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
} from 'vexflow';
import { ParsedScore, Track, NoteEvent } from '../../types/mml';
import { getInstrumentByProgram } from '../../constants/instruments';

export type PartNameDisplayMode = 'abbr' | 'abbrJa' | 'multilineJa' | 'trackOnly';

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

/**
 * 1小節分の音符リストから VexFlow の StaveNote 配列を生成
 */
function createVexNotesForMeasure(
  notes: NoteEvent[],
  measureIndex: number,
  beatsPerMeasure: number,
  clef: string
): StaveNote[] {
  const vexNotes: StaveNote[] = [];
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
    return [restNote];
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
      vexNotes.push(restNote);
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

      vexNotes.push(staveNote);
    } catch {
      vexNotes.push(
        new StaveNote({
          clef,
          keys: [clef === 'bass' ? 'd/3' : 'b/4'],
          duration: 'qr',
        })
      );
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
  }

  return vexNotes;
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
  containerWidth = 800
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

  const beatsPerMeasure = score.timeSignature.numerator || 4;
  const measureGroups = groupNotesByMeasure(track, beatsPerMeasure);

  const measuresPerRow = containerWidth > 900 ? 3 : containerWidth > 600 ? 2 : 1;
  const staveWidth = Math.floor((containerWidth - 40) / measuresPerRow);
  // 低音加線や高音加線が切れないよう、十分な高さを確保 (150px)
  const staveHeight = 145;
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
      const y = 30; // 上部余白を確保して高音加線を保護

      const stave = new Stave(x, y, staveWidth);

      if (c === 0) {
        stave.addClef(defaultClef);
        if (r === 0) {
          stave.addTimeSignature(`${score.timeSignature.numerator}/${score.timeSignature.denominator}`);
        }
      }

      if (idx === measureGroups.length - 1) {
        stave.setEndBarType(2); // 終止線
      }

      stave.setContext(ctx).draw();

      const vexNotes = createVexNotesForMeasure(
        mGroup.notes,
        mGroup.measureIndex,
        beatsPerMeasure,
        defaultClef
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
  partNameMode: PartNameDisplayMode = 'abbr'
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

  const beatsPerMeasure = score.timeSignature.numerator || 4;

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

  // 1パートあたりの高さを 120px に拡大し、低音の加線や符頭が切れるのを完全に防止
  const trackStaveHeight = 120;
  const systemHeight = tracks.length * trackStaveHeight + 40;
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
        const staveY = 20 + tIdx * trackStaveHeight;
        const stave = new Stave(x, staveY, staveWidth);
        const clef = trackClefs[tIdx];

        if (c === 0) {
          stave.addClef(clef);
          if (r === 0) {
            stave.addTimeSignature(`${score.timeSignature.numerator}/${score.timeSignature.denominator}`);
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

        // 音符生成
        const notes = trackMeasureMaps[tIdx].get(mIdx) || [];
        const vexNotes = createVexNotesForMeasure(notes, mIdx, beatsPerMeasure, clef);

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
