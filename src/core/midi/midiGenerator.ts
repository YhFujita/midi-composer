import { ParsedScore, Track, NoteEvent, TempoEvent } from '../../types/mml';

/**
 * 可変長数値 (Variable Length Quantity: VLQ) をバイト配列にエンコード
 */
function encodeVLQ(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];

  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  return bytes;
}

/**
 * 16bit 数値をビッグエンディアンバイト配列に変換
 */
function uint16Bytes(val: number): number[] {
  return [(val >> 8) & 0xff, val & 0xff];
}

/**
 * 32bit 数値をビッグエンディアンバイト配列に変換
 */
function uint32Bytes(val: number): number[] {
  return [
    (val >> 24) & 0xff,
    (val >> 16) & 0xff,
    (val >> 8) & 0xff,
    val & 0xff,
  ];
}

/**
 * 文字列をバイト配列に変換
 */
function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return bytes;
}

interface RawMidiEvent {
  tick: number; // 絶対ティック
  bytes: number[];
}

/**
 * ParsedScore を Standard MIDI File (.mid / Format 1) のバイナリ (Uint8Array) に変換する
 */
export function generateMidiBlob(score: ParsedScore): Blob {
  const PPQ = 480; // 4分音符あたりのTick数 (Ticks Per Quarter Note)
  const trackChunks: Uint8Array[] = [];

  // トラック0: テンポ & 拍子情報用コンダクタートラック
  const conductorEvents: RawMidiEvent[] = [];

  // 拍子設定 (Time Signature)
  conductorEvents.push({
    tick: 0,
    bytes: [
      0xff, 0x58, 0x04,
      score.timeSignature.numerator,
      Math.round(Math.log2(score.timeSignature.denominator)),
      24, // 1メトロノームクリックあたりのMIDIクロック数
      8,  // 32分音符の数
    ],
  });

  // テンポ設定 (Set Tempo)
  score.tempoEvents.forEach((t) => {
    const tick = Math.round(t.time * PPQ);
    const microsecondsPerBeat = Math.round(60000000 / t.bpm);
    conductorEvents.push({
      tick,
      bytes: [
        0xff, 0x51, 0x03,
        (microsecondsPerBeat >> 16) & 0xff,
        (microsecondsPerBeat >> 8) & 0xff,
        microsecondsPerBeat & 0xff,
      ],
    });
  });

  // トラック名の追加
  conductorEvents.push({
    tick: 0,
    bytes: [0xff, 0x03, 13, ...stringToBytes('MIDI Composer')],
  });

  trackChunks.push(buildTrackChunk(conductorEvents, PPQ));

  // 各パートトラックの生成
  score.tracks.forEach((track, index) => {
    const trackEvents: RawMidiEvent[] = [];
    const channel = (track.channel - 1) & 0x0f; // 0-15

    // トラック名
    const trackNameBytes = stringToBytes(track.name || `Track ${index + 1}`);
    trackEvents.push({
      tick: 0,
      bytes: [0xff, 0x03, trackNameBytes.length, ...trackNameBytes],
    });

    // プログラムチェンジ (音色選択)
    trackEvents.push({
      tick: 0,
      bytes: [0xc0 | channel, track.instrument & 0x7f],
    });

    // ノートオン / ノートオフ イベント
    track.notes.forEach((note, noteIdx) => {
      // タイで前の音から引き継がれている音符は単独で Note On を発音しない
      if (note.hasTieFromPrev) return;

      let effectiveDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
      let effectiveEndBeat = note.startTime + effectiveDur;

      // タイで次の音に繋がっている場合、タイが終了する最後の音の末尾まで長さを延長
      if (note.hasTieToNext) {
        let currentNote = note;
        for (let nextIdx = noteIdx + 1; nextIdx < track.notes.length; nextIdx++) {
          const nextNote = track.notes[nextIdx];
          if (nextNote.hasTieFromPrev && nextNote.midiNote === currentNote.midiNote) {
            const nextDur = nextNote.gateDuration !== undefined ? nextNote.gateDuration : nextNote.duration;
            effectiveEndBeat = nextNote.startTime + nextDur;
            if (!nextNote.hasTieToNext) break;
            currentNote = nextNote;
          }
        }
      }

      // バラシ (ストローク) の微小ディレイ計算 (1音あたり約 20 ticks)
      const strumOffsetTicks = (note.isStrum && note.strumOrder)
        ? Math.round(note.strumOrder * 20)
        : 0;
      const startTick = Math.round(note.startTime * PPQ) + strumOffsetTicks;
      const endTick = Math.max(startTick + 1, Math.round(effectiveEndBeat * PPQ));
      const midiNote = Math.max(0, Math.min(127, note.midiNote));
      const velocity = Math.max(1, Math.min(127, note.velocity));

      // Note On
      trackEvents.push({
        tick: startTick,
        bytes: [0x90 | channel, midiNote, velocity],
      });

      // Note Off
      trackEvents.push({
        tick: endTick,
        bytes: [0x80 | channel, midiNote, 0],
      });
    });

    // ペダル (CC#64: Hold 1 / Sustain) イベント
    if (track.pedalEvents && track.pedalEvents.length > 0) {
      track.pedalEvents.forEach((p) => {
        const tick = Math.round(p.time * PPQ);
        const val = p.type === 'on' ? 127 : 0;
        trackEvents.push({
          tick,
          bytes: [0xb0 | channel, 0x40, val], // CC#64 (Sustain Pedal)
        });
      });
    }

    trackChunks.push(buildTrackChunk(trackEvents, PPQ));
  });

  // MIDI ヘッダーチャンク (MThd)
  // Format 1 (マルチトラック同期), トラック数, PPQ (480)
  const numTracks = trackChunks.length;
  const headerBytes = [
    ...stringToBytes('MThd'),
    ...uint32Bytes(6),       // チャンク長 = 6
    ...uint16Bytes(1),       // Format 1
    ...uint16Bytes(numTracks),
    ...uint16Bytes(PPQ),
  ];

  // 全チャンクの結合
  let totalLength = headerBytes.length;
  trackChunks.forEach((chunk) => {
    totalLength += chunk.length;
  });

  const finalMidiBuffer = new Uint8Array(totalLength);
  finalMidiBuffer.set(new Uint8Array(headerBytes), 0);

  let offset = headerBytes.length;
  trackChunks.forEach((chunk) => {
    finalMidiBuffer.set(chunk, offset);
    offset += chunk.length;
  });

  return new Blob([finalMidiBuffer], { type: 'audio/midi' });
}

/**
 * イベント配列をデルタタイム形式の MTrk チャンクにビルド
 */
function buildTrackChunk(events: RawMidiEvent[], ppq: number): Uint8Array {
  // Tick順にソート (同じTickの場合は Meta/ProgChange -> NoteOff -> ControlChange -> NoteOn の順)
  function getEventPriority(bytes: number[]): number {
    if (bytes[0] === 0xff) return 0; // Meta event
    const status = bytes[0] & 0xf0;
    if (status === 0xc0) return 1;  // Program Change
    if (status === 0x80) return 2;  // Note Off
    if (status === 0xb0) return 3;  // Control Change (Pedal ON/OFF等)
    if (status === 0x90) return 4;  // Note On
    return 5;
  }

  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return getEventPriority(a.bytes) - getEventPriority(b.bytes);
  });

  const trackDataBytes: number[] = [];
  let lastTick = 0;

  events.forEach((ev) => {
    const deltaTick = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;

    const deltaBytes = encodeVLQ(deltaTick);
    trackDataBytes.push(...deltaBytes);
    trackDataBytes.push(...ev.bytes);
  });

  // End of Track メタイベント (FF 2F 00)
  trackDataBytes.push(...encodeVLQ(0));
  trackDataBytes.push(0xff, 0x2f, 0x00);

  const chunkHeader = [
    ...stringToBytes('MTrk'),
    ...uint32Bytes(trackDataBytes.length),
  ];

  const fullTrack = new Uint8Array(chunkHeader.length + trackDataBytes.length);
  fullTrack.set(new Uint8Array(chunkHeader), 0);
  fullTrack.set(new Uint8Array(trackDataBytes), chunkHeader.length);

  return fullTrack;
}
