import React, { useState, useEffect } from 'react';
import { BookOpen, Music, Columns2, Rows2, Music2, Loader2, CheckCircle2 } from 'lucide-react';
import { soundFontManager, SoundFontState } from '../../core/audio/soundFontManager';

export type LayoutOrientation = 'horizontal' | 'vertical';

interface HeaderProps {
  onOpenGuide: () => void;
  onOpenSoundFontModal: () => void;
  layoutOrientation: LayoutOrientation;
  onChangeLayout: (layout: LayoutOrientation) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenGuide,
  onOpenSoundFontModal,
  layoutOrientation,
  onChangeLayout,
}) => {
  const [sfState, setSfState] = useState<SoundFontState>(soundFontManager.getState());

  useEffect(() => {
    return soundFontManager.subscribe((state) => {
      setSfState(state);
    });
  }, []);

  return (
    <header className="no-print flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-white">
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg shadow-md shadow-blue-500/20">
          <Music className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            MIDI Composer
          </h1>
          <p className="text-[10px] text-slate-400 -mt-0.5">
            MML Text to MIDI / MP3 / Sheet Music
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* SoundFont 音源設定・ステータスインジケーター */}
        <button
          onClick={onOpenSoundFontModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-lg transition-all shadow-sm"
          title="SoundFont (MIDI音源) の管理・変更"
        >
          <Music2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline text-slate-400">音源:</span>
          <span className="max-w-[120px] truncate text-slate-200">
            {sfState.currentSoundFont?.name.replace(/ \(.*\)/, '') || 'TimGM6mb'}
          </span>
          {sfState.status === 'ready' ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-950" title="SoundFont 準備完了" />
          ) : sfState.status === 'loading' ? (
            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" title="簡易音源フォールバック" />
          )}
        </button>

        {/* 画面分割方向の切り替え (左右分割 / 上下分割) */}
        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onChangeLayout('horizontal')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
              layoutOrientation === 'horizontal'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title="エディタと楽譜を左右に並べて表示"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">左右分割</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeLayout('vertical')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
              layoutOrientation === 'vertical'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title="エディタと楽譜を上下に並べて表示"
          >
            <Rows2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">上下分割</span>
          </button>
        </div>

        {/* MML記法ガイドモーダルボタン: 白背景・不透明・黒文字 */}
        <button
          onClick={onOpenGuide}
          className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-md transition-all shadow-sm"
          style={{ backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 }}
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>MML 記法ガイド</span>
        </button>
      </div>
    </header>
  );
};


