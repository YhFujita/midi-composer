import React from 'react';
import {
  Music2,
  Volume2,
  CornerDownLeft,
  ChevronDown,
  Sparkles,
  Layers,
  Settings2,
} from 'lucide-react';
import {
  POPULAR_INSTRUMENTS,
  getInstrumentByProgram,
} from '../../constants/instruments';
import { InsertFormatType } from './InstrumentSelectorModal';
import { audioEngine } from '../../core/audio/soundFontPlayer';

interface EditorToolbarProps {
  selectedProgram: number;
  onSelectProgram: (program: number) => void;
  onOpenModal: () => void;
  onOpenChordModal: () => void;
  isChordModalOpen?: boolean;
  onInsertToEditor: (program: number, format: InsertFormatType) => void;
  onInsertText?: (text: string) => void;
  formatType: InsertFormatType;
  onChangeFormatType: (format: InsertFormatType) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  selectedProgram,
  onSelectProgram,
  onOpenModal,
  onOpenChordModal,
  isChordModalOpen,
  onInsertToEditor,
  onInsertText,
  formatType,
  onChangeFormatType,
}) => {
  const currentInst = getInstrumentByProgram(selectedProgram);

  const handlePreview = () => {
    audioEngine.previewInstrument(selectedProgram);
  };

  const handleInsert = () => {
    onInsertToEditor(selectedProgram, formatType);
  };

  return (
    <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-200 text-xs gap-2 select-none">
      {/* 左エリア: 楽器選択ボタン & クイック選択 */}
      <div className="flex items-center space-x-1.5 flex-wrap">
        <span className="text-[11px] text-slate-300 font-semibold mr-1 flex items-center">
          <Music2 className="w-3.5 h-3.5 mr-1 text-blue-400" />
          楽器:
        </span>

        {/* 楽器選択パレットを開くボタン: 白背景・不透明・黒文字 */}
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-md transition-all text-xs text-left shadow-sm group"
          style={{ backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 }}
          title="楽器選択パレットを開く (全128音色)"
        >
          <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[11px] border border-blue-200">
            #{selectedProgram}
          </span>
          <span className="font-bold text-slate-900 max-w-[130px] sm:max-w-[180px] truncate">
            {currentInst.nameJa}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-800" />
        </button>

        {/* 試聴ボタン */}
        <button
          type="button"
          onClick={handlePreview}
          className="p-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-md text-blue-600 hover:text-blue-700 transition-colors shadow-sm"
          style={{ backgroundColor: '#ffffff', opacity: 1 }}
          title="選択中の楽器をプレビュー試聴"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        {/* 主要音色クイックセレクター: 白背景・不透明・黒文字 */}
        <div className="hidden sm:flex items-center space-x-1 pl-1">
          <select
            value={selectedProgram}
            onChange={(e) => onSelectProgram(parseInt(e.target.value, 10))}
            className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm max-w-[140px] truncate"
            style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
            title="よく使う音色のクイック選択"
          >
            <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
              クイック選択...
            </option>
            {POPULAR_INSTRUMENTS.map((inst) => (
              <option key={inst.program} value={inst.program} style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                {inst.program}: {inst.nameJa}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-600 hidden sm:inline px-0.5">|</span>

        {/* コード入力ボタン: 開いている時はアクティブスタイル */}
        <button
          type="button"
          onClick={onOpenChordModal}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all text-xs font-bold shadow-sm group border ${
            isChordModalOpen
              ? 'bg-blue-50 text-blue-700 border-blue-500 ring-1 ring-blue-400'
              : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border-slate-300'
          }`}
          style={!isChordModalOpen ? { backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 } : {}}
          title="コード入力パレットを開閉 (テキスト入力と並行して右側に表示)"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isChordModalOpen ? 'text-blue-600 animate-spin-slow' : 'text-amber-500'}`} />
          <span>コード入力</span>
          {isChordModalOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          )}
        </button>

        {/* 移調コマンドクイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="エディタのカーソル位置に移調コマンドを挿入 (曲の途中での転調に便利)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                移調を挿入...
              </option>
              <optgroup label="パート移調 (トラック別)">
                <option value="Key(-1) /* 短2度↓ */">Key(-1) /* 短2度下げ(半音↓) */</option>
                <option value="Key(1) /* 短2度↑ */">Key(1) /* 短2度上げ(半音↑) */</option>
                <option value="Key(-2) /* 長2度↓ */">Key(-2) /* 長2度下げ(全音↓) */</option>
                <option value="Key(2) /* 長2度↑ */">Key(2) /* 長2度上げ(全音↑) */</option>
                <option value="Key(0) /* 原調リセット */">Key(0) /* 原調に戻す */</option>
              </optgroup>
              <optgroup label="楽曲全体移調 (マスター)">
                <option value="MasterKey(-1) /* 全体短2度↓ */">MasterKey(-1) /* 全体短2度下げ */</option>
                <option value="MasterKey(1) /* 全体短2度↑ */">MasterKey(1) /* 全体短2度上げ */</option>
                <option value="MasterKey(2) /* 全体長2度↑ */">MasterKey(2) /* 全体長2度上げ */</option>
                <option value="MasterKey(0) /* 全体原調リセット */">MasterKey(0) /* 全体原調に戻す */</option>
              </optgroup>
            </select>
          </div>
        )}
      </div>

      {/* 右エリア: 現在の入力場所へ出力ボタン & 書式設定 */}
      <div className="flex items-center space-x-2 ml-auto">
        {/* 書式選択ドロップダウン: 白背景・不透明・黒文字 */}
        <div className="flex items-center space-x-1">
          <select
            value={formatType}
            onChange={(e) => onChangeFormatType(e.target.value as InsertFormatType)}
            className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
            style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
            title="エディタ挿入時の構文形式"
          >
            <option value="with-comment" style={{ backgroundColor: '#ffffff', color: '#000000' }}>形式: コメント付 (推奨)</option>
            <option value="voice-only" style={{ backgroundColor: '#ffffff', color: '#000000' }}>形式: Voice のみ</option>
          </select>
        </div>

        {/* 出力ボタン: 現在の入力場所へ出力 */}
        <button
          type="button"
          onClick={handleInsert}
          className="flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-semibold rounded-md shadow-sm shadow-blue-900/40 transition-all text-xs"
          title="エディタの現在の入力場所 (カーソル位置) に構文エラーのない形式で出力します"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>現在の入力場所へ出力</span>
        </button>
      </div>
    </div>
  );
};
