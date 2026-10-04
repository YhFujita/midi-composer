import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Music2,
  Upload,
  Check,
  Trash2,
  HardDrive,
  Info,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  FolderDown,
  Copy,
  Sparkles,
} from 'lucide-react';
import {
  soundFontManager,
  SoundFontMeta,
  SoundFontState,
} from '../../core/audio/soundFontManager';
import { audioEngine } from '../../core/audio/soundFontPlayer';
import { SOUNDFONT_PRESETS, SoundFontPreset } from '../../constants/soundfonts';

interface SoundFontModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundFontModal: React.FC<SoundFontModalProps> = ({ isOpen, onClose }) => {
  const [sfState, setSfState] = useState<SoundFontState>(soundFontManager.getState());
  const [savedList, setSavedList] = useState<SoundFontMeta[]>([]);
  const [presetStatuses, setPresetStatuses] = useState<Record<string, { isLocal: boolean; isCached: boolean }>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPresetId, setProcessingPresetId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = soundFontManager.subscribe((state) => {
      setSfState(state);
    });
    return unsub;
  }, []);

  const refreshData = async () => {
    const list = await soundFontManager.listSavedSoundFonts();
    setSavedList(list);

    // 各プリセットの状態（ローカルフォルダにあるか・IndexedDBにあるか）をチェック
    const statusMap: Record<string, { isLocal: boolean; isCached: boolean }> = {};
    for (const preset of SOUNDFONT_PRESETS) {
      statusMap[preset.id] = await soundFontManager.checkPresetStatus(preset);
    }
    setPresetStatuses(statusMap);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      setSuccessMessage(null);
      setErrorMessage(null);
      setCopiedCommand(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // カスタムファイルの読み込み
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
      await refreshData();
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

  // プリセット音源の切り替えまたはダウンロード
  const handleSelectPreset = async (preset: SoundFontPreset) => {
    setIsProcessing(true);
    setProcessingPresetId(preset.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const buffer = await soundFontManager.loadPresetSoundFont(preset);
      await audioEngine.applySoundFontBuffer(buffer);
      await refreshData();
      setSuccessMessage(`音源を「${preset.name}」に切り替えました。`);
    } catch (err: any) {
      setErrorMessage(err?.message || '音源の読み込みに失敗しました。');
    } finally {
      setIsProcessing(false);
      setProcessingPresetId(null);
    }
  };

  // 保存済みカスタム音源の切り替え
  const handleSwitchCustom = async (id: string, name: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const buffer = await soundFontManager.switchToSoundFont(id);
      await audioEngine.applySoundFontBuffer(buffer);
      await refreshData();
      setSuccessMessage(`音源を「${name}」に切り替えました。`);
    } catch (err: any) {
      setErrorMessage(err?.message || '音源の切り替えに失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // キャッシュの削除
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`「${name}」のキャッシュを削除しますか？`)) {
      await soundFontManager.deleteSoundFont(id);
      await refreshData();
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('npm run download:soundfont');
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  const formatSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ユーザーが手動追加したカスタム音源（プリセットに含まれないもの）を抽出
  const customSavedList = savedList.filter(
    (sf) => !SOUNDFONT_PRESETS.some((preset) => preset.id === sf.id)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 背景を完全不透明白(#ffffff)にし、背後が一切透けないように設計 */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-slate-900 bg-white animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                SoundFont (MIDI音源) 設定・管理
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                高品質サンプリング音源の選択、ローカルフォルダ連携、カスタム音源追加
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツエリア */}
        <div
          className="p-6 space-y-6 overflow-y-auto max-h-[75vh]"
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
                  {sfState.currentSoundFont?.name || 'TimGM6mb (標準GM音源)'}
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
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  準備完了
                </span>
              ) : sfState.status === 'loading' ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 px-3 py-1 rounded-full">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ロード中 ({sfState.progress}%)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 px-3 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  簡易音源
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
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-xl flex items-start gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* 1. 定番・推奨音源ライブラリ (FluidR3 GM & TimGM6mb) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 px-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                定番・推奨音源ライブラリ (Localフォルダ連携)
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                public/soundfonts/ 対応
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {SOUNDFONT_PRESETS.map((preset) => {
                const isCurrent = sfState.currentSoundFont?.id === preset.id;
                const status = presetStatuses[preset.id];
                const isLocal = status?.isLocal;
                const isCached = status?.isCached;
                const isAvailable = isLocal || isCached;
                const isThisLoading = isProcessing && processingPresetId === preset.id;

                return (
                  <div
                    key={preset.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-50/70 border-indigo-400 shadow-sm ring-1 ring-indigo-400/50'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">
                            {preset.name}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {preset.formattedSize}
                          </span>
                          {preset.isDefault && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                              初期標準
                            </span>
                          )}
                          {isLocal ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Localフォルダ保存済
                            </span>
                          ) : isCached ? (
                            <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">
                              ブラウザ保存済
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                              未ダウンロード
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {preset.description}
                        </p>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ファイル名: {preset.filename}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isCurrent ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white border border-indigo-300 rounded-lg shadow-2xs">
                            <Check className="w-4 h-4 text-indigo-600" />
                            使用中
                          </span>
                        ) : isAvailable ? (
                          <button
                            onClick={() => handleSelectPreset(preset)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isThisLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ロード中...
                              </>
                            ) : (
                              'この音源に切り替える'
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectPreset(preset)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-300 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            title="オンラインからダウンロードして保存します"
                          >
                            {isThisLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                DL中 ({sfState.progress}%)...
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                ダウンロードして使用
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. ローカルフォルダ連携＆コマンド案内カード */}
          <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FolderDown className="w-4 h-4 text-slate-700" />
                Localフォルダ（public/soundfonts/）への追加・保存方法
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                プロジェクト内の <code className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-slate-800">public/soundfonts/</code> フォルダに音源ファイル（.sf2）を保存すると、Webアプリから高速・安定して直接読み込めます。
              </p>
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-700">
                  ⚡ FluidR3 GM を一括ダウンロードするコマンド（推奨）:
                </div>
                <div className="flex items-center justify-between bg-slate-900 text-slate-100 px-3 py-2 rounded-md font-mono text-xs">
                  <span>npm run download:soundfont</span>
                  <button
                    onClick={handleCopyCommand}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors cursor-pointer"
                    title="コマンドをコピー"
                  >
                    {copiedCommand ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>コピー</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 手元のファイルを直接ドラッグ＆ドロップで追加 */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 px-1">
              お手持ちの SoundFont ファイルを追加 (.sf2 / .sf3)
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
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
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="p-2.5 bg-white rounded-full text-indigo-600 border border-slate-200 shadow-xs">
                  {isProcessing && !processingPresetId ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-indigo-600 hover:underline">
                    PC内の音源ファイルを選択
                  </span>
                  <span className="text-xs text-slate-600 font-medium"> またはドラッグ＆ドロップ</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  読み込んだ音源はブラウザのローカルキャッシュ（IndexedDB）に自動保存されます
                </p>
              </div>
            </div>
          </div>

          {/* 4. 追加保存されたカスタム音源一覧 */}
          {customSavedList.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800 px-1">
                インポート済みカスタム音源一覧
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {customSavedList.map((sf) => {
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
                          <div className="text-xs font-bold truncate text-slate-900">
                            {sf.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {formatSize(sf.size)}
                          </div>
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
                            onClick={() => handleSwitchCustom(sf.id, sf.name)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg transition-colors shadow-2xs cursor-pointer"
                          >
                            選択
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(sf.id, sf.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="キャッシュから削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ヒント情報 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-2 text-[11px] text-blue-900 font-medium shadow-2xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>FluidR3 GM</strong> はピアノ、ストリングス、ギター、ブラスなど生楽器のサンプリングが極めて高精細な本格的GM音源です。
              一度ローカルに保存（ダウンロード）すると、次回以降オフラインでも即座に高品質サウンドで演奏・MP3出力が可能です。
            </div>
          </div>
        </div>

        {/* フッター */}
        <div
          className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-lg transition-colors border border-slate-300 shadow-2xs cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
