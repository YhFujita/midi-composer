import React from 'react';
import {
  Music2,
  Volume2,
  CornerDownLeft,
  ChevronDown,
  Sparkles,
  Layers,
  Settings2,
} from 'lucide-react';
import {
  POPULAR_INSTRUMENTS,
  getInstrumentByProgram,
} from '../../constants/instruments';
import { InsertFormatType } from './InstrumentSelectorModal';
import { audioEngine } from '../../core/audio/soundFontPlayer';

interface EditorToolbarProps {
  selectedProgram: number;
  onSelectProgram: (program: number) => void;
  onOpenModal: () => void;
  onOpenChordModal: () => void;
  isChordModalOpen?: boolean;
  onToggleKeyboard?: () => void;
  isKeyboardOpen?: boolean;
  onInsertToEditor: (program: number, format: InsertFormatType) => void;
  onInsertText?: (text: string) => void;
  formatType: InsertFormatType;
  onChangeFormatType: (format: InsertFormatType) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  selectedProgram,
  onSelectProgram,
  onOpenModal,
  onOpenChordModal,
  isChordModalOpen,
  onToggleKeyboard,
  isKeyboardOpen,
  onInsertToEditor,
  onInsertText,
  formatType,
  onChangeFormatType,
}) => {
  const currentInst = getInstrumentByProgram(selectedProgram);

  const handlePreview = () => {
    if (selectedProgram === 128) {
      // ドラムセットのプレビュー: バスドラム -> ハイハット -> スネア
      audioEngine.previewNote(36, 300, 0, 110, true);
      setTimeout(() => audioEngine.previewNote(42, 200, 0, 95, true), 150);
      setTimeout(() => audioEngine.previewNote(38, 300, 0, 105, true), 300);
    } else {
      audioEngine.previewInstrument(selectedProgram);
    }
  };

  const handleInsert = () => {
    onInsertToEditor(selectedProgram, formatType);
  };

  return (
    <div className="flex flex-wrap items-center justify-between px-2.5 py-1 bg-slate-900 border-b border-slate-800 text-slate-200 text-xs gap-1.5 select-none">
      {/* 左エリア: 楽器選択ボタン & クイック選択 */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 flex-wrap">
        <span className="text-[11px] text-slate-300 font-semibold mr-0.5 flex items-center">
          <Music2 className="w-3.5 h-3.5 mr-1 text-blue-400" />
          楽器:
        </span>

        {/* 楽器選択パレットを開くボタン: 白背景・不透明・黒文字 */}
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center space-x-1.5 px-2 py-0.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-md transition-all text-xs text-left shadow-xs group h-7"
          style={{ backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 }}
          title="楽器選択パレットを開く (全128音色 + ドラムセット)"
        >
          <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1 py-0 rounded text-[11px] border border-blue-200">
            {selectedProgram === 128 ? 'Drum' : `#${selectedProgram}`}
          </span>
          <span className="font-bold text-slate-900 max-w-[110px] sm:max-w-[160px] truncate text-[11px]">
            {currentInst.nameJa}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-800" />
        </button>

        {/* 試聴ボタン */}
        <button
          type="button"
          onClick={handlePreview}
          className="p-1 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-md text-blue-600 hover:text-blue-700 transition-colors shadow-xs h-7 w-7 flex items-center justify-center"
          style={{ backgroundColor: '#ffffff', opacity: 1 }}
          title="選択中の楽器をプレビュー試聴"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        {/* 主要音色クイックセレクター: 白背景・不透明・黒文字 */}
        <div className="hidden sm:flex items-center space-x-1 pl-0.5">
          <select
            value={selectedProgram}
            onChange={(e) => onSelectProgram(parseInt(e.target.value, 10))}
            className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded px-1.5 py-0.5 outline-none hover:border-slate-400 focus:border-blue-600 shadow-xs max-w-[130px] truncate h-7"
            style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
            title="よく使う音色のクイック選択"
          >
            <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
              クイック選択...
            </option>
            {POPULAR_INSTRUMENTS.map((inst) => (
              <option key={inst.program} value={inst.program} style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                {inst.program === 128 ? '🥁 ドラムセット (Ch 10)' : `${inst.program}: ${inst.nameJa}`}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-600 hidden sm:inline px-0.5">|</span>

        {/* コード入力ボタン: 開いている時はアクティブスタイル */}
        <button
          type="button"
          onClick={onOpenChordModal}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded-md transition-all text-xs font-bold shadow-xs group border h-7 ${
            isChordModalOpen
              ? 'bg-blue-50 text-blue-700 border-blue-500 ring-1 ring-blue-400'
              : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border-slate-300'
          }`}
          style={!isChordModalOpen ? { backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 } : {}}
          title="コード入力パレットを開閉 (テキスト入力と並行して右側に表示)"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isChordModalOpen ? 'text-blue-600 animate-spin-slow' : 'text-amber-500'}`} />
          <span className="text-[11px]">コード入力</span>
          {isChordModalOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          )}
        </button>

        {/* ピアノ鍵盤ボタン: 開いている時はアクティブスタイル */}
        {onToggleKeyboard && (
          <button
            type="button"
            onClick={onToggleKeyboard}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md transition-all text-xs font-bold shadow-xs group border h-7 ${
              isKeyboardOpen
                ? 'bg-blue-50 text-blue-700 border-blue-500 ring-1 ring-blue-400'
                : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border-slate-300'
            }`}
            style={!isKeyboardOpen ? { backgroundColor: '#ffffff', color: '#0f172a', opacity: 1 } : {}}
            title="バーチャルピアノ鍵盤を開閉 (音の試聴やカーソル位置への音符入力)"
          >
            <span className="text-sm leading-none">🎹</span>
            <span className="text-[11px]">ピアノ鍵盤</span>
            {isKeyboardOpen && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            )}
          </button>
        )}

        {/* 調号（Key Signature）クイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="調号 (Key Signature) を挿入 (五線譜に調号を表示し、MML音符に自動で#や♭を適用)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                調号 (Key) を挿入...
              </option>
              <optgroup label="長調 (シャープ系 #)">
                <option value="Key C /* ハ長調 (#/♭なし) */">Key C (ハ長調: 記号なし)</option>
                <option value="Key G /* ト長調 (#1) */">Key G (ト長調: #1 [F#])</option>
                <option value="Key D /* ニ長調 (#2) */">Key D (ニ長調: #2 [F#,C#])</option>
                <option value="Key A /* イ長調 (#3) */">Key A (イ長調: #3 [F#,C#,G#])</option>
                <option value="Key E /* ホ長調 (#4) */">Key E (ホ長調: #4 [F#,C#,G#,D#])</option>
                <option value="Key B /* ロ長調 (#5) */">Key B (ロ長調: #5 [F#,C#,G#,D#,A#])</option>
                <option value="Key F# /* 嬰ヘ長調 (#6) */">Key F# (嬰ヘ長調: #6)</option>
              </optgroup>
              <optgroup label="長調 (フラット系 ♭)">
                <option value="Key F /* ヘ長調 (♭1) */">Key F (ヘ長調: ♭1 [Bb])</option>
                <option value="Key Bb /* 変ロ長調 (♭2) */">Key Bb (変ロ長調: ♭2 [Bb,Eb])</option>
                <option value="Key Eb /* 変ホ長調 (♭3) */">Key Eb (変ホ長調: ♭3 [Bb,Eb,Ab])</option>
                <option value="Key Ab /* 変イ長調 (♭4) */">Key Ab (変イ長調: ♭4)</option>
                <option value="Key Db /* 変ニ長調 (♭5) */">Key Db (変ニ長調: ♭5)</option>
                <option value="Key Gb /* 変ト長調 (♭6) */">Key Gb (変ト長調: ♭6)</option>
              </optgroup>
              <optgroup label="短調 (Minor Keys)">
                <option value="Key Am /* イ短調 */">Key Am (イ短調: 記号なし)</option>
                <option value="Key Em /* ホ短調 (#1) */">Key Em (ホ短調: #1)</option>
                <option value="Key Bm /* ロ短調 (#2) */">Key Bm (ロ短調: #2)</option>
                <option value="Key F#m /* 嬰ヘ短調 (#3) */">Key F#m (嬰ヘ短調: #3)</option>
                <option value="Key C#m /* 嬰ハ短調 (#4) */">Key C#m (嬰ハ短調: #4)</option>
                <option value="Key Dm /* ニ短調 (♭1) */">Key Dm (ニ短調: ♭1)</option>
                <option value="Key Gm /* ト短調 (♭2) */">Key Gm (ト短調: ♭2)</option>
                <option value="Key Cm /* ハ短調 (♭3) */">Key Cm (ハ短調: ♭3)</option>
              </optgroup>
              <optgroup label="調号下の臨時記号例">
                <option value="f= /* Fナチュラル(白鍵) */">f= (調号下のナチュラル例)</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* 半音移調 (Transpose) クイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="半音単位の移調 (Transpose / KeyShift) を挿入 (音高を平行移動)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                移調 (半音シフト)...
              </option>
              <optgroup label="パート移調 (トラック別)">
                <option value="Key(-1) /* 短2度↓ */">Key(-1) /* 短2度下げ(半音↓) */</option>
                <option value="Key(1) /* 短2度↑ */">Key(1) /* 短2度上げ(半音↑) */</option>
                <option value="Key(-2) /* 長2度↓ */">Key(-2) /* 長2度下げ(全音↓) */</option>
                <option value="Key(2) /* 長2度↑ */">Key(2) /* 長2度上げ(全音↑) */</option>
                <option value="Key(0) /* 原調リセット */">Key(0) /* 原調に戻す */</option>
              </optgroup>
              <optgroup label="楽曲全体移調 (マスター)">
                <option value="MasterKey(-1) /* 全体短2度↓ */">MasterKey(-1) /* 全体短2度下げ */</option>
                <option value="MasterKey(1) /* 全体短2度↑ */">MasterKey(1) /* 全体短2度上げ */</option>
                <option value="MasterKey(2) /* 全体長2度↑ */">MasterKey(2) /* 全体長2度上げ */</option>
                <option value="MasterKey(0) /* 全体原調リセット */">MasterKey(0) /* 全体原調に戻す */</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* ペダル記号クイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="エディタのカーソル位置にペダル記号を挿入 (音を伸ばして重ねる)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                ペダルを挿入...
              </option>
              <option value="Pedal /* 踏む */">Pedal /* 踏む (離すまで音が持続) */</option>
              <option value="PedalOff /* 離す */">PedalOff /* 離す (ペダル音を消音) */</option>
              <option value="Pedal c8 e8 g8 > c8 PedalOff">Pedal c8 e8 g8 &gt; c8 PedalOff (アルペジオ例)</option>
            </select>
          </div>
        )}

        {/* タイ・スラー記号クイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="エディタのカーソル位置にタイやスラーの記号を挿入 (音の結合・レガート演奏)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                タイ/スラーを挿入...
              </option>
              <optgroup label="タイ (同一音の結合)">
                <option value="& /* タイ/スラー記号 */">&amp; /* タイ/スラー記号 (前後の音を繋ぐ) */</option>
                <option value="c4 & c4">c4 &amp; c4 /* タイ (ドを4分+4分伸ばす) */</option>
                <option value="[ceg]4 & [ceg]4">[ceg]4 &amp; [ceg]4 /* 和音タイ */</option>
                <option value="^4">^4 /* 音長タイ (^で長さを足す) */</option>
              </optgroup>
              <optgroup label="スラー (レガート演奏)">
                <option value="c4 & d4 & e4">c4 &amp; d4 &amp; e4 /* &amp;によるスラー */</option>
                <option value="Slur( c4 d4 e4 f4 )">Slur( c4 d4 e4 f4 ) /* フレーズスラー */</option>
                <option value="SlurOn c4 d4 e4 SlurOff">SlurOn c4 d4 e4 SlurOff /* 区間スラー */</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* 3連符クイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="エディタのカーソル位置に3連符（Tuplet）を挿入 (五線譜にも連符括弧が描画されます)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                3連符を挿入...
              </option>
              <optgroup label="波括弧記法 (推奨・自動3連符)">
                <option value="{ c d e }4 /* 8分3連符 (1拍に3音) */">{'{ c d e }4 /* 8分3連符 (1拍に3音) */'}</option>
                <option value="{ c d e }8 /* 16分3連符 (半拍に3音) */">{'{ c d e }8 /* 16分3連符 (半拍に3音) */'}</option>
                <option value="{ c d e }2 /* 4分3連符 (2拍に3音) */">{'{ c d e }2 /* 4分3連符 (2拍に3音) */'}</option>
                <option value="{ [ceg] [dfa] [e g b] }4 /* 和音3連符 */">{'{ [ceg] [dfa] [e g b] }4 /* 和音3連符 */'}</option>
              </optgroup>
              <optgroup label="直接音長指定 (12分/6分/24分)">
                <option value="c12 d12 e12 /* 12分音符 (8分3連符) */">c12 d12 e12 /* 12分音符 (8分3連符) */</option>
                <option value="c6 d6 e6 /* 6分音符 (4分3連符) */">c6 d6 e6 /* 6分音符 (4分3連符) */</option>
                <option value="c24 d24 e24 /* 24分音符 (16分3連符) */">c24 d24 e24 /* 24分音符 (16分3連符) */</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* 構成記号 (リハーサルマーク: 🄰, 🄱 等) クイック挿入ドロップダウン: 白背景・不透明・黒文字 */}
        {onInsertText && (
          <div className="flex items-center space-x-1 pl-1">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onInsertText(e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded-md px-2 py-1 outline-none hover:border-slate-400 focus:border-blue-600 shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
              title="エディタのカーソル位置に曲の構成記号・リハーサルマーク (🄰, 🄱, [Intro], [Chorus] 等) を挿入 (五線譜にも角丸四角枠で描画されます)"
            >
              <option value="" disabled style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                構成記号 (🄰, 🄱)...
              </option>
              <optgroup label="四角囲み文字 (Unicode)">
                <option value="🄰 ">🄰 (Aセクション / Aメロ)</option>
                <option value="🄱 ">🄱 (Bセクション / Bメロ)</option>
                <option value="🄲 ">🄲 (Cセクション / サビ)</option>
                <option value="🄳 ">🄳 (Dセクション)</option>
              </optgroup>
              <optgroup label="ブラケット記法 (角カッコ)">
                <option value="[Intro] ">[Intro] (イントロ)</option>
                <option value="[A] ">[A] (Aメロ)</option>
                <option value="[B] ">[B] (Bメロ)</option>
                <option value="[Chorus] ">[Chorus] (サビ)</option>
                <option value="[Bridge] ">[Bridge] (間奏・ブリッジ)</option>
                <option value="[Outro] ">[Outro] (アウトロ・エンディング)</option>
              </optgroup>
              <optgroup label="コマンド記法">
                <option value='Mark("A") '>Mark("A")</option>
                <option value='Section("Chorus") '>Section("Chorus")</option>
              </optgroup>
            </select>
          </div>
        )}
      </div>

      {/* 右エリア: 現在の入力場所へ出力ボタン & 書式設定 */}
      <div className="flex items-center space-x-1.5 ml-auto">
        {/* 書式選択ドロップダウン: 白背景・不透明・黒文字 */}
        <div className="flex items-center space-x-1">
          <select
            value={formatType}
            onChange={(e) => onChangeFormatType(e.target.value as InsertFormatType)}
            className="bg-white border border-slate-300 text-slate-900 font-medium text-[11px] rounded px-1.5 py-0.5 outline-none hover:border-slate-400 focus:border-blue-600 shadow-xs h-7"
            style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}
            title="エディタ挿入時の構文形式"
          >
            <option value="with-comment" style={{ backgroundColor: '#ffffff', color: '#000000' }}>形式: コメント付</option>
            <option value="voice-only" style={{ backgroundColor: '#ffffff', color: '#000000' }}>形式: Voice のみ</option>
          </select>
        </div>

        {/* 出力ボタン: 現在の入力場所へ出力 */}
        <button
          type="button"
          onClick={handleInsert}
          className="flex items-center space-x-1 px-2.5 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-semibold rounded shadow-xs transition-all text-xs h-7"
          title="エディタの現在の入力場所 (カーソル位置) に構文エラーのない形式で出力します"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span className="text-[11px]">エディタへ出力</span>
        </button>
      </div>
    </div>
  );
};
