/**
 * SoundFont のロード、IndexedDB キャッシュ、プリセットおよびローカル音源管理を行うマネージャー
 */

import { SOUNDFONT_PRESETS, SoundFontPreset } from '../../constants/soundfonts';

export interface SoundFontMeta {
  id: string;
  name: string;
  size: number;
  isDefault: boolean;
  updatedAt: number;
}

export type SoundFontLoadStatus = 'uninitialized' | 'loading' | 'ready' | 'error';

export interface SoundFontState {
  status: SoundFontLoadStatus;
  progress: number; // 0 - 100
  currentSoundFont: SoundFontMeta | null;
  errorMessage?: string;
}

type StateListener = (state: SoundFontState) => void;

const DB_NAME = 'midi_composer_soundfonts';
const DB_VERSION = 1;
const STORE_NAME = 'soundfonts';
const ACTIVE_SF2_STORAGE_KEY = 'midi_composer_active_sf2_id';
const DEFAULT_SF2_ID = 'timgm6mb_default';

class SoundFontManager {
  private state: SoundFontState = {
    status: 'uninitialized',
    progress: 0,
    currentSoundFont: null,
  };
  private listeners: Set<StateListener> = new Set();
  private dbPromise: Promise<IDBDatabase> | null = null;
  private currentBuffer: ArrayBuffer | null = null;

  constructor() {
    // 遅延初期化
  }

  public getState(): SoundFontState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  private updateState(partial: Partial<SoundFontState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  /**
   * IndexedDB インスタンスの取得
   */
  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        resolve((e.target as IDBOpenDBRequest).result);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * IndexedDB から SoundFont データを取得
   */
  public async getFromCache(id: string): Promise<{ meta: SoundFontMeta; buffer: ArrayBuffer } | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => {
          if (req.result) {
            resolve({
              meta: {
                id: req.result.id,
                name: req.result.name,
                size: req.result.size,
                isDefault: req.result.isDefault,
                updatedAt: req.result.updatedAt,
              },
              buffer: req.result.data,
            });
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * IndexedDB に SoundFont データを保存
   */
  private async saveToCache(meta: SoundFontMeta, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          ...meta,
          data: buffer,
        });

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to cache soundfont in IndexedDB:', e);
    }
  }

  /**
   * 保存されている全 SoundFont のメタデータを取得
   */
  public async listSavedSoundFonts(): Promise<SoundFontMeta[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = (req.result || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            size: r.size,
            isDefault: r.isDefault,
            updatedAt: r.updatedAt,
          }));
          resolve(results);
        };

        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * キャッシュされたカスタム SoundFont を削除
   */
  public async deleteSoundFont(id: string): Promise<void> {
    if (id === DEFAULT_SF2_ID) return; // デフォルトは削除不可
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      // 削除対象が現在使用中ならデフォルトに戻す
      if (this.state.currentSoundFont?.id === id) {
        await this.loadDefaultSoundFont();
      }
    } catch (e) {
      console.error('Delete soundfont error:', e);
    }
  }

  /**
   * ストリーミングダウンロード共通関数
   */
  private async fetchBufferWithProgress(url: string, estimatedTotalBytes: number): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ダウンロードに失敗しました (ステータス: ${response.status} ${response.statusText})`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : estimatedTotalBytes;

    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const pct = Math.min(98, Math.round(15 + (receivedBytes / totalBytes) * 80));
        this.updateState({ progress: pct });
      }

      const totalBuffer = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        totalBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      return totalBuffer.buffer;
    } else {
      return await response.arrayBuffer();
    }
  }

  /**
   * プリセット音源のローカル存在とキャッシュ状態を確認
   */
  public async checkPresetStatus(preset: SoundFontPreset): Promise<{ isLocal: boolean; isCached: boolean }> {
    // 1. キャッシュの確認
    const cached = await this.getFromCache(preset.id);
    const isCached = !!(cached && cached.buffer && cached.buffer.byteLength > 0);

    // 2. ローカルフォルダ (public/soundfonts/...) の確認
    let isLocal = false;
    try {
      const res = await fetch(preset.localUrl, { method: 'HEAD' });
      isLocal = res.ok;
    } catch {
      isLocal = false;
    }

    return { isLocal, isCached };
  }

  /**
   * プリセット SoundFont のロード
   */
  public async loadPresetSoundFont(preset: SoundFontPreset): Promise<ArrayBuffer> {
    this.updateState({ status: 'loading', progress: 10, errorMessage: undefined });

    // 1. まず IndexedDB キャッシュを確認
    const cached = await this.getFromCache(preset.id);
    if (cached && cached.buffer && cached.buffer.byteLength > 0) {
      this.currentBuffer = cached.buffer;
      this.updateState({
        status: 'ready',
        progress: 100,
        currentSoundFont: cached.meta,
      });
      try {
        localStorage.setItem(ACTIVE_SF2_STORAGE_KEY, preset.id);
      } catch {}
      return cached.buffer;
    }

    // 2. ローカルフォルダ (public/soundfonts/) から取得を試行
    try {
      this.updateState({ progress: 15 });
      const buffer = await this.fetchBufferWithProgress(preset.localUrl, preset.size);

      const meta: SoundFontMeta = {
        id: preset.id,
        name: preset.name,
        size: buffer.byteLength,
        isDefault: !!preset.isDefault,
        updatedAt: Date.now(),
      };

      // IndexedDB に保存
      await this.saveToCache(meta, buffer);

      this.currentBuffer = buffer;
      this.updateState({
        status: 'ready',
        progress: 100,
        currentSoundFont: meta,
      });
      try {
        localStorage.setItem(ACTIVE_SF2_STORAGE_KEY, preset.id);
      } catch {}
      return buffer;
    } catch (localErr: any) {
      console.warn(`ローカルフォルダ (${preset.localUrl}) からの取得失敗、外部URLの確認へ:`, localErr);

      // 3. 外部オンラインURLが指定されている場合はそちらを試行
      if (preset.onlineDownloadUrl) {
        try {
          this.updateState({ progress: 15 });
          const buffer = await this.fetchBufferWithProgress(preset.onlineDownloadUrl, preset.size);

          const meta: SoundFontMeta = {
            id: preset.id,
            name: preset.name,
            size: buffer.byteLength,
            isDefault: !!preset.isDefault,
            updatedAt: Date.now(),
          };

          await this.saveToCache(meta, buffer);

          this.currentBuffer = buffer;
          this.updateState({
            status: 'ready',
            progress: 100,
            currentSoundFont: meta,
          });
          try {
            localStorage.setItem(ACTIVE_SF2_STORAGE_KEY, preset.id);
          } catch {}
          return buffer;
        } catch (onlineErr: any) {
          const msg = `「${preset.name}」の読み込みに失敗しました。プロジェクトの public/soundfonts/ フォルダに「${preset.filename}」を配置するか、ターミナルで npm run download:soundfont を実行してください。`;
          this.updateState({ status: 'error', progress: 0, errorMessage: msg });
          throw new Error(msg);
        }
      }

      const msg = `音源ファイル「${preset.filename}」が見つかりませんでした。`;
      this.updateState({ status: 'error', progress: 0, errorMessage: msg });
      throw new Error(msg);
    }
  }

  /**
   * デフォルトの SoundFont (TimGM6mb.sf2) をロード
   */
  public async loadDefaultSoundFont(): Promise<ArrayBuffer> {
    const defaultPreset = SOUNDFONT_PRESETS.find((p) => p.id === DEFAULT_SF2_ID) || SOUNDFONT_PRESETS[0];
    return this.loadPresetSoundFont(defaultPreset);
  }

  /**
   * 起動時に保存されていたアクティブ音源（またはデフォルト）をロード
   */
  public async initActiveSoundFont(): Promise<ArrayBuffer> {
    let savedId: string | null = null;
    try {
      savedId = localStorage.getItem(ACTIVE_SF2_STORAGE_KEY);
    } catch {}

    if (savedId) {
      // プリセットか確認
      const preset = SOUNDFONT_PRESETS.find((p) => p.id === savedId);
      if (preset) {
        try {
          return await this.loadPresetSoundFont(preset);
        } catch (e) {
          console.warn(`前回保存されたプリセット (${savedId}) の復元に失敗したため、デフォルト音源に切り替えます`, e);
        }
      } else {
        // カスタム音源か確認
        const cached = await this.getFromCache(savedId);
        if (cached && cached.buffer) {
          this.currentBuffer = cached.buffer;
          this.updateState({
            status: 'ready',
            progress: 100,
            currentSoundFont: cached.meta,
          });
          return cached.buffer;
        }
      }
    }

    return this.loadDefaultSoundFont();
  }

  /**
   * ユーザー指定のカスタム SoundFont (.sf2 / .sf3) を読み込み
   */
  public async loadCustomSoundFont(file: File): Promise<ArrayBuffer> {
    this.updateState({ status: 'loading', progress: 30, errorMessage: undefined });
    try {
      const buffer = await file.arrayBuffer();
      const meta: SoundFontMeta = {
        id: `custom_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        name: file.name,
        size: buffer.byteLength,
        isDefault: false,
        updatedAt: Date.now(),
      };

      // IndexedDB に保存
      await this.saveToCache(meta, buffer);

      this.currentBuffer = buffer;
      this.updateState({
        status: 'ready',
        progress: 100,
        currentSoundFont: meta,
      });

      try {
        localStorage.setItem(ACTIVE_SF2_STORAGE_KEY, meta.id);
      } catch {}

      return buffer;
    } catch (err: any) {
      const msg = err?.message || 'カスタムSoundFontの読み込みに失敗しました';
      this.updateState({
        status: 'error',
        errorMessage: msg,
      });
      throw err;
    }
  }

  /**
   * 保存済み / プリセット SoundFont に切り替え
   */
  public async switchToSoundFont(id: string): Promise<ArrayBuffer> {
    const preset = SOUNDFONT_PRESETS.find((p) => p.id === id);
    if (preset) {
      return this.loadPresetSoundFont(preset);
    }

    const item = await this.getFromCache(id);
    if (!item) {
      throw new Error('指定されたSoundFontが見つかりません');
    }
    this.currentBuffer = item.buffer;
    this.updateState({
      status: 'ready',
      progress: 100,
      currentSoundFont: item.meta,
    });

    try {
      localStorage.setItem(ACTIVE_SF2_STORAGE_KEY, id);
    } catch {}

    return item.buffer;
  }

  /**
   * 現在保持している ArrayBuffer を取得
   */
  public getCurrentBuffer(): ArrayBuffer | null {
    return this.currentBuffer;
  }
}

export const soundFontManager = new SoundFontManager();
