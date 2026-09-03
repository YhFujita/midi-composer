/**
 * SMF (Standard MIDI File) Format 0 / Format 1 バイナリパーサー
 * Pure TypeScript 実装 (外部依存なし)
 */

export interface ParsedMidiNote {
  midiNote: number;
  startTick: number;
  endTick: number;
  durationTicks: number;
  velocity: number;
  channel: number;
}

export interface ParsedMidiTrack {
  id: number;
  name: string;
  channel: number; // 1 - 16
  instrument: number; // GM 音色番号 (0-127)
  notes: ParsedMidiNote[];
  pedalEvents: { timeTick: number; type: 'on' | 'off' }[];
}

export interface ParsedMidiData {
  ppq: number; // Ticks Per Quarter Note
  format: number;
  tempos: { tick: number; bpm: number }[];
  timeSignatures: { tick: number; numerator: number; denominator: number }[];
  tracks: ParsedMidiTrack[];
}

/**
 * 可変長数値 (VLQ: Variable Length Quantity) をリーダーから読み取る
 */
function readVLQ(bytes: Uint8Array, offset: { val: number }): number {
  let value = 0;
  while (offset.val < bytes.length) {
    const b = bytes[offset.val++];
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      break;
    }
  }
  return value;
}

/**
 * 指定バイト数を文字列（ASCII / UTF-8）として読み取る
 */
function readString(bytes: Uint8Array, offset: { val: number }, length: number): string {
  const slice = bytes.subarray(offset.val, offset.val + length);
  offset.val += length;
  try {
    return new TextDecoder('utf-8').decode(slice);
  } catch {
    let res = '';
    for (let i = 0; i < slice.length; i++) {
      res += String.fromCharCode(slice[i]);
    }
    return res;
  }
}

/**
 * 16bit ビッグエンディアン符号なし整数を読み取る
 */
function readUint16(bytes: Uint8Array, offset: { val: number }): number {
  const val = (bytes[offset.val] << 8) | bytes[offset.val + 1];
  offset.val += 2;
  return val;
}

/**
 * 32bit ビッグエンディアン符号なし整数を読み取る
 */
function readUint32(bytes: Uint8Array, offset: { val: number }): number {
  const val =
    (bytes[offset.val] << 24) |
    (bytes[offset.val + 1] << 16) |
    (bytes[offset.val + 2] << 8) |
    bytes[offset.val + 3];
  offset.val += 4;
  return val >>> 0; // 符号なし変換
}

interface RawTrackEvent {
  tick: number;
  type: 'noteOn' | 'noteOff' | 'programChange' | 'controlChange' | 'tempo' | 'timeSignature' | 'trackName';
  channel: number; // 0-15
  param1?: number;
  param2?: number;
  text?: string;
  data?: any;
}

/**
 * MIDI ファイルのバイナリ (ArrayBuffer または Uint8Array) を解析する
 */
export function parseMidiFile(input: ArrayBuffer | Uint8Array): ParsedMidiData {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const offset = { val: 0 };

  // 1. MThd ヘッダー検証
  if (bytes.length < 14) {
    throw new Error('MIDIファイルのサイズが小さすぎます。');
  }

  const headerTag = readString(bytes, offset, 4);
  if (headerTag !== 'MThd') {
    throw new Error(`無効なMIDIヘッダーです: "${headerTag}" (期待値: "MThd")`);
  }

  const headerLength = readUint32(bytes, offset);
  if (headerLength < 6) {
    throw new Error(`不正なヘッダー長です: ${headerLength}`);
  }

  const format = readUint16(bytes, offset);
  const numTracks = readUint16(bytes, offset);
  const division = readUint16(bytes, offset);

  // division: 最上位ビットが0の場合は PPQ (Ticks Per Quarter Note)
  let ppq = 480;
  if ((division & 0x8000) === 0) {
    ppq = division;
  } else {
    // SMPTE形式の場合は標準的な480でフォールバック
    ppq = 480;
  }

  // 残りのヘッダーバイトをスキップ
  if (headerLength > 6) {
    offset.val += headerLength - 6;
  }

  const allTempos: { tick: number; bpm: number }[] = [];
  const allTimeSignatures: { tick: number; numerator: number; denominator: number }[] = [];
  const rawTracksEvents: RawTrackEvent[][] = [];

  // 2. 各 MTrk チャンクを読み取り
  while (offset.val < bytes.length && rawTracksEvents.length < numTracks) {
    if (offset.val + 8 > bytes.length) break;

    const chunkTag = readString(bytes, offset, 4);
    const chunkLength = readUint32(bytes, offset);

    if (chunkTag !== 'MTrk') {
      // 未知のチャンクはスキップ
      offset.val += chunkLength;
      continue;
    }

    const chunkEnd = offset.val + chunkLength;
    const trackEvents: RawTrackEvent[] = [];
    let currentTick = 0;
    let runningStatus: number | null = null;

    while (offset.val < chunkEnd && offset.val < bytes.length) {
      const delta = readVLQ(bytes, offset);
      currentTick += delta;

      if (offset.val >= chunkEnd) break;

      let statusByte = bytes[offset.val];

      if (statusByte < 0x80) {
        // ランニングステータス適用
        if (runningStatus === null) {
          throw new Error(`不正なMIDIデータ: ランニングステータスが存在しない位置でデータバイト (0x${statusByte.toString(16)}) が出現しました`);
        }
        statusByte = runningStatus;
      } else {
        // 新しいステータスバイト
        offset.val++;
        if (statusByte < 0xf0) {
          runningStatus = statusByte;
        } else {
          runningStatus = null; // メタ/SysExではランニングステータスはクリア
        }
      }

      // メタイベント (0xFF)
      if (statusByte === 0xff) {
        const metaType = bytes[offset.val++];
        const metaLength = readVLQ(bytes, offset);
        const metaDataStart = offset.val;

        if (metaType === 0x03) {
          // トラック名
          const trackName = readString(bytes, { val: metaDataStart }, metaLength);
          trackEvents.push({
            tick: currentTick,
            type: 'trackName',
            channel: 0,
            text: trackName,
          });
        } else if (metaType === 0x51 && metaLength === 3) {
          // テンポ設定 (Set Tempo)
          const m0 = bytes[metaDataStart];
          const m1 = bytes[metaDataStart + 1];
          const m2 = bytes[metaDataStart + 2];
          const microsec = (m0 << 16) | (m1 << 8) | m2;
          const bpm = Math.round((60000000 / (microsec || 500000)) * 10) / 10;
          const existing = allTempos.find((t) => t.tick === currentTick);
          if (existing) {
            existing.bpm = bpm;
          } else {
            allTempos.push({ tick: currentTick, bpm });
          }
          trackEvents.push({
            tick: currentTick,
            type: 'tempo',
            channel: 0,
            param1: bpm,
          });
        } else if (metaType === 0x58 && metaLength >= 2) {
          // 拍子設定 (Time Signature)
          const numerator = bytes[metaDataStart];
          const denominatorPower = bytes[metaDataStart + 1];
          const denominator = Math.pow(2, denominatorPower);
          const existingSig = allTimeSignatures.find((t) => t.tick === currentTick);
          if (existingSig) {
            existingSig.numerator = numerator;
            existingSig.denominator = denominator;
          } else {
            allTimeSignatures.push({ tick: currentTick, numerator, denominator });
          }
          trackEvents.push({
            tick: currentTick,
            type: 'timeSignature',
            channel: 0,
            param1: numerator,
            param2: denominator,
          });
        } else if (metaType === 0x2f) {
          // End of Track
          offset.val = metaDataStart + metaLength;
          break;
        }

        offset.val = metaDataStart + metaLength;
        continue;
      }

      // SysEx イベント (0xF0, 0xF7)
      if (statusByte === 0xf0 || statusByte === 0xf7) {
        const sysExLength = readVLQ(bytes, offset);
        offset.val += sysExLength;
        continue;
      }

      // チャンネルメッセージ
      const messageType = statusByte & 0xf0;
      const channel = statusByte & 0x0f;

      switch (messageType) {
        case 0x80: {
          // Note Off
          const note = bytes[offset.val++];
          const vel = bytes[offset.val++];
          trackEvents.push({
            tick: currentTick,
            type: 'noteOff',
            channel,
            param1: note,
            param2: vel,
          });
          break;
        }
        case 0x90: {
          // Note On (ベロシティ0はNote Off扱い)
          const note = bytes[offset.val++];
          const vel = bytes[offset.val++];
          if (vel === 0) {
            trackEvents.push({
              tick: currentTick,
              type: 'noteOff',
              channel,
              param1: note,
              param2: 0,
            });
          } else {
            trackEvents.push({
              tick: currentTick,
              type: 'noteOn',
              channel,
              param1: note,
              param2: vel,
            });
          }
          break;
        }
        case 0xa0: {
          // Polyphonic Aftertouch
          offset.val += 2;
          break;
        }
        case 0xb0: {
          // Control Change
          const controller = bytes[offset.val++];
          const value = bytes[offset.val++];
          trackEvents.push({
            tick: currentTick,
            type: 'controlChange',
            channel,
            param1: controller,
            param2: value,
          });
          break;
        }
        case 0xc0: {
          // Program Change (音色)
          const program = bytes[offset.val++];
          trackEvents.push({
            tick: currentTick,
            type: 'programChange',
            channel,
            param1: program,
          });
          break;
        }
        case 0xd0: {
          // Channel Aftertouch
          offset.val += 1;
          break;
        }
        case 0xe0: {
          // Pitch Bend
          offset.val += 2;
          break;
        }
        default: {
          // 不明なステータス
          break;
        }
      }
    }

    offset.val = chunkEnd;
    rawTracksEvents.push(trackEvents);
  }

  // 3. トラック情報の組み立て (NoteOn と NoteOff のペアリング & Format 0 のチャンネル分割)
  const resultTracks: ParsedMidiTrack[] = [];

  function buildTrackFromEvents(
    trackId: number,
    trackName: string,
    channel: number,
    events: RawTrackEvent[]
  ): ParsedMidiTrack | null {
    const activeNotes = new Map<number, { startTick: number; velocity: number }[]>();
    const finishedNotes: ParsedMidiNote[] = [];
    const pedalEvents: { timeTick: number; type: 'on' | 'off' }[] = [];
    let instrument = 0; // デフォルト Piano (0)

    for (const ev of events) {
      if (ev.type === 'programChange') {
        instrument = ev.param1 ?? 0;
      } else if (ev.type === 'controlChange' && ev.param1 === 64) {
        // CC#64: Sustain Pedal
        const isPedalOn = (ev.param2 ?? 0) >= 64;
        pedalEvents.push({
          timeTick: ev.tick,
          type: isPedalOn ? 'on' : 'off',
        });
      } else if (ev.type === 'noteOn') {
        const note = ev.param1!;
        const vel = ev.param2!;
        const list = activeNotes.get(note) || [];
        list.push({ startTick: ev.tick, velocity: vel });
        activeNotes.set(note, list);
      } else if (ev.type === 'noteOff') {
        const note = ev.param1!;
        const list = activeNotes.get(note);
        if (list && list.length > 0) {
          const active = list.shift()!;
          const dur = Math.max(1, ev.tick - active.startTick);
          finishedNotes.push({
            midiNote: note,
            startTick: active.startTick,
            endTick: ev.tick,
            durationTicks: dur,
            velocity: active.velocity,
            channel: channel + 1,
          });
        }
      }
    }

    // 未クローズのノートがあれば強制クローズ
    activeNotes.forEach((list, note) => {
      for (const active of list) {
        finishedNotes.push({
          midiNote: note,
          startTick: active.startTick,
          endTick: active.startTick + ppq,
          durationTicks: ppq,
          velocity: active.velocity,
          channel: channel + 1,
        });
      }
    });

    if (finishedNotes.length === 0 && pedalEvents.length === 0) {
      return null;
    }

    finishedNotes.sort((a, b) => a.startTick - b.startTick || a.midiNote - b.midiNote);

    return {
      id: trackId,
      name: trackName || `Track ${trackId + 1}`,
      channel: channel + 1,
      instrument,
      notes: finishedNotes,
      pedalEvents,
    };
  }

  if (format === 0 && rawTracksEvents.length === 1) {
    const singleTrackEvents = rawTracksEvents[0];
    const eventsByChannel = new Map<number, RawTrackEvent[]>();

    for (const ev of singleTrackEvents) {
      const ch = ev.channel;
      if (!eventsByChannel.has(ch)) {
        eventsByChannel.set(ch, []);
      }
      eventsByChannel.get(ch)!.push(ev);
    }

    let trackIdx = 0;
    eventsByChannel.forEach((events, ch) => {
      const nameEv = events.find((e) => e.type === 'trackName');
      const track = buildTrackFromEvents(
        trackIdx,
        nameEv?.text || `Track ${trackIdx + 1} (Ch ${ch + 1})`,
        ch,
        events
      );
      if (track) {
        resultTracks.push(track);
        trackIdx++;
      }
    });
  } else {
    rawTracksEvents.forEach((events, idx) => {
      const nameEv = events.find((e) => e.type === 'trackName');
      const noteEv = events.find((e) => e.type === 'noteOn' || e.type === 'programChange');
      const ch = noteEv ? noteEv.channel : 0;

      const track = buildTrackFromEvents(
        idx,
        nameEv?.text || `Track ${idx + 1}`,
        ch,
        events
      );
      if (track) {
        resultTracks.push(track);
      }
    });
  }

  allTempos.sort((a, b) => a.tick - b.tick);
  allTimeSignatures.sort((a, b) => a.tick - b.tick);

  return {
    ppq,
    format,
    tempos: allTempos.length > 0 ? allTempos : [{ tick: 0, bpm: 120 }],
    timeSignatures: allTimeSignatures.length > 0 ? allTimeSignatures : [{ tick: 0, numerator: 4, denominator: 4 }],
    tracks: resultTracks,
  };
}
