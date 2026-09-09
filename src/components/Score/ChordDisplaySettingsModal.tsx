import React, { useState, useMemo } from 'react';
import {
  X,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ParsedScore } from '../../types/mml';
import {
  ScoreDisplayOptions,
  MeasureChordOverride,
} from '../../core/score/vexflowAdapter';
import { getInstrumentByProgram } from '../../constants/instruments';

interface ChordDisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: ParsedScore;
  displayOptions: ScoreDisplayOptions;
  onUpdateOptions: (newOptions: Partial<ScoreDisplayOptions>) => void;
}

type TabType = 'tracks' | 'measures';

export const ChordDisplaySettingsModal: React.FC<ChordDisplaySettingsModalProps> = ({
  isOpen,
  onClose,
  score,
  displayOptions,
  onUpdateOptions,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('tracks');

  // 小節編集用の選択中・編集対象の小節番号 (1-indexed: 1, 2, ... N)
  const [selectedMeasureNumber, setSelectedMeasureNumber] = useState<number>(1);

  // 拍位置手動追加用の入力値
  const [newBeatInput, setNewBeatInput] = useState<string>('0.0');

  const tracks = score?.tracks || [];
  const beatsPerMeasure = score?.timeSignature?.numerator || 4;
  const totalMeasures = Math.max(
    1,
    Math.ceil(((score?.totalDuration ?? 16)) / beatsPerMeasure)
  );

  // 現在のトラック選択設定
  const chordTrackSource = displayOptions.chordTrackSource || 'all';
  const selectedTrackIds = useMemo(() => {
    if (chordTrackSource === 'all') {
      return tracks.map((t) => t.id);
    }
    if (chordTrackSource === 'custom' && displayOptions.chordTargetTrackIds) {
      return displayOptions.chordTargetTrackIds;
    }
    return tracks.map((t) => t.id);
  }, [chordTrackSource, displayOptions.chordTargetTrackIds, tracks]);

  // トラック選択トグル
  const handleToggleTrack = (trackId: number) => {
    let nextIds: number[];
    if (chordTrackSource !== 'custom') {
      // 全選択状態から個別解除
      nextIds = tracks.map((t) => t.id).filter((id) => id !== trackId);
    } else {
      if (selectedTrackIds.includes(trackId)) {
        nextIds = selectedTrackIds.filter((id) => id !== trackId);
      } else {
        nextIds = [...selectedTrackIds, trackId];
      }
    }

    onUpdateOptions({
      chordTrackSource: 'custom',
      chordTargetTrackIds: nextIds,
    });
  };

  // プリセット: 全トラック選択
  const handleSelectAllTracks = () => {
    onUpdateOptions({
      chordTrackSource: 'all',
      chordTargetTrackIds: tracks.map((t) => t.id),
    });
  };

  // プリセット: 伴奏・ベースのみ (ピアノ、エレピ、オルガン、ギター、ベース等)
  const handleSelectAccompanimentOnly = () => {
    const accIds = tracks
      .filter((t) => {
        const p = t.instrument ?? 0;
        // GM音色番号: 0-7 (Piano), 16-23 (Organ), 24-31 (Guitar), 32-39 (Bass), 4-5 (EP), 8-15 (Chromatic Perc)
        const isPiano = p >= 0 && p <= 7;
        const isOrgan = p >= 16 && p <= 23;
        const isGuitar = p >= 24 && p <= 31;
        const isBass = p >= 32 && p <= 39;
        const isKeyboard = p >= 4 && p <= 5;
        // ドラムチャンネル(10)は除外
        const isDrum = t.channel === 10;
        return (isPiano || isOrgan || isGuitar || isBass || isKeyboard) && !isDrum;
      })
      .map((t) => t.id);

    onUpdateOptions({
      chordTrackSource: 'custom',
      chordTargetTrackIds: accIds.length > 0 ? accIds : tracks.map((t) => t.id),
    });
  };

  // 現在選択中の小節のインデックス (0-indexed)
  const currentMeasureIndex = Math.max(0, Math.min(totalMeasures - 1, selectedMeasureNumber - 1));
  const currentOverride = displayOptions.measureChordOverrides?.[currentMeasureIndex];
  const currentMode = currentOverride?.mode || 'default';

  // 選択中小節に存在する音符開始拍（ユニークな拍位置）を検出
  const activeMeasureBeats = useMemo(() => {
    const measureStartBeat = currentMeasureIndex * beatsPerMeasure;
    const measureEndBeat = measureStartBeat + beatsPerMeasure;

    // 対象トラックの音符のみ
    const targetTracks =
      chordTrackSource === 'custom' && displayOptions.chordTargetTrackIds
        ? tracks.filter((t) => displayOptions.chordTargetTrackIds!.includes(t.id))
        : tracks;

    const beatMap = new Map<number, { pitches: string[]; trackNames: string[] }>();

    targetTracks.forEach((t) => {
      t.notes?.forEach((n) => {
        if (n && typeof n.startTime === 'number' && n.startTime >= measureStartBeat && n.startTime < measureEndBeat) {
          // 4分音符基準の小節内拍オフセット（1/16音符精度 0.25拍に丸め）
          const offset = Math.round((n.startTime - measureStartBeat) * 4) / 4;
          if (!beatMap.has(offset)) {
            beatMap.set(offset, { pitches: [], trackNames: [] });
          }
          const item = beatMap.get(offset)!;
          if (n.pitch && !item.pitches.includes(n.pitch)) {
            item.pitches.push(n.pitch);
          }
          const tName = t.name || `TR${t.id + 1}`;
          if (!item.trackNames.includes(tName)) {
            item.trackNames.push(tName);
          }
        }
      });
    });

    return Array.from(beatMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([offset, data]) => ({
        offset,
        pitches: data.pitches,
        trackNames: data.trackNames,
      }));
  }, [currentMeasureIndex, beatsPerMeasure, chordTrackSource, displayOptions.chordTargetTrackIds, tracks]);

  // 小節オーバーライドの更新
  const updateMeasureOverride = (override: MeasureChordOverride | null) => {
    const currentOverrides = { ...(displayOptions.measureChordOverrides || {}) };
    if (!override || override.mode === 'default') {
      delete currentOverrides[currentMeasureIndex];
    } else {
      currentOverrides[currentMeasureIndex] = override;
    }
    onUpdateOptions({
      measureChordOverrides: currentOverrides,
    });
  };

  // 小節内の特定拍トグル
  const handleToggleBeatOffset = (offset: number) => {
    const customBeats = currentOverride?.customBeats ? [...currentOverride.customBeats] : [];
    let nextBeats: number[];
    if (customBeats.includes(offset)) {
      nextBeats = customBeats.filter((b) => b !== offset);
    } else {
      nextBeats = [...customBeats, offset].sort((a, b) => a - b);
    }

    updateMeasureOverride({
      measureIndex: currentMeasureIndex,
      mode: 'custom',
      customBeats: nextBeats,
    });
  };

  // 手動拍の追加
  const handleAddManualBeat = () => {
    const val = parseFloat(newBeatInput);
    if (isNaN(val) || val < 0 || val >= beatsPerMeasure) return;

    const customBeats = currentOverride?.customBeats ? [...currentOverride.customBeats] : [];
    if (!customBeats.includes(val)) {
      const nextBeats = [...customBeats, val].sort((a, b) => a - b);
      updateMeasureOverride({
        measureIndex: currentMeasureIndex,
        mode: 'custom',
        customBeats: nextBeats,
      });
    }
    setNewBeatInput('0.0');
  };

  // 設定済み小節の一覧
  const configuredMeasures = useMemo(() => {
    const overrides = displayOptions?.measureChordOverrides || {};
    return Object.keys(overrides)
      .map((k) => parseInt(k, 10))
      .filter((mIdx) => !isNaN(mIdx) && overrides[mIdx] != null)
      .sort((a, b) => a - b)
      .map((mIdx) => ({
        measureIndex: mIdx,
        measureNumber: mIdx + 1,
        override: overrides[mIdx],
      }));
  }, [displayOptions?.measureChordOverrides]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 完全不透明白(#ffffff) */}
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
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">コード自動生成・表示の詳細設定</h2>
              <p className="text-xs text-slate-500">
                コード解析の対象パートや、小節ごとの表示タイミング（拍・音符位置）を設定
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

        {/* タブ切り替えバー */}
        <div
          className="flex border-b border-slate-200 px-6 bg-slate-50 gap-2 pt-2"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <button
            onClick={() => setActiveTab('tracks')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'tracks'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. 解析対象トラックの選択</span>
            {chordTrackSource === 'custom' && (
              <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {selectedTrackIds.length}/{tracks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('measures')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'measures'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>2. 小節別の表示位置指定 (15小節など)</span>
            {configuredMeasures.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {configuredMeasures.length}小節設定中
              </span>
            )}
          </button>
        </div>

        {/* コンテンツエリア */}
        <div
          className="p-6 space-y-5 overflow-y-auto max-h-[70vh] flex-1 text-slate-800"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* ========== タブ1: トラック選択 ========== */}
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
                <p className="font-bold text-blue-900 mb-1 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  メロディの経過音によるコード崩れを防止
                </p>
                メロディパートをコード解析に含めると、細かな経過音や装飾音によってコード判定が複雑になりすぎることがあります。
                伴奏パート（ピアノ・キーボード・ギター）やベースパートのみを選択することで、すっきりとした正しいコードネームを五線譜上に表示できます。
              </div>

              {/* プリセット選択ボタン */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700">クイック選択:</span>
                <button
                  onClick={handleSelectAccompanimentOnly}
                  className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors cursor-pointer"
                >
                  🎹 伴奏＆ベースのみ
                </button>
                <button
                  onClick={handleSelectAllTracks}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md border border-slate-300 transition-colors cursor-pointer"
                >
                  全トラック合算
                </button>
                <button
                  onClick={() =>
                    onUpdateOptions({
                      chordTrackSource: 'custom',
                      chordTargetTrackIds: [],
                    })
                  }
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md border border-slate-300 transition-colors cursor-pointer"
                >
                  選択解除
                </button>
              </div>

              {/* トラック一覧 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                {tracks.map((track, idx) => {
                  const inst = getInstrumentByProgram(track.instrument);
                  const isChecked = selectedTrackIds.includes(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handleToggleTrack(track.id)}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-blue-600">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900 font-mono">
                              TR {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {track.name || `Track ${idx + 1}`}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.2 bg-slate-100 border border-slate-200 rounded text-slate-600">
                              {inst.nameJa}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            チャンネル: {track.channel} | ノート数: {track.notes?.length || 0}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isChecked
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isChecked ? '解析対象' : '除外中'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========== タブ2: 小節別指定 ========== */}
          {activeTab === 'measures' && (
            <div className="space-y-4">
              {/* 小節セレクター */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">編集小節:</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() =>
                        setSelectedMeasureNumber((m) => Math.max(1, m - 1))
                      }
                      disabled={selectedMeasureNumber <= 1}
                      className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer"
                      title="前の小節"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-slate-500">第</span>
                      <input
                        type="number"
                        min={1}
                        max={totalMeasures}
                        value={selectedMeasureNumber}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setSelectedMeasureNumber(
                              Math.max(1, Math.min(totalMeasures, val))
                            );
                          }
                        }}
                        className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-center font-bold text-blue-600 focus:outline-none focus:border-blue-600 shadow-sm"
                      />
                      <span className="text-xs text-slate-500">小節 / 全 {totalMeasures} 小節</span>
                    </div>
                    <button
                      onClick={() =>
                        setSelectedMeasureNumber((m) => Math.min(totalMeasures, m + 1))
                      }
                      disabled={selectedMeasureNumber >= totalMeasures}
                      className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer"
                      title="次の小節"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 設定リセットボタン */}
                {currentOverride && (
                  <button
                    onClick={() => updateMeasureOverride(null)}
                    className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>この小節の設定を解除</span>
                  </button>
                )}
              </div>

              {/* 表示モード選択 */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800">
                  第 {selectedMeasureNumber} 小節のコード表示設定:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* デフォルト */}
                  <label
                    onClick={() => updateMeasureOverride(null)}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      currentMode === 'default'
                        ? 'bg-blue-50 border-blue-500 font-bold text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="measureMode"
                      checked={currentMode === 'default'}
                      onChange={() => {}}
                      className="text-blue-600"
                    />
                    <div>
                      <div>曲全体の基本設定に従う</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        ({displayOptions.chordGranularity === 'measure' ? '1小節1つ' : displayOptions.chordGranularity === 'two-beats' ? '2拍ごと' : displayOptions.chordGranularity === 'beat' ? '毎拍' : '自動'})
                      </div>
                    </div>
                  </label>

                  {/* 非表示 */}
                  <label
                    onClick={() =>
                      updateMeasureOverride({
                        measureIndex: currentMeasureIndex,
                        mode: 'none',
                      })
                    }
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      currentMode === 'none'
                        ? 'bg-blue-50 border-blue-500 font-bold text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="measureMode"
                      checked={currentMode === 'none'}
                      onChange={() => {}}
                      className="text-blue-600"
                    />
                    <div>
                      <div>コードを表示しない</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        この小節のみコードネームを非表示
                      </div>
                    </div>
                  </label>

                  {/* 1拍目のみ */}
                  <label
                    onClick={() =>
                      updateMeasureOverride({
                        measureIndex: currentMeasureIndex,
                        mode: 'measure',
                      })
                    }
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      currentMode === 'measure'
                        ? 'bg-blue-50 border-blue-500 font-bold text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="measureMode"
                      checked={currentMode === 'measure'}
                      onChange={() => {}}
                      className="text-blue-600"
                    />
                    <div>
                      <div>1拍目のみ (1小節1つ)</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        小節の先頭に1つだけ表示
                      </div>
                    </div>
                  </label>

                  {/* 1拍目と3拍目 */}
                  <label
                    onClick={() =>
                      updateMeasureOverride({
                        measureIndex: currentMeasureIndex,
                        mode: 'two-beats',
                      })
                    }
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      currentMode === 'two-beats'
                        ? 'bg-blue-50 border-blue-500 font-bold text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="measureMode"
                      checked={currentMode === 'two-beats'}
                      onChange={() => {}}
                      className="text-blue-600"
                    />
                    <div>
                      <div>1拍目と3拍目 (2拍ごと)</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        半小節ごとにコードを表示
                      </div>
                    </div>
                  </label>

                  {/* 毎拍 */}
                  <label
                    onClick={() =>
                      updateMeasureOverride({
                        measureIndex: currentMeasureIndex,
                        mode: 'beat',
                      })
                    }
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      currentMode === 'beat'
                        ? 'bg-blue-50 border-blue-500 font-bold text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="measureMode"
                      checked={currentMode === 'beat'}
                      onChange={() => {}}
                      className="text-blue-600"
                    />
                    <div>
                      <div>毎拍表示 (1拍ごと)</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        1拍ごとに変化を検出
                      </div>
                    </div>
                  </label>

                  {/* 音符位置・カスタム拍位置の個別選択 */}
                  <label
                    onClick={() => {
                      if (currentMode !== 'custom') {
                        // 初回は既存の音符開始位置から先頭などを初期選択
                        const defaultBeats = activeMeasureBeats.slice(0, 2).map((b) => b.offset);
                        updateMeasureOverride({
                          measureIndex: currentMeasureIndex,
                          mode: 'custom',
                          customBeats: defaultBeats.length > 0 ? defaultBeats : [0],
                        });
                      }
                    }}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      currentMode === 'custom'
                        ? 'bg-blue-50 border-blue-500 font-bold text-blue-900'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="measureMode"
                      checked={currentMode === 'custom'}
                      onChange={() => {}}
                      className="text-blue-600"
                    />
                    <div>
                      <div className="text-blue-600 font-bold">🎯 音符・拍の位置を個別選択</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        特定の音符タイミングにピンポイント指定
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* カスタム拍指定パネル */}
              {currentMode === 'custom' && (
                <div className="bg-slate-50 border border-blue-300 rounded-xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        第 {selectedMeasureNumber} 小節の音符発音位置 (クリックで表示ON/OFF):
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        チェックを入れた拍の位置にコードを検出・配置します
                      </p>
                    </div>
                  </div>

                  {activeMeasureBeats.length === 0 ? (
                    <div className="text-xs text-slate-500 p-3 bg-white rounded-lg border border-slate-200 text-center">
                      この小節（対象トラック内）には音符が見つかりませんでした。下のフォームから任意の拍位置を追加できます。
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeMeasureBeats.map((bInfo) => {
                        const isSelected = currentOverride?.customBeats?.includes(bInfo.offset);
                        return (
                          <div
                            key={bInfo.offset}
                            onClick={() => handleToggleBeatOffset(bInfo.offset)}
                            className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-100/70 border-blue-400 font-bold text-blue-950'
                                : 'bg-white border-slate-200 hover:bg-slate-100/80 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                              <span className="text-xs font-mono">
                                拍 {(bInfo.offset + 1).toFixed(2)} (オフセット: +{bInfo.offset.toFixed(2)}拍)
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center space-x-1.5">
                              <span className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                {bInfo.pitches.slice(0, 4).join(', ')}
                                {bInfo.pitches.length > 4 ? '...' : ''}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                ({bInfo.trackNames.join(', ')})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 任意の拍の手動追加 */}
                  <div className="pt-2 border-t border-slate-200 flex items-center space-x-2">
                    <span className="text-xs text-slate-700 font-medium">その他の拍を追加:</span>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      max={beatsPerMeasure - 0.25}
                      value={newBeatInput}
                      onChange={(e) => setNewBeatInput(e.target.value)}
                      placeholder="例: 1.5"
                      className="w-16 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-900 outline-none"
                    />
                    <span className="text-xs text-slate-500">拍目 (0〜{beatsPerMeasure - 1})</span>
                    <button
                      type="button"
                      onClick={handleAddManualBeat}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>追加</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 設定済み小節一覧パネル */}
              {configuredMeasures.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      現在個別設定されている小節 ({configuredMeasures.length}小節):
                    </span>
                    <button
                      onClick={() =>
                        onUpdateOptions({
                          measureChordOverrides: {},
                        })
                      }
                      className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      すべての小節設定をリセット
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {configuredMeasures.map((item) => {
                      const isCurrent = item.measureNumber === selectedMeasureNumber;
                      const modeLabel =
                        item.override?.mode === 'none'
                          ? '非表示'
                          : item.override?.mode === 'measure'
                          ? '1拍目'
                          : item.override?.mode === 'two-beats'
                          ? '2拍ごと'
                          : item.override?.mode === 'beat'
                          ? '毎拍'
                          : item.override?.mode === 'custom'
                          ? `拍:[${item.override?.customBeats?.map((b) => b.toFixed(1)).join(', ') || ''}]`
                          : '';

                      return (
                        <button
                          key={item.measureIndex}
                          onClick={() => setSelectedMeasureNumber(item.measureNumber)}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-bold">第{item.measureNumber}小節</span>
                          <span className="text-[10px] opacity-80">({modeLabel})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div
          className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <div className="text-[11px] text-slate-500">
            ※ 設定は自動で保存され、楽譜描画および印刷・PDF出力に即時反映されます
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
