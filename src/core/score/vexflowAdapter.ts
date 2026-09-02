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

import { detectChordsForMeasure, ChordDetectionGranularity } from './chordDetector';

export type PartNameDisplayMode = 'abbr' | 'abbrJa' | 'multilineJa' | 'trackOnly';

export interface ScoreDisplayOptions {
  showTitle: boolean;          // 楽譜タイトルを表示するか
  showTempo: boolean;          // テンポ指示 (♩=120) を表示するか
  showTimeSignature: boolean;  // 拍子記号 (4/4 等) を表示するか
  showTrackDetails: boolean;   // パート別の個別指示(テンポ/拍子等)を表示するか
  customTitle?: string;        // ユーザー指定のカスタムタイトル
  showChords: boolean;         // コードネームを表示するか
  chordGranularity: ChordDetectionGranularity; // 'measure' | 'two-beats' | 'beat' | 'auto'
  chordTrackSource: 'all' | 'selected';       // 総譜時のコード解析対象
}

export const DEFAULT_DISPLAY_OPTIONS: ScoreDisplayOptions = {
  showTitle: true,
  showTempo: true,
  showTimeSignature: true,
  showTrackDetails: true,
  showChords: true,
  chordGranularity: 'auto',
  chordTrackSource: 'all',
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
    const headerDiv = document.createElement('div');
    headerDiv.className = 'score-title-header w-full text-center mb-6 pt-1 pb-3 border-b border-slate-200';
    
    const titleText = options.customTitle?.trim() || score.title || `${track.name || `Track ${selectedTrackIndex + 1}`}`;
    
    const h1 = document.createElement('h1');
    h1.className = 'text-2xl font-bold tracking-tight text-slate-900 font-serif';
    h1.textContent = titleText;
    headerDiv.appendChild(h1);

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
    container.appendChild(headerDiv);
  }

  const measureGroups = groupNotesByMeasure(track, beatsPerMeasure);

  const measuresPerRow = containerWidth > 900 ? 3 : containerWidth > 600 ? 2 : 1;
  const staveWidth = Math.floor((containerWidth - 40) / measuresPerRow);
  // 低音加線や高音加線が切れないよう、十分な高さを確保 (150px)
  const staveHeight = 150;
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
      const y = 35; // 上部余白を確保してテンポ表示と高音加線を保護

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
    const headerDiv = document.createElement('div');
    headerDiv.className = 'score-title-header w-full text-center mb-6 pt-1 pb-3 border-b border-slate-200';
    
    const titleText = options.customTitle?.trim() || score.title || 'Full Score (総譜)';
    
    const h1 = document.createElement('h1');
    h1.className = 'text-2xl font-bold tracking-tight text-slate-900 font-serif';
    h1.textContent = titleText;
    headerDiv.appendChild(h1);

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

  // 1パートあたりの高さを 125px に設定
  const trackStaveHeight = 125;
  const systemHeight = tracks.length * trackStaveHeight + 45;
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
        const staveY = 25 + tIdx * trackStaveHeight;
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
