export interface NoteEvent {
  pitch: string;       // 例: "C4", "G#5", "Bb3"
  midiNote: number;    // 例: 60 (C4)
  startTime: number;   // 4分音符基準の拍数 (0, 1.0, 2.5 ...)
  duration: number;    // 4分音符基準の長さ (1.0 = 4分音符, 0.5 = 8分音符, 4.0 = 全音符)
  velocity: number;    // 0 - 127
  trackId: number;     // 0, 1, ...
  channel: number;     // 1 - 16
  instrument?: number; // GM音色番号 (0-127)
  isChord?: boolean;   // 和音の一部か
  isStrum?: boolean;   // バラシ (ギターストローク・ロール) 演奏か
  strumDirection?: 'down' | 'up'; // ストローク方向 ('down': 低音→高音, 'up': 高音→低音)
  strumDelaySec?: number; // 1音あたりのディレイ時間 (秒、デフォルト約 0.035秒)
  strumOrder?: number; // 和音内での発音順序 (0, 1, 2, ...)
  strumTotal?: number; // 和音内の総音数
  gateRate?: number;   // ゲートタイム率 (0.0 - 1.0)
  gateDuration?: number; // 4分音符基準の実際の発音長
  originalPitch?: string; // 移調前のオリジナル音名 (例: "C4")
  keyShift?: number;   // 適用された移調半音数 (例: -1, +2)
  line?: number;       // ソース行番号
  column?: number;     // ソース列番号
}

export interface RestEvent {
  startTime: number;
  duration: number;
  trackId: number;
}

export interface TempoEvent {
  time: number;        // 拍数
  bpm: number;         // テンポ (BPM)
}

export interface TimeSignatureEvent {
  time: number;
  numerator: number;   // 分子 (4/4 の 4)
  denominator: number; // 分母 (4/4 の 4)
}

export interface MasterKeyEvent {
  time: number;        // 拍数
  shift: number;       // 移調半音数 (例: -1, +2)
}

export interface Track {
  id: number;
  name: string;
  channel: number;
  instrument: number;  // General MIDI Program (0: Acoustic Grand Piano, etc.)
  notes: NoteEvent[];
  tempoEvents?: TempoEvent[];
  timeSignatureEvents?: TimeSignatureEvent[];
  initialTempo?: number;
  initialTimeSignature?: { numerator: number; denominator: number };
  initialKey?: number;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export interface ParseMMLOptions {
  globalKeyShift?: number; // UI等から指定される楽曲全体の外部移調オフセット（半音単位）
}

export interface ParsedScore {
  title?: string;
  tracks: Track[];
  tempoEvents: TempoEvent[];
  timeSignature: { numerator: number; denominator: number };
  totalDuration: number; // 全体の長さ（拍数）
  masterKeyEvents?: MasterKeyEvent[];
  globalKeyShift?: number;
  errors: ParseError[];
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number; // 秒数
  currentBeat: number; // 拍数
  duration: number;    // 総秒数
}
