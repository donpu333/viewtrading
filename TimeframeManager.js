  class TimeframeManager {
            constructor(chartManager, wsManager, timerManager) {
                this.chartManager = chartManager;
                this.wsManager = wsManager;
                this.timerManager = timerManager;
                this.currentInterval = localStorage.getItem('lastTimeframe') || CONFIG.defaultInterval;
console.log('📊 TimeframeManager: таймфрейм =', this.currentInterval);
              
                this.currentExchange = 'Binance';
                this.currentContractType = 'PERP';
                
                this.savedCenterTime = null;
                this.savedRangeWidth = null;
                
                this.init();
            }

            init() {
                this.updateInstrumentInfo();
                this.loadStarredTimeframes();
                this.setupEventListeners();
                this.setupControlButtons();
                
                this.timerManager.start(this.currentInterval);
                this.chartManager.setCurrentInterval(this.currentInterval);

                document.addEventListener('click', this.handleDocumentClick.bind(this));
                
                this.chartManager.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
                    this.saveCurrentPosition();
                });
            }

            saveCurrentPosition() {
                const timeScale = this.chartManager.chart.timeScale();
                const visibleRange = timeScale.getVisibleLogicalRange();
                
                if (visibleRange && this.chartManager.chartData.length > 0) {
                    const fromIndex = Math.max(0, Math.floor(visibleRange.from));
                    const toIndex = Math.min(this.chartManager.chartData.length - 1, Math.ceil(visibleRange.to));
                    
                    if (fromIndex < toIndex && fromIndex >= 0 && toIndex < this.chartManager.chartData.length) {
                        const centerIndex = Math.floor((fromIndex + toIndex) / 2);
                        this.savedCenterTime = this.chartManager.chartData[centerIndex].time;
                        
                        const startTime = this.chartManager.chartData[fromIndex].time;
                        const endTime = this.chartManager.chartData[toIndex].time;
                        this.savedRangeWidth = Math.abs(endTime - startTime);
                    }
                }
            }

            restorePosition() {
                if (!this.savedCenterTime || !this.savedRangeWidth || this.chartManager.chartData.length === 0) return;
                
                const timeScale = this.chartManager.chart.timeScale();
                
                let closestIndex = 0;
                let minDiff = Infinity;
                
                for (let i = 0; i < this.chartManager.chartData.length; i++) {
                    const diff = Math.abs(this.chartManager.chartData[i].time - this.savedCenterTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                
                const halfWidth = this.savedRangeWidth / 2;
                const targetStartTime = this.chartManager.chartData[closestIndex].time - halfWidth;
                const targetEndTime = this.chartManager.chartData[closestIndex].time + halfWidth;
                
                let startIndex = 0;
                let endIndex = this.chartManager.chartData.length - 1;
                
                for (let i = 0; i < this.chartManager.chartData.length; i++) {
                    if (this.chartManager.chartData[i].time >= targetStartTime) {
                        startIndex = i;
                        break;
                    }
                }
                
                for (let i = this.chartManager.chartData.length - 1; i >= 0; i--) {
                    if (this.chartManager.chartData[i].time <= targetEndTime) {
                        endIndex = i;
                        break;
                    }
                }
                
                if (startIndex < endIndex) {
                    timeScale.setVisibleLogicalRange({
                        from: startIndex,
                        to: endIndex
                    });
                }
            }

            handleDocumentClick(event) {
                const panel = document.getElementById('timeframePanel');
                if (panel.classList.contains('expanded') && !panel.contains(event.target)) {
                    panel.classList.remove('expanded');
                }
            }
updateInstrumentInfo() {
    const pairDisplay = document.getElementById('pairDisplay');
    if (pairDisplay) pairDisplay.textContent = this.chartManager.currentSymbol;  // ← меняем this.currentPair на this.chartManager.currentSymbol
    
    const contractTypeDisplay = document.getElementById('contractTypeDisplay');
    if (contractTypeDisplay) contractTypeDisplay.textContent = this.chartManager.currentMarketType === 'futures' ? 'PERP' : 'SPOT';
    
    const exchangeDisplay = document.getElementById('exchangeDisplay');
    if (exchangeDisplay) exchangeDisplay.textContent = this.chartManager.currentExchange === 'binance' ? 'Binance' : 'Bybit';
    
    const currentTfBadge = document.getElementById('currentTfBadge');
    if (currentTfBadge) currentTfBadge.textContent = TF_LABELS[this.currentInterval] || this.currentInterval;
}
            setupEventListeners() {
                const header = document.getElementById('timeframeHeader');
                header.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('tf-star')) {
                        document.getElementById('timeframePanel').classList.toggle('expanded');
                    }
                });

                document.querySelectorAll('.timeframe-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.classList.contains('tf-star')) return;
                        this.switchToTimeframe(item.dataset.tf);
                    });
                });

                document.addEventListener('click', (e) => {
                    if (e.target.classList.contains('tf-star')) {
                        e.stopPropagation();
                        e.target.classList.toggle('starred');
                        this.saveStarredTimeframes();
                    }
                });

                const copyBtn = document.getElementById('copyPairButton');
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.copyToClipboard();
                });

                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key === 't') {
                        e.preventDefault();
                        this.currentContractType = this.currentContractType === 'PERP' ? 'SPOT' : 'PERP';
                        this.updateInstrumentInfo();
                    }
                });

                const candleBtn = document.getElementById('candleBtn');
                const barBtn = document.getElementById('barBtn');
                
                candleBtn.addEventListener('click', () => {
                    candleBtn.classList.add('active');
                    barBtn.classList.remove('active');
                    this.chartManager.setChartType('candle');
                });
                
                barBtn.addEventListener('click', () => {
                    barBtn.classList.add('active');
                    candleBtn.classList.remove('active');
                    this.chartManager.setChartType('bar');
                });
            }
            
            setupControlButtons() {
                const scrollBtn = document.getElementById('scrollToLastCandleButton');
                const newScrollBtn = scrollBtn.cloneNode(true);
                scrollBtn.parentNode.replaceChild(newScrollBtn, scrollBtn);
                newScrollBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.scrollToLastCandle();
                });
                
                const autoScaleBtn = document.getElementById('autoScaleButton');
                const newAutoScaleBtn = autoScaleBtn.cloneNode(true);
                autoScaleBtn.parentNode.replaceChild(newAutoScaleBtn, autoScaleBtn);
                newAutoScaleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.autoScaleChart();
                });
            }
            
            scrollToLastCandle() {
                if (this.chartManager) this.chartManager.scrollToLast();
            }
            
            autoScaleChart() {
                if (this.chartManager) this.chartManager.autoScale();
            }

           copyToClipboard() {
    const button = document.getElementById('copyPairButton');
    // ✅ Берем символ из chartManager.currentSymbol
    const textToCopy = this.chartManager.currentSymbol;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1000);
            })
            .catch(() => this.fallbackCopy(button, textToCopy));
    } else {
        this.fallbackCopy(button, textToCopy);
    }
}

fallbackCopy(button, text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 1000);
    } catch (err) {
        console.error('Ошибка копирования:', err);
    }
    
    document.body.removeChild(textarea);
}
            fallbackCopy(button) {
                const textarea = document.createElement('textarea');
                textarea.value = this.currentPair;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                
                try {
                    document.execCommand('copy');
                    button.classList.add('copied');
                    setTimeout(() => button.classList.remove('copied'), 1000);
                } catch (err) {}
                
                document.body.removeChild(textarea);
            }

            loadStarredTimeframes() {
                const starred = JSON.parse(localStorage.getItem('starredTimeframes') || '[]');
                
                document.querySelectorAll('.tf-star').forEach(star => {
                    if (starred.includes(star.dataset.tf)) {
                        star.classList.add('starred');
                    } else {
                        star.classList.remove('starred');
                    }
                });
                
                this.updateStarredDisplay(starred);
            }

            saveStarredTimeframes() {
                const starred = [];
                document.querySelectorAll('.tf-star.starred').forEach(star => {
                    starred.push(star.dataset.tf);
                });
                localStorage.setItem('starredTimeframes', JSON.stringify(starred));
                this.updateStarredDisplay(starred);
            }

            updateStarredDisplay(starred) {
                const container = document.getElementById('starredTimeframes');
                container.innerHTML = '';
                
                starred.forEach(tf => {
                    const label = TF_LABELS[tf] || tf;
                    const item = document.createElement('div');
                    item.className = 'starred-item';
                    if (tf === this.currentInterval) {
                        item.classList.add('active');
                    }
                    item.dataset.tf = tf;
                    item.innerHTML = `<span class="tf-name">${label}</span>`;
                    
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.switchToTimeframe(tf);
                    });
                    
                    container.appendChild(item);
                });
            }
async switchToTimeframe(tf) {
    console.log('Переключение на таймфрейм:', tf);
    
    
    
    document.querySelectorAll('.timeframe-item').forEach(i => {
        i.classList.toggle('active', i.dataset.tf === tf);
    });

    this.currentInterval = tf;
    localStorage.setItem('lastTimeframe', tf);
console.log('💾 Сохранён таймфрейм:', tf);
    this.updateInstrumentInfo();
    document.getElementById('timeframePanel').classList.remove('expanded');
    
    this.chartManager.setCurrentInterval(tf);

    console.log('Загружаем данные для', tf);
    
    // ✅ БЕРЁМ ТЕКУЩИЙ СИМВОЛ ИЗ CHARTMANAGER
    const currentSymbol = this.chartManager.currentSymbol;
    const currentExchange = this.chartManager.currentExchange;
    const currentMarketType = this.chartManager.currentMarketType;
    
    console.log('Текущий символ:', currentSymbol, currentExchange, currentMarketType);
    
    const data = await this.chartManager.fetchKlines(currentSymbol, currentExchange, currentMarketType, tf, 1000);
    console.log('Получено данных:', data ? data.length : 0);
    
    if (data && data.length > 0) {
        console.log('Устанавливаем данные на график');
        this.chartManager.setDataQuick(
            data, 
            tf, 
            currentSymbol,
            currentExchange, 
            currentMarketType
        );
        
        // ✅ ДОБАВЛЕНО: ОБНОВЛЯЕМ ФОРМАТ ЦЕНЫ ПОСЛЕ ЗАГРУЗКИ ДАННЫХ
        this.chartManager.updatePricePrecision(currentSymbol, currentExchange, currentMarketType);
        
        // ✅ ОБНОВЛЯЕМ WEBSOCKET ОДНИМ ВЫЗОВОМ (символ + таймфрейм)
       if (this.wsManager) {
    console.log('🔄 Обновляем WebSocket для символа:', currentSymbol, 'таймфрейм:', tf);
    this.wsManager.updateSymbolAndTimeframe(currentSymbol, tf, currentExchange, currentMarketType);
}
        setTimeout(() => {
            this.chartManager.autoScale();
        }, 300);
        
        if (window.rayManager) {
            setTimeout(() => {
                window.rayManager.syncWithNewTimeframe();
            }, 200);
        }
        
        if (window.trendLineManager) {
            setTimeout(() => {
                window.trendLineManager.syncWithNewTimeframe();
            }, 200);
        }
        
        if (window.rulerLineManager) {
            setTimeout(() => {
                window.rulerLineManager.syncWithNewTimeframe();
            }, 200);
        }
        
        if (window.alertLineManager) {
            setTimeout(() => {
                window.alertLineManager.syncWithNewTimeframe();
            }, 200);
        }
        
        if (window.textManager) {
            setTimeout(() => {
                window.textManager.syncWithNewTimeframe();
            }, 200);
        }
         if (this.chartManager.indicatorManager) {
            setTimeout(() => {
                this.chartManager.indicatorManager.syncAllIndicatorPanels();
            }, 200);
        }
        console.log('Запускаем таймер');
        this.timerManager.start(tf);
        
        this.loadStarredTimeframes();
        
   }   
}
}
if (typeof window !== 'undefined') {
    window.TimeframeManager = TimeframeManager;
}