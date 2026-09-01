export interface PresetSong {
  id: string;
  title: string;
  description: string;
  mml: string;
}

export const PRESET_SONGS: PresetSong[] = [
  {
    id: 'twinkle',
    title: 'きらきら星 (2パート)',
    description: 'メロディと伴奏のシンプルな2トラック構成',
    mml: `// きらきら星 (Twinkle, Twinkle, Little Star)
// テンポ110 / 4分の4拍子
Tempo(110)
TimeSignature(4,4)

// Track 1: メロディパート (Piano)
TR(1) Voice(0) v105 o5 l4
c c g g | a a g2 |
f f e e | d d c2 |
g g f f | e e d2 |
g g f f | e e d2 |
c c g g | a a g2 |
f f e e | d d c2 |

// Track 2: 伴奏パート (Strings / Piano)
TR(2) Voice(48) v85 o4 l2
[c e g] [c e g] | [c f a] [c e g] |
[d f a] [c e g] | [b- d g] [c e g] |
[c e g] [d f a] | [c e g] [b- d g] |
[c e g] [d f a] | [c e g] [b- d g] |
[c e g] [c e g] | [c f a] [c e g] |
[d f a] [c e g] | [b- d g] [c e g] |
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
  }
];
