// IndicatorManager.js
class IndicatorManager {
    
    constructor(chartManager) {
        this.chartManager = chartManager;
        this.activeIndicators = [];
        this.panelManager = null;
        this.indicatorPanels = {
            rsi: null,
            macd: null,
            stoch: null,
            volume: null,
            adx: null,
            atr: null
        };
        this._addingInProgress = new Set();
        this._isShowingPanel = false;
        this._pendingIndicators = null;
        this._currentSettingsIndicator = null;
        
        // Инициализируем Worker
        this.worker = window.initIndicatorWorker();
        if (this.worker) {
            this.worker.addEventListener('message', (e) => {
                this._handleWorkerMessage(e.data);
            });
        }
        
        this._initIndicatorPanels();
    }
    
    _handleWorkerMessage(message) {
        if (message.task === 'result') {
            const indicator = this.activeIndicators.find(i => i.id == message.indicatorId);
            if (indicator && message.success) {
                indicator.onCalculateResult(message);
            }
        }
        else if (message.task === 'resultMultiple') {
            for (const res of message.results) {
                const indicator = this.activeIndicators.find(i => i.id == res.indicatorId);
                if (indicator && res.success) {
                    indicator.onCalculateResult({ indicatorId: res.indicatorId, result: res.result, success: true });
                }
            }
        }
    }
    
    _filterData(data) {
        if (!data || !Array.isArray(data)) return [];
        return data.filter(item => item && item.time !== undefined && item.value !== undefined && !isNaN(item.value) && item.time > 0);
    }
    
    _initIndicatorPanels() {
        const chartContainer = document.getElementById('chart-container');
        
        let panelsContainer = document.getElementById('indicator-panels-container');
        if (!panelsContainer) {
            panelsContainer = document.createElement('div');
            panelsContainer.id = 'indicator-panels-container';
            chartContainer.parentNode.insertBefore(panelsContainer, chartContainer.nextSibling);
        }
        
        this.panelManager = new window.IndicatorPanelManager(panelsContainer, this.chartManager);
        
        setTimeout(() => {
            if (this.chartManager && this.chartManager.chart && this.panelManager) {
                this.panelManager.syncTimeScaleWithMainChart(this.chartManager.chart);
                console.log('✅ Синхронизация панелей индикаторов включена');
            }
        }, 100);
        
        this.indicatorPanels = {
            rsi: null,
            macd: null,
            stoch: null,
            volume: null,
            adx: null,
            atr: null
        };
    }
    
    toggleIndicatorVisibility(indicator) {
        if (!indicator) return;
        
        indicator.visible = indicator.visible === false ? true : false;
        
        indicator.series.forEach(series => {
            if (series) {
                series.applyOptions({ visible: indicator.visible });
            }
        });
        
        this._saveIndicators();
        this._renderUI();
        
        console.log(`${indicator.data.name} ${indicator.visible ? 'показан' : 'скрыт'}`);
    }
    
    _showPanel(panelId) {
        if (this._isShowingPanel) return;
        
        this._isShowingPanel = true;
        
        try {
            let panel = this.indicatorPanels[panelId];
            
            let panelName = '';
            switch(panelId) {
                case 'rsi': panelName = 'RSI'; break;
                case 'macd': panelName = 'MACD'; break;
                case 'stoch': panelName = 'Stochastic RSI'; break;
                case 'volume': panelName = 'Volume'; break;
                case 'adx': panelName = 'ADX'; break;
                case 'atr': panelName = 'ATR'; break;
                default: panelName = panelId;
            }
            
            const isPanelAttached = panel && panel.wrapper && 
                panel.wrapper.parentNode === this.panelManager.container;
            
            if (!panel || !isPanelAttached) {
                panel = this.panelManager.createPanel(panelId, panelName, 150, 60, 400);
                this.indicatorPanels[panelId] = panel;
            }
            
            if (panel && panel.isCollapsed) {
                this.panelManager.toggleCollapse(panelId);
            }
            
            if (panel && panel.wrapper) {
                panel.wrapper.style.display = '';
            }
            
            setTimeout(() => {
                if (this.chartManager && this.chartManager._updateMainChartHeight) {
                    this.chartManager._updateMainChartHeight();
                }
            }, 50);
            
        } finally {
            setTimeout(() => {
                this._isShowingPanel = false;
            }, 100);
        }
        
        setTimeout(() => {
            this.syncAllIndicatorPanels();
        }, 100);
    }
    
    addIndicator(type) {
        if (this._addingInProgress.has(type)) return false;
        if (this.activeIndicators.some(i => i.type === type)) return false;
        
        this._addingInProgress.add(type);
        
        try {
            // ✅ ИСПРАВЛЕНО: используем window.IndicatorFactory
            const indicator = window.IndicatorFactory.createIndicator(type, this);
            if (!indicator) return false;
            
            if (indicator.data.panel !== 'main') {
                this._showPanel(indicator.data.panel);
            }
            
            const series = indicator.createSeries();
            if (series) {
                this.activeIndicators.push(indicator);
                this._saveIndicators();
                this._renderUI();
                
                setTimeout(() => {
                    if (this.chartManager && this.chartManager._updateMainChartHeight) {
                        this.chartManager._updateMainChartHeight();
                    }
                }, 50);
                
                return true;
            }
            return false;
            
        } catch (error) {
            console.error(`Ошибка при добавлении индикатора ${type}:`, error);
            return false;
        } finally {
            setTimeout(() => this._addingInProgress.delete(type), 500);
        }
    }
    
    removeIndicator(index) {
        const indicator = this.activeIndicators[index];
        if (!indicator) return false;
        
        indicator.series.forEach(series => {
            if (indicator.data.panel === 'main') {
                try {
                    this.chartManager.chart.removeSeries(series);
                } catch(e) {}
            } else {
                this.panelManager.removeSeries(indicator.data.panel, null, series);
            }
        });
        
        this.activeIndicators.splice(index, 1);
        
        if (indicator.data.panel !== 'main') {
            const hasOther = this.activeIndicators.some(i => i.data.panel === indicator.data.panel);
            if (!hasOther) {
                this.panelManager.closePanel(indicator.data.panel);
                setTimeout(() => {
                    if (this.chartManager && this.chartManager._updateMainChartHeight) {
                        this.chartManager._updateMainChartHeight();
                    }
                }, 50);
            }
        }
        
        this._saveIndicators();
        this._renderUI();
        
        setTimeout(() => {
            if (this.chartManager && this.chartManager.chart) {
                this.chartManager.chart.timeScale().autoScale();
            }
        }, 50);
        
        return true;
    }
    
    updateAllIndicators() {
        if (!this.worker) return;
        
        const calculations = [];
        this.activeIndicators.forEach(indicator => {
            const chartData = this.chartManager.chartData;
            if (chartData && chartData.length > 0) {
                calculations.push({
                    indicatorId: indicator.id,
                    type: indicator.getWorkerType(),
                    data: chartData,
                    params: indicator.getWorkerParams()
                });
            }
        });
        
        if (calculations.length > 0) {
            this.worker.postMessage({
                task: 'calculateMultiple',
                calculations: calculations
            });
        }
    }
    
    syncAllIndicatorPanels() {
        if (this.panelManager && this.chartManager && this.chartManager.chart) {
            this.panelManager.syncTimeScaleWithMainChart(this.chartManager.chart);
        }
    }
    
    showIndicatorSettings(indicator) {
        const panel = document.getElementById('indicatorSettings');
        const content = document.getElementById('indicatorSettingsContent');
        const title = document.getElementById('indicatorSettingsTitle');
        
        if (!panel || !content || !title) {
            console.error('Панель настроек не найдена в DOM');
            return;
        }
        
        this._currentSettingsIndicator = indicator;
        title.textContent = `Настройки: ${indicator.data.name}`;
        
        content.innerHTML = indicator.getSettingsHTML();
        
        const widthSlider = document.getElementById('indicatorLineWidth');
        const widthValue = document.getElementById('lineWidthValue');
        if (widthSlider && widthValue) {
            const updateWidthValue = () => {
                widthValue.textContent = widthSlider.value;
            };
            widthSlider.oninput = updateWidthValue;
            updateWidthValue();
        }
        
        panel.style.display = 'block';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        
        this._setupIndicatorSettingsButtons();
    }
    
    _setupIndicatorSettingsButtons() {
        const panel = document.getElementById('indicatorSettings');
        if (!panel) return;
        
        const saveBtn = document.getElementById('indicatorSaveSettings');
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.onclick = () => {
                if (this._currentSettingsIndicator) {
                    this._currentSettingsIndicator.applySettingsFromForm();
                    this._currentSettingsIndicator.createSeries();
                    this._renderUI();
                    this._saveIndicators();
                }
                panel.style.display = 'none';
            };
        }
        
        const deleteBtn = document.getElementById('indicatorDelete');
        if (deleteBtn) {
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.onclick = () => {
                if (this._currentSettingsIndicator) {
                    const index = this.activeIndicators.findIndex(i => i.id === this._currentSettingsIndicator.id);
                    if (index !== -1) {
                        this.removeIndicator(index);
                    }
                }
                panel.style.display = 'none';
            };
        }
        
        const closeBtn = panel.querySelector('.close-settings');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.onclick = () => {
                panel.style.display = 'none';
            };
        }
        
        const closeOnOutsideClick = (e) => {
            if (!panel.contains(e.target) && panel.style.display === 'block') {
                panel.style.display = 'none';
                document.removeEventListener('mousedown', closeOnOutsideClick);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('mousedown', closeOnOutsideClick);
        }, 100);
    }
    
    _saveIndicators() {
        const indicatorsData = this.activeIndicators.map(indicator => ({
            type: indicator.type,
            settings: indicator.settings,
            id: indicator.id,
            visible: indicator.visible !== false
        }));
        localStorage.setItem('activeIndicatorsV2', JSON.stringify(indicatorsData));
        console.log('💾 Сохранены индикаторы:', indicatorsData);
    }
    
    loadIndicators() {
        try {
            const saved = localStorage.getItem('activeIndicatorsV2');
            if (!saved) {
                console.log('📂 Нет сохранённых индикаторов');
                return;
            }
            
            const indicatorsData = JSON.parse(saved);
            if (!indicatorsData || indicatorsData.length === 0) {
                console.log('📂 Сохранённые индикаторы пусты');
                return;
            }
            
            if (!this.chartManager.chartData || this.chartManager.chartData.length === 0) {
                console.log('⏳ Данные ещё не загружены, сохраняем для отложенной загрузки');
                this._pendingIndicators = indicatorsData;
                return;
            }
            
            console.log('📂 Загружаем сохранённые индикаторы:', indicatorsData.length);
            
            let loadedCount = 0;
            const totalCount = indicatorsData.length;
            
            indicatorsData.forEach((data, index) => {
                setTimeout(() => {
                    if (this.activeIndicators.some(i => i.type === data.type)) {
                        console.log(`⏭️ Индикатор ${data.type} уже добавлен, пропускаем`);
                        loadedCount++;
                        if (loadedCount === totalCount) {
                            this.afterAllIndicatorsLoaded();
                        }
                        return;
                    }
                    
                    console.log(`➕ Добавляем индикатор: ${data.type}`);
                    const success = this.addIndicator(data.type);
                    
                    if (success) {
                        const indicator = this.activeIndicators.find(i => i.type === data.type);
                        if (indicator) {
                            if (data.settings) {
                                indicator.settings = { ...indicator.settings, ...data.settings };
                            }
                            if (data.visible !== undefined) {
                                indicator.visible = data.visible;
                            }
                            indicator.createSeries();
                            if (indicator.series) {
                                indicator.series.forEach(series => {
                                    if (series) series.applyOptions({ visible: indicator.visible });
                                });
                            }
                            console.log(`✅ Индикатор ${data.type} восстановлен с настройками`);
                        }
                    }
                    
                    loadedCount++;
                    if (loadedCount === totalCount) {
                        this.afterAllIndicatorsLoaded();
                    }
                }, index * 200);
            });
            
        } catch(e) {
            console.warn('❌ Ошибка загрузки индикаторов:', e);
        }
    }
    
    restorePendingIndicators() {
        if (!this.chartManager.chartData || this.chartManager.chartData.length === 0) {
            console.log('⏳ Данные ещё не загружены, откладываем восстановление индикаторов');
            return;
        }
        
        if (this._pendingIndicators && this._pendingIndicators.length > 0) {
            console.log('🔄 Восстанавливаем отложенные индикаторы:', this._pendingIndicators);
            const indicatorsData = [...this._pendingIndicators];
            this._pendingIndicators = null;
            
            let loadedCount = 0;
            const totalCount = indicatorsData.length;
            
            indicatorsData.forEach((data, index) => {
                setTimeout(() => {
                    if (!this.activeIndicators.some(i => i.type === data.type)) {
                        this.addIndicator(data.type);
                        const indicator = this.activeIndicators.find(i => i.type === data.type);
                        if (indicator && data.settings) {
                            indicator.settings = { ...indicator.settings, ...data.settings };
                            if (data.visible !== undefined) indicator.visible = data.visible;
                            indicator.createSeries();
                        }
                    }
                    
                    loadedCount++;
                    if (loadedCount === totalCount) {
                        this.afterAllIndicatorsLoaded();
                    }
                }, index * 200);
            });
        }
    }
    
    afterAllIndicatorsLoaded() {
        console.log('✅ Все индикаторы загружены, обновляем высоту графика');
        
        setTimeout(() => {
            if (this.chartManager && this.chartManager._updateMainChartHeight) {
                this.chartManager._updateMainChartHeight();
            }
            
            setTimeout(() => {
                if (this.chartManager && this.chartManager.chart) {
                    const volumeScale = this.chartManager.chart.priceScale('volume');
                    if (volumeScale) {
                        volumeScale.applyOptions({
                            scaleMargins: {
                                top: 0.7,
                                bottom: 0
                            }
                        });
                    }
                    this.chartManager.chart.timeScale().fitContent();
                }
            }, 50);
        }, 100);
        
        setTimeout(() => {
            this.syncAllIndicatorPanels();
        }, 200);
    }
    
    clearAllIndicators() {
        const indices = [...Array(this.activeIndicators.length).keys()].reverse();
        indices.forEach(i => {
            this.removeIndicator(i);
        });
    }
    
    _renderUI() {
        if (window.renderActiveIndicatorsUI) {
            window.renderActiveIndicatorsUI(this.activeIndicators);
        }
    }
}

// Регистрация в window
if (typeof window !== 'undefined') {
    window.IndicatorManager = IndicatorManager;
}