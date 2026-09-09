import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChordDisplaySettingsModal } from './ChordDisplaySettingsModal';
import { parseMML } from '../../core/parser/mmlParser';
import { DEFAULT_DISPLAY_OPTIONS, ScoreDisplayOptions } from '../../core/score/vexflowAdapter';
import { PRESET_SONGS } from '../../constants/presets';

describe('ChordDisplaySettingsModal', () => {
  const defaultScore = parseMML(PRESET_SONGS[0].mml);

  it('isOpen: false の時は何も描画しない (null)', () => {
    const html = renderToString(
      React.createElement(ChordDisplaySettingsModal, {
        isOpen: false,
        onClose: () => {},
        score: defaultScore,
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        onUpdateOptions: () => {},
      })
    );
    expect(html).toBe('');
  });

  it('isOpen: true の時はモーダル全体が正常に描画される', () => {
    const html = renderToString(
      React.createElement(ChordDisplaySettingsModal, {
        isOpen: true,
        onClose: () => {},
        score: defaultScore,
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        onUpdateOptions: () => {},
      })
    );
    expect(html).toContain('コード自動生成・表示の詳細設定');
    expect(html).toContain('解析対象トラックの選択');
    expect(html).toContain('小節別の表示位置指定');
  });

  it('全プリセットソングでクラッシュせず正常にレンダリングできる', () => {
    for (const preset of PRESET_SONGS) {
      const score = parseMML(preset.mml);
      const html = renderToString(
        React.createElement(ChordDisplaySettingsModal, {
          isOpen: true,
          onClose: () => {},
          score: score,
          displayOptions: DEFAULT_DISPLAY_OPTIONS,
          onUpdateOptions: () => {},
        })
      );
      expect(html).toContain('コード自動生成・表示の詳細設定');
    }
  });

  it('空のスコアや異常データでもクラッシュしない', () => {
    const emptyScore = parseMML('');
    const html = renderToString(
      React.createElement(ChordDisplaySettingsModal, {
        isOpen: true,
        onClose: () => {},
        score: emptyScore,
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        onUpdateOptions: () => {},
      })
    );
    expect(html).toContain('コード自動生成・表示の詳細設定');
  });

  it('壊れた measureChordOverrides や特殊な displayOptions でも安全に処理できる', () => {
    const optionsWithBadData: ScoreDisplayOptions = {
      ...DEFAULT_DISPLAY_OPTIONS,
      chordTrackSource: 'custom',
      chordTargetTrackIds: [0, 999],
      measureChordOverrides: {
        0: { measureIndex: 0, mode: 'custom', customBeats: [0, 1.5] },
        1: { measureIndex: 1, mode: 'none' },
        2: null as any,
        3: undefined as any,
        4: { measureIndex: 4, mode: 'beat' },
      },
    };

    const html = renderToString(
      React.createElement(ChordDisplaySettingsModal, {
        isOpen: true,
        onClose: () => {},
        score: defaultScore,
        displayOptions: optionsWithBadData,
        onUpdateOptions: () => {},
      })
    );
    expect(html).toContain('コード自動生成・表示の詳細設定');
  });
});
