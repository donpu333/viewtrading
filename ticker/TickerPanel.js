class TickerPanel {
    constructor(coordinator) {
        this.coordinator = coordinator;
        
        // Инициализация модулей
        this.storage = new TickerStorage();
        this.ws = new TickerWebSocket(this);
        this.renderer = new TickerRenderer(this);
        this.modal = new TickerModal(this);
        this.events = new TickerEvents(this);
        
        // Пробрасываем ссылки
        this.state = this.storage.state;
        this.tickers = this.storage.tickers;
        this.tickersMap = this.storage.tickersMap;
        this.allSymbolsCache = this.storage.allSymbolsCache;
        this.binanceSymbolsCache = this.storage.binanceSymbolsCache;
        this.bybitSymbolsCache = this.storage.bybitSymbolsCache;
        this.allBinanceFutures = this.storage.allBinanceFutures;
        this.allBinanceSpot = this.storage.allBinanceSpot;
        this.allBybitFutures = this.storage.allBybitFutures;
        this.allBybitSpot = this.storage.allBybitSpot;
        this.formatCache = this.storage.formatCache;
        this.cacheMaxAge = this.storage.cacheMaxAge;
        this.settings = this.storage.settings;
        this.debugMode = this.storage.debugMode;
        this.filterCache = this.storage.filterCache;
        this.saveTimeout = this.storage.saveTimeout;
        this._isRefreshing = this.storage._isRefreshing;
        this._eventsInitialized = this.storage._eventsInitialized;
        
        this.rowHeight = 36;
        this.visibleCount = 30;
        this.tickerElements = this.renderer.tickerElements;
        this.displayedTickers = this.renderer.displayedTickers;
        this.totalItems = this.renderer.totalItems;
        this._scrollHandler = this.renderer._scrollHandler;
        this._renderScheduled = this.renderer._renderScheduled;
        this._renderRafId = this.renderer._renderRafId;
        this._firstRender = this.renderer._firstRender;
        
        this.wsConnections = this.ws.wsConnections;
        this.wsReconnectTimers = this.ws.wsReconnectTimers;
        this._pendingBybitSubscriptions = this.ws._pendingBybitSubscriptions;
        this.pendingUpdates = this.ws.pendingUpdates;
        this.updatePending = this.ws.updatePending;
        this.wsUpdateBuffer = this.ws.wsUpdateBuffer;
        this.wsUpdateTimer = this.ws.wsUpdateTimer;
        this.wsDebounceMs = this.ws.wsDebounceMs;
        this._binanceFuturesConnecting = this.ws._binanceFuturesConnecting;
        this._binanceSpotConnecting = this.ws._binanceSpotConnecting;
        this._bybitFuturesConnecting = this.ws._bybitFuturesConnecting;
        this._bybitSpotConnecting = this.ws._bybitSpotConnecting;
        this._hasSignificantChange = this.ws._hasSignificantChange;
        this.fallbackInterval = this.ws.fallbackInterval;
        
        // Пробрасываем методы storage
        this.loadUserData = this.storage.loadUserData.bind(this.storage);
        this.saveCurrentSymbol = this.storage.saveCurrentSymbol.bind(this.storage);
        this.loadFromLocalStorage = this.storage.loadFromLocalStorage.bind(this.storage);
        this.loadFromIndexedDB = this.storage.loadFromIndexedDB.bind(this.storage);
        this.saveSymbolsToIndexedDB = this.storage.saveSymbolsToIndexedDB.bind(this.storage);
        this.sortByPopularity = this.storage.sortByPopularity.bind(this.storage);
        this.getFilteredCount = this.storage.getFilteredCount.bind(this.storage);
        this.updateModalCount = this.storage.updateModalCount.bind(this.storage);
        this.removeDuplicates = this.storage.removeDuplicates.bind(this.storage);
        this.saveState = this.storage.saveState.bind(this.storage);
        
        // Пробрасываем методы ws
        this.setupWebSockets = this.ws.setupWebSockets.bind(this.ws);
        this.startFallbackPriceUpdates = this.ws.startFallbackPriceUpdates.bind(this.ws);
        this.connectBinanceWebSocket = this.ws.connectBinanceWebSocket.bind(this.ws);
        this._processBinanceTicker = this.ws._processBinanceTicker.bind(this.ws);
        this.applyBinanceUpdates = this.ws.applyBinanceUpdates.bind(this.ws);
        this.flushWsUpdates = this.ws.flushWsUpdates.bind(this.ws);
        this.processPendingUpdates = this.ws.processPendingUpdates.bind(this.ws);
        this.connectBybitWebSocket = this.ws.connectBybitWebSocket.bind(this.ws);
        this.updateBybitSubscription = this.ws.updateBybitSubscription.bind(this.ws);
        this.processPendingBybitSubscriptions = this.ws.processPendingBybitSubscriptions.bind(this.ws);
        this.subscribeAllBybitSymbols = this.ws.subscribeAllBybitSymbols.bind(this.ws);
        this.applyBybitUpdates = this.ws.applyBybitUpdates.bind(this.ws);
        this.fetchBinanceFuturesPrices = this.ws.fetchBinanceFuturesPrices.bind(this.ws);
        this.fetchBinanceSpotPrices = this.ws.fetchBinanceSpotPrices.bind(this.ws);
        this.fetchBybitFuturesPrices = this.ws.fetchBybitFuturesPrices.bind(this.ws);
        this.fetchBybitSpotPrices = this.ws.fetchBybitSpotPrices.bind(this.ws);
        this.closeAllWebSockets = this.ws.closeAllWebSockets.bind(this.ws);
        this.cleanup = this.ws.cleanup.bind(this.ws);
        
        // Пробрасываем методы renderer
        this.updatePriceElements = this.renderer.updatePriceElements.bind(this.renderer);
        this.sortTickers = this.renderer.sortTickers.bind(this.renderer);
        this.getFilteredTickers = this.renderer.getFilteredTickers.bind(this.renderer);
        this.renderTickerList = this.renderer.renderTickerList.bind(this.renderer);
        this.renderVisibleTickers = this.renderer.renderVisibleTickers.bind(this.renderer);
        this.createTickerElement = this.renderer.createTickerElement.bind(this.renderer);
        this.formatPrice = this.renderer.formatPrice.bind(this.renderer);
        this.formatChange = this.renderer.formatChange.bind(this.renderer);
        this.formatVolume = this.renderer.formatVolume.bind(this.renderer);
        this.formatTrades = this.renderer.formatTrades.bind(this.renderer);
        this.startCacheCleanup = this.renderer.startCacheCleanup.bind(this.renderer);
        this.setupHeaderSorting = this.renderer.setupHeaderSorting.bind(this.renderer);
        
        // Пробрасываем методы modal
        this.setupModal = this.modal.setupModal.bind(this.modal);
        this.addNextBatch = this.modal.addNextBatch.bind(this.modal);
        this.updateModalButtons = this.modal.updateModalButtons.bind(this.modal);
        this.updateModalResults = this.modal.updateModalResults.bind(this.modal);
        this.renderModalResults = this.modal.renderModalResults.bind(this.modal);
        
        // Пробрасываем методы events
        this.setupDelegatedEvents = this.events.setupDelegatedEvents.bind(this.events);
        this.setupFilters = this.events.setupFilters.bind(this.events);
        this.setupClearAllButton = this.events.setupClearAllButton.bind(this.events);
        this.setupFlagContextMenu = this.events.setupFlagContextMenu.bind(this.events);
        this.setupUIEventListeners = this.events.setupUIEventListeners.bind(this.events);
        
        // Прямые методы (без отдельного класса)
        this.initializeDataParallel = this.initializeDataParallel.bind(this);
        this.refreshSymbolCache = this.refreshSymbolCache.bind(this);
        this.processParallelData = this.processParallelData.bind(this);
        this.addInitialSymbols = this.addInitialSymbols.bind(this);
        this.fetchBinanceSpotSnapshot = this.fetchBinanceSpotSnapshot.bind(this);
        this.fetchBinanceFuturesSnapshot = this.fetchBinanceFuturesSnapshot.bind(this);
        this.fetchBybitSnapshots = this.fetchBybitSnapshots.bind(this);
        
        // Привязка методов
        this.handleFlagSelect = this.handleFlagSelect.bind(this);
        this.handleTickerClick = this.handleTickerClick.bind(this);
        this.handleStarClick = this.handleStarClick.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleKeyDelete = this.handleKeyDelete.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        this.debouncedUpdatePrices = () => {
            if (this._renderScheduled) return;
            this._renderScheduled = true;
            this._renderRafId = requestAnimationFrame(() => {
                this.updatePriceElements();
                this._renderScheduled = false;
                this._renderRafId = null;
            });
        };
        
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
        
        this.loadFromLocalStorage();
        this.init();
        
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
  async init() {
    console.log('📋 TickerPanel: быстрая инициализация');

    // ЛЁГКИЕ ОПЕРАЦИИ – выполняются мгновенно
    this.setupFilters();            // создание кнопок фильтров
    this.setupFlagContextMenu();    // контекстное меню
    this.setupUIEventListeners();   // клики, удаление
    this.setupClearAllButton();     // кнопка очистки
    this.setupHeaderSorting();      // сортировка по клику на заголовки
    this.setupModal();              // модальное окно (пустое)

    // ТЯЖЁЛЫЕ ОПЕРАЦИИ – откладываем, чтобы график успел отрисоваться
    setTimeout(async () => {
        await this.loadUserData();          // IndexedDB
        this.initializeDataParallel();      // загрузка списков, снапшотов
        this.startFallbackPriceUpdates();   // фоновое обновление цен
        this.startCacheCleanup();           // очистка кэша
        // Если модальное окно зависит от загруженных данных – обновить
        this.updateModalWithData?.();
        console.log('✅ TickerPanel полностью загружен (фон)');
    }, 100); // задержка 100 мс даёт графику фору
}
    
    // ========== МЕТОДЫ ЗАГРУЗКИ ДАННЫХ (были в TickerDataLoader) ==========
    
    async initializeDataParallel() {
        const container = document.getElementById('tickerListContainer');
        
        const loaded = await this.loadFromIndexedDB();
        
       if (loaded) {
    this.addInitialSymbols();
    this.renderTickerList();
    this.updateModalCount();
    // Запускаем фоновое обновление с задержкой, чтобы не мешать интерфейсу
    setTimeout(() => {
        this.refreshSymbolCache(10000).catch(err => 
            console.warn('⚠️ Ошибка фонового обновления:', err)
        );
    }, 1000);
    return;  // ← ВАЖНО: выходим, не делаем сетевые запросы
}
        
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
                container.innerHTML = '';
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
    
    processParallelData(results, updateOnly = false) {
        const MAX_SYMBOLS = 4000;
        
        let binanceFuturesList = [];
        let binanceSpotList = [];
        let bybitFuturesList = [];
        let bybitSpotList = [];
        
        if (results[0] && results[0].symbols) {
            binanceFuturesList = results[0].symbols
                .filter(s => s.symbol && s.symbol.endsWith('USDT') && s.status === 'TRADING')
                .map(s => ({ symbol: s.symbol, exchange: 'binance', marketType: 'futures' }));
            console.log('Binance Futures загружено:', binanceFuturesList.length);
            binanceFuturesList = this.sortByPopularity(binanceFuturesList);
        }
        
        if (results[1] && results[1].symbols) {
            binanceSpotList = results[1].symbols
                .filter(s => s.symbol && s.symbol.endsWith('USDT') && s.status === 'TRADING')
                .map(s => ({ symbol: s.symbol, exchange: 'binance', marketType: 'spot' }));
            console.log('Binance Spot загружено:', binanceSpotList.length);
            binanceSpotList = this.sortByPopularity(binanceSpotList);
        }
        
        if (results[2] && results[2].retCode === 0 && results[2].result?.list) {
            bybitFuturesList = results[2].result.list
                .filter(s => s.symbol && s.symbol.endsWith('USDT') && (s.status === 'Trading' || s.status === 'Listed' || s.status === 'Active'))
                .map(s => ({ symbol: s.symbol, exchange: 'bybit', marketType: 'futures' }));
            console.log('Bybit Futures загружено:', bybitFuturesList.length);
            bybitFuturesList = this.sortByPopularity(bybitFuturesList);
        }
        
        if (results[3] && results[3].retCode === 0 && results[3].result?.list) {
            bybitSpotList = results[3].result.list
                .filter(s => s.symbol && s.symbol.endsWith('USDT') && (s.status === 'Trading' || s.status === 'Listed' || s.status === 'Active'))
                .map(s => ({ symbol: s.symbol, exchange: 'bybit', marketType: 'spot' }));
            console.log('Bybit Spot загружено:', bybitSpotList.length);
            bybitSpotList = this.sortByPopularity(bybitSpotList);
        }
        
        if (!updateOnly) {
            this.binanceSymbolsCache = [...binanceFuturesList, ...binanceSpotList];
            this.bybitSymbolsCache = [...bybitFuturesList, ...bybitSpotList];
        } else {
            const newBinance = [...binanceFuturesList, ...binanceSpotList];
            const newBybit = [...bybitFuturesList, ...bybitSpotList];
            this.binanceSymbolsCache = [...this.binanceSymbolsCache, ...newBinance];
            this.bybitSymbolsCache = [...this.bybitSymbolsCache, ...newBybit];
            this.binanceSymbolsCache = this.sortByPopularity(this.binanceSymbolsCache);
            this.bybitSymbolsCache = this.sortByPopularity(this.bybitSymbolsCache);
        }
        
        this.binanceSymbolsCache = [...new Map(this.binanceSymbolsCache.map(item => [`${item.symbol}:${item.marketType}`, item])).values()];
        this.bybitSymbolsCache = [...new Map(this.bybitSymbolsCache.map(item => [`${item.symbol}:${item.marketType}`, item])).values()];
        
        this.allBinanceFutures = this.binanceSymbolsCache.filter(s => s.marketType === 'futures');
        this.allBinanceSpot = this.binanceSymbolsCache.filter(s => s.marketType === 'spot');
        this.allBybitFutures = this.bybitSymbolsCache.filter(s => s.marketType === 'futures');
        this.allBybitSpot = this.bybitSymbolsCache.filter(s => s.marketType === 'spot');
        
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
    
  addInitialSymbols() {
    const savedSymbols = this.state.customSymbols;
    
    const container = document.getElementById('tickerListContainer');
    if (container) {
        container.innerHTML = '';
    }
    
    // === ИСПРАВЛЕНО: skipInitialFetch = false ===
    savedSymbols.forEach(symbolKey => {
        const parts = symbolKey.split(':');
        if (parts.length === 3) {
            const [symbol, exchange, marketType] = parts;
            this.addSymbol(symbol, true, exchange, marketType, false, false);
            //                                                         ^^^^^
            //                                                         НЕ пропускаем загрузку
        }
    });
    
    this.renderTickerList();
    this.updateModalCount();
    
    // ЗАПУСКАЕМ WebSocket НЕМЕДЛЕННО, не ждём REST
    this.setupWebSockets();
    
    // Снапшоты — только как подстраховка, в фоне
    Promise.allSettled([
        this.fetchBinanceSpotSnapshot(),
        this.fetchBinanceFuturesSnapshot(),
        this.fetchBybitSnapshots()
    ]).then(() => {
        console.log('✅ Фоновые снапшоты загружены');
        this.debouncedUpdatePrices();
    });
    
    // === ДОБАВЛЕНО: принудительная подписка Bybit через 2 секунды ===
    setTimeout(() => {
        if (this.ws && this.ws.forceSubscribeAll) {
            this.ws.forceSubscribeAll();
        }
    }, 2000);
    
    this.setupDelegatedEvents();
}
    
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
    
    async fetchBybitSnapshots() {
        try {
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
    
    // ========== ОСТАЛЬНЫЕ МЕТОДЫ ==========
    
    clearAllSymbols() {
        this.tickers = [];
        this.tickersMap.clear();
        this.state.customSymbols = [];
        this.state.favorites = [];
        this.state.flags = {};
        this.tickerElements.clear();
        this.displayedTickers = [];
        this.totalItems = 0;
        
        this.filterCache = null;
        this.formatCache = { prices: new Map(), volumes: new Map(), changes: new Map() };
        
        const container = document.getElementById('tickerListContainer');
        if (container) {
            container.innerHTML = '';
            container.style.height = 'auto';
            container.scrollTop = 0;
        }
        
        this.saveState();
        this.setupWebSockets();
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
        
        if (this.debugMode) {
            console.log(`➕ Добавлен символ: ${symbol} (${exchange} ${marketType})`);
        }
        
        if (!skipInitialFetch) {
            this.fetchInitialDataForSymbol(symbol, exchange, marketType);
        }
        
        if (exchange === 'bybit') {
            this.updateBybitSubscription(marketType, symbol);
        }
        
        if (render) {
            this.renderTickerList();
        }
        
        return true;
    }
    // НОВЫЙ МЕТОД — ДОБАВИТЬ В TickerPanel.js
async addSymbolsBatch(symbolsData) {
    const addedSymbols = [];
    
    symbolsData.forEach(({ symbol, exchange, marketType }) => {
        if (!symbol) return;
        
        symbol = symbol.trim().toUpperCase();
        if (!symbol.endsWith('USDT')) return;
        
        const key = `${symbol}:${exchange}:${marketType}`;
        if (this.tickersMap.has(key)) return;
        
        const newTicker = { 
            symbol, 
            price: 0, 
            change: 0, 
            volume: 0, 
            trades: null, 
            custom: true, 
            prevPrice: 0, 
            exchange, 
            marketType, 
            flag: this.state.flags[key] || null 
        };
        
        this.tickers.push(newTicker);
        this.tickersMap.set(key, newTicker);
        
        const symbolKey = `${symbol}:${exchange}:${marketType}`;
        if (!this.state.customSymbols.includes(symbolKey)) { 
            this.state.customSymbols.push(symbolKey); 
        }
        
        addedSymbols.push({ symbol, exchange, marketType });
    });
    
    if (addedSymbols.length === 0) return;
    
    this.saveState();
    
    // Первый рендер (с прочерками)
    this.filterCache = null;
    this.renderTickerList();
    
    // Загружаем цены
    await this.fetchBatchSnapshots(addedSymbols);
    
    // === ВАЖНО: ВТОРОЙ РЕНДЕР ПОСЛЕ ПОЛУЧЕНИЯ ЦЕН! ===
    this.filterCache = null;
    this.renderTickerList();
    this.debouncedUpdatePrices(); // ← ДОБАВИТЬ!
    
    // Обновляем WebSocket подписки
    this.setupWebSockets();
    
    console.log(`✅ Добавлено ${addedSymbols.length} символов`);
}
// НОВЫЙ МЕТОД — массовая загрузка снапшотов
async fetchBatchSnapshots(symbols) {
    const binanceSpot = symbols.filter(s => s.exchange === 'binance' && s.marketType === 'spot');
    const binanceFutures = symbols.filter(s => s.exchange === 'binance' && s.marketType === 'futures');
    const bybitSpot = symbols.filter(s => s.exchange === 'bybit' && s.marketType === 'spot');
    const bybitFutures = symbols.filter(s => s.exchange === 'bybit' && s.marketType === 'futures');
    
    const promises = [];
    
    // Binance Spot — одним запросом все
    if (binanceSpot.length > 0) {
        promises.push(
            fetch('https://api.binance.com/api/v3/ticker/24hr')
                .then(r => r.json())
                .then(data => {
                    const symbolSet = new Set(binanceSpot.map(s => s.symbol));
                    data.forEach(ticker => {
                        if (symbolSet.has(ticker.symbol)) {
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
                })
                .catch(e => console.warn('Binance Spot batch error:', e))
        );
    }
    
    // Binance Futures — одним запросом все
    if (binanceFutures.length > 0) {
        promises.push(
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
                .then(r => r.json())
                .then(data => {
                    const symbolSet = new Set(binanceFutures.map(s => s.symbol));
                    data.forEach(ticker => {
                        if (symbolSet.has(ticker.symbol)) {
                            const key = `${ticker.symbol}:binance:futures`;
                            const tickerObj = this.tickersMap.get(key);
                            if (tickerObj) {
                                tickerObj.price = parseFloat(ticker.lastPrice);
                                tickerObj.change = parseFloat(ticker.priceChangePercent);
                                tickerObj.volume = parseFloat(ticker.quoteVolume);
                            }
                        }
                    });
                })
                .catch(e => console.warn('Binance Futures batch error:', e))
        );
    }
    
    // Bybit — аналогично
    if (bybitFutures.length > 0 || bybitSpot.length > 0) {
        promises.push(this.fetchBybitSnapshots());
    }
    
    await Promise.allSettled(promises);
    this.debouncedUpdatePrices();
}
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
    
    handleTickerClick(e) {
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
    
    handleStarClick(star) {
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
    
    handleContextMenu(e) {
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
    
    handleDoubleClick(e) {
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
    
    handleFlagSelect(e) {
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
    
    closeContextMenu() {
        document.getElementById('flagContextMenu').style.display = 'none';
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            console.log('📴 Вкладка неактивна, WebSocket отключаются');
            this.closeAllWebSockets();
        } else {
            console.log('👁️ Вкладка активна, WebSocket подключаются');
            this.setupWebSockets();
        }
    }
}

if (typeof window !== 'undefined') {
    window.TickerPanel = TickerPanel;
    console.log('✅ TickerPanel зарегистрирован в window');
}