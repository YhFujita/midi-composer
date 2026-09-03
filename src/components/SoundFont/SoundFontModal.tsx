import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Music2,
  Upload,
  Check,
  Trash2,
  RefreshCw,
  HardDrive,
  Info,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  soundFontManager,
  SoundFontMeta,
  SoundFontState,
} from '../../core/audio/soundFontManager';
import { audioEngine } from '../../core/audio/soundFontPlayer';

interface SoundFontModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundFontModal: React.FC<SoundFontModalProps> = ({ isOpen, onClose }) => {
  const [sfState, setSfState] = useState<SoundFontState>(soundFontManager.getState());
  const [savedList, setSavedList] = useState<SoundFontMeta[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = soundFontManager.subscribe((state) => {
      setSfState(state);
    });
    return unsub;
  }, []);

  const refreshList = async () => {
    const list = await soundFontManager.listSavedSoundFonts();
    setSavedList(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.sf2') && !file.name.endsWith('.sf3')) {
      setErrorMessage('.sf2 または .sf3 形式のサウンドフォントファイルを選択してください。');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const buffer = await soundFontManager.loadCustomSoundFont(file);
      await audioEngine.applySoundFontBuffer(buffer);
      await refreshList();
      setSuccessMessage(`「${file.name}」を正常に読み込み、音源に適用しました！`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'SoundFontの適用に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSwitch = async (id: string, name: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const buffer = await soundFontManager.switchToSoundFont(id);
      await audioEngine.applySoundFontBuffer(buffer);
      await refreshList();
      setSuccessMessage(`音源を「${name}」に切り替えました。`);
    } catch (err: any) {
      setErrorMessage(err?.message || '音源の切り替えに失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`「${name}」のキャッシュを削除しますか？`)) {
      await soundFontManager.deleteSoundFont(id);
      await refreshList();
    }
  };

  const formatSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 背景を完全不透明白(#ffffff)にし、背後が一切透けないように設計 */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-slate-900 bg-white animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                SoundFont (MIDI音源) 設定
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                本物の生楽器サンプリング音源の管理・カスタム音源の追加
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div
          className="p-5 space-y-5 overflow-y-auto max-h-[75vh]"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* 現在のステータスバナー */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <HardDrive className="w-5 h-5 text-indigo-600 shrink-0" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">現在使用中の音源</div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  {sfState.currentSoundFont?.name || 'TimGM6mb (内蔵 GM音源)'}
                  {sfState.currentSoundFont?.size && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      {formatSize(sfState.currentSoundFont.size)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div>
              {sfState.status === 'ready' ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  準備完了
                </span>
              ) : sfState.status === 'loading' ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ロード中 ({sfState.progress}%)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  簡易合成音
                </span>
              )}
            </div>
          </div>

          {/* メッセージ表示 */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ファイルのドラッグ＆ドロップエリア */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50 scale-[0.99]'
                : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".sf2,.sf3"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-white rounded-full text-indigo-600 border border-slate-200 shadow-xs">
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-sm font-bold text-indigo-600 hover:underline">
                  SoundFont ファイルを選択
                </span>
                <span className="text-sm text-slate-600 font-medium"> またはここにドラッグ＆ドロップ</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                対応フォーマット: .sf2, .sf3 (読み込んだ音源はブラウザ内に自動保存されます)
              </p>
            </div>
          </div>

          {/* 保存済み SoundFont 一覧 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-semibold">
              <span>利用可能な音源ライブラリ</span>
              <span className="text-slate-500 font-normal">IndexedDB キャッシュ</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {savedList.map((sf) => {
                const isCurrent = sfState.currentSoundFont?.id === sf.id;
                return (
                  <div
                    key={sf.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-50/80 border-indigo-400 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
                      <Music2
                        className={`w-4 h-4 shrink-0 ${
                          isCurrent ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5 text-slate-900">
                          {sf.name}
                          {sf.isDefault && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                              標準
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">{formatSize(sf.size)}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {isCurrent ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-300 shadow-2xs">
                          <Check className="w-3 h-3 text-indigo-600" />
                          使用中
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSwitch(sf.id, sf.name)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        >
                          選択
                        </button>
                      )}

                      {!sf.isDefault && (
                        <button
                          onClick={() => handleDelete(sf.id, sf.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="キャッシュから削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ヒント情報 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-2 text-[11px] text-blue-900 font-medium shadow-2xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              標準音源の <strong>TimGM6mb.sf2</strong> は軽量で全128楽器＋ドラムに対応しています。お好みのSoundFont（Roland SC-55系、FluidR3、高音質なピアノ音源など）を追加すると、さらにリアルなサウンドで作曲・再生を楽しめます。
            </div>
          </div>
        </div>

        {/* フッター */}
        <div
          className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-lg transition-colors border border-slate-300 shadow-2xs cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
