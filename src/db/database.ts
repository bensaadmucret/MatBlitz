import initSqlJs, { Database } from 'sql.js'

let db: Database | null = null
const DB_KEY = 'matblitz-sqlite-db'

export async function initDB(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  })

  // Try to load existing DB from IndexedDB
  const savedData = await loadFromIndexedDB()
  if (savedData) {
    db = new SQL.Database(new Uint8Array(savedData))
  } else {
    db = new SQL.Database()
  }

  // Create tables if not exist
  db.run(`
    CREATE TABLE IF NOT EXISTS puzzle_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puzzle_id TEXT NOT NULL,
      solved INTEGER NOT NULL DEFAULT 0,
      time_ms INTEGER NOT NULL DEFAULT 0,
      hints_used INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      combo_before INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_puzzle_results_puzzle_id ON puzzle_results(puzzle_id);
    CREATE INDEX IF NOT EXISTS idx_puzzle_results_timestamp ON puzzle_results(timestamp);
    CREATE INDEX IF NOT EXISTS idx_puzzle_results_solved ON puzzle_results(solved);

    CREATE TABLE IF NOT EXISTS game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT NOT NULL,
      unlocked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_streak (
      date TEXT PRIMARY KEY,
      puzzles_solved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  await saveToIndexedDB()
  return db
}

export function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

// Persist to IndexedDB
async function saveToIndexedDB(): Promise<void> {
  if (!db) return
  const data = db.export()
  const buffer = new Uint8Array(data)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MatBlitzDB', 1)

    request.onupgradeneeded = () => {
      const idb = request.result
      if (!idb.objectStoreNames.contains('sqlite')) {
        idb.createObjectStore('sqlite')
      }
    }

    request.onsuccess = () => {
      const idb = request.result
      const tx = idb.transaction('sqlite', 'readwrite')
      const store = tx.objectStore('sqlite')
      store.put(buffer, DB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }

    request.onerror = () => reject(request.error)
  })
}

async function loadFromIndexedDB(): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MatBlitzDB', 1)

    request.onupgradeneeded = () => {
      const idb = request.result
      if (!idb.objectStoreNames.contains('sqlite')) {
        idb.createObjectStore('sqlite')
      }
    }

    request.onsuccess = () => {
      const idb = request.result
      const tx = idb.transaction('sqlite', 'readonly')
      const store = tx.objectStore('sqlite')
      const getReq = store.get(DB_KEY)
      getReq.onsuccess = () => resolve(getReq.result || null)
      getReq.onerror = () => resolve(null)
    }

    request.onerror = () => resolve(null)
  })
}

// Auto-save after mutations
let saveTimeout: ReturnType<typeof setTimeout> | null = null

export function scheduleSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveToIndexedDB().catch(console.error)
  }, 500) // Debounce 500ms
}

export async function closeDB(): Promise<void> {
  if (db) {
    await saveToIndexedDB()
    db.close()
    db = null
  }
}
