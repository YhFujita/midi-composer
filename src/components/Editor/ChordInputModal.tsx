import React, { useState, useMemo } from 'react';
import {
  X,
  Volume2,
  CornerDownLeft,
  Music,
  Sparkles,
  Layers,
  FileText,
  Play,
  RotateCcw,
  ArrowLeftRight,
} from 'lucide-react';
import {
  COMMON_CHORD_TYPES,
  buildChordMml,
  getPitchClass,
} from '../../core/score/chordDetector';
import { audioEngine } from '../../core/audio/soundFontPlayer';

interface ChordInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertChord: (mmlText: string) => void;
  currentProgram?: number;
}

type TabType = 'builder' | 'diatonic' | 'progression';

const ROOT_NOTES = [
  { name: 'C', alt: '' },
  { name: 'C#', alt: 'Db' },
  { name: 'D', alt: '' },
  { name: 'Eb', alt: 'D#' },
  { name: 'E', alt: '' },
  { name: 'F', alt: '' },
  { name: 'F#', alt: 'Gb' },
  { name: 'G', alt: '' },
  { name: 'Ab', alt: 'G#' },
  { name: 'A', alt: '' },
  { name: 'Bb', alt: 'A#' },
  { name: 'B', alt: '' },
];

const DURATION_OPTIONS = [
  { label: '全音符 (1)', value: '1' },
  { label: '2分音符 (2)', value: '2' },
  { label: '4分音符 (4)', value: '4' },
  { label: '8分音符 (8)', value: '8' },
  { label: '付点2分 (2.)', value: '2.' },
  { label: '付点4分 (4.)', value: '4.' },
];

interface DiatonicKey {
  name: string;
  label: string;
  chords: { root: string; type: string; degree: string; func: string }[];
}

const DIATONIC_KEYS: DiatonicKey[] = [
  {
    name: 'C Major',
    label: 'C Major (ハ長調)',
    chords: [
      { root: 'C', type: '', degree: 'I', func: 'Tonic' },
      { root: 'D', type: 'm', degree: 'ii', func: 'Subdominant' },
      { root: 'E', type: 'm', degree: 'iii', func: 'Tonic' },
      { root: 'F', type: '', degree: 'IV', func: 'Subdominant' },
      { root: 'G', type: '', degree: 'V', func: 'Dominant' },
      { root: 'A', type: 'm', degree: 'vi', func: 'Tonic' },
      { root: 'B', type: 'dim', degree: 'vii°', func: 'Dominant' },
    ],
  },
  {
    name: 'G Major',
    label: 'G Major (ト長調 / #1個)',
    chords: [
      { root: 'G', type: '', degree: 'I', func: 'Tonic' },
      { root: 'A', type: 'm', degree: 'ii', func: 'Subdominant' },
      { root: 'B', type: 'm', degree: 'iii', func: 'Tonic' },
      { root: 'C', type: '', degree: 'IV', func: 'Subdominant' },
      { root: 'D', type: '', degree: 'V', func: 'Dominant' },
      { root: 'E', type: 'm', degree: 'vi', func: 'Tonic' },
      { root: 'F#', type: 'dim', degree: 'vii°', func: 'Dominant' },
    ],
  },
  {
    name: 'F Major',
    label: 'F Major (ヘ長調 / ♭1個)',
    chords: [
      { root: 'F', type: '', degree: 'I', func: 'Tonic' },
      { root: 'G', type: 'm', degree: 'ii', func: 'Subdominant' },
      { root: 'A', type: 'm', degree: 'iii', func: 'Tonic' },
      { root: 'Bb', type: '', degree: 'IV', func: 'Subdominant' },
      { root: 'C', type: '', degree: 'V', func: 'Dominant' },
      { root: 'D', type: 'm', degree: 'vi', func: 'Tonic' },
      { root: 'E', type: 'dim', degree: 'vii°', func: 'Dominant' },
    ],
  },
  {
    name: 'D Major',
    label: 'D Major (ニ長調 / #2個)',
    chords: [
      { root: 'D', type: '', degree: 'I', func: 'Tonic' },
      { root: 'E', type: 'm', degree: 'ii', func: 'Subdominant' },
      { root: 'F#', type: 'm', degree: 'iii', func: 'Tonic' },
      { root: 'G', type: '', degree: 'IV', func: 'Subdominant' },
      { root: 'A', type: '', degree: 'V', func: 'Dominant' },
      { root: 'B', type: 'm', degree: 'vi', func: 'Tonic' },
      { root: 'C#', type: 'dim', degree: 'vii°', func: 'Dominant' },
    ],
  },
  {
    name: 'A minor',
    label: 'A minor (イ短調)',
    chords: [
      { root: 'A', type: 'm', degree: 'i', func: 'Tonic' },
      { root: 'B', type: 'dim', degree: 'ii°', func: 'Subdominant' },
      { root: 'C', type: '', degree: 'III', func: 'Tonic' },
      { root: 'D', type: 'm', degree: 'iv', func: 'Subdominant' },
      { root: 'E', type: 'm', degree: 'v', func: 'Dominant' },
      { root: 'F', type: '', degree: 'VI', func: 'Subdominant' },
      { root: 'G', type: '', degree: 'VII', func: 'Subdominant' },
    ],
  },
];

const PRESET_PROGRESSIONS = [
  { name: '王道進行 (F → G → Em → Am)', text: 'F G Em Am' },
  { name: 'ポップパンク進行 (C → G → Am → F)', text: 'C G Am F' },
  { name: 'カノン進行 (C → G → Am → Em → F → C → F → G)', text: 'C G Am Em F C F G' },
  { name: '小室進行 (Am → F → G → C)', text: 'Am F G C' },
  { name: '丸サ進行 (Fmaj7 → E7 → Am7 → C7)', text: 'Fmaj7 E7 Am7 C7' },
  { name: '2-5-1 ジャズ進行 (Dm7 → G7 → Cmaj7)', text: 'Dm7 G7 Cmaj7' },
];

export const ChordInputModal: React.FC<ChordInputModalProps> = ({
  isOpen,
  onClose,
  onInsertChord,
  currentProgram = 0,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('builder');
  const [panelPosition, setPanelPosition] = useState<'right' | 'left'>('right');

  // コードビルダー用状態
  const [builderRoot, setBuilderRoot] = useState<string>('C');
  const [builderType, setBuilderType] = useState<string>('');
  const [builderDuration, setBuilderDuration] = useState<string>('4');
  const [builderInversion, setBuilderInversion] = useState<number>(0);
  const [builderBass, setBuilderBass] = useState<string>(''); // オンコード指定

  // ダイアトニックコード用状態
  const [selectedKeyIdx, setSelectedKeyIdx] = useState<number>(0);
  const [diatonicDuration, setDiatonicDuration] = useState<string>('4');

  // コード進行一括展開用状態
  const [progressionText, setProgressionText] = useState<string>('C G Am F');
  const [progressionDuration, setProgressionDuration] = useState<string>('1');

  // 生成されるMMLコード文字列
  const generatedMml = useMemo(() => {
    return buildChordMml(
      builderRoot,
      builderType,
      builderDuration,
      builderInversion,
      builderBass || undefined
    );
  }, [builderRoot, builderType, builderDuration, builderInversion, builderBass]);

  // 選択中のコードのMIDIノート配列（プレビュー用）
  const chordMidiNotes = useMemo(() => {
    const rootPc = getPitchClass(`${builderRoot}4`);
    const typeDef = COMMON_CHORD_TYPES.find((t) => t.type === builderType) || COMMON_CHORD_TYPES[0];
    const baseMidi = 60 + rootPc; // C4 = 60基準

    let intervals = [...typeDef.intervals];
    if (builderInversion > 0 && intervals.length > 1) {
      const invCount = builderInversion % intervals.length;
      for (let i = 0; i < invCount; i++) {
        const lowest = intervals.shift()!;
        intervals.push(lowest + 12);
      }
    }

    const notes = intervals.map((int) => baseMidi + int);
    if (builderBass && builderBass !== builderRoot) {
      const bassPc = getPitchClass(`${builderBass}3`);
      notes.unshift(48 + bassPc); // C3基準
    }
    return notes;
  }, [builderRoot, builderType, builderInversion, builderBass]);

  if (!isOpen) return null;

  // プレビュー再生
  const handlePreview = (midis?: number[]) => {
    audioEngine.previewChord(midis || chordMidiNotes, currentProgram);
  };

  // ビルダーから挿入
  const handleInsertBuilder = () => {
    onInsertChord(generatedMml);
    handlePreview();
  };

  // ダイアトニックコードから即座に挿入
  const handleInsertDiatonic = (root: string, type: string) => {
    const mml = buildChordMml(root, type, diatonicDuration, 0);
    onInsertChord(mml);

    // 試聴
    const rootPc = getPitchClass(`${root}4`);
    const typeDef = COMMON_CHORD_TYPES.find((t) => t.type === type) || COMMON_CHORD_TYPES[0];
    const midis = typeDef.intervals.map((int) => 60 + rootPc + int);
    handlePreview(midis);
  };

  // コード進行テキストの一括変換＆挿入
  const handleInsertProgression = () => {
    const tokens = progressionText.trim().split(/\s+/);
    if (tokens.length === 0) return;

    const mmlParts: string[] = [];
    for (const token of tokens) {
      // 例: "C", "Am", "Fmaj7", "G7", "C/E", "F#m7"
      const slashParts = token.split('/');
      const mainChord = slashParts[0];
      const bass = slashParts[1];

      // ルート音とコードタイプを正規表現で分離
      const match = mainChord.match(/^([A-Ga-g][#b]?)(.*)$/);
      if (!match) continue;

      const root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      const rawType = match[2];

      // 最も近いコードタイプをマッチング
      let resolvedType = '';
      const exactType = COMMON_CHORD_TYPES.find((t) => t.type === rawType);
      if (exactType) {
        resolvedType = exactType.type;
      } else if (rawType.toLowerCase() === 'm' || rawType.toLowerCase() === 'min') {
        resolvedType = 'm';
      } else if (rawType.toLowerCase() === 'maj' || rawType.toLowerCase() === 'major') {
        resolvedType = '';
      } else {
        resolvedType = rawType;
      }

      const mml = buildChordMml(root, resolvedType, progressionDuration, 0, bass);
      mmlParts.push(mml);
    }

    if (mmlParts.length > 0) {
      onInsertChord(mmlParts.join(' '));
    }
  };

  return (
    <div
      className={`fixed top-[104px] bottom-3 z-40 pointer-events-none flex flex-col transition-all duration-200 ${
        panelPosition === 'right' ? 'right-2 sm:right-4' : 'left-2 sm:left-4'
      }`}
    >
      <div
        className="pointer-events-auto relative w-[92vw] sm:w-[410px] bg-white border border-slate-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full max-h-full animate-in fade-in duration-200"
        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
      >
        {/* ヘッダー */}
        <div className="flex-shrink-0 flex items-center justify-between px-3.5 sm:px-4 py-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-blue-100 text-blue-700 rounded-md">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                コード入力パレット
                <span className="text-[10px] font-normal text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                  {panelPosition === 'right' ? '右側' : '左側'}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* 左右切替ボタン */}
            <button
              type="button"
              onClick={() => setPanelPosition((prev) => (prev === 'right' ? 'left' : 'right'))}
              className="flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-md text-[11px] font-semibold text-slate-700 shadow-sm transition-all"
              title={`パレットを画面の${panelPosition === 'right' ? '左側' : '右側'}へ移動`}
            >
              <ArrowLeftRight className="w-3 h-3 text-blue-600" />
              <span>{panelPosition === 'right' ? '左へ' : '右へ'}</span>
            </button>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
              title="パレットを閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* タブ切り替えボタン */}
        <div className="flex-shrink-0 flex items-center space-x-1 px-2.5 sm:px-3 pt-2 pb-1.5 border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`flex items-center justify-center space-x-1 flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'builder'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Music className="w-3 h-3" />
            <span>ビルダー</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diatonic')}
            className={`flex items-center justify-center space-x-1 flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'diatonic'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>ダイアトニック</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('progression')}
            className={`flex items-center justify-center space-x-1 flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'progression'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>進行展開</span>
          </button>
        </div>

        {/* コンテンツエリア (min-h-0 で内部スクロールを保証) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#f8fafc]">
          {/* 1. コードビルダー タブ */}
          {activeTab === 'builder' && (
            <div className="space-y-3">
              {/* ルート音選択 (6列×2行でジャストフィット) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>ルート音 (根音):</span>
                  <span className="text-blue-600 font-mono text-xs font-bold">{builderRoot}</span>
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {ROOT_NOTES.map((r) => {
                    const isSelected = builderRoot === r.name;
                    return (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => setBuilderRoot(r.name)}
                        className={`py-1 text-xs font-bold rounded-md border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-400'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <div>{r.name}</div>
                        {r.alt && <div className="text-[8px] opacity-75 font-normal">({r.alt})</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* コードタイプ選択 */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>コード種別 (和音の種類):</span>
                  <span className="text-blue-600 font-mono text-xs font-bold">
                    {builderRoot}
                    {builderType || '(Major)'}
                    {builderBass ? ` / ${builderBass}` : ''}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {COMMON_CHORD_TYPES.map((t) => {
                    const isSelected = builderType === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setBuilderType(t.type)}
                        className={`p-1.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500 shadow-sm'
                            : 'bg-white border-slate-300 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs text-slate-900">
                          {builderRoot}
                          {t.type}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate">{t.nameJa}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 転回形・オンコード・音長設定 */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {/* 転回形 */}
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-slate-700">ボイシング (展開形):</label>
                  <select
                    value={builderInversion}
                    onChange={(e) => setBuilderInversion(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg p-1.5 outline-none font-medium shadow-sm"
                  >
                    <option value={0}>基本形 (Root Position)</option>
                    <option value={1}>第1展開形 (1st Inversion)</option>
                    <option value={2}>第2展開形 (2nd Inversion)</option>
                    <option value={3}>第3展開形 (3rd Inversion)</option>
                  </select>
                </div>

                {/* オンコード (ベース音) */}
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-slate-700">オンコード (分数ベース):</label>
                  <select
                    value={builderBass}
                    onChange={(e) => setBuilderBass(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg p-1.5 outline-none font-medium shadow-sm"
                  >
                    <option value="">なし (通常)</option>
                    {ROOT_NOTES.map((r) => (
                      <option key={r.name} value={r.name}>
                        /{r.name} (on {r.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 音長 */}
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-slate-700">音の長さ (Duration):</label>
                  <select
                    value={builderDuration}
                    onChange={(e) => setBuilderDuration(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg p-1.5 outline-none font-medium shadow-sm"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 2. ダイアトニック高速入力 タブ */}
          {activeTab === 'diatonic' && (
            <div className="space-y-4">
              {/* キー選択 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">キー (調) の選択:</label>
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                  {DIATONIC_KEYS.map((k, idx) => (
                    <button
                      key={k.name}
                      type="button"
                      onClick={() => setSelectedKeyIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                        selectedKeyIdx === idx
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 音長選択 */}
              <div className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">挿入時の音長:</span>
                <div className="flex items-center space-x-1">
                  {DURATION_OPTIONS.slice(0, 4).map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDiatonicDuration(d.value)}
                      className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
                        diatonicDuration === d.value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">
                  ボタンを押すと即座に挿入されます
                </span>
              </div>

              {/* ダイアトニックコードボタン一覧 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  ダイアトニックコード一覧（クリックで連続挿入）:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIATONIC_KEYS[selectedKeyIdx].chords.map((c) => {
                    const chordName = `${c.root}${c.type}`;
                    return (
                      <button
                        key={`${c.root}-${c.degree}`}
                        type="button"
                        onClick={() => handleInsertDiatonic(c.root, c.type)}
                        className="flex flex-col p-2 rounded-xl bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 active:scale-95 transition-all text-left group shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-slate-900 group-hover:text-blue-600">
                            {chordName}
                          </span>
                          <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-bold">
                            {c.degree}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 flex items-center justify-between">
                          <span>{c.func}</span>
                          <CornerDownLeft className="w-2.5 h-2.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. コード進行一括展開 タブ */}
          {activeTab === 'progression' && (
            <div className="space-y-3">
              {/* テキスト入力エリア */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>コード進行テキスト入力:</span>
                  <span className="text-[10px] text-slate-500">スペース区切りで入力</span>
                </label>
                <input
                  type="text"
                  value={progressionText}
                  onChange={(e) => setProgressionText(e.target.value)}
                  placeholder="例: C G Am F や Dm7 G7 Cmaj7"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-500 shadow-sm"
                />
              </div>

              {/* 1コードあたりの音長 */}
              <div className="flex items-center space-x-1.5 bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">音長:</span>
                <div className="flex items-center space-x-1 overflow-x-auto">
                  {DURATION_OPTIONS.slice(0, 4).map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setProgressionDuration(d.value)}
                      className={`px-2 py-0.5 text-xs rounded-md font-semibold transition-all whitespace-nowrap ${
                        progressionDuration === d.value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 定番プリセット */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">定番コード進行プリセット:</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRESET_PROGRESSIONS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setProgressionText(p.text)}
                      className="text-left p-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-xs transition-all flex flex-col shadow-sm"
                    >
                      <span className="font-bold text-slate-800 text-[11px]">{p.name}</span>
                      <span className="font-mono text-[10px] text-blue-600 mt-0.5">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 固定フッター（アクションボタン） */}
        {activeTab === 'builder' && (
          <div className="flex-shrink-0 flex items-center justify-between px-3.5 py-2 border-t border-slate-200 bg-slate-50 gap-2">
            {/* 生成プレビュー */}
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="text-[11px] text-slate-500 font-semibold">MML:</span>
              <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-blue-700 shadow-sm truncate max-w-[130px]">
                {generatedMml}
              </span>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center space-x-1.5 ml-auto">
              <button
                type="button"
                onClick={() => handlePreview()}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-blue-600 font-bold rounded-lg text-xs shadow-sm transition-all"
                title="選択中のコードを試聴"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>試聴</span>
              </button>

              <button
                type="button"
                onClick={handleInsertBuilder}
                className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold rounded-lg text-xs shadow-md transition-all whitespace-nowrap"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>挿入</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'diatonic' && (
          <div className="flex-shrink-0 flex items-center justify-between px-3.5 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
            <span>💡 各コードを押すと即座に挿入</span>
            <span className="font-semibold text-blue-600 font-mono">{DIATONIC_KEYS[selectedKeyIdx].name}</span>
          </div>
        )}

        {activeTab === 'progression' && (
          <div className="flex-shrink-0 flex items-center justify-end px-3.5 py-2 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={handleInsertProgression}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold rounded-lg text-xs shadow-md transition-all"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>進行をMML和音に変換して挿入</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
