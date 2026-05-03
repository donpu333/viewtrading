  const INDICATOR_TYPES = {
    // Трендовые индикаторы (на основном графике)
    sma20: { 
        category: 'trend', 
        panel: 'main', 
        name: 'SMA 20', 
        color: '#FFD700' 
    },
    sma50: { 
        category: 'trend', 
        panel: 'main', 
        name: 'SMA 50', 
        color: '#FF69B4' 
    },
    ema20: { 
        category: 'trend', 
        panel: 'main', 
        name: 'EMA 20', 
        color: '#00E5FF' 
    },
    
    // Осцилляторы (отдельные панели)
    rsi14: { 
        category: 'oscillator', 
        panel: 'rsi', 
        name: 'RSI 14', 
        color: '#FFA500' 
    },
    stochrsi: { 
        category: 'oscillator', 
        panel: 'stoch', 
        name: 'Stochastic RSI', 
        color: '#87CEEB' 
    },
    
    // Гистограммные (отдельные панели)
    macd: { 
        category: 'histogram', 
        panel: 'macd', 
        name: 'MACD', 
        color: '#FFB6C1' 
    },
    
    // Объём (отдельная панель) - если нужен как индикатор, иначе закомментировать
    // volume: { 
    //     category: 'volume', 
    //     panel: 'volume', 
    //     name: 'Volume', 
    //     color: '#26a69a' 
    // },
    
    // Волатильность (на основном графике или отдельной панели)
    atr: { 
        category: 'volatility', 
        panel: 'right', 
        name: 'ATR', 
        color: '#AB47BC' 
    },
    adx: { 
        category: 'trend', 
        panel: 'right', 
        name: 'ADX', 
        color: '#66BB6A' 
    },
    
    // ========== НОВЫЙ ИНДИКАТОР ATR MULTI ==========
    multiatr: { 
        category: 'volatility', 
        panel: 'right', 
        name: 'ATR Multi', 
        color: '#FFA500' 
    }
};
const INDICATORS_LIST = Object.entries(INDICATOR_TYPES).map(([id, data]) => ({
    id: id,
    name: data.name,
    category: data.category === 'trend' ? 'Трендовые' : 
               data.category === 'oscillator' ? 'Осцилляторы' :
               data.category === 'histogram' ? 'Гистограммные' :
               data.category === 'volume' ? 'Объём' : 'Волатильность',
    color: data.color,
    panel: data.panel
}));
if (typeof window !== 'undefined') {
    window.INDICATOR_TYPES = INDICATOR_TYPES;
    window.INDICATORS_LIST = INDICATORS_LIST;
}