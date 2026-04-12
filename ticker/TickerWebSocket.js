class TickerWebSocket {
    constructor(parent) {
        this.parent = parent;
        this.wsConnections = [];
        this.wsReconnectTimers = [];
        this._pendingBybitSubscriptions = [];
        this.pendingUpdates = new Map();
        this.updatePending = false;
        this.wsUpdateBuffer = new Map();
        this.wsUpdateTimer = null;
        this.wsDebounceMs = 50;
        this._binanceFuturesConnecting = false;
        this._binanceSpotConnecting = false;
        this._bybitFuturesConnecting = false;
        this._bybitSpotConnecting = false;
        this._hasSignificantChange = false;
        this.fallbackInterval = null;
    }
    
   setupWebSockets() {
    this.cleanup();
    
    if (this.parent.debugMode) {
        console.log('🔄 Настройка WebSocket...');
        console.log('   Текущие символы:', this.parent.tickers.map(t => `${t.symbol}:${t.exchange}:${t.marketType}`));
    }
    
    if (this.parent.state.isSettingUpWebSockets) {
        if (this.parent.debugMode) console.log('⏭️ WebSocket уже настраивается, пропускаем');
        return;
    }
    
    this.parent.state.isSettingUpWebSockets = true;
    
    const hasBinanceFutures = this.parent.tickers.some(t => t.exchange === 'binance' && t.marketType === 'futures');
    const hasBinanceSpot = this.parent.tickers.some(t => t.exchange === 'binance' && t.marketType === 'spot');
    const hasBybitFutures = this.parent.tickers.some(t => t.exchange === 'bybit' && t.marketType === 'futures');
    const hasBybitSpot = this.parent.tickers.some(t => t.exchange === 'bybit' && t.marketType === 'spot');
    
    let connectionsToMake = 0;
    
    if (hasBinanceFutures && !this.parent.state.wsConnected.binanceFutures && !this._binanceFuturesConnecting) {
        this._binanceFuturesConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBinanceWebSocket('futures', 'wss://fstream.binance.com/ws/!ticker@arr');
        }, connectionsToMake * 500);
    }
    
    if (hasBinanceSpot && !this.parent.state.wsConnected.binanceSpot && !this._binanceSpotConnecting) {
        this._binanceSpotConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBinanceWebSocket('spot', 'wss://stream.binance.com:9443/ws/!ticker@arr');
        }, connectionsToMake * 500);
    }
    
    if (hasBybitFutures && !this.parent.state.wsConnected.bybitFutures && !this._bybitFuturesConnecting) {
        this._bybitFuturesConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBybitWebSocket('futures', 'wss://stream.bybit.com/v5/public/linear');
        }, connectionsToMake * 500);
    }
    
    if (hasBybitSpot && !this.parent.state.wsConnected.bybitSpot && !this._bybitSpotConnecting) {
        this._bybitSpotConnecting = true;
        connectionsToMake++;
        setTimeout(() => {
            this.connectBybitWebSocket('spot', 'wss://stream.bybit.com/v5/public/spot');
        }, connectionsToMake * 500);
    }
    
    const totalDelay = (connectionsToMake + 1) * 500 + 2000;
    setTimeout(() => {
        this.parent.state.isSettingUpWebSockets = false;
        if (this.parent.debugMode) console.log('✅ Настройка WebSocket завершена');
    }, totalDelay);
    
    // ========== ДОБАВЛЕНО: принудительная подписка Bybit ==========
    setTimeout(() => {
        this.forceSubscribeAll();
    }, 1500);
}
    // ========== НОВЫЙ МЕТОД (вставить сюда) ==========
    forceSubscribeAll() {
        // Bybit Futures
        const bybitFuturesSymbols = this.parent.tickers
            .filter(t => t.exchange === 'bybit' && t.marketType === 'futures')
            .map(t => t.symbol);
        
        const wsFutures = this.wsConnections.find(c => 
            c.url && c.url.includes('linear') && c.readyState === WebSocket.OPEN
        );
        
        if (wsFutures && bybitFuturesSymbols.length > 0) {
            const subscribeMsg = {
                op: "subscribe",
                args: bybitFuturesSymbols.map(s => `tickers.${s}`)
            };
            wsFutures.send(JSON.stringify(subscribeMsg));
            if (this.parent.debugMode) {
                console.log(`📡 Принудительная подписка Bybit Futures: ${bybitFuturesSymbols.length} символов`);
            }
        }
        
        // Bybit Spot
        const bybitSpotSymbols = this.parent.tickers
            .filter(t => t.exchange === 'bybit' && t.marketType === 'spot')
            .map(t => t.symbol);
        
        const wsSpot = this.wsConnections.find(c => 
            c.url && c.url.includes('spot') && c.url.includes('v5') && c.readyState === WebSocket.OPEN
        );
        
        if (wsSpot && bybitSpotSymbols.length > 0) {
            const subscribeMsg = {
                op: "subscribe",
                args: bybitSpotSymbols.map(s => `tickers.${s}`)
            };
            wsSpot.send(JSON.stringify(subscribeMsg));
            if (this.parent.debugMode) {
                console.log(`📡 Принудительная подписка Bybit Spot: ${bybitSpotSymbols.length} символов`);
            }
        }
    }
    
    

    startFallbackPriceUpdates() {
        if (this.fallbackInterval) clearInterval(this.fallbackInterval);
          this.fallbackInterval = setInterval(async () => {
            
            const symbolsToUpdate = this.parent.tickers.filter(t => !t.price || t.price === 0);
            if (symbolsToUpdate.length === 0) return;
            
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
                this.parent.debouncedUpdatePrices();
            }
        }, 5000);
    }
    
    connectBinanceWebSocket(marketType, url) {
        const attemptKey = marketType === 'futures' ? 'binanceFutures' : 'binanceSpot';
        
        if (this.parent.state.wsReconnectAttempts[attemptKey] >= this.parent.state.maxReconnectAttempts) {
            return;
        }
        
        if (!this.parent.tickers.some(t => t.exchange === 'binance' && t.marketType === marketType)) {
            return;
        }
        
        const ws = new WebSocket(url);
        const exchange = 'binance';
        let reconnectTimer;
        let pingInterval;
        
        ws.onopen = () => {
            console.log(`✅ Binance ${marketType} WebSocket открыт`);
            this.parent.state.binanceHasConnection[marketType] = true;
            this.parent.state.wsReconnectAttempts[attemptKey] = 0;
            this.parent.state.wsConnected[attemptKey] = true;
            
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
            this.parent.state.binanceHasConnection[marketType] = false;
        };
        
        ws.onclose = () => {
            console.log(`❌ Binance ${marketType} WebSocket закрыт`);
            this.parent.state.binanceHasConnection[marketType] = false;
            this.parent.state.wsConnected[attemptKey] = false;
            
            if (pingInterval) clearInterval(pingInterval);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            
            this.parent.state.wsReconnectAttempts[attemptKey]++;
            
            if (this.parent.tickers.some(t => t.exchange === 'binance' && t.marketType === marketType) && 
                this.parent.state.wsReconnectAttempts[attemptKey] < this.parent.state.maxReconnectAttempts) {
                const delay = Math.min(30000, Math.pow(2, this.parent.state.wsReconnectAttempts[attemptKey]) * 1000);
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
        const ticker = this.parent.tickersMap.get(key);
        
        if (!ticker) return;
        
        if (!this.wsUpdateBuffer.has(key)) {
            this.wsUpdateBuffer.set(key, {});
        }
        
        const update = this.wsUpdateBuffer.get(key);
        
        if (tickerData.c !== undefined) {
            update.price = parseFloat(tickerData.c);
            if (window.chartManagerInstance && window.chartManagerInstance.currentSymbol === symbol) {
                window.chartManagerInstance.updateCurrentCandle(update.price);
            }
        }
        if (tickerData.P !== undefined) update.change = parseFloat(tickerData.P);
        if (tickerData.q !== undefined) update.volume = parseFloat(tickerData.q);
        if (tickerData.n !== undefined) update.trades = parseInt(tickerData.n);
        
        if (this.wsUpdateTimer) clearTimeout(this.wsUpdateTimer);
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
            const ticker = this.parent.tickersMap.get(key);
            if (ticker) {
                if (update.price !== undefined) {
                    const oldPrice = ticker.price;
                    ticker.price = update.price;
                    
                    if (oldPrice && oldPrice !== 0 && !hasSignificantChange) {
                        const changePercent = Math.abs((update.price - oldPrice) / oldPrice) * 100;
                        if (changePercent > 0.5) {
                            hasSignificantChange = true;
                            if (this.parent.debugMode) {
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
                this.parent.updatePriceImmediate();
            } else {
                this.parent.debouncedUpdatePrices();
            }
        }
    }
    
    flushWsUpdates() {
        if (this.wsUpdateBuffer.size === 0) return;
        
        for (const [key, update] of this.wsUpdateBuffer.entries()) {
            if (!this.pendingUpdates.has(key)) {
                this.pendingUpdates.set(key, {});
            }
            const existing = this.pendingUpdates.get(key);
            Object.assign(existing, update);
        }
        
        this.wsUpdateBuffer.clear();
        this.wsUpdateTimer = null;
        
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
        
        if (this.parent.state.wsReconnectAttempts[attemptKey] >= this.parent.state.maxReconnectAttempts) {
            return;
        }
        
        if (!this.parent.tickers.some(t => t.exchange === 'bybit' && t.marketType === marketType)) {
            return;
        }
        
        const ws = new WebSocket(url);
        const exchange = 'bybit';
        let reconnectTimer;
        let pingInterval;
        
        ws.onopen = () => {
            console.log(`✅ Bybit ${marketType} WebSocket открыт`);
            this.parent.state.bybitHasConnection[marketType] = true;
            this.parent.state.wsReconnectAttempts[attemptKey] = 0;
            this.parent.state.wsConnected[attemptKey] = true;
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
                    const ticker = this.parent.tickersMap.get(key);
                    
                    if (ticker) {
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
                        
                        if (this.wsUpdateTimer) clearTimeout(this.wsUpdateTimer);
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
            this.parent.state.bybitHasConnection[marketType] = false;
        };
        
        ws.onclose = () => {
            console.log(`❌ Bybit ${marketType} WebSocket закрыт`);
            this.parent.state.bybitHasConnection[marketType] = false;
            this.parent.state.wsConnected[attemptKey] = false;
            
            if (pingInterval) clearInterval(pingInterval);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            
            this.parent.state.wsReconnectAttempts[attemptKey]++;
            
            if (this.parent.tickers.some(t => t.exchange === 'bybit' && t.marketType === marketType) && 
                this.parent.state.wsReconnectAttempts[attemptKey] < this.parent.state.maxReconnectAttempts) {
                const delay = Math.min(30000, Math.pow(2, this.parent.state.wsReconnectAttempts[attemptKey]) * 1000);
                reconnectTimer = setTimeout(() => {
                    this.connectBybitWebSocket(marketType, url);
                }, delay);
                this.wsReconnectTimers.push(reconnectTimer);
            }
        };
        
        this.wsConnections.push(ws);
    }
    
    updateBybitSubscription(marketType, symbol) {
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
            if (this.parent.debugMode) {
                console.log(`✅ Bybit подписан на ${symbol} (${marketType})`);
            }
            return true;
        } else {
            if (!this._pendingBybitSubscriptions) this._pendingBybitSubscriptions = [];
            this._pendingBybitSubscriptions.push({ symbol, marketType });
            if (this.parent.debugMode) {
                console.log(`⏳ Bybit WebSocket не готов, ${symbol} добавлен в очередь (${this._pendingBybitSubscriptions.length} в очереди)`);
            }
            return false;
        }
    }
    
    processPendingBybitSubscriptions() {
        if (!this._pendingBybitSubscriptions || this._pendingBybitSubscriptions.length === 0) return;
        
        const pending = [...this._pendingBybitSubscriptions];
        this._pendingBybitSubscriptions = [];
        
        if (this.parent.debugMode) {
            console.log(`📡 Обработка очереди Bybit подписок: ${pending.length} символов`);
        }
        
        pending.forEach(({ symbol, marketType }) => {
            this.updateBybitSubscription(marketType, symbol);
        });
    }
    
    subscribeAllBybitSymbols(ws, marketType) {
        const symbols = this.parent.tickers
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
        
        const updates = new Map(this.pendingUpdates);
        this.pendingUpdates.clear();
        
        let hasUpdates = false;
        let hasSignificantChange = this._hasSignificantChange || false;
        this._hasSignificantChange = false;
        
        updates.forEach((update, key) => {
            const ticker = this.parent.tickersMap.get(key);
            if (ticker) {
                if (update.price !== undefined) {
                    const oldPrice = ticker.price;
                    ticker.price = update.price;
                    
                    if (oldPrice && oldPrice !== 0 && !hasSignificantChange) {
                        const changePercent = Math.abs((update.price - oldPrice) / oldPrice) * 100;
                        if (changePercent > 0.5) {
                            hasSignificantChange = true;
                            if (this.parent.debugMode) {
                                console.log(`⚡ Значительное изменение ${ticker.symbol}: ${oldPrice} → ${update.price} (${changePercent.toFixed(2)}%)`);
                            }
                        }
                    }
                    
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
                this.parent.updatePriceImmediate();
            } else {
                this.parent.debouncedUpdatePrices();
            }
        }
    }
    
    async fetchBinanceFuturesPrices(symbols) {
        try {
            const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
            if (!response.ok) return;
            const data = await response.json();
            
            data.forEach(item => {
                const symbol = item.symbol;
                if (symbols.includes(symbol)) {
                    const key = `${symbol}:binance:futures`;
                    const ticker = this.parent.tickersMap.get(key);
                    if (ticker && !ticker.price) {
                        ticker.price = parseFloat(item.price);
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
                    const ticker = this.parent.tickersMap.get(key);
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
                    const ticker = this.parent.tickersMap.get(key);
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
                    const ticker = this.parent.tickersMap.get(key);
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
        
        this.parent.state.wsConnected = {
            binanceFutures: false,
            binanceSpot: false,
            bybitFutures: false,
            bybitSpot: false
        };
        
        this.parent.state.wsReconnectAttempts = { 
            binanceFutures: 0, 
            binanceSpot: 0, 
            bybitFutures: 0, 
            bybitSpot: 0 
        };
        
        this.parent.state.binanceHasConnection = { futures: false, spot: false };
        this.parent.state.bybitHasConnection = { futures: false, spot: false };
        this.parent.state.isSettingUpWebSockets = false;
    }
    
    cleanup() {
        console.log('🧹 Очистка WebSocket соединений...');
        
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
        
        if (this.parent._renderRafId) {
            cancelAnimationFrame(this.parent._renderRafId);
            this.parent._renderRafId = null;
        }
        
        this.parent.state.wsConnected = {
            binanceFutures: false,
            binanceSpot: false,
            bybitFutures: false,
            bybitSpot: false
        };
        
        this.parent.state.wsReconnectAttempts = { 
            binanceFutures: 0, 
            binanceSpot: 0, 
            bybitFutures: 0, 
            bybitSpot: 0 
        };
        
        this.parent.state.binanceHasConnection = { futures: false, spot: false };
        this.parent.state.bybitHasConnection = { futures: false, spot: false };
        this.parent.state.isSettingUpWebSockets = false;
        
        if (this.pendingUpdates) {
            this.pendingUpdates.clear();
        }
        
        console.log('✅ Очистка завершена');
    }
}

if (typeof window !== 'undefined') {
    window.TickerWebSocket = TickerWebSocket;
}