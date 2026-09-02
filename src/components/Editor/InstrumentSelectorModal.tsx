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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 背景を完全不透明白(#ffffff)にし、背後が一切透けないように設計 */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-slate-900 overflow-hidden bg-white"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* モーダルヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                楽器 (GM音色) 選択パレット
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  全128音色
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                音色を選び、現在の入力場所（エディタのカーソル位置）へ正しいMML構文で出力できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 検索・書式設定コントロールバー */}
        <div
          className="px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-3 justify-between bg-slate-50"
          style={{ backgroundColor: '#f8fafc' }}
        >
          {/* 検索入力 */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="楽器名 (ピアノ, guitar, strings...) や番号で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1"
              >
                ×
              </button>
            )}
          </div>

          {/* 出力書式セレクター */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs justify-end">
            <span className="text-slate-600 text-[11px] font-medium">出力書式:</span>
            <div className="inline-flex bg-slate-200 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setFormatType('with-comment')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  formatType === 'with-comment'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
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
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
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
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="TR(x) Voice(n) /* 楽器名 */ を出力"
              >
                TR指定付き
              </button>
            </div>

            {formatType === 'with-track' && (
              <div className="flex items-center space-x-1 ml-1 bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-sm">
                <span className="text-slate-600 text-[11px] font-medium">TR:</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={targetTrack}
                  onChange={(e) => setTargetTrack(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                  className="w-10 bg-white text-center text-slate-900 font-mono font-bold focus:outline-none"
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* カテゴリタブ */}
        <div
          className="px-6 py-2.5 border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto text-xs bg-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          {INSTRUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat.nameJa}
            </button>
          ))}
        </div>

        {/* 楽器リスト一覧エリア: ソリッド不透明白背景でくっきり表示 */}
        <div
          className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-2.5"
          style={{ backgroundColor: '#f8fafc' }}
        >
          {filteredInstruments.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-sm font-medium">
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
                      ? 'border-blue-500 ring-2 ring-blue-500 shadow-sm'
                      : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                  }`}
                  style={{ backgroundColor: isSelected ? '#eff6ff' : '#ffffff', opacity: 1 }}
                >
                  {/* 楽器情報: 黒文字・高コントラスト */}
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center font-mono text-xs font-bold"
                      style={{ backgroundColor: '#f1f5f9', color: '#1d4ed8' }}
                    >
                      {inst.program}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {inst.nameJa}
                        </span>
                        {inst.isFeatured && (
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-600 block truncate font-mono">
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
                      onClick={() => handleInsert(inst.program)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors active:scale-95"
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
          className="px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-700 gap-2 bg-slate-50"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <div className="flex items-center space-x-2 truncate">
            <span className="text-slate-600 font-medium">出力書式の例:</span>
            <code className="bg-white border border-slate-300 px-2.5 py-1 rounded text-blue-800 font-mono text-[11px] font-semibold shadow-sm">
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
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors border border-slate-300"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
