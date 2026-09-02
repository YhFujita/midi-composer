import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { ParseError } from '../../types/mml';
import { EditorToolbar } from './EditorToolbar';
import { InstrumentSelectorModal, InsertFormatType } from './InstrumentSelectorModal';
import { ChordInputModal } from './ChordInputModal';
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
  const [isChordModalOpen, setIsChordModalOpen] = useState<boolean>(false);
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

      let targetRange = selection;
      let textToInsert = baseCode;

      // 選択範囲が空（単なるカーソル）の場合、現在の行内に既存の Voice コマンドがあるか検査
      if (selection.isEmpty()) {
        const lineNumber = selection.startLineNumber;
        const lineContent = model.getLineContent(lineNumber);

        // 例: Voice(0), Voice(48) /* ... */, @0 などを検出
        const voiceRegex = /(?:Voice|Program)\s*\(\s*\d+\s*\)(?:\s*\/\*.*?\*\/)?|@\s*\d+/i;
        const match = lineContent.match(voiceRegex);

        if (match && match.index !== undefined) {
          const matchStartCol = match.index + 1;
          const matchEndCol = matchStartCol + match[0].length;

          // カーソルがその行にある場合は、既存の Voice コマンドを置換対象にする
          targetRange = new monacoRef.current.Range(
            lineNumber,
            matchStartCol,
            lineNumber,
            matchEndCol
          );
          textToInsert = baseCode;
        } else {
          // 既存のVoiceがない場合は、カーソル前後のスマートスペーシング
          const startPos = selection.getStartPosition();
          const endPos = selection.getEndPosition();

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

          textToInsert = prefix + baseCode + suffix;
        }
      }

      // Monaco Editor の executeEdits でテキストを挿入/置換
      editor.executeEdits('instrument-output', [
        {
          range: targetRange,
          text: textToInsert,
          forceMoveMarkers: true,
        },
      ]);

      // カーソルを挿入したテキストの末尾に移動し、エディタにフォーカス
      editor.focus();
    },
    []
  );

  // コード簡易入力モーダルからの和音MML挿入処理
  const insertChordCode = useCallback((mmlChordText: string) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const targetRange = selection;
    let textToInsert = mmlChordText;

    // 前後のスマートスペーシング
    if (selection.isEmpty()) {
      const startPos = selection.getStartPosition();
      const endPos = selection.getEndPosition();

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

      textToInsert = prefix + mmlChordText + suffix;
    }

    editor.executeEdits('chord-insert', [
      {
        range: targetRange,
        text: textToInsert,
        forceMoveMarkers: true,
      },
    ]);

    editor.focus();
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-[#13141a] overflow-hidden">
      {/* エディタ上部ツールバー: 楽器選択・コード入力・出力ボタン */}
      <EditorToolbar
        selectedProgram={selectedProgram}
        onSelectProgram={setSelectedProgram}
        onOpenModal={() => setIsInstrumentModalOpen(true)}
        onOpenChordModal={() => setIsChordModalOpen((prev) => !prev)}
        isChordModalOpen={isChordModalOpen}
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

      {/* コード簡易入力モーダルパレット */}
      <ChordInputModal
        isOpen={isChordModalOpen}
        onClose={() => setIsChordModalOpen(false)}
        onInsertChord={insertChordCode}
        currentProgram={selectedProgram}
      />
    </div>
  );
};
