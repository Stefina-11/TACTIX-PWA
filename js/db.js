const DB = (() => {
  const DB_NAME = 'tactix_data';
  const STORE_LOGS = 'logs';
  const STORE_MESSAGES = 'messages';
  const STORE_TELEMETRY = 'telemetry';
  const STORE_EMERGENCIES = 'emergencies';
  const DB_VERSION = 1;

  let db = null;

  function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const stores = [
          { name: STORE_LOGS, keyPath: 'id', autoIncrement: true, indexes: ['timestamp', 'type'] },
          { name: STORE_MESSAGES, keyPath: 'id', autoIncrement: true, indexes: ['timestamp', 'direction'] },
          { name: STORE_TELEMETRY, keyPath: 'id', autoIncrement: true, indexes: ['timestamp', 'soldierId'] },
          { name: STORE_EMERGENCIES, keyPath: 'id', autoIncrement: true, indexes: ['timestamp', 'resolved'] }
        ];
        stores.forEach(s => {
          if (!database.objectStoreNames.contains(s.name)) {
            const store = database.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: true });
            s.indexes.forEach(idx => store.createIndex(idx, idx, { unique: false }));
          }
        });
      };
    });
  }

  function add(storeName, data) {
    if (!db) return Promise.reject('DB not initialized');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const entry = { ...data, timestamp: Date.now() };
      const req = store.add(entry);
      req.onsuccess = () => resolve({ ...entry, id: req.result });
      req.onerror = () => reject(req.error);
    });
  }

  function getAll(storeName, count = 100) {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.slice(-count).reverse());
    });
  }

  function getByIndex(storeName, indexName, value) {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function clear(storeName) {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
    });
  }

  async function backup() {
    const data = {};
    for (const name of [STORE_LOGS, STORE_MESSAGES, STORE_TELEMETRY, STORE_EMERGENCIES]) {
      data[name] = await getAll(name, 500);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tactix-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    init,
    add,
    getAll,
    getByIndex,
    clear,
    backup
  };
})();
