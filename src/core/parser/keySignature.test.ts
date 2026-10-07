import { describe, it, expect } from 'vitest';
import { parseKeySignature, getKeyAccidentalForNote } from '../../utils/keySignature';
import { parseMML } from './mmlParser';
import { createVexNotesForMeasure } from '../score/vexflowAdapter';

describe('Key Signature (調号) ユーティリティ', () => {
  it('主要な長調の調号を正しく解析できる', () => {
    // ハ長調 (C Major) - 記号なし
    const keyC = parseKeySignature('C');
    expect(keyC).not.toBeNull();
    expect(keyC?.name).toBe('C');
    expect(keyC?.accidentalsCount).toBe(0);
    expect(Object.keys(keyC!.alteredNotes).length).toBe(0);

    // ト長調 (G Major) - #1 (F)
    const keyG = parseKeySignature('G');
    expect(keyG?.name).toBe('G');
    expect(keyG?.accidentalsCount).toBe(1);
    expect(keyG?.alteredNotes).toEqual({ F: '#' });

    // ホ長調 (E Major) - #4 (F, C, G, D)
    const keyE = parseKeySignature('E');
    expect(keyE?.name).toBe('E');
    expect(keyE?.vexKey).toBe('E');
    expect(keyE?.accidentalsCount).toBe(4);
    expect(keyE?.alteredNotes).toEqual({ F: '#', C: '#', G: '#', D: '#' });

    // 嬰ヘ長調 (F# Major) - #6 (F, C, G, D, A, E)
    const keyFSharp = parseKeySignature('F#');
    expect(keyFSharp?.name).toBe('F#');
    expect(keyFSharp?.accidentalsCount).toBe(6);
    expect(keyFSharp?.alteredNotes).toEqual({ F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' });

    // 変ロ長調 (Bb Major) - ♭2 (B, E)
    const keyBb = parseKeySignature('Bb');
    expect(keyBb?.name).toBe('Bb');
    expect(keyBb?.accidentalsCount).toBe(-2);
    expect(keyBb?.alteredNotes).toEqual({ B: 'b', E: 'b' });
  });

  it('短調の調号を正しく解析できる', () => {
    // イ短調 (Am) - 記号なし
    const keyAm = parseKeySignature('Am');
    expect(keyAm?.name).toBe('Am');
    expect(keyAm?.isMinor).toBe(true);
    expect(keyAm?.accidentalsCount).toBe(0);

    // ホ短調 (Em) - #1 (F)
    const keyEm = parseKeySignature('Em');
    expect(keyEm?.name).toBe('Em');
    expect(keyEm?.isMinor).toBe(true);
    expect(keyEm?.accidentalsCount).toBe(1);
    expect(keyEm?.alteredNotes).toEqual({ F: '#' });
  });
});

describe('MML パーサーにおける調号機能と自動音高適用', () => {
  it('Key E 設定時に f や g を入力すると自動的に実音 F# や G# で鳴り、調号フラグが付く', () => {
    const mml = `
      Key E
      o4 e4 f4 g4 a4
    `;
    const score = parseMML(mml);
    const notes = score.tracks[0].notes;

    expect(score.initialKeySignature).toBe('E');
    expect(notes.length).toBe(4);

    // e4 -> E4 (MIDI 64), 変化なし
    expect(notes[0].pitch).toBe('E4');
    expect(notes[0].midiNote).toBe(64);
    expect(notes[0].isKeyAltered).toBeFalsy();

    // f4 -> F#4 (MIDI 66), 調号により自動変化
    expect(notes[1].pitch).toBe('F#4');
    expect(notes[1].midiNote).toBe(66);
    expect(notes[1].isKeyAltered).toBe(true);
    expect(notes[1].accidentalType).toBeUndefined(); // 楽譜に余計な#は付けない

    // g4 -> G#4 (MIDI 68), 調号により自動変化
    expect(notes[2].pitch).toBe('G#4');
    expect(notes[2].midiNote).toBe(68);
    expect(notes[2].isKeyAltered).toBe(true);
    expect(notes[2].accidentalType).toBeUndefined();

    // a4 -> A4 (MIDI 69), 変化なし
    expect(notes[3].pitch).toBe('A4');
    expect(notes[3].midiNote).toBe(69);
    expect(notes[3].isKeyAltered).toBeFalsy();
  });

  it('調号下で明示的ナチュラル (= または n) を入力すると白鍵の音が鳴り、ナチュラル記号が設定される', () => {
    const mml = `
      Key E
      o4 f=4 fn4 f#4
    `;
    const score = parseMML(mml);
    const notes = score.tracks[0].notes;

    // f=4 -> F4 (MIDI 65), ナチュラル
    expect(notes[0].pitch).toBe('F4');
    expect(notes[0].midiNote).toBe(65);
    expect(notes[0].isKeyAltered).toBe(false);
    expect(notes[0].accidentalType).toBe('n');

    // fn4 -> F4 (MIDI 65), ナチュラル
    expect(notes[1].pitch).toBe('F4');
    expect(notes[1].midiNote).toBe(65);
    expect(notes[1].isKeyAltered).toBe(false);
    expect(notes[1].accidentalType).toBe('n');

    // f#4 -> F#4 (MIDI 66), 明示的シャープ
    expect(notes[2].pitch).toBe('F#4');
    expect(notes[2].midiNote).toBe(66);
    expect(notes[2].accidentalType).toBe('#');
  });

  it('曲の途中での転調 (Modulation) が正しく追従される', () => {
    const mml = `
      Key E
      o4 e4 f4
      Key G
      o4 g4 f4 c4
    `;
    const score = parseMML(mml);
    const notes = score.tracks[0].notes;

    expect(score.keySignatureEvents?.length).toBe(2);
    expect(score.keySignatureEvents?.[0].key).toBe('E');
    expect(score.keySignatureEvents?.[1].key).toBe('G');

    // Key E 区間 (time: 0〜2)
    // f4 -> F#4
    expect(notes[1].pitch).toBe('F#4');
    expect(notes[1].isKeyAltered).toBe(true);

    // Key G 区間 (time: 2〜)
    // g4 -> G4 (Key G では G は変化なし)
    expect(notes[2].pitch).toBe('G4');
    expect(notes[2].isKeyAltered).toBeFalsy();

    // f4 -> F#4 (Key G でも F は F#)
    expect(notes[3].pitch).toBe('F#4');
    expect(notes[3].isKeyAltered).toBe(true);

    // c4 -> C4 (Key G では C はナチュラル)
    expect(notes[4].pitch).toBe('C4');
    expect(notes[4].isKeyAltered).toBeFalsy();
  });

  it('数値によるトラック移調 Key(2) と調号 Key E が競合せず、厳格に分離されている', () => {
    // 1. 数値移調: Key(2) -> 全体を長2度(半音+2)平行移動
    const mmlTranspose = `
      Key(2)
      o4 c4 d4
    `;
    const scoreTranspose = parseMML(mmlTranspose);
    const notesTranspose = scoreTranspose.tracks[0].notes;
    // c4 (60) + 2 = D4 (62)
    expect(notesTranspose[0].midiNote).toBe(62);
    expect(notesTranspose[0].pitch).toBe('D4');
    // 調号イベントは作成されず初期調は C
    expect(scoreTranspose.initialKeySignature).toBe('C');

    // 2. 調号: Key E -> ホ長調
    const mmlKey = `
      Key E
      o4 c4
    `;
    const scoreKey = parseMML(mmlKey);
    const notesKey = scoreKey.tracks[0].notes;
    // Key E では c は C#4 (61) になる
    expect(notesKey[0].midiNote).toBe(61);
    expect(notesKey[0].pitch).toBe('C#4');
    expect(notesKey[0].isKeyAltered).toBe(true);
    expect(scoreKey.initialKeySignature).toBe('E');
  });

  it('和音や連符内でも調号が自動適用される', () => {
    const mml = `
      Key E
      o4 [ceg]4
      {c d e}4
    `;
    const score = parseMML(mml);
    const chordNotes = score.tracks[0].notes.filter((n) => n.isChord);
    const tupletNotes = score.tracks[0].notes.filter((n) => n.isTuplet);

    // 和音 [ceg]: c は C#4, e は E4, g は G#4
    const cNote = chordNotes.find((n) => n.pitch.startsWith('C'));
    const gNote = chordNotes.find((n) => n.pitch.startsWith('G'));
    expect(cNote?.pitch).toBe('C#4');
    expect(cNote?.isKeyAltered).toBe(true);
    expect(gNote?.pitch).toBe('G#4');
    expect(gNote?.isKeyAltered).toBe(true);

    // 連符 {c d e}: c は C#4, d は D#4, e は E4
    const tC = tupletNotes.find((n) => n.pitch.startsWith('C'));
    const tD = tupletNotes.find((n) => n.pitch.startsWith('D'));
    expect(tC?.pitch).toBe('C#4');
    expect(tC?.isKeyAltered).toBe(true);
    expect(tD?.pitch).toBe('D#4');
    expect(tD?.isKeyAltered).toBe(true);
  });

  it('#が6つ付く調号 (fcgdae) を音名直接指定や波括弧でパースでき、eを入力したら実音fになる', () => {
    // 1. parseKeySignature での音名列挙判定
    const keyByFc = parseKeySignature('fcgdae');
    expect(keyByFc?.name).toBe('F#');
    expect(keyByFc?.accidentalsCount).toBe(6);
    expect(keyByFc?.alteredNotes).toEqual({ F: '#', C: '#', G: '#', D: '#', A: '#', E: '#' });

    const keyByPlus = parseKeySignature('+fcgdae');
    expect(keyByPlus?.name).toBe('F#');
    expect(keyByPlus?.accidentalsCount).toBe(6);

    const keyByBrace = parseKeySignature('{+fcgdae}');
    expect(keyByBrace?.name).toBe('F#');
    expect(keyByBrace?.accidentalsCount).toBe(6);

    // フラット6つの音名列挙 (beadgc)
    const keyFlat6 = parseKeySignature('beadgc');
    expect(keyFlat6?.name).toBe('Gb');
    expect(keyFlat6?.accidentalsCount).toBe(-6);

    // 2. MML パーサーでの直接指定と e入力 -> 実音f の動作検証
    // Key +fcgdae 設定下で o4 e4 f4 を入力
    const mml = `
      Key +fcgdae
      o4 e4 f4 e=4
    `;
    const score = parseMML(mml);
    const notes = score.tracks[0].notes;

    expect(score.initialKeySignature).toBe('F#');
    expect(notes.length).toBe(3);

    // e4 -> 調号により E#4 となり、実音は F4 (MIDI 65)
    expect(notes[0].pitch).toBe('F4');
    expect(notes[0].midiNote).toBe(65);
    expect(notes[0].originalPitch).toBe('E#4');
    expect(notes[0].isKeyAltered).toBe(true);
    expect(notes[0].accidentalType).toBeUndefined();

    // f4 -> 調号により F#4 となり、実音は F#4 (MIDI 66)
    expect(notes[1].pitch).toBe('F#4');
    expect(notes[1].midiNote).toBe(66);
    expect(notes[1].originalPitch).toBe('F#4');
    expect(notes[1].isKeyAltered).toBe(true);

    // e=4 -> ナチュラル記号付きで実音 E4 (MIDI 64)
    expect(notes[2].pitch).toBe('E4');
    expect(notes[2].midiNote).toBe(64);
    expect(notes[2].originalPitch).toBe('E4');
    expect(notes[2].accidentalType).toBe('n');

    // 3. 波括弧構文 {+fcgdae} も同様にパースされることの検証
    const mmlBrace = `
      {+fcgdae}
      o4 e4
    `;
    const scoreBrace = parseMML(mmlBrace);
    expect(scoreBrace.initialKeySignature).toBe('F#');
    expect(scoreBrace.tracks[0].notes[0].pitch).toBe('F4');
    expect(scoreBrace.tracks[0].notes[0].midiNote).toBe(65);

    // 4. 五線譜描画において、調号下の e4 (E#4) がミ(e/4)の位置に、f4 (F#4) がファ(f/4)の位置に正しく配置されることの検証
    const vexOutput = createVexNotesForMeasure(notes, 0, 4, 'treble');
    const noteItems = vexOutput.items.filter((it) => !it.isRest);
    expect(noteItems.length).toBe(3);
    // 最初の音 e4 (実音 F4) は五線譜上 e/4 に置かれる
    expect(noteItems[0].staveNote.getKeys()).toEqual(['e/4']);
    // 次の音 f4 (実音 F#4) は五線譜上 f/4 に置かれる
    expect(noteItems[1].staveNote.getKeys()).toEqual(['f/4']);
    // ナチュラル e=4 は五線譜上 e/4 に置かれる
    expect(noteItems[2].staveNote.getKeys()).toEqual(['e/4']);
  });

  it('調号下の音階にさらに#を付けた場合、Unicode♮指定、一度ナチュラルにした後の調号自動復帰、調号消去を正しく処理できる', () => {
    // 1. 調号で既に#が付いている音階にさらに#を明示指定した場合: 全音上がるのではなく F#4 (66) になる
    const mml = `
      Key G
      o4 f4 f#4 f♮4 f4
    `;
    const score = parseMML(mml);
    const notes = score.tracks[0].notes;
    expect(notes.length).toBe(4);

    // 1音目: f4 -> 調号により自動的に F#4 (MIDI 66)
    expect(notes[0].pitch).toBe('F#4');
    expect(notes[0].midiNote).toBe(66);
    expect(notes[0].isKeyAltered).toBe(true);

    // 2音目: f#4 -> さらに#を付けても全音(G)にはならず、明示的シャープ F#4 (MIDI 66)
    expect(notes[1].pitch).toBe('F#4');
    expect(notes[1].midiNote).toBe(66);
    expect(notes[1].accidentalType).toBe('#');

    // 3音目: f♮4 -> Unicode ナチュラル記号で白鍵 F4 (MIDI 65)
    expect(notes[2].pitch).toBe('F4');
    expect(notes[2].midiNote).toBe(65);
    expect(notes[2].accidentalType).toBe('n');

    // 4音目: f4 -> 一度ナチュラルにした後、次は何も付けなくても自動的に調号 F#4 (MIDI 66) に戻る！
    expect(notes[3].pitch).toBe('F#4');
    expect(notes[3].midiNote).toBe(66);
    expect(notes[3].isKeyAltered).toBe(true);

    // 5. 調号を消す場合: Key C または Key 0 または {=} でハ長調（調号なし）に戻る
    const mmlReset = `
      Key G
      o4 f4
      Key C
      o4 f4
    `;
    const scoreReset = parseMML(mmlReset);
    expect(scoreReset.tracks[0].notes[0].pitch).toBe('F#4');
    expect(scoreReset.tracks[0].notes[1].pitch).toBe('F4'); // 調号リセット後は白鍵F4
  });
});
