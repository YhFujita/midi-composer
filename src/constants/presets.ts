export interface PresetSong {
  id: string;
  title: string;
  description: string;
  mml: string;
}

export const PRESET_SONGS: PresetSong[] = [
  {
    id: 'twinkle',
    title: '🎤 きらきら星 (ボカロ歌詞付き・2パート)',
    description: '歌詞付きメロディ（ボカロ歌唱）と伴奏の2トラック構成',
    mml: `// きらきら星 (Twinkle, Twinkle, Little Star)
// テンポ110 / 4分の4拍子
Tempo(110)
TimeSignature(4,4)

// Track 1: ボーカルパート (Lyrics一括指定 & 音符ごと歌詞指定の両方に対応)
TR(1) Voice(129) /* ボーカル・歌声合成 */ v108 o5 l4
Lyrics("きらきらひかる")
c c g g | a a g2 |
Lyrics("おそらのほしよ")
f f e e | d d c2 |
Lyrics("まばたきしては")
g g f f | e e d2 |
Lyrics("みんなをみてる")
g g f f | e e d2 |
// 音符ごとに "歌詞" を直接書く記法でも指定できます
c"き" c"ら" g"き" g"ら" | a"ひ" a"か" g2"る" |
f"お" f"そ" e"ら" e"の" | d"ほ" d"し" c2"よ" |

// Track 2: 伴奏パート (Strings / Piano)
TR(2) Voice(48) v80 o4 l2
[c e g] [c e g] | [c f a] [c e g] |
[d f a] [c e g] | [b- d g] [c e g] |
[c e g] [d f a] | [c e g] [b- d g] |
[c e g] [d f a] | [c e g] [b- d g] |
[c e g] [c e g] | [c f a] [c e g] |
[d f a] [c e g] | [b- d g] [c e g] |
`
  },
  {
    id: 'haru_no_ogawa',
    title: '🎤 春の小川 (ボカロ歌唱＆伴奏)',
    description: '日本語の五母音・子音・拗音を歌うボカロ歌唱サンプル',
    mml: `// 春の小川 (ボーカル＆ピアノ伴奏)
Tempo(108)
TimeSignature(4,4)

// Track 1: ボーカルパート
TR(1) Voice(129) v110 o4 l8
Lyrics("はるのおがわは さらさらいくよ")
g4 > c4 c8 d8 e4 | c8 d8 e8 c8 d4 c4 |
Lyrics("きしのすみれや れんげのはなに")
< g4 > c4 c8 d8 e4 | c8 d8 e8 g8 d4 c4 |

// Track 2: アコースティックピアノ伴奏
TR(2) Voice(0) v82 o4 l4
[c e g] [c e g] [c f a] [c e g] | [c e g] [a > c e <] [f a > d <] [c e g] |
[c e g] [c e g] [c f a] [c e g] | [c e g] [a > c e <] [g b > d <] [c e g] |
`
  },
  {
    id: 'canon',
    title: 'パッヘルベルのカノン (3パート)',
    description: 'カノン進行によるアンサンブル（フルート、ストリングス、チェロ）',
    mml: `// パッヘルベルのカノン (Pachelbel's Canon in D)
Tempo(96)
TimeSignature(4,4)

// Track 1: フルート (Flute)
TR(1) Voice(73) v105 o5 l4
f# e d c# | < b a b > c# |
d c# < b a | g f# g e |
f#8 a8 g8 f#8 e8 g8 f#8 e8 | d8 f#8 e8 d8 c#8 e8 d8 c#8 |
< b8 > d8 c#8 < b8 a8 > c#8 < b8 a8 | g8 b8 a8 g8 f#8 a8 g8 f#8 |
f#2 e2 | d2 c#2 | < b2 a2 | b2 > c#2 | d1 |

// Track 2: バイオリン (Strings)
TR(2) Voice(48) v90 o4 l2
[d f# a] [a > c# e <] | [b > d f# <] [f# a > c# <] |
[g b > d <] [d f# a] | [g b > d <] [a > c# e <] |
[d f# a] [a > c# e <] | [b > d f# <] [f# a > c# <] |
[g b > d <] [d f# a] | [g b > d <] [a > c# e <] |
[d f# a]1 |

// Track 3: 通奏低音 (Acoustic Bass)
TR(3) Voice(32) v100 o3 l4
d4 < a4 b4 f#4 | g4 d4 g4 a4 |
d4 < a4 b4 f#4 | g4 d4 g4 a4 |
d4 < a4 b4 f#4 | g4 d4 g4 a4 |
d4 < a4 b4 f#4 | g4 d4 g4 a4 |
d1 |
`
  },
  {
    id: 'minuet',
    title: 'バッハのメヌエット (2パート)',
    description: 'J.S.バッハのト長調メヌエット (BWV Anh. 114)',
    mml: `// バッハのメヌエット (Minuet in G major)
Tempo(120)
TimeSignature(3,4)

// Track 1: ピアノ右手
TR(1) Voice(0) v105 o5 l4
d8 g8 a8 b8 > c8 d8 | < g4 g4 g4 |
> e8 c8 d8 e8 f#8 g8 | < g4 g4 g4 |
> c8 d8 c8 < b8 a8 b8 | > c8 < b8 a8 g8 f#8 g8 |
a8 b8 a8 g8 f#8 e8 | d2. |

// Track 2: ピアノ左手
TR(2) Voice(0) v90 o4 l4
[g b]2. | [f# a]2. |
[e g]2. | [d f#]2. |
[e g]2. | [d f#]2. |
[c e]2. | [d f# a]2. |
`
  },
  {
    id: 'pop_drums',
    title: 'ポップス・ドラムビート (3パート: 鍵盤/ベース/ドラム)',
    description: 'エレクトリックピアノ、ベース、8ビートドラムのアンサンブル',
    mml: `// ポップス・ドラムビート (Pops Drum Groove)
Tempo(124)
TimeSignature(4,4)

// Track 1: エレクトリックピアノ (EPiano)
TR(1) Voice(4) v100 o4 l8
[c e g b]4. [c e g b]4. [c e g b]4 | [a > c e g <]4. [a > c e g <]4. [a > c e g <]4 |
[f a > c e <]4. [f a > c e <]4. [f a > c e <]4 | [g b > d f <]4. [g b > d f <]4. [g b > d f <]4 |

// Track 2: エレキベース (Electric Bass)
TR(2) Voice(33) v105 o2 l8
c4 c8 c8 c4 c8 c8 | a4 a8 a8 a4 a8 a8 |
f4 f8 f8 f4 f8 f8 | g4 g8 g8 g4 g8 g8 |

// Track 3: ドラムセット (Drum Kit: Ch 10)
// o2 c: バスドラム(Kick=36), o2 d: スネア(Snare=38), o2 f#: クローズハイハット(Hi-Hat=42)
TR(3) CH(10) v100 o2 l8
[c f#] f# [d f#] f# [c f#] [c f#] [d f#] f# |
[c f#] f# [d f#] f# [c f#] [c f#] [d f#] f# |
[c f#] f# [d f#] f# [c f#] [c f#] [d f#] f# |
[c f#] f# [d f#] f# [c f#] [c f#] [d f#] f# |
`
  }
];
