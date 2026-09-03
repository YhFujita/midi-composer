import {
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Dot,
  Accidental,
  Beam,
  Renderer,
  StaveConnector,
  Stroke,
  Annotation,
  StaveTie,
  Curve,
  CurvePosition,
  Tuplet,
} from 'vexflow';
import { ParsedScore, Track, NoteEvent, PedalEvent } from '../../types/mml';
import { getInstrumentByProgram } from '../../constants/instruments';
import { getTripletInfo } from '../../utils/noteConverter';

import { detectChordsForMeasure, ChordDetectionGranularity } from './chordDetector';

export type PartNameDisplayMode = 'abbr' | 'abbrJa' | 'multilineJa' | 'trackOnly';

export interface ScoreDisplayOptions {
  showTitle: boolean;          // 楽譜タイトルを表示するか
  showSubInfo?: boolean;       // タイトル下の詳細情報 (パート数・テンポ・拍子・小節数等) を表示するか
  showTempo: boolean;          // テンポ指示 (♩=120) を表示するか
  showTimeSignature: boolean;  // 拍子記号 (4/4 等) を表示するか
  showTrackDetails: boolean;   // パート別の個別指示(テンポ/拍子等)を表示するか
  customTitle?: string;        // ユーザー指定のカスタムタイトル
  showChords: boolean;         // コードネームを表示するか
  chordGranularity: ChordDetectionGranularity; // 'measure' | 'two-beats' | 'beat' | 'auto'
  chordTrackSource: 'all' | 'selected';       // 総譜時のコード解析対象
  showTiesAndSlurs?: boolean;  // タイ・スラーの記号を描画するか
}

export const DEFAULT_DISPLAY_OPTIONS: ScoreDisplayOptions = {
  showTitle: true,
  showSubInfo: true,
  showTempo: true,
  showTimeSignature: true,
  showTrackDetails: true,
  showChords: true,
  chordGranularity: 'auto',
  chordTrackSource: 'all',
  showTiesAndSlurs: true,
};

/**
 * 音名文字列 ("C4", "F#5", "Bb3") を VexFlow 形式 ("c/4", "f#/5", "bb/3") に変換
 */
export function pitchToVexKey(pitch: string): { key: string; accidental?: string } {
  const match = pitch.trim().match(/^([A-Ga-g])([#\+\-_b]?)(-?\d+)$/);
  if (!match) return { key: 'c/4' };

  const note = match[1].toLowerCase();
  let acc = match[2];
  if (acc === '+') acc = '#';
  if (acc === '-' || acc === '_') acc = 'b';
  const oct = match[3];

  const key = `${note}${acc ? acc : ''}/${oct}`;
  return { key, accidental: acc || undefined };
}

/**
 * 4分音符基準の長さ (duration) を VexFlow の音長コード ('w', 'h', 'q', '8', '16', '32') と付点有無に変換
 */
export function durationToVexDuration(dur: number): { duration: string; isDotted: boolean } {
  // 3連符などの連符長を優先判定
  const trip = getTripletInfo(dur);
  if (trip) {
    const vexCode = trip.vexDuration === '4' ? 'q' : (trip.vexDuration === '2' ? 'h' : trip.vexDuration);
    return { duration: vexCode, isDotted: false };
  }

  const eps = 0.05;

  if (Math.abs(dur - 6.0) < eps) return { duration: 'wd', isDotted: true };
  if (Math.abs(dur - 4.0) < eps) return { duration: 'w', isDotted: false };
  if (Math.abs(dur - 3.0) < eps) return { duration: 'hd', isDotted: true };
  if (Math.abs(dur - 2.0) < eps) return { duration: 'h', isDotted: false };
  if (Math.abs(dur - 1.5) < eps) return { duration: 'qd', isDotted: true };
  if (Math.abs(dur - 1.0) < eps) return { duration: 'q', isDotted: false };
  if (Math.abs(dur - 0.75) < eps) return { duration: '8d', isDotted: true };
  if (Math.abs(dur - 0.5) < eps) return { duration: '8', isDotted: false };
  if (Math.abs(dur - 0.375) < eps) return { duration: '16d', isDotted: true };
  if (Math.abs(dur - 0.25) < eps) return { duration: '16', isDotted: false };
  if (Math.abs(dur - 0.125) < eps) return { duration: '32', isDotted: false };

  // 最も近い標準長さにフォールバック
  if (dur >= 3.0) return { duration: 'w', isDotted: false };
  if (dur >= 1.5) return { duration: 'h', isDotted: false };
  if (dur >= 0.75) return { duration: 'q', isDotted: false };
  if (dur >= 0.35) return { duration: '8', isDotted: false };
  return { duration: '16', isDotted: false };
}

export interface MeasureNoteGroup {
  measureIndex: number;
  notes: NoteEvent[];
}

/**
 * 楽譜を小節（Measure）ごとに分割する
 */
export function groupNotesByMeasure(
  track: Track,
  beatsPerMeasure: number = 4
): MeasureNoteGroup[] {
  const measuresMap = new Map<number, NoteEvent[]>();

  track.notes.forEach((note) => {
    const measureIdx = Math.floor(note.startTime / beatsPerMeasure);
    if (!measuresMap.has(measureIdx)) {
      measuresMap.set(measureIdx, []);
    }
    measuresMap.get(measureIdx)!.push(note);
  });

  const maxMeasure = Math.max(0, ...Array.from(measuresMap.keys()));
  const groups: MeasureNoteGroup[] = [];

  for (let i = 0; i <= maxMeasure; i++) {
    groups.push({
      measureIndex: i,
      notes: (measuresMap.get(i) || []).sort((a, b) => a.startTime - b.startTime),
    });
  }

  return groups;
}

export interface VexMeasureItem {
  staveNote: StaveNote;
  noteEvents: NoteEvent[];
  isRest: boolean;
}

export interface VexMeasureOutput {
  notes: StaveNote[];
  items: VexMeasureItem[];
  tuplets: Tuplet[];
}

/**
 * 1小節分の音符リストから VexFlow の StaveNote 配列およびマッピング情報を生成
 */
function createVexNotesForMeasure(
  notes: NoteEvent[],
  measureIndex: number,
  beatsPerMeasure: number,
  clef: string,
  pedalEvents?: PedalEvent[]
): VexMeasureOutput {
  const vexNotes: StaveNote[] = [];
  const items: VexMeasureItem[] = [];
  const measureStartBeat = measureIndex * beatsPerMeasure;
  let currentBeatInMeasure = 0;

  // 音符がない場合は小節全休符を挿入
  if (!notes || notes.length === 0) {
    const { duration: rDur, isDotted: rDot } = durationToVexDuration(beatsPerMeasure);
    const restNote = new StaveNote({
      clef,
      keys: [clef === 'bass' ? 'd/3' : 'b/4'],
      duration: `${rDur.replace('d', '')}r`,
    });
    if (rDot) {
      Dot.buildAndAttach([restNote], { all: true });
    }
    items.push({ staveNote: restNote, noteEvents: [], isRest: true });
    return { notes: [restNote], items, tuplets: [] };
  }

  // 同じ startTime の音符を和音としてまとめる
  const notesByTime = new Map<number, NoteEvent[]>();
  notes.forEach((n) => {
    const relTime = Math.round((n.startTime - measureStartBeat) * 1000) / 1000;
    if (!notesByTime.has(relTime)) {
      notesByTime.set(relTime, []);
    }
    notesByTime.get(relTime)!.push(n);
  });

  const sortedTimes = Array.from(notesByTime.keys()).sort((a, b) => a - b);

  for (const t of sortedTimes) {
    // 直前に空白があれば休符を挿入
    const gap = t - currentBeatInMeasure;
    if (gap > 0.08) {
      const { duration: rDur, isDotted: rDot } = durationToVexDuration(gap);
      const restNote = new StaveNote({
        clef,
        keys: [clef === 'bass' ? 'd/3' : 'b/4'],
        duration: `${rDur.replace('d', '')}r`,
      });
      if (rDot) {
        Dot.buildAndAttach([restNote], { all: true });
      }

      // 休符のタイミングにペダルOFFがあれば ✱ を付与
      if (pedalEvents && pedalEvents.length > 0) {
        const hasPedalOff = pedalEvents.some(
          (p) => p.type === 'off' && Math.abs(p.time - (measureStartBeat + currentBeatInMeasure)) < 0.05
        );
        if (hasPedalOff) {
          try {
            const relAnn = new Annotation('✱').setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
            restNote.addModifier(relAnn, 0);
          } catch {
            // ignore
          }
        }
      }

      vexNotes.push(restNote);
      items.push({ staveNote: restNote, noteEvents: [], isRest: true });
      currentBeatInMeasure += gap;
    }

    const noteGroup = notesByTime.get(t)!;
    const firstNote = noteGroup[0];
    const { duration: vDur, isDotted } = durationToVexDuration(firstNote.duration);

    const keys: string[] = [];
    const accidentals: { index: number; acc: string }[] = [];

    noteGroup.forEach((n, kIdx) => {
      const { key, accidental } = pitchToVexKey(n.pitch);
      keys.push(key);
      if (accidental) {
        accidentals.push({ index: kIdx, acc: accidental });
      }
    });

    try {
      const staveNote = new StaveNote({
        clef,
        keys,
        duration: vDur.replace('d', ''),
      });

      if (isDotted) {
        Dot.buildAndAttach([staveNote], { all: true });
      }

      accidentals.forEach(({ index, acc }) => {
        staveNote.addModifier(new Accidental(acc), index);
      });

      // バラシ (ギターストローク・アルペジオ) 波線記号の付与
      if (noteGroup.some((n) => n.isStrum)) {
        const strumNote = noteGroup.find((n) => n.isStrum);
        const strokeType =
          strumNote?.strumDirection === 'up'
            ? Stroke.Type.ROLL_UP
            : Stroke.Type.ROLL_DOWN;
        staveNote.addStroke(0, new Stroke(strokeType));
      }

      // ペダル記号 (Ped. / ✱) の付与
      if (pedalEvents && pedalEvents.length > 0) {
        const noteAbsoluteStart = measureStartBeat + t;
        const noteAbsoluteEnd = noteAbsoluteStart + firstNote.duration;

        const hasPedalOn = pedalEvents.some(
          (p) => p.type === 'on' && Math.abs(p.time - noteAbsoluteStart) < 0.05
        );
        const hasPedalOff = pedalEvents.some(
          (p) => p.type === 'off' && Math.abs(p.time - noteAbsoluteStart) < 0.05
        );
        const hasPedalOffAtEnd = pedalEvents.some(
          (p) => p.type === 'off' && Math.abs(p.time - noteAbsoluteEnd) < 0.05
        );

        if (hasPedalOn) {
          const pedAnn = new Annotation('Ped.').setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
          staveNote.addModifier(pedAnn, 0);
        } else if (hasPedalOff || hasPedalOffAtEnd) {
          const relAnn = new Annotation('✱').setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
          staveNote.addModifier(relAnn, 0);
        }
      }

      vexNotes.push(staveNote);
      items.push({ staveNote, noteEvents: noteGroup, isRest: false });
    } catch {
      const fallbackRest = new StaveNote({
        clef,
        keys: [clef === 'bass' ? 'd/3' : 'b/4'],
        duration: 'qr',
      });
      vexNotes.push(fallbackRest);
      items.push({ staveNote: fallbackRest, noteEvents: [], isRest: true });
    }

    currentBeatInMeasure = t + firstNote.duration;
  }

  // 小節末尾の残り時間を休符で埋める
  const remaining = beatsPerMeasure - currentBeatInMeasure;
  if (remaining > 0.08) {
    const { duration: rDur, isDotted: rDot } = durationToVexDuration(remaining);
    const restNote = new StaveNote({
      clef,
      keys: [clef === 'bass' ? 'd/3' : 'b/4'],
      duration: `${rDur.replace('d', '')}r`,
    });
    if (rDot) {
      Dot.buildAndAttach([restNote], { all: true });
    }
    vexNotes.push(restNote);
    items.push({ staveNote: restNote, noteEvents: [], isRest: true });
  }

  // 3連符・連符 (Tuplet) の検出と生成
  const tuplets: Tuplet[] = [];

  // 1. tupletGroupId を持つ明示的連符のグループ化
  const explicitTupletGroups = new Map<number, StaveNote[]>();
  const explicitTupletConfig = new Map<number, { numNotes: number; notesOccupied: number }>();
  items.forEach((it) => {
    if (!it.isRest && it.noteEvents.length > 0) {
      const firstEv = it.noteEvents[0];
      if (firstEv.tupletGroupId !== undefined) {
        if (!explicitTupletGroups.has(firstEv.tupletGroupId)) {
          explicitTupletGroups.set(firstEv.tupletGroupId, []);
          explicitTupletConfig.set(firstEv.tupletGroupId, {
            numNotes: firstEv.tupletNumber || 3,
            notesOccupied: firstEv.tupletOccupied || 2,
          });
        }
        explicitTupletGroups.get(firstEv.tupletGroupId)!.push(it.staveNote);
      }
    }
  });

  explicitTupletGroups.forEach((staveNotes, gId) => {
    if (staveNotes.length >= 2) {
      const cfg = explicitTupletConfig.get(gId)!;
      try {
        const tuplet = new Tuplet(staveNotes, {
          numNotes: cfg.numNotes,
          notesOccupied: cfg.notesOccupied,
          location: Tuplet.LOCATION_TOP,
        });
        tuplets.push(tuplet);
      } catch {
        // ignore
      }
    }
  });

  // 2. 音長直接指定 (c12, c6 等) による3連符のグループ化 (tupletGroupId を持たないもの)
  let consecutiveTriplets: StaveNote[] = [];
  let currentTripDuration: number | null = null;

  items.forEach((it) => {
    if (!it.isRest && it.noteEvents.length > 0) {
      const ev = it.noteEvents[0];
      if (ev.tupletGroupId === undefined) {
        const trip = getTripletInfo(ev.duration);
        if (trip) {
          if (currentTripDuration !== null && Math.abs(currentTripDuration - ev.duration) < 0.02) {
            consecutiveTriplets.push(it.staveNote);
          } else {
            if (consecutiveTriplets.length === 3) {
              try {
                tuplets.push(
                  new Tuplet(consecutiveTriplets, {
                    numNotes: 3,
                    notesOccupied: 2,
                    location: Tuplet.LOCATION_TOP,
                  })
                );
              } catch {}
            }
            consecutiveTriplets = [it.staveNote];
            currentTripDuration = ev.duration;
          }

          if (consecutiveTriplets.length === 3) {
            try {
              tuplets.push(
                new Tuplet(consecutiveTriplets, {
                  numNotes: 3,
                  notesOccupied: 2,
                  location: Tuplet.LOCATION_TOP,
                })
              );
            } catch {}
            consecutiveTriplets = [];
            currentTripDuration = null;
          }
          return;
        }
      }
    }

    if (consecutiveTriplets.length === 3) {
      try {
        tuplets.push(
          new Tuplet(consecutiveTriplets, {
            numNotes: 3,
            notesOccupied: 2,
            location: Tuplet.LOCATION_TOP,
          })
        );
      } catch {}
    }
    consecutiveTriplets = [];
    currentTripDuration = null;
  });

  if (consecutiveTriplets.length === 3) {
    try {
      tuplets.push(
        new Tuplet(consecutiveTriplets, {
          numNotes: 3,
          notesOccupied: 2,
          location: Tuplet.LOCATION_TOP,
        })
      );
    } catch {}
  }

  return { notes: vexNotes, items, tuplets };
}

/**
 * 1小節内のタイ（Tie）およびスラー（Slur）記号を描画する
 */
function renderTiesAndSlursForMeasure(ctx: any, items: VexMeasureItem[]) {
  // 1. タイ（同一音高の連結）の描画
  items.forEach((item, itemIdx) => {
    if (item.isRest || !item.noteEvents || item.noteEvents.length === 0) return;

    item.noteEvents.forEach((ne, kIdx) => {
      // 次の音符へ繋がるタイ
      if (ne.hasTieToNext) {
        // 同一小節内の次の音符を探す
        let nextItem: VexMeasureItem | undefined;
        let nextKeyIdx = 0;
        for (let j = itemIdx + 1; j < items.length; j++) {
          const candidate = items[j];
          if (candidate.isRest) continue;
          const matchIdx = candidate.noteEvents.findIndex(
            (cn) => cn.hasTieFromPrev && cn.midiNote === ne.midiNote
          );
          if (matchIdx !== -1) {
            nextItem = candidate;
            nextKeyIdx = matchIdx;
            break;
          }
        }

        if (nextItem) {
          // 同一小節内タイ
          try {
            const tie = new StaveTie({
              firstNote: item.staveNote,
              lastNote: nextItem.staveNote,
              firstIndexes: [kIdx],
              lastIndexes: [nextKeyIdx],
            });
            tie.setContext(ctx).draw();
          } catch {
            // ignore
          }
        } else {
          // 小節跨ぎタイ（次小節へ向かうタイ）
          try {
            const tie = new StaveTie({
              firstNote: item.staveNote,
              lastNote: null,
              firstIndexes: [kIdx],
            });
            tie.setContext(ctx).draw();
          } catch {
            // ignore
          }
        }
      }

      // 前の小節から受けるタイ（同一小節内に先行音がない場合）
      if (ne.hasTieFromPrev) {
        let hasPrevInMeasure = false;
        for (let j = 0; j < itemIdx; j++) {
          const candidate = items[j];
          if (!candidate.isRest && candidate.noteEvents.some((pn) => pn.hasTieToNext && pn.midiNote === ne.midiNote)) {
            hasPrevInMeasure = true;
            break;
          }
        }
        if (!hasPrevInMeasure) {
          try {
            const tie = new StaveTie({
              firstNote: null,
              lastNote: item.staveNote,
              lastIndexes: [kIdx],
            });
            tie.setContext(ctx).draw();
          } catch {
            // ignore
          }
        }
      }
    });
  });

  // 2. スラー（レガート曲線）の描画
  const slurGroups = new Map<number, VexMeasureItem[]>();
  items.forEach((item) => {
    if (item.isRest || !item.noteEvents || item.noteEvents.length === 0) return;
    const sId = item.noteEvents[0].slurGroupId;
    if (sId !== undefined) {
      if (!slurGroups.has(sId)) {
        slurGroups.set(sId, []);
      }
      slurGroups.get(sId)!.push(item);
    }
  });

  slurGroups.forEach((groupItems) => {
    if (groupItems.length >= 2) {
      const first = groupItems[0];
      const last = groupItems[groupItems.length - 1];
      try {
        const curve = new Curve(first.staveNote, last.staveNote, {
          position: CurvePosition.NEAR_TOP,
          thickness: 1.8,
        });
        curve.setContext(ctx).draw();
      } catch {
        try {
          const tie = new StaveTie({
            firstNote: first.staveNote,
            lastNote: last.staveNote,
            firstIndexes: [0],
            lastIndexes: [0],
          });
          tie.setContext(ctx).draw();
        } catch {
          // ignore
        }
      }
    } else if (groupItems.length === 1) {
      // 1小節に1音のみのスラー端点（小節跨ぎスラー）
      const single = groupItems[0];
      const isStart = single.noteEvents.some((n) => n.isSlurStart);
      const isEnd = single.noteEvents.some((n) => n.isSlurEnd);
      if (isStart) {
        try {
          const tie = new StaveTie({
            firstNote: single.staveNote,
            lastNote: null,
            firstIndexes: [0],
          });
          tie.setContext(ctx).draw();
        } catch {
          // ignore
        }
      } else if (isEnd) {
        try {
          const tie = new StaveTie({
            firstNote: null,
            lastNote: single.staveNote,
            lastIndexes: [0],
          });
          tie.setContext(ctx).draw();
        } catch {
          // ignore
        }
      }
    }
  });
}

/** トラックの平均音高から Clef (ト音/ヘ音) を判定 */
function getTrackClef(track: Track): string {
  if (!track.notes || track.notes.length === 0) return 'treble';
  const sum = track.notes.reduce((acc, n) => acc + n.midiNote, 0);
  const avgMidi = sum / track.notes.length;
  return avgMidi < 55 ? 'bass' : 'treble';
}

/**
 * 【パート譜】指定した単一トラックの楽譜を描画する（低音加線保護＆改ページ対応）
 */
export function renderScoreToSvg(
  container: HTMLDivElement,
  score: ParsedScore,
  selectedTrackIndex = 0,
  containerWidth = 800,
  options: ScoreDisplayOptions = DEFAULT_DISPLAY_OPTIONS
) {
  container.innerHTML = '';

  const track = score.tracks[selectedTrackIndex] || score.tracks[0];
  if (!track || track.notes.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'text-gray-400 text-center py-12';
    emptyMsg.textContent = '表示できる音符がありません。MMLを入力してください。';
    container.appendChild(emptyMsg);
    return;
  }

  const inst = getInstrumentByProgram(track.instrument);
  const trackTempo = track.initialTempo || score.tempoEvents[0]?.bpm || 120;
  const trackTimeSig = track.initialTimeSignature || score.timeSignature;
  const beatsPerMeasure = trackTimeSig.numerator || 4;

  // 1. 楽譜タイトル・ヘッダー（表示オプション有効時）
  if (options.showTitle) {
    const showSub = options.showSubInfo !== false;
    const headerDiv = document.createElement('div');
    headerDiv.className = `score-title-header w-full text-center ${showSub ? 'mb-8' : 'mb-6'} pt-1 pb-3 border-b border-slate-200`;
    
    const titleText = options.customTitle?.trim() || score.title || `${track.name || `Track ${selectedTrackIndex + 1}`}`;
    
    const h1 = document.createElement('h1');
    h1.className = 'text-2xl font-bold tracking-tight text-slate-900 font-serif';
    h1.textContent = titleText;
    headerDiv.appendChild(h1);

    if (showSub) {
      const sub = document.createElement('div');
      sub.className = 'flex items-center justify-center space-x-3 text-xs text-slate-600 font-sans mt-1.5';
      sub.innerHTML = `
        <span class="font-semibold text-slate-800">${track.name || `Track ${selectedTrackIndex + 1}`}: ${inst.nameJa}</span>
        <span class="text-slate-400">|</span>
        <span>Tempo: ${trackTempo} BPM</span>
        <span class="text-slate-400">|</span>
        <span>拍子: ${trackTimeSig.numerator}/${trackTimeSig.denominator}</span>
      `;
      headerDiv.appendChild(sub);
    }
    container.appendChild(headerDiv);
  }

  const measureGroups = groupNotesByMeasure(track, beatsPerMeasure);

  const measuresPerRow = containerWidth > 900 ? 3 : containerWidth > 600 ? 2 : 1;
  const staveWidth = Math.floor((containerWidth - 40) / measuresPerRow);
  // コードネームや低音加線・高音加線が切れないよう、十分な高さを確保 (165px)
  const staveHeight = 165;
  const rowCount = Math.ceil(measureGroups.length / measuresPerRow);

  const defaultClef = getTrackClef(track);

  // 段（System / Row）ごとに個別 div & SVG を生成（改ページ完全対応）
  for (let r = 0; r < rowCount; r++) {
    const rowContainer = document.createElement('div');
    rowContainer.className = 'score-system-row w-full flex justify-center';
    rowContainer.style.breakInside = 'avoid';
    rowContainer.style.pageBreakInside = 'avoid';
    rowContainer.style.marginBottom = '16px';
    container.appendChild(rowContainer);

    const renderer = new Renderer(rowContainer, Renderer.Backends.SVG);
    renderer.resize(containerWidth, staveHeight);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    // SVG 要素自体の overflow を visible に設定し、万一の低音はみ出しも確実に描画
    const svgElem = rowContainer.querySelector('svg');
    if (svgElem) {
      svgElem.style.overflow = 'visible';
    }

    for (let c = 0; c < measuresPerRow; c++) {
      const idx = r * measuresPerRow + c;
      if (idx >= measureGroups.length) break;

      const mGroup = measureGroups[idx];
      const x = 20 + c * staveWidth;
      const y = 45; // 上部余白を確保してヘッダー、コード表示、テンポ表示を保護

      const stave = new Stave(x, y, staveWidth);

      if (c === 0) {
        stave.addClef(defaultClef);
        if (r === 0 && options.showTimeSignature) {
          stave.addTimeSignature(`${trackTimeSig.numerator}/${trackTimeSig.denominator}`);
        }
      }

      if (idx === measureGroups.length - 1) {
        stave.setEndBarType(2); // 終止線
      }

      stave.setContext(ctx).draw();

      // テンポ指示 (メトロノーム記号) 描画
      if (r === 0 && c === 0 && options.showTempo) {
        ctx.save();
        ctx.setFont('sans-serif', 10.5, 'bold');
        ctx.setFillStyle('#0f172a');
        ctx.fillText(`♩ = ${trackTempo}`, x + 5, y - 10);
        ctx.restore();
      }

      // コードネーム (和音記号) 描画
      if (options.showChords) {
        const chords = detectChordsForMeasure(
          mGroup.notes,
          mGroup.measureIndex,
          beatsPerMeasure,
          options.chordGranularity || 'auto'
        );

        if (chords.length > 0) {
          ctx.save();
          ctx.setFont('sans-serif', 11.5, 'bold');
          ctx.setFillStyle('#1d4ed8');

          const startPad = c === 0 ? 65 : 18;
          const usableWidth = staveWidth - startPad - 15;

          chords.forEach((ci) => {
            const beatRatio = Math.max(0, Math.min(1, ci.beatOffset / beatsPerMeasure));
            const chordX = x + startPad + usableWidth * beatRatio;
            let chordY = y - 10;
            if (r === 0 && c === 0 && options.showTempo && ci.beatOffset < 1.0) {
              chordY = y - 24;
            }
            ctx.fillText(ci.chord.chordName, chordX, chordY);
          });

          ctx.restore();
        }
      }

      const { notes: vexNotes, items: measureItems, tuplets: measureTuplets } = createVexNotesForMeasure(
        mGroup.notes,
        mGroup.measureIndex,
        beatsPerMeasure,
        defaultClef,
        track.pedalEvents
      );

      if (vexNotes.length > 0) {
        try {
          const voice = new Voice({
            numBeats: score.timeSignature.numerator,
            beatValue: score.timeSignature.denominator,
          }).setMode(Voice.Mode.SOFT);

          voice.addTickables(vexNotes);

          // 先に Beam を生成して Note にアタッチ（旗の重複バグ防止）
          let beams: Beam[] = [];
          try {
            beams = Beam.generateBeams(vexNotes);
          } catch {
            // ignore
          }

          new Formatter().joinVoices([voice]).format([voice], staveWidth - (c === 0 ? 80 : 30));

          voice.draw(ctx, stave);
          beams.forEach((b) => b.setContext(ctx).draw());
          measureTuplets.forEach((t) => {
            try {
              t.setContext(ctx).draw();
            } catch {
              // ignore
            }
          });

          // タイおよびスラーの描画
          if (options.showTiesAndSlurs !== false) {
            renderTiesAndSlursForMeasure(ctx, measureItems);
          }
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * 【スコア譜 / 総譜】全トラックを縦に並べて同期描画する（低音加線保護＆改ページ対応）
 */
export function renderFullScoreToSvg(
  container: HTMLDivElement,
  score: ParsedScore,
  containerWidth = 850,
  partNameMode: PartNameDisplayMode = 'abbr',
  options: ScoreDisplayOptions = DEFAULT_DISPLAY_OPTIONS
) {
  container.innerHTML = '';

  const tracks = score.tracks.filter((t) => t.notes.length > 0);
  if (tracks.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'text-gray-400 text-center py-12';
    emptyMsg.textContent = '表示できる音符がありません。MMLを入力してください。';
    container.appendChild(emptyMsg);
    return;
  }

  const globalTempo = score.tempoEvents[0]?.bpm || 120;
  const globalTimeSig = score.timeSignature;
  const beatsPerMeasure = globalTimeSig.numerator || 4;

  // 1. 楽譜タイトル・ヘッダー（表示オプション有効時）
  if (options.showTitle) {
    const showSub = options.showSubInfo !== false;
    const headerDiv = document.createElement('div');
    headerDiv.className = `score-title-header w-full text-center ${showSub ? 'mb-8' : 'mb-6'} pt-1 pb-3 border-b border-slate-200`;
    
    const titleText = options.customTitle?.trim() || score.title || 'Full Score (総譜)';
    
    const h1 = document.createElement('h1');
    h1.className = 'text-2xl font-bold tracking-tight text-slate-900 font-serif';
    h1.textContent = titleText;
    headerDiv.appendChild(h1);

    if (showSub) {
      const sub = document.createElement('div');
      sub.className = 'flex items-center justify-center space-x-3 text-xs text-slate-600 font-sans mt-1.5';
      sub.innerHTML = `
        <span class="font-semibold text-slate-800">全 ${tracks.length} パート</span>
        <span class="text-slate-400">|</span>
        <span>Tempo: ${globalTempo} BPM</span>
        <span class="text-slate-400">|</span>
        <span>拍子: ${globalTimeSig.numerator}/${globalTimeSig.denominator}</span>
        <span class="text-slate-400">|</span>
        <span>総小節数: ${Math.ceil(score.totalDuration / (globalTimeSig.numerator || 4))}</span>
      `;
      headerDiv.appendChild(sub);
    }
    container.appendChild(headerDiv);
  }

  const trackMeasureMaps: Map<number, NoteEvent[]>[] = tracks.map((track) => {
    const mMap = new Map<number, NoteEvent[]>();
    track.notes.forEach((note) => {
      const mIdx = Math.floor(note.startTime / beatsPerMeasure);
      if (!mMap.has(mIdx)) mMap.set(mIdx, []);
      mMap.get(mIdx)!.push(note);
    });
    return mMap;
  });

  let maxMeasure = 0;
  trackMeasureMaps.forEach((mMap) => {
    Array.from(mMap.keys()).forEach((k) => {
      if (k > maxMeasure) maxMeasure = k;
    });
  });

  const totalMeasures = maxMeasure + 1;
  const measuresPerRow = containerWidth > 750 ? 2 : 1;

  const leftMargin = partNameMode === 'multilineJa' ? 95 : partNameMode === 'trackOnly' ? 45 : 75;
  const staveWidth = Math.floor((containerWidth - leftMargin - 25) / measuresPerRow);

  // 1パートあたりの高さを 125px に設定、上部コード余白を考慮して systemHeight を調整
  const trackStaveHeight = 125;
  const topPadding = 42;
  const systemHeight = tracks.length * trackStaveHeight + topPadding + 25;
  const rowCount = Math.ceil(totalMeasures / measuresPerRow);

  const trackClefs = tracks.map((t) => getTrackClef(t));

  for (let r = 0; r < rowCount; r++) {
    const rowContainer = document.createElement('div');
    rowContainer.className = 'score-system-row w-full flex justify-center';
    rowContainer.style.breakInside = 'avoid';
    rowContainer.style.pageBreakInside = 'avoid';
    rowContainer.style.marginBottom = '24px';
    container.appendChild(rowContainer);

    const renderer = new Renderer(rowContainer, Renderer.Backends.SVG);
    renderer.resize(containerWidth, systemHeight);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

    const svgElem = rowContainer.querySelector('svg');
    if (svgElem) {
      svgElem.style.overflow = 'visible';
    }

    for (let c = 0; c < measuresPerRow; c++) {
      const mIdx = r * measuresPerRow + c;
      if (mIdx >= totalMeasures) break;

      const x = leftMargin + c * staveWidth;
      const stavesInMeasure: Stave[] = [];

      tracks.forEach((track, tIdx) => {
        const staveY = topPadding + tIdx * trackStaveHeight;
        const stave = new Stave(x, staveY, staveWidth);
        const clef = trackClefs[tIdx];

        // 各パートの拍子・テンポ情報
        const trackSig = (options.showTrackDetails && track.initialTimeSignature)
          ? track.initialTimeSignature
          : score.timeSignature;
        const trackTempo = track.initialTempo || globalTempo;
        const hasCustomTempo = track.initialTempo && track.initialTempo !== globalTempo;

        if (c === 0) {
          stave.addClef(clef);
          if (r === 0 && options.showTimeSignature) {
            stave.addTimeSignature(`${trackSig.numerator}/${trackSig.denominator}`);
          }

          // パート名・楽器名
          const inst = getInstrumentByProgram(track.instrument);
          let labelLine1 = `TR${tIdx + 1}`;
          let labelLine2 = '';

          if (partNameMode === 'abbr') {
            labelLine1 = `TR${tIdx + 1}: ${inst.abbr}`;
          } else if (partNameMode === 'abbrJa') {
            labelLine1 = `TR${tIdx + 1}: ${inst.abbrJa}`;
          } else if (partNameMode === 'multilineJa') {
            labelLine1 = `TR${tIdx + 1}`;
            labelLine2 = inst.nameJa.length > 8 ? inst.nameJa.slice(0, 7) + '..' : inst.nameJa;
          } else {
            labelLine1 = `TR ${tIdx + 1}`;
          }

          ctx.save();
          ctx.setFont('sans-serif', 8.5, 'bold');
          ctx.setFillStyle('#334155');

          if (labelLine2) {
            ctx.fillText(labelLine1, 8, staveY + 38);
            ctx.setFont('sans-serif', 7.5, 'normal');
            ctx.setFillStyle('#64748b');
            ctx.fillText(labelLine2, 8, staveY + 50);
          } else {
            ctx.fillText(labelLine1, 8, staveY + 45);
          }
          ctx.restore();
        }

        if (mIdx === totalMeasures - 1) {
          stave.setEndBarType(2); // 終止線
        }

        stave.setContext(ctx).draw();
        stavesInMeasure.push(stave);

        // テンポ指示の描画
        if (r === 0 && c === 0 && options.showTempo) {
          // 最上段（全体テンポ）
          if (tIdx === 0) {
            ctx.save();
            ctx.setFont('sans-serif', 10.5, 'bold');
            ctx.setFillStyle('#0f172a');
            ctx.fillText(`♩ = ${globalTempo}`, x + 5, staveY - 8);
            ctx.restore();
          }
          // パート個別のテンポ指示（パート詳細表示が有効で、全体と異なるまたは明示指定されている場合）
          else if (options.showTrackDetails && hasCustomTempo) {
            ctx.save();
            ctx.setFont('sans-serif', 9, 'bold');
            ctx.setFillStyle('#2563eb');
            ctx.fillText(`(TR${tIdx + 1}: ♩ = ${trackTempo})`, x + 5, staveY - 6);
            ctx.restore();
          }
        }

        // コードネーム (和音記号) 描画 (最上段に全パート合算または第1パートから推定して表示)
        if (tIdx === 0 && options.showChords) {
          const targetNotes: NoteEvent[] =
            options.chordTrackSource === 'all'
              ? tracks.flatMap((_, i) => trackMeasureMaps[i].get(mIdx) || [])
              : trackMeasureMaps[0].get(mIdx) || [];

          const chords = detectChordsForMeasure(
            targetNotes,
            mIdx,
            beatsPerMeasure,
            options.chordGranularity || 'auto'
          );

          if (chords.length > 0) {
            ctx.save();
            ctx.setFont('sans-serif', 11.5, 'bold');
            ctx.setFillStyle('#1d4ed8');

            const startPad = c === 0 ? 65 : 18;
            const usableWidth = staveWidth - startPad - 15;

            chords.forEach((ci) => {
              const beatRatio = Math.max(0, Math.min(1, ci.beatOffset / beatsPerMeasure));
              const chordX = x + startPad + usableWidth * beatRatio;
              let chordY = staveY - 10;
              if (r === 0 && c === 0 && options.showTempo && ci.beatOffset < 1.0) {
                chordY = staveY - 24;
              }
              ctx.fillText(ci.chord.chordName, chordX, chordY);
            });

            ctx.restore();
          }
        }

        // 音符生成
        const notes = trackMeasureMaps[tIdx].get(mIdx) || [];
        const { notes: vexNotes, items: measureItems, tuplets: measureTuplets } = createVexNotesForMeasure(notes, mIdx, beatsPerMeasure, clef, track.pedalEvents);

        if (vexNotes.length > 0) {
          try {
            const voice = new Voice({
              numBeats: score.timeSignature.numerator,
              beatValue: score.timeSignature.denominator,
            }).setMode(Voice.Mode.SOFT);

            voice.addTickables(vexNotes);

            // 先に Beam を生成してアタッチ
            let beams: Beam[] = [];
            try {
              beams = Beam.generateBeams(vexNotes);
            } catch {
              // ignore
            }

            new Formatter().joinVoices([voice]).format([voice], staveWidth - (c === 0 ? 80 : 30));

            voice.draw(ctx, stave);
            beams.forEach((b) => b.setContext(ctx).draw());
            measureTuplets.forEach((t) => {
              try {
                t.setContext(ctx).draw();
              } catch {
                // ignore
              }
            });

            // タイおよびスラーの描画
            if (options.showTiesAndSlurs !== false) {
              renderTiesAndSlursForMeasure(ctx, measureItems);
            }
          } catch {
            // ignore
          }
        }
      });

      // 複数トラック時の縦連結
      if (stavesInMeasure.length > 1) {
        const topStave = stavesInMeasure[0];
        const bottomStave = stavesInMeasure[stavesInMeasure.length - 1];

        try {
          if (c === 0) {
            const bracketConnector = new StaveConnector(topStave, bottomStave);
            bracketConnector.setType(StaveConnector.type.BRACKET);
            bracketConnector.setContext(ctx).draw();

            const leftConnector = new StaveConnector(topStave, bottomStave);
            leftConnector.setType(StaveConnector.type.SINGLE_LEFT);
            leftConnector.setContext(ctx).draw();
          }

          const rightConnector = new StaveConnector(topStave, bottomStave);
          rightConnector.setType(
            mIdx === totalMeasures - 1 ? StaveConnector.type.BOLD_DOUBLE_RIGHT : StaveConnector.type.SINGLE_RIGHT
          );
          rightConnector.setContext(ctx).draw();
        } catch {
          // ignore
        }
      }
    }
  }
}
