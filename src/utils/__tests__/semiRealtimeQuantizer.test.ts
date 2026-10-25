import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ENABLED_CANDIDATE_IDS,
  STRAIGHT_CANDIDATE_IDS,
  computeCandidateZones,
  quantizeBeatsToZone,
  msToBeats,
  getMetronomeAccentAtBeat,
} from '../semiRealtimeQuantizer';

describe('semiRealtimeQuantizer', () => {
  describe('msToBeats', () => {
    it('BPM 120 のとき 500ms が 1.0拍 (4分音符) になること', () => {
      expect(msToBeats(500, 120)).toBeCloseTo(1.0, 5);
      expect(msToBeats(250, 120)).toBeCloseTo(0.5, 5);
      expect(msToBeats(2000, 120)).toBeCloseTo(4.0, 5);
    });

    it('BPM 60 のとき 1000ms が 1.0拍 になること', () => {
      expect(msToBeats(1000, 60)).toBeCloseTo(1.0, 5);
      expect(msToBeats(1500, 60)).toBeCloseTo(1.5, 5);
    });
  });

  describe('computeCandidateZones & quantizeBeatsToZone (全8種類有効時)', () => {
    it('全8種 (16, 8, 8., 4, 4., 2, 2., 1) の境界値で最も近い音符へ正確に振り分けられること', () => {
      const ids = DEFAULT_ENABLED_CANDIDATE_IDS;
      const { zones, gaugeMaxBeats } = computeCandidateZones(ids);

      expect(zones).toHaveLength(8);
      expect(gaugeMaxBeats).toBeCloseTo(4.5, 5);

      // 16分音符 (0.25拍): 0 〜 0.375未満
      expect(quantizeBeatsToZone(0.05, ids).candidate.id).toBe('16');
      expect(quantizeBeatsToZone(0.25, ids).candidate.id).toBe('16');
      expect(quantizeBeatsToZone(0.37, ids).candidate.id).toBe('16');

      // 8分音符 (0.5拍): 0.375 〜 0.625未満
      expect(quantizeBeatsToZone(0.38, ids).candidate.id).toBe('8');
      expect(quantizeBeatsToZone(0.5, ids).candidate.id).toBe('8');
      expect(quantizeBeatsToZone(0.62, ids).candidate.id).toBe('8');

      // 付点8分音符 (0.75拍): 0.625 〜 0.875未満
      expect(quantizeBeatsToZone(0.63, ids).candidate.id).toBe('8.');
      expect(quantizeBeatsToZone(0.75, ids).candidate.id).toBe('8.');
      expect(quantizeBeatsToZone(0.87, ids).candidate.id).toBe('8.');

      // 4分音符 (1.0拍): 0.875 〜 1.25未満
      expect(quantizeBeatsToZone(0.88, ids).candidate.id).toBe('4');
      expect(quantizeBeatsToZone(1.0, ids).candidate.id).toBe('4');
      expect(quantizeBeatsToZone(1.24, ids).candidate.id).toBe('4');

      // 付点4分音符 (1.5拍): 1.25 〜 1.75未満
      expect(quantizeBeatsToZone(1.26, ids).candidate.id).toBe('4.');
      expect(quantizeBeatsToZone(1.5, ids).candidate.id).toBe('4.');
      expect(quantizeBeatsToZone(1.74, ids).candidate.id).toBe('4.');

      // 2分音符 (2.0拍): 1.75 〜 2.5未満
      expect(quantizeBeatsToZone(1.76, ids).candidate.id).toBe('2');
      expect(quantizeBeatsToZone(2.0, ids).candidate.id).toBe('2');
      expect(quantizeBeatsToZone(2.49, ids).candidate.id).toBe('2');

      // 付点2分音符 (3.0拍): 2.5 〜 3.5未満
      expect(quantizeBeatsToZone(2.51, ids).candidate.id).toBe('2.');
      expect(quantizeBeatsToZone(3.0, ids).candidate.id).toBe('2.');
      expect(quantizeBeatsToZone(3.49, ids).candidate.id).toBe('2.');

      // 全音符 (4.0拍): 3.5以上
      expect(quantizeBeatsToZone(3.51, ids).candidate.id).toBe('1');
      expect(quantizeBeatsToZone(4.0, ids).candidate.id).toBe('1');
      expect(quantizeBeatsToZone(6.0, ids).candidate.id).toBe('1');
    });
  });

  describe('カスタム選択候補での振り分け', () => {
    it('付点なし (16, 8, 4, 2, 1) のみを事前選択した場合、付点音符に吸い込まれず選択候補内で振り分けられること', () => {
      const ids = STRAIGHT_CANDIDATE_IDS;
      // 8分(0.5) と 4分(1.0) の境界は 0.75
      expect(quantizeBeatsToZone(0.7, ids).candidate.id).toBe('8');
      expect(quantizeBeatsToZone(0.8, ids).candidate.id).toBe('4');

      // 4分(1.0) と 2分(2.0) の境界は 1.5
      expect(quantizeBeatsToZone(1.4, ids).candidate.id).toBe('4');
      expect(quantizeBeatsToZone(1.6, ids).candidate.id).toBe('2');

      // 2分(2.0) と 全(4.0) の境界は 3.0
      expect(quantizeBeatsToZone(2.9, ids).candidate.id).toBe('2');
      expect(quantizeBeatsToZone(3.1, ids).candidate.id).toBe('1');
    });

    it('空配列が渡された場合でも4分音符へ安全にフォールバックすること', () => {
      expect(quantizeBeatsToZone(1.2, []).candidate.id).toBe('4');
    });
  });

  describe('getMetronomeAccentAtBeat', () => {
    it('4拍の倍数は accent、1拍の倍数は quarter、細分拍は sub になること', () => {
      expect(getMetronomeAccentAtBeat(0)).toBe('quarter');
      expect(getMetronomeAccentAtBeat(0.25)).toBe('sub');
      expect(getMetronomeAccentAtBeat(0.5)).toBe('sub');
      expect(getMetronomeAccentAtBeat(0.75)).toBe('sub');
      expect(getMetronomeAccentAtBeat(1.0)).toBe('quarter');
      expect(getMetronomeAccentAtBeat(1.5)).toBe('sub');
      expect(getMetronomeAccentAtBeat(2.0)).toBe('quarter');
      expect(getMetronomeAccentAtBeat(3.0)).toBe('quarter');
      expect(getMetronomeAccentAtBeat(4.0)).toBe('accent');
      expect(getMetronomeAccentAtBeat(8.0)).toBe('accent');
    });
  });
});
