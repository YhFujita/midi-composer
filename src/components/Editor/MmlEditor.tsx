import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { ParseError } from '../../types/mml';
import { EditorToolbar } from './EditorToolbar';
import { InstrumentSelectorModal, InsertFormatType } from './InstrumentSelectorModal';
import { getInstrumentByProgram } from '../../constants/instruments';

interface MmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: ParseError[];
}

export const MmlEditor: React.FC<MmlEditorProps> = ({ value, onChange, errors }) => {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<any>(null);

  // 選択中の楽器・モーダル状態
  const [selectedProgram, setSelectedProgram] = useState<number>(0);
  const [isInstrumentModalOpen, setIsInstrumentModalOpen] = useState<boolean>(false);
  const [formatType, setFormatType] = useState<InsertFormatType>('with-comment');

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
  const updateErrorMarkers = useCallback(() => {
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
  }, [errors]);

  useEffect(() => {
    updateErrorMarkers();
  }, [updateErrorMarkers]);

  /**
   * 現在のカーソル位置（または選択範囲）へ構文エラーのない安全な形式で出力
   */
  const insertInstrumentCode = useCallback(
    (program: number, format: InsertFormatType = 'with-comment', trackNumber?: number) => {
      if (!editorRef.current || !monacoRef.current) return;
      const editor = editorRef.current;
      const model = editor.getModel();
      if (!model) return;

      const inst = getInstrumentByProgram(program);

      // 出力テキストの生成
      let baseCode = '';
      if (format === 'voice-only') {
        baseCode = `Voice(${program})`;
      } else if (format === 'with-track') {
        const tr = trackNumber || 1;
        baseCode = `TR(${tr}) Voice(${program}) /* ${inst.nameJa} */`;
      } else {
        // with-comment: インラインコメント形式で後続の音符を破壊しないように保護
        baseCode = `Voice(${program}) /* ${inst.nameJa} */`;
      }

      // 現在のカーソル位置または選択範囲を取得
      let selection = editor.getSelection();
      if (!selection) {
        // カーソルが未指定ならファイルの末尾を対象とする
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        selection = new monacoRef.current.Selection(lastLine, lastCol, lastLine, lastCol);
      }

      const startPos = selection.getStartPosition();
      const endPos = selection.getEndPosition();

      // 構文エラー防止のためのスマートスペーシング処理
      // 1. 直前の文字チェック: 空白・改行でなければ手前に半角スペースを付加
      let prefix = '';
      if (startPos.column > 1) {
        const charBefore = model.getValueInRange({
          startLineNumber: startPos.line,
          startColumn: startPos.column - 1,
          endLineNumber: startPos.line,
          endColumn: startPos.column,
        });
        if (charBefore && !/\s/.test(charBefore)) {
          prefix = ' ';
        }
      }

      // 2. 直後の文字チェック: 空白・改行でなければ後ろに半角スペースを付加
      let suffix = '';
      const lineMaxCol = model.getLineMaxColumn(endPos.line);
      if (endPos.column < lineMaxCol) {
        const charAfter = model.getValueInRange({
          startLineNumber: endPos.line,
          startColumn: endPos.column,
          endLineNumber: endPos.line,
          endColumn: endPos.column + 1,
        });
        if (charAfter && !/\s/.test(charAfter)) {
          suffix = ' ';
        }
      }

      const textToInsert = prefix + baseCode + suffix;

      // Monaco Editor の executeEdits でテキストを挿入/置換
      editor.executeEdits('instrument-output', [
        {
          range: selection,
          text: textToInsert,
          forceMoveMarkers: true,
        },
      ]);

      // カーソルを挿入したテキストの末尾に移動し、エディタにフォーカス
      editor.focus();
    },
    []
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#13141a] overflow-hidden">
      {/* エディタ上部ツールバー: 楽器選択・出力ボタン */}
      <EditorToolbar
        selectedProgram={selectedProgram}
        onSelectProgram={setSelectedProgram}
        onOpenModal={() => setIsInstrumentModalOpen(true)}
        onInsertToEditor={insertInstrumentCode}
        formatType={formatType}
        onChangeFormatType={setFormatType}
      />

      {/* Monaco Editor 本体 */}
      <div className="flex-1 overflow-hidden">
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

      {/* 楽器選択モーダルパレット */}
      <InstrumentSelectorModal
        isOpen={isInstrumentModalOpen}
        onClose={() => setIsInstrumentModalOpen(false)}
        currentProgram={selectedProgram}
        onSelectInstrument={setSelectedProgram}
        onInsertToEditor={insertInstrumentCode}
      />
    </div>
  );
};
