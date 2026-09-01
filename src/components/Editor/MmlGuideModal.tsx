import React from 'react';
import { X, BookOpen, Music, Play, Layers } from 'lucide-react';

interface MmlGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MmlGuideModal: React.FC<MmlGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-slate-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">MML (サクラ風) 記法クイックリファレンス</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm">
          {/* 基本音符 */}
          <div>
            <h3 className="text-sm font-semibold text-blue-400 flex items-center mb-2">
              <Music className="w-4 h-4 mr-1.5" /> 1. 音符・休符
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-emerald-400 font-mono font-bold">c d e f g a b</code>
                <p className="text-slate-300 mt-1">ド・レ・ミ・ファ・ソ・ラ・シ の音符</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-emerald-400 font-mono font-bold">c+ / c# / d- / d_</code>
                <p className="text-slate-300 mt-1">シャープ (半音上げ) / フラット (半音下げ)</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-emerald-400 font-mono font-bold">c4 / c8 / c16 / c2 / c1</code>
                <p className="text-slate-300 mt-1">音長指定 (4分音符、8分音符、全音符 等)</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-emerald-400 font-mono font-bold">r4 / r8 / c4.</code>
                <p className="text-slate-300 mt-1">休符 (r4) / 付点音符 (c4.)</p>
              </div>
            </div>
          </div>

          {/* オクターブ・音量・テンポ */}
          <div>
            <h3 className="text-sm font-semibold text-purple-400 flex items-center mb-2">
              <Play className="w-4 h-4 mr-1.5" /> 2. 演奏設定・コマンド
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-purple-300 font-mono font-bold">o4 / o5 / &gt; / &lt;</code>
                <p className="text-slate-300 mt-1">オクターブ指定 / &gt;(1オクターブ上) / &lt;(下)</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-purple-300 font-mono font-bold">l4 / l8 / l16</code>
                <p className="text-slate-300 mt-1">デフォルト音長を設定 (省略時の長さ)</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-purple-300 font-mono font-bold">v100 / ( / )</code>
                <p className="text-slate-300 mt-1">音量・ベロシティ指定 (0〜127) / (大きめ / )小さめ</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-purple-300 font-mono font-bold">Tempo(120) / t120</code>
                <p className="text-slate-300 mt-1">テンポ設定 (BPM)</p>
              </div>
            </div>
          </div>

          {/* 和音・複数トラック */}
          <div>
            <h3 className="text-sm font-semibold text-amber-400 flex items-center mb-2">
              <Layers className="w-4 h-4 mr-1.5" /> 3. 和音・複数パート
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-amber-300 font-mono font-bold">[ceg]4 / [fa&gt;c&lt;]2</code>
                <p className="text-slate-300 mt-1">和音 (同時に鳴らす音をカッコで囲む)</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <code className="text-amber-300 font-mono font-bold">TR(1) / TR(2) / Voice(0)</code>
                <p className="text-slate-300 mt-1">トラック指定 / 音色 (0:ピアノ, 48:Strings 等)</p>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 sm:col-span-2">
                <code className="text-amber-300 font-mono font-bold">// 1行コメント / /* 複数行 */ / ; コメント</code>
                <p className="text-slate-300 mt-1">コメント記述でメモや小節番号を整理できます</p>
              </div>
            </div>
          </div>

          {/* 楽器選択パレット・出力機能のご案内 */}
          <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs">
            <h4 className="font-semibold text-blue-300 flex items-center gap-1.5 mb-1.5">
              💡 楽器選択パレット &amp; 入力場所への出力
            </h4>
            <p className="text-slate-300 leading-relaxed">
              エディタ上部の「<strong>楽器選択ボタン</strong>」を押すと、全128音色のGM楽器パレットが開きます。音色をプレビュー試聴し、「<strong>出力</strong>」ボタンまたは上部ツールバーの「<strong>現在の入力場所へ出力</strong>」を押すことで、現在のカーソル位置へ構文ミスなく自動整形されて挿入されます。
            </p>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="flex justify-end px-6 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
