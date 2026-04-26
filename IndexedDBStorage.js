class IndexedDBStorage {
    constructor(dbName, version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.initPromise = null;
        console.log('📦 IndexedDBStorage constructor', dbName, version);
    }

    async init() {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise((resolve, reject) => {
            console.log('📦 opening database...');
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('📦 Database error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onblocked = (event) => {
                console.warn('📦 Database blocked - close other tabs with this app');
                reject(new Error('Database blocked by another connection'));
            };
            
            request.onsuccess = (event) => {
                console.log('📦 Database opened successfully');
                this.db = event.target.result;
                
                // Обработчик неожиданного закрытия соединения
                this.db.onclose = () => {
                    console.warn('📦 Database connection closed unexpectedly');
                    this.db = null;
                    this.initPromise = null;
                };
                
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('📦 Database upgrade needed');
                const db = event.target.result;
                const transaction = event.target.transaction;
                
                // Создаём хранилище symbolCaches, если его нет
                if (!db.objectStoreNames.contains('symbolCaches')) {
                    console.log('📦 Creating symbolCaches store');
                    const symbolStore = db.createObjectStore('symbolCaches', { keyPath: 'exchange' });
                    symbolStore.createIndex('timestamp', 'timestamp');
                }
                
                // Создаём хранилище drawings с индексами type, symbolKey, timestamp
                if (!db.objectStoreNames.contains('drawings')) {
                    console.log('📦 Creating drawings store');
                    const drawingsStore = db.createObjectStore('drawings', { keyPath: 'id' });
                    drawingsStore.createIndex('type', 'type');
                    drawingsStore.createIndex('symbolKey', 'symbolKey');
                    drawingsStore.createIndex('timestamp', 'timestamp');
                }
                
                // Создаём хранилище candles, если его нет
                if (!db.objectStoreNames.contains('candles')) {
                    console.log('📦 Creating candles store');
                    const candlesStore = db.createObjectStore('candles', { keyPath: 'key' });
                    candlesStore.createIndex('symbol', 'symbol');
                    candlesStore.createIndex('interval', 'interval');
                    candlesStore.createIndex('exchange', 'exchange');
                    candlesStore.createIndex('marketType', 'marketType');
                    candlesStore.createIndex('lastUpdate', 'lastUpdate');
                }
                
                // Создаём хранилище settings, если его нет
                if (!db.objectStoreNames.contains('settings')) {
                    console.log('📦 Creating settings store');
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                // Для существующего хранилища drawings добавляем индекс symbolKey
                if (db.objectStoreNames.contains('drawings')) {
                    const drawingsStore = transaction.objectStore('drawings');
                    if (!drawingsStore.indexNames.contains('symbolKey')) {
                        console.log('📦 Adding symbolKey index to existing drawings store');
                        drawingsStore.createIndex('symbolKey', 'symbolKey');
                    }
                }
            };
        });
        
        return this.initPromise;
    }

    // Закрытие соединения с БД
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initPromise = null;
            console.log('📦 Database connection closed');
        }
    }

    async delete(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in put (${storeName}):`, error);
                reject(error);
            }
        });
    }

    async get(storeName, key) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in get (${storeName}):`, error);
                reject(error);
            }
        });
    }

    async getAll(storeName) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in getAll (${storeName}):`, error);
                reject(error);
            }
        });
    }

    async getByIndex(storeName, indexName, value) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                
                if (!store.indexNames.contains(indexName)) {
                    console.warn(`📦 Index ${indexName} not found in ${storeName}`);
                    resolve([]);
                    return;
                }
                
                const index = store.index(indexName);
                const request = index.getAll(value);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in getByIndex (${storeName}):`, error);
                reject(error);
            }
        });
    }

    // Очистка хранилища
    async clear(storeName) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            request.onerror = () => reject(request.error);
        });
    }

    // Подсчёт записей в хранилище
    async count(storeName) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Массовая вставка
    async putMany(storeName, items) {
        await this.init();
        
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            let completed = 0;
            const results = [];
            
            transaction.oncomplete = () => resolve(results);
            transaction.onerror = () => reject(transaction.error);
            
            items.forEach(item => {
                const request = store.put(item);
                request.onsuccess = () => {
                    results.push(request.result);
                    completed++;
                };
                request.onerror = () => reject(request.error);
            });
        });
    }
}

// Глобальный экземпляр БД (версия 3)
window.db = new IndexedDBStorage('TradingViewPro', 3);
window.dbReady = false;

// Инициализация с проверкой
window.db.init().then(() => {
    window.dbReady = true;
    console.log('✅ IndexedDB ready to use');
}).catch(err => {
    window.dbReady = false;
    console.error('❌ IndexedDB init failed:', err);
    // Создаем запасной вариант (заглушка)
    window.db = {
        get: () => Promise.resolve(null),
        put: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        getAll: () => Promise.resolve([]),
        getByIndex: () => Promise.resolve([]),
        clear: () => Promise.resolve(),
        count: () => Promise.resolve(0),
        putMany: () => Promise.resolve([])
    };
    window.dbReady = true;
});

if (typeof window !== 'undefined') {
    window.IndexedDBStorage = IndexedDBStorage;
}