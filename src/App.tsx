import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Layout/Header';
import { ControlBar } from './components/Transport/ControlBar';
import { MmlEditor } from './components/Editor/MmlEditor';
import { SheetMusic } from './components/Score/SheetMusic';
import { MmlGuideModal } from './components/Editor/MmlGuideModal';
import { parseMML } from './core/parser/mmlParser';
import { generateMidiBlob } from './core/midi/midiGenerator';
import { audioEngine } from './core/audio/soundFontPlayer';
import { exportToMp3 } from './core/audio/mp3Exporter';
import { openMmlFile, saveMmlFile, downloadBlob } from './utils/fileSystem';
import { PRESET_SONGS } from './constants/presets';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  // 初期コードはきらきら星プリセット
  const [mmlText, setMmlText] = useState<string>(PRESET_SONGS[0].mml);
  const [currentFilename, setCurrentFilename] = useState<string>('twinkle_star.mml');
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

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

  // MML パース処理 (メモ化)
  const parsedScore = useMemo(() => {
    return parseMML(mmlText);
  }, [mmlText]);

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

  // 再生
  const handlePlay = useCallback(() => {
    const totalNotes = parsedScore.tracks.reduce((sum, tr) => sum + tr.notes.length, 0);
    if (totalNotes === 0) {
      alert('再生できる有効な音符がありません。MMLエディタを確認してください。');
      return;
    }
    if (isPaused) {
      audioEngine.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      audioEngine.play(parsedScore, currentTimeSec);
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [parsedScore, isPaused, currentTimeSec]);

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
      setMmlText(fileData.content);
      setCurrentFilename(fileData.filename);
      setFileHandle(fileData.handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('ファイル読み込みエラー:', err);
      }
    }
  }, [handleStop]);

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
      setMmlText(mml);
    },
    [handleStop]
  );

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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ヘッダー */}
      <Header onOpenGuide={() => setIsGuideOpen(true)} />

      {/* コントロールバー (再生・停止・エクスポート・ファイル操作) */}
      <ControlBar
        score={parsedScore}
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        currentFilename={currentFilename}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSeek={handleSeek}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportMidi={handleExportMidi}
        onExportMp3={handleExportMp3}
        onLoadPreset={handleLoadPreset}
        isExportingMp3={isExportingMp3}
        mp3Progress={mp3Progress}
      />

      {/* メインエリア: 2分割レイアウト (左: MMLエディタ, 右: 五線譜ビュー) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* 左ペイン: Monaco Editor + エラーステータス */}
        <div className="no-print w-full md:w-1/2 h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-slate-800">
          <div className="flex-1 overflow-hidden">
            <MmlEditor
              value={mmlText}
              onChange={setMmlText}
              errors={parsedScore.errors}
            />
          </div>

          {/* フッター: エラー・パース状態バー */}
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
            <span className="text-slate-500 font-mono text-[11px]">UTF-8</span>
          </div>
        </div>

        {/* 右ペイン: 五線譜ビューア (A4印刷対応) */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-hidden flex flex-col">
          <SheetMusic
            score={parsedScore}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
          />
        </div>
      </div>

      {/* MML記法リファレンスモーダル */}
      <MmlGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
};

export default App;
