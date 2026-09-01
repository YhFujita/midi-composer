import { Stave, StaveNote, Voice, Formatter, Dot, Accidental, Beam, Renderer } from 'vexflow';
import { ParsedScore, Track, NoteEvent } from '../../types/mml';

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
  // 許容誤差を考慮
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
 * 指定した SVG 要素に VexFlow 楽譜を描画する
 */
export function renderScoreToSvg(
  container: HTMLDivElement,
  score: ParsedScore,
  selectedTrackIndex = 0,
  containerWidth = 800
) {
  // コンテナ初期化
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

  // 1行あたりの小節数（幅に応じて2〜4小節）
  const measuresPerRow = containerWidth > 900 ? 3 : containerWidth > 600 ? 2 : 1;
  const staveWidth = Math.floor((containerWidth - 40) / measuresPerRow);
  const staveHeight = 130;
  const rowCount = Math.ceil(measureGroups.length / measuresPerRow);
  const totalHeight = rowCount * staveHeight + 60;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(containerWidth, totalHeight);
  const ctx = renderer.getContext();
  ctx.setFont('Arial', 10);

  // 平均音高から適切な Clef (ト音/ヘ音) を自動判定
  let avgMidi = 60;
  if (track.notes.length > 0) {
    const sum = track.notes.reduce((acc, n) => acc + n.midiNote, 0);
    avgMidi = sum / track.notes.length;
  }
  const defaultClef = avgMidi < 55 ? 'bass' : 'treble';

  measureGroups.forEach((mGroup, idx) => {
    const rowIndex = Math.floor(idx / measuresPerRow);
    const colIndex = idx % measuresPerRow;

    const x = 20 + colIndex * staveWidth;
    const y = 20 + rowIndex * staveHeight;

    const stave = new Stave(x, y, staveWidth);

    // 行の最初の小節には Clef と TimeSignature を追加
    if (colIndex === 0) {
      stave.addClef(defaultClef);
      if (rowIndex === 0) {
        stave.addTimeSignature(`${score.timeSignature.numerator}/${score.timeSignature.denominator}`);
      }
    }

    // 最後の小節には終止線
    if (idx === measureGroups.length - 1) {
      stave.setEndBarType(2); // END
    }

    stave.setContext(ctx).draw();

    // 小節内の音符生成
    const vexNotes: StaveNote[] = [];
    const measureStartBeat = mGroup.measureIndex * beatsPerMeasure;
    let currentBeatInMeasure = 0;

    // 同じ startTime の音符を和音としてまとめる
    const notesByTime = new Map<number, NoteEvent[]>();
    mGroup.notes.forEach((n) => {
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
      if (gap > 0.1) {
        const { duration: rDur, isDotted: rDot } = durationToVexDuration(gap);
        const restNote = new StaveNote({
          clef: defaultClef,
          keys: [defaultClef === 'bass' ? 'd/3' : 'b/4'],
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
          clef: defaultClef,
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
      } catch (err) {
        // パース例外時のフォールバック休符
        vexNotes.push(
          new StaveNote({
            clef: defaultClef,
            keys: ['b/4'],
            duration: 'qr',
          })
        );
      }

      currentBeatInMeasure = t + firstNote.duration;
    }

    // 小節末尾の残り時間を休符で埋める
    const remaining = beatsPerMeasure - currentBeatInMeasure;
    if (remaining > 0.1) {
      const { duration: rDur, isDotted: rDot } = durationToVexDuration(remaining);
      const restNote = new StaveNote({
        clef: defaultClef,
        keys: [defaultClef === 'bass' ? 'd/3' : 'b/4'],
        duration: `${rDur.replace('d', '')}r`,
      });
      if (rDot) {
        Dot.buildAndAttach([restNote], { all: true });
      }
      vexNotes.push(restNote);
    }

    if (vexNotes.length > 0) {
      try {
        const voice = new Voice({
          numBeats: score.timeSignature.numerator,
          beatValue: score.timeSignature.denominator,
        }).setMode(Voice.Mode.SOFT);

        voice.addTickables(vexNotes);
        new Formatter().joinVoices([voice]).format([voice], staveWidth - (colIndex === 0 ? 80 : 30));
        voice.draw(ctx, stave);

        // 8分音符以下の自動連桁 (Beam)
        try {
          const beams = Beam.generateBeams(vexNotes);
          beams.forEach((b) => b.setContext(ctx).draw());
        } catch {
          // 連桁失敗時は無視
        }
      } catch {
        // Voice フォーマット失敗時は単体描画
      }
    }
  });
}
