import { describe, it, expect } from 'vitest';
import { parseMML } from './mmlParser';
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
});


