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

export interface LyricToken {
  /** 楽譜表示・MIDI歌詞出力用の表記 (例: "は", "へ", "き", "しゃ") */
  display: string;
  /** ユーザーが は[わ] / は[は] / は［わ］ 等で明示的に指定した発音 */
  explicitPronunciation?: string;
  /** 文脈（文節末・定型句・複合助詞等）から自動推定された発音 (例: "わ", "え") */
  autoPronunciation?: string;
}

/**
 * 音符個別指定の歌詞文字列 (例: "は[わ]", "は［わ］", "は[は]", "き") を
 * 表示文字と明示的発音指定に分離する
 */
export function parseInlineLyric(rawLyric: string): LyricToken {
  const trimmed = rawLyric.trim();
  if (!trimmed) {
    return { display: '' };
  }

  const match = trimmed.match(/^(.+?)\s*[\[［]([^\]］]+)[\]］]$/);
  if (match) {
    const display = match[1].trim();
    const explicitPronunciation = match[2].trim();
    if (display && explicitPronunciation) {
      return { display, explicitPronunciation };
    }
  }

  return { display: trimmed };
}

/**
 * 音符の発音すべき歌詞文字列を解決する
 * 優先順位:
 *  1. ユーザー明示指定 (lyricPronunciation: は[わ] / は[は] 等)
 *  2. 文脈自動推定 (autoLyricPronunciation: 設定ON時のみ)
 *  3. 表示歌詞そのまま (lyric)
 */
export function resolveNotePronunciation(
  note: {
    lyric?: string;
    lyricPronunciation?: string;
    autoLyricPronunciation?: string;
  },
  autoConvertParticles = true
): string {
  if (note.lyricPronunciation && note.lyricPronunciation.trim().length > 0) {
    return note.lyricPronunciation.trim();
  }
  if (
    autoConvertParticles &&
    note.autoLyricPronunciation &&
    note.autoLyricPronunciation.trim().length > 0
  ) {
    return note.autoLyricPronunciation.trim();
  }
  if (note.lyric && note.lyric.trim().length > 0) {
    const parsed = parseInlineLyric(note.lyric);
    return parsed.explicitPronunciation || parsed.display;
  }
  return 'ら';
}

/**
 * 文節末に「は」があっても助詞ではなく「は (ha)」と発音する例外語
 */
const HA_WORD_END_EXCEPTIONS = new Set<string>([
  'はは',
  'ちちはは',
  'あは',
  'あはは',
  'うは',
  'うはは',
  'わはは',
  'がはは',
  'ははは',
  'ふは',
  'ふはは',
  'ぶは',
  'ぷは',
  'げは',
  'きゃは',
  'きゃはは',
  'いろは',
  'このは',
  'ことのは',
  'くさは',
  'もろは',
  'なは',
  'やまは',
  'さは',
  'しゅうは',
]);

/**
 * 文節末に「へ」があっても助詞ではなく「へ (he)」と発音する例外語
 */
const HE_WORD_END_EXCEPTIONS = new Set<string>([
  'えへ',
  'えへへ',
  'へへ',
  'へへへ',
  'てへ',
  'うへ',
  'うへへ',
  'あへ',
  'おへ',
]);

/**
 * スペースなしの語中でも安全に「わ」と発音できる3文字以上の複合助詞パターン
 */
const IN_WORD_COMPOUND_HA_SUFFIXES = [
  'からは',
  'までは',
  'だけは',
  'ほどは',
  'さえは',
  'こそは',
  'よりは',
  'ばかりは',
  'くらいは',
  'ぐらいは',
  'ながらは',
];

/**
 * スペースなしの語中でも高確率で助詞・定型表現の「は→わ」となるフレーズ末尾パターン
 */
const IN_WORD_FIXED_HA_PHRASES = [
  'こんにちは',
  'こんばんは',
  'あるいは',
  'または',
  'もしくは',
  'すなわちは',
  'それでは',
  'ここでは',
  'そこでは',
  'あそこでは',
  'いまでは',
  'いつかは',
  'いつもは',
  'だれかは',
  'だれもは',
  'なにかは',
  'どこかは',
  'きょうは',
  'あしたは',
  'きのうは',
  'むかしは',
  'いまは',
  'よるは',
  'あさは',
  'ぼくは',
  'ぼくらは',
  'わたしは',
  'わたしたちは',
  'きみは',
  'きみたちは',
  'あなたは',
  'かれは',
  'かのじょは',
  'みんなは',
  'ふたりは',
  'ひとは',
  'こころは',
  'せかいは',
  'そらは',
  'かぜは',
  'ほしは',
  'ゆめは',
  'あいは',
  'ときは',
  'ひかりは',
  'なみだは',
  'えがおは',
  'おもいは',
  'ことばは',
  'うたは',
  'みちは',
  'それは',
  'これは',
  'あれは',
  'ほんとうは',
  'じつは',
  'けっきょくは',
  'つまりは',
  'まずは',
  'やがては',
];

/**
 * 文節ごとのモーラ配列に対して、日本語の文脈に基づく助詞「は→わ」「へ→え」の自動発音推定を付与する
 * ※ ユーザーが明示指定 (explicitPronunciation) したモーラには一切上書きしない
 */
export function annotateContextualPronunciations(wordLists: LyricToken[][]): void {
  for (let wIdx = 0; wIdx < wordLists.length; wIdx++) {
    const word = wordLists[wIdx];
    const len = word.length;
    if (len === 0) continue;

    // 1. 単独1モーラ文節 ("ぼく は いく" / "うみ へ いく" 等)
    // ※ "は な が さ く" のような1文字分かち書きで誤変換しないよう、直前文節が2モーラ以上の場合のみ助詞と判定
    if (len === 1) {
      const token = word[0];
      if (!token.explicitPronunciation && wIdx > 0 && wordLists[wIdx - 1].length >= 2) {
        if (token.display === 'は') {
          token.autoPronunciation = 'わ';
        } else if (token.display === 'へ') {
          token.autoPronunciation = 'え';
        }
      }
      continue;
    }

    const wordText = word.map((t) => t.display).join('');

    for (let i = 0; i < len; i++) {
      const token = word[i];
      // 明示指定がある場合はそのまま尊重
      if (token.explicitPronunciation) continue;

      // ひらがなの「は」「へ」のみ対象（カタカナの「ハ」「ヘ」は外来語・擬音のため変換しない）
      if (token.display !== 'は' && token.display !== 'へ') continue;

      // 文節の先頭（語頭）の「は」「へ」は助詞ではないので変換しない (例: はる, はな, へや)
      if (i === 0) continue;

      const prevMora = word[i - 1].display;
      // 促音直後（あっは、やっは、えっへ 等）は変換しない
      if (prevMora === 'っ' || prevMora === 'ッ') continue;

      const isEndOfWord = i === len - 1;

      if (token.display === 'は') {
        if (isEndOfWord) {
          // 文節末の「は」: 例外語（母・笑い声・木の葉・言の葉等）以外は助詞として「わ」
          if (
            HA_WORD_END_EXCEPTIONS.has(wordText) ||
            wordText.endsWith('はは') ||
            wordText.endsWith('このは') ||
            wordText.endsWith('ことのは')
          ) {
            continue;
          }
          token.autoPronunciation = 'わ';
        } else {
          // 文節途中の「は」（スペースなしで連続して書かれた場合: "きづいたときにはもう", "まばたきしてはみんな" 等）
          const prefixStr = word
            .slice(0, i + 1)
            .map((t) => t.display)
            .join('');
          const afterStr = word
            .slice(i + 1)
            .map((t) => t.display)
            .join('');

          // 語中でも確実に「は (ha)」と発音するパターンの除外
          if (
            prefixStr.endsWith('はは') ||
            prefixStr.endsWith('あは') ||
            prefixStr.endsWith('うは') ||
            prefixStr.endsWith('わは') ||
            prefixStr.endsWith('がは') ||
            prefixStr.endsWith('いろは') ||
            prefixStr.endsWith('このは') ||
            prefixStr.endsWith('ことのは')
          ) {
            continue;
          }
          if (prefixStr.endsWith('あさは') && afterStr.startsWith('か')) {
            // あさはか (浅はか)
            continue;
          }
          if (
            prefixStr.endsWith('のは') &&
            (afterStr.startsWith('ら') || afterStr.startsWith('な'))
          ) {
            // のはら (野原), のはな (野花)
            continue;
          }

          let shouldConvertToWa = false;

          // (A) 3文字以上の複合助詞 (からは, までは, だけは, ほどは, さえは, こそは, よりは 等)
          if (IN_WORD_COMPOUND_HA_SUFFIXES.some((suf) => prefixStr.endsWith(suf))) {
            shouldConvertToWa = true;
          }

          // (B) 2文字複合助詞 (には, では, ては, とは)
          if (!shouldConvertToWa) {
            if (prefixStr.endsWith('には') && i >= 2) {
              // 例外: にはい (2杯), にはん (2班), にはち (二八), にはく (2泊)
              if (!/^(?:い|ん|ち|く)/.test(afterStr)) {
                shouldConvertToWa = true;
              }
            } else if (prefixStr.endsWith('では')) {
              // 例外: ではいり (出入り), ではじめ (出始め), ではら (出払う)
              if (!/^(?:いり|じめ|ら)/.test(afterStr)) {
                if (i >= 2 || /^(?:ない|なく|あり|ある|なか)/.test(afterStr)) {
                  shouldConvertToWa = true;
                }
              }
            } else if (prefixStr.endsWith('ては') && i >= 2) {
              // 例外: てはい (手配), てはじめ (手始め), てはず (手筈), てはば (手幅)
              if (!/^(?:い|じめ|ず|ば)/.test(afterStr)) {
                shouldConvertToWa = true;
              }
            } else if (prefixStr.endsWith('とは') && i >= 2) {
              shouldConvertToWa = true;
            }
          }

          // (C) 定型句・頻出の「主語+は」表現 (こんにちは, ぼくは, きょうは, それは 等)
          if (!shouldConvertToWa) {
            if (IN_WORD_FIXED_HA_PHRASES.some((phrase) => prefixStr.endsWith(phrase))) {
              shouldConvertToWa = true;
            }
          }

          if (shouldConvertToWa) {
            token.autoPronunciation = 'わ';
          }
        }
      } else if (token.display === 'へ') {
        if (isEndOfWord) {
          // 文節末の「へ」: 笑い声・感動詞以外は助詞として「え」 (例: うみへ, みらいへ, あしたへ)
          if (
            HE_WORD_END_EXCEPTIONS.has(wordText) ||
            wordText.endsWith('へへ') ||
            wordText.endsWith('えへ') ||
            wordText.endsWith('うへ') ||
            wordText.endsWith('てへ')
          ) {
            continue;
          }
          token.autoPronunciation = 'え';
        } else {
          // 文節途中の「へ」: 「〜へと」「〜への」のみ安全に変換 (例: みらいへと, きみへの)
          if (wordText.includes('へとへと') || wordText.includes('へのへの')) {
            continue;
          }
          const nextMora = word[i + 1].display;
          if (nextMora === 'と' || nextMora === 'の') {
            token.autoPronunciation = 'え';
          }
        }
      }
    }
  }
}

/**
 * フレーズ歌詞文字列 (例: "きづいた ときには", "きづいた ときには[わ]", "Twinkle little") を
 * 音符1つ分に割り当てるモーラ＋発音情報配列に分割する
 */
export function tokenizeLyricsWithPronunciation(lyricsText: string): LyricToken[] {
  const cleaned = lyricsText.trim();
  if (!cleaned) return [];

  // 空白・読点・句点・感嘆符・疑問符・括弧類・スラッシュで文節チャンクに分割
  const chunks = cleaned.split(/[\s,、。！？!?「」『』（）()・/]+/).filter(Boolean);
  const wordLists: LyricToken[][] = [];

  // 小書き文字（前の文字と結合して1モーラになる文字）
  const smallKanaRegex = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]$/;

  for (const chunk of chunks) {
    // 英字シラブル単体 または 英字[発音] (例: "la", "love", "the[ざ]")
    const romajiInlineMatch = chunk.match(/^([a-zA-Z'-]+)(?:[\[［]([^\]］]+)[\]］])?$/);
    if (romajiInlineMatch) {
      const display = romajiInlineMatch[1];
      const explicitPronunciation = romajiInlineMatch[2]?.trim();
      wordLists.push([
        explicitPronunciation ? { display, explicitPronunciation } : { display },
      ]);
      continue;
    }

    // 日本語文字を1モーラずつ切り出し、直後の [発音] / ［発音］ を取り込む
    const chars = Array.from(chunk);
    const wordTokens: LyricToken[] = [];
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      // 孤立した括弧記号はスキップ
      if (ch === '[' || ch === ']' || ch === '［' || ch === '］') {
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

      // モーラ直後に [発音] または ［発音］ が続く場合は明示的発音指定として取り込む
      let explicitPronunciation: string | undefined;
      if (i < chars.length && (chars[i] === '[' || chars[i] === '［')) {
        const closeChar = chars[i] === '[' ? ']' : '］';
        let closeIdx = -1;
        for (let j = i + 1; j < chars.length; j++) {
          if (chars[j] === closeChar || chars[j] === ']' || chars[j] === '］') {
            closeIdx = j;
            break;
          }
        }
        if (closeIdx !== -1) {
          const pron = chars.slice(i + 1, closeIdx).join('').trim();
          if (pron) {
            explicitPronunciation = pron;
          }
          i = closeIdx + 1;
        }
      }

      wordTokens.push(
        explicitPronunciation
          ? { display: mora, explicitPronunciation }
          : { display: mora }
      );
    }

    if (wordTokens.length > 0) {
      wordLists.push(wordTokens);
    }
  }

  // 文節ごとの文脈に基づき助詞「は→わ」「へ→え」の自動推定を付与
  annotateContextualPronunciations(wordLists);

  return wordLists.flat();
}

/**
 * フレーズ歌詞文字列 (例: "きらきらひかる", "しゃぼんだま とんだ", "Twinkle little") を
 * 音符1つ分に割り当てるモーラ（拍）文字列配列に分割する
 */
export function tokenizeLyrics(lyricsText: string): string[] {
  return tokenizeLyricsWithPronunciation(lyricsText).map((t) => t.display);
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
 * VOICEVOX Engine の歌唱辞書 (MORA_KANA_TO_MORA_PHONEMES) でエラーになる表記（ヲ, ヂ, ヅ, ヰ, ヱ, 小書き単体等）を
 * 発音どおりの標準ひらがな1モーラに正規化するマップ
 */
const VOICEVOX_PRONUNCIATION_HIRA_MAP: Record<string, string> = {
  'を': 'お',
  'ゐ': 'い',
  'ゑ': 'え',
  'ぢ': 'じ',
  'づ': 'ず',
  'ぢゃ': 'じゃ',
  'ぢゅ': 'じゅ',
  'ぢょ': 'じょ',
  'ぁ': 'あ',
  'ぃ': 'い',
  'ぅ': 'う',
  'ぇ': 'え',
  'ぉ': 'お',
  'ゃ': 'や',
  'ゅ': 'ゆ',
  'ょ': 'よ',
  'ゎ': 'わ',
  'ゔぁ': 'ば',
  'ゔぃ': 'び',
  'ゔ': 'ぶ',
  'ゔぇ': 'べ',
  'ゔぉ': 'ぼ',
};

/**
 * VOICEVOX の歌唱APIが確実に受け付ける有効なカタカナモーラ集合
 */
const VALID_VOICEVOX_KATAKANA_MORAS = new Set<string>([
  'ア', 'イ', 'ウ', 'エ', 'オ',
  'カ', 'キ', 'ク', 'ケ', 'コ', 'キャ', 'キュ', 'キェ', 'キョ',
  'サ', 'シ', 'ス', 'セ', 'ソ', 'シャ', 'シュ', 'シェ', 'ショ', 'スィ',
  'タ', 'チ', 'ツ', 'テ', 'ト', 'チャ', 'チュ', 'チェ', 'チョ', 'ツァ', 'ツィ', 'ツェ', 'ツォ', 'ティ', 'テュ', 'トゥ',
  'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ニャ', 'ニュ', 'ニェ', 'ニョ',
  'ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'ヒャ', 'ヒュ', 'ヒェ', 'ヒョ', 'ファ', 'フィ', 'フェ', 'フォ', 'フュ',
  'マ', 'ミ', 'ム', 'メ', 'モ', 'ミャ', 'ミュ', 'ミェ', 'ミョ',
  'ヤ', 'ユ', 'イェ', 'ヨ',
  'ラ', 'リ', 'ル', 'レ', 'ロ', 'リャ', 'リュ', 'リェ', 'リョ',
  'ワ', 'ウィ', 'ウェ', 'ウォ', 'ン',
  'ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ギャ', 'ギュ', 'ギェ', 'ギョ',
  'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ', 'ジャ', 'ジュ', 'ジェ', 'ジョ', 'ズィ',
  'ダ', 'デ', 'ド', 'ディ', 'デュ', 'ドゥ',
  'バ', 'ビ', 'ブ', 'ベ', 'ボ', 'ビャ', 'ビュ', 'ビェ', 'ビョ',
  'パ', 'ピ', 'プ', 'ペ', 'ポ', 'ピャ', 'ピュ', 'ピェ', 'ピョ',
]);

function normalizeMoraForVoicevox(hira: string, vowel: VowelType): { safeHira: string; safeKata: string } {
  const mappedHira = VOICEVOX_PRONUNCIATION_HIRA_MAP[hira] || hira;
  const candidateKata = hiraganaToKatakana(mappedHira);
  if (VALID_VOICEVOX_KATAKANA_MORAS.has(candidateKata)) {
    return { safeHira: mappedHira, safeKata: candidateKata };
  }
  const fallbackVowelHira: Record<VowelType, string> = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', n: 'ん',
  };
  const fbHira = fallbackVowelHira[vowel] || 'あ';
  return { safeHira: fbHira, safeKata: hiraganaToKatakana(fbHira) };
}

/**
 * 1つの音符の歌詞文字列 (例: "き", "しゃ", "ー", "la") から音素情報を取得する
 * @param lyric 音符に付与された歌詞
 * @param prevVowel 直前の音符の母音 (長音「ー」の母音引き継ぎ用)
 */
export function parseLyricToPhoneme(lyric: string, prevVowel: VowelType = 'a'): PhonemeInfo {
  const inlineParsed = parseInlineLyric(lyric);
  const raw = (inlineParsed.explicitPronunciation || inlineParsed.display).trim();
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

  // 促音単体 ("っ", "ッ") -> 単一ノートに割り当てられた場合はVOICEVOXエラー防止のため直前母音を発音しつつスタッカート化
  if (raw === 'っ' || raw === 'ッ') {
    const vowelToHira: Record<VowelType, string> = {
      a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', n: 'ん',
    };
    const hira = vowelToHira[prevVowel] || 'あ';
    return {
      raw,
      hiragana: hira,
      katakana: hiraganaToKatakana(hira),
      consonant: '',
      vowel: prevVowel,
      isStaccatoMora: true,
    };
  }

  const hira = katakanaToHiragana(raw).replace(/[っッー\-~～]/g, '');
  const hasStaccato = /[っッ]$/.test(raw);

  if (HIRAGANA_MORA_MAP[hira]) {
    const entry = HIRAGANA_MORA_MAP[hira];
    const { safeHira, safeKata } = normalizeMoraForVoicevox(hira, entry.v);
    return {
      raw,
      hiragana: safeHira,
      katakana: safeKata,
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
    const { safeHira, safeKata } = normalizeMoraForVoicevox(firstMora, entry.v);
    return {
      raw,
      hiragana: safeHira,
      katakana: safeKata,
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
    const { safeHira, safeKata } = normalizeMoraForVoicevox(katakanaToHiragana(rom.kata), rom.v);
    return {
      raw,
      hiragana: safeHira,
      katakana: safeKata,
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
