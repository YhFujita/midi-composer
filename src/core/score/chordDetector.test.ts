import { describe, it, expect } from 'vitest';
import {
  detectChordFromPitches,
  detectChordsForMeasure,
  buildChordMml,
  getPitchClass,
  pitchClassToName,
} from './chordDetector';
import { NoteEvent } from '../../types/mml';

describe('chordDetector', () => {
  describe('ピッチクラス変換', () => {
    it('音名からピッチクラスを正しく取得できる', () => {
      expect(getPitchClass('C4')).toBe(0);
      expect(getPitchClass('C#4')).toBe(1);
      expect(getPitchClass('D4')).toBe(2);
      expect(getPitchClass('Eb4')).toBe(3);
      expect(getPitchClass('E4')).toBe(4);
      expect(getPitchClass('F4')).toBe(5);
      expect(getPitchClass('G4')).toBe(7);
      expect(getPitchClass('A4')).toBe(9);
      expect(getPitchClass('B4')).toBe(11);
    });

    it('ピッチクラスから音名を取得できる', () => {
      expect(pitchClassToName(0)).toBe('C');
      expect(pitchClassToName(4)).toBe('E');
      expect(pitchClassToName(7)).toBe('G');
    });
  });

  describe('detectChordFromPitches', () => {
    it('C Major (C, E, G) を正しく認識する', () => {
      const chord = detectChordFromPitches(['C4', 'E4', 'G4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('C');
      expect(chord?.chordType).toBe('');
      expect(chord?.chordName).toBe('C');
    });

    it('A minor (A, C, E) を正しく認識する', () => {
      const chord = detectChordFromPitches(['A3', 'C4', 'E4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('A');
      expect(chord?.chordType).toBe('m');
      expect(chord?.chordName).toBe('Am');
    });

    it('G7 (G, B, D, F) を正しく認識する', () => {
      const chord = detectChordFromPitches(['G3', 'B3', 'D4', 'F4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('G');
      expect(chord?.chordType).toBe('7');
      expect(chord?.chordName).toBe('G7');
    });

    it('Fmaj7 (F, A, C, E) を正しく認識する', () => {
      const chord = detectChordFromPitches(['F3', 'A3', 'C4', 'E4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('F');
      expect(chord?.chordType).toBe('maj7');
      expect(chord?.chordName).toBe('Fmaj7');
    });

    it('Csus4 (C, F, G) を正しく認識する', () => {
      const chord = detectChordFromPitches(['C4', 'F4', 'G4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('C');
      expect(chord?.chordType).toBe('sus4');
      expect(chord?.chordName).toBe('Csus4');
    });

    it('Bdim (B, D, F) を正しく認識する', () => {
      const chord = detectChordFromPitches(['B3', 'D4', 'F4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('B');
      expect(chord?.chordType).toBe('dim');
      expect(chord?.chordName).toBe('Bdim');
    });

    it('オンコード C/E (E, G, C) を正しく認識する (第1展開形)', () => {
      // 最低音がE3
      const chord = detectChordFromPitches(['E3', 'G3', 'C4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('C');
      expect(chord?.bass).toBe('E');
      expect(chord?.chordName).toBe('C/E');
    });

    it('G/B (B, D, G) を正しく認識する', () => {
      const chord = detectChordFromPitches(['B3', 'D4', 'G4']);
      expect(chord).not.toBeNull();
      expect(chord?.root).toBe('G');
      expect(chord?.bass).toBe('B');
      expect(chord?.chordName).toBe('G/B');
    });
  });

  describe('detectChordsForMeasure', () => {
    it('小節内の2つの和音を正しく拍ごとに検出する', () => {
      // 0拍目にCメジャー、2拍目にGメジャー
      const notes: NoteEvent[] = [
        // Beat 0: C4, E4, G4 (duration: 2.0)
        { pitch: 'C4', midiNote: 60, startTime: 0, duration: 2.0, velocity: 100, trackId: 0, channel: 1 },
        { pitch: 'E4', midiNote: 64, startTime: 0, duration: 2.0, velocity: 100, trackId: 0, channel: 1 },
        { pitch: 'G4', midiNote: 67, startTime: 0, duration: 2.0, velocity: 100, trackId: 0, channel: 1 },
        // Beat 2: G3, B3, D4 (duration: 2.0)
        { pitch: 'G3', midiNote: 55, startTime: 2.0, duration: 2.0, velocity: 100, trackId: 0, channel: 1 },
        { pitch: 'B3', midiNote: 59, startTime: 2.0, duration: 2.0, velocity: 100, trackId: 0, channel: 1 },
        { pitch: 'D4', midiNote: 62, startTime: 2.0, duration: 2.0, velocity: 100, trackId: 0, channel: 1 },
      ];

      const detected = detectChordsForMeasure(notes, 0, 4, 'two-beats');
      expect(detected.length).toBe(2);
      expect(detected[0].beatOffset).toBe(0);
      expect(detected[0].chord.chordName).toBe('C');
      expect(detected[1].beatOffset).toBe(2);
      expect(detected[1].chord.chordName).toBe('G');
    });
  });

  describe('buildChordMml', () => {
    it('C Major 4分音符のMMLを生成できる', () => {
      const mml = buildChordMml('C', '', '4');
      expect(mml).toBe('[ceg]4');
    });

    it('Am 2分音符のMMLを生成できる', () => {
      const mml = buildChordMml('A', 'm', '2');
      expect(mml).toBe('[a>ce<]2');
    });

    it('G7 4分音符のMMLを生成できる', () => {
      const mml = buildChordMml('G', '7', '4');
      expect(mml).toBe('[gb>df<]4');
    });
  });
});
