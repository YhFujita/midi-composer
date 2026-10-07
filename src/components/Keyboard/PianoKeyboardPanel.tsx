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
} from 'lucide-react';
import { SvgPianoKeyboard } from './SvgPianoKeyboard';
import { NoteIcon } from './NoteIcon';
import { audioEngine } from '../../core/audio/soundFontPlayer';
import { getInstrumentByProgram } from '../../constants/instruments';

export interface PianoKeyboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
  onBackspace?: () => void;
  currentProgram?: number;
  isDrumMode?: boolean;
}

const NOTE_LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

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

export const PianoKeyboardPanel: React.FC<PianoKeyboardPanelProps> = ({
  isOpen,
  onClose,
  onInsertText,
  onBackspace,
  currentProgram = 0,
  isDrumMode = false,
}) => {
  // モード: 'preview' (試聴), 'insert' (通常入力), 'smart' (直感操作モード)
  const [mode, setMode] = useState<'preview' | 'insert' | 'smart'>('insert');

  // 入力モード設定
  const [duration, setDuration] = useState<string>('4');
  const [isDotted, setIsDotted] = useState<boolean>(false);
  const [octaveFormat, setOctaveFormat] = useState<'auto' | 'explicit' | 'note-only'>('auto');
  const [lastInsertedOctave, setLastInsertedOctave] = useState<number>(4);

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
    }, 1500);
  }, []);

  // 鍵盤表示設定: ドラムモード時は C2〜 (MIDI 36〜、キック/スネア/ハイハットの中心)
  const [startOctave, setStartOctave] = useState<number>(() => (isDrumMode ? 2 : 3));
  const [octaveCount, setOctaveCount] = useState<number>(3); // 3オクターブ
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

  // 現在選択中の音符情報
  const noteDesc = useMemo(() => getNoteDescription(duration, isDotted), [duration, isDotted]);

  // 鍵盤押下時ハンドラ
  const handleNoteDown = useCallback(
    (midiNote: number) => {
      // 1. 発音 (ドラムモード時は Channel 10 ドラムセットで発音)
      const inst = soundOption === 'piano' && !isDrumMode ? 0 : currentProgram;
      audioEngine.noteOn(midiNote, 105, inst, isDrumMode);
      setActiveNotes((prev) => (prev.includes(midiNote) ? prev : [...prev, midiNote]));

      // 2. 通常入力または直感操作モードの場合はエディタへMML挿入
      if (mode === 'insert' || mode === 'smart') {
        const noteIndex = ((midiNote % 12) + 12) % 12;
        const noteName = NOTE_LETTERS[noteIndex];
        const octave = Math.floor(midiNote / 12) - 1;
        const durStr = `${duration}${isDotted ? '.' : ''}`;

        let insertCode = '';
        if (octaveFormat === 'auto') {
          if (octave === lastInsertedOctave) {
            insertCode = `${noteName}${durStr}`;
          } else if (octave === lastInsertedOctave + 1) {
            insertCode = `> ${noteName}${durStr}`;
          } else if (octave === lastInsertedOctave - 1) {
            insertCode = `< ${noteName}${durStr}`;
          } else {
            insertCode = `o${octave} ${noteName}${durStr}`;
          }
          setLastInsertedOctave(octave);
        } else if (octaveFormat === 'explicit') {
          insertCode = `o${octave} ${noteName}${durStr}`;
          setLastInsertedOctave(octave);
        } else {
          // note-only
          insertCode = `${noteName}${durStr}`;
        }

        onInsertText(insertCode);
      }
    },
    [mode, soundOption, currentProgram, duration, isDotted, octaveFormat, lastInsertedOctave, onInsertText]
  );

  // 鍵盤離脱時ハンドラ
  const handleNoteUp = useCallback(
    (midiNote: number) => {
      audioEngine.noteOff(midiNote, isDrumMode);
      setActiveNotes((prev) => prev.filter((n) => n !== midiNote));
    },
    [isDrumMode]
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
   * 直感操作モードのキーボードイベントハンドラ
   * - 数字キー (1〜8): 音符の長さ切り替え
   *   - 1を押した直後に6を押す: 16分音符
   *   - 1直後以外の6: 6分音符 (付点8分音符, duration: '8', isDotted: true)
   *   - 3: 付点4分音符 (duration: '4', isDotted: true)
   *   - 2, 4, 8: 各種音符
   * - . : 付点トグル
   * - r : 現在の音長で休符挿入
   * - ^ : タイ挿入
   * - Space : 空白挿入
   * - Enter : 改行挿入
   * - Backspace : 削除
   */
  useEffect(() => {
    if (!isOpen || mode !== 'smart') {
      setIsWaitingSixAfterOne(false);
      if (pendingOneTimerRef.current) {
        clearTimeout(pendingOneTimerRef.current);
        pendingOneTimerRef.current = null;
      }
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // モーダル等で他のフォーム要素 (input, select, 通常のtextarea) にフォーカスがある場合は横取りしない
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isMonaco = activeEl.classList.contains('inputarea');
        if (!isMonaco && (tagName === 'input' || tagName === 'textarea' || tagName === 'select')) {
          return;
        }
      }

      // 修飾キー (Ctrl, Alt, Meta) が押されている場合はブラウザ・OSショートカットを優先
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;

      // 1. 数字キー: 音長切り替え
      if (key === '1') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('1');
        setIsDotted(false);
        setIsWaitingSixAfterOne(true);
        triggerFeedback('全音符 (1) に設定 [6で16分音符]');

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
          // 1の直後に6が押された場合 -> 16分音符モード
          if (pendingOneTimerRef.current) {
            clearTimeout(pendingOneTimerRef.current);
            pendingOneTimerRef.current = null;
          }
          setIsWaitingSixAfterOne(false);
          setDuration('16');
          setIsDotted(false);
          triggerFeedback('⚡ 16分音符 (16) に設定');
        } else {
          // 1の直後以外 -> 通常の6分音符 (付点8分音符)
          setDuration('8');
          setIsDotted(true);
          triggerFeedback('⚡ 付点8分音符 (6分音符 / 8.) に設定');
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
        triggerFeedback('2分音符 (2) に設定');
        return;
      }

      if (key === '3') {
        e.preventDefault();
        e.stopPropagation();
        // 3を押したら付点4分音符モード
        setDuration('4');
        setIsDotted(true);
        triggerFeedback('⚡ 付点4分音符 (3 / 4.) に設定');
        return;
      }

      if (key === '4') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('4');
        setIsDotted(false);
        triggerFeedback('4分音符 (4) に設定');
        return;
      }

      if (key === '8') {
        e.preventDefault();
        e.stopPropagation();
        setDuration('8');
        setIsDotted(false);
        triggerFeedback('8分音符 (8) に設定');
        return;
      }

      // 2. 付点トグル (.)
      if (key === '.') {
        e.preventDefault();
        e.stopPropagation();
        setIsDotted((prev) => {
          const next = !prev;
          triggerFeedback(next ? '付点 ON (長さを1.5倍)' : '付点 OFF');
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
  ]);

  if (!isOpen) return null;

  const isInputActive = mode === 'insert' || mode === 'smart';

  return (
    <div
      className="border-t border-slate-300 shadow-2xl flex flex-col z-30 flex-shrink-0 transition-all duration-200 select-none"
      style={{ backgroundColor: '#ffffff', opacity: 1, color: '#0f172a' }}
    >
      {/* メイン上部コントロールバー */}
      <div
        className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-slate-200 gap-y-1"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* 左側: タイトル & ドラムバッジ & モード切替 */}
        <div className="flex items-center space-x-2 flex-wrap">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-900 mr-1">
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

          {/* モード切替セグメントボタン: 試聴 / 通常入力 / 直感操作 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 shadow-inner">
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'preview'
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="音階と音色を確かめるモード（エディタへは書き込みません）"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>試聴モード</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('insert')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'insert'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="マウス操作でエディタへ直接音符を入力するモード"
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
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'smart'
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                  : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 font-semibold'
              }`}
              title="キーボードで音長・休符・タイ等を高速切替しながら、マウス鍵盤とハイブリッドで入力できる直感モード"
            >
              <Zap className={`w-3.5 h-3.5 ${mode === 'smart' ? 'text-amber-300 fill-amber-300' : 'text-indigo-500'}`} />
              <span>直感操作モード</span>
            </button>
          </div>

          {/* 操作フィードバック通知バッジ */}
          {feedback && (
            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-xs animate-in fade-in flex items-center space-x-1">
              <span>{feedback}</span>
            </span>
          )}
        </div>

        {/* 中央: 現在選択中の音符インジケーター & 音長・付点・記号設定 */}
        {isInputActive && (
          <div className="flex items-center space-x-2 flex-wrap bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            {/* ★最重要: 現在選択中の音符・記号が一目で分かる目立つプレビューカード★ */}
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

            {/* 音長選択ボタングループ (アイコン + 名称 + キー表記) */}
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
                    className={`flex items-center space-x-1 px-1.5 py-0.5 text-xs font-bold rounded border transition-all ${
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
                className={`flex items-center space-x-1 px-1.5 py-0.5 text-xs font-bold rounded border transition-all ${
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

            {/* 記号挿入アクション: 休符、タイ、空白、改行、削除 */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  handleInsertRest();
                  triggerFeedback(`休符 (r${duration}${isDotted ? '.' : ''})`);
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors flex items-center space-x-0.5"
                title={`休符 (r${duration}${isDotted ? '.' : ''}) を挿入 (キー: r)`}
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
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors flex items-center space-x-0.5"
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
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors"
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
                className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded shadow-2xs transition-colors flex items-center space-x-0.5"
                title="改行を挿入 (キー: Enter)"
              >
                <CornerDownLeft className="w-3 h-3" />
                <span>改行</span>
              </button>
              {onBackspace && (
                <button
                  type="button"
                  onClick={() => {
                    onBackspace();
                    triggerFeedback('削除 (BS)');
                  }}
                  className="p-1 bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 rounded shadow-2xs transition-colors"
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

        {/* 試聴モード時の案内バッジ */}
        {mode === 'preview' && (
          <div className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-md border border-slate-200">
            ℹ️ 試聴モード中: 鍵盤をクリックすると発音確認ができます（エディタに入力するには「入力モード」または「直感操作モード」を選択してください）
          </div>
        )}

        {/* 右側: 音色・オクターブシフト・ラベル表示・閉じるボタン */}
        <div className="flex items-center space-x-1.5 ml-auto">
          {/* 音色選択 */}
          <div className="hidden lg:flex items-center space-x-1 text-xs">
            <span className="text-[11px] text-slate-500 font-semibold">音色:</span>
            <select
              value={soundOption}
              onChange={(e) => setSoundOption(e.target.value as any)}
              className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1.5 py-0.5 font-medium outline-none shadow-2xs max-w-[130px] truncate"
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
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 text-slate-700"
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
              className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded disabled:opacity-30 text-slate-700"
              title="鍵盤の表示範囲を1オクターブ上げる"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 音名ラベル表示トグル */}
          <button
            type="button"
            onClick={() => setShowLabels((prev) => !prev)}
            className={`p-1 rounded-lg border transition-colors ${
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
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-1"
            title="ピアノ鍵盤を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ★直感操作モード専用サブガイドバー★ */}
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

          {/* 「1」押下直後の16分音符待機インジケーター */}
          {isWaitingSixAfterOne && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-400 rounded-md font-bold text-xs shadow-xs animate-pulse">
              <span>⏳</span>
              <span>今「6」を押すと 16分音符 に設定されます</span>
            </div>
          )}
        </div>
      )}

      {/* SVG ピアノ鍵盤描画エリア */}
      <div
        className="px-2 py-1.5 flex justify-center items-center overflow-x-auto bg-gradient-to-b from-slate-100 to-slate-200/80"
        style={{ backgroundColor: '#f1f5f9' }}
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
