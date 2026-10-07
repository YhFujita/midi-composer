export interface DrumNoteInfo {
  midiNote: number;
  name: string;
  nameJa: string;
  shortName: string;
  category: 'kick' | 'snare' | 'hihat' | 'cymbal' | 'tom' | 'percussion';
}

/**
 * General MIDI (GM) Level 1 パーカッション・ドラムノートマップ
 * MIDIノート番号 35〜81 に対応
 */
export const GM_DRUM_MAP: Record<number, DrumNoteInfo> = {
  35: { midiNote: 35, name: 'Acoustic Bass Drum', nameJa: 'バスドラム(生)', shortName: 'Kick', category: 'kick' },
  36: { midiNote: 36, name: 'Bass Drum 1', nameJa: 'バスドラム1', shortName: 'Kick', category: 'kick' },
  37: { midiNote: 37, name: 'Side Stick', nameJa: 'サイドスティック', shortName: 'Stick', category: 'percussion' },
  38: { midiNote: 38, name: 'Acoustic Snare', nameJa: 'スネアドラム(生)', shortName: 'Snare', category: 'snare' },
  39: { midiNote: 39, name: 'Hand Clap', nameJa: 'ハンドクラップ', shortName: 'Clap', category: 'percussion' },
  40: { midiNote: 40, name: 'Electric Snare', nameJa: 'エレキスネア', shortName: 'Snare2', category: 'snare' },
  41: { midiNote: 41, name: 'Low Floor Tom', nameJa: 'フロアタム(低)', shortName: 'L.Fl.Tom', category: 'tom' },
  42: { midiNote: 42, name: 'Closed Hi-Hat', nameJa: 'クローズドハイハット', shortName: 'Cl.Hat', category: 'hihat' },
  43: { midiNote: 43, name: 'High Floor Tom', nameJa: 'フロアタム(高)', shortName: 'H.Fl.Tom', category: 'tom' },
  44: { midiNote: 44, name: 'Pedal Hi-Hat', nameJa: 'ペダルハイハット', shortName: 'Pd.Hat', category: 'hihat' },
  45: { midiNote: 45, name: 'Low Tom', nameJa: 'ロータム', shortName: 'Low Tom', category: 'tom' },
  46: { midiNote: 46, name: 'Open Hi-Hat', nameJa: 'オープンハイハット', shortName: 'Op.Hat', category: 'hihat' },
  47: { midiNote: 47, name: 'Low-Mid Tom', nameJa: 'ローミッドタム', shortName: 'L-M Tom', category: 'tom' },
  48: { midiNote: 48, name: 'Hi-Mid Tom', nameJa: 'ハイミッドタム', shortName: 'H-M Tom', category: 'tom' },
  49: { midiNote: 49, name: 'Crash Cymbal 1', nameJa: 'クラッシュシンバル1', shortName: 'Crash', category: 'cymbal' },
  50: { midiNote: 50, name: 'High Tom', nameJa: 'ハイタム', shortName: 'Hi Tom', category: 'tom' },
  51: { midiNote: 51, name: 'Ride Cymbal 1', nameJa: 'ライドシンバル1', shortName: 'Ride', category: 'cymbal' },
  52: { midiNote: 52, name: 'Chinese Cymbal', nameJa: 'チャイナシンバル', shortName: 'China', category: 'cymbal' },
  53: { midiNote: 53, name: 'Ride Bell', nameJa: 'ライドベル', shortName: 'R.Bell', category: 'cymbal' },
  54: { midiNote: 54, name: 'Tambourine', nameJa: 'タンバリン', shortName: 'Tamb', category: 'percussion' },
  55: { midiNote: 55, name: 'Splash Cymbal', nameJa: 'スプラッシュシンバル', shortName: 'Splash', category: 'cymbal' },
  56: { midiNote: 56, name: 'Cowbell', nameJa: 'カウベル', shortName: 'Cowbell', category: 'percussion' },
  57: { midiNote: 57, name: 'Crash Cymbal 2', nameJa: 'クラッシュシンバル2', shortName: 'Crash2', category: 'cymbal' },
  58: { midiNote: 58, name: 'Vibraslap', nameJa: 'ビブラスラップ', shortName: 'Vibra', category: 'percussion' },
  59: { midiNote: 59, name: 'Ride Cymbal 2', nameJa: 'ライドシンバル2', shortName: 'Ride2', category: 'cymbal' },
  60: { midiNote: 60, name: 'Hi Bongo', nameJa: 'ハイボンゴ', shortName: 'H.Bongo', category: 'percussion' },
  61: { midiNote: 61, name: 'Low Bongo', nameJa: 'ローボンゴ', shortName: 'L.Bongo', category: 'percussion' },
  62: { midiNote: 62, name: 'Mute Hi Conga', nameJa: 'ミュートハイコンガ', shortName: 'M.Conga', category: 'percussion' },
  63: { midiNote: 63, name: 'Open Hi Conga', nameJa: 'オープンハイコンガ', shortName: 'O.Conga', category: 'percussion' },
  64: { midiNote: 64, name: 'Low Conga', nameJa: 'ローコンガ', shortName: 'L.Conga', category: 'percussion' },
  65: { midiNote: 65, name: 'High Timbale', nameJa: 'ハイティンバレス', shortName: 'H.Timb', category: 'percussion' },
  66: { midiNote: 66, name: 'Low Timbale', nameJa: 'ローティンバレス', shortName: 'L.Timb', category: 'percussion' },
  67: { midiNote: 67, name: 'High Agogo', nameJa: 'ハイアゴゴ', shortName: 'H.Agogo', category: 'percussion' },
  68: { midiNote: 68, name: 'Low Agogo', nameJa: 'ローアゴゴ', shortName: 'L.Agogo', category: 'percussion' },
  69: { midiNote: 69, name: 'Cabasa', nameJa: 'カバサ', shortName: 'Cabasa', category: 'percussion' },
  70: { midiNote: 70, name: 'Maracas', nameJa: 'マラカス', shortName: 'Maracas', category: 'percussion' },
  71: { midiNote: 71, name: 'Short Whistle', nameJa: 'ショートホイッスル', shortName: 'Whistle', category: 'percussion' },
  72: { midiNote: 72, name: 'Long Whistle', nameJa: 'ロングホイッスル', shortName: 'L.Whistle', category: 'percussion' },
  73: { midiNote: 73, name: 'Short Guiro', nameJa: 'ショートギロ', shortName: 'Guiro', category: 'percussion' },
  74: { midiNote: 74, name: 'Long Guiro', nameJa: 'ロングギロ', shortName: 'L.Guiro', category: 'percussion' },
  75: { midiNote: 75, name: 'Claves', nameJa: 'クラベス', shortName: 'Claves', category: 'percussion' },
  76: { midiNote: 76, name: 'Hi Wood Block', nameJa: 'ハイウッドブロック', shortName: 'H.Block', category: 'percussion' },
  77: { midiNote: 77, name: 'Low Wood Block', nameJa: 'ローウッドブロック', shortName: 'L.Block', category: 'percussion' },
  78: { midiNote: 78, name: 'Mute Cuica', nameJa: 'ミュートクイーカ', shortName: 'M.Cuica', category: 'percussion' },
  79: { midiNote: 79, name: 'Open Cuica', nameJa: 'オープンクイーカ', shortName: 'O.Cuica', category: 'percussion' },
  80: { midiNote: 80, name: 'Mute Triangle', nameJa: 'ミュートトライアングル', shortName: 'M.Tri', category: 'percussion' },
  81: { midiNote: 81, name: 'Open Triangle', nameJa: 'オープントライアングル', shortName: 'O.Tri', category: 'percussion' },
};

/**
 * MIDIノート番号からドラム情報を取得
 */
export function getDrumInfo(midiNote: number): DrumNoteInfo | undefined {
  return GM_DRUM_MAP[midiNote];
}

/**
 * 指定のMIDIノートがGMドラム音域(35-81)に含まれるか
 */
export function isDrumMidiNote(midiNote: number): boolean {
  return midiNote >= 35 && midiNote <= 81;
}
