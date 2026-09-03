import React, { useState, useMemo } from 'react';
import { X, Music2, CheckSquare, Square, SlidersHorizontal, FileMusic, AlertCircle } from 'lucide-react';
import { ParsedMidiData } from '../../core/midi/midiParser';

// GM 音色主要カテゴリ名
function getInstrumentName(prog: number): string {
  if (prog <= 7) return `Piano (${prog})`;
  if (prog <= 15) return `Chromatic Perc (${prog})`;
  if (prog <= 23) return `Organ (${prog})`;
  if (prog <= 31) return `Guitar (${prog})`;
  if (prog <= 39) return `Bass (${prog})`;
  if (prog <= 47) return `Strings (${prog})`;
  if (prog <= 55) return `Ensemble (${prog})`;
  if (prog <= 63) return `Brass (${prog})`;
  if (prog <= 71) return `Reed (${prog})`;
  if (prog <= 79) return `Pipe (${prog})`;
  if (prog <= 87) return `Synth Lead (${prog})`;
  if (prog <= 95) return `Synth Pad (${prog})`;
  if (prog <= 103) return `Synth Effects (${prog})`;
  if (prog <= 111) return `Ethnic (${prog})`;
  if (prog <= 119) return `Percussive (${prog})`;
  return `Sound FX (${prog})`;
}

export interface MidiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  midiData: ParsedMidiData | null;
  filename: string;
  onImport: (selectedTrackIds: number[], quantizeResolution: number) => void;
}

export const MidiImportModal: React.FC<MidiImportModalProps> = ({
  isOpen,
  onClose,
  midiData,
  filename,
  onImport,
}) => {
  // 選択トラックID一覧
  const [selectedTracks, setSelectedTracks] = useState<number[]>([]);
  // クオンタイズ解像度 (0.25 = 16分音符, 0.125 = 32分音符, 0.5 = 8分音符)
  const [quantizeResolution, setQuantizeResolution] = useState<number>(0.25);

  // midiData が変更されたら、ノートが存在するすべてのトラックをデフォルトで選択
  React.useEffect(() => {
    if (midiData) {
      const validTrackIds = midiData.tracks
        .filter((t) => t.notes.length > 0)
        .map((t) => t.id);
      setSelectedTracks(validTrackIds);
    }
  }, [midiData]);

  const toggleTrack = (id: number) => {
    setSelectedTracks((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!midiData) return;
    setSelectedTracks(midiData.tracks.map((t) => t.id));
  };

  const deselectAll = () => {
    setSelectedTracks([]);
  };

  const totalNotes = useMemo(() => {
    if (!midiData) return 0;
    return midiData.tracks.reduce((sum, t) => sum + t.notes.length, 0);
  }, [midiData]);

  if (!isOpen || !midiData) return null;

  const bpm = midiData.tempos[0]?.bpm || 120;
  const timeSig = midiData.timeSignatures[0] || { numerator: 4, denominator: 4 };

  const handleConfirm = () => {
    onImport(selectedTracks, quantizeResolution);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 完全不透明な白地(#ffffff) */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-900 bg-white animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FileMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">MIDIファイルのインポート</h2>
              <p className="text-xs text-slate-600 font-medium">
                MIDIデータをMMLに変換してエディタに展開します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div
          className="p-6 space-y-5 overflow-y-auto max-h-[70vh]"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* ファイル概要カード */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 text-xs">
            <div className="flex-1 min-w-[140px]">
              <span className="text-slate-500 font-medium block">ファイル名</span>
              <span className="text-slate-900 font-bold truncate block" title={filename}>
                {filename}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">テンポ (BPM)</span>
              <span className="text-slate-900 font-bold">{bpm}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">拍子</span>
              <span className="text-slate-900 font-bold">
                {timeSig.numerator} / {timeSig.denominator}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">総トラック数</span>
              <span className="text-slate-900 font-bold">{midiData.tracks.length} トラック</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">総音符数</span>
              <span className="text-slate-900 font-bold">{totalNotes} 音</span>
            </div>
          </div>

          {/* クオンタイズ設定 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>クオンタイズ解像度 (リズムの自動補正)</span>
            </div>
            <p className="text-xs text-slate-600">
              手弾き演奏などの微小なズレを吸収し、読みやすくきれいなMML音符に丸めます。
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { val: 0.25, label: '16分音符 (推奨)', desc: '一般的なポップス・メロディ' },
                { val: 0.125, label: '32分音符', desc: '細かい装飾音・速弾き' },
                { val: 0.5, label: '8分音符', desc: 'シンプルなテンポ・伴奏' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setQuantizeResolution(item.val)}
                  className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                    quantizeResolution === item.val
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20 text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900">{item.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* トラック選択一覧 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                <Music2 className="w-3.5 h-3.5 text-blue-600" />
                <span>インポートするトラック ({selectedTracks.length} / {midiData.tracks.length})</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  すべて選択
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  すべて解除
                </button>
              </div>
            </div>

            {midiData.tracks.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>音符データを含むトラックが見つかりませんでした。</span>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                {midiData.tracks.map((track, idx) => {
                  const isSelected = selectedTracks.includes(track.id);
                  const isDrum = track.channel === 10;
                  return (
                    <div
                      key={track.id}
                      onClick={() => toggleTrack(track.id)}
                      className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <button
                          type="button"
                          className="text-blue-600 focus:outline-none cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTrack(track.id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900">
                              Track {idx + 1}: {track.name || `Track ${idx + 1}`}
                            </span>
                            {isDrum && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-medium">
                                Drum (Ch 10)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                            <span>Ch {track.channel}</span>
                            <span>•</span>
                            <span>音色: {getInstrumentName(track.instrument)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 pl-2">
                        <span className="text-xs font-mono font-semibold text-slate-700">
                          {track.notes.length} 音
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div
          className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-lg transition-colors border border-slate-300 cursor-pointer"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedTracks.length === 0}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
          >
            <Music2 className="w-4 h-4" />
            <span>MMLに変換して開く ({selectedTracks.length} トラック)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
