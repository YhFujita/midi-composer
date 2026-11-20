import { parseLyricToPhoneme, VowelType } from './vocalPhonemes';
import { vocalSettingsManager } from './vocalSynth';

export interface VoicevoxSingerStyle {
  id: number;
  name: string;
  type?: string; // 'sing' | 'singing_teacher' | 'frame_decode' | 'humming'
}

export interface VoicevoxSinger {
  name: string;
  speaker_uuid: string;
  styles: VoicevoxSingerStyle[];
}

export interface VoicevoxNoteInput {
  midiNote: number;
  startSec: number;
  endSec: number;
  lyric: string;
}

export interface RenderedVocalClip {
  audioBuffer: AudioBuffer;
  /** AudioBuffer の先頭が楽曲の何秒目に対応するか (VOICEVOX先頭休符パディング補正込み) */
  startOffsetSec: number;
}

const VOICEVOX_FPS = 24000 / 256; // 93.75 frames per second
const INITIAL_REST_FRAMES = 15; // VOICEVOX仕様上必須となる先頭休符フレーム数 (0.16秒)
const MAX_NOTES_PER_CHUNK = 14; // 長尺曲でのタイムアウト・推論エラーを防ぐ1リクエストあたりの最大音符数

class VoicevoxClient {
  private isConnected = false;
  private singers: VoicevoxSinger[] = [];
  private teacherSpeakerIds: number[] = [6000];
  private clipCache = new Map<string, RenderedVocalClip>();
  private lastError: string | null = null;

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getSingers(): VoicevoxSinger[] {
    return this.singers;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public clearCache() {
    this.clipCache.clear();
  }

  /**
   * ngrok 等のトンネル警告画面を回避しつつ fetch を実行するヘルパー
   */
  private async fetchWithTunnelSupport(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    // ngrok 無料プランで GET リクエスト時に HTML 警告ページが返された場合はヘッダーを付与して再試行
    if (res.ok && contentType.includes('text/html')) {
      const retryHeaders = new Headers(init?.headers || {});
      retryHeaders.set('ngrok-skip-browser-warning', 'true');
      return await fetch(url, { ...init, headers: retryHeaders });
    }
    return res;
  }

  /**
   * VOICEVOX サーバー（ローカルPC / Google Colab等のリモートサーバー）への疎通確認とシンガー一覧取得
   */
  public async checkConnection(customUrl?: string): Promise<{
    ok: boolean;
    singers: VoicevoxSinger[];
    error?: string;
  }> {
    const baseUrl = (customUrl || vocalSettingsManager.getSettings().voicevoxUrl).replace(/\/+$/, '');
    this.lastError = null;

    try {
      const controller = new AbortController();
      // Google Colab やリモートトンネル経由の初回コールドスタートにも対応できるよう 15秒 (15000ms) に設定
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await this.fetchWithTunnelSupport(`${baseUrl}/singers`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.isConnected = false;
        const errMsg = `VOICEVOX サーバーからエラー応答が返されました (HTTP ${res.status})。URLまたはサーバーの起動状態を確認してください。`;
        this.lastError = errMsg;
        return {
          ok: false,
          singers: [],
          error: errMsg,
        };
      }

      const data: VoicevoxSinger[] = await res.json();
      const rawSingers = Array.isArray(data) ? data : [];

      // クエリ生成用 (singing_teacher / sing) のスタイルIDを収集
      const teacherIds: number[] = [];
      const decodeStyleIds: number[] = [];

      rawSingers.forEach((s) => {
        s.styles.forEach((st) => {
          if (st.type === 'singing_teacher' || st.type === 'sing') {
            teacherIds.push(st.id);
          }
          if (st.type === 'frame_decode' || st.type === 'sing' || st.type === 'humming' || !st.type) {
            decodeStyleIds.push(st.id);
          }
        });
      });

      if (!teacherIds.includes(6000)) {
        teacherIds.push(6000);
      }
      this.teacherSpeakerIds = teacherIds;
      this.singers = rawSingers;
      this.isConnected = true;

      // 現在の speakerId が波形合成可能なスタイル一覧に存在しない場合は最適な初期スタイルIDをセット
      const currentSpeakerId = vocalSettingsManager.getSettings().voicevoxSpeakerId;
      const allStyleIds = rawSingers.flatMap((s) => s.styles.map((st) => st.id));
      const validTargetIds = decodeStyleIds.length > 0 ? decodeStyleIds : allStyleIds;

      if (validTargetIds.length > 0 && !validTargetIds.includes(currentSpeakerId)) {
        // 波音リツ (6000 または 3065) や先頭の合成可能スタイルを選択
        const preferred = validTargetIds.includes(6000)
          ? 6000
          : validTargetIds.includes(3065)
          ? 3065
          : validTargetIds[0];
        vocalSettingsManager.updateSettings({ voicevoxSpeakerId: preferred });
      }

      return { ok: true, singers: this.singers };
    } catch (err: any) {
      this.isConnected = false;
      const isTimeout = err?.name === 'AbortError';
      const errMsg = isTimeout
        ? 'VOICEVOX サーバーへの接続がタイムアウト（15秒）しました。Google Colab 等のリモートサーバーやローカルの VOICEVOX が起動完了しているか、URLが正しいか確認してください。'
        : 'VOICEVOX サーバーに接続できませんでした。①ローカルPCの場合は VOICEVOX が起動しており「設定 → オプション → CORS Policy Mode」が「all」になっていること、②Google Colab 等のリモートサーバーの場合は公開URL（https://...）が有効で CORS が許可（--cors_policy_mode all）されていることを確認してください。';
      this.lastError = errMsg;
      return {
        ok: false,
        singers: [],
        error: errMsg,
      };
    }
  }

  /**
   * ノート配列からキャッシュキーを生成
   */
  private buildCacheKey(notes: VoicevoxNoteInput[], speakerId: number): string {
    const body = notes
      .map((n) => `${n.midiNote}:${n.startSec.toFixed(3)}-${n.endSec.toFixed(3)}:${n.lyric}`)
      .join('|');
    return `spk${speakerId}__${body}`;
  }

  /**
   * 指定したボーカルノート配列の合成結果がすでにキャッシュされているか判定する
   */
  public hasCachedTrackVocal(vocalNotes: VoicevoxNoteInput[], speakerId?: number): boolean {
    if (vocalNotes.length === 0) return true;
    const settings = vocalSettingsManager.getSettings();
    const targetSpeaker = speakerId ?? settings.voicevoxSpeakerId ?? 6000;
    const sorted = [...vocalNotes].sort((a, b) => a.startSec - b.startSec);
    const cacheKey = this.buildCacheKey(sorted, targetSpeaker);
    return this.clipCache.has(cacheKey);
  }

  /**
   * キャッシュ済みの歌声クリップがあれば同期的に取得する
   */
  public getCachedTrackVocal(
    vocalNotes: VoicevoxNoteInput[],
    speakerId?: number
  ): RenderedVocalClip | undefined {
    if (vocalNotes.length === 0) return undefined;
    const settings = vocalSettingsManager.getSettings();
    const targetSpeaker = speakerId ?? settings.voicevoxSpeakerId ?? 6000;
    const sorted = [...vocalNotes].sort((a, b) => a.startSec - b.startSec);
    const cacheKey = this.buildCacheKey(sorted, targetSpeaker);
    return this.clipCache.get(cacheKey);
  }

  /**
   * 連続するノート列を、休符または最大音符数（14音）ごとのフレーズチャンクに分割する
   * （長尺曲を1リクエストで送るとColabやVOICEVOX Engineで推論エラーやタイムアウトになるのを防ぐ）
   */
  private splitNotesIntoChunks(sortedNotes: VoicevoxNoteInput[]): VoicevoxNoteInput[][] {
    if (sortedNotes.length <= MAX_NOTES_PER_CHUNK) {
      return [sortedNotes];
    }

    const chunks: VoicevoxNoteInput[][] = [];
    let currentChunk: VoicevoxNoteInput[] = [];

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      currentChunk.push(note);

      const nextNote = i + 1 < sortedNotes.length ? sortedNotes[i + 1] : null;
      if (!nextNote) break;

      const gapToNext = nextNote.startSec - note.endSec;
      const noteDur = note.endSec - note.startSec;

      // 1. 0.25秒以上の明確な休符があり、すでに4音以上溜まっている場合はここでフレーズ分割
      if (gapToNext >= 0.25 && currentChunk.length >= 4) {
        chunks.push(currentChunk);
        currentChunk = [];
        continue;
      }

      // 2. チャンクが8音以上で、長めの音符（2分音符相当 >= 0.75秒）が来た場合はフレーズの区切りとして分割
      if (currentChunk.length >= 8 && noteDur >= 0.75) {
        chunks.push(currentChunk);
        currentChunk = [];
        continue;
      }

      // 3. 最大音符数に達した場合は分割
      if (currentChunk.length >= MAX_NOTES_PER_CHUNK) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * 1フレーズチャンク分のノート配列を VOICEVOX API で合成し AudioBuffer を返す
   */
  private async synthesizeChunk(
    ctx: BaseAudioContext,
    chunkNotes: VoicevoxNoteInput[],
    baseUrl: string,
    targetSpeaker: number,
    initialPrevVowel: VowelType
  ): Promise<{ clip: RenderedVocalClip | null; lastVowel: VowelType; error?: string }> {
    interface VvScoreNote {
      key: number | null;
      frame_length: number;
      lyric: string;
    }

    const vvNotesKata: VvScoreNote[] = [];
    const vvNotesHira: VvScoreNote[] = [];

    // 1. 先頭休符 (VOICEVOX必須仕様: 15フレーム)
    vvNotesKata.push({ key: null, frame_length: INITIAL_REST_FRAMES, lyric: '' });
    vvNotesHira.push({ key: null, frame_length: INITIAL_REST_FRAMES, lyric: '' });

    const firstNoteStartSec = chunkNotes[0].startSec;
    let prevVowel = initialPrevVowel;
    let accumulatedFrames = 0;

    for (let i = 0; i < chunkNotes.length; i++) {
      const item = chunkNotes[i];
      const nextItem = i + 1 < chunkNotes.length ? chunkNotes[i + 1] : null;

      // 現在のノートの理想開始フレーム位置 (firstNoteStartSec からの相対フレーム)
      const idealStartFrame = Math.round((item.startSec - firstNoteStartSec) * VOICEVOX_FPS);
      const gapFrames = idealStartFrame - accumulatedFrames;

      // 0.16秒 (15フレーム) 以上の明確な休符がある場合のみ無音休符ノートを挿入
      // (数フレームの極小休符を入れるとVOICEVOXの音素長計算で400エラーになるため)
      if (gapFrames >= 15) {
        vvNotesKata.push({ key: null, frame_length: gapFrames, lyric: '' });
        vvNotesHira.push({ key: null, frame_length: gapFrames, lyric: '' });
        accumulatedFrames += gapFrames;
      } else if (gapFrames > 0 && vvNotesKata.length > 1) {
        // 15フレーム未満の微小な隙間は、直前の音符を伸ばしてレガートに繋げる
        vvNotesKata[vvNotesKata.length - 1].frame_length += gapFrames;
        vvNotesHira[vvNotesHira.length - 1].frame_length += gapFrames;
        accumulatedFrames += gapFrames;
      }

      // 次のノートとの間に明確な休符（0.16秒以上）がない場合は、次のノートの開始時刻まで音長を繋げてブツ切れを防ぐ
      let effectiveEndSec = item.endSec;
      if (nextItem) {
        const gapToNextSec = nextItem.startSec - item.endSec;
        if (gapToNextSec > 0 && gapToNextSec < 0.16) {
          effectiveEndSec = nextItem.startSec;
        } else {
          effectiveEndSec = Math.min(item.endSec, nextItem.startSec);
        }
      }

      const idealEndFrame = Math.round((effectiveEndSec - firstNoteStartSec) * VOICEVOX_FPS);
      // VOICEVOX で子音+母音を安定して配置できるよう最低10フレーム以上を確保
      const noteFrames = Math.max(10, idealEndFrame - accumulatedFrames);

      const phoneme = parseLyricToPhoneme(item.lyric, prevVowel);
      prevVowel = phoneme.vowel;

      const midiKey = Math.max(28, Math.min(100, item.midiNote));
      vvNotesKata.push({
        key: midiKey,
        frame_length: noteFrames,
        lyric: phoneme.katakana || 'ア',
      });
      vvNotesHira.push({
        key: midiKey,
        frame_length: noteFrames,
        lyric: phoneme.hiragana || 'あ',
      });

      accumulatedFrames += noteFrames;
    }

    // 末尾休符 (VOICEVOX必須仕様: 15フレーム)
    vvNotesKata.push({ key: null, frame_length: 15, lyric: '' });
    vvNotesHira.push({ key: null, frame_length: 15, lyric: '' });

    // クエリ作成用の speaker ID 候補リスト (6000 や singing_teacher / sing スタイルを優先)
    const querySpeakerCandidates = Array.from(
      new Set([6000, ...this.teacherSpeakerIds, targetSpeaker])
    );

    let frameAudioQuery: any = null;
    let lastQueryErrText = '';

    // Step 1: /sing_frame_audio_query の実行 (カタカナで試行し、万一失敗時はひらがなでも試行)
    outerLoop: for (const payload of [{ notes: vvNotesKata }, { notes: vvNotesHira }]) {
      for (const qSpeaker of querySpeakerCandidates) {
        try {
          const qRes = await fetch(
            `${baseUrl}/sing_frame_audio_query?speaker=${qSpeaker}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
          if (qRes.ok) {
            frameAudioQuery = await qRes.json();
            break outerLoop;
          } else {
            const errTxt = await qRes.text().catch(() => '');
            lastQueryErrText = `HTTP ${qRes.status}: ${errTxt.slice(0, 120)}`;
          }
        } catch (e: any) {
          lastQueryErrText = e?.message || 'Network Error';
        }
      }
    }

    if (!frameAudioQuery) {
      return {
        clip: null,
        lastVowel: prevVowel,
        error: `歌唱クエリ作成(/sing_frame_audio_query)に失敗しました (${lastQueryErrText})`,
      };
    }

    // Step 2: /frame_synthesis の実行
    // targetSpeaker で試行し、もし targetSpeaker が singing_teacher 専用ID等で失敗した場合は
    // 同一シンガーまたは全体の frame_decode / sing スタイルIDでフォールバック試行
    const decodeFallbackIds: number[] = [targetSpeaker];
    this.singers.forEach((s) => {
      const hasTarget = s.styles.some((st) => st.id === targetSpeaker);
      if (hasTarget) {
        s.styles.forEach((st) => {
          if (!decodeFallbackIds.includes(st.id)) decodeFallbackIds.push(st.id);
        });
      }
    });
    this.singers.forEach((s) => {
      s.styles.forEach((st) => {
        if (
          (st.type === 'frame_decode' || st.type === 'sing' || !st.type) &&
          !decodeFallbackIds.includes(st.id)
        ) {
          decodeFallbackIds.push(st.id);
        }
      });
    });
    if (!decodeFallbackIds.includes(6000)) {
      decodeFallbackIds.push(6000);
    }

    let wavArrayBuffer: ArrayBuffer | null = null;
    let lastSynthErrText = '';

    for (const synthSpeaker of decodeFallbackIds) {
      try {
        const sRes = await fetch(
          `${baseUrl}/frame_synthesis?speaker=${synthSpeaker}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(frameAudioQuery),
          }
        );
        if (sRes.ok) {
          wavArrayBuffer = await sRes.arrayBuffer();
          break;
        } else {
          const errTxt = await sRes.text().catch(() => '');
          lastSynthErrText = `HTTP ${sRes.status} (speaker=${synthSpeaker}): ${errTxt.slice(0, 120)}`;
        }
      } catch (e: any) {
        lastSynthErrText = e?.message || 'Network Error';
      }
    }

    if (!wavArrayBuffer) {
      return {
        clip: null,
        lastVowel: prevVowel,
        error: `歌声波形合成(/frame_synthesis)に失敗しました (${lastSynthErrText})`,
      };
    }

    try {
      // decodeAudioData でバッファが detach されても安全なように slice(0) を渡す
      const audioBuffer = await ctx.decodeAudioData(wavArrayBuffer.slice(0));
      const initialRestSec = INITIAL_REST_FRAMES / VOICEVOX_FPS;
      const startOffsetSec = firstNoteStartSec - initialRestSec;

      return {
        clip: {
          audioBuffer,
          startOffsetSec,
        },
        lastVowel: prevVowel,
      };
    } catch (e: any) {
      return {
        clip: null,
        lastVowel: prevVowel,
        error: `WAV音声データのデコードに失敗しました (${e?.message || 'decodeAudioData error'})`,
      };
    }
  }

  /**
   * 複数のフレーズチャンクの RenderedVocalClip を1本の連続した AudioBuffer に結合する
   */
  private mergeVocalClips(
    ctx: BaseAudioContext,
    clips: RenderedVocalClip[]
  ): RenderedVocalClip | null {
    if (clips.length === 0) return null;
    if (clips.length === 1) return clips[0];

    const sampleRate = clips[0].audioBuffer.sampleRate;
    const minStartSec = Math.min(...clips.map((c) => c.startOffsetSec));
    const maxEndSec = Math.max(
      ...clips.map((c) => c.startOffsetSec + c.audioBuffer.duration)
    );
    const totalDurationSec = Math.max(0.1, maxEndSec - minStartSec);
    const totalSamples = Math.ceil(totalDurationSec * sampleRate);

    const mergedBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const outData = mergedBuffer.getChannelData(0);

    for (const clip of clips) {
      const offsetSamples = Math.max(
        0,
        Math.round((clip.startOffsetSec - minStartSec) * sampleRate)
      );
      const srcData = clip.audioBuffer.getChannelData(0);
      const len = Math.min(srcData.length, totalSamples - offsetSamples);
      for (let i = 0; i < len; i++) {
        // チャンク境界でのクリップノイズを防ぎつつ加算合成
        outData[offsetSamples + i] = Math.max(
          -1,
          Math.min(1, outData[offsetSamples + i] + srcData[i])
        );
      }
    }

    return {
      audioBuffer: mergedBuffer,
      startOffsetSec: minStartSec,
    };
  }

  /**
   * トラックの歌詞付きノート群から VOICEVOX Song API で歌声 AudioBuffer を合成する
   */
  public async synthesizeTrackVocal(
    ctx: BaseAudioContext,
    vocalNotes: VoicevoxNoteInput[],
    speakerId?: number
  ): Promise<RenderedVocalClip | null> {
    if (vocalNotes.length === 0) return null;

    const settings = vocalSettingsManager.getSettings();
    const targetSpeaker = speakerId ?? settings.voicevoxSpeakerId ?? 6000;
    const baseUrl = settings.voicevoxUrl.replace(/\/+$/, '');

    const sorted = [...vocalNotes].sort((a, b) => a.startSec - b.startSec);
    const cacheKey = this.buildCacheKey(sorted, targetSpeaker);
    if (this.clipCache.has(cacheKey)) {
      return this.clipCache.get(cacheKey)!;
    }

    this.lastError = null;

    // まだ一度も /singers を取得していない場合は先に接続確認してスタイルID一覧を把握する
    if (this.singers.length === 0) {
      await this.checkConnection(baseUrl);
    }

    const chunks = this.splitNotesIntoChunks(sorted);
    const renderedClips: RenderedVocalClip[] = [];
    let prevVowel: VowelType = 'a';

    for (const chunk of chunks) {
      const { clip, lastVowel, error } = await this.synthesizeChunk(
        ctx,
        chunk,
        baseUrl,
        targetSpeaker,
        prevVowel
      );
      prevVowel = lastVowel;

      if (!clip) {
        this.lastError = error || 'VOICEVOX 歌声合成中にエラーが発生しました';
        console.warn('VOICEVOX chunk synthesis failed:', this.lastError);
        return null;
      }
      renderedClips.push(clip);
    }

    const finalClip = this.mergeVocalClips(ctx, renderedClips);
    if (finalClip) {
      this.clipCache.set(cacheKey, finalClip);
      this.isConnected = true;
    }
    return finalClip;
  }
}

export const voicevoxClient = new VoicevoxClient();
