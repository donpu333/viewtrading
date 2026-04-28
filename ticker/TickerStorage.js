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
    
    // Геттеры
    getState() { return this.state; }
    getTickers() { return this.tickers; }
    getTickersMap() { return this.tickersMap; }
    getBinanceSymbolsCache() { return this.binanceSymbolsCache; }
    getBybitSymbolsCache() { return this.bybitSymbolsCache; }
    
    // ===== ЗАГРУЗКА ДАННЫХ =====
    
    async loadUserData() {
        console.log('📦 Загрузка пользовательских данных...');
        
        // Сначала быстро грузим из localStorage
        const loadedFromLocal = this.loadFromLocalStorage();
        
        // Пытаемся IndexedDB (может перезаписать localStorage если данные свежее)
        if (window.db && window.dbReady) {
            try {
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
                }
                
                console.log('✅ Данные загружены из IndexedDB');
            } catch (error) {
                console.warn('❌ Ошибка IndexedDB, используем localStorage:', error);
            }
        } else if (loadedFromLocal) {
            console.log('✅ Данные загружены из localStorage');
        } else {
            console.warn('⚠️ Нет сохранённых данных');
        }
    }
    
    loadFromLocalStorage() {
        try {
            let loaded = false;
            
            const customSymbols = localStorage.getItem('customSymbols');
            if (customSymbols) {
                const parsed = JSON.parse(customSymbols);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.state.customSymbols = parsed;
                    loaded = true;
                    console.log('📦 customSymbols из localStorage:', parsed.length);
                }
            }
            
            const favorites = localStorage.getItem('favorites');
            if (favorites) {
                const parsed = JSON.parse(favorites);
                if (Array.isArray(parsed)) {
                    this.state.favorites = parsed;
                }
            }
            
            const flags = localStorage.getItem('flags');
            if (flags) {
                const parsed = JSON.parse(flags);
                if (typeof parsed === 'object') {
                    this.state.flags = parsed;
                }
            }
            
            const currentSymbol = localStorage.getItem('currentSymbol');
            if (currentSymbol) {
                const parsed = JSON.parse(currentSymbol);
                this.state.currentSymbol = parsed.symbol || 'BTCUSDT';
                this.state.currentExchange = parsed.exchange || 'binance';
                this.state.currentMarketType = parsed.marketType || 'futures';
            }
            
            return loaded;
            
        } catch (e) {
            console.warn('❌ Ошибка загрузки из localStorage:', e);
            return false;
        }
    }
    
    async loadFromIndexedDB() {
        console.log('📦 Загрузка инструментов из IndexedDB...');
        
        if (!window.db || !window.dbReady) {
            console.warn('📦 IndexedDB не доступна');
            return false;
        }
        
        try {
            const binanceCache = await window.db.get('symbolCaches', 'binance');
            if (binanceCache && binanceCache.data && binanceCache.data.length > 0) {
                this.binanceSymbolsCache = binanceCache.data;
                this.binanceSymbolsCache = this.sortByPopularity(this.binanceSymbolsCache);
                this.allBinanceFutures = this.binanceSymbolsCache.filter(s => s.marketType === 'futures');
                this.allBinanceSpot = this.binanceSymbolsCache.filter(s => s.marketType === 'spot');
                console.log(`✅ Binance из IndexedDB: ${this.binanceSymbolsCache.length}`);
            }
            
            const bybitCache = await window.db.get('symbolCaches', 'bybit');
            if (bybitCache && bybitCache.data && bybitCache.data.length > 0) {
                this.bybitSymbolsCache = bybitCache.data;
                this.bybitSymbolsCache = this.sortByPopularity(this.bybitSymbolsCache);
                this.allBybitFutures = this.bybitSymbolsCache.filter(s => s.marketType === 'futures');
                this.allBybitSpot = this.bybitSymbolsCache.filter(s => s.marketType === 'spot');
                console.log(`✅ Bybit из IndexedDB: ${this.bybitSymbolsCache.length}`);
            }
            
            this.allSymbolsCache = [...this.binanceSymbolsCache, ...this.bybitSymbolsCache];
            
            return this.binanceSymbolsCache.length > 0 || this.bybitSymbolsCache.length > 0;
            
        } catch (error) {
            console.warn('❌ Ошибка загрузки из IndexedDB:', error);
            return false;
        }
    }
    
    // ===== СОХРАНЕНИЕ =====
    
    async saveState() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        
        this.saveTimeout = setTimeout(async () => {
            // ВСЕГДА сохраняем в localStorage (быстро, синхронно)
            try {
                localStorage.setItem('customSymbols', JSON.stringify(this.state.customSymbols));
                localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
                localStorage.setItem('flags', JSON.stringify(this.state.flags));
                localStorage.setItem('currentSymbol', JSON.stringify({
                    symbol: this.state.currentSymbol,
                    exchange: this.state.currentExchange,
                    marketType: this.state.currentMarketType
                }));
            } catch (e) {
                console.warn('Ошибка сохранения в localStorage:', e);
            }
            
            // Сохраняем в IndexedDB если доступна
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
                    
                    console.log('✅ Состояние сохранено');
                    
                } catch (error) {
                    console.warn('❌ Ошибка сохранения в IndexedDB:', error);
                }
            }
        }, 500);
    }
    
    async saveCurrentSymbol(symbol, exchange, marketType) {
        // localStorage
        try {
            localStorage.setItem('currentSymbol', JSON.stringify({ symbol, exchange, marketType }));
        } catch (e) {}
        
        // IndexedDB
        if (!window.db || !window.dbReady) return;
        
        try {
            await window.db.put('settings', {
                key: 'currentSymbol',
                value: { symbol, exchange, marketType },
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('❌ Ошибка сохранения currentSymbol:', error);
        }
    }
    
    async saveSymbolsToIndexedDB() {
        // localStorage (резерв)
        try {
            localStorage.setItem('binanceSymbolsCache', JSON.stringify(this.binanceSymbolsCache));
            localStorage.setItem('bybitSymbolsCache', JSON.stringify(this.bybitSymbolsCache));
        } catch (e) {
            console.warn('localStorage переполнен, кэш символов не сохранён');
        }
        
        // IndexedDB
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
            }
            
            if (this.bybitSymbolsCache && this.bybitSymbolsCache.length > 0) {
                const sortedBybit = this.sortByPopularity(this.bybitSymbolsCache);
                await window.db.put('symbolCaches', {
                    exchange: 'bybit',
                    data: sortedBybit,
                    timestamp: now
                });
            }
            
            console.log('✅ Кэш символов сохранён в IndexedDB');
            
        } catch (error) {
            console.warn('❌ Ошибка сохранения кэша:', error);
        }
    }
    
    // ===== ВОТЧЛИСТЫ =====
    
    async loadWatchlists() {
    if (window.db && window.dbReady) {
        try {
            const data = await window.db.get('settings', 'watchlists');
            if (data?.value) return data.value;
        } catch (e) {}
    }
    const saved = localStorage.getItem('watchlists');
    return saved ? JSON.parse(saved) : null;
}

async saveWatchlists(data) {
    if (window.db && window.dbReady) {
        try {
            await window.db.put('settings', { key: 'watchlists', value: data, timestamp: Date.now() });
            console.log('📋 Вотчлисты сохранены в IndexedDB');
            localStorage.removeItem('watchlists'); // чистим localStorage, теперь всё в IndexedDB
            return;
        } catch (e) {
            console.error('Ошибка сохранения в IndexedDB:', e);
        }
    }
    localStorage.setItem('watchlists', JSON.stringify(data));
}
    
    
    
    // ===== УТИЛИТЫ =====
    
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
            
            if (aIndex !== -1 && bIndex !== -1) {
                if (aIndex === bIndex) {
                    if (a.exchange === 'binance' && b.exchange !== 'binance') return -1;
                    if (a.exchange !== 'binance' && b.exchange === 'binance') return 1;
                    return 0;
                }
                return aIndex - bIndex;
            }
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            
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
        
        const foundSpan = document.getElementById('modalFoundCount');
        if (foundSpan) foundSpan.textContent = '...';
        
        fetch(url)
            .then(r => r.json())
            .then(data => {
                let count = 0;
                if (exchange === 'binance' && data.symbols) {
                    count = data.symbols.filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING').length;
                } else if (exchange === 'bybit' && data.result?.list) {
                    count = data.result.list.filter(s => s.symbol.endsWith('USDT')).length;
                }
                if (foundSpan) foundSpan.textContent = count;
            })
            .catch(() => {
                if (foundSpan) foundSpan.textContent = '...';
            });
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
    // ===== МЕТОДЫ ДЛЯ ВОТЧЛИСТОВ =====
// ===== ВОТЧЛИСТЫ =====


}

if (typeof window !== 'undefined') {
    window.TickerStorage = TickerStorage;
}