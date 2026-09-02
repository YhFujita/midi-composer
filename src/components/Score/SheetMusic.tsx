import React, { useEffect, useRef, useState } from 'react';
import { ParsedScore } from '../../types/mml';
import {
  renderScoreToSvg,
  renderFullScoreToSvg,
  PartNameDisplayMode,
} from '../../core/score/vexflowAdapter';
import { Printer, ZoomIn, ZoomOut, Layers, BookOpen, Tag } from 'lucide-react';
import { getInstrumentByProgram } from '../../constants/instruments';

interface SheetMusicProps {
  score: ParsedScore;
  currentBeat: number;
  isPlaying: boolean;
}

export type ScoreViewMode = 'score' | 'part';

export const SheetMusic: React.FC<SheetMusicProps> = ({ score, currentBeat, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 表示モード ('score': 総譜, 'part': パート譜)
  const [viewMode, setViewMode] = useState<ScoreViewMode>('score');
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(100);

  // パート名表示モード
  const [partNameMode, setPartNameMode] = useState<PartNameDisplayMode>('abbr');

  // トラック変更時に有効な範囲に調整
  useEffect(() => {
    if (selectedTrack >= score.tracks.length && score.tracks.length > 0) {
      setSelectedTrack(0);
    }
  }, [score.tracks.length, selectedTrack]);

  // レンダリング実行（画面表示 ＆ 印刷共通コンテナ）
  useEffect(() => {
    if (!containerRef.current) return;
    const baseWidth = Math.max(650, containerRef.current.clientWidth || 800);
    const targetWidth = Math.floor(baseWidth * (zoom / 100));

    if (viewMode === 'score') {
      renderFullScoreToSvg(containerRef.current, score, targetWidth, partNameMode);
    } else {
      renderScoreToSvg(containerRef.current, score, selectedTrack, targetWidth);
    }
  }, [score, viewMode, selectedTrack, zoom, partNameMode]);

  const handlePrint = () => {
    window.print();
  };

  const currentMeasure = Math.floor(currentBeat / (score.timeSignature.numerator || 4)) + 1;
  const activeTrack = score.tracks[selectedTrack] || score.tracks[0];
  const activeInst = activeTrack ? getInstrumentByProgram(activeTrack.instrument) : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 score-pane-container">
      {/* ツールバー (画面用 / 印刷時は非表示) */}
      <div className="no-print flex flex-wrap items-center justify-between px-4 py-2 bg-slate-950/90 border-b border-slate-800 gap-2">
        {/* 表示切替タブ (スコア譜 ＆ 各パート譜) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
          {/* スコア譜 (総譜) ボタン */}
          <button
            type="button"
            onClick={() => setViewMode('score')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
              viewMode === 'score'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-900/40 ring-1 ring-blue-400'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700'
            }`}
            title="全パートが揃ったスコア譜（総譜）を表示"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-300" />
            <span>スコア譜 (総譜)</span>
            <span className="text-[10px] bg-slate-900/80 px-1.5 py-0.2 rounded text-blue-300 font-mono">
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
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
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

        {/* 右エリア: パート名表示設定、ズーム、印刷ボタン */}
        <div className="flex items-center space-x-2 ml-auto">
          {/* スコア譜表示時のみ: パート名略記セレクター */}
          {viewMode === 'score' && (
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5">
              <Tag className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-slate-400">表記:</span>
              <select
                value={partNameMode}
                onChange={(e) => setPartNameMode(e.target.value as PartNameDisplayMode)}
                className="bg-transparent text-slate-200 text-[11px] font-medium outline-none cursor-pointer hover:text-white"
                title="スコア譜でのパート名・楽器名の表示形式"
              >
                <option value="abbr" className="bg-slate-900 text-white">
                  英語略記 (Tb., Vln.)
                </option>
                <option value="abbrJa" className="bg-slate-900 text-white">
                  日本語略記 (Tb, Vn, Pf)
                </option>
                <option value="multilineJa" className="bg-slate-900 text-white">
                  日本語名 (改行表示)
                </option>
                <option value="trackOnly" className="bg-slate-900 text-white">
                  トラック番号のみ (TR 1)
                </option>
              </select>
            </div>
          )}

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
      <div className="flex-1 overflow-auto p-4 bg-slate-900 flex flex-col items-center print:p-0 print:bg-white print:overflow-visible">
        {/* 印刷時のみ表示されるヘッダー */}
        <div className="hidden print-header w-full text-center mb-6 pb-2 border-b border-gray-300">
          <h1 className="text-2xl font-bold text-black mb-1">
            {viewMode === 'score'
              ? 'Full Score (総譜)'
              : `${activeTrack?.name || `Track ${selectedTrack + 1}`}: ${activeInst?.nameJa || 'パート譜'}`}
          </h1>
          <p className="text-xs text-gray-600">
            Tempo: {score.tempoEvents[0]?.bpm || 120} BPM | Time Signature:{' '}
            {score.timeSignature.numerator}/{score.timeSignature.denominator} | Total Measures:{' '}
            {Math.ceil(score.totalDuration / (score.timeSignature.numerator || 4))}
          </p>
        </div>

        {/* 楽譜描画エリア */}
        <div
          ref={containerRef}
          className="bg-white rounded-xl shadow-2xl p-6 min-w-[550px] max-w-full overflow-x-auto text-slate-900 border border-slate-200 print:shadow-none print:border-none print:p-0 print:min-w-0 print:overflow-visible print:w-full"
          style={{ transformOrigin: 'top center' }}
        />
      </div>
    </div>
  );
};
