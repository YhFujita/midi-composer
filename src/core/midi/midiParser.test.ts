import { describe, it, expect } from 'vitest';
import { parseMML } from '../parser/mmlParser';
import { generateMidiBlob } from './midiGenerator';
import { parseMidiFile } from './midiParser';
import { convertMidiToMml, durationToMmlLength } from './midiToMml';

describe('MIDI Parser & MIDI to MML Converter', () => {
  it('durationToMmlLength で標準的な音長が正しく分解されること', () => {
    expect(durationToMmlLength(1.0)).toBe('4');
    expect(durationToMmlLength(0.5)).toBe('8');
    expect(durationToMmlLength(0.25)).toBe('16');
    expect(durationToMmlLength(2.0)).toBe('2');
    expect(durationToMmlLength(4.0)).toBe('1');
    expect(durationToMmlLength(1.5)).toBe('4.');
    expect(durationToMmlLength(0.75)).toBe('8.');
    expect(durationToMmlLength(2.5)).toBe('2^8');
  });

  it('generateMidiBlob で生成した MIDI バイナリを parseMidiFile で正しく復元できること', async () => {
    const originalMml = `
Tempo(135)
TimeSignature(3,4)
TR(1) Voice(0) v100 o4 l4
c d e
TR(2) Voice(48) v90 o3 l2
[c e g]
`;
    const score = parseMML(originalMml);
    const blob = generateMidiBlob(score);
    const buffer = await blob.arrayBuffer();

    const parsedMidi = parseMidiFile(buffer);

    expect(parsedMidi.ppq).toBe(480);
    expect(parsedMidi.tempos[0].bpm).toBe(135);
    expect(parsedMidi.timeSignatures[0].numerator).toBe(3);
    expect(parsedMidi.timeSignatures[0].denominator).toBe(4);

    // 有効トラック数（トラック1とトラック2）
    expect(parsedMidi.tracks.length).toBe(2);

    const track1 = parsedMidi.tracks[0];
    expect(track1.notes.length).toBe(3);
    expect(track1.notes[0].midiNote).toBe(60); // C4
    expect(track1.notes[1].midiNote).toBe(62); // D4
    expect(track1.notes[2].midiNote).toBe(64); // E4

    const track2 = parsedMidi.tracks[1];
    expect(track2.instrument).toBe(48);
    expect(track2.notes.length).toBe(3); // [c e g]
  });

  it('MIDI データを MML 文字列に逆変換し、再度 MML パーサーで読み込めること (Round-trip)', async () => {
    const originalMml = `
Tempo(120)
TimeSignature(4,4)
TR(1) Voice(0) v100 o4 l4
c d e f | g a b > c <
`;
    const score = parseMML(originalMml);
    const blob = generateMidiBlob(score);
    const buffer = await blob.arrayBuffer();

    const parsedMidi = parseMidiFile(buffer);
    const generatedMml = convertMidiToMml(parsedMidi, { songTitle: 'テストソング' });

    expect(generatedMml).toContain('Tempo(120)');
    expect(generatedMml).toContain('TimeSignature(4,4)');
    expect(generatedMml).toContain('TR(1)');
    expect(generatedMml).toContain('c4');

    // 生成されたMMLを既存の parseMML で解析できること
    const reScore = parseMML(generatedMml);
    expect(reScore.errors.length).toBe(0);
    expect(reScore.tracks.length).toBe(1);
    expect(reScore.tracks[0].notes.length).toBe(8);
  });

  it('和音を含む MIDI データを [c e g]4 形式の MML に変換できること', async () => {
    const originalMml = `
Tempo(120)
TimeSignature(4,4)
TR(1) Voice(0) o4 l4
[c e g]4 [d f a]4
`;
    const score = parseMML(originalMml);
    const blob = generateMidiBlob(score);
    const buffer = await blob.arrayBuffer();

    const parsedMidi = parseMidiFile(buffer);
    const generatedMml = convertMidiToMml(parsedMidi);

    expect(generatedMml).toMatch(/\[.*c.*e.*g.*\]/);
    const reScore = parseMML(generatedMml);
    expect(reScore.errors.length).toBe(0);
    expect(reScore.tracks[0].notes.length).toBe(6);
  });
});
