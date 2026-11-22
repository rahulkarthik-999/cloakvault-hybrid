import type { TelemetryEvent, VaultDocument } from '../types/vault';

const DB_NAME = 'cloakvault_local_db';
const DB_VERSION = 1;
const STORE_VAULTS = 'vaults';
const STORE_TELEMETRY = 'telemetry';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VAULTS)) {
        db.createObjectStore(STORE_VAULTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TELEMETRY)) {
        db.createObjectStore(STORE_TELEMETRY, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllLocalVaults(): Promise<VaultDocument[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VAULTS, 'readonly');
      const req = tx.objectStore(STORE_VAULTS).getAll();
      req.onsuccess = () => {
        const docs = (req.result as VaultDocument[]).sort(
          (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
        );
        resolve(docs);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveLocalVault(vault: VaultDocument): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VAULTS, 'readwrite');
      tx.objectStore(STORE_VAULTS).put(vault);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota errors in restricted browsing modes
  }
}

export async function deleteLocalVault(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VAULTS, 'readwrite');
      tx.objectStore(STORE_VAULTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadLocalTelemetry(): Promise<TelemetryEvent[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TELEMETRY, 'readonly');
      const req = tx.objectStore(STORE_TELEMETRY).getAll();
      req.onsuccess = () => {
        const list = (req.result as TelemetryEvent[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(list.slice(0, 50));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveLocalTelemetryEvent(event: TelemetryEvent): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TELEMETRY, 'readwrite');
      tx.objectStore(STORE_TELEMETRY).put(event);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}
