import React, { useRef, useMemo, useCallback } from 'react';

export interface SvgPianoKeyboardProps {
  startOctave?: number; // 開始オクターブ (例: 3 -> C3から開始)
  octaveCount?: number; // 表示オクターブ数 (例: 3 -> C3〜B5 + 高音C = 37鍵)
  activeNotes?: number[]; // 現在押されている/発音中のMIDIノート番号
  onNoteDown: (midiNote: number) => void; // 鍵盤押下時ハンドラ
  onNoteUp?: (midiNote: number) => void; // 鍵盤離脱時ハンドラ
  showLabels?: boolean; // 音名ラベルの表示有無
  whiteKeyWidth?: number; // 白鍵の幅 (px)
  whiteKeyHeight?: number; // 白鍵の高さ (px)
  className?: string;
}

interface WhiteKeyInfo {
  midiNote: number;
  pitchName: string;
  octave: number;
  x: number;
  isC: boolean;
}

interface BlackKeyInfo {
  midiNote: number;
  pitchName: string;
  octave: number;
  x: number;
}

const WHITE_NOTE_OFFSETS = [
  { step: 0, name: 'C', isC: true },
  { step: 2, name: 'D', isC: false },
  { step: 4, name: 'E', isC: false },
  { step: 5, name: 'F', isC: false },
  { step: 7, name: 'G', isC: false },
  { step: 9, name: 'A', isC: false },
  { step: 11, name: 'B', isC: false },
];

export const SvgPianoKeyboard: React.FC<SvgPianoKeyboardProps> = ({
  startOctave = 3,
  octaveCount = 3,
  activeNotes = [],
  onNoteDown,
  onNoteUp,
  showLabels = true,
  whiteKeyWidth = 32,
  whiteKeyHeight = 125,
  className = '',
}) => {
  const isPointerDownRef = useRef(false);
  const currentHoveredNoteRef = useRef<number | null>(null);

  const blackKeyWidth = Math.round(whiteKeyWidth * 0.62);
  const blackKeyHeight = Math.round(whiteKeyHeight * 0.64);

  // 鍵盤情報の事前計算 (メモ化)
  const { whiteKeys, blackKeys, totalWidth } = useMemo(() => {
    const whites: WhiteKeyInfo[] = [];
    const blacks: BlackKeyInfo[] = [];

    let currentWhiteX = 0;

    for (let octIdx = 0; octIdx < octaveCount; octIdx++) {
      const currentOctave = startOctave + octIdx;
      const octaveBaseMidi = (currentOctave + 1) * 12; // C-1 = 0, C4 = 60

      // 白鍵 7本
      for (let wIdx = 0; wIdx < WHITE_NOTE_OFFSETS.length; wIdx++) {
        const item = WHITE_NOTE_OFFSETS[wIdx];
        whites.push({
          midiNote: octaveBaseMidi + item.step,
          pitchName: `${item.name}${currentOctave}`,
          octave: currentOctave,
          x: currentWhiteX,
          isC: item.isC,
        });
        currentWhiteX += whiteKeyWidth;
      }

      // 黒鍵 5本 (白鍵の相対位置に基づいて正確に配置)
      const octStartX = octIdx * 7 * whiteKeyWidth;

      // C# (CとDの間)
      blacks.push({
        midiNote: octaveBaseMidi + 1,
        pitchName: `C#${currentOctave}`,
        octave: currentOctave,
        x: octStartX + 1 * whiteKeyWidth - blackKeyWidth * 0.6,
      });

      // D# (DとEの間)
      blacks.push({
        midiNote: octaveBaseMidi + 3,
        pitchName: `D#${currentOctave}`,
        octave: currentOctave,
        x: octStartX + 2 * whiteKeyWidth - blackKeyWidth * 0.4,
      });

      // F# (FとGの間)
      blacks.push({
        midiNote: octaveBaseMidi + 6,
        pitchName: `F#${currentOctave}`,
        octave: currentOctave,
        x: octStartX + 4 * whiteKeyWidth - blackKeyWidth * 0.65,
      });

      // G# (GとAの間)
      blacks.push({
        midiNote: octaveBaseMidi + 8,
        pitchName: `G#${currentOctave}`,
        octave: currentOctave,
        x: octStartX + 5 * whiteKeyWidth - blackKeyWidth * 0.5,
      });

      // A# (AとBの間)
      blacks.push({
        midiNote: octaveBaseMidi + 10,
        pitchName: `A#${currentOctave}`,
        octave: currentOctave,
        x: octStartX + 6 * whiteKeyWidth - blackKeyWidth * 0.35,
      });
    }

    // 最後に高音端の「C」の白鍵を1本追加（ピアノの自然な端点）
    const endOctave = startOctave + octaveCount;
    whites.push({
      midiNote: (endOctave + 1) * 12,
      pitchName: `C${endOctave}`,
      octave: endOctave,
      x: currentWhiteX,
      isC: true,
    });
    currentWhiteX += whiteKeyWidth;

    return {
      whiteKeys: whites,
      blackKeys: blacks,
      totalWidth: currentWhiteX,
    };
  }, [startOctave, octaveCount, whiteKeyWidth, blackKeyWidth]);

  // アクティブ判定用の Set
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);

  // 鍵盤押下ハンドラ
  const handleKeyPointerDown = useCallback(
    (midiNote: number, e: React.PointerEvent) => {
      e.preventDefault();
      isPointerDownRef.current = true;
      currentHoveredNoteRef.current = midiNote;
      onNoteDown(midiNote);
    },
    [onNoteDown]
  );

  // 鍵盤進入ハンドラ (ドラッグしながらグリッサンド演奏)
  const handleKeyPointerEnter = useCallback(
    (midiNote: number) => {
      if (isPointerDownRef.current && currentHoveredNoteRef.current !== midiNote) {
        if (currentHoveredNoteRef.current !== null && onNoteUp) {
          onNoteUp(currentHoveredNoteRef.current);
        }
        currentHoveredNoteRef.current = midiNote;
        onNoteDown(midiNote);
      }
    },
    [onNoteDown, onNoteUp]
  );

  // 鍵盤離脱ハンドラ
  const handleKeyPointerLeave = useCallback(
    (midiNote: number) => {
      if (isPointerDownRef.current && currentHoveredNoteRef.current === midiNote) {
        if (onNoteUp) {
          onNoteUp(midiNote);
        }
        currentHoveredNoteRef.current = null;
      }
    },
    [onNoteUp]
  );

  // ポインターアップ (全体)
  const handlePointerUp = useCallback(() => {
    if (isPointerDownRef.current) {
      if (currentHoveredNoteRef.current !== null && onNoteUp) {
        onNoteUp(currentHoveredNoteRef.current);
      }
      isPointerDownRef.current = false;
      currentHoveredNoteRef.current = null;
    }
  }, [onNoteUp]);

  return (
    <div
      className={`select-none overflow-x-auto touch-none pb-1 ${className}`}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <svg
        width={totalWidth}
        height={whiteKeyHeight + 2}
        viewBox={`0 0 ${totalWidth} ${whiteKeyHeight + 2}`}
        className="block drop-shadow-md cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        <defs>
          {/* 白鍵通常グラデーション */}
          <linearGradient id="svg-white-key-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="88%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          {/* 白鍵押下時アクティブグラデーション */}
          <linearGradient id="svg-white-key-active-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="70%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>

          {/* 黒鍵通常グラデーション */}
          <linearGradient id="svg-black-key-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="15%" stopColor="#1e293b" />
            <stop offset="85%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* 黒鍵押下時アクティブグラデーション */}
          <linearGradient id="svg-black-key-active-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          {/* 黒鍵シャドウフィルタ */}
          <filter id="svg-black-key-shadow" x="-15%" y="-5%" width="130%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 1. 先に全白鍵を描画 */}
        <g id="white-keys">
          {whiteKeys.map((key) => {
            const isActive = activeSet.has(key.midiNote);
            return (
              <g
                key={key.midiNote}
                onPointerDown={(e) => handleKeyPointerDown(key.midiNote, e)}
                onPointerEnter={() => handleKeyPointerEnter(key.midiNote)}
                onPointerLeave={() => handleKeyPointerLeave(key.midiNote)}
                className="transition-colors duration-75"
              >
                {/* 白鍵本体 */}
                <rect
                  x={key.x}
                  y={0.5}
                  width={whiteKeyWidth - 1}
                  height={whiteKeyHeight}
                  rx={3}
                  ry={3}
                  fill={isActive ? 'url(#svg-white-key-active-grad)' : 'url(#svg-white-key-grad)'}
                  stroke={isActive ? '#3b82f6' : '#cbd5e1'}
                  strokeWidth={isActive ? 1.5 : 1}
                />

                {/* 白鍵下部の立体ハイライト線 */}
                <line
                  x1={key.x + 2}
                  y1={whiteKeyHeight - 2}
                  x2={key.x + whiteKeyWidth - 3}
                  y2={whiteKeyHeight - 2}
                  stroke={isActive ? '#2563eb' : '#94a3b8'}
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                {/* 音名ラベル */}
                {showLabels && (
                  <text
                    x={key.x + (whiteKeyWidth - 1) / 2}
                    y={whiteKeyHeight - 8}
                    textAnchor="middle"
                    fontSize={key.isC ? 11 : 9}
                    fontWeight={key.isC ? 'bold' : '600'}
                    fill={key.isC ? (isActive ? '#1e3a8a' : '#2563eb') : isActive ? '#1e40af' : '#64748b'}
                    pointerEvents="none"
                    fontFamily="monospace"
                  >
                    {key.pitchName}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* 2. 白鍵の上に黒鍵を描画 */}
        <g id="black-keys">
          {blackKeys.map((key) => {
            const isActive = activeSet.has(key.midiNote);
            return (
              <g
                key={key.midiNote}
                onPointerDown={(e) => handleKeyPointerDown(key.midiNote, e)}
                onPointerEnter={() => handleKeyPointerEnter(key.midiNote)}
                onPointerLeave={() => handleKeyPointerLeave(key.midiNote)}
                className="transition-colors duration-75"
              >
                {/* 黒鍵本体 */}
                <rect
                  x={key.x}
                  y={0.5}
                  width={blackKeyWidth}
                  height={blackKeyHeight}
                  rx={2.5}
                  ry={2.5}
                  fill={isActive ? 'url(#svg-black-key-active-grad)' : 'url(#svg-black-key-grad)'}
                  stroke={isActive ? '#60a5fa' : '#020617'}
                  strokeWidth={isActive ? 1.5 : 1}
                  filter="url(#svg-black-key-shadow)"
                />

                {/* 黒鍵上面のハイライトリフレクション */}
                <rect
                  x={key.x + 2}
                  y={2}
                  width={blackKeyWidth - 4}
                  height={Math.round(blackKeyHeight * 0.7)}
                  rx={1.5}
                  ry={1.5}
                  fill={isActive ? '#93c5fd' : '#475569'}
                  opacity={isActive ? 0.4 : 0.25}
                  pointerEvents="none"
                />

                {/* 黒鍵の音名ラベル */}
                {showLabels && (
                  <text
                    x={key.x + blackKeyWidth / 2}
                    y={blackKeyHeight - 6}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight="600"
                    fill={isActive ? '#ffffff' : '#94a3b8'}
                    pointerEvents="none"
                    fontFamily="monospace"
                  >
                    #
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
