import { ParsedScore } from '../types/mml';

export interface CursorMmlContext {
  trackId: number;
  channel: number;
  instrument: number;
  isDrum: boolean;
}

/**
 * MMLコードとカーソル行・列番号から、現在のカーソル位置における
 * トラック番号、チャンネル番号、音色番号、およびドラムパート判定を導出する。
 */
export function detectCursorContext(
  mmlCode: string,
  cursorLine: number,
  _cursorColumn: number,
  score?: ParsedScore
): CursorMmlContext {
  const lines = mmlCode.split('\n');
  const targetLineIdx = Math.max(0, Math.min(lines.length - 1, cursorLine - 1));

  let currentTrackId = 0;
  let currentChannel = 1;
  let currentInstrument = 0;

  let inBlockComment = false;

  for (let l = 0; l <= targetLineIdx; l++) {
    const line = lines[l];
    let col = 0;

    while (col < line.length) {
      if (inBlockComment) {
        const endComment = line.indexOf('*/', col);
        if (endComment !== -1) {
          inBlockComment = false;
          col = endComment + 2;
          continue;
        } else {
          break;
        }
      }

      if (line.startsWith('/*', col)) {
        inBlockComment = true;
        col += 2;
        continue;
      }
      if (line.startsWith('//', col) || line.startsWith(';', col)) {
        break;
      }

      const remaining = line.slice(col);

      // トラック指定: TR(n), Track(n), TR=n
      const trackMatch = remaining.match(/^(?:TR(?:ACK)?\(?=?\s*(\d+)\)?)/i);
      if (trackMatch) {
        const trNum = parseInt(trackMatch[1], 10);
        currentTrackId = trNum > 0 ? trNum - 1 : 0;
        // トラックデフォルトチャンネル
        currentChannel = Math.min(16, Math.max(1, currentTrackId + 1));
        col += trackMatch[0].length;
        continue;
      }

      // チャンネル指定: CH(n), Channel(n), CH=n
      const chMatch = remaining.match(/^(?:CH(?:ANNEL)?\(?=?\s*(\d+)\)?)/i);
      if (chMatch) {
        const chNum = parseInt(chMatch[1], 10);
        currentChannel = Math.max(1, Math.min(16, chNum));
        col += chMatch[0].length;
        continue;
      }

      // 音色指定: Voice(n), @n, Program(n)
      const voiceMatch = remaining.match(/^(?:(?:VOICE|PROGRAM)\(?=?\s*(\d+)\)?|@\s*(\d+))/i);
      if (voiceMatch) {
        currentInstrument = parseInt(voiceMatch[1] || voiceMatch[2], 10);
        col += voiceMatch[0].length;
        continue;
      }

      col++;
    }
  }

  // score オブジェクトが存在する場合は、該当トラックの実装情報も考慮
  if (score && score.tracks) {
    const track = score.tracks.find((t) => t.id === currentTrackId);
    if (track) {
      if (track.channel) currentChannel = track.channel;
      if (track.instrument !== undefined) currentInstrument = track.instrument;
    }
  }

  // ドラムパート判定: MIDIチャンネル10 (パーカッション) または プログラム128等
  const isDrum = currentChannel === 10 || currentInstrument === 128;

  return {
    trackId: currentTrackId,
    channel: currentChannel,
    instrument: currentInstrument,
    isDrum,
  };
}
