const precisionCache = new Map();

async function getPrecisionFromExchange(symbol, exchange, marketType) {
    const cacheKey = `${symbol}:${exchange}:${marketType}`;
    if (precisionCache.has(cacheKey)) return precisionCache.get(cacheKey);
    
    try {
        let precision = 2;
        
        // ========== BINANCE ==========
        if (exchange === 'binance') {
            const url = marketType === 'futures' 
                ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
                : 'https://api.binance.com/api/v3/exchangeInfo';
            const res = await fetch(url);
            const data = await res.json();
            const symbolInfo = data.symbols.find(s => s.symbol === symbol);
            
            if (symbolInfo.pricePrecision !== undefined) {
                precision = symbolInfo.pricePrecision;
            } else {
                const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');
                const tickSize = parseFloat(priceFilter.tickSize);
                precision = Math.max(0, -Math.floor(Math.log10(tickSize)));
            }
        }
        
        // ========== BYBIT ==========
        if (exchange === 'bybit') {
            const category = marketType === 'futures' ? 'linear' : 'spot';
            const url = `https://api.bybit.com/v5/market/instruments-info?category=${category}&symbol=${symbol}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.retCode === 0 && data.result?.list?.[0]) {
                const info = data.result.list[0];
                
                if (marketType === 'futures') {
                    // Bybit Futures: используем priceScale
                    precision = info.priceScale;
                } else {
                    // Bybit Spot: вычисляем из tickSize
                    const tickSize = parseFloat(info.priceFilter.tickSize);
                    precision = Math.max(0, -Math.floor(Math.log10(tickSize)));
                }
            }
        }
        
        precisionCache.set(cacheKey, precision);
        return precision;
        
    } catch (e) {
        console.warn(`Ошибка получения precision для ${symbol}:`, e);
        return 2;
    }
}
if (typeof window !== 'undefined') {
    window.getPrecisionFromExchange = getPrecisionFromExchange;
}