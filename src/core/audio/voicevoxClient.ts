import { parseLyricToPhoneme, VowelType } from './vocalPhonemes';
import { vocalSettingsManager } from './vocalSynth';

export interface VoicevoxSingerStyle {
  id: number;
  name: string;
  type?: string;
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

class VoicevoxClient {
  private isConnected = false;
  private singers: VoicevoxSinger[] = [];
  private clipCache = new Map<string, RenderedVocalClip>();

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getSingers(): VoicevoxSinger[] {
    return this.singers;
  }

  public clearCache() {
    this.clipCache.clear();
  }

  /**
   * VOICEVOX ローカルサーバーへの疎通確認とシンガー一覧取得
   */
  public async checkConnection(customUrl?: string): Promise<{
    ok: boolean;
    singers: VoicevoxSinger[];
    error?: string;
  }> {
    const baseUrl = (customUrl || vocalSettingsManager.getSettings().voicevoxUrl).replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${baseUrl}/singers`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.isConnected = false;
        return {
          ok: false,
          singers: [],
          error: `VOICEVOX からエラー応答が返されました (HTTP ${res.status})`,
        };
      }

      const data: VoicevoxSinger[] = await res.json();
      this.singers = Array.isArray(data) ? data : [];
      this.isConnected = true;

      // 現在の speakerId が一覧に存在しない場合は先頭の有効なスタイルIDをセット
      const currentSpeakerId = vocalSettingsManager.getSettings().voicevoxSpeakerId;
      const allStyleIds = this.singers.flatMap((s) => s.styles.map((st) => st.id));
      if (allStyleIds.length > 0 && !allStyleIds.includes(currentSpeakerId)) {
        // 6000 (波音リツ) があれば優先、なければ先頭
        const preferred = allStyleIds.includes(6000) ? 6000 : allStyleIds[0];
        vocalSettingsManager.updateSettings({ voicevoxSpeakerId: preferred });
      }

      return { ok: true, singers: this.singers };
    } catch (err: any) {
      this.isConnected = false;
      return {
        ok: false,
        singers: [],
        error:
          'VOICEVOX に接続できませんでした。PCで VOICEVOX が起動していること、および VOICEVOX の「設定 → オプション → CORS Policy Mode」が「all」になっていることを確認してください。',
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

    // VOICEVOX Score JSON の構築
    interface VvScoreNote {
      key: number | null;
      frame_length: number;
      lyric: string;
    }

    const vvNotes: VvScoreNote[] = [];

    // 1. 先頭休符 (VOICEVOX必須仕様)
    vvNotes.push({
      key: null,
      frame_length: INITIAL_REST_FRAMES,
      lyric: '',
    });

    const firstNoteStartSec = sorted[0].startSec;
    let cursorSec = firstNoteStartSec;
    let prevVowel: VowelType = 'a';

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const nextStartSec = i + 1 < sorted.length ? sorted[i + 1].startSec : null;

      // 前の音との間に隙間があれば休符フレームを挿入
      const gapSec = item.startSec - cursorSec;
      if (gapSec > 0.03) {
        const restFrames = Math.max(2, Math.round(gapSec * VOICEVOX_FPS));
        vvNotes.push({
          key: null,
          frame_length: restFrames,
          lyric: '',
        });
        cursorSec += restFrames / VOICEVOX_FPS;
      }

      // 次の音とオーバーラップしないように長さを調整
      const effectiveEndSec =
        nextStartSec !== null ? Math.min(item.endSec, nextStartSec) : item.endSec;
      const durSec = Math.max(0.05, effectiveEndSec - item.startSec);
      const noteFrames = Math.max(3, Math.round(durSec * VOICEVOX_FPS));

      const phoneme = parseLyricToPhoneme(item.lyric, prevVowel);
      prevVowel = phoneme.vowel;

      vvNotes.push({
        key: Math.max(24, Math.min(108, item.midiNote)),
        frame_length: noteFrames,
        lyric: phoneme.katakana || 'ア',
      });

      cursorSec = item.startSec + noteFrames / VOICEVOX_FPS;
    }

    // 末尾休符 (VOICEVOX必須仕様)
    vvNotes.push({
      key: null,
      frame_length: 15,
      lyric: '',
    });

    const scorePayload = { notes: vvNotes };

    try {
      // Step 1: /sing_frame_audio_query (まず targetSpeaker で試行し、失敗時は標準クエリ用 speaker=6000 で再試行)
      let queryRes = await fetch(
        `${baseUrl}/sing_frame_audio_query?speaker=${targetSpeaker}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scorePayload),
        }
      );

      if (!queryRes.ok && targetSpeaker !== 6000) {
        queryRes = await fetch(`${baseUrl}/sing_frame_audio_query?speaker=6000`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scorePayload),
        });
      }

      if (!queryRes.ok) {
        console.warn('VOICEVOX sing_frame_audio_query failed:', queryRes.status);
        return null;
      }

      const frameAudioQuery = await queryRes.json();

      // Step 2: /frame_synthesis で WAV バイナリを生成
      const synthRes = await fetch(
        `${baseUrl}/frame_synthesis?speaker=${targetSpeaker}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(frameAudioQuery),
        }
      );

      if (!synthRes.ok) {
        console.warn('VOICEVOX frame_synthesis failed:', synthRes.status);
        return null;
      }

      const wavArrayBuffer = await synthRes.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(wavArrayBuffer);

      // 先頭に入れた INITIAL_REST_FRAMES 分の時間を差し引いた位置が、このAudioBufferの再生開始基準時刻
      const initialRestSec = INITIAL_REST_FRAMES / VOICEVOX_FPS;
      const startOffsetSec = firstNoteStartSec - initialRestSec;

      const clip: RenderedVocalClip = {
        audioBuffer,
        startOffsetSec,
      };
      this.clipCache.set(cacheKey, clip);
      this.isConnected = true;
      return clip;
    } catch (err) {
      console.warn('VOICEVOX synthesis error, falling back to built-in formant synth:', err);
      return null;
    }
  }
}

export const voicevoxClient = new VoicevoxClient();
