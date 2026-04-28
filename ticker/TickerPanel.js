class TickerPanel {
    constructor(coordinator) {
        this.coordinator = coordinator;
        // Инициализация менеджера вотчлистов
this.watchlistManager = new WatchlistManager(this);
        // Инициализация модулей
        this.storage = new TickerStorage();
        this.renderer = new TickerRenderer(this);
        this.modal = new TickerModal(this);
        this.events = new TickerEvents(this);
        this.priceManager = window.priceManagerInstance;
        if (!this.priceManager) {
            console.error('❌ PriceManager не найден! Тикерная панель не будет получать цены.');
        }
        
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
        
        // Прямые методы
        this.initializeDataParallel = this.initializeDataParallel.bind(this);
        this.refreshSymbolCache = this.refreshSymbolCache.bind(this);
        this.processParallelData = this.processParallelData.bind(this);
        this.addInitialSymbols = this.addInitialSymbols.bind(this);
        this.fetchBybitSnapshots = this.fetchBybitSnapshots.bind(this);
        
        // Привязка методов
        this.handleFlagSelect = this.handleFlagSelect.bind(this);
        this.handleTickerClick = this.handleTickerClick.bind(this);
        this.handleStarClick = this.handleStarClick.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleKeyDelete = this.handleKeyDelete.bind(this);
        
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
    }
    
 async init() {
    console.log('📋 TickerPanel: быстрая инициализация');
    document.getElementById('tickerLoader').style.display = 'block';
    
    this.setupFilters();
    this.setupFlagContextMenu();
    this.setupUIEventListeners();
    this.setupClearAllButton();
    this.setupHeaderSorting();
    this.setupModal();

    document.addEventListener('contextmenu', (e) => {
        const tickerItem = e.target.closest('.ticker-item');
        if (tickerItem) {
            this.handleContextMenu(e);
        }
    });

    // Закрытие контекстного меню при клике мимо
    document.addEventListener('click', (e) => {
        const tickerMenu = document.getElementById('tickerContextMenu');
        if (tickerMenu && tickerMenu.style.display === 'block' && !tickerMenu.contains(e.target)) {
            tickerMenu.style.display = 'none';
        }
    });

    if (this.watchlistManager) {
        this.watchlistManager.createDropdownContainer();
    }

    setTimeout(async () => {
        await this.loadUserData();
        if (this.watchlistManager) {
            this.watchlistManager.syncActiveListFromPanel();
        }
        this.initializeDataParallel();
        this.startCacheCleanup();
        this.updateModalWithData?.();

        if (this.watchlistManager) {
            await this.watchlistManager.initializeWithPriority();
        }
    }, 100);
}
   async initializeDataParallel() {
        const container = document.getElementById('tickerListContainer');
        
        const loaded = await this.loadFromIndexedDB();
        
        if (loaded) {
            this.addInitialSymbols();
            this.renderTickerList();
            this.updateModalCount();
            setTimeout(() => {
                this.refreshSymbolCache(10000).catch(err => 
                    console.warn('⚠️ Ошибка фонового обновления:', err)
                );
            }, 1000);
            return;
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
    
    _onPriceUpdate(symbol, price) {
        for (let [key, ticker] of this.tickersMap) {
            if (ticker.symbol === symbol && ticker.price !== price) {
                ticker.price = price;
                ticker.prevPrice = price;
            }
        }
        this.renderer.updatePriceElements();
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
    }
    
    if (results[1] && results[1].symbols) {
        binanceSpotList = results[1].symbols
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && s.status === 'TRADING')
            .map(s => ({ symbol: s.symbol, exchange: 'binance', marketType: 'spot' }));
    }
    
    if (results[2] && results[2].retCode === 0 && results[2].result?.list) {
        bybitFuturesList = results[2].result.list
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && (s.status === 'Trading' || s.status === 'Listed' || s.status === 'Active'))
            .map(s => ({ symbol: s.symbol, exchange: 'bybit', marketType: 'futures' }));
    }
    
    if (results[3] && results[3].retCode === 0 && results[3].result?.list) {
        bybitSpotList = results[3].result.list
            .filter(s => s.symbol && s.symbol.endsWith('USDT') && (s.status === 'Trading' || s.status === 'Listed' || s.status === 'Active'))
            .map(s => ({ symbol: s.symbol, exchange: 'bybit', marketType: 'spot' }));
    }
    
    if (!updateOnly) {
        this.binanceSymbolsCache = [...binanceFuturesList, ...binanceSpotList];
        this.bybitSymbolsCache = [...bybitFuturesList, ...bybitSpotList];
    } else {
        const newBinance = [...binanceFuturesList, ...binanceSpotList];
        const newBybit = [...bybitFuturesList, ...bybitSpotList];
        this.binanceSymbolsCache = [...this.binanceSymbolsCache, ...newBinance];
        this.bybitSymbolsCache = [...this.bybitSymbolsCache, ...newBybit];
    }
    
    // ✅ Дедупликация БЕЗ потери порядка
    this.binanceSymbolsCache = this.removeDuplicates(this.binanceSymbolsCache, 'symbol');
    this.bybitSymbolsCache = this.removeDuplicates(this.bybitSymbolsCache, 'symbol');
    
    // ✅ СОРТИРУЕМ ПОСЛЕ дедупликации
    this.binanceSymbolsCache = this.sortByPopularity(this.binanceSymbolsCache);
    this.bybitSymbolsCache = this.sortByPopularity(this.bybitSymbolsCache);
    
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
    
    savedSymbols.forEach(symbolKey => {
        const parts = symbolKey.split(':');
        if (parts.length === 3) {
            const [symbol, exchange, marketType] = parts;
            this.addSymbol(symbol, true, exchange, marketType, false, false, true);
        }
    });
    
    this.updateModalCount();
    
    Promise.all([
        fetch('https://fapi.binance.com/fapi/v1/ticker/24hr').then(r => r.json()).catch(() => []),
        fetch('https://api.binance.com/api/v3/ticker/24hr').then(r => r.json()).catch(() => []),
        fetch('https://api.bybit.com/v5/market/tickers?category=linear').then(r => r.json()).catch(() => null),
        fetch('https://api.bybit.com/v5/market/tickers?category=spot').then(r => r.json()).catch(() => null)
    ]).then(([binanceFutures, binanceSpot, bybitFutures, bybitSpot]) => {
        if (Array.isArray(binanceFutures)) {
            binanceFutures.forEach(t => {
                this.tickersMap.forEach(ticker => {
                    if (ticker.symbol === t.symbol && ticker.exchange === 'binance' && ticker.marketType === 'futures') {
                        ticker.price = parseFloat(t.lastPrice);
                        ticker.change = parseFloat(t.priceChangePercent);
                        ticker.volume = parseFloat(t.quoteVolume);
                        ticker.trades = parseInt(t.count);
                    }
                });
            });
        }

        if (Array.isArray(binanceSpot)) {
            binanceSpot.forEach(t => {
                this.tickersMap.forEach(ticker => {
                    if (ticker.symbol === t.symbol && ticker.exchange === 'binance' && ticker.marketType === 'spot') {
                        ticker.price = parseFloat(t.lastPrice);
                        ticker.change = parseFloat(t.priceChangePercent);
                        ticker.volume = parseFloat(t.quoteVolume);
                        ticker.trades = parseInt(t.count);
                    }
                });
            });
        }

        if (bybitFutures?.retCode === 0 && bybitFutures.result?.list) {
            bybitFutures.result.list.forEach(t => {
                this.tickersMap.forEach(ticker => {
                    if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'futures') {
                        ticker.price = parseFloat(t.lastPrice);
                        ticker.change = parseFloat(t.price24hPcnt) * 100;
                        ticker.volume = parseFloat(t.volume24h) * parseFloat(t.lastPrice);
                        ticker.trades = 0;
                    }
                });
            });
        }

        if (bybitSpot?.retCode === 0 && bybitSpot.result?.list) {
            bybitSpot.result.list.forEach(t => {
                this.tickersMap.forEach(ticker => {
                    if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'spot') {
                        ticker.price = parseFloat(t.lastPrice);
                        ticker.change = parseFloat(t.price24hPcnt) * 100;
                        ticker.volume = parseFloat(t.volume24h) * parseFloat(t.lastPrice);
                        ticker.trades = 0;
                    }
                });
            });
        }

        this.renderTickerList();
        
        // 👇 ОДИН РАЗ ДОБАВЛЯЕМ ready
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const container = document.getElementById('tickerListContainer');
                if (container) container.classList.add('ready');
            });
        });
        
        console.log('✅ Данные загружены (1 рендер)');
    }).catch(e => console.error('❌ Ошибка загрузки:', e));
    
    // Обновление цен каждую секунду
    if (this._priceInterval) clearInterval(this._priceInterval);
    this._priceInterval = setInterval(() => {
        fetch('https://fapi.binance.com/fapi/v1/ticker/price')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    data.forEach(t => {
                        this.tickersMap.forEach(ticker => {
                            if (ticker.symbol === t.symbol && ticker.exchange === 'binance') {
                                ticker.price = parseFloat(t.price);
                            }
                        });
                    });
                }
            })
            .catch(() => {});

        fetch('https://api.bybit.com/v5/market/tickers?category=linear')
            .then(r => r.json())
            .then(data => {
                if (data.retCode === 0 && data.result?.list) {
                    data.result.list.forEach(t => {
                        this.tickersMap.forEach(ticker => {
                            if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'futures') {
                                ticker.price = parseFloat(t.lastPrice);
                            }
                        });
                    });
                }
            })
            .catch(() => {});

        fetch('https://api.bybit.com/v5/market/tickers?category=spot')
            .then(r => r.json())
            .then(data => {
                if (data.retCode === 0 && data.result?.list) {
                    data.result.list.forEach(t => {
                        this.tickersMap.forEach(ticker => {
                            if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'spot') {
                                ticker.price = parseFloat(t.lastPrice);
                            }
                        });
                    });
                }
            })
            .catch(() => {});
 document.getElementById('tickerLoader').style.display = 'none';
        this.renderer.updatePriceElements();
    }, 1000);
    
    this.setupDelegatedEvents();
}
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
    
    // УБИРАЕМ ЭТО:
    // if (this.watchlistManager) {
    //     this.watchlistManager.clearActiveList();
    //     this.watchlistManager.renderDropdown();
    // }
    
    // Оставляем просто перерисовку дропдауна
    if (this.watchlistManager) {
        this.watchlistManager.renderDropdown();
    }
    
    this.saveState();
}
   addSymbol(symbol, isCustom = true, exchange = 'binance', marketType = 'futures', render = true, skipInitialFetch = false, skipWatchlistSync = false) {
    
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
    
    // Подписка на цену через PriceManager
    if (window.priceManagerInstance && exchange === 'binance') {
        window.priceManagerInstance.subscribe(symbol, (price) => {
            this._onPriceUpdate(symbol, price);
        });
    }
    
    const symbolKey = `${symbol}:${exchange}:${marketType}`;
    if (isCustom && !this.state.customSymbols.includes(symbolKey)) { 
        this.state.customSymbols.push(symbolKey); 
        this.saveState(); 
    }
    
    // ===== НОВОЕ: Синхронизация с активным вотчлистом =====
   if (isCustom && this.watchlistManager && !skipWatchlistSync) {
    this.watchlistManager.addSymbolToActiveList(symbol, exchange, marketType);
    this.watchlistManager.renderDropdown();
}
    
    this.filterCache = null;
    
    if (this.debugMode) {
        console.log(`➕ Добавлен символ: ${symbol} (${exchange} ${marketType})`);
    }
    
    if (!skipInitialFetch) {
        this.fetchInitialDataForSymbol(symbol, exchange, marketType);
    }
    
    if (render) {
        this.renderTickerList();
    }
    
    return true;
}

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
        
        if (window.priceManagerInstance && exchange === 'binance') {
            window.priceManagerInstance.subscribe(symbol, (price) => {
                this._onPriceUpdate(symbol, price);
            });
        }
        
        if (this.watchlistManager) {
            this.watchlistManager.addSymbolToActiveList(symbol, exchange, marketType);
        }
        
        addedSymbols.push({ symbol, exchange, marketType });
    });
    
    if (addedSymbols.length === 0) return;
    
    this.saveState();
    this.filterCache = null;
    this.renderTickerList();
    
    // ✅ Загружаем цены для всех
    await this.fetchBatchSnapshots(addedSymbols);
    
    this.filterCache = null;
    this.renderTickerList();
    this.debouncedUpdatePrices();
    
    // ✅ Принудительно обновляем отображение
    this.displayedTickers = [];
    this.tickerElements.clear();
    this.filterCache = null;
    this.renderTickerList();
    
    console.log(`✅ Добавлено ${addedSymbols.length} символов`);
}
  async fetchBatchSnapshots(symbols) {
    const binanceSymbols = symbols.filter(s => s.exchange === 'binance');
    const bybitSymbols = symbols.filter(s => s.exchange === 'bybit');
    
    const promises = [];
    
    if (binanceSymbols.length > 0) {
        promises.push(
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
                .then(r => r.json())
                .then(data => {
                    const symbolSet = new Set(binanceSymbols.map(s => s.symbol));
                    data.forEach(ticker => {
                        if (symbolSet.has(ticker.symbol)) {
                            this.tickersMap.forEach(t => {
                                if (t.symbol === ticker.symbol && t.exchange === 'binance') {
                                    t.price = parseFloat(ticker.lastPrice);
                                    t.change = parseFloat(ticker.priceChangePercent);
                                    t.volume = parseFloat(ticker.quoteVolume);
                                    t.trades = parseInt(ticker.count);
                                }
                            });
                        }
                    });
                })
                .catch(e => console.warn('Binance batch error:', e))
        );
    }
    
    // ✅ Bybit Futures
    const bybitFutures = bybitSymbols.filter(s => s.marketType === 'futures');
    if (bybitFutures.length > 0) {
        promises.push(
            fetch('https://api.bybit.com/v5/market/tickers?category=linear')
                .then(r => r.json())
                .then(data => {
                    if (data.retCode === 0 && data.result?.list) {
                        const symbolSet = new Set(bybitFutures.map(s => s.symbol));
                        data.result.list.forEach(t => {
                            if (symbolSet.has(t.symbol)) {
                                this.tickersMap.forEach(ticker => {
                                    if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'futures') {
                                        ticker.price = parseFloat(t.lastPrice);
                                        ticker.change = parseFloat(t.price24hPcnt) * 100;
                                        ticker.volume = parseFloat(t.volume24h) * parseFloat(t.lastPrice);
                                    }
                                });
                            }
                        });
                    }
                })
                .catch(e => console.warn('Bybit futures error:', e))
        );
    }
    
    // ✅ Bybit Spot
    const bybitSpot = bybitSymbols.filter(s => s.marketType === 'spot');
    if (bybitSpot.length > 0) {
        promises.push(
            fetch('https://api.bybit.com/v5/market/tickers?category=spot')
                .then(r => r.json())
                .then(data => {
                    if (data.retCode === 0 && data.result?.list) {
                        const symbolSet = new Set(bybitSpot.map(s => s.symbol));
                        data.result.list.forEach(t => {
                            if (symbolSet.has(t.symbol)) {
                                this.tickersMap.forEach(ticker => {
                                    if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'spot') {
                                        ticker.price = parseFloat(t.lastPrice);
                                        ticker.change = parseFloat(t.price24hPcnt) * 100;
                                        ticker.volume = parseFloat(t.volume24h) * parseFloat(t.lastPrice);
                                    }
                                });
                            }
                        });
                    }
                })
                .catch(e => console.warn('Bybit spot error:', e))
        );
    }
    
    await Promise.allSettled(promises);
    this.debouncedUpdatePrices();
}
    async fetchInitialDataForSymbol(symbol, exchange, marketType) {
        if (exchange === 'binance') {
            try {
                const url = marketType === 'futures' 
                    ? `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`
                    : `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
                const response = await fetch(url);
                const data = await response.json();
                
                const ticker = this.tickersMap.get(`${symbol}:${exchange}:${marketType}`);
                if (ticker) {
                    ticker.price = parseFloat(data.lastPrice);
                    ticker.change = parseFloat(data.priceChangePercent);
                    ticker.volume = parseFloat(data.quoteVolume);
                    ticker.trades = parseInt(data.count);
                    this.debouncedUpdatePrices();
                    console.log(`✅ Загружены начальные данные для ${symbol}`);
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
                    if (ticker) {
                        ticker.price = parseFloat(tickerData.lastPrice);
                        ticker.change = parseFloat(tickerData.price24hPcnt) * 100;
                        ticker.volume = parseFloat(tickerData.turnover24h) || parseFloat(tickerData.volume24h) * parseFloat(tickerData.lastPrice);
                        this.debouncedUpdatePrices();
                        console.log(`✅ Загружены начальные данные для ${symbol}`);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось загрузить ${symbol}:`, error);
            }
        }
    }
    
    async fetchBybitSnapshots() {
        try {
            const futuresRes = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
            const futuresData = await futuresRes.json();
            
            if (futuresData.retCode === 0 && futuresData.result?.list) {
                futuresData.result.list.forEach(ticker => {
                    if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
                        this.tickersMap.forEach(t => {
                            if (t.symbol === ticker.symbol && t.exchange === 'bybit' && t.marketType === 'futures') {
                                t.price = parseFloat(ticker.lastPrice);
                                t.change = parseFloat(ticker.price24hPcnt) * 100;
                                t.volume = parseFloat(ticker.volume24h) * parseFloat(ticker.lastPrice);
                            }
                        });
                    }
                });
            }
            
            const spotRes = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
            const spotData = await spotRes.json();
            
            if (spotData.retCode === 0 && spotData.result?.list) {
                spotData.result.list.forEach(ticker => {
                    if (ticker.symbol && ticker.symbol.endsWith('USDT')) {
                        this.tickersMap.forEach(t => {
                            if (t.symbol === ticker.symbol && t.exchange === 'bybit' && t.marketType === 'spot') {
                                t.price = parseFloat(ticker.lastPrice);
                                t.change = parseFloat(ticker.price24hPcnt) * 100;
                                t.volume = parseFloat(ticker.volume24h);
                            }
                        });
                    }
                });
            }
            
            this.debouncedUpdatePrices();
            console.log('✅ Bybit начальные данные загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки Bybit:', error);
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
    
    // ===== НОВОЕ: Синхронизация с активным вотчлистом =====
    if (this.watchlistManager) {
        this.watchlistManager.removeSymbolFromActiveList(symbol, exchange, marketType);
         this.watchlistManager.renderDropdown();
    }
    
    this.saveState();
    
    if (this.state.currentSymbol === symbol && 
        this.state.currentExchange === exchange && 
        this.state.currentMarketType === marketType) { 
        this.state.currentSymbol = ''; 
        this.state.currentExchange = 'binance'; 
    }
    
    this.filterCache = null;
    this.renderTickerList();
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
    if (!tickerItem) return;
    
    const flag = e.target.closest('.flag');
    const flagPlaceholder = e.target.closest('.flag-placeholder');
    
    // Клик по флагу — показываем меню флагов
    if (flag || flagPlaceholder) {
        e.preventDefault();
        e.stopPropagation();
        
        const contextMenu = document.getElementById('flagContextMenu');
        if (!contextMenu) return;
        
        contextMenu.dataset.symbol = tickerItem.dataset.symbol;
        contextMenu.dataset.exchange = tickerItem.dataset.exchange;
        contextMenu.dataset.marketType = tickerItem.dataset.marketType;
        
        const x = Math.min(e.pageX, window.innerWidth - 200);
        const y = Math.min(e.pageY, window.innerHeight - 200);
        
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        
        // Скрыть меню тикера
        const tickerMenu = document.getElementById('tickerContextMenu');
        if (tickerMenu) tickerMenu.style.display = 'none';
        
        return;
    }
    
    // Клик по тикеру (не по флагу) — показываем меню с вотчлистами
    e.preventDefault();
    e.stopPropagation();
    
    const symbol = tickerItem.dataset.symbol;
    const exchange = tickerItem.dataset.exchange;
    const marketType = tickerItem.dataset.marketType;
    
    let menu = document.getElementById('tickerContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'tickerContextMenu';
        menu.className = 'context-menu';
        document.body.appendChild(menu);
    }
    
    // Строим HTML меню
   let html = `
    <div class="context-menu-item" data-action="copy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Копировать ${symbol}
    </div>`;
    
    if (this.watchlistManager && this.watchlistManager.lists) {
        html += `<div class="context-menu-divider"></div>`;
        html += `<div class="context-menu-label">Добавить в вотчлист:</div>`;
        
        this.watchlistManager.listOrder.forEach(listId => {
            const list = this.watchlistManager.lists.get(listId);
            if (list) {
                html += `
                    <div class="context-menu-item" 
                         data-action="add-wl" 
                         data-list-id="${listId}"
                         data-symbol="${symbol}"
                         data-exchange="${exchange}"
                         data-market-type="${marketType}">
                       ${listId === this.watchlistManager.activeListId ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;color:#4caf50;"><path d="m17,15c-4.188,0-6.33,3.499-6.849,4.5.52,1.001,2.661,4.5,6.849,4.5s6.33-3.499,6.849-4.5c-.52-1.001-2.661-4.5-6.849-4.5Zm0,8c-3.302,0-5.033-2.288-5.717-3.5.685-1.212,2.415-3.5,5.717-3.5s5.033,2.288,5.717,3.5c-.685,1.212-2.415,3.5-5.717,3.5Zm-8-12.5h11v1h-11v-1Zm8,7c-1.103,0-2,.897-2,2s.897,2,2,2,2-.897,2-2-.897-2-2-2Zm0,3c-.551,0-1-.448-1-1s.449-1,1-1,1,.448,1,1-.449,1-1,1ZM6,5.5c0,.552-.448,1-1,1s-1-.448-1-1,.448-1,1-1,1,.448,1,1Zm0,5.5c0,.552-.448,1-1,1s-1-.448-1-1,.448-1,1-1,1,.448,1,1Zm14-5h-11v-1h11v1Zm-14,10.5c0,.552-.448,1-1,1s-1-.448-1-1,.448-1,1-1,1,.448,1,1ZM24,2.5v13.684c-.292-.327-.624-.66-1-.981V2.5c0-.827-.673-1.5-1.5-1.5H2.5c-.827,0-1.5.673-1.5,1.5v18.5h7.686c.161.279.377.624.653,1H0V2.5C0,1.122,1.122,0,2.5,0h19c1.378,0,2.5,1.122,2.5,2.5Z"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;opacity:0.5;"><path d="M17.5,24H6.5c-2.481,0-4.5-2.019-4.5-4.5V4.5C2,2.019,4.019,0,6.5,0h11c2.481,0,4.5,2.019,4.5,4.5v15c0,2.481-2.019,4.5-4.5,4.5ZM6.5,1c-1.93,0-3.5,1.57-3.5,3.5v15c0,1.93,1.57,3.5,3.5,3.5h11c1.93,0,3.5-1.57,3.5-3.5V4.5c0-1.93-1.57-3.5-3.5-3.5H6.5Zm11.5,4.5c0-.276-.224-.5-.5-.5h-6c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5h6c.276,0,.5-.224,.5-.5Zm0,6c0-.276-.224-.5-.5-.5h-6c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5h6c.276,0,.5-.224,.5-.5Zm0,6c0-.276-.224-.5-.5-.5h-6c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5h6c.276,0,.5-.224,.5-.5ZM8.5,7h-2c-.276,0-.5-.224-.5-.5v-2c0-.276,.224-.5,.5-.5h2c.276,0,.5,.224,.5,.5v2c0,.276-.224,.5-.5,.5Zm-1.5-1h1v-1h-1v1Zm1.5,7h-2c-.276,0-.5-.224-.5-.5v-2c0-.276,.224-.5,.5-.5h2c.276,0,.5,.224,.5,.5v2c0,.276-.224,.5-.5,.5Zm-1.5-1h1v-1h-1v1Zm1.5,7h-2c-.276,0-.5-.224-.5-.5v-2c0-.276,.224-.5,.5-.5h2c.276,0,.5,.224,.5,.5v2c0,.276-.224,.5-.5,.5Zm-1.5-1h1v-1h-1v1Z"/></svg>'}
                        ${this.watchlistManager.escapeHtml(list.name)}
                        <span style="margin-left:auto;color:#666;font-size:11px">${list.symbols.length}</span>
                    </div>`;
            }
        });
    }
    
    menu.innerHTML = html;
    
    // Позиция
    const x = Math.min(e.pageX, window.innerWidth - 220);
    const y = Math.min(e.pageY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
    
    // Обработчики
    menu.querySelector('[data-action="copy"]').onclick = () => {
        navigator.clipboard.writeText(symbol);
        menu.style.display = 'none';
    };
    
       menu.querySelectorAll('[data-action="add-wl"]').forEach(item => {
        item.onclick = async (ev) => {
            ev.stopPropagation();
            const listId = item.dataset.listId;
            const sym = item.dataset.symbol;
            const ex = item.dataset.exchange;
            const mt = item.dataset.marketType;
            
            if (this.watchlistManager) {
                const added = await this.watchlistManager.addSymbolToList(listId, sym, ex, mt);
                
                // Уведомление
                const notif = document.getElementById('alertNotification');
                if (notif) {
                    const list = this.watchlistManager.lists.get(listId);
                    notif.innerHTML = `<div>${added ? '✅' : '⚠️'} ${sym} ${added ? '→' : 'уже в'} ${list?.name || 'списке'}</div>`;
                    notif.style.display = 'block';
                    notif.style.borderLeftColor = added ? '#4caf50' : '#ff9800';
                    setTimeout(() => notif.style.display = 'none', 2000);
                }
            }
            menu.style.display = 'none';
        };
    });
        
    
    // Скрыть меню флагов
    const flagMenu = document.getElementById('flagContextMenu');
    if (flagMenu) flagMenu.style.display = 'none';
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
    
    // Находим тикер по ключу
    const key = `${symbol}:${exchange}:${marketType}`;
    const ticker = this.tickersMap.get(key);
    
    if (ticker && this.renderer) {
        // Находим индекс в отображаемом списке
        const index = this.renderer.displayedTickers.indexOf(ticker);
        
        if (index !== -1) {
            const container = document.getElementById('tickerListContainer');
            const rowHeight = this.renderer.rowHeight || 36;
            
            // Прокручиваем контейнер к нужной позиции
            container.scrollTop = Math.max(0, index * rowHeight - container.clientHeight / 2);
            
            // Принудительно рендерим видимые тикеры
            setTimeout(() => {
                this.renderer.renderVisibleTickers();
                
                // Теперь элемент должен быть видим — подсвечиваем
                const tickerElement = document.querySelector(
                    `.ticker-item[data-symbol="${symbol}"][data-exchange="${exchange}"][data-market-type="${marketType}"]`
                );
                if (tickerElement) {
                    tickerElement.classList.add('active');
                }
            }, 100);
        }
    }
    
    if (this.coordinator) {
        this.coordinator.loadSymbol(symbol, exchange, marketType);
        
        setTimeout(() => {
            if (this.coordinator.chartManager) {
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
    const flagMenu = document.getElementById('flagContextMenu');
    if (flagMenu) flagMenu.style.display = 'none';
    const tickerMenu = document.getElementById('tickerContextMenu');
    if (tickerMenu) tickerMenu.style.display = 'none';
}
}

if (typeof window !== 'undefined') {
    window.TickerPanel = TickerPanel;
    console.log('✅ TickerPanel зарегистрирован в window');
}