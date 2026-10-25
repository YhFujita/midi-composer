import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Delete,
  CornerDownLeft,
  Eye,
  EyeOff,
  Zap,
  Timer,
  RotateCcw,
  Minus,
  Plus,
} from 'lucide-react';
import { SvgPianoKeyboard } from './SvgPianoKeyboard';
import { NoteIcon } from './NoteIcon';
import { SemiRealtimeMonitor, LastQuantizedResult } from './SemiRealtimeMonitor';
import { audioEngine } from '../../core/audio/soundFontPlayer';
import { getInstrumentByProgram } from '../../constants/instruments';
import {
  SEMI_REALTIME_CANDIDATES,
  DEFAULT_ENABLED_CANDIDATE_IDS,
  STRAIGHT_CANDIDATE_IDS,
  METRONOME_INTERVAL_OPTIONS,
  MetronomeIntervalBeats,
  MetronomeClickAccent,
  quantizeBeatsToZone,
  msToBeats,
  getMetronomeAccentAtBeat,
} from '../../utils/semiRealtimeQuantizer';

export interface PianoKeyboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
  onBackspace?: () => void;
  onUndo?: () => void;
  currentProgram?: number;
  isDrumMode?: boolean;
  /** MMLスコア上の現在カーソル位置のBPM (半リアルタイム入力のテンポ連動用) */
  scoreBpm?: number;
}

const NOTE_LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

const STORAGE_KEY_CANDIDATES = 'midi_composer_semi_rt_candidates';
const STORAGE_KEY_INTERVAL = 'midi_composer_semi_rt_interval';

/**
 * プリセット音長定義
 * ユーザー要望: 3で付点4分音符、6で付点8分音符(6分音符)、1直後6で16分音符
 */
interface PresetDuration {
  label: string;
  keyDisplay: string;
  duration: string;
  isDotted: boolean;
  title: string;
}

const PRESET_DURATIONS: PresetDuration[] = [
  { label: '全', keyDisplay: '1', duration: '1', isDotted: false, title: '全音符 (キー: 1)' },
  { label: '2分', keyDisplay: '2', duration: '2', isDotted: false, title: '2分音符 (キー: 2)' },
  { label: '付点4分', keyDisplay: '3', duration: '4', isDotted: true, title: '付点4分音符 (キー: 3)' },
  { label: '4分', keyDisplay: '4', duration: '4', isDotted: false, title: '4分音符 (キー: 4)' },
  { label: '付点8分', keyDisplay: '6', duration: '8', isDotted: true, title: '付点8分音符 (6分音符 / キー: 6)' },
  { label: '8分', keyDisplay: '8', duration: '8', isDotted: false, title: '8分音符 (キー: 8)' },
  { label: '16分', keyDisplay: '16', duration: '16', isDotted: false, title: '16分音符 (キー: 1の直後に6)' },
];

/** 半リアルタイムモード用の事前設定休符オプション */
const REST_DURATION_OPTIONS: { label: string; duration: string; isDotted: boolean; mml: string }[] = [
  { label: '16分休符 (r16)', duration: '16', isDotted: false, mml: 'r16' },
  { label: '8分休符 (r8)', duration: '8', isDotted: false, mml: 'r8' },
  { label: '付点8分休符 (r8.)', duration: '8', isDotted: true, mml: 'r8.' },
  { label: '4分休符 (r4)', duration: '4', isDotted: false, mml: 'r4' },
  { label: '付点4分休符 (r4.)', duration: '4', isDotted: true, mml: 'r4.' },
  { label: '2分休符 (r2)', duration: '2', isDotted: false, mml: 'r2' },
  { label: '付点2分休符 (r2.)', duration: '2', isDotted: true, mml: 'r2.' },
  { label: '全休符 (r1)', duration: '1', isDotted: false, mml: 'r1' },
];

/**
 * 現在の音長・付点設定から視覚的な表示名称とMML記述例を取得
 */
function getNoteDescription(duration: string, isDotted: boolean): { name: string; mmlExample: string } {
  let name = '';
  if (duration === '1') {
    name = isDotted ? '付点全音符' : '全音符';
  } else if (duration === '2') {
    name = isDotted ? '付点2分音符' : '2分音符';
  } else if (duration === '4') {
    name = isDotted ? '付点4分音符' : '4分音符';
  } else if (duration === '8') {
    name = isDotted ? '付点8分音符 (6分)' : '8分音符';
  } else if (duration === '16') {
    name = isDotted ? '付点16分音符' : '16分音符';
  } else {
    name = `${duration}分音符${isDotted ? ' (付点)' : ''}`;
  }
  return {
    name,
    mmlExample: `c${duration}${isDotted ? '.' : ''}`,
  };
}

/**
 * MIDIノート番号・音長・オクターブ設定からMML文字列と更新後オクターブを生成する純粋関数
 */
function buildNoteMml(
  midiNote: number,
  targetDuration: string,
  targetIsDotted: boolean,
  lastOctave: number,
  octaveFormat: 'auto' | 'explicit' | 'note-only'
): { code: string; nextOctave: number } {
  const noteIndex = ((midiNote % 12) + 12) % 12;
  const noteName = NOTE_LETTERS[noteIndex];
  const octave = Math.floor(midiNote / 12) - 1;
  const durStr = `${targetDuration}${targetIsDotted ? '.' : ''}`;

  if (octaveFormat === 'auto') {
    let code = '';
    if (octave === lastOctave) {
      code = `${noteName}${durStr}`;
    } else if (octave === lastOctave + 1) {
      code = `> ${noteName}${durStr}`;
    } else if (octave === lastOctave - 1) {
      code = `< ${noteName}${durStr}`;
    } else {
      code = `o${octave} ${noteName}${durStr}`;
    }
    return { code, nextOctave: octave };
  } else if (octaveFormat === 'explicit') {
    return { code: `o${octave} ${noteName}${durStr}`, nextOctave: octave };
  } else {
    return { code: `${noteName}${durStr}`, nextOctave: lastOctave };
  }
}

export const PianoKeyboardPanel: React.FC<PianoKeyboardPanelProps> = ({
  isOpen,
  onClose,
  onInsertText,
  onBackspace,
  onUndo,
  currentProgram = 0,
  isDrumMode = false,
  scoreBpm = 120,
}) => {
  // モード: 'preview' (試聴), 'insert' (通常入力), 'smart' (直感操作), 'semi-realtime' (半リアルタイム入力)
  const [mode, setMode] = useState<'preview' | 'insert' | 'smart' | 'semi-realtime'>('insert');

  // 入力モード設定 (半リアルタイムモードでは「事前設定の休符長」としても機能)
  const [duration, setDuration] = useState<string>('4');
  const [isDotted, setIsDotted] = useState<boolean>(false);
  const [octaveFormat, setOctaveFormat] = useState<'auto' | 'explicit' | 'note-only'>('auto');
  const [lastInsertedOctave, setLastInsertedOctave] = useState<number>(4);

  // --- 半リアルタイム入力専用ステート ---
  // 自動判定候補の音符リスト (例: 16, 8, 8., 4, 4., 2, 2., 1)
  const [enabledCandidateIds, setEnabledCandidateIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CANDIDATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = new Set(SEMI_REALTIME_CANDIDATES.map((c) => c.id));
          const filtered = parsed.filter((id: unknown) => typeof id === 'string' && validIds.has(id));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_ENABLED_CANDIDATE_IDS;
  });

  // メトロノームのクリック間隔拍数 (デフォルト: 1拍 = 4分音符ごと)
  const [clickIntervalBeats, setClickIntervalBeats] = useState<MetronomeIntervalBeats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INTERVAL);
      if (saved !== null) {
        const num = Number(saved);
        if ([0, 2, 1, 0.5, 0.25].includes(num)) {
          return num as MetronomeIntervalBeats;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 1;
  });

  // 半リアルタイム計測用のテンポ設定 (スコア連動 or 手動BPM)
  const [syncWithScoreBpm, setSyncWithScoreBpm] = useState<boolean>(true);
  const [customBpm, setCustomBpm] = useState<number>(100);
  const effectiveBpm = syncWithScoreBpm ? Math.max(20, Math.min(300, scoreBpm || 120)) : customBpm;

  // ホールド計測中のリアルタイム状態
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [holdingMidiNote, setHoldingMidiNote] = useState<number | null>(null);
  const [holdingBeats, setHoldingBeats] = useState<number>(0);
  const [holdingSec, setHoldingSec] = useState<number>(0);
  const [lastClickFlash, setLastClickFlash] = useState<{
    timestamp: number;
    accent: MetronomeClickAccent;
  } | null>(null);
  const [lastQuantizedResult, setLastQuantizedResult] = useState<LastQuantizedResult | null>(null);

  // 高精度タイミング管理用Ref (再レンダーによるクロージャ陳腐化を防ぐ)
  const holdStateRef = useRef<{
    active: boolean;
    midiNote: number | null;
    startPerf: number;
    cancelled: boolean;
    lastClickStep: number;
  }>({
    active: false,
    midiNote: null,
    startPerf: 0,
    cancelled: false,
    lastClickStep: 0,
  });

  const latestSemiRtConfigRef = useRef({
    effectiveBpm,
    clickIntervalBeats,
    enabledCandidateIds,
    octaveFormat,
    lastInsertedOctave,
  });

  useEffect(() => {
    latestSemiRtConfigRef.current = {
      effectiveBpm,
      clickIntervalBeats,
      enabledCandidateIds,
      octaveFormat,
      lastInsertedOctave,
    };
  }, [effectiveBpm, clickIntervalBeats, enabledCandidateIds, octaveFormat, lastInsertedOctave]);

  // 1キー押下直後の16分音符判定タイマーと待機フラグ
  const [isWaitingSixAfterOne, setIsWaitingSixAfterOne] = useState<boolean>(false);
  const pendingOneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 一時的な操作フィードバックメッセージ
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 1600);
  }, []);

  // 鍵盤表示設定: ドラムモード時は C2〜 (MIDI 36〜、キック/スネア/ハイハットの中心)
  const [startOctave, setStartOctave] = useState<number>(() => (isDrumMode ? 2 : 3));
  const [octaveCount] = useState<number>(3); // 3オクターブ
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [soundOption, setSoundOption] = useState<'current' | 'piano'>('current');

  // ドラムモード切り替え時に開始オクターブをドラム主音域(C2)に自動追従
  useEffect(() => {
    if (isDrumMode) {
      setStartOctave(2);
    }
  }, [isDrumMode]);

  // 現在発音中/押下中のMIDIノート
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  // 楽器情報
  const currentInst = useMemo(() => getInstrumentByProgram(currentProgram), [currentProgram]);

  // 現在選択中の音符情報 (通常/直感モードでは音符長、半リアルタイムモードでは事前設定休符長)
  const noteDesc = useMemo(() => getNoteDescription(duration, isDotted), [duration, isDotted]);

  // 半リアルタイム候補の個別トグル
  const handleToggleCandidate = useCallback(
    (id: string) => {
      setEnabledCandidateIds((prev) => {
        const exists = prev.includes(id);
        if (exists && prev.length <= 1) {
          triggerFeedback('⚠️ 少なくとも1つの音符長を有効にしてください');
          return prev;
        }
        const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
        // マスター定義順に整列して保存
        const ordered = SEMI_REALTIME_CANDIDATES.filter((c) => next.includes(c.id)).map((c) => c.id);
        try {
          localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(ordered));
        } catch {
          // ignore
        }
        return ordered;
      });
    },
    [triggerFeedback]
  );

  // 半リアルタイム候補の一括プリセット適用
  const handleApplyCandidatePreset = useCallback(
    (ids: string[], presetLabel: string) => {
      setEnabledCandidateIds(ids);
      try {
        localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(ids));
      } catch {
        // ignore
      }
      triggerFeedback(`自動判定候補を「${presetLabel}」に設定`);
    },
    [triggerFeedback]
  );

  // クリック間隔の変更
  const handleChangeClickInterval = useCallback(
    (val: MetronomeIntervalBeats) => {
      setClickIntervalBeats(val);
      try {
        localStorage.setItem(STORAGE_KEY_INTERVAL, String(val));
      } catch {
        // ignore
      }
      if (val > 0) {
        // 変更時にクリック音を1回プレビュー発音して感触を伝える
        audioEngine.playMetronomeClick('quarter', 0.65);
      }
    },
    []
  );

  // 手動BPMの増減操作
  const handleAdjustBpm = useCallback(
    (delta: number) => {
      const base = syncWithScoreBpm ? effectiveBpm : customBpm;
      const next = Math.max(30, Math.min(240, base + delta));
      setSyncWithScoreBpm(false);
      setCustomBpm(next);
    },
    [syncWithScoreBpm, effectiveBpm, customBpm]
  );

  // ホールド中のリアルタイム計測 & メトロノームクリック発火ループ
  useEffect(() => {
    if (!isHolding || mode !== 'semi-realtime') return;

    let rafId: number;
    const tick = () => {
      const hs = holdStateRef.current;
      if (!hs.active || hs.cancelled) return;

      const now = performance.now();
      const elapsedMs = Math.max(0, now - hs.startPerf);
      const cfg = latestSemiRtConfigRef.current;
      const beats = msToBeats(elapsedMs, cfg.effectiveBpm);

      setHoldingBeats(beats);
      setHoldingSec(elapsedMs / 1000);

      if (cfg.clickIntervalBeats > 0) {
        const currentStep = Math.floor(beats / cfg.clickIntervalBeats);
        if (currentStep > hs.lastClickStep) {
          hs.lastClickStep = currentStep;
          const stepBeat = currentStep * cfg.clickIntervalBeats;
          const accent = getMetronomeAccentAtBeat(stepBeat);
          audioEngine.playMetronomeClick(accent);
          setLastClickFlash({ timestamp: now, accent });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isHolding, mode]);

  // パネル非表示・モード変更・ウィンドウフォーカス喪失時のホールド安全解除
  const cancelActiveHoldSilently = useCallback(() => {
    const hs = holdStateRef.current;
    if (hs.active) {
      const midi = hs.midiNote;
      hs.active = false;
      hs.midiNote = null;
      hs.cancelled = true;
      if (midi !== null) {
        audioEngine.noteOff(midi, isDrumMode);
      }
      setActiveNotes([]);
      setIsHolding(false);
      setHoldingMidiNote(null);
      setHoldingBeats(0);
      setHoldingSec(0);
    }
  }, [isDrumMode]);

  useEffect(() => {
    if (!isOpen || mode !== 'semi-realtime') {
      cancelActiveHoldSilently();
    }
  }, [isOpen, mode, cancelActiveHoldSilently]);

  useEffect(() => {
    const handleWindowBlur = () => {
      cancelActiveHoldSilently();
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [cancelActiveHoldSilently]);

  // 半リアルタイムホールド中にリアルタイム表示するMMLプレビュー文字列
  const holdingPreviewMml = useMemo(() => {
    if (!isHolding || holdingMidiNote === null) return '';
    const zone = quantizeBeatsToZone(holdingBeats, enabledCandidateIds);
    return buildNoteMml(
      holdingMidiNote,
      zone.candidate.duration,
      zone.candidate.isDotted,
      lastInsertedOctave,
      octaveFormat
    ).code;
  }, [isHolding, holdingMidiNote, holdingBeats, enabledCandidateIds, lastInsertedOctave, octaveFormat]);

  // 鍵盤押下時ハンドラ
  const handleNoteDown = useCallback(
    (midiNote: number) => {
      // 1. 発音 (ドラムモード時は Channel 10 ドラムセットで発音)
      const inst = soundOption === 'piano' && !isDrumMode ? 0 : currentProgram;
      audioEngine.noteOn(midiNote, 105, inst, isDrumMode);
      setActiveNotes((prev) => (prev.includes(midiNote) ? prev : [...prev, midiNote]));

      // 2. 通常入力または直感操作モードの場合は押下時点でエディタへMML挿入
      if (mode === 'insert' || mode === 'smart') {
        const { code, nextOctave } = buildNoteMml(
          midiNote,
          duration,
          isDotted,
          lastInsertedOctave,
          octaveFormat
        );
        setLastInsertedOctave(nextOctave);
        onInsertText(code);
        return;
      }

      // 3. 半リアルタイムモードの場合は押下時点から時間計測を開始し、離鍵時に長さを確定する
      if (mode === 'semi-realtime') {
        const now = performance.now();
        holdStateRef.current = {
          active: true,
          midiNote,
          startPerf: now,
          cancelled: false,
          lastClickStep: 0,
        };
        setHoldingMidiNote(midiNote);
        setHoldingBeats(0);
        setHoldingSec(0);
        setIsHolding(true);

        // 押下開始時点 (0拍目) の基準クリックを発音
        if (latestSemiRtConfigRef.current.clickIntervalBeats > 0) {
          audioEngine.playMetronomeClick('quarter');
          setLastClickFlash({ timestamp: now, accent: 'quarter' });
        }
      }
    },
    [
      mode,
      soundOption,
      currentProgram,
      isDrumMode,
      duration,
      isDotted,
      octaveFormat,
      lastInsertedOctave,
      onInsertText,
    ]
  );

  // 鍵盤離脱時ハンドラ
  const handleNoteUp = useCallback(
    (midiNote: number) => {
      audioEngine.noteOff(midiNote, isDrumMode);
      setActiveNotes((prev) => prev.filter((n) => n !== midiNote));

      // 半リアルタイムモード: 押していた時間から最も近い有効音符を自動判定して挿入
      const hs = holdStateRef.current;
      if (mode === 'semi-realtime' && hs.active && hs.midiNote === midiNote) {
        const now = performance.now();
        const elapsedMs = Math.max(0, now - hs.startPerf);
        const wasCancelled = hs.cancelled;

        // ホールド状態をリセット（押していない間は時間が流れない）
        hs.active = false;
        hs.midiNote = null;
        setIsHolding(false);
        setHoldingMidiNote(null);
        setHoldingBeats(0);
        setHoldingSec(0);

        if (!wasCancelled) {
          const cfg = latestSemiRtConfigRef.current;
          const beats = msToBeats(elapsedMs, cfg.effectiveBpm);
          const matchedZone = quantizeBeatsToZone(beats, cfg.enabledCandidateIds);

          const { code, nextOctave } = buildNoteMml(
            midiNote,
            matchedZone.candidate.duration,
            matchedZone.candidate.isDotted,
            cfg.lastInsertedOctave,
            cfg.octaveFormat
          );

          cfg.lastInsertedOctave = nextOctave;
          setLastInsertedOctave(nextOctave);
          onInsertText(code);

          setLastQuantizedResult({
            mml: code,
            candidate: matchedZone.candidate,
            elapsedBeats: beats,
            elapsedSec: elapsedMs / 1000,
          });
          triggerFeedback(
            `⏱️ ${matchedZone.candidate.label} (${code}) を入力 [${beats.toFixed(2)}拍]`
          );
        }
      }
    },
    [isDrumMode, mode, onInsertText, triggerFeedback]
  );

  // 休符挿入
  const handleInsertRest = useCallback(() => {
    const durStr = `${duration}${isDotted ? '.' : ''}`;
    onInsertText(`r${durStr}`);
  }, [duration, isDotted, onInsertText]);

  // オクターブシフト操作
  const handleOctaveShift = useCallback((delta: number) => {
    setStartOctave((prev) => Math.max(1, Math.min(6, prev + delta)));
  }, []);

  /**
   * 直感操作モード ＆ 半リアルタイムモード共通のキーボードイベントハンドラ
   * - 数字キー (1〜8): 音符長 (半リアルタイムモードでは事前設定の休符長) の切り替え
   *   - 1を押した直後に6を押す: 16分
   *   - 1直後以外の6: 付点8分 (duration: '8', isDotted: true)
   *   - 3: 付点4分 (duration: '4', isDotted: true)
   *   - 2, 4, 8: 各種音長
   * - . : 付点トグル
   * - r : 事前設定した長さの休符挿入 (半リアルタイムモード中も時間を進めず即挿入)
   * - ^ : タイ挿入
   * - Space : 空白挿入
   * - Enter : 改行挿入
   * - Backspace : 削除
   * - Escape : 半リアルタイム押下中の入力をキャンセル
   */
  useEffect(() => {
    const isKeyboardShortcutMode = mode === 'smart' || mode === 'semi-realtime';
    if (!isOpen || !isKeyboardShortcutMode) {
      setIsWaitingSixAfterOne(false);
      if (pendingOneTimerRef.current) {
        clearTimeout(pendingOneTimerRef.current);
        pendingOneTimerRef.current = null;
      }
      return;
    }

    const prefixLabel = mode === 'semi-realtime' ? '休符長を ' : '';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escキーでホールド中の半リアルタイム入力を即時キャンセル
      if (e.key === 'Escape' && holdStateRef.current.active) {
        e.preventDefault();
        e.stopPropagation();
        cancelActiveHoldSilently();
        triggerFeedback('🚫 押下中の音符入力をキャンセルしました');
        return;
      }

      // モーダル等で他のフォーム要素 (input, select, 通常のtextarea) にフォーカスがある場合は横取りしない
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isMonaco = activeEl.classList.contains('inputarea');
        if (!isMonaco && (tagName === 'input' || tagName === 'textarea' || tagName === 'select')) {
          return;
        }
      }

      // 修飾キー (Ctrl, Alt, Meta) が押されている場合はブラウザ・OSショートカット (Ctrl+Z 等) を優先
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // キーリピートによる連続誤挿入（rキー押しっぱなし等）を防止
      if (e.repeat && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const key = e.key;

      // 1. 数字キー: 音長 / 休符長 切り替え
      if (key === '1') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('1');
        setIsDotted(false);
        setIsWaitingSixAfterOne(true);
        triggerFeedback(`${prefixLabel}全 (1) に設定 [6で16分]`);

        if (pendingOneTimerRef.current) {
          clearTimeout(pendingOneTimerRef.current);
        }
        pendingOneTimerRef.current = setTimeout(() => {
          setIsWaitingSixAfterOne(false);
          pendingOneTimerRef.current = null;
        }, 1000);
        return;
      }

      if (key === '6') {
        e.preventDefault();
        e.stopPropagation();
        if (isWaitingSixAfterOne) {
          if (pendingOneTimerRef.current) {
            clearTimeout(pendingOneTimerRef.current);
            pendingOneTimerRef.current = null;
          }
          setIsWaitingSixAfterOne(false);
          setDuration('16');
          setIsDotted(false);
          triggerFeedback(`⚡ ${prefixLabel}16分 (16) に設定`);
        } else {
          setDuration('8');
          setIsDotted(true);
          triggerFeedback(`⚡ ${prefixLabel}付点8分 (8.) に設定`);
        }
        return;
      }

      // 1以外のキーが押されたら、1待機フラグは解除
      if (isWaitingSixAfterOne) {
        if (pendingOneTimerRef.current) {
          clearTimeout(pendingOneTimerRef.current);
          pendingOneTimerRef.current = null;
        }
        setIsWaitingSixAfterOne(false);
      }

      if (key === '2') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('2');
        setIsDotted(false);
        triggerFeedback(`${prefixLabel}2分 (2) に設定`);
        return;
      }

      if (key === '3') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('4');
        setIsDotted(true);
        triggerFeedback(`⚡ ${prefixLabel}付点4分 (4.) に設定`);
        return;
      }

      if (key === '4') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('4');
        setIsDotted(false);
        triggerFeedback(`${prefixLabel}4分 (4) に設定`);
        return;
      }

      if (key === '8') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('8');
        setIsDotted(false);
        triggerFeedback(`${prefixLabel}8分 (8) に設定`);
        return;
      }

      // 2. 付点トグル (.)
      if (key === '.') {
        e.preventDefault();
        e.stopPropagation();
        setIsDotted((prev) => {
          const next = !prev;
          triggerFeedback(next ? `${prefixLabel}付点 ON` : `${prefixLabel}付点 OFF`);
          return next;
        });
        return;
      }

      // 3. 休符挿入 (r / R)
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        e.stopPropagation();
        handleInsertRest();
        triggerFeedback(`休符 (r${duration}${isDotted ? '.' : ''}) を挿入`);
        return;
      }

      // 4. タイ挿入 (^)
      if (key === '^' || key === '~') {
        e.preventDefault();
        e.stopPropagation();
        onInsertText('^');
        triggerFeedback('タイ (^) を挿入');
        return;
      }

      // 5. 空白挿入 (Space)
      if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onInsertText(' ');
        triggerFeedback('空白 を挿入');
        return;
      }

      // 6. 改行挿入 (Enter)
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onInsertText('\n');
        triggerFeedback('改行 を挿入');
        return;
      }

      // 7. 削除 (Backspace)
      if (key === 'Backspace') {
        if (onBackspace) {
          e.preventDefault();
          e.stopPropagation();
          onBackspace();
          triggerFeedback('削除 (BS)');
        }
        return;
      }

      // 8. オクターブ記号 (<, >)
      if (key === '>') {
        e.preventDefault();
        e.stopPropagation();
        onInsertText('>');
        triggerFeedback('オクターブUP (>)');
        return;
      }
      if (key === '<') {
        e.preventDefault();
        e.stopPropagation();
        onInsertText('<');
        triggerFeedback('オクターブDOWN (<)');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (pendingOneTimerRef.current) {
        clearTimeout(pendingOneTimerRef.current);
      }
    };
  }, [
    isOpen,
    mode,
    duration,
    isDotted,
    isWaitingSixAfterOne,
    handleInsertRest,
    onInsertText,
    onBackspace,
    triggerFeedback,
    cancelActiveHoldSilently,
  ]);

  if (!isOpen) return null;

  const isStandardInputActive = mode === 'insert' || mode === 'smart';
  const currentRestValue = `r${duration}${isDotted ? '.' : ''}`;

  return (
    <div
      className="border-t border-slate-300 shadow-2xl flex flex-col z-30 flex-shrink-0 transition-all duration-200 select-none"
      style={{ backgroundColor: '#ffffff', opacity: 1, color: '#0f172a' }}
    >
      {/* メイン上部コントロールバー */}
      <div
        className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-slate-200 gap-y-1.5 gap-x-2"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* 左側: タイトル & ドラムバッジ & モード切替 */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-900 mr-0.5">
            <span className="text-base leading-none">🎹</span>
            <span className="hidden sm:inline">ピアノエディタ</span>
          </div>

          {/* ドラムモードバッジ */}
          {isDrumMode && (
            <span
              className="flex items-center space-x-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md shadow-xs animate-in fade-in"
              title="ドラムセット音源 (MIDI Channel 10) が選択されています。鍵盤をクリックすると打楽器音が鳴ります。"
            >
              <span>🥁 ドラムセット (Ch 10)</span>
            </span>
          )}

          {/* モード切替セグメントボタン: 試聴モード / 入力モード / 直感操作モード / 半リアルタイム */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 shadow-inner">
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mode === 'preview'
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="音階と音色を確かめるモード（エディタへは書き込みません）"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>試聴モード</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('insert')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mode === 'insert'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="マウス操作でエディタへ固定長の音符を入力するモード"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>入力モード</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('smart');
                triggerFeedback('⚡ 直感操作モードが有効になりました');
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mode === 'smart'
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                  : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 font-semibold'
              }`}
              title="キーボードで音長・休符・タイ等を高速切替しながら、マウス鍵盤とハイブリッドで入力できる直感モード"
            >
              <Zap
                className={`w-3.5 h-3.5 ${
                  mode === 'smart' ? 'text-amber-300 fill-amber-300' : 'text-indigo-500'
                }`}
              />
              <span>直感操作モード</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('semi-realtime');
                triggerFeedback('⏱️ 半リアルタイム入力モードが有効になりました');
              }}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mode === 'semi-realtime'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                  : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50 font-semibold'
              }`}
              title="鍵盤を押している長さに応じて、事前設定した音符候補の中から近い音長を自動選択して入力するモード（押していない間は時間が進みません）"
            >
              <Timer
                className={`w-3.5 h-3.5 ${
                  mode === 'semi-realtime' ? 'text-amber-200' : 'text-emerald-600'
                }`}
              />
              <span>半リアルタイム</span>
            </button>
          </div>

          {/* 操作フィードバック通知バッジ */}
          {feedback && (
            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-xs animate-in fade-in flex items-center space-x-1">
              <span>{feedback}</span>
            </span>
          )}
        </div>

        {/* 中央A: 通常入力 / 直感操作モード時の音長・付点・記号設定 */}
        {isStandardInputActive && (
          <div className="flex items-center space-x-2 flex-wrap bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 gap-y-1">
            {/* 現在選択中の音符プレビューカード */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md border shadow-xs transition-all ${
                mode === 'smart'
                  ? 'bg-white border-indigo-400 ring-1 ring-indigo-200'
                  : 'bg-white border-blue-400 ring-1 ring-blue-200'
              }`}
              title={`現在選択中の音符: ${noteDesc.name} (${noteDesc.mmlExample})`}
            >
              <span className="text-[10px] font-bold text-slate-500">選択中:</span>
              <NoteIcon
                duration={duration}
                isDotted={isDotted}
                size={18}
                className={mode === 'smart' ? 'text-indigo-600' : 'text-blue-600'}
              />
              <span className="text-xs font-black text-slate-900 font-mono">
                {noteDesc.name}
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                {noteDesc.mmlExample}
              </span>
              {isDotted && (
                <span className="text-[10px] font-black px-1.5 py-0.2 bg-amber-500 text-white rounded shadow-2xs">
                  付点
                </span>
              )}
            </div>

            <span className="text-slate-300">|</span>

            {/* 音長選択ボタングループ */}
            <div className="flex items-center space-x-1 flex-wrap">
              {PRESET_DURATIONS.map((preset) => {
                const isSelected = duration === preset.duration && isDotted === preset.isDotted;
                return (
                  <button
                    key={`${preset.duration}-${preset.isDotted}`}
                    type="button"
                    onClick={() => {
                      setDuration(preset.duration);
                      setIsDotted(preset.isDotted);
                      triggerFeedback(`${preset.label}音符 に設定`);
                    }}
                    className={`flex items-center space-x-1 px-1.5 py-0.5 text-xs font-bold rounded border transition-all cursor-pointer ${
                      isSelected
                        ? mode === 'smart'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400'
                          : 'bg-blue-600 text-white border-blue-700 shadow-xs ring-1 ring-blue-400'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={preset.title}
                  >
                    <NoteIcon
                      duration={preset.duration}
                      isDotted={preset.isDotted}
                      size={14}
                      className={isSelected ? 'text-white' : 'text-slate-600'}
                    />
                    <span>{preset.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                        isSelected
                          ? mode === 'smart'
                            ? 'bg-indigo-700 text-indigo-100'
                            : 'bg-blue-700 text-blue-100'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {preset.keyDisplay}
                    </span>
                  </button>
                );
              })}

              {/* 付点トグルボタン */}
              <button
                type="button"
                onClick={() => {
                  setIsDotted((prev) => {
                    const next = !prev;
                    triggerFeedback(next ? '付点 ON' : '付点 OFF');
                    return next;
                  });
                }}
                className={`flex items-center space-x-1 px-1.5 py-0.5 text-xs font-bold rounded border transition-all cursor-pointer ${
                  isDotted
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-1 ring-amber-400'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="付点トグル (キー: .)"
              >
                <span>付点</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                    isDotted ? 'bg-amber-600 text-amber-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  .
                </span>
              </button>
            </div>

            <span className="text-slate-300">|</span>

            {/* 記号挿入アクション */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  handleInsertRest();
                  triggerFeedback(`休符 (${currentRestValue})`);
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors flex items-center space-x-0.5 cursor-pointer"
                title={`休符 (${currentRestValue}) を挿入 (キー: r)`}
              >
                <span>休符</span>
                <span className="text-[9px] text-slate-500 font-mono">r</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onInsertText('^');
                  triggerFeedback('タイ (^) を挿入');
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors flex items-center space-x-0.5 cursor-pointer"
                title="タイ (^) を挿入 (キー: ^)"
              >
                <span>タイ</span>
                <span className="text-[9px] text-slate-500 font-mono">^</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onInsertText(' ');
                  triggerFeedback('空白 を挿入');
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors cursor-pointer"
                title="空白スペースを挿入 (キー: Space)"
              >
                空白
              </button>
              <button
                type="button"
                onClick={() => {
                  onInsertText('\n');
                  triggerFeedback('改行 を挿入');
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors flex items-center space-x-0.5 cursor-pointer"
                title="改行を挿入 (キー: Enter)"
              >
                <CornerDownLeft className="w-3 h-3" />
                <span>改行</span>
              </button>
              {onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    onUndo();
                    triggerFeedback('直前の操作を取消 (Undo)');
                  }}
                  className="p-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded shadow-2xs transition-colors cursor-pointer"
                  title="直前の入力を元に戻す (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onBackspace && (
                <button
                  type="button"
                  onClick={() => {
                    onBackspace();
                    triggerFeedback('削除 (BS)');
                  }}
                  className="p-1 bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 rounded shadow-2xs transition-colors cursor-pointer"
                  title="直前の1文字を削除 (キー: Backspace)"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span className="text-slate-300">|</span>

            {/* オクターブ指定形式 */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-bold text-slate-600">記法:</span>
              <select
                value={octaveFormat}
                onChange={(e) => setOctaveFormat(e.target.value as any)}
                className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1.5 py-0.5 font-medium outline-none shadow-2xs"
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                title="MML出力時のオクターブ記述スタイル"
              >
                <option value="auto">自動 (&gt;, &lt;)</option>
                <option value="explicit">明示 (o4)</option>
                <option value="note-only">音名のみ</option>
              </select>
            </div>
          </div>
        )}

        {/* 中央B: 半リアルタイム入力モード専用設定バー */}
        {mode === 'semi-realtime' && (
          <div
            className="flex items-center space-x-2 flex-wrap px-2 py-1 rounded-lg border border-emerald-200 gap-y-1"
            style={{ backgroundColor: '#f0fdf4', opacity: 1 }}
          >
            {/* 1. 自動振り分け音符候補のON/OFFマルチ選択 */}
            <div className="flex items-center space-x-1 flex-wrap gap-y-1">
              <span
                className="text-[11px] font-extrabold text-emerald-950 mr-0.5"
                title="クリックして自動判定に含める音符の長さをON/OFFします"
              >
                候補:
              </span>
              {SEMI_REALTIME_CANDIDATES.map((cand) => {
                const isEnabled = enabledCandidateIds.includes(cand.id);
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleToggleCandidate(cand.id)}
                    className={`flex items-center space-x-0.5 px-1.5 py-0.5 text-xs font-bold rounded border transition-all cursor-pointer ${
                      isEnabled
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-400 border-slate-300 hover:text-slate-700 hover:border-slate-400'
                    }`}
                    title={`${cand.label} (${cand.beats}拍) を自動判定候補に${
                      isEnabled ? '含めています (クリックで除外)' : '含める'
                    }`}
                  >
                    <NoteIcon
                      duration={cand.duration}
                      isDotted={cand.isDotted}
                      size={13}
                      className={isEnabled ? 'text-white' : 'text-slate-400'}
                    />
                    <span>{cand.shortLabel}</span>
                  </button>
                );
              })}

              {/* 候補クイックプリセット */}
              <div className="flex items-center space-x-0.5 ml-0.5">
                <button
                  type="button"
                  onClick={() => handleApplyCandidatePreset(DEFAULT_ENABLED_CANDIDATE_IDS, '全種')}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded cursor-pointer"
                  title="全8種類 (16, 8, 付点8, 4, 付点4, 2, 付点2, 全) をすべて有効化"
                >
                  全種
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCandidatePreset(STRAIGHT_CANDIDATE_IDS, '付点なし')}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-white hover:bg-emerald-100 text-slate-700 border border-slate-300 rounded cursor-pointer"
                  title="付点音符を除いた基本5種類 (16, 8, 4, 2, 全) のみを有効化"
                >
                  付点なし
                </button>
              </div>
            </div>

            <span className="text-emerald-300">|</span>

            {/* 2. メトロノームのクリック頻度 & BPM設定 */}
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span className="text-[11px] font-extrabold text-emerald-950">クリック:</span>
              <div className="flex items-center bg-white rounded-md border border-slate-300 p-0.5">
                {METRONOME_INTERVAL_OPTIONS.map((opt) => {
                  const active = clickIntervalBeats === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChangeClickInterval(opt.value)}
                      className={`px-1.5 py-0.5 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                        active
                          ? opt.value === 0
                            ? 'bg-slate-700 text-white'
                            : 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title={opt.title}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* テンポ (BPM) 連動 / 手動調整 */}
              <div className="flex items-center space-x-0.5 bg-white border border-slate-300 rounded-md px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setSyncWithScoreBpm((prev) => !prev)}
                  className={`px-1.5 py-0.2 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                    syncWithScoreBpm
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                  title={
                    syncWithScoreBpm
                      ? `MML内のテンポ (${scoreBpm} BPM) に自動連動中（クリックで手動BPM固定に切替）`
                      : `手動テンポ固定中（クリックでMMLテンポ ${scoreBpm} BPM 連動に戻す）`
                  }
                >
                  {syncWithScoreBpm ? '連動' : '手動'}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleAdjustBpm(e.shiftKey ? -1 : -5)}
                  className="p-0.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                  title="入力計測テンポを遅くする (-5 BPM / Shift+クリックで -1 BPM)"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span
                  className="text-[11px] font-mono font-bold text-slate-900 px-1 min-w-[32px] text-center"
                  title="半リアルタイム計測の基準テンポ (BPM)"
                >
                  {effectiveBpm}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleAdjustBpm(e.shiftKey ? 1 : 5)}
                  className="p-0.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                  title="入力計測テンポを速くする (+5 BPM / Shift+クリックで +1 BPM)"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <span className="text-emerald-300">|</span>

            {/* 3. 休符 (rキー) 事前設定 & 補助編集ボタン */}
            <div className="flex items-center space-x-1 flex-wrap gap-y-1">
              <span className="text-[11px] font-extrabold text-emerald-950">休符:</span>
              <select
                value={currentRestValue}
                onChange={(e) => {
                  const found = REST_DURATION_OPTIONS.find((o) => o.mml === e.target.value);
                  if (found) {
                    setDuration(found.duration);
                    setIsDotted(found.isDotted);
                    triggerFeedback(`休符長を ${found.label} に設定`);
                  }
                }}
                className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1.5 py-0.5 font-bold outline-none shadow-2xs"
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                title="rキーまたは休符ボタンで挿入する休符の長さ（数字キー 1〜8, . でも切替可能）"
              >
                {REST_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.mml} value={opt.mml}>
                    {opt.label}
                  </option>
                ))}
                {!REST_DURATION_OPTIONS.some((o) => o.mml === currentRestValue) && (
                  <option value={currentRestValue}>{`休符 (${currentRestValue})`}</option>
                )}
              </select>

              <button
                type="button"
                onClick={() => {
                  handleInsertRest();
                  triggerFeedback(`休符 (${currentRestValue}) を挿入`);
                }}
                className="px-2 py-0.5 bg-white hover:bg-emerald-100 border border-emerald-400 text-emerald-950 text-xs font-extrabold rounded shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer"
                title={`事前設定した休符 (${currentRestValue}) を挿入 (キーボード: r)`}
              >
                <span>休符挿入</span>
                <kbd className="text-[10px] px-1 bg-emerald-50 border border-emerald-300 rounded font-mono text-emerald-800">
                  r
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => {
                  onInsertText('^');
                  triggerFeedback('タイ (^) を挿入');
                }}
                className="px-1.5 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors cursor-pointer"
                title="タイ (^) を挿入 (キー: ^)"
              >
                タイ^
              </button>
              <button
                type="button"
                onClick={() => {
                  onInsertText(' ');
                  triggerFeedback('空白 を挿入');
                }}
                className="px-1.5 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors cursor-pointer"
                title="空白スペースを挿入 (キー: Space)"
              >
                空白
              </button>
              <button
                type="button"
                onClick={() => {
                  onInsertText('\n');
                  triggerFeedback('改行 を挿入');
                }}
                className="p-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded shadow-2xs transition-colors cursor-pointer"
                title="改行を挿入 (キー: Enter)"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
              {onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    onUndo();
                    triggerFeedback('直前の操作を取消 (Undo)');
                  }}
                  className="p-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded shadow-2xs transition-colors cursor-pointer"
                  title="直前に入力した音符・休符を丸ごと取り消す (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onBackspace && (
                <button
                  type="button"
                  onClick={() => {
                    onBackspace();
                    triggerFeedback('削除 (BS)');
                  }}
                  className="p-1 bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 rounded shadow-2xs transition-colors cursor-pointer"
                  title="直前の1文字を削除 (キー: Backspace)"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
              )}

              {/* オクターブ記法 */}
              <select
                value={octaveFormat}
                onChange={(e) => setOctaveFormat(e.target.value as any)}
                className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1 py-0.5 font-medium outline-none shadow-2xs"
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                title="MML出力時のオクターブ記述スタイル"
              >
                <option value="auto">自動 (&gt;,&lt;)</option>
                <option value="explicit">明示 (o4)</option>
                <option value="note-only">音名のみ</option>
              </select>
            </div>
          </div>
        )}

        {/* 試聴モード時の案内バッジ */}
        {mode === 'preview' && (
          <div className="text-xs text-slate-600 font-medium px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
            ℹ️ 試聴モード中: 鍵盤をクリックすると発音確認ができます（入力するには「入力」「直感操作」「半リアルタイム」を選択してください）
          </div>
        )}

        {/* 右側: 音色・オクターブシフト・ラベル表示・閉じるボタン */}
        <div className="flex items-center space-x-1.5 ml-auto">
          {/* 音色選択 */}
          <div className="hidden xl:flex items-center space-x-1 text-xs">
            <span className="text-[11px] text-slate-500 font-semibold">音色:</span>
            <select
              value={soundOption}
              onChange={(e) => setSoundOption(e.target.value as any)}
              className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1.5 py-0.5 font-medium outline-none shadow-2xs max-w-[125px] truncate"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
              title="鍵盤を押したときの発音音色"
            >
              {isDrumMode ? (
                <option value="current">🥁 ドラムセット (Ch 10)</option>
              ) : (
                <option value="current">連動 (#{currentProgram} {currentInst.nameJa})</option>
              )}
              <option value="piano">ピアノ (#0 Grand Piano)</option>
            </select>
          </div>

          {/* オクターブシフト操作 */}
          <div className="flex items-center space-x-0.5 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => handleOctaveShift(-1)}
              disabled={startOctave <= 1}
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 text-slate-700 cursor-pointer"
              title="鍵盤の表示範囲を1オクターブ下げる"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-xs font-mono font-bold text-blue-700">
              C{startOctave} - C{startOctave + octaveCount}
            </span>
            <button
              type="button"
              onClick={() => handleOctaveShift(1)}
              disabled={startOctave >= 6}
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 text-slate-700 cursor-pointer"
              title="鍵盤の表示範囲を1オクターブ上げる"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 音名ラベル表示トグル */}
          <button
            type="button"
            onClick={() => setShowLabels((prev) => !prev)}
            className={`p-1 rounded-lg border transition-colors cursor-pointer ${
              showLabels
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-slate-300 text-slate-400 hover:text-slate-700'
            }`}
            title={showLabels ? '音名ラベルを非表示' : '音名ラベルを表示'}
          >
            {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-1 cursor-pointer"
            title="ピアノ鍵盤を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 直感操作モード専用サブガイドバー */}
      {mode === 'smart' && (
        <div
          className="flex items-center justify-between px-3 py-1 bg-indigo-50 border-b border-indigo-200 text-xs text-indigo-950 flex-wrap gap-y-1"
          style={{ backgroundColor: '#eef2ff' }}
        >
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="flex items-center space-x-1 font-black text-indigo-900">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>直感操作ガイド:</span>
            </span>
            <span className="text-[11px] text-slate-800">
              数字キーで音長切替:
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold ml-1">1</kbd>全
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold ml-1">2</kbd>2分
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold ml-1">3</kbd>付点4分
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold ml-1">4</kbd>4分
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold ml-1">6</kbd>付点8分
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold ml-1">8</kbd>8分
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-indigo-700 font-black ml-1">1→6</kbd>16分
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-800">
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold">.</kbd> 付点
              <span className="mx-1 text-slate-400">/</span>
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold">r</kbd> 休符
              <span className="mx-1 text-slate-400">/</span>
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold">^</kbd> タイ
              <span className="mx-1 text-slate-400">/</span>
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold">Space</kbd> 空白
              <span className="mx-1 text-slate-400">/</span>
              <kbd className="font-mono bg-white border border-slate-300 px-1 py-0.2 rounded text-slate-900 font-bold">Enter</kbd> 改行
            </span>
          </div>

          {isWaitingSixAfterOne && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-400 rounded-md font-bold text-xs shadow-xs animate-pulse">
              <span>⏳</span>
              <span>今「6」を押すと 16分音符 に設定されます</span>
            </div>
          )}
        </div>
      )}

      {/* 半リアルタイムモード専用: メトロノーム振り子 ＆ 音符ゾーンゲージモニター + 操作ガイド */}
      {mode === 'semi-realtime' && (
        <>
          <SemiRealtimeMonitor
            isHolding={isHolding}
            holdingBeats={holdingBeats}
            holdingSec={holdingSec}
            previewMml={holdingPreviewMml}
            enabledCandidateIds={enabledCandidateIds}
            clickIntervalBeats={clickIntervalBeats}
            effectiveBpm={effectiveBpm}
            lastClickFlash={lastClickFlash}
            lastResult={lastQuantizedResult}
          />
          <div
            className="flex items-center justify-between px-3 py-0.5 border-b border-emerald-200 text-[11px] text-slate-800 flex-wrap gap-y-0.5"
            style={{ backgroundColor: '#ecfdf5', opacity: 1 }}
          >
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-extrabold text-emerald-900 flex items-center space-x-1">
                <Timer className="w-3 h-3 text-emerald-700" />
                <span>半リアルタイム操作:</span>
              </span>
              <span>鍵盤を押している間だけメトロノームとゲージが進み、離した長さの音符を入力</span>
              <span className="text-emerald-300">|</span>
              <span>
                <kbd className="font-mono bg-white border border-slate-300 px-1 rounded text-slate-900 font-bold">r</kbd> 休符 ({currentRestValue})
                <span className="mx-1 text-slate-400">/</span>
                <kbd className="font-mono bg-white border border-slate-300 px-1 rounded text-slate-900 font-bold">1〜8, .</kbd> 休符長切替
                <span className="mx-1 text-slate-400">/</span>
                <kbd className="font-mono bg-white border border-slate-300 px-1 rounded text-slate-900 font-bold">^</kbd> タイ
                <span className="mx-1 text-slate-400">/</span>
                <kbd className="font-mono bg-white border border-slate-300 px-1 rounded text-slate-900 font-bold">Esc</kbd> 押下キャンセル
              </span>
            </div>
            {isWaitingSixAfterOne && (
              <span className="px-2 py-0.2 bg-amber-100 text-amber-900 border border-amber-400 rounded font-bold text-[11px]">
                ⏳ 今「6」を押すと休符長が 16分休符 になります
              </span>
            )}
          </div>
        </>
      )}

      {/* SVG ピアノ鍵盤描画エリア */}
      <div
        className="px-2 py-1.5 flex justify-center items-center overflow-x-auto"
        style={{ backgroundColor: '#f1f5f9', opacity: 1 }}
      >
        <SvgPianoKeyboard
          startOctave={startOctave}
          octaveCount={octaveCount}
          activeNotes={activeNotes}
          onNoteDown={handleNoteDown}
          onNoteUp={handleNoteUp}
          showLabels={showLabels}
          isDrumMode={isDrumMode}
          whiteKeyWidth={30}
          whiteKeyHeight={100}
          className="mx-auto"
        />
      </div>
    </div>
  );
};
