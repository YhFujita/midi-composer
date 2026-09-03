import { describe, it, expect } from 'vitest';
import { parseMML } from '../parser/mmlParser';
import { generateMidiBlob } from './midiGenerator';

describe('MIDI Generator', () => {
  it('MMLから有効なMIDI Blobを生成できること', async () => {
    const mml = 't120 l4 c d e f [ceg]1';
    const score = parseMML(mml);
    const blob = generateMidiBlob(score);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/midi');
    expect(blob.size).toBeGreaterThan(50); // MThd + MTrk ヘッダーとイベント

    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // MThd マジックバイトの検証
    const magic = String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3]);
    expect(magic).toBe('MThd');
  });

  it('Pedal 〜 PedalOff の MML から CC#64 (Hold 1 / Sustain) を含むMIDIが生成されること', async () => {
    const mml = 't120 Pedal c4 d4 PedalOff';
    const score = parseMML(mml);
    const blob = generateMidiBlob(score);

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));

    // CC#64 ON (0xB0, 0x40, 0x7F) が含まれていること
    const hasPedalOn = bytes.some((b, i) => b === 0xb0 && bytes[i + 1] === 0x40 && bytes[i + 2] === 0x7f);
    expect(hasPedalOn).toBe(true);

    // CC#64 OFF (0xB0, 0x40, 0x00) が含まれていること
    const hasPedalOff = bytes.some((b, i) => b === 0xb0 && bytes[i + 1] === 0x40 && bytes[i + 2] === 0x00);
    expect(hasPedalOff).toBe(true);
  });
});
