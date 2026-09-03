/**
 * MIDI データから MML テキストへの逆変換エンジン
 * クオンタイズ、和音認識、休符補完、オクターブ最適化、小節線自動挿入
 */

import { ParsedMidiData, ParsedMidiTrack, ParsedMidiNote } from './midiParser';

export interface MidiToMmlOptions {
  selectedTrackIds?: number[];
  quantizeResolution?: number; // 4分音符基準 (例: 0.25 = 16分音符, 0.125 = 32分音符, 0.5 = 8分音符)
  songTitle?: string;
  defaultLength?: number; // デフォルト音長 (4 or 8)
}

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

/**
 * 4分音符基準の長さを MML 音長表現 (例: "4", "8.", "2^8") に分解する
 */
export function durationToMmlLength(dur: number): string {
  // 代表的な音長テーブル (大きい順)
  const durations: { dur: number; str: string }[] = [
    { dur: 6.0, str: '1.' },
    { dur: 4.0, str: '1' },
    { dur: 3.0, str: '2.' },
    { dur: 2.0, str: '2' },
    { dur: 1.5, str: '4.' },
    { dur: 1.0, str: '4' },
    { dur: 0.75, str: '8.' },
    { dur: 0.5, str: '8' },
    { dur: 0.375, str: '16.' },
    { dur: 0.25, str: '16' },
    { dur: 0.125, str: '32' },
    { dur: 0.0625, str: '64' },
  ];

  let remaining = dur;
  const parts: string[] = [];
  const eps = 0.01;

  while (remaining > eps) {
    let matched = false;
    for (const d of durations) {
      if (remaining >= d.dur - eps) {
        parts.push(d.str);
        remaining -= d.dur;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 最小の32分または64分音符で切り上げる
      parts.push('32');
      break;
    }
    if (parts.length >= 4) {
      // タイが長くなりすぎるのを防止
      break;
    }
  }

  return parts.length > 0 ? parts.join('^') : '4';
}

interface NoteGroup {
  startBeat: number;
  durationBeat: number;
  notes: ParsedMidiNote[];
}

/**
 * トラックの演奏データを MML 文字列に変換
 */
function convertTrackToMml(
  track: ParsedMidiTrack,
  trackNumber: number,
  ppq: number,
  quantize: number,
  beatsPerMeasure: number
): string {
  const notes = track.notes;
  if (!notes || notes.length === 0) {
    return '';
  }

  // 1. 各音符をクオンタイズ
  const quantized = notes.map((n) => {
    const startBeat = Math.round((n.startTick / ppq) / quantize) * quantize;
    const rawDurBeat = (n.durationTicks / ppq);
    const endBeat = Math.round(((n.startTick + n.durationTicks) / ppq) / quantize) * quantize;
    const durBeat = Math.max(quantize, endBeat - startBeat);
    return {
      midiNote: n.midiNote,
      velocity: n.velocity,
      startBeat: Math.max(0, startBeat),
      durBeat,
    };
  });

  // 開始拍順にソート
  quantized.sort((a, b) => a.startBeat - b.startBeat || a.midiNote - b.midiNote);

  // 2. 同一タイミング (startBeat) の音符をグループ化 (和音化)
  const groups: NoteGroup[] = [];
  let currentGroup: NoteGroup | null = null;

  for (const qn of quantized) {
    if (!currentGroup || Math.abs(currentGroup.startBeat - qn.startBeat) >= quantize * 0.5) {
      currentGroup = {
        startBeat: qn.startBeat,
        durationBeat: qn.durBeat,
        notes: [
          {
            midiNote: qn.midiNote,
            startTick: 0,
            endTick: 0,
            durationTicks: 0,
            velocity: qn.velocity,
            channel: track.channel,
          },
        ],
      };
      groups.push(currentGroup);
    } else {
      // 和音構成音を追加 (重複音は除外)
      if (!currentGroup.notes.some((n) => n.midiNote === qn.midiNote)) {
        currentGroup.notes.push({
          midiNote: qn.midiNote,
          startTick: 0,
          endTick: 0,
          durationTicks: 0,
          velocity: qn.velocity,
          channel: track.channel,
        });
        // 和音の長さは平均または最初の音符に合わせる
        currentGroup.durationBeat = Math.max(currentGroup.durationBeat, qn.durBeat);
      }
    }
  }

  // 和音内を音高順（低音から高音）にソート
  for (const g of groups) {
    g.notes.sort((a, b) => a.midiNote - b.midiNote);
  }

  // 3. MML トークン列の生成
  const lines: string[] = [];
  // トラックヘッダー
  const avgVel = Math.round(
    notes.reduce((sum, n) => sum + n.velocity, 0) / (notes.length || 1)
  );
  lines.push(`// Track ${trackNumber}: ${track.name || `Track ${trackNumber}`} (Ch ${track.channel})`);
  lines.push(`TR(${trackNumber}) Voice(${track.instrument}) v${avgVel} o4 l4`);

  let currentOctave = 4;
  let currentBeat = 0;
  let currentLine = '';
  let measureCount = 0;

  // オクターブ記号（> / < / oN）を算出
  function getOctaveCommand(targetOctave: number): string {
    if (targetOctave === currentOctave) return '';
    const diff = targetOctave - currentOctave;
    currentOctave = targetOctave;
    if (diff === 1) return '>';
    if (diff === -1) return '<';
    if (diff === 2) return '>>';
    if (diff === -2) return '<<';
    return `o${targetOctave} `;
  }

  // 小節線と改行の処理
  let lastMeasureIndex = 0;

  function checkMeasureBreak(beat: number) {
    if (beatsPerMeasure <= 0) return;
    const measureIndex = Math.floor(beat / beatsPerMeasure);
    if (measureIndex > lastMeasureIndex) {
      const crossed = measureIndex - lastMeasureIndex;
      lastMeasureIndex = measureIndex;
      for (let i = 0; i < crossed; i++) {
        currentLine += ' | ';
        measureCount++;
        if (measureCount % 4 === 0) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
      }
    }
  }

  for (const group of groups) {
    // 休符チェック (直前の終了拍から現在の開始拍にギャップがある場合)
    if (group.startBeat > currentBeat + quantize * 0.5) {
      const restDur = group.startBeat - currentBeat;
      // 休符の長さ
      const restLenStr = durationToMmlLength(restDur);
      const restParts = restLenStr.split('^');
      for (const p of restParts) {
        currentLine += `r${p} `;
      }
      currentBeat = group.startBeat;
      checkMeasureBreak(currentBeat);
    }

    const durStr = durationToMmlLength(group.durationBeat);

    if (group.notes.length === 1) {
      // 単音
      const n = group.notes[0];
      const oct = Math.floor(n.midiNote / 12) - 1;
      const noteName = NOTE_NAMES[((n.midiNote % 12) + 12) % 12];
      const octCmd = getOctaveCommand(oct);
      currentLine += `${octCmd}${noteName}${durStr} `;
    } else {
      // 和音 [note note ...]durStr
      let chordContent = '';
      for (const n of group.notes) {
        const oct = Math.floor(n.midiNote / 12) - 1;
        const noteName = NOTE_NAMES[((n.midiNote % 12) + 12) % 12];
        const octCmd = getOctaveCommand(oct);
        chordContent += `${octCmd}${noteName} `;
      }
      currentLine += `[${chordContent.trim()}]${durStr} `;
    }

    currentBeat = group.startBeat + group.durationBeat;
    checkMeasureBreak(currentBeat);
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim() + ' |');
  }

  return lines.join('\n');
}

/**
 * 解析された MIDI データ全体を MML ソースコードに変換する
 */
export function convertMidiToMml(midiData: ParsedMidiData, options?: MidiToMmlOptions): string {
  const selectedTrackIds = options?.selectedTrackIds;
  const quantize = options?.quantizeResolution || 0.25; // デフォルト 16分音符 (0.25拍)
  const title = options?.songTitle || 'インポートした楽曲';

  // 拍子情報の抽出
  const initialTimeSig = midiData.timeSignatures[0] || { numerator: 4, denominator: 4 };
  const beatsPerMeasure = (initialTimeSig.numerator * 4) / initialTimeSig.denominator;

  // テンポ情報の抽出
  const initialTempo = midiData.tempos[0] || { bpm: 120 };

  const mmlParts: string[] = [];

  // ヘッダー部
  mmlParts.push(`// ${title}`);
  mmlParts.push(`Tempo(${initialTempo.bpm})`);
  mmlParts.push(`TimeSignature(${initialTimeSig.numerator},${initialTimeSig.denominator})`);
  mmlParts.push('');

  // 変換対象トラックのフィルタリング
  const tracksToConvert = midiData.tracks.filter((t) => {
    if (selectedTrackIds && selectedTrackIds.length > 0) {
      return selectedTrackIds.includes(t.id);
    }
    return t.notes.length > 0;
  });

  if (tracksToConvert.length === 0) {
    mmlParts.push('// 再生可能な音符イベントが見つかりませんでした。');
    return mmlParts.join('\n');
  }

  // 各トラックを変換
  tracksToConvert.forEach((track, index) => {
    const trackMml = convertTrackToMml(
      track,
      index + 1,
      midiData.ppq,
      quantize,
      beatsPerMeasure
    );
    if (trackMml) {
      mmlParts.push(trackMml);
      mmlParts.push('');
    }
  });

  return mmlParts.join('\n');
}
