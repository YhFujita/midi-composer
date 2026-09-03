import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Volume2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Music,
  Delete,
  CornerDownLeft,
  Settings2,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SvgPianoKeyboard } from './SvgPianoKeyboard';
import { audioEngine } from '../../core/audio/soundFontPlayer';
import { getInstrumentByProgram } from '../../constants/instruments';

export interface PianoKeyboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
  onBackspace?: () => void;
  currentProgram?: number;
}

const NOTE_LETTERS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

const DURATION_LIST = [
  { label: '全 (1)', value: '1' },
  { label: '2分 (2)', value: '2' },
  { label: '4分 (4)', value: '4' },
  { label: '8分 (8)', value: '8' },
  { label: '16分 (16)', value: '16' },
];

export const PianoKeyboardPanel: React.FC<PianoKeyboardPanelProps> = ({
  isOpen,
  onClose,
  onInsertText,
  onBackspace,
  currentProgram = 0,
}) => {
  // モード: 'preview' (音を確かめる) または 'insert' (カーソル位置へ入力)
  const [mode, setMode] = useState<'preview' | 'insert'>('preview');

  // 入力モード設定
  const [duration, setDuration] = useState<string>('4');
  const [isDotted, setIsDotted] = useState<boolean>(false);
  const [octaveFormat, setOctaveFormat] = useState<'auto' | 'explicit' | 'note-only'>('auto');
  const [lastInsertedOctave, setLastInsertedOctave] = useState<number>(4);

  // 鍵盤表示設定
  const [startOctave, setStartOctave] = useState<number>(3); // デフォルト C3〜
  const [octaveCount, setOctaveCount] = useState<number>(3); // 3オクターブ (C3〜C6)
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [soundOption, setSoundOption] = useState<'current' | 'piano'>('current');

  // 現在発音中/押下中のMIDIノート
  const [activeNotes, setActiveNotes] = useState<number[]>([]);

  // 楽器情報
  const currentInst = useMemo(() => getInstrumentByProgram(currentProgram), [currentProgram]);

  // 鍵盤押下時ハンドラ
  const handleNoteDown = useCallback(
    (midiNote: number) => {
      // 1. 発音
      const inst = soundOption === 'piano' ? 0 : currentProgram;
      audioEngine.noteOn(midiNote, 105, inst);
      setActiveNotes((prev) => (prev.includes(midiNote) ? prev : [...prev, midiNote]));

      // 2. 入力モードの場合はエディタへMML挿入
      if (mode === 'insert') {
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
  const handleNoteUp = useCallback((midiNote: number) => {
    audioEngine.noteOff(midiNote);
    setActiveNotes((prev) => prev.filter((n) => n !== midiNote));
  }, []);

  // 休符挿入
  const handleInsertRest = useCallback(() => {
    const durStr = `${duration}${isDotted ? '.' : ''}`;
    onInsertText(`r${durStr}`);
  }, [duration, isDotted, onInsertText]);

  // オクターブシフト操作
  const handleOctaveShift = useCallback((delta: number) => {
    setStartOctave((prev) => Math.max(1, Math.min(6, prev + delta)));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="border-t border-slate-300 shadow-2xl flex flex-col z-30 flex-shrink-0 transition-all duration-200 select-none"
      style={{ backgroundColor: '#ffffff', opacity: 1, color: '#0f172a' }}
    >
      {/* 上部コントロールバー */}
      <div
        className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50 gap-y-1.5"
        style={{ backgroundColor: '#f8fafc' }}
      >
        {/* 左側: モード切替 & タイトル */}
        <div className="flex items-center space-x-2 flex-wrap">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-900 mr-1">
            <span className="text-base leading-none">🎹</span>
            <span className="hidden sm:inline">ピアノ鍵盤</span>
          </div>

          {/* モード切替セグメントボタン */}
          <div className="flex items-center bg-slate-200 p-0.5 rounded-lg border border-slate-300 shadow-inner">
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                mode === 'preview'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="音階と音色を確かめるモード（エディタは変更されません）"
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
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="クリックした音をエディタの現在のカーソル位置へ直接入力するモード"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>入力モード</span>
            </button>
          </div>

          {/* 入力モード時のバッジ */}
          {mode === 'insert' && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md animate-pulse">
              ● カーソル位置に入力中
            </span>
          )}
        </div>

        {/* 中央: 入力モード設定（音長・付点・オクターブ記法） */}
        {mode === 'insert' && (
          <div className="flex items-center space-x-1.5 flex-wrap bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-700">音長:</span>
            {/* 音長選択ボタン */}
            <div className="flex items-center space-x-0.5">
              {DURATION_LIST.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-all ${
                    duration === d.value
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
              {/* 付点トグル */}
              <button
                type="button"
                onClick={() => setIsDotted((prev) => !prev)}
                className={`px-2 py-0.5 text-xs font-bold rounded border transition-all ${
                  isDotted
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
                title="付点音符（長さを1.5倍）"
              >
                付点 (.)
              </button>
            </div>

            <span className="text-slate-300 mx-0.5">|</span>

            {/* オクターブ指定形式 */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-bold text-slate-700">記法:</span>
              <select
                value={octaveFormat}
                onChange={(e) => setOctaveFormat(e.target.value as any)}
                className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1.5 py-0.5 font-medium outline-none shadow-xs"
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                title="MML出力時のオクターブ記述スタイル"
              >
                <option value="auto">自動 (オクターブ差分追従)</option>
                <option value="explicit">明示 (o4 c4)</option>
                <option value="note-only">音名のみ (c4)</option>
              </select>
            </div>

            <span className="text-slate-300 mx-0.5">|</span>

            {/* 休符挿入・スペース・改行 */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleInsertRest}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-800 text-xs font-bold rounded transition-colors"
                title={`休符 (r${duration}${isDotted ? '.' : ''}) をカーソル位置に挿入`}
              >
                休符 (r)
              </button>
              <button
                type="button"
                onClick={() => onInsertText(' ')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-800 text-xs font-bold rounded transition-colors"
                title="空白スペースを挿入"
              >
                空白
              </button>
              {onBackspace && (
                <button
                  type="button"
                  onClick={onBackspace}
                  className="p-1 bg-slate-100 hover:bg-rose-50 active:bg-rose-100 border border-slate-300 text-rose-600 rounded transition-colors"
                  title="直前の1文字を削除 (Backspace)"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 右側: オクターブ移動 & 音色 & 閉じる */}
        <div className="flex items-center space-x-1.5 ml-auto">
          {/* 音色選択 (選択中楽器 or 常にピアノ) */}
          <div className="hidden md:flex items-center space-x-1 text-xs">
            <span className="text-[11px] text-slate-500 font-semibold">音色:</span>
            <select
              value={soundOption}
              onChange={(e) => setSoundOption(e.target.value as any)}
              className="bg-white border border-slate-300 text-slate-900 text-xs rounded px-1.5 py-0.5 font-medium outline-none shadow-xs max-w-[130px] truncate"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
              title="鍵盤を押したときの発音音色"
            >
              <option value="current">連動 (#{currentProgram} {currentInst.nameJa})</option>
              <option value="piano">ピアノ (#0 Grand Piano)</option>
            </select>
          </div>

          {/* オクターブシフト操作 */}
          <div className="flex items-center space-x-0.5 bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
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
            className={`p-1.5 rounded-lg border transition-colors ${
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
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-1"
            title="ピアノ鍵盤を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG ピアノ鍵盤描画エリア */}
      <div
        className="px-2 py-2 flex justify-center items-center overflow-x-auto bg-gradient-to-b from-slate-100 to-slate-200/80"
        style={{ backgroundColor: '#f1f5f9' }}
      >
        <SvgPianoKeyboard
          startOctave={startOctave}
          octaveCount={octaveCount}
          activeNotes={activeNotes}
          onNoteDown={handleNoteDown}
          onNoteUp={handleNoteUp}
          showLabels={showLabels}
          whiteKeyWidth={32}
          whiteKeyHeight={115}
          className="mx-auto"
        />
      </div>
    </div>
  );
};
