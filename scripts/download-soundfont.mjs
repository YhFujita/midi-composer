/**
 * FluidR3_GM.sf2 ダウンロードスクリプト
 * プロジェクトの public/soundfonts/ フォルダに直接ダウンロードして配置します。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.resolve(__dirname, '../public/soundfonts');
const TARGET_FILENAME = 'FluidR3_GM.sf2';
const TARGET_PATH = path.join(TARGET_DIR, TARGET_FILENAME);
const TEMP_PATH = `${TARGET_PATH}.tmp`;

const DOWNLOAD_URL = 'https://github.com/pianobooster/fluid-soundfont/releases/download/v3.1/FluidR3_GM.sf2';

// フォルダが存在しない場合は作成
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// 既に完全なファイルが存在する場合は確認
const force = process.argv.includes('--force');
if (fs.existsSync(TARGET_PATH) && !force) {
  const stats = fs.statSync(TARGET_PATH);
  if (stats.size > 140 * 1024 * 1024) {
    console.log(`[スキップ] ${TARGET_FILENAME} は既に存在します (${(stats.size / 1024 / 1024).toFixed(1)} MB)。`);
    console.log('再ダウンロードする場合は `npm run download:soundfont -- --force` を実行してください。');
    process.exit(0);
  }
}

console.log('====================================================');
console.log('MIDI Composer - 音源ダウンロードツール');
console.log('====================================================');
console.log(`音源名: FluidR3 GM (SoundFont 2)`);
console.log(`保存先: ${TARGET_PATH}`);
console.log(`ダウンロード元: ${DOWNLOAD_URL}`);
console.log('ダウンロードを開始します...\n');

function downloadFile(url, destPath, redirectCount = 0) {
  if (redirectCount > 10) {
    console.error('エラー: リダイレクト回数が上限を超えました。');
    process.exit(1);
  }

  const client = url.startsWith('https') ? https : http;

  client.get(url, (res) => {
    // 301, 302 リダイレクト対応
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      let redirectUrl = res.headers.location;
      if (!redirectUrl.startsWith('http')) {
        const parsed = new URL(url);
        redirectUrl = `${parsed.origin}${redirectUrl}`;
      }
      return downloadFile(redirectUrl, destPath, redirectCount + 1);
    }

    if (res.statusCode !== 200) {
      console.error(`エラー: ダウンロードに失敗しました (ステータスコード: ${res.statusCode})`);
      process.exit(1);
    }

    const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
    let downloadedBytes = 0;
    let lastLoggedPercent = -1;

    const fileStream = fs.createWriteStream(destPath);

    res.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      fileStream.write(chunk);

      if (totalBytes > 0) {
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);
        if (percent !== lastLoggedPercent) {
          lastLoggedPercent = percent;
          const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(1);
          const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
          const barLength = 30;
          const filled = Math.floor((percent / 100) * barLength);
          const bar = '■'.repeat(filled) + '░'.repeat(barLength - filled);
          process.stdout.write(`\r[${bar}] ${percent}% (${mbDownloaded} / ${mbTotal} MB)`);
        }
      } else {
        const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(1);
        process.stdout.write(`\rダウンロード中... ${mbDownloaded} MB`);
      }
    });

    res.on('end', () => {
      fileStream.end();
      if (fs.existsSync(TARGET_PATH)) {
        try {
          fs.unlinkSync(TARGET_PATH);
        } catch {}
      }
      fs.renameSync(destPath, TARGET_PATH);
      console.log('\n\n完了: FluidR3_GM.sf2 のダウンロードと配置が正常に完了しました！');
      console.log(`ファイルサイズ: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
      console.log('アプリ起動後、SoundFont設定から「FluidR3 GM」を選択してご利用いただけます。\n');
    });

    res.on('error', (err) => {
      fileStream.end();
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch {}
      }
      console.error('\nダウンロードエラー:', err.message);
      process.exit(1);
    });
  }).on('error', (err) => {
    console.error('\n接続エラー:', err.message);
    process.exit(1);
  });
}

downloadFile(DOWNLOAD_URL, TEMP_PATH);
