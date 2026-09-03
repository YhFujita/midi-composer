import { NoteEvent, ParsedScore, ParseError, Track, TempoEvent, TimeSignatureEvent, MasterKeyEvent, ParseMMLOptions, PedalEvent, MmlTimelineItem } from '../../types/mml';
import { pitchToMidi, midiToPitch, parseDurationLength, getTripletInfo } from '../../utils/noteConverter';

interface TrackState {
  id: number;
  name: string;
  channel: number;
  instrument: number;
  octave: number;
  defaultLength: number;
  velocity: number;
  gateRate: number;    // ゲートタイム率 (0.0 - 1.0)
  keyShift: number;    // トラック個別の移調量 (半音単位, 例: -1, +2)
  initialKey?: number; // トラック開始時の初期移調量
  currentTime: number; // 4分音符基準の累積時間
  notes: NoteEvent[];
  tempoEvents: TempoEvent[];
  timeSignatureEvents: TimeSignatureEvent[];
  isPedalOn: boolean;
  pedalEvents: PedalEvent[];
  activePedalNotes: NoteEvent[];
  pendingTieOrSlur: boolean; // 直前の音符から '&' または '^' で繋がるフラグ
  lastNoteGroup: NoteEvent[] | null; // 直前の音符群 (単音または和音)
  inExplicitSlur: boolean; // Slur(...) や SlurOn によるスラーモード中か
  explicitSlurParenDepth: number; // Slur(...) のカッコ深さ
  currentExplicitSlurId?: number; // 現在のスラーグループID
  explicitSlurNotes: NoteEvent[]; // 明示的スラーに属する音符リスト
  currentSlurGroupCount: number; // スラーグループ採番カウンタ
  currentTupletGroupCount: number; // 連符グループ採番カウンタ
}

export function parseMML(mmlCode: string, options?: ParseMMLOptions): ParsedScore {
  const errors: ParseError[] = [];
  const tracksMap = new Map<number, TrackState>();
  const timelineItems: MmlTimelineItem[] = [];
  const tempoEvents: TempoEvent[] = [{ time: 0, bpm: 120 }];
  const timeSignatures: TimeSignatureEvent[] = [{ time: 0, numerator: 4, denominator: 4 }];
  const masterKeyEvents: MasterKeyEvent[] = [{ time: 0, shift: 0 }];
  const uiGlobalKeyShift = options?.globalKeyShift || 0;
  let scoreTitle: string | undefined;

  // 指定時刻における全体移調量 (MasterKey) を取得
  function getMasterKeyAt(time: number): number {
    let shift = 0;
    for (const ev of masterKeyEvents) {
      if (time >= ev.time) {
        shift = ev.shift;
      } else {
        break;
      }
    }
    return shift;
  }

  // デフォルトの第1トラック(ID: 0)を初期化
  function getOrCreateTrack(trackId: number): TrackState {
    if (!tracksMap.has(trackId)) {
      tracksMap.set(trackId, {
        id: trackId,
        name: `Track ${trackId + 1}`,
        channel: Math.min(16, Math.max(1, trackId + 1)),
        instrument: 0, // Acoustic Grand Piano
        octave: 4,
        defaultLength: 4,
        velocity: 100,
        gateRate: 1.0,
        keyShift: 0,
        currentTime: 0,
        notes: [],
        tempoEvents: [],
        timeSignatureEvents: [],
        isPedalOn: false,
        pedalEvents: [],
        activePedalNotes: [],
        pendingTieOrSlur: false,
        lastNoteGroup: null,
        inExplicitSlur: false,
        explicitSlurParenDepth: 0,
        explicitSlurNotes: [],
        currentSlurGroupCount: 0,
        currentTupletGroupCount: 0,
      });
    }
    return tracksMap.get(trackId)!;
  }

  // 音符群をトラックへ登録（タイ・スラーの接続およびペダル適用）
  function registerNotesToTrack(
    track: TrackState,
    notes: NoteEvent[],
    hasTrailingTieOrSlur: boolean
  ) {
    // 1. 直前の音符からのタイ・スラー接続チェック
    if (track.pendingTieOrSlur && track.lastNoteGroup && track.lastNoteGroup.length > 0) {
      const prev = track.lastNoteGroup;
      // 同一音高判定 (単音または和音構成音がすべて一致)
      const isSamePitch =
        prev.length === notes.length &&
        prev.every((pn, idx) => pn.midiNote === notes[idx].midiNote);

      if (isSamePitch) {
        // タイ (Tie) として結合
        prev.forEach((pn) => {
          pn.hasTieToNext = true;
        });
        notes.forEach((cn) => {
          cn.hasTieFromPrev = true;
        });
      } else {
        // 異なる音高 -> スラー (Slur) として結合
        const prevSlurId = prev[0].slurGroupId;
        const slurId = prevSlurId !== undefined ? prevSlurId : ++track.currentSlurGroupCount;
        if (prevSlurId === undefined) {
          prev.forEach((pn) => {
            pn.slurGroupId = slurId;
            pn.isSlurStart = true;
            pn.gateRate = 1.0;
            pn.gateDuration = pn.duration;
          });
        }
        notes.forEach((cn) => {
          cn.slurGroupId = slurId;
          cn.gateRate = 1.0;
          cn.gateDuration = cn.duration;
        });
        // 以前の終了フラグをクリアし、現在の音に終了フラグを設定
        prev.forEach((pn) => {
          pn.isSlurEnd = false;
        });
        notes.forEach((cn) => {
          cn.isSlurEnd = true;
        });
      }
      track.pendingTieOrSlur = false;
    }

    // 2. 明示的スラーモード (SlurOn や Slur(...) ) の適用
    if (track.inExplicitSlur && track.currentExplicitSlurId !== undefined) {
      notes.forEach((cn) => {
        cn.slurGroupId = track.currentExplicitSlurId;
        cn.gateRate = 1.0;
        cn.gateDuration = cn.duration;
      });
      if (track.explicitSlurNotes.length === 0) {
        notes.forEach((cn) => (cn.isSlurStart = true));
      } else {
        // 前の音の isSlurEnd を解除
        track.explicitSlurNotes.forEach((pn) => (pn.isSlurEnd = false));
      }
      notes.forEach((cn) => (cn.isSlurEnd = true));
      track.explicitSlurNotes.push(...notes);
    }

    // ペダル処理 & ノート追加
    notes.forEach((n) => {
      if (track.isPedalOn) {
        n.hasPedal = true;
        track.activePedalNotes.push(n);
      }
      track.notes.push(n);
    });

    track.lastNoteGroup = notes;
    track.pendingTieOrSlur = hasTrailingTieOrSlur;
  }

  let currentTrackId = 0;
  let currentTrack = getOrCreateTrack(currentTrackId);

  // コメントの除去と位置情報の保持
  const lines = mmlCode.split('\n');
  let inBlockComment = false;

  // 先頭コメントからタイトル候補を抽出
  for (const line of lines) {
    const trimmed = line.trim();
    if (!scoreTitle && trimmed.startsWith('//')) {
      const commentContent = trimmed.replace(/^\/\/\s*/, '').trim();
      // "テンポ" や "Track" やディレクティブで始まらない最初のコメントをタイトル候補とする
      if (
        commentContent &&
        !commentContent.startsWith('テンポ') &&
        !commentContent.startsWith('Tempo') &&
        !commentContent.startsWith('Track') &&
        !commentContent.startsWith('TR') &&
        !commentContent.startsWith('Voice')
      ) {
        scoreTitle = commentContent.replace(/^Title[:\s=]*/i, '').trim();
        break;
      }
    } else if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
      break;
    }
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    let col = 0;
    while (col < rawLine.length) {
      // ブロックコメント処理
      if (inBlockComment) {
        const endCommentIdx = rawLine.indexOf('*/', col);
        if (endCommentIdx !== -1) {
          inBlockComment = false;
          col = endCommentIdx + 2;
          continue;
        } else {
          break; // この行はすべてブロックコメント内
        }
      }

      // コメント開始チェック
      if (rawLine.startsWith('/*', col)) {
        inBlockComment = true;
        col += 2;
        continue;
      }
      if (rawLine.startsWith('//', col) || rawLine.startsWith(';', col)) {
        break; // 行末までコメント
      }

      const char = rawLine[col];

      // 空白文字スキップ
      if (/\s/.test(char)) {
        col++;
        continue;
      }

      // コマンド解析 (大文字・小文字両対応)
      const remaining = rawLine.slice(col);

      // 0. 小節線 | やカンマ , などの区切り記号をスキップ
      if (char === '|' || char === ',') {
        col++;
        continue;
      }

      // 0.01 タイ・スラー接続記号 (& または ^) が単独で現れた場合
      if (char === '&' || char === '^') {
        if (currentTrack.lastNoteGroup && currentTrack.lastNoteGroup.length > 0) {
          currentTrack.pendingTieOrSlur = true;
        }
        col++;
        continue;
      }

      // 0.05 スラー開始: Slur( ... )
      const slurCallMatch = remaining.match(/^Slur\s*\(/i);
      if (slurCallMatch) {
        currentTrack.inExplicitSlur = true;
        currentTrack.explicitSlurParenDepth = (currentTrack.explicitSlurParenDepth || 0) + 1;
        currentTrack.currentExplicitSlurId = ++currentTrack.currentSlurGroupCount;
        currentTrack.explicitSlurNotes = [];
        col += slurCallMatch[0].length;
        continue;
      }

      // 0.06 スラー区間コマンド: SlurOn / SlurOff
      const slurOnMatch = remaining.match(/^(?:SlurOn|Slur_On|_slur\b)/i);
      if (slurOnMatch) {
        currentTrack.inExplicitSlur = true;
        currentTrack.currentExplicitSlurId = ++currentTrack.currentSlurGroupCount;
        currentTrack.explicitSlurNotes = [];
        col += slurOnMatch[0].length;
        continue;
      }

      const slurOffMatch = remaining.match(/^(?:SlurOff|Slur_Off|_slur\*)/i);
      if (slurOffMatch) {
        currentTrack.inExplicitSlur = false;
        currentTrack.explicitSlurNotes = [];
        col += slurOffMatch[0].length;
        continue;
      }

      // 0.1 タイトル設定: Title("..."), Title = "..."
      const titleMatch = remaining.match(/^(?:Title\s*\(?\s*["'「]([^"'」]+)["'」]\s*\)?|Title\s*=\s*"([^"]*)")/i);
      if (titleMatch) {
        scoreTitle = (titleMatch[1] || titleMatch[2] || '').trim();
        col += titleMatch[0].length;
        continue;
      }

      // 0.2 トラック名設定: TrackName("..."), TrackName = "...", Name("...")
      const trackNameMatch = remaining.match(/^(?:(?:TrackName|Name)\s*\(?\s*["'「]([^"'」]+)["'」]\s*\)?|(?:TrackName|Name)\s*=\s*"([^"]*)")/i);
      if (trackNameMatch) {
        const tName = (trackNameMatch[1] || trackNameMatch[2] || '').trim();
        if (tName) currentTrack.name = tName;
        col += trackNameMatch[0].length;
        continue;
      }

      // 0.3 その他文字列設定
      const strAssignMatch = remaining.match(/^[a-zA-Z_]+\s*=\s*"[^"]*"/);
      if (strAssignMatch) {
        col += strAssignMatch[0].length;
        continue;
      }

      // 0.4 ドットコマンド (System.Time 等)
      const dotCmdMatch = remaining.match(/^[a-zA-Z_]+\.[a-zA-Z_]+\s*(\([^)]*\))?/);
      if (dotCmdMatch) {
        col += dotCmdMatch[0].length;
        continue;
      }

      // 0.5 ゲートタイム (q8, q100, Gate(80), Gate=80 等)
      const gateMatch = remaining.match(/^(?:q\s*(\d+)|GATE(?:\s*\(\s*|\s*=\s*|\s+)?(\d+)\s*\)?)/i);
      if (gateMatch) {
        const rawVal = parseInt(gateMatch[1] || gateMatch[2], 10);
        if (!isNaN(rawVal)) {
          let rate = 1.0;
          if (rawVal === 0) {
            rate = 0.05;
          } else if (rawVal <= 8) {
            // 8段階指定 (1〜8: 12.5%〜100%)
            rate = rawVal / 8;
          } else {
            // パーセント指定 (9〜100+)
            rate = Math.min(1.0, rawVal / 100);
          }
          currentTrack.gateRate = Math.max(0.01, rate);
        }
        col += gateMatch[0].length;
        continue;
      }

      // 0.55 ペダル (サステイン / ダンパーペダル)
      // ペダルOFF (離す): PedalOff, Pedal(off), Pedal(0), P(off), P(0), P0, _P*, または小文字 _p
      const pedalOffMatch = remaining.match(/^(?:PedalOff|Pedal\s*\(\s*(?:off|0)\s*\)|P\s*\(\s*(?:off|0)\s*\)|P0\b|_P\*)/i)
        || remaining.match(/^(_p\b)/);
      if (pedalOffMatch) {
        currentTrack.isPedalOn = false;
        currentTrack.pedalEvents.push({
          time: currentTrack.currentTime,
          type: 'off',
          trackId: currentTrack.id,
          channel: currentTrack.channel,
        });
        currentTrack.activePedalNotes.forEach((n) => {
          n.pedalReleaseTime = currentTrack.currentTime;
        });
        currentTrack.activePedalNotes = [];
        col += pedalOffMatch[0].length;
        continue;
      }

      // ペダルON (踏む): Pedal, Pedal(on), Pedal(1), Pedal(), P(on), P(1), P1, _P
      const pedalOnMatch = remaining.match(/^(?:Pedal(?:\s*\(\s*(?:on|1|127)?\s*\))?|P\s*\(\s*(?:on|1|127)\s*\)|P1\b|_P\b)/i);
      if (pedalOnMatch) {
        if (!currentTrack.isPedalOn) {
          currentTrack.isPedalOn = true;
          currentTrack.pedalEvents.push({
            time: currentTrack.currentTime,
            type: 'on',
            trackId: currentTrack.id,
            channel: currentTrack.channel,
          });
        }
        col += pedalOnMatch[0].length;
        continue;
      }

      // 0.6 パン・モジュレーション (p64, Pan(64), m0)
      const panModMatch = remaining.match(/^(?:(?:PAN|MOD)\(?=?\s*\d+\)?|[pm]\s*\d+)/i);
      if (panModMatch) {
        col += panModMatch[0].length;
        continue;
      }

      // 1. トラック指定: TR(n), Track(n), TR=n, TRn
      const trackMatch = remaining.match(/^(?:TR(?:ACK)?\(?=?\s*(\d+)\)?)/i);
      if (trackMatch) {
        const rawTrNum = parseInt(trackMatch[1], 10);
        currentTrackId = rawTrNum > 0 ? rawTrNum - 1 : 0;
        currentTrack = getOrCreateTrack(currentTrackId);
        timelineItems.push({
          line: lineNumber,
          startColumn: col + 1,
          endColumn: col + trackMatch[0].length,
          trackId: currentTrack.id,
          beat: currentTrack.currentTime,
          type: 'track',
        });
        col += trackMatch[0].length;
        continue;
      }

      // 2. チャンネル指定: CH(n), Channel(n), CH=n
      const chMatch = remaining.match(/^(?:CH(?:ANNEL)?\(?=?\s*(\d+)\)?)/i);
      if (chMatch) {
        const chNum = parseInt(chMatch[1], 10);
        currentTrack.channel = Math.max(1, Math.min(16, chNum));
        col += chMatch[0].length;
        continue;
      }

      // 3. 音色 (Program / Voice): Voice(n), @n, Program(n)
      const voiceMatch = remaining.match(/^(?:(?:VOICE|PROGRAM)\(?=?\s*(\d+)\)?|@\s*(\d+))/i);
      if (voiceMatch) {
        const progNum = parseInt(voiceMatch[1] || voiceMatch[2], 10);
        currentTrack.instrument = Math.max(0, Math.min(127, progNum));
        col += voiceMatch[0].length;
        continue;
      }

      // 4. テンポ: Tempo(n), TEMPO=n, t(n), tn
      const tempoMatch = remaining.match(/^(?:TEMPO\(?=?\s*(\d+)\)?|t\s*(\d+))/i);
      if (tempoMatch) {
        const bpm = parseInt(tempoMatch[1] || tempoMatch[2], 10);
        if (bpm >= 20 && bpm <= 400) {
          const tEvent = {
            time: currentTrack.currentTime,
            bpm,
          };
          tempoEvents.push(tEvent);
          currentTrack.tempoEvents.push(tEvent);
        }
        col += tempoMatch[0].length;
        continue;
      }

      // 5. 拍子: TimeSignature(4,4), Time(4,4)
      const timeSigMatch = remaining.match(/^(?:TIME(?:SIGNATURE)?\(\s*(\d+)\s*,\s*(\d+)\s*\))/i);
      if (timeSigMatch) {
        const num = parseInt(timeSigMatch[1], 10);
        const den = parseInt(timeSigMatch[2], 10);
        const sigEvent = {
          time: currentTrack.currentTime,
          numerator: num,
          denominator: den,
        };
        timeSignatures.push(sigEvent);
        currentTrack.timeSignatureEvents.push(sigEvent);
        col += timeSigMatch[0].length;
        continue;
      }

      // 5.1 全体移調 (MasterKey / MasterTranspose): MasterKey(-1), MasterKey(2), MasterKey = -1, MasterKey-1 等
      const masterKeyMatch = remaining.match(/^(?:Master(?:Key|Transpose)(?:\s*\(\s*([+-]?\d+)\s*\)|(?:\s*=\s*|\s*)([+-]?\d+)))/i);
      if (masterKeyMatch) {
        const rawStr = masterKeyMatch[1] ?? masterKeyMatch[2];
        const shiftVal = parseInt(rawStr, 10);
        if (!isNaN(shiftVal)) {
          // 同一時刻のイベントがあれば上書き、なければ追加
          const existing = masterKeyEvents.find((ev) => ev.time === currentTrack.currentTime);
          if (existing) {
            existing.shift = shiftVal;
          } else {
            masterKeyEvents.push({
              time: currentTrack.currentTime,
              shift: shiftVal,
            });
            masterKeyEvents.sort((a, b) => a.time - b.time);
          }
        }
        col += masterKeyMatch[0].length;
        continue;
      }

      // 5.2 トラック移調 (Key / Transpose / _k): Key(-1), Key(2), Key = -1, Key-1, Transpose(-1), _k(-1) 等
      const keyMatch = remaining.match(/^(?:(?:Key|Transpose)(?:\s*\(\s*([+-]?\d+)\s*\)|(?:\s*=\s*|\s*)([+-]?\d+))|_k(?:\s*\(\s*([+-]?\d+)\s*\)|(?:\s*=\s*|\s*)([+-]?\d+)))/i);
      if (keyMatch) {
        const rawStr = keyMatch[1] ?? keyMatch[2] ?? keyMatch[3] ?? keyMatch[4];
        const shiftVal = parseInt(rawStr, 10);
        if (!isNaN(shiftVal)) {
          currentTrack.keyShift = shiftVal;
          if (currentTrack.initialKey === undefined && currentTrack.currentTime === 0) {
            currentTrack.initialKey = shiftVal;
          }
        }
        col += keyMatch[0].length;
        continue;
      }

      // 6. デフォルト音長: l4, l8, l16, Length(4)
      const lenMatch = remaining.match(/^(?:l\s*(\d+\.?)|LENGTH\(?=?\s*(\d+\.?)\)?)/i);
      if (lenMatch) {
        const lStr = lenMatch[1] || lenMatch[2];
        const val = parseFloat(lStr);
        if (!isNaN(val) && val > 0) {
          currentTrack.defaultLength = val;
        }
        col += lenMatch[0].length;
        continue;
      }

      // 7. オクターブ指定: o4, o5, Octave(4)
      const octMatch = remaining.match(/^(?:o\s*(\d+)|OCTAVE\(?=?\s*(\d+)\)?)/i);
      if (octMatch) {
        const oct = parseInt(octMatch[1] || octMatch[2], 10);
        if (oct >= 0 && oct <= 9) {
          currentTrack.octave = oct;
        }
        col += octMatch[0].length;
        continue;
      }

      // 8. オクターブシフト: > (up), < (down)
      if (char === '>') {
        if (currentTrack.octave < 9) currentTrack.octave++;
        col++;
        continue;
      }
      if (char === '<') {
        if (currentTrack.octave > 0) currentTrack.octave--;
        col++;
        continue;
      }

      // 9. ベロシティ (音量): v100, Volume(100), (, )
      const velMatch = remaining.match(/^(?:v\s*(\d+)|VOLUME\(?=?\s*(\d+)\)?)/i);
      if (velMatch) {
        const vel = parseInt(velMatch[1] || velMatch[2], 10);
        currentTrack.velocity = Math.max(0, Math.min(127, vel));
        col += velMatch[0].length;
        continue;
      }
      if (char === '(') {
        currentTrack.velocity = Math.min(127, currentTrack.velocity + 8);
        col++;
        continue;
      }
      if (char === ')') {
        if (currentTrack.explicitSlurParenDepth > 0) {
          currentTrack.explicitSlurParenDepth--;
          if (currentTrack.explicitSlurParenDepth === 0) {
            currentTrack.inExplicitSlur = false;
            currentTrack.explicitSlurNotes = [];
          }
          col++;
          continue;
        }
        currentTrack.velocity = Math.max(0, currentTrack.velocity - 8);
        col++;
        continue;
      }

      // 9.5 連符 (3連符など): { c d e }4, { c d e }8, { [ceg] [dfa] [egb] }4, { c r e }4 等
      if (char === '{') {
        const tupletCloseIdx = remaining.indexOf('}');
        if (tupletCloseIdx === -1) {
          errors.push({
            message: '連符の終了記号 "}" が見つかりません',
            line: lineNumber,
            column: col + 1,
          });
          col++;
          continue;
        }

        const tupletContent = remaining.slice(1, tupletCloseIdx);
        const afterTuplet = remaining.slice(tupletCloseIdx + 1);
        const tupletLenMatch = afterTuplet.match(/^((?:[\^&]?\d*\.*)+)/);
        const tupletLenStr = tupletLenMatch ? tupletLenMatch[1] : '';
        const tupletLenCharsUsed = tupletLenMatch ? tupletLenMatch[0].length : 0;
        const tupletDuration = parseDurationLength(tupletLenStr, currentTrack.defaultLength);

        // 連符内の要素を解析
        interface ParsedTupletItem {
          type: 'note' | 'chord' | 'rest';
          colOffset: number;
          rawLength: number;
          pitch?: string;
          midiNote?: number;
          originalPitch?: string;
          keyShift?: number;
          chordNotes?: { pitch: string; midiNote: number; originalPitch: string; keyShift: number }[];
          isStrum?: boolean;
          strumDirection?: 'down' | 'up';
          strumDelaySec?: number;
        }

        const tupletItems: ParsedTupletItem[] = [];
        let tIdx = 0;
        let tempOctave = currentTrack.octave;
        let tempVelocity = currentTrack.velocity;

        while (tIdx < tupletContent.length) {
          const tChar = tupletContent[tIdx];
          if (/\s/.test(tChar)) {
            tIdx++;
            continue;
          }

          const tRemaining = tupletContent.slice(tIdx);

          // オクターブ操作
          if (tChar === '>') {
            if (tempOctave < 9) tempOctave++;
            tIdx++;
            continue;
          }
          if (tChar === '<') {
            if (tempOctave > 0) tempOctave--;
            tIdx++;
            continue;
          }
          const tOctMatch = tRemaining.match(/^(?:o\s*(\d+)|OCTAVE\(?=?\s*(\d+)\)?)/i);
          if (tOctMatch) {
            const octVal = parseInt(tOctMatch[1] || tOctMatch[2], 10);
            if (octVal >= 0 && octVal <= 9) tempOctave = octVal;
            tIdx += tOctMatch[0].length;
            continue;
          }

          // ベロシティ操作
          const tVelMatch = tRemaining.match(/^(?:v\s*(\d+)|VOLUME\(?=?\s*(\d+)\)?)/i);
          if (tVelMatch) {
            const vVal = parseInt(tVelMatch[1] || tVelMatch[2], 10);
            tempVelocity = Math.max(0, Math.min(127, vVal));
            tIdx += tVelMatch[0].length;
            continue;
          }
          if (tChar === '(') {
            tempVelocity = Math.min(127, tempVelocity + 8);
            tIdx++;
            continue;
          }
          if (tChar === ')') {
            tempVelocity = Math.max(0, tempVelocity - 8);
            tIdx++;
            continue;
          }

          // 休符
          if (tChar.toLowerCase() === 'r') {
            tupletItems.push({
              type: 'rest',
              colOffset: tIdx,
              rawLength: 1,
            });
            tIdx++;
            continue;
          }

          // 和音
          if (tChar === '[') {
            const closeBracket = tRemaining.indexOf(']');
            if (closeBracket !== -1) {
              let insideChord = tRemaining.slice(1, closeBracket);
              let cOct = tempOctave;
              const cNotes: { pitch: string; midiNote: number; originalPitch: string; keyShift: number }[] = [];
              let ci = 0;
              let isStrum = false;
              let strumDirection: 'down' | 'up' = 'down';
              let strumDelaySec = 0.035;

              const strumM = insideChord.match(/^(\s*~(?:\^|\-)?(\d+)?\s*)/);
              if (strumM) {
                isStrum = true;
                if (strumM[1].includes('^') || strumM[1].includes('-')) strumDirection = 'up';
                if (strumM[2]) {
                  const num = parseInt(strumM[2], 10);
                  if (num === 16) strumDelaySec = 0.07;
                  else if (num === 32) strumDelaySec = 0.035;
                  else if (num === 64) strumDelaySec = 0.018;
                  else if (num > 0) strumDelaySec = Math.max(0.01, Math.min(0.2, 1.0 / num));
                }
                insideChord = insideChord.slice(strumM[0].length);
              }

              while (ci < insideChord.length) {
                const cc = insideChord[ci];
                if (cc === '>') { if (cOct < 9) cOct++; ci++; continue; }
                if (cc === '<') { if (cOct > 0) cOct--; ci++; continue; }
                if (cc === "'") { if (cOct < 9) cOct++; ci++; continue; }
                const nm = insideChord.slice(ci).match(/^([a-gA-G])([#\+\-_b]?)/);
                if (nm) {
                  const pLet = nm[1].toUpperCase();
                  let acc = nm[2] || '';
                  if (acc === '+') acc = '#';
                  if (acc === '_') acc = '-';
                  const fPitch = `${pLet}${acc}${cOct}`;
                  const bMidi = pitchToMidi(fPitch);
                  const mShift = getMasterKeyAt(currentTrack.currentTime);
                  const tShift = currentTrack.keyShift + mShift + uiGlobalKeyShift;
                  const transMidi = Math.max(0, Math.min(127, bMidi + tShift));
                  cNotes.push({
                    pitch: midiToPitch(transMidi),
                    midiNote: transMidi,
                    originalPitch: fPitch,
                    keyShift: tShift,
                  });
                  ci += nm[0].length;
                  continue;
                }
                ci++;
              }

              tupletItems.push({
                type: 'chord',
                colOffset: tIdx,
                rawLength: closeBracket + 1,
                chordNotes: cNotes,
                isStrum,
                strumDirection,
                strumDelaySec,
              });
              tIdx += closeBracket + 1;
              continue;
            }
          }

          // 単音符
          const nMatch = tRemaining.match(/^([a-gA-G])([#\+\-_b]?)/i);
          if (nMatch) {
            const pLet = nMatch[1].toUpperCase();
            let acc = nMatch[2] || '';
            if (acc === '+') acc = '#';
            if (acc === '_') acc = '-';
            const fPitch = `${pLet}${acc}${tempOctave}`;
            const bMidi = pitchToMidi(fPitch);
            const mShift = getMasterKeyAt(currentTrack.currentTime);
            const tShift = currentTrack.keyShift + mShift + uiGlobalKeyShift;
            const transMidi = Math.max(0, Math.min(127, bMidi + tShift));
            tupletItems.push({
              type: 'note',
              colOffset: tIdx,
              rawLength: nMatch[0].length,
              pitch: midiToPitch(transMidi),
              midiNote: transMidi,
              originalPitch: fPitch,
              keyShift: tShift,
            });
            tIdx += nMatch[0].length;
            continue;
          }

          tIdx++;
        }

        currentTrack.octave = tempOctave;
        currentTrack.velocity = tempVelocity;

        if (tupletItems.length > 0) {
          const tupletId = ++currentTrack.currentTupletGroupCount;
          const numNotes = tupletItems.length;
          const notesOccupied = numNotes === 3 ? 2 : (numNotes === 5 || numNotes === 6 || numNotes === 7 ? 4 : 2);
          const stepDuration = tupletDuration / numNotes;
          const tupletStartBeat = currentTrack.currentTime;

          tupletItems.forEach((item, itemIdx) => {
            const itemStartBeat = tupletStartBeat + (tupletDuration * itemIdx) / numNotes;
            const itemCol = col + 1 + 1 + item.colOffset;

            if (item.type === 'rest') {
              currentTrack.pendingTieOrSlur = false;
              currentTrack.lastNoteGroup = null;
              timelineItems.push({
                line: lineNumber,
                startColumn: itemCol,
                endColumn: itemCol + item.rawLength,
                trackId: currentTrack.id,
                beat: itemStartBeat,
                type: 'rest',
              });
            } else if (item.type === 'note' && item.pitch && item.midiNote !== undefined) {
              const noteEvent: NoteEvent = {
                pitch: item.pitch,
                midiNote: item.midiNote,
                originalPitch: item.originalPitch,
                keyShift: item.keyShift,
                startTime: itemStartBeat,
                duration: stepDuration,
                velocity: currentTrack.velocity,
                gateRate: currentTrack.gateRate,
                gateDuration: stepDuration * currentTrack.gateRate,
                trackId: currentTrack.id,
                channel: currentTrack.channel,
                instrument: currentTrack.instrument,
                isTuplet: true,
                tupletGroupId: tupletId,
                tupletNumber: numNotes,
                tupletOccupied: notesOccupied,
                line: lineNumber,
                column: itemCol,
              };
              registerNotesToTrack(currentTrack, [noteEvent], false);
              timelineItems.push({
                line: lineNumber,
                startColumn: itemCol,
                endColumn: itemCol + item.rawLength,
                trackId: currentTrack.id,
                beat: itemStartBeat,
                type: 'note',
              });
            } else if (item.type === 'chord' && item.chordNotes && item.chordNotes.length > 0) {
              const chordNotes: NoteEvent[] = item.chordNotes.map((cn) => ({
                pitch: cn.pitch,
                midiNote: cn.midiNote,
                originalPitch: cn.originalPitch,
                keyShift: cn.keyShift,
                startTime: itemStartBeat,
                duration: stepDuration,
                velocity: currentTrack.velocity,
                gateRate: currentTrack.gateRate,
                gateDuration: stepDuration * currentTrack.gateRate,
                trackId: currentTrack.id,
                channel: currentTrack.channel,
                instrument: currentTrack.instrument,
                isChord: true,
                isTuplet: true,
                tupletGroupId: tupletId,
                tupletNumber: numNotes,
                tupletOccupied: notesOccupied,
                line: lineNumber,
                column: itemCol,
              }));

              if (item.isStrum) {
                const sorted = [...chordNotes].sort((a, b) =>
                  item.strumDirection === 'down' ? a.midiNote - b.midiNote : b.midiNote - a.midiNote
                );
                sorted.forEach((note, sIdx) => {
                  note.isStrum = true;
                  note.strumDirection = item.strumDirection;
                  note.strumDelaySec = item.strumDelaySec;
                  note.strumOrder = sIdx;
                  note.strumTotal = sorted.length;
                });
              }

              registerNotesToTrack(currentTrack, chordNotes, false);
              timelineItems.push({
                line: lineNumber,
                startColumn: itemCol,
                endColumn: itemCol + item.rawLength,
                trackId: currentTrack.id,
                beat: itemStartBeat,
                type: 'note',
              });
            }
          });

          currentTrack.currentTime = tupletStartBeat + tupletDuration;
        }

        const tupletFullTokenLen = 1 + tupletCloseIdx + tupletLenCharsUsed;
        col += tupletFullTokenLen;
        continue;
      }

      // 10. 和音: [ceg]4, [~ceg]4, [~^ceg]4, [ceg]~4 など (バラシ演奏対応)
      if (char === '[') {
        const chordCloseIdx = remaining.indexOf(']');
        if (chordCloseIdx !== -1) {
          let chordContent = remaining.slice(1, chordCloseIdx);
          let afterChord = remaining.slice(chordCloseIdx + 1);

          // バラシ (ギターストローク / ロール) 記号の検出
          let isStrum = false;
          let strumDirection: 'down' | 'up' = 'down';
          let strumDelaySec = 0.035; // デフォルトストローク間隔 (約35ms)

          // 1. コード内部先頭のチルダ: [~ceg]4, [~^ceg]4, [~32ceg]4
          const insideStrumMatch = chordContent.match(/^(\s*~(?:\^|\-)?(\d+)?\s*)/);
          if (insideStrumMatch) {
            isStrum = true;
            const fullMatch = insideStrumMatch[1];
            if (fullMatch.includes('^') || fullMatch.includes('-')) {
              strumDirection = 'up';
            }
            const speedVal = insideStrumMatch[2];
            if (speedVal) {
              const num = parseInt(speedVal, 10);
              if (num === 16) strumDelaySec = 0.07;
              else if (num === 32) strumDelaySec = 0.035;
              else if (num === 64) strumDelaySec = 0.018;
              else if (num > 0) strumDelaySec = Math.max(0.01, Math.min(0.2, 1.0 / num));
            }
            chordContent = chordContent.slice(insideStrumMatch[0].length);
          }

          // 2. コード内部末尾のチルダ: [ceg~]4
          const insideEndStrumMatch = chordContent.match(/(\s*~(?:\^|\-)?(\d+)?\s*)$/);
          if (insideEndStrumMatch && !isStrum) {
            isStrum = true;
            if (insideEndStrumMatch[1].includes('^') || insideEndStrumMatch[1].includes('-')) {
              strumDirection = 'up';
            }
            chordContent = chordContent.slice(0, -insideEndStrumMatch[0].length);
          }

          // 3. コード直後のチルダ: [ceg]~4, [ceg]~^4
          let afterStrumLen = 0;
          const afterStrumMatch = afterChord.match(/^~(?:\^|\-)?(\d+)?/);
          if (afterStrumMatch) {
            isStrum = true;
            if (afterStrumMatch[0].includes('^') || afterStrumMatch[0].includes('-')) {
              strumDirection = 'up';
            }
            if (afterStrumMatch[1]) {
              const num = parseInt(afterStrumMatch[1], 10);
              if (num === 16) strumDelaySec = 0.07;
              else if (num === 32) strumDelaySec = 0.035;
              else if (num === 64) strumDelaySec = 0.018;
              else if (num > 0) strumDelaySec = Math.max(0.01, Math.min(0.2, 1.0 / num));
            }
            afterStrumLen = afterStrumMatch[0].length;
            afterChord = afterChord.slice(afterStrumLen);
          }

          // 和音の長さを解析
          const chordLenMatch = afterChord.match(/^((?:[\^&]?\d*\.*)+)/);
          const chordLenStr = chordLenMatch ? chordLenMatch[1] : '';
          let lenCharsUsed = chordLenMatch ? chordLenMatch[0].length : 0;
          const afterLen = afterChord.slice(lenCharsUsed);

          // 4. 音長直後のチルダ: [ceg]4~
          const trailingStrumMatch = afterLen.match(/^~(?:\^|\-)?(\d+)?/);
          if (trailingStrumMatch) {
            isStrum = true;
            if (trailingStrumMatch[0].includes('^') || trailingStrumMatch[0].includes('-')) {
              strumDirection = 'up';
            }
            lenCharsUsed += trailingStrumMatch[0].length;
          }

          const chordDuration = parseDurationLength(chordLenStr, currentTrack.defaultLength);

          // 和音内の各音符を解析
          const chordNotes: NoteEvent[] = [];
          let chordOctave = currentTrack.octave;
          let cIdx = 0;
          while (cIdx < chordContent.length) {
            const cChar = chordContent[cIdx];
            if (cChar === '>') {
              if (chordOctave < 9) chordOctave++;
              cIdx++;
              continue;
            }
            if (cChar === '<') {
              if (chordOctave > 0) chordOctave--;
              cIdx++;
              continue;
            }
            if (cChar === "'") {
              if (chordOctave < 9) chordOctave++;
              cIdx++;
              continue;
            }

            const noteMatch = chordContent.slice(cIdx).match(/^([a-gA-G])([#\+\-_b]?)/);
            if (noteMatch) {
              const pitchLetter = noteMatch[1].toUpperCase();
              let acc = noteMatch[2] || '';
              if (acc === '+') acc = '#';
              if (acc === '_') acc = '-';

              const fullPitch = `${pitchLetter}${acc}${chordOctave}`;
              const baseMidi = pitchToMidi(fullPitch);
              const masterShift = getMasterKeyAt(currentTrack.currentTime);
              const totalShift = currentTrack.keyShift + masterShift + uiGlobalKeyShift;
              const transposedMidi = Math.max(0, Math.min(127, baseMidi + totalShift));
              const finalPitch = midiToPitch(transposedMidi);

              const chordTripInfo = getTripletInfo(chordDuration);
              chordNotes.push({
                pitch: finalPitch,
                midiNote: transposedMidi,
                originalPitch: fullPitch,
                keyShift: totalShift,
                startTime: currentTrack.currentTime,
                duration: chordDuration,
                velocity: currentTrack.velocity,
                gateRate: currentTrack.gateRate,
                gateDuration: chordDuration * currentTrack.gateRate,
                trackId: currentTrack.id,
                channel: currentTrack.channel,
                instrument: currentTrack.instrument,
                isChord: true,
                isTuplet: chordTripInfo ? true : undefined,
                tupletNumber: chordTripInfo ? 3 : undefined,
                tupletOccupied: chordTripInfo ? 2 : undefined,
                line: lineNumber,
                column: col + 1,
              });

              cIdx += noteMatch[0].length;
              continue;
            }

            cIdx++;
          }

          // バラシ設定を構成音に付与
          if (chordNotes.length > 0) {
            if (isStrum) {
              // ピッチ順（低音→高音 / 高音→低音）で発音インデックスを設定
              const sorted = [...chordNotes].sort((a, b) =>
                strumDirection === 'down' ? a.midiNote - b.midiNote : b.midiNote - a.midiNote
              );

              sorted.forEach((note, idx) => {
                note.isStrum = true;
                note.strumDirection = strumDirection;
                note.strumDelaySec = strumDelaySec;
                note.strumOrder = idx;
                note.strumTotal = sorted.length;
              });
            }

            const hasTrailingTie = /[\^&]$/.test(chordLenStr);
            registerNotesToTrack(currentTrack, chordNotes, hasTrailingTie);
          }

          const chordTokenLen = 1 + chordCloseIdx + afterStrumLen + lenCharsUsed;
          timelineItems.push({
            line: lineNumber,
            startColumn: col + 1,
            endColumn: col + chordTokenLen,
            trackId: currentTrack.id,
            beat: currentTrack.currentTime,
            type: 'note',
          });

          currentTrack.currentTime += chordDuration;
          col += chordTokenLen;
          continue;
        } else {
          errors.push({
            message: '和音の終了記号 "]" が見つかりません',
            line: lineNumber,
            column: col + 1,
          });
          col++;
          continue;
        }
      }

      // 11. 休符: r, r4, r8., r4^4
      const restMatch = remaining.match(/^r((?:[\^&]?\d*\.*)*)/i);
      if (restMatch) {
        currentTrack.pendingTieOrSlur = false;
        currentTrack.lastNoteGroup = null;
        const restLenStr = restMatch[1];
        const duration = parseDurationLength(restLenStr, currentTrack.defaultLength);
        timelineItems.push({
          line: lineNumber,
          startColumn: col + 1,
          endColumn: col + restMatch[0].length,
          trackId: currentTrack.id,
          beat: currentTrack.currentTime,
          type: 'rest',
        });
        currentTrack.currentTime += duration;
        col += restMatch[0].length;
        continue;
      }

      // 12. 単音符: c, d, e, f, g, a, b (付加記号: +, #, -, _, b, および長さ)
      const singleNoteMatch = remaining.match(/^([a-gA-G])([#\+\-_b]?)((?:[\^&]?\d*\.*)*)/i);
      if (singleNoteMatch) {
        const noteLetter = singleNoteMatch[1].toUpperCase();
        let accidental = singleNoteMatch[2] || '';
        if (accidental === '+') accidental = '#';
        if (accidental === '_') accidental = '-';
        
        const noteLenStr = singleNoteMatch[3];
        const duration = parseDurationLength(noteLenStr, currentTrack.defaultLength);
        const tripInfo = getTripletInfo(duration);
        const fullPitch = `${noteLetter}${accidental}${currentTrack.octave}`;
        const baseMidi = pitchToMidi(fullPitch);
        const masterShift = getMasterKeyAt(currentTrack.currentTime);
        const totalShift = currentTrack.keyShift + masterShift + uiGlobalKeyShift;
        const transposedMidi = Math.max(0, Math.min(127, baseMidi + totalShift));
        const finalPitch = midiToPitch(transposedMidi);

        const singleNote: NoteEvent = {
          pitch: finalPitch,
          midiNote: transposedMidi,
          originalPitch: fullPitch,
          keyShift: totalShift,
          startTime: currentTrack.currentTime,
          duration: duration,
          velocity: currentTrack.velocity,
          gateRate: currentTrack.gateRate,
          gateDuration: duration * currentTrack.gateRate,
          trackId: currentTrack.id,
          channel: currentTrack.channel,
          instrument: currentTrack.instrument,
          isTuplet: tripInfo ? true : undefined,
          tupletNumber: tripInfo ? 3 : undefined,
          tupletOccupied: tripInfo ? 2 : undefined,
          line: lineNumber,
          column: col + 1,
        };

        const hasTrailingTie = /[\^&]$/.test(noteLenStr);
        registerNotesToTrack(currentTrack, [singleNote], hasTrailingTie);

        timelineItems.push({
          line: lineNumber,
          startColumn: col + 1,
          endColumn: col + singleNoteMatch[0].length,
          trackId: currentTrack.id,
          beat: currentTrack.currentTime,
          type: 'note',
        });

        currentTrack.currentTime += duration;
        col += singleNoteMatch[0].length;
        continue;
      }

      // 未知の文字
      errors.push({
        message: `解釈できない文字または構文です: "${char}"`,
        line: lineNumber,
        column: col + 1,
      });
      col++;
    }
  }

  // パース終了時に未解放のペダルがあれば、トラックの現在時刻でOFFにする
  tracksMap.forEach((ts) => {
    if (ts.isPedalOn) {
      ts.activePedalNotes.forEach((n) => {
        n.pedalReleaseTime = ts.currentTime;
      });
      ts.pedalEvents.push({
        time: ts.currentTime,
        type: 'off',
        trackId: ts.id,
        channel: ts.channel,
      });
      ts.isPedalOn = false;
      ts.activePedalNotes = [];
    }
  });

  // 全トラックのペダルイベント統合リスト
  const allPedalEvents: PedalEvent[] = [];
  tracksMap.forEach((ts) => {
    allPedalEvents.push(...ts.pedalEvents);
  });

  // トラックリストの整形
  const tracks: Track[] = Array.from(tracksMap.values()).map((ts) => {
    const sortedTempo = ts.tempoEvents.sort((a, b) => a.time - b.time);
    const sortedTimeSig = ts.timeSignatureEvents.sort((a, b) => a.time - b.time);
    return {
      id: ts.id,
      name: ts.name,
      channel: ts.channel,
      instrument: ts.instrument,
      notes: ts.notes.sort((a, b) => a.startTime - b.startTime),
      tempoEvents: sortedTempo,
      timeSignatureEvents: sortedTimeSig,
      pedalEvents: ts.pedalEvents.sort((a, b) => a.time - b.time),
      initialTempo: sortedTempo[0]?.bpm,
      initialTimeSignature: sortedTimeSig[0]
        ? { numerator: sortedTimeSig[0].numerator, denominator: sortedTimeSig[0].denominator }
        : undefined,
      initialKey: ts.initialKey ?? ts.keyShift,
    };
  });

  // 全体の総拍数 (ペダルで持続する音符の長さも考慮)
  let maxDuration = 0;
  for (const tr of tracks) {
    for (const note of tr.notes) {
      const end = Math.max(note.startTime + note.duration, note.pedalReleaseTime ?? 0);
      if (end > maxDuration) {
        maxDuration = end;
      }
    }
  }

  const activeTimeSig = timeSignatures[timeSignatures.length - 1] || { numerator: 4, denominator: 4 };

  return {
    title: scoreTitle,
    tracks,
    tempoEvents: tempoEvents.sort((a, b) => a.time - b.time),
    timeSignature: {
      numerator: activeTimeSig.numerator,
      denominator: activeTimeSig.denominator,
    },
    totalDuration: maxDuration,
    masterKeyEvents: masterKeyEvents.sort((a, b) => a.time - b.time),
    globalKeyShift: uiGlobalKeyShift,
    pedalEvents: allPedalEvents.sort((a, b) => a.time - b.time),
    timelineItems,
    errors,
  };
}

/**
 * テキストエディタ上のカーソル位置 (行, 列) から最適な再生開始拍数 (beat) を導出する
 * @param timelineItems MMLパース時に記録された音符・休符・トラックのタイムライン情報
 * @param cursorLine 1-indexed 行番号
 * @param cursorColumn 1-indexed 列番号
 */
export function findBeatAtCursor(
  timelineItems: MmlTimelineItem[] | undefined,
  cursorLine: number,
  cursorColumn: number
): number {
  if (!timelineItems || timelineItems.length === 0) return 0;

  // 1. カーソルがアイテムの範囲内にあるか (line一致 かつ startColumn <= cursorColumn <= endColumn)
  const exactItem = timelineItems.find(
    (item) => item.line === cursorLine && cursorColumn >= item.startColumn && cursorColumn <= item.endColumn
  );
  if (exactItem) {
    return exactItem.beat;
  }

  // 2. カーソル行に存在するアイテム
  const sameLineItems = timelineItems.filter((item) => item.line === cursorLine);
  if (sameLineItems.length > 0) {
    // カーソルより右側（前方）にある最初のアイテム
    const nextItemOnLine = sameLineItems.find((item) => item.startColumn >= cursorColumn);
    if (nextItemOnLine) {
      return nextItemOnLine.beat;
    }
    // カーソルが行末（右側にアイテムがない）の場合:
    // 次の行以降にアイテムがあればその最初のアイテム、なければ同一行の最後のアイテム
    const futureItems = timelineItems.filter((item) => item.line > cursorLine);
    if (futureItems.length > 0) {
      return futureItems[0].beat;
    }
    return sameLineItems[sameLineItems.length - 1].beat;
  }

  // 3. カーソル行にアイテムがない場合（空行、コメント行、トラック定義行など）
  // 後続行の最初のアイテム
  const futureItems = timelineItems.filter((item) => item.line > cursorLine);
  if (futureItems.length > 0) {
    return futureItems[0].beat;
  }

  // 先行行の最後のアイテム
  const pastItems = timelineItems.filter((item) => item.line < cursorLine);
  if (pastItems.length > 0) {
    return pastItems[pastItems.length - 1].beat;
  }

  return 0;
}

