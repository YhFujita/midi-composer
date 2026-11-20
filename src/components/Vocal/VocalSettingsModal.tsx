import React, { useState, useEffect } from 'react';
import {
  X,
  Mic2,
  Volume2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
  Radio,
} from 'lucide-react';
import {
  vocalSettingsManager,
  VocalSettings,
  VocalCharacterType,
  VocalEngineMode,
} from '../../core/audio/vocalSynth';
import { voicevoxClient, VoicevoxSinger } from '../../core/audio/voicevoxClient';
import { audioEngine } from '../../core/audio/soundFontPlayer';

interface VocalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHARACTER_OPTIONS: {
  id: VocalCharacterType;
  label: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: 'idol',
    label: 'ボカロ・ポップ (標準女声)',
    badge: '推奨',
    desc: '明るく華やかなフォルマント特性を持つ王道ボカロ風の歌声',
  },
  {
    id: 'soft',
    label: 'ウィスパー・ソフト (優しめ)',
    badge: 'Soft',
    desc: '息遣い（ブレス成分）を含んだ柔らかく落ち着いた歌声',
  },
  {
    id: 'male',
    label: 'ボーイッシュ・クリア (男声/低め)',
    badge: 'Male',
    desc: '声道長を長めにモデリングした青年・ボーイッシュ系の歌声',
  },
  {
    id: 'retro',
    label: 'レトロ・チップボーカル (ロボ声)',
    badge: '8bit',
    desc: '矩形波をブレンドしたピコピコ・シンセサイザー風の合成音声',
  },
];

export const VocalSettingsModal: React.FC<VocalSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<VocalSettings>(vocalSettingsManager.getSettings());
  const [isCheckingVv, setIsCheckingVv] = useState(false);
  const [vvConnected, setVvConnected] = useState(voicevoxClient.getConnectionStatus());
  const [vvSingers, setVvSingers] = useState<VoicevoxSinger[]>(voicevoxClient.getSingers());
  const [vvError, setVvError] = useState<string | null>(null);

  useEffect(() => {
    return vocalSettingsManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });
  }, []);

  if (!isOpen) return null;

  const update = (partial: Partial<VocalSettings>) => {
    vocalSettingsManager.updateSettings(partial);
  };

  const handleTestVoicevox = async () => {
    setIsCheckingVv(true);
    setVvError(null);
    const res = await voicevoxClient.checkConnection(settings.voicevoxUrl);
    setIsCheckingVv(false);
    setVvConnected(res.ok);
    setVvSingers(res.singers);
    if (!res.ok && res.error) {
      setVvError(res.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 完全不透明な白地背景 (#ffffff) */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col text-slate-900 bg-white animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-pink-50 border border-pink-200 rounded-xl text-pink-600">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>歌声合成 (ボカロ歌唱) 設定</span>
                <span className="text-[11px] bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full font-bold border border-pink-200">
                  Web Audio &amp; VOICEVOX対応
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                音符に割り当てた歌詞を歌わせるシンセサイザーの声質や外部VOICEVOX連携を設定します
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

        {/* コンテンツ */}
        <div
          className="p-6 space-y-6 overflow-y-auto flex-1"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* 1. 歌声エンジンの選択 */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-600" />
              <span>1. 使用する歌声合成エンジン</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    mode: 'auto' as VocalEngineMode,
                    title: '自動切替 (推奨)',
                    desc: 'VOICEVOX接続時は高音質AI歌唱、未接続時は内蔵シンセで即再生',
                  },
                  {
                    mode: 'formant' as VocalEngineMode,
                    title: '内蔵フォルマント合成',
                    desc: '外部ソフト不要・ブラウザ単体で遅延なく五十音をシンセ歌唱',
                  },
                  {
                    mode: 'voicevox' as VocalEngineMode,
                    title: 'VOICEVOX 優先',
                    desc: 'PCで起動中のVOICEVOXソング機能を使用してリアルに歌唱',
                  },
                ]
              ).map((item) => {
                const isSelected = settings.engineMode === item.mode;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => update({ engineMode: item.mode })}
                    className={`p-3 rounded-xl text-left transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                      <span>{item.title}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 内蔵フォルマント歌声シンセのキャラクター選択 & 試聴 */}
          <div className="space-y-3 border-t border-slate-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pink-600" />
                <span>2. 内蔵ボカロシンセの声質キャラクター</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => audioEngine.previewVocal(['ど', 'れ', 'み', 'ふぁ', 'そ'])}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>「どれみふぁそ」試聴</span>
                </button>
                <button
                  type="button"
                  onClick={() => audioEngine.previewVocal(['あ', 'い', 'う', 'え', 'お'])}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-pink-600" />
                  <span>「あいうえお」試聴</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CHARACTER_OPTIONS.map((ch) => {
                const isSelected = settings.character === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      update({ character: ch.id });
                      setTimeout(() => audioEngine.previewVocal(['ら', 'ら', 'ら']), 30);
                    }}
                    className={`p-3 rounded-xl text-left transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{ch.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {ch.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">{ch.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 歌唱表現・ミキシング調整 */}
          <div className="space-y-3 border-t border-slate-200 pt-5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>3. 歌唱表現・バランス調整</span>
            </h3>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
              {/* 歌詞付き音符の自動歌唱 */}
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    歌詞がある音符をすべて自動で歌わせる
                  </div>
                  <div className="text-[11px] text-slate-600">
                    ONの場合、Voice(0)等の通常トラックでも歌詞（Lyricsや&quot;あ&quot;）を書くと自動で歌声合成になります
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.singAllLyricNotes !== false}
                  onChange={(e) => update({ singAllLyricNotes: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
              </label>

              {/* 歌声ボリューム */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-800">歌声の音量 (Vocal Volume)</span>
                  <span className="font-mono font-bold text-slate-900">
                    {Math.round((settings.vocalVolume ?? 1.25) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2.0}
                  step={0.05}
                  value={settings.vocalVolume ?? 1.25}
                  onChange={(e) => update({ vocalVolume: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* ビブラート深さ */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-800">ビブラートの深さ (Vibrato Depth)</span>
                  <span className="font-mono font-bold text-slate-900">
                    {Math.round((settings.vibratoDepth ?? 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.0}
                  step={0.1}
                  value={settings.vibratoDepth ?? 1.0}
                  onChange={(e) => update({ vibratoDepth: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* ユニゾン楽器サポート音量 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-800">
                    ユニゾン補助楽器レイヤー音量 (歌声の芯・音程補強)
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {Math.round((settings.accompanimentLayerGain ?? 0.2) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.05}
                  value={settings.accompanimentLayerGain ?? 0.2}
                  onChange={(e) => update({ accompanimentLayerGain: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  0%にすると純粋な合成音声のみ、20%前後にするとコーラス楽器が薄く重なりアンサンブルに馴染みます
                </p>
              </div>
            </div>
          </div>

          {/* 4. VOICEVOX API連携設定 (ローカルPC / Google Colab等のリモート対応) */}
          <div className="space-y-3 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Mic2 className="w-4 h-4 text-indigo-600" />
                <span>4. VOICEVOX API連携 (ローカルPC / Google Colabリモート対応)</span>
              </h3>
              {vvConnected ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  VOICEVOX 接続済み
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                  未接続 (内蔵ボカロシンセで動作中)
                </span>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={settings.voicevoxUrl}
                  onChange={(e) => update({ voicevoxUrl: e.target.value })}
                  placeholder="http://127.0.0.1:50021 または https://xxxx.trycloudflare.com"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono outline-none focus:border-blue-600"
                  style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                />
                <button
                  type="button"
                  onClick={handleTestVoicevox}
                  disabled={isCheckingVv}
                  className="flex items-center justify-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingVv ? 'animate-spin' : ''}`} />
                  <span>{isCheckingVv ? '接続確認中 (最大15秒)...' : 'VOICEVOX 接続テスト'}</span>
                </button>
              </div>

              {vvError && (
                <div className="flex items-start space-x-2 text-xs text-amber-900 bg-amber-50 border border-amber-300 p-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{vvError}</span>
                </div>
              )}

              {vvConnected && vvSingers.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    VOICEVOX シンガー（キャラクター / スタイル）選択:
                  </label>
                  <select
                    value={settings.voicevoxSpeakerId}
                    onChange={(e) => {
                      voicevoxClient.clearCache();
                      update({ voicevoxSpeakerId: parseInt(e.target.value, 10) });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium outline-none focus:border-blue-600"
                    style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                  >
                    {vvSingers.map((singer) => (
                      <optgroup key={singer.speaker_uuid} label={singer.name}>
                        {singer.styles.map((st) => (
                          <option key={st.id} value={st.id}>
                            {singer.name} - {st.name} (ID: {st.id})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              <div className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-200 pt-2.5">
                💡 <strong>VOICEVOX 接続手順 (ローカル &amp; Google Colab 対応)</strong>:
                <br />
                ・<strong>ローカルPCの場合</strong>: VOICEVOX を起動し、「<strong>設定 → オプション → CORS Policy Mode</strong>」を <code>all</code> にして接続テストを押してください。
                <br />
                ・<strong>Google Colab 等のリモートサーバーの場合</strong>: VOICEVOX Engine を <code>--cors_policy_mode all</code> 付きで起動し、Cloudflare Tunnel や ngrok 等の公開URL（<code>https://...</code>）を入力して接続テストを押してください。初回再生時は歌声の合成完了を待ってから伴奏と頭から同期再生されます。
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div
          className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 flex-shrink-0"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            完了・閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
