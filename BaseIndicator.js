class BaseIndicator {
    constructor(manager, type, name, color, panel = 'main') {
        this.manager = manager;
        this.type = type;
        this.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.data = {
            name: name,
            color: color,
            panel: panel
        };
        this.settings = {
            color: color,
            lineWidth: 2
        };
        this.series = [];
        this.isCalculating = false;
        this.pendingData = false;
          this.visible = true; 
    }
    
    getSetting(key) {
        return this.settings[key];
    }
    
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        this.calculateAsync();
        if (this.manager) {
            this.manager._renderUI();
            this.manager._saveIndicators();
        }
    }
    
    calculateAsync() {
        if (this.isCalculating) {
            this.pendingData = true;
            return;
        }
        
        this.isCalculating = true;
        
        const chartData = this.manager?.chartManager?.chartData;
        if (!chartData || chartData.length === 0) {
            this.isCalculating = false;
            return;
        }
        
        const worker = this.manager?.worker;
        if (!worker) {
            console.warn('Worker не инициализирован');
            this.isCalculating = false;
            return;
        }
        
        worker.postMessage({
            task: 'calculate',
            indicatorId: this.id,
            indicatorType: this.getWorkerType(),
            data: chartData,
            params: this.getWorkerParams()
        });
    }
    
    onCalculateResult(result) {
        this.isCalculating = false;
        
        if (this.pendingData) {
            this.pendingData = false;
            this.calculateAsync();
            return;
        }
        
        if (result && result.success && result.result) {
            this.updateSeriesData(result.result);
        }
    }
    
    updateSeriesData(data) {
        // Переопределяется в наследниках
    }
    
    getWorkerType() {
        return this.type;
    }
    
    getWorkerParams() {
        return {};
    }
    
    createSeries() {
        this._createEmptySeries();
        this.calculateAsync();
        return this.series;
    }
    
    _createEmptySeries() {
        // Переопределяется в наследниках
    }
    
    getSettingsHTML() {
        return `
            <div class="settings-row">
                <label>Цвет:</label>
                <input type="color" id="indicatorColor" value="${this.settings.color}" style="width: 50px; height: 30px;">
            </div>
            <div class="settings-row">
                <label>Толщина:</label>
                <input type="range" id="indicatorLineWidth" min="1" max="5" step="1" value="${this.settings.lineWidth}">
                <span class="value-display" id="lineWidthValue">${this.settings.lineWidth}</span>
            </div>
        `;
    }
    
    applySettingsFromForm() {
        const colorInput = document.getElementById('indicatorColor');
        const widthInput = document.getElementById('indicatorLineWidth');
        
        const newSettings = {};
        if (colorInput) newSettings.color = colorInput.value;
        if (widthInput) newSettings.lineWidth = parseInt(widthInput.value);
        
        this.updateSettings(newSettings);
    }
}
if (typeof window !== 'undefined') {
    window.BaseIndicator = BaseIndicator;
}