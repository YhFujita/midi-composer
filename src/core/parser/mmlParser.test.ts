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
});
