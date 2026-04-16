class PriceManager {
    constructor() {
        // Хранилище цен для всех символов
        this.prices = new Map(); // symbol -> { price, time, exchange }
        
        // Подписчики на обновления цен
        this.subscribers = new Map(); // symbol -> [callback1, callback2]
        
        // WebSocket для цен
        this.wsBinance = null;
        this.wsBybit = null;
        
        // Таймеры переподключения
        this.binanceReconnectTimer = null;
        this.bybitReconnectTimer = null;
        
        // Запускаем подключение
        this._init();
    }
    
    _init() {
        this._initBinance();
        this._initBybit();
        console.log('✅ PriceManager инициализирован');
    }
    
    _initBinance() {
        if (this.wsBinance) {
            try { this.wsBinance.close(); } catch(e) {}
        }
        
        this.wsBinance = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
        
        this.wsBinance.onopen = () => {
            console.log('✅ PriceManager: Binance подключен');
        };
        
        this.wsBinance.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const tickers = Array.isArray(data) ? data : [data];
                
                tickers.forEach(ticker => {
                    const symbol = ticker.s;
                    const price = parseFloat(ticker.c);
                    
                    // Сохраняем цену
                    this.prices.set(symbol, {
                        price: price,
                        time: Date.now(),
                        exchange: 'binance'
                    });
                    
                    // Уведомляем подписчиков
                    if (this.subscribers.has(symbol)) {
    this.subscribers.get(symbol).forEach(cb => {
        try { cb(price, symbol); } catch(e) {}  // передаем symbol
    });
}
                });
            } catch (error) {
                console.error('PriceManager error:', error);
            }
        };
        
        this.wsBinance.onclose = () => {
            console.log('❌ PriceManager: Binance закрыт, переподключение...');
            this.binanceReconnectTimer = setTimeout(() => this._initBinance(), 3000);
        };
        
        this.wsBinance.onerror = (error) => {
            console.error('PriceManager Binance error:', error);
        };
    }
    
    _initBybit() {
        if (this.wsBybit) {
            try { this.wsBybit.close(); } catch(e) {}
        }
        
        this.wsBybit = new WebSocket('wss://stream.bybit.com/v5/public/linear');
        
        this.wsBybit.onopen = () => {
            console.log('✅ PriceManager: Bybit подключен');
            this.wsBybit.send(JSON.stringify({ op: "subscribe", args: ["tickers"] }));
        };
        
        this.wsBybit.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.topic && data.topic.startsWith('tickers.')) {
                    const symbol = data.data.symbol;
                    const price = parseFloat(data.data.lastPrice);
                    
                    this.prices.set(symbol, {
                        price: price,
                        time: Date.now(),
                        exchange: 'bybit'
                    });
                    
                    if (this.subscribers.has(symbol)) {
                        this.subscribers.get(symbol).forEach(cb => cb(price));
                    }
                }
            } catch (error) {
                console.error('PriceManager Bybit error:', error);
            }
        };
        
        this.wsBybit.onclose = () => {
            console.log('❌ PriceManager: Bybit закрыт, переподключение...');
            this.bybitReconnectTimer = setTimeout(() => this._initBybit(), 3000);
        };
        
        this.wsBybit.onerror = (error) => {
            console.error('PriceManager Bybit error:', error);
        };
    }
    
    // Подписаться на цену символа
    subscribe(symbol, callback) {
        if (!symbol || typeof callback !== 'function') return;
        
        if (!this.subscribers.has(symbol)) {
            this.subscribers.set(symbol, []);
        }
        
        this.subscribers.get(symbol).push(callback);
        
        // Если цена уже есть — сразу вызываем
        const cached = this.prices.get(symbol);
        if (cached) {
            setTimeout(() => callback(cached.price), 0);
        }
    }
    
    // Отписаться
    unsubscribe(symbol, callback) {
        if (!this.subscribers.has(symbol)) return;
        
        const callbacks = this.subscribers.get(symbol);
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
        
        if (callbacks.length === 0) {
            this.subscribers.delete(symbol);
        }
    }
    
    // Получить текущую цену
   getPrice(symbol) {
    const cached = this.prices.get(symbol);
    return cached ? cached.price : null;
}
    
    // Принудительный запрос цены через REST
    async fetchPrice(symbol, exchange = 'binance', marketType = 'futures') {
        try {
            let url;
            if (exchange === 'binance') {
                if (marketType === 'futures') {
                    url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`;
                } else {
                    url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
                }
            } else {
                const category = marketType === 'futures' ? 'linear' : 'spot';
                url = `https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            let price = null;
            if (exchange === 'binance') {
                price = parseFloat(data.price);
            } else {
                if (data.retCode === 0 && data.result?.list?.[0]) {
                    price = parseFloat(data.result.list[0].lastPrice);
                }
            }
            
            if (price && !isNaN(price)) {
                this.prices.set(symbol, {
                    price: price,
                    time: Date.now(),
                    exchange: exchange
                });
                
                if (this.subscribers.has(symbol)) {
                    this.subscribers.get(symbol).forEach(cb => cb(price));
                }
                
                return price;
            }
        } catch (e) {
            console.warn(`Ошибка получения цены ${symbol}:`, e);
        }
        return null;
    }
    
    // Закрыть все соединения
    close() {
        if (this.wsBinance) {
            try { this.wsBinance.close(); } catch(e) {}
            this.wsBinance = null;
        }
        if (this.wsBybit) {
            try { this.wsBybit.close(); } catch(e) {}
            this.wsBybit = null;
        }
        if (this.binanceReconnectTimer) clearTimeout(this.binanceReconnectTimer);
        if (this.bybitReconnectTimer) clearTimeout(this.bybitReconnectTimer);
    }
}
if (typeof window !== 'undefined') {
    window.PriceManager = PriceManager;
}