import React, { useState, useMemo } from 'react';
import { X, Search, Volume2, PlusCircle, Music2, Sparkles, RefreshCw } from 'lucide-react';
import {
  INSTRUMENTS,
  INSTRUMENT_CATEGORIES,
  DRUM_KIT_INSTRUMENT,
} from '../../constants/instruments';
import { audioEngine } from '../../core/audio/soundFontPlayer';

export type InsertFormatType = 'voice-only' | 'with-comment' | 'with-track';

interface InstrumentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProgram: number;
  onSelectInstrument: (program: number) => void;
  onInsertToEditor: (program: number, format: InsertFormatType, trackNumber?: number) => void;
}

export const InstrumentSelectorModal: React.FC<InstrumentSelectorModalProps> = ({
  isOpen,
  onClose,
  currentProgram,
  onSelectInstrument,
  onInsertToEditor,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formatType, setFormatType] = useState<InsertFormatType>('with-comment');
  const [targetTrack, setTargetTrack] = useState<number>(1);
  const [activePreview, setActivePreview] = useState<number | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // カテゴリ & 検索フィルター
  const filteredInstruments = useMemo(() => {
    let list = [...INSTRUMENTS, DRUM_KIT_INSTRUMENT];

    // カテゴリフィルター
    if (selectedCategory !== 'all') {
      const cat = INSTRUMENT_CATEGORIES.find((c) => c.id === selectedCategory);
      if (cat) {
        list = list.filter(
          (inst) => (inst.program >= cat.range[0] && inst.program <= cat.range[1]) || (cat.id === 'percussive' && inst.program === 128)
        );
      }
    }

    // 検索語フィルター
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (inst) =>
          inst.name.toLowerCase().includes(q) ||
          inst.nameJa.toLowerCase().includes(q) ||
          inst.category.toLowerCase().includes(q) ||
          inst.categoryJa.toLowerCase().includes(q) ||
          inst.program.toString() === q
      );
    }

    return list;
  }, [selectedCategory, searchQuery]);

  // モーダルオープン時に現在選択中の楽器へスクロール
  React.useEffect(() => {
    if (isOpen && listRef.current) {
      const timer = setTimeout(() => {
        const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 試聴 (Web Audio で該当楽器のサウンドを即座にアルペジオ再生)
  const handlePreview = (program: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePreview(program);
    if (program === 128) {
      audioEngine.previewNote(36, 300, 0, 110, true);
      setTimeout(() => audioEngine.previewNote(42, 200, 0, 95, true), 150);
      setTimeout(() => audioEngine.previewNote(38, 300, 0, 105, true), 300);
    } else {
      audioEngine.previewInstrument(program);
    }
    setTimeout(() => {
      setActivePreview(null);
    }, 1000);
  };

  // 出力実行
  const handleInsert = (program: number) => {
    onSelectInstrument(program);
    onInsertToEditor(program, formatType, targetTrack);
    onClose();
  };

  const allInstruments = [...INSTRUMENTS, DRUM_KIT_INSTRUMENT];
  const currentInstInfo = allInstruments.find((i) => i.program === currentProgram);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: コンパクトかつ縦長 (max-w-md, h-[86vh] max-h-[800px])、完全不透明白(#ffffff) */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-md h-[86vh] max-h-[800px] flex flex-col text-slate-900 overflow-hidden bg-white animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* モーダルヘッダー */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 flex-shrink-0">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  楽器 (GM音色) 選択
                </h2>
                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 flex-shrink-0">
                  全128音色
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                音色を選びエディタの入力位置へ出力
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 ml-1"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 検索・書式設定コントロールバー */}
        <div
          className="px-4 py-2.5 border-b border-slate-200 flex flex-col gap-2 bg-slate-50 flex-shrink-0"
          style={{ backgroundColor: '#f8fafc' }}
        >
          {/* 検索入力 */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="楽器名 (ピアノ, guitar等) や番号で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1"
              >
                ×
              </button>
            )}
          </div>

          {/* 出力書式セレクター */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-slate-600 text-[11px] font-medium flex-shrink-0">出力書式:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <div className="inline-flex bg-slate-200 p-0.5 rounded-lg border border-slate-300 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setFormatType('with-comment')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    formatType === 'with-comment'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="Voice(n) /* 楽器名 */ を出力"
                >
                  コメント付
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('voice-only')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    formatType === 'voice-only'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="Voice(n) のみを出力"
                >
                  Voiceのみ
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('with-track')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    formatType === 'with-track'
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="TR(x) Voice(n) /* 楽器名 */ を出力"
                >
                  TR指定付
                </button>
              </div>

              {formatType === 'with-track' && (
                <div className="flex items-center space-x-1 bg-white px-1.5 py-0.5 rounded-md border border-slate-300 shadow-sm flex-shrink-0">
                  <span className="text-slate-500 text-[10px] font-medium">TR:</span>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={targetTrack}
                    onChange={(e) => setTargetTrack(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                    className="w-7 bg-white text-center text-slate-900 font-mono text-[11px] font-bold focus:outline-none"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* カテゴリタブ */}
        <div
          className="px-3 py-2 border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto text-xs bg-white flex-shrink-0"
          style={{ backgroundColor: '#ffffff' }}
        >
          {INSTRUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap text-[11px] font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat.nameJa}
            </button>
          ))}
        </div>

        {/* 楽器リスト一覧エリア: 1列表示でコンパクト・縦スクロールしやすく楽器名とボタンが近接 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5"
          style={{ backgroundColor: '#f8fafc' }}
        >
          {filteredInstruments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-medium">
              一致する楽器が見つかりませんでした。
            </div>
          ) : (
            filteredInstruments.map((inst) => {
              const isSelected = inst.program === currentProgram;
              return (
                <div
                  key={inst.program}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelectInstrument(inst.program)}
                  onDoubleClick={() => handleInsert(inst.program)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl border transition-all cursor-pointer group select-none ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500 shadow-sm'
                      : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                  style={{ backgroundColor: isSelected ? '#eff6ff' : '#ffffff', opacity: 1 }}
                  title="クリックで選択、ダブルクリックで出力"
                >
                  {/* 楽器情報: 番号バッジ + 日本語名 + 英語名 */}
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                    <span
                      className={`flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center font-mono text-[11px] font-bold ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-blue-700 border-slate-200 group-hover:bg-blue-50 group-hover:border-blue-300'
                      }`}
                    >
                      {inst.program}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {inst.nameJa}
                        </span>
                        {inst.isFeatured && (
                          <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate font-mono">
                        {inst.name}
                      </span>
                    </div>
                  </div>

                  {/* アクションボタン群 (楽器名のすぐ右側に配置) */}
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {/* 試聴ボタン */}
                    <button
                      type="button"
                      onClick={(e) => handlePreview(inst.program, e)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        activePreview === inst.program
                          ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
                          : 'bg-white border-slate-300 text-slate-700 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                      style={{ backgroundColor: activePreview === inst.program ? '#2563eb' : '#ffffff' }}
                      title="音色をプレビュー試聴"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    {/* 現在の入力場所へ出力ボタン */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInsert(inst.program);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                      title="エディタ入力位置に出力して閉じる"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>出力</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* モーダルフッター */}
        <div
          className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700 gap-2 bg-slate-50 flex-shrink-0"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <div className="flex items-center space-x-1.5 min-w-0 flex-1 truncate">
            <span className="text-slate-500 text-[11px] font-medium flex-shrink-0">出力例:</span>
            <code className="bg-white border border-slate-300 px-2 py-0.5 rounded text-blue-800 font-mono text-[11px] font-semibold shadow-sm truncate">
              {formatType === 'voice-only' && `Voice(${currentProgram})`}
              {formatType === 'with-comment' &&
                `Voice(${currentProgram}) /* ${currentInstInfo?.nameJa || 'Piano'} */`}
              {formatType === 'with-track' &&
                `TR(${targetTrack}) Voice(${currentProgram}) /* ${currentInstInfo?.nameJa || 'Piano'} */`}
            </code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors border border-slate-300 flex-shrink-0 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
