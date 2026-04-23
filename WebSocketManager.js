class WebSocketManager {
    constructor(chartManager) {
        this.chartManager = chartManager;
        this.ws = null;
        this.reconnectTimer = null;
        this.pingInterval = null;
        this.updateQueue = [];
        this._processTimer = null;
        this.isConnected = false;
        
        this.currentSymbol = CONFIG.defaultSymbol;
        this.currentInterval = localStorage.getItem('lastTimeframe') || CONFIG.defaultInterval;
        this.currentExchange = 'binance';
        
        console.log('📊 WebSocketManager: таймфрейм =', this.currentInterval);
        
        // Видимость вкладки
        this._visibilityHandler = () => {
            if (!document.hidden) {
                console.log('👁️ Вкладка активна, проверяем соединение');
                if (!this.isConnected && this.currentSymbol) {
                    this.connect(this.currentSymbol, this.currentInterval, this.currentExchange);
                }
                if (this.updateQueue.length > 0) {
                    this.processUpdates();
                }
            }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
        
        // Не даём Mac усыпить таймеры
        this._keepAliveInterval = setInterval(() => {
            // Пустой интервал не даёт браузеру уснуть
        }, 10000);
    }

    connect(symbol, interval, exchange = 'binance') {
        this.currentSymbol = symbol;
        this.currentInterval = interval;
        this.currentExchange = exchange;
        
        // Закрываем старые соединения
        this._cleanup();
        
        if (exchange === 'binance') {
            this._connectBinance(symbol, interval);
        } else {
            this._connectBybit(symbol, interval);
        }
    }

    _connectBinance(symbol, interval) {
        const wsUrl = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ Binance WebSocket открыт:', symbol, interval);
                this.isConnected = true;
                this._startPing();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Игнорируем пинг-понг
                    if (data.ping) {
                        this.ws.send(JSON.stringify({ pong: data.ping }));
                        return;
                    }
                    if (data.result === 'pong') return;
                    
                    const k = data.k;
                    if (!k) return;
                    
                    const candle = {
                        time: Math.floor(k.t / 1000),
                        open: parseFloat(k.o),
                        high: parseFloat(k.h),
                        low: parseFloat(k.l),
                        close: parseFloat(k.c),
                        volume: parseFloat(k.v)
                    };
                    
                    // Сразу обновляем, без очередей и таймеров
                    if (this.chartManager?.updateLastCandle) {
                        this.chartManager.updateLastCandle(candle);
                    }
                    if (this.chartManager?.indicatorManager) {
                        this.chartManager.indicatorManager.updateAllIndicators();
                    }
                    
                } catch (e) {
                    console.warn('Ошибка обработки сообщения:', e);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('❌ Binance WebSocket закрыт');
                this.isConnected = false;
                this._stopPing();
                this._scheduleReconnect(symbol, interval, 'binance');
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ Binance WebSocket ошибка');
                this.isConnected = false;
            };
            
        } catch (e) {
            console.error('Ошибка создания WebSocket:', e);
            this._scheduleReconnect(symbol, interval, 'binance');
        }
    }

    _connectBybit(symbol, interval) {
        const intervalMap = {
            '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
            '1h': '60', '4h': '240', '6h': '360', '12h': '720',
            '1d': 'D', '1w': 'W', '1M': 'M'
        };
        const bybitInterval = intervalMap[interval] || interval;
        const stream = `kline.${bybitInterval}.${symbol}`;
        
        try {
            this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
            
            this.ws.onopen = () => {
                console.log('✅ Bybit WebSocket открыт:', symbol, interval);
                this.isConnected = true;
                this.ws.send(JSON.stringify({
                    op: "subscribe",
                    args: [stream]
                }));
                this._startPing();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.op === 'subscribe') return;
                    if (data.op === 'pong') return;
                    
                    if (data.topic && data.topic.startsWith('kline.')) {
                        const kline = data.data;
                        if (!kline) return;
                        
                        let klineData = Array.isArray(kline) ? kline[0] : kline;
                        if (!klineData) return;
                        
                        const timestamp = Number(klineData.start);
                        if (isNaN(timestamp)) return;
                        
                        const candle = {
                            time: Math.floor(timestamp / 1000),
                            open: parseFloat(klineData.open),
                            high: parseFloat(klineData.high),
                            low: parseFloat(klineData.low),
                            close: parseFloat(klineData.close),
                            volume: parseFloat(klineData.volume)
                        };
                        
                        // Сразу обновляем
                        if (this.chartManager?.updateLastCandle) {
                            this.chartManager.updateLastCandle(candle);
                        }
                        if (this.chartManager?.indicatorManager) {
                            this.chartManager.indicatorManager.updateAllIndicators();
                        }
                    }
                } catch (e) {
                    console.warn('Ошибка обработки Bybit:', e);
                }
            };
            
            this.ws.onclose = () => {
                console.log('❌ Bybit WebSocket закрыт');
                this.isConnected = false;
                this._stopPing();
                this._scheduleReconnect(symbol, interval, 'bybit');
            };
            
            this.ws.onerror = () => {
                console.error('❌ Bybit WebSocket ошибка');
                this.isConnected = false;
            };
            
        } catch (e) {
            console.error('Ошибка создания Bybit WebSocket:', e);
            this._scheduleReconnect(symbol, interval, 'bybit');
        }
    }

    _startPing() {
        this._stopPing();
        // Пинг каждые 20 секунд чтобы Mac не заморозил соединение
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                if (this.currentExchange === 'binance') {
                    this.ws.send(JSON.stringify({ ping: Date.now() }));
                } else {
                    this.ws.send(JSON.stringify({ op: 'ping' }));
                }
            }
        }, 20000);
    }

    _stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    _scheduleReconnect(symbol, interval, exchange) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        
        // Реконнект с нарастающей задержкой
        const delay = this._reconnectAttempts ? Math.min(1000 * this._reconnectAttempts, 10000) : 1000;
        this._reconnectAttempts = (this._reconnectAttempts || 0) + 1;
        
        console.log(`🔄 Переподключение через ${delay}ms (попытка ${this._reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            if (this.currentSymbol === symbol && this.currentInterval === interval) {
                this.connect(symbol, interval, exchange);
            }
        }, delay);
    }

    _cleanup() {
        this._stopPing();
        this._reconnectAttempts = 0;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            try {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onclose = null;
                this.ws.onerror = null;
                this.ws.close();
            } catch (e) {}
            this.ws = null;
        }
        
        this.isConnected = false;
    }

    updateSymbolAndTimeframe(symbol, interval, exchange) {
        this.connect(symbol, interval, exchange);
    }
    
    updateTimeframe(interval) {
        this.connect(this.currentSymbol, interval, this.currentExchange);
    }
    
    updateSymbol(symbol) {
        this.connect(symbol, this.currentInterval, this.currentExchange);
    }

    closeAll() {
        this._cleanup();
    }

    destroy() {
        this._cleanup();
        
        if (this._keepAliveInterval) {
            clearInterval(this._keepAliveInterval);
            this._keepAliveInterval = null;
        }
        
        document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
}

if (typeof window !== 'undefined') {
    window.WebSocketManager = WebSocketManager;
}
