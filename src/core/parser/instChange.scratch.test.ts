import { describe, it } from 'vitest';
import { parseMML } from './mmlParser';

describe('scratch', () => {
  it('inst change', () => {
    const mml = `TR(1) Voice(0) o4 l4
c d Voice(40) /* バイオリン */ e f Voice(0) g a
TR(2) @24 c d @0 e f`;
    const s = parseMML(mml);
    s.tracks.forEach((t) => console.log(t.id, t.instrument, t.notes.map((n) => `${n.pitch}:${n.instrument}`).join(' ')));
    console.log(s.errors);
  });
});
