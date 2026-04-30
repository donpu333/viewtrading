// ========== ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ ==========

class TimerPriceAxisView {
    constructor(timerManager) {
        this._timerManager = timerManager;
    }

    coordinate() {
        const chartManager = this._timerManager._chartManager;
        if (!chartManager) return -1;
        const lastCandle = chartManager.getLastCandle();
        if (!lastCandle) return -1;
        return lastCandle.close;
    }

    text() {
        return this._timerManager._timerElement?.textContent || '';
    }

    visible() {
        const timerText = this._timerManager._timerElement?.textContent || '';
        return timerText.length > 0;
    }

    font() {
        return "bold 11px -apple-system, 'Inter', Arial, sans-serif";
    }
}

class TimerPaneView {
    constructor(timerManager) {
        this._timerManager = timerManager;
    }
    
    renderer() { 
        return null; 
    }
}

class TimerPrimitive {
    constructor(timerManager, chartManager) {
        this._timerManager = timerManager;
        this._chartManager = chartManager;
        this._priceAxisView = new TimerPriceAxisView(timerManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    
    paneViews() { 
        return []; 
    }
    
    priceAxisViews() {
        return [this._priceAxisView];
    }
    
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
    }
    
    detached() {}
    
    updateAllViews() {}
    
    requestRedraw() {
        if (this._requestUpdate) {
            this._requestUpdate();
        }
    }
    
    setEnabled(enabled) {
        if (this._priceAxisView) {
            this._priceAxisView._enabled = enabled;
            this.requestRedraw();
        }
    }
    
    isEnabled() {
        return this._priceAxisView?._enabled ?? true;
    }
    
    updateDisplay() {
        this.requestRedraw();
    }
}

// ========== ОСНОВНОЙ КЛАСС ==========

class TimerManager { 
    constructor(chartManager) {
        this._chartManager = chartManager;
        this._interval = null;
        this._currentTf = CONFIG.defaultInterval || '1h';
        this._primitive = null;
        this._timerElement = { textContent: '' };
        chartManager.timerManager = this;
        setTimeout(() => this._createPrimitive(), 500);
    }

    _createPrimitive() {
        if (!this._chartManager || !this._chartManager.chart) return;
        
        this._primitive = new TimerPrimitive(this, this._chartManager);
        
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        
        if (series) {
            try {
                series.attachPrimitive(this._primitive);
                
                if (this._isDayTimeframe(this._currentTf)) {
                    this._primitive.setEnabled(false);
                }
                
                series.subscribeDataChanged(() => {
                    if (this._primitive && this._primitive.isEnabled()) {
                        this._primitive.requestRedraw();
                    }
                });
                
                console.log('✅ TimerManager: примитив создан');
            } catch (e) {
                console.warn('❌ TimerManager: ошибка создания примитива:', e);
            }
        }
    }

    _isDayTimeframe(interval) {
        return ['1d', '1w', '1M'].includes(interval);
    }

    start(interval) {
        this._currentTf = interval;
        
        if (this._isDayTimeframe(interval)) {
            this._timerElement.textContent = '';
            if (this._primitive) this._primitive.setEnabled(false);
            this.stop();
            return;
        }
        
        this._updateTimer();
        this.stop();
        this._interval = setInterval(() => this._updateTimer(), 250);
    }

    _updateTimer() {
        if (this._isDayTimeframe(this._currentTf)) {
            this._timerElement.textContent = '';
            if (this._primitive) this._primitive.setEnabled(false);
            return;
        }
        
        const duration = TF_DURATIONS[this._currentTf];
        if (!duration) return;
        
        const now = Date.now();
        const moscowNow = Utils.toMoscowTime(now).getTime();
        const msSinceEpoch = moscowNow % duration;
        const timeLeft = duration - msSinceEpoch;
        
        const newText = Utils.formatTimeRemaining(timeLeft);
        
        if (this._timerElement.textContent !== newText) {
            this._timerElement.textContent = newText;
            if (this._primitive) {
                if (!this._primitive.isEnabled()) {
                    this._primitive.setEnabled(true);
                }
                this._primitive.requestRedraw();
            }
        }
    }

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
    
    reattach() {
        if (!this._primitive) return;
        
        const wasEnabled = this._primitive.isEnabled();
        
        try {
            const oldSeries = this._chartManager.currentChartType === 'candle' 
                ? this._chartManager.barSeries 
                : this._chartManager.candleSeries;
            if (oldSeries) oldSeries.detachPrimitive(this._primitive);
        } catch (e) {}
        
        const newSeries = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        
        if (newSeries) {
            try {
                newSeries.attachPrimitive(this._primitive);
                if (wasEnabled) this._primitive.setEnabled(true);
            } catch (e) {}
        }
    }
    
    destroy() {
        this.stop();
        if (this._primitive) {
            try {
                const series = this._chartManager.currentChartType === 'candle' 
                    ? this._chartManager.candleSeries 
                    : this._chartManager.barSeries;
                if (series) series.detachPrimitive(this._primitive);
            } catch (e) {}
            this._primitive = null;
        }
        this._timerElement = null;
    }
}

if (typeof window !== 'undefined') {
    window.TimerManager = TimerManager;
}
