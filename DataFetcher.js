  class DataFetcher {
   static async loadMoreKlines(symbol, interval, endTime, exchange = 'binance', marketType = 'futures') {
   
    const limit = 1000;
    let url;
    
    if (exchange === 'binance') {
        if (marketType === 'futures') {
            url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&endTime=${endTime}`;
        } else {
            url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&endTime=${endTime}`;
        }
    } else if (exchange === 'bybit') {
        const bybitIntervalMap = {
            '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
            '1h': '60', '4h': '240', '6h': '360', '12h': '720',
            '1d': 'D', '1w': 'W', '1M': 'M'
        };
        const bybitInterval = bybitIntervalMap[interval] || interval;
        const category = marketType === 'futures' ? 'linear' : 'spot';
        url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`;
        // Bybit не поддерживает endTime в таком формате, потребуется другой подход
        // Например, через параметры startTime и endTime, либо через пагинацию
    } else {
        console.error('Неподдерживаемая биржа:', exchange);
        return [];
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 400) {
                console.warn('Символ не поддерживается для истории:', symbol);
                return [];
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const rawData = await response.json();
        
        if (exchange === 'binance') {
            if (!Array.isArray(rawData)) return [];
            return rawData.map(item => ({
                time: Math.floor(item[0] / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        } else if (exchange === 'bybit') {
            if (rawData.retCode !== 0 || !rawData.result?.list) return [];
            // Bybit возвращает от новых к старым, переворачиваем
            return rawData.result.list.map(item => ({
                time: Math.floor(parseInt(item[0]) / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5] || 0)
            })).filter(c => c !== null).reverse();
        }
        return [];
        
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Ошибка загрузки истории:', e);
        }
        return [];
    }
}
}

        function positionsLine(positionMedia, pixelRatio, desiredWidthMedia = 1, widthIsBitmap = false) {
            const scaledPosition = Math.round(pixelRatio * positionMedia);
            const lineBitmapWidth = widthIsBitmap 
                ? desiredWidthMedia 
                : Math.round(desiredWidthMedia * pixelRatio);
            const centreOffset = Math.floor(lineBitmapWidth * 0.5);
            const position = scaledPosition - centreOffset;
            return { position, length: lineBitmapWidth };
        }

        function positionsBox(position1Media, position2Media, pixelRatio) {
            const scaledPosition1 = Math.round(pixelRatio * position1Media);
            const scaledPosition2 = Math.round(pixelRatio * position2Media);
            return {
                position: Math.min(scaledPosition1, scaledPosition2),
                length: Math.abs(scaledPosition2 - scaledPosition1) + 1,
            };
        }
if (typeof window !== 'undefined') {
    window.DataFetcher = DataFetcher;
}