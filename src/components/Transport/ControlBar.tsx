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
  Minus,
  Plus,
  RotateCcw,
  Upload,
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
  onPlay?: () => void;
  onPlayFromStart: () => void;
  onPlayFromCursor: () => void;
  cursorPlaybackTimeSec?: number;
  cursorLineNumber?: number;
  onPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onNew: () => void;
  onOpen: () => void;
  onImportMidi: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportMidi: () => void;
  onExportMp3: () => void;
  onLoadPreset: (mml: string) => void;
  isExportingMp3: boolean;
  mp3Progress: number;
  globalKeyShift?: number;
  onChangeGlobalKeyShift?: (shift: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
}

export function getKeyIntervalLabel(shift: number): string {
  if (shift === 0) return '原調 (±0)';
  const abs = Math.abs(shift);
  const dir = shift > 0 ? '↑' : '↓';
  const names: Record<number, string> = {
    1: '短2度',
    2: '長2度',
    3: '短3度',
    4: '長3度',
    5: '完全4度',
    6: '増4度/減5度',
    7: '完全5度',
    8: '短6度',
    9: '長6度',
    10: '短7度',
    11: '長7度',
    12: '1オクターブ',
  };
  const name = names[abs] || `${abs}半音`;
  return `${shift > 0 ? '+' : ''}${shift} (${name}${dir})`;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  score,
  isPlaying,
  isPaused,
  currentTimeSec,
  totalDurationSec,
  currentFilename,
  onPlay,
  onPlayFromStart,
  onPlayFromCursor,
  cursorPlaybackTimeSec,
  cursorLineNumber,
  onPause,
  onStop,
  onSeek,
  onNew,
  onOpen,
  onImportMidi,
  onSave,
  onSaveAs,
  onExportMidi,
  onExportMp3,
  onLoadPreset,
  isExportingMp3,
  mp3Progress,
  globalKeyShift = 0,
  onChangeGlobalKeyShift,
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
            onClick={onImportMidi}
            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition-colors"
            title="MIDIファイルをインポート (.mid / .midi)"
          >
            <Upload className="w-4 h-4 text-sky-400" />
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
        <div className="flex items-center space-x-1.5">
          {/* 最初から再生 */}
          <button
            onClick={onPlayFromStart}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-all active:scale-95 shadow-sm shadow-blue-900/30"
            title="曲の最初から再生 (00:00)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>最初から</span>
          </button>

          {/* 途中から再生（テキストカーソル位置から） */}
          <button
            onClick={onPlayFromCursor}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-all active:scale-95 shadow-sm shadow-emerald-900/30"
            title={`テキストカーソルの位置から再生${
              cursorLineNumber !== undefined
                ? ` (行 ${cursorLineNumber}${cursorPlaybackTimeSec !== undefined ? ` : ${formatTime(cursorPlaybackTimeSec)}` : ''})`
                : ''
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>途中から</span>
          </button>

          {/* 一時停止 / 再開ボタン */}
          {isPlaying ? (
            <button
              onClick={onPause}
              className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-all active:scale-95 shadow-sm shadow-amber-900/30"
              title="一時停止"
            >
              <Pause className="w-4 h-4 fill-current" />
            </button>
          ) : isPaused ? (
            <button
              onClick={onPlay}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-all active:scale-95 shadow-sm shadow-blue-900/30"
              title="一時停止位置から再開"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          ) : null}

          {/* 停止 */}
          <button
            onClick={onStop}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md transition-colors"
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

        {/* 全体移調 (Key Shift / Transpose) コントロール */}
        <div
          className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-md text-slate-300"
          title={`楽曲全体の移調（現在: ${getKeyIntervalLabel(globalKeyShift)}）\nクリックで半音上げ下げ、中央をクリックで原調(±0)にリセット`}
        >
          <span className="text-[11px] font-semibold text-slate-400 pl-0.5">移調:</span>

          {/* 半音下げるボタン */}
          <button
            type="button"
            onClick={() => onChangeGlobalKeyShift?.(Math.max(-12, globalKeyShift - 1))}
            disabled={globalKeyShift <= -12}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
            title="半音下げる (短2度↓)"
          >
            <Minus className="w-3 h-3" />
          </button>

          {/* 現在の移調値バッジ (クリックで0にリセット) */}
          <button
            type="button"
            onClick={() => onChangeGlobalKeyShift?.(0)}
            className={`px-1.5 py-0.5 font-mono text-xs font-bold rounded transition-all ${
              globalKeyShift === 0
                ? 'text-slate-300 hover:bg-slate-800'
                : globalKeyShift > 0
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 hover:bg-blue-600/50'
                : 'bg-amber-600/30 text-amber-300 border border-amber-500/50 hover:bg-amber-600/50'
            }`}
            title="クリックして原調 (±0) にリセット"
          >
            {globalKeyShift > 0 ? `+${globalKeyShift}` : globalKeyShift === 0 ? '±0' : `${globalKeyShift}`}
          </button>

          {/* 半音上げるボタン */}
          <button
            type="button"
            onClick={() => onChangeGlobalKeyShift?.(Math.min(12, globalKeyShift + 1))}
            disabled={globalKeyShift >= 12}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
            title="半音上げる (短2度↑)"
          >
            <Plus className="w-3 h-3" />
          </button>

          {/* 度数ラベル (移調中のみ表示) */}
          {globalKeyShift !== 0 && (
            <span className="text-[10px] font-medium text-amber-400 hidden lg:inline pl-1 pr-0.5">
              {getKeyIntervalLabel(globalKeyShift).replace(/^[+-]?\d+\s*/, '')}
            </span>
          )}
        </div>
      </div>

      {/* 右エリア: MIDI / MP3 エクスポート */}
      <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
        {/* MIDI 読込 (インポート) */}
        <button
          onClick={onImportMidi}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
          title="Standard MIDI File (.mid / .midi) をインポートしてMMLに変換"
        >
          <Upload className="w-3.5 h-3.5 text-sky-400" />
          <span>MIDI 読込</span>
        </button>

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
