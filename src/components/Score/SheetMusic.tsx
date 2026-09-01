import React, { useEffect, useRef, useState } from 'react';
import { ParsedScore } from '../../types/mml';
import { renderScoreToSvg } from '../../core/score/vexflowAdapter';
import { Printer, Music, ZoomIn, ZoomOut, Layers } from 'lucide-react';

interface SheetMusicProps {
  score: ParsedScore;
  currentBeat: number;
  isPlaying: boolean;
}

export const SheetMusic: React.FC<SheetMusicProps> = ({ score, currentBeat, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(100);

  // トラック変更時に有効な範囲に調整
  useEffect(() => {
    if (selectedTrack >= score.tracks.length && score.tracks.length > 0) {
      setSelectedTrack(0);
    }
  }, [score.tracks.length, selectedTrack]);

  // 画面用レンダリング
  useEffect(() => {
    if (!containerRef.current) return;
    const width = Math.max(600, Math.floor((containerRef.current.clientWidth || 800) * (zoom / 100)));
    renderScoreToSvg(containerRef.current, score, selectedTrack, width);
  }, [score, selectedTrack, zoom]);

  // 印刷用レンダリング（全トラックまたは選択トラック）
  useEffect(() => {
    if (!printContainerRef.current) return;
    renderScoreToSvg(printContainerRef.current, score, selectedTrack, 750);
  }, [score, selectedTrack]);

  const handlePrint = () => {
    window.print();
  };

  const currentMeasure = Math.floor(currentBeat / (score.timeSignature.numerator || 4)) + 1;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100">
      {/* ツールバー (画面用 / 印刷時は非表示) */}
      <div className="no-print flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 gap-2">
        {/* トラック切り替えタブ */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <Layers className="w-4 h-4 text-slate-400 mr-1" />
          {score.tracks.map((track, idx) => (
            <button
              key={track.id}
              onClick={() => setSelectedTrack(idx)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedTrack === idx
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {track.name || `Track ${idx + 1}`} ({track.notes.length}音)
            </button>
          ))}
          {score.tracks.length === 0 && (
            <span className="text-xs text-slate-500">トラックなし</span>
          )}
        </div>

        {/* ズーム & 印刷ボタン */}
        <div className="flex items-center space-x-2">
          {isPlaying && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>第 {currentMeasure} 小節 / {currentBeat.toFixed(1)} 拍</span>
            </div>
          )}

          <div className="flex items-center bg-slate-800 rounded-md p-0.5 text-xs text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(60, z - 10))}
              className="p-1 hover:bg-slate-700 rounded"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1 hover:bg-slate-700 rounded"
              title="拡大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
            title="五線譜をA4印刷 / PDF保存"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>印刷 / PDF</span>
          </button>
        </div>
      </div>

      {/* 画面用五線譜コンテナ */}
      <div className="no-print flex-1 overflow-auto p-4 bg-slate-900 flex justify-center items-start">
        <div
          ref={containerRef}
          className="bg-white rounded-lg shadow-xl p-6 min-w-[500px] max-w-full overflow-x-auto"
          style={{ transformOrigin: 'top center' }}
        />
      </div>

      {/* 印刷専用コンテナ (A4印刷時にのみ表示) */}
      <div className="hidden print-only print-container">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-black mb-1">
            {score.tracks[selectedTrack]?.name || 'MIDI Score'}
          </h1>
          <p className="text-xs text-gray-600">
            Tempo: {score.tempoEvents[0]?.bpm || 120} BPM | Time: {score.timeSignature.numerator}/{score.timeSignature.denominator}
          </p>
        </div>
        <div ref={printContainerRef} className="w-full" />
      </div>
    </div>
  );
};
