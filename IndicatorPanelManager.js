class IndicatorPanelManager {
    constructor(container, chartManager) {
        this.container = container;
        this.chartManager = chartManager;
        this.panels = new Map(); // id -> { wrapper, chart, series, height, isCollapsed }
        this.activeResizer = null;
        this.startY = 0;
        this.startHeight = 0;
        
        this._initEvents();
    }
    
    _initEvents() {
        // Глобальные события для ресайза
        document.addEventListener('mousemove', this._onMouseMove.bind(this));
        document.addEventListener('mouseup', this._onMouseUp.bind(this));
    }
    
    createPanel(id, title, defaultHeight = 150, minHeight = 80, maxHeight = 400) {
    // Проверяем, не существует ли уже
    if (this.panels.has(id)) return this.panels.get(id);
    
    // Создаем обертку
    const wrapper = document.createElement('div');
    wrapper.className = 'indicator-panel-wrapper';
    wrapper.style.height = `${defaultHeight}px`;
    wrapper.dataset.panelId = id;
    
    // Заголовок
    const header = document.createElement('div');
    header.className = 'indicator-panel-header';
    header.innerHTML = `
        <div class="indicator-panel-title">
            <span> ${title}</span>
        </div>
        <div class="indicator-panel-actions">
            <button class="indicator-panel-btn collapse-btn" title="Свернуть">▼</button>
            <button class="indicator-panel-btn close-btn" title="Закрыть">✕</button>
        </div>
    `;
    
    // Контент
    const content = document.createElement('div');
    content.className = 'indicator-panel-content';
    
    // Ресайзер (верхняя граница)
    const resizer = document.createElement('div');
    resizer.className = 'panel-resizer';
    resizer.dataset.panelId = id;
    
    wrapper.appendChild(resizer);
    wrapper.appendChild(header);
    wrapper.appendChild(content);
    this.container.appendChild(wrapper);
    
    // Создаем график Lightweight Charts
    const chart = LightweightCharts.createChart(content, {
        width: this.container.clientWidth,
        height: defaultHeight - 28,
        layout: {
            background: { color: '#000000' },
            textColor: '#808080'
        },
        grid: {
            vertLines: { visible: false },
            horzLines: { visible: true, color: '#2B3139' }
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        timeScale: { visible: false },
        rightPriceScale: {
            scaleMargins: { top: 0.1, bottom: 0.1 },
            borderColor: '#333333'
        }
    });
    
    // Сохраняем данные
    const panel = {
        wrapper,
        header,
        content,
        resizer,
        chart,
        height: defaultHeight,
        minHeight,
        maxHeight,
        isCollapsed: false,
        series: new Map() // id -> series
    };
    
    this.panels.set(id, panel);
    
    // Обработчики
    header.querySelector('.collapse-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCollapse(id);
    });
    
    header.querySelector('.close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePanel(id);
    });
    
    resizer.addEventListener('mousedown', (e) => {
        this._startResize(id, e);
    });
    
    setTimeout(() => {
        if (this.chartManager && this.chartManager._updateMainChartHeight) {
            this.chartManager._updateMainChartHeight();
        }
    }, 50);
    
    // 👇 ДОБАВЛЕНО: синхронизация временной шкалы панели с основным графиком
    setTimeout(() => {
        if (this.chartManager && this.chartManager.chart) {
            this.syncTimeScaleWithMainChart(this.chartManager.chart);
        }
    }, 100);
    
    return panel;
}
    
    toggleCollapse(id) {
        const panel = this.panels.get(id);
        if (!panel) return;
        
        panel.isCollapsed = !panel.isCollapsed;
        
        if (panel.isCollapsed) {
            panel.wrapper.classList.add('collapsed');
            panel.wrapper.style.height = '36px';
            panel.header.querySelector('.collapse-btn').innerHTML = '▶';
        } else {
            panel.wrapper.classList.remove('collapsed');
            panel.wrapper.style.height = `${panel.height}px`;
            panel.header.querySelector('.collapse-btn').innerHTML = '▼';
            
            // Обновляем размер графика после разворачивания
            setTimeout(() => {
                panel.chart.applyOptions({ height: panel.height - 28 });
                if (panel.series.size > 0) {
                    panel.series.forEach(series => {
                        if (series.setData) {
                            const currentData = series._data;
                            if (currentData) series.setData(currentData);
                        }
                    });
                }
            }, 50);
        }
        
        this._updateContainerHeight();
         setTimeout(() => {
        if (this.chartManager && this.chartManager._updateMainChartHeight) {
            this.chartManager._updateMainChartHeight();
        }
    }, 100);
}
    
    
    closePanel(id) {
        const panel = this.panels.get(id);
        if (!panel) return;
        
        // Удаляем из DOM
        if (panel.wrapper && panel.wrapper.parentNode) {
            panel.wrapper.remove();
        }
        
        // Уничтожаем график
        if (panel.chart && panel.chart.remove) {
            try {
                panel.chart.remove();
            } catch(e) {}
        }
        
        // Удаляем из хранилища
        this.panels.delete(id);
        
        this._updateContainerHeight();
    }
    
    _startResize(id, e) {
        e.preventDefault();
        e.stopPropagation();
        
        const panel = this.panels.get(id);
        if (!panel || panel.isCollapsed) return;
        
        this.activeResizer = {
            id,
            startY: e.clientY,
            startHeight: panel.height
        };
        
        if (panel.resizer) panel.resizer.classList.add('active');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }
    
    _onMouseMove(e) {
        if (!this.activeResizer) return;
        
        const panel = this.panels.get(this.activeResizer.id);
        if (!panel) {
            this._onMouseUp();
            return;
        }
        
        const delta = this.activeResizer.startY - e.clientY;
        let newHeight = this.activeResizer.startHeight + delta;
        
        // Ограничиваем
        newHeight = Math.max(panel.minHeight, Math.min(panel.maxHeight, newHeight));
        
        if (newHeight !== panel.height) {
            panel.height = newHeight;
            panel.wrapper.style.height = `${newHeight}px`;
            if (panel.chart) {
                panel.chart.applyOptions({ height: newHeight - 28 });
            }
            
            // Перерисовываем данные
            if (panel.series.size > 0) {
                panel.series.forEach(series => {
                    if (series.setData) {
                        const currentData = series._data;
                        if (currentData) series.setData(currentData);
                    }
                });
            }
            
            this._updateContainerHeight();
        }
    }
    
    _onMouseUp() {
        if (!this.activeResizer) return;
        
        const panel = this.panels.get(this.activeResizer.id);
        if (panel && panel.resizer) {
            panel.resizer.classList.remove('active');
        }
        
        this.activeResizer = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
    
    _updateContainerHeight() {
        // Обновляем высоту основного графика
        if (this.chartManager && this.chartManager._updateMainChartHeight) {
            this.chartManager._updateMainChartHeight();
        }
    }
    
    addSeries(panelId, seriesId, type, options) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.chart) return null;
        
        let series;
        if (type === 'line') {
            series = panel.chart.addSeries(LightweightCharts.LineSeries, options);
        } else if (type === 'histogram') {
            series = panel.chart.addSeries(LightweightCharts.HistogramSeries, options);
        }
        
        if (series) {
            panel.series.set(seriesId, series);
        }
        
        return series;
    }
    
    removeSeries(panelId, seriesId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.chart) return;
        
        const series = panel.series.get(seriesId);
        if (series) {
            try {
                panel.chart.removeSeries(series);
            } catch(e) {}
            panel.series.delete(seriesId);
        }
    }
    
    resize(width) {
        this.panels.forEach(panel => {
            if (panel.chart) {
                panel.chart.applyOptions({ width: width });
            }
        });
    }
    syncTimeScaleWithMainChart(mainChart) {
        if (!mainChart) return;
        
        const timeScale = mainChart.timeScale();
        const handleVisibleRangeChange = () => {
            const logicalRange = timeScale.getVisibleLogicalRange();
            if (!logicalRange) return;
            
            this.panels.forEach(panel => {
                if (panel.chart && !panel.isCollapsed) {
                    try {
                        panel.chart.timeScale().setVisibleLogicalRange(logicalRange);
                    } catch (e) {}
                }
            });
        };
        
        timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
        handleVisibleRangeChange();
    }
}





if (typeof window !== 'undefined') {
    window.IndicatorPanelManager = IndicatorPanelManager;
}