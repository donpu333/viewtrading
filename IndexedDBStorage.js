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
                
                if (!db.objectStoreNames.contains('symbolCaches')) {
                    console.log('📦 Creating symbolCaches store');
                    const symbolStore = db.createObjectStore('symbolCaches', { keyPath: 'exchange' });
                    symbolStore.createIndex('timestamp', 'timestamp');
                }
                
                if (!db.objectStoreNames.contains('drawings')) {
                    console.log('📦 Creating drawings store');
                    const drawingsStore = db.createObjectStore('drawings', { keyPath: 'id' });
                    drawingsStore.createIndex('type', 'type');
                    drawingsStore.createIndex('symbolKey', 'symbolKey');
                    drawingsStore.createIndex('timestamp', 'timestamp');
                }
                
                if (!db.objectStoreNames.contains('candles')) {
                    console.log('📦 Creating candles store');
                    const candlesStore = db.createObjectStore('candles', { keyPath: 'key' });
                    candlesStore.createIndex('symbol', 'symbol');
                    candlesStore.createIndex('interval', 'interval');
                    candlesStore.createIndex('exchange', 'exchange');
                    candlesStore.createIndex('marketType', 'marketType');
                    candlesStore.createIndex('lastUpdate', 'lastUpdate');
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    console.log('📦 Creating settings store');
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                // Защита при обновлении версий для старых баз
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
        // ИСПРАВЛЕНИЕ: Добавлена проверка существования хранилища
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in delete (${storeName}):`, error);
                reject(error);
            }
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

    async clear(storeName) {
        await this.init();
        // ИСПРАВЛЕНИЕ: Добавлена проверка существования хранилища
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in clear (${storeName}):`, error);
                reject(error);
            }
        });
    }

    async count(storeName) {
        await this.init();
        // ИСПРАВЛЕНИЕ: Добавлена проверка существования хранилища
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.count();
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error(`📦 Error in count (${storeName}):`, error);
                reject(error);
            }
        });
    }

    async putMany(storeName, items) {
        await this.init();
        // ИСПРАВЛЕНИЕ: Добавлена проверка существования хранилища
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Store ${storeName} not found`);
        }

        if (!items || items.length === 0) return [];
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                const results = [];
                
                transaction.oncomplete = () => resolve(results);
                transaction.onerror = () => reject(transaction.error);
                
                items.forEach(item => {
                    const request = store.put(item);
                    request.onsuccess = () => results.push(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error(`📦 Error in putMany (${storeName}):`, error);
                reject(error);
            }
        });
    }
}

// Глобальный экземпляр БД (версия 3)
window.db = new IndexedDBStorage('TradingViewPro', 3);
window.dbReady = false;

// Инициализация с безопасным fallback
window.db.init().then(() => {
    window.dbReady = true;
    console.log('✅ IndexedDB ready to use');
}).catch(err => {
    window.dbReady = false; // ВАЖНО: оставляем false!
    console.error('❌ IndexedDB init failed:', err);
    
    // ИСПРАВЛЕНИЕ: Умная заглушка через Proxy
    // Она не даст приложению упасть, но будет кричать в консоль, если что-то пойдёт не так
    window.db = new Proxy({}, {
        get: (target, prop) => {
            if (['get', 'put', 'delete', 'getAll', 'getByIndex', 'clear', 'count', 'putMany', 'init'].includes(prop)) {
                return (...args) => {
                    console.warn(`📦 IndexedDB DISABLED. Call to db.${prop}(${args[0]}) was ignored.`);
                    // Возвращаем безопасные дефолтные значения, чтобы не сломать логику upstream
                    if (prop === 'getAll' || prop === 'getByIndex') return Promise.resolve([]);
                    if (prop === 'count') return Promise.resolve(0);
                    return Promise.resolve(null);
                };
            }
            return undefined;
        }
    });
    
    // Оповещаем пользователя (можно заменить на красивый UI Alert)
    setTimeout(() => {
        alert('Ваш браузер заблокировал доступ к локальной базе данных.\nСохранение рисунков и кэш свечей будут недоступны во этой сессии.\nРазрешите использование Cookies/Storage в настройках браузера.');
    }, 1000);
});

if (typeof window !== 'undefined') {
    window.IndexedDBStorage = IndexedDBStorage;
}