import { audioEngine } from './soundFontPlayer';
import { ParsedScore } from '../../types/mml';
import lamejs from 'lamejs';

/**
 * Float32 配列 (-1.0 ~ 1.0) を Int16 配列 (-32768 ~ 32767) に変換する
 */
function convertFloat32ToInt16(buffer: Float32Array): Int16Array {
  let l = buffer.length;
  const buf = new Int16Array(l);
  while (l--) {
    const s = Math.max(-1, Math.min(1, buffer[l]));
    buf[l] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buf;
}

/**
 * ParsedScore をバックグラウンドレンダリングし、MP3 Blob を生成する
 */
export async function exportToMp3(
  score: ParsedScore,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  if (onProgress) onProgress(10);

  // 1. OfflineAudioContext で無音レンダリング (WAV/PCM AudioBuffer)
  const audioBuffer = await audioEngine.renderOffline(score);
  if (onProgress) onProgress(50);

  // 2. Lamejs による MP3 エンコード
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 192; // 192 kbps 高音質

  const mp3Encoder = new (lamejs as any).Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

  const sampleBlockSize = 1152; // LAME の標準フレームサイズ
  const leftInt16 = convertFloat32ToInt16(leftChannel);
  const rightInt16 = convertFloat32ToInt16(rightChannel);

  const numSamples = leftInt16.length;
  for (let i = 0; i < numSamples; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);

    const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    if (onProgress && i % (sampleBlockSize * 20) === 0) {
      const p = 50 + Math.round((i / numSamples) * 45);
      onProgress(p);
    }
  }

  // フラッシュ処理
  const endBuf = mp3Encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  if (onProgress) onProgress(100);

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
}
