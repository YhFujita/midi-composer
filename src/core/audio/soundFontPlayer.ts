import { ParsedScore, NoteEvent } from '../../types/mml';
import { midiToFreq } from '../../utils/noteConverter';
import { soundFontManager } from './soundFontManager';
import { WorkletSynthesizer } from 'spessasynth_lib';
import {
  scheduleFormantVocalNote,
  vocalSettingsManager,
} from './vocalSynth';
import { parseLyricToPhoneme, VowelType } from './vocalPhonemes';
import { voicevoxClient, VoicevoxNoteInput } from './voicevoxClient';

export interface PlayerCallback {
  onProgress?: (currentTimeSec: number, currentBeat: number, totalDurationSec: number) => void;
  onEnded?: () => void;
  onVocalPreparing?: (isPreparing: boolean) => void;
  onVocalError?: (errorMessage: string | null) => void;
}

interface ResolvedVocalItem {
  note: NoteEvent;
  startSec: number;
  endSec: number;
  lyric: string;
  isSlurredFromPrev: boolean;
}

interface ExtractedVocalTrack {
  trackId: number;
  vocalItems: ResolvedVocalItem[];
  vvInputs: VoicevoxNoteInput[];
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
  private isPreparingVocal = false;
  private playSessionId = 0;
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

  // 音切れ・音飛び防止用ステート管理
  private channelCurrentPrograms: number[] = new Array(16).fill(-1);
  private pendingNoteOffTimers = new Map<string, any>();
  private previewTimers: any[] = [];
  private activePreviewNotes = new Map<number, { stopTimer?: any }>();

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
      const buffer = await soundFontManager.initActiveSoundFont();

      // SoundBank の登録
      await synth.soundBankManager.addSoundBank(buffer, 'main');

      // チャンネル 9 (MIDI Ch 10) をドラムモードに設定
      try {
        synth.midiChannels[9]?.setDrums(true);
      } catch (e) {
        console.warn('Failed to set drums on channel 9:', e);
      }

      this.synth = synth;
      this.isSoundFontReady = true;
      this.isSynthInitializing = false;
      console.log('SpessaSynth SoundFont engine ready with active SoundFont');
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
      try {
        this.synth.midiChannels[9]?.setDrums(true);
      } catch {}
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
   * 該当ノートを歌声合成（ボカロ）として発音すべきか判定
   */
  private isVocalNote(note: NoteEvent, trackInstrument: number): boolean {
    const inst = note.instrument !== undefined ? note.instrument : trackInstrument;
    if (inst === 129) return true;
    const settings = vocalSettingsManager.getSettings();
    if (settings.singAllLyricNotes !== false && note.lyric && note.lyric.trim().length > 0) {
      return true;
    }
    return false;
  }

  /**
   * 楽譜の全ノートを発音スケジュール用アイテムに平坦化
   */
  private prepareScheduledNotes(score: ParsedScore, startOffsetSec: number): ScheduledNoteItem[] {
    const list: ScheduledNoteItem[] = [];
    const vocalSettings = vocalSettingsManager.getSettings();

    score.tracks.forEach((track) => {
      // 0-indexed channel (0-15)
      const midiChannel = Math.max(0, Math.min(15, track.channel - 1));

      track.notes.forEach((note, noteIdx) => {
        if (note.hasTieFromPrev) return;

        const isVocal = this.isVocalNote(note, track.instrument);
        const accLayerGain = vocalSettings.accompanimentLayerGain ?? 0.2;
        // ボーカルノートで伴奏ユニゾンレイヤーが0の場合はSoundFont側では鳴らさない
        if (isVocal && accLayerGain <= 0.01) {
          return;
        }

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
        // タイで繋がっていない場合、同一ノートの連続発音時に NoteOff が次の NoteOn を打ち消して
        // 音がブツブツ切れるのを防ぐため、微小なリリースギャップ(約15ms)を設ける
        const rawDurSec = Math.max(0.01, noteEndSec - noteStartSec);
        const releaseGap = note.hasTieToNext ? 0 : Math.min(0.018, Math.max(0.005, rawDurSec * 0.05));
        const effectiveEndSec = Math.max(effectiveStartSec + 0.04, noteEndSec - releaseGap);

        if (effectiveEndSec > startOffsetSec) {
          const rawInst = note.instrument !== undefined ? note.instrument : track.instrument;
          const inst = rawInst === 129 ? 52 : rawInst; // 129(Vocal)のユニゾン補助音は 52(Choir Aahs)
          const rawVel = note.velocity || 100;
          const effectiveVel = isVocal ? Math.max(1, Math.round(rawVel * accLayerGain)) : rawVel;
          const noteChannel = note.channel !== undefined ? Math.max(0, Math.min(15, note.channel - 1)) : midiChannel;
          list.push({
            id: `tr${track.id}_n${noteIdx}_${note.midiNote}_${effectiveStartSec}`,
            startSec: effectiveStartSec,
            endSec: effectiveEndSec,
            channel: noteChannel,
            midiNote: note.midiNote,
            velocity: effectiveVel,
            instrument: inst,
          });
        }
      });
    });

    list.sort((a, b) => a.startSec - b.startSec);
    return list;
  }

  /**
   * 楽譜からボーカルノート情報をトラックごとに抽出する
   */
  private extractVocalTracksData(score: ParsedScore): ExtractedVocalTrack[] {
    const result: ExtractedVocalTrack[] = [];

    score.tracks.forEach((track) => {
      const vocalItems: ResolvedVocalItem[] = [];
      let prevWasSlurred = false;

      track.notes.forEach((note, noteIdx) => {
        if (note.hasTieFromPrev) return;
        if (!this.isVocalNote(note, track.instrument)) {
          prevWasSlurred = false;
          return;
        }

        let noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        // 歌声の場合はゲートタイムが短すぎないよう最低でも音長の92%を確保して滑らかに歌わせる
        noteDur = Math.max(noteDur, note.duration * 0.92);
        let effectiveEndBeat = note.startTime + noteDur;

        if (note.hasTieToNext) {
          let currentNote = note;
          for (let nextIdx = noteIdx + 1; nextIdx < track.notes.length; nextIdx++) {
            const nextNote = track.notes[nextIdx];
            if (nextNote.hasTieFromPrev && nextNote.midiNote === currentNote.midiNote) {
              const nextDur = Math.max(
                nextNote.gateDuration !== undefined ? nextNote.gateDuration : nextNote.duration,
                nextNote.duration * 0.92
              );
              effectiveEndBeat = nextNote.startTime + nextDur;
              if (!nextNote.hasTieToNext) break;
              currentNote = nextNote;
            }
          }
        }

        const startSec = this.beatToSec(note.startTime);
        const endSec = this.beatToSec(effectiveEndBeat);
        const lyricText = note.lyric && note.lyric.trim().length > 0 ? note.lyric.trim() : 'ら';

        vocalItems.push({
          note,
          startSec,
          endSec: Math.max(startSec + 0.05, endSec),
          lyric: lyricText,
          isSlurredFromPrev: prevWasSlurred,
        });

        prevWasSlurred = Boolean(note.slurGroupId !== undefined && !note.isSlurEnd);
      });

      if (vocalItems.length > 0) {
        const vvInputs: VoicevoxNoteInput[] = vocalItems.map((it) => ({
          midiNote: it.note.midiNote,
          startSec: it.startSec,
          endSec: it.endSec,
          lyric: it.lyric,
        }));
        result.push({
          trackId: track.id,
          vocalItems,
          vvInputs,
        });
      }
    });

    return result;
  }

  /**
   * プリフェッチ済みの VOICEVOX 歌声クリップまたは内蔵フォルマント合成を伴奏と同期スケジュールする
   */
  private schedulePreparedVocalTracks(
    vocalTracksData: ExtractedVocalTrack[],
    startOffsetSec: number
  ) {
    if (!this.audioCtx || vocalTracksData.length === 0) return;
    const ctx = this.audioCtx;
    const vocalSettings = vocalSettingsManager.getSettings();

    const vocalMaster = ctx.createGain();
    vocalMaster.gain.setValueAtTime(0.85, ctx.currentTime);
    vocalMaster.connect(ctx.destination);

    const shouldTryVoicevox =
      vocalSettings.engineMode === 'voicevox' ||
      (vocalSettings.engineMode === 'auto' && voicevoxClient.getConnectionStatus());

    vocalTracksData.forEach(({ vocalItems, vvInputs }) => {
      // 内蔵フォルマントシンセでスケジュールする関数
      const scheduleWithFormant = (currentOffsetSec: number) => {
        if (!this.audioCtx || !this.isPlaying) return;
        const now = this.audioCtx.currentTime;
        let prevVowel: VowelType = 'a';

        vocalItems.forEach((item) => {
          if (item.endSec <= currentOffsetSec) {
            // すでに過ぎたノートでも母音の引き継ぎ（長音「ー」用）だけ更新
            prevVowel = parseLyricToPhoneme(item.lyric, prevVowel).vowel;
            return;
          }

          const effectiveStart = Math.max(currentOffsetSec, item.startSec);
          const audioStartTime = now + (effectiveStart - currentOffsetSec);
          const durSec = Math.max(0.04, item.endSec - effectiveStart);

          const scheduled = scheduleFormantVocalNote(
            ctx,
            item.note.midiNote,
            item.lyric,
            prevVowel,
            audioStartTime,
            durSec,
            item.note.velocity || 100,
            vocalMaster,
            vocalSettings,
            item.isSlurredFromPrev
          );
          prevVowel = scheduled.vowel;
          this.activeOscillatorNodes.push(scheduled);
        });
      };

      if (shouldTryVoicevox) {
        const cachedClip = voicevoxClient.getCachedTrackVocal(vvInputs);
        if (cachedClip) {
          const src = ctx.createBufferSource();
          src.buffer = cachedClip.audioBuffer;
          const vvGain = ctx.createGain();
          vvGain.gain.setValueAtTime((vocalSettings.vocalVolume ?? 1.25) * 0.95, ctx.currentTime);
          src.connect(vvGain);
          vvGain.connect(ctx.destination);

          const now = ctx.currentTime;
          if (cachedClip.startOffsetSec >= startOffsetSec) {
            const delay = cachedClip.startOffsetSec - startOffsetSec;
            src.start(now + delay);
          } else {
            const bufferOffset = startOffsetSec - cachedClip.startOffsetSec;
            if (bufferOffset < cachedClip.audioBuffer.duration) {
              src.start(now, bufferOffset);
            }
          }

          this.activeOscillatorNodes.push({
            stop: (t: number) => {
              try {
                src.stop(t);
                src.disconnect();
                vvGain.disconnect();
              } catch {
                // ignore
              }
            },
          });
          return;
        }
      }

      // 内蔵フォルマント合成（またはVOICEVOX合成失敗時のフォールバック）
      scheduleWithFormant(startOffsetSec);
    });
  }

  /**
   * 伴奏と歌声を同一基準時刻から一斉に再生開始する内部メソッド
   */
  private async startActualPlayback(
    score: ParsedScore,
    startOffsetSec: number,
    vocalTracksData: ExtractedVocalTrack[],
    sessionId?: number
  ) {
    if (!this.audioCtx || !this.isPlaying) return;
    if (sessionId !== undefined && this.playSessionId !== sessionId) return;

    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    if (!this.isPlaying || (sessionId !== undefined && this.playSessionId !== sessionId)) return;

    const now = ctx.currentTime;
    this.startTimeSec = now - startOffsetSec;

    this.channelCurrentPrograms.fill(-1);

    if (this.isSoundFontReady && this.synth) {
      // チャンネル 9 (MIDI Ch 10) をドラムモードに設定
      try {
        this.synth.midiChannels[9]?.setDrums(true);
      } catch {}

      this.scheduledNotes = this.prepareScheduledNotes(score, startOffsetSec);

      // SoundFont チャンネル設定:
      // 再生開始位置以降で各チャンネルが最初に発音する音符の音色を初期音色として設定する
      const initialPrograms = new Map<number, number>();
      this.scheduledNotes.forEach((item) => {
        if (!initialPrograms.has(item.channel)) {
          initialPrograms.set(item.channel, item.instrument);
        }
      });
      score.tracks.forEach((track) => {
        const ch = Math.max(0, Math.min(15, track.channel - 1));
        if (!initialPrograms.has(ch)) {
          initialPrograms.set(ch, track.instrument === 129 ? 52 : track.instrument);
        }
      });
      initialPrograms.forEach((program, ch) => {
        if (ch !== 9) { // チャンネル 9 (10) はドラム専用
          const gmProg = program === 129 ? 52 : Math.max(0, Math.min(127, program));
          this.synth?.programChange(ch, gmProg);
          this.channelCurrentPrograms[ch] = gmProg;
        }
      });

      this.startSoundFontScheduler();
      this.schedulePreparedVocalTracks(vocalTracksData, startOffsetSec);
    } else {
      // SoundFont ロード前はオシレータフォールバックで再生
      this.playOscillatorFallback(score, startOffsetSec);
      this.schedulePreparedVocalTracks(vocalTracksData, startOffsetSec);
    }

    this.startProgressLoop();
  }

  /**
   * 楽譜の再生を開始
   * VOICEVOX 連携が有効かつ未キャッシュのボーカルトラックがある場合は、
   * 伴奏を先に走らせず歌声合成（プリフェッチ）の完了を待ってから頭から同期再生を開始します。
   */
  public play(score: ParsedScore, startOffsetSec = 0) {
    const ctx = this.initAudioContext();
    this.stop();

    // ユーザークリックの同期タイミングで1サンプルの無音バッファを再生してAudioContextの自動サスペンドを防止
    try {
      const unlockBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const unlockSrc = ctx.createBufferSource();
      unlockSrc.buffer = unlockBuf;
      unlockSrc.connect(ctx.destination);
      unlockSrc.start(0);
    } catch {
      // ignore
    }

    const sessionId = ++this.playSessionId;

    this.currentScore = score;
    this.buildTempoMap(score);
    this.isPlaying = true;
    this.isPaused = false;
    this.pausedAtSec = startOffsetSec;
    this.callbacks.onVocalError?.(null);

    // もし SoundFont がまだ準備できていなければ裏でロード試行
    if (!this.isSoundFontReady) {
      this.initSoundFont();
    }

    const vocalSettings = vocalSettingsManager.getSettings();
    const shouldTryVoicevox =
      vocalSettings.engineMode === 'voicevox' ||
      (vocalSettings.engineMode === 'auto' && voicevoxClient.getConnectionStatus());

    const vocalTracksData = this.extractVocalTracksData(score);
    const uncachedVocalTracks = shouldTryVoicevox
      ? vocalTracksData.filter((td) => !voicevoxClient.hasCachedTrackVocal(td.vvInputs))
      : [];

    if (uncachedVocalTracks.length > 0) {
      this.isPreparingVocal = true;
      this.callbacks.onVocalPreparing?.(true);

      Promise.all(
        uncachedVocalTracks.map((td) => voicevoxClient.synthesizeTrackVocal(ctx, td.vvInputs))
      )
        .then((results) => {
          if (this.playSessionId !== sessionId || !this.isPlaying) return;
          this.isPreparingVocal = false;
          this.callbacks.onVocalPreparing?.(false);
          if (results.some((r) => r === null) && voicevoxClient.getLastError()) {
            this.callbacks.onVocalError?.(voicevoxClient.getLastError());
          }
          this.startActualPlayback(score, startOffsetSec, vocalTracksData, sessionId);
        })
        .catch(() => {
          if (this.playSessionId !== sessionId || !this.isPlaying) return;
          this.isPreparingVocal = false;
          this.callbacks.onVocalPreparing?.(false);
          if (voicevoxClient.getLastError()) {
            this.callbacks.onVocalError?.(voicevoxClient.getLastError());
          }
          this.startActualPlayback(score, startOffsetSec, vocalTracksData, sessionId);
        });
    } else {
      this.startActualPlayback(score, startOffsetSec, vocalTracksData, sessionId);
    }
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

        // 発音スケジュール (過去の未発音ノートも含め確実にスケジュールして音飛びを防止)
        if (!item.isStarted && item.startSec <= windowEndSec) {
          item.isStarted = true;
          const delayMs = Math.max(0, (item.startSec - currentSec) * 1000);
          const noteKey = `${item.channel}_${item.midiNote}`;

          item.onTimerId = setTimeout(() => {
            if (!this.isPlaying || !this.synth) return;

            // 1. 同一チャンネル・同一ノートの保留中 NoteOff があれば先にクリア＆確実に消音
            // これにより、前の音の NoteOff が新しい NoteOn の直後に発火して消音してしまう事故を防ぐ
            if (this.pendingNoteOffTimers.has(noteKey)) {
              clearTimeout(this.pendingNoteOffTimers.get(noteKey));
              this.pendingNoteOffTimers.delete(noteKey);
              try {
                this.synth.noteOff(item.channel, item.midiNote);
              } catch {
                // ignore
              }
            }

            // 2. 楽器変更が必要な場合のみ programChange を送信 (不要な連打による音切れ・ボイス途切れを防止)
            if (item.channel !== 9) {
              const currentProg = this.channelCurrentPrograms[item.channel];
              if (currentProg !== item.instrument) {
                this.synth.programChange(item.channel, item.instrument);
                this.channelCurrentPrograms[item.channel] = item.instrument;
              }
            }

            // 3. 発音
            this.synth.noteOn(item.channel, item.midiNote, item.velocity);
          }, delayMs);
          this.activeTimers.push(item.onTimerId);

          // 停止スケジュール
          const offDelayMs = Math.max(15, (item.endSec - currentSec) * 1000);
          item.offTimerId = setTimeout(() => {
            if (!this.synth) return;
            this.synth.noteOff(item.channel, item.midiNote);
            this.pendingNoteOffTimers.delete(noteKey);
            item.isEnded = true;
          }, offDelayMs);
          this.activeTimers.push(item.offTimerId);
          this.pendingNoteOffTimers.set(noteKey, item.offTimerId);
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
        // ボーカルノートは scheduleVocalTracks で発音されるため重複回避
        if (this.isVocalNote(note, track.instrument)) return;

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
            const effectiveNote: NoteEvent = {
              ...note,
              channel: note.channel !== undefined ? note.channel : track.channel,
            };
            const node = this.scheduleNoteOscillator(ctx, effectiveNote, inst, audioStartTime, effectiveDurSec, masterGain);
            this.activeOscillatorNodes.push(node);
          }
        }
      });
    });
  }

  /**
   * ドラム音のオシレータ/ノイズ合成 (Web Audio API / OfflineAudioContext 共通)
   */
  private scheduleDrumOscillator(
    ctx: BaseAudioContext,
    midiNote: number,
    startAudioTime: number,
    velocity = 100,
    masterGain: GainNode
  ): { stop: (time: number) => void } {
    const vel = Math.max(0.01, Math.min(1, velocity / 127));
    const activeNodes: { stop?: (t: number) => void; disconnect?: () => void }[] = [];

    // バスドラム (35, 36)
    if (midiNote === 35 || midiNote === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, startAudioTime);
      osc.frequency.exponentialRampToValueAtTime(35, startAudioTime + 0.12);
      gain.gain.setValueAtTime(vel * 0.9, startAudioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + 0.25);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startAudioTime);
      osc.stop(startAudioTime + 0.26);
      activeNodes.push(osc, gain);
    }
    // スネアドラム (38, 40)
    else if (midiNote === 38 || midiNote === 40) {
      const bufferSize = Math.floor(ctx.sampleRate * 0.2);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, startAudioTime);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vel * 0.6, startAudioTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + 0.2);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noise.start(startAudioTime);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, startAudioTime);
      osc.frequency.exponentialRampToValueAtTime(80, startAudioTime + 0.1);
      oscGain.gain.setValueAtTime(vel * 0.4, startAudioTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + 0.15);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(startAudioTime);
      osc.stop(startAudioTime + 0.2);
      activeNodes.push(noise, filter, noiseGain, osc, oscGain);
    }
    // ハイハット (42: Closed, 44: Pedal, 46: Open)
    else if (midiNote === 42 || midiNote === 44 || midiNote === 46) {
      const dur = midiNote === 46 ? 0.35 : 0.08;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, startAudioTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.45, startAudioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(startAudioTime);
      activeNodes.push(noise, filter, gain);
    }
    // シンバル (49, 51, 52, 53, 55, 57, 59)
    else if ([49, 51, 52, 53, 55, 57, 59].includes(midiNote)) {
      const dur = 0.8;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(5500, startAudioTime);
      filter.Q.setValueAtTime(1.5, startAudioTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.5, startAudioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(startAudioTime);
      activeNodes.push(noise, filter, gain);
    }
    // タム (41, 43, 45, 47, 48, 50)
    else if ([41, 43, 45, 47, 48, 50].includes(midiNote)) {
      const baseFreq = 90 + (midiNote - 41) * 15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 1.4, startAudioTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, startAudioTime + 0.12);
      gain.gain.setValueAtTime(vel * 0.7, startAudioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + 0.3);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startAudioTime);
      osc.stop(startAudioTime + 0.31);
      activeNodes.push(osc, gain);
    }
    // その他パーカッション (カウベル、ウッドブロック等)
    else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(midiNote), startAudioTime);
      gain.gain.setValueAtTime(vel * 0.5, startAudioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + 0.15);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startAudioTime);
      osc.stop(startAudioTime + 0.16);
      activeNodes.push(osc, gain);
    }

    return {
      stop: () => {
        activeNodes.forEach((node) => {
          try {
            if (node.stop) node.stop(0);
            if (node.disconnect) node.disconnect();
          } catch {}
        });
      },
    };
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
    // ドラムパート判定: MIDIチャンネル10 (note.channel === 10)、または楽器128
    const isDrumNote = note.channel === 10 || instrument === 128;
    if (isDrumNote) {
      return this.scheduleDrumOscillator(ctx, note.midiNote, startAudioTime, note.velocity || 100, masterGain);
    }

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
    this.playSessionId++;
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
    this.playSessionId++;
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
    if (!this.isPlaying || this.isPreparingVocal || !this.audioCtx) {
      return this.pausedAtSec;
    }
    return Math.max(0, this.audioCtx.currentTime - this.startTimeSec);
  }

  public getTotalDurationSec(): number {
    return this.totalDurationSec;
  }

  private clearPlayback() {
    if (this.isPreparingVocal) {
      this.isPreparingVocal = false;
      this.callbacks.onVocalPreparing?.(false);
    }
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    this.activeTimers.forEach((id) => clearTimeout(id));
    this.activeTimers = [];
    this.pendingNoteOffTimers.forEach((id) => clearTimeout(id));
    this.pendingNoteOffTimers.clear();
    this.previewTimers.forEach((id) => clearTimeout(id));
    this.previewTimers = [];
    this.scheduledNotes = [];
    this.channelCurrentPrograms.fill(-1);

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
   * ボーカル歌声のプレビュー試聴 ("ど・れ・み・ふぁ・そ" を内蔵フォルマント合成で歌う)
   */
  public previewVocal(sampleLyrics: string[] = ['ど', 'れ', 'み', 'ふぁ', 'そ']) {
    const ctx = this.initAudioContext();
    this.previewTimers.forEach((id) => clearTimeout(id));
    this.previewTimers = [];

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(ctx.destination);

    const midis = [60, 62, 64, 65, 67];
    let prevVowel: VowelType = 'a';
    const settings = vocalSettingsManager.getSettings();

    midis.forEach((midi, idx) => {
      const lyric = sampleLyrics[idx] || 'ら';
      const offset = idx * 0.28;
      const dur = idx === midis.length - 1 ? 0.55 : 0.26;
      const res = scheduleFormantVocalNote(
        ctx,
        midi,
        lyric,
        prevVowel,
        now + offset,
        dur,
        105,
        masterGain,
        settings,
        false
      );
      prevVowel = res.vowel;
    });
  }

  /**
   * VOICEVOX サーバーを使ったテスト歌唱プレビュー ("ど・れ・み" を合成して再生)
   */
  public async previewVoicevoxVocal(
    sampleLyrics: string[] = ['ど', 'れ', 'み']
  ): Promise<{ ok: boolean; error?: string }> {
    const ctx = this.initAudioContext();
    try {
      const unlockBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const unlockSrc = ctx.createBufferSource();
      unlockSrc.buffer = unlockBuf;
      unlockSrc.connect(ctx.destination);
      unlockSrc.start(0);
    } catch {
      // ignore
    }

    const midis = [60, 62, 64];
    const vvInputs: VoicevoxNoteInput[] = midis.map((midi, idx) => ({
      midiNote: midi,
      startSec: idx * 0.45,
      endSec: idx * 0.45 + (idx === midis.length - 1 ? 0.65 : 0.45),
      lyric: sampleLyrics[idx] || 'ら',
    }));

    const clip = await voicevoxClient.synthesizeTrackVocal(ctx, vvInputs);
    if (!clip) {
      return {
        ok: false,
        error: voicevoxClient.getLastError() || 'VOICEVOX でのテスト歌声合成に失敗しました。',
      };
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = clip.audioBuffer;
    const gain = ctx.createGain();
    const vol = vocalSettingsManager.getSettings().vocalVolume ?? 1.25;
    gain.gain.setValueAtTime(vol * 0.95, ctx.currentTime);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);

    return { ok: true };
  }

  /**
   * 楽器の音色確認用の短いプレビュー演奏 (C4, E4, G4 の分散和音)
   */
  public previewInstrument(instrument: number) {
    const ctx = this.initAudioContext();

    // 以前のプレビュー演奏タイマーをキャンセル
    this.previewTimers.forEach((id) => clearTimeout(id));
    this.previewTimers = [];

    // 129: ボーカル・歌声合成のプレビュー
    if (instrument === 129) {
      this.previewVocal(['ど', 'み', 'そ']);
      return;
    }

    if (this.isSoundFontReady && this.synth) {
      // プレビュー用チャンネル(0)の発音中ボイスを停止してから楽器変更
      try {
        [60, 64, 67].forEach((midi) => this.synth?.noteOff(0, midi));
      } catch {}

      this.synth.programChange(0, instrument);
      this.channelCurrentPrograms[0] = instrument;

      const notes = [
        { midi: 60, delay: 0, dur: 330 },
        { midi: 64, delay: 150, dur: 330 },
        { midi: 67, delay: 300, dur: 580 },
      ];

      notes.forEach((n) => {
        const onTimer = setTimeout(() => {
          if (!this.synth) return;
          this.synth.noteOn(0, n.midi, 100);

          const offTimer = setTimeout(() => {
            this.synth?.noteOff(0, n.midi);
          }, n.dur);
          this.previewTimers.push(offTimer);
        }, n.delay);

        this.previewTimers.push(onTimer);
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
    this.previewTimers.forEach((id) => clearTimeout(id));
    this.previewTimers = [];

    const sorted = [...midiNotes].sort((a, b) =>
      strumDirection === 'down' ? a - b : b - a
    );

    if (this.isSoundFontReady && this.synth) {
      try {
        midiNotes.forEach((midi) => this.synth?.noteOff(0, midi));
      } catch {}

      this.synth.programChange(0, instrument);
      this.channelCurrentPrograms[0] = instrument;

      sorted.forEach((midi, idx) => {
        const delay = isStrum ? idx * 40 : 0;
        const dur = Math.max(350, 1150 - delay);

        const onTimer = setTimeout(() => {
          if (!this.synth) return;
          this.synth.noteOn(0, midi, 95);

          const offTimer = setTimeout(() => {
            this.synth?.noteOff(0, midi);
          }, dur);
          this.previewTimers.push(offTimer);
        }, delay);

        this.previewTimers.push(onTimer);
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
   * フォールバック用のドラム単音合成 (Web Audio API)
   */
  private playFallbackDrumNote(ctx: AudioContext, midiNote: number, velocity = 100) {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.scheduleDrumOscillator(ctx, midiNote, ctx.currentTime, velocity, masterGain);
  }

  /**
   * ピアノ鍵盤演奏用: 単音のノートオン
   * @param isDrum ドラムセット(MIDI Channel 10 / パーカッションバンク)で発音するか
   */
  public noteOn(midiNote: number, velocity = 100, instrument = 0, isDrum = false) {
    const ctx = this.initAudioContext();

    if (!isDrum && instrument === 129) {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.8, now);
      masterGain.connect(ctx.destination);
      scheduleFormantVocalNote(ctx, midiNote, 'ら', 'a', now, 0.45, velocity, masterGain);
      return;
    }

    if (this.isSoundFontReady && this.synth) {
      if (isDrum) {
        // GMドラムチャンネル (インデックス 9 = MIDI Ch 10)
        this.synth.noteOn(9, midiNote, Math.max(1, Math.min(127, velocity)));
      } else {
        if (this.channelCurrentPrograms[0] !== instrument) {
          this.synth.programChange(0, instrument);
          // 再生スケジューラ側の音色キャッシュと同期させる (再生中の音色ズレ防止)
          this.channelCurrentPrograms[0] = instrument;
        }
        this.synth.noteOn(0, midiNote, Math.max(1, Math.min(127, velocity)));
      }
    } else {
      if (isDrum) {
        this.playFallbackDrumNote(ctx, midiNote, velocity);
        return;
      }
      // フォールバック: Web Audio オシレータ (旋律楽器)
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
  public noteOff(midiNote: number, isDrum = false) {
    if (!this.audioCtx) return;

    if (this.synth) {
      if (isDrum) {
        this.synth.noteOff(9, midiNote);
      } else {
        this.synth.noteOff(0, midiNote);
      }
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
  public previewNote(midiNote: number, durationMs = 600, instrument = 0, velocity = 100, isDrum = false) {
    const existing = this.activePreviewNotes.get(midiNote);
    if (existing?.stopTimer) {
      clearTimeout(existing.stopTimer);
      this.activePreviewNotes.delete(midiNote);
      this.noteOff(midiNote, isDrum);
    }

    this.noteOn(midiNote, velocity, instrument, isDrum);
    const stopTimer = setTimeout(() => {
      this.noteOff(midiNote, isDrum);
      this.activePreviewNotes.delete(midiNote);
    }, Math.max(100, durationMs));

    this.activePreviewNotes.set(midiNote, { stopTimer });
  }

  /**
   * 半リアルタイム入力用: メトロノームのクリック音を合成再生
   * 楽器の持続音と混ざっても聴き取りやすいウッドブロック調の短音クリックを遅延ゼロで発音する
   */
  public playMetronomeClick(accent: 'accent' | 'quarter' | 'sub' = 'quarter', volume = 0.8) {
    const ctx = this.initAudioContext();
    const now = ctx.currentTime;
    const clampedVol = Math.max(0, Math.min(1, volume));
    if (clampedVol <= 0.001) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let startFreq = 1120;
    let endFreq = 760;
    let durationSec = 0.038;
    let peakGain = clampedVol * 0.36;

    if (accent === 'accent') {
      startFreq = 1560;
      endFreq = 1040;
      durationSec = 0.048;
      peakGain = clampedVol * 0.46;
    } else if (accent === 'sub') {
      startFreq = 780;
      endFreq = 540;
      durationSec = 0.028;
      peakGain = clampedVol * 0.24;
    }

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };

    osc.start(now);
    osc.stop(now + durationSec + 0.005);
  }

  /**
   * OfflineAudioContext を使った PCM レンダリング (MP3 書き出し用)
   */
  public async renderOffline(score: ParsedScore): Promise<AudioBuffer> {
    this.buildTempoMap(score);
    const sampleRate = 44100;
    const duration = Math.max(1.0, this.totalDurationSec + 1.0);
    const length = Math.ceil(sampleRate * duration);

    const OfflineAudioCtxClass =
      (typeof window !== 'undefined' && (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) ||
      (globalThis as any).OfflineAudioContext;
    if (!OfflineAudioCtxClass) {
      throw new Error('お使いのブラウザ環境では OfflineAudioContext がサポートされていません。');
    }
    const offlineCtx = new OfflineAudioCtxClass(2, length, sampleRate);

    // 現時点ではブラウザ間互換性と安定性のため、Offline時は確実かつ高速なオシレータ合成＋歌声合成パイプラインを使用
    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.7, 0);
    masterGain.connect(offlineCtx.destination);

    const vocalSettings = vocalSettingsManager.getSettings();
    const shouldTryVoicevox =
      vocalSettings.engineMode === 'voicevox' ||
      (vocalSettings.engineMode === 'auto' && voicevoxClient.getConnectionStatus());

    for (const track of score.tracks) {
      const vvInputs: VoicevoxNoteInput[] = [];
      const vocalNotesMeta: {
        note: NoteEvent;
        startSec: number;
        durSec: number;
        lyric: string;
        isSlurredFromPrev: boolean;
      }[] = [];
      let prevWasSlurred = false;

      track.notes.forEach((note, noteIdx) => {
        if (note.hasTieFromPrev) return;

        const isVocal = this.isVocalNote(note, track.instrument);
        let noteDur = note.gateDuration !== undefined ? note.gateDuration : note.duration;
        if (isVocal) {
          noteDur = Math.max(noteDur, note.duration * 0.92);
        }
        let effectiveEndBeat = note.startTime + noteDur;

        if (note.hasTieToNext) {
          let currentNote = note;
          for (let nextIdx = noteIdx + 1; nextIdx < track.notes.length; nextIdx++) {
            const nextNote = track.notes[nextIdx];
            if (nextNote.hasTieFromPrev && nextNote.midiNote === currentNote.midiNote) {
              const nextDur = nextNote.gateDuration !== undefined ? nextNote.gateDuration : nextNote.duration;
              effectiveEndBeat = nextNote.startTime + (isVocal ? Math.max(nextDur, nextNote.duration * 0.92) : nextDur);
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

        if (isVocal) {
          const lyricText = note.lyric && note.lyric.trim().length > 0 ? note.lyric.trim() : 'ら';
          vvInputs.push({
            midiNote: note.midiNote,
            startSec: noteStartSec,
            endSec: Math.max(noteStartSec + 0.05, noteEndSec),
            lyric: lyricText,
          });
          vocalNotesMeta.push({
            note,
            startSec: noteStartSec,
            durSec: Math.max(0.04, noteDurSec),
            lyric: lyricText,
            isSlurredFromPrev: prevWasSlurred,
          });
          prevWasSlurred = Boolean(note.slurGroupId !== undefined && !note.isSlurEnd);

          // ユニゾン補助レイヤーが有効な場合は薄く伴奏音もミックス
          const accGain = vocalSettings.accompanimentLayerGain ?? 0.2;
          if (accGain > 0.01) {
            const inst = (note.instrument !== undefined ? note.instrument : track.instrument) === 129
              ? 52
              : (note.instrument !== undefined ? note.instrument : track.instrument);
            const effectiveNote: NoteEvent = {
              ...note,
              velocity: Math.max(1, Math.round((note.velocity || 100) * accGain)),
              channel: note.channel !== undefined ? note.channel : track.channel,
            };
            this.scheduleNoteOscillator(offlineCtx, effectiveNote, inst, noteStartSec, noteDurSec, masterGain);
          }
        } else {
          prevWasSlurred = false;
          const inst = note.instrument !== undefined ? note.instrument : track.instrument;
          const effectiveNote: NoteEvent = {
            ...note,
            channel: note.channel !== undefined ? note.channel : track.channel,
          };
          this.scheduleNoteOscillator(offlineCtx, effectiveNote, inst, noteStartSec, noteDurSec, masterGain);
        }
      });

      if (vocalNotesMeta.length > 0) {
        let renderedWithVoicevox = false;
        if (shouldTryVoicevox) {
          try {
            const clip = await voicevoxClient.synthesizeTrackVocal(offlineCtx, vvInputs);
            if (clip) {
              const src = offlineCtx.createBufferSource();
              src.buffer = clip.audioBuffer;
              const vvGain = offlineCtx.createGain();
              vvGain.gain.setValueAtTime((vocalSettings.vocalVolume ?? 1.25) * 0.95, 0);
              src.connect(vvGain);
              vvGain.connect(offlineCtx.destination);
              if (clip.startOffsetSec >= 0) {
                src.start(clip.startOffsetSec);
              } else {
                src.start(0, -clip.startOffsetSec);
              }
              renderedWithVoicevox = true;
            }
          } catch {
            renderedWithVoicevox = false;
          }
        }

        if (!renderedWithVoicevox) {
          let prevVowel: VowelType = 'a';
          vocalNotesMeta.forEach((vm) => {
            const res = scheduleFormantVocalNote(
              offlineCtx,
              vm.note.midiNote,
              vm.lyric,
              prevVowel,
              vm.startSec,
              vm.durSec,
              vm.note.velocity || 100,
              masterGain,
              vocalSettings,
              vm.isSlurredFromPrev
            );
            prevVowel = res.vowel;
          });
        }
      }
    }

    return await offlineCtx.startRendering();
  }
}

export const audioEngine = new AudioEngine();
