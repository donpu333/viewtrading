class TickerStorage {
    constructor() {
        this.state = {
            favorites: [],
            customSymbols: [],
            flags: {},
            activeTab: 'all',
            activeFlagTab: 'red',
            currentSymbol: '',
            currentExchange: 'binance',
            currentMarketType: 'futures',
            sortBy: 'volume',
            sortDirection: 'desc',
            marketFilter: 'all',
            exchangeFilter: 'all',
            modalSearchQuery: '',
            modalExchange: 'binance',
            modalMarketType: 'futures',
            modalPage: 0,
            modalPageSize: 30,
            isAddingAllInProgress: false,
            addingAllOffset: 0,
            addingAllBatchSize: 50,
            binanceHasConnection: { futures: false, spot: false },
            bybitHasConnection: { futures: false, spot: false },
            maxReconnectAttempts: 10,
            wsReconnectAttempts: { 
                binanceFutures: 0, 
                binanceSpot: 0, 
                bybitFutures: 0, 
                bybitSpot: 0 
            },
            wsConnected: {
                binanceFutures: false,
                binanceSpot: false,
                bybitFutures: false,
                bybitSpot: false    
            },
            isSettingUpWebSockets: false
        };
        
        this.tickers = [];
        this.tickersMap = new Map();
        this.allSymbolsCache = [];
        this.binanceSymbolsCache = [];
        this.bybitSymbolsCache = [];
        this.allBinanceFutures = [];
        this.allBinanceSpot = [];
        this.allBybitFutures = [];
        this.allBybitSpot = [];
        
        this.formatCache = {
            prices: new Map(),
            volumes: new Map(),
            changes: new Map()
        };
        this.cacheMaxAge = 10000;
        this.settings = { excludePatterns: ['BULL', 'BEAR', 'UP', 'DOWN', 'HEDGE'] };
        this.debugMode = true;
        this.filterCache = null;
        this.saveTimeout = null;
        this._isRefreshing = false;
        this._eventsInitialized = false;
    }
    
    getState() { return this.state; }
    getTickers() { return this.tickers; }
    getTickersMap() { return this.tickersMap; }
    getBinanceSymbolsCache() { return this.binanceSymbolsCache; }
    getBybitSymbolsCache() { return this.bybitSymbolsCache; }
    
    async loadUserData() {
        console.log('📦 Загрузка пользовательских данных из IndexedDB...');
        this.state.flags = {};
        this.state.currentSymbol = 'BTCUSDT';
        this.state.currentExchange = 'binance';
        this.state.currentMarketType = 'futures';
        
        if (!window.db) {
            console.warn('📦 IndexedDB не доступна, используем localStorage');
            this.loadFromLocalStorage();
            return;
        }
        
        try {
            if (!window.dbReady) {
                console.log('⏳ Ожидание инициализации IndexedDB...');
                await new Promise(resolve => {
                    const check = setInterval(() => {
                        if (window.dbReady) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                    setTimeout(() => {
                        clearInterval(check);
                        resolve();
                    }, 3000);
                });
            }
            
            const favorites = await window.db.get('settings', 'favorites');
            if (favorites && favorites.value) {
                this.state.favorites = favorites.value;
            }
            
            const customSymbols = await window.db.get('settings', 'customSymbols');
            if (customSymbols && customSymbols.value) {
                this.state.customSymbols = customSymbols.value;
            }
            
            const flags = await window.db.get('settings', 'flags');
            if (flags && flags.value) {
                this.state.flags = flags.value;
            }
            
            const currentSymbol = await window.db.get('settings', 'currentSymbol');
            if (currentSymbol && currentSymbol.value) {
                this.state.currentSymbol = currentSymbol.value.symbol || 'BTCUSDT';
                this.state.currentExchange = currentSymbol.value.exchange || 'binance';
                this.state.currentMarketType = currentSymbol.value.marketType || 'futures';
                console.log('✅ Загружен последний символ:', this.state.currentSymbol);
            }
            
            console.log('✅ Пользовательские данные загружены из IndexedDB');
        } catch (error) {
            console.warn('❌ Ошибка загрузки из IndexedDB:', error);
            this.loadFromLocalStorage();
        }
    }
    
    async saveCurrentSymbol(symbol, exchange, marketType) {
        if (!window.db) {
            console.warn('📦 IndexedDB не доступна');
            return;
        }
        
        try {
            if (!window.dbReady) {
                await new Promise(resolve => {
                    const check = setInterval(() => {
                        if (window.dbReady) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                    setTimeout(() => {
                        clearInterval(check);
                        resolve();
                    }, 2000);
                });
            }
            
            await window.db.put('settings', {
                key: 'currentSymbol',
                value: { symbol, exchange, marketType },
                timestamp: Date.now()
            });
            
            console.log(`✅ Текущий символ сохранен: ${symbol}`);
            
        } catch (error) {
            console.warn('❌ Ошибка сохранения текущего символа:', error);
        }
    }
    
    loadFromLocalStorage() {
        try {
            return false;
        } catch (e) {
            console.warn('Ошибка загрузки из localStorage:', e);
            return false;
        }
    }
    
    async loadFromIndexedDB() {
        console.log('📦 Загрузка инструментов из IndexedDB...');
        
        if (!window.db) {
            console.warn('📦 IndexedDB не доступна');
            return false;
        }
        
        try {
            if (!window.dbReady) {
                await new Promise(resolve => {
                    const check = setInterval(() => {
                        if (window.dbReady) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                    setTimeout(() => {
                        clearInterval(check);
                        resolve();
                    }, 2000);
                });
            }
            
            const binanceCache = await window.db.get('symbolCaches', 'binance');
            if (binanceCache && binanceCache.data && binanceCache.data.length > 0) {
                this.binanceSymbolsCache = binanceCache.data;
                this.binanceSymbolsCache = this.sortByPopularity(this.binanceSymbolsCache);
                this.allBinanceFutures = this.binanceSymbolsCache.filter(s => s.marketType === 'futures');
                this.allBinanceSpot = this.binanceSymbolsCache.filter(s => s.marketType === 'spot');
                console.log(`✅ Binance загружен из IndexedDB: ${this.binanceSymbolsCache.length} символов`);
            }
            
            const bybitCache = await window.db.get('symbolCaches', 'bybit');
            if (bybitCache && bybitCache.data && bybitCache.data.length > 0) {
                this.bybitSymbolsCache = bybitCache.data;
                this.bybitSymbolsCache = this.sortByPopularity(this.bybitSymbolsCache);
                this.allBybitFutures = this.bybitSymbolsCache.filter(s => s.marketType === 'futures');
                this.allBybitSpot = this.bybitSymbolsCache.filter(s => s.marketType === 'spot');
                console.log(`✅ Bybit загружен из IndexedDB: ${this.bybitSymbolsCache.length} символов`);
            }
            
            this.allSymbolsCache = [...this.binanceSymbolsCache, ...this.bybitSymbolsCache];
            
            const savedSymbols = await window.db.get('settings', 'customSymbols');
            if (savedSymbols && savedSymbols.value) {
                this.state.customSymbols = savedSymbols.value;
            }
            
            const savedFavorites = await window.db.get('settings', 'favorites');
            if (savedFavorites && savedFavorites.value) {
                this.state.favorites = savedFavorites.value;
            }
            
            const savedFlags = await window.db.get('settings', 'flags');
            if (savedFlags && savedFlags.value) {
                this.state.flags = savedFlags.value;
            }
            
            const savedCurrent = await window.db.get('settings', 'currentSymbol');
            if (savedCurrent && savedCurrent.value) {
                this.state.currentSymbol = savedCurrent.value.symbol || 'BTCUSDT';
                this.state.currentExchange = savedCurrent.value.exchange || 'binance';
                this.state.currentMarketType = savedCurrent.value.marketType || 'futures';
            }
            
            return this.binanceSymbolsCache.length > 0 || this.bybitSymbolsCache.length > 0;
            
        } catch (error) {
            console.warn('❌ Ошибка загрузки из IndexedDB:', error);
            return false;
        }
    }
    
    async saveSymbolsToIndexedDB() {
        if (!window.db || !window.dbReady) return;
        
        try {
            const now = Date.now();
            
            if (this.binanceSymbolsCache && this.binanceSymbolsCache.length > 0) {
                const sortedBinance = this.sortByPopularity(this.binanceSymbolsCache);
                await window.db.put('symbolCaches', {
                    exchange: 'binance',
                    data: sortedBinance,
                    timestamp: now
                });
                console.log(`✅ Binance сохранён в IndexedDB: ${sortedBinance.length} символов`);
            }
            
            if (this.bybitSymbolsCache && this.bybitSymbolsCache.length > 0) {
                const sortedBybit = this.sortByPopularity(this.bybitSymbolsCache);
                await window.db.put('symbolCaches', {
                    exchange: 'bybit',
                    data: sortedBybit,
                    timestamp: now
                });
                console.log(`✅ Bybit сохранён в IndexedDB: ${sortedBybit.length} символов`);
            }
            
        } catch (error) {
            console.warn('❌ Ошибка сохранения в IndexedDB:', error);
        }
    }
    
sortByPopularity(symbols) {
    const popularityOrder = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
        'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
        'MATICUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT', 'LTCUSDT',
        'FILUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'NEARUSDT',
        'INJUSDT', 'SUIUSDT', 'SEIUSDT', 'WIFUSDT', 'PEPEUSDT',
        'SHIBUSDT', 'BONKUSDT', 'FLOKIUSDT'
    ];
    
    return [...symbols].sort((a, b) => {
        const aSymbol = a.symbol || '';
        const bSymbol = b.symbol || '';
        const aIndex = popularityOrder.indexOf(aSymbol);
        const bIndex = popularityOrder.indexOf(bSymbol);
        
        // Сначала по популярности
        if (aIndex !== -1 && bIndex !== -1) {
            // Оба популярные — если одинаковые, то по бирже (Binance первый)
            if (aIndex === bIndex) {
                if (a.exchange === 'binance' && b.exchange !== 'binance') return -1;
                if (a.exchange !== 'binance' && b.exchange === 'binance') return 1;
                return 0;
            }
            return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // Непопулярные — по алфавиту
        return aSymbol.localeCompare(bSymbol);
    });
}
    
    getFilteredCount(exchange, marketType, query) {
        if (exchange === 'binance') {
            const source = marketType === 'futures' ? this.allBinanceFutures : this.allBinanceSpot;
            if (!source) return 0;
            let filtered = source;
            if (query) {
                filtered = filtered.filter(s => s.symbol.includes(query.toUpperCase()));
            }
            return filtered.length;
        } else {
            const source = marketType === 'futures' ? this.allBybitFutures : this.allBybitSpot;
            if (!source) return 0;
            let filtered = source;
            if (query) {
                filtered = filtered.filter(s => s.symbol.includes(query.toUpperCase()));
            }
            return filtered.length;
        }
    }
    
    updateModalCount() {
    const exchange = this.state.modalExchange;
    const marketType = this.state.modalMarketType;
    
    let url;
    if (exchange === 'binance') {
        url = marketType === 'futures' 
            ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
            : 'https://api.binance.com/api/v3/exchangeInfo';
    } else {
        const category = marketType === 'futures' ? 'linear' : 'spot';
        url = `https://api.bybit.com/v5/market/instruments-info?category=${category}`;
    }
    
    fetch(url)
        .then(r => r.json())
        .then(data => {
            let count = 0;
            if (exchange === 'binance' && data.symbols) {
                count = data.symbols.filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING').length;
            } else if (exchange === 'bybit' && data.result?.list) {
                count = data.result.list.filter(s => s.symbol.endsWith('USDT')).length;
            }
            const foundSpan = document.getElementById('modalFoundCount');
            if (foundSpan) foundSpan.textContent = count;
        })
        .catch(() => {
            const foundSpan = document.getElementById('modalFoundCount');
            if (foundSpan) foundSpan.textContent = '...';
        });
    
    // Пока грузится — показываем ...
    const foundSpan = document.getElementById('modalFoundCount');
    if (foundSpan) foundSpan.textContent = '...';
}
    removeDuplicates(arr, key) {
        const seen = new Map();
        return arr.filter(item => {
            if (!item || !item[key]) return false;
            const value = item[key];
            if (seen.has(value)) return false;
            seen.set(value, true);
            return true;
        });
    }
    
    async saveState() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        
        this.saveTimeout = setTimeout(async () => {
            if (window.db && window.dbReady) {
                try {
                    await window.db.put('settings', {
                        key: 'favorites',
                        value: this.state.favorites,
                        timestamp: Date.now()
                    });
                    
                    await window.db.put('settings', {
                        key: 'customSymbols',
                        value: this.state.customSymbols,
                        timestamp: Date.now()
                    });
                    
                    await window.db.put('settings', {
                        key: 'flags',
                        value: this.state.flags,
                        timestamp: Date.now()
                    });
                    
                    console.log('✅ Состояние сохранено в IndexedDB');
                    
                } catch (error) {
                    console.warn('❌ Ошибка сохранения в IndexedDB:', error);
                }
            }
        }, 500);
    }
}

if (typeof window !== 'undefined') {
    window.TickerStorage = TickerStorage;
}