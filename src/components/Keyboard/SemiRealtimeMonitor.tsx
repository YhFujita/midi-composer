import React, { useMemo } from 'react';
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
}

/**
 * 半リアルタイム入力専用モニターコンポーネント
 * - 左側: クリック周期に完全同期して左右スイングするメトロノーム振り子SVG
 * - 中央: 現在判定中の音符（または直前確定した音符）のリアルタイム表示カード
 * - 右側: 事前設定した音符候補の判定ゾーン・ジャスト位置・現在経過拍数を示すリアルタイムゲージ
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

  // ゲージ進行率 (%)
  const progressPercent = isHolding
    ? Math.max(0, Math.min(100, (holdingBeats / gaugeMaxBeats) * 100))
    : 0;

  // 直前入力位置のゴーストマーカー位置 (%)
  const ghostPercent =
    !isHolding && lastResult
      ? Math.max(0, Math.min(99.5, (lastResult.elapsedBeats / gaugeMaxBeats) * 100))
      : null;

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
      style={{ backgroundColor: '#f8fafc', opacity: 1, color: '#0f172a' }}
    >
      {/* 1. メトロノーム振り子ビジュアライザー (SVG) */}
      <div
        className={`flex items-center space-x-2 px-2 py-1 rounded-lg border flex-shrink-0 ${
          isHolding
            ? 'bg-white border-emerald-400 shadow-xs'
            : 'bg-white border-slate-300'
        }`}
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
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
        <div className="hidden sm:flex flex-col justify-center leading-tight pr-0.5">
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

      {/* 2. 現在判定音符 / 直前確定音符カード (幅を固定してゲージの揺れを防止) */}
      <div
        className={`w-48 sm:w-52 flex-shrink-0 px-2.5 py-1 rounded-lg border flex flex-col justify-center ${
          isHolding
            ? 'border-emerald-500 ring-2 ring-emerald-200'
            : 'border-slate-300'
        }`}
        style={{
          backgroundColor: isHolding ? '#ecfdf5' : '#ffffff',
          opacity: 1,
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
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>直前の確定音符:</span>
              <span className="font-mono text-slate-600">
                {lastResult.elapsedBeats.toFixed(2)}拍
              </span>
            </div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <NoteIcon
                duration={lastResult.candidate.duration}
                isDotted={lastResult.candidate.isDotted}
                size={18}
                className="text-blue-600 flex-shrink-0"
              />
              <span className="text-xs font-bold text-slate-800 truncate">
                {lastResult.candidate.label}
              </span>
              <span
                className="ml-auto text-xs font-mono font-bold px-1.5 py-0.2 rounded border border-slate-300 text-slate-900"
                style={{ backgroundColor: '#f1f5f9' }}
              >
                {lastResult.mml}
              </span>
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

      {/* 3. リアルタイム音符ゾーンゲージ */}
      <div className="flex-1 min-w-[200px] flex flex-col justify-center">
        {/* 上段: 各有効音符のジャスト位置目盛りラベル */}
        <div className="relative h-5 w-full mb-0.5">
          {zones.map((zone) => {
            const centerPercent = (zone.candidate.beats / gaugeMaxBeats) * 100;
            const isZoneActive = isHolding && activeZone.candidate.id === zone.candidate.id;
            const isLastMatched =
              !isHolding && lastResult?.candidate.id === zone.candidate.id;

            return (
              <div
                key={zone.candidate.id}
                className="absolute bottom-0 flex items-center space-x-0.5 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${centerPercent}%` }}
                title={`${zone.candidate.label} (基準: ${zone.candidate.beats}拍 / 判定範囲: ${zone.minBeats.toFixed(
                  2
                )}〜${
                  Number.isFinite(zone.maxBeats) ? `${zone.maxBeats.toFixed(2)}拍` : '上限なし'
                })`}
              >
                <NoteIcon
                  duration={zone.candidate.duration}
                  isDotted={zone.candidate.isDotted}
                  size={12}
                  className={
                    isZoneActive
                      ? 'text-emerald-700'
                      : isLastMatched
                      ? 'text-blue-600'
                      : 'text-slate-500'
                  }
                />
                <span
                  className={`text-[10px] font-mono leading-none px-0.5 py-0.5 rounded ${
                    isZoneActive
                      ? 'bg-emerald-600 text-white font-black shadow-2xs'
                      : isLastMatched
                      ? 'bg-blue-100 text-blue-800 font-bold border border-blue-300'
                      : 'text-slate-700 font-bold'
                  }`}
                >
                  {zone.candidate.gaugeLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* 下段: ゾーン区切り付きゲージトラック */}
        <div
          className="relative h-6 w-full rounded-lg border border-slate-300 overflow-hidden shadow-inner"
          style={{ backgroundColor: '#e2e8f0', opacity: 1 }}
        >
          {/* 1. 各音符候補の判定ゾーン背景 */}
          {zones.map((zone, idx) => {
            const leftPct = (zone.minBeats / gaugeMaxBeats) * 100;
            const widthPct = ((zone.visualMaxBeats - zone.minBeats) / gaugeMaxBeats) * 100;
            const isZoneActive = isHolding && activeZone.candidate.id === zone.candidate.id;

            return (
              <div
                key={zone.candidate.id}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: isZoneActive
                    ? '#ecfdf5'
                    : idx % 2 === 0
                    ? '#ffffff'
                    : '#f1f5f9',
                }}
              />
            );
          })}

          {/* 2. リアルタイム伸縮プログレスバー (60fps追従のためCSSトランジションは付けない・完全不透明) */}
          {isHolding && (
            <div
              className="absolute top-1 bottom-1 left-0 rounded-r-sm pointer-events-none"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #6ee7b7 0%, #34d399 65%, #10b981 100%)',
                opacity: 1,
              }}
            />
          )}

          {/* 3. ゾーン境界の破線 (プログレスバーの上からくっきり見えるよう描画) */}
          {zones.map((zone, idx) => {
            if (idx === zones.length - 1) return null;
            const boundaryPct = (zone.visualMaxBeats / gaugeMaxBeats) * 100;
            return (
              <div
                key={`bound-${zone.candidate.id}`}
                className="absolute top-0 bottom-0 border-r border-dashed border-slate-400 pointer-events-none"
                style={{ left: `${boundaryPct}%` }}
              />
            );
          })}

          {/* 4. 各有効音符のジャスト中心位置ティック線 */}
          {zones.map((zone) => {
            const centerPercent = (zone.candidate.beats / gaugeMaxBeats) * 100;
            const isZoneActive = isHolding && activeZone.candidate.id === zone.candidate.id;
            return (
              <div
                key={`tick-${zone.candidate.id}`}
                className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 pointer-events-none"
                style={{
                  left: `${centerPercent}%`,
                  backgroundColor: isZoneActive ? '#047857' : '#94a3b8',
                }}
              />
            );
          })}

          {/* 押下中の現在地ヘッドカーソル */}
          {isHolding && (
            <div
              className="absolute top-0 bottom-0 w-1 -translate-x-1/2 pointer-events-none shadow-sm"
              style={{
                left: `${progressPercent}%`,
                backgroundColor: '#064e3b',
              }}
            />
          )}

          {/* 待機中の直前確定位置ゴーストマーカー */}
          {ghostPercent !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 pointer-events-none"
              style={{
                left: `${ghostPercent}%`,
                backgroundColor: '#2563eb',
              }}
              title={
                lastResult
                  ? `直前の離鍵タイミング: ${lastResult.elapsedBeats.toFixed(2)}拍 (${lastResult.mml})`
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
