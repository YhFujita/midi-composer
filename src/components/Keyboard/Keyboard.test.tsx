import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PianoKeyboardPanel } from './PianoKeyboardPanel';
import { SvgPianoKeyboard } from './SvgPianoKeyboard';
import { NoteIcon } from './NoteIcon';
import { SemiRealtimeMonitor } from './SemiRealtimeMonitor';
import { DEFAULT_ENABLED_CANDIDATE_IDS } from '../../utils/semiRealtimeQuantizer';

describe('Keyboard components', () => {
  it('PianoKeyboardPanel が正常にレンダリングされる (isDrumMode: false)', () => {
    const html = renderToString(
      <PianoKeyboardPanel
        isOpen={true}
        onClose={() => {}}
        onInsertText={() => {}}
        isDrumMode={false}
      />
    );
    expect(html).toBeTruthy();
    // 直感操作モードボタン、選択中音符プレビューカード、付点4分/付点8分ボタンが含まれることを検証
    expect(html).toContain('直感操作モード');
    expect(html).toContain('半リアルタイム');
    expect(html).toContain('選択中:');
    expect(html).toContain('付点4分');
    expect(html).toContain('付点8分');
    expect(html).toContain('タイ');
  });

  it('SemiRealtimeMonitor が待機中および押下中に振り子SVGとゾーンゲージを正しく描画する', () => {
    const idleHtml = renderToString(
      <SemiRealtimeMonitor
        isHolding={false}
        holdingBeats={0}
        holdingSec={0}
        previewMml=""
        enabledCandidateIds={DEFAULT_ENABLED_CANDIDATE_IDS}
        clickIntervalBeats={1}
        effectiveBpm={120}
        lastClickFlash={null}
        lastResult={null}
      />
    );
    expect(idleHtml).toContain('メトロノーム振り子');
    expect(idleHtml).toContain('時間停止');
    expect(idleHtml).toContain('120');

    const holdingHtml = renderToString(
      <SemiRealtimeMonitor
        isHolding={true}
        holdingBeats={1.45}
        holdingSec={0.725}
        previewMml="c4."
        enabledCandidateIds={DEFAULT_ENABLED_CANDIDATE_IDS}
        clickIntervalBeats={0.5}
        effectiveBpm={120}
        lastClickFlash={{ timestamp: 0, accent: 'quarter' }}
        lastResult={null}
      />
    );
    expect(holdingHtml).toContain('計測中');
    expect(holdingHtml).toContain('付点4分音符');
    expect(holdingHtml).toContain('c4.');
  });

  it('PianoKeyboardPanel が正常にレンダリングされる (isDrumMode: true)', () => {
    const html = renderToString(
      <PianoKeyboardPanel
        isOpen={true}
        onClose={() => {}}
        onInsertText={() => {}}
        isDrumMode={true}
      />
    );
    expect(html).toBeTruthy();
    expect(html).toContain('ドラムセット (Ch 10)');
  });

  it('SvgPianoKeyboard が正常にレンダリングされる (isDrumMode: true)', () => {
    const html = renderToString(
      <SvgPianoKeyboard
        startOctave={2}
        octaveCount={3}
        onNoteDown={() => {}}
        isDrumMode={true}
      />
    );
    expect(html).toBeTruthy();
  });

  it('NoteIcon が各種音長・付点で正しくSVGを描画する', () => {
    const whole = renderToString(<NoteIcon duration="1" isDotted={false} />);
    expect(whole).toContain('<svg');
    expect(whole).toContain('ellipse');

    const half = renderToString(<NoteIcon duration="2" isDotted={false} />);
    expect(half).toContain('<svg');
    expect(half).toContain('<line');

    const quarterDotted = renderToString(<NoteIcon duration="4" isDotted={true} />);
    expect(quarterDotted).toContain('<svg');
    expect(quarterDotted).toContain('<circle'); // 付点ドット

    const sixteenth = renderToString(<NoteIcon duration="16" isDotted={false} />);
    expect(sixteenth).toContain('<svg');
    expect(sixteenth).toContain('<path'); // 旗2本
  });
});
