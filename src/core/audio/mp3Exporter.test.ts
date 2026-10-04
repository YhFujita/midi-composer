import { describe, it, expect, vi } from 'vitest';
import { exportToMp3 } from './mp3Exporter';
import { audioEngine } from './soundFontPlayer';
import { ParsedScore } from '../../types/mml';

describe('mp3Exporter', () => {
  it('ParsedScore から正常に MP3 Blob を生成できる', async () => {
    // 擬似的な AudioBuffer をモック
    const sampleRate = 44100;
    const length = 44100; // 1秒
    const leftData = new Float32Array(length);
    const rightData = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      leftData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
      rightData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }

    const mockAudioBuffer = {
      numberOfChannels: 2,
      sampleRate,
      length,
      duration: 1,
      getChannelData: (ch: number) => (ch === 0 ? leftData : rightData),
    } as unknown as AudioBuffer;

    vi.spyOn(audioEngine, 'renderOffline').mockResolvedValue(mockAudioBuffer);

    const dummyScore: ParsedScore = {
      title: 'Test',
      tempoEvents: [{ time: 0, bpm: 120 }],
      timeSignature: { numerator: 4, denominator: 4 },
      tracks: [
        {
          id: 1,
          name: 'Track 1',
          channel: 1,
          instrument: 0,
          notes: [
            {
              pitch: 'C4',
              startTime: 0,
              duration: 1,
              midiNote: 60,
              velocity: 100,
              trackId: 1,
              channel: 1,
            },
          ],
        },
      ],
      totalDuration: 1,
      errors: [],
    };

    const progressLogs: number[] = [];
    const blob = await exportToMp3(dummyScore, (p) => {
      progressLogs.push(p);
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
    expect(blob.size).toBeGreaterThan(0);
    expect(progressLogs).toContain(10);
    expect(progressLogs).toContain(50);
    expect(progressLogs).toContain(100);
  });
});
