const Auth = (() => {
  const DB_NAME = 'tactix_auth';
  const STORE_USERS = 'users';
  const STORE_SESSIONS = 'sessions';
  const SESSION_KEY = 'tactix_session';

  let db = null;

  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_USERS)) {
          const userStore = database.createObjectStore(STORE_USERS, { keyPath: 'serviceId' });
          userStore.createIndex('role', 'role', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_SESSIONS)) {
          database.createObjectStore(STORE_SESSIONS, { keyPath: 'token' });
        }
      };
    });
  }

  function sha256(message) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
      .then((buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hashPassword(password, salt) {
    return sha256(salt + ':' + password);
  }

  function verifyPassword(password, salt, hash) {
    return hashPassword(password, salt).then(h => h === hash);
  }

  async function createUser(serviceId, password, role, commandCode = null) {
    if (!db) await initDB();
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const user = {
      serviceId,
      salt,
      hash,
      role,
      commandCode: role === 'admin' ? commandCode : null,
      createdAt: Date.now()
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_USERS, 'readwrite');
      const store = tx.objectStore(STORE_USERS);
      const request = store.add(user);
      request.onsuccess = () => resolve(user);
      request.onerror = () => reject(request.error);
    });
  }

  async function getUser(serviceId) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_USERS, 'readonly');
      const store = tx.objectStore(STORE_USERS);
      const request = store.get(serviceId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function login(serviceId, password, role, commandCode) {
    const user = await getUser(serviceId);
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }
    if (user.role !== role) {
      return { success: false, error: 'Role mismatch' };
    }
    if (role === 'admin' && commandCode !== user.commandCode) {
      return { success: false, error: 'Invalid command override code' };
    }
    const valid = await verifyPassword(password, user.salt, user.hash);
    if (!valid) {
      return { success: false, error: 'Invalid credentials' };
    }
    const token = generateToken();
    const session = {
      token,
      serviceId,
      role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (8 * 60 * 60 * 1000)
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, session, user };
  }

  async function logout() {
    const session = getSession();
    if (session && db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        store.delete(session.token);
        tx.oncomplete = () => resolve();
      });
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function isAuthenticated() {
    return getSession() !== null;
  }

  function getRole() {
    const session = getSession();
    return session ? session.role : null;
  }

  async function seedUsers() {
    const existing = await getUser('SOL-2049');
    if (existing) return;
    await createUser('SOL-2049', 'tactix2049', 'soldier');
    await createUser('CMD-7742', 'command7742', 'admin', 'OVR-9921');
    await createUser('SOL-1024', 'field1024', 'soldier');
    await createUser('SOL-3388', 'field3388', 'soldier');
  }

  return {
    initDB,
    login,
    logout,
    getUser,
    createUser,
    seedUsers,
    getSession,
    isAuthenticated,
    getRole
  };
})();
