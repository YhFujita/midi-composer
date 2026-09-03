import { ParsedScore, NoteEvent, TempoEvent } from '../../types/mml';
import { midiToFreq } from '../../utils/noteConverter';

export interface PlayerCallback {
  onProgress?: (currentTimeSec: number, currentBeat: number, totalDurationSec: number) => void;
  onEnded?: () => void;
}

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private isPaused = false;
  private startTimeSec = 0;
  private pausedAtSec = 0;
  private currentScore: ParsedScore | null = null;
  private activeNodes: { stop: (time: number) => void }[] = [];
  private animationFrameId: number | null = null;
  private callbacks: PlayerCallback = {};
  private tempoMap: { time: number; bpm: number; secStart: number }[] = [];
  private totalDurationSec = 0;

  constructor() {
    // AudioContext はユーザー操作時に初期化
  }

  private initAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setCallbacks(callbacks: PlayerCallback) {
    this.callbacks = callbacks;
  }

  /**
   * 拍数から秒数への変換マップを構築
   */
  private buildTempoMap(score: ParsedScore) {
    this.tempoMap = [];
    const tempos = [...score.tempoEvents].sort((a, b) => a.time - b.time);
    if (tempos.length === 0 || tempos[0].time !== 0) {
      tempos.unshift({ time: 0, bpm: 120 });
    }

    let currentSec = 0;
    let lastBeat = 0;
    let currentBpm = tempos[0].bpm;

    for (let i = 0; i < tempos.length; i++) {
      const t = tempos[i];
      const deltaBeat = t.time - lastBeat;
      currentSec += (deltaBeat * 60) / currentBpm;
      currentBpm = t.bpm;
      lastBeat = t.time;

      this.tempoMap.push({
        time: t.time,
        bpm: t.bpm,
        secStart: currentSec,
      });
    }

    // 総秒数の計算
    const totalBeats = score.totalDuration;
    const lastTempo = this.tempoMap[this.tempoMap.length - 1];
    const remainingBeats = Math.max(0, totalBeats - lastTempo.time);
    this.totalDurationSec = lastTempo.secStart + (remainingBeats * 60) / lastTempo.bpm;
  }

  /**
   * 拍数 (beat) を 秒数 (sec) に変換
   */
  public beatToSec(beat: number): number {
    if (this.tempoMap.length === 0) return (beat * 60) / 120;

    let targetIdx = 0;
    for (let i = 0; i < this.tempoMap.length; i++) {
      if (beat >= this.tempoMap[i].time) {
        targetIdx = i;
      } else {
        break;
      }
    }

    const t = this.tempoMap[targetIdx];
    const deltaBeat = beat - t.time;
    return t.secStart + (deltaBeat * 60) / t.bpm;
  }

  /**
   * 指定した楽譜における拍数 (beat) を秒数 (sec) に変換
   */
  public calculateBeatToSec(score: ParsedScore, beat: number): number {
    this.buildTempoMap(score);
    return this.beatToSec(beat);
  }

  /**
   * 秒数 (sec) を 拍数 (beat) に変換
   */
  public secToBeat(sec: number): number {
    if (this.tempoMap.length === 0) return (sec * 120) / 60;

    let targetIdx = 0;
    for (let i = 0; i < this.tempoMap.length; i++) {
      if (sec >= this.tempoMap[i].secStart) {
        targetIdx = i;
      } else {
        break;
      }
    }

    const t = this.tempoMap[targetIdx];
    const deltaSec = sec - t.secStart;
    return t.time + (deltaSec * t.bpm) / 60;
  }

  /**
   * ノートを合成して AudioNode をスケジュール再生
   */
  private scheduleNote(
    ctx: BaseAudioContext,
    note: NoteEvent,
    instrument: number,
    startAudioTime: number,
    durationSec: number,
    masterGain: GainNode
  ): { stop: (time: number) => void } {
    const freq = midiToFreq(note.midiNote);
    const vel = (note.velocity || 100) / 127;

    // GM 音色番号に応じたサウンド生成 (全16ファミリー対応)
    let oscType: OscillatorType = 'triangle';
    let filterFreq = 3500;
    let attack = 0.01;
    let decay = 0.3;
    let sustain = 0.4;
    let release = 0.2;
    let isBrass = false;

    if (instrument >= 0 && instrument <= 7) {
      // 0-7: Piano
      if (instrument >= 4 && instrument <= 5) {
        // Electric Piano (まろやかな Rhodes / DX7 系)
        oscType = 'sine';
        filterFreq = 2400;
        attack = 0.005;
        decay = 1.0;
        sustain = 0.3;
        release = 0.35;
      } else if (instrument >= 6 && instrument <= 7) {
        // Harpsichord / Clavinet (明るいチェンバロ)
        oscType = 'sawtooth';
        filterFreq = 4800;
        attack = 0.002;
        decay = 0.6;
        sustain = 0.15;
        release = 0.2;
      } else {
        // Acoustic Grand Piano
        oscType = 'triangle';
        filterFreq = 3600;
        attack = 0.003;
        decay = 0.9;
        sustain = 0.1;
        release = 0.3;
      }
    } else if (instrument >= 8 && instrument <= 15) {
      // 8-15: Chromatic Percussion (オルゴール, 鉄琴, マリンバ, ベル)
      oscType = 'sine';
      filterFreq = 6500;
      attack = 0.001;
      decay = 0.7;
      sustain = 0.02;
      release = 0.35;
    } else if (instrument >= 16 && instrument <= 23) {
      // 16-23: Organ (パイプオルガン, ハモンド, アコーディオン, ハーモニカ)
      oscType = instrument === 19 ? 'sawtooth' : 'sine';
      filterFreq = 3000;
      attack = 0.02;
      decay = 0.1;
      sustain = 0.9;
      release = 0.08;
    } else if (instrument >= 24 && instrument <= 31) {
      // 24-31: Guitar
      if (instrument >= 29 && instrument <= 30) {
        // Overdrive / Distortion
        oscType = 'sawtooth';
        filterFreq = 2200;
        attack = 0.005;
        decay = 0.3;
        sustain = 0.7;
        release = 0.25;
      } else if (instrument === 31) {
        // Harmonics
        oscType = 'sine';
        filterFreq = 6000;
        attack = 0.002;
        decay = 0.8;
        sustain = 0.05;
        release = 0.3;
      } else {
        // Acoustic / Clean Guitar
        oscType = instrument >= 26 ? 'sawtooth' : 'triangle';
        filterFreq = 2800;
        attack = 0.008;
        decay = 0.6;
        sustain = 0.15;
        release = 0.25;
      }
    } else if (instrument >= 32 && instrument <= 39) {
      // 32-39: Bass (ウッドベース, エレキベース, シンセベース)
      oscType = instrument >= 38 ? 'square' : 'sawtooth';
      filterFreq = 900; // 重低音ローパス
      attack = 0.01;
      decay = 0.45;
      sustain = 0.55;
      release = 0.15;
    } else if (instrument >= 40 && instrument <= 47) {
      // 40-47: Solo Strings (バイオリン, チェロ, ハープ, ピチカート)
      if (instrument === 45 || instrument === 46) {
        // Pizzicato / Harp
        oscType = 'triangle';
        filterFreq = 3200;
        attack = 0.002;
        decay = 0.6;
        sustain = 0.05;
        release = 0.2;
      } else if (instrument === 47) {
        // Timpani
        oscType = 'sine';
        filterFreq = 450;
        attack = 0.005;
        decay = 0.6;
        sustain = 0.05;
        release = 0.3;
      } else {
        // Violin / Cello
        oscType = 'sawtooth';
        filterFreq = 2400;
        attack = 0.08;
        decay = 0.3;
        sustain = 0.85;
        release = 0.4;
      }
    } else if (instrument >= 48 && instrument <= 55) {
      // 48-55: Ensemble & Choir (ストリングス合奏, クワイア, オーケストラヒット)
      if (instrument >= 52 && instrument <= 54) {
        // Choir / Voice (合唱)
        oscType = 'sine';
        filterFreq = 1600;
        attack = 0.15;
        decay = 0.25;
        sustain = 0.8;
        release = 0.45;
      } else if (instrument === 55) {
        // Orchestra Hit
        oscType = 'sawtooth';
        filterFreq = 4500;
        attack = 0.001;
        decay = 0.35;
        sustain = 0.2;
        release = 0.25;
      } else {
        // String Ensemble 1 & 2, Synth Strings
        oscType = 'sawtooth';
        filterFreq = 2800;
        attack = 0.12;
        decay = 0.25;
        sustain = 0.88;
        release = 0.5;
      }
    } else if (instrument >= 56 && instrument <= 63) {
      // 56-63: Brass (トランペット, トロンボーン, ホルン, ブラスセクション)
      oscType = 'sawtooth';
      filterFreq = 3400;
      attack = 0.04;
      decay = 0.2;
      sustain = 0.78;
      release = 0.2;
      isBrass = true;
    } else if (instrument >= 64 && instrument <= 71) {
      // 64-71: Reed (サックス, オーボエ, ファゴット, クラリネット)
      oscType = instrument >= 68 ? 'square' : 'sawtooth';
      filterFreq = 2600;
      attack = 0.03;
      decay = 0.2;
      sustain = 0.82;
      release = 0.18;
    } else if (instrument >= 72 && instrument <= 79) {
      // 72-79: Pipe (フルート, ピッコロ, リコーダー, 尺八, オカリナ)
      oscType = 'sine';
      filterFreq = 5200;
      attack = 0.05;
      decay = 0.1;
      sustain = 0.88;
      release = 0.15;
    } else if (instrument >= 80 && instrument <= 87) {
      // 80-87: Synth Lead (矩形波リード, ノコギリ波リード 等)
      oscType = instrument === 80 ? 'square' : 'sawtooth';
      filterFreq = 4000;
      attack = 0.006;
      decay = 0.15;
      sustain = 0.75;
      release = 0.18;
    } else if (instrument >= 88 && instrument <= 95) {
      // 88-95: Synth Pad (幻想的なパッド音)
      oscType = 'sawtooth';
      filterFreq = 2000;
      attack = 0.25;
      decay = 0.35;
      sustain = 0.9;
      release = 0.7;
    } else if (instrument >= 104 && instrument <= 111) {
      // 104-111: Ethnic (シタール, 三味線, 琴, カリンバ)
      if (instrument === 108) {
        // Kalimba
        oscType = 'sine';
        filterFreq = 3600;
        attack = 0.002;
        decay = 0.6;
        sustain = 0.05;
        release = 0.25;
      } else {
        // Shamisen / Koto / Sitar
        oscType = 'sawtooth';
        filterFreq = 4200;
        attack = 0.002;
        decay = 0.5;
        sustain = 0.08;
        release = 0.25;
      }
    } else if (instrument >= 112 && instrument <= 119) {
      // 112-119: Percussive (スチールドラム, 和太鼓 等)
      if (instrument === 114) {
        // Steel Drum
        oscType = 'sine';
        filterFreq = 4000;
        attack = 0.002;
        decay = 0.75;
        sustain = 0.12;
        release = 0.25;
      } else if (instrument === 116) {
        // Taiko
        oscType = 'triangle';
        filterFreq = 650;
        attack = 0.002;
        decay = 0.4;
        sustain = 0.05;
        release = 0.2;
      } else {
        oscType = 'triangle';
        filterFreq = 2400;
        attack = 0.002;
        decay = 0.4;
        sustain = 0.05;
        release = 0.2;
      }
    } else {
      // 96-103: Synth FX / 120-127: SFX / その他
      oscType = 'square';
      filterFreq = 2800;
      attack = 0.01;
      decay = 0.25;
      sustain = 0.5;
      release = 0.2;
    }

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, startAudioTime);

    filter.type = 'lowpass';
    if (isBrass) {
      // ブラス特有のフィルター開閉エンベロープ
      filter.frequency.setValueAtTime(filterFreq * 0.4, startAudioTime);
      filter.frequency.linearRampToValueAtTime(filterFreq * 1.5, startAudioTime + attack);
      filter.frequency.exponentialRampToValueAtTime(filterFreq, startAudioTime + attack + decay);
    } else {
      filter.frequency.setValueAtTime(filterFreq, startAudioTime);
    }

    // ADSR エンベロープ
    const peakGain = vel * 0.4;
    const sustainGain = peakGain * sustain;
    const stopTime = startAudioTime + durationSec + release;

    noteGain.gain.setValueAtTime(0, startAudioTime);
    noteGain.gain.linearRampToValueAtTime(peakGain, startAudioTime + attack);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustainGain), startAudioTime + attack + decay);
    noteGain.gain.setValueAtTime(sustainGain, startAudioTime + durationSec);
    noteGain.gain.exponentialRampToValueAtTime(0.00001, stopTime);

    osc.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(startAudioTime);
    osc.stop(stopTime);

    return {
      stop: (time: number) => {
        try {
          osc.stop(time);
          osc.disconnect();
          noteGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  /**
   * 楽譜の再生を開始
   */
  public play(score: ParsedScore, startOffsetSec = 0) {
    const ctx = this.initAudioContext();
    this.stop();

    this.currentScore = score;
    this.buildTempoMap(score);
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedAtSec = startOffsetSec;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;
    this.startTimeSec = now - startOffsetSec;

    // スケジュール設定
    this.activeNodes = [];

    score.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        const noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        let effectiveEndBeat = note.startTime + noteDur;
        if (note.pedalReleaseTime !== undefined && note.pedalReleaseTime > effectiveEndBeat) {
          effectiveEndBeat = note.pedalReleaseTime;
        }
        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(effectiveEndBeat);
        const noteDurSec = Math.max(0.02, noteEndSec - noteStartSec);

        // 指定位置より先のノートのみスケジュール
        if (noteEndSec > startOffsetSec) {
          const strumOffsetSec = (note.isStrum && note.strumOrder)
            ? note.strumOrder * (note.strumDelaySec || 0.035)
            : 0;
          const audioStartTime = now + (noteStartSec - startOffsetSec) + strumOffsetSec;
          const effectiveDurSec = Math.max(0.02, noteDurSec - strumOffsetSec);

          if (audioStartTime >= now) {
            const inst = note.instrument !== undefined ? note.instrument : track.instrument;
            const node = this.scheduleNote(ctx, note, inst, audioStartTime, effectiveDurSec, masterGain);
            this.activeNodes.push(node);
          }
        }
      });
    });

    this.startProgressLoop();
  }

  /**
   * 一時停止
   */
  public pause() {
    if (!this.isPlaying || this.isPaused || !this.audioCtx) return;
    this.pausedAtSec = this.getCurrentTimeSec();
    this.clearNodes();
    this.isPlaying = false;
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 再開
   */
  public resume() {
    if (this.isPaused && this.currentScore) {
      this.play(this.currentScore, this.pausedAtSec);
    }
  }

  /**
   * 停止
   */
  public stop() {
    this.clearNodes();
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAtSec = 0;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(0, 0, this.totalDurationSec);
    }
  }

  /**
   * 指定位置へのシーク
   */
  public seek(sec: number) {
    const clampedSec = Math.max(0, Math.min(this.totalDurationSec, sec));
    if (this.isPlaying && this.currentScore) {
      this.play(this.currentScore, clampedSec);
    } else {
      this.pausedAtSec = clampedSec;
      if (this.callbacks.onProgress) {
        this.callbacks.onProgress(clampedSec, this.secToBeat(clampedSec), this.totalDurationSec);
      }
    }
  }

  public getCurrentTimeSec(): number {
    if (!this.isPlaying || !this.audioCtx) {
      return this.pausedAtSec;
    }
    return Math.max(0, this.audioCtx.currentTime - this.startTimeSec);
  }

  public getTotalDurationSec(): number {
    return this.totalDurationSec;
  }

  private clearNodes() {
    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.activeNodes.forEach((node) => node.stop(now));
    }
    this.activeNodes = [];
  }

  private startProgressLoop() {
    const loop = () => {
      if (!this.isPlaying) return;

      const currentSec = this.getCurrentTimeSec();
      const currentBeat = this.secToBeat(currentSec);

      if (this.callbacks.onProgress) {
        this.callbacks.onProgress(currentSec, currentBeat, this.totalDurationSec);
      }

      if (currentSec >= this.totalDurationSec + 0.5) {
        this.stop();
        if (this.callbacks.onEnded) {
          this.callbacks.onEnded();
        }
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * OfflineAudioContext を使って無音で全音源を PCM レンダリングする（MP3書き出し用）
   */
  public async renderOffline(score: ParsedScore): Promise<AudioBuffer> {
    this.buildTempoMap(score);
    const sampleRate = 44100;
    const duration = Math.max(1.0, this.totalDurationSec + 1.0); // 余韻を含める
    const length = Math.ceil(sampleRate * duration);

    const OfflineAudioCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineAudioCtxClass(2, length, sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.7, 0);
    masterGain.connect(offlineCtx.destination);

    score.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        const noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        let effectiveEndBeat = note.startTime + noteDur;
        if (note.pedalReleaseTime !== undefined && note.pedalReleaseTime > effectiveEndBeat) {
          effectiveEndBeat = note.pedalReleaseTime;
        }
        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(effectiveEndBeat);
        const noteDurSec = Math.max(0.02, noteEndSec - noteStartSec);

        const inst = note.instrument !== undefined ? note.instrument : track.instrument;
        this.scheduleNote(offlineCtx, note, inst, noteStartSec, noteDurSec, masterGain);
      });
    });

    return await offlineCtx.startRendering();
  }

  /**
   * 楽器の音色確認用の短いプレビュー演奏 (C4, E4, G4 の分散和音)
   */
  public previewInstrument(instrument: number) {
    const ctx = this.initAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.5, now);
    masterGain.connect(ctx.destination);

    // C4 (60), E4 (64), G4 (67) を軽くアルペジオ演奏
    const notes = [
      { midi: 60, offset: 0, dur: 0.35 },
      { midi: 64, offset: 0.15, dur: 0.35 },
      { midi: 67, offset: 0.3, dur: 0.6 },
    ];

    notes.forEach((n) => {
      const dummyNote: NoteEvent = {
        pitch: 'C',
        midiNote: n.midi,
        startTime: 0,
        duration: 1,
        velocity: 100,
        trackId: 0,
        channel: 1,
      };
      this.scheduleNote(ctx, dummyNote, instrument, now + n.offset, n.dur, masterGain);
    });
  }

  /**
   * 指定したMIDIノート群のコードプレビュー演奏（通常同時発音 または バラシ演奏）
   */
  public previewChord(
    midiNotes: number[],
    instrument = 0,
    isStrum = true,
    strumDirection: 'down' | 'up' = 'down'
  ) {
    const ctx = this.initAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.45, now);
    masterGain.connect(ctx.destination);

    // 方向に応じた並び替え
    const sorted = [...midiNotes].sort((a, b) =>
      strumDirection === 'down' ? a - b : b - a
    );

    sorted.forEach((midi, idx) => {
      const dummyNote: NoteEvent = {
        pitch: '',
        midiNote: midi,
        startTime: 0,
        duration: 1,
        velocity: 95,
        trackId: 0,
        channel: 1,
      };
      // isStrum が有効な場合は約40ms間隔のストローク、無効な場合は完全同時
      const offset = isStrum ? idx * 0.04 : 0;
      const dur = 1.2 - offset;
      this.scheduleNote(ctx, dummyNote, instrument, now + offset, Math.max(0.4, dur), masterGain);
    });
  }
}

export const audioEngine = new AudioEngine();
