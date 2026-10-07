import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PianoKeyboardPanel } from './PianoKeyboardPanel';
import { SvgPianoKeyboard } from './SvgPianoKeyboard';

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
});
