/**
 * 日本語歌詞のモーラ分割・音素（子音＋母音）変換ユーティリティ
 * Web Audio フォルマント歌声合成および VOICEVOX ローカルAPI連携の両方で使用します。
 */

export type VowelType = 'a' | 'i' | 'u' | 'e' | 'o' | 'n';

export type ConsonantType =
  | ''
  | 'k'
  | 's'
  | 'sh'
  | 't'
  | 'ch'
  | 'ts'
  | 'n'
  | 'h'
  | 'f'
  | 'm'
  | 'y'
  | 'r'
  | 'w'
  | 'g'
  | 'z'
  | 'j'
  | 'd'
  | 'b'
  | 'p';

export interface PhonemeInfo {
  raw: string;
  hiragana: string;
  katakana: string;
  consonant: ConsonantType;
  vowel: VowelType;
  hasGlideY?: boolean; // 拗音 (きゃ, しゃ, ちゃ 等: /i/ -> 母音への遷移)
  hasGlideW?: boolean; // うぃ, くぁ 等 (/u/ -> 母音への遷移)
  isLongVowel?: boolean; // 長音記号 (ー, -, ~)
  isStaccatoMora?: boolean; // 促音 (っ, ッ) が含まれるか
}

/**
 * カタカナをひらがなに変換する
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * ひらがなをカタカナに変換する (VOICEVOX API用)
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * フレーズ歌詞文字列 (例: "きらきらひかる", "しゃぼんだま とんだ", "Twinkle little") を
 * 音符1つ分に割り当てるモーラ（拍）配列に分割する
 */
export function tokenizeLyrics(lyricsText: string): string[] {
  const cleaned = lyricsText.trim();
  if (!cleaned) return [];

  // 明示的にスペースやカンマで全要素が区切られている場合（かつ英単語等を含む場合）はまず空白で分割し、
  // 各トークンが日本語連続文字列ならさらにモーラ分割する
  const tokens = cleaned.split(/[\s,、/]+/).filter(Boolean);
  const result: string[] = [];

  // 小書き文字（前の文字と結合して1モーラになる文字）
  const smallKanaRegex = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]$/;

  for (const token of tokens) {
    // 英字のみで構成されるシラブル (例: "la", "lu", "do", "re", "mi", "love") はそのまま1音符に割り当て
    if (/^[a-zA-Z'-]+$/.test(token)) {
      result.push(token);
      continue;
    }

    // 日本語文字を1モーラずつ切り出す
    const chars = Array.from(token);
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      // 句読点や記号単体はスキップ（ただし長音記号「ー」「-」「~」「～」は1モーラとして残す）
      if (/^[。、！？!?「」『』（）()・]$/.test(ch)) {
        i++;
        continue;
      }

      let mora = ch;
      // 次の文字が小書き仮名（ゃゅょぁぃぅぇぉゎ）なら結合して1モーラにする (例: しゃ, きょ, ふぁ, てぃ)
      if (i + 1 < chars.length && smallKanaRegex.test(chars[i + 1])) {
        mora += chars[i + 1];
        i += 2;
      } else {
        i += 1;
      }

      result.push(mora);
    }
  }

  return result;
}

/**
 * ひらがなモーラ -> 音素定義マップ
 */
const HIRAGANA_MORA_MAP: Record<string, { c: ConsonantType; v: VowelType; y?: boolean; w?: boolean }> = {
  // あ行
  'あ': { c: '', v: 'a' },
  'い': { c: '', v: 'i' },
  'う': { c: '', v: 'u' },
  'え': { c: '', v: 'e' },
  'お': { c: '', v: 'o' },
  'ぁ': { c: '', v: 'a' },
  'ぃ': { c: '', v: 'i' },
  'ぅ': { c: '', v: 'u' },
  'ぇ': { c: '', v: 'e' },
  'ぉ': { c: '', v: 'o' },
  'うぁ': { c: 'w', v: 'a', w: true },
  'うぃ': { c: 'w', v: 'i', w: true },
  'うぇ': { c: 'w', v: 'e', w: true },
  'うぉ': { c: 'w', v: 'o', w: true },

  // か行
  'か': { c: 'k', v: 'a' },
  'き': { c: 'k', v: 'i' },
  'く': { c: 'k', v: 'u' },
  'け': { c: 'k', v: 'e' },
  'こ': { c: 'k', v: 'o' },
  'きゃ': { c: 'k', v: 'a', y: true },
  'きゅ': { c: 'k', v: 'u', y: true },
  'きぇ': { c: 'k', v: 'e', y: true },
  'きょ': { c: 'k', v: 'o', y: true },
  'くぁ': { c: 'k', v: 'a', w: true },
  'くぃ': { c: 'k', v: 'i', w: true },
  'くぇ': { c: 'k', v: 'e', w: true },
  'くぉ': { c: 'k', v: 'o', w: true },

  // さ行
  'さ': { c: 's', v: 'a' },
  'し': { c: 'sh', v: 'i' },
  'す': { c: 's', v: 'u' },
  'せ': { c: 's', v: 'e' },
  'そ': { c: 's', v: 'o' },
  'しゃ': { c: 'sh', v: 'a', y: true },
  'しゅ': { c: 'sh', v: 'u', y: true },
  'しぇ': { c: 'sh', v: 'e', y: true },
  'しょ': { c: 'sh', v: 'o', y: true },
  'すぃ': { c: 's', v: 'i', w: true },

  // た行
  'た': { c: 't', v: 'a' },
  'ち': { c: 'ch', v: 'i' },
  'つ': { c: 'ts', v: 'u' },
  'て': { c: 't', v: 'e' },
  'と': { c: 't', v: 'o' },
  'ちゃ': { c: 'ch', v: 'a', y: true },
  'ちゅ': { c: 'ch', v: 'u', y: true },
  'ちぇ': { c: 'ch', v: 'e', y: true },
  'ちょ': { c: 'ch', v: 'o', y: true },
  'つぁ': { c: 'ts', v: 'a', w: true },
  'つぃ': { c: 'ts', v: 'i', w: true },
  'つぇ': { c: 'ts', v: 'e', w: true },
  'つぉ': { c: 'ts', v: 'o', w: true },
  'てぃ': { c: 't', v: 'i' },
  'てゅ': { c: 't', v: 'u', y: true },
  'とぅ': { c: 't', v: 'u' },

  // な行
  'な': { c: 'n', v: 'a' },
  'に': { c: 'n', v: 'i' },
  'ぬ': { c: 'n', v: 'u' },
  'ね': { c: 'n', v: 'e' },
  'の': { c: 'n', v: 'o' },
  'にゃ': { c: 'n', v: 'a', y: true },
  'にゅ': { c: 'n', v: 'u', y: true },
  'にぇ': { c: 'n', v: 'e', y: true },
  'にょ': { c: 'n', v: 'o', y: true },

  // は行
  'は': { c: 'h', v: 'a' },
  'ひ': { c: 'h', v: 'i' },
  'ふ': { c: 'f', v: 'u' },
  'へ': { c: 'h', v: 'e' },
  'ほ': { c: 'h', v: 'o' },
  'ひゃ': { c: 'h', v: 'a', y: true },
  'ひゅ': { c: 'h', v: 'u', y: true },
  'ひぇ': { c: 'h', v: 'e', y: true },
  'ひょ': { c: 'h', v: 'o', y: true },
  'ふぁ': { c: 'f', v: 'a', w: true },
  'ふぃ': { c: 'f', v: 'i', w: true },
  'ふぇ': { c: 'f', v: 'e', w: true },
  'ふぉ': { c: 'f', v: 'o', w: true },
  'ふゅ': { c: 'f', v: 'u', y: true },

  // ま行
  'ま': { c: 'm', v: 'a' },
  'み': { c: 'm', v: 'i' },
  'む': { c: 'm', v: 'u' },
  'め': { c: 'm', v: 'e' },
  'も': { c: 'm', v: 'o' },
  'みゃ': { c: 'm', v: 'a', y: true },
  'みゅ': { c: 'm', v: 'u', y: true },
  'みぇ': { c: 'm', v: 'e', y: true },
  'みょ': { c: 'm', v: 'o', y: true },

  // や行
  'や': { c: 'y', v: 'a', y: true },
  'ゆ': { c: 'y', v: 'u', y: true },
  'いぇ': { c: 'y', v: 'e', y: true },
  'よ': { c: 'y', v: 'o', y: true },
  'ゃ': { c: 'y', v: 'a', y: true },
  'ゅ': { c: 'y', v: 'u', y: true },
  'ょ': { c: 'y', v: 'o', y: true },

  // ら行
  'ら': { c: 'r', v: 'a' },
  'り': { c: 'r', v: 'i' },
  'る': { c: 'r', v: 'u' },
  'れ': { c: 'r', v: 'e' },
  'ろ': { c: 'r', v: 'o' },
  'りゃ': { c: 'r', v: 'a', y: true },
  'りゅ': { c: 'r', v: 'u', y: true },
  'りぇ': { c: 'r', v: 'e', y: true },
  'りょ': { c: 'r', v: 'o', y: true },

  // わ行・ん
  'わ': { c: 'w', v: 'a', w: true },
  'ゎ': { c: 'w', v: 'a', w: true },
  'ゐ': { c: '', v: 'i' },
  'ゑ': { c: '', v: 'e' },
  'を': { c: '', v: 'o' },
  'ん': { c: 'n', v: 'n' },

  // が行
  'が': { c: 'g', v: 'a' },
  'ぎ': { c: 'g', v: 'i' },
  'ぐ': { c: 'g', v: 'u' },
  'げ': { c: 'g', v: 'e' },
  'ご': { c: 'g', v: 'o' },
  'ぎゃ': { c: 'g', v: 'a', y: true },
  'ぎゅ': { c: 'g', v: 'u', y: true },
  'ぎぇ': { c: 'g', v: 'e', y: true },
  'ぎょ': { c: 'g', v: 'o', y: true },

  // ざ行
  'ざ': { c: 'z', v: 'a' },
  'じ': { c: 'j', v: 'i' },
  'ず': { c: 'z', v: 'u' },
  'ぜ': { c: 'z', v: 'e' },
  'ぞ': { c: 'z', v: 'o' },
  'じゃ': { c: 'j', v: 'a', y: true },
  'じゅ': { c: 'j', v: 'u', y: true },
  'じぇ': { c: 'j', v: 'e', y: true },
  'じょ': { c: 'j', v: 'o', y: true },
  'ずぃ': { c: 'z', v: 'i', w: true },

  // だ行
  'だ': { c: 'd', v: 'a' },
  'ぢ': { c: 'j', v: 'i' },
  'づ': { c: 'z', v: 'u' },
  'で': { c: 'd', v: 'e' },
  'ど': { c: 'd', v: 'o' },
  'ぢゃ': { c: 'j', v: 'a', y: true },
  'ぢゅ': { c: 'j', v: 'u', y: true },
  'ぢょ': { c: 'j', v: 'o', y: true },
  'でぃ': { c: 'd', v: 'i' },
  'でゅ': { c: 'd', v: 'u', y: true },
  'どぅ': { c: 'd', v: 'u' },

  // ば行
  'ば': { c: 'b', v: 'a' },
  'び': { c: 'b', v: 'i' },
  'ぶ': { c: 'b', v: 'u' },
  'べ': { c: 'b', v: 'e' },
  'ぼ': { c: 'b', v: 'o' },
  'びゃ': { c: 'b', v: 'a', y: true },
  'びゅ': { c: 'b', v: 'u', y: true },
  'びぇ': { c: 'b', v: 'e', y: true },
  'びょ': { c: 'b', v: 'o', y: true },

  // ぱ行
  'ぱ': { c: 'p', v: 'a' },
  'ぴ': { c: 'p', v: 'i' },
  'ぷ': { c: 'p', v: 'u' },
  'ぺ': { c: 'p', v: 'e' },
  'ぽ': { c: 'p', v: 'o' },
  'ぴゃ': { c: 'p', v: 'a', y: true },
  'ぴゅ': { c: 'p', v: 'u', y: true },
  'ぴぇ': { c: 'p', v: 'e', y: true },
  'ぴょ': { c: 'p', v: 'o', y: true },

  // ゔ行
  'ゔぁ': { c: 'b', v: 'a' },
  'ゔぃ': { c: 'b', v: 'i' },
  'ゔ': { c: 'b', v: 'u' },
  'ゔぇ': { c: 'b', v: 'e' },
  'ゔぉ': { c: 'b', v: 'o' },
};

/**
 * ローマ字 / 英単語シラブルから簡易的に日本語モーラ（または子音+母音）を推定する
 */
function parseRomajiSyllable(romaji: string): { c: ConsonantType; v: VowelType; kata: string } {
  const lower = romaji.toLowerCase().trim();
  if (lower === 'n' || lower === 'm') {
    return { c: 'n', v: 'n', kata: 'ン' };
  }

  // ドレミ階名や一般ローマ字の変換
  const romajiToHira: Record<string, string> = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
    wa: 'わ', wo: 'を',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    da: 'だ', di: 'でぃ', du: 'どぅ', de: 'で', do: 'ど',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
    nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  };

  if (romajiToHira[lower]) {
    const hira = romajiToHira[lower];
    const mapped = HIRAGANA_MORA_MAP[hira];
    if (mapped) {
      return { c: mapped.c, v: mapped.v, kata: hiraganaToKatakana(hira) };
    }
  }

  // 末尾の母音から推定
  let vowel: VowelType = 'a';
  if (lower.endsWith('i') || lower.endsWith('y')) vowel = 'i';
  else if (lower.endsWith('u') || lower.endsWith('w')) vowel = 'u';
  else if (lower.endsWith('e')) vowel = 'e';
  else if (lower.endsWith('o')) vowel = 'o';

  let consonant: ConsonantType = '';
  if (lower.startsWith('sh')) consonant = 'sh';
  else if (lower.startsWith('ch')) consonant = 'ch';
  else if (lower.startsWith('ts')) consonant = 'ts';
  else if (lower.startsWith('k') || lower.startsWith('c')) consonant = 'k';
  else if (lower.startsWith('s')) consonant = 's';
  else if (lower.startsWith('t')) consonant = 't';
  else if (lower.startsWith('n')) consonant = 'n';
  else if (lower.startsWith('h')) consonant = 'h';
  else if (lower.startsWith('f')) consonant = 'f';
  else if (lower.startsWith('m')) consonant = 'm';
  else if (lower.startsWith('y')) consonant = 'y';
  else if (lower.startsWith('r') || lower.startsWith('l')) consonant = 'r';
  else if (lower.startsWith('w')) consonant = 'w';
  else if (lower.startsWith('g')) consonant = 'g';
  else if (lower.startsWith('z')) consonant = 'z';
  else if (lower.startsWith('j')) consonant = 'j';
  else if (lower.startsWith('d')) consonant = 'd';
  else if (lower.startsWith('b') || lower.startsWith('v')) consonant = 'b';
  else if (lower.startsWith('p')) consonant = 'p';

  const fallbackKataMap: Record<VowelType, string> = {
    a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ', n: 'ン',
  };

  return { c: consonant, v: vowel, kata: fallbackKataMap[vowel] };
}

/**
 * 1つの音符の歌詞文字列 (例: "き", "しゃ", "ー", "la") から音素情報を取得する
 * @param lyric 音符に付与された歌詞
 * @param prevVowel 直前の音符の母音 (長音「ー」の母音引き継ぎ用)
 */
export function parseLyricToPhoneme(lyric: string, prevVowel: VowelType = 'a'): PhonemeInfo {
  const raw = lyric.trim();
  if (!raw) {
    return {
      raw: 'あ',
      hiragana: 'あ',
      katakana: 'ア',
      consonant: '',
      vowel: 'a',
    };
  }

  // 長音記号の判定 ("ー", "-", "~", "～")
  if (/^[ー\-~～―]+$/.test(raw)) {
    const vowelToHira: Record<VowelType, string> = {
      a: 'あ',
      i: 'い',
      u: 'う',
      e: 'え',
      o: 'お',
      n: 'ん',
    };
    const hira = vowelToHira[prevVowel] || 'あ';
    return {
      raw,
      hiragana: hira,
      katakana: hiraganaToKatakana(hira), // VOICEVOX のフレームクエリでは母音カナの方がエラーになりにくい
      consonant: '',
      vowel: prevVowel,
      isLongVowel: true,
    };
  }

  // 促音単体 ("っ", "ッ")
  if (raw === 'っ' || raw === 'ッ') {
    const vowelToHira: Record<VowelType, string> = {
      a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', n: 'ん',
    };
    const hira = vowelToHira[prevVowel] || 'あ';
    return {
      raw,
      hiragana: 'っ',
      katakana: 'ッ',
      consonant: '',
      vowel: prevVowel,
      isStaccatoMora: true,
    };
  }

  const hira = katakanaToHiragana(raw).replace(/[っッー\-~～]/g, '');
  const hasStaccato = /[っッ]$/.test(raw);

  if (HIRAGANA_MORA_MAP[hira]) {
    const entry = HIRAGANA_MORA_MAP[hira];
    return {
      raw,
      hiragana: hira,
      katakana: hiraganaToKatakana(hira),
      consonant: entry.c,
      vowel: entry.v,
      hasGlideY: entry.y,
      hasGlideW: entry.w,
      isStaccatoMora: hasStaccato,
    };
  }

  // 2文字以上でマップにない場合（例: "きら" が1つの音符に書かれた場合は先頭モーラを主としつつカナ変換）
  const subTokens = tokenizeLyrics(hira);
  if (subTokens.length > 0 && HIRAGANA_MORA_MAP[subTokens[0]]) {
    const firstMora = subTokens[0];
    const entry = HIRAGANA_MORA_MAP[firstMora];
    return {
      raw,
      hiragana: firstMora,
      katakana: hiraganaToKatakana(firstMora),
      consonant: entry.c,
      vowel: entry.v,
      hasGlideY: entry.y,
      hasGlideW: entry.w,
      isStaccatoMora: hasStaccato,
    };
  }

  // ローマ字・英語の解析
  if (/^[a-zA-Z'-]+$/.test(raw)) {
    const rom = parseRomajiSyllable(raw);
    return {
      raw,
      hiragana: katakanaToHiragana(rom.kata),
      katakana: rom.kata,
      consonant: rom.c,
      vowel: rom.v,
    };
  }

  // フォールバック（「あ」として歌う）
  return {
    raw,
    hiragana: 'あ',
    katakana: 'ア',
    consonant: '',
    vowel: 'a',
  };
}
