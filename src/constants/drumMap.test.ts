import { describe, it, expect } from 'vitest';
import { getDrumInfo, isDrumMidiNote, GM_DRUM_MAP } from './drumMap';

describe('drumMap', () => {
  it('主要なGMドラムノート情報が正しく取得できる', () => {
    // 36: Bass Drum 1
    const kick = getDrumInfo(36);
    expect(kick).toBeDefined();
    expect(kick?.shortName).toBe('Kick');
    expect(kick?.category).toBe('kick');

    // 38: Snare
    const snare = getDrumInfo(38);
    expect(snare).toBeDefined();
    expect(snare?.shortName).toBe('Snare');
    expect(snare?.category).toBe('snare');

    // 42: Closed Hi-Hat
    const hihat = getDrumInfo(42);
    expect(hihat).toBeDefined();
    expect(hihat?.shortName).toBe('Cl.Hat');
    expect(hihat?.category).toBe('hihat');

    // 49: Crash Cymbal
    const crash = getDrumInfo(49);
    expect(crash).toBeDefined();
    expect(crash?.shortName).toBe('Crash');
    expect(crash?.category).toBe('cymbal');
  });

  it('isDrumMidiNote がGMドラム音域(35〜81)を正しく判定する', () => {
    expect(isDrumMidiNote(34)).toBe(false);
    expect(isDrumMidiNote(35)).toBe(true);
    expect(isDrumMidiNote(60)).toBe(true);
    expect(isDrumMidiNote(81)).toBe(true);
    expect(isDrumMidiNote(82)).toBe(false);
  });

  it('GMドラムマップに主要な打楽器が網羅されている', () => {
    expect(Object.keys(GM_DRUM_MAP).length).toBeGreaterThanOrEqual(40);
  });
});
