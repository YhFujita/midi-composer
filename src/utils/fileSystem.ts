// File System Access API & フォールバックによるファイル入出力

export interface FileHandleHolder {
  handle: FileSystemFileHandle | null;
  filename: string;
}

/**
 * ローカルのテキストファイル（.mml, .txt 等）を開く
 */
export async function openMmlFile(): Promise<{ content: string; filename: string; handle: FileSystemFileHandle | null }> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'MML 音楽ファイル (*.mml, *.txt, *.sakura)',
            accept: {
              'text/plain': ['.mml', '.txt', '.sakura'],
            },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      const content = await file.text();
      return { content, filename: file.name, handle };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      // フォールバックへ
    }
  }

  // フォールバック: input[type=file]
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mml,.txt,.sakura,text/plain';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('ファイルが選択されませんでした'));
        return;
      }
      const content = await file.text();
      resolve({ content, filename: file.name, handle: null });
    };

    input.oncancel = () => {
      reject(new DOMException('キャンセルされました', 'AbortError'));
    };

    input.click();
  });
}

/**
 * ファイルを保存（上書きまたは新規保存）
 */
export async function saveMmlFile(
  content: string,
  currentHandle: FileSystemFileHandle | null,
  defaultFilename = 'composition.mml'
): Promise<{ handle: FileSystemFileHandle | null; filename: string }> {
  // すでにファイルハンドルがある場合は上書き保存
  if (currentHandle && 'createWritable' in currentHandle) {
    try {
      const writable = await (currentHandle as any).createWritable();
      await writable.write(content);
      await writable.close();
      const file = await currentHandle.getFile();
      return { handle: currentHandle, filename: file.name };
    } catch (err: any) {
      console.warn('上書き保存に失敗したため新規保存ダイアログを開きます:', err);
    }
  }

  // 名前を付けて保存
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: 'MML 音楽ファイル (*.mml)',
            accept: {
              'text/plain': ['.mml'],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      const file = await handle.getFile();
      return { handle, filename: file.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
    }
  }

  // フォールバック: Blob ダウンロード
  downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), defaultFilename);
  return { handle: null, filename: defaultFilename };
}

/**
 * 任意の Blob をダウンロード保存する汎用関数
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
