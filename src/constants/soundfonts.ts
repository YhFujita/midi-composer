/**
 * 定番・推奨 SoundFont (MIDI音源) のプリセット定義
 */

export interface SoundFontPreset {
  id: string;
  name: string;
  filename: string;
  size: number; // バイト数
  formattedSize: string;
  description: string;
  /** public/soundfonts 配下の相対パス */
  localUrl: string;
  /** オンラインからの直接ダウンロードURL (外部ミラー) */
  onlineDownloadUrl: string;
  /** アプリ初期同梱（標準）かどうか */
  isDefault?: boolean;
}

export const SOUNDFONT_PRESETS: SoundFontPreset[] = [
  {
    id: 'timgm6mb_default',
    name: 'TimGM6mb (標準GM音源)',
    filename: 'TimGM6mb.sf2',
    size: 5994284,
    formattedSize: '5.7 MB',
    description: '軽量で素早く読み込める標準GM音源。全128楽器とドラムに対応。',
    localUrl: '/soundfonts/TimGM6mb.sf2',
    onlineDownloadUrl: '',
    isDefault: true,
  },
  {
    id: 'fluidr3_gm',
    name: 'FluidR3 GM (高品位GM音源)',
    filename: 'FluidR3_GM.sf2',
    size: 148398306,
    formattedSize: '141.5 MB',
    description: '世界的に評価の高い高品位SoundFont。ピアノやストリングス、管楽器など圧倒的な生演奏の質感を実現。',
    localUrl: '/soundfonts/FluidR3_GM.sf2',
    onlineDownloadUrl: 'https://github.com/pianobooster/fluid-soundfont/releases/download/v3.1/FluidR3_GM.sf2',
    isDefault: false,
  },
];
