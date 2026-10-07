// 調号（Key Signature）および音楽理論ユーティリティ

export type AccidentalChar = '#' | 'b' | 'n';

export interface KeySignatureInfo {
  name: string;              // 標準調名 (例: "E", "F#", "Bb", "Am")
  vexKey: string;            // VexFlow 用調名 (例: "E", "F#", "Bb", "Am")
  isMinor: boolean;          // 短調フラグ
  accidentalsCount: number;  // 正: シャープ数, 負: フラット数, 0: なし
  alteredNotes: Record<string, '#' | 'b'>; // 幹音に対する変化記号 (例: { F: '#', C: '#', G: '#', D: '#' })
}

// 幹音の順序
// シャープの付く順序: F, C, G, D, A, E, B (ファ・ド・ソ・レ・ラ・ミ・シ)
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

// フラットの付く順序: B, E, A, D, G, C, F (シ・ミ・ラ・レ・ソ・ド・ファ)
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * シャープまたはフラットの個数から各幹音の変化記号マップを生成
 */
function createAlteredMap(count: number): Record<string, '#' | 'b'> {
  const map: Record<string, '#' | 'b'> = {};
  if (count > 0) {
    const num = Math.min(count, 7);
    for (let i = 0; i < num; i++) {
      map[SHARP_ORDER[i]] = '#';
    }
  } else if (count < 0) {
    const num = Math.min(Math.abs(count), 7);
    for (let i = 0; i < num; i++) {
      map[FLAT_ORDER[i]] = 'b';
    }
  }
  return map;
}

// 標準調定義マスターテーブル
// key は小文字化した調名（別名含む）
const KEY_DEFINITIONS: Record<string, { standardName: string; vexKey: string; isMinor: boolean; count: number }> = {
  // 長調 (Major)
  'c': { standardName: 'C', vexKey: 'C', isMinor: false, count: 0 },
  '0': { standardName: 'C', vexKey: 'C', isMinor: false, count: 0 },
  '=': { standardName: 'C', vexKey: 'C', isMinor: false, count: 0 },
  'natural': { standardName: 'C', vexKey: 'C', isMinor: false, count: 0 },
  '♮': { standardName: 'C', vexKey: 'C', isMinor: false, count: 0 },
  'g': { standardName: 'G', vexKey: 'G', isMinor: false, count: 1 },
  'd': { standardName: 'D', vexKey: 'D', isMinor: false, count: 2 },
  'a': { standardName: 'A', vexKey: 'A', isMinor: false, count: 3 },
  'e': { standardName: 'E', vexKey: 'E', isMinor: false, count: 4 },
  'b': { standardName: 'B', vexKey: 'B', isMinor: false, count: 5 },
  'f#': { standardName: 'F#', vexKey: 'F#', isMinor: false, count: 6 },
  'f+': { standardName: 'F#', vexKey: 'F#', isMinor: false, count: 6 },
  'c#': { standardName: 'C#', vexKey: 'C#', isMinor: false, count: 7 },
  'c+': { standardName: 'C#', vexKey: 'C#', isMinor: false, count: 7 },
  'f': { standardName: 'F', vexKey: 'F', isMinor: false, count: -1 },
  'bb': { standardName: 'Bb', vexKey: 'Bb', isMinor: false, count: -2 },
  'b-': { standardName: 'Bb', vexKey: 'Bb', isMinor: false, count: -2 },
  'b_': { standardName: 'Bb', vexKey: 'Bb', isMinor: false, count: -2 },
  'eb': { standardName: 'Eb', vexKey: 'Eb', isMinor: false, count: -3 },
  'e-': { standardName: 'Eb', vexKey: 'Eb', isMinor: false, count: -3 },
  'e_': { standardName: 'Eb', vexKey: 'Eb', isMinor: false, count: -3 },
  'ab': { standardName: 'Ab', vexKey: 'Ab', isMinor: false, count: -4 },
  'a-': { standardName: 'Ab', vexKey: 'Ab', isMinor: false, count: -4 },
  'a_': { standardName: 'Ab', vexKey: 'Ab', isMinor: false, count: -4 },
  'db': { standardName: 'Db', vexKey: 'Db', isMinor: false, count: -5 },
  'd-': { standardName: 'Db', vexKey: 'Db', isMinor: false, count: -5 },
  'd_': { standardName: 'Db', vexKey: 'Db', isMinor: false, count: -5 },
  'gb': { standardName: 'Gb', vexKey: 'Gb', isMinor: false, count: -6 },
  'g-': { standardName: 'Gb', vexKey: 'Gb', isMinor: false, count: -6 },
  'g_': { standardName: 'Gb', vexKey: 'Gb', isMinor: false, count: -6 },
  'cb': { standardName: 'Cb', vexKey: 'Cb', isMinor: false, count: -7 },
  'c-': { standardName: 'Cb', vexKey: 'Cb', isMinor: false, count: -7 },
  'c_': { standardName: 'Cb', vexKey: 'Cb', isMinor: false, count: -7 },

  // 短調 (Minor)
  'am': { standardName: 'Am', vexKey: 'Am', isMinor: true, count: 0 },
  'em': { standardName: 'Em', vexKey: 'Em', isMinor: true, count: 1 },
  'bm': { standardName: 'Bm', vexKey: 'Bm', isMinor: true, count: 2 },
  'f#m': { standardName: 'F#m', vexKey: 'F#m', isMinor: true, count: 3 },
  'f+m': { standardName: 'F#m', vexKey: 'F#m', isMinor: true, count: 3 },
  'c#m': { standardName: 'C#m', vexKey: 'C#m', isMinor: true, count: 4 },
  'c+m': { standardName: 'C#m', vexKey: 'C#m', isMinor: true, count: 4 },
  'g#m': { standardName: 'G#m', vexKey: 'G#m', isMinor: true, count: 5 },
  'g+m': { standardName: 'G#m', vexKey: 'G#m', isMinor: true, count: 5 },
  'd#m': { standardName: 'D#m', vexKey: 'D#m', isMinor: true, count: 6 },
  'd+m': { standardName: 'D#m', vexKey: 'D#m', isMinor: true, count: 6 },
  'a#m': { standardName: 'A#m', vexKey: 'A#m', isMinor: true, count: 7 },
  'a+m': { standardName: 'A#m', vexKey: 'A#m', isMinor: true, count: 7 },
  'dm': { standardName: 'Dm', vexKey: 'Dm', isMinor: true, count: -1 },
  'gm': { standardName: 'Gm', vexKey: 'Gm', isMinor: true, count: -2 },
  'cm': { standardName: 'Cm', vexKey: 'Cm', isMinor: true, count: -3 },
  'fm': { standardName: 'Fm', vexKey: 'Fm', isMinor: true, count: -4 },
  'bbm': { standardName: 'Bbm', vexKey: 'Bbm', isMinor: true, count: -5 },
  'b-m': { standardName: 'Bbm', vexKey: 'Bbm', isMinor: true, count: -5 },
  'b_m': { standardName: 'Bbm', vexKey: 'Bbm', isMinor: true, count: -5 },
  'ebm': { standardName: 'Ebm', vexKey: 'Ebm', isMinor: true, count: -6 },
  'e-m': { standardName: 'Ebm', vexKey: 'Ebm', isMinor: true, count: -6 },
  'e_m': { standardName: 'Ebm', vexKey: 'Ebm', isMinor: true, count: -6 },
  'abm': { standardName: 'Abm', vexKey: 'Abm', isMinor: true, count: -7 },
  'a-m': { standardName: 'Abm', vexKey: 'Abm', isMinor: true, count: -7 },
  'a_m': { standardName: 'Abm', vexKey: 'Abm', isMinor: true, count: -7 },

  // 音名列挙によるシャープ系調号エイリアス (fcgdae 等)
  '+f': { standardName: 'G', vexKey: 'G', isMinor: false, count: 1 },
  '+fc': { standardName: 'D', vexKey: 'D', isMinor: false, count: 2 },
  '+fcg': { standardName: 'A', vexKey: 'A', isMinor: false, count: 3 },
  '+fcgd': { standardName: 'E', vexKey: 'E', isMinor: false, count: 4 },
  '+fcgda': { standardName: 'B', vexKey: 'B', isMinor: false, count: 5 },
  '+fcgdae': { standardName: 'F#', vexKey: 'F#', isMinor: false, count: 6 },
  '+fcgdaeb': { standardName: 'C#', vexKey: 'C#', isMinor: false, count: 7 },
  'fc': { standardName: 'D', vexKey: 'D', isMinor: false, count: 2 },
  'fcg': { standardName: 'A', vexKey: 'A', isMinor: false, count: 3 },
  'fcgd': { standardName: 'E', vexKey: 'E', isMinor: false, count: 4 },
  'fcgda': { standardName: 'B', vexKey: 'B', isMinor: false, count: 5 },
  'fcgdae': { standardName: 'F#', vexKey: 'F#', isMinor: false, count: 6 },
  'fcgdaeb': { standardName: 'C#', vexKey: 'C#', isMinor: false, count: 7 },

  // 音名列挙によるフラット系調号エイリアス (beadgc 等)
  '-b': { standardName: 'F', vexKey: 'F', isMinor: false, count: -1 },
  '-be': { standardName: 'Bb', vexKey: 'Bb', isMinor: false, count: -2 },
  '-bea': { standardName: 'Eb', vexKey: 'Eb', isMinor: false, count: -3 },
  '-bead': { standardName: 'Ab', vexKey: 'Ab', isMinor: false, count: -4 },
  '-beadg': { standardName: 'Db', vexKey: 'Db', isMinor: false, count: -5 },
  '-beadgc': { standardName: 'Gb', vexKey: 'Gb', isMinor: false, count: -6 },
  '-beadgcf': { standardName: 'Cb', vexKey: 'Cb', isMinor: false, count: -7 },
  'be': { standardName: 'Bb', vexKey: 'Bb', isMinor: false, count: -2 },
  'bea': { standardName: 'Eb', vexKey: 'Eb', isMinor: false, count: -3 },
  'bead': { standardName: 'Ab', vexKey: 'Ab', isMinor: false, count: -4 },
  'beadg': { standardName: 'Db', vexKey: 'Db', isMinor: false, count: -5 },
  'beadgc': { standardName: 'Gb', vexKey: 'Gb', isMinor: false, count: -6 },
  'beadgcf': { standardName: 'Cb', vexKey: 'Cb', isMinor: false, count: -7 },
};

/**
 * 入力された調名文字列（例: "E", "Key E", "F#", "Bb", "E minor", "G major", "+fcgdae", "fcgdae" 等）を解析し、
 * 調号情報を取得する。該当しない場合は null を返す。
 */
export function parseKeySignature(input: string): KeySignatureInfo | null {
  if (!input || typeof input !== 'string') return null;

  // 余分なプレフィックスや空白、波括弧、角括弧、丸括弧、引用符等を除去
  let clean = input.trim();
  clean = clean.replace(/^[{\[\(（"'「]+|[}\]\)）"'」]+$/g, '').trim();
  clean = clean.replace(/^key(?:\s*signature|\s*sig)?\s*[:=]?\s*/i, '');
  clean = clean.replace(/^[{\[\(（"'「]+|[}\]\)）"'」]+$/g, '').trim();

  // "#" を "+"、"_" を "-" に正規化
  let normalized = clean.toLowerCase().replace(/#/g, '+').replace(/_/g, '-');

  // 直接テーブル引き (音名列挙 "+fcgdae", "fcgdae" 等も含む)
  if (KEY_DEFINITIONS[normalized]) {
    const def = KEY_DEFINITIONS[normalized];
    return {
      name: def.standardName,
      vexKey: def.vexKey,
      isMinor: def.isMinor,
      accidentalsCount: def.count,
      alteredNotes: createAlteredMap(def.count),
    };
  }

  // "major", "maj", "minor", "min", "m" の正規化
  let isMinor = false;
  if (/[\s_-]minor$/i.test(clean) || /[\s_-]min$/i.test(clean)) {
    isMinor = true;
    clean = clean.replace(/[\s_-](?:minor|min)$/i, '').trim();
  } else if (/[\s_-]major$/i.test(clean) || /[\s_-]maj$/i.test(clean)) {
    isMinor = false;
    clean = clean.replace(/[\s_-](?:major|maj)$/i, '').trim();
  }

  // 末尾の m (小文字) 判定: 例 "Cm", "F#m"
  if (/^[a-gA-G][#\+\-b_]?m$/i.test(clean)) {
    isMinor = true;
    clean = clean.slice(0, -1);
  }

  // 音名部分の抽出: 例 "F#", "Bb", "C"
  const m = clean.match(/^([a-gA-G])([#\+\-b_]?)$/);
  if (m) {
    const letter = m[1].toLowerCase();
    let acc = m[2] || '';
    if (acc === '+') acc = '#';
    if (acc === '-' || acc === '_') acc = 'b';

    const lookupKey = `${letter}${acc}${isMinor ? 'm' : ''}`.toLowerCase();
    const def = KEY_DEFINITIONS[lookupKey];
    if (def) {
      return {
        name: def.standardName,
        vexKey: def.vexKey,
        isMinor: def.isMinor,
        accidentalsCount: def.count,
        alteredNotes: createAlteredMap(def.count),
      };
    }
  }

  // 音名列挙フォールバック判定 (例: 空白区切り "f c g d a e" や順序不同など)
  // シャープ系: 文字列から 'f','c','g','d','a','e','b' のみで構成されているかを検査
  const stripped = clean.toLowerCase().replace(/[\s,]+/g, '');
  if (/^[+]?[fcgdaeb]{1,7}$/.test(stripped)) {
    const chars = stripped.replace(/^\+/, '').split('');
    const uniqueChars = Array.from(new Set(chars));
    // 伝統的シャープ順序 F, C, G, D, A, E, B の個数と調
    const sharpCountMap: Record<number, string> = {
      1: '+f', 2: '+fc', 3: '+fcg', 4: '+fcgd', 5: '+fcgda', 6: '+fcgdae', 7: '+fcgdaeb'
    };
    const keyAlias = sharpCountMap[uniqueChars.length];
    if (keyAlias && KEY_DEFINITIONS[keyAlias]) {
      const def = KEY_DEFINITIONS[keyAlias];
      return {
        name: def.standardName,
        vexKey: def.vexKey,
        isMinor: false,
        accidentalsCount: def.count,
        alteredNotes: createAlteredMap(def.count),
      };
    }
  }

  // フラット系: 文字列から 'b','e','a','d','g','c','f' のみで構成されているかを検査 (先頭 - または 2音以上)
  if (/^[-]?[beadgcf]{2,7}$/.test(stripped) || /^-[beadgcf]{1,7}$/.test(stripped)) {
    const chars = stripped.replace(/^-/, '').split('');
    const uniqueChars = Array.from(new Set(chars));
    const flatCountMap: Record<number, string> = {
      1: '-b', 2: '-be', 3: '-bea', 4: '-bead', 5: '-beadg', 6: '-beadgc', 7: '-beadgcf'
    };
    const keyAlias = flatCountMap[uniqueChars.length];
    if (keyAlias && KEY_DEFINITIONS[keyAlias]) {
      const def = KEY_DEFINITIONS[keyAlias];
      return {
        name: def.standardName,
        vexKey: def.vexKey,
        isMinor: false,
        accidentalsCount: def.count,
        alteredNotes: createAlteredMap(def.count),
      };
    }
  }

  return null;
}

/**
 * 指定した調号（KeySignatureInfo）において、幹音（'C', 'D', 'E', 'F', 'G', 'A', 'B'）に
 * 付く調号の臨時記号（'#' | 'b' | undefined）を取得する
 */
export function getKeyAccidentalForNote(
  keyInfo: KeySignatureInfo | null | undefined,
  noteLetter: string
): '#' | 'b' | undefined {
  if (!keyInfo) return undefined;
  const upper = noteLetter.toUpperCase();
  return keyInfo.alteredNotes[upper];
}

/**
 * デフォルトのハ長調 (Key C) 情報を取得
 */
export function getDefaultKeySignature(): KeySignatureInfo {
  return {
    name: 'C',
    vexKey: 'C',
    isMinor: false,
    accidentalsCount: 0,
    alteredNotes: {},
  };
}
