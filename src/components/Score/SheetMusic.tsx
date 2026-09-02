import React, { useEffect, useRef, useState } from 'react';
import { ParsedScore } from '../../types/mml';
import {
  renderScoreToSvg,
  renderFullScoreToSvg,
  PartNameDisplayMode,
  ScoreDisplayOptions,
  DEFAULT_DISPLAY_OPTIONS,
} from '../../core/score/vexflowAdapter';
import {
  Printer,
  ZoomIn,
  ZoomOut,
  Layers,
  BookOpen,
  Tag,
  SlidersHorizontal,
  Check,
  Type,
} from 'lucide-react';
import { getInstrumentByProgram } from '../../constants/instruments';

interface SheetMusicProps {
  score: ParsedScore;
  currentBeat: number;
  isPlaying: boolean;
}

export type ScoreViewMode = 'score' | 'part';

export const SheetMusic: React.FC<SheetMusicProps> = ({ score, currentBeat, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // 表示モード ('score': 総譜, 'part': パート譜)
  const [viewMode, setViewMode] = useState<ScoreViewMode>('score');
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(100);

  // パート名表示モード
  const [partNameMode, setPartNameMode] = useState<PartNameDisplayMode>('abbr');

  // 表示設定ドロップダウンメニューの開閉
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 楽譜表示オプション
  const [displayOptions, setDisplayOptions] = useState<ScoreDisplayOptions>(() => {
    try {
      const saved = localStorage.getItem('midi_composer_score_options');
      if (saved) {
        return { ...DEFAULT_DISPLAY_OPTIONS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_DISPLAY_OPTIONS;
  });

  // オプション変更用ハンドラ
  const updateDisplayOption = <K extends keyof ScoreDisplayOptions>(
    key: K,
    value: ScoreDisplayOptions[K]
  ) => {
    setDisplayOptions((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem('midi_composer_score_options', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  // コンテナの横幅状態
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // トラック変更時に有効な範囲に調整
  useEffect(() => {
    if (selectedTrack >= score.tracks.length && score.tracks.length > 0) {
      setSelectedTrack(0);
    }
  }, [score.tracks.length, selectedTrack]);

  // コンテナ要素の幅を監視（リサイズ・レイアウト切替時に自動追従）
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.clientWidth || containerRef.current.parentElement?.clientWidth || 800;
        // マージンやパディングを考慮した基本幅 (最低650px)
        const effectiveWidth = Math.max(650, clientWidth - 48);
        setContainerWidth(effectiveWidth);
      }
    };

    updateWidth();

    // ResizeObserver でコンテナのリサイズを監視
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 印刷中状態
  const [isPrinting, setIsPrinting] = useState(false);

  // 印刷イベント監視
  useEffect(() => {
    const handleBeforePrint = () => {
      setIsPrinting(true);
    };
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // レンダリング実行（画面表示 ＆ 印刷共通コンテナ）
  useEffect(() => {
    if (!containerRef.current) return;
    // 印刷時は A4 用紙に最適な 760px、画面時はコンテナ幅 * ズーム
    const targetWidth = isPrinting ? 760 : Math.floor(containerWidth * (zoom / 100));

    if (viewMode === 'score') {
      renderFullScoreToSvg(containerRef.current, score, targetWidth, partNameMode, displayOptions);
    } else {
      renderScoreToSvg(containerRef.current, score, selectedTrack, targetWidth, displayOptions);
    }
  }, [score, viewMode, selectedTrack, zoom, partNameMode, containerWidth, displayOptions, isPrinting]);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
      }, 500);
    }, 60);
  };

  const currentMeasure = Math.floor(currentBeat / (score.timeSignature.numerator || 4)) + 1;
  const activeTrack = score.tracks[selectedTrack] || score.tracks[0];
  const activeInst = activeTrack ? getInstrumentByProgram(activeTrack.instrument) : null;

  const currentTitle =
    displayOptions.customTitle?.trim() ||
    score.title ||
    (viewMode === 'score' ? 'Full Score (総譜)' : `${activeTrack?.name || `Track ${selectedTrack + 1}`}: ${activeInst?.nameJa || 'パート譜'}`);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 score-pane-container">
      {/* ツールバー (画面用 / 印刷時は非表示) */}
      <div className="no-print flex flex-wrap items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 gap-2">
        {/* 表示切替タブ (スコア譜 ＆ 各パート譜) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
          {/* スコア譜 (総譜) ボタン */}
          <button
            type="button"
            onClick={() => setViewMode('score')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
              viewMode === 'score'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-900/40 ring-1 ring-blue-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
            title="全パートが揃ったスコア譜（総譜）を表示"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-300" />
            <span>スコア譜 (総譜)</span>
            <span className="text-[10px] bg-slate-900 px-1.5 py-0.2 rounded text-blue-300 font-mono">
              {score.tracks.filter((t) => t.notes.length > 0).length}パート
            </span>
          </button>

          <span className="text-slate-600 px-0.5">|</span>

          {/* 各パート譜ボタン */}
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-slate-400 font-medium mr-0.5 flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1 text-slate-400" />
              パート譜:
            </span>
            {score.tracks.map((track, idx) => {
              const inst = getInstrumentByProgram(track.instrument);
              const isSelected = viewMode === 'part' && selectedTrack === idx;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrack(idx);
                    setViewMode('part');
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                  title={`${track.name || `Track ${idx + 1}`} (${inst.nameJa}) のパート譜を表示`}
                >
                  <span>{track.name || `TR(${idx + 1})`}</span>
                  <span className="text-[10px] text-slate-400 ml-1">({inst.abbrJa || inst.nameJa})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右エリア: 表記設定、表示設定ドロップダウン、ズーム、印刷ボタン */}
        <div className="flex items-center space-x-2 ml-auto">
          {/* スコア譜表示時のみ: パート名略記セレクター (白背景・不透明・黒文字) */}
          {viewMode === 'score' && (
            <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-md px-2 py-0.5 shadow-sm">
              <Tag className="w-3 h-3 text-blue-600" />
              <span className="text-[10px] text-slate-600 font-medium">表記:</span>
              <select
                value={partNameMode}
                onChange={(e) => setPartNameMode(e.target.value as PartNameDisplayMode)}
                className="bg-white text-slate-900 text-[11px] font-medium outline-none cursor-pointer"
                style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
                title="スコア譜でのパート名・楽器名の表示形式"
              >
                <option value="abbr" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  英語略記 (Tb., Vln.)
                </option>
                <option value="abbrJa" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  日本語略記 (Tb, Vn, Pf)
                </option>
                <option value="multilineJa" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  日本語名 (改行表示)
                </option>
                <option value="trackOnly" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  トラック番号のみ (TR 1)
                </option>
              </select>
            </div>
          )}

          {/* 表示設定ポップオーバー */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors border ${
                isSettingsOpen
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
              }`}
              style={!isSettingsOpen ? { backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 } : {}}
              title="譜面のタイトル・テンポ・拍子等の表示/非表示設定"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>表示設定</span>
            </button>

            {isSettingsOpen && (
              <div
                className="absolute right-0 mt-2 w-72 bg-white border border-slate-300 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3 text-slate-900"
                style={{ backgroundColor: '#ffffff', opacity: 1 }}
              >
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>譜面表示オプション</span>
                  <span className="text-[10px] text-slate-500 font-normal">自動保存</span>
                </div>

                {/* カスタムタイトル入力 */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600 font-medium flex items-center space-x-1">
                    <Type className="w-3 h-3 text-blue-600" />
                    <span>曲名タイトル:</span>
                  </label>
                  <input
                    type="text"
                    value={displayOptions.customTitle || ''}
                    placeholder={score.title || '曲名 (未入力時は自動検出)'}
                    onChange={(e) => updateDisplayOption('customTitle', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 shadow-sm"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  />
                </div>

                {/* トグル項目リスト */}
                <div className="space-y-1.5 pt-1">
                  {/* タイトル表示 */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 cursor-pointer select-none">
                    <span className="text-slate-800 font-medium">楽譜タイトルを表示</span>
                    <input
                      type="checkbox"
                      checked={displayOptions.showTitle}
                      onChange={(e) => updateDisplayOption('showTitle', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                    />
                  </label>

                  {/* テンポ表示 */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 cursor-pointer select-none">
                    <span className="text-slate-800 font-medium">テンポ指示を表示 (♩ = BPM)</span>
                    <input
                      type="checkbox"
                      checked={displayOptions.showTempo}
                      onChange={(e) => updateDisplayOption('showTempo', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                    />
                  </label>

                  {/* 拍子記号表示 */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 cursor-pointer select-none">
                    <span className="text-slate-800 font-medium">拍子記号を表示 (4/4, 3/4 等)</span>
                    <input
                      type="checkbox"
                      checked={displayOptions.showTimeSignature}
                      onChange={(e) => updateDisplayOption('showTimeSignature', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                    />
                  </label>

                  {/* パート個別指示 (スコア譜) */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 cursor-pointer select-none">
                    <span className="text-slate-800 font-medium">パート別の個別テンポ/拍子を表示</span>
                    <input
                      type="checkbox"
                      checked={displayOptions.showTrackDetails}
                      onChange={(e) => updateDisplayOption('showTrackDetails', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                    />
                  </label>

                  {/* コードネーム表示 */}
                  <div className="border-t border-slate-200 pt-2 mt-1 space-y-2">
                    <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 cursor-pointer select-none">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-bold flex items-center">
                          <span className="w-2 h-2 rounded-full bg-blue-600 mr-1.5"></span>
                          コードネームを表示
                        </span>
                        <span className="text-[10px] text-slate-500">五線譜の上に和音記号を表示</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={displayOptions.showChords}
                        onChange={(e) => updateDisplayOption('showChords', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                    </label>

                    {displayOptions.showChords && (
                      <div className="pl-3.5 space-y-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-700 font-medium">解析の単位:</span>
                          <select
                            value={displayOptions.chordGranularity || 'auto'}
                            onChange={(e) =>
                              updateDisplayOption('chordGranularity', e.target.value as any)
                            }
                            className="bg-white border border-slate-300 text-slate-900 text-[11px] rounded px-1.5 py-0.5 outline-none font-medium"
                          >
                            <option value="auto">自動 (変化タイミング)</option>
                            <option value="measure">小節ごと (1小節1つ)</option>
                            <option value="two-beats">2拍ごと (半小節単位)</option>
                            <option value="beat">毎拍 (1拍ごと)</option>
                          </select>
                        </div>

                        {viewMode === 'score' && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-700 font-medium">総譜の解析対象:</span>
                            <select
                              value={displayOptions.chordTrackSource || 'all'}
                              onChange={(e) =>
                                updateDisplayOption('chordTrackSource', e.target.value as any)
                              }
                              className="bg-white border border-slate-300 text-slate-900 text-[11px] rounded px-1.5 py-0.5 outline-none font-medium"
                            >
                              <option value="all">全パート合算 (伴奏+ベース)</option>
                              <option value="selected">第1パートのみ</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isPlaying && (
            <div className="hidden xl:flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>第 {currentMeasure} 小節 / {currentBeat.toFixed(1)} 拍</span>
            </div>
          )}

          <div className="flex items-center bg-slate-800 rounded-md p-0.5 text-xs text-slate-300 border border-slate-700">
            <button
              onClick={() => setZoom((z) => Math.max(60, z - 10))}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px]">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(160, z + 10))}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="拡大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 印刷 / PDF出力ボタン */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-md shadow-sm transition-all active:scale-95"
            title="現在の楽譜（スコア譜またはパート譜）をA4印刷 / PDF保存"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>印刷 / PDF出力</span>
          </button>
        </div>
      </div>

      {/* 五線譜表示コンテナ (画面表示および印刷・PDF出力の両方に共通で使用) */}
      <div className="flex-1 overflow-auto p-4 bg-slate-900 flex flex-col items-center print:p-0 print:m-0 print:bg-white print:overflow-visible print:w-full print:block">
        {/* 楽譜描画エリア (タイトル・ヘッダーもこの内部で統一描画) */}
        <div
          ref={containerRef}
          className="bg-white rounded-xl shadow-2xl p-6 min-w-[550px] max-w-full overflow-x-auto text-slate-900 border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:min-w-0 print:max-w-none print:overflow-visible print:w-full print:block"
          style={{ transformOrigin: 'top center' }}
        />
      </div>
    </div>
  );
};

