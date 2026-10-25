import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { NoteIcon } from './NoteIcon';
import {
  computeCandidateZones,
  quantizeBeatsToZone,
  MetronomeIntervalBeats,
  MetronomeClickAccent,
  SemiRealtimeCandidate,
} from '../../utils/semiRealtimeQuantizer';

export interface LastQuantizedResult {
  mml: string;
  candidate: SemiRealtimeCandidate;
  elapsedBeats: number;
  elapsedSec: number;
  midiNote: number;
  prevOctave: number;
  canModify: boolean;
}

export interface SemiRealtimeMonitorProps {
  /** 現在鍵盤を押下して計測中か */
  isHolding: boolean;
  /** 現在押下中の経過拍数 (4分音符 = 1.0) */
  holdingBeats: number;
  /** 現在押下中の経過秒数 */
  holdingSec: number;
  /** 現在押下中のプレビューMML文字列 (例: "c4.") */
  previewMml: string;
  /** 有効化されている音符候補IDリスト */
  enabledCandidateIds: string[];
  /** メトロノームのクリック間隔拍数 (0 = OFF) */
  clickIntervalBeats: MetronomeIntervalBeats;
  /** 現在の有効BPM */
  effectiveBpm: number;
  /** 直近のメトロノームクリック発火情報 (LED発光演出用) */
  lastClickFlash: { timestamp: number; accent: MetronomeClickAccent } | null;
  /** 直前に確定・挿入された音符の結果 */
  lastResult: LastQuantizedResult | null;
  /** 直前に確定した音符の長さを指定候補へ直接変更するハンドラ (マウスクリック修正用) */
  onSelectLastCandidate?: (candidate: SemiRealtimeCandidate) => void;
  /** 直前に確定した音符の長さを1段階短く(-1) / 長く(+1) 変更するハンドラ (ボタン・上下キー修正用) */
  onStepLastCandidate?: (stepDelta: -1 | 1) => void;
}

/**
 * 半リアルタイム入力専用モニターコンポーネント
 * - 左側: クリック周期に完全同期して左右スイングするメトロノーム振り子SVG
 * - 中央: 現在判定中の音符、および入力直後の音符長を上下ボタンで即座に修正できるカード
 * - 右側: 押下中にバーが滑らかに伸び、入力直後はクリックで他の音長へ修正できるリアルタイムゲージ
 */
export const SemiRealtimeMonitor: React.FC<SemiRealtimeMonitorProps> = ({
  isHolding,
  holdingBeats,
  holdingSec,
  previewMml,
  enabledCandidateIds,
  clickIntervalBeats,
  effectiveBpm,
  lastClickFlash,
  lastResult,
  onSelectLastCandidate,
  onStepLastCandidate,
}) => {
  // 判定ゾーンレイアウトの計算
  const { zones, gaugeMaxBeats } = useMemo(
    () => computeCandidateZones(enabledCandidateIds),
    [enabledCandidateIds]
  );

  // 現在該当している音符ゾーン
  const activeZone = useMemo(
    () => quantizeBeatsToZone(holdingBeats, enabledCandidateIds),
    [holdingBeats, enabledCandidateIds]
  );

  // 振り子の角度算出:
  // 押下開始(0拍)で左端(-28°)、1クリック間隔ごとに右端(+28°)⇄左端(-28°)へ到達し、端に届く瞬間がクリック音と一致する設計
  const swingUnitBeats = clickIntervalBeats > 0 ? clickIntervalBeats : 1;
  const pendulumAngleDeg = isHolding
    ? -28 * Math.cos((Math.PI * holdingBeats) / swingUnitBeats)
    : 0;

  // クリック発火直後 (120ms以内) の発光判定
  const nowPerf = typeof performance !== 'undefined' ? performance.now() : 0;
  const isClickFlashing =
    isHolding &&
    clickIntervalBeats > 0 &&
    lastClickFlash !== null &&
    nowPerf - lastClickFlash.timestamp < 120;

  const flashAccent = lastClickFlash?.accent ?? 'quarter';

  // 押下中のリアルタイムゲージ進行率 (%)
  const holdingProgressPercent = isHolding
    ? Math.max(2, Math.min(100, (holdingBeats / gaugeMaxBeats) * 100))
    : 0;

  // 待機中（直前入力あり）の確定音符バー表示率 (%)
  const settledProgressPercent =
    !isHolding && lastResult
      ? Math.max(2, Math.min(100, (lastResult.candidate.beats / gaugeMaxBeats) * 100))
      : 0;

  // 待機中の実離鍵タイミングマーカー位置 (%)
  const rawReleasePercent =
    !isHolding && lastResult
      ? Math.max(0, Math.min(99.5, (lastResult.elapsedBeats / gaugeMaxBeats) * 100))
      : null;

  // 直前入力音符が有効候補リストの何番目にあるか (上下ステップボタンの活性制御用)
  const lastCandidateIndex = useMemo(() => {
    if (!lastResult) return -1;
    return zones.findIndex((z) => z.candidate.id === lastResult.candidate.id);
  }, [lastResult, zones]);

  const canModifyLast = Boolean(!isHolding && lastResult && lastResult.canModify);
  const canStepShorter = canModifyLast && lastCandidateIndex > 0;
  const canStepLonger =
    canModifyLast &&
    lastCandidateIndex >= 0 &&
    lastCandidateIndex < zones.length - 1;

  // LEDインジケーターの色
  let ledFill = '#cbd5e1';
  if (isClickFlashing) {
    if (flashAccent === 'accent') ledFill = '#f59e0b';
    else if (flashAccent === 'quarter') ledFill = '#10b981';
    else ledFill = '#3b82f6';
  } else if (isHolding) {
    ledFill = '#6ee7b7';
  }

  return (
    <div
      className="px-3 py-1.5 border-b border-slate-200 flex items-center gap-3 select-none"
      onWheel={(e) => {
        if (canModifyLast && onStepLastCandidate && Math.abs(e.deltaY) > 0) {
          e.preventDefault();
          onStepLastCandidate(e.deltaY < 0 ? 1 : -1);
        }
      }}
      style={{
        backgroundColor: '#f8fafc',
        opacity: 1,
        color: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 12px',
      }}
    >
      {/* 1. メトロノーム振り子ビジュアライザー (SVG) */}
      <div
        className={`flex items-center space-x-2 px-2 py-1 rounded-lg border flex-shrink-0 ${
          isHolding
            ? 'bg-white border-emerald-400 shadow-xs'
            : 'bg-white border-slate-300'
        }`}
        style={{
          backgroundColor: '#ffffff',
          opacity: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          borderRadius: '8px',
        }}
        title={
          clickIntervalBeats > 0
            ? `メトロノーム動作: ${effectiveBpm} BPM (振り子が左右の端に届くタイミングでクリック音が鳴ります)`
            : `視覚メトロノーム: ${effectiveBpm} BPM (クリック音ミュート中)`
        }
      >
        <svg
          width="54"
          height="46"
          viewBox="0 0 54 46"
          className="block flex-shrink-0"
          aria-label="メトロノーム振り子"
        >
          {/* メトロノーム台形ボディ */}
          <polygon
            points="16,6 38,6 46,43 8,43"
            fill={isHolding ? '#ecfdf5' : '#f1f5f9'}
            stroke={isClickFlashing ? '#10b981' : isHolding ? '#34d399' : '#94a3b8'}
            strokeWidth={isClickFlashing ? '2' : '1.5'}
            strokeLinejoin="round"
          />

          {/* スイング目盛りアーク */}
          <path
            d="M 11 16 A 26 26 0 0 1 43 16"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />

          {/* 左端・中央・右端のターゲットポイント */}
          <circle
            cx="12"
            cy="16.5"
            r="2"
            fill={isHolding && pendulumAngleDeg <= -24 ? '#10b981' : '#94a3b8'}
          />
          <circle cx="27" cy="12" r="1.5" fill="#cbd5e1" />
          <circle
            cx="42"
            cy="16.5"
            r="2"
            fill={isHolding && pendulumAngleDeg >= 24 ? '#10b981' : '#94a3b8'}
          />

          {/* 上部クリック発光LED */}
          <circle
            cx="27"
            cy="6"
            r={isClickFlashing ? '3.5' : '2.5'}
            fill={ledFill}
            stroke="#ffffff"
            strokeWidth="0.8"
          />

          {/* 振り子の針と重り (支点: x=27, y=39) */}
          <g transform={`rotate(${pendulumAngleDeg.toFixed(2)} 27 39)`}>
            {/* 針ロッド */}
            <line
              x1="27"
              y1="39"
              x2="27"
              y2="10"
              stroke={isHolding ? '#059669' : '#475569'}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* 可動式の重り (台形ウェイト) */}
            <polygon
              points="23.5,21 30.5,21 29.5,26 24.5,26"
              fill={isHolding ? '#10b981' : '#64748b'}
              stroke={isHolding ? '#047857' : '#334155'}
              strokeWidth="0.8"
            />
            {/* 針先のポイント */}
            <circle
              cx="27"
              cy="10"
              r="2"
              fill={isClickFlashing ? '#f59e0b' : isHolding ? '#059669' : '#475569'}
            />
          </g>

          {/* 支点キャップ */}
          <circle cx="27" cy="39" r="3" fill="#334155" />
        </svg>

        {/* BPM・動作ステータスミニ表示 */}
        <div
          className="hidden sm:flex flex-col justify-center leading-tight pr-0.5"
          style={{ marginLeft: '6px' }}
        >
          <span
            className={`text-[10px] font-extrabold ${
              isHolding ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {isHolding ? '● 計測中' : '⏸ 時間停止'}
          </span>
          <span className="text-xs font-mono font-bold text-slate-900">
            {effectiveBpm}
            <span className="text-[10px] font-sans font-semibold text-slate-500 ml-0.5">BPM</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            {clickIntervalBeats === 0
              ? '音OFF'
              : clickIntervalBeats === 2
              ? '2分音'
              : clickIntervalBeats === 1
              ? '4分音'
              : clickIntervalBeats === 0.5
              ? '8分音'
              : '16分音'}
          </span>
        </div>
      </div>

      {/* 2. 現在判定音符 / 直前確定音符＆ワンタッチ修正カード */}
      <div
        className={`flex-shrink-0 px-2.5 py-1 rounded-lg border flex flex-col justify-center ${
          isHolding
            ? 'border-emerald-500 ring-2 ring-emerald-200'
            : canModifyLast
            ? 'border-blue-400 ring-1 ring-blue-100'
            : 'border-slate-300'
        }`}
        style={{
          backgroundColor: isHolding ? '#ecfdf5' : '#ffffff',
          opacity: 1,
          width: '235px',
          minHeight: '48px',
          padding: '4px 10px',
          borderRadius: '8px',
        }}
      >
        {isHolding ? (
          <>
            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800">
              <span>今離すと確定:</span>
              <span className="font-mono text-emerald-900">
                {holdingBeats.toFixed(2)}拍 ({holdingSec.toFixed(2)}s)
              </span>
            </div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <NoteIcon
                duration={activeZone.candidate.duration}
                isDotted={activeZone.candidate.isDotted}
                size={20}
                className="text-emerald-700 flex-shrink-0"
              />
              <span className="text-xs font-black text-slate-900 truncate">
                {activeZone.candidate.label}
              </span>
              <span
                className="ml-auto text-xs font-mono font-extrabold px-1.5 py-0.2 rounded border border-emerald-400 text-emerald-950"
                style={{ backgroundColor: '#ffffff' }}
              >
                {previewMml}
              </span>
            </div>
          </>
        ) : lastResult ? (
          <>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
              <span className={canModifyLast ? 'text-blue-700 font-extrabold' : 'text-slate-500'}>
                {canModifyLast ? '✏️ 直前音符 (↑↓で修正可):' : '直前の確定音符:'}
              </span>
              <span className="font-mono text-slate-500">
                {lastResult.elapsedBeats.toFixed(2)}拍
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5 gap-1">
              {/* 1段階短くするボタン */}
              {canModifyLast && (
                <button
                  type="button"
                  disabled={!canStepShorter}
                  onClick={() => onStepLastCandidate?.(-1)}
                  className="p-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-400 text-slate-700 hover:text-blue-700 disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  style={{ width: '22px', height: '22px', backgroundColor: '#f8fafc' }}
                  title="直前の音符を1段階短い音符へ変更 (キー: ↓ または ←)"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="flex items-center space-x-1 min-w-0 flex-1">
                <NoteIcon
                  duration={lastResult.candidate.duration}
                  isDotted={lastResult.candidate.isDotted}
                  size={18}
                  className="text-blue-600 flex-shrink-0"
                />
                <span className="text-xs font-extrabold text-slate-900 truncate">
                  {lastResult.candidate.label}
                </span>
              </div>

              <span
                className="text-xs font-mono font-extrabold px-1.5 py-0.2 rounded border border-blue-300 text-blue-950 flex-shrink-0"
                style={{ backgroundColor: '#eff6ff' }}
              >
                {lastResult.mml}
              </span>

              {/* 1段階長くするボタン */}
              {canModifyLast && (
                <button
                  type="button"
                  disabled={!canStepLonger}
                  onClick={() => onStepLastCandidate?.(1)}
                  className="p-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-400 text-slate-700 hover:text-blue-700 disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  style={{ width: '22px', height: '22px', backgroundColor: '#f8fafc' }}
                  title="直前の音符を1段階長い音符へ変更 (キー: ↑ または →)"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] font-bold text-slate-500">半リアルタイム待機中</div>
            <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate">
              鍵盤を押す長さで音長を自動選択
            </div>
          </>
        )}
      </div>

      {/* 3. リアルタイム音符ゾーンゲージ (押下中バー伸縮アニメーション + クリックで直前音符修正) */}
      <div
        className="flex-1 flex flex-col justify-center"
        style={{ flex: 1, minWidth: '220px' }}
      >
        {/* 上段: 各有効音符のジャスト位置目盛りラベル (クリックで直前音符をその長さへ変更可能) */}
        <div
          className="relative w-full"
          style={{ position: 'relative', height: '22px', width: '100%', marginBottom: '2px' }}
        >
          {zones.map((zone) => {
            const centerPercent = (zone.candidate.beats / gaugeMaxBeats) * 100;
            const isZoneActive = isHolding && activeZone.candidate.id === zone.candidate.id;
            const isLastMatched =
              !isHolding && lastResult?.candidate.id === zone.candidate.id;

            return (
              <button
                key={zone.candidate.id}
                type="button"
                disabled={!canModifyLast}
                onClick={() => {
                  if (canModifyLast && onSelectLastCandidate) {
                    onSelectLastCandidate(zone.candidate);
                  }
                }}
                className={`flex items-center space-x-0.5 whitespace-nowrap rounded px-1 py-0.5 transition-colors ${
                  canModifyLast ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'
                }`}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: `${centerPercent}%`,
                  transform: 'translateX(-50%)',
                  backgroundColor: isZoneActive
                    ? '#059669'
                    : isLastMatched
                    ? '#dbeafe'
                    : 'transparent',
                  border: isLastMatched ? '1px solid #60a5fa' : '1px solid transparent',
                }}
                title={
                  canModifyLast
                    ? `クリックして直前の音符を「${zone.candidate.label} (${zone.candidate.mmlSuffix})」に変更`
                    : `${zone.candidate.label} (基準: ${zone.candidate.beats}拍 / 判定範囲: ${zone.minBeats.toFixed(
                        2
                      )}〜${
                        Number.isFinite(zone.maxBeats) ? `${zone.maxBeats.toFixed(2)}拍` : '上限なし'
                      })`
                }
              >
                <NoteIcon
                  duration={zone.candidate.duration}
                  isDotted={zone.candidate.isDotted}
                  size={12}
                  className={
                    isZoneActive
                      ? 'text-white'
                      : isLastMatched
                      ? 'text-blue-700'
                      : 'text-slate-600'
                  }
                />
                <span
                  className="text-[10px] font-mono leading-none font-bold"
                  style={{
                    color: isZoneActive
                      ? '#ffffff'
                      : isLastMatched
                      ? '#1e40af'
                      : '#334155',
                  }}
                >
                  {zone.candidate.gaugeLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* 下段: ゾーン区切り付きゲージトラック (高さ26pxをインラインスタイルで完全保証) */}
        <div
          className="relative w-full rounded-lg border border-slate-300 overflow-hidden"
          style={{
            position: 'relative',
            height: '26px',
            width: '100%',
            backgroundColor: '#e2e8f0',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            overflow: 'hidden',
            opacity: 1,
          }}
        >
          {/* 1. 各音符候補の判定ゾーン背景 (直前音符修正可能時はゾーンクリックでも変更可能) */}
          {zones.map((zone, idx) => {
            const leftPct = (zone.minBeats / gaugeMaxBeats) * 100;
            const widthPct = ((zone.visualMaxBeats - zone.minBeats) / gaugeMaxBeats) * 100;
            const isZoneActive = isHolding && activeZone.candidate.id === zone.candidate.id;
            const isLastMatched =
              !isHolding && lastResult?.candidate.id === zone.candidate.id;

            return (
              <div
                key={zone.candidate.id}
                onClick={() => {
                  if (canModifyLast && onSelectLastCandidate) {
                    onSelectLastCandidate(zone.candidate);
                  }
                }}
                className={canModifyLast ? 'cursor-pointer' : ''}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: isZoneActive
                    ? '#d1fae5'
                    : isLastMatched
                    ? '#eff6ff'
                    : idx % 2 === 0
                    ? '#ffffff'
                    : '#f1f5f9',
                }}
                title={
                  canModifyLast
                    ? `クリックして直前の音符を「${zone.candidate.label}」に変更`
                    : `${zone.candidate.label}ゾーン (${zone.minBeats.toFixed(2)}〜${
                        Number.isFinite(zone.maxBeats) ? `${zone.maxBeats.toFixed(2)}拍` : '最大'
                      })`
                }
              />
            );
          })}

          {/* 2A. 押下中のリアルタイム伸縮プログレスバー (エメラルドグラデーション) */}
          {isHolding && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: '2px',
                bottom: '2px',
                left: 0,
                width: `${holdingProgressPercent}%`,
                background: 'linear-gradient(90deg, #34d399 0%, #10b981 65%, #059669 100%)',
                borderRadius: '0 4px 4px 0',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.45)',
                opacity: 1,
              }}
            />
          )}

          {/* 2B. 離鍵直後の確定音符長バー (ブルーグラデーション・音長修正時に連動伸縮) */}
          {!isHolding && lastResult && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: '4px',
                bottom: '4px',
                left: 0,
                width: `${settledProgressPercent}%`,
                background: 'linear-gradient(90deg, #93c5fd 0%, #3b82f6 100%)',
                borderRadius: '0 4px 4px 0',
                opacity: 1,
              }}
            />
          )}

          {/* 3. ゾーン境界の破線 */}
          {zones.map((zone, idx) => {
            if (idx === zones.length - 1) return null;
            const boundaryPct = (zone.visualMaxBeats / gaugeMaxBeats) * 100;
            return (
              <div
                key={`bound-${zone.candidate.id}`}
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${boundaryPct}%`,
                  borderRight: '1px dashed #94a3b8',
                }}
              />
            );
          })}

          {/* 4. 各有効音符のジャスト中心位置ティック線 */}
          {zones.map((zone) => {
            const centerPercent = (zone.candidate.beats / gaugeMaxBeats) * 100;
            const isZoneActive = isHolding && activeZone.candidate.id === zone.candidate.id;
            const isLastMatched =
              !isHolding && lastResult?.candidate.id === zone.candidate.id;
            return (
              <div
                key={`tick-${zone.candidate.id}`}
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${centerPercent}%`,
                  width: isZoneActive || isLastMatched ? '2px' : '1px',
                  transform: 'translateX(-50%)',
                  backgroundColor: isZoneActive
                    ? '#065f46'
                    : isLastMatched
                    ? '#1d4ed8'
                    : '#64748b',
                }}
              />
            );
          })}

          {/* 5. 押下中の現在地ヘッドカーソル */}
          {isHolding && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${holdingProgressPercent}%`,
                width: '4px',
                transform: 'translateX(-50%)',
                backgroundColor: '#064e3b',
                borderRadius: '2px',
              }}
            />
          )}

          {/* 6. 待機中の実離鍵タイミングマーカー (オレンジの細いインジケーター) */}
          {rawReleasePercent !== null && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${rawReleasePercent}%`,
                width: '2px',
                transform: 'translateX(-50%)',
                backgroundColor: '#f59e0b',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
