const DB_NAME = '115-translation-dashboard';
const DB_VERSION = 1;
const STORE = 'research-records';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('此瀏覽器不支援 IndexedDB。'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('time', 'time', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('無法開啟本機資料庫。'));
  });
}

export async function addRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({ schemaVersion: 1, createdAt: new Date().toISOString(), ...record });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('無法儲存紀錄。'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

export async function getRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => String(b.time || b.createdAt).localeCompare(String(a.time || a.createdAt))));
    req.onerror = () => reject(req.error || new Error('無法讀取本機紀錄。'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

export async function clearRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('無法清除紀錄。')); };
  });
}

export async function importRecords(records) {
  if (!Array.isArray(records)) throw new Error('JSON 檔案格式錯誤：最外層必須是陣列。');
  const clean = records.filter(r => r && typeof r === 'object' && !Array.isArray(r) && (r.type === 'translation' || r.type === 'environment-test'));
  if (clean.length !== records.length) throw new Error('檔案包含不符合格式的紀錄，未匯入任何資料。');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    clean.forEach(({ id, ...record }) => store.add({ schemaVersion: 1, importedAt: new Date().toISOString(), ...record }));
    tx.oncomplete = () => { db.close(); resolve(clean.length); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('匯入失敗。')); };
  });
}
