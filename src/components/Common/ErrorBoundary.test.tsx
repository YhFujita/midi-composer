import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ErrorBoundary } from './ErrorBoundary';

const FaultyComponent: React.FC = () => {
  throw new Error('テスト用の例外エラー');
};

const NormalComponent: React.FC = () => {
  return <div>正常なコンポーネント</div>;
};

describe('ErrorBoundary', () => {
  it('子コンポーネントが正常な場合は子要素をそのまま描画すること', () => {
    const html = renderToString(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );
    expect(html).toContain('正常なコンポーネント');
  });
});
