class WebSocketManager {
    constructor(chartManager) {
        this.chartManager = chartManager;
        this.wsKline = null;
        this.klineReconnectTimer = null;
        this.currentSymbol = 'BTCUSDT';
        this.currentInterval = '1h';
        this.currentExchange = 'binance';
    }

    connectKline(symbol, interval, exchange, marketType) {
        if (!symbol) {
            console.warn('❌ WebSocket: symbol is undefined, сохраняем старый');
            symbol = this.currentSymbol || 'BTCUSDT';
        }
        if (!exchange) exchange = this.currentExchange || 'binance';
        
        if (this.klineReconnectTimer) { 
            clearTimeout(this.klineReconnectTimer); 
            this.klineReconnectTimer = null; 
        }
        if (this.wsKline) {
            this.wsKline.onclose = null; 
            this.wsKline.onerror = null; 
            this.wsKline.onmessage = null;
            if (this.wsKline.readyState === WebSocket.OPEN || this.wsKline.readyState === WebSocket.CONNECTING) {
                this.wsKline.close();
            }
            this.wsKline = null;
        }

        this.currentSymbol = symbol;
        this.currentInterval = interval;
        this.currentExchange = exchange;

        let wsUrl;
        if (exchange === 'bybit') {
            const category = marketType === 'spot' ? 'spot' : 'linear';
            wsUrl = `wss://stream.bybit.com/v5/public/${category}`;
        } else {
            wsUrl = (exchange === 'binance' && marketType === 'spot')
                ? `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`
                : `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@trade`;
        }

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ Trade (свечи) открыт:', exchange);
            this.wsKline = ws; // ← СОХРАНЯЕМ ТОЛЬКО ПРИ ОТКРЫТИИ!
            if (exchange === 'bybit') {
                ws.send(JSON.stringify({
                    op: 'subscribe',
                    args: [`publicTrade.${symbol}`]
                }));
            }
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                let price = null;
                
                if (exchange === 'bybit') {
                    if (data.topic?.startsWith('publicTrade.') && data.data?.length) {
                        price = parseFloat(data.data[0].p);
                    }
                } else {
                    price = parseFloat(data.p);
                }
                
                if (!price || !this.chartManager?.chartData?.length) return;
                
                const cm = this.chartManager;
                const last = cm.chartData[cm.chartData.length - 1];
                const nowSec = Math.floor(Date.now() / 1000);
                const stepMap = { 
                    '1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,
                    '1h':3600,'4h':14400,'6h':21600,'12h':43200,
                    '1d':86400,'1w':604800,'1M':2592000 
                };
                const step = stepMap[interval] || 3600;
                const aligned = Math.floor(nowSec / step) * step;

                if (aligned > last.time) {
                    const next = { 
                        time: aligned, open: price, high: price, 
                        low: price, close: price, volume: 0 
                    };
                    cm.chartData.push(next);
                    cm.lastCandle = next;
                    const series = cm.currentChartType === 'candle' ? cm.candleSeries : cm.barSeries;
                    series?.update(next);
                } else {
                    last.close = price;
                    if (price > last.high) last.high = price;
                    if (price < last.low) last.low = price;
                    cm.lastCandle = last;
                    const series = cm.currentChartType === 'candle' ? cm.candleSeries : cm.barSeries;
                    series?.update(last);
                }

                cm.currentRealPrice = price;
                const series = cm.currentChartType === 'candle' ? cm.candleSeries : cm.barSeries;
                if (series) {
                    const isBullish = last.close >= last.open;
                    const lineColor = isBullish 
                        ? (cm.bullishColor || '#00bcd4') 
                        : (cm.bearishColor || '#f23645');
                    series.applyOptions({ priceLineColor: lineColor });
                }
            } catch(e) {}
        };
        
        ws.onclose = () => {
            console.log('❌ Trade WebSocket закрыт, переподключение...');
            if (this.currentSymbol === symbol) {
                this.klineReconnectTimer = setTimeout(() => 
                    this.connectKline(symbol, interval, exchange, marketType), 3000
                );
            }
        };
        
        ws.onerror = () => {};
    }
    
    updateSymbolAndTimeframe(symbol, interval, exchange, marketType) {
        this.connectKline(symbol, interval, exchange, marketType);
    }

    closeAll() {
        if (this.wsKline) {
            try { this.wsKline.close(); } catch(e) {}
            this.wsKline = null;
        }
        if (this.klineReconnectTimer) clearTimeout(this.klineReconnectTimer);
    }
}

if (typeof window !== 'undefined') window.WebSocketManager = WebSocketManager;