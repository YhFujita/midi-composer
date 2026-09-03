import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header, LayoutOrientation } from './components/Layout/Header';
import { ControlBar } from './components/Transport/ControlBar';
import { MmlEditor, CursorPosition, MmlEditorActions } from './components/Editor/MmlEditor';
import { SheetMusic } from './components/Score/SheetMusic';
import { PianoKeyboardPanel } from './components/Keyboard/PianoKeyboardPanel';
import { MmlGuideModal } from './components/Editor/MmlGuideModal';
import { SoundFontModal } from './components/SoundFont/SoundFontModal';
import { MidiImportModal } from './components/MidiImport/MidiImportModal';
import { parseMML, findBeatAtCursor } from './core/parser/mmlParser';
import { generateMidiBlob } from './core/midi/midiGenerator';
import { parseMidiFile, ParsedMidiData } from './core/midi/midiParser';
import { convertMidiToMml } from './core/midi/midiToMml';
import { audioEngine } from './core/audio/soundFontPlayer';
import { exportToMp3 } from './core/audio/mp3Exporter';
import { openMmlFile, openMidiFile, saveMmlFile, downloadBlob } from './utils/fileSystem';
import { PRESET_SONGS } from './constants/presets';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';

export const App: React.FC = () => {
  // 初期コードはきらきら星プリセット
  const [mmlText, setMmlText] = useState<string>(PRESET_SONGS[0].mml);
  const [currentFilename, setCurrentFilename] = useState<string>('twinkle_star.mml');
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

  // MIDIインポート状態
  const [isMidiModalOpen, setIsMidiModalOpen] = useState(false);
  const [importedMidiData, setImportedMidiData] = useState<ParsedMidiData | null>(null);
  const [importedMidiFilename, setImportedMidiFilename] = useState<string>('');

  // エディタのテキストカーソル位置
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ lineNumber: 1, column: 1 });

  // ピアノ鍵盤パネル表示状態
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  // 選択中の楽器 (エディタ・鍵盤共有)
  const [selectedProgram, setSelectedProgram] = useState<number>(0);
  // エディタアクションref (音符挿入・削除用)
  const editorActionsRef = React.useRef<MmlEditorActions | null>(null);

  // レイアウト分割方向 ('horizontal': 左右分割, 'vertical': 上下分割)
  const [layoutOrientation, setLayoutOrientation] = useState<LayoutOrientation>(() => {
    const saved = localStorage.getItem('midi_composer_layout');
    return saved === 'vertical' ? 'vertical' : 'horizontal';
  });

  const handleLayoutChange = useCallback((layout: LayoutOrientation) => {
    setLayoutOrientation(layout);
    localStorage.setItem('midi_composer_layout', layout);
  }, []);

  // 再生状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [totalDurationSec, setTotalDurationSec] = useState(0);

  // MP3書き出し状態
  const [isExportingMp3, setIsExportingMp3] = useState(false);
  const [mp3Progress, setMp3Progress] = useState(0);

  // ガイドモーダル
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // SoundFont設定モーダル
  const [isSoundFontModalOpen, setIsSoundFontModalOpen] = useState(false);

  // 全体移調 (半音単位, 例: -1 で短2度下げ)
  const [globalKeyShift, setGlobalKeyShift] = useState<number>(0);

  // MML パース処理 (メモ化: MMLテキストまたは全体移調が変更されたら再計算)
  const parsedScore = useMemo(() => {
    return parseMML(mmlText, { globalKeyShift });
  }, [mmlText, globalKeyShift]);

  // 全体移調変更ハンドラ (再生中の場合はシームレスに移調後のスコアで継続再生)
  const handleKeyShiftChange = useCallback(
    (newShift: number) => {
      setGlobalKeyShift(newShift);
      if (isPlaying) {
        const newScore = parseMML(mmlText, { globalKeyShift: newShift });
        audioEngine.play(newScore, currentTimeSec);
      }
    },
    [isPlaying, mmlText, currentTimeSec]
  );

  // オーディオコールバック登録
  useEffect(() => {
    audioEngine.setCallbacks({
      onProgress: (currentSec, beat, totalSec) => {
        setCurrentTimeSec(currentSec);
        setCurrentBeat(beat);
        setTotalDurationSec(totalSec);
      },
      onEnded: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
    });
  }, []);

  // カーソル位置に対応する再生秒数
  const cursorPlaybackSec = useMemo(() => {
    const beat = findBeatAtCursor(parsedScore.timelineItems, cursorPosition.lineNumber, cursorPosition.column);
    return audioEngine.calculateBeatToSec(parsedScore, beat);
  }, [parsedScore, cursorPosition]);

  // 最初から再生
  const handlePlayFromStart = useCallback(() => {
    const totalNotes = parsedScore.tracks.reduce((sum, tr) => sum + tr.notes.length, 0);
    if (totalNotes === 0) {
      alert('再生できる有効な音符がありません。MMLエディタを確認してください。');
      return;
    }
    audioEngine.play(parsedScore, 0);
    setIsPlaying(true);
    setIsPaused(false);
  }, [parsedScore]);

  // 途中から再生 (テキストカーソルの位置から再生)
  const handlePlayFromCursor = useCallback(() => {
    const totalNotes = parsedScore.tracks.reduce((sum, tr) => sum + tr.notes.length, 0);
    if (totalNotes === 0) {
      alert('再生できる有効な音符がありません。MMLエディタを確認してください。');
      return;
    }
    const beat = findBeatAtCursor(parsedScore.timelineItems, cursorPosition.lineNumber, cursorPosition.column);
    const sec = audioEngine.calculateBeatToSec(parsedScore, beat);
    audioEngine.play(parsedScore, sec);
    setIsPlaying(true);
    setIsPaused(false);
  }, [parsedScore, cursorPosition]);

  // 再開 (一時停止位置から)
  const handlePlay = useCallback(() => {
    const totalNotes = parsedScore.tracks.reduce((sum, tr) => sum + tr.notes.length, 0);
    if (totalNotes === 0) {
      alert('再生できる有効な音符がありません。MMLエディタを確認してください。');
      return;
    }
    // 常に最新の parsedScore を渡して再生（編集した音色が確実に反映される）
    audioEngine.play(parsedScore, currentTimeSec);
    setIsPlaying(true);
    setIsPaused(false);
  }, [parsedScore, currentTimeSec]);

  // 一時停止
  const handlePause = useCallback(() => {
    audioEngine.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  // 停止
  const handleStop = useCallback(() => {
    audioEngine.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTimeSec(0);
    setCurrentBeat(0);
  }, []);

  // シーク
  const handleSeek = useCallback(
    (sec: number) => {
      setCurrentTimeSec(sec);
      audioEngine.seek(sec);
    },
    []
  );

  // 新規作成
  const handleNew = useCallback(() => {
    if (window.confirm('新しいファイルを作成しますか？未保存の変更は失われます。')) {
      handleStop();
      setGlobalKeyShift(0);
      setMmlText('// 新規 MML 作成\nTempo(120)\nTimeSignature(4,4)\n\nTR(1) Voice(0) o4 l4\nc d e f g a b > c <\n');
      setCurrentFilename('new_song.mml');
      setFileHandle(null);
    }
  }, [handleStop]);

  // ファイルを開く
  const handleOpen = useCallback(async () => {
    try {
      const fileData = await openMmlFile();
      handleStop();
      setGlobalKeyShift(0);
      setMmlText(fileData.content);
      setCurrentFilename(fileData.filename);
      setFileHandle(fileData.handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('ファイル読み込みエラー:', err);
      }
    }
  }, [handleStop]);

  // MIDI ファイルを開く
  const handleOpenMidi = useCallback(async () => {
    try {
      const { buffer, filename } = await openMidiFile();
      const midiData = parseMidiFile(buffer);
      setImportedMidiData(midiData);
      setImportedMidiFilename(filename);
      setIsMidiModalOpen(true);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('MIDI読み込みエラー:', err);
        alert(`MIDIファイルの解析に失敗しました: ${err.message || err}`);
      }
    }
  }, []);

  // MIDI インポート確定
  const handleConfirmMidiImport = useCallback(
    (selectedTrackIds: number[], quantizeResolution: number) => {
      if (!importedMidiData) return;
      try {
        handleStop();
        setGlobalKeyShift(0);
        const songTitle = importedMidiFilename.replace(/\.[^/.]+$/, '');
        const generatedMml = convertMidiToMml(importedMidiData, {
          selectedTrackIds,
          quantizeResolution,
          songTitle,
        });

        setMmlText(generatedMml);
        const newMmlFilename = `${songTitle}.mml`;
        setCurrentFilename(newMmlFilename);
        setFileHandle(null);
      } catch (err: any) {
        console.error('MML変換エラー:', err);
        alert(`MML変換に失敗しました: ${err.message || err}`);
      }
    },
    [importedMidiData, importedMidiFilename, handleStop]
  );

  // ドラッグ＆ドロップ処理
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.mid') || lowerName.endsWith('.midi')) {
        try {
          const buffer = await file.arrayBuffer();
          const midiData = parseMidiFile(buffer);
          setImportedMidiData(midiData);
          setImportedMidiFilename(file.name);
          setIsMidiModalOpen(true);
        } catch (err: any) {
          console.error('MIDI読み込みエラー:', err);
          alert(`MIDIファイルの解析に失敗しました: ${err.message || err}`);
        }
      } else if (lowerName.endsWith('.mml') || lowerName.endsWith('.txt') || lowerName.endsWith('.sakura')) {
        try {
          const content = await file.text();
          handleStop();
          setGlobalKeyShift(0);
          setMmlText(content);
          setCurrentFilename(file.name);
          setFileHandle(null);
        } catch (err: any) {
          console.error('MML読み込みエラー:', err);
          alert(`ファイルの読み込みに失敗しました: ${err.message || err}`);
        }
      }
    },
    [handleStop]
  );

  // 保存
  const handleSave = useCallback(async () => {
    try {
      const result = await saveMmlFile(mmlText, fileHandle, currentFilename);
      if (result.handle) setFileHandle(result.handle);
      setCurrentFilename(result.filename);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('保存エラー:', err);
      }
    }
  }, [mmlText, fileHandle, currentFilename]);

  // 名前を付けて保存
  const handleSaveAs = useCallback(async () => {
    try {
      const result = await saveMmlFile(mmlText, null, currentFilename);
      if (result.handle) setFileHandle(result.handle);
      setCurrentFilename(result.filename);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('保存エラー:', err);
      }
    }
  }, [mmlText, currentFilename]);

  // MIDI エクスポート
  const handleExportMidi = useCallback(() => {
    try {
      const midiBlob = generateMidiBlob(parsedScore);
      const baseName = currentFilename.replace(/\.[^/.]+$/, '');
      downloadBlob(midiBlob, `${baseName}.mid`);
    } catch (err) {
      console.error('MIDI出力エラー:', err);
      alert('MIDIファイルの生成中にエラーが発生しました。');
    }
  }, [parsedScore, currentFilename]);

  // MP3 エクスポート
  const handleExportMp3 = useCallback(async () => {
    try {
      setIsExportingMp3(true);
      setMp3Progress(0);
      const mp3Blob = await exportToMp3(parsedScore, (percent) => {
        setMp3Progress(percent);
      });
      const baseName = currentFilename.replace(/\.[^/.]+$/, '');
      downloadBlob(mp3Blob, `${baseName}.mp3`);
    } catch (err) {
      console.error('MP3書き出しエラー:', err);
      alert('MP3ファイルの生成中にエラーが発生しました。');
    } finally {
      setIsExportingMp3(false);
    }
  }, [parsedScore, currentFilename]);

  // プリセット読み込み
  const handleLoadPreset = useCallback(
    (mml: string) => {
      handleStop();
      setGlobalKeyShift(0);
      setMmlText(mml);
    },
    [handleStop]
  );

  // MML編集ハンドラ (編集時は一時停止状態をリセットし、常に最新の編集内容で再生できるようにする)
  const handleMmlChange = useCallback((newText: string) => {
    setMmlText(newText);
    setIsPaused(false);
  }, []);

  // ショートカットキー (Ctrl+S で保存)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const isHorizontal = layoutOrientation === 'horizontal';

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ヘッダー */}
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSoundFontModal={() => setIsSoundFontModalOpen(true)}
        layoutOrientation={layoutOrientation}
        onChangeLayout={handleLayoutChange}
      />

      {/* コントロールバー (再生・停止・エクスポート・ファイル操作・移調) */}
      <ControlBar
        score={parsedScore}
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        currentFilename={currentFilename}
        onPlay={handlePlay}
        onPlayFromStart={handlePlayFromStart}
        onPlayFromCursor={handlePlayFromCursor}
        cursorPlaybackTimeSec={cursorPlaybackSec}
        cursorLineNumber={cursorPosition.lineNumber}
        onPause={handlePause}
        onStop={handleStop}
        onSeek={handleSeek}
        onNew={handleNew}
        onOpen={handleOpen}
        onImportMidi={handleOpenMidi}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportMidi={handleExportMidi}
        onExportMp3={handleExportMp3}
        onLoadPreset={handleLoadPreset}
        isExportingMp3={isExportingMp3}
        mp3Progress={mp3Progress}
        globalKeyShift={globalKeyShift}
        onChangeGlobalKeyShift={handleKeyShiftChange}
      />

      {/* メインエリア: 分割レイアウト (左右分割 または 上下分割) */}
      <div
        className={`flex-1 flex ${
          isHorizontal ? 'flex-row' : 'flex-col'
        } overflow-hidden relative print:block print:w-full print:h-auto print:overflow-visible`}
      >
        {/* エディタペイン: Monaco Editor + エラーステータス */}
        <div
          className={`no-print flex flex-col ${
            isHorizontal
              ? 'w-1/2 h-full border-r border-slate-800'
              : 'w-full h-1/2 border-b border-slate-800'
          }`}
        >
          <div className="flex-1 overflow-hidden">
            <MmlEditor
              value={mmlText}
              onChange={handleMmlChange}
              errors={parsedScore.errors}
              onCursorChange={setCursorPosition}
              selectedProgram={selectedProgram}
              onSelectProgram={setSelectedProgram}
              isKeyboardOpen={isKeyboardOpen}
              onToggleKeyboard={() => setIsKeyboardOpen((prev) => !prev)}
              editorActionsRef={editorActionsRef}
            />
          </div>

          {/* フッター: エラー・パース状態バー & カーソル位置 */}
          <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
            {parsedScore.errors.length > 0 ? (
              <div className="flex items-center space-x-1.5 text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  エラー: 行 {parsedScore.errors[0].line} - {parsedScore.errors[0].message}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>MML 構文正常 ({parsedScore.tracks.length} トラック, 総拍数: {parsedScore.totalDuration.toFixed(1)})</span>
              </div>
            )}
            <div className="flex items-center space-x-3 text-slate-400 font-mono text-[11px]">
              <span>行 {cursorPosition.lineNumber}, 列 {cursorPosition.column}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">UTF-8</span>
            </div>
          </div>
        </div>

        {/* 楽譜ペイン: 五線譜ビューア (A4印刷対応) */}
        <div
          className={`${
            isHorizontal ? 'w-1/2 h-full' : 'w-full h-1/2'
          } overflow-hidden flex flex-col print:block print:w-full print:h-auto print:overflow-visible`}
        >
          <SheetMusic
            score={parsedScore}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
          />
        </div>
      </div>

      {/* バーチャルピアノ鍵盤パネル (全幅ドック) */}
      <PianoKeyboardPanel
        isOpen={isKeyboardOpen}
        onClose={() => setIsKeyboardOpen(false)}
        onInsertText={(text) => editorActionsRef.current?.insertText(text)}
        onBackspace={() => editorActionsRef.current?.deleteBackward()}
        currentProgram={selectedProgram}
      />

      {/* MML記法リファレンスモーダル */}
      <MmlGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* SoundFont (MIDI音源) 設定モーダル */}
      <SoundFontModal
        isOpen={isSoundFontModalOpen}
        onClose={() => setIsSoundFontModalOpen(false)}
      />

      {/* MIDIインポート設定モーダル */}
      <MidiImportModal
        isOpen={isMidiModalOpen}
        onClose={() => setIsMidiModalOpen(false)}
        midiData={importedMidiData}
        filename={importedMidiFilename}
        onImport={handleConfirmMidiImport}
      />

      {/* ドラッグ＆ドロップ オーバーレイ表示 */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-blue-950/60 border-4 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="bg-white text-slate-900 px-8 py-6 rounded-2xl shadow-2xl flex items-center space-x-4 border border-blue-500 animate-in zoom-in-95 duration-150">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <Upload className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">ファイルをドロップしてインポート</div>
              <div className="text-xs text-slate-600 mt-0.5">
                MIDI (.mid / .midi) または MML (.mml / .txt) に対応
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

