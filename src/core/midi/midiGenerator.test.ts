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
});
