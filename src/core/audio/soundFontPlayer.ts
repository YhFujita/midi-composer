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

    // GM 音色番号に応じたサウンド生成
    // 0-7: Piano, 24-31: Guitar, 32-39: Bass, 40-47: Strings, 56-63: Brass, 73-79: Flute/Pipe, 80-87: Synth Lead
    let oscType: OscillatorType = 'triangle';
    let filterFreq = 4000;
    let attack = 0.01;
    let decay = 0.3;
    let sustain = 0.4;
    let release = 0.2;

    if (instrument >= 0 && instrument <= 7) {
      // Piano 系
      oscType = 'triangle';
      filterFreq = 3000;
      attack = 0.005;
      decay = 0.8;
      sustain = 0.15;
      release = 0.3;
    } else if (instrument >= 24 && instrument <= 31) {
      // Guitar 系
      oscType = 'sawtooth';
      filterFreq = 2500;
      attack = 0.01;
      decay = 0.5;
      sustain = 0.2;
      release = 0.2;
    } else if (instrument >= 32 && instrument <= 39) {
      // Bass 系
      oscType = 'sawtooth';
      filterFreq = 800;
      attack = 0.01;
      decay = 0.4;
      sustain = 0.6;
      release = 0.15;
    } else if (instrument >= 40 && instrument <= 47) {
      // Strings 系
      oscType = 'sawtooth';
      filterFreq = 2000;
      attack = 0.1;
      decay = 0.4;
      sustain = 0.8;
      release = 0.5;
    } else if (instrument >= 56 && instrument <= 63) {
      // Brass 系
      oscType = 'sawtooth';
      filterFreq = 3500;
      attack = 0.04;
      decay = 0.2;
      sustain = 0.7;
      release = 0.2;
    } else if (instrument >= 73 && instrument <= 79) {
      // Flute 系
      oscType = 'sine';
      filterFreq = 5000;
      attack = 0.05;
      decay = 0.1;
      sustain = 0.85;
      release = 0.15;
    } else {
      // Synth / その他
      oscType = 'square';
      filterFreq = 2500;
      attack = 0.01;
      decay = 0.2;
      sustain = 0.5;
      release = 0.2;
    }

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, startAudioTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startAudioTime);

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
        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(note.startTime + note.duration);
        const noteDurSec = Math.max(0.05, noteEndSec - noteStartSec);

        // 指定位置より先のノートのみスケジュール
        if (noteEndSec > startOffsetSec) {
          const audioStartTime = now + (noteStartSec - startOffsetSec);
          if (audioStartTime >= now) {
            const node = this.scheduleNote(ctx, note, track.instrument, audioStartTime, noteDurSec, masterGain);
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
        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(note.startTime + note.duration);
        const noteDurSec = Math.max(0.05, noteEndSec - noteStartSec);

        this.scheduleNote(offlineCtx, note, track.instrument, noteStartSec, noteDurSec, masterGain);
      });
    });

    return await offlineCtx.startRendering();
  }
}

export const audioEngine = new AudioEngine();
