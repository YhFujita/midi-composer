/**
 * 半リアルタイム入力 (Semi-Realtime Input) 用の音長クオンタイズ・ゾーン計算ユーティリティ
 * 鍵盤を押している経過拍数から、事前選択された音符候補の中で最も近い長さの音符へ自動振り分けを行う。
 */

export interface SemiRealtimeCandidate {
  /** 一意識別子 (例: '16', '8', '8.', '4', '4.', '2', '2.', '1') */
  id: string;
  /** 表示用名称 (例: '付点4分音符') */
  label: string;
  /** トグルボタン用の短い表記 (例: '付点4') */
  shortLabel: string;
  /** ゲージ目盛り用の省スペース表記 (例: '4.') */
  gaugeLabel: string;
  /** MMLの音長サフィックス (例: '4.') */
  mmlSuffix: string;
  /** NoteIcon 等に渡す基本音長文字列 ('16' | '8' | '4' | '2' | '1') */
  duration: string;
  /** 付点の有無 */
  isDotted: boolean;
  /** 4分音符 = 1.0 とした基準拍数 */
  beats: number;
}

/**
 * 半リアルタイム入力で選択可能な音符の長さ候補一覧（短い順）
 * 例: 16分, 8分, 付点8分, 4分, 付点4分, 2分, 付点2分, 全音符
 */
export const SEMI_REALTIME_CANDIDATES: SemiRealtimeCandidate[] = [
  {
    id: '16',
    label: '16分音符',
    shortLabel: '16',
    gaugeLabel: '16',
    mmlSuffix: '16',
    duration: '16',
    isDotted: false,
    beats: 0.25,
  },
  {
    id: '8',
    label: '8分音符',
    shortLabel: '8',
    gaugeLabel: '8',
    mmlSuffix: '8',
    duration: '8',
    isDotted: false,
    beats: 0.5,
  },
  {
    id: '8.',
    label: '付点8分音符',
    shortLabel: '付点8',
    gaugeLabel: '8.',
    mmlSuffix: '8.',
    duration: '8',
    isDotted: true,
    beats: 0.75,
  },
  {
    id: '4',
    label: '4分音符',
    shortLabel: '4',
    gaugeLabel: '4',
    mmlSuffix: '4',
    duration: '4',
    isDotted: false,
    beats: 1.0,
  },
  {
    id: '4.',
    label: '付点4分音符',
    shortLabel: '付点4',
    gaugeLabel: '4.',
    mmlSuffix: '4.',
    duration: '4',
    isDotted: true,
    beats: 1.5,
  },
  {
    id: '2',
    label: '2分音符',
    shortLabel: '2',
    gaugeLabel: '2',
    mmlSuffix: '2',
    duration: '2',
    isDotted: false,
    beats: 2.0,
  },
  {
    id: '2.',
    label: '付点2分音符',
    shortLabel: '付点2',
    gaugeLabel: '2.',
    mmlSuffix: '2.',
    duration: '2',
    isDotted: true,
    beats: 3.0,
  },
  {
    id: '1',
    label: '全音符',
    shortLabel: '全',
    gaugeLabel: '全',
    mmlSuffix: '1',
    duration: '1',
    isDotted: false,
    beats: 4.0,
  },
];

/** デフォルトで有効にする候補IDリスト（全8種類） */
export const DEFAULT_ENABLED_CANDIDATE_IDS: string[] = SEMI_REALTIME_CANDIDATES.map((c) => c.id);

/** 付点なしの候補IDリスト */
export const STRAIGHT_CANDIDATE_IDS: string[] = ['16', '8', '4', '2', '1'];

/** ゲージ描画および判定用の各候補ゾーン情報 */
export interface CandidateZone {
  candidate: SemiRealtimeCandidate;
  /** このゾーンに入る最小拍数 (先頭候補は 0) */
  minBeats: number;
  /** このゾーンの上限拍数 (末尾候補は Infinity) */
  maxBeats: number;
  /** ゲージUI表示上の右端拍数 */
  visualMaxBeats: number;
}

export interface ComputedZoneLayout {
  zones: CandidateZone[];
  /** ゲージ全体の最大表示拍数 (例: 全音符まで有効なら 4.5 拍) */
  gaugeMaxBeats: number;
}

/**
 * 有効な候補ID配列から、昇順ソートされた判定ゾーン配列とゲージ最大拍数を算出する。
 * 隣り合う候補同士の境界は中間点 (算術平均) とする。
 */
export function computeCandidateZones(enabledIds: string[]): ComputedZoneLayout {
  const enabledSet = new Set(enabledIds);
  let activeCandidates = SEMI_REALTIME_CANDIDATES.filter((c) => enabledSet.has(c.id));

  // 万一すべてOFFにされた場合は4分音符をフォールバックにする
  if (activeCandidates.length === 0) {
    activeCandidates = [SEMI_REALTIME_CANDIDATES.find((c) => c.id === '4')!];
  }

  // 拍数の昇順を保証
  activeCandidates.sort((a, b) => a.beats - b.beats);

  const maxCandidateBeats = activeCandidates[activeCandidates.length - 1].beats;
  // 最大音符のジャスト位置がゲージの約88.9%付近に来るよう 1.125 倍 (4.0拍なら 4.5拍) を確保
  const gaugeMaxBeats = Math.max(1.125, maxCandidateBeats * 1.125);

  const zones: CandidateZone[] = activeCandidates.map((candidate, idx) => {
    const prev = idx > 0 ? activeCandidates[idx - 1] : null;
    const next = idx < activeCandidates.length - 1 ? activeCandidates[idx + 1] : null;

    const minBeats = prev ? (prev.beats + candidate.beats) / 2 : 0;
    const maxBeats = next ? (candidate.beats + next.beats) / 2 : Number.POSITIVE_INFINITY;
    const visualMaxBeats = next ? maxBeats : gaugeMaxBeats;

    return {
      candidate,
      minBeats,
      maxBeats,
      visualMaxBeats,
    };
  });

  return {
    zones,
    gaugeMaxBeats,
  };
}

/**
 * 経過拍数 (elapsedBeats) から最も近い有効音符ゾーンを判定して返す。
 */
export function quantizeBeatsToZone(elapsedBeats: number, enabledIds: string[]): CandidateZone {
  const { zones } = computeCandidateZones(enabledIds);
  const clampedBeats = Math.max(0, elapsedBeats);

  for (let i = 0; i < zones.length; i++) {
    if (clampedBeats < zones[i].maxBeats) {
      return zones[i];
    }
  }
  return zones[zones.length - 1];
}

/**
 * 経過ミリ秒とBPMから4分音符基準の経過拍数を算出する。
 */
export function msToBeats(elapsedMs: number, bpm: number): number {
  const safeBpm = Math.max(20, Math.min(300, bpm || 120));
  const safeMs = Math.max(0, elapsedMs);
  return (safeMs / 1000) * (safeBpm / 60);
}

/**
 * メトロノームのクリック間隔設定オプション
 * value は4分音符=1.0拍に対する間隔拍数 (0 はミュート)
 */
export type MetronomeIntervalBeats = 0 | 2 | 1 | 0.5 | 0.25;

export interface MetronomeIntervalOption {
  value: MetronomeIntervalBeats;
  label: string;
  title: string;
}

export const METRONOME_INTERVAL_OPTIONS: MetronomeIntervalOption[] = [
  { value: 0, label: 'OFF', title: 'クリック音なし（視覚メトロノーム・ゲージのみ）' },
  { value: 2, label: '2分', title: '2分音符 (2拍) ごとにクリック音を鳴らす' },
  { value: 1, label: '4分', title: '4分音符 (1拍) ごとにクリック音を鳴らす' },
  { value: 0.5, label: '8分', title: '8分音符 (0.5拍) ごとにクリック音を鳴らす（表拍は高音、裏拍は低音）' },
  { value: 0.25, label: '16分', title: '16分音符 (0.25拍) ごとにクリック音を鳴らす（拍頭は高音、細分拍は低音）' },
];

export type MetronomeClickAccent = 'accent' | 'quarter' | 'sub';

/**
 * 指定拍位置におけるメトロノームクリックのアクセント種別を返す。
 * - 4拍の倍数 (4.0, 8.0 ...): 'accent' (全音符節目の高音アクセント)
 * - 1拍の倍数 (0.0, 1.0, 2.0, 3.0 ...): 'quarter' (4分音符拍頭の標準クリック)
 * - それ以外 (0.5, 0.25, 0.75 ...): 'sub' (裏拍・細分拍の控えめなクリック)
 */
export function getMetronomeAccentAtBeat(beatPosition: number): MetronomeClickAccent {
  const eps = 1e-4;
  if (beatPosition > eps) {
    const nearestFour = Math.round(beatPosition / 4) * 4;
    if (nearestFour > 0 && Math.abs(beatPosition - nearestFour) < eps) {
      return 'accent';
    }
  }
  const nearestOne = Math.round(beatPosition);
  if (Math.abs(beatPosition - nearestOne) < eps) {
    return 'quarter';
  }
  return 'sub';
}
