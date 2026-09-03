# モーダル / ダイアログ UI 設計規約 (Modal UI Design Guidelines)

本プロジェクト（MIDI Composer）におけるモーダル・ダイアログ・ポップアップコンポーネントを作成または修正する際の**絶対遵守ルールブック**です。
エージェントはモーダルを新設または改修する際、必ず本規約に従って実装してください。

---

## 1. 背景色の完全不透明・白地化（最重要原則）

モーダルの背後が透けて文字やUI要素が見づらくなる現象を完全に防止するため、以下の実装を徹底します。

* **モーダル本体（カード）は必ず完全不透明な白地（`#ffffff`）とする**:
  * Tailwindクラス: `bg-white`
  * インラインスタイル: `style={{ backgroundColor: '#ffffff', opacity: 1 }}`
  * **禁止事項**: `opacity` による透過、`bg-slate-900/80` や `bg-white/90` などの半透明カラー指定（slash opacity記法）をモーダルカード本体に適用すること。
* **背景オーバーレイ（バックドロップ）**:
  * クラス: `fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in`
  * スタイル: `style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}`
  * **禁止事項**: モーダル背後の `backdrop-blur`（ぼかし効果）は可読性を低下させるため使用しない。

---

## 2. コントラストと文字色（ライトテーマ統一）

白地背景の上で高い視認性を保つため、ダークスレート系の高コントラストな配色を使用します。

| 要素 | 推奨クラス | 備考 |
| :--- | :--- | :--- |
| **タイトル・見出し** | `text-slate-900 font-bold` | はっきり読める黒に近い色 |
| **本文・ラベル** | `text-slate-800 font-medium` | 十分な可読性を確保 |
| **補足説明・説明文** | `text-slate-600` | 視覚的階層を付けつつ読みやすく |
| **注記・メタ情報** | `text-slate-500 text-xs` | 日時やファイルサイズ等 |
| **プライマリアクション** | `bg-blue-600 hover:bg-blue-700 text-white font-bold` | 決定・挿入・保存等の主操作 |
| **セカンダリ / 閉じる** | `bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold` | キャンセル・閉じる等の副操作 |

---

## 3. 外枠・境界線・エレベーション

* **モーダル外枠**:
  * `border border-slate-300 rounded-2xl shadow-2xl`
* **区切り線**:
  * ヘッダー下: `border-b border-slate-200 bg-white`
  * フッター上: `border-t border-slate-200 bg-slate-50`
* **内部カード / グリッドアイテム**:
  * 通常: `bg-white border border-slate-200 hover:border-slate-300`
  * 選択中: `bg-blue-50 border-blue-500 ring-2 ring-blue-500`

---

## 4. レスポンシブとスクロール制御

* **幅制限**: 用途に応じて `max-w-xl`（設定・情報表示）または `max-w-4xl`（楽器一覧・一覧パレット）を指定。
* **高さ制限と内部スクロール**:
  * モーダル全体: `max-h-[90vh]` または `max-h-[85vh]`
  * コンテンツエリア: `overflow-y-auto max-h-[75vh]`（または `flex-1 overflow-y-auto`）を指定し、画面外にモーダルがあふれないようにする。

---

## 5. 標準モーダルコンポーネント・テンプレート

新規モーダルを作成する際は、必ず以下の構造をベースに実装してください。

```tsx
import React from 'react';
import { X } from 'lucide-react';

interface ExampleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExampleModal: React.FC<ExampleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      {/* モーダル本体: 背景を完全不透明白(#ffffff)にし、背後が一切透けないように設計 */}
      <div
        className="border border-slate-300 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-slate-900 bg-white animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white"
          style={{ backgroundColor: '#ffffff' }}
        >
          <h2 className="text-base font-bold text-slate-900">モーダルタイトル</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div
          className="p-6 space-y-4 overflow-y-auto max-h-[75vh]"
          style={{ backgroundColor: '#ffffff' }}
        >
          <p className="text-sm text-slate-700">コンテンツをここに配置します。</p>
        </div>

        {/* フッター */}
        <div
          className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-lg transition-colors border border-slate-300 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 6. 作成・修正完了前のセルフチェックリスト

モーダルコードを作成または更新した後は、完了とする前に必ず以下の点を確認してください：

- [ ] モーダルカード本体に `style={{ backgroundColor: '#ffffff', opacity: 1 }}` および `bg-white` が設定されているか？
- [ ] モーダル本体に透過処理（`opacity < 1` や `bg-xxx/80` 等）が含まれていないか？
- [ ] 背景オーバーレイに `backdrop-blur` を使用していないか？
- [ ] タイトルや本文の文字色は、白背景でもくっきり読める濃色（`text-slate-900`, `text-slate-800` 等）になっているか？
- [ ] 閉じるボタン（ヘッダー右上の×ボタンおよびフッターボタン）が機能しているか？
