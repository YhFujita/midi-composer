import { midiToFreq } from '../../utils/noteConverter';
import { parseLyricToPhoneme, VowelType, ConsonantType } from './vocalPhonemes';

export type VocalCharacterType = 'idol' | 'soft' | 'male' | 'retro';

export type VocalEngineMode = 'auto' | 'formant' | 'voicevox';

export interface VocalSettings {
  /** 歌声エンジンモード ('auto': VOICEVOX接続時はVOICEVOX、未接続時は内蔵フォルマント, 'formant': 内蔵のみ, 'voicevox': VOICEVOX優先) */
  engineMode: VocalEngineMode;
  /** 内蔵フォルマントシンセのキャラクター（声質） */
  character: VocalCharacterType;
  /** 歌詞が付いた音符は楽器番号に関わらずすべて自動で歌わせるか (true 推奨) */
  singAllLyricNotes: boolean;
  /** 日本語の助詞「は→わ」「へ→え」を文脈に応じて自動発音変換するか (true 推奨) */
  autoConvertParticlePronunciation: boolean;
  /** ビブラートの深さ (0.0 〜 2.0, デフォルト 1.0) */
  vibratoDepth: number;
  /** 歌声のマスター音量 (0.0 〜 2.0, デフォルト 1.2) */
  vocalVolume: number;
  /** 歌声発音時に元の楽器音（SoundFont）も薄くユニゾンで重ねるか (0.0 〜 1.0, デフォルト 0.25) */
  accompanimentLayerGain: number;
  /** VOICEVOX ローカルサーバーのエンドポイントURL */
  voicevoxUrl: string;
  /** 選択中の VOICEVOX シンガー（スタイル）ID */
  voicevoxSpeakerId: number;
}

export const DEFAULT_VOCAL_SETTINGS: VocalSettings = {
  engineMode: 'auto',
  character: 'idol',
  singAllLyricNotes: true,
  autoConvertParticlePronunciation: true,
  vibratoDepth: 1.0,
  vocalVolume: 1.25,
  accompanimentLayerGain: 0.2,
  voicevoxUrl: 'http://127.0.0.1:50021',
  voicevoxSpeakerId: 6000, // 波音リツ (ノーマル) 等の標準歌唱スタイルID
};

const STORAGE_KEY = 'midi_composer_vocal_settings';

type Listener = (settings: VocalSettings) => void;

class VocalSettingsManager {
  private settings: VocalSettings;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.settings = this.load();
  }

  private load(): VocalSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_VOCAL_SETTINGS };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_VOCAL_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_VOCAL_SETTINGS };
  }

  public getSettings(): VocalSettings {
    return this.settings;
  }

  public updateSettings(partial: Partial<VocalSettings>) {
    this.settings = { ...this.settings, ...partial };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // ignore
      }
    }
    this.listeners.forEach((l) => l(this.settings));
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const vocalSettingsManager = new VocalSettingsManager();

/**
 * 母音ごとの基準フォルマント周波数 (F1, F2, F3, F4) と各バンドのQ値・相対ゲイン
 * 日本語の明瞭な女声（ボカロ標準）をベースにチューニング
 */
interface FormantSpec {
  f1: number;
  f2: number;
  f3: number;
  f4: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  g1: number;
  g2: number;
  g3: number;
  g4: number;
}

const VOWEL_FORMANTS: Record<VowelType, FormantSpec> = {
  a: {
    f1: 840, f2: 1340, f3: 2880, f4: 3900,
    q1: 5.5, q2: 6.5, q3: 8.0, q4: 9.0,
    g1: 1.0, g2: 0.80, g3: 0.38, g4: 0.22,
  },
  i: {
    f1: 310, f2: 2520, f3: 3200, f4: 4050,
    q1: 5.0, q2: 7.5, q3: 8.5, q4: 9.5,
    g1: 1.0, g2: 0.78, g3: 0.42, g4: 0.25,
  },
  u: {
    f1: 360, f2: 1180, f3: 2680, f4: 3750,
    q1: 5.0, q2: 6.5, q3: 8.0, q4: 9.0,
    g1: 1.0, g2: 0.58, g3: 0.30, g4: 0.16,
  },
  e: {
    f1: 530, f2: 2080, f3: 2850, f4: 3900,
    q1: 5.5, q2: 7.0, q3: 8.0, q4: 9.0,
    g1: 1.0, g2: 0.80, g3: 0.38, g4: 0.22,
  },
  o: {
    f1: 500, f2: 880, f3: 2720, f4: 3700,
    q1: 5.5, q2: 6.0, q3: 8.0, q4: 9.0,
    g1: 1.0, g2: 0.72, g3: 0.32, g4: 0.16,
  },
  n: {
    f1: 270, f2: 980, f3: 2300, f4: 3500,
    q1: 4.5, q2: 6.0, q3: 8.0, q4: 9.0,
    g1: 1.0, g2: 0.38, g3: 0.16, g4: 0.08,
  },
};

/**
 * 子音・半母音の開始フォルマント（Locus Frequency: 母音へ遷移する直前の口の形）
 */
function getConsonantStartFormants(
  consonant: ConsonantType,
  target: FormantSpec,
  hasGlideY?: boolean,
  hasGlideW?: boolean
): { f1: number; f2: number; glideSec: number } {
  // 拗音 (きゃ, しゃ, ちゃ, にゃ, や, ゆ, よ 等): /i/ のフォルマントから目標母音へ滑らかに遷移
  if (hasGlideY || consonant === 'y') {
    return { f1: 300, f2: 2480, glideSec: 0.055 };
  }
  // 合拗音 (わ, うぃ, ふぁ 等): /u/ のフォルマントから目標母音へ遷移
  if (hasGlideW || consonant === 'w') {
    return { f1: 340, f2: 820, glideSec: 0.055 };
  }

  switch (consonant) {
    case 'm':
    case 'b':
    case 'p':
    case 'f':
      // 両唇音: F1・F2 ともに低い状態から開く
      return { f1: 260, f2: 780, glideSec: 0.042 };
    case 'n':
    case 'd':
    case 't':
    case 's':
    case 'z':
    case 'ts':
      // 歯茎音: F1 は低く、F2 は 1700Hz 付近から遷移
      return { f1: 290, f2: 1720, glideSec: 0.038 };
    case 'r':
      // 弾き音 (ら行): F1=320Hz, F2=1550Hz から素早く遷移
      return { f1: 320, f2: 1550, glideSec: 0.036 };
    case 'sh':
    case 'ch':
    case 'j':
      // 歯茎硬口蓋音: /i/ に近い高い F2 から遷移
      return { f1: 300, f2: 2250, glideSec: 0.045 };
    case 'k':
    case 'g':
      // 軟口蓋音: F2 が目標母音の少し上から収束
      return { f1: 320, f2: Math.min(2600, target.f2 * 1.18), glideSec: 0.038 };
    default:
      return { f1: target.f1, f2: target.f2, glideSec: 0.01 };
  }
}

/**
 * 無声・摩擦・破擦子音のアタックノイズ（さ行・た行・か行・は行など）を生成・スケジュールする
 */
function scheduleConsonantNoise(
  ctx: BaseAudioContext,
  consonant: ConsonantType,
  vowelTargetF2: number,
  startAudioTime: number,
  velGain: number,
  destination: AudioNode,
  activeNodes: { stop?: (t: number) => void; disconnect?: () => void }[]
): number {
  if (!consonant) return 0;

  let noiseDur = 0;
  let filterType: BiquadFilterType = 'bandpass';
  let filterFreq = 3000;
  let filterQ = 1.5;
  let noiseAmp = 0;

  switch (consonant) {
    case 's':
      noiseDur = 0.048;
      filterType = 'highpass';
      filterFreq = 5800;
      filterQ = 1.0;
      noiseAmp = 0.36;
      break;
    case 'sh':
      noiseDur = 0.052;
      filterType = 'bandpass';
      filterFreq = 3300;
      filterQ = 1.8;
      noiseAmp = 0.38;
      break;
    case 'ts':
      noiseDur = 0.040;
      filterType = 'highpass';
      filterFreq = 5200;
      filterQ = 1.4;
      noiseAmp = 0.42;
      break;
    case 'ch':
      noiseDur = 0.042;
      filterType = 'bandpass';
      filterFreq = 3500;
      filterQ = 2.0;
      noiseAmp = 0.42;
      break;
    case 'k':
      noiseDur = 0.024;
      filterType = 'bandpass';
      filterFreq = Math.max(1200, Math.min(3000, vowelTargetF2 * 1.1));
      filterQ = 2.5;
      noiseAmp = 0.38;
      break;
    case 't':
      noiseDur = 0.022;
      filterType = 'highpass';
      filterFreq = 3800;
      filterQ = 1.5;
      noiseAmp = 0.36;
      break;
    case 'p':
      noiseDur = 0.020;
      filterType = 'bandpass';
      filterFreq = 950;
      filterQ = 1.8;
      noiseAmp = 0.35;
      break;
    case 'h':
      noiseDur = 0.045;
      filterType = 'bandpass';
      filterFreq = vowelTargetF2;
      filterQ = 1.5;
      noiseAmp = 0.26;
      break;
    case 'f':
      noiseDur = 0.046;
      filterType = 'bandpass';
      filterFreq = 2800;
      filterQ = 1.2;
      noiseAmp = 0.28;
      break;
    case 'z':
    case 'j':
      noiseDur = 0.032;
      filterType = 'bandpass';
      filterFreq = consonant === 'j' ? 3200 : 4800;
      filterQ = 1.6;
      noiseAmp = 0.22;
      break;
    default:
      return 0;
  }

  const bufferSize = Math.max(64, Math.floor(ctx.sampleRate * noiseDur));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, startAudioTime);
  filter.Q.setValueAtTime(filterQ, startAudioTime);

  const gain = ctx.createGain();
  const peak = velGain * noiseAmp;
  gain.gain.setValueAtTime(0.001, startAudioTime);
  gain.gain.linearRampToValueAtTime(peak, startAudioTime + Math.min(0.008, noiseDur * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.001, startAudioTime + noiseDur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  noise.start(startAudioTime);
  activeNodes.push(noise, filter, gain);

  // 母音の声帯発音をわずかに遅らせるオフセット秒数（無声子音のクリアな発音のため）
  if (['s', 'sh', 'ts', 'ch', 'k', 't', 'p', 'f', 'h'].includes(consonant)) {
    return Math.min(0.026, noiseDur * 0.55);
  }
  return 0;
}

/**
 * Web Audio API によるフォルマント歌声合成（1音符分のスケジューリング）
 * リアルタイム再生 (AudioContext) と MP3書き出し (OfflineAudioContext) の両方で完全動作します。
 */
export function scheduleFormantVocalNote(
  ctx: BaseAudioContext,
  midiNote: number,
  lyric: string,
  prevVowel: VowelType,
  startAudioTime: number,
  durationSec: number,
  velocity: number,
  masterGain: GainNode,
  settings: VocalSettings = vocalSettingsManager.getSettings(),
  isTiedOrSlurredFromPrev = false
): { stop: (time: number) => void; vowel: VowelType } {
  const phoneme = parseLyricToPhoneme(lyric, prevVowel);
  const vowel = phoneme.vowel;
  const baseSpec = VOWEL_FORMANTS[vowel] || VOWEL_FORMANTS.a;

  // キャラクターに応じたフォルマントスケール・波形パラメータ
  let formantScale = 1.0;
  let mainOscType: OscillatorType = 'sawtooth';
  let subOscType: OscillatorType = 'sawtooth';
  let bodyOscGain = 0.28; // 基音補強 (triangle)
  let breathAmount = 0.025;
  let qScale = 1.0;

  switch (settings.character) {
    case 'idol':
      formantScale = 1.05; // 明るく華やかなボカロ女声
      mainOscType = 'sawtooth';
      subOscType = 'sawtooth';
      bodyOscGain = 0.30;
      breathAmount = 0.02;
      qScale = 1.0;
      break;
    case 'soft':
      formantScale = 1.01; // 柔らかく息遣いのあるウィスパー女声
      mainOscType = 'sawtooth';
      subOscType = 'triangle';
      bodyOscGain = 0.42;
      breathAmount = 0.055;
      qScale = 0.85;
      break;
    case 'male':
      formantScale = 0.84; // 男声・青年ボーカル
      mainOscType = 'sawtooth';
      subOscType = 'sawtooth';
      bodyOscGain = 0.32;
      breathAmount = 0.02;
      qScale = 0.95;
      break;
    case 'retro':
      formantScale = 1.08; // ピコピコ・チップボーカル
      mainOscType = 'square';
      subOscType = 'sawtooth';
      bodyOscGain = 0.15;
      breathAmount = 0.0;
      qScale = 1.25;
      break;
  }

  const freq = midiToFreq(midiNote);
  const velNorm = Math.max(0.05, Math.min(1.0, (velocity || 100) / 127));
  const vocalMasterAmp = velNorm * (settings.vocalVolume ?? 1.25) * 0.72;

  const activeNodes: { stop?: (t: number) => void; disconnect?: () => void }[] = [];

  // 促音（っ）が含まれる場合は後半を少し短く切る
  const effectiveDurSec = phoneme.isStaccatoMora
    ? Math.max(0.05, durationSec * 0.68)
    : Math.max(0.04, durationSec);

  // 1. 子音ノイズの生成（長音やスラー継続でない場合）
  let voiceOnsetDelay = 0;
  if (!phoneme.isLongVowel && !isTiedOrSlurredFromPrev && phoneme.consonant) {
    voiceOnsetDelay = scheduleConsonantNoise(
      ctx,
      phoneme.consonant,
      baseSpec.f2 * formantScale,
      startAudioTime,
      vocalMasterAmp,
      masterGain,
      activeNodes
    );
  }

  const voiceStart = Math.max(0, startAudioTime + voiceOnsetDelay);
  const releaseSec = phoneme.isStaccatoMora ? 0.03 : 0.08;
  const noteReleaseStart = Math.max(voiceStart + 0.045, startAudioTime + effectiveDurSec);
  const stopTime = noteReleaseStart + releaseSec;

  // 2. 声帯オシレータ群（メインノコギリ波 ＋ デチューンコーラス波 ＋ 基音補強三角波）
  const oscMain = ctx.createOscillator();
  const oscSub = ctx.createOscillator();
  const oscBody = ctx.createOscillator();

  oscMain.type = mainOscType;
  oscSub.type = subOscType;
  oscBody.type = 'triangle';

  // わずかなデチューンでボカロ特有の透明感・コーラス感を付与
  oscSub.detune.setValueAtTime(5.5, voiceStart);

  // 歌い出しの自然なピッチしゃくり (Scoop)
  const useScoop = !isTiedOrSlurredFromPrev && !phoneme.isLongVowel && effectiveDurSec >= 0.12;
  const startFreq = useScoop ? freq * 0.972 : freq;
  const scoopEnd = voiceStart + 0.032;

  [oscMain, oscSub, oscBody].forEach((osc) => {
    osc.frequency.setValueAtTime(startFreq, voiceStart);
    if (useScoop) {
      osc.frequency.exponentialRampToValueAtTime(freq, scoopEnd);
    }
  });

  // 3. ビブラート (LFO)
  const vibDepthSetting = settings.vibratoDepth ?? 1.0;
  if (effectiveDurSec >= 0.32 && vibDepthSetting > 0.01) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.6, voiceStart); // 5.6Hz の自然なビブラート周期

    const maxVibHz = freq * 0.012 * vibDepthSetting; // 約 ±20セント
    const vibDelay = Math.min(0.22, effectiveDurSec * 0.35);
    const vibFadeIn = Math.min(0.45, effectiveDurSec * 0.75);

    lfoGain.gain.setValueAtTime(0, voiceStart);
    lfoGain.gain.setValueAtTime(0, voiceStart + vibDelay);
    lfoGain.gain.linearRampToValueAtTime(maxVibHz, voiceStart + vibFadeIn);

    lfo.connect(lfoGain);
    lfoGain.connect(oscMain.frequency);
    lfoGain.connect(oscSub.frequency);
    lfoGain.connect(oscBody.frequency);

    lfo.start(voiceStart);
    lfo.stop(stopTime);
    activeNodes.push(lfo, lfoGain);
  }

  // オシレータミキサー & 声門スペクトル傾斜フィルタ (Glottal Roll-off)
  const glottalMix = ctx.createGain();
  const subMixGain = ctx.createGain();
  const bodyMixGain = ctx.createGain();

  glottalMix.gain.setValueAtTime(0.55, voiceStart);
  subMixGain.gain.setValueAtTime(0.35, voiceStart);
  bodyMixGain.gain.setValueAtTime(bodyOscGain, voiceStart);

  const glottalRollOff = ctx.createBiquadFilter();
  glottalRollOff.type = 'lowpass';
  glottalRollOff.frequency.setValueAtTime(4600, voiceStart);
  glottalRollOff.Q.setValueAtTime(0.7, voiceStart);

  oscMain.connect(glottalMix);
  oscSub.connect(subMixGain);
  subMixGain.connect(glottalMix);
  oscBody.connect(bodyMixGain);
  bodyMixGain.connect(glottalMix);

  // ブレス（息）成分のミキシング
  if (breathAmount > 0.001) {
    const breathLen = Math.min(2.0, effectiveDurSec + 0.1);
    const bSize = Math.max(64, Math.floor(ctx.sampleRate * breathLen));
    const bBuf = ctx.createBuffer(1, bSize, ctx.sampleRate);
    const bData = bBuf.getChannelData(0);
    for (let i = 0; i < bSize; i++) bData[i] = Math.random() * 2 - 1;
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = bBuf;
    breathSrc.loop = true;
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(breathAmount, voiceStart);
    breathSrc.connect(breathGain);
    breathGain.connect(glottalMix);
    breathSrc.start(voiceStart);
    breathSrc.stop(stopTime);
    activeNodes.push(breathSrc, breathGain);
  }

  glottalMix.connect(glottalRollOff);

  // 4. 4並列フォルマントフィルタバンク (F1, F2, F3, F4) + 基音の明瞭度パス
  const targetF1 = baseSpec.f1 * formantScale;
  const targetF2 = baseSpec.f2 * formantScale;
  const targetF3 = baseSpec.f3 * formantScale;
  const targetF4 = baseSpec.f4 * formantScale;

  const { f1: startF1, f2: startF2, glideSec } = getConsonantStartFormants(
    phoneme.consonant,
    { ...baseSpec, f1: targetF1, f2: targetF2 },
    phoneme.hasGlideY,
    phoneme.hasGlideW
  );

  const formantSum = ctx.createGain();
  formantSum.gain.setValueAtTime(1.0, voiceStart);

  const formants = [
    { startF: startF1, targetF: targetF1, q: baseSpec.q1 * qScale, g: baseSpec.g1 },
    { startF: startF2, targetF: targetF2, q: baseSpec.q2 * qScale, g: baseSpec.g2 },
    { startF: targetF3, targetF: targetF3, q: baseSpec.q3 * qScale, g: baseSpec.g3 },
    { startF: targetF4, targetF: targetF4, q: baseSpec.q4 * qScale, g: baseSpec.g4 },
  ];

  formants.forEach((fm) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(fm.q, voiceStart);

    if (!phoneme.isLongVowel && Math.abs(fm.startF - fm.targetF) > 10) {
      bp.frequency.setValueAtTime(Math.max(80, fm.startF), voiceStart);
      bp.frequency.exponentialRampToValueAtTime(
        Math.max(80, fm.targetF),
        voiceStart + glideSec
      );
    } else {
      bp.frequency.setValueAtTime(Math.max(80, fm.targetF), voiceStart);
    }

    const fg = ctx.createGain();
    fg.gain.setValueAtTime(fm.g * 1.65, voiceStart);

    glottalRollOff.connect(bp);
    bp.connect(fg);
    fg.connect(formantSum);
    activeNodes.push(bp, fg);
  });

  // 低域・基音の芯（Fundamental Presence）を少しブレンドして音程感をくっきりさせる
  const fundamentalLp = ctx.createBiquadFilter();
  fundamentalLp.type = 'lowpass';
  fundamentalLp.frequency.setValueAtTime(Math.max(350, freq * 1.4), voiceStart);
  const fundamentalGain = ctx.createGain();
  fundamentalGain.gain.setValueAtTime(0.32, voiceStart);
  oscBody.connect(fundamentalLp);
  fundamentalLp.connect(fundamentalGain);
  fundamentalGain.connect(formantSum);

  // 5. 音量エンベロープ (ADSR: 時刻が必ず単調増加になるよう厳密に保護)
  const noteEnvelope = ctx.createGain();
  const isTapR = phoneme.consonant === 'r' && !phoneme.isLongVowel && effectiveDurSec >= 0.08;
  const attackTime = isTapR ? 0.034 : isTiedOrSlurredFromPrev ? 0.008 : 0.018;
  const decayTime = 0.06;
  const sustainLevel = 0.88;

  const attackEnd = Math.min(noteReleaseStart - 0.005, voiceStart + attackTime);
  const sustainStart = Math.max(attackEnd + 0.002, Math.min(noteReleaseStart - 0.002, attackEnd + decayTime));

  noteEnvelope.gain.setValueAtTime(0.0001, voiceStart);
  // ら行 ('r') の場合は舌の弾きを再現するため一瞬の軽いディップを入れる
  if (isTapR && attackEnd >= voiceStart + 0.034) {
    noteEnvelope.gain.linearRampToValueAtTime(Math.max(0.001, vocalMasterAmp * 0.45), voiceStart + 0.01);
    noteEnvelope.gain.linearRampToValueAtTime(Math.max(0.001, vocalMasterAmp * 0.25), voiceStart + 0.018);
    noteEnvelope.gain.linearRampToValueAtTime(Math.max(0.001, vocalMasterAmp), voiceStart + 0.034);
  } else {
    noteEnvelope.gain.linearRampToValueAtTime(Math.max(0.001, vocalMasterAmp), Math.max(voiceStart + 0.005, attackEnd));
  }

  noteEnvelope.gain.exponentialRampToValueAtTime(
    Math.max(0.001, vocalMasterAmp * sustainLevel),
    sustainStart
  );
  noteEnvelope.gain.setValueAtTime(
    Math.max(0.001, vocalMasterAmp * sustainLevel),
    Math.max(sustainStart + 0.001, noteReleaseStart)
  );
  noteEnvelope.gain.exponentialRampToValueAtTime(0.00001, stopTime);

  formantSum.connect(noteEnvelope);
  noteEnvelope.connect(masterGain);

  oscMain.start(voiceStart);
  oscSub.start(voiceStart);
  oscBody.start(voiceStart);

  oscMain.stop(stopTime);
  oscSub.stop(stopTime);
  oscBody.stop(stopTime);

  activeNodes.push(
    oscMain,
    oscSub,
    oscBody,
    glottalMix,
    subMixGain,
    bodyMixGain,
    glottalRollOff,
    formantSum,
    fundamentalLp,
    fundamentalGain,
    noteEnvelope
  );

  return {
    vowel,
    stop: (time: number) => {
      activeNodes.forEach((node) => {
        try {
          if (node.stop) node.stop(time);
          if (node.disconnect) node.disconnect();
        } catch {
          // ignore
        }
      });
    },
  };
}
