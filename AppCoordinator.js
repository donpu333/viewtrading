class AppCoordinator {
    constructor() {
        this.chartManager = null;
        this.tickerPanel = null;
        this.wsManager = null;
        this.timerManager = null;
        this.tfManager = null;
        
        // Флаг для блокировки повторных загрузок
        this._isLoading = false;
        this._pendingSymbol = null;
        
        // Кэш загруженных данных
        this.symbolCache = new Map();
        // Запрос разрешения на уведомления при запуске
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}
        // Инициализация
        this.init();
    }
    
async init() {
    console.log('🚀 Запуск приложения...');

    // 1. Создаём график
    this.chartManager = new ChartManager(document.getElementById('chart-container'));
    window.chartManagerInstance = this.chartManager;

    await this._waitForChart();

  this.wsManager = new window.WebSocketManager(this.chartManager);
window.wsManager = this.wsManager;
    this.timerManager = new TimerManager(this.chartManager);
    this.tfManager = new TimeframeManager(this.chartManager, this.wsManager, this.timerManager);

    // 2. Тикер-панель создаём, но НЕ инициализируем
    if (window.TickerPanel) {
        this.tickerPanel = new window.TickerPanel(this);
        window.tickerPanel = this.tickerPanel;
    } else {
        console.error('❌ window.TickerPanel не найден!');
        this.tickerPanel = { init: () => Promise.resolve(), cleanup: () => {} };
    }

    await this._waitForSavedSymbol();
    this._updateHeaderFromSavedSymbol();

    // 3. Грузим данные графика – это самое важное
    await this.loadInitialData();
    this.initDrawingTools();

    // 4. Только после того, как график полностью готов, запускаем тикер-панель
    setTimeout(() => {
        if (this.tickerPanel?.init) {
            this.tickerPanel.init().catch(e => console.warn('TickerPanel error:', e));
        }
    }, 300); 
    console.log('✅ Приложение готово (график активен)');
}
    _waitForChart() {
    return new Promise(resolve => {
        const check = () => {
            if (this.chartManager && this.chartManager.chart) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}
async loadInitialData() {
    // 👇 БЕРЁМ СИМВОЛ ИЗ CHARTMANAGER (уже загружен из IndexedDB)
    const defaultSymbol = this.chartManager.currentSymbol || 'BTCUSDT';
    const defaultExchange = this.chartManager.currentExchange || 'binance';
    const defaultMarketType = this.chartManager.currentMarketType || 'futures';
    const defaultInterval = localStorage.getItem('lastTimeframe') || '1h';
    console.log('📊 Загружаем с таймфреймом:', defaultInterval);
    
    console.log('📊 Загружаю данные для:', defaultSymbol, defaultExchange, defaultMarketType);
    
    const data = await this.chartManager.fetchKlines(defaultSymbol, defaultExchange, defaultMarketType, defaultInterval, 1000);
    if (data && data.length > 0) {
        this.chartManager.setDataQuick(
            data,
            defaultInterval,
            defaultSymbol,
            defaultExchange,
            defaultMarketType
        );
        
        // 👇 ИСПРАВЛЕНО: одна строка вместо двух
        if (this.wsManager) {
            this.wsManager.updateSymbolAndTimeframe(defaultSymbol, defaultInterval, defaultExchange);
        }
        
        // 👇 СРАЗУ обновляем шапку ПРАВИЛЬНЫМ символом
        document.getElementById('pairDisplay').textContent = defaultSymbol;
        document.getElementById('exchangeDisplay').textContent =
            defaultExchange === 'binance' ? 'Binance' : 'Bybit';
        document.getElementById('contractTypeDisplay').textContent =
            defaultMarketType === 'futures' ? 'PERP' : 'SPOT';
    }
}
_updateHeaderFromSavedSymbol() {
    const symbol = this.chartManager.currentSymbol || 'BTCUSDT';
    const exchange = this.chartManager.currentExchange || 'binance';
    const marketType = this.chartManager.currentMarketType || 'futures';
    
    // СРАЗУ обновляем заголовок чтобы не было мелькания
  // ✅ ИСПРАВЛЕНО: используем symbol, exchange, marketType
const pairDisplay = document.getElementById('pairDisplay');
if (pairDisplay) pairDisplay.textContent = symbol;

const exchangeDisplay = document.getElementById('exchangeDisplay');
if (exchangeDisplay) exchangeDisplay.textContent =
    exchange === 'binance' ? 'Binance' : 'Bybit';

const contractTypeDisplay = document.getElementById('contractTypeDisplay');
if (contractTypeDisplay) contractTypeDisplay.textContent =
    marketType === 'futures' ? 'PERP' : 'SPOT';
    
    if (pairDisplay) pairDisplay.textContent = symbol;
    if (exchangeDisplay) exchangeDisplay.textContent = exchange === 'binance' ? 'Binance' : 'Bybit';
    if (contractTypeDisplay) contractTypeDisplay.textContent = marketType === 'futures' ? 'PERP' : 'SPOT';
    
    console.log('📊 Заголовок обновлён:', symbol);
}
// 👇 НОВЫЙ МЕТОД: Ждём загрузки сохранённого символа
async _waitForSavedSymbol() {
    return new Promise(async (resolve) => {
        try {
            const saved = await window.db.get('settings', 'currentSymbol');
            if (saved && saved.value && saved.value.symbol) {
                this.chartManager.currentSymbol = saved.value.symbol;
                this.chartManager.currentExchange = saved.value.exchange || 'binance';
                this.chartManager.currentMarketType = saved.value.marketType || 'futures';
                
                // 👇 НОВОЕ: СРАЗУ обновляем заголовок
                this._updateHeaderFromSavedSymbol();
                
                console.log('✅ Используется сохранённый символ:', saved.value.symbol);
            }
        } catch (e) {
            console.warn('Не удалось загрузить сохранённый символ');
        }
        resolve();
    });
}
async initDrawingTools() {  // ← ТОЛЬКО ДОБАВИТЬ async
    // Лучи
    const rayManager = new HorizontalRayManager(this.chartManager);
    window.rayManager = rayManager;
    
    // Трендовые линии
    const trendLineManager = new TrendLineManager(this.chartManager);
    window.trendLineManager = trendLineManager;
    
    // Линейки
    const rulerLineManager = new RulerLineManager(this.chartManager);
    window.rulerLineManager = rulerLineManager;
    
    // Алерты
    const alertLineManager = new AlertLineManager(this.chartManager);
    window.alertLineManager = alertLineManager;
    
    // Текст
    const textManager = new TextManager(this.chartManager);
    window.textManager = textManager;
    
    // ЗАГРУЖАЕМ РИСУНКИ МГНОВЕННО
    await rayManager.loadRays();  // ← ТОЛЬКО ДОБАВИТЬ await
    await  trendLineManager.loadTrendLines();
     await   rulerLineManager.loadRulers();
    await alertLineManager.loadAlerts();
    await textManager.loadTexts();
    
    // КОРОТКАЯ ЗАДЕРЖКА ДЛЯ СИНХРОНИЗАЦИИ (200 мс достаточно)
    setTimeout(() => {
        rayManager.syncWithNewTimeframe();
        trendLineManager.syncWithNewTimeframe();
        rulerLineManager.syncWithNewTimeframe();
        alertLineManager.syncWithNewTimeframe();
        textManager.syncWithNewTimeframe();
    }, 200);
    
    // Настраиваем кнопки инструментов (этот метод уже есть ниже)
    this.setupToolButtons();
}
    
    setupToolButtons() {
        // Горизонтальный луч
        const rayBtn = document.getElementById('toolHorizontalRay');
        if (rayBtn) {
            rayBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Отключаем другие режимы
                if (window.trendLineManager) window.trendLineManager.setDrawingMode(false);
                if (window.alertLineManager) window.alertLineManager.setDrawingMode(false);
                if (window.rulerLineManager) window.rulerLineManager.setDrawingMode(false);
                if (window.textManager) window.textManager.setDrawingMode(false);
                
                const newMode = !window.rayManager._isDrawingMode;
                window.rayManager.setDrawingMode(newMode);
            };
        }
        
        // Трендовая линия
        const trendBtn = document.getElementById('toolTrendLine');
        if (trendBtn) {
            trendBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (window.rayManager) window.rayManager.setDrawingMode(false);
                if (window.alertLineManager) window.alertLineManager.setDrawingMode(false);
                if (window.rulerLineManager) window.rulerLineManager.setDrawingMode(false);
                if (window.textManager) window.textManager.setDrawingMode(false);
                
                const newMode = !window.trendLineManager._isDrawingMode;
                window.trendLineManager.setDrawingMode(newMode);
            };
        }
        
        // Алерт
        const alertBtn = document.getElementById('toolAlert');
        if (alertBtn) {
            alertBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (window.rayManager) window.rayManager.setDrawingMode(false);
                if (window.trendLineManager) window.trendLineManager.setDrawingMode(false);
                if (window.rulerLineManager) window.rulerLineManager.setDrawingMode(false);
                if (window.textManager) window.textManager.setDrawingMode(false);
                
                const newMode = !window.alertLineManager._isDrawingMode;
                window.alertLineManager.setDrawingMode(newMode);
            };
        }
        
        // Линейка
        const rulerBtn = document.getElementById('toolRuler');
        if (rulerBtn) {
            rulerBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (window.rayManager) window.rayManager.setDrawingMode(false);
                if (window.trendLineManager) window.trendLineManager.setDrawingMode(false);
                if (window.alertLineManager) window.alertLineManager.setDrawingMode(false);
                if (window.textManager) window.textManager.setDrawingMode(false);
                
                const newMode = !window.rulerLineManager._isDrawingMode;
                window.rulerLineManager.setDrawingMode(newMode);
            };
        }
        
        // Текст
        const textBtn = document.getElementById('toolText');
        if (textBtn) {
            textBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (window.rayManager) window.rayManager.setDrawingMode(false);
                if (window.trendLineManager) window.trendLineManager.setDrawingMode(false);
                if (window.alertLineManager) window.alertLineManager.setDrawingMode(false);
                if (window.rulerLineManager) window.rulerLineManager.setDrawingMode(false);
                
                const newMode = !window.textManager._isDrawingMode;
                window.textManager.setDrawingMode(newMode);
            };
        }
        
        // Магнит
      const magnetBtn = document.getElementById('toolMagnet');
if (magnetBtn) {
    magnetBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = magnetBtn.classList.contains('magnet-active');
        const newState = !isActive;
        
        // ✅ ТОЛЬКО ДЛЯ ЛУЧЕЙ И ТРЕНДОВЫХ ЛИНИЙ
        if (window.rayManager) window.rayManager.setMagnetEnabled(newState);
        if (window.trendLineManager) window.trendLineManager.setMagnetEnabled(newState);
        
        magnetBtn.classList.toggle('magnet-active', newState);
    };
    
    // Включаем по умолчанию
    magnetBtn.classList.add('magnet-active');
    if (window.rayManager) window.rayManager.setMagnetEnabled(true);
    if (window.trendLineManager) window.trendLineManager.setMagnetEnabled(true);
}

// Удалить всё
const trashBtn = document.getElementById('toolTrash');
if (trashBtn) {
    trashBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (window.rayManager) window.rayManager.deleteAllRays();
        if (window.trendLineManager) window.trendLineManager.deleteAllTrendLines();
        if (window.rulerLineManager) window.rulerLineManager.deleteAllRulers();
        if (window.alertLineManager) window.alertLineManager.deleteAllAlerts();
        if (window.textManager) window.textManager.deleteAllTexts();
        
        if (window.alertLineManager) window.alertLineManager._updateAlertsListUI();
    };
}
  }  
    
// Главный метод для загрузки символа
async loadSymbol(symbol, exchange, marketType, externalSignal = null) {
    
    console.log(`📊 Загрузка символа: ${symbol} (${exchange} ${marketType})`);
    if (this.chartManager) {
        this.chartManager.clearChart();
    }
    // ✅ ОТМЕНЯЕМ ПРЕДЫДУЩИЙ ЗАПРОС
    if (this._currentRequest && this._currentRequest.abort) {
        this._currentRequest.abort();
        console.log('🛑 Предыдущий запрос отменён');
    }
    
    // ✅ СОЗДАЁМ НОВЫЙ КОНТРОЛЛЕР
    const abortController = new AbortController();
    const finalSignal = externalSignal || abortController.signal;
    this._currentRequest = abortController;
    
    // Блокируем повторные загрузки
    if (this._isLoading) {
        this._pendingSymbol = { symbol, exchange, marketType };
        console.log('Загрузка уже идёт, ставим в очередь');
        return;
    }
    
    this._isLoading = true;
    
    try {
        // 👇 1. ОБНОВЛЯЕМ СИМВОЛ В CHARTMANAGER (подписка на цену)
        this.chartManager.setSymbol(symbol);
        
        // 👇 2. ОБНОВЛЯЕМ СИМВОЛ В WEBSOCKETMANAGER (для свечей)
 if (this.wsManager) {
    this.wsManager.updateSymbolAndTimeframe(symbol, this.chartManager.currentInterval, exchange, marketType);
}
        
        // Проверяем кэш
        const cacheKey = `${symbol}_${exchange}_${marketType}_${this.chartManager.currentInterval}`;
        const cached = this.symbolCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) { // 5 минут
            console.log('📦 Загружаем из кэша:', cached.data.length, 'свечей');
            
            // ✅ ПРОВЕРКА ОТМЕНЫ
            if (finalSignal.aborted) {
                console.log('⏸️ Запрос отменён, кэш игнорируется');
                return;
            }
            
            this.chartManager.setDataQuick(cached.data, this.chartManager.currentInterval, symbol, exchange, marketType);
            this.chartManager.updatePricePrecision(symbol, exchange, marketType);
            
            this.chartManager.currentSymbol = symbol;
            this.chartManager.currentExchange = exchange;
            this.chartManager.currentMarketType = marketType;
            
            document.getElementById('pairDisplay').textContent = symbol;
            document.getElementById('exchangeDisplay').textContent = exchange === 'binance' ? 'Binance' : 'Bybit';
            document.getElementById('contractTypeDisplay').textContent = marketType === 'futures' ? 'PERP' : 'SPOT';
            
            // ✅ ИСПРАВЛЕНО: добавлен async/await
            requestAnimationFrame(async () => {
                if (this.chartManager && this.chartManager.chart) {
                  
                }
                await this.syncAllDrawings();
                
            });
            
            this._isLoading = false;
            
            if (this._pendingSymbol) {
                const pending = this._pendingSymbol;
                this._pendingSymbol = null;
                setTimeout(() => this.loadSymbol(pending.symbol, pending.exchange, pending.marketType), 100);
            }
            
            return;
        }
        
        // ✅ ПРОВЕРКА ОТМЕНЫ ПЕРЕД ЗАПРОСОМ
        if (finalSignal.aborted) {
            console.log('⏸️ Запрос отменён перед загрузкой');
            return;
        }
        
        // ✅ ПЕРЕДАЁМ signal В _fetchSymbolData
        const data = await this._fetchSymbolData(symbol, exchange, marketType, finalSignal);
        
        // ✅ ПРОВЕРКА ОТМЕНЫ ПОСЛЕ ПОЛУЧЕНИЯ ДАННЫХ
        if (finalSignal.aborted) {
            console.log('⏸️ Запрос отменён, данные игнорируются');
            return;
        }
        
        if (data && data.length > 0) {
            this.symbolCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            if (this.symbolCache.size > 50) {
                const oldestKey = this.symbolCache.keys().next().value;
                this.symbolCache.delete(oldestKey);
            }
            
            this.chartManager.setDataQuick(data, this.chartManager.currentInterval, symbol, exchange, marketType);
            this.chartManager.updatePricePrecision(symbol, exchange, marketType);
            
            this.chartManager.currentSymbol = symbol;
            this.chartManager.currentExchange = exchange;
            this.chartManager.currentMarketType = marketType;
            
            document.getElementById('pairDisplay').textContent = symbol;
            document.getElementById('exchangeDisplay').textContent = exchange === 'binance' ? 'Binance' : 'Bybit';
            document.getElementById('contractTypeDisplay').textContent = marketType === 'futures' ? 'PERP' : 'SPOT';
            
            // ✅ ИСПРАВЛЕНО: добавлен async/await
            requestAnimationFrame(async () => {
                this.chartManager.autoScale();
                await this.syncAllDrawings();
               
            });
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⏸️ Запрос отменён (быстрое переключение)');
        } else {
            console.error('❌ Ошибка загрузки символа:', error);
            
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
        }
        
    } finally {
        this._isLoading = false;
        
        if (this._pendingSymbol) {
            const pending = this._pendingSymbol;
            this._pendingSymbol = null;
            setTimeout(() => this.loadSymbol(pending.symbol, pending.exchange, pending.marketType), 100);
        }
    }
}
   async _fetchSymbolData(symbol, exchange, marketType, externalSignal = null) {
    const interval = this.chartManager.currentInterval;
    
    // Маппинг интервалов для Bybit
    const bybitIntervalMap = {
        '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', '6h': '360', '12h': '720',
        '1d': 'D', '1w': 'W', '1M': 'M'
    };
    
    let url;
    if (exchange === 'binance') {
        if (marketType === 'futures') {
            url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
        } else {
            url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
        }
    } else {
        const bybitInterval = bybitIntervalMap[interval] || interval;
        const category = marketType === 'futures' ? 'linear' : 'spot';
        url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bybitInterval}&limit=200`;
    }
    
    console.log('URL загрузки:', url);
    
    // ✅ СОЗДАЁМ ВНУТРЕННИЙ КОНТРОЛЛЕР
    const internalController = new AbortController();
    const timeoutId = setTimeout(() => internalController.abort(), 10000);
    
    // ✅ ОБЪЕДИНЯЕМ ВНЕШНИЙ И ВНУТРЕННИЙ СИГНАЛЫ
    const combinedSignal = (() => {
        if (!externalSignal) return internalController.signal;
        
        const combinedController = new AbortController();
        
        const onAbort = () => {
            combinedController.abort();
            externalSignal.removeEventListener('abort', onAbort);
            internalController.abort();
        };
        
        externalSignal.addEventListener('abort', onAbort);
        
        internalController.signal.addEventListener('abort', () => {
            combinedController.abort();
            externalSignal.removeEventListener('abort', onAbort);
        });
        
        return combinedController.signal;
    })();
    
    try {
        const response = await fetch(url, { signal: combinedSignal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // ✅ ПРОВЕРКА ОТМЕНЫ
        if (combinedSignal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        
        if (exchange === 'binance') {
            if (!Array.isArray(data)) {
                throw new Error('Binance: неверный формат ответа');
            }
            
            return data.map(item => ({
                time: Math.floor(item[0] / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
            
        } else {
            if (data.retCode !== 0) {
                throw new Error(`Bybit error: ${data.retMsg}`);
            }
            
            if (!data.result || !data.result.list) {
                throw new Error('Bybit: нет данных');
            }
            
            const candles = data.result.list;
            
            const formatted = candles.map(item => ({
                time: Math.floor(parseInt(item[0]) / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5] || 0)
            })).filter(c => c !== null);
            
            return formatted.reverse();
        }
        
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
async syncAllDrawings() {
    // Ждём готовности графика
    await this.chartManager.waitForChartReady?.();
    
    // Загружаем рисунки для текущего символа
    if (window.rayManager) await window.rayManager.loadRays();
    if (window.trendLineManager) await window.trendLineManager.loadTrendLines();
    if (window.rulerLineManager) await window.rulerLineManager.loadRulers();
    if (window.alertLineManager) await window.alertLineManager.loadAlerts();
    if (window.textManager) await window.textManager.loadTexts();
} 
}
if (typeof window !== 'undefined') {
    window.AppCoordinator = AppCoordinator;
}