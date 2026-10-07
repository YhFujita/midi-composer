import { ParsedScore } from '../types/mml';

export interface CursorMmlContext {
  trackId: number;
  channel: number;
  instrument: number;
  isDrum: boolean;
}

interface TrackCursorState {
  channel: number;
  channelExplicit: boolean; // CH(n) が明示的に指定されたか
  instrument: number;
}

/**
 * MMLコードとカーソル行・列番号から、現在のカーソル位置における
 * トラック番号、チャンネル番号、音色番号、およびドラムパート判定を導出する。
 *
 * - 音色 (Voice / @ / Program) はトラックごとに保持し、カーソル位置より前で
 *   最後に指定された音色を返す（曲の途中での楽器変更・復帰に対応）。
 * - カーソル行では、カーソルより前から始まるコマンドに加え、
 *   行頭のヘッダー部分（最初の音符より前の TR / CH / Voice 等）も考慮する。
 */
export function detectCursorContext(
  mmlCode: string,
  cursorLine: number,
  cursorColumn: number,
  score?: ParsedScore
): CursorMmlContext {
  const lines = mmlCode.split('\n');
  const targetLineIdx = Math.max(0, Math.min(lines.length - 1, cursorLine - 1));

  // カーソル行で考慮するコマンドの開始列上限 (0-indexed, この値未満の列で始まるコマンドを適用)
  let lineLimitCol = Math.max(0, cursorColumn - 1);
  if (score?.timelineItems) {
    // カーソル行の最初の音符・休符より前（行頭ヘッダー部分）のコマンドは常に適用する
    const firstNoteOnLine = score.timelineItems.find(
      (item) => item.line === targetLineIdx + 1 && (item.type === 'note' || item.type === 'rest')
    );
    if (firstNoteOnLine) {
      lineLimitCol = Math.max(lineLimitCol, firstNoteOnLine.startColumn - 1);
    } else {
      // 音符のない行（トラック定義行など）は行全体を適用
      lineLimitCol = Number.MAX_SAFE_INTEGER;
    }
  }

  const trackStates = new Map<number, TrackCursorState>();
  const getTrackState = (id: number): TrackCursorState => {
    let st = trackStates.get(id);
    if (!st) {
      st = {
        channel: Math.min(16, Math.max(1, id + 1)), // トラックデフォルトチャンネル
        channelExplicit: false,
        instrument: 0,
      };
      trackStates.set(id, st);
    }
    return st;
  };

  let currentTrackId = 0;
  let currentState = getTrackState(currentTrackId);

  let inBlockComment = false;

  for (let l = 0; l <= targetLineIdx; l++) {
    const line = lines[l];
    const isTargetLine = l === targetLineIdx;
    let col = 0;

    while (col < line.length) {
      // カーソル行では、上限列以降で始まるコマンドは無視
      if (isTargetLine && col >= lineLimitCol) break;

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

      // 文字列リテラル ("...") 内のコマンド文字列は誤検知しないようスキップ
      if (remaining[0] === '"') {
        const closeIdx = line.indexOf('"', col + 1);
        col = closeIdx === -1 ? line.length : closeIdx + 1;
        continue;
      }

      // トラック指定: TR(n), Track(n), TR=n
      const trackMatch = remaining.match(/^(?:TR(?:ACK)?\(?=?\s*(\d+)\)?)/i);
      if (trackMatch) {
        const trNum = parseInt(trackMatch[1], 10);
        currentTrackId = trNum > 0 ? trNum - 1 : 0;
        currentState = getTrackState(currentTrackId);
        col += trackMatch[0].length;
        continue;
      }

      // チャンネル指定: CH(n), Channel(n), CH=n
      const chMatch = remaining.match(/^(?:CH(?:ANNEL)?\(?=?\s*(\d+)\)?)/i);
      if (chMatch) {
        const chNum = parseInt(chMatch[1], 10);
        currentState.channel = Math.max(1, Math.min(16, chNum));
        currentState.channelExplicit = true;
        col += chMatch[0].length;
        continue;
      }

      // 音色指定: Voice(n), @n, Program(n)
      const voiceMatch = remaining.match(/^(?:(?:VOICE|PROGRAM)\(?=?\s*(\d+)\)?|@\s*(\d+))/i);
      if (voiceMatch) {
        currentState.instrument = parseInt(voiceMatch[1] || voiceMatch[2], 10);
        col += voiceMatch[0].length;
        continue;
      }

      col++;
    }
  }

  let currentChannel = currentState.channel;
  const currentInstrument = currentState.instrument;

  // score オブジェクトが存在する場合、カーソル位置より前で CH 指定が見つからなかったトラックは
  // パース結果のトラックチャンネルを採用する (音色はカーソル位置の値を優先し上書きしない)
  if (score && score.tracks && !currentState.channelExplicit) {
    const track = score.tracks.find((t) => t.id === currentTrackId);
    if (track && track.channel) currentChannel = track.channel;
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
