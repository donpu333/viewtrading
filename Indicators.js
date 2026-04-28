class ADXIndicator extends BaseIndicator {
    constructor(manager) {
        super(manager, 'adx', 'ADX', '#66BB6A', 'adx');
        this.settings.period = 14;
    }
    
    getWorkerType() {
        return 'adx';
    }
    
    getWorkerParams() {
        return { period: this.settings.period };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Период ADX:</label>
                <input type="number" id="indicatorPeriod" value="${this.settings.period}" min="5" max="50" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const periodInput = document.getElementById('indicatorPeriod');
        if (periodInput) this.settings.period = parseInt(periodInput.value);
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        this.series.forEach(s => {
            if (s) panelManager.removeSeries(panelId, null, s);
        });
        this.series = [];
        
        const adxSeries = panelManager.addSeries(panelId, `${this.type}-line`, 'line', {
            color: this.settings.color,
            lineWidth: this.settings.lineWidth
        });
        
        const plusSeries = panelManager.addSeries(panelId, `${this.type}-plus`, 'line', {
            color: '#4CAF50',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed
        });
        
        const minusSeries = panelManager.addSeries(panelId, `${this.type}-minus`, 'line', {
            color: '#FF5252',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed
        });
        
        this.series = [adxSeries, plusSeries, minusSeries];
    }
    
    updateSeriesData(data) {
        if (!data || !data.length) return;
        
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        const adxData = data.map(d => ({ time: d.time, value: d.value }));
        const plusData = data.map(d => ({ time: d.time, value: d.plusDI }));
        const minusData = data.map(d => ({ time: d.time, value: d.minusDI }));
        
        if (this.series[0]) this.series[0].setData(this.manager._filterData(adxData));
        if (this.series[1]) this.series[1].setData(this.manager._filterData(plusData));
        if (this.series[2]) this.series[2].setData(this.manager._filterData(minusData));
    }
     }

     class ATRIndicator extends BaseIndicator {
    constructor(manager) {
        super(manager, 'atr', 'ATR', '#AB47BC', 'atr');
        this.settings.period = 14;
    }
    
    getWorkerType() {
        return 'atr';
    }
    
    getWorkerParams() {
        return { period: this.settings.period };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Период ATR:</label>
                <input type="number" id="indicatorPeriod" value="${this.settings.period}" min="5" max="50" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const periodInput = document.getElementById('indicatorPeriod');
        if (periodInput) this.settings.period = parseInt(periodInput.value);
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        this.series.forEach(s => {
            if (s) panelManager.removeSeries(panelId, null, s);
        });
        this.series = [];
        
        const series = panelManager.addSeries(panelId, `${this.type}-line`, 'line', {
            color: this.settings.color,
            lineWidth: this.settings.lineWidth
        });
        
        this.series = [series];
    }
    
    updateSeriesData(data) {
        if (!data || !data.length) return;
        
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        if (this.series[0]) {
            this.series[0].setData(this.manager._filterData(data));
        }
    }
}

class EMAIndicator extends BaseIndicator {
    constructor(manager, period, name, color) {
        super(manager, `ema${period}`, name, color, 'main');
        this.settings.period = period;
    }
    
    getWorkerType() {
        return 'ema';
    }
    
    getWorkerParams() {
        return { period: this.settings.period };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Период EMA:</label>
                <input type="number" id="indicatorPeriod" value="${this.settings.period}" min="1" max="200" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const periodInput = document.getElementById('indicatorPeriod');
        if (periodInput) this.settings.period = parseInt(periodInput.value);
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        this.series.forEach(s => {
            if (s) {
                try {
                    this.manager.chartManager.chart.removeSeries(s);
                } catch(e) {}
            }
        });
        this.series = [];
        
        const series = this.manager.chartManager.chart.addSeries(LightweightCharts.LineSeries, {
            color: this.settings.color,
            lineWidth: this.settings.lineWidth
        });
        
        this.series = [series];
    }
    
    updateSeriesData(data) {
        if (!data || !data.length) return;
        if (this.series[0]) {
            this.series[0].setData(this.manager._filterData(data));
        }
    }
}

class MACDIndicator extends BaseIndicator {
    constructor(manager) {
        super(manager, 'macd', 'MACD', '#FFB6C1', 'macd');
        this.settings.fastPeriod = 12;
        this.settings.slowPeriod = 26;
        this.settings.signalPeriod = 9;
    }
    
    getWorkerType() {
        return 'macd';
    }
    
    getWorkerParams() {
        return {
            fastPeriod: this.settings.fastPeriod,
            slowPeriod: this.settings.slowPeriod,
            signalPeriod: this.settings.signalPeriod
        };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Быстрый период:</label>
                <input type="number" id="indicatorFastPeriod" value="${this.settings.fastPeriod}" min="5" max="50" style="width: 70px;">
            </div>
            <div class="settings-row">
                <label>Медленный период:</label>
                <input type="number" id="indicatorSlowPeriod" value="${this.settings.slowPeriod}" min="10" max="100" style="width: 70px;">
            </div>
            <div class="settings-row">
                <label>Сигнальный период:</label>
                <input type="number" id="indicatorSignalPeriod" value="${this.settings.signalPeriod}" min="5" max="50" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const fastInput = document.getElementById('indicatorFastPeriod');
        const slowInput = document.getElementById('indicatorSlowPeriod');
        const signalInput = document.getElementById('indicatorSignalPeriod');
        
        if (fastInput) this.settings.fastPeriod = parseInt(fastInput.value);
        if (slowInput) this.settings.slowPeriod = parseInt(slowInput.value);
        if (signalInput) this.settings.signalPeriod = parseInt(signalInput.value);
        
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        // Удаляем старые серии
        this.series.forEach(s => {
            if (s) panelManager.removeSeries(panelId, null, s);
        });
        this.series = [];
        
        // Создаём линию MACD
        const macdSeries = panelManager.addSeries(panelId, `${this.type}-line`, 'line', {
            color: this.settings.color,
            lineWidth: this.settings.lineWidth
        });
        
        // Создаём сигнальную линию
        const signalSeries = panelManager.addSeries(panelId, `${this.type}-signal`, 'line', {
            color: '#87CEEB',
            lineWidth: 2
        });
        
        // Создаём гистограмму
        const histSeries = panelManager.addSeries(panelId, `${this.type}-histogram`, 'histogram', {});
        
        this.series = [macdSeries, signalSeries, histSeries];
    }
    
    updateSeriesData(data) {
    if (!data || !data.length) return;
    
    const panelManager = this.manager.panelManager;
    const panelId = this.data.panel;
    
    // Получаем все свечи с основного графика
    const chartData = this.manager.chartManager.chartData;
    if (!chartData || chartData.length === 0) return;
    
    // Индексируем полученные данные по времени
    const macdMap = new Map();
    const signalMap = new Map();
    const histMap = new Map();
    
    data.forEach(item => {
        macdMap.set(item.time, item.macd);
        signalMap.set(item.time, item.signal);
        histMap.set(item.time, item.histogram);
    });
    
    // Создаём выровненные массивы
    const macdData = [];
    const signalData = [];
    const histData = [];
    
    chartData.forEach(candle => {
        const time = candle.time;
        
        // MACD линия
        if (macdMap.has(time)) {
            macdData.push({ time, value: macdMap.get(time) });
            signalData.push({ time, value: signalMap.get(time) });
            histData.push({ 
                time, 
                value: histMap.get(time),
                color: histMap.get(time) >= 0 ? '#26a69a' : '#f44336'
            });
        } else {
            // Для первых свечей, где индикатор не рассчитан — не добавляем точки
            // Линия начнётся с первой точки данных
        }
    });
    
    // Обновляем линии
    if (this.series[0]) this.series[0].setData(macdData);
    if (this.series[1]) this.series[1].setData(signalData);
    if (this.series[2]) this.series[2].setData(histData);
    
    // Синхронизируем шкалу времени панели
    if (panelManager && panelManager.panels.has(panelId)) {
        const panel = panelManager.panels.get(panelId);
        if (panel && panel.chart) {
            const mainRange = this.manager.chartManager.chart.timeScale().getVisibleLogicalRange();
            if (mainRange) {
                panel.chart.timeScale().setVisibleLogicalRange(mainRange);
            }
        }
    }

 setTimeout(() => {
        if (this.manager) this.manager.syncAllIndicatorPanels();
    }, 50);
}
}

class MultiTimeframeATRIndicator extends BaseIndicator {
    constructor(manager) {
        super(manager, 'multiatr', 'ATR Multi', '#FFA500', 'main');
        
        this.settings = {
            atrPeriod: 3,
            rangeMode: 'High-Low',
            useFilter: true,
            filterType: 'Adaptive',
            devFactor: 1.0,
            fixedMult: 1.5,
            showWeekTF: true,
            weekATRPeriod: 5,
            showDayTF: true,
            dayATRPeriod: 5,
            showHourTF: true,
            hourATRPeriod: 24,
            hourTF: '1',
            showMinuteTF: true,
            minuteATRPeriod: 3,
            minuteTF: '5',
            showMinute1TF: true,
            minute1ATRPeriod: 1,
            minute1TF: '1',
            showTable: true
        };
        
        this.cache = {
            week: { atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0 },
            day: { atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0 },
            hour: { atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0 },
            minute: { atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0 },
            minute1: { atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0 },
            current: { atr: 0, natr: 0, progress: 0, remaining: 0, rangeRatio: 0, trueRange: 0, isValid: true, upperBound: 0, lowerBound: 0 }
        };
        
        this._lastCandleTime = 0;
        this._setupEventHandlers();
        setTimeout(() => this.updateAllMetrics(), 500);
    }
    
    // Переопределяем геттер/сеттер для visible, чтобы глазок работал
    get visible() {
        return this._visible;
    }
    
    set visible(value) {
        this._visible = value;
        const table = document.getElementById('multiatr-full-table');
        if (table) {
            table.style.display = value ? 'block' : 'none';
        }
        // Сохраняем состояние
        if (this.manager) {
            this.manager._saveIndicators();
        }
    }
    
    getWorkerType() { return null; }
    calculateAsync() {}
    
    calculateRMA(values, period) {
        if (!values || values.length === 0) return [];
        const rma = [];
        let sum = 0;
        for (let i = 0; i < period && i < values.length; i++) sum += values[i];
        rma.push(sum / period);
        for (let i = period; i < values.length; i++) {
            rma.push((values[i] + (period - 1) * rma[rma.length - 1]) / period);
        }
        return rma;
    }
    
    calculateTrueRange(high, low, prevClose, mode) {
        if (mode === 'True Range') {
            return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        }
        return high - low;
    }
    
    calculateCandlesFromHours(hours, minuteTFStr) {
        const minuteValue = parseInt(minuteTFStr);
        const candles = Math.floor(hours * 60 / minuteValue);
        return Math.max(candles, 1);
    }
    
    computeATRMetrics(data, period, rangeMode, useFilter, filterType, devFactor, fixedMult) {
        if (!data || data.length < period + 1) {
            return {
                atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0,
                trueRange: 0, rangeRatio: 0, upperBound: 0, lowerBound: 0, isValid: true
            };
        }
    
        const trueRanges = [];
        const rawATR = [];
        const filteredATR = [];
    
        for (let i = 1; i < data.length; i++) {
            const tr = this.calculateTrueRange(data[i].high, data[i].low, data[i-1].close, rangeMode);
            trueRanges.push(tr);
        }
    
        if (trueRanges.length < period) {
            return {
                atr: 0, natr: 0, progress: 0, remaining: 0, remainingPoints: 0,
                trueRange: 0, rangeRatio: 0, upperBound: 0, lowerBound: 0, isValid: true
            };
        }
    
        for (let i = 0; i < trueRanges.length; i++) {
            const tr = trueRanges[i];
    
            if (i === 0) {
                rawATR[i] = tr;
            } else {
                rawATR[i] = (tr + (period - 1) * rawATR[i-1]) / period;
            }
    
            let currentValue = tr;
            let upper = 0, lower = 0;
    
            if (useFilter && i >= period) {
                const window = trueRanges.slice(i - period, i);
                const mean = window.reduce((a,b) => a+b, 0) / period;
                const variance = window.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / period;
                const stdDev = Math.sqrt(variance);
                const robustVal = rawATR[i];
    
                if (filterType === 'Adaptive') {
                    upper = Math.min(robustVal + stdDev * devFactor, robustVal * 3.0);
                    lower = Math.max(robustVal - stdDev * devFactor, 0);
                    lower = Math.max(lower, robustVal * 0.3);
                } else {
                    upper = robustVal * fixedMult;
                    lower = Math.max(robustVal / fixedMult, 0);
                }
    
                const isValid = tr <= upper && tr >= lower;
                if (!isValid) {
                    currentValue = filteredATR[i-1];
                }
            }
    
            if (i === 0) {
                filteredATR[i] = currentValue;
            } else {
                filteredATR[i] = (currentValue + (period - 1) * filteredATR[i-1]) / period;
            }
        }
    
        const lastIndex = trueRanges.length - 1;
        const atr = filteredATR[lastIndex];
        const lastCandle = data[data.length - 1];
        const lastTrueRange = trueRanges[lastIndex];
        const distanceFromOpen = Math.abs(lastCandle.close - lastCandle.open);
        const progress = atr > 0 ? (distanceFromOpen / atr) * 100 : 0;
        const remaining = Math.max(0, 100 - progress);
        const remainingPoints = Math.max(0, atr - distanceFromOpen);
        const natr = lastCandle.close > 0 ? (atr / lastCandle.close) * 100 : 0;
    
        const prevATR = lastIndex > 0 ? filteredATR[lastIndex-1] : atr;
        const rangeRatio = prevATR > 0 ? (lastTrueRange / prevATR) * 100 : 0;
    
        let upperBound = 0, lowerBound = 0;
        if (useFilter && lastIndex >= period) {
            const window = trueRanges.slice(lastIndex - period, lastIndex);
            const mean = window.reduce((a,b) => a+b, 0) / period;
            const variance = window.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / period;
            const stdDev = Math.sqrt(variance);
            const robustVal = rawATR[lastIndex];
            if (filterType === 'Adaptive') {
                upperBound = Math.min(robustVal + stdDev * devFactor, robustVal * 3.0);
                lowerBound = Math.max(robustVal - stdDev * devFactor, 0);
                lowerBound = Math.max(lowerBound, robustVal * 0.3);
            } else {
                upperBound = robustVal * fixedMult;
                lowerBound = Math.max(robustVal / fixedMult, 0);
            }
        }
    
        return {
            atr, natr, progress, remaining, remainingPoints,
            trueRange: lastTrueRange, rangeRatio, upperBound, lowerBound, isValid: true
        };
    }
    
    calculateMetricsForData(data, period, closePrice) {
        const metrics = this.computeATRMetrics(data, period, this.settings.rangeMode,
            this.settings.useFilter, this.settings.filterType,
            this.settings.devFactor, this.settings.fixedMult);
        return {
            atr: metrics.atr,
            natr: metrics.natr,
            progress: metrics.progress,
            remaining: metrics.remaining,
            remainingPoints: metrics.remainingPoints
        };
    }
    
    calculateCurrentMetrics(data, period) {
        const closedData = data.slice(0, -1);
        if (closedData.length < period + 1) {
            return {
                atr: 0, natr: 0, trueRange: 0, rangeRatio: 0,
                progress: 0, remaining: 0, upperBound: 0, lowerBound: 0, isValid: true
            };
        }
        const metrics = this.computeATRMetrics(closedData, period, this.settings.rangeMode,
            this.settings.useFilter, this.settings.filterType,
            this.settings.devFactor, this.settings.fixedMult);
        return {
            atr: metrics.atr,
            natr: metrics.natr,
            trueRange: metrics.trueRange,
            rangeRatio: metrics.rangeRatio,
            progress: metrics.progress,
            remaining: metrics.remaining,
            upperBound: metrics.upperBound,
            lowerBound: metrics.lowerBound,
            isValid: metrics.isValid
        };
    }
    
    async updateAllMetrics() {
        const chartManager = this.manager.chartManager;
        if (!chartManager) return;
    
        const currentData = chartManager.chartData;
        if (!currentData || currentData.length === 0) return;
    
        this.cache.current = this.calculateCurrentMetrics(currentData, this.settings.atrPeriod);
        const closePrice = currentData[currentData.length - 1].close;
    
        if (this.settings.showWeekTF) {
            const limit = Math.max(200, this.settings.weekATRPeriod * 3);
            const data = await this.fetchDataForTF('1w', limit);
            if (data && data.length > this.settings.weekATRPeriod) {
                const metrics = this.computeATRMetrics(data, this.settings.weekATRPeriod,
                    this.settings.rangeMode, this.settings.useFilter,
                    this.settings.filterType, this.settings.devFactor, this.settings.fixedMult);
                this.cache.week = {
                    atr: metrics.atr,
                    natr: metrics.natr,
                    progress: metrics.progress,
                    remaining: metrics.remaining,
                    remainingPoints: metrics.remainingPoints
                };
            }
        }
    
        if (this.settings.showDayTF) {
            const limit = Math.max(200, this.settings.dayATRPeriod * 3);
            const data = await this.fetchDataForTF('1d', limit);
            if (data && data.length > this.settings.dayATRPeriod) {
                const metrics = this.computeATRMetrics(data, this.settings.dayATRPeriod,
                    this.settings.rangeMode, this.settings.useFilter,
                    this.settings.filterType, this.settings.devFactor, this.settings.fixedMult);
                this.cache.day = {
                    atr: metrics.atr,
                    natr: metrics.natr,
                    progress: metrics.progress,
                    remaining: metrics.remaining,
                    remainingPoints: metrics.remainingPoints
                };
            }
        }
    
        if (this.settings.showHourTF) {
            const hourTF = this.settings.hourTF + 'h';
            const limit = Math.max(200, this.settings.hourATRPeriod * 3);
            const data = await this.fetchDataForTF(hourTF, limit);
            if (data && data.length > this.settings.hourATRPeriod) {
                const metrics = this.computeATRMetrics(data, this.settings.hourATRPeriod,
                    this.settings.rangeMode, this.settings.useFilter,
                    this.settings.filterType, this.settings.devFactor, this.settings.fixedMult);
                this.cache.hour = {
                    atr: metrics.atr,
                    natr: metrics.natr,
                    progress: metrics.progress,
                    remaining: metrics.remaining,
                    remainingPoints: metrics.remainingPoints
                };
            }
        }
    
        if (this.settings.showMinuteTF) {
            const minuteTF = this.settings.minuteTF + 'm';
            const period = this.calculateCandlesFromHours(this.settings.minuteATRPeriod, this.settings.minuteTF);
            const limit = Math.max(period * 3, 200);
            const data = await this.fetchDataForTF(minuteTF, limit);
            if (data && data.length > period) {
                const metrics = this.computeATRMetrics(data, period,
                    this.settings.rangeMode, this.settings.useFilter,
                    this.settings.filterType, this.settings.devFactor, this.settings.fixedMult);
                this.cache.minute = {
                    atr: metrics.atr,
                    natr: metrics.natr,
                    progress: metrics.progress,
                    remaining: metrics.remaining,
                    remainingPoints: metrics.remainingPoints
                };
            }
        }
    
        if (this.settings.showMinute1TF) {
            const minute1TF = this.settings.minute1TF + 'm';
            const period = this.calculateCandlesFromHours(this.settings.minute1ATRPeriod, this.settings.minute1TF);
            const limit = Math.max(period * 3, 200);
            const data = await this.fetchDataForTF(minute1TF, limit);
            if (data && data.length > period) {
                const metrics = this.computeATRMetrics(data, period,
                    this.settings.rangeMode, this.settings.useFilter,
                    this.settings.filterType, this.settings.devFactor, this.settings.fixedMult);
                this.cache.minute1 = {
                    atr: metrics.atr,
                    natr: metrics.natr,
                    progress: metrics.progress,
                    remaining: metrics.remaining,
                    remainingPoints: metrics.remainingPoints
                };
            }
        }
    
        if (this.settings.showTable) this.renderFullTable();
    }
    
    _setupEventHandlers() {
        const chartManager = this.manager.chartManager;
        if (chartManager) {
            if (chartManager._subscribeToSymbolChange) {
                chartManager._subscribeToSymbolChange(() => {
                    setTimeout(() => this.updateAllMetrics(), 500);
                });
            }
            if (chartManager.on && typeof chartManager.on === 'function') {
                chartManager.on('dataUpdate', () => this._onChartDataUpdate());
            } else {
                this._startFallbackTimer();
            }
        }
    }
    
    _onChartDataUpdate() {
        const chartManager = this.manager.chartManager;
        if (!chartManager) return;
        const data = chartManager.chartData;
        if (!data || data.length === 0) return;
        const lastCandle = data[data.length - 1];
        if (lastCandle.time !== this._lastCandleTime) {
            this._lastCandleTime = lastCandle.time;
            this.updateAllMetrics();
        }
    }
    
    _startFallbackTimer() {
        let lastTime = 0;
        setInterval(() => {
            const chartManager = this.manager.chartManager;
            if (!chartManager) return;
            const data = chartManager.chartData;
            if (data && data.length) {
                const t = data[data.length - 1].time;
                if (t !== lastTime) {
                    lastTime = t;
                    this.updateAllMetrics();
                }
            }
        }, 5000);
    }
    
    async fetchDataForTF(tf, limit) {
        const chartManager = this.manager.chartManager;
        const symbol = chartManager.currentSymbol;
        const exchange = chartManager.currentExchange;
        const marketType = chartManager.currentMarketType;
        
        const bybitIntervalMap = {
            '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
            '1h': '60', '4h': '240', '6h': '360', '12h': '720',
            '1d': 'D', '1w': 'W'
        };
        
        let url;
        if (exchange === 'binance') {
            if (marketType === 'futures') {
                url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`;
            } else {
                url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`;
            }
        } else {
            const bybitInterval = bybitIntervalMap[tf] || tf;
            const category = marketType === 'futures' ? 'linear' : 'spot';
            url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            
            if (exchange === 'binance') {
                if (!Array.isArray(data)) return [];
                return data.map(item => ({
                    time: Math.floor(item[0] / 1000) + 10800,
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                    volume: parseFloat(item[5])
                }));
            } else {
                if (data.retCode !== 0 || !data.result?.list) return [];
                const candles = data.result.list;
                return candles.map(item => ({
                    time: Math.floor(parseInt(item[0]) / 1000) ,
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                    volume: parseFloat(item[5] || 0)
                })).filter(c => c !== null)
            }
        } catch (e) {
            return [];
        }
    }
    
    renderFullTable() {
        const existing = document.getElementById('multiatr-full-table');
        if (existing) existing.remove();
        
        const c = this.cache;
        const current = c.current;
        const currentChartTF = this.manager?.chartManager?.currentInterval || '1h';
        
      const formatATR = (v) => {
    if (!v || v === 0) return '—';
    // 8 знаков после запятой хватит почти для всех монет
    return parseFloat(v.toFixed(8)).toString();
};
        
        const formatPercent = (v) => v > 0 ? v.toFixed(1) + '%' : '—%';
        const progressColor = (p) => p > 80 ? '#FF4444' : p > 50 ? '#FFA500' : '#FFFFFF';
        const remainingColor = (r) => r < 20 ? '#FF4444' : r < 50 ? '#FFA500' : '#FFFFFF';
        
        const tableDiv = document.createElement('div');
        tableDiv.id = 'multiatr-full-table';
        tableDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(10, 10, 26, 0.95);
            border: 1px solid #2A2A4A;
            border-radius: 8px;
            padding: 10px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: #fff;
            z-index: 10000;
            backdrop-filter: blur(4px);
            min-width: 380px;
            display: ${this.visible !== false ? 'block' : 'none'};
        `;
        
        const modeText = this.settings.rangeMode === 'True Range' ? 'TR' : 'HL';
        const filterText = this.settings.useFilter ? 
            (this.settings.filterType === 'Adaptive' ? `✓A${this.settings.devFactor}` : `✓F${this.settings.fixedMult}`) : '✗Filter';
        
        let rowsHTML = `
            <div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #3A3A5A;">
                <span style="color:#22E00F; font-weight:bold;">📊 ATR MULTI</span>
                <span style="color:#888; margin-left:8px; font-size:10px;">${modeText} | ${filterText}</span>
                <span style="color:#FFA500; margin-left:8px; font-size:10px;">Period: ${this.settings.atrPeriod}</span>
            </div>
            <table style="border-collapse:collapse; width:100%;">
                <tr style="border-bottom:1px solid #3A3A5A;">
                    <th style="text-align:left; padding:2px 4px; color:#22E00F;">Таймфрейм</th>
                    <th style="text-align:right; padding:2px 4px; color:#22E00F;">ATR</th>
                    <th style="text-align:right; padding:2px 4px; color:#22E00F;">NATR</th>
                    <th style="text-align:right; padding:2px 4px; color:#22E00F;">Пройдено</th>
                    <th style="text-align:right; padding:2px 4px; color:#22E00F;">Остаток</th>
                    <th style="text-align:center; padding:2px 4px; color:#22E00F;">📋</th>
                 </tr>
        `;
        
        const addRow = (label, color, atrValue, natr, progress, remaining) => {
           const atrFormatted = formatATR(atrValue);
const copyValue = atrValue.toString(); // точное число для копирования
const copyBtnHtml = atrFormatted !== '—' ? `
    <td style="text-align:center; padding:2px 4px;">
        <button class="copy-button" data-value="${copyValue}" style="...">
            <span class="copy-icon"></span>
        </button>
    </td>
` : `<td style="text-align:center; padding:2px 4px;">—</td>`;
            
            return `
                <tr>
                    <td style="padding:2px 4px; color:${color};">${label}</td>
                    <td style="text-align:right; padding:2px 4px; color:#FFFFFF;">${atrFormatted}</td>
                    <td style="text-align:right; padding:2px 4px; color:#FFFFFF;">${formatPercent(natr)}</td>
                    <td style="text-align:right; padding:2px 4px; color:${progressColor(progress)};">${formatPercent(progress)}</td>
                    <td style="text-align:right; padding:2px 4px; color:${remainingColor(remaining)};">${formatPercent(remaining)}</td>
                    ${copyBtnHtml}
                </tr>
            `;
        };
        
        if (this.settings.showWeekTF) {
            rowsHTML += addRow(`W (${this.settings.weekATRPeriod})`, '#FFA500', c.week.atr, c.week.natr, c.week.progress, c.week.remaining);
        }
        if (this.settings.showDayTF) {
            rowsHTML += addRow(`D (${this.settings.dayATRPeriod})`, '#4A90E2', c.day.atr, c.day.natr, c.day.progress, c.day.remaining);
        }
        if (this.settings.showHourTF) {
            rowsHTML += addRow(`${this.settings.hourTF}H (${this.settings.hourATRPeriod})`, '#FF69B4', c.hour.atr, c.hour.natr, c.hour.progress, c.hour.remaining);
        }
        if (this.settings.showMinuteTF) {
            rowsHTML += addRow(`${this.settings.minuteTF}M (${this.settings.minuteATRPeriod}ч)`, '#0F0', c.minute.atr, c.minute.natr, c.minute.progress, c.minute.remaining);
        }
        if (this.settings.showMinute1TF) {
            rowsHTML += addRow(`${this.settings.minute1TF}M (${this.settings.minute1ATRPeriod}ч)`, '#0FF', c.minute1.atr, c.minute1.natr, c.minute1.progress, c.minute1.remaining);
        }
        
        rowsHTML += `<tr style="border-top:1px solid #3A3A5A;">`;
        rowsHTML += addRow(`${currentChartTF} (${this.settings.atrPeriod})`, '#FF0', current.atr, current.natr, current.progress, current.remaining);
        
        rowsHTML += `
            <tr style="border-top:1px solid #3A3A5A;">
                <td style="padding:2px 4px; color:#888;">Текущая свеча</td>
                <td style="text-align:right; padding:2px 4px; color:#FFFFFF;">${formatATR(current.trueRange)}</td>
                <td style="text-align:right; padding:2px 4px; color:${current.rangeRatio > 100 ? '#F44' : '#0F0'};">${formatPercent(current.rangeRatio)}</td>
                <td style="text-align:right;">—</td>
                <td style="text-align:right;">—</td>
                <td style="text-align:center;">—</td>
            </tr>
        `;
        
        if (this.settings.useFilter) {
            rowsHTML += `
                <tr>
                    <td style="padding:2px 4px; color:#888; font-size:9px;" colspan="6">Фильтр: U:${formatATR(current.upperBound)} L:${formatATR(current.lowerBound)}</td>
                </tr>
            `;
        }
        
        rowsHTML += `</table>`;
        tableDiv.innerHTML = rowsHTML;
        
        // Обработчики копирования
        const btns = tableDiv.querySelectorAll('.copy-button');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.getAttribute('data-value');
                if (value && value !== '—') {
                    navigator.clipboard.writeText(value).then(() => {
                        btn.classList.add('copied');
                        setTimeout(() => btn.classList.remove('copied'), 1000);
                    }).catch(() => {});
                }
            });
        });
        
        document.body.appendChild(tableDiv);
    }
    
    getSettingsHTML() {
        return `
            <div style="max-height:400px; overflow-y:auto; padding-right:5px; scrollbar-width: thin; scrollbar-color: #4A4A4A #1E1E1E;">
                <div style="margin-bottom:12px;">
                    <div style="color:#FFA500; margin-bottom:8px;">📊 Основные настройки</div>
                    <div style="margin-bottom:8px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:120px;">Период ATR (дни):</label><input type="number" id="atrPeriod" value="${this.settings.atrPeriod}" min="1" max="50" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:80px;"></div>
                    <div style="margin-bottom:8px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:120px;">Режим расчета диапазона:</label><select id="rangeMode" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px;"><option value="High-Low">High-Low</option><option value="True Range" ${this.settings.rangeMode === 'True Range' ? 'selected' : ''}>True Range</option></select></div>
                    <div style="margin-bottom:8px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:120px;">Включить фильтр:</label><input type="checkbox" id="useFilter" ${this.settings.useFilter ? 'checked' : ''} style="accent-color:#4A90E2;"></div>
                    <div id="filterSettings" style="margin-left:130px; ${!this.settings.useFilter ? 'display:none;' : ''}">
                        <div style="margin-bottom:8px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:80px;">Тип фильтра:</label><select id="filterType" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px;"><option value="Adaptive">Adaptive</option><option value="Fixed" ${this.settings.filterType === 'Fixed' ? 'selected' : ''}>Fixed</option></select></div>
                        <div id="adaptiveSettings" style="margin-bottom:8px; ${this.settings.filterType !== 'Adaptive' ? 'display:none;' : ''} display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:80px;">Коэффициент отклонения:</label><input type="number" id="devFactor" min="0.1" max="2.0" step="0.1" value="${this.settings.devFactor}" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:80px;"></div>
                        <div id="fixedSettings" style="margin-bottom:8px; ${this.settings.filterType !== 'Fixed' ? 'display:none;' : ''} display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:80px;">Фиксированный множитель:</label><input type="number" id="fixedMult" min="1.1" max="3.0" step="0.1" value="${this.settings.fixedMult}" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:80px;"></div>
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="color:#FFA500; margin-bottom:8px;">📅 Дополнительные таймфреймы</div>
                    <div style="margin-bottom:6px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:70px;">W ATR:</label><input type="checkbox" id="showWeekTF" ${this.settings.showWeekTF ? 'checked' : ''}><input type="number" id="weekATRPeriod" value="${this.settings.weekATRPeriod}" min="1" max="20" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:60px;"></div>
                    <div style="margin-bottom:6px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:70px;">D ATR:</label><input type="checkbox" id="showDayTF" ${this.settings.showDayTF ? 'checked' : ''}><input type="number" id="dayATRPeriod" value="${this.settings.dayATRPeriod}" min="1" max="20" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:60px;"></div>
                    <div style="margin-bottom:6px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:70px;">H ATR:</label><input type="checkbox" id="showHourTF" ${this.settings.showHourTF ? 'checked' : ''}><select id="hourTF" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px;">${['1','2','3','4','6','8','12'].map(v => `<option value="${v}" ${this.settings.hourTF === v ? 'selected' : ''}>${v}</option>`).join('')}</select><input type="number" id="hourATRPeriod" value="${this.settings.hourATRPeriod}" min="1" max="100" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:60px;"></div>
                    <div style="margin-bottom:6px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:70px;">M ATR:</label><input type="checkbox" id="showMinuteTF" ${this.settings.showMinuteTF ? 'checked' : ''}><select id="minuteTF" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px;">${['1','2','3','5','10','15','30'].map(v => `<option value="${v}" ${this.settings.minuteTF === v ? 'selected' : ''}>${v}</option>`).join('')}</select><input type="number" id="minuteATRPeriod" value="${this.settings.minuteATRPeriod}" min="1" max="24" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:60px;"><span style="color:#888;">ч</span></div>
                    <div style="margin-bottom:6px; display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:70px;">1M ATR:</label><input type="checkbox" id="showMinute1TF" ${this.settings.showMinute1TF ? 'checked' : ''}><select id="minute1TF" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px;">${['1','2','3','5','10','15','30'].map(v => `<option value="${v}" ${this.settings.minute1TF === v ? 'selected' : ''}>${v}</option>`).join('')}</select><input type="number" id="minute1ATRPeriod" value="${this.settings.minute1ATRPeriod}" min="1" max="24" style="background:#1E1E1E; border:1px solid #404040; color:#fff; border-radius:4px; padding:4px 8px; width:60px;"><span style="color:#888;">ч</span></div>
                </div>
                <div><div style="color:#FFA500; margin-bottom:8px;">🎨 Отображение</div><div style="display:flex; align-items:center; gap:10px;"><label style="color:#B0B0B0; width:120px;">Показывать таблицу:</label><input type="checkbox" id="showTable" ${this.settings.showTable ? 'checked' : ''} style="accent-color:#4A90E2;"></div></div>
            </div>
        `;
    }
    
    applySettingsFromForm() {
        this.settings.atrPeriod = parseInt(document.getElementById('atrPeriod')?.value || 3);
        this.settings.rangeMode = document.getElementById('rangeMode')?.value || 'High-Low';
        this.settings.useFilter = document.getElementById('useFilter')?.checked || false;
        this.settings.filterType = document.getElementById('filterType')?.value || 'Adaptive';
        this.settings.devFactor = parseFloat(document.getElementById('devFactor')?.value || 1);
        this.settings.fixedMult = parseFloat(document.getElementById('fixedMult')?.value || 1.5);
        this.settings.showWeekTF = document.getElementById('showWeekTF')?.checked || false;
        this.settings.weekATRPeriod = parseInt(document.getElementById('weekATRPeriod')?.value || 5);
        this.settings.showDayTF = document.getElementById('showDayTF')?.checked || false;
        this.settings.dayATRPeriod = parseInt(document.getElementById('dayATRPeriod')?.value || 5);
        this.settings.showHourTF = document.getElementById('showHourTF')?.checked || false;
        this.settings.hourTF = document.getElementById('hourTF')?.value || '1';
        this.settings.hourATRPeriod = parseInt(document.getElementById('hourATRPeriod')?.value || 24);
        this.settings.showMinuteTF = document.getElementById('showMinuteTF')?.checked || false;
        this.settings.minuteTF = document.getElementById('minuteTF')?.value || '5';
        this.settings.minuteATRPeriod = parseInt(document.getElementById('minuteATRPeriod')?.value || 3);
        this.settings.showMinute1TF = document.getElementById('showMinute1TF')?.checked || false;
        this.settings.minute1TF = document.getElementById('minute1TF')?.value || '1';
        this.settings.minute1ATRPeriod = parseInt(document.getElementById('minute1ATRPeriod')?.value || 1);
        this.settings.showTable = document.getElementById('showTable')?.checked || true;
        
        this.updateAllMetrics();
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        this.series.forEach(s => { try { this.manager.chartManager.chart.removeSeries(s); } catch(e) {} });
        this.series = [];
    }
    
    updateSeriesData(data) {
        if (data && data.length) {
            const lastTime = data[data.length - 1].time;
            if (lastTime !== this._lastCandleTime) {
                this._lastCandleTime = lastTime;
                this.updateAllMetrics();
            }
        }
    }
}

class RSI14Indicator extends BaseIndicator {
    constructor(manager) {
        super(manager, 'rsi14', 'RSI 14', '#FFA500', 'rsi');
        this.settings.period = 14;
        this.settings.levels = [30, 70];
    }
    
    getWorkerType() {
        return 'rsi';
    }
    
    getWorkerParams() {
        return { period: this.settings.period };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Период RSI:</label>
                <input type="number" id="indicatorPeriod" value="${this.settings.period}" min="5" max="50" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const periodInput = document.getElementById('indicatorPeriod');
        if (periodInput) this.settings.period = parseInt(periodInput.value);
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        // Удаляем старые серии
        this.series.forEach(s => {
            if (s) panelManager.removeSeries(panelId, null, s);
        });
        this.series = [];
        
        // Создаём основную линию RSI
        const lineSeries = panelManager.addSeries(panelId, `${this.type}-line`, 'line', {
            color: this.settings.color,
            lineWidth: this.settings.lineWidth
        });
        
        // Создаём уровни 30 и 70
        const level30Series = panelManager.addSeries(panelId, `${this.type}-level30`, 'line', {
            color: '#808080',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed
        });
        
        const level70Series = panelManager.addSeries(panelId, `${this.type}-level70`, 'line', {
            color: '#808080',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed
        });
        
        this.series = [lineSeries, level30Series, level70Series];
    }
    
   updateSeriesData(data) {
    if (!data || !data.length) return;
    
    const panelManager = this.manager.panelManager;
    const panelId = this.data.panel;
    
    // Получаем все свечи с основного графика
    const chartData = this.manager.chartManager.chartData;
    if (!chartData || chartData.length === 0) return;
    
    // Создаём массив с null для первых свечей, где RSI не рассчитан
    const rsiData = [];
    const rsiMap = new Map();
    
    // Индексируем полученные данные RSI по времени
    data.forEach(item => {
        rsiMap.set(item.time, item.value);
    });
    
    // Проходим по всем свечам и добавляем значение RSI, если есть
    chartData.forEach(candle => {
        if (rsiMap.has(candle.time)) {
            rsiData.push({
                time: candle.time,
                value: rsiMap.get(candle.time)
            });
        } else {
            // Для свечей, где RSI ещё не рассчитан, не добавляем точку
            // (линия будет начинаться с первой точки данных)
            // Можно добавить null, но это может разорвать линию
        }
    });
    
    // Обновляем основную линию RSI
    if (this.series[0]) {
        this.series[0].setData(rsiData);
    }
    
    // Обновляем уровни 30 и 70 (они должны быть на всём диапазоне)
    const level30Data = chartData.map(candle => ({ time: candle.time, value: 30 }));
    const level70Data = chartData.map(candle => ({ time: candle.time, value: 70 }));
    
    if (this.series[1]) {
        this.series[1].setData(level30Data);
    }
    if (this.series[2]) {
        this.series[2].setData(level70Data);
    }
 setTimeout(() => {
        if (this.manager) this.manager.syncAllIndicatorPanels();
    }, 50);
}
}

class SMAIndicator extends BaseIndicator {
    constructor(manager, period, name, color) {
        super(manager, `sma${period}`, name, color, 'main');
        this.settings.period = period;
    }
    
    getWorkerType() {
        return 'sma';
    }
    
    getWorkerParams() {
        return { period: this.settings.period };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Период SMA:</label>
                <input type="number" id="indicatorPeriod" value="${this.settings.period}" min="1" max="200" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const periodInput = document.getElementById('indicatorPeriod');
        if (periodInput) this.settings.period = parseInt(periodInput.value);
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        // Удаляем старые серии
        this.series.forEach(s => {
            if (s) {
                try {
                    this.manager.chartManager.chart.removeSeries(s);
                } catch(e) {}
            }
        });
        this.series = [];
        
        // Создаём новую пустую линию
        const series = this.manager.chartManager.chart.addSeries(LightweightCharts.LineSeries, {
            color: this.settings.color,
            lineWidth: this.settings.lineWidth
        });
        
        this.series = [series];
    }
    
    updateSeriesData(data) {
        if (!data || !data.length) return;
        if (this.series[0]) {
            this.series[0].setData(this.manager._filterData(data));
        }
    }
}

class StochRSIIndicator extends BaseIndicator {
    constructor(manager) {
        super(manager, 'stochrsi', 'Stochastic RSI', '#87CEEB', 'stoch');
        this.settings.period = 14;
        this.settings.k = 3;
        this.settings.d = 3;
    }
    
    getWorkerType() {
        return 'stochrsi';
    }
    
    getWorkerParams() {
        return {
            period: this.settings.period,
            k: this.settings.k,
            d: this.settings.d
        };
    }
    
    getSettingsHTML() {
        return `
            ${super.getSettingsHTML()}
            <div class="settings-row">
                <label>Период:</label>
                <input type="number" id="indicatorPeriod" value="${this.settings.period}" min="5" max="50" style="width: 70px;">
            </div>
            <div class="settings-row">
                <label>%K:</label>
                <input type="number" id="indicatorK" value="${this.settings.k}" min="1" max="10" style="width: 70px;">
            </div>
            <div class="settings-row">
                <label>%D:</label>
                <input type="number" id="indicatorD" value="${this.settings.d}" min="1" max="10" style="width: 70px;">
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const periodInput = document.getElementById('indicatorPeriod');
        const kInput = document.getElementById('indicatorK');
        const dInput = document.getElementById('indicatorD');
        
        if (periodInput) this.settings.period = parseInt(periodInput.value);
        if (kInput) this.settings.k = parseInt(kInput.value);
        if (dInput) this.settings.d = parseInt(dInput.value);
        
        super.applySettingsFromForm();
    }
    
    _createEmptySeries() {
        const panelManager = this.manager.panelManager;
        const panelId = this.data.panel;
        
        this.series.forEach(s => {
            if (s) panelManager.removeSeries(panelId, null, s);
        });
        this.series = [];
        
        const kSeries = panelManager.addSeries(panelId, `${this.type}-k`, 'line', {
            color: '#87CEEB',
            lineWidth: this.settings.lineWidth
        });
        
        const dSeries = panelManager.addSeries(panelId, `${this.type}-d`, 'line', {
            color: '#FFA500',
            lineWidth: this.settings.lineWidth
        });
        
        this.series = [kSeries, dSeries];
    }
    
  updateSeriesData(data) {
    console.log('StochRSI updateSeriesData called, data:', {
        hasK: !!data?.k,
        hasD: !!data?.d,
        hasTimes: !!data?.times,
        kLength: data?.k?.length,
        timesLength: data?.times?.length
    });
    
    if (!data || !data.k || !data.d || !data.times) {
        console.warn('StochRSI: нет данных');
        return;
    }
    
    const panelManager = this.manager.panelManager;
    const panelId = this.data.panel;
    
    const chartData = this.manager.chartManager.chartData;
    if (!chartData || chartData.length === 0) {
        console.warn('StochRSI: нет свечей');
        return;
    }
    
    console.log('StochRSI: chartData length:', chartData.length);
    console.log('StochRSI: data.times length:', data.times.length);
    console.log('StochRSI: first data time:', data.times[0]);
    console.log('StochRSI: last data time:', data.times[data.times.length - 1]);
    console.log('StochRSI: first chart time:', chartData[0].time);
    console.log('StochRSI: last chart time:', chartData[chartData.length - 1].time);
    
    // Индексируем данные
    const kMap = new Map();
    const dMap = new Map();
    
    for (let i = 0; i < data.times.length; i++) {
        kMap.set(data.times[i], data.k[i]);
        dMap.set(data.times[i], data.d[i]);
    }
    
    // Создаём массивы для всех свечей
    const kData = [];
    const dData = [];
    
    for (let i = 0; i < chartData.length; i++) {
        const time = chartData[i].time;
        if (kMap.has(time)) {
            kData.push({ time, value: kMap.get(time) });
            dData.push({ time, value: dMap.get(time) });
        } else {
            kData.push({ time, value: null });
            dData.push({ time, value: null });
        }
    }
    
    console.log('StochRSI: создано kData точек:', kData.length);
    console.log('StochRSI: из них с данными:', kData.filter(p => p.value !== null).length);
    
    // Обновляем линии
    if (this.series[0]) {
        this.series[0].setData(kData);
        console.log('StochRSI: K линия обновлена');
    }
    if (this.series[1]) {
        this.series[1].setData(dData);
        console.log('StochRSI: D линия обновлена');
    }
    
    // Синхронизируем шкалу времени
    if (panelManager && panelManager.panels.has(panelId)) {
        const panel = panelManager.panels.get(panelId);
        if (panel && panel.chart) {
            const mainRange = this.manager.chartManager.chart.timeScale().getVisibleLogicalRange();
            if (mainRange) {
                panel.chart.timeScale().setVisibleLogicalRange(mainRange);
            }
        }
    }
 setTimeout(() => {
        if (this.manager) this.manager.syncAllIndicatorPanels();
    }, 50);
}
}
if (typeof window !== 'undefined') {
    window.SMAIndicator = SMAIndicator;
    window.EMAIndicator = EMAIndicator;
    window.RSI14Indicator = RSI14Indicator;
    window.MACDIndicator = MACDIndicator;
    window.StochRSIIndicator = StochRSIIndicator;
    window.ADXIndicator = ADXIndicator;
    window.ATRIndicator = ATRIndicator;
    window.MultiTimeframeATRIndicator = MultiTimeframeATRIndicator;
}