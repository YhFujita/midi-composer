export interface InstrumentInfo {
  program: number; // 0 - 127
  name: string; // 英語名
  nameJa: string; // 日本語名
  category: string; // カテゴリ名 (英語)
  categoryJa: string; // カテゴリ名 (日本語)
  isFeatured?: boolean; // よく使われる代表的な楽器
}

export interface InstrumentCategory {
  id: string;
  name: string;
  nameJa: string;
  range: [number, number];
}

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  { id: 'all', name: 'All', nameJa: 'すべて', range: [0, 127] },
  { id: 'piano', name: 'Piano', nameJa: 'ピアノ', range: [0, 7] },
  { id: 'chromatic', name: 'Chromatic Percussion', nameJa: '鍵盤打楽器', range: [8, 15] },
  { id: 'organ', name: 'Organ', nameJa: 'オルガン', range: [16, 23] },
  { id: 'guitar', name: 'Guitar', nameJa: 'ギター', range: [24, 31] },
  { id: 'bass', name: 'Bass', nameJa: 'ベース', range: [32, 39] },
  { id: 'strings', name: 'Strings', nameJa: '弦楽器', range: [40, 47] },
  { id: 'ensemble', name: 'Ensemble', nameJa: 'アンサンブル/合唱', range: [48, 55] },
  { id: 'brass', name: 'Brass', nameJa: '金管楽器', range: [56, 63] },
  { id: 'reed', name: 'Reed', nameJa: '木管 (リード)', range: [64, 71] },
  { id: 'pipe', name: 'Pipe', nameJa: '笛・パイプ', range: [72, 79] },
  { id: 'synth-lead', name: 'Synth Lead', nameJa: 'シンセリード', range: [80, 87] },
  { id: 'synth-pad', name: 'Synth Pad', nameJa: 'シンセパッド', range: [88, 95] },
  { id: 'synth-fx', name: 'Synth Effects', nameJa: 'シンセ効果音', range: [96, 103] },
  { id: 'ethnic', name: 'Ethnic', nameJa: '民族楽器', range: [104, 111] },
  { id: 'percussive', name: 'Percussive', nameJa: '打楽器', range: [112, 119] },
  { id: 'sfx', name: 'Sound Effects', nameJa: '効果音', range: [120, 127] },
];

export const INSTRUMENTS: InstrumentInfo[] = [
  // 1-8: Piano
  { program: 0, name: 'Acoustic Grand Piano', nameJa: 'アコースティック・グランドピアノ', category: 'Piano', categoryJa: 'ピアノ', isFeatured: true },
  { program: 1, name: 'Bright Acoustic Piano', nameJa: 'ブライト・ピアノ', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 2, name: 'Electric Grand Piano', nameJa: 'エレクトリック・グランドピアノ', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 3, name: 'Honky-tonk Piano', nameJa: 'ホンキートンク・ピアノ', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 4, name: 'Electric Piano 1', nameJa: 'エレピ 1 (ローズ系)', category: 'Piano', categoryJa: 'ピアノ', isFeatured: true },
  { program: 5, name: 'Electric Piano 2', nameJa: 'エレピ 2 (DX系)', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 6, name: 'Harpsichord', nameJa: 'ハープシコード (チェンバロ)', category: 'Piano', categoryJa: 'ピアノ', isFeatured: true },
  { program: 7, name: 'Clavinet', nameJa: 'クラビネット', category: 'Piano', categoryJa: 'ピアノ' },

  // 9-16: Chromatic Percussion
  { program: 8, name: 'Celesta', nameJa: 'チェレスタ', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 9, name: 'Glockenspiel', nameJa: 'グロッケンシュピール (鉄琴)', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器', isFeatured: true },
  { program: 10, name: 'Music Box', nameJa: 'オルゴール', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器', isFeatured: true },
  { program: 11, name: 'Vibraphone', nameJa: 'ヴィブラフォン', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 12, name: 'Marimba', nameJa: 'マリンバ (木琴)', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器', isFeatured: true },
  { program: 13, name: 'Xylophone', nameJa: 'シロフォン', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 14, name: 'Tubular Bells', nameJa: 'チューブラーベル (鐘)', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 15, name: 'Dulcimer', nameJa: 'ダルシマー', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },

  // 17-24: Organ
  { program: 16, name: 'Drawbar Organ', nameJa: 'ドローバー・オルガン (ハモンド)', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 17, name: 'Percussive Organ', nameJa: 'パーカッシブ・オルガン', category: 'Organ', categoryJa: 'オルガン' },
  { program: 18, name: 'Rock Organ', nameJa: 'ロック・オルガン', category: 'Organ', categoryJa: 'オルガン' },
  { program: 19, name: 'Church Organ', nameJa: 'パイプオルガン (教会)', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 20, name: 'Reed Organ', nameJa: 'リード・オルガン', category: 'Organ', categoryJa: 'オルガン' },
  { program: 21, name: 'Accordion', nameJa: 'アコーディオン', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 22, name: 'Harmonica', nameJa: 'ハーモニカ', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 23, name: 'Tango Accordion', nameJa: 'タンゴ・アコーディオン', category: 'Organ', categoryJa: 'オルガン' },

  // 25-32: Guitar
  { program: 24, name: 'Acoustic Guitar (nylon)', nameJa: 'クラシックギター (ナイロン弦)', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 25, name: 'Acoustic Guitar (steel)', nameJa: 'アコースティックギター (フォーク弦)', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 26, name: 'Electric Guitar (jazz)', nameJa: 'ジャズ・ギター', category: 'Guitar', categoryJa: 'ギター' },
  { program: 27, name: 'Electric Guitar (clean)', nameJa: 'クリーン・エレキギター', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 28, name: 'Electric Guitar (muted)', nameJa: 'ミュート・エレキギター', category: 'Guitar', categoryJa: 'ギター' },
  { program: 29, name: 'Overdriven Guitar', nameJa: 'オーバードライブ・ギター', category: 'Guitar', categoryJa: 'ギター' },
  { program: 30, name: 'Distortion Guitar', nameJa: 'ディストーション・ギター', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 31, name: 'Guitar Harmonics', nameJa: 'ギター・ハーモニクス', category: 'Guitar', categoryJa: 'ギター' },

  // 33-40: Bass
  { program: 32, name: 'Acoustic Bass', nameJa: 'ウッドベース (アコースティック)', category: 'Bass', categoryJa: 'ベース', isFeatured: true },
  { program: 33, name: 'Electric Bass (finger)', nameJa: 'エレキベース (指弾き)', category: 'Bass', categoryJa: 'ベース', isFeatured: true },
  { program: 34, name: 'Electric Bass (pick)', nameJa: 'エレキベース (ピック弾き)', category: 'Bass', categoryJa: 'ベース' },
  { program: 35, name: 'Fretless Bass', nameJa: 'フレットレス・ベース', category: 'Bass', categoryJa: 'ベース' },
  { program: 36, name: 'Slap Bass 1', nameJa: 'スラップベース 1', category: 'Bass', categoryJa: 'ベース' },
  { program: 37, name: 'Slap Bass 2', nameJa: 'スラップベース 2', category: 'Bass', categoryJa: 'ベース' },
  { program: 38, name: 'Synth Bass 1', nameJa: 'シンセベース 1', category: 'Bass', categoryJa: 'ベース', isFeatured: true },
  { program: 39, name: 'Synth Bass 2', nameJa: 'シンセベース 2', category: 'Bass', categoryJa: 'ベース' },

  // 41-48: Strings
  { program: 40, name: 'Violin', nameJa: 'ヴァイオリン', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 41, name: 'Viola', nameJa: 'ヴィオラ', category: 'Strings', categoryJa: '弦楽器' },
  { program: 42, name: 'Cello', nameJa: 'チェロ', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 43, name: 'Contrabass', nameJa: 'コントラバス', category: 'Strings', categoryJa: '弦楽器' },
  { program: 44, name: 'Tremolo Strings', nameJa: 'トレモロ・ストリングス', category: 'Strings', categoryJa: '弦楽器' },
  { program: 45, name: 'Pizzicato Strings', nameJa: 'ピチカート・ストリングス', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 46, name: 'Orchestral Harp', nameJa: 'ハープ', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 47, name: 'Timpani', nameJa: 'ティンパニ', category: 'Strings', categoryJa: '弦楽器' },

  // 49-56: Ensemble
  { program: 48, name: 'String Ensemble 1', nameJa: 'ストリングス合奏 1', category: 'Ensemble', categoryJa: 'アンサンブル/合唱', isFeatured: true },
  { program: 49, name: 'String Ensemble 2', nameJa: 'ストリングス合奏 2', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 50, name: 'Synth Strings 1', nameJa: 'シンセ・ストリングス 1', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 51, name: 'Synth Strings 2', nameJa: 'シンセ・ストリングス 2', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 52, name: 'Choir Aahs', nameJa: '合唱 (アー)', category: 'Ensemble', categoryJa: 'アンサンブル/合唱', isFeatured: true },
  { program: 53, name: 'Voice Oohs', nameJa: 'コーラス (オー)', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 54, name: 'Synth Voice', nameJa: 'シンセ・ボイス', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 55, name: 'Orchestra Hit', nameJa: 'オーケストラ・ヒット', category: 'Ensemble', categoryJa: 'アンサンブル/合唱', isFeatured: true },

  // 57-64: Brass
  { program: 56, name: 'Trumpet', nameJa: 'トランペット', category: 'Brass', categoryJa: '金管楽器', isFeatured: true },
  { program: 57, name: 'Trombone', nameJa: 'トロンボーン', category: 'Brass', categoryJa: '金管楽器' },
  { program: 58, name: 'Tuba', nameJa: 'チューバ', category: 'Brass', categoryJa: '金管楽器' },
  { program: 59, name: 'Muted Trumpet', nameJa: 'ミュート・トランペット', category: 'Brass', categoryJa: '金管楽器' },
  { program: 60, name: 'French Horn', nameJa: 'ホルン', category: 'Brass', categoryJa: '金管楽器', isFeatured: true },
  { program: 61, name: 'Brass Section', nameJa: 'ブラス・セクション', category: 'Brass', categoryJa: '金管楽器', isFeatured: true },
  { program: 62, name: 'Synth Brass 1', nameJa: 'シンセ・ブラス 1', category: 'Brass', categoryJa: '金管楽器' },
  { program: 63, name: 'Synth Brass 2', nameJa: 'シンセ・ブラス 2', category: 'Brass', categoryJa: '金管楽器' },

  // 65-72: Reed
  { program: 64, name: 'Soprano Sax', nameJa: 'ソプラノ・サックス', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 65, name: 'Alto Sax', nameJa: 'アルト・サックス', category: 'Reed', categoryJa: '木管 (リード)', isFeatured: true },
  { program: 66, name: 'Tenor Sax', nameJa: 'テナー・サックス', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 67, name: 'Baritone Sax', nameJa: 'バリトン・サックス', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 68, name: 'Oboe', nameJa: 'オーボエ', category: 'Reed', categoryJa: '木管 (リード)', isFeatured: true },
  { program: 69, name: 'English Horn', nameJa: 'イングリッシュ・ホルン', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 70, name: 'Bassoon', nameJa: 'ファゴット (バスーン)', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 71, name: 'Clarinet', nameJa: 'クラリネット', category: 'Reed', categoryJa: '木管 (リード)', isFeatured: true },

  // 73-80: Pipe
  { program: 72, name: 'Piccolo', nameJa: 'ピッコロ', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 73, name: 'Flute', nameJa: 'フルート', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },
  { program: 74, name: 'Recorder', nameJa: 'リコーダー', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },
  { program: 75, name: 'Pan Flute', nameJa: 'パンフルート', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 76, name: 'Blown Bottle', nameJa: 'ボトル・ブロー', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 77, name: 'Shakuhachi', nameJa: '尺八 (しゃくはち)', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },
  { program: 78, name: 'Whistle', nameJa: '口笛 (ホイッスル)', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 79, name: 'Ocarina', nameJa: 'オカリナ', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },

  // 81-88: Synth Lead
  { program: 80, name: 'Lead 1 (square)', nameJa: '矩形波リード (ファミコン風)', category: 'Synth Lead', categoryJa: 'シンセリード', isFeatured: true },
  { program: 81, name: 'Lead 2 (sawtooth)', nameJa: 'ノコギリ波リード', category: 'Synth Lead', categoryJa: 'シンセリード', isFeatured: true },
  { program: 82, name: 'Lead 3 (calliope)', nameJa: 'カリオペ・リード', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 83, name: 'Lead 4 (chiff)', nameJa: 'チフ・リード', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 84, name: 'Lead 5 (charang)', nameJa: 'チャラン・リード', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 85, name: 'Lead 6 (voice)', nameJa: 'ボイス・リード', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 86, name: 'Lead 7 (fifths)', nameJa: '5度リード', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 87, name: 'Lead 8 (bass + lead)', nameJa: 'ベース＋リード', category: 'Synth Lead', categoryJa: 'シンセリード' },

  // 89-96: Synth Pad
  { program: 88, name: 'Pad 1 (new age)', nameJa: 'ファンタジー・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド', isFeatured: true },
  { program: 89, name: 'Pad 2 (warm)', nameJa: 'ウォーム・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド', isFeatured: true },
  { program: 90, name: 'Pad 3 (polysynth)', nameJa: 'ポリシンセ・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 91, name: 'Pad 4 (choir)', nameJa: 'クワイア・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 92, name: 'Pad 5 (bowed)', nameJa: 'ボウド・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 93, name: 'Pad 6 (metallic)', nameJa: 'メタリック・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 94, name: 'Pad 7 (halo)', nameJa: 'ヘイロー・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 95, name: 'Pad 8 (sweep)', nameJa: 'スウィープ・パッド', category: 'Synth Pad', categoryJa: 'シンセパッド' },

  // 97-104: Synth Effects
  { program: 96, name: 'FX 1 (rain)', nameJa: '雨 (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 97, name: 'FX 2 (soundtrack)', nameJa: 'サウンドトラック (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 98, name: 'FX 3 (crystal)', nameJa: 'クリスタル (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 99, name: 'FX 4 (atmosphere)', nameJa: 'アトモスフィア (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 100, name: 'FX 5 (brightness)', nameJa: 'ブライトネス (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 101, name: 'FX 6 (goblins)', nameJa: 'ゴブリン (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 102, name: 'FX 7 (echoes)', nameJa: 'エコー (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 103, name: 'FX 8 (sci-fi)', nameJa: 'SF (FX)', category: 'Synth Effects', categoryJa: 'シンセ効果音' },

  // 105-112: Ethnic
  { program: 104, name: 'Sitar', nameJa: 'シタール', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 105, name: 'Banjo', nameJa: 'バンジョー', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 106, name: 'Shamisen', nameJa: '三味線 (しゃみせん)', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 107, name: 'Koto', nameJa: '琴 (こと)', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 108, name: 'Kalimba', nameJa: 'カリンバ', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 109, name: 'Bag pipe', nameJa: 'バグパイプ', category: 'Ethnic', categoryJa: '民族楽器' },
  { program: 110, name: 'Fiddle', nameJa: 'フィドル', category: 'Ethnic', categoryJa: '民族楽器' },
  { program: 111, name: 'Shanai', nameJa: 'シャハナーイ', category: 'Ethnic', categoryJa: '民族楽器' },

  // 113-120: Percussive
  { program: 112, name: 'Tinkle Bell', nameJa: 'ティンクル・ベル', category: 'Percussive', categoryJa: '打楽器' },
  { program: 113, name: 'Agogo', nameJa: 'アゴゴ', category: 'Percussive', categoryJa: '打楽器' },
  { program: 114, name: 'Steel Drums', nameJa: 'スチール・ドラム', category: 'Percussive', categoryJa: '打楽器', isFeatured: true },
  { program: 115, name: 'Woodblock', nameJa: 'ウッドブロック', category: 'Percussive', categoryJa: '打楽器' },
  { program: 116, name: 'Taiko Drum', nameJa: '和太鼓 (たいこ)', category: 'Percussive', categoryJa: '打楽器', isFeatured: true },
  { program: 117, name: 'Melodic Tom', nameJa: 'メロディック・タム', category: 'Percussive', categoryJa: '打楽器' },
  { program: 118, name: 'Synth Drum', nameJa: 'シンセ・ドラム', category: 'Percussive', categoryJa: '打楽器' },
  { program: 119, name: 'Reverse Cymbal', nameJa: '逆再生シンバル', category: 'Percussive', categoryJa: '打楽器' },

  // 121-128: Sound Effects
  { program: 120, name: 'Guitar Fret Noise', nameJa: 'ギター・フレットノイズ', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 121, name: 'Breath Noise', nameJa: 'ブレスノイズ', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 122, name: 'Seashore', nameJa: '波の音 (海岸)', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 123, name: 'Bird Tweet', nameJa: '小鳥のさえずり', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 124, name: 'Telephone Ring', nameJa: '電話のベル', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 125, name: 'Helicopter', nameJa: 'ヘリコプター', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 126, name: 'Applause', nameJa: '拍手・歓声', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 127, name: 'Gunshot', nameJa: '銃声', category: 'Sound Effects', categoryJa: '効果音' },
];

/** プログラム番号から楽器情報を取得 */
export function getInstrumentByProgram(program: number): InstrumentInfo {
  const found = INSTRUMENTS.find((inst) => inst.program === program);
  return (
    found || {
      program,
      name: `Instrument ${program}`,
      nameJa: `音色 ${program}`,
      category: 'Unknown',
      categoryJa: 'その他',
    }
  );
}

/** クイック選択用の代表的な楽器リスト */
export const POPULAR_INSTRUMENTS: InstrumentInfo[] = INSTRUMENTS.filter((inst) => inst.isFeatured);
