/**
 * 上传草稿的本地持久化（IndexedDB）。
 *
 * 两个 store：
 *   files —— 按 item id 存转换后的 Blob 与尺寸（大对象，只在新增/移除时写）
 *   meta  —— 按 id 存行程/状态/URL 等小字段（每次状态变化重写，体积很小）
 *
 * 这样刷新页面不会丢已选照片和上传进度；中途被系统杀掉的上传会在恢复时降级为「待上传」。
 */

export type DraftFile = {
  id: string;
  name: string;
  size: number;
  /** 上传成功后会被清掉，只留 thumb，省 IndexedDB 空间 */
  blob?: Blob;
  /** 列表预览用的小图 */
  thumb?: Blob;
  width: number;
  height: number;
  takenAt: string;
  gps?: [number, number];
};

export type DraftMeta = {
  id: string;
  order: number;
  trip: string;
  status: "ready" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
  cover: boolean;
  candidate?: string;
  nearest?: string;
  distanceKm?: number;
};

const DB_NAME = "alvin-travel-upload";
const DB_VERSION = 1;
const FILE_STORE = "files";
const META_STORE = "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        t.oncomplete = () => db.close();
      })
  );
}

export async function putDraftFile(file: DraftFile): Promise<void> {
  await tx(FILE_STORE, "readwrite", (s) => s.put(file));
}

export async function removeDraftFile(id: string): Promise<void> {
  await tx(FILE_STORE, "readwrite", (s) => s.delete(id));
}

/** 覆盖写整份 meta（很小，几十条也只是一次轻量写） */
export async function saveDraftMeta(list: DraftMeta[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(META_STORE, "readwrite");
    const store = t.objectStore(META_STORE);
    store.clear();
    for (const item of list) store.put(item);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error ?? new Error("IndexedDB write failed"));
    };
  });
}

export async function loadDraft(): Promise<{ files: DraftFile[]; meta: DraftMeta[] }> {
  const [files, meta] = await Promise.all([
    tx<DraftFile[]>(FILE_STORE, "readonly", (s) => s.getAll() as IDBRequest<DraftFile[]>),
    tx<DraftMeta[]>(META_STORE, "readonly", (s) => s.getAll() as IDBRequest<DraftMeta[]>),
  ]);
  return { files, meta };
}

export async function clearDraft(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([FILE_STORE, META_STORE], "readwrite");
    t.objectStore(FILE_STORE).clear();
    t.objectStore(META_STORE).clear();
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error ?? new Error("IndexedDB clear failed"));
    };
  });
}
