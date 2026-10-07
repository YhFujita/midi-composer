import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import './index.css';

// 万が一の未捕捉例外（非同期処理やイベント内）を画面上に可視化するフェイルセーフ
if (typeof window !== 'undefined') {
  const showErrorOverlay = (title: string, message: string, stack?: string) => {
    // 既存のエラーオーバーレイがあれば再描画しない
    if (document.getElementById('uncaught-error-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'uncaught-error-overlay';
    overlay.style.cssText =
      'position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; background-color: rgba(2, 6, 23, 0.9); padding: 16px; font-family: sans-serif;';

    const card = document.createElement('div');
    card.style.cssText =
      'max-width: 600px; width: 100%; background-color: #ffffff; color: #0f172a; border-radius: 12px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid #e2e8f0; opacity: 1;';

    card.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
        <div>
          <h2 style="font-size: 16px; font-weight: bold; margin: 0; color: #0f172a;">${title}</h2>
          <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">予期せぬエラーが発生しました</p>
        </div>
      </div>
      <div style="font-size: 12px; font-family: monospace; background-color: #fff1f2; color: #be123c; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; margin-bottom: 16px; word-break: break-all;">
        ${message}
      </div>
      ${
        stack
          ? `<pre style="font-size: 11px; font-family: monospace; background-color: #f1f5f9; color: #334155; padding: 12px; border-radius: 8px; max-height: 180px; overflow: auto; border: 1px solid #e2e8f0; white-space: pre-wrap;">${stack}</pre>`
          : ''
      }
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
        <button id="err-clear-btn" style="padding: 6px 12px; font-size: 12px; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
          キャッシュをクリア
        </button>
        <button id="err-reload-btn" style="padding: 6px 16px; font-size: 12px; font-weight: bold; background-color: #2563eb; color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">
          再読み込み
        </button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('err-reload-btn')?.addEventListener('click', () => {
      window.location.reload();
    });
    document.getElementById('err-clear-btn')?.addEventListener('click', () => {
      try {
        localStorage.clear();
      } catch {}
      window.location.reload();
    });
  };

  window.addEventListener('error', (event) => {
    console.error('Global window.onerror caught:', event.error || event.message);
    showErrorOverlay('JavaScript 実行時エラー', event.message, event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Global unhandledrejection caught:', event.reason);
    const reasonMsg = event.reason instanceof Error ? event.reason.message : String(event.reason);
    const stack = event.reason instanceof Error ? event.reason.stack : undefined;
    showErrorOverlay('非同期処理エラー (Promise Rejection)', reasonMsg, stack);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
