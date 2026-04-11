 class TickerPanel {
    constructor(coordinator) {
    this.coordinator = coordinator;
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
    
    // Размеры и прокрутка
    this.rowHeight = 36;
    this.visibleCount = 30;
    this.tickerElements = new Map();
    this.displayedTickers = [];
    this.totalItems = 0;
    this._scrollHandler = null;
    
    // Рендеринг и анимация
    this._renderScheduled = false;
    this._renderRafId = null;
    this._firstRender = true;
    this._isRefreshing = false;
    this._eventsInitialized = false;
    
    // Данные тикеров
    this.tickers = [];
    this.tickersMap = new Map();
    this.allSymbolsCache = [];
    this.binanceSymbolsCache = [];
    this.bybitSymbolsCache = [];
    this.allBinanceFutures = [];
    this.allBinanceSpot = [];
    this.allBybitFutures = [];
    this.allBybitSpot = [];
    

    // Для debounce WebSocket обновлений
    this.wsUpdateBuffer = new Map();     // Буфер для накопления обновлений
    this.wsUpdateTimer = null;           // Таймер для отложенной обработки
    this.wsDebounceMs = 50;              // Ждём 50 мс перед обработкой

   this.formatCache = {
        prices: new Map(),     // key: цена (число) → { value: строка, timestamp: Date.now() }
        volumes: new Map(),
        changes: new Map()
    };
    this.cacheMaxAge = 10000; // 10 секунд


    // WebSocket
    this.wsConnections = [];
    this.wsReconnectTimers = [];
    this._pendingBybitSubscriptions = []
    this.pendingUpdates = new Map();
    this.updatePending = false;
    
    // Флаги подключения (для предотвращения дублирования)
    this._binanceFuturesConnecting = false;
    this._binanceSpotConnecting = false;
    this._bybitFuturesConnecting = false;
    this._bybitSpotConnecting = false;
    
    // Флаг значительного изменения цены
    this._hasSignificantChange = false;
    
    // Настройки и кэш
    this.settings = { excludePatterns: ['BULL', 'BEAR', 'UP', 'DOWN', 'HEDGE'] };
    this.debugMode = true;
    this.filterCache = null;
    this.saveTimeout = null;
    
  
    // Callback
    this.onSymbolSelect = null;
    
    // Привязка методов
    this.handleFlagSelect = this.handleFlagSelect.bind(this);
    this.handleTickerClick = this.handleTickerClick.bind(this);
    this.handleStarClick = this.handleStarClick.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.handleKeyDelete = this.handleKeyDelete.bind(this);
    
    // Debounced обновление цен
    this.debouncedUpdatePrices = () => {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        this._renderRafId = requestAnimationFrame(() => {
            this.updatePriceElements();
            this._renderScheduled = false;
            this._renderRafId = null;
        });
    };
    
    // Немедленное обновление цен
    this.updatePriceImmediate = () => {
        if (this._renderScheduled) {
            if (this._renderRafId) {
                cancelAnimationFrame(this._renderRafId);
                this._renderRafId = null;
            }
            this._renderScheduled = false;
        }
        this.updatePriceElements();
    };
    
    // Загрузка и инициализация
    this.loadFromLocalStorage();
    this.init();

     this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
}

// Добавить как метод класса:
handleVisibilityChange() {
    if (document.hidden) {
        console.log('📴 Вкладка неактивна, WebSocket отключаются');
        this.closeAllWebSockets();
    } else {
        console.log('👁️ Вкладка активна, WebSocket подключаются');
        this.setupWebSockets();
    }
}


    async init() {
        await this.loadUserData();
        this.setupFilters();
        this.setupModal();
        this.setupFlagContextMenu();
        this.setupUIEventListeners();
        this.setupClearAllButton();
        this.setupHeaderSorting();
        this.initializeDataParallel();
        this.startFallbackPriceUpdates();
        this.startCacheCleanup();
    }

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

  addInitialSymbols() {
    const savedSymbols = this.state.customSymbols;
    
    const container = document.getElementById('tickerListContainer');
    if (container) {
        container.innerHTML = '';
    }
    
    // Загружаем только сохранённые символы (без индивидуальных запросов)
    savedSymbols.forEach(symbolKey => {
        const parts = symbolKey.split(':');
        if (parts.length === 3) {
            const [symbol, exchange, marketType] = parts;
            this.addSymbol(symbol, true, exchange, marketType, false, true); // ← добавили true
        }
    });
    
    this.renderTickerList();
    this.updateModalCount();
    
    // Загружаем начальные данные через REST (один массовый запрос)
    Promise.all([
        this.fetchBinanceSpotSnapshot(),
        this.fetchBinanceFuturesSnapshot(),
        this.fetchBybitSnapshots()
    ]).then(() => {
        console.log('✅ Все начальные данные загружены, теперь открываем WebSocket');
        this.setupWebSockets();
    }).catch(err => {
        console.warn('⚠️ Ошибка при загрузке начальных данных, но WebSocket всё равно откроем', err);
        this.setupWebSockets();
    });
    
    this.setupDelegatedEvents();
}
    // ✅ НОВЫЙ МЕТОД: Загрузка начальных данных Binance Spot
    async fetchBinanceSpotSnapshot() {
        try {
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const data = await response.json();
            
            data.forEach(ticker => {
                if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
                    const key = `${ticker.symbol}:binance:spot`;
                    const tickerObj = this.tickersMap.get(key);
                    
                    if (tickerObj) {
                        tickerObj.price = parseFloat(ticker.lastPrice);
                        tickerObj.change = parseFloat(ticker.priceChangePercent);
                        tickerObj.volume = parseFloat(ticker.quoteVolume);
                        tickerObj.trades = parseInt(ticker.count);
                    }
                }
            });
            
            this.debouncedUpdatePrices();
            console.log('✅ Binance Spot начальные данные загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки Binance Spot:', error);
        }
    }

    // ✅ НОВЫЙ МЕТОД: Загрузка начальных данных Binance Futures
    async fetchBinanceFuturesSnapshot() {
        try {
            const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
            const data = await response.json();
            
            data.forEach(ticker => {
                if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
                    const key = `${ticker.symbol}:binance:futures`;
                    const tickerObj = this.tickersMap.get(key);
                    
                    if (tickerObj) {
                        tickerObj.price = parseFloat(ticker.lastPrice);
                        tickerObj.change = parseFloat(ticker.priceChangePercent);
                        tickerObj.volume = parseFloat(ticker.quoteVolume);
                    }
                }
            });
            
            this.debouncedUpdatePrices();
            console.log('✅ Binance Futures начальные данные загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки Binance Futures:', error);
        }
    }

    // ✅ НОВЫЙ МЕТОД: Загрузка начальных данных Bybit
    async fetchBybitSnapshots() {
        try {
            // Futures
            const futuresRes = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
            const futuresData = await futuresRes.json();
            
            if (futuresData.retCode === 0 && futuresData.result?.list) {
                futuresData.result.list.forEach(ticker => {
                    if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
                        const key = `${ticker.symbol}:bybit:futures`;
                        const tickerObj = this.tickersMap.get(key);
                        
                        if (tickerObj) {
                            tickerObj.price = parseFloat(ticker.lastPrice);
                            tickerObj.change = parseFloat(ticker.price24hPcnt) * 100;
                            tickerObj.volume = parseFloat(ticker.volume24h);
                        }
                    }
                });
            }
            
            // Spot
            const spotRes = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
            const spotData = await spotRes.json();
            
            if (spotData.retCode === 0 && spotData.result?.list) {
                spotData.result.list.forEach(ticker => {
                    if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
                        const key = `${ticker.symbol}:bybit:spot`;
                        const tickerObj = this.tickersMap.get(key);
                        
                        if (tickerObj) {
                            tickerObj.price = parseFloat(ticker.lastPrice);
                            tickerObj.change = parseFloat(ticker.price24hPcnt) * 100;
                            tickerObj.volume = parseFloat(ticker.volume24h);
                        }
                    }
                });
            }
            
            this.debouncedUpdatePrices();
            console.log('✅ Bybit начальные данные загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки Bybit:', error);
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
            
            // 👇 ПРИМЕНЯЕМ СОРТИРОВКУ ПОСЛЕ ЗАГРУЗКИ
            this.binanceSymbolsCache = this.sortByPopularity(this.binanceSymbolsCache);
            
            this.allBinanceFutures = this.binanceSymbolsCache.filter(s => s.marketType === 'futures');
            this.allBinanceSpot = this.binanceSymbolsCache.filter(s => s.marketType === 'spot');
            console.log(`✅ Binance загружен из IndexedDB: ${this.binanceSymbolsCache.length} символов`);
        }
        
        const bybitCache = await window.db.get('symbolCaches', 'bybit');
        if (bybitCache && bybitCache.data && bybitCache.data.length > 0) {
            this.bybitSymbolsCache = bybitCache.data;
            
            // 👇 ПРИМЕНЯЕМ СОРТИРОВКУ ПОСЛЕ ЗАГРУЗКИ
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
            // 👇 СОРТИРУЕМ ПЕРЕД СОХРАНЕНИЕМ
            const sortedBinance = this.sortByPopularity(this.binanceSymbolsCache);
            
            await window.db.put('symbolCaches', {
                exchange: 'binance',
                data: sortedBinance,
                timestamp: now
            });
            console.log(`✅ Binance сохранён в IndexedDB: ${sortedBinance.length} символов`);
        }
        
        if (this.bybitSymbolsCache && this.bybitSymbolsCache.length > 0) {
            // 👇 СОРТИРУЕМ ПЕРЕД СОХРАНЕНИЕМ
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

   async initializeDataParallel() {
    const container = document.getElementById('tickerListContainer');
    
    const loaded = await this.loadFromIndexedDB();
    
    if (loaded) {
        this.addInitialSymbols();
        this.renderTickerList();
        this.updateModalCount();
        this.refreshSymbolCache(10000).catch(err => 
            console.warn('⚠️ Ошибка фонового обновления:', err)
        );
        return;
    }
    
    // Убрали надпись - просто пусто
    if (container) {
        container.innerHTML = '';
    }
    
    const controllers = [];
    const fetchWithTimeout = (url, timeout) => {
        const controller = new AbortController();
        controllers.push(controller);
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));
    };
    
    const urls = [
        'https://fapi.binance.com/fapi/v1/exchangeInfo',
        'https://api.binance.com/api/v3/exchangeInfo',
        'https://api.bybit.com/v5/market/instruments-info?category=linear',
        'https://api.bybit.com/v5/market/instruments-info?category=spot'
    ];
    
    try {
        const allResults = await Promise.allSettled(
            urls.map(url => fetchWithTimeout(url, 5000).then(r => r.json()).catch(() => null))
        );
        const finalResults = allResults.map(r => r.status === 'fulfilled' ? r.value : null);
        
        this.processParallelData(finalResults, false);
        this.addInitialSymbols();
        await this.saveSymbolsToIndexedDB();
        
        if (container) {
            container.innerHTML = '';
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
       if (container) {
    container.innerHTML = '';   // или ничего
}
    } finally {
        controllers.forEach(c => c.abort());
    }
}

    async refreshSymbolCache(timeout = 10000) {
        if (this._isRefreshing) return;
        
        this._isRefreshing = true;
        
        const controllers = [];
        const fetchWithTimeout = (url, timeout) => {
            const controller = new AbortController();
            controllers.push(controller);
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            return fetch(url, { signal: controller.signal })
                .finally(() => clearTimeout(timeoutId));
        };
        
        const urls = [
            'https://fapi.binance.com/fapi/v1/exchangeInfo',
            'https://api.binance.com/api/v3/exchangeInfo',
            'https://api.bybit.com/v5/market/instruments-info?category=linear',
            'https://api.bybit.com/v5/market/instruments-info?category=spot'
        ];
        
        try {
            const promises = urls.map(url => 
                fetchWithTimeout(url, timeout)
                    .then(r => r.json())
                    .catch(e => {
                        console.warn(`⚠️ Фоновое обновление ${url}:`, e);
                        return null;
                    })
            );
            
            const results = await Promise.allSettled(promises);
            const finalResults = results.map(r => r.status === 'fulfilled' ? r.value : null);
            
            this.processParallelData(finalResults, true);
            
            await this.saveSymbolsToIndexedDB();
            
            console.log('✅ Кэш символов обновлён в фоне');
            
        } catch (error) {
            console.warn('⚠️ Ошибка фонового обновления:', error);
        } finally {
            controllers.forEach(c => c.abort());
            this._isRefreshing = false;
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
        const aIndex = popularityOrder.indexOf(a.symbol);
        const bIndex = popularityOrder.indexOf(b.symbol);
        
        // Оба в списке популярных
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // Только a в списке популярных
        if (aIndex !== -1) return -1;
        // Только b в списке популярных
        if (bIndex !== -1) return 1;
        // Остальные по алфавиту (цифры → буквы)
        return a.symbol.localeCompare(b.symbol);
    });
}
processParallelData(results, updateOnly = false) {
    const MAX_SYMBOLS = 4000;
    
    let binanceFuturesList = [];
    let binanceSpotList = [];
    let bybitFuturesList = [];
    let bybitSpotList = [];
    
    // Binance Futures
    if (results[0] && results[0].symbols) {
        binanceFuturesList = results[0].symbols
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && s.status === 'TRADING')
            .map(s => ({ symbol: s.symbol, exchange: 'binance', marketType: 'futures' }));
        console.log('Binance Futures загружено:', binanceFuturesList.length);
        
        // 👇 СОРТИРУЕМ
        binanceFuturesList = this.sortByPopularity(binanceFuturesList);
    }
    
    // Binance Spot
    if (results[1] && results[1].symbols) {
        binanceSpotList = results[1].symbols
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && s.status === 'TRADING')
            .map(s => ({ symbol: s.symbol, exchange: 'binance', marketType: 'spot' }));
        console.log('Binance Spot загружено:', binanceSpotList.length);
        
        // 👇 СОРТИРУЕМ
        binanceSpotList = this.sortByPopularity(binanceSpotList);
    }
    
    // Bybit Futures
    if (results[2] && results[2].retCode === 0 && results[2].result?.list) {
        bybitFuturesList = results[2].result.list
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && (s.status === 'Trading' || s.status === 'Listed' || s.status === 'Active'))
            .map(s => ({ symbol: s.symbol, exchange: 'bybit', marketType: 'futures' }));
        console.log('Bybit Futures загружено:', bybitFuturesList.length);
        
        // 👇 СОРТИРУЕМ
        bybitFuturesList = this.sortByPopularity(bybitFuturesList);
    }
    
    // Bybit Spot
    if (results[3] && results[3].retCode === 0 && results[3].result?.list) {
        bybitSpotList = results[3].result.list
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && (s.status === 'Trading' || s.status === 'Listed' || s.status === 'Active'))
            .map(s => ({ symbol: s.symbol, exchange: 'bybit', marketType: 'spot' }));
        console.log('Bybit Spot загружено:', bybitSpotList.length);
        
        // 👇 СОРТИРУЕМ
        bybitSpotList = this.sortByPopularity(bybitSpotList);
    }
    
    // ✅ ПРИСВАИВАЕМ (уже отсортированные)
    if (!updateOnly) {
        this.binanceSymbolsCache = [...binanceFuturesList, ...binanceSpotList];
        this.bybitSymbolsCache = [...bybitFuturesList, ...bybitSpotList];
    } else {
        // При обновлении тоже сортируем
        const newBinance = [...binanceFuturesList, ...binanceSpotList];
        const newBybit = [...bybitFuturesList, ...bybitSpotList];
        
        this.binanceSymbolsCache = [...this.binanceSymbolsCache, ...newBinance];
        this.bybitSymbolsCache = [...this.bybitSymbolsCache, ...newBybit];
        
        // Сортируем после объединения
        this.binanceSymbolsCache = this.sortByPopularity(this.binanceSymbolsCache);
        this.bybitSymbolsCache = this.sortByPopularity(this.bybitSymbolsCache);
    }
    
    // ✅ Удаляем дубликаты
    this.binanceSymbolsCache = [...new Map(this.binanceSymbolsCache.map(item => [`${item.symbol}:${item.marketType}`, item])).values()];
    this.bybitSymbolsCache = [...new Map(this.bybitSymbolsCache.map(item => [`${item.symbol}:${item.marketType}`, item])).values()];
    
    // Обновляем основные массивы
    this.allBinanceFutures = this.binanceSymbolsCache.filter(s => s.marketType === 'futures');
    this.allBinanceSpot = this.binanceSymbolsCache.filter(s => s.marketType === 'spot');
    this.allBybitFutures = this.bybitSymbolsCache.filter(s => s.marketType === 'futures');
    this.allBybitSpot = this.bybitSymbolsCache.filter(s => s.marketType === 'spot');
    
    // ✅ Ограничиваем количество
    this.allBinanceFutures = this.allBinanceFutures.slice(0, MAX_SYMBOLS);
    this.allBinanceSpot = this.allBinanceSpot.slice(0, MAX_SYMBOLS);
    this.allBybitFutures = this.allBybitFutures.slice(0, MAX_SYMBOLS);
    this.allBybitSpot = this.allBybitSpot.slice(0, MAX_SYMBOLS);
    
    this.allSymbolsCache = [...this.binanceSymbolsCache, ...this.bybitSymbolsCache];
    this.updateModalCount();
    
    console.log(`📊 Загружено:`);
    console.log(`   Binance Futures: ${this.allBinanceFutures.length}`);
    console.log(`   Binance Spot: ${this.allBinanceSpot.length}`);
    console.log(`   Bybit Futures: ${this.allBybitFutures.length}`);
    console.log(`   Bybit Spot: ${this.allBybitSpot.length}`);
}
    setupClearAllButton() {
        const clearBtn = document.getElementById('clearAllBtn');
        if (clearBtn) {
            clearBtn.addEventListener('dblclick', () => {
                this.clearAllSymbols();
            });
        }
    }
clearAllSymbols() {

    
    // 2. Очищаем все данные
    this.tickers = [];
    this.tickersMap.clear();
    this.state.customSymbols = [];
    this.state.favorites = [];
    this.state.flags = {};
    this.tickerElements.clear();
    this.displayedTickers = [];
    this.totalItems = 0;
    
    // 3. Очищаем кэш
    this.filterCache = null;
    this.formatCache = { prices: new Map(), volumes: new Map(), changes: new Map() };
    
    // 4. Очищаем DOM
    const container = document.getElementById('tickerListContainer');
    if (container) {
        container.innerHTML = '';
        container.style.height = 'auto';
        container.scrollTop = 0;
    }
    
    // 5. Сохраняем пустое состояние
    this.saveState();
    
    // 6. Перезапускаем WebSocket (без символов они не подключатся)
    this.setupWebSockets();
}
    closeAllWebSockets() {
        this.wsReconnectTimers.forEach(timer => clearTimeout(timer));
        this.wsReconnectTimers = [];
        
        this.wsConnections.forEach(ws => {
            try { 
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close(1000, "Closing connection");
                }
            } catch (e) {}
        });
        this.wsConnections = [];
        
        this.state.wsConnected = {
            binanceFutures: false,
            binanceSpot: false,
            bybitFutures: false,
            bybitSpot: false
        };
        
        this.state.wsReconnectAttempts = { 
            binanceFutures: 0, 
            binanceSpot: 0, 
            bybitFutures: 0, 
            bybitSpot: 0 
        };
        
        this.state.binanceHasConnection = { futures: false, spot: false };
        this.state.bybitHasConnection = { futures: false, spot: false };
        this.state.isSettingUpWebSockets = false;
    }

    setupFilters() {
        document.querySelectorAll('[data-filter="market"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter="market"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.marketFilter = btn.dataset.value;
                this.filterCache = null;
                this.renderTickerList();
            });
        });
        
        document.querySelectorAll('[data-filter="exchange"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter="exchange"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.exchangeFilter = btn.dataset.value;
                this.filterCache = null;
                this.renderTickerList();
            });
        });
    }

  setupModal() {
    const modal = document.getElementById('addInstrumentModal');
    const openBtn = document.getElementById('addInstrumentBtn');
    const closeBtn = document.getElementById('modalClose');
    const modalSearch = document.getElementById('modalSearchInput');
    const modalBinanceBtn = document.getElementById('modalBinanceBtn');
    const modalBybitBtn = document.getElementById('modalBybitBtn');
    const modalFuturesBtn = document.getElementById('modalFuturesBtn');
    const modalSpotBtn = document.getElementById('modalSpotBtn');
    const modalAddAllBtn = document.getElementById('modalAddAllBtn');

    openBtn.addEventListener('click', () => {
        this.state.modalExchange = 'binance';
        this.state.modalMarketType = 'futures';
        this.state.modalSearchQuery = '';
        this.state.modalPage = 0;
        modalSearch.value = '';
        this.updateModalButtons();
        modal.classList.add('show');
        modalSearch.focus();
        this.updateModalCount();
        this.updateModalResults(true);
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        this.state.isAddingAllInProgress = false;
        this.state.addingAllOffset = 0;
        modalAddAllBtn.classList.remove('loading');
        modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            this.state.isAddingAllInProgress = false;
            this.state.addingAllOffset = 0;
            modalAddAllBtn.classList.remove('loading');
            modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
        }
    });

    modalBinanceBtn.addEventListener('click', () => { 
        this.state.modalExchange = 'binance'; 
        this.state.modalPage = 0;
        this.updateModalButtons();
        this.updateModalCount();
        this.updateModalResults(true); 
    });
    
    modalBybitBtn.addEventListener('click', () => { 
        this.state.modalExchange = 'bybit'; 
        this.state.modalPage = 0;
        this.updateModalButtons();
        this.updateModalCount();
        this.updateModalResults(true); 
    });
    
    modalFuturesBtn.addEventListener('click', () => { 
        this.state.modalMarketType = 'futures'; 
        this.state.modalPage = 0;
        this.updateModalButtons();
        this.updateModalCount();
        this.updateModalResults(true); 
    });
    
    modalSpotBtn.addEventListener('click', () => { 
        this.state.modalMarketType = 'spot'; 
        this.state.modalPage = 0;
        this.updateModalButtons();
        this.updateModalCount();
        this.updateModalResults(true); 
    });

    modalAddAllBtn.addEventListener('click', async () => {
        if (this.state.isAddingAllInProgress) return;
        
        const cache = this.state.modalExchange === 'binance' ? this.binanceSymbolsCache : this.bybitSymbolsCache;
        const allPairs = cache.filter(s => 
            s.exchange === this.state.modalExchange && 
            s.marketType === this.state.modalMarketType && 
            s.symbol && s.symbol.endsWith('USDT')
        );
        
        if (allPairs.length === 0) return;
        
        this.state.isAddingAllInProgress = true;
        this.state.addingAllOffset = 0;
        modalAddAllBtn.classList.add('loading');
        modalAddAllBtn.innerHTML = '<i class="fas fa-spinner"></i> Загрузка...';
        
        this.addNextBatch();
    });

    // ===== ОЧИЩАЕМ ПОЛЕ ОТ СТАРЫХ ОБРАБОТЧИКОВ =====
    const oldInput = modalSearch;
    const newInput = oldInput.cloneNode(true);
    oldInput.parentNode.replaceChild(newInput, oldInput);
    const modalSearchClean = document.getElementById('modalSearchInput');

    // ===== ОБРАБОТЧИК KEYDOWN С ТРАНСКРИПЦИЕЙ =====
    modalSearchClean.addEventListener('keydown', (e) => {
        // Пропускаем служебные клавиши
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || 
            e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' || 
            e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') {
            return; // Стандартное поведение для этих клавиш
        }
        
        // Игнорируем комбинации с Ctrl, Alt, Meta
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Блокируем стандартное поведение для буквенно-цифровых клавиш
        e.preventDefault();
        
        let char = e.key;
        
        // Если русская буква — конвертируем в английскую
        const ruToEng = {
            'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 'e', 'н': 'n',
            'г': 'g', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': 'h', 'ъ': ']',
            'ф': 'a', 'ы': 's', 'в': 'v', 'а': 'a', 'п': 'p', 'р': 'r',
            'о': 'o', 'л': 'l', 'д': 'd', 'ж': ';', 'э': "'",
            'я': 'z', 'ч': 'x', 'с': 's', 'м': 'm', 'и': 'i', 'т': 't',
            'ь': 'b', 'б': ',', 'ю': '.',
            // Заглавные русские
            'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'E', 'Н': 'N',
            'Г': 'G', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': 'H', 'Ъ': ']',
            'Ф': 'A', 'Ы': 'S', 'В': 'V', 'А': 'A', 'П': 'P', 'Р': 'R',
            'О': 'O', 'Л': 'L', 'Д': 'D', 'Ж': ';', 'Э': "'",
            'Я': 'Z', 'Ч': 'X', 'С': 'S', 'М': 'M', 'И': 'I', 'Т': 'T',
            'Ь': 'B', 'Б': ',', 'Ю': '.'
        };
        
        if (ruToEng[char]) {
            char = ruToEng[char];
        }
        
        // Принудительно делаем заглавной (для английских букв)
        if (char.length === 1 && char.match(/[a-z]/i)) {
            char = char.toUpperCase();
        }

        // Вставляем символ в позицию курсора
        const input = e.target;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const value = input.value;
        
        input.value = value.substring(0, start) + char + value.substring(end);
        input.selectionStart = input.selectionEnd = start + 1;
        
        // Обновляем состояние (без вызова дополнительного события input)
        this.state.modalSearchQuery = input.value;
        this.state.modalPage = 0;
        
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.updateModalResults(true);
        }, 300);
    });

    // ===== ОБРАБОТЧИК INPUT (на случай вставки мышью) =====
    modalSearchClean.addEventListener('input', (e) => {
        const input = e.target;
        const cursor = input.selectionStart;
        
        // Переводим всё в верхний регистр
        input.value = input.value.toUpperCase();
        input.setSelectionRange(cursor, cursor);
        
        this.state.modalSearchQuery = input.value;
        this.state.modalPage = 0;
        
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.updateModalResults(true);
        }, 300);
    });

    // Обработчик Escape и Enter (глобальный)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            modal.classList.remove('show');
            this.state.isAddingAllInProgress = false;
            this.state.addingAllOffset = 0;
            modalAddAllBtn.classList.remove('loading');
            modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
        }
        
        if (e.key === 'Enter' && modal.classList.contains('show')) {
            e.preventDefault();
            const firstItem = document.querySelector('.modal-result-item:not(.added)');
            if (firstItem) {
                const symbol = firstItem.dataset.symbol;
                const exchange = firstItem.dataset.exchange;
                const marketType = firstItem.dataset.marketType;
                if (this.addSymbol(symbol, true, exchange, marketType)) {
                    this.updateModalCount();
                    this.updateModalResults(true);
                    this.filterCache = null;
                    this.renderTickerList();
                    if (e.shiftKey) modal.classList.remove('show');
                }
            }
        }
    });
}
 addNextBatch() {
    if (!this.state.isAddingAllInProgress) return;
    
    const modalAddAllBtn = document.getElementById('modalAddAllBtn');
    const cache = this.state.modalExchange === 'binance' ? this.binanceSymbolsCache : this.bybitSymbolsCache;
    const allPairs = cache.filter(s => 
        s.exchange === this.state.modalExchange && 
        s.marketType === this.state.modalMarketType && 
        s.symbol && s.symbol.endsWith('USDT')
    );
    
    const batchSize = this.state.addingAllBatchSize;
    const start = this.state.addingAllOffset;
    const end = Math.min(start + batchSize, allPairs.length);
    
    for (let i = start; i < end; i++) {
        const symbolData = allPairs[i];
        if (symbolData && symbolData.symbol && !this.tickers.some(t => 
            t.symbol === symbolData.symbol && 
            t.exchange === symbolData.exchange && 
            t.marketType === symbolData.marketType
        )) {
            this.addSymbol(symbolData.symbol, true, symbolData.exchange, symbolData.marketType, false, true);
        }
    }
    
    this.state.addingAllOffset = end;
    const progress = Math.round((end / allPairs.length) * 100);
    if (modalAddAllBtn) {
        modalAddAllBtn.innerHTML = `<i class="fas fa-spinner"></i> Загружено ${end}/${allPairs.length} (${progress}%)`;
    }
    
    if (end < allPairs.length) {
        setTimeout(() => this.addNextBatch(), 50);
    } else {
        this.state.isAddingAllInProgress = false;
        if (modalAddAllBtn) {
            modalAddAllBtn.classList.remove('loading');
            modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
        }
        this.updateModalCount();
        this.updateModalResults(true);
        this.filterCache = null;
        this.renderTickerList();
        
        
        
        this.setupWebSockets();
    }
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

    updateModalButtons() {
        const binanceBtn = document.getElementById('modalBinanceBtn');
        const bybitBtn = document.getElementById('modalBybitBtn');
        const futuresBtn = document.getElementById('modalFuturesBtn');
        const spotBtn = document.getElementById('modalSpotBtn');
        
        if (binanceBtn) binanceBtn.classList.toggle('active', this.state.modalExchange === 'binance');
        if (bybitBtn) bybitBtn.classList.toggle('active', this.state.modalExchange === 'bybit');
        if (futuresBtn) futuresBtn.classList.toggle('active', this.state.modalMarketType === 'futures');
        if (spotBtn) spotBtn.classList.toggle('active', this.state.modalMarketType === 'spot');
    }

    updateModalCount() {
        let count = this.getFilteredCount(this.state.modalExchange, this.state.modalMarketType, this.state.modalSearchQuery);
        const foundSpan = document.getElementById('modalFoundCount');
        if (foundSpan) foundSpan.textContent = count;
    }

    updateModalResults(reset = false) {
        const resultsContainer = document.getElementById('modalResults');
        
        if (reset) {
            this.state.modalPage = 0;
        }
        
        let source;
        if (this.state.modalExchange === 'binance') {
            source = this.state.modalMarketType === 'futures' ? this.allBinanceFutures : this.allBinanceSpot;
        } else {
            source = this.state.modalMarketType === 'futures' ? this.allBybitFutures : this.allBybitSpot;
        }
        
        if (!source || source.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Загрузка данных...</div>';
            return;
        }
        
        let filteredResults = [...source];
        
        if (this.state.modalSearchQuery) {
            const query = this.state.modalSearchQuery.toUpperCase();
            filteredResults = filteredResults.filter(s => s.symbol.includes(query));
        }
        
        this.modalAllResults = filteredResults;
        
        const pageSize = this.state.modalPageSize;
        const startIndex = reset ? 0 : this.state.modalPage * pageSize;
        const endIndex = Math.min(startIndex + pageSize, this.modalAllResults.length);
        
        if (this.modalAllResults.length === 0) {
    resultsContainer.innerHTML = '';   // или оставить пустым
    return;
}
        const pageResults = this.modalAllResults.slice(startIndex, endIndex);
        
        if (!reset && startIndex < this.modalAllResults.length) {
            this.state.modalPage++;
        }
        
        this.renderModalResults(pageResults, !reset && startIndex > 0);
    }

    renderModalResults(results, append = false) {
        const resultsContainer = document.getElementById('modalResults');
        
        if (results.length === 0 && !append) { 
            resultsContainer.innerHTML = '<div class="no-results">Инструменты не найдены</div>'; 
            return; 
        }
        
        let html = append ? resultsContainer.innerHTML : '';
        
        for (const symbolData of results) {
            if (!symbolData || !symbolData.symbol) continue;
            
            const isAdded = this.tickers.some(t => 
                t.symbol === symbolData.symbol && 
                t.exchange === symbolData.exchange && 
                t.marketType === symbolData.marketType
            );
            
            const addedClass = isAdded ? 'added' : '';
            
            let exchangeIconHtml = '';
            if (symbolData.exchange === 'binance') {
                exchangeIconHtml = `
                    <div class="modal-exchange-icon binance-icon">
                       <svg width="25" height="25" viewBox="0 0 32 32">
                          <circle cx="16" cy="16" r="15" fill="none" stroke="#FFA500" stroke-width="1.2"/>
                          <g transform="translate(16, 16) scale(0.025)">
                            <g transform="translate(-500, -500)">
                              <path fill="#F0B90B" d="M500,612.7l112.7-112.7L500,387.3L387.3,500L500,612.7z M500,774.6L306.4,581L193.6,693.7L500,1000l306.4-306.3L693.7,581L500,774.6z M887.3,387.3L774.6,500l112.7,112.7L1000,500L887.3,387.3z M500,225.4l193.7,193.7L806.4,306.4L500,0L193.6,306.4l112.7,112.7L500,225.4z M225.4,500L112.7,612.7L0,500l112.7-112.7L225.4,500z"/>
                            </g>
                          </g>
                        </svg>
                    </div>
                `;
            } else {
                exchangeIconHtml = `
                    <div class="modal-exchange-icon bybit-icon">
                       <svg width="25" height="25" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="19" fill="none" stroke="#FFFFFF" stroke-width="1.2"/>
                          <g transform="translate(20, 20) scale(0.012)">
                            <g transform="translate(-1300, -420)">
                              <polygon fill="#F7A600" points="1781.6,642.2 1781.6,0 1910.7,0 1910.7,642.2"/>
                              <path fill="#FFFFFF" d="M277.3,832.9H0.6V190.8h265.6c129,0,204.3,70.4,204.3,180.4c0,71.3-48.3,117.2-81.8,132.6c39.9,18,91,58.6,91,144.3 C479.7,767.9,395.2,832.9,277.3,832.9L277.3,832.9z M256,302.7H129.6v147.9H256c54.8,0,85.5-29.8,85.5-74S310.8,302.7,256,302.7 L256,302.7z M264.3,563.3H129.6v157.8h134.6c58.6,0,86.4-36.1,86.4-79.4C350.6,598.4,322.7,563.3,264.3,563.3z"/>
                              <polygon fill="#FFFFFF" points="873.4,569.5 873.4,832.9 745.2,832.9 745.2,569.5 546.5,190.8 686.8,190.8 810.2,449.6 931.9,190.8 1072.1,190.8"/>
                              <path fill="#FFFFFF" d="M1438,832.9h-276.7V190.8h265.6c129,0,204.3,70.4,204.3,180.4c0,71.3-48.3,117.2-81.8,132.6c39.9,18,91,58.6,91,144.3 C1640.4,767.9,1556,832.9,1438,832.9L1438,832.9z M1416.7,302.7h-126.3v147.9h126.3c54.8,0,85.5-29.8,85.5-74 C1502.1,332.4,1471.4,302.7,1416.7,302.7L1416.7,302.7z M1425,563.3h-134.6v157.8H1425c58.6,0,86.4-36.1,86.4-79.4 C1511.4,598.4,1483.5,563.3,1425,563.3L1425,563.3z"/>
                              <polygon fill="#FFFFFF" points="2326.7,302.7 2326.7,833 2197.6,833 2197.6,302.7 2024.9,302.7 2024.9,190.8 2499.4,190.8 2499.4,302.7"/>
                            </g>
                          </g>
                        </svg>
                    </div>
                `;
            }
            
            if (isAdded) {
                html += `<div class="modal-result-item ${addedClass}" data-symbol="${symbolData.symbol}" data-exchange="${symbolData.exchange}" data-market-type="${symbolData.marketType}">${exchangeIconHtml}<span class="modal-result-symbol">${symbolData.symbol}</span><div class="modal-result-exchange"><span>${symbolData.exchange === 'binance' ? 'Binance' : 'Bybit'} - ${symbolData.marketType === 'futures' ? 'Futures' : 'Spot'}</span></div><div class="modal-result-actions"><span class="modal-check-icon"><i class="fas fa-check-circle"></i></span><span class="modal-target-btn" data-symbol="${symbolData.symbol}" data-exchange="${symbolData.exchange}" data-market-type="${symbolData.marketType}" title="Прицелиться"><i class="fas fa-crosshairs"></i></span></div></div>`;
            } else {
                html += `<div class="modal-result-item ${addedClass}" data-symbol="${symbolData.symbol}" data-exchange="${symbolData.exchange}" data-market-type="${symbolData.marketType}">${exchangeIconHtml}<span class="modal-result-symbol">${symbolData.symbol}</span><div class="modal-result-exchange"><span>${symbolData.exchange === 'binance' ? 'Binance' : 'Bybit'} - ${symbolData.marketType === 'futures' ? 'Futures' : 'Spot'}</span></div><span class="modal-add-icon"><i class="fas fa-plus-circle"></i></span></div>`;
            }
        }
        
        resultsContainer.innerHTML = html;
        
        document.querySelectorAll('.modal-result-item:not(.added)').forEach(item => {
            item.addEventListener('click', (e) => {
                const symbol = item.dataset.symbol;
                const exchange = item.dataset.exchange;
                const marketType = item.dataset.marketType;
                
                if (this.addSymbol(symbol, true, exchange, marketType)) {
                    this.updateModalCount();
                    this.updateModalResults(true);
                    this.filterCache = null;
                    this.renderTickerList();
                    if (e.shiftKey) {
                        document.getElementById('addInstrumentModal').classList.remove('show');
                    }
                }
            });
        });
        
        document.querySelectorAll('.modal-target-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                const exchange = btn.dataset.exchange;
                const marketType = btn.dataset.marketType;
                
                if (this.focusOnSymbol) {
                    this.focusOnSymbol(symbol, exchange, marketType);
                } else {
                    document.getElementById('addInstrumentModal').classList.remove('show');
                }
            });
        });
        
        if (!resultsContainer._scrollHandler) {
            resultsContainer._scrollHandler = () => {
                const { scrollTop, scrollHeight, clientHeight } = resultsContainer;
                if (scrollHeight - scrollTop - clientHeight < 100) {
                    if (this.modalAllResults && 
                        this.state.modalPage * this.state.modalPageSize < this.modalAllResults.length) {
                        this.updateModalResults(false);
                    }
                }
            };
            resultsContainer.addEventListener('scroll', resultsContainer._scrollHandler);
        }
    }

setupWebSockets() {
    // ✅ ДОБАВЛЯЕМ ОЧИСТКУ В САМОМ НАЧАЛЕ
    this.cleanup();
    
    // Логирование
    if (this.debugMode) {
        console.log('🔄 Настройка WebSocket...');
        console.log('   Текущие символы:', this.tickers.map(t => `${t.symbol}:${t.exchange}:${t.marketType}`));
    }
    
    // Если уже настраиваем - пропускаем
    if (this.state.isSettingUpWebSockets) {
        if (this.debugMode) console.log('⏭️ WebSocket уже настраивается, пропускаем');
        return;
    }
    
    this.state.isSettingUpWebSockets = true;
    
    // Проверяем наличие символов для каждого типа
    const hasBinanceFutures = this.tickers.some(t => t.exchange === 'binance' && t.marketType === 'futures');
    const hasBinanceSpot = this.tickers.some(t => t.exchange === 'binance' && t.marketType === 'spot');
    const hasBybitFutures = this.tickers.some(t => t.exchange === 'bybit' && t.marketType === 'futures');
    const hasBybitSpot = this.tickers.some(t => t.exchange === 'bybit' && t.marketType === 'spot');
    
    // Счётчик для задержек между подключениями
    let connectionsToMake = 0;
    
    // Binance Futures
    if (hasBinanceFutures && !this.state.wsConnected.binanceFutures && !this._binanceFuturesConnecting) {
        this._binanceFuturesConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBinanceWebSocket('futures', 'wss://fstream.binance.com/ws/!ticker@arr');
        }, connectionsToMake * 500);
    }
    
    // Binance Spot
    if (hasBinanceSpot && !this.state.wsConnected.binanceSpot && !this._binanceSpotConnecting) {
        this._binanceSpotConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBinanceWebSocket('spot', 'wss://stream.binance.com:9443/ws/!ticker@arr');
        }, connectionsToMake * 500);
    }
    
    // Bybit Futures
    if (hasBybitFutures && !this.state.wsConnected.bybitFutures && !this._bybitFuturesConnecting) {
        this._bybitFuturesConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBybitWebSocket('futures', 'wss://stream.bybit.com/v5/public/linear');
        }, connectionsToMake * 500);
    }
    
    // Bybit Spot
    if (hasBybitSpot && !this.state.wsConnected.bybitSpot && !this._bybitSpotConnecting) {
        this._bybitSpotConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBybitWebSocket('spot', 'wss://stream.bybit.com/v5/public/spot');
        }, connectionsToMake * 500);
    }
    
    // Сбрасываем флаг настройки через разумное время (учитывая все задержки)
    const totalDelay = (connectionsToMake + 1) * 500 + 2000;
    setTimeout(() => {
        this.state.isSettingUpWebSockets = false;
        if (this.debugMode) console.log('✅ Настройка WebSocket завершена');
    }, totalDelay);
}
startFallbackPriceUpdates() {
    // Очищаем предыдущий интервал, если он был
    if (this.fallbackInterval) clearInterval(this.fallbackInterval);
    
    // Запускаем обновление каждые 5 секунд
    this.fallbackInterval = setInterval(async () => {
        // Обновляем только символы, у которых цена 0 (или null)
        const symbolsToUpdate = this.tickers.filter(t => !t.price || t.price === 0);
        if (symbolsToUpdate.length === 0) return;
        
        // Группируем по бирже и типу рынка
        const binanceFuturesSymbols = symbolsToUpdate
            .filter(t => t.exchange === 'binance' && t.marketType === 'futures')
            .map(t => t.symbol);
        const binanceSpotSymbols = symbolsToUpdate
            .filter(t => t.exchange === 'binance' && t.marketType === 'spot')
            .map(t => t.symbol);
        const bybitFuturesSymbols = symbolsToUpdate
            .filter(t => t.exchange === 'bybit' && t.marketType === 'futures')
            .map(t => t.symbol);
        const bybitSpotSymbols = symbolsToUpdate
            .filter(t => t.exchange === 'bybit' && t.marketType === 'spot')
            .map(t => t.symbol);
        
        // Параллельные запросы
        const promises = [];
        
        if (binanceFuturesSymbols.length) {
            promises.push(this.fetchBinanceFuturesPrices(binanceFuturesSymbols));
        }
        if (binanceSpotSymbols.length) {
            promises.push(this.fetchBinanceSpotPrices(binanceSpotSymbols));
        }
        if (bybitFuturesSymbols.length) {
            promises.push(this.fetchBybitFuturesPrices(bybitFuturesSymbols));
        }
        if (bybitSpotSymbols.length) {
            promises.push(this.fetchBybitSpotPrices(bybitSpotSymbols));
        }
        
        if (promises.length) {
            await Promise.allSettled(promises);
            // После обновления данных вызываем перерисовку
            this.debouncedUpdatePrices();
        }
    }, 5000); // 5 секунд
}
   connectBinanceWebSocket(marketType, url) {
    const attemptKey = marketType === 'futures' ? 'binanceFutures' : 'binanceSpot';
    
    if (this.state.wsReconnectAttempts[attemptKey] >= this.state.maxReconnectAttempts) {
        return;
    }
    
    if (!this.tickers.some(t => t.exchange === 'binance' && t.marketType === marketType)) {
        return;
    }
    
    const ws = new WebSocket(url);
    const exchange = 'binance';
    let reconnectTimer;
    let pingInterval;
    
    ws.onopen = () => {
        console.log(`✅ Binance ${marketType} WebSocket открыт`);
        this.state.binanceHasConnection[marketType] = true;
        this.state.wsReconnectAttempts[attemptKey] = 0;    // сброс счётчика
        this.state.wsConnected[attemptKey] = true;
        
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 180000);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.result !== undefined || data.id || data.pong) return;
            
            if (Array.isArray(data)) {
                data.forEach(tickerData => {
                    if (tickerData && tickerData.s) {
                        this._processBinanceTicker(tickerData, exchange, marketType);
                    }
                });
            } else if (data.s) {
                this._processBinanceTicker(data, exchange, marketType);
            }
            
            if (!this.updatePending) {
                this.updatePending = true;
                setTimeout(() => this.applyBinanceUpdates(), 100);
            }
        } catch (error) { 
            console.error(`Binance ${marketType} parse error:`, error); 
        }
    };
    
    ws.onerror = (error) => {
        console.error(`Binance ${marketType} WebSocket error:`, error);
        this.state.binanceHasConnection[marketType] = false;
    };
    
    ws.onclose = () => {
        console.log(`❌ Binance ${marketType} WebSocket закрыт`);
        this.state.binanceHasConnection[marketType] = false;
        this.state.wsConnected[attemptKey] = false;
        
        if (pingInterval) clearInterval(pingInterval);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        
        this.state.wsReconnectAttempts[attemptKey]++;
        
        if (this.tickers.some(t => t.exchange === 'binance' && t.marketType === marketType) && 
            this.state.wsReconnectAttempts[attemptKey] < this.state.maxReconnectAttempts) {
            // Экспоненциальная задержка, максимум 30 секунд
            const delay = Math.min(30000, Math.pow(2, this.state.wsReconnectAttempts[attemptKey]) * 1000);
            reconnectTimer = setTimeout(() => {
                this.connectBinanceWebSocket(marketType, url);
            }, delay);
            this.wsReconnectTimers.push(reconnectTimer);
        }
    };
    
    this.wsConnections.push(ws);
}

 _processBinanceTicker(tickerData, exchange, marketType) {
    if (!tickerData || !tickerData.s) return;
    
    const symbol = tickerData.s;
    const key = `${symbol}:${exchange}:${marketType}`;
    const ticker = this.tickersMap.get(key);
    
    if (!ticker) return;
    
    // Накопление обновлений в буфер
    if (!this.wsUpdateBuffer.has(key)) {
        this.wsUpdateBuffer.set(key, {});
    }
    
    const update = this.wsUpdateBuffer.get(key);
    
    if (tickerData.c !== undefined) {
        update.price = parseFloat(tickerData.c);
        
        // Обновление текущей свечи на графике (активный символ)
        if (window.chartManagerInstance && window.chartManagerInstance.currentSymbol === symbol) {
            window.chartManagerInstance.updateCurrentCandle(update.price);
        }
    }
    if (tickerData.P !== undefined) {
        update.change = parseFloat(tickerData.P);
    }
    if (tickerData.q !== undefined) {
        update.volume = parseFloat(tickerData.q);
    }
    if (tickerData.n !== undefined) {
        update.trades = parseInt(tickerData.n);
    }
    
    // Запускаем таймер для отложенной обработки
    if (this.wsUpdateTimer) {
        clearTimeout(this.wsUpdateTimer);
    }
    this.wsUpdateTimer = setTimeout(() => {
        this.flushWsUpdates();
    }, this.wsDebounceMs);
}
 applyBinanceUpdates() {
    if (this.pendingUpdates.size === 0) {
        this.updatePending = false;
        return;
    }
    
    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();
    
    let hasUpdates = false;
    let hasSignificantChange = this._hasSignificantChange || false;
    this._hasSignificantChange = false;
    
    updates.forEach((update, key) => {
        const ticker = this.tickersMap.get(key);
        if (ticker) {
            if (update.price !== undefined) {
                const oldPrice = ticker.price;
                ticker.price = update.price;
                
                if (oldPrice && oldPrice !== 0 && !hasSignificantChange) {
                    const changePercent = Math.abs((update.price - oldPrice) / oldPrice) * 100;
                    if (changePercent > 0.5) {
                        hasSignificantChange = true;
                        if (this.debugMode) {
                            console.log(`⚡ Значительное изменение ${ticker.symbol}: ${oldPrice} → ${update.price}`);
                        }
                    }
                }
                
                if (window.chartManagerInstance && window.chartManagerInstance.currentSymbol === ticker.symbol) {
                    window.chartManagerInstance.updateCurrentCandle(update.price);
                }
            }
            if (update.change !== undefined) ticker.change = update.change;
            if (update.volume !== undefined) ticker.volume = update.volume;
            if (update.trades !== undefined) ticker.trades = update.trades;
            hasUpdates = true;
        }
    });
    
    this.updatePending = false;
    
    if (hasUpdates) {
        if (hasSignificantChange) {
            this.updatePriceImmediate();
        } else {
            this.debouncedUpdatePrices();
        }
    }
}
flushWsUpdates() {
    if (this.wsUpdateBuffer.size === 0) return;
    
    // Переносим обновления из буфера в pendingUpdates
    for (const [key, update] of this.wsUpdateBuffer.entries()) {
        if (!this.pendingUpdates.has(key)) {
            this.pendingUpdates.set(key, {});
        }
        const existing = this.pendingUpdates.get(key);
        Object.assign(existing, update);
    }
    
    // Очищаем буфер
    this.wsUpdateBuffer.clear();
    this.wsUpdateTimer = null;
    
    // Запускаем обработку (общий метод, который сам решит, что вызывать)
    if (!this.updatePending) {
        this.updatePending = true;
        setTimeout(() => {
            this.processPendingUpdates();
        }, 100);
    }
}
processPendingUpdates() {
    if (this.pendingUpdates.size === 0) {
        this.updatePending = false;
        return;
    }
    
    // Проверяем, есть ли обновления от Binance или Bybit
    let hasBinance = false;
    let hasBybit = false;
    
    for (const [key] of this.pendingUpdates) {
        if (key.includes('binance')) hasBinance = true;
        if (key.includes('bybit')) hasBybit = true;
    }
    
    if (hasBinance) {
        this.applyBinanceUpdates();
    }
    if (hasBybit) {
        this.applyBybitUpdates();
    }
    
    this.updatePending = false;
}
  connectBybitWebSocket(marketType, url) {
    const attemptKey = marketType === 'futures' ? 'bybitFutures' : 'bybitSpot';
    
    if (this.state.wsReconnectAttempts[attemptKey] >= this.state.maxReconnectAttempts) {
        return;
    }
    
    if (!this.tickers.some(t => t.exchange === 'bybit' && t.marketType === marketType)) {
        return;
    }
    
    const ws = new WebSocket(url);
    const exchange = 'bybit';
    let reconnectTimer;
    let pingInterval;
    
    ws.onopen = () => {
        console.log(`✅ Bybit ${marketType} WebSocket открыт`);
        this.state.bybitHasConnection[marketType] = true;
        this.state.wsReconnectAttempts[attemptKey] = 0;    // сброс счётчика
        this.state.wsConnected[attemptKey] = true;
        this.subscribeAllBybitSymbols(ws, marketType);
        
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: "ping" }));
            }
        }, 20000);
        this.processPendingBybitSubscriptions();
    };
    
  ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        
        if (data.op === "pong") return;
        if (data.op === 'subscribe') return;
        
        if (data.topic && data.topic.startsWith('tickers.')) {
            if (!data.data || !data.data.symbol) return;
            
            const symbol = data.data.symbol;
            const tickerData = data.data;
            
            const key = `${symbol}:${exchange}:${marketType}`;
            const ticker = this.tickersMap.get(key);
            
            if (ticker) {
                // ✅ НАКОПЛЕНИЕ В БУФЕР (как для Binance)
                if (!this.wsUpdateBuffer.has(key)) {
                    this.wsUpdateBuffer.set(key, {});
                }
                
                const update = this.wsUpdateBuffer.get(key);
                if (tickerData.lastPrice) update.price = parseFloat(tickerData.lastPrice);
                if (tickerData.price24hPcnt !== undefined) {
                    update.change = parseFloat(tickerData.price24hPcnt) * 100;
                }
                if (tickerData.turnover24h !== undefined) {
                    update.volume = parseFloat(tickerData.turnover24h);
                }
                
                // Запускаем таймер для отложенной обработки
                if (this.wsUpdateTimer) {
                    clearTimeout(this.wsUpdateTimer);
                }
                this.wsUpdateTimer = setTimeout(() => {
                    this.flushWsUpdates();
                }, this.wsDebounceMs);
            }
        }
    } catch (error) { 
        console.error('Bybit WebSocket error:', error); 
    }
};
    
    ws.onerror = (error) => {
        console.error(`Bybit ${marketType} WebSocket error:`, error);
        this.state.bybitHasConnection[marketType] = false;
    };
    
    ws.onclose = () => {
        console.log(`❌ Bybit ${marketType} WebSocket закрыт`);
        this.state.bybitHasConnection[marketType] = false;
        this.state.wsConnected[attemptKey] = false;
        
        if (pingInterval) clearInterval(pingInterval);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        
        this.state.wsReconnectAttempts[attemptKey]++;
        
        if (this.tickers.some(t => t.exchange === 'bybit' && t.marketType === marketType) && 
            this.state.wsReconnectAttempts[attemptKey] < this.state.maxReconnectAttempts) {
            // Экспоненциальная задержка, максимум 30 секунд
            const delay = Math.min(30000, Math.pow(2, this.state.wsReconnectAttempts[attemptKey]) * 1000);
            reconnectTimer = setTimeout(() => {
                this.connectBybitWebSocket(marketType, url);
            }, delay);
            this.wsReconnectTimers.push(reconnectTimer);
        }
    };
    
    this.wsConnections.push(ws);
}

   updateBybitSubscription(marketType, symbol) {
    // Ищем открытый WebSocket для Bybit
    const ws = this.wsConnections.find(conn => 
        conn.url && (
            (marketType === 'futures' && conn.url.includes('linear')) ||
            (marketType === 'spot' && conn.url.includes('spot'))
        ) && conn.readyState === WebSocket.OPEN
    );
    
    if (ws) {
        const subscribeMsg = {
            op: "subscribe",
            args: [`tickers.${symbol}`]
        };
        ws.send(JSON.stringify(subscribeMsg));
        if (this.debugMode) {
            console.log(`✅ Bybit подписан на ${symbol} (${marketType})`);
        }
        return true;
    } else {
        // Добавляем в очередь, если WebSocket ещё не открыт
        if (!this._pendingBybitSubscriptions) this._pendingBybitSubscriptions = [];
        this._pendingBybitSubscriptions.push({ symbol, marketType });
        if (this.debugMode) {
            console.log(`⏳ Bybit WebSocket не готов, ${symbol} добавлен в очередь (${this._pendingBybitSubscriptions.length} в очереди)`);
        }
        return false;
    }
}
processPendingBybitSubscriptions() {
    if (!this._pendingBybitSubscriptions || this._pendingBybitSubscriptions.length === 0) return;
    
    const pending = [...this._pendingBybitSubscriptions];
    this._pendingBybitSubscriptions = [];
    
    if (this.debugMode) {
        console.log(`📡 Обработка очереди Bybit подписок: ${pending.length} символов`);
    }
    
    pending.forEach(({ symbol, marketType }) => {
        this.updateBybitSubscription(marketType, symbol);
    });
}
    subscribeAllBybitSymbols(ws, marketType) {
        const symbols = this.tickers
            .filter(t => t.exchange === 'bybit' && t.marketType === marketType && t.symbol)
            .map(t => t.symbol);
        
        const uniqueSymbols = [...new Set(symbols)];
        
        if (uniqueSymbols.length > 0) {
            const batchSize = 10;
            for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
                const batch = uniqueSymbols.slice(i, i + batchSize);
                const subscribeMsg = {
                    op: "subscribe",
                    args: batch.map(s => `tickers.${s}`)
                };
                
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(subscribeMsg));
                    }
                }, i * 100);
            }
        }
    }

 applyBybitUpdates() {
    if (this.pendingUpdates.size === 0) {
        this.updatePending = false;
        return;
    }
    
    // Создаём локальную копию
    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();
    
    let hasUpdates = false;
    let hasSignificantChange = this._hasSignificantChange || false;
    this._hasSignificantChange = false;
    
    updates.forEach((update, key) => {
        const ticker = this.tickersMap.get(key);
        if (ticker) {
            if (update.price !== undefined) {
                const oldPrice = ticker.price;
                ticker.price = update.price;
                
                // Проверка на значительное изменение
                if (oldPrice && oldPrice !== 0 && !hasSignificantChange) {
                    const changePercent = Math.abs((update.price - oldPrice) / oldPrice) * 100;
                    if (changePercent > 0.5) {
                        hasSignificantChange = true;
                        if (this.debugMode) {
                            console.log(`⚡ Значительное изменение ${ticker.symbol}: ${oldPrice} → ${update.price} (${changePercent.toFixed(2)}%)`);
                        }
                    }
                }
                
                // Обновление текущей свечи на графике
                if (window.chartManagerInstance && window.chartManagerInstance.currentSymbol === ticker.symbol) {
                    window.chartManagerInstance.updateCurrentCandle(update.price);
                }
            }
            if (update.change !== undefined) ticker.change = update.change;
            if (update.volume !== undefined) ticker.volume = update.volume;
            hasUpdates = true;
        }
    });
    
    this.updatePending = false;
    
    if (hasUpdates) {
        if (hasSignificantChange) {
            this.updatePriceImmediate();
        } else {
            this.debouncedUpdatePrices();
        }
    }
}
async fetchBinanceFuturesPrices(symbols) {
    try {
        // Если символов много, лучше запросить все сразу
        const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
        if (!response.ok) return;
        const data = await response.json();
        
        data.forEach(item => {
            const symbol = item.symbol;
            if (symbols.includes(symbol)) {
                const key = `${symbol}:binance:futures`;
                const ticker = this.tickersMap.get(key);
                if (ticker && !ticker.price) {
                    ticker.price = parseFloat(item.price);
                    // Можно также обновить изменение, но в REST-эндпоинте /price нет изменения, только цена
                }
            }
        });
    } catch (error) {
        console.warn('Ошибка Binance Futures REST:', error);
    }
}
async fetchBinanceSpotPrices(symbols) {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price');
        if (!response.ok) return;
        const data = await response.json();
        
        data.forEach(item => {
            const symbol = item.symbol;
            if (symbols.includes(symbol)) {
                const key = `${symbol}:binance:spot`;
                const ticker = this.tickersMap.get(key);
                if (ticker && !ticker.price) {
                    ticker.price = parseFloat(item.price);
                }
            }
        });
    } catch (error) {
        console.warn('Ошибка Binance Spot REST:', error);
    }
}
async fetchBybitFuturesPrices(symbols) {
    try {
        const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
        if (!response.ok) return;
        const data = await response.json();
        if (data.retCode !== 0 || !data.result?.list) return;
        
        data.result.list.forEach(item => {
            const symbol = item.symbol;
            if (symbols.includes(symbol)) {
                const key = `${symbol}:bybit:futures`;
                const ticker = this.tickersMap.get(key);
                if (ticker && !ticker.price) {
                    ticker.price = parseFloat(item.lastPrice);
                    ticker.change = parseFloat(item.price24hPcnt) * 100;
                    ticker.volume = parseFloat(item.volume24h);
                }
            }
        });
    } catch (error) {
        console.warn('Ошибка Bybit Futures REST:', error);
    }
}
async fetchBybitSpotPrices(symbols) {
    try {
        const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
        if (!response.ok) return;
        const data = await response.json();
        if (data.retCode !== 0 || !data.result?.list) return;
        
        data.result.list.forEach(item => {
            const symbol = item.symbol;
            if (symbols.includes(symbol)) {
                const key = `${symbol}:bybit:spot`;
                const ticker = this.tickersMap.get(key);
                if (ticker && !ticker.price) {
                    ticker.price = parseFloat(item.lastPrice);
                    ticker.change = parseFloat(item.price24hPcnt) * 100;
                    ticker.volume = parseFloat(item.volume24h);
                }
            }
        });
    } catch (error) {
        console.warn('Ошибка Bybit Spot REST:', error);
    }
}
  updatePriceElements() {
    const container = document.getElementById('tickerListContainer');
    if (!container) return;
    
    // Получаем текущую позицию скролла
    const scrollTop = container.scrollTop;
    
    // Вычисляем, какие индексы сейчас видны
    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight));
    const endIndex = Math.min(startIndex + this.visibleCount + 5, this.totalItems); // +5 буфер
    
    let hasUpdates = false;
    
    // Обновляем ТОЛЬКО видимые элементы
    for (let i = startIndex; i < endIndex; i++) {
        const ticker = this.displayedTickers[i];
        if (!ticker) continue;
        
        const key = `${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`;
        const el = this.tickerElements.get(key);
        
        if (!el || !el.isConnected) continue;
        
        // Обновляем цены в элементе
        const priceEl = el.querySelector('.ticker-price');
        const changeEl = el.querySelector('.ticker-change');
        const volumeEl = el.querySelector('.ticker-volume');
        const tradesEl = el.querySelector('.ticker-trades');
        
        const newPrice = this.formatPrice(ticker.price);
        const newChange = this.formatChange(ticker.change) + '%';
        const newVolume = this.formatVolume(ticker.volume);
        const newTrades = this.formatTrades(ticker);
        
        if (priceEl && priceEl.textContent !== newPrice) {
            priceEl.textContent = newPrice;
            priceEl.className = `ticker-price ${ticker.change > 0 ? 'positive' : ticker.change < 0 ? 'negative' : ''}`;
            hasUpdates = true;
        }
        if (changeEl && changeEl.textContent !== newChange) {
            changeEl.textContent = newChange;
            changeEl.className = `ticker-change ${ticker.change > 0 ? 'positive' : ticker.change < 0 ? 'negative' : ''}`;
            hasUpdates = true;
        }
        if (volumeEl && volumeEl.textContent !== newVolume) {
            volumeEl.textContent = newVolume;
            hasUpdates = true;
        }
        if (tradesEl && tradesEl.textContent !== newTrades) {
            tradesEl.textContent = newTrades;
            hasUpdates = true;
        }
    }
    
    // Только если были обновления и сортировка по объёму
    if (hasUpdates && this.state.sortBy === 'volume') {
        this.filterCache = null;
        this.renderTickerList();
    }
}

    sortTickers(tickers) {
        return [...tickers].sort((a, b) => {
            let result = 0;
            if (this.state.sortBy === 'name') result = a.symbol.localeCompare(b.symbol);
            else if (this.state.sortBy === 'price') result = (a.price || 0) - (b.price || 0);
            else if (this.state.sortBy === 'change') result = (a.change || 0) - (b.change || 0);
            else if (this.state.sortBy === 'volume') result = (a.volume || 0) - (b.volume || 0);
            else if (this.state.sortBy === 'trades') result = (a.trades || 0) - (b.trades || 0);
            return this.state.sortDirection === 'asc' ? result : -result;
        });
    }

    getFilteredTickers() {
    // ✅ ВКЛЮЧАЕМ sortBy и sortDirection В КЛЮЧ КЭША
    const cacheKey = `${this.state.marketFilter}:${this.state.exchangeFilter}:${this.state.activeTab}:${this.state.activeFlagTab}:${this.state.sortBy}:${this.state.sortDirection}`;
    
    if (this.filterCache && this.filterCache.key === cacheKey) {
        return this.filterCache.result;
    }
    
    let filtered = [...this.tickers];
    
    if (this.state.marketFilter !== 'all') {
        filtered = filtered.filter(t => t.marketType === this.state.marketFilter);
    }
    if (this.state.exchangeFilter !== 'all') {
        filtered = filtered.filter(t => t.exchange === this.state.exchangeFilter);
    }
    
    if (this.state.activeTab === 'favorites') {
        filtered = filtered.filter(t => this.state.favorites.includes(t.symbol));
    } 
    else if (this.state.activeTab === 'flags') {
        if (this.state.activeFlagTab) {
            filtered = filtered.filter(t => {
                const key = `${t.symbol}:${t.exchange}:${t.marketType}`;
                return this.state.flags[key] === this.state.activeFlagTab;
            });
        } else {
            filtered = filtered.filter(t => {
                const key = `${t.symbol}:${t.exchange}:${t.marketType}`;
                return this.state.flags[key] !== undefined;
            });
        }
    }
    
    const result = this.sortTickers(filtered);
    
    this.filterCache = {
        key: cacheKey,
        result: result
    };
    
    return result;
}
    renderTickerList() {
        const flagTabs = document.getElementById('flagTabs');
        if (flagTabs) {
            if (this.state.activeTab === 'flags') {
                flagTabs.classList.add('show');
            } else {
                flagTabs.classList.remove('show');
            }
        }

        const container = document.getElementById('tickerListContainer');
        if (!container) return;

        const displayed = this.getFilteredTickers();
        this.displayedTickers = displayed;
        this.totalItems = displayed.length;

        if (displayed.length === 0) {
    container.innerHTML = '';          // ← убираем текст
    return;
}
if (this.totalItems === 0) {
    container.innerHTML = '';
    container.style.height = 'auto';
    return;
}

        container.style.height = (this.totalItems * this.rowHeight) + 'px';
        container.style.position = 'relative';
        container.style.overflowY = 'auto';

        this.renderVisibleTickers();

        if (!this._scrollHandler) {
            this._scrollHandler = () => this.renderVisibleTickers();
            container.addEventListener('scroll', this._scrollHandler);

        }
    }

    renderVisibleTickers() {
        const container = document.getElementById('tickerListContainer');
        if (!container || !this.displayedTickers) return;

        const scrollTop = container.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight));
        const endIndex = Math.min(startIndex + this.visibleCount, this.totalItems);
        if (startIndex >= endIndex) return; 
        const visibleKeys = new Set();
        const fragment = document.createDocumentFragment();

        if (this._firstRender) {
            this._firstRender = false;
        }

        for (let i = startIndex; i < endIndex; i++) {
            const ticker = this.displayedTickers[i];
            if (!ticker) continue;

            const key = `${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`;
            visibleKeys.add(key);

            let el = this.tickerElements.get(key);
            if (!el) {
                el = this.createTickerElement(ticker, i);
                this.tickerElements.set(key, el);
            }
            
            el.style.top = (i * this.rowHeight) + 'px';
            
            if (!el.parentNode) {
                fragment.appendChild(el);
            }
        }

        if (fragment.children.length > 0) {
            container.appendChild(fragment);
        }

        for (const [key, el] of this.tickerElements.entries()) {
            if (!visibleKeys.has(key) && el.parentNode === container) {
                container.removeChild(el);
            }
        }
    }

    createTickerElement(ticker, index) {
        const div = document.createElement('div');
        div.className = `ticker-item ${ticker.symbol === this.state.currentSymbol && 
            ticker.exchange === this.state.currentExchange && 
            ticker.marketType === this.state.currentMarketType ? 'active' : ''}`;
        div.dataset.symbol = ticker.symbol;
        div.dataset.exchange = ticker.exchange;
        div.dataset.marketType = ticker.marketType;

        const flag = this.state.flags[`${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`] || null;
        const flagHTML = flag ? 
            `<div class="flag flag-${flag}" data-symbol="${ticker.symbol}" data-exchange="${ticker.exchange}" data-market-type="${ticker.marketType}"></div>` : 
            '<div class="flag-placeholder"></div>';

        const isFavorite = this.state.favorites.includes(ticker.symbol) ? 'favorite' : '';

        div.innerHTML = `
            <div class="ticker-name">
                ${flagHTML}
                <span class="symbol-text">${ticker.symbol.replace('USDT', '')}</span>
                <span class="star ${isFavorite}" data-symbol="${ticker.symbol}" title="Избранное">★</span>
            </div>
            <div class="ticker-price ${ticker.change > 0 ? 'positive' : (ticker.change < 0 ? 'negative' : '')}">${this.formatPrice(ticker.price)}</div>
            <div class="ticker-change ${ticker.change > 0 ? 'positive' : (ticker.change < 0 ? 'negative' : '')}">${this.formatChange(ticker.change)}%</div>
            <div class="ticker-volume">${this.formatVolume(ticker.volume)}</div>
            <div class="ticker-trades">${this.formatTrades(ticker)}</div>
        `;

        return div;
    }

    formatPrice(price) {
    if (!price || price <= 0) return '...';
    
    const now = Date.now();
    const cached = this.formatCache.prices.get(price);
    
    // Если есть в кэше и не устарел
    if (cached && (now - cached.timestamp) < this.cacheMaxAge) {
        return cached.value;
    }
    
    let result;
    if (price < 0.00000001) {
        result = price.toExponential(4);
    } else if (price < 0.0001) {
        result = price.toFixed(8);
    } else if (price < 0.001) {
        result = price.toFixed(6);
    } else if (price < 0.01) {
        result = price.toFixed(5);
    } else if (price < 0.1) {
        result = price.toFixed(4);
    } else if (price < 1) {
        result = price.toFixed(3);
    } else if (price < 1000) {
        result = price.toFixed(2);
    } else {
        result = price.toFixed(2);
    }
    
    // Сохраняем в кэш с временем
    this.formatCache.prices.set(price, { value: result, timestamp: now });
    
    // Ограничиваем размер кэша (оставляем только последние 500)
    if (this.formatCache.prices.size > 500) {
        const oldestKey = this.formatCache.prices.keys().next().value;
        this.formatCache.prices.delete(oldestKey);
    }
    
    return result;
}

    formatChange(change) {
    if (change === undefined || change === null) return '0.00';
    
    const now = Date.now();
    const cached = this.formatCache.changes.get(change);
    
    if (cached && (now - cached.timestamp) < this.cacheMaxAge) {
        return cached.value;
    }
    
    const result = (change > 0 ? '+' : '') + change.toFixed(2);
    
    this.formatCache.changes.set(change, { value: result, timestamp: now });
    
    if (this.formatCache.changes.size > 500) {
        const oldestKey = this.formatCache.changes.keys().next().value;
        this.formatCache.changes.delete(oldestKey);
    }
    
    return result;
}

  // ✅ Замените функцию formatVolume на:
formatVolume(volume) {
    if (!volume || volume === 0) return '0';
    
    const now = Date.now();
    const cached = this.formatCache.volumes.get(volume);
    
    if (cached && (now - cached.timestamp) < this.cacheMaxAge) {
        return cached.value;
    }
    
    let result;
    if (volume >= 1e9) result = (volume / 1e9).toFixed(2) + 'B';
    else if (volume >= 1e6) result = (volume / 1e6).toFixed(2) + 'M';
    else if (volume >= 1e3) result = (volume / 1e3).toFixed(2) + 'K';
    else if (volume < 1) result = volume.toFixed(4);
    else result = volume.toFixed(2);
    
    this.formatCache.volumes.set(volume, { value: result, timestamp: now });
    
    if (this.formatCache.volumes.size > 500) {
        const oldestKey = this.formatCache.volumes.keys().next().value;
        this.formatCache.volumes.delete(oldestKey);
    }
    
    return result;
}

    formatTrades(ticker) {
        if (ticker.exchange !== 'binance' || !ticker.trades || ticker.trades <= 0) return '—';
        if (ticker.trades > 1e9) return (ticker.trades / 1e9).toFixed(1) + 'B';
        if (ticker.trades > 1e6) return (ticker.trades / 1e6).toFixed(1) + 'M';
        if (ticker.trades > 1e3) return (ticker.trades / 1e3).toFixed(1) + 'K';
        return ticker.trades.toString();
    }

    startCacheCleanup() {
    setInterval(() => {
        const now = Date.now();
        
        for (const [key, value] of this.formatCache.prices) {
            if (now - value.timestamp > this.cacheMaxAge) {
                this.formatCache.prices.delete(key);
            }
        }
        
        for (const [key, value] of this.formatCache.changes) {
            if (now - value.timestamp > this.cacheMaxAge) {
                this.formatCache.changes.delete(key);
            }
        }
        
        for (const [key, value] of this.formatCache.volumes) {
            if (now - value.timestamp > this.cacheMaxAge) {
                this.formatCache.volumes.delete(key);
            }
        }
    }, 30000); // Раз в 30 секунд
}
  setupHeaderSorting() {
    // 1. Удаляем старые обработчики, чтобы не было дублирования (если init вызывается несколько раз)
    if (this._sortClickHandler) {
        document.querySelectorAll('.table-header span[data-sort]').forEach(header => {
            header.removeEventListener('click', this._sortClickHandler);
        });
    }
    
    // 2. Создаём новый обработчик
    this._sortClickHandler = (e) => {
        e.stopPropagation(); // чтобы клик не уходил на контейнер и не мешал другим обработчикам
        
        const header = e.currentTarget;
        const sortBy = header.dataset.sort;
        
        // Меняем направление, если кликнули по тому же полю
        if (this.state.sortBy === sortBy) {
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortBy = sortBy;
            this.state.sortDirection = 'desc'; // по умолчанию сортируем по убыванию
        }
        
        // Обновляем иконки во всех заголовках
        document.querySelectorAll('.table-header span[data-sort] i').forEach(icon => {
            icon.className = 'fas fa-sort';
        });
        
        // Устанавливаем активную иконку на текущем заголовке
        const icon = header.querySelector('i');
        if (icon) {
            icon.className = this.state.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }
        
        // Сбрасываем кэш и перерисовываем список
        this.filterCache = null;
        this.renderTickerList();
    };
    
    // 3. Навешиваем обработчик на все заголовки
    document.querySelectorAll('.table-header span[data-sort]').forEach(header => {
        header.addEventListener('click', this._sortClickHandler);
    });
}

 addSymbol(symbol, isCustom = true, exchange = 'binance', marketType = 'futures', render = true, skipInitialFetch = false) {
    if (!symbol) return false;
    
    symbol = symbol.trim().toUpperCase();
    if (!symbol.endsWith('USDT')) return false;
    
    const key = `${symbol}:${exchange}:${marketType}`;
    if (this.tickersMap.has(key)) return false;
    
    const newTicker = { 
        symbol, 
        price: 0, 
        change: 0, 
        volume: 0, 
        trades: null, 
        custom: isCustom, 
        prevPrice: 0, 
        exchange, 
        marketType, 
        flag: this.state.flags[key] || null 
    };
    
    this.tickers.push(newTicker);
    this.tickersMap.set(key, newTicker);
    
    const symbolKey = `${symbol}:${exchange}:${marketType}`;
    if (isCustom && !this.state.customSymbols.includes(symbolKey)) { 
        this.state.customSymbols.push(symbolKey); 
        this.saveState(); 
    }
    
    this.filterCache = null;
    
    // Логирование добавления символа (для отладки)
    if (this.debugMode) {
        console.log(`➕ Добавлен символ: ${symbol} (${exchange} ${marketType})`);
    }
    
    // ЗАГРУЗКА НАЧАЛЬНЫХ ДАННЫХ (только если не массовая загрузка)
    if (!skipInitialFetch) {
        this.fetchInitialDataForSymbol(symbol, exchange, marketType);
    }
    
    // ✅ ДЛЯ BYBIT: подписываемся на WebSocket (более безопасная версия)
    if (exchange === 'bybit') {
        this.updateBybitSubscription(marketType, symbol);
    }
    
    // Перерисовываем список (если нужно)
    if (render) {
        this.renderTickerList();
    }
    
    return true;
}

// ✅ НОВЫЙ МЕТОД: загрузка начальных данных для одного символа
async fetchInitialDataForSymbol(symbol, exchange, marketType) {
    if (exchange === 'binance' && marketType === 'spot') {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
            const data = await response.json();
            
            const ticker = this.tickersMap.get(`${symbol}:${exchange}:${marketType}`);
            if (ticker && !ticker.price) {
                ticker.price = parseFloat(data.lastPrice);
                ticker.change = parseFloat(data.priceChangePercent);
                ticker.volume = parseFloat(data.quoteVolume);
                ticker.trades = parseInt(data.count);
                this.debouncedUpdatePrices();
                console.log(`✅ Загружены начальные данные для ${symbol} (${exchange} ${marketType})`);
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить ${symbol}:`, error);
        }
    }
    
    if (exchange === 'binance' && marketType === 'futures') {
        try {
            const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`);
            const data = await response.json();
            
            const ticker = this.tickersMap.get(`${symbol}:${exchange}:${marketType}`);
            if (ticker && !ticker.price) {
                ticker.price = parseFloat(data.lastPrice);
                ticker.change = parseFloat(data.priceChangePercent);
                ticker.volume = parseFloat(data.quoteVolume);
                this.debouncedUpdatePrices();
                console.log(`✅ Загружены начальные данные для ${symbol} (${exchange} ${marketType})`);
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить ${symbol}:`, error);
        }
    }
    
    if (exchange === 'bybit') {
        const category = marketType === 'futures' ? 'linear' : 'spot';
        try {
            const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}`);
            const data = await response.json();
            
            if (data.retCode === 0 && data.result?.list?.[0]) {
                const tickerData = data.result.list[0];
                const ticker = this.tickersMap.get(`${symbol}:${exchange}:${marketType}`);
                if (ticker && !ticker.price) {
                    ticker.price = parseFloat(tickerData.lastPrice);
                    ticker.change = parseFloat(tickerData.price24hPcnt) * 100;
                    ticker.volume = parseFloat(tickerData.turnover24h);
                    this.debouncedUpdatePrices();
                    console.log(`✅ Загружены начальные данные для ${symbol} (${exchange} ${marketType})`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить ${symbol}:`, error);
        }
    }
}
    removeSymbol(symbol, exchange, marketType) {
        if (!symbol) return;
        
        const key = `${symbol}:${exchange}:${marketType}`;
        delete this.state.flags[key];
        
        this.tickers = this.tickers.filter(t => 
            !(t.symbol === symbol && t.exchange === exchange && t.marketType === marketType)
        );
        this.tickersMap.delete(key);
        
        const symbolKey = `${symbol}:${exchange}:${marketType}`;
        this.state.customSymbols = this.state.customSymbols.filter(s => s !== symbolKey);
        this.state.favorites = this.state.favorites.filter(s => s !== symbol);
        
        this.saveState();
        
        if (this.state.currentSymbol === symbol && 
            this.state.currentExchange === exchange && 
            this.state.currentMarketType === marketType) { 
            this.state.currentSymbol = ''; 
            this.state.currentExchange = 'binance'; 
        }
        
        this.filterCache = null;
        this.renderTickerList();
        this.setupWebSockets();
    }

    setupDelegatedEvents() {
        const container = document.getElementById('tickerListContainer');
        if (!container) return;
        
        container.removeEventListener('click', this.handleTickerClick);
        container.removeEventListener('contextmenu', this.handleContextMenu);
        container.removeEventListener('dblclick', this.handleDoubleClick);
        
        container.addEventListener('click', this.handleTickerClick);
        container.addEventListener('contextmenu', this.handleContextMenu);
        container.addEventListener('dblclick', this.handleDoubleClick);
        
        document.addEventListener('keydown', this.handleKeyDelete);
        
        console.log('✅ Обработчики событий обновлены');
    }

    handleKeyDelete(e) {
        if (e.key !== 'Delete') return;
        
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || 
                              activeElement.tagName === 'TEXTAREA' || 
                              activeElement.tagName === 'SELECT')) {
            return;
        }
        
        const activeTicker = document.querySelector('.ticker-item.active');
        if (!activeTicker) return;
        
        e.preventDefault();
        
        const symbol = activeTicker.dataset.symbol;
        const exchange = activeTicker.dataset.exchange;
        const marketType = activeTicker.dataset.marketType;
        
        if (symbol && exchange && marketType) {
            const notification = document.getElementById('alertNotification');
            if (notification) {
                notification.innerHTML = `
                    <div class="alert-title">🗑️ Удален</div>
                    <div class="alert-price">${symbol}</div>
                    <div class="alert-repeat">${exchange} ${marketType}</div>
                `;
                notification.style.display = 'block';
                notification.style.borderLeftColor = '#f23645';
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 2000);
            }
            
            this.removeSymbol(symbol, exchange, marketType);
        }
    }

  handleTickerClick = (e) => {
    const star = e.target.closest('.star');
    if (star) {
        e.preventDefault();
        e.stopPropagation();
        const symbol = star.dataset.symbol;
        if (!symbol) return;
        
        const index = this.state.favorites.indexOf(symbol);
        if (index === -1) {
            this.state.favorites.push(symbol);
            star.classList.add('favorite');
        } else {
            this.state.favorites.splice(index, 1);
            star.classList.remove('favorite');
        }
        this.saveState();
        this.filterCache = null;
        return;
    }

    const flag = e.target.closest('.flag');
    if (flag) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    const tickerItem = e.target.closest('.ticker-item');
    if (tickerItem && tickerItem.dataset.symbol) {
        const symbol = tickerItem.dataset.symbol;
        const exchange = tickerItem.dataset.exchange;
        const marketType = tickerItem.dataset.marketType;
        
        if (this.state.currentSymbol === symbol &&
            this.state.currentExchange === exchange &&
            this.state.currentMarketType === marketType) {
            return;
        }
        
        // Отмена предыдущего запроса
        if (this._currentLoadAbortController) {
            this._currentLoadAbortController.abort();
        }
        
        this._currentLoadAbortController = new AbortController();
        const signal = this._currentLoadAbortController.signal;
        
        this.state.currentSymbol = symbol;
        this.state.currentExchange = exchange;
        this.state.currentMarketType = marketType;
        
        this.saveCurrentSymbol(symbol, exchange, marketType);
        
        document.querySelectorAll('.ticker-item.active').forEach(el => {
            el.classList.remove('active');
        });
        tickerItem.classList.add('active');
        
        if (this.coordinator) {
            this.coordinator.loadSymbol(symbol, exchange, marketType, signal).catch(err => {
                if (err.name === 'AbortError') {
                    console.log('⏸️ Загрузка прервана');
                }
            });
        }
        
        const pairDisplay = document.getElementById('pairDisplay');
        if (pairDisplay) pairDisplay.textContent = symbol;
        
        const exchangeDisplay = document.getElementById('exchangeDisplay');
        if (exchangeDisplay) exchangeDisplay.textContent = exchange === 'binance' ? 'Binance' : 'Bybit';
        
        const contractTypeDisplay = document.getElementById('contractTypeDisplay');
        if (contractTypeDisplay) contractTypeDisplay.textContent = marketType === 'futures' ? 'PERP' : 'SPOT';
    }
}

    handleStarClick = (star) => {
        const symbol = star.dataset.symbol;
        if (!symbol) return;
        
        const index = this.state.favorites.indexOf(symbol);
        
        if (index === -1) {
            this.state.favorites.push(symbol);
        } else {
            this.state.favorites.splice(index, 1);
        }
        
        this.filterCache = null;
        this.saveState();
        
        star.classList.toggle('favorite', index === -1);
    }

    handleContextMenu = (e) => {
        const tickerItem = e.target.closest('.ticker-item');
        if (!tickerItem || !tickerItem.dataset.symbol) return;
        
        e.preventDefault();
        
        const contextMenu = document.getElementById('flagContextMenu');
        
        contextMenu.dataset.symbol = tickerItem.dataset.symbol;
        contextMenu.dataset.exchange = tickerItem.dataset.exchange;
        contextMenu.dataset.marketType = tickerItem.dataset.marketType;
        
        const x = Math.min(e.pageX, window.innerWidth - 200);
        const y = Math.min(e.pageY, window.innerHeight - 200);
        
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    handleDoubleClick = (e) => {
        const flag = e.target.closest('.flag');
        if (!flag) return;
        
        e.stopPropagation();
        
        const item = flag.closest('.ticker-item');
        if (!item || !item.dataset.symbol) return;
        
        const symbol = item.dataset.symbol;
        const exchange = item.dataset.exchange;
        const marketType = item.dataset.marketType;
        const key = `${symbol}:${exchange}:${marketType}`;
        
        delete this.state.flags[key];
        
        const ticker = this.tickers.find(t => 
            t.symbol === symbol && t.exchange === exchange && t.marketType === marketType
        );
        
        if (ticker) {
            ticker.flag = null;
            
            const flagContainer = flag.parentNode;
            const placeholder = document.createElement('div');
            placeholder.className = 'flag-placeholder';
            flagContainer.replaceChild(placeholder, flag);
        }
        
        this.filterCache = null;
        this.saveState();
    }

    focusOnSymbol(symbol, exchange, marketType) {
        this.state.currentSymbol = symbol;
        this.state.currentExchange = exchange;
        this.state.currentMarketType = marketType;
        
        this.saveCurrentSymbol(symbol, exchange, marketType);
        
        document.querySelectorAll('.ticker-item.active').forEach(el => {
            el.classList.remove('active');
        });
        
        const tickerElement = document.querySelector(
            `.ticker-item[data-symbol="${symbol}"][data-exchange="${exchange}"][data-market-type="${marketType}"]`
        );
        
        if (tickerElement) {
            tickerElement.classList.add('active');
        }
        
        if (this.coordinator) {
            this.coordinator.loadSymbol(symbol, exchange, marketType);
            
            setTimeout(() => {
                if (this.coordinator.chartManager) {
                    this.coordinator.chartManager.scrollToLastWithOffset(15);
                    this.coordinator.chartManager.autoScale();
                }
            }, 500);
        }
        
        const pairDisplay = document.getElementById('pairDisplay');
        if (pairDisplay) pairDisplay.textContent = symbol;
        
        const exchangeDisplay = document.getElementById('exchangeDisplay');
        if (exchangeDisplay) exchangeDisplay.textContent = exchange === 'binance' ? 'Binance' : 'Bybit';
        
        const contractTypeDisplay = document.getElementById('contractTypeDisplay');
        if (contractTypeDisplay) contractTypeDisplay.textContent = marketType === 'futures' ? 'PERP' : 'SPOT';
        
        document.getElementById('addInstrumentModal').classList.remove('show');
        
        console.log(`🎯 Сфокусировался на ${symbol} (${exchange} ${marketType})`);
    }

    setupFlagContextMenu() {
        const contextMenu = document.getElementById('flagContextMenu');
        
        contextMenu.querySelectorAll('.context-menu-item').forEach(menuItem => {
            menuItem.removeEventListener('click', this.handleFlagSelect);
            menuItem.addEventListener('click', this.handleFlagSelect);
        });
        
        document.removeEventListener('click', this.closeContextMenu);
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });
    }

    handleFlagSelect = (e) => {
        e.stopPropagation();
        
        const contextMenu = document.getElementById('flagContextMenu');
        const symbol = contextMenu.dataset.symbol;
        const exchange = contextMenu.dataset.exchange;
        const marketType = contextMenu.dataset.marketType;
        const flag = e.currentTarget.dataset.flag;
        
        if (!symbol || !exchange || !marketType) return;
        
        const key = `${symbol}:${exchange}:${marketType}`;
        
        this.state.flags[key] = flag;
        
        const ticker = this.tickers.find(t => 
            t.symbol === symbol && t.exchange === exchange && t.marketType === marketType
        );
        
        if (ticker) {
            ticker.flag = flag;
            
            const tickerElement = document.querySelector(
                `.ticker-item[data-symbol="${symbol}"][data-exchange="${exchange}"][data-market-type="${marketType}"]`
            );
            
            if (tickerElement) {
                const flagContainer = tickerElement.querySelector('.flag, .flag-placeholder');
                if (flagContainer) {
                    const newFlag = document.createElement('div');
                    newFlag.className = `flag flag-${flag}`;
                    newFlag.dataset.symbol = symbol;
                    newFlag.dataset.exchange = exchange;
                    newFlag.dataset.marketType = marketType;
                    flagContainer.parentNode.replaceChild(newFlag, flagContainer);
                }
            }
        }
        
        this.filterCache = null;
        this.saveState();
        contextMenu.style.display = 'none';
    }

    closeContextMenu = () => {
        document.getElementById('flagContextMenu').style.display = 'none';
    }

    setupUIEventListeners() {
        document.querySelectorAll('.tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.state.activeTab = tab.dataset.tab;
                
                const flagTabs = document.getElementById('flagTabs');
                if (flagTabs) {
                    if (this.state.activeTab === 'flags') {
                        flagTabs.style.display = 'flex';
                        this.state.activeFlagTab = null;
                        document.querySelectorAll('.tab[data-flag]').forEach(t => t.classList.remove('active'));
                    } else {
                        flagTabs.style.display = 'none';
                        this.state.activeFlagTab = null;
                    }
                }
                
                this.filterCache = null;
                this.renderTickerList();
            });
        });
        
        document.querySelectorAll('.tab[data-flag]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (this.state.activeTab !== 'flags') {
                    document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
                    document.querySelector('.tab[data-tab="flags"]').classList.add('active');
                    this.state.activeTab = 'flags';
                    
                    const flagTabs = document.getElementById('flagTabs');
                    if (flagTabs) {
                        flagTabs.style.display = 'flex';
                    }
                }
                
                document.querySelectorAll('.tab[data-flag]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.state.activeFlagTab = tab.dataset.flag;
                
                this.filterCache = null;
                this.renderTickerList();
            });
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

handleVisibilityChange() {
    if (document.hidden) {
        // Вкладка невидима — закрываем WebSocket
        console.log('📴 Вкладка неактивна, WebSocket отключаются');
        this.closeAllWebSockets();
    } else {
        // Вкладка снова видима — переподключаем WebSocket
        console.log('👁️ Вкладка активна, WebSocket подключаются');
        this.setupWebSockets();
    }
}

     cleanup() {
        console.log('🧹 Очистка WebSocket соединений...');
        
        // 1. Закрываем все WebSocket соединения
        let closedCount = 0;
        for (const ws of this.wsConnections) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.close(1000, "Cleanup");
                    closedCount++;
                } catch(e) {
                    console.warn('Ошибка закрытия WebSocket:', e);
                }
            }
        }
        this.wsConnections = [];
        console.log(`   Закрыто ${closedCount} WebSocket соединений`);
        
        // 2. Очищаем таймеры переподключения
        if (this.fallbackInterval) {
            clearInterval(this.fallbackInterval);
            this.fallbackInterval = null;
        }
        
        let timerCount = this.wsReconnectTimers.length;
        for (const timer of this.wsReconnectTimers) {
            clearTimeout(timer);
        }
        this.wsReconnectTimers = [];
        console.log(`   Очищено ${timerCount} таймеров`);
        
        // 3. Отменяем animation frame (если есть)
        if (this._renderRafId) {
            cancelAnimationFrame(this._renderRafId);
            this._renderRafId = null;
        }
        
        // 4. Сбрасываем флаги подключения
        this.state.wsConnected = {
            binanceFutures: false,
            binanceSpot: false,
            bybitFutures: false,
            bybitSpot: false
        };
        
        this.state.wsReconnectAttempts = { 
            binanceFutures: 0, 
            binanceSpot: 0, 
            bybitFutures: 0, 
            bybitSpot: 0 
        };
        
        this.state.binanceHasConnection = { futures: false, spot: false };
        this.state.bybitHasConnection = { futures: false, spot: false };
        this.state.isSettingUpWebSockets = false;
        
        // 5. Очищаем очередь обновлений цен (если есть)
        if (this.pendingUpdates) {
            this.pendingUpdates.clear();
        }
         document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        console.log('✅ Очистка завершена');
    }
}

if (typeof window !== 'undefined') {
    window.TickerPanel = TickerPanel;
    console.log('✅ TickerPanel зарегистрирован в window');
}