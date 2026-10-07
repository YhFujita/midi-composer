import { describe, it, expect } from 'vitest';
import { detectCursorContext } from './editorCursor';
import { parseMML } from '../core/parser/mmlParser';

describe('editorCursor - detectCursorContext', () => {
  it('初期状態（トラック・チャンネル指定なし）では Track 0, Channel 1, isDrum false を返す', () => {
    const mml = 'c d e f';
    const ctx = detectCursorContext(mml, 1, 1);
    expect(ctx.trackId).toBe(0);
    expect(ctx.channel).toBe(1);
    expect(ctx.isDrum).toBe(false);
  });

  it('CH(10) または Channel(10) が指定されている行では isDrum true を返す', () => {
    const mml = `TR(1) Voice(0) o4 c d e
TR(2) CH(10) o2 c d f#
`;
    // 1行目にカーソルがある場合: 旋律トラック
    const ctx1 = detectCursorContext(mml, 1, 5);
    expect(ctx1.trackId).toBe(0);
    expect(ctx1.channel).toBe(1);
    expect(ctx1.isDrum).toBe(false);

    // 2行目にカーソルがある場合: ドラムトラック (CH 10)
    const ctx2 = detectCursorContext(mml, 2, 8);
    expect(ctx2.trackId).toBe(1);
    expect(ctx2.channel).toBe(10);
    expect(ctx2.isDrum).toBe(true);
  });

  it('TR(10) でチャンネルがデフォルト10になる場合も isDrum true を返す', () => {
    const mml = `TR(1) c d e
TR(10) o2 c d
`;
    const ctx = detectCursorContext(mml, 2, 3);
    expect(ctx.trackId).toBe(9);
    expect(ctx.channel).toBe(10);
    expect(ctx.isDrum).toBe(true);
  });

  it('コメント内の CH(10) は誤検知しない', () => {
    const mml = `// これは CH(10) の説明です
TR(1) Voice(0) c d e
`;
    const ctx = detectCursorContext(mml, 1, 5);
    expect(ctx.isDrum).toBe(false);
  });

  it('ParsedScore と連動してトラックチャンネルを取得できる', () => {
    const mml = `TR(1) Voice(0) c d
TR(2) Channel(10) c d
`;
    const score = parseMML(mml);
    const ctx = detectCursorContext(mml, 2, 4, score);
    expect(ctx.isDrum).toBe(true);
    expect(ctx.channel).toBe(10);
  });
});
