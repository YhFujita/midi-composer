import { describe, it, expect } from 'vitest';
import { parseMML, findBeatAtCursor } from './mmlParser';
import { PRESET_SONGS } from '../../constants/presets';

describe('MML Parser', () => {
  it('基本的な単音とデフォルト音長をパースできること', () => {
    const code = 'l4 c d e f';
    const result = parseMML(code);

    expect(result.errors).toHaveLength(0);
    expect(result.tracks).toHaveLength(1);
    const notes = result.tracks[0].notes;
    expect(notes).toHaveLength(4);
    expect(notes[0].pitch).toBe('C4');
    expect(notes[0].duration).toBe(1.0);
    expect(notes[1].pitch).toBe('D4');
    expect(notes[1].startTime).toBe(1.0);
  });

  it('オクターブシフトと付点音符、テンポ設定が正しく動作すること', () => {
    const code = 't140 o5 c4. d8 > c2 <';
    const result = parseMML(code);

    expect(result.errors).toHaveLength(0);
    expect(result.tempoEvents[result.tempoEvents.length - 1].bpm).toBe(140);
    const notes = result.tracks[0].notes;
    expect(notes[0].pitch).toBe('C5');
    expect(notes[0].duration).toBe(1.5); // 4分音符付点 = 1.5
    expect(notes[1].pitch).toBe('D5');
    expect(notes[1].duration).toBe(0.5); // 8分音符 = 0.5
    expect(notes[2].pitch).toBe('C6'); // > で o6 にシフト
    expect(notes[2].duration).toBe(2.0); // 2分音符 = 2.0
  });

  it('和音 [ceg]4 をパースできること', () => {
    const code = '[ceg]4';
    const result = parseMML(code);

    expect(result.errors).toHaveLength(0);
    const notes = result.tracks[0].notes;
    expect(notes).toHaveLength(3);
    // 3音とも開始時刻と長さが同一であること
    expect(notes[0].startTime).toBe(0);
    expect(notes[1].startTime).toBe(0);
    expect(notes[2].startTime).toBe(0);
    expect(notes[0].duration).toBe(1.0);
    expect(notes[0].pitch).toBe('C4');
    expect(notes[1].pitch).toBe('E4');
    expect(notes[2].pitch).toBe('G4');
  });

  it('小節線 | を含むプリセット曲がエラーなくパースできること', () => {
    PRESET_SONGS.forEach((song) => {
      const result = parseMML(song.mml);
      expect(result.errors).toHaveLength(0);
      expect(result.tracks.length).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
    });
  });

  it('休符 r4 によって時間が進むこと', () => {
    const code = 'c4 r4 e4';
    const result = parseMML(code);

    const notes = result.tracks[0].notes;
    expect(notes).toHaveLength(2);
    expect(notes[0].startTime).toBe(0);
    expect(notes[1].startTime).toBe(2.0); // c4 (1.0) + r4 (1.0) = 2.0
  });

  it('Voice(n) およびブロックコメント付きの楽器指定が正しく認識されること', () => {
    const code = 'TR(1) Voice(48) /* ストリングス */ c4 d4\nTR(2) Voice(73) /* フルート */ e4 f4';
    const result = parseMML(code);

    expect(result.errors).toHaveLength(0);
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].instrument).toBe(48);
    expect(result.tracks[0].notes).toHaveLength(2);
    expect(result.tracks[1].instrument).toBe(73);
    expect(result.tracks[1].notes).toHaveLength(2);
  });

  it('q コマンドおよび Gate コマンドでゲートタイム(発音長)が正しく反映されること', () => {
    // 8段階指定 (q4 = 50%), パーセント指定 (q80 = 80%), Gate(25) = 25%
    const code = 'l4 q4 c q80 d Gate(25) e q8 [ceg]4';
    const result = parseMML(code);

    expect(result.errors).toHaveLength(0);
    const notes = result.tracks[0].notes;
    // c (q4: 50% = 0.5)
    expect(notes[0].pitch).toBe('C4');
    expect(notes[0].duration).toBe(1.0);
    expect(notes[0].gateRate).toBe(0.5);
    expect(notes[0].gateDuration).toBe(0.5);

    // d (q80: 80% = 0.8)
    expect(notes[1].pitch).toBe('D4');
    expect(notes[1].duration).toBe(1.0);
    expect(notes[1].gateRate).toBe(0.8);
    expect(notes[1].gateDuration).toBe(0.8);

    // e (Gate(25): 25% = 0.25)
    expect(notes[2].pitch).toBe('E4');
    expect(notes[2].duration).toBe(1.0);
    expect(notes[2].gateRate).toBe(0.25);
    expect(notes[2].gateDuration).toBe(0.25);

    // [ceg]4 (q8: 100% = 1.0)
    expect(notes[3].pitch).toBe('C4');
    expect(notes[3].gateRate).toBe(1.0);
    expect(notes[3].gateDuration).toBe(1.0);
    expect(notes[4].pitch).toBe('E4');
    expect(notes[4].gateDuration).toBe(1.0);
    expect(notes[5].pitch).toBe('G4');
    expect(notes[5].gateDuration).toBe(1.0);
  });

  describe('移調 (トランスポーズ) 機能', () => {
    it('Key(-1) で短2度下がる (半音下げ: C4 -> B3)', () => {
      const code = 'Key(-1) o4 c4 d4 e4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(3);
      // c4 (MIDI 60) -> 59 (B3)
      expect(notes[0].midiNote).toBe(59);
      expect(notes[0].pitch).toBe('B3');
      expect(notes[0].originalPitch).toBe('C4');
      expect(notes[0].keyShift).toBe(-1);

      // d4 (MIDI 62) -> 61 (C#4)
      expect(notes[1].midiNote).toBe(61);
      expect(notes[1].pitch).toBe('C#4');
      expect(notes[1].originalPitch).toBe('D4');

      // e4 (MIDI 64) -> 63 (D#4)
      expect(notes[2].midiNote).toBe(63);
      expect(notes[2].pitch).toBe('D#4');
    });

    it('Key(2) で長2度上がる (全音上げ: C4 -> D4)', () => {
      const code = 'Key(2) o4 c4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const note = result.tracks[0].notes[0];
      // c4 (MIDI 60) -> 62 (D4)
      expect(note.midiNote).toBe(62);
      expect(note.pitch).toBe('D4');
      expect(note.originalPitch).toBe('C4');
      expect(note.keyShift).toBe(2);
    });

    it('曲の途中で Key(n) を変更して転調できること', () => {
      // 最初の2音は原調(0)、後半2音は短2度下げ(-1)
      const code = 'o4 c4 d4 Key(-1) c4 d4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(4);

      // 前半: 移調なし
      expect(notes[0].pitch).toBe('C4');
      expect(notes[0].midiNote).toBe(60);
      expect(notes[1].pitch).toBe('D4');
      expect(notes[1].midiNote).toBe(62);

      // 後半: 半音下げ (-1)
      expect(notes[2].pitch).toBe('B3');
      expect(notes[2].midiNote).toBe(59);
      expect(notes[3].pitch).toBe('C#4');
      expect(notes[3].midiNote).toBe(61);
    });

    it('トラック毎に異なる移調量を指定できること', () => {
      const code = 'TR(1) Key(0) o4 c4\nTR(2) Key(-1) o4 c4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      expect(result.tracks).toHaveLength(2);
      // TR1 は C4 (60)
      expect(result.tracks[0].notes[0].pitch).toBe('C4');
      expect(result.tracks[0].notes[0].midiNote).toBe(60);

      // TR2 は B3 (59)
      expect(result.tracks[1].notes[0].pitch).toBe('B3');
      expect(result.tracks[1].notes[0].midiNote).toBe(59);
    });

    it('MasterKey(n) で全トラックに全体移調が適用されること', () => {
      const code = 'MasterKey(-1)\nTR(1) o4 c4\nTR(2) o4 e4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      // TR1: C4 (60) -> B3 (59)
      expect(result.tracks[0].notes[0].pitch).toBe('B3');
      expect(result.tracks[0].notes[0].midiNote).toBe(59);
      // TR2: E4 (64) -> D#4 (63)
      expect(result.tracks[1].notes[0].pitch).toBe('D#4');
      expect(result.tracks[1].notes[0].midiNote).toBe(63);
    });

    it('和音 [ceg]4 に対しても移調が正しく適用されること', () => {
      const code = 'Key(-1) [ceg]4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(3);
      // C4 -> B3
      expect(notes[0].pitch).toBe('B3');
      expect(notes[0].midiNote).toBe(59);
      // E4 -> D#4
      expect(notes[1].pitch).toBe('D#4');
      expect(notes[1].midiNote).toBe(63);
      // G4 -> F#4
      expect(notes[2].pitch).toBe('F#4');
      expect(notes[2].midiNote).toBe(66);
    });

    it('オプションの globalKeyShift が全体に移調を加算すること', () => {
      const code = 'o4 c4';
      const result = parseMML(code, { globalKeyShift: -1 });

      expect(result.errors).toHaveLength(0);
      expect(result.tracks[0].notes[0].pitch).toBe('B3');
      expect(result.tracks[0].notes[0].midiNote).toBe(59);
      expect(result.globalKeyShift).toBe(-1);
    });
  });

  describe('和音のバラシ (ギターストローク・ジャララーン) 演奏機能', () => {
    it('[~ceg]4 でダウンストローク (低音→高音) のバラシ情報が付与されること', () => {
      const code = '[~ceg]4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(3);

      // 構成音すべてに isStrum が付与され、ダウンストロークであること
      expect(notes[0].isStrum).toBe(true);
      expect(notes[0].strumDirection).toBe('down');
      expect(notes[0].strumOrder).toBe(0); // C4 (最低音)
      expect(notes[0].strumTotal).toBe(3);

      expect(notes[1].isStrum).toBe(true);
      expect(notes[1].strumDirection).toBe('down');
      expect(notes[1].strumOrder).toBe(1); // E4

      expect(notes[2].isStrum).toBe(true);
      expect(notes[2].strumDirection).toBe('down');
      expect(notes[2].strumOrder).toBe(2); // G4 (最高音)
    });

    it('[~^ceg]4 でアップストローク (高音→低音) のバラシ情報が付与されること', () => {
      const code = '[~^ceg]4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(3);

      expect(notes[0].isStrum).toBe(true);
      expect(notes[0].strumDirection).toBe('up');
      // 高音から順に order が付与されていること
      const gNote = notes.find((n) => n.pitch === 'G4');
      const cNote = notes.find((n) => n.pitch === 'C4');
      expect(gNote?.strumOrder).toBe(0); // G4が最初
      expect(cNote?.strumOrder).toBe(2); // C4が最後
    });

    it('[ceg]~4 や [ceg]4~ でもバラシとして正しくパースできること', () => {
      const code1 = '[ceg]~4';
      const res1 = parseMML(code1);
      expect(res1.errors).toHaveLength(0);
      expect(res1.tracks[0].notes[0].isStrum).toBe(true);

      const code2 = '[ceg]4~';
      const res2 = parseMML(code2);
      expect(res2.errors).toHaveLength(0);
      expect(res2.tracks[0].notes[0].isStrum).toBe(true);
    });

    it('[~16ceg]4 や [~64ceg]4 で速度が正しく反映されること', () => {
      const slow = parseMML('[~16ceg]4');
      expect(slow.tracks[0].notes[0].strumDelaySec).toBe(0.07);

      const fast = parseMML('[~64ceg]4');
      expect(fast.tracks[0].notes[0].strumDelaySec).toBe(0.018);
    });
  });

  describe('ペダル (ダンパー / サステイン) 機能', () => {
    it('Pedal 〜 PedalOff でアルペジオ各音に hasPedal と pedalReleaseTime が付与されること', () => {
      // 8分音符4つのアルペジオ (総時間 2.0拍)
      const code = 'l8 Pedal c e g > c PedalOff';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(4);

      // すべてのノートが hasPedal === true で、ペダル解放時刻が 2.0拍 であること
      notes.forEach((note) => {
        expect(note.hasPedal).toBe(true);
        expect(note.pedalReleaseTime).toBe(2.0);
      });

      // 開始時間はそれぞれ 0, 0.5, 1.0, 1.5
      expect(notes[0].startTime).toBe(0);
      expect(notes[1].startTime).toBe(0.5);
      expect(notes[2].startTime).toBe(1.0);
      expect(notes[3].startTime).toBe(1.5);

      // pedalEvents が ON と OFF の2件記録されていること
      expect(result.tracks[0].pedalEvents).toBeDefined();
      expect(result.tracks[0].pedalEvents).toHaveLength(2);
      expect(result.tracks[0].pedalEvents![0]).toEqual({
        time: 0,
        type: 'on',
        trackId: 0,
        channel: 1,
      });
      expect(result.tracks[0].pedalEvents![1]).toEqual({
        time: 2.0,
        type: 'off',
        trackId: 0,
        channel: 1,
      });
    });

    it('ペダル区間外の音符には pedalReleaseTime が付与されないこと', () => {
      const code = 'c4 Pedal d4 e4 PedalOff f4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes).toHaveLength(4);

      // c4 (ペダル前)
      expect(notes[0].hasPedal).toBeUndefined();
      expect(notes[0].pedalReleaseTime).toBeUndefined();

      // d4, e4 (ペダル中: ペダル離下時刻は 3.0拍)
      expect(notes[1].hasPedal).toBe(true);
      expect(notes[1].pedalReleaseTime).toBe(3.0);
      expect(notes[2].hasPedal).toBe(true);
      expect(notes[2].pedalReleaseTime).toBe(3.0);

      // f4 (ペダル後)
      expect(notes[3].hasPedal).toBeUndefined();
      expect(notes[3].pedalReleaseTime).toBeUndefined();
    });

    it('短縮記法 P1 / P0 および Pedal(1) / Pedal(0) が正しく動作すること', () => {
      const code1 = 'P1 c4 d4 P0';
      const res1 = parseMML(code1);
      expect(res1.errors).toHaveLength(0);
      expect(res1.tracks[0].notes[0].hasPedal).toBe(true);
      expect(res1.tracks[0].notes[0].pedalReleaseTime).toBe(2.0);

      const code2 = 'Pedal(1) c4 d4 Pedal(0)';
      const res2 = parseMML(code2);
      expect(res2.errors).toHaveLength(0);
      expect(res2.tracks[0].notes[0].hasPedal).toBe(true);
      expect(res2.tracks[0].notes[0].pedalReleaseTime).toBe(2.0);

      const code3 = '_P c4 d4 _p';
      const res3 = parseMML(code3);
      expect(res3.errors).toHaveLength(0);
      expect(res3.tracks[0].notes[0].hasPedal).toBe(true);
      expect(res3.tracks[0].notes[0].pedalReleaseTime).toBe(2.0);
    });

    it('ペダルがOFFにならず曲末尾に達した場合、末尾時刻で自動解放されること', () => {
      const code = 'Pedal c4 d4';
      const result = parseMML(code);

      expect(result.errors).toHaveLength(0);
      const notes = result.tracks[0].notes;
      expect(notes[0].pedalReleaseTime).toBe(2.0);
      expect(notes[1].pedalReleaseTime).toBe(2.0);
      expect(result.totalDuration).toBe(2.0);
    });
  });

  describe('findBeatAtCursor (カーソル位置からの再生拍数導出)', () => {
    it('音符の直上または直前にある場合、その音符の開始拍が返ること', () => {
      // 1行目: "c4 d4 e4 f4"
      // c4: col 1..2 (beat 0)
      // d4: col 4..5 (beat 1)
      // e4: col 7..8 (beat 2)
      // f4: col 10..11 (beat 3)
      const code = 'c4 d4 e4 f4';
      const score = parseMML(code);

      // c4の上 (line 1, col 1) -> beat 0
      expect(findBeatAtCursor(score.timelineItems, 1, 1)).toBe(0);
      // d4の上 (line 1, col 4) -> beat 1
      expect(findBeatAtCursor(score.timelineItems, 1, 4)).toBe(1.0);
      // e4の上 (line 1, col 7) -> beat 2
      expect(findBeatAtCursor(score.timelineItems, 1, 7)).toBe(2.0);
      // f4の上 (line 1, col 10) -> beat 3
      expect(findBeatAtCursor(score.timelineItems, 1, 10)).toBe(3.0);
    });

    it('小節線や空白などの区切り上にある場合、後続の音符の開始拍が返ること', () => {
      const code = 'c4 d4 | e4 f4';
      const score = parseMML(code);

      // | の上 (line 1, col 7) -> 次の音符 e4 (col 9, beat 2)
      expect(findBeatAtCursor(score.timelineItems, 1, 7)).toBe(2.0);
      // c4 と d4 の間のスペース (line 1, col 3) -> 次の音符 d4 (beat 1)
      expect(findBeatAtCursor(score.timelineItems, 1, 3)).toBe(1.0);
    });

    it('行末にカーソルがある場合、次の行の先頭音符の開始拍が返ること', () => {
      const code = 'c4 d4\ne4 f4';
      const score = parseMML(code);

      // 1行目の行末 (line 1, col 10) -> 2行目の e4 (beat 2)
      expect(findBeatAtCursor(score.timelineItems, 1, 10)).toBe(2.0);
    });

    it('コメント行や空行、トラック宣言行にある場合、後続行の先頭音符が返ること', () => {
      const code = '// コメント\n\nTR(1) o4 l4\nc d e f';
      const score = parseMML(code);

      // 1行目 (コメント) -> c (beat 0)
      expect(findBeatAtCursor(score.timelineItems, 1, 1)).toBe(0);
      // 2行目 (空行) -> c (beat 0)
      expect(findBeatAtCursor(score.timelineItems, 2, 1)).toBe(0);
      // 3行目 (TR(1)) -> TR(1) の beat 0
      expect(findBeatAtCursor(score.timelineItems, 3, 1)).toBe(0);
    });

    it('和音 [ceg]4 や休符 r4 の位置も正確に反映されること', () => {
      const code = 'c4 r4 [ceg]4 d4';
      const score = parseMML(code);

      // c4 (beat 0)
      expect(findBeatAtCursor(score.timelineItems, 1, 1)).toBe(0);
      // r4 (line 1, col 4) -> 休符 (beat 1.0)
      expect(findBeatAtCursor(score.timelineItems, 1, 4)).toBe(1.0);
      // [ceg]4 の中 (line 1, col 8) -> 和音 (beat 2.0)
      expect(findBeatAtCursor(score.timelineItems, 1, 8)).toBe(2.0);
      // d4 (line 1, col 14) -> beat 3.0
      expect(findBeatAtCursor(score.timelineItems, 1, 14)).toBe(3.0);
    });

    it('複数トラックにおいてトラック2の行にカーソルがある場合、そのトラックの拍数が返ること', () => {
      const code = 'TR(1) o4 l4\nc d e f\n\nTR(2) o4 l4\ng a b > c';
      const score = parseMML(code);

      // トラック2の1音目 g (5行目 col 1) -> beat 0
      expect(findBeatAtCursor(score.timelineItems, 5, 1)).toBe(0);
      // トラック2の3音目 b (5行目 col 5) -> beat 2
      expect(findBeatAtCursor(score.timelineItems, 5, 5)).toBe(2.0);
    });
  });

  describe('タイ (Tie) & スラー (Slur)', () => {
    it('& 記号または ^ 記号で同一音高の音符がタイ結合されること', () => {
      const code = 'c4 & c4 c4 ^ c8';
      const score = parseMML(code);

      expect(score.errors).toHaveLength(0);
      const notes = score.tracks[0].notes;
      expect(notes).toHaveLength(4);

      // c4 & c4
      expect(notes[0].pitch).toBe('C4');
      expect(notes[0].hasTieToNext).toBe(true);
      expect(notes[0].hasTieFromPrev).toBeFalsy();

      expect(notes[1].pitch).toBe('C4');
      expect(notes[1].hasTieFromPrev).toBe(true);
      expect(notes[1].hasTieToNext).toBeFalsy();

      // c4 ^ c8
      expect(notes[2].pitch).toBe('C4');
      expect(notes[2].hasTieToNext).toBe(true);
      expect(notes[2].hasTieFromPrev).toBeFalsy();

      expect(notes[3].pitch).toBe('C4');
      expect(notes[3].hasTieFromPrev).toBe(true);
      expect(notes[3].hasTieToNext).toBeFalsy();
    });

    it('和音 [ceg]4 & [ceg]4 が正しくタイ結合されること', () => {
      const code = '[ceg]4 & [ceg]2';
      const score = parseMML(code);

      expect(score.errors).toHaveLength(0);
      const notes = score.tracks[0].notes;
      expect(notes).toHaveLength(6);

      // 前の和音3音に hasTieToNext が付く
      expect(notes[0].hasTieToNext).toBe(true);
      expect(notes[1].hasTieToNext).toBe(true);
      expect(notes[2].hasTieToNext).toBe(true);

      // 後ろの和音3音に hasTieFromPrev が付く
      expect(notes[3].hasTieFromPrev).toBe(true);
      expect(notes[4].hasTieFromPrev).toBe(true);
      expect(notes[5].hasTieFromPrev).toBe(true);
    });

    it('& 記号で異なる音高の音符がスラー（レガート）結合されること', () => {
      const code = 'c4 & d4 & e4';
      const score = parseMML(code);

      expect(score.errors).toHaveLength(0);
      const notes = score.tracks[0].notes;
      expect(notes).toHaveLength(3);

      // スラーIDが共通
      const slurId = notes[0].slurGroupId;
      expect(slurId).toBeDefined();
      expect(notes[1].slurGroupId).toBe(slurId);
      expect(notes[2].slurGroupId).toBe(slurId);

      // 開始音と終了音
      expect(notes[0].isSlurStart).toBe(true);
      expect(notes[0].isSlurEnd).toBeFalsy();
      expect(notes[1].isSlurStart).toBeFalsy();
      expect(notes[1].isSlurEnd).toBeFalsy();
      expect(notes[2].isSlurStart).toBeFalsy();
      expect(notes[2].isSlurEnd).toBe(true);

      // レガート (gateRate = 1.0)
      expect(notes[0].gateRate).toBe(1.0);
      expect(notes[1].gateRate).toBe(1.0);
      expect(notes[2].gateRate).toBe(1.0);
    });

    it('Slur(...) コマンドで指定されたフレーズがスラー化されること', () => {
      const code = 'q4 Slur( c4 d4 e4 f4 ) g4';
      const score = parseMML(code);

      expect(score.errors).toHaveLength(0);
      const notes = score.tracks[0].notes;
      expect(notes).toHaveLength(5);

      // スラー内の4音
      const sId = notes[0].slurGroupId;
      expect(sId).toBeDefined();
      expect(notes[0].isSlurStart).toBe(true);
      expect(notes[1].slurGroupId).toBe(sId);
      expect(notes[2].slurGroupId).toBe(sId);
      expect(notes[3].slurGroupId).toBe(sId);
      expect(notes[3].isSlurEnd).toBe(true);

      // スラー外の音符
      expect(notes[4].slurGroupId).toBeUndefined();
      expect(notes[4].gateRate).toBe(0.5); // q4 の設定が生きている
    });

    it('SlurOn / SlurOff コマンドで区間スラーが機能すること', () => {
      const code = 'SlurOn c4 d4 SlurOff e4';
      const score = parseMML(code);

      expect(score.errors).toHaveLength(0);
      const notes = score.tracks[0].notes;
      expect(notes).toHaveLength(3);

      expect(notes[0].isSlurStart).toBe(true);
      expect(notes[1].isSlurEnd).toBe(true);
      expect(notes[0].slurGroupId).toBe(notes[1].slurGroupId);
      expect(notes[2].slurGroupId).toBeUndefined();
    });

    it('休符 r を挟んだ場合はタイ・スラーの接続が途切れること', () => {
      const code = 'c4 & r4 c4';
      const score = parseMML(code);

      expect(score.errors).toHaveLength(0);
      const notes = score.tracks[0].notes;
      expect(notes).toHaveLength(2);
      expect(notes[0].hasTieToNext).toBeFalsy();
      expect(notes[1].hasTieFromPrev).toBeFalsy();
    });
  });
});



