class PriceManager {
    constructor() {
        this.prices = new Map();
        this.subscribers = new Map();
        this.wsBinance = null;
        this.wsBybit = null;
        this.binanceReconnectTimer = null;
        this.bybitReconnectTimer = null;
        this._init();
    }
    
    _init() {
        this._initBinance();
        this._initBybit();
        console.log('✅ PriceManager инициализирован');
    }
    
  _initBinance() {
    if (this.binanceReconnectTimer) {
        clearTimeout(this.binanceReconnectTimer);
        this.binanceReconnectTimer = null;
    }
    if (this.wsBinance) {
        try { 
            this.wsBinance.onclose = null; 
            this.wsBinance.onerror = null; 
            this.wsBinance.onmessage = null; 
            this.wsBinance.close(); 
        } catch(e) {}
        this.wsBinance = null;
    }
    
    const ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
    
    ws.onopen = () => {
        console.log('✅ PriceManager: Binance подключен');
        this.wsBinance = ws;
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            const tickers = Array.isArray(data) ? data : [data];
            
            tickers.forEach(ticker => {
                if (!ticker.s || !ticker.c) return;
                
                const symbol = ticker.s;
                const price = parseFloat(ticker.c);
                
                if (isNaN(price)) return;
                
                this.prices.set(symbol, {
                    price: price,
                    time: Date.now(),
                    exchange: 'binance'
                });
                
                if (this.subscribers.has(symbol)) {
                    const cbs = this.subscribers.get(symbol);
                    for (let i = 0; i < cbs.length; i++) {
                        try { 
                            cbs[i](price, symbol); 
                        } catch(e) {}
                    }
                }
            });
        } catch (error) {}
    };
    
    ws.onclose = (event) => {
        console.log('❌ PriceManager: Binance закрыт, переподключение...');
        this.binanceReconnectTimer = setTimeout(() => {
            this._initBinance();
        }, 3000);
    };
    
    ws.onerror = (error) => {
        console.warn('⚠️ PriceManager: Binance ошибка');
    };
}
    
 _initBybit() {
    // Очищаем таймер переподключения
    if (this.bybitReconnectTimer) {
        clearTimeout(this.bybitReconnectTimer);
        this.bybitReconnectTimer = null;
    }
    
    // Закрываем старый сокет если есть
    if (this.wsBybit) {
        try { 
            this.wsBybit.onclose = null; 
            this.wsBybit.onerror = null; 
            this.wsBybit.onmessage = null; 
            this.wsBybit.close(); 
        } catch(e) {}
        this.wsBybit = null;
    }
    
    console.log('🔄 PriceManager: Подключение к Bybit...');
    
    const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    
    ws.onopen = () => {
        console.log('✅ PriceManager: Bybit подключен');
        this.wsBybit = ws;
        try {
            ws.send(JSON.stringify({ 
                op: "subscribe", 
                args: ["tickers.BTCUSDT"] 
            }));
        } catch(e) {
            console.error('Ошибка подписки Bybit:', e);
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Обрабатываем ответ подписки
            if (data.op === 'subscribe' && data.success) {
                console.log('✅ PriceManager: Bybit подписка успешна');
                return;
            }
            
            // Обрабатываем ticker данные
            if (data.topic && data.topic.startsWith('tickers.') && data.data) {
                const symbol = data.data.symbol;
                const price = parseFloat(data.data.lastPrice);
                
                if (!symbol || isNaN(price)) return;
                
                this.prices.set(symbol, {
                    price: price,
                    time: Date.now(),
                    exchange: 'bybit'
                });
                
                if (this.subscribers.has(symbol)) {
                    const cbs = this.subscribers.get(symbol);
                    for (let i = 0; i < cbs.length; i++) {
                        try { cbs[i](price, symbol); } catch(e) {}
                    }
                }
            }
        } catch (error) {
            // Игнорируем ошибки парсинга
        }
    };
    
    ws.onclose = (event) => {
        console.warn('❌ PriceManager: Bybit закрыт, код:', event.code, 'причина:', event.reason);
        this.wsBybit = null;
        // Переподключаемся через 5 секунд
        this.bybitReconnectTimer = setTimeout(() => this._initBybit(), 5000);
    };
    
    ws.onerror = (error) => {
        console.error('⚠️ PriceManager: Bybit ошибка');
    };
}
    subscribe(symbol, callback) {
        if (!symbol || typeof callback !== 'function') return;
        
        if (!this.subscribers.has(symbol)) {
            this.subscribers.set(symbol, []);
        }
        
        this.subscribers.get(symbol).push(callback);
        
        const cached = this.prices.get(symbol);
        if (cached) {
            setTimeout(() => {
                try { callback(cached.price, symbol); } catch(e) {}
            }, 0);
        }
    }
    
    unsubscribe(symbol, callback) {
        if (!this.subscribers.has(symbol)) return;
        
        const callbacks = this.subscribers.get(symbol);
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
        
        if (callbacks.length === 0) {
            this.subscribers.delete(symbol);
        }
    }
    
    getPrice(symbol) {
        const cached = this.prices.get(symbol);
        return cached ? cached.price : null;
    }
    
    async fetchPrice(symbol, exchange = 'binance', marketType = 'futures') {
        if (!symbol) return null;
        
        try {
            let url;
            if (exchange === 'binance') {
                url = marketType === 'futures' 
                    ? `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`
                    : `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
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
                this.prices.set(symbol, { price, time: Date.now(), exchange });
                
                if (this.subscribers.has(symbol)) {
                    const cbs = this.subscribers.get(symbol);
                    for (let i = 0; i < cbs.length; i++) {
                        try { cbs[i](price, symbol); } catch(e) {}
                    }
                }
                
                return price;
            }
        } catch (e) {
            console.warn(`Ошибка получения цены ${symbol}:`, e);
        }
        return null;
    }
    
    close() {
        if (this.wsBinance) {
            try { this.wsBinance.onclose = null; this.wsBinance.close(); } catch(e) {}
            this.wsBinance = null;
        }
        if (this.wsBybit) {
            try { this.wsBybit.onclose = null; this.wsBybit.close(); } catch(e) {}
            this.wsBybit = null;
        }
        if (this.binanceReconnectTimer) { clearTimeout(this.binanceReconnectTimer); this.binanceReconnectTimer = null; }
        if (this.bybitReconnectTimer) { clearTimeout(this.bybitReconnectTimer); this.bybitReconnectTimer = null; }
    }
}

if (typeof window !== 'undefined') {
    window.PriceManager = PriceManager;
}