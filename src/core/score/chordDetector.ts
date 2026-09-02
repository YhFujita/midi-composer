import { NoteEvent } from '../../types/mml';
import { pitchToMidi } from '../../utils/noteConverter';

export const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_PITCH_CLASS_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

// 代表的なコード定義（ルートからの半音程の集合）
export interface ChordDefinition {
  name: string;
  intervals: number[]; // 0から始まる半音程リスト
  priority: number;   // 照合優先度（高いほど優先）
  minPitches?: number; // 最小構成音数
}

export const CHORD_DEFINITIONS: ChordDefinition[] = [
  // 4和音・テンション
  { name: 'maj7', intervals: [0, 4, 7, 11], priority: 95 },
  { name: '7', intervals: [0, 4, 7, 10], priority: 95 },
  { name: 'm7', intervals: [0, 3, 7, 10], priority: 95 },
  { name: 'mM7', intervals: [0, 3, 7, 11], priority: 95 },
  { name: 'm7b5', intervals: [0, 3, 6, 10], priority: 95 },
  { name: 'dim7', intervals: [0, 3, 6, 9], priority: 95 },
  { name: '7sus4', intervals: [0, 5, 7, 10], priority: 95 },
  { name: 'add9', intervals: [0, 2, 4, 7], priority: 90 },
  { name: '6', intervals: [0, 4, 7, 9], priority: 90 },
  { name: 'm6', intervals: [0, 3, 7, 9], priority: 90 },

  // 3和音
  { name: '', intervals: [0, 4, 7], priority: 80 },      // Major
  { name: 'm', intervals: [0, 3, 7], priority: 80 },     // minor
  { name: 'dim', intervals: [0, 3, 6], priority: 80 },
  { name: 'aug', intervals: [0, 4, 8], priority: 80 },
  { name: 'sus4', intervals: [0, 5, 7], priority: 80 },
  { name: 'sus2', intervals: [0, 2, 7], priority: 75 },

  // 5度省略形 (omit5)
  { name: '7(omit5)', intervals: [0, 4, 10], priority: 70 },
  { name: 'maj7(omit5)', intervals: [0, 4, 11], priority: 70 },
  { name: 'm7(omit5)', intervals: [0, 3, 10], priority: 70 },
  { name: '', intervals: [0, 4], priority: 60, minPitches: 2 },  // 3度のみ
  { name: 'm', intervals: [0, 3], priority: 60, minPitches: 2 },

  // パワーコード (omit3)
  { name: '5', intervals: [0, 7], priority: 65, minPitches: 2 },
];

export interface DetectedChord {
  chordName: string;      // 例: "C", "Am7", "G7/B"
  root: string;           // 例: "C"
  chordType: string;      // 例: "", "m7", "7"
  bass?: string;          // オンコード時のベース音 (例: "B")
  confidence: number;     // 一致度 (0.0 - 1.0)
  pitchClasses: number[]; // 構成音のピッチクラス一覧
}

export type ChordDetectionGranularity = 'measure' | 'two-beats' | 'beat' | 'auto';

/**
 * 音名またはMIDI番号からピッチクラス (0〜11: C=0, C#=1... B=11) を取得
 */
export function getPitchClass(pitchOrMidi: string | number): number {
  if (typeof pitchOrMidi === 'number') {
    return ((pitchOrMidi % 12) + 12) % 12;
  }
  const midi = pitchToMidi(pitchOrMidi);
  return ((midi % 12) + 12) % 12;
}

/**
 * ピッチクラス番号を音名文字列に変換
 */
export function pitchClassToName(pc: number, useFlat = false): string {
  const norm = ((pc % 12) + 12) % 12;
  return useFlat ? FLAT_PITCH_CLASS_NAMES[norm] : PITCH_CLASS_NAMES[norm];
}

/**
 * 与えられたピッチ群（音名またはNoteEvent配列）からコードを推定する
 */
export function detectChordFromPitches(
  pitches: (string | NoteEvent)[],
  preferFlat = false
): DetectedChord | null {
  if (!pitches || pitches.length === 0) return null;

  // MIDIノート番号とピッチクラスを抽出
  const midiList: number[] = [];
  const pitchClassSet = new Set<number>();

  pitches.forEach((p) => {
    let midi: number;
    if (typeof p === 'string') {
      midi = pitchToMidi(p);
    } else {
      midi = p.midiNote || pitchToMidi(p.pitch);
    }
    midiList.push(midi);
    pitchClassSet.add(((midi % 12) + 12) % 12);
  });

  if (pitchClassSet.size === 0) return null;

  // 単音の場合
  if (pitchClassSet.size === 1) {
    const pc = Array.from(pitchClassSet)[0];
    const rootName = pitchClassToName(pc, preferFlat);
    return {
      chordName: rootName,
      root: rootName,
      chordType: '',
      confidence: 0.5,
      pitchClasses: [pc],
    };
  }

  // 最低音（ベース音）を判定
  const lowestMidi = Math.min(...midiList);
  const bassPc = ((lowestMidi % 12) + 12) % 12;
  const bassName = pitchClassToName(bassPc, preferFlat);

  const pcArray = Array.from(pitchClassSet);

  let bestMatch: DetectedChord | null = null;
  let bestScore = -1;

  // 各ピッチクラスをルート候補として全コード定義と照合
  // ベース音をルート候補として最優先で評価
  const candidateRoots = [bassPc, ...pcArray.filter((pc) => pc !== bassPc)];

  for (const rootPc of candidateRoots) {
    const rootName = pitchClassToName(rootPc, preferFlat);

    // ルートからの半音インターバル集合を計算
    const relativeIntervals = pcArray.map((pc) => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
    const relSet = new Set(relativeIntervals);

    for (const def of CHORD_DEFINITIONS) {
      if (def.minPitches && pcArray.length < def.minPitches) continue;

      const defSet = new Set(def.intervals);
      let matchCount = 0;
      let penalty = 0;

      // 定義に含まれる音と何音一致しているか
      def.intervals.forEach((interval) => {
        if (relSet.has(interval)) matchCount++;
      });

      // 入力された音のうち、定義に含まれない余剰音のペナルティ
      relSet.forEach((interval) => {
        if (!defSet.has(interval)) {
          penalty += 0.5;
        }
      });

      // 適合度スコア算出
      const coverage = matchCount / def.intervals.length;
      if (coverage < 0.65) continue; // 構成音の過半数が一致していなければ除外

      let score = coverage * def.priority - penalty * 10;
      // ベース音がルートと一致していればボーナス
      if (rootPc === bassPc) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        const isSlash = rootPc !== bassPc;
        const cleanType = def.name.replace(/\(omit5\)/, '');
        const chordName = `${rootName}${cleanType}${isSlash ? `/${bassName}` : ''}`;

        bestMatch = {
          chordName,
          root: rootName,
          chordType: cleanType,
          bass: isSlash ? bassName : undefined,
          confidence: Math.min(1.0, Math.max(0.1, score / 100)),
          pitchClasses: pcArray,
        };
      }
    }
  }

  return bestMatch;
}

export interface MeasureChordInfo {
  beatOffset: number; // 小節内の拍位置 (0.0, 1.0, 2.0 ...)
  chord: DetectedChord;
}

/**
 * 1小節分の音符リストから、指定された粒度に基づいてコードネーム一覧を自動検出する
 */
export function detectChordsForMeasure(
  notes: NoteEvent[],
  measureIndex: number,
  beatsPerMeasure = 4,
  granularity: ChordDetectionGranularity = 'auto',
  preferFlat = false
): MeasureChordInfo[] {
  if (!notes || notes.length === 0) return [];

  const measureStartBeat = measureIndex * beatsPerMeasure;
  const measureEndBeat = measureStartBeat + beatsPerMeasure;

  // 小節内に存在する音符のみを対象
  const measureNotes = notes.filter(
    (n) => n.startTime < measureEndBeat && n.startTime + n.duration > measureStartBeat
  );

  if (measureNotes.length === 0) return [];

  const results: MeasureChordInfo[] = [];

  if (granularity === 'measure') {
    // 小節頭（または最初の音）のタイミングのコードを1つ抽出
    const chord = detectChordFromPitches(measureNotes, preferFlat);
    if (chord) {
      results.push({ beatOffset: 0, chord });
    }
  } else if (granularity === 'two-beats') {
    // 2拍ごと (4拍子の場合は 0拍目 と 2拍目)
    const halfBeat = beatsPerMeasure >= 4 ? beatsPerMeasure / 2 : beatsPerMeasure;
    for (let beat = 0; beat < beatsPerMeasure; beat += halfBeat) {
      const activeNotes = getNotesActiveAt(measureNotes, measureStartBeat + beat, 1.0);
      if (activeNotes.length > 0) {
        const chord = detectChordFromPitches(activeNotes, preferFlat);
        if (chord) {
          results.push({ beatOffset: beat, chord });
        }
      }
    }
  } else if (granularity === 'beat') {
    // 毎拍
    for (let beat = 0; beat < beatsPerMeasure; beat += 1.0) {
      const activeNotes = getNotesActiveAt(measureNotes, measureStartBeat + beat, 0.5);
      if (activeNotes.length > 0) {
        const chord = detectChordFromPitches(activeNotes, preferFlat);
        if (chord) {
          // 直前のコードと同一でなければ追加
          const prev = results[results.length - 1];
          if (!prev || prev.chord.chordName !== chord.chordName) {
            results.push({ beatOffset: beat, chord });
          }
        }
      }
    }
  } else {
    // 'auto': 発音タイミングごとにグループ化し、コード変化を追従
    const timeMap = new Map<number, NoteEvent[]>();
    measureNotes.forEach((n) => {
      // 0.25拍単位にクオンタイズして同一拍の和音としてまとめる
      const relBeat = Math.max(0, Math.round((n.startTime - measureStartBeat) * 4) / 4);
      if (relBeat < beatsPerMeasure) {
        if (!timeMap.has(relBeat)) timeMap.set(relBeat, []);
        timeMap.get(relBeat)!.push(n);
      }
    });

    const sortedBeats = Array.from(timeMap.keys()).sort((a, b) => a - b);
    let lastChordName = '';

    for (const b of sortedBeats) {
      const notesAtBeat = timeMap.get(b)!;
      // 単音だけでなくその時点で鳴っている音も含めて判定
      const activeNotes = getNotesActiveAt(measureNotes, measureStartBeat + b, 0.25);
      const targetNotes = activeNotes.length > notesAtBeat.length ? activeNotes : notesAtBeat;

      const chord = detectChordFromPitches(targetNotes, preferFlat);
      if (chord && chord.chordName !== lastChordName && chord.confidence >= 0.4) {
        results.push({ beatOffset: b, chord });
        lastChordName = chord.chordName;
      }
    }

    // もし変化点でコードが抽出されなかった場合は小節全体でフォールバック
    if (results.length === 0) {
      const fallbackChord = detectChordFromPitches(measureNotes, preferFlat);
      if (fallbackChord) {
        results.push({ beatOffset: 0, chord: fallbackChord });
      }
    }
  }

  return results;
}

/**
 * 特定の拍（絶対時間）において鳴っている（発音中または直近の）音符を抽出
 */
function getNotesActiveAt(notes: NoteEvent[], targetBeat: number, tolerance = 0.5): NoteEvent[] {
  return notes.filter((n) => {
    const start = n.startTime;
    const end = n.startTime + n.duration;
    // ターゲット拍で発音中、またはターゲット拍の直近（tolerance内）で開始されるノート
    return (start <= targetBeat && targetBeat < end) || Math.abs(start - targetBeat) < tolerance;
  });
}

/**
 * 代表的なコード構成音定義テーブル（ルートC基準の音名一覧）
 */
export const COMMON_CHORD_TYPES: { type: string; label: string; nameJa: string; intervals: number[] }[] = [
  { type: '', label: 'Major', nameJa: 'メジャー', intervals: [0, 4, 7] },
  { type: 'm', label: 'minor', nameJa: 'マイナー', intervals: [0, 3, 7] },
  { type: '7', label: '7 (Dominant)', nameJa: 'セブンス', intervals: [0, 4, 7, 10] },
  { type: 'maj7', label: 'maj7 (Major 7th)', nameJa: 'メジャーセブンス', intervals: [0, 4, 7, 11] },
  { type: 'm7', label: 'm7 (Minor 7th)', nameJa: 'マイナーセブンス', intervals: [0, 3, 7, 10] },
  { type: 'sus4', label: 'sus4', nameJa: 'サスフォー', intervals: [0, 5, 7] },
  { type: 'dim', label: 'dim', nameJa: 'ディミニッシュ', intervals: [0, 3, 6] },
  { type: 'aug', label: 'aug', nameJa: 'オーグメント', intervals: [0, 4, 8] },
  { type: 'm7b5', label: 'm7(b5)', nameJa: 'ハーフディミニッシュ', intervals: [0, 3, 6, 10] },
  { type: 'add9', label: 'add9', nameJa: 'アドナインス', intervals: [0, 2, 4, 7] },
  { type: '6', label: '6th', nameJa: 'シックス', intervals: [0, 4, 7, 9] },
  { type: '5', label: '5 (Power)', nameJa: 'パワーコード', intervals: [0, 7] },
];

/**
 * コードのMML文字列（例: "[ceg]4" や "[e4g4>c<]2"）を生成するユーティリティ
 */
export function buildChordMml(
  root: string,
  chordType: string,
  durationStr = '4',
  inversion = 0, // 0: 基本形, 1: 第1展開形, 2: 第2展開形, 3: 第3展開形
  bass?: string
): string {
  const rootPc = getPitchClass(`${root}4`);
  const typeDef = COMMON_CHORD_TYPES.find((d) => d.type === chordType) || COMMON_CHORD_TYPES[0];

  let intervals = [...typeDef.intervals];

  // 転回形処理
  if (inversion > 0 && intervals.length > 1) {
    const invCount = inversion % intervals.length;
    for (let i = 0; i < invCount; i++) {
      const lowest = intervals.shift()!;
      intervals.push(lowest + 12);
    }
  }

  // 和音内の音名を組み立て
  const noteStrs: string[] = [];
  let curOctOffset = 0;

  // オンコードのベース音（ルートと異なる場合）
  if (bass && bass !== root) {
    const bassPc = getPitchClass(`${bass}3`);
    const bassName = pitchClassToName(bassPc).toLowerCase();
    noteStrs.push('<' + bassName + '>');
  }

  intervals.forEach((interval) => {
    const pitchVal = rootPc + interval;
    const pc = pitchVal % 12;
    const octOffset = Math.floor(pitchVal / 12);
    const noteName = pitchClassToName(pc).toLowerCase();

    const diff = octOffset - curOctOffset;
    if (diff > 0) {
      noteStrs.push('>'.repeat(diff));
    } else if (diff < 0) {
      noteStrs.push('<'.repeat(-diff));
    }
    curOctOffset = octOffset;
    noteStrs.push(noteName);
  });

  // 和音の終端でオクターブオフセットを元の高さに戻す
  if (curOctOffset > 0) {
    noteStrs.push('<'.repeat(curOctOffset));
  } else if (curOctOffset < 0) {
    noteStrs.push('>'.repeat(-curOctOffset));
  }

  return `[${noteStrs.join('')}]${durationStr}`;
}
