import { NoteEvent, ParsedScore, ParseError, Track, TempoEvent, TimeSignatureEvent } from '../../types/mml';
import { pitchToMidi, parseDurationLength } from '../../utils/noteConverter';

interface TrackState {
  id: number;
  name: string;
  channel: number;
  instrument: number;
  octave: number;
  defaultLength: number;
  velocity: number;
  currentTime: number; // 4分音符基準の累積時間
  notes: NoteEvent[];
}

export function parseMML(mmlCode: string): ParsedScore {
  const errors: ParseError[] = [];
  const tracksMap = new Map<number, TrackState>();
  const tempoEvents: TempoEvent[] = [{ time: 0, bpm: 120 }];
  const timeSignatures: TimeSignatureEvent[] = [{ time: 0, numerator: 4, denominator: 4 }];

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
        currentTime: 0,
        notes: [],
      });
    }
    return tracksMap.get(trackId)!;
  }

  let currentTrackId = 0;
  let currentTrack = getOrCreateTrack(currentTrackId);

  // コメントの除去と位置情報の保持
  // 行ごとにパースするか、ストリームとしてパースする
  const lines = mmlCode.split('\n');

  let inBlockComment = false;

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

      // 0.1 文字列設定 (Title = "...", TrackName = "...")
      const strAssignMatch = remaining.match(/^[a-zA-Z_]+\s*=\s*"[^"]*"/);
      if (strAssignMatch) {
        col += strAssignMatch[0].length;
        continue;
      }

      // 0.2 ドットコマンド (System.Time 等)
      const dotCmdMatch = remaining.match(/^[a-zA-Z_]+\.[a-zA-Z_]+\s*(\([^)]*\))?/);
      if (dotCmdMatch) {
        col += dotCmdMatch[0].length;
        continue;
      }

      // 0.3 ゲートタイム (q8, q100, Gate(8))
      const gateMatch = remaining.match(/^(?:q\s*\d+|GATE\(?=?\s*\d+\)?)/i);
      if (gateMatch) {
        col += gateMatch[0].length;
        continue;
      }

      // 0.4 パン・モジュレーション (p64, Pan(64), m0)
      const panModMatch = remaining.match(/^(?:(?:PAN|MOD)\(?=?\s*\d+\)?|[pm]\s*\d+)/i);
      if (panModMatch) {
        col += panModMatch[0].length;
        continue;
      }

      // 1. トラック指定: TR(n), Track(n), TR=n, TRn
      const trackMatch = remaining.match(/^(?:TR(?:ACK)?\(?=?\s*(\d+)\)?)/i);
      if (trackMatch) {
        const rawTrNum = parseInt(trackMatch[1], 10);
        // 1-indexed to 0-indexed if > 0
        currentTrackId = rawTrNum > 0 ? rawTrNum - 1 : 0;
        currentTrack = getOrCreateTrack(currentTrackId);
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
          tempoEvents.push({
            time: currentTrack.currentTime,
            bpm,
          });
        }
        col += tempoMatch[0].length;
        continue;
      }

      // 5. 拍子: TimeSignature(4,4), Time(4,4)
      const timeSigMatch = remaining.match(/^(?:TIME(?:SIGNATURE)?\(\s*(\d+)\s*,\s*(\d+)\s*\))/i);
      if (timeSigMatch) {
        const num = parseInt(timeSigMatch[1], 10);
        const den = parseInt(timeSigMatch[2], 10);
        timeSignatures.push({
          time: currentTrack.currentTime,
          numerator: num,
          denominator: den,
        });
        col += timeSigMatch[0].length;
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
        currentTrack.velocity = Math.max(0, currentTrack.velocity - 8);
        col++;
        continue;
      }

      // 10. 和音: [ceg]4, [c e g]8. など
      if (char === '[') {
        const chordCloseIdx = remaining.indexOf(']');
        if (chordCloseIdx !== -1) {
          const chordContent = remaining.slice(1, chordCloseIdx);
          const afterChord = remaining.slice(chordCloseIdx + 1);
          // 和音の長さを解析
          const chordLenMatch = afterChord.match(/^((?:[\^&]?\d*\.*)+)/);
          const chordLenStr = chordLenMatch ? chordLenMatch[1] : '';
          const chordDuration = parseDurationLength(chordLenStr, currentTrack.defaultLength);

          // 和音内の各音符を解析 (オクターブ記号 > < ' も考慮)
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
              const midiVal = pitchToMidi(fullPitch);

              currentTrack.notes.push({
                pitch: fullPitch,
                midiNote: midiVal,
                startTime: currentTrack.currentTime,
                duration: chordDuration,
                velocity: currentTrack.velocity,
                trackId: currentTrack.id,
                channel: currentTrack.channel,
                isChord: true,
                line: lineNumber,
                column: col + 1,
              });

              cIdx += noteMatch[0].length;
              continue;
            }

            cIdx++;
          }

          currentTrack.currentTime += chordDuration;
          col += 1 + chordCloseIdx + (chordLenMatch ? chordLenMatch[0].length : 0);
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
        const restLenStr = restMatch[1];
        const duration = parseDurationLength(restLenStr, currentTrack.defaultLength);
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
        const fullPitch = `${noteLetter}${accidental}${currentTrack.octave}`;
        const midiVal = pitchToMidi(fullPitch);

        currentTrack.notes.push({
          pitch: fullPitch,
          midiNote: midiVal,
          startTime: currentTrack.currentTime,
          duration: duration,
          velocity: currentTrack.velocity,
          trackId: currentTrack.id,
          channel: currentTrack.channel,
          line: lineNumber,
          column: col + 1,
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

  // トラックリストの整形
  const tracks: Track[] = Array.from(tracksMap.values()).map((ts) => ({
    id: ts.id,
    name: ts.name,
    channel: ts.channel,
    instrument: ts.instrument,
    notes: ts.notes.sort((a, b) => a.startTime - b.startTime),
  }));

  // 全体の総拍数
  let maxDuration = 0;
  for (const tr of tracks) {
    for (const note of tr.notes) {
      const end = note.startTime + note.duration;
      if (end > maxDuration) {
        maxDuration = end;
      }
    }
  }

  const activeTimeSig = timeSignatures[timeSignatures.length - 1] || { numerator: 4, denominator: 4 };

  return {
    tracks,
    tempoEvents: tempoEvents.sort((a, b) => a.time - b.time),
    timeSignature: {
      numerator: activeTimeSig.numerator,
      denominator: activeTimeSig.denominator,
    },
    totalDuration: maxDuration,
    errors,
  };
}
