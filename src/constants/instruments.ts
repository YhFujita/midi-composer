export interface InstrumentInfo {
  program: number; // 0 - 127
  name: string; // 英語名
  nameJa: string; // 日本語名
  abbr: string; // 英語省略記号 (例: "Pno.", "Tb.", "Vln.")
  abbrJa: string; // 日本語省略記号 (例: "Pf", "Tb", "Vn")
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
  { program: 0, name: 'Acoustic Grand Piano', nameJa: 'アコースティック・グランドピアノ', abbr: 'Pno.', abbrJa: 'Pf', category: 'Piano', categoryJa: 'ピアノ', isFeatured: true },
  { program: 1, name: 'Bright Acoustic Piano', nameJa: 'ブライト・ピアノ', abbr: 'Br.Pno.', abbrJa: 'BrPf', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 2, name: 'Electric Grand Piano', nameJa: 'エレクトリック・グランドピアノ', abbr: 'El.Gr.Pno.', abbrJa: 'EPf', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 3, name: 'Honky-tonk Piano', nameJa: 'ホンキートンク・ピアノ', abbr: 'Hnk.Pno.', abbrJa: 'Honky', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 4, name: 'Electric Piano 1', nameJa: 'エレピ 1 (ローズ系)', abbr: 'E.Pno.1', abbrJa: 'EP1', category: 'Piano', categoryJa: 'ピアノ', isFeatured: true },
  { program: 5, name: 'Electric Piano 2', nameJa: 'エレピ 2 (DX系)', abbr: 'E.Pno.2', abbrJa: 'EP2', category: 'Piano', categoryJa: 'ピアノ' },
  { program: 6, name: 'Harpsichord', nameJa: 'ハープシコード (チェンバロ)', abbr: 'Hpsch.', abbrJa: 'Cemb', category: 'Piano', categoryJa: 'ピアノ', isFeatured: true },
  { program: 7, name: 'Clavinet', nameJa: 'クラビネット', abbr: 'Clav.', abbrJa: 'Clav', category: 'Piano', categoryJa: 'ピアノ' },

  // 9-16: Chromatic Percussion
  { program: 8, name: 'Celesta', nameJa: 'チェレスタ', abbr: 'Cel.', abbrJa: 'Cel', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 9, name: 'Glockenspiel', nameJa: 'グロッケンシュピール (鉄琴)', abbr: 'Glock.', abbrJa: 'Glock', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器', isFeatured: true },
  { program: 10, name: 'Music Box', nameJa: 'オルゴール', abbr: 'M.Box', abbrJa: 'MBox', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器', isFeatured: true },
  { program: 11, name: 'Vibraphone', nameJa: 'ヴィブラフォン', abbr: 'Vib.', abbrJa: 'Vib', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 12, name: 'Marimba', nameJa: 'マリンバ (木琴)', abbr: 'Mar.', abbrJa: 'Mar', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器', isFeatured: true },
  { program: 13, name: 'Xylophone', nameJa: 'シロフォン', abbr: 'Xyl.', abbrJa: 'Xyl', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 14, name: 'Tubular Bells', nameJa: 'チューブラーベル (鐘)', abbr: 'Tub.B.', abbrJa: '鐘', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },
  { program: 15, name: 'Dulcimer', nameJa: 'ダルシマー', abbr: 'Dulc.', abbrJa: 'Dulc', category: 'Chromatic Percussion', categoryJa: '鍵盤打楽器' },

  // 17-24: Organ
  { program: 16, name: 'Drawbar Organ', nameJa: 'ドローバー・オルガン (ハモンド)', abbr: 'Dr.Org.', abbrJa: 'Hammond', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 17, name: 'Percussive Organ', nameJa: 'パーカッシブ・オルガン', abbr: 'Perc.Org.', abbrJa: 'P.Org', category: 'Organ', categoryJa: 'オルガン' },
  { program: 18, name: 'Rock Organ', nameJa: 'ロック・オルガン', abbr: 'Rk.Org.', abbrJa: 'R.Org', category: 'Organ', categoryJa: 'オルガン' },
  { program: 19, name: 'Church Organ', nameJa: 'パイプオルガン (教会)', abbr: 'Ch.Org.', abbrJa: 'PipeOrg', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 20, name: 'Reed Organ', nameJa: 'リード・オルガン', abbr: 'Rd.Org.', abbrJa: 'RdOrg', category: 'Organ', categoryJa: 'オルガン' },
  { program: 21, name: 'Accordion', nameJa: 'アコーディオン', abbr: 'Acc.', abbrJa: 'Acc', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 22, name: 'Harmonica', nameJa: 'ハーモニカ', abbr: 'Harm.', abbrJa: 'Harm', category: 'Organ', categoryJa: 'オルガン', isFeatured: true },
  { program: 23, name: 'Tango Accordion', nameJa: 'タンゴ・アコーディオン', abbr: 'T.Acc.', abbrJa: 'TangoAcc', category: 'Organ', categoryJa: 'オルガン' },

  // 25-32: Guitar
  { program: 24, name: 'Acoustic Guitar (nylon)', nameJa: 'クラシックギター (ナイロン弦)', abbr: 'N.Gt.', abbrJa: 'CGt', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 25, name: 'Acoustic Guitar (steel)', nameJa: 'アコースティックギター (フォーク弦)', abbr: 'A.Gt.', abbrJa: 'AGt', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 26, name: 'Electric Guitar (jazz)', nameJa: 'ジャズ・ギター', abbr: 'J.Gt.', abbrJa: 'JazzGt', category: 'Guitar', categoryJa: 'ギター' },
  { program: 27, name: 'Electric Guitar (clean)', nameJa: 'クリーン・エレキギター', abbr: 'E.Gt.', abbrJa: 'EGt', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 28, name: 'Electric Guitar (muted)', nameJa: 'ミュート・エレキギター', abbr: 'M.Gt.', abbrJa: 'MutGt', category: 'Guitar', categoryJa: 'ギター' },
  { program: 29, name: 'Overdriven Guitar', nameJa: 'オーバードライブ・ギター', abbr: 'OD.Gt.', abbrJa: 'ODGt', category: 'Guitar', categoryJa: 'ギター' },
  { program: 30, name: 'Distortion Guitar', nameJa: 'ディストーション・ギター', abbr: 'Dist.Gt.', abbrJa: 'DistGt', category: 'Guitar', categoryJa: 'ギター', isFeatured: true },
  { program: 31, name: 'Guitar Harmonics', nameJa: 'ギター・ハーモニクス', abbr: 'Gt.Harm.', abbrJa: 'GtHarm', category: 'Guitar', categoryJa: 'ギター' },

  // 33-40: Bass
  { program: 32, name: 'Acoustic Bass', nameJa: 'ウッドベース (アコースティック)', abbr: 'A.Bass', abbrJa: 'W.Bass', category: 'Bass', categoryJa: 'ベース', isFeatured: true },
  { program: 33, name: 'Electric Bass (finger)', nameJa: 'エレキベース (指弾き)', abbr: 'E.Bass', abbrJa: 'EBass', category: 'Bass', categoryJa: 'ベース', isFeatured: true },
  { program: 34, name: 'Electric Bass (pick)', nameJa: 'エレキベース (ピック弾き)', abbr: 'Pk.Bass', abbrJa: 'PkBass', category: 'Bass', categoryJa: 'ベース' },
  { program: 35, name: 'Fretless Bass', nameJa: 'フレットレス・ベース', abbr: 'Fretless', abbrJa: 'Fretless', category: 'Bass', categoryJa: 'ベース' },
  { program: 36, name: 'Slap Bass 1', nameJa: 'スラップベース 1', abbr: 'Slap.1', abbrJa: 'Slap1', category: 'Bass', categoryJa: 'ベース' },
  { program: 37, name: 'Slap Bass 2', nameJa: 'スラップベース 2', abbr: 'Slap.2', abbrJa: 'Slap2', category: 'Bass', categoryJa: 'ベース' },
  { program: 38, name: 'Synth Bass 1', nameJa: 'シンセベース 1', abbr: 'Syn.Bass.1', abbrJa: 'SynBass1', category: 'Bass', categoryJa: 'ベース', isFeatured: true },
  { program: 39, name: 'Synth Bass 2', nameJa: 'シンセベース 2', abbr: 'Syn.Bass.2', abbrJa: 'SynBass2', category: 'Bass', categoryJa: 'ベース' },

  // 41-48: Strings
  { program: 40, name: 'Violin', nameJa: 'ヴァイオリン', abbr: 'Vln.', abbrJa: 'Vn', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 41, name: 'Viola', nameJa: 'ヴィオラ', abbr: 'Vla.', abbrJa: 'Va', category: 'Strings', categoryJa: '弦楽器' },
  { program: 42, name: 'Cello', nameJa: 'チェロ', abbr: 'Vc.', abbrJa: 'Vc', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 43, name: 'Contrabass', nameJa: 'コントラバス', abbr: 'Cb.', abbrJa: 'Cb', category: 'Strings', categoryJa: '弦楽器' },
  { program: 44, name: 'Tremolo Strings', nameJa: 'トレモロ・ストリングス', abbr: 'Trem.Str.', abbrJa: 'TremStr', category: 'Strings', categoryJa: '弦楽器' },
  { program: 45, name: 'Pizzicato Strings', nameJa: 'ピチカート・ストリングス', abbr: 'Pizz.Str.', abbrJa: 'Pizz', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 46, name: 'Orchestral Harp', nameJa: 'ハープ', abbr: 'Hp.', abbrJa: 'Harp', category: 'Strings', categoryJa: '弦楽器', isFeatured: true },
  { program: 47, name: 'Timpani', nameJa: 'ティンパニ', abbr: 'Timp.', abbrJa: 'Timp', category: 'Strings', categoryJa: '弦楽器' },

  // 49-56: Ensemble
  { program: 48, name: 'String Ensemble 1', nameJa: 'ストリングス合奏 1', abbr: 'Str.Ens.1', abbrJa: 'Strings', category: 'Ensemble', categoryJa: 'アンサンブル/合唱', isFeatured: true },
  { program: 49, name: 'String Ensemble 2', nameJa: 'ストリングス合奏 2', abbr: 'Str.Ens.2', abbrJa: 'Str2', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 50, name: 'Synth Strings 1', nameJa: 'シンセ・ストリングス 1', abbr: 'Syn.Str.1', abbrJa: 'SynStr1', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 51, name: 'Synth Strings 2', nameJa: 'シンセ・ストリングス 2', abbr: 'Syn.Str.2', abbrJa: 'SynStr2', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 52, name: 'Choir Aahs', nameJa: '合唱 (アー)', abbr: 'Choir', abbrJa: '合唱', category: 'Ensemble', categoryJa: 'アンサンブル/合唱', isFeatured: true },
  { program: 53, name: 'Voice Oohs', nameJa: 'コーラス (オー)', abbr: 'Voice', abbrJa: '声', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 54, name: 'Synth Voice', nameJa: 'シンセ・ボイス', abbr: 'Syn.Voice', abbrJa: 'SynVoice', category: 'Ensemble', categoryJa: 'アンサンブル/合唱' },
  { program: 55, name: 'Orchestra Hit', nameJa: 'オーケストラ・ヒット', abbr: 'Orch.Hit', abbrJa: 'OrchHit', category: 'Ensemble', categoryJa: 'アンサンブル/合唱', isFeatured: true },

  // 57-64: Brass
  { program: 56, name: 'Trumpet', nameJa: 'トランペット', abbr: 'Tp.', abbrJa: 'Tp', category: 'Brass', categoryJa: '金管楽器', isFeatured: true },
  { program: 57, name: 'Trombone', nameJa: 'トロンボーン', abbr: 'Tb.', abbrJa: 'Tb', category: 'Brass', categoryJa: '金管楽器' },
  { program: 58, name: 'Tuba', nameJa: 'チューバ', abbr: 'Tub.', abbrJa: 'Tub', category: 'Brass', categoryJa: '金管楽器' },
  { program: 59, name: 'Muted Trumpet', nameJa: 'ミュート・トランペット', abbr: 'Mut.Tp.', abbrJa: 'MutTp', category: 'Brass', categoryJa: '金管楽器' },
  { program: 60, name: 'French Horn', nameJa: 'ホルン', abbr: 'Hn.', abbrJa: 'Hr', category: 'Brass', categoryJa: '金管楽器', isFeatured: true },
  { program: 61, name: 'Brass Section', nameJa: 'ブラス・セクション', abbr: 'Brass', abbrJa: 'Brass', category: 'Brass', categoryJa: '金管楽器', isFeatured: true },
  { program: 62, name: 'Synth Brass 1', nameJa: 'シンセ・ブラス 1', abbr: 'Syn.Br.1', abbrJa: 'SynBr1', category: 'Brass', categoryJa: '金管楽器' },
  { program: 63, name: 'Synth Brass 2', nameJa: 'シンセ・ブラス 2', abbr: 'Syn.Br.2', abbrJa: 'SynBr2', category: 'Brass', categoryJa: '金管楽器' },

  // 65-72: Reed
  { program: 64, name: 'Soprano Sax', nameJa: 'ソプラノ・サックス', abbr: 'S.Sax', abbrJa: 'S.Sax', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 65, name: 'Alto Sax', nameJa: 'アルト・サックス', abbr: 'A.Sax', abbrJa: 'A.Sax', category: 'Reed', categoryJa: '木管 (リード)', isFeatured: true },
  { program: 66, name: 'Tenor Sax', nameJa: 'テナー・サックス', abbr: 'T.Sax', abbrJa: 'T.Sax', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 67, name: 'Baritone Sax', nameJa: 'バリトン・サックス', abbr: 'B.Sax', abbrJa: 'B.Sax', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 68, name: 'Oboe', nameJa: 'オーボエ', abbr: 'Ob.', abbrJa: 'Ob', category: 'Reed', categoryJa: '木管 (リード)', isFeatured: true },
  { program: 69, name: 'English Horn', nameJa: 'イングリッシュ・ホルン', abbr: 'E.Hn.', abbrJa: 'EHn', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 70, name: 'Bassoon', nameJa: 'ファゴット (バスーン)', abbr: 'Bsn.', abbrJa: 'Fg', category: 'Reed', categoryJa: '木管 (リード)' },
  { program: 71, name: 'Clarinet', nameJa: 'クラリネット', abbr: 'Cl.', abbrJa: 'Cl', category: 'Reed', categoryJa: '木管 (リード)', isFeatured: true },

  // 73-80: Pipe
  { program: 72, name: 'Piccolo', nameJa: 'ピッコロ', abbr: 'Picc.', abbrJa: 'Picc', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 73, name: 'Flute', nameJa: 'フルート', abbr: 'Fl.', abbrJa: 'Fl', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },
  { program: 74, name: 'Recorder', nameJa: 'リコーダー', abbr: 'Rec.', abbrJa: 'Rec', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },
  { program: 75, name: 'Pan Flute', nameJa: 'パンフルート', abbr: 'Pan.Fl.', abbrJa: 'PanFl', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 76, name: 'Blown Bottle', nameJa: 'ボトル・ブロー', abbr: 'Bottle', abbrJa: 'Bottle', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 77, name: 'Shakuhachi', nameJa: '尺八 (しゃくはち)', abbr: 'Shaku.', abbrJa: '尺八', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },
  { program: 78, name: 'Whistle', nameJa: '口笛 (ホイッスル)', abbr: 'Whistle', abbrJa: '口笛', category: 'Pipe', categoryJa: '笛・パイプ' },
  { program: 79, name: 'Ocarina', nameJa: 'オカリナ', abbr: 'Ocarina', abbrJa: 'オカリナ', category: 'Pipe', categoryJa: '笛・パイプ', isFeatured: true },

  // 81-88: Synth Lead
  { program: 80, name: 'Lead 1 (square)', nameJa: '矩形波リード (ファミコン風)', abbr: 'Sq.Lead', abbrJa: 'Square', category: 'Synth Lead', categoryJa: 'シンセリード', isFeatured: true },
  { program: 81, name: 'Lead 2 (sawtooth)', nameJa: 'ノコギリ波リード', abbr: 'Saw.Lead', abbrJa: 'Saw', category: 'Synth Lead', categoryJa: 'シンセリード', isFeatured: true },
  { program: 82, name: 'Lead 3 (calliope)', nameJa: 'カリオペ・リード', abbr: 'Cal.Lead', abbrJa: 'Calliope', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 83, name: 'Lead 4 (chiff)', nameJa: 'チフ・リード', abbr: 'Chiff.Ld', abbrJa: 'Chiff', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 84, name: 'Lead 5 (charang)', nameJa: 'チャラン・リード', abbr: 'Char.Ld', abbrJa: 'Charang', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 85, name: 'Lead 6 (voice)', nameJa: 'ボイス・リード', abbr: 'Vox.Lead', abbrJa: 'VoiceLd', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 86, name: 'Lead 7 (fifths)', nameJa: '5度リード', abbr: '5th.Lead', abbrJa: '5thLd', category: 'Synth Lead', categoryJa: 'シンセリード' },
  { program: 87, name: 'Lead 8 (bass + lead)', nameJa: 'ベース＋リード', abbr: 'B+L.Lead', abbrJa: 'B+L', category: 'Synth Lead', categoryJa: 'シンセリード' },

  // 89-96: Synth Pad
  { program: 88, name: 'Pad 1 (new age)', nameJa: 'ファンタジー・パッド', abbr: 'NewAge.Pd', abbrJa: 'Pad1', category: 'Synth Pad', categoryJa: 'シンセパッド', isFeatured: true },
  { program: 89, name: 'Pad 2 (warm)', nameJa: 'ウォーム・パッド', abbr: 'Warm.Pd', abbrJa: 'Pad2', category: 'Synth Pad', categoryJa: 'シンセパッド', isFeatured: true },
  { program: 90, name: 'Pad 3 (polysynth)', nameJa: 'ポリシンセ・パッド', abbr: 'Poly.Pd', abbrJa: 'Poly', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 91, name: 'Pad 4 (choir)', nameJa: 'クワイア・パッド', abbr: 'Choir.Pd', abbrJa: 'Ch.Pad', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 92, name: 'Pad 5 (bowed)', nameJa: 'ボウド・パッド', abbr: 'Bowed.Pd', abbrJa: 'Bowed', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 93, name: 'Pad 6 (metallic)', nameJa: 'メタリック・パッド', abbr: 'Met.Pd', abbrJa: 'MetPad', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 94, name: 'Pad 7 (halo)', nameJa: 'ヘイロー・パッド', abbr: 'Halo.Pd', abbrJa: 'Halo', category: 'Synth Pad', categoryJa: 'シンセパッド' },
  { program: 95, name: 'Pad 8 (sweep)', nameJa: 'スウィープ・パッド', abbr: 'Swp.Pd', abbrJa: 'Sweep', category: 'Synth Pad', categoryJa: 'シンセパッド' },

  // 97-104: Synth Effects
  { program: 96, name: 'FX 1 (rain)', nameJa: '雨 (FX)', abbr: 'FX:Rain', abbrJa: 'FX:雨', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 97, name: 'FX 2 (soundtrack)', nameJa: 'サウンドトラック (FX)', abbr: 'FX:Trk', abbrJa: 'FX:Track', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 98, name: 'FX 3 (crystal)', nameJa: 'クリスタル (FX)', abbr: 'FX:Cryst', abbrJa: 'FX:Cryst', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 99, name: 'FX 4 (atmosphere)', nameJa: 'アトモスフィア (FX)', abbr: 'FX:Atmo', abbrJa: 'FX:Atmo', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 100, name: 'FX 5 (brightness)', nameJa: 'ブライトネス (FX)', abbr: 'FX:Brite', abbrJa: 'FX:Brite', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 101, name: 'FX 6 (goblins)', nameJa: 'ゴブリン (FX)', abbr: 'FX:Gob', abbrJa: 'FX:Gob', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 102, name: 'FX 7 (echoes)', nameJa: 'エコー (FX)', abbr: 'FX:Echo', abbrJa: 'FX:Echo', category: 'Synth Effects', categoryJa: 'シンセ効果音' },
  { program: 103, name: 'FX 8 (sci-fi)', nameJa: 'SF (FX)', abbr: 'FX:SciFi', abbrJa: 'FX:SF', category: 'Synth Effects', categoryJa: 'シンセ効果音' },

  // 105-112: Ethnic
  { program: 104, name: 'Sitar', nameJa: 'シタール', abbr: 'Sitar', abbrJa: 'Sitar', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 105, name: 'Banjo', nameJa: 'バンジョー', abbr: 'Banjo', abbrJa: 'Banjo', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 106, name: 'Shamisen', nameJa: '三味線 (しゃみせん)', abbr: 'Shami.', abbrJa: '三味線', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 107, name: 'Koto', nameJa: '琴 (こと)', abbr: 'Koto', abbrJa: '琴', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 108, name: 'Kalimba', nameJa: 'カリンバ', abbr: 'Kalimba', abbrJa: 'Kalimba', category: 'Ethnic', categoryJa: '民族楽器', isFeatured: true },
  { program: 109, name: 'Bag pipe', nameJa: 'バグパイプ', abbr: 'Bagpipe', abbrJa: 'Bagpipe', category: 'Ethnic', categoryJa: '民族楽器' },
  { program: 110, name: 'Fiddle', nameJa: 'フィドル', abbr: 'Fiddle', abbrJa: 'Fiddle', category: 'Ethnic', categoryJa: '民族楽器' },
  { program: 111, name: 'Shanai', nameJa: 'シャハナーイ', abbr: 'Shanai', abbrJa: 'Shanai', category: 'Ethnic', categoryJa: '民族楽器' },

  // 113-120: Percussive
  { program: 112, name: 'Tinkle Bell', nameJa: 'ティンクル・ベル', abbr: 'T.Bell', abbrJa: 'T.Bell', category: 'Percussive', categoryJa: '打楽器' },
  { program: 113, name: 'Agogo', nameJa: 'アゴゴ', abbr: 'Agogo', abbrJa: 'Agogo', category: 'Percussive', categoryJa: '打楽器' },
  { program: 114, name: 'Steel Drums', nameJa: 'スチール・ドラム', abbr: 'St.Drums', abbrJa: 'SteelDr', category: 'Percussive', categoryJa: '打楽器', isFeatured: true },
  { program: 115, name: 'Woodblock', nameJa: 'ウッドブロック', abbr: 'W.Block', abbrJa: 'WBlock', category: 'Percussive', categoryJa: '打楽器' },
  { program: 116, name: 'Taiko Drum', nameJa: '和太鼓 (たいこ)', abbr: 'Taiko', abbrJa: '和太鼓', category: 'Percussive', categoryJa: '打楽器', isFeatured: true },
  { program: 117, name: 'Melodic Tom', nameJa: 'メロディック・タム', abbr: 'Mel.Tom', abbrJa: 'Tom', category: 'Percussive', categoryJa: '打楽器' },
  { program: 118, name: 'Synth Drum', nameJa: 'シンセ・ドラム', abbr: 'Syn.Dr.', abbrJa: 'SynDr', category: 'Percussive', categoryJa: '打楽器' },
  { program: 119, name: 'Reverse Cymbal', nameJa: '逆再生シンバル', abbr: 'Rev.Cym.', abbrJa: 'RevCym', category: 'Percussive', categoryJa: '打楽器' },

  // 121-128: Sound Effects
  { program: 120, name: 'Guitar Fret Noise', nameJa: 'ギター・フレットノイズ', abbr: 'Fret.Nz', abbrJa: 'Fret', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 121, name: 'Breath Noise', nameJa: 'ブレスノイズ', abbr: 'Brth.Nz', abbrJa: 'Breath', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 122, name: 'Seashore', nameJa: '波の音 (海岸)', abbr: 'Sea', abbrJa: '波', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 123, name: 'Bird Tweet', nameJa: '小鳥のさえずり', abbr: 'Bird', abbrJa: '鳥', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 124, name: 'Telephone Ring', nameJa: '電話のベル', abbr: 'Phone', abbrJa: '電話', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 125, name: 'Helicopter', nameJa: 'ヘリコプター', abbr: 'Heli', abbrJa: 'ヘリ', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 126, name: 'Applause', nameJa: '拍手・歓声', abbr: 'Applaus', abbrJa: '拍手', category: 'Sound Effects', categoryJa: '効果音' },
  { program: 127, name: 'Gunshot', nameJa: '銃声', abbr: 'Gunshot', abbrJa: '銃声', category: 'Sound Effects', categoryJa: '効果音' },
];

/** プログラム番号から楽器情報を取得 */
export function getInstrumentByProgram(program: number): InstrumentInfo {
  const found = INSTRUMENTS.find((inst) => inst.program === program);
  return (
    found || {
      program,
      name: `Instrument ${program}`,
      nameJa: `音色 ${program}`,
      abbr: `Inst.${program}`,
      abbrJa: `音色${program}`,
      category: 'Unknown',
      categoryJa: 'その他',
    }
  );
}

/** クイック選択用の代表的な楽器リスト */
export const POPULAR_INSTRUMENTS: InstrumentInfo[] = INSTRUMENTS.filter((inst) => inst.isFeatured);
