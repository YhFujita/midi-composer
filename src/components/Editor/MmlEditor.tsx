import React, { useEffect, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { ParseError } from '../../types/mml';

interface MmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: ParseError[];
}

export const MmlEditor: React.FC<MmlEditorProps> = ({ value, onChange, errors }) => {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<any>(null);

  const handleEditorWillMount = (monaco: Monaco) => {
    monacoRef.current = monaco;

    // MML 言語が未登録なら登録
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'mml')) {
      monaco.languages.register({ id: 'mml' });

      monaco.languages.setMonarchTokensProvider('mml', {
        defaultToken: '',
        tokenPostfix: '.mml',

        keywords: [
          'TR', 'TRACK', 'CH', 'CHANNEL', 'VOICE', 'PROGRAM',
          'TEMPO', 'TIME', 'TIMESIGNATURE', 'OCTAVE', 'LENGTH', 'VOLUME'
        ],

        tokenizer: {
          root: [
            // コメント
            [/\/\/.*$/, 'comment'],
            [/;.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],

            // コマンドキーワード (TR, Voice, Tempo 等)
            [/[a-zA-Z]+\b(?=\s*[\(=])/, {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],

            // オクターブ・音長・音量などの短縮コマンド (o4, l8, v100, t120, >, <)
            [/[olvtOLVT]\d+/, 'type'],
            [/[><\(\)]/, 'operator'],

            // 音符 (c, d, e, f, g, a, b + 変化記号 + 音長)
            [/[a-gA-G][#\+\-_b]?\d*\.*(\^|&)?\d*\.*/, 'string'],

            // 休符 (r4, r8.)
            [/[rR]\d*\.*(\^|&)?\d*\.*/, 'number'],

            // 和音 [ceg]4
            [/\[[^\]]+\]\d*\.*/, 'variable'],

            // 小節区切りバー
            [/\|/, 'delimiter'],

            // 数値
            [/\d+/, 'number'],
          ],

          comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
          ]
        }
      });

      // カスタムテーマ設定
      monaco.editor.defineTheme('mml-dark-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
          { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
          { token: 'type', foreground: '4EC9B0', fontStyle: 'bold' },
          { token: 'string', foreground: 'CE9178', fontStyle: 'bold' }, // 音符
          { token: 'variable', foreground: 'DCDCAA' }, // 和音
          { token: 'number', foreground: 'B5CEA8' }, // 休符・数値
          { token: 'operator', foreground: 'C586C0' },
          { token: 'delimiter', foreground: '808080' }
        ],
        colors: {
          'editor.background': '#13141a',
          'editor.lineHighlightBackground': '#1e2029',
          'editorLineNumber.foreground': '#5c6370',
          'editorLineNumber.activeForeground': '#abb2bf',
        }
      });
    }
  };

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    updateErrorMarkers();
  };

  // パースエラーの波線マーカー更新
  const updateErrorMarkers = () => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const markers = errors.map((err) => ({
      startLineNumber: Math.max(1, err.line),
      startColumn: Math.max(1, err.column),
      endLineNumber: Math.max(1, err.line),
      endColumn: Math.max(1, err.column + 2),
      message: err.message,
      severity: monacoRef.current!.MarkerSeverity.Error,
    }));

    monacoRef.current.editor.setModelMarkers(model, 'mml-parser', markers);
  };

  useEffect(() => {
    updateErrorMarkers();
  }, [errors]);

  return (
    <div className="h-full w-full flex flex-col bg-[#13141a]">
      <Editor
        height="100%"
        defaultLanguage="mml"
        theme="mml-dark-theme"
        value={value}
        onChange={(val) => onChange(val || '')}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
        }}
      />
    </div>
  );
};
