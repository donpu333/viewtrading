const CONFIG = {
            colors: {
                bullish: '#00bcd4',
                bearish: '#f23645',
                gold: '#ffd700',
                volume: '#26a69a',
                rsi: '#FFA500',
                sma20: '#FFD700',
                sma50: '#FF69B4',
                ema20: '#00E5FF',
                macd: '#FFB6C1',
                signal: '#87CEEB'
            },
            defaultSymbol: 'BTCUSDT',
            defaultInterval: '1h',
            useRealTimePrice: true, 
            klineLimits: {
                '1m': 12000,
                '3m': 12000,
                '5m': 12000,
                '15m': 12000,
                '30m': 12000,
                '1h': 12000,
                '4h': 6000,
                '6h': 6000,
                '12h': 6000,
                '1d': 4000,
                '1w': 1000,
                '1M': 500
            },
            wsReconnectDelay: 3000,
            defaultBarsToShow: 60,
            quickLoadLimit: 1000,
            preloadTimeframes: ['1m', '3m', '5m', '15m', '1h'],
            timezoneOffset: 3,
           alertAutoDeleteTime: 24 * 60 * 60 * 1000,// 24 часа
            telegramProxyUrl: 'https://script.google.com/macros/s/AKfycbzQEUVh61o2aHkhrWXVIQ7CEsAK5QcoaMX-s0tu01Us4AdBeGge9hodBxqP1rSXH8jD/exec',
            rsiPeriod: 14,
            sma20Period: 20,
            sma50Period: 50,
            ema20Period: 20,
            macd: { fast: 12, slow: 26, signal: 9 },
            stochRsi: { period: 14, k: 3, d: 3 },
            atrPeriod: 14,
            adxPeriod: 14
        };
        if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}