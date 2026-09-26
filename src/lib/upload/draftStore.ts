/*
 * Browser-only: keeps an unsent upload (files + choices) in IndexedDB so it survives
 * leaving the page to sign in with Google. Files are stored as-is (IndexedDB holds Blobs).
 * Every call fails soft: private browsing or a full disk just means nothing is restored.
 */

export type DraftFile = {
  id: string;
  file: File;
  box: "content" | "objectives";
  week: number | null;
  pages: number | null | undefined;
  note?: string;
};

export type UploadDraft = {
  title: string;
  courseCode: string;
  university: string;
  year: string;
  notes: string;
  files: DraftFile[];
};

const DB = "unitute-upload";
const STORE = "drafts";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = action(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveDraft(draft: UploadDraft): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(draft, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadDraft(): Promise<UploadDraft | null> {
  try {
    return ((await run("readonly", (s) => s.get(KEY))) as UploadDraft | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // nothing to clear
  }
}
