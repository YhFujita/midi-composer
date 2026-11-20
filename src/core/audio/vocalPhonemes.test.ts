import { describe, it, expect } from 'vitest';
import {
  tokenizeLyrics,
  tokenizeLyricsWithPronunciation,
  parseInlineLyric,
  parseLyricToPhoneme,
  resolveNotePronunciation,
} from './vocalPhonemes';
import { parseMML } from '../parser/mmlParser';

describe('日本語歌詞の文脈発音制御 (は→わ / へ→え & 明示指定)', () => {
  it('「きづいた ときには」の表示を「は」のまま保ち、発音を「わ」と判定する', () => {
    const tokens = tokenizeLyricsWithPronunciation('きづいた ときには');
    expect(tokens.map((t) => t.display)).toEqual(['き', 'づ', 'い', 'た', 'と', 'き', 'に', 'は']);
    expect(tokens[7].autoPronunciation).toBe('わ');

    const resolvedOn = tokens.map((t) =>
      resolveNotePronunciation(
        {
          lyric: t.display,
          lyricPronunciation: t.explicitPronunciation,
          autoLyricPronunciation: t.autoPronunciation,
        },
        true
      )
    );
    expect(resolvedOn).toEqual(['き', 'づ', 'い', 'た', 'と', 'き', 'に', 'わ']);

    // VOICEVOX 送信用のカタカナモーラが「ワ」になること
    expect(parseLyricToPhoneme(resolvedOn[7]).katakana).toBe('ワ');

    // 自動変換OFFのときは「は」のまま
    const resolvedOff = resolveNotePronunciation(
      {
        lyric: tokens[7].display,
        lyricPronunciation: tokens[7].explicitPronunciation,
        autoLyricPronunciation: tokens[7].autoPronunciation,
      },
      false
    );
    expect(resolvedOff).toBe('は');
    expect(parseLyricToPhoneme(resolvedOff).katakana).toBe('ハ');
  });

  it('スペースなし・複合助詞・プリセット歌詞で正しく「は」と「わ」を区別する', () => {
    // 語頭の「は」は ha、文節末の「は」は wa
    const haru = tokenizeLyricsWithPronunciation('はるのおがわは さらさらいくよ');
    expect(haru[0].display).toBe('は');
    expect(haru[0].autoPronunciation).toBeUndefined();
    expect(haru[6].display).toBe('は');
    expect(haru[6].autoPronunciation).toBe('わ');

    // スペースなし末尾
    const noSpace = tokenizeLyricsWithPronunciation('きづいたときには');
    expect(noSpace[noSpace.length - 1].display).toBe('は');
    expect(noSpace[noSpace.length - 1].autoPronunciation).toBe('わ');

    // スペースなし語中の複合助詞 (ときにはもう / まばたきしてはみんな)
    const mid1 = tokenizeLyricsWithPronunciation('きづいたときにはもう');
    expect(mid1[7].display).toBe('は');
    expect(mid1[7].autoPronunciation).toBe('わ');

    const mid2 = tokenizeLyricsWithPronunciation('まばたきしてはみんな');
    expect(mid2[6].display).toBe('は');
    expect(mid2[6].autoPronunciation).toBe('わ');

    // 助詞をスペース分離した場合 (ぼく は いく) vs 1文字分かち書き (は な が さ く)
    const spacedParticle = tokenizeLyricsWithPronunciation('ぼく は いく');
    expect(spacedParticle[2].display).toBe('は');
    expect(spacedParticle[2].autoPronunciation).toBe('わ');

    const oneCharSpaced = tokenizeLyricsWithPronunciation('は な が さ く');
    expect(oneCharSpaced[0].display).toBe('は');
    expect(oneCharSpaced[0].autoPronunciation).toBeUndefined();

    const oneCharMid = tokenizeLyricsWithPronunciation('き ら き ら は る');
    expect(oneCharMid[4].display).toBe('は');
    expect(oneCharMid[4].autoPronunciation).toBeUndefined();
  });

  it('例外語・語中一般語・カタカナは誤って「わ」に変換しない', () => {
    const cases: { text: string; haIndices: number[] }[] = [
      { text: 'はは', haIndices: [0, 1] },
      { text: 'ちちはは', haIndices: [2, 3] },
      { text: 'ぼくのはは', haIndices: [3, 4] },
      { text: 'あはは', haIndices: [1, 2] },
      { text: 'いろは', haIndices: [2] },
      { text: 'このは', haIndices: [2] },
      { text: 'ことのは', haIndices: [3] },
      { text: 'おはよう', haIndices: [1] },
      { text: 'おはなし', haIndices: [1] },
      { text: 'ごはん', haIndices: [1] },
      { text: 'はるののはら', haIndices: [4] },
      { text: 'あさはか', haIndices: [2] },
      { text: 'てはじめ', haIndices: [1] },
      { text: 'ではいり', haIndices: [1] },
      { text: 'アハハ', haIndices: [1, 2] },
    ];

    for (const { text, haIndices } of cases) {
      const tokens = tokenizeLyricsWithPronunciation(text);
      for (const idx of haIndices) {
        expect(tokens[idx].autoPronunciation, `"${text}" の index ${idx} は自動変換されないこと`).toBeUndefined();
      }
    }
  });

  it('明示的発音指定 (は[わ] / は［わ］ / は[は]) が最優先で動作する', () => {
    // 自動変換OFFでも明示指定「わ」が効く
    const forcedWa = tokenizeLyricsWithPronunciation('きづいた ときには[わ]');
    expect(forcedWa[7].display).toBe('は');
    expect(forcedWa[7].explicitPronunciation).toBe('わ');
    expect(
      resolveNotePronunciation(
        {
          lyric: forcedWa[7].display,
          lyricPronunciation: forcedWa[7].explicitPronunciation,
          autoLyricPronunciation: forcedWa[7].autoPronunciation,
        },
        false
      )
    ).toBe('わ');

    // 全角角括弧 ［］ にも対応
    const fullwidth = tokenizeLyricsWithPronunciation('きづいた ときには［わ］');
    expect(fullwidth[7].display).toBe('は');
    expect(fullwidth[7].explicitPronunciation).toBe('わ');

    // 自動変換ONでも明示指定「は[は]」で「は」に固定できる
    const forcedHa = tokenizeLyricsWithPronunciation('そのなは[は]');
    expect(forcedHa[3].display).toBe('は');
    expect(forcedHa[3].explicitPronunciation).toBe('は');
    expect(forcedHa[3].autoPronunciation).toBeUndefined();
    expect(
      resolveNotePronunciation(
        {
          lyric: forcedHa[3].display,
          lyricPronunciation: forcedHa[3].explicitPronunciation,
          autoLyricPronunciation: forcedHa[3].autoPronunciation,
        },
        true
      )
    ).toBe('は');

    // parseInlineLyric 単体テスト
    expect(parseInlineLyric('は[わ]')).toEqual({ display: 'は', explicitPronunciation: 'わ' });
    expect(parseInlineLyric('は［は］')).toEqual({ display: 'は', explicitPronunciation: 'は' });
    expect(parseInlineLyric('しゃ[さ]')).toEqual({ display: 'しゃ', explicitPronunciation: 'さ' });
    expect(tokenizeLyrics('きづいた ときには[わ]')).toEqual(['き', 'づ', 'い', 'た', 'と', 'き', 'に', 'は']);
  });

  it('助詞「へ→え」の自動判定と例外・明示上書きが動作する', () => {
    const umi = tokenizeLyricsWithPronunciation('うみへ いこう');
    expect(umi[2].display).toBe('へ');
    expect(umi[2].autoPronunciation).toBe('え');

    const mirai = tokenizeLyricsWithPronunciation('みらいへと きみへの');
    expect(mirai[3].display).toBe('へ');
    expect(mirai[3].autoPronunciation).toBe('え');
    expect(mirai[7].display).toBe('へ');
    expect(mirai[7].autoPronunciation).toBe('え');

    // 例外: へとへと / えへへ
    const heto = tokenizeLyricsWithPronunciation('へとへと えへへ');
    expect(heto[0].autoPronunciation).toBeUndefined();
    expect(heto[2].autoPronunciation).toBeUndefined();
    expect(heto[5].autoPronunciation).toBeUndefined();
    expect(heto[6].autoPronunciation).toBeUndefined();

    // 明示上書き: うみへ[へ]
    const forcedHe = tokenizeLyricsWithPronunciation('うみへ[へ]');
    expect(forcedHe[2].display).toBe('へ');
    expect(forcedHe[2].explicitPronunciation).toBe('へ');
    expect(
      resolveNotePronunciation(
        {
          lyric: forcedHe[2].display,
          lyricPronunciation: forcedHe[2].explicitPronunciation,
          autoLyricPronunciation: forcedHe[2].autoPronunciation,
        },
        true
      )
    ).toBe('へ');
  });

  it('MMLパーサー経由で Lyrics(...) および音符個別指定の両方で発音が制御できる', () => {
    const score1 = parseMML(`
      TR(1) Voice(129) o5 l4
      Lyrics("きづいた ときには")
      c d e f g a b > c
    `);
    const notes1 = score1.tracks[0].notes;
    expect(notes1.map((n) => n.lyric)).toEqual(['き', 'づ', 'い', 'た', 'と', 'き', 'に', 'は']);
    expect(notes1[7].autoLyricPronunciation).toBe('わ');
    expect(resolveNotePronunciation(notes1[7], true)).toBe('わ');

    // 音符個別指定: 休符で区切られた連続フレーズの末尾「は」と明示指定「は[は]」「は[わ]」
    const score2 = parseMML(`
      TR(1) Voice(129) o5 l4
      c"き" d"づ" e"い" f"た" r4 g"と" a"き" b"に" c"は"
      r4 d"と" e"き" f"に" g"は[は]"
      r4 a"は[わ]"
    `);
    const notes2 = score2.tracks[0].notes;
    // 1つ目のフレーズ「ときには」の「は」 -> 自動推定 'わ'
    expect(notes2[7].lyric).toBe('は');
    expect(notes2[7].autoLyricPronunciation).toBe('わ');
    expect(resolveNotePronunciation(notes2[7], true)).toBe('わ');

    // 2つ目のフレーズ「ときには[は]」 -> 明示指定 'は'
    expect(notes2[11].lyric).toBe('は');
    expect(notes2[11].lyricPronunciation).toBe('は');
    expect(resolveNotePronunciation(notes2[11], true)).toBe('は');

    // 単独指定「は[わ]」 -> 表示 'は' / 明示指定 'わ'
    expect(notes2[12].lyric).toBe('は');
    expect(notes2[12].lyricPronunciation).toBe('わ');
    expect(resolveNotePronunciation(notes2[12], false)).toBe('わ');
  });
});
