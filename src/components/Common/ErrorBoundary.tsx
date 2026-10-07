import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.removeItem('midi_composer_layout');
      localStorage.removeItem('midi_composer_score_options');
      localStorage.removeItem('midi_composer_active_sf2_id');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const title = this.props.fallbackTitle || 'エラーが発生しました';

      return (
        <div
          className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100"
          style={{ minHeight: '100vh', backgroundColor: '#020617' }}
        >
          <div
            className="max-w-2xl w-full bg-white text-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200"
            style={{ backgroundColor: '#ffffff', opacity: 1, color: '#0f172a' }}
          >
            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-200">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-500">
                  コンポーネントの実行中にエラーが発生したため、安全に停止しました。
                </p>
              </div>
            </div>

            {/* エラーメッセージ */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 font-mono break-all">
                {error ? `${error.name}: ${error.message}` : '不明なエラー'}
              </div>
            </div>

            {/* スタックトレース */}
            {(error?.stack || errorInfo?.componentStack) && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  詳細スタック情報:
                </label>
                <pre className="text-[11px] font-mono bg-slate-100 text-slate-800 p-3 rounded-lg overflow-auto max-h-48 border border-slate-200 select-all whitespace-pre-wrap">
                  {error?.stack}
                  {errorInfo?.componentStack}
                </pre>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={this.handleResetState}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
                title="保存された設定（localStorage）をクリアして初期状態でリロード"
              >
                キャッシュ設定をクリアして再読込
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ページを再読み込み</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
