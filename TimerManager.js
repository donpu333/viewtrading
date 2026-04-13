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
            
            const lastCandle = chartManager.getLastCandle();
            if (!lastCandle) return;
            
            // ТЕКСТ ТАЙМЕРА
            const timerText = this._timerManager._timerElement?.textContent || '';
            
            // Если текст пустой - не рисуем
            if (!timerText) return;
            
            // РАЗМЕРЫ
            const fontSize = 11;
            ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;
            const textWidth = ctx.measureText(timerText).width;
            
            const padding = 8 * scope.horizontalPixelRatio;
            const rectWidth = textWidth + padding * 2;
            const rectHeight = (fontSize + 8) * scope.verticalPixelRatio;
            const rectX = scope.mediaSize.width - rectWidth - 5 * scope.horizontalPixelRatio;
            
            // ПОЛУЧАЕМ ЦЕНУ
            let price = chartManager.getCurrentPrice();
            if (!price || isNaN(price) || price <= 0) {
                price = lastCandle.close;
            }
            
            const activeSeries = chartManager.currentChartType === 'candle' 
                ? chartManager.candleSeries 
                : chartManager.barSeries;
            
            // ПОЛУЧАЕМ Y КООРДИНАТУ
            let rectY;
            const yCoordinate = activeSeries.priceToCoordinate(price);
            
            if (yCoordinate !== null) {
                const { position: yPos } = positionsLine(
                    yCoordinate, 
                    scope.verticalPixelRatio, 
                    1, 
                    false
                );
                rectY = yPos - rectHeight / 2;
            } else {
                // Fallback — рисуем внизу справа
                rectY = scope.mediaSize.height - rectHeight - 10 * scope.verticalPixelRatio;
            }
            
            // ЦВЕТ
            let isBullish = true;
            if (chartManager.lastCandle) {
                isBullish = chartManager.lastCandle.close >= chartManager.lastCandle.open;
            }
            
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
    
    updateAllViews() {}
    
    requestRedraw() {
        if (this._requestUpdate) {
            this._requestUpdate();
        }
    }
    
    // ========== ПУБЛИЧНЫЕ МЕТОДЫ (ИНКАПСУЛЯЦИЯ) ==========
    
    /**
     * Включает или выключает отображение таймера
     * @param {boolean} enabled - true для отображения, false для скрытия
     */
    setEnabled(enabled) {
        if (this._paneView && this._paneView._renderer) {
            this._paneView._renderer.enabled = enabled;
            this.requestRedraw();
        }
    }
    
    /**
     * Проверяет, включен ли таймер
     * @returns {boolean}
     */
    isEnabled() {
        return this._paneView?._renderer?.enabled ?? false;
    }
    
    /**
     * Принудительно обновляет отображение таймера
     */
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
        
        // Создаем объект для хранения текста таймера
        this._timerElement = { textContent: '' };
        
        // Сохраняем ссылку на менеджер в chartManager
        chartManager.timerManager = this;
        
        // Ждем инициализации графика и создаем примитив
        setTimeout(() => this._createPrimitive(), 500);
    }

    _createPrimitive() {
        if (!this._chartManager || !this._chartManager.chart) {
            console.warn('⚠️ TimerManager: chart не готов');
            return;
        }
        
        // Создаем примитив
        this._primitive = new TimerPrimitive(this, this._chartManager);
        
        // Прикрепляем к активной серии
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        
        if (series) {
            try {
                series.attachPrimitive(this._primitive);
                
                // Проверяем, нужно ли показывать таймер
                if (this._isDayTimeframe(this._currentTf)) {
                    this._primitive.setEnabled(false);
                }
                
                console.log('✅ TimerManager: примитив создан');
            } catch (e) {
                console.warn('❌ TimerManager: ошибка создания примитива:', e);
            }
        }
    }
    
    /**
     * Проверяет, является ли таймфрейм дневным или выше
     * @param {string} interval - таймфрейм
     * @returns {boolean}
     */
    _isDayTimeframe(interval) {
        return ['1d', '1w', '1M'].includes(interval);
    }

    /**
     * Запускает таймер для указанного интервала
     * @param {string} interval - таймфрейм
     */
    start(interval) {
        this._currentTf = interval;
        
        // Для дневных и выше - полностью скрываем таймер
        if (this._isDayTimeframe(interval)) {
            this._timerElement.textContent = '';
            
            if (this._primitive) {
                this._primitive.setEnabled(false);
            }
            
            // Останавливаем интервал обновления
            this.stop();
            console.log(`⏹️ TimerManager: таймер скрыт для ${interval}`);
            return;
        }
        
        // Для минутных/часовых - показываем таймер
        this._updateTimer();
        
        // Запускаем интервал обновления
        this.stop(); // Очищаем старый интервал
        this._interval = setInterval(() => this._updateTimer(), 1000);
        
        console.log(`▶️ TimerManager: таймер запущен для ${interval}`);
    }

    _updateTimer() {
        // Для дневных и выше - скрываем таймер
        if (this._isDayTimeframe(this._currentTf)) {
            this._timerElement.textContent = '';
            
            if (this._primitive) {
                this._primitive.setEnabled(false);
            }
            return;
        }
        
        const duration = TF_DURATIONS[this._currentTf];
        if (!duration) {
            console.warn(`⚠️ TimerManager: неизвестная длительность для ${this._currentTf}`);
            return;
        }
        
        const now = Date.now();
        const moscowNow = Utils.toMoscowTime(now).getTime();
        const msSinceEpoch = moscowNow % duration;
        const timeLeft = duration - msSinceEpoch;
        
        this._timerElement.textContent = Utils.formatTimeRemaining(timeLeft);
        
        // Включаем отображение таймера
        if (this._primitive) {
            if (!this._primitive.isEnabled()) {
                this._primitive.setEnabled(true);
            } else {
                this._primitive.updateDisplay();
            }
        }
    }

    /**
     * Останавливает таймер
     */
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
    
    /**
     * Вызывается при смене типа графика (свечи/бары)
     */
    reattach() {
        if (!this._primitive) return;
        
        // Сохраняем текущее состояние
        const wasEnabled = this._primitive.isEnabled();
        
        // Открепляем от старой серии
        try {
            const oldSeries = this._chartManager.currentChartType === 'candle' 
                ? this._chartManager.barSeries 
                : this._chartManager.candleSeries;
            
            if (oldSeries) {
                oldSeries.detachPrimitive(this._primitive);
            }
        } catch (e) {
            console.warn('⚠️ TimerManager: ошибка открепления:', e);
        }
        
        // Прикрепляем к новой серии
        const newSeries = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        
        if (newSeries) {
            try {
                newSeries.attachPrimitive(this._primitive);
                
                // Восстанавливаем состояние
                if (wasEnabled) {
                    this._primitive.setEnabled(true);
                }
                
                console.log('🔄 TimerManager: таймер переприкреплён');
            } catch (e) {
                console.warn('❌ TimerManager: ошибка переприкрепления:', e);
            }
        }
    }
    
    /**
     * Уничтожает таймер и очищает ресурсы
     */
    destroy() {
        this.stop();
        
        if (this._primitive) {
            try {
                const series = this._chartManager.currentChartType === 'candle' 
                    ? this._chartManager.candleSeries 
                    : this._chartManager.barSeries;
                
                if (series) {
                    series.detachPrimitive(this._primitive);
                }
            } catch (e) {
                console.warn('⚠️ TimerManager: ошибка удаления примитива:', e);
            }
            
            this._primitive = null;
        }
        
        this._timerElement = null;
        console.log('🧹 TimerManager: уничтожен');
    }
}

// ========== ЭКСПОРТ ==========
if (typeof window !== 'undefined') {
    window.TimerManager = TimerManager;
}
