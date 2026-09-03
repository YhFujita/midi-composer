import { ParsedScore, NoteEvent } from '../../types/mml';
import { midiToFreq } from '../../utils/noteConverter';
import { soundFontManager } from './soundFontManager';
import { WorkletSynthesizer } from 'spessasynth_lib';

export interface PlayerCallback {
  onProgress?: (currentTimeSec: number, currentBeat: number, totalDurationSec: number) => void;
  onEnded?: () => void;
}

interface ScheduledNoteItem {
  id: string;
  startSec: number;
  endSec: number;
  channel: number; // 0 - 15
  midiNote: number;
  velocity: number;
  instrument: number;
  onTimerId?: any;
  offTimerId?: any;
  isStarted?: boolean;
  isEnded?: boolean;
}

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private synth: WorkletSynthesizer | null = null;
  private isSoundFontReady = false;
  private isSynthInitializing = false;

  private isPlaying = false;
  private isPaused = false;
  private startTimeSec = 0;
  private pausedAtSec = 0;
  private currentScore: ParsedScore | null = null;
  private animationFrameId: number | null = null;
  private schedulerIntervalId: any = null;
  private callbacks: PlayerCallback = {};
  private tempoMap: { time: number; bpm: number; secStart: number }[] = [];
  private totalDurationSec = 0;

  // 再生中ノートの管理
  private scheduledNotes: ScheduledNoteItem[] = [];
  private activeTimers: any[] = [];
  private activeOscillatorNodes: { stop: (time: number) => void }[] = [];
  private activeSingleOscillators = new Map<number, { osc: OscillatorNode; gain: GainNode; stopTimer?: any }>();

  constructor() {
    // アプリ起動時にバックグラウンドで SoundFont の準備を開始
    if (typeof window !== 'undefined') {
      this.initSoundFont();
    }
  }

  /**
   * SoundFont2 シンセサイザーの初期化
   */
  public async initSoundFont(): Promise<boolean> {
    if (this.isSoundFontReady && this.synth) return true;
    if (this.isSynthInitializing) return false;

    this.isSynthInitializing = true;
    try {
      const ctx = this.initAudioContext();

      // AudioWorklet モジュールの登録
      await ctx.audioWorklet.addModule('/spessasynth_processor.min.js');

      // シンセサイザーの生成
      const synth = new WorkletSynthesizer(ctx);
      await synth.isReady;

      // SoundFont データのロード (IndexedDB または fetch)
      const buffer = await soundFontManager.loadDefaultSoundFont();

      // SoundBank の登録
      await synth.soundBankManager.addSoundBank(buffer, 'main');

      this.synth = synth;
      this.isSoundFontReady = true;
      this.isSynthInitializing = false;
      console.log('SpessaSynth SoundFont engine ready with TimGM6mb.sf2');
      return true;
    } catch (err) {
      console.warn('SoundFont engine initialization deferred or fallback to oscillator:', err);
      this.isSynthInitializing = false;
      return false;
    }
  }

  /**
   * カスタム SoundFont バッファをシンセに適用
   */
  public async applySoundFontBuffer(buffer: ArrayBuffer): Promise<void> {
    const ctx = this.initAudioContext();
    if (!this.synth) {
      await ctx.audioWorklet.addModule('/spessasynth_processor.min.js');
      this.synth = new WorkletSynthesizer(ctx);
      await this.synth.isReady;
    }

    try {
      // 既存の main を上書き
      await this.synth.soundBankManager.addSoundBank(buffer, 'main');
      this.isSoundFontReady = true;
      console.log('Custom soundfont applied successfully.');
    } catch (err) {
      console.error('Failed to apply custom soundfont:', err);
      throw err;
    }
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

    const totalBeats = score.totalDuration;
    const lastTempo = this.tempoMap[this.tempoMap.length - 1];
    const remainingBeats = Math.max(0, totalBeats - lastTempo.time);
    this.totalDurationSec = lastTempo.secStart + (remainingBeats * 60) / lastTempo.bpm;
  }

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

  public calculateBeatToSec(score: ParsedScore, beat: number): number {
    this.buildTempoMap(score);
    return this.beatToSec(beat);
  }

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
   * 楽譜の全ノートを発音スケジュール用アイテムに平坦化
   */
  private prepareScheduledNotes(score: ParsedScore, startOffsetSec: number): ScheduledNoteItem[] {
    const list: ScheduledNoteItem[] = [];

    score.tracks.forEach((track) => {
      // 0-indexed channel (0-15)
      const midiChannel = Math.max(0, Math.min(15, track.channel - 1));

      track.notes.forEach((note, noteIdx) => {
        if (note.hasTieFromPrev) return;

        let noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        let effectiveEndBeat = note.startTime + noteDur;

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

        if (note.pedalReleaseTime !== undefined && note.pedalReleaseTime > effectiveEndBeat) {
          effectiveEndBeat = note.pedalReleaseTime;
        }

        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(effectiveEndBeat);

        const strumOffsetSec = note.isStrum && note.strumOrder
          ? note.strumOrder * (note.strumDelaySec || 0.035)
          : 0;

        const effectiveStartSec = noteStartSec + strumOffsetSec;
        const effectiveEndSec = Math.max(effectiveStartSec + 0.05, noteEndSec);

        if (effectiveEndSec > startOffsetSec) {
          const inst = note.instrument !== undefined ? note.instrument : track.instrument;
          list.push({
            id: `tr${track.id}_n${noteIdx}_${note.midiNote}_${effectiveStartSec}`,
            startSec: effectiveStartSec,
            endSec: effectiveEndSec,
            channel: midiChannel,
            midiNote: note.midiNote,
            velocity: note.velocity || 100,
            instrument: inst,
          });
        }
      });
    });

    list.sort((a, b) => a.startSec - b.startSec);
    return list;
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

    const now = ctx.currentTime;
    this.startTimeSec = now - startOffsetSec;

    // もし SoundFont がまだ準備できていなければ裏でロード試行
    if (!this.isSoundFontReady) {
      this.initSoundFont();
    }

    if (this.isSoundFontReady && this.synth) {
      // SoundFont チャンネル設定 (各トラックの初期楽器を設定)
      score.tracks.forEach((track) => {
        const ch = Math.max(0, Math.min(15, track.channel - 1));
        if (ch !== 9) { // チャンネル 9 (10) はドラム専用
          this.synth?.programChange(ch, track.instrument);
        }
      });

      this.scheduledNotes = this.prepareScheduledNotes(score, startOffsetSec);
      this.startSoundFontScheduler();
    } else {
      // SoundFont ロード前はオシレータフォールバックで再生
      this.playOscillatorFallback(score, startOffsetSec);
    }

    this.startProgressLoop();
  }

  /**
   * SoundFont 用の高精度スケジューラー
   */
  private startSoundFontScheduler() {
    const LOOKAHEAD_SEC = 0.15; // 150ms 先まで先読みスケジュール
    const CHECK_INTERVAL_MS = 25; // 25ms ごとにチェック

    const checkAndSchedule = () => {
      if (!this.isPlaying || !this.audioCtx || !this.synth) return;

      const currentSec = this.getCurrentTimeSec();
      const windowEndSec = currentSec + LOOKAHEAD_SEC;

      for (let i = 0; i < this.scheduledNotes.length; i++) {
        const item = this.scheduledNotes[i];

        if (item.startSec > windowEndSec) {
          // これ以降のノートはまだ先なのでループ終了
          break;
        }

        // 発音スケジュール
        if (!item.isStarted && item.startSec >= currentSec - 0.05 && item.startSec <= windowEndSec) {
          item.isStarted = true;
          const delayMs = Math.max(0, (item.startSec - currentSec) * 1000);

          item.onTimerId = setTimeout(() => {
            if (!this.isPlaying || !this.synth) return;
            // 楽器変更が必要な場合
            if (item.channel !== 9) {
              this.synth.programChange(item.channel, item.instrument);
            }
            this.synth.noteOn(item.channel, item.midiNote, item.velocity);
          }, delayMs);
          this.activeTimers.push(item.onTimerId);

          // 停止スケジュール
          const offDelayMs = Math.max(10, (item.endSec - currentSec) * 1000);
          item.offTimerId = setTimeout(() => {
            if (!this.synth) return;
            this.synth.noteOff(item.channel, item.midiNote);
            item.isEnded = true;
          }, offDelayMs);
          this.activeTimers.push(item.offTimerId);
        }
      }
    };

    // 直ちに一度実行して、タイマーを開始
    checkAndSchedule();
    this.schedulerIntervalId = setInterval(checkAndSchedule, CHECK_INTERVAL_MS);
  }

  /**
   * オシレータによるフォールバック再生
   */
  private playOscillatorFallback(score: ParsedScore, startOffsetSec: number) {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, now);
    masterGain.connect(ctx.destination);

    this.activeOscillatorNodes = [];

    score.tracks.forEach((track) => {
      track.notes.forEach((note, noteIdx) => {
        if (note.hasTieFromPrev) return;

        let noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        let effectiveEndBeat = note.startTime + noteDur;

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

        if (note.pedalReleaseTime !== undefined && note.pedalReleaseTime > effectiveEndBeat) {
          effectiveEndBeat = note.pedalReleaseTime;
        }
        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(effectiveEndBeat);
        const noteDurSec = Math.max(0.02, noteEndSec - noteStartSec);

        if (noteEndSec > startOffsetSec) {
          const strumOffsetSec = (note.isStrum && note.strumOrder)
            ? note.strumOrder * (note.strumDelaySec || 0.035)
            : 0;
          const audioStartTime = now + (noteStartSec - startOffsetSec) + strumOffsetSec;
          const effectiveDurSec = Math.max(0.02, noteDurSec - strumOffsetSec);

          if (audioStartTime >= now) {
            const inst = note.instrument !== undefined ? note.instrument : track.instrument;
            const node = this.scheduleNoteOscillator(ctx, note, inst, audioStartTime, effectiveDurSec, masterGain);
            this.activeOscillatorNodes.push(node);
          }
        }
      });
    });
  }

  /**
   * オシレータによる単一ノート合成（フォールバック用）
   */
  private scheduleNoteOscillator(
    ctx: BaseAudioContext,
    note: NoteEvent,
    instrument: number,
    startAudioTime: number,
    durationSec: number,
    masterGain: GainNode
  ): { stop: (time: number) => void } {
    const freq = midiToFreq(note.midiNote);
    const vel = (note.velocity || 100) / 127;

    let oscType: OscillatorType = 'triangle';
    let filterFreq = 3500;
    let attack = 0.01;
    let decay = 0.3;
    let sustain = 0.4;
    let release = 0.2;

    if (instrument >= 0 && instrument <= 7) {
      if (instrument >= 4 && instrument <= 5) {
        oscType = 'sine';
        filterFreq = 2400;
        decay = 1.0;
      } else {
        oscType = 'triangle';
        filterFreq = 3600;
        decay = 0.9;
      }
    } else if (instrument >= 16 && instrument <= 23) {
      oscType = instrument === 19 ? 'sawtooth' : 'sine';
      filterFreq = 3000;
      sustain = 0.9;
    } else {
      oscType = 'sawtooth';
      filterFreq = 2500;
    }

    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, startAudioTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startAudioTime);

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
   * 一時停止
   */
  public pause() {
    if (!this.isPlaying || this.isPaused || !this.audioCtx) return;
    this.pausedAtSec = this.getCurrentTimeSec();
    this.clearPlayback();
    this.isPlaying = false;
    this.isPaused = true;
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
    this.clearPlayback();
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAtSec = 0;
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(0, 0, this.totalDurationSec);
    }
  }

  /**
   * シーク
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

  private clearPlayback() {
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    this.activeTimers.forEach((id) => clearTimeout(id));
    this.activeTimers = [];
    this.scheduledNotes = [];

    if (this.synth) {
      try {
        this.synth.stopAll(true);
      } catch {
        // ignore
      }
    }

    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.activeOscillatorNodes.forEach((node) => node.stop(now));
      this.activeSingleOscillators.forEach((item) => {
        try {
          item.osc.stop(now);
          item.osc.disconnect();
          item.gain.disconnect();
        } catch {
          // ignore
        }
      });
      this.activeSingleOscillators.clear();
    }
    this.activeOscillatorNodes = [];

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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
   * 楽器の音色確認用の短いプレビュー演奏 (C4, E4, G4 の分散和音)
   */
  public previewInstrument(instrument: number) {
    const ctx = this.initAudioContext();

    if (this.isSoundFontReady && this.synth) {
      // チャンネル0で楽器変更してアルペジオ演奏
      this.synth.programChange(0, instrument);

      const notes = [
        { midi: 60, delay: 0, dur: 350 },
        { midi: 64, delay: 150, dur: 350 },
        { midi: 67, delay: 300, dur: 600 },
      ];

      notes.forEach((n) => {
        setTimeout(() => {
          if (!this.synth) return;
          this.synth.noteOn(0, n.midi, 100);
          setTimeout(() => {
            this.synth?.noteOff(0, n.midi);
          }, n.dur);
        }, n.delay);
      });
    } else {
      // フォールバック
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.5, now);
      masterGain.connect(ctx.destination);

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
        this.scheduleNoteOscillator(ctx, dummyNote, instrument, now + n.offset, n.dur, masterGain);
      });
    }
  }

  /**
   * コードプレビュー演奏
   */
  public previewChord(
    midiNotes: number[],
    instrument = 0,
    isStrum = true,
    strumDirection: 'down' | 'up' = 'down'
  ) {
    const ctx = this.initAudioContext();
    const sorted = [...midiNotes].sort((a, b) =>
      strumDirection === 'down' ? a - b : b - a
    );

    if (this.isSoundFontReady && this.synth) {
      this.synth.programChange(0, instrument);

      sorted.forEach((midi, idx) => {
        const delay = isStrum ? idx * 40 : 0;
        const dur = Math.max(400, 1200 - delay);

        setTimeout(() => {
          if (!this.synth) return;
          this.synth.noteOn(0, midi, 95);
          setTimeout(() => {
            this.synth?.noteOff(0, midi);
          }, dur);
        }, delay);
      });
    } else {
      // フォールバック
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.45, now);
      masterGain.connect(ctx.destination);

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
        const offset = isStrum ? idx * 0.04 : 0;
        const dur = 1.2 - offset;
        this.scheduleNoteOscillator(ctx, dummyNote, instrument, now + offset, Math.max(0.4, dur), masterGain);
      });
    }
  }

  /**
   * ピアノ鍵盤演奏用: 単音のノートオン
   */
  public noteOn(midiNote: number, velocity = 100, instrument = 0) {
    const ctx = this.initAudioContext();

    if (this.isSoundFontReady && this.synth) {
      this.synth.programChange(0, instrument);
      this.synth.noteOn(0, midiNote, Math.max(1, Math.min(127, velocity)));
    } else {
      // フォールバック: Web Audio オシレータ
      const now = ctx.currentTime;
      // 既存の同音があれば停止
      const existing = this.activeSingleOscillators.get(midiNote);
      if (existing) {
        try {
          existing.osc.stop(now);
          existing.osc.disconnect();
          existing.gain.disconnect();
        } catch {
          // ignore
        }
        this.activeSingleOscillators.delete(midiNote);
      }

      const freq = midiToFreq(midiNote);
      const vel = Math.max(0.01, Math.min(1, velocity / 127));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // ピアノに近い波形とフィルタ
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, now);

      const peakGain = vel * 0.5;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain * 0.6), now + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      this.activeSingleOscillators.set(midiNote, { osc, gain });
    }
  }

  /**
   * ピアノ鍵盤演奏用: 単音のノートオフ
   */
  public noteOff(midiNote: number) {
    if (!this.audioCtx) return;

    if (this.synth) {
      this.synth.noteOff(0, midiNote);
    }

    const item = this.activeSingleOscillators.get(midiNote);
    if (item) {
      const now = this.audioCtx.currentTime;
      const releaseTime = 0.15;
      try {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(item.gain.gain.value, now);
        item.gain.gain.exponentialRampToValueAtTime(0.00001, now + releaseTime);
        item.osc.stop(now + releaseTime);
        setTimeout(() => {
          try {
            item.osc.disconnect();
            item.gain.disconnect();
          } catch {
            // ignore
          }
        }, releaseTime * 1000 + 50);
      } catch {
        // ignore
      }
      this.activeSingleOscillators.delete(midiNote);
    }
  }

  /**
   * ピアノ鍵盤クリック用: 指定ミリ秒後に自動ノートオフする単音プレビュー
   */
  public previewNote(midiNote: number, durationMs = 600, instrument = 0, velocity = 100) {
    this.noteOn(midiNote, velocity, instrument);
    setTimeout(() => {
      this.noteOff(midiNote);
    }, Math.max(100, durationMs));
  }

  /**
   * OfflineAudioContext を使った PCM レンダリング (MP3 書き出し用)
   */
  public async renderOffline(score: ParsedScore): Promise<AudioBuffer> {
    this.buildTempoMap(score);
    const sampleRate = 44100;
    const duration = Math.max(1.0, this.totalDurationSec + 1.0);
    const length = Math.ceil(sampleRate * duration);

    const OfflineAudioCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineAudioCtxClass(2, length, sampleRate);

    // 現時点ではブラウザ間互換性と安定性のため、Offline時は確実かつ高速なオシレータ合成またはフォールバックパイプラインを使用
    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.7, 0);
    masterGain.connect(offlineCtx.destination);

    score.tracks.forEach((track) => {
      track.notes.forEach((note, noteIdx) => {
        if (note.hasTieFromPrev) return;

        let noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        let effectiveEndBeat = note.startTime + noteDur;

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

        if (note.pedalReleaseTime !== undefined && note.pedalReleaseTime > effectiveEndBeat) {
          effectiveEndBeat = note.pedalReleaseTime;
        }
        const noteStartSec = this.beatToSec(note.startTime);
        const noteEndSec = this.beatToSec(effectiveEndBeat);
        const noteDurSec = Math.max(0.02, noteEndSec - noteStartSec);

        const inst = note.instrument !== undefined ? note.instrument : track.instrument;
        this.scheduleNoteOscillator(offlineCtx, note, inst, noteStartSec, noteDurSec, masterGain);
      });
    });

    return await offlineCtx.startRendering();
  }
}

export const audioEngine = new AudioEngine();
