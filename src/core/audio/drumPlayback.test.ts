import { describe, it, expect } from 'vitest';
import { parseMML } from '../parser/mmlParser';

describe('drum playback logic in mml parser and sound font player', () => {
  it('identifies drum notes and separates channels correctly', () => {
    const mml = `
TR(1) Voice(40) o4 c d e f
TR(2) CH(10) Voice(0) o2 f#4 r4 f#4 r4
`;
    const score = parseMML(mml);
    expect(score.tracks.length).toBe(2);
    expect(score.tracks[0].channel).toBe(1);
    expect(score.tracks[1].channel).toBe(10);
    
    // Drum notes
    const drumNotes = score.tracks[1].notes;
    expect(drumNotes.length).toBe(2);
    expect(drumNotes[0].midiNote).toBe(42); // Closed Hi-Hat
    expect(drumNotes[0].channel).toBe(10);
  });

  it('identifies in-track drum channel switches', () => {
    const mml = `
TR(1) Voice(40) o4 c4 CH(10) Voice(0) o2 f#4 CH(1) Voice(40) o4 d4
`;
    const score = parseMML(mml);
    expect(score.tracks.length).toBe(1);
    const notes = score.tracks[0].notes;
    expect(notes.length).toBe(3);
    expect(notes[0].channel).toBe(1);
    expect(notes[1].channel).toBe(10);
    expect(notes[1].midiNote).toBe(42);
    expect(notes[2].channel).toBe(1);
  });
});
