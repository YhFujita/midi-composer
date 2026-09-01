import React from 'react';
import { BookOpen, Music, HelpCircle } from 'lucide-react';

interface HeaderProps {
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenGuide }) => {
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

      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenGuide}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>MML 記法ガイド</span>
        </button>
      </div>
    </header>
  );
};
