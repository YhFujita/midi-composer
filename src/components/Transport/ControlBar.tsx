import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Download,
  FolderOpen,
  Save,
  FilePlus,
  Music4,
  FileAudio,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ParsedScore } from '../../types/mml';
import { PRESET_SONGS } from '../../constants/presets';

interface ControlBarProps {
  score: ParsedScore;
  isPlaying: boolean;
  isPaused: boolean;
  currentTimeSec: number;
  totalDurationSec: number;
  currentFilename: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportMidi: () => void;
  onExportMp3: () => void;
  onLoadPreset: (mml: string) => void;
  isExportingMp3: boolean;
  mp3Progress: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  score,
  isPlaying,
  isPaused,
  currentTimeSec,
  totalDurationSec,
  currentFilename,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportMidi,
  onExportMp3,
  onLoadPreset,
  isExportingMp3,
  mp3Progress,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const currentBpm = score.tempoEvents[0]?.bpm || 120;
  const timeSignatureStr = `${score.timeSignature.numerator}/${score.timeSignature.denominator}`;

  return (
    <div className="no-print flex flex-col md:flex-row items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-slate-200 gap-2 shadow-md">
      {/* 左エリア: ファイル操作 & プリセット */}
      <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <div className="flex items-center space-x-1 border-r border-slate-800 pr-2">
          <button
            onClick={onNew}
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition-colors"
            title="新規作成"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={onOpen}
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition-colors"
            title="ローカルファイルを開く (.mml / .txt)"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onSave}
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition-colors"
            title="上書き保存 (Ctrl+S)"
          >
            <Save className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        {/* プリセット曲選択: 白背景・不透明・黒文字 */}
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={selectedPreset}
            onChange={(e) => {
              const p = PRESET_SONGS.find((s) => s.id === e.target.value);
              if (p) {
                onLoadPreset(p.mml);
                setSelectedPreset(e.target.value);
              }
            }}
            className="bg-white border border-slate-300 text-slate-900 font-medium text-xs rounded-md px-2.5 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
            style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
          >
            <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
              サンプル曲を読み込む...
            </option>
            {PRESET_SONGS.map((song) => (
              <option key={song.id} value={song.id} style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                {song.title}
              </option>
            ))}
          </select>
        </div>

        {/* ファイル名 */}
        <span className="text-xs text-slate-400 font-mono hidden lg:inline px-2">
          {currentFilename}
        </span>
      </div>

      {/* 中央エリア: 再生トランスポートコントロール */}
      <div className="flex items-center space-x-3 w-full md:w-auto justify-center">
        <div className="flex items-center space-x-1">
          {isPlaying ? (
            <button
              onClick={onPause}
              className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-full transition-transform active:scale-95 shadow-md shadow-amber-900/30"
              title="一時停止"
            >
              <Pause className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-transform active:scale-95 shadow-md shadow-blue-900/30"
              title="プレビュー再生"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          )}

          <button
            onClick={onStop}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition-colors"
            title="停止"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* タイム表示 & シークスライダー */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-300 w-12 text-right">
            {formatTime(currentTimeSec)}
          </span>

          <input
            type="range"
            min={0}
            max={totalDurationSec || 10}
            step={0.1}
            value={currentTimeSec}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-28 sm:w-44 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          <span className="text-xs font-mono text-slate-400 w-12">
            {formatTime(totalDurationSec)}
          </span>
        </div>

        {/* テンポ & 拍子バッジ */}
        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-2 py-1 rounded-md text-slate-300">
          <span className="text-blue-400 font-semibold">{currentBpm} BPM</span>
          <span className="text-slate-600">|</span>
          <span className="text-purple-400">{timeSignatureStr}</span>
        </div>
      </div>

      {/* 右エリア: MIDI / MP3 エクスポート */}
      <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
        {/* MIDI 保存 */}
        <button
          onClick={onExportMidi}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors"
          title="Standard MIDI File (.mid) を保存"
        >
          <Music4 className="w-3.5 h-3.5 text-blue-400" />
          <span>MIDI 出力</span>
        </button>

        {/* MP3 書き出し */}
        <button
          onClick={onExportMp3}
          disabled={isExportingMp3}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-md text-xs font-medium transition-all shadow-md shadow-emerald-950 disabled:opacity-50"
          title="Web Audio で高速レンダリングして MP3 を保存"
        >
          {isExportingMp3 ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>MP3変換中 ({mp3Progress}%)...</span>
            </>
          ) : (
            <>
              <FileAudio className="w-3.5 h-3.5 text-emerald-100" />
              <span>MP3 出力</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
