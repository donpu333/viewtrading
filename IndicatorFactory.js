
class IndicatorFactory {
    static createIndicator(type, manager) {
        switch(type) {
            // Трендовые
            case 'sma20':
                return new SMAIndicator(manager, 20, 'SMA 20', '#FFD700');
            case 'sma50':
                return new SMAIndicator(manager, 50, 'SMA 50', '#FF69B4');
            case 'ema20':
                return new EMAIndicator(manager, 20, 'EMA 20', '#00E5FF');
            
            // Осцилляторы
            case 'rsi14':
                return new RSI14Indicator(manager);
            case 'stochrsi':
                return new StochRSIIndicator(manager);
            
            // Гистограммные
            case 'macd':
                return new MACDIndicator(manager);
            
            // Объём (если нужен)
            // case 'volume':
            //     return new VolumeIndicator(manager);
            
            // Волатильность
            case 'atr':
                return new ATRIndicator(manager);
            case 'adx':
                return new ADXIndicator(manager);
            
            // ========== НОВЫЙ ИНДИКАТОР ==========
            case 'multiatr':
                return new MultiTimeframeATRIndicator(manager);
            
            default:
                console.warn('⚠️ Неизвестный тип индикатора:', type);
                return null;
        }
    }
}
if (typeof window !== 'undefined') {
    window.IndicatorFactory = IndicatorFactory;
}