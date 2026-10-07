import React from 'react';

export interface NoteIconProps {
  duration: string; // '1' | '2' | '4' | '8' | '16' など
  isDotted?: boolean;
  className?: string;
  size?: number;
}

/**
 * 音符の長さ（全音符、2分音符、4分音符、8分音符、16分音符）および付点を
 * 視認性の高いベクターSVGで美しく描画するアイコンコンポーネント
 */
export const NoteIcon: React.FC<NoteIconProps> = ({
  duration,
  isDotted = false,
  className = '',
  size = 18,
}) => {
  const dur = String(duration);
  const isWhole = dur === '1';
  const isHalf = dur === '2';
  const isEighth = dur === '8';
  const isSixteenth = dur === '16';
  // 4分音符は isWhole, isHalf, isEighth, isSixteenth のいずれでもない場合のデフォルト

  // 全音符 (符頭のみの中空楕円)
  if (isWhole) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block flex-shrink-0 ${className}`}
        aria-hidden="true"
      >
        <ellipse
          cx={isDotted ? 9 : 12}
          cy="12"
          rx="6"
          ry="3.8"
          transform={`rotate(-25 ${isDotted ? 9 : 12} 12)`}
          stroke="currentColor"
          strokeWidth="2.4"
          fill="none"
        />
        {isDotted && <circle cx="18" cy="12" r="2" fill="#f59e0b" />}
      </svg>
    );
  }

  // 2分音符 (中空符頭 + ステム)
  if (isHalf) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block flex-shrink-0 ${className}`}
        aria-hidden="true"
      >
        {/* 中空符頭 */}
        <ellipse
          cx="7.5"
          cy="16"
          rx="4.2"
          ry="2.8"
          transform="rotate(-25 7.5 16)"
          stroke="currentColor"
          strokeWidth="2.2"
          fill="none"
        />
        {/* ステム */}
        <line x1="11.2" y1="15.5" x2="11.2" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* 付点 */}
        {isDotted && <circle cx="17.5" cy="15.5" r="2" fill="#f59e0b" />}
      </svg>
    );
  }

  // 4分音符 / 8分音符 / 16分音符 (塗りつぶし符頭 + ステム + 旗)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* 塗りつぶし符頭 */}
      <ellipse
        cx="7.5"
        cy="16"
        rx="4.2"
        ry="2.8"
        transform="rotate(-25 7.5 16)"
        fill="currentColor"
      />
      {/* ステム */}
      <line x1="11.2" y1="15.5" x2="11.2" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      {/* 8分音符の旗 */}
      {isEighth && (
        <path
          d="M 11.2 4.5 C 14.5 6, 16.5 9, 16 12.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* 16分音符の旗 (2本) */}
      {isSixteenth && (
        <>
          <path
            d="M 11.2 4.5 C 14.5 6, 16.5 8.5, 16 11.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 11.2 8.5 C 14.5 10, 16.5 12.5, 16 15.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}

      {/* 付点 */}
      {isDotted && <circle cx="17.5" cy="15.5" r="2" fill="#f59e0b" />}
    </svg>
  );
};
