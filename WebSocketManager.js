class WebSocketManager {
    constructor(chartManager) {
        this.chartManager = chartManager;
        
        // Только для свечей
        this.wsKline = null;
        this.klineReconnectTimer = null;
        this.updateQueue = [];
        this.rafId = null;
        
        this.currentSymbol = CONFIG.defaultSymbol;
      this.currentInterval = localStorage.getItem('lastTimeframe') || CONFIG.defaultInterval;
console.log('📊 WebSocketManager: таймфрейм =', this.currentInterval);
        this.wsKlineBybit = null;
        this.bybitKlineReconnectTimer = null;
        this.currentExchange = 'binance';
        
    }
    
    connectKline(symbol, interval) {
        // ✅ Если уже есть открытое соединение с нужными параметрами — не создаем новое
        if (this.wsKline && 
            this.wsKline.readyState === WebSocket.OPEN && 
            this.currentSymbol === symbol && 
            this.currentInterval === interval) {
            console.log('⏭️ Уже подключен к', symbol, interval);
            return;
        }
        
        // Закрываем старый
        if (this.wsKline) {
            try {
                this.wsKline.onclose = null; // Отключаем обработчик
                this.wsKline.close();
            } catch(e) {}
            this.wsKline = null;
        }
        
        if (this.klineReconnectTimer) clearTimeout(this.klineReconnectTimer);
        
        this.updateQueue = [];
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        this.currentSymbol = symbol;
        this.currentInterval = interval;
        
        try {
            this.wsKline = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`);
            
            this.wsKline.onopen = () => {
                console.log('✅ Свечи подключены к', symbol, interval);
            };
            
            this.wsKline.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const k = data.k;
                
                // ✅ СТАЛО:
const newK = {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    
volume: parseFloat(k.v)
};
                
                this.updateQueue.push(newK);
                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(() => this.processUpdates());
                }
            };
            
            this.wsKline.onclose = (event) => {
                console.log('❌ Свечи закрыты для', symbol, interval);
                // ✅ Переподключаемся только если это ВСЕ ЕЩЕ текущий символ и интервал
                if (this.currentSymbol === symbol && this.currentInterval === interval) {
                    this.klineReconnectTimer = setTimeout(() => {
                        this.connectKline(symbol, interval);
                    }, 3000);
                }
            };
            
            this.wsKline.onerror = (error) => {
                console.error('Ошибка свечей:', error);
            };
            
        } catch(e) {
            console.error('Ошибка создания WebSocket:', e);
        }
    }
    
   connectBybitKline(symbol, interval) {
    // Закрываем старый
    if (this.wsKlineBybit) {
        this.wsKlineBybit.onclose = null;
        this.wsKlineBybit.close();
        this.wsKlineBybit = null;
    }
    
    if (this.bybitKlineReconnectTimer) clearTimeout(this.bybitKlineReconnectTimer);
    
    // Маппинг интервалов Bybit
    const intervalMap = {
        '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', '6h': '360', '12h': '720',
        '1d': 'D', '1w': 'W', '1M': 'M'
    };
    const bybitInterval = intervalMap[interval] || interval;
    const stream = `kline.${bybitInterval}.${symbol}`;
    
    try {
        this.wsKlineBybit = new WebSocket('wss://stream.bybit.com/v5/public/spot');
        
        this.wsKlineBybit.onopen = () => {
            console.log(`✅ Bybit WebSocket свечей открыт для ${symbol} ${interval}`);
            this.wsKlineBybit.send(JSON.stringify({
                op: "subscribe",
                args: [stream]
            }));
        };
        
        this.wsKlineBybit.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.op === 'subscribe') return;
            
            if (data.topic && data.topic.startsWith('kline.')) {
                const kline = data.data;
                if (!kline) return;
                
                // Обрабатываем как массив (Bybit присылает массив свечей)
                let klineData;
                if (Array.isArray(kline)) {
                    klineData = kline[0];
                } else {
                    klineData = kline;
                }
                
                if (!klineData) return;
                
                // Проверяем корректность времени
                const timestamp = Number(klineData.start);
                if (isNaN(timestamp)) {
                    console.warn('Bybit: некорректное время, пропускаем свечу');
                    return;
                }
                const timeSeconds = Math.floor(timestamp / 1000);
                
                const candle = {
                    time: timeSeconds,
                    open: parseFloat(klineData.open),
                    high: parseFloat(klineData.high),
                    low: parseFloat(klineData.low),
                    close: parseFloat(klineData.close),
                    volume: parseFloat(klineData.volume)
                };
                
                this.updateQueue.push(candle);
                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(() => this.processUpdates());
                }
            }
        };
        
        this.wsKlineBybit.onclose = () => {
            console.log('❌ Bybit WebSocket свечей закрыт');
            if (this.currentExchange === 'bybit') {
                this.bybitKlineReconnectTimer = setTimeout(() => {
                    this.connectBybitKline(this.currentSymbol, this.currentInterval);
                }, 3000);
            }
        };
        
        this.wsKlineBybit.onerror = (error) => {
            console.error('Bybit WebSocket свечей ошибка:', error);
        };
        
    } catch(e) {
        console.error('Ошибка создания Bybit WebSocket:', e);
    }
}
    processUpdates() {
        if (this.updateQueue.length === 0) {
            this.rafId = null;
            return;
        }
        
        const uniqueUpdates = [];
        const seen = new Set();
        
        for (let i = this.updateQueue.length - 1; i >= 0; i--) {
            const candle = this.updateQueue[i];
            if (!seen.has(candle.time)) {
                seen.add(candle.time);
                uniqueUpdates.unshift(candle);
            }
        }
        
        this.updateQueue = [];
        this.rafId = null;
        
        uniqueUpdates.forEach(candle => {
            if (this.chartManager && this.chartManager.updateLastCandle) {
                this.chartManager.updateLastCandle(candle);
            }
        });
        
        if (this.chartManager.indicatorManager) {
            this.chartManager.indicatorManager.updateAllIndicators();
        }
    }
    
    updateTimeframe(interval) {
        if (this.currentInterval === interval) return;
        this.updateSymbolAndTimeframe(this.currentSymbol, interval);
    }
    
    updateSymbol(symbol) {
        if (this.currentSymbol === symbol) return;
        this.updateSymbolAndTimeframe(symbol, this.currentInterval);
    }
    
       updateSymbolAndTimeframe(symbol, interval, exchange) {
        this.currentSymbol = symbol;
        this.currentInterval = interval;
        this.currentExchange = exchange;
        
        // Очищаем очередь обновлений
        this.updateQueue = [];
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        // Закрываем все старые WebSocket
        if (this.wsKline) {
            this.wsKline.onclose = null;
            this.wsKline.close();
            this.wsKline = null;
        }
        if (this.wsKlineBybit) {
            this.wsKlineBybit.onclose = null;
            this.wsKlineBybit.close();
            this.wsKlineBybit = null;
        }
        if (this.klineReconnectTimer) clearTimeout(this.klineReconnectTimer);
        if (this.bybitKlineReconnectTimer) clearTimeout(this.bybitKlineReconnectTimer);
        
        // Подключаем нужный WebSocket в зависимости от биржи
        if (exchange === 'binance') {
            this.connectKline(symbol, interval);
        } else if (exchange === 'bybit') {
            this.connectBybitKline(symbol, interval);
        }
    }
    
    closeAll() {
        if (this.wsKline) {
            try { 
                this.wsKline.onclose = null;
                this.wsKline.close(); 
            } catch(e) {}
            this.wsKline = null;
        }
        if (this.klineReconnectTimer) clearTimeout(this.klineReconnectTimer);
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.updateQueue = [];
    }
}
if (typeof window !== 'undefined') {
    window.WebSocketManager = WebSocketManager;
} 
