// ========== ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ ==========

class TimerRenderer {
    constructor(timerManager) {
        this._timerManager = timerManager;
        this.enabled = true;
        this._lastValidY = null;  // Кешируем последнюю валидную позицию
        this._initAttempts = 0;
        this._maxInitAttempts = 50;
    }

    draw(target) {
        if (!this.enabled) return;
        
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const chartManager = this._timerManager._chartManager;
            if (!chartManager) return;
            
            const timerText = this._timerManager._timerElement?.textContent || '';
            if (!timerText) return;
            
            const fontSize = 11;
            ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;
            const textWidth = ctx.measureText(timerText).width;
            const padding = 8 * scope.horizontalPixelRatio;
            const rectWidth = textWidth + padding * 2;
            const rectHeight = (fontSize + 8) * scope.verticalPixelRatio;
            const rectX = scope.mediaSize.width - rectWidth - 5 * scope.horizontalPixelRatio;
            
            // Получаем цену (как в оригинале)
            let price = chartManager.currentRealPrice;
            if (!price || isNaN(price) || price <= 0) {
                const lastCandle = chartManager.getLastCandle();
                price = lastCandle ? lastCandle.close : 0;
            }
            
            const activeSeries = chartManager.currentChartType === 'candle' 
                ? chartManager.candleSeries 
                : chartManager.barSeries;
            
            // ОРИГИНАЛЬНАЯ логика, но с защитой
            let yCoord = null;
            
            if (activeSeries && price > 0) {
                yCoord = activeSeries.priceToCoordinate(price);
            }
            
            // ЕСЛИ НЕ СРАБОТАЛО — ИСПОЛЬЗУЕМ КЕШ
            if (yCoord === null || yCoord === undefined || yCoord < 0) {
                if (this._lastValidY !== null) {
                    yCoord = this._lastValidY;
                } else {
                    // Пытаемся через последнюю свечу
                    const lastCandle = chartManager.getLastCandle();
                    if (lastCandle && activeSeries) {
                        yCoord = activeSeries.priceToCoordinate(lastCandle.close);
                    }
                }
            } else {
                // Сохраняем валидную координату
                this._lastValidY = yCoord;
                this._initAttempts = 0;
            }
            
            // СЧИТАЕМ ПОПЫТКИ инициализации
            if (yCoord === null || yCoord === undefined || yCoord < 0) {
                this._initAttempts++;
                
                // Если слишком много попыток — форсируем отображение
                if (this._initAttempts > this._maxInitAttempts) {
                    const lastCandle = chartManager.getLastCandle();
                    if (lastCandle && activeSeries) {
                        yCoord = activeSeries.priceToCoordinate(lastCandle.close);
                        if (yCoord !== null && yCoord !== undefined) {
                            this._lastValidY = yCoord;
                        }
                    }
                }
            }
            
            // ФИНАЛЬНЫЙ ФОЛБЭК — только если вообще ничего не работает
            let rectY;
            if (yCoord !== null && yCoord !== undefined && yCoord > 0) {
                rectY = yCoord - rectHeight / 2;
            } else {
                // Используем процент от высоты как в оригинале
                // Но берем 50% — это будет похоже на центр, 
                // пока не появятся реальные данные
                rectY = scope.mediaSize.height * 0.3;
            }
            
            // НЕ ДАЕМ ВЫЙТИ ЗА ГРАНИЦЫ (опционально)
            const minY = rectHeight / 2;
            const maxY = scope.mediaSize.height - rectHeight / 2;
            rectY = Math.max(minY, Math.min(maxY, rectY));
            
            const lastCandle = chartManager.getLastCandle();
            const isBullish = lastCandle ? lastCandle.close >= lastCandle.open : true;
            const bullishColor = chartManager.bullishColor || '#00bcd4';
            const bearishColor = chartManager.bearishColor || '#f23645';
            const bgColor = isBullish ? bullishColor : bearishColor;
            
            ctx.save();
            ctx.fillStyle = bgColor;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4 * scope.horizontalPixelRatio;
            ctx.beginPath();
            this._roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 4 * scope.horizontalPixelRatio);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timerText, rectX + rectWidth / 2, rectY + rectHeight / 2);
            ctx.restore();
        });
    }
    
    _roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
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
    // В TimerManager добавьте проверку готовности данных
start(interval) {
    this._currentTf = interval;
    
    if (this._isDayTimeframe(interval)) {
        this._timerElement.textContent = '';
        if (this._primitive) this._primitive.setEnabled(false);
        this.stop();
        return;
    }
    
    // Сбрасываем кеш при смене ТФ
    if (this._primitive && this._primitive._paneView && this._primitive._paneView._renderer) {
        this._primitive._paneView._renderer._lastValidY = null;
        this._primitive._paneView._renderer._initAttempts = 0;
    }
    
    this._updateTimer();
    this.stop();
    this._interval = setInterval(() => this._updateTimer(), 250);
}
    _roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
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
            
            // Скрываем на дневных ТФ
            if (this._isDayTimeframe(this._currentTf)) {
                this._primitive.setEnabled(false);
            }
            
            // 👇 СИНХРОНИЗАЦИЯ С ДАННЫМИ СЕРИИ
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
