class ChartManager {
    constructor(container) {
        this.chartData = [];
        this.lastCandle = null;
        this._loadingSymbol = false;
        this.indicatorManager = new IndicatorManager(this);
        this.chartContainer = document.getElementById('chart-container');
       // Восстанавливаем сохранённый тип графика
const savedChartType = localStorage.getItem('chartType') || 'candle';
this.currentChartType = savedChartType;
console.log('📊 Тип графика:', savedChartType);
        this.isLoadingMore = false;
        this.hasMoreData = true;
        this.currentInterval = localStorage.getItem('lastTimeframe') || CONFIG.defaultInterval;
console.log('📊 ChartManager: таймфрейм =', this.currentInterval);
        this.currentSymbol = CONFIG.defaultSymbol;
        this.currentExchange = 'binance';
        this.currentMarketType = 'futures';
        this._lastWidth = this.chartContainer.clientWidth;
        this._initPromise = null;
        this._lastHeight = this.chartContainer.clientHeight;
        this._savedTimePosition = null;
        this._lastTimeframe = null;
        this._symbolChangeCallbacks = [];
        this._updateScheduled = false;
        this._lastUpdateTime = 0;
        this._drawingsUpdateRafId = null;
        this._pendingUpdates = false;  // 👈 флаг фоновых изменений

this._visibilityHandler = () => {
    if (!document.hidden) {
        // Вернулись на вкладку
        if (this._pendingUpdates) {
            this._pendingUpdates = false;
            this.forceRedraw();   // принудительно обновляем график
        }
        // Синхронизируем таймер и рисунки
        if (this.timerManager?._primitive) {
            this.timerManager._primitive.requestRedraw();
        }
        this.scheduleDrawingsUpdate();
    }
};

document.addEventListener('visibilitychange', this._visibilityHandler);
        this.priceManager = new PriceManager();
        window.priceManagerInstance = this.priceManager;
        this._priceUpdateHandler = null;

        this.scheduleDrawingsUpdate = this.scheduleDrawingsUpdate.bind(this);
        this.onVisibleLogicalRangeChange = this.onVisibleLogicalRangeChange.bind(this);

        this.overlay = safeElement('candleStatsOverlay');
        this.openEl = safeElement('openValue');
        this.highEl = safeElement('highValue');
        this.lowEl = safeElement('lowValue');
        this.closeEl = safeElement('closeValue');
        this.changeEl = safeElement('changeValue');

        this.loadingOverlay = safeElement('loadingOverlay');
        this.loadingProgress = safeElement('loadingProgress');
this.chart = LightweightCharts.createChart(container, {
    layout: { 
        background: { color: '#000000' }, 
        textColor: '#808080'
    },
    grid: { 
        vertLines: { visible: false },
        horzLines: { visible: false }
    },
    crosshair: { 
        mode: LightweightCharts.CrosshairMode.Normal 
    },
    timeScale: { 
        timeVisible: true, 
        secondsVisible: false,
        borderColor: '#333333',
        barSpacing: 12,
        minBarSpacing: 3,
        fixLeftEdge: true,
        fixRightEdge: false,
        rightOffset: 5,
        tickMarkFormatter: (time) => {
            const mskTime = time + (3 * 3600);
            const date = new Date(mskTime * 1000);
            const hours = date.getUTCHours().toString().padStart(2, '0');
            const minutes = date.getUTCMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }
    },
    rightPriceScale: { 
        borderColor: '#333333',
        borderVisible: true,
        scaleMargins: {
            top: 0.1,
            bottom: 0.1,
        }
    },
    localization: {
        timeFormatter: (time) => {
            const mskTime = time + (3 * 3600);
            const date = new Date(mskTime * 1000);
            return date.toLocaleString('ru-RU', {
                timeZone: 'UTC',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
});

// Создаём свечную серию
this.candleSeries = this.chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: CONFIG.colors.bullish,
    downColor: CONFIG.colors.bearish,
    borderVisible: false,
    wickUpColor: CONFIG.colors.bullish,
    wickDownColor: CONFIG.colors.bearish,
    priceScaleId: 'right',
    priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01
    }
});

// Создаём барную серию
this.barSeries = this.chart.addSeries(LightweightCharts.BarSeries, {
    upColor: CONFIG.colors.bullish,
    downColor: CONFIG.colors.bearish,
    openVisible: true,
    thinBars: true,
    priceScaleId: 'right',
    priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01
    }
});

// Включаем встроенную линию цены
this.candleSeries.applyOptions({
    priceLineVisible: true,
    lastValueVisible: true,
    priceLineSource: this.currentRealPrice || 0,
    priceLineColor: '#00bcd4',
    priceLineWidth: 1,
    priceLineStyle: LightweightCharts.LineStyle.Dashed
});

this.barSeries.applyOptions({
    priceLineVisible: true,
    lastValueVisible: true,
    priceLineSource: this.currentRealPrice || 0,
    priceLineColor: '#00bcd4',
    priceLineWidth: 1,
    priceLineStyle: LightweightCharts.LineStyle.Dashed
});
// В конструкторе ChartManager, после создания candleSeries и barSeries
const savedBg = localStorage.getItem('chartBgColor');
const savedBullish = localStorage.getItem('chartBullishColor');
const savedBearish = localStorage.getItem('chartBearishColor');

if (savedBg) {
    this.chart.applyOptions({ layout: { background: { color: savedBg } } });
}
if (savedBullish && savedBearish) {
    CONFIG.colors.bullish = savedBullish;
    CONFIG.colors.bearish = savedBearish;
    this.bullishColor = savedBullish;
    this.bearishColor = savedBearish;
    
    this.candleSeries.applyOptions({
        upColor: savedBullish,
        downColor: savedBearish,
        wickUpColor: savedBullish,
        wickDownColor: savedBearish
    });
    
    this.barSeries.applyOptions({
        upColor: savedBullish,
        downColor: savedBearish
    });
    
    // === ЛИНИЯ ЦЕНЫ ===
    const lastCandle = this.chartData?.[this.chartData.length - 1];
    const isBullish = lastCandle ? lastCandle.close >= lastCandle.open : true;
    const lineColor = isBullish ? savedBullish : savedBearish;
    this.candleSeries.applyOptions({ priceLineColor: lineColor });
    this.barSeries.applyOptions({ priceLineColor: lineColor });
}
// ========== СОЗДАНИЕ ОБЪЁМА ==========
if (typeof LightweightCharts !== 'undefined') {
    try {
        this.volumeSeries = this.chart.addSeries(LightweightCharts.HistogramSeries, {
            priceScaleId: 'volume',
            priceFormat: { type: 'volume' },
            color: '#26a69a',
            lineWidth: 1,
            lastValueVisible: false,
            title: ''
        });
        
        const volumeScale = this.chart.priceScale('volume');
        if (volumeScale) {
            volumeScale.applyOptions({
                scaleMargins: { top: 0.7, bottom: 0 },
                visible: true,
                borderVisible: true,
                autoScale: true
            });
        }
        
        this.bullishColor = CONFIG.colors.bullish;
        this.bearishColor = CONFIG.colors.bearish;
        
        console.log('✅ Volume series создан');
    } catch (e) {
        console.warn('⚠️ Не удалось создать Volume:', e);
        this.volumeSeries = null;
    }
} else {
    console.warn('⚠️ LightweightCharts не загружен');
    this.volumeSeries = null;
}

console.log('✅ Volume series создан с отдельной шкалой');

this.chart.priceScale('right').applyOptions({ 
    scaleMargins: { top: 0.0, bottom: 0.5 }
});

// Применяем сохранённый тип графика
const isCandle = this.currentChartType === 'candle';
this.candleSeries.applyOptions({ visible: isCandle });
this.barSeries.applyOptions({ visible: !isCandle });

this.chart.subscribeCrosshairMove(this.onCrosshairMove.bind(this));
this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.onVisibleLogicalRangeChange);

this.setupMaximumSubscriptions();
this.setupEventListeners();

this.alertTimers = new Map();
this.currentRealPrice = null;

this._subscribeToPrice();

(async () => {
    const CACHE_VERSION = '2';
    const savedVersion = localStorage.getItem('candleCacheVersion');
    if (savedVersion !== CACHE_VERSION) {
        await this.clearOldCaches();
        localStorage.setItem('candleCacheVersion', CACHE_VERSION);
        console.log('✅ Кэш свечей обновлён до версии', CACHE_VERSION);
    }
})();

// Запускаем асинхронную инициализацию
this._initPromise = (async () => {
    await this.waitForReady();
    
    this._updateMainChartHeight();
    
    const panelsContainer = document.getElementById('indicator-panels-container');
    if (panelsContainer) {
        const observer = new ResizeObserver(() => {
            this._updateMainChartHeight();
        });
        observer.observe(panelsContainer);
    }
    
    console.log('✅ ChartManager полностью инициализирован');
})();
 }
getCurrentPrice() {
    // 1. Сначала из PriceManager (WebSocket)
    if (this.priceManager) {
        const price = this.priceManager.getPrice(this.currentSymbol);
        if (price !== null && !isNaN(price)) {
            return price;
        }
    }
    
    // 2. Если WebSocket еще не дал цену — используем сохраненную realPrice
    if (this.currentRealPrice !== null && this.currentRealPrice !== undefined && !isNaN(this.currentRealPrice)) {
        return this.currentRealPrice;
    }
    
    
    // 4. Если ничего нет — null
    return null;
}
saveCurrentTimePosition() {
    if (!this.chart || !this.chartData.length) return null;
    
    const timeScale = this.chart.timeScale();
    const visibleRange = timeScale.getVisibleLogicalRange();
    
    if (visibleRange) {
        const firstVisibleIndex = Math.floor(visibleRange.from);
        if (firstVisibleIndex >= 0 && firstVisibleIndex < this.chartData.length) {
            return this.chartData[firstVisibleIndex].time;
        }
    }
    return null;
}
scrollToTime(time) {
    if (!this.chart || !time) return;
    
    const timeScale = this.chart.timeScale();
    const currentRange = timeScale.getVisibleLogicalRange();
    
    if (!currentRange) return;
    
    const targetIndex = this.chartData.findIndex(c => c.time >= time);
    
    if (targetIndex !== -1) {
        const visibleBars = currentRange.to - currentRange.from;
        timeScale.setVisibleLogicalRange({
            from: Math.max(0, targetIndex - 55),
            to: Math.max(0, targetIndex - 55) + visibleBars
        });
    } else {
        this.scrollToLast();
    }
}
getCurrentSymbolKey() {
    return `${this.currentSymbol}:${this.currentExchange}:${this.currentMarketType}`;
}
updatePricePrecision(symbol, exchange, marketType) {
    // Получаем precision напрямую с биржи (с кэшированием)
    getPrecisionFromExchange(symbol, exchange, marketType).then(precision => {
        // ===== ВСЯ СТАРАЯ ЛОГИКА ОСТАЁТСЯ =====
        const minMove = Math.pow(10, -precision);
        
        if (this.candleSeries) {
            this.candleSeries.applyOptions({
                priceFormat: { type: 'price', precision: precision, minMove: minMove }
            });
        }
        if (this.barSeries) {
            this.barSeries.applyOptions({
                priceFormat: { type: 'price', precision: precision, minMove: minMove }
            });
        }
        if (this.chartData && this.chartData.length > 0) {
            if (this.candleSeries) this.candleSeries.setData(this.chartData);
            if (this.barSeries) this.barSeries.setData(this.chartData);
        }
        // =====================================
        
        console.log(`✅ Precision для ${symbol} (${exchange} ${marketType}) = ${precision}`);
    }).catch(err => {
        console.warn(`Ошибка применения precision для ${symbol}:`, err);
    });
}
    setupMaximumSubscriptions() {
        this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            this.scheduleDrawingsUpdate();
        });
        
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            this.scheduleDrawingsUpdate();
        });

        const priceScale = this.chart.priceScale('right');
        if (priceScale && typeof priceScale.subscribeVisibleLogicalRangeChange === 'function') {
            priceScale.subscribeVisibleLogicalRangeChange(() => {
                this.scheduleDrawingsUpdate();
            });
        }

        this.chartContainer.addEventListener('mousedown', () => {
            this.scheduleDrawingsUpdate();
        });
        
        this.chartContainer.addEventListener('mouseup', () => {
            this.scheduleDrawingsUpdate();
        });
        
        this.chartContainer.addEventListener('wheel', () => {
            this.scheduleDrawingsUpdate();
        }, { passive: true });
        
        const observer = new MutationObserver(() => {
            this.scheduleDrawingsUpdate();
        });
        observer.observe(this.chartContainer, { 
            attributes: true, 
            childList: true, 
            subtree: true,
            attributeFilter: ['style', 'class', 'width', 'height']
        });
    }
   forceRedraw() {
    if (!this.chartData.length) return;

    this.candleSeries.setData([]);
    this.barSeries.setData([]);
    if (this.volumeSeries) this.volumeSeries.setData([]);

    setTimeout(() => {
        this.candleSeries.setData(this.chartData);
        this.barSeries.setData(this.chartData);

        if (this.volumeSeries) {
            const volumeData = this.chartData.map(c => ({
                time: c.time,
                value: c.volume,
                color: c.close >= c.open ? this.bullishColor : this.bearishColor
            }));
            this.volumeSeries.setData(volumeData);
        }

        if (this.indicatorManager) {
            this.indicatorManager.updateAllIndicators();
        }

        // 👇 ВОССТАНАВЛИВАЕМ ЛИНИЮ ЦЕНЫ
        if (this.currentRealPrice) {
            const series = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
            if (series) {
                series.applyOptions({ priceLineSource: this.currentRealPrice });
            }
        }

        if (this.timerManager?._primitive) {
            this.timerManager._primitive.requestRedraw();
        }

        this.chart.timeScale().fitContent();
    }, 10);
}
    _subscribeToSymbolChange(callback) {
        this._symbolChangeCallbacks = this._symbolChangeCallbacks || [];
        this._symbolChangeCallbacks.push(callback);
    }

    _notifySymbolChange() {
        if (this._symbolChangeCallbacks) {
            this._symbolChangeCallbacks.forEach(cb => cb());
        }
    }
    
  loadSymbolData(symbol, exchange, marketType) {
 getPrecisionFromExchange(symbol, exchange, marketType).then(precision => {
        this.applyPriceFormat(precision);
    });
    
    const isSameSymbol = (symbol === this.currentSymbol);
const isTimeframeChange = isSameSymbol && (this.currentInterval !== this._lastTimeframe);

if (isTimeframeChange) {
    this._savedTimePosition = this.saveCurrentTimePosition();
    console.log('📍 Сохранена позиция:', this._savedTimePosition);
}
    console.log(`📊 Загружаю данные для ${symbol} (${exchange} ${marketType})`);
    
    if (this._loadingSymbol) {
        console.log('Загрузка уже выполняется, пропускаем');
        return;
    }
    this._loadingSymbol = true;
    // Ждём готовности IndexedDB (без await)
const dbPromise = new Promise(resolve => {
    if (window.dbReady) {
        resolve();
    } else {
        console.log('⏳ Ожидание IndexedDB...');
        const check = setInterval(() => {
            if (window.dbReady) {
                clearInterval(check);
                console.log('✅ IndexedDB готова');
                resolve();
            }
        }, 50);
        setTimeout(() => {
            clearInterval(check);
            console.warn('⚠️ Таймаут ожидания IndexedDB');
            resolve();
        }, 3000);
    }
});

// Дальше весь код loadSymbolData оберни в dbPromise.then(() => { ... })
    this.setSymbol(symbol);
    
    const previousData = [...(this.chartData || [])];
    const previousSymbol = this.currentSymbol;
    const previousExchange = this.currentExchange;
    const previousMarketType = this.currentMarketType;
    
    if (this.loadingOverlay) {
        this.loadingOverlay.classList.add('visible');
        if (this.loadingProgress) {
            this.loadingProgress.textContent = 'Загрузка...';
        }
    }
    
    const loadData = async () => {
        let formattedData = [];
        try {
            const cachedCandles = await this.loadCandlesFromCache(symbol, exchange, marketType, this.currentInterval);
            
            if (cachedCandles) {
                console.log(`✅ Использую кэшированные данные для ${symbol}`);
                formattedData = cachedCandles;
                
                setTimeout(() => {
                    this.refreshCandlesInBackground(symbol, exchange, marketType, this.currentInterval);
                }, 500);
                
            } else {
                console.log(`🌐 Загружаю данные с биржи для ${symbol}`);
                
                const bybitIntervalMap = {
                    '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
                    '1h': '60', '4h': '240', '6h': '360', '12h': '720',
                    '1d': 'D', '1w': 'W', '1M': 'M'
                };
                
                let url;
                if (exchange === 'binance') {
                    if (marketType === 'futures') {
                        url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${this.currentInterval}&limit=1000`;
                    } else {
                        url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${this.currentInterval}&limit=1000`;
                    }
                } else {
                    const bybitInterval = bybitIntervalMap[this.currentInterval] || this.currentInterval;
                    const category = marketType === 'futures' ? 'linear' : 'spot';
                    url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bybitInterval}&limit=200`;
                }
                
                console.log('URL загрузки:', url);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                if (exchange === 'binance') {
                    if (!Array.isArray(data)) {
                        throw new Error(`Binance error: ${data.msg || 'Invalid response'}`);
                    }
                    
                    if (data.length === 0) {
                        throw new Error('Binance: нет данных');
                    }
                    
                    formattedData = data.map(item => ({
                        time: Math.floor(item[0] / 1000),
                        open: parseFloat(item[1]),
                        high: parseFloat(item[2]),
                        low: parseFloat(item[3]),
                        close: parseFloat(item[4]),
                        volume: parseFloat(item[5])
                    }));
                    
                    console.log(`✅ Binance: загружено ${formattedData.length} свечей`);
                    
                } else {
                    if (data.retCode !== 0) {
                        throw new Error(`Bybit error: ${data.retMsg || 'Unknown error'} (код: ${data.retCode})`);
                    }
                    
                    if (!data.result || !data.result.list) {
                        throw new Error('Bybit: нет данных');
                    }
                    
                    const candles = data.result.list;
                    
                    formattedData = candles.map(item => ({
                        time: Math.floor(parseInt(item[0]) / 1000),
                        open: parseFloat(item[1]),
                        high: parseFloat(item[2]),
                        low: parseFloat(item[3]),
                        close: parseFloat(item[4]),
                        volume: parseFloat(item[5] || 0)
                    })).filter(c => c !== null);
                     
                    console.log(`✅ Bybit: загружено ${formattedData.length} свечей`);
                }
                
                if (formattedData.length > 0) {
                    await this.saveCandlesToCache(symbol, exchange, marketType, this.currentInterval, formattedData);
                }
            }
            
            if (formattedData.length === 0) {
                throw new Error('Нет данных для отображения');
            }
            
            this.chartData = [];
            if (this.candleSeries) this.candleSeries.setData([]);
            if (this.barSeries) this.barSeries.setData([]);
            
            this.setDataQuick(formattedData, this.currentInterval, symbol);
            
            const pairDisplay = document.getElementById('pairDisplay');
            if (pairDisplay) pairDisplay.textContent = symbol;

            const exchangeDisplay = document.getElementById('exchangeDisplay');
            if (exchangeDisplay) exchangeDisplay.textContent = exchange === 'binance' ? 'Binance' : 'Bybit';

            const contractTypeDisplay = document.getElementById('contractTypeDisplay');
            if (contractTypeDisplay) contractTypeDisplay.textContent = marketType === 'futures' ? 'PERP' : 'SPOT';
            
            this.currentSymbol = symbol;
            this.currentExchange = exchange;
            this.currentMarketType = marketType;

            // ========== ИСПРАВЛЕНИЕ: ЗАГРУЗКА ВСЕХ РИСУНКОВ ДЛЯ НОВОГО СИМВОЛА ==========
            // Дожидаемся готовности серии (если реализован метод)
            await this.waitForReady();

            if (window.rayManager) {
                await window.rayManager.loadRays();
            }
            if (window.trendLineManager) {
                await window.trendLineManager.loadTrendLines();
            }
            if (window.rulerLineManager) {
                await window.rulerLineManager.loadRulers();
            }
            if (window.alertLineManager) {
                await window.alertLineManager.loadAlerts();
            }
            if (window.textManager) {
                await window.textManager.loadTexts();
            }
            // ========================================================================

            if (this.wsManager) {
                this.wsManager.closeAll();
                this.wsManager.connect(symbol, this.currentInterval);
            }
            
            if (this.loadingOverlay) {
                this.loadingOverlay.classList.remove('visible');
            }
            
          setTimeout(() => {
    if (isTimeframeChange && this._savedTimePosition) {
        this.scrollToTime(this._savedTimePosition);
        this._savedTimePosition = null;
        console.log('📍 Восстановлена позиция');
    } else {
        this.scrollToLast();
    }
    
    this._lastTimeframe = this.currentInterval;
}, 300);
             localStorage.setItem('lastTimeframe', this.currentInterval);
            console.log('💾 Сохранён таймфрейм:', this.currentInterval);
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            
            const notification = document.getElementById('alertNotification');
            if (notification) {
                notification.innerHTML = `
                    <div class="alert-title">❌ Ошибка загрузки</div>
                    <div class="alert-price">${symbol}</div>
                    <div class="alert-repeat">${error.message || 'Проверьте символ'}</div>
                `;
                notification.style.display = 'block';
                notification.style.borderLeftColor = '#f23645';
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 5000);
            }
            
            if (this.loadingOverlay) {
                this.loadingOverlay.classList.remove('visible');
            }
            
            if (previousData && previousData.length > 0) {
                console.log('Восстанавливаю предыдущие данные');
                this.chartData = previousData;
                this._performUpdate();
                
                document.getElementById('pairDisplay').textContent = previousSymbol || 'BTCUSDT';
                document.getElementById('exchangeDisplay').textContent = 
                    previousExchange === 'binance' ? 'Binance' : 'Bybit';
                document.getElementById('contractTypeDisplay').textContent = 
                    previousMarketType === 'futures' ? 'PERP' : 'SPOT';
            }
            
        } finally {
            this._loadingSymbol = false;
            
        }
    };
    
    loadData();
}
   async saveCandlesToCache(symbol, exchange, marketType, interval, candles) {
    if (!candles || candles.length === 0) return;
    
    const CACHE_VERSION = '2'; // ← новая версия кэша
    const key = `${symbol}_${interval}_${exchange}_${marketType}_v${CACHE_VERSION}`; // ← версия в ключе
    
    const cacheData = {
        key: key,
        symbol: symbol,
        exchange: exchange,
        marketType: marketType,
        interval: interval,
        data: candles,
        lastUpdate: Date.now(),
        firstCandleTime: candles[0].time,
        lastCandleTime: candles[candles.length - 1].time,
        count: candles.length,
        version: CACHE_VERSION // ← поле версии
    };
    
    if (!window.db) {
        console.warn('📦 IndexedDB не доступна, кэш не сохранен');
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
        
        await window.db.put('candles', cacheData);
        console.log(`📦 Свечи сохранены в кэш: ${key} (${candles.length} свечей)`);
    } catch (error) {
        console.warn('❌ Ошибка сохранения свечей в кэш:', error);
    }
}
    
    async loadCandlesFromCache(symbol, exchange, marketType, interval) {
    const CACHE_VERSION = '2';
    const key = `${symbol}_${interval}_${exchange}_${marketType}_v${CACHE_VERSION}`;
    
    if (!window.db) return null;
    
    try {
        const cached = await window.db.get('candles', key);
        if (!cached) return null;
        
        // Проверяем версию (на случай, если ключ без версии, но поле есть)
        if (cached.version !== CACHE_VERSION) {
            console.log(`Кэш устарел (версия ${cached.version}), удаляем`);
            await window.db.delete('candles', key);
            return null;
        }
        
        const CACHE_DURATION = 5 * 60 * 1000; // 5 минут
        if (Date.now() - cached.lastUpdate > CACHE_DURATION) {
            console.log(`Кэш устарел по времени: ${key}`);
            return null;
        }
        
        console.log(`📦 Загружено ${cached.data.length} свечей из кэша: ${key}`);
        return cached.data;
    } catch (error) {
        console.warn('❌ Ошибка загрузки свечей из кэша:', error);
        return null;
    }
}
// Вставьте после метода loadCandlesFromCache или перед getCurrentPrice
async fetchKlines(symbol, exchange, marketType, interval, limit = 1000) {
    const bybitIntervalMap = {
        '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', '6h': '360', '12h': '720',
        '1d': 'D', '1w': 'W', '1M': 'M'
    };

    let url;
    if (exchange === 'binance') {
        if (marketType === 'futures') {
            url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        } else {
            url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        }
    } else {
        const bybitInterval = bybitIntervalMap[interval] || interval;
        const category = marketType === 'futures' ? 'linear' : 'spot';
        url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (exchange === 'binance') {
        return data.map(item => ({
            time: Math.floor(item[0] / 1000),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
        }));
    } else {
        if (data.retCode !== 0) throw new Error(data.retMsg);
        const candles = data.result.list;
        // Bybit возвращает от новых к старым, приводим к хронологическому порядку
        return candles.map(item => ({
            time: Math.floor(parseInt(item[0]) / 1000),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5] || 0)
        })).filter(c => c !== null).reverse();
    }
}
    async clearOldCaches() {
    const CACHE_VERSION = '2';
    try {
        const allCandles = await window.db.getAll('candles');
        for (const cache of allCandles) {
            if (!cache.version || cache.version !== CACHE_VERSION) {
                await window.db.delete('candles', cache.key);
                console.log(`🗑️ Удалён старый кэш свечей: ${cache.key}`);
            }
        }
    } catch (e) {
        console.warn('Ошибка очистки кэша свечей:', e);
    }
}
    async clearOldCandlesCache(maxAge = 24 * 60 * 60 * 1000) {
        try {
            const allCandles = await window.db.getAll('candles');
            const now = Date.now();
            let deletedCount = 0;
            
            for (const cached of allCandles) {
                if (now - cached.lastUpdate > maxAge) {
                    await window.db.delete('candles', cached.key);
                    deletedCount++;
                }
            }
            
            if (deletedCount > 0) {
                console.log(`🧹 Очищено ${deletedCount} устаревших кэшей свечей`);
            }
            
        } catch (error) {
            console.warn('❌ Ошибка очистки кэша свечей:', error);
        }
    }
    async waitForReady() {
    let attempts = 0;
    const maxAttempts = 50; // 5 секунд максимум
    
    while (attempts < maxAttempts) {
        if (this.chart && 
            this.candleSeries && 
            this.chartData && 
            this.chartData.length > 0 &&
            this.chart.timeScale()?.getVisibleRange()) {
            console.log('✅ График готов за', attempts * 100, 'мс');
            return true;
        }
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    console.warn('⚠️ Таймаут ожидания готовности графика');
    return false;
}

async waitForSeriesReady() {
    return this.waitForReady();
}
    timeToCoordinate(time) {
        try {
            return this.chart.timeScale().timeToCoordinate(time);
        } catch (e) {
            return null;
        }
    }

    coordinateToTime(coordinate) {
        try {
            return this.chart.timeScale().coordinateToTime(coordinate);
        } catch (e) {
            return null;
        }
    }

    priceToCoordinate(price) {
        try {
            const series = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
            return series.priceToCoordinate(price);
        } catch (e) {
            return null;
        }
    }

    // ========== FALLBACK МЕТОДЫ (ВНУТРИ КЛАССА) ==========
    timeToCoordinateWithFallback(time) {
        let coord = this.timeToCoordinate(time);
        if (coord !== null) return coord;
        
        const data = this.chartData;
        if (!data || !data.length) return null;
        
        const firstCandle = data[0];
        const lastCandle = data[data.length - 1];
        const firstX = this.timeToCoordinate(firstCandle.time);
        const lastX = this.timeToCoordinate(lastCandle.time);
        
        if (firstX === null || lastX === null) return null;
        
        const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
        if (time < firstCandle.time) {
            return firstX - (firstCandle.time - time) * pixelsPerMs;
        } else {
            return lastX + (time - lastCandle.time) * pixelsPerMs;
        }
    }

    priceToCoordinateWithFallback(price) {
        let coord = this.priceToCoordinate(price);
        if (coord !== null) return coord;

        const series = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
        if (!series) return null;
        
        const priceScale = series.priceScale();
        if (!priceScale) return null;
        
        const height = priceScale.height();
        const firstValue = priceScale.coordinateToPrice(0);
        const lastValue = priceScale.coordinateToPrice(height);
        
        if (firstValue === null || lastValue === null) return null;
        
        const minPrice = Math.min(firstValue, lastValue);
        const maxPrice = Math.max(firstValue, lastValue);
        const pixelsPerUnit = height / (maxPrice - minPrice);
        
        if (price < minPrice) {
            return 0 - (minPrice - price) * pixelsPerUnit;
        } else {
            return height + (price - maxPrice) * pixelsPerUnit;
        }
    }
   
timeToLogical(time) {
    if (!this.chartData || !this.chartData.length) return null;
    const index = this.chartData.findIndex(c => c.time === time);
    return index !== -1 ? index : null;
}
    coordinateToPrice(coordinate) {
        try {
            const series = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
            return series.coordinateToPrice(coordinate);
        } catch (e) {
            return null;
        }
    }

    scheduleDrawingsUpdate() {
        if (this._drawingsUpdateRafId === null && window.renderDrawings) {
            this._drawingsUpdateRafId = requestAnimationFrame(() => {
                window.renderDrawings();
                this._drawingsUpdateRafId = null;
            });
        }
    }
    
    onVisibleLogicalRangeChange(range) {
        if (!range || this.isLoadingMore || !this.hasMoreData || !this.chartData.length) return;
        
        const fromIndex = Math.max(0, Math.floor(range.from));
        
        if (fromIndex < 70 && this.hasMoreData && !this.isLoadingMore) {
            this.loadMoreHistoricalData();
        }
    }
    
    async loadMoreHistoricalData() {
        if (this.isLoadingMore || !this.hasMoreData || !this.chartData.length) return;
        
        this.isLoadingMore = true;
        
        try {
            const oldestCandle = this.chartData[0];
            if (!oldestCandle) {
                this.isLoadingMore = false;
                return;
            }
            
            const endTime = (oldestCandle.time * 1000) - 1;
            
            const olderCandles = await DataFetcher.loadMoreKlines(
                this.currentSymbol, 
                this.currentInterval, 
                endTime
            );
            
            if (olderCandles && olderCandles.length > 0) {
                const uniqueOlder = olderCandles.filter(newCandle => 
                    !this.chartData.some(existing => existing.time === newCandle.time)
                );
                
                if (uniqueOlder.length > 0) {
                    this.chartData = [...uniqueOlder, ...this.chartData];
                    this.scheduleUpdate();
                }
                
                if (olderCandles.length < 1000) {
                    this.hasMoreData = false;
                }
            } else {
                this.hasMoreData = false;
            }
        } catch (e) {
            console.error('Ошибка загрузки истории:', e);
        } finally {
            this.isLoadingMore = false;
        }
    }
    
   async refreshCandlesInBackground(symbol, exchange, marketType, interval) {
    console.log(`🔄 Фоновое обновление свечей для ${symbol}...`);
    
    try {
        const bybitIntervalMap = {
            '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
            '1h': '60', '4h': '240', '6h': '360', '12h': '720',
            '1d': 'D', '1w': 'W', '1M': 'M'
        };
        const CACHE_VERSION = '2';
        
        let url;
        let limit = 100;
        
        if (exchange === 'binance') {
            if (marketType === 'futures') {
                url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            } else {
                url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            }
        } else {
            const bybitInterval = bybitIntervalMap[interval] || interval;
            const category = marketType === 'futures' ? 'linear' : 'spot';
            url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) return;
        
        const data = await response.json();
        
        let freshCandles = [];
        
        if (exchange === 'binance') {
            if (!Array.isArray(data)) return;
            freshCandles = data.map(item => ({
                time: Math.floor(item[0] / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        } else {
            if (data.retCode !== 0 || !data.result?.list) return;
            const candles = data.result.list;
            freshCandles = candles.map(item => ({
                time: Math.floor(parseInt(item[0]) / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5] || 0)
            })).filter(c => c !== null);
        }
        
        if (freshCandles.length === 0) return;
        
        const lastCachedTime = this.chartData.length > 0 ? this.chartData[this.chartData.length - 1].time : 0;
        const lastFreshTime = freshCandles[freshCandles.length - 1].time;
        
        if (lastFreshTime > lastCachedTime) {
            console.log(`📊 Найдены новые свечи: ${lastFreshTime} > ${lastCachedTime}`);
            const newCandles = freshCandles.filter(c => c.time > lastCachedTime);
            this.chartData.push(...newCandles);
            this._performUpdate();
            
            if (window.db && window.dbReady) {
                const key = `${symbol}_${interval}_${exchange}_${marketType}_v${CACHE_VERSION}`;
                const cached = await window.db.get('candles', key);
                
                if (cached) {
                    const updatedData = [...cached.data, ...newCandles];
                    if (updatedData.length > 1000) {
                        updatedData.splice(0, updatedData.length - 1000);
                    }
                    await window.db.put('candles', {
                        ...cached,
                        key: key,
                        data: updatedData,
                        lastUpdate: Date.now(),
                        lastCandleTime: updatedData[updatedData.length - 1].time,
                        count: updatedData.length,
                        version: CACHE_VERSION
                    });
                    console.log(`📦 Кэш обновлён: добавлено ${newCandles.length} свечей`);
                } else {
                    // Создаём новую запись, если её не было
                    const newCache = {
                        key: key,
                        symbol: symbol,
                        exchange: exchange,
                        marketType: marketType,
                        interval: interval,
                        data: freshCandles,
                        lastUpdate: Date.now(),
                        firstCandleTime: freshCandles[0].time,
                        lastCandleTime: freshCandles[freshCandles.length - 1].time,
                        count: freshCandles.length,
                        version: CACHE_VERSION
                    };
                    await window.db.put('candles', newCache);
                    console.log(`📦 Создан новый кэш: ${key}`);
                }
            }
            this.scrollToLast();
        }
    } catch (error) {
        console.warn('⚠️ Ошибка фонового обновления:', error);
    }
}
    
    setupEventListeners() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            
            resizeTimeout = setTimeout(() => {
                if (this.chart) {
                    const width = this.chartContainer.clientWidth;
                    const height = this.chartContainer.clientHeight;
                    
                    this.chart.applyOptions({ width, height });
                    
                    if (this._resizeIndicatorPanels) {
                        this._resizeIndicatorPanels();
                    }
                    
                    if (this._updateMainChartHeight) {
                        this._updateMainChartHeight();
                    }
                    
                    setTimeout(() => {
                        this.scrollToLast();
                    }, 50);
                }
                
                if (this.timerManager && this.timerManager._primitive) {
                    this.timerManager._primitive.requestRedraw();
                }
                
                this.scheduleDrawingsUpdate();
            }, 100);
        });
    }
    
setChartType(type) {
    if (!this.chart) {
        console.warn('График не инициализирован');
        return;
    }
    
    this.currentChartType = type;
    localStorage.setItem('chartType', type);
    if (type === 'candle') {
        if (this.candleSeries) this.candleSeries.applyOptions({ visible: true });
        if (this.barSeries) this.barSeries.applyOptions({ visible: false });
    } else if (type === 'bar') {
        if (this.candleSeries) this.candleSeries.applyOptions({ visible: false });
        if (this.barSeries) this.barSeries.applyOptions({ visible: true });
    }
    
    // применяем текущие цвета к барам
    if (this.barSeries) {
        const bullishColor = CONFIG.colors.bullish;
        const bearishColor = CONFIG.colors.bearish;
        this.barSeries.applyOptions({
            upColor: bullishColor,
            downColor: bearishColor
        });
    }
    
    if (this.timerManager && typeof this.timerManager.reattach === 'function') {
        this.timerManager.reattach();
    }
    
    if (this.indicatorManager && this.indicatorManager.activeIndicators) {
        console.log('🔄 Пересоздаём серии индикаторов при смене типа графика');
        this.indicatorManager.activeIndicators.forEach(indicator => {
            try {
                indicator.createSeries();
            } catch (e) {
                console.warn('Ошибка при пересоздании серии для индикатора:', indicator.type, e);
            }
        });
    }
    
    setTimeout(() => {
        if (window.rayManager) window.rayManager.syncWithNewTimeframe();
        if (window.trendLineManager) window.trendLineManager.syncWithNewTimeframe();
        if (window.rulerLineManager) window.rulerLineManager.syncWithNewTimeframe();
        if (window.alertLineManager) window.alertLineManager.syncWithNewTimeframe();
        if (window.textManager) window.textManager.syncWithNewTimeframe();
    }, 50);
    
    // Обновляем линию цены с правильным цветом
    const activeSeries = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
    if (activeSeries) {
        const lastCandle = this.chartData[this.chartData.length - 1];
        const isBullish = lastCandle ? lastCandle.close >= lastCandle.open : true;
        const lineColor = isBullish ? CONFIG.colors.bullish : CONFIG.colors.bearish;
        
        activeSeries.applyOptions({
            priceLineVisible: true,
            lastValueVisible: true,
            priceLineSource: this.currentRealPrice || 0,
            priceLineColor: lineColor,
            priceLineWidth: 1,
            priceLineStyle: LightweightCharts.LineStyle.Dashed
        });
    }
}
    scheduleUpdate() {
        if (this._updateScheduled) return;
        
        this._updateScheduled = true;
        requestAnimationFrame(() => {
            this._performUpdate();
            this._updateScheduled = false;
            this._lastUpdateTime = Date.now();
        });
    }
scheduleUpdatePosition() {
    if (this._updatePositionRafId === null) {
        this._updatePositionRafId = requestAnimationFrame(() => {
            this.updatePriceLineTimerPosition();
            this._updatePositionRafId = null;
        });
    }
}

updatePriceLineTimerPosition() {
    if (!this.lastCandle || !this.priceLineTimer) return;
    
    const price = this.currentRealPrice || this.lastCandle.close;
    const activeSeries = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
    const coordinate = activeSeries.priceToCoordinate(price);
    
    if (coordinate !== null && !isNaN(coordinate)) {
        const containerRect = this.chartContainer.getBoundingClientRect();
        let topPosition = coordinate - containerRect.top + 60;
        
        // Ограничиваем, чтобы таймер не вылезал за пределы
        const timerHeight = this.priceLineTimer.offsetHeight;
        topPosition = Math.max(5, Math.min(window.innerHeight - timerHeight - 5, topPosition));
        
        this.priceLineTimer.style.top = topPosition + 'px';
        this.priceLineTimer.style.right = '10px';
        
        // Цвет
        const isBullish = this.lastCandle ? Utils.isBullish(this.lastCandle.open, this.lastCandle.close) : true;
        this.priceLineTimer.classList.remove('bullish', 'bearish');
        this.priceLineTimer.classList.add(isBullish ? 'bullish' : 'bearish');
    }
}
_performUpdate() {
    if (!this.chartData.length) return;
    
    this.candleSeries.setData(this.chartData);
    this.barSeries.setData(this.chartData);
    
    // 👇 ДОБАВЬТЕ ОБНОВЛЕНИЕ ОБЪЁМА
    if (this.volumeSeries && this.chartData.length > 0) {
        const volumeData = this.chartData.map(candle => {
            const isBullish = candle.close >= candle.open;
            return {
                time: candle.time,
                value: candle.volume,
                color: isBullish ? this.bullishColor : this.bearishColor
            };
        });
        this.volumeSeries.setData(volumeData);
        console.log('📊 Volume обновлён при подгрузке истории:', volumeData.length, 'свечей');
    }
    
    if (this.indicatorManager) {
        this.indicatorManager.updateAllIndicators();
    }
}
  updateLastCandle(candle) {
    if (!candle || typeof candle.time !== 'number' || isNaN(candle.time) || candle.time <= 0) {
        console.warn('Пропущена свеча с некорректным временем:', candle);
        return;
    }
    
    try {
        const existingIndex = this.chartData.findIndex(c => c.time === candle.time);
        
        if (existingIndex !== -1) {
            this.chartData[existingIndex] = candle;
        } else {
            this.chartData.push(candle);
            const limit = CONFIG.klineLimits[this.currentInterval] || 1000;
            if (this.chartData.length > limit) {
                this.chartData = this.chartData.slice(-limit);
            }
        }
        
        // ЕДИНСТВЕННОЕ ОБЪЯВЛЕНИЕ activeSeries
        const activeSeries = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
        if (activeSeries) {
            activeSeries.update({
                time: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
            });
        }
        
        this.currentRealPrice = candle.close;
        if (activeSeries) {
            activeSeries.applyOptions({ priceLineSource: candle.close });
        }
        
        if (this.volumeSeries && this.chartData.length > 0) {
            const volumeData = this.chartData.map(c => {
                const isBullish = c.close >= c.open;
                return {
                    time: c.time,
                    value: c.volume,
                    color: isBullish ? this.bullishColor : this.bearishColor
                };
            });
            this.volumeSeries.setData(volumeData);
        }
        
        this.lastCandle = candle;
        
    } catch (e) {
        console.warn('Ошибка в updateLastCandle:', e);
    }
}

async waitForChartReady() {
    // Ждём, пока timeScale станет доступен и вернёт диапазон
    await new Promise(resolve => {
        const check = () => {
            const ts = this.chart?.timeScale();
            if (ts && ts.getVisibleRange()) {
                resolve();
            } else {
                requestAnimationFrame(check);
            }
        };
        check();
    });
    // Дополнительная микро-пауза для уверенности
    await new Promise(r => setTimeout(r, 50));
}
setDataQuick(data, interval, symbol, exchange = 'binance', marketType = 'futures') {
      
    console.log('🔵 setDataQuick: получено свечей', data.length);
    if (data.length > 0) {
        console.log('    Первая свеча:', data[0]);
        console.log('    Последняя свеча:', data[data.length-1]);
        
        // ========== ОЧИЩАЕМ СТАРЫЕ ДАННЫЕ ПЕРЕД ЗАГРУЗКОЙ НОВЫХ ==========
        if (this.candleSeries) this.candleSeries.setData([]);
        if (this.barSeries) this.barSeries.setData([]);
        if (this.volumeSeries) this.volumeSeries.setData([]);
        // =================================================================
        
        // ========== ВЫРАВНИВАНИЕ ВРЕМЕНИ ПО НАЧАЛУ ИНТЕРВАЛА ==========
        const intervalMapSeconds = {
            '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
            '1h': 3600, '4h': 14400, '6h': 21600, '12h': 43200,
            '1d': 86400, '1w': 604800, '1M': 2592000
        };
        const step = intervalMapSeconds[interval] || 3600;
        data = data.map(c => ({
            ...c,
            time: Math.floor(Math.floor(c.time * 1000) / (step * 1000)) * step
        }));
        // =================================================================
        
        this.chartData = data;
        this.currentInterval = interval;
        this.currentSymbol = symbol;
        this.currentExchange = exchange;
        this.currentMarketType = marketType;
        this.hasMoreData = true;
        this.lastCandle = data[data.length - 1];
        
        this._performUpdate();
        
        // ========== ОБНОВЛЯЕМ ОБЪЁМ ==========
        if (this.volumeSeries && this.chartData.length > 0) {
            const volumeData = this.chartData.map(candle => {
                const isBullish = candle.close >= candle.open;
                return {
                    time: candle.time,
                    value: candle.volume,
                    color: isBullish ? this.bullishColor : this.bearishColor
                };
            });
            this.volumeSeries.setData(volumeData);
            console.log('✅ Volume обновлён:', volumeData.length, 'свечей');
        }
        
        if (this.indicatorManager) {
            console.log('📊 setDataQuick: данные загружены, восстанавливаем индикаторы');
            this.indicatorManager.restorePendingIndicators();
            this.indicatorManager.updateAllIndicators();
            this.indicatorManager.loadIndicators();
        }
        
        this.loadDrawingsForCurrentSymbol();
        setTimeout(() => {
            this.autoScale();
        }, 100);
        
        setTimeout(() => {
            if (window.renderDrawings) window.renderDrawings();
        }, 100);
        
        this._notifySymbolChange();
        
        setTimeout(() => {
            this._updateMainChartHeight();
        }, 150);
        
    } else {
        console.warn('setDataQuick: нет данных');
    }
    this._lastTimeframe = interval;

if (!window._dailySeparator) {
    window._dailySeparator = new DailySeparator(this);
} else {
    window._dailySeparator.redraw();
}

}
async loadDrawingsForCurrentSymbol() {
    // Небольшая задержка, чтобы серия точно была готова
    await new Promise(resolve => setTimeout(resolve, 100));

    const key = `${this.currentSymbol}:${this.currentExchange}:${this.currentMarketType}`;
    console.log('🎨 Загрузка рисунков для:', key);

    // Загружаем все рисунки параллельно
    await Promise.all([
        window.rayManager?.loadRays(),
        window.trendLineManager?.loadTrendLines(),
        window.rulerLineManager?.loadRulers(),
        window.alertLineManager?.loadAlerts(),
        window.textManager?.loadTexts()
    ].filter(Boolean));
}
updateCurrentCandle(price) {
    if (!this.chartData || this.chartData.length === 0) return;
    const lastCandle = this.chartData[this.chartData.length - 1];
    if (!lastCandle) return;
    lastCandle.close = price;
    if (price > lastCandle.high) lastCandle.high = price;
    if (price < lastCandle.low) lastCandle.low = price;
    const activeSeries = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
    if (activeSeries) {
        activeSeries.update({ time: lastCandle.time, open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: price });
    }
    this.lastCandle = lastCandle;
    this.currentRealPrice = price;
    if (activeSeries) {
        activeSeries.applyOptions({ priceLineSource: price });
    }
    if (this.scheduleUpdatePosition) {
        this.scheduleUpdatePosition();
    }
}
   onCrosshairMove(param) {
    if (!this.overlay) {
        this.overlay = safeElement('candleStatsOverlay');
    }
    
    if (!param || !param.time || !this.chartData || this.chartData.length === 0) {
        if (this.overlay) this.overlay.classList.remove('visible');
        return;
    }

    const candle = this.chartData.find(c => c.time === param.time);
    
    if (candle) {
        const isBullish = Utils.isBullish(candle.open, candle.close);
        const bullishClass = isBullish ? 'bullish' : 'bearish';
        
        if (this.openEl) {
            this.openEl.textContent = Utils.formatPrice(candle.open);
            this.openEl.className = `stat-value ${bullishClass}`;
        }
        
        if (this.highEl) {
            this.highEl.textContent = Utils.formatPrice(candle.high);
            this.highEl.className = `stat-value ${bullishClass}`;
        }
        
        if (this.lowEl) {
            this.lowEl.textContent = Utils.formatPrice(candle.low);
            this.lowEl.className = `stat-value ${bullishClass}`;
        }
        
        if (this.closeEl) {
            this.closeEl.textContent = Utils.formatPrice(candle.close);
            this.closeEl.className = `stat-value ${bullishClass}`;
        }
        
        if (this.changeEl) {
            const change = Utils.calculateChange(candle.open, candle.close);
            const changeNum = parseFloat(change);
            this.changeEl.textContent = (changeNum > 0 ? '+' : '') + change + '%';
            this.changeEl.className = `change-value ${bullishClass}`;
        }
        
        // ========== ДОБАВЛЕННЫЙ БЛОК ДЛЯ ОБЪЁМА ==========
        const volumeEl = document.getElementById('volumeValue');
        if (volumeEl) {
            // Используем функцию форматирования объёма
            volumeEl.textContent = Utils.formatVolume(candle.volume);
            volumeEl.className = `stat-value ${bullishClass}`;
        }
        // ===================================================
        
        if (this.overlay) {
            this.overlay.classList.add('visible');
        }
    } else {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
        }
    }
}
 updateRealPrice(price) {
    this.currentRealPrice = price;
    const series = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
    if (series) {
        const lastCandle = this.chartData[this.chartData.length - 1];
        const isBullish = lastCandle ? lastCandle.close >= lastCandle.open : true;
        const lineColor = isBullish ? CONFIG.colors.bullish : CONFIG.colors.bearish;
        
        series.applyOptions({ 
            priceLineSource: price,
            priceLineColor: lineColor
        });
    }
    this.scheduleUpdatePosition();
}
    scrollToLast() {
        if (this.chart && this.chartData.length > 0) {
            const timeScale = this.chart.timeScale();
            const currentRange = timeScale.getVisibleLogicalRange();
            
            if (currentRange) {
                const visibleBarsCount = currentRange.to - currentRange.from;
                const newFrom = Math.max(0, this.chartData.length - visibleBarsCount + 55);
                
                timeScale.setVisibleLogicalRange({
                    from: newFrom,
                    to: newFrom + visibleBarsCount
                });
            } else {
                timeScale.scrollToRealTime();
                
                setTimeout(() => {
                    const newRange = timeScale.getVisibleLogicalRange();
                    if (newRange) {
                        const visibleBars = newRange.to - newRange.from;
                        timeScale.setVisibleLogicalRange({
                            from: this.chartData.length - visibleBars + 35,
                            to: this.chartData.length + 35
                        });
                    }
                }, 50);
            }
        }
    }
    clearChart() {
    if (this.candleSeries) {
        this.candleSeries.setData([]);
    }
    if (this.barSeries) {
        this.barSeries.setData([]);
    }
    if (this.volumeSeries) {
        this.volumeSeries.setData([]);
    }
    
    this.chartData = [];
    this.lastCandle = null;
    
    const priceScale = this.chart.priceScale('right');
    if (priceScale) {
        priceScale.applyOptions({ autoScale: true });
    }
}
    autoScale() {
        
        if (this.chart && this.chartData.length > 0) {
            const timeScale = this.chart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();
            
            if (visibleRange) {
                const fromIndex = Math.max(0, Math.floor(visibleRange.from));
                const toIndex = Math.min(this.chartData.length - 1, Math.ceil(visibleRange.to));
                
                if (fromIndex < toIndex && fromIndex >= 0 && toIndex < this.chartData.length) {
                    let minPrice = Infinity, maxPrice = -Infinity;
                    
                    for (let i = fromIndex; i <= toIndex; i++) {
                        minPrice = Math.min(minPrice, this.chartData[i].low);
                        maxPrice = Math.max(maxPrice, this.chartData[i].high);
                    }
                    
                    const padding = (maxPrice - minPrice) * 0.05;
                    
                    const priceScale = this.chart.priceScale('right');
                    if (priceScale) {
                        priceScale.applyOptions({
                            autoScale: true,
                        });
                        
                        setTimeout(() => {
                            priceScale.applyOptions({
                                autoScale: true,
                            });
                        }, 10);
                    }
                    
                    setTimeout(() => {
                        if (this.timerManager && this.timerManager._primitive) {
                            this.timerManager._primitive.requestRedraw();
                        }
                    }, 50);
                }
            } else {
                const priceScale = this.chart.priceScale('right');
                if (priceScale) {
                    priceScale.applyOptions({
                        autoScale: true,
                    });
                }
            }
        }
    }

    getLastCandle() {
        return this.lastCandle;
    }
    
    getChart() {
        return this.chart;
    }
    
    setCurrentInterval(interval) {
        this.currentInterval = interval;
    }
    
_updateMainChartHeight() {
    if (!this.chart) return;
    
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;
    
    const panelsContainer = document.getElementById('indicator-panels-container');
    let panelsHeight = 0;
    
    if (panelsContainer) {
        const panels = panelsContainer.querySelectorAll('.indicator-panel-wrapper:not(.collapsed)');
        panels.forEach(panel => {
            panelsHeight += panel.offsetHeight;
        });
    }
    
    // Получаем доступную высоту (минус верхняя панель 48px)
    const availableHeight = window.innerHeight - 48;
    
    // Высота графика = доступная высота - высота панелей
    let newChartHeight = availableHeight - panelsHeight;
    
    if (newChartHeight < 200) newChartHeight = 200;
    
    this.chart.applyOptions({ height: newChartHeight });
    
    // Обновляем шкалу объёма
    const volumeScale = this.chart.priceScale('volume');
    if (volumeScale) {
        volumeScale.applyOptions({
            scaleMargins: { top: 0.7, bottom: 0 }
        });
    }
    
    console.log('📏 Высота графика:', newChartHeight, 'Панели:', panelsHeight);
}
 _resizeIndicatorPanels() {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) return;
    
    const width = chartContainer.clientWidth;
    
    // 👇 ИСПРАВЛЕНО: panelManager находится внутри indicatorManager
    if (this.indicatorManager && this.indicatorManager.panelManager) {
        this.indicatorManager.panelManager.resize(width);
        this._updateMainChartHeight();
    }
}


    addIndicator(type) {
    return this.indicatorManager.addIndicator(type);
    // В конце метода addIndicator, перед return true
setTimeout(() => {
    this.chartManager._updateMainChartHeight();
}, 50);
}

removeIndicatorByType(type) {
    return this.indicatorManager.removeIndicator(type);
}

clearAllIndicators() {
    this.indicatorManager.clearAllIndicators();
}

updateAllIndicators() {
    this.indicatorManager.updateAllIndicators();
}

restoreIndicators() {
    this.indicatorManager.loadIndicators();
}
_subscribeToPrice() {
    if (this._priceUpdateHandler) {
        this.priceManager.unsubscribe(this.currentSymbol, this._priceUpdateHandler);
    }
    
    this._priceUpdateHandler = (price, symbol) => {
        if (symbol === this.currentSymbol) {
            this.currentRealPrice = price;
            const series = this.currentChartType === 'candle' ? this.candleSeries : this.barSeries;
            if (series) {
                const lastCandle = this.chartData[this.chartData.length - 1];
                const isBullish = lastCandle ? lastCandle.close >= lastCandle.open : true;
                const lineColor = isBullish ? CONFIG.colors.bullish : CONFIG.colors.bearish;
                
                series.applyOptions({ 
                    priceLineSource: price,
                    priceLineColor: lineColor
                });
            }
            this.scheduleUpdatePosition();
        }
    };
    
    this.priceManager.subscribe(this.currentSymbol, this._priceUpdateHandler);
    
    const cachedPrice = this.priceManager.getPrice(this.currentSymbol);
    if (cachedPrice !== null) {
        this.currentRealPrice = cachedPrice;
    }
}
    
    setSymbol(symbol) {
        if (this.currentSymbol === symbol) return;
        this.currentSymbol = symbol;
        this._subscribeToPrice();
    }
    // ДОБАВЬ ЭТОТ МЕТОД В ChartManager
applyPriceFormat(precision) {
    const minMove = Math.pow(10, -precision);
    const priceFormat = { type: 'price', precision: precision, minMove: minMove };
    
    if (this.candleSeries) {
        this.candleSeries.applyOptions({ priceFormat: priceFormat });
    }
    if (this.barSeries) {
        this.barSeries.applyOptions({ priceFormat: priceFormat });
    }
    
    console.log(`✅ Применён формат цены: ${precision} знаков`);
}
}
if (typeof window !== 'undefined') {
    window.ChartManager = ChartManager;
}
