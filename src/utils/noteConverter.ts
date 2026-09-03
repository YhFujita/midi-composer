// MIDIノート番号、音名、周波数の相互変換ユーティリティ

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 音名とオクターブ（例: "C4", "F#5", "Bb3"）から MIDIノート番号 (0〜127) を算出する
 */
export function pitchToMidi(pitch: string): number {
  const match = pitch.trim().match(/^([A-Ga-g])([#\+\-_b]?)(-?\d+)$/);
  if (!match) return 60; // デフォルトは C4 (60)

  const rawNote = match[1].toUpperCase();
  const accidental = match[2];
  const octave = parseInt(match[3], 10);

  let baseIndex = 0;
  switch (rawNote) {
    case 'C': baseIndex = 0; break;
    case 'D': baseIndex = 2; break;
    case 'E': baseIndex = 4; break;
    case 'F': baseIndex = 5; break;
    case 'G': baseIndex = 7; break;
    case 'A': baseIndex = 9; break;
    case 'B': baseIndex = 11; break;
  }

  if (accidental === '#' || accidental === '+') {
    baseIndex += 1;
  } else if (accidental === '-' || accidental === '_' || accidental === 'b') {
    baseIndex -= 1;
  }

  // MIDIノート番号: C-1 = 0, C4 = 60
  const midiNote = (octave + 1) * 12 + baseIndex;
  return Math.max(0, Math.min(127, midiNote));
}

/**
 * MIDIノート番号から標準音名（例: 60 -> "C4", 61 -> "C#4"）を算出する
 */
export function midiToPitch(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * MIDIノート番号から基本周波数 (Hz) を算出する (A4 = 440Hz)
 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * MMLの音長表記（例: "4", "8.", "16", "4^4" 等）から四分音符基準の長さ (duration) を算出する
 * 四分音符 = 1.0, 8分音符 = 0.5, 全音符 = 4.0, 2分音符 = 2.0
 */
export function parseDurationLength(lenStr: string, defaultLength: number = 4): number {
  if (!lenStr || lenStr.trim() === '') {
    return 4 / defaultLength;
  }

  // タイ記号 (^) または (&) で結合された長さを合計する
  const parts = lenStr.split(/[\^&]/);
  let totalDuration = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // 付点の数をカウント
    const dots = (trimmed.match(/\./g) || []).length;
    const numPart = trimmed.replace(/\./g, '');
    const noteValue = numPart ? parseFloat(numPart) : defaultLength;

    if (isNaN(noteValue) || noteValue <= 0) {
      continue;
    }

    let baseDuration = 4 / noteValue; // 4分音符基準 (例: 4 -> 1.0, 8 -> 0.5)
    let dotMultiplier = 1;
    let addFraction = 0.5;

    for (let i = 0; i < dots; i++) {
      dotMultiplier += addFraction;
      addFraction /= 2;
    }

    totalDuration += baseDuration * dotMultiplier;
  }

  return totalDuration > 0 ? totalDuration : 4 / defaultLength;
}

/**
 * 音長 (4分音符基準) が3連符（8分3連符、16分3連符、4分3連符等）に該当するかを判定する
 */
export function getTripletInfo(dur: number): {
  isTriplet: boolean;
  vexDuration: string; // VexFlow で指定する基礎音長コード ('8', '16', '4' 等)
  standardDuration: number; // 3連符でない場合の基本音長 (4分音符基準)
} | null {
  const eps = 0.025;

  // 32分3連符: 1/12拍 ≈ 0.0833 (32分音符 0.125拍 の 2/3)
  if (Math.abs(dur - (1 / 12)) < eps) {
    return { isTriplet: true, vexDuration: '32', standardDuration: 0.125 };
  }
  // 16分3連符: 1/6拍 ≈ 0.1667 (16分音符 0.25拍 の 2/3)
  if (Math.abs(dur - (1 / 6)) < eps) {
    return { isTriplet: true, vexDuration: '16', standardDuration: 0.25 };
  }
  // 8分3連符: 1/3拍 ≈ 0.3333 (8分音符 0.5拍 の 2/3)
  if (Math.abs(dur - (1 / 3)) < eps) {
    return { isTriplet: true, vexDuration: '8', standardDuration: 0.5 };
  }
  // 4分3連符: 2/3拍 ≈ 0.6667 (4分音符 1.0拍 の 2/3)
  if (Math.abs(dur - (2 / 3)) < eps) {
    return { isTriplet: true, vexDuration: '4', standardDuration: 1.0 };
  }
  // 2分3連符: 4/3拍 ≈ 1.3333 (2分音符 2.0拍 の 2/3)
  if (Math.abs(dur - (4 / 3)) < eps) {
    return { isTriplet: true, vexDuration: '2', standardDuration: 2.0 };
  }

  return null;
}

