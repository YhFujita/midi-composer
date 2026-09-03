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

  it('タイで結合された音符 (c4 & c4) が重複発音されずに1音として出力されること', async () => {
    const mml = 't120 c4 & c4';
    const score = parseMML(mml);
    const blob = generateMidiBlob(score);

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));

    // Note On (0x90, 60, >0) をカウント
    let noteOnCount = 0;
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x90 && bytes[i + 1] === 60 && bytes[i + 2] > 0) {
        noteOnCount++;
      }
    }
    // タイで2つの音符が結合されているため、Note On は1回のみ
    expect(noteOnCount).toBe(1);
  });
});
