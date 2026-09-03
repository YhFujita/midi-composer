import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header, LayoutOrientation } from './components/Layout/Header';
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

  // 再生
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ヘッダー */}
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
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

      {/* MML記法リファレンスモーダル */}
      <MmlGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
};

export default App;

