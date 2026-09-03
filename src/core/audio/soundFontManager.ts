/**
 * SoundFont のロード、IndexedDB キャッシュ、カスタム音源管理を行うマネージャー
 */

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
const DEFAULT_SF2_URL = '/soundfonts/TimGM6mb.sf2';
const DEFAULT_SF2_ID = 'timgm6mb_default';
const DEFAULT_SF2_NAME = 'TimGM6mb (内蔵 GM音源)';

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
  private async getFromCache(id: string): Promise<{ meta: SoundFontMeta; buffer: ArrayBuffer } | null> {
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
   * デフォルトの SoundFont (TimGM6mb.sf2) をロード
   */
  public async loadDefaultSoundFont(): Promise<ArrayBuffer> {
    this.updateState({ status: 'loading', progress: 10, errorMessage: undefined });

    // 1. まず IndexedDB キャッシュを確認
    const cached = await this.getFromCache(DEFAULT_SF2_ID);
    if (cached && cached.buffer && cached.buffer.byteLength > 0) {
      this.currentBuffer = cached.buffer;
      this.updateState({
        status: 'ready',
        progress: 100,
        currentSoundFont: cached.meta,
      });
      return cached.buffer;
    }

    // 2. キャッシュにない場合はネットワークからダウンロード
    try {
      this.updateState({ progress: 20 });
      const response = await fetch(DEFAULT_SF2_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch soundfont: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 6000000;

      let buffer: ArrayBuffer;
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;
          const pct = Math.min(95, Math.round(20 + (receivedBytes / totalBytes) * 75));
          this.updateState({ progress: pct });
        }

        const totalBuffer = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          totalBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        buffer = totalBuffer.buffer;
      } else {
        buffer = await response.arrayBuffer();
      }

      const meta: SoundFontMeta = {
        id: DEFAULT_SF2_ID,
        name: DEFAULT_SF2_NAME,
        size: buffer.byteLength,
        isDefault: true,
        updatedAt: Date.now(),
      };

      // IndexedDB にキャッシュ保存
      await this.saveToCache(meta, buffer);

      this.currentBuffer = buffer;
      this.updateState({
        status: 'ready',
        progress: 100,
        currentSoundFont: meta,
      });

      return buffer;
    } catch (err: any) {
      const msg = err?.message || 'SoundFontのダウンロードに失敗しました';
      this.updateState({
        status: 'error',
        progress: 0,
        errorMessage: msg,
      });
      throw err;
    }
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
   * 保存済み SoundFont に切り替え
   */
  public async switchToSoundFont(id: string): Promise<ArrayBuffer> {
    if (id === DEFAULT_SF2_ID) {
      return await this.loadDefaultSoundFont();
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
