class DailySeparator {
    constructor(chartManager) {
        this._cm = chartManager;
        this._primitive = null;
        this._requestUpdate = null;
        
        // Загружаем настройки
        const saved = localStorage.getItem('separatorSettings');
        if (saved) {
            const s = JSON.parse(saved);
            this._enabled = s.enabled !== false;
            this._color = s.color || '#808080';
            this._lineStyle = s.style || 'dashed';
            this._lineWidth = s.width || 1;
            this._opacity = s.opacity || 0.3;
        } else {
            this._enabled = true;
            this._color = '#808080';
            this._lineStyle = 'dashed';
            this._lineWidth = 1;
            this._opacity = 0.3;
        }
        
        setTimeout(() => this._attach(), 1000);
    }
    
    _attach() {
        if (!this._cm || !this._cm.chart) {
            setTimeout(() => this._attach(), 500);
            return;
        }
        
        const series = this._cm.currentChartType === 'candle' 
            ? this._cm.candleSeries 
            : this._cm.barSeries;
        
        if (!series) return;
        
        const self = this;
        
        this._primitive = {
            paneViews: () => [{
                renderer: () => ({
                    draw: (target) => self._draw(target)
                })
            }],
            attached: ({ requestUpdate }) => {
                self._requestUpdate = requestUpdate;
            },
            detached: () => {},
            updateAllViews: () => {},
            requestRedraw: () => {
                if (self._requestUpdate) self._requestUpdate();
            }
        };
        
        series.attachPrimitive(this._primitive);
        console.log('✅ DailySeparator: примитив прикреплён');
    }
    
    _draw(target) {
        if (!this._enabled) return;
        
        const tf = this._cm.currentInterval;
        if (['1d', '1w', '1M'].includes(tf)) return;
        
        const data = this._cm.chartData;
        if (!data || data.length < 2) return;
        
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            let prevDay = null;
            
            data.forEach(candle => {
             const mskTime = new Date(candle.time * 1000);
const day = mskTime.getUTCDate();
                if (prevDay !== null && day !== prevDay) {
                    const timeScale = this._cm.chart.timeScale();
                    const x = timeScale.timeToCoordinate(candle.time);
                    
                    if (x !== null && x > 0 && x < scope.mediaSize.width) {
                        ctx.save();
                        
                        // Цвет с прозрачностью
                        ctx.strokeStyle = this._hexToRgba(this._color, this._opacity);
                        ctx.lineWidth = this._lineWidth * scope.horizontalPixelRatio;
                        
                        // Стиль линии
                        if (this._lineStyle === 'dashed') ctx.setLineDash([4, 4]);
                        else if (this._lineStyle === 'dotted') ctx.setLineDash([2, 2]);
                        else ctx.setLineDash([]);
                        
                        ctx.beginPath();
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, scope.mediaSize.height);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
                
                prevDay = day;
            });
        });
    }
    
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    updateSettings(settings) {
        if (settings.enabled !== undefined) this._enabled = settings.enabled;
        if (settings.color) this._color = settings.color;
        if (settings.style) this._lineStyle = settings.style;
        if (settings.width) this._lineWidth = settings.width;
        if (settings.opacity !== undefined) this._opacity = settings.opacity;
        
        localStorage.setItem('separatorSettings', JSON.stringify({
            enabled: this._enabled,
            color: this._color,
            style: this._lineStyle,
            width: this._lineWidth,
            opacity: this._opacity
        }));
        
        if (this._primitive && this._primitive.requestRedraw) {
            this._primitive.requestRedraw();
        }
    }
    
    redraw() {
        if (this._primitive && this._primitive.requestRedraw) {
            this._primitive.requestRedraw();
        }
    }
}

if (typeof window !== 'undefined') {
    window.DailySeparator = DailySeparator;
}