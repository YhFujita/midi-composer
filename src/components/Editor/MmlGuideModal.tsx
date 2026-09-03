import React from 'react';
import { X, BookOpen, Music, Play, Layers, ArrowUpDown } from 'lucide-react';

interface MmlGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MmlGuideModal: React.FC<MmlGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className="border border-slate-300 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-slate-900 overflow-hidden"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">MML (サクラ風) 記法クイックリファレンス</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm bg-white text-slate-800">
          {/* 基本音符 */}
          <div>
            <h3 className="text-sm font-bold text-blue-700 flex items-center mb-2">
              <Music className="w-4 h-4 mr-1.5" /> 1. 音符・休符
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-emerald-700 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">c d e f g a b</code>
                <p className="text-slate-700 mt-1.5 font-medium">ド・レ・ミ・ファ・ソ・ラ・シ の音符</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-emerald-700 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">c+ / c# / d- / d_</code>
                <p className="text-slate-700 mt-1.5 font-medium">シャープ (半音上げ) / フラット (半音下げ)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-emerald-700 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">c4 / c8 / c16 / c2 / c1</code>
                <p className="text-slate-700 mt-1.5 font-medium">音長指定 (4分音符、8分音符、全音符 等)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-emerald-700 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">r4 / r8 / c4.</code>
                <p className="text-slate-700 mt-1.5 font-medium">休符 (r4) / 付点音符 (c4.)</p>
              </div>
            </div>
          </div>

          {/* オクターブ・音量・テンポ・メタ情報 */}
          <div>
            <h3 className="text-sm font-bold text-purple-700 flex items-center mb-2">
              <Play className="w-4 h-4 mr-1.5" /> 2. 演奏設定・コマンド
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">Title("曲名") / // 曲名</code>
                <p className="text-slate-700 mt-1.5 font-medium">譜面に表示される曲名タイトルを設定</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">Tempo(120) / t120</code>
                <p className="text-slate-700 mt-1.5 font-medium">テンポ設定 (BPM)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">TimeSignature(4,4)</code>
                <p className="text-slate-700 mt-1.5 font-medium">拍子記号設定 (4/4, 3/4 等)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">o4 / o5 / &gt; / &lt;</code>
                <p className="text-slate-700 mt-1.5 font-medium">オクターブ指定 / &gt;(1オクターブ上) / &lt;(下)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">l4 / l8 / l16</code>
                <p className="text-slate-700 mt-1.5 font-medium">デフォルト音長を設定 (省略時の長さ)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">v100 / ( / )</code>
                <p className="text-slate-700 mt-1.5 font-medium">音量・ベロシティ指定 (0〜127) / (大きめ / )小さめ</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-purple-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-300 inline-block">q80 / Gate(80) / q4</code>
                <p className="text-slate-700 mt-1.5 font-medium">ゲートタイム (音の長さ)。q100=伸ばす, q80=標準, q20やq2=スタッカート</p>
              </div>
            </div>
          </div>

          {/* 和音・複数トラック */}
          <div>
            <h3 className="text-sm font-bold text-amber-800 flex items-center mb-2">
              <Layers className="w-4 h-4 mr-1.5" /> 3. 和音・複数パート
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-amber-900 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 inline-block">[ceg]4 / [fa&gt;c&lt;]2</code>
                <p className="text-slate-700 mt-1.5 font-medium">和音 (同時に鳴らす音をカッコで囲む)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-amber-900 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 inline-block">TR(1) / TR(2) / Voice(0)</code>
                <p className="text-slate-700 mt-1.5 font-medium">トラック指定 / 音色 (0:ピアノ, 48:Strings 等)</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 sm:col-span-2 shadow-sm">
                <code className="text-amber-900 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 inline-block">[~ceg]4 / [~^ceg]4 / [ceg]~4</code>
                <p className="text-slate-700 mt-1.5 font-medium">
                  🎸 <strong>バラシ (ギターストローク・ロール演奏)</strong>: チルダ記号「~」を付けると、アルペジオまで分解せずギターをジャララーンとストロークするような心地よい時間差演奏になります (~^ で逆かき上げストローク)。楽譜上にもアルペジオ波線記号が美しく描画されます。
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 sm:col-span-2 shadow-sm">
                <code className="text-amber-900 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300 inline-block">// 1行コメント / /* 複数行 */ / ; コメント</code>
                <p className="text-slate-700 mt-1.5 font-medium">コメント記述でメモや小節番号を整理できます</p>
              </div>
            </div>
          </div>

          {/* 移調・キー変更 */}
          <div>
            <h3 className="text-sm font-bold text-emerald-800 flex items-center mb-2">
              <ArrowUpDown className="w-4 h-4 mr-1.5" /> 4. 移調 (キー変更・転調)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-emerald-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">Key(-1) / Key(2) / Key(0)</code>
                <p className="text-slate-700 mt-1.5 font-medium">パート移調 (半音単位)。-1で短2度下げ(半音↓)、+2で長2度上げ(全音↑)。曲の途中でも自由に変更可能です</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                <code className="text-emerald-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">MasterKey(-1) / MasterKey(1)</code>
                <p className="text-slate-700 mt-1.5 font-medium">楽曲全体の移調。曲頭または途中で全パートを一括転調します</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 sm:col-span-2 shadow-sm">
                <code className="text-emerald-800 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 inline-block">Transpose(n) / _k(n) / 画面上部「移調」ボタン</code>
                <p className="text-slate-700 mt-1.5 font-medium">互換コマンドに対応。また、エディタツールバーの「移調を挿入」からワンクリックでカーソル位置へ挿入でき、上部バーの「移調 [-] [±0] [+]」からも即座に試聴・キー変更が可能です</p>
              </div>
            </div>
          </div>

          {/* 楽器選択パレット・出力機能のご案内 */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs shadow-sm">
            <h4 className="font-bold text-blue-900 flex items-center gap-1.5 mb-1.5 text-xs">
              💡 楽器選択パレット &amp; 入力場所への出力
            </h4>
            <p className="text-slate-700 leading-relaxed font-medium">
              エディタ上部の「<strong>楽器選択ボタン</strong>」を押すと、全128音色のGM楽器パレットが開きます。音色をプレビュー試聴し、「<strong>出力</strong>」ボタンまたは上部ツールバーの「<strong>現在の入力場所へ出力</strong>」を押すことで、現在のカーソル位置へ構文ミスなく自動整形されて挿入されます。
            </p>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="flex justify-end px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
