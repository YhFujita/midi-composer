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
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export interface ParsedScore {
  title?: string;
  tracks: Track[];
  tempoEvents: TempoEvent[];
  timeSignature: { numerator: number; denominator: number };
  totalDuration: number; // 全体の長さ（拍数）
  errors: ParseError[];
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number; // 秒数
  currentBeat: number; // 拍数
  duration: number;    // 総秒数
}
