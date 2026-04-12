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
        const timerText = this._timerManager._timerElement?.textContent || '--:--';
        
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
            renderer() { return this._renderer; }
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
            
            paneViews() { return [this._paneView]; }
            
            attached({ chart, series, requestUpdate }) {
                this._chart = chart;
                this._series = series;
                this._requestUpdate = requestUpdate;
            }
            
            updateAllViews() {}
            
            requestRedraw() {
                if (this._requestUpdate) this._requestUpdate();
            }
        }

class TimerManager { 
            constructor(chartManager) {
                this._chartManager = chartManager;
                this._interval = null;
                this._currentTf = CONFIG.defaultInterval;
                this._primitive = null;
                
                // Создаем скрытый элемент для хранения текста (не отображается на странице)
                this._timerElement = { textContent: '--:--' };
                
                // Сохраняем ссылку на менеджер в chartManager
                chartManager.timerManager = this;
                
                // Ждем инициализации графика и создаем примитив
                setTimeout(() => this._createPrimitive(), 500);
            }

            _createPrimitive() {
                if (!this._chartManager || !this._chartManager.chart) return;
                
                // Создаем примитив
                this._primitive = new TimerPrimitive(this, this._chartManager);
                
                // Прикрепляем к активной серии
                const series = this._chartManager.currentChartType === 'candle' 
                    ? this._chartManager.candleSeries 
                    : this._chartManager.barSeries;
                
                if (series) {
                    try {
                        series.attachPrimitive(this._primitive);
                        console.log('✅ Таймер примитив создан');
                    } catch (e) {
                        console.warn('Ошибка при создании примитива таймера:', e);
                    }
                }
            }

            start(interval) {
                this._currentTf = interval;
                
                // Для дневных и выше таймер не показываем
                if (['1d', '1w', '1M'].includes(interval)) {
                    this._timerElement.textContent = '--:--';
                    return;
                }
                
                // Обновляем сразу
                this._updateTimer();
                
                // Запускаем интервал
                if (this._interval) clearInterval(this._interval);
                this._interval = setInterval(() => this._updateTimer(), 1000);
            }

         _updateTimer() {
    // Для дневных и выше - скрываем таймер полностью
    if (['1d', '1w', '1M'].includes(this._currentTf)) {
        this._timerElement.textContent = '';
        if (this._primitive) {
            // ✅ ПРАВИЛЬНО: обращаемся к рендереру через _paneView._renderer
            if (this._primitive._paneView && this._primitive._paneView._renderer) {
                this._primitive._paneView._renderer.enabled = false;
            }
            this._primitive.requestRedraw();
        }
        return;
    }
    
    const duration = TF_DURATIONS[this._currentTf];
    if (!duration) return;
    
    const now = Date.now();
    const moscowNow = Utils.toMoscowTime(now).getTime();
    const msSinceEpoch = moscowNow % duration;
    const timeLeft = duration - msSinceEpoch;
    
    this._timerElement.textContent = Utils.formatTimeRemaining(timeLeft);
    
    // Включаем рендерер если был выключен
    if (this._primitive && this._primitive._paneView && this._primitive._paneView._renderer) {
        if (this._primitive._paneView._renderer.enabled === false) {
            this._primitive._paneView._renderer.enabled = true;
        }
    }
    
    // Запрашиваем перерисовку
    if (this._primitive) {
        this._primitive.requestRedraw();
    }
}

            stop() {
                if (this._interval) {
                    clearInterval(this._interval);
                    this._interval = null;
                }
            }
            
            // Вызывается при смене типа графика
            reattach() {
                if (!this._primitive) return;
                
                // Открепляем от старой серии
                try {
                    const oldSeries = this._chartManager.currentChartType === 'candle' 
                        ? this._chartManager.barSeries 
                        : this._chartManager.candleSeries;
                    
                    if (oldSeries) {
                        oldSeries.detachPrimitive(this._primitive);
                    }
                } catch (e) {}
                
                // Прикрепляем к новой
                const newSeries = this._chartManager.currentChartType === 'candle' 
                    ? this._chartManager.candleSeries 
                    : this._chartManager.barSeries;
                
                if (newSeries) {
                    try {
                        newSeries.attachPrimitive(this._primitive);
                    } catch (e) {
                        console.warn('Ошибка при переприкреплении таймера:', e);
                    }
                }
            }
        }

if (typeof window !== 'undefined') {
    window.TimerManager = TimerManager;
}