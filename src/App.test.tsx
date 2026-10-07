import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

beforeEach(() => {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  (globalThis as any).window = globalThis;
});

import App from './App';

describe('App mounting test', () => {
  it('App がクラッシュせずに正常にレンダリングされること', () => {
    const html = renderToString(<App />);
    expect(html).toBeTruthy();
  });
});
