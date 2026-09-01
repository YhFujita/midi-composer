import React, { useState, useMemo } from 'react';
import { X, Search, Volume2, PlusCircle, Music2, Sparkles, RefreshCw } from 'lucide-react';
import {
  INSTRUMENTS,
  INSTRUMENT_CATEGORIES,
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

  // カテゴリ & 検索フィルター
  const filteredInstruments = useMemo(() => {
    let list = INSTRUMENTS;

    // カテゴリフィルター
    if (selectedCategory !== 'all') {
      const cat = INSTRUMENT_CATEGORIES.find((c) => c.id === selectedCategory);
      if (cat) {
        list = list.filter(
          (inst) => inst.program >= cat.range[0] && inst.program <= cat.range[1]
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

  if (!isOpen) return null;

  // 試聴 (Web Audio で該当楽器のサウンドを即座にアルペジオ再生)
  const handlePreview = (program: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePreview(program);
    audioEngine.previewInstrument(program);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(8px)' }}
    >
      {/* モーダル本体: 背景を完全不透明(#0f172a)にし、背後が一切透けないように設計 */}
      <div
        className="border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-slate-200 overflow-hidden"
        style={{ backgroundColor: '#0f172a' }}
      >
        {/* モーダルヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-800"
          style={{ backgroundColor: '#020617' }}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-900/60 border border-blue-500/50 rounded-xl text-blue-400">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                楽器 (GM音色) 選択パレット
                <span className="text-xs font-normal text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  全128音色
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                音色を選び、現在の入力場所（エディタのカーソル位置）へ正しいMML構文で出力できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 検索・書式設定コントロールバー */}
        <div
          className="px-6 py-3 border-b border-slate-800 flex flex-col sm:flex-row items-center gap-3 justify-between"
          style={{ backgroundColor: '#090d16' }}
        >
          {/* 検索入力 */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="楽器名 (ピアノ, guitar, strings...) や番号で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* 出力書式セレクター */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs justify-end">
            <span className="text-slate-400 text-[11px]">出力書式:</span>
            <div className="inline-flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setFormatType('with-comment')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  formatType === 'with-comment'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Voice(n) /* 楽器名 */ を出力（おすすめ）"
              >
                コメント付き
              </button>
              <button
                type="button"
                onClick={() => setFormatType('voice-only')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  formatType === 'voice-only'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Voice(n) のみを出力"
              >
                Voiceのみ
              </button>
              <button
                type="button"
                onClick={() => setFormatType('with-track')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  formatType === 'with-track'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="TR(x) Voice(n) /* 楽器名 */ を出力"
              >
                TR指定付き
              </button>
            </div>

            {formatType === 'with-track' && (
              <div className="flex items-center space-x-1 ml-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                <span className="text-slate-400 text-[11px]">TR:</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={targetTrack}
                  onChange={(e) => setTargetTrack(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                  className="w-10 bg-transparent text-center text-blue-400 font-mono focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* カテゴリタブ */}
        <div
          className="px-6 py-2.5 border-b border-slate-800 flex items-center space-x-1.5 overflow-x-auto text-xs"
          style={{ backgroundColor: '#0f172a' }}
        >
          {INSTRUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.nameJa}
            </button>
          ))}
        </div>

        {/* 楽器リスト一覧エリア: ソリッド不透明背景でくっきり表示 */}
        <div
          className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-2.5"
          style={{ backgroundColor: '#0f172a' }}
        >
          {filteredInstruments.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm">
              一致する楽器が見つかりませんでした。
            </div>
          ) : (
            filteredInstruments.map((inst) => {
              const isSelected = inst.program === currentProgram;
              return (
                <div
                  key={inst.program}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-blue-500 text-white ring-1 ring-blue-500'
                      : 'bg-slate-800/95 border-slate-700 hover:border-slate-500 text-slate-200'
                  }`}
                  style={{ backgroundColor: isSelected ? '#1e293b' : '#1e293b' }}
                >
                  {/* 楽器情報 */}
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-blue-400">
                      {inst.program}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-xs text-white truncate">
                          {inst.nameJa}
                        </span>
                        {inst.isFeatured && (
                          <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate font-mono">
                        {inst.name}
                      </span>
                    </div>
                  </div>

                  {/* アクションボタン群 */}
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {/* 試聴ボタン */}
                    <button
                      type="button"
                      onClick={(e) => handlePreview(inst.program, e)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        activePreview === inst.program
                          ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                      title="音色をプレビュー試聴"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    {/* 現在の入力場所へ出力ボタン */}
                    <button
                      type="button"
                      onClick={() => handleInsert(inst.program)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors active:scale-95"
                      title="現在のエディタ入力位置に出力して閉じる"
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
          className="px-6 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-300 gap-2"
          style={{ backgroundColor: '#020617' }}
        >
          <div className="flex items-center space-x-2 truncate">
            <span className="text-slate-400">出力書式の例:</span>
            <code className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-blue-300 font-mono text-[11px]">
              {formatType === 'voice-only' && `Voice(${currentProgram})`}
              {formatType === 'with-comment' &&
                `Voice(${currentProgram}) /* ${
                  INSTRUMENTS.find((i) => i.program === currentProgram)?.nameJa || 'Piano'
                } */`}
              {formatType === 'with-track' &&
                `TR(${targetTrack}) Voice(${currentProgram}) /* ${
                  INSTRUMENTS.find((i) => i.program === currentProgram)?.nameJa || 'Piano'
                } */`}
            </code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
