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
  onInsertToEditor: (program: number, format: InsertFormatType) => void;
  formatType: InsertFormatType;
  onChangeFormatType: (format: InsertFormatType) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  selectedProgram,
  onSelectProgram,
  onOpenModal,
  onInsertToEditor,
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
    <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-slate-200 text-xs gap-2 select-none">
      {/* 左エリア: 楽器選択ボタン & クイック選択 */}
      <div className="flex items-center space-x-1.5 flex-wrap">
        <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center">
          <Music2 className="w-3.5 h-3.5 mr-1 text-blue-400" />
          楽器:
        </span>

        {/* 楽器選択パレットを開くボタン */}
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 hover:border-slate-600 rounded-md transition-all text-xs text-left group"
          title="楽器選択パレットを開く (全128音色)"
        >
          <span className="font-mono text-blue-400 font-semibold bg-slate-900/80 px-1.5 py-0.5 rounded text-[11px] border border-slate-800">
            #{selectedProgram}
          </span>
          <span className="font-medium text-slate-100 max-w-[130px] sm:max-w-[180px] truncate">
            {currentInst.nameJa}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white" />
        </button>

        {/* 試聴ボタン */}
        <button
          type="button"
          onClick={handlePreview}
          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-300 hover:text-white transition-colors"
          title="選択中の楽器をプレビュー試聴"
        >
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
        </button>

        {/* 主要音色クイックセレクター */}
        <div className="hidden sm:flex items-center space-x-1 pl-1">
          <select
            value={selectedProgram}
            onChange={(e) => onSelectProgram(parseInt(e.target.value, 10))}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-700 focus:border-blue-500 max-w-[130px] truncate"
            title="よく使う音色のクイック選択"
          >
            <option value="" disabled>
              クイック選択...
            </option>
            {POPULAR_INSTRUMENTS.map((inst) => (
              <option key={inst.program} value={inst.program}>
                {inst.program}: {inst.nameJa}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 右エリア: 現在の入力場所へ出力ボタン & 書式設定 */}
      <div className="flex items-center space-x-2 ml-auto">
        {/* 書式選択ドロップダウン */}
        <div className="flex items-center space-x-1">
          <select
            value={formatType}
            onChange={(e) => onChangeFormatType(e.target.value as InsertFormatType)}
            className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-[11px] rounded-md px-2 py-1 outline-none focus:border-blue-500"
            title="エディタ挿入時の構文形式"
          >
            <option value="with-comment">形式: コメント付 (推奨)</option>
            <option value="voice-only">形式: Voice のみ</option>
          </select>
        </div>

        {/* 出力ボタン: 現在の入力場所へ出力 */}
        <button
          type="button"
          onClick={handleInsert}
          className="flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-medium rounded-md shadow-sm shadow-blue-900/40 transition-all text-xs"
          title="エディタの現在の入力場所 (カーソル位置) に構文エラーのない形式で出力します"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>現在の入力場所へ出力</span>
        </button>
      </div>
    </div>
  );
};
