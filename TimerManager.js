// ========== ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ ==========

class TimerRenderer {
    constructor(timerManager) {
        this._timerManager = timerManager;
        this.enabled = true;
    }

    draw(target) {
        if (!this.enabled) return;
        
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const chartManager = this._timerManager._chartManager;
            if (!chartManager) return;
            
            const timerText = this._timerManager._timerElement?.textContent || '';
            if (!timerText) return;
            
            const activeSeries = chartManager.currentChartType === 'candle' 
                ? chartManager.candleSeries 
                : chartManager.barSeries;
            
            if (!activeSeries) return;
            
            const lastCandle = chartManager.getLastCandle();
            if (!lastCandle) return;
            
            const yCoord = activeSeries.priceToCoordinate(lastCandle.close);
            if (yCoord === null || yCoord === undefined) return;
            
            const fontSize = 11;
            const fontFamily = "-apple-system, 'Inter', Arial, sans-serif";
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            const textWidth = ctx.measureText(timerText).width;
            const paddingH = 6 * scope.horizontalPixelRatio;
            const paddingV = 3 * scope.verticalPixelRatio;
            const rectWidth = textWidth + paddingH * 2;
            const rectHeight = (fontSize + paddingV * 2) * scope.verticalPixelRatio;
            
           // Получаем точную координату правого края графика
const priceScale = chartManager.chart.priceScale('right');
const priceScaleWidth = priceScale ? priceScale.width() : 70;
const rectX = scope.mediaSize.width + priceScaleWidth * scope.horizontalPixelRatio - rectWidth - 4 * scope.horizontalPixelRatio;
            
            const rectY = yCoord - rectHeight / 2;
            const minY = 0;
            const maxY = scope.mediaSize.height - rectHeight;
            const clampedY = Math.max(minY, Math.min(maxY, rectY));
            
            const isBullish = lastCandle.close >= lastCandle.open;
            const bgColor = isBullish 
                ? (chartManager.bullishColor || '#26a69a')
                : (chartManager.bearishColor || '#ef5350');
            
            ctx.save();
            ctx.fillStyle = bgColor;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 3 * scope.horizontalPixelRatio;
            ctx.shadowOffsetY = 1 * scope.verticalPixelRatio;
            ctx.beginPath();
            this._roundRect(ctx, rectX, clampedY, rectWidth, rectHeight, 3 * scope.horizontalPixelRatio);
            ctx.fill();
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timerText, rectX + rectWidth / 2, clampedY + rectHeight / 2);
            ctx.restore();
        });
    }
    
    _roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }
}

class TimerPaneView {
    constructor(timerManager) {
        this._timerManager = timerManager;
        this._renderer = new TimerRenderer(timerManager);
    }
    
    renderer() { 
        return this._renderer; 
    }
}

class TimerPrimitive {
    constructor(timerManager, chartManager) {
        this._timerManager = timerManager;
        this._chartManager = chartManager;
        this._paneView = new TimerPaneView(timerManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    
    paneViews() { 
        return [this._paneView]; 
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
        if (this._paneView && this._paneView._renderer) {
            this._paneView._renderer.enabled = enabled;
            this.requestRedraw();
        }
    }
    
    isEnabled() {
        return this._paneView?._renderer?.enabled ?? false;
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
               if (this._chartManager && this._chartManager.chart) {
    const currentWidth = this._chartManager.chart.options().width;
    this._chartManager.chart.applyOptions({ width: currentWidth });
}
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
