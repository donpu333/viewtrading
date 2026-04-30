

class HorizontalRay {
    constructor(price, time, options = {}) {
        this.price = price;
        this.time = time;
        this.anchorTime = options.anchorTime || time; // FIX: якорное время (не меняется при смене ТФ)
        this.id = `ray_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.options = {
            color: options.color || '#4A90E2',
            lineWidth: options.lineWidth || 2,
            lineStyle: options.lineStyle || 'solid',
            opacity: options.opacity !== undefined ? options.opacity : 0.9,
            extendLeft: options.extendLeft || false,
            extendRight: options.extendRight !== undefined ? options.extendRight : true,
            showPrice: options.showPrice !== undefined ? options.showPrice : true,
            fontSize: options.fontSize || 10,
            ...options
        };
        this.anchorCandle = options.anchorCandle || null;
        this.timeframeVisibility = options.timeframeVisibility || {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        this.selected = false;
        this.hovered = false;
        this.dragging = false;
        this.showDragPoint = false;
        this.attached = false;
        this.dragPointX = 0;
        this.dragPointY = 0;
        // FIX: для обратной совместимости
        if (options.originalStartTime) this.anchorTime = options.originalStartTime;
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }
    
    isVisibleOnTimeframe(timeframe) {
        return this.timeframeVisibility[timeframe] !== false;
    }
}

class HorizontalRayRenderer {
    constructor(ray, chartManager) {
        this._ray = ray;
        this._chartManager = chartManager;
        this._hitArea = null;
        this._priceLabelHitArea = null;
      
    }
draw(target) {
         const currentKey = this._chartManager.getCurrentSymbolKey?.();
    if (currentKey && this._ray.symbolKey !== currentKey) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const ray = this._ray;
            const chartManager = this._chartManager;

            const currentTf = chartManager.currentInterval;
            if (!ray.isVisibleOnTimeframe(currentTf)) {
                return;
            }

            const yCoordinate = chartManager.priceToCoordinate(ray.price);
            const xCoordinate = chartManager.timeToCoordinate(ray.time);
            if (yCoordinate === null || xCoordinate === null) return;

            const timeScale = chartManager.chart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (!visibleRange) return;

            let startX = 0;
            let endX = scope.mediaSize.width;
            if (!ray.options.extendLeft) startX = xCoordinate;
            if (!ray.options.extendRight) endX = xCoordinate;

            const { position: startPos } = positionsLine(startX, scope.horizontalPixelRatio, 1, true);
            const { position: endPos } = positionsLine(endX, scope.horizontalPixelRatio, 1, true);
            const { position: yPos, length: yLength } = positionsLine(
                yCoordinate, scope.verticalPixelRatio, ray.options.lineWidth, false
            );

            this._hitArea = {
                y: yPos,
                height: yLength,
                x1: Math.min(startPos, endPos),
                x2: Math.max(startPos, endPos)
            };

            ctx.save();

            const color = ray.options.color;
            const opacity = ray.options.opacity !== undefined ? ray.options.opacity : 0.9;

            const parseHex = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            };

            const parseRgb = (rgb) => {
                const result = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(rgb);
                return result ? {
                    r: parseInt(result[1], 10),
                    g: parseInt(result[2], 10),
                    b: parseInt(result[3], 10)
                } : null;
            };

            let rgbaColor;
            let parsed = parseHex(color) || parseRgb(color);
            if (parsed) {
                rgbaColor = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${opacity})`;
            } else {
                rgbaColor = color;
            }

            ctx.strokeStyle = rgbaColor;
            ctx.lineWidth = yLength;
            
            if (ray.options.lineStyle === 'dashed') ctx.setLineDash([10, 8]);
            else if (ray.options.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
            else ctx.setLineDash([]);
            
            ctx.beginPath();
            ctx.moveTo(startPos, yPos + yLength / 2);
            ctx.lineTo(endPos, yPos + yLength / 2);
            ctx.stroke();

            if (ray.hovered || ray.dragging || ray.selected || ray.attached) {
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(Math.round(xCoordinate * scope.horizontalPixelRatio), yPos + yLength / 2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = rgbaColor;
                ctx.beginPath();
                ctx.arc(Math.round(xCoordinate * scope.horizontalPixelRatio), yPos + yLength / 2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
            }

            if (ray.options.showPrice) {
                const priceText = Utils.formatPrice(ray.price);

                ctx.font = `bold ${ray.options.fontSize * scope.horizontalPixelRatio}px 'Inter', Arial, sans-serif`;
                const textMetrics = ctx.measureText(priceText);
                const textWidth = textMetrics.width;
                const padding = 8 * scope.horizontalPixelRatio;
                const labelWidth = textWidth + padding * 2;
                const labelHeight = (ray.options.fontSize + 6) * scope.verticalPixelRatio;

                const labelXPos = scope.mediaSize.width * scope.horizontalPixelRatio - labelWidth - 2;
                const labelYPos = yPos - labelHeight / 2;

                this._priceLabelHitArea = { x: labelXPos, y: labelYPos, width: labelWidth, height: labelHeight };

                ctx.fillStyle = rgbaColor;
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                this._roundRect(ctx, labelXPos, labelYPos, labelWidth, labelHeight, 4 * scope.horizontalPixelRatio);
                ctx.fill();

                ctx.shadowBlur = 0;
                
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold ${(ray.options.fontSize + 1) * scope.horizontalPixelRatio}px 'Inter', Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(priceText, labelXPos + labelWidth / 2, labelYPos + labelHeight / 2);
                
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
            
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
hitTest(x, y) {
    const isMac = /Mac/.test(navigator.userAgent);
    
    if (this._hitArea) {
        if (isMac) {
            const buffer = 10;
            const inY = Math.abs(y - this._hitArea.y - this._hitArea.height / 2) < (this._hitArea.height / 2 + buffer);
            const pixelRatio = window.devicePixelRatio || 1;
            const chartWidth = (this._chartManager?.chartContainer?.offsetWidth || 426) * pixelRatio;
            const inX = x >= 0 && x <= chartWidth;
            if (inX && inY) return 'line';
        } else {
            const buffer = 10;
            const inY = Math.abs(y - this._hitArea.y - this._hitArea.height / 2) < (this._hitArea.height / 2 + buffer);
            const inX = x >= this._hitArea.x1 - buffer && x <= this._hitArea.x2 + buffer;
            if (inX && inY) return 'line';
        }
    }
    
    if (this._priceLabelHitArea) {
        if (isMac) {
            const padding = 15;
            const inX = x >= this._priceLabelHitArea.x - padding && 
                        x <= this._priceLabelHitArea.x + this._priceLabelHitArea.width + padding;
            const inY = y >= this._priceLabelHitArea.y - padding && 
                        y <= this._priceLabelHitArea.y + this._priceLabelHitArea.height + padding;
            if (inX && inY) return 'label';
        } else {
            const inX = x >= this._priceLabelHitArea.x && 
                        x <= this._priceLabelHitArea.x + this._priceLabelHitArea.width;
            const inY = y >= this._priceLabelHitArea.y && 
                        y <= this._priceLabelHitArea.y + this._priceLabelHitArea.height;
            if (inX && inY) return 'label';
        }
    }
    
    return null;
}
}
class HorizontalRayPaneView {
    constructor(ray, chartManager) {
        this._ray = ray;
        this._chartManager = chartManager;
        this._renderer = new HorizontalRayRenderer(ray, chartManager);
    }
    renderer() { return this._renderer; }
    zOrder() { return 'top'; }
}

class HorizontalRayPrimitive {
    constructor(ray, chartManager) {
        this._ray = ray;
        this._chartManager = chartManager;
        this._paneView = new HorizontalRayPaneView(ray, chartManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    
    paneViews() { return [this._paneView]; }
    
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
        // FIX: при первом подключении синхронизируем время
        this._syncRayTime();
    }
    
    // FIX: ключевой метод - вызывается библиотекой при любых изменениях (смена ТФ, скролл, изменение данных)
    updateAllViews() {
        const oldTime = this._ray.time;
        this._syncRayTime();
        if (this._ray.time !== oldTime && this._requestUpdate) {
            this._requestUpdate();
        }
    }
    
    // FIX: пересчёт времени луча на основе anchorTime и текущих свечей
    _syncRayTime() {
        const chartData = this._chartManager.chartData;
        if (!chartData || chartData.length === 0) return;
        
        const anchor = this._ray.anchorTime;
        if (anchor === undefined) return;
        
        // Определяем интервал между свечами (мс)
        let intervalMs = 60 * 60 * 1000; // дефолт 1 час
        if (chartData.length >= 2) {
            intervalMs = chartData[1].time - chartData[0].time;
        }
        
        // Ищем свечу, содержащую anchorTime
        let newTime = anchor;
        for (let i = 0; i < chartData.length; i++) {
            const start = chartData[i].time;
            const end = start + intervalMs;
            if (anchor >= start && anchor < end) {
                newTime = start;
                break;
            }
        }
        
        // Если не нашли - ближайшая свеча
        if (newTime === anchor && chartData.length) {
            let closest = chartData[0];
            let minDiff = Math.abs(chartData[0].time - anchor);
            for (let i = 1; i < chartData.length; i++) {
                const diff = Math.abs(chartData[i].time - anchor);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = chartData[i];
                }
            }
            newTime = closest.time;
        }
        
        this._ray.time = newTime;
    }
    
    getRay() { return this._ray; }
    
    requestRedraw() { if (this._requestUpdate) this._requestUpdate(); }
    
    detached() {
        // очистка при необходимости
    }
}

class HorizontalRayManager {
    constructor(chartManager) {
        this._rays = [];
        this._chartManager = chartManager;
        this._selectedRay = null;
        this._hoveredRay = null;
        this._isDrawingMode = false;
        this._magnetEnabled = true;
        this._isDragging = false;
        this._dragRay = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartPrice = 0;
        this._dragStartTime = 0;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._potentialDrag = null;
        this._dragThreshold = 5;
        
        this._currentSymbolKey = this._getCurrentSymbolKey();
        this._isLoading = false;
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._setupEventListeners();
        this._setupHotkeys();
        this._autoLoadRays();
          this._isMac = /Mac/.test(navigator.userAgent);
    this._pixelRatio = window.devicePixelRatio || 1;
    }
// ✅ ДОБАВЬТЕ ЭТОТ МЕТОД ПОСЛЕ КОНСТРУКТОРА:
_autoLoadRays() {
    // Загружаем лучи асинхронно, не блокируя конструктор
    setTimeout(async () => {
        try {
            // Ждем готовности БД
            if (!window.dbReady) {
                await new Promise(resolve => {
                    const check = () => {
                        if (window.dbReady) resolve();
                        else setTimeout(check, 50);
                    };
                    check();
                });
            }
            
            console.log('🚀 Auto-loading rays...');
            await this.loadRays();
            console.log('✅ Rays auto-loaded successfully');
        } catch (error) {
            console.error('❌ Auto-load rays failed:', error);
        }
    }, 100); // Небольшая задержка для инициализации графика
}
    _getCurrentSymbolKey() {
        const symbol = this._chartManager.currentSymbol || 'BTCUSDT';
        const exchange = this._chartManager.currentExchange || 'binance';
        const marketType = this._chartManager.currentMarketType || 'futures';
        return `${symbol}:${exchange}:${marketType}`;
    }
    
    _getRaysForCurrentSymbol() {
        const currentKey = this._getCurrentSymbolKey();
        return this._rays.filter(item => item.ray.symbolKey === currentKey);
    }

    _setupHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyO' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                
                const container = this._chartManager.chartContainer;
                const rect = container.getBoundingClientRect();
                const mouseX = this._lastMouseX !== undefined ? this._lastMouseX : rect.width / 2;
                const mouseY = this._lastMouseY !== undefined ? this._lastMouseY : rect.height / 2;
                
                let price = this._chartManager.coordinateToPrice(mouseY);
                let time = this._chartManager.coordinateToTime(mouseX);
                
                if (price === null || time === null) {
                    const lastCandle = this._chartManager.getLastCandle();
                    if (lastCandle) {
                        price = lastCandle.close;
                        time = lastCandle.time;
                    } else {
                        return;
                    }
                }
                
                if (this._magnetEnabled) {
                    const snapped = this._snapToPrice(price, time);
                    price = snapped.price;
                    time = snapped.time;
                }
                
                this.createRay(price, time, {
                    color: document.getElementById('currentColorBox')?.style.backgroundColor || '#0933e2',
                    lineWidth: parseInt(document.getElementById('settingThickness')?.value) || 2,
                    lineStyle: document.getElementById('templateSelect')?.value || 'solid',
                    opacity: parseInt(document.getElementById('colorOpacity')?.value) / 100 || 0.9,
                    showPrice: true
                });
            }
            
            if (e.key === 'Delete' && this._selectedRay) {
                this.deleteRay(this._selectedRay.id);
                this._selectedRay = null;
            }
        });
    }

 _handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (this._isMac && this._pixelRatio > 1) {
        x *= this._pixelRatio;
        y *= this._pixelRatio;
    }
    const hit = this.hitTest(x, y);

    if (hit) {
        if (this._selectedRay && this._selectedRay !== hit.ray) {
            this._selectedRay.selected = false;
            this._selectedRay.showDragPoint = false;
            this._selectedRay.attached = false;
        }

        hit.ray.selected = true;
        hit.ray.showDragPoint = true;
        hit.ray.attached = false;

        let rayX = this._chartManager.timeToCoordinate(hit.ray.time);
        let rayY = this._chartManager.priceToCoordinate(hit.ray.price);
        
        // ТОЛЬКО ДЛЯ MAC
        if (this._isMac && this._pixelRatio > 1) {
            if (rayX !== null) rayX *= this._pixelRatio;
            if (rayY !== null) rayY *= this._pixelRatio;
        }
        
        if (rayX !== null && rayY !== null) {
            hit.ray.dragPointX = rayX;
            hit.ray.dragPointY = rayY;
        }

        this._selectedRay = hit.ray;
        this._requestRedraw();
        
        
        const menu = document.getElementById('drawingContextMenu');
        if (menu) {
            document.getElementById('trendContextMenu').style.display = 'none';
            document.getElementById('alertContextMenu').style.display = 'none';
            
            menu.style.display = 'flex';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            
            const copyBtn = document.getElementById('contextCopyBtn');
            const newCopyBtn = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
            newCopyBtn.onclick = (event) => {
                event.stopPropagation();
                const priceText = Utils.formatPrice(hit.ray.price);
                navigator.clipboard?.writeText(priceText);
                menu.style.display = 'none';
            };
            
            const settingsBtn = document.getElementById('contextSettingsBtn');
            const newSettingsBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);
            newSettingsBtn.onclick = (event) => {
                event.stopPropagation();
                this._showSettings(hit.ray);
                menu.style.display = 'none';
            };
            
            const deleteBtn = document.getElementById('contextDeleteBtn');
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.onclick = (event) => {
                event.stopPropagation();
                this.deleteRay(hit.ray.id);
                menu.style.display = 'none';
            };
        }
    } else {
        const menu = document.getElementById('drawingContextMenu');
        if (menu) menu.style.display = 'none';
    }
}
   _setupEventListeners() {
    const container = this._chartManager.chartContainer;

    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }
        const hit = this.hitTest(x, y);

        if (hit) {
            e.preventDefault();
            e.stopPropagation();

            if (this._selectedRay && this._selectedRay === hit.ray) {
                this._selectedRay.selected = false;
                this._selectedRay.showDragPoint = false;
                this._selectedRay.attached = false;
                this._selectedRay = null;
                this._requestRedraw();
                return;
            }

            if (this._selectedRay) {
                this._selectedRay.selected = false;
                this._selectedRay.showDragPoint = false;
                this._selectedRay.attached = false;
            }

            hit.ray.selected = true;
            hit.ray.showDragPoint = true;
            hit.ray.attached = true;
            this._selectedRay = hit.ray;

            const rayX = this._chartManager.timeToCoordinate(hit.ray.time);
            const rayY = this._chartManager.priceToCoordinate(hit.ray.price);
            if (rayX !== null && rayY !== null) {
                hit.ray.dragPointX = rayX;
                hit.ray.dragPointY = rayY;
            }

            this._potentialDrag = {
                ray: hit.ray,
                startX: x,
                startY: y,
                startPrice: hit.ray.price,
                startTime: hit.ray.time
            };

            this._requestRedraw();
        } else {
            const rayMenu = document.getElementById('drawingContextMenu');
            if (rayMenu && rayMenu.style.display === 'flex') {
                const menuRect = rayMenu.getBoundingClientRect();
                const isClickInsideMenu = 
                    e.clientX >= menuRect.left && e.clientX <= menuRect.right &&
                    e.clientY >= menuRect.top && e.clientY <= menuRect.bottom;
                if (isClickInsideMenu) return;
            }

            if (this._dragRay) {
                this._dragRay.selected = false;
                this._dragRay.showDragPoint = false;
                this._dragRay.attached = false;
                this._dragRay = null;
            }
            if (this._selectedRay) {
                this._selectedRay.selected = false;
                this._selectedRay.showDragPoint = false;
                this._selectedRay.attached = false;
                this._selectedRay = null;
            }
            
            if (rayMenu) rayMenu.style.display = 'none';
            
            this._requestRedraw();
        }
    });

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }

        this._lastMouseX = x;
        this._lastMouseY = y;

        if (this._potentialDrag && !this._isDragging) {
            const dx = Math.abs(x - this._potentialDrag.startX);
            const dy = Math.abs(y - this._potentialDrag.startY);

            if (dx > this._dragThreshold || dy > this._dragThreshold) {
                this._isDragging = true;
                this._dragRay = this._potentialDrag.ray;
                this._dragRay.dragging = true;

                this._dragStartX = this._potentialDrag.startX;
                this._dragStartY = this._potentialDrag.startY;
                this._dragStartPrice = this._potentialDrag.startPrice;
                this._dragStartTime = this._potentialDrag.startTime;

                container.style.cursor = 'grabbing';
            }
        }

        if (this._isDragging && this._dragRay) {
            e.preventDefault();
            e.stopPropagation();

            const deltaX = x - this._dragStartX;
            const deltaY = y - this._dragStartY;

            const rayX = this._chartManager.timeToCoordinate(this._dragStartTime);
            const rayY = this._chartManager.priceToCoordinate(this._dragStartPrice);

            if (rayX !== null && rayY !== null) {
                const newX = rayX + deltaX;
                const newY = rayY + deltaY;

                const newPrice = this._chartManager.coordinateToPrice(newY);
                const newTime = this._chartManager.coordinateToTime(newX);

                if (newPrice !== null) {
                    this._dragRay.price = newPrice;
                }
                if (newTime !== null) {
                    this._dragRay.time = newTime;
                    this._dragRay.anchorTime = newTime;
                }
                const newRayX = this._chartManager.timeToCoordinate(this._dragRay.time);
                const newRayY = this._chartManager.priceToCoordinate(this._dragRay.price);

                if (newRayX !== null && newRayY !== null) {
                    this._dragRay.dragPointX = newRayX;
                    this._dragRay.dragPointY = newRayY;
                }

                this._requestRedraw();
            }
        } else {
            const raysForCurrent = this._getRaysForCurrentSymbol();
            let hit = null;
            
            for (const item of raysForCurrent) {
                if (!item.primitive || !item.primitive._paneView || !item.primitive._paneView._renderer) continue;
                const hitType = item.primitive._paneView._renderer.hitTest(x, y);
                if (hitType) {
                    hit = { ray: item.ray, type: hitType };
                    break;
                }
            }
            
            const hitRay = hit ? hit.ray : null;

            if (hitRay) {
                container.style.cursor = 'grab';
            } else {
                container.style.cursor = 'crosshair';
            }

            if (this._hoveredRay !== hitRay) {
                if (this._hoveredRay) {
                    this._hoveredRay.hovered = false;
                }
                this._hoveredRay = hitRay;
                if (hitRay) {
                    hitRay.hovered = true;
                }
                this._requestRedraw();
            }
        }
    });

    container.addEventListener('mouseup', (e) => {
        this._potentialDrag = null;

        if (this._isDragging) {
            e.preventDefault();
            e.stopPropagation();

            this._isDragging = false;
            if (this._dragRay) {
                this._dragRay.dragging = false;
                this._dragRay.attached = false;
                
                const newAnchor = this._findClosestCandleTime(this._dragRay.time);
                if (newAnchor) {
                    this._dragRay.anchorTime = newAnchor;
                }
                
                this._saveRays();
                this._dragRay = null;
                this._requestRedraw();
            }

            container.style.cursor = 'crosshair';

            setTimeout(() => {
                const moveEvent = new MouseEvent('mousemove', {
                    clientX: e.clientX,
                    clientY: e.clientY
                });
                container.dispatchEvent(moveEvent);
            }, 10);
        }
    });

    container.addEventListener('mouseleave', () => {
        if (this._hoveredRay) {
            this._hoveredRay.hovered = false;
            this._hoveredRay = null;
            this._requestRedraw();
        }
        container.style.cursor = 'crosshair';
    });

    container.addEventListener('click', (e) => {
        if (this._isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (this._isDrawingMode) {
            this._handleChartClick(e);
        }
    });

    container.addEventListener('contextmenu', (e) => {
        this._handleContextMenu(e);
    });

    container.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }
        const hit = this.hitTest(x, y);
        
        if (hit) {
            this.deleteRay(hit.ray.id);
            
            if (this._selectedRay && this._selectedRay.id === hit.ray.id) {
                this._selectedRay = null;
            }
            if (this._hoveredRay && this._hoveredRay.id === hit.ray.id) {
                this._hoveredRay = null;
            }
            
            this._requestRedraw();
        }
    });
}

    setDrawingMode(enabled) {
        this._isDrawingMode = enabled;
        
        const rayBtn = document.getElementById('toolHorizontalRay');
        if (rayBtn) {
            if (enabled) {
                rayBtn.style.background = '#4A90E2';
                rayBtn.style.color = '#FFFFFF';
                rayBtn.classList.add('active');
            } else {
                rayBtn.style.background = '';
                rayBtn.style.color = '';
                rayBtn.classList.remove('active');
            }
        }
    }

    setMagnetEnabled(enabled) {
        this._magnetEnabled = enabled;
        const magnetBtn = document.getElementById('toolMagnet');
        if (magnetBtn) {
            if (enabled) {
                magnetBtn.style.background = '#4A90E2';
                magnetBtn.style.color = '#FFFFFF';
                magnetBtn.classList.add('magnet-active');
            } else {
                magnetBtn.style.background = '';
                magnetBtn.style.color = '';
                magnetBtn.classList.remove('magnet-active');
            }
        }
    }

    createRay(price, time, options = {}) {
        const defaultVisibility = {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        
        const timeframeVisibility = options.timeframeVisibility || defaultVisibility;
        
        const ray = new HorizontalRay(price, time, {
            ...options,
            timeframeVisibility: timeframeVisibility
        });
        // FIX: anchorTime уже установлен в конструкторе, но на всякий случай
        ray.anchorTime = time;
        if (options.anchorCandle) {
            ray.anchorCandle = { ...options.anchorCandle };
        }
        
        ray.symbolKey = this._getCurrentSymbolKey();
        ray.symbol = this._chartManager.currentSymbol;
        ray.exchange = this._chartManager.currentExchange;
        ray.marketType = this._chartManager.currentMarketType;
        
        const primitive = new HorizontalRayPrimitive(ray, this._chartManager);
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        series.attachPrimitive(primitive);
        this._rays.push({ ray, primitive, series });
        this._saveRays();
        return ray;
    }
    
    deleteRay(rayId) {
    console.log('🗑️ Удаление луча:', rayId);
    
    const index = this._rays.findIndex(r => r.ray.id === rayId);
    if (index !== -1) {
        const { primitive, series, ray } = this._rays[index];
        
        // ========== ДОБАВИТЬ УДАЛЕНИЕ ИЗ INDEXEDDB ==========
        window.db.delete('drawings', rayId).catch(e => console.warn(e));
        // ====================================================
        
        try { 
            if (series && primitive) {
                series.detachPrimitive(primitive); 
            }
        } catch (e) {
            console.warn('Ошибка при detach:', e);
        }
        this._rays.splice(index, 1);
        
        if (this._selectedRay && this._selectedRay.id === rayId) {
            this._selectedRay = null;
        }
        if (this._dragRay && this._dragRay.id === rayId) {
            this._dragRay = null;
        }
        
        this._saveRays(); // ← этот метод сохраняет ТОЛЬКО существующие лучи, удалённый не сохранит
        this._requestRedraw();
        
        const menu = document.getElementById('drawingContextMenu');
        if (menu) menu.style.display = 'none';
        
        return true;
    }
    console.warn('Луч не найден:', rayId);
    return false;
}
    deleteAllRays() {
    const currentKey = this._getCurrentSymbolKey();
    const raysToDelete = this._rays.filter(item => item.ray.symbolKey === currentKey);
    
    // ========== ДОБАВИТЬ УДАЛЕНИЕ ВСЕХ ЛУЧЕЙ ИЗ INDEXEDDB ==========
    for (const item of raysToDelete) {
        window.db.delete('drawings', item.ray.id).catch(e => console.warn(e));
    }
    // ================================================================
    
    raysToDelete.forEach(({ primitive, series }) => {
        try { 
            if (series && primitive) {
                series.detachPrimitive(primitive); 
            }
        } catch (e) {}
    });
    
    this._rays = this._rays.filter(item => item.ray.symbolKey !== currentKey);
    
    if (this._selectedRay && this._selectedRay.symbolKey === currentKey) {
        this._selectedRay = null;
    }
    if (this._dragRay && this._dragRay.symbolKey === currentKey) {
        this._dragRay = null;
    }
    
    this._saveRays();
    this._requestRedraw();
}
    
    hitTest(x, y) {
        const raysForCurrent = this._getRaysForCurrentSymbol();
        
        for (const item of raysForCurrent) {
            if (!item.primitive || !item.primitive._paneView || !item.primitive._paneView._renderer) continue;
            
            const hitType = item.primitive._paneView._renderer.hitTest(x, y);
            if (hitType) {
                return { ray: item.ray, type: hitType };
            }
        }
        return null;
    }
    
    // FIX: удалён syncWithNewTimeframe - больше не нужен, всё делает updateAllViews
    
    _handleChartClick(event) {
        if (!this._isDrawingMode) return;
        
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        let price = this._chartManager.coordinateToPrice(y);
        let time = this._chartManager.coordinateToTime(x);
        let anchorCandle = null;
        
        if (price === null || time === null) {
            const lastCandle = this._chartManager.getLastCandle();
            if (lastCandle) {
                price = lastCandle.close;
                time = lastCandle.time;
            } else {
                return;
            }
        }
        
        if (this._magnetEnabled) {
            const snapped = this._snapToPrice(price, time);
            price = snapped.price;
            time = snapped.time;
            anchorCandle = snapped.anchorCandle;
        } else {
            const snappedTime = this._findClosestCandleTime(time);
            if (snappedTime) {
                time = snappedTime;
            }
        }
        
        this.createRay(price, time, {
            color: document.getElementById('currentColorBox')?.style.backgroundColor || '#0933e2',
            lineWidth: parseInt(document.getElementById('settingThickness')?.value) || 2,
            lineStyle: document.getElementById('templateSelect')?.value || 'solid',
            opacity: parseInt(document.getElementById('colorOpacity')?.value) / 100,
            showPrice: true,
            anchorCandle: anchorCandle
        });
        
        this.setDrawingMode(false);
    }

    _snapToPrice(price, time) {
        if (!this._chartManager.chartData.length) return { price, time, anchorCandle: null };
        
        const data = this._chartManager.chartData;
        
        let closestCandle = data[0];
        let minTimeDiff = Math.abs(data[0].time - time);
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minTimeDiff) { 
                minTimeDiff = diff; 
                closestCandle = data[i]; 
            }
        }
        
        const priceY = this._chartManager.priceToCoordinate(price);
        const highY = this._chartManager.priceToCoordinate(closestCandle.high);
        const lowY = this._chartManager.priceToCoordinate(closestCandle.low);
        const closeY = this._chartManager.priceToCoordinate(closestCandle.close);
        
        if (priceY === null || highY === null) return { price, time, anchorCandle: null };
        
        const dHighPx = Math.abs(highY - priceY);
        const dLowPx = Math.abs(lowY - priceY);
        const dClosePx = Math.abs(closeY - priceY);
        
        let snappedPrice = price;
        let anchorType = null;
        const MAGNET_THRESHOLD = 150;
        
        const minDistPx = Math.min(dHighPx, dLowPx, dClosePx);
        
        if (minDistPx < MAGNET_THRESHOLD) {
            if (minDistPx === dHighPx) {
                snappedPrice = closestCandle.high;
                anchorType = 'high';
            } else if (minDistPx === dLowPx) {
                snappedPrice = closestCandle.low;
                anchorType = 'low';
            } else {
                snappedPrice = closestCandle.close;
                anchorType = 'close';
            }
        }
        
        return { 
            price: snappedPrice, 
            time: closestCandle.time,
            anchorCandle: {
                time: closestCandle.time,
                type: anchorType,
                price: snappedPrice
            }
        };
    }
    
    _findClosestCandleTime(time) {
        if (!this._chartManager.chartData.length) return time;
        
        const data = this._chartManager.chartData;
        let closestCandle = data[0];
        let minDiff = Math.abs(data[0].time - time);
        
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minDiff) {
                minDiff = diff;
                closestCandle = data[i];
            }
        }
        
        return closestCandle.time;
    }

    _showSettings(ray) {
        const settings = document.getElementById('drawingSettings');
        
        document.getElementById('currentColorBox').style.backgroundColor = ray.options.color;
        document.getElementById('hexInputInline').value = ray.options.color;
        document.getElementById('settingThickness').value = ray.options.lineWidth;
        document.getElementById('templateSelect').value = ray.options.lineStyle;
        document.getElementById('colorOpacity').value = Math.round(ray.options.opacity * 100);
        document.getElementById('colorOpacityValue').textContent = document.getElementById('colorOpacity').value + '%';
        
        const priceInput = document.getElementById('settingsPriceInput');
        if (priceInput) {
            priceInput.value = Utils.formatPrice(ray.price);
            priceInput.addEventListener('contextmenu', (e) => {
                e.stopPropagation();
            });
        }

        const hexInput = document.getElementById('hexInputInline');
        if (hexInput) {
            hexInput.addEventListener('contextmenu', (e) => {
                e.stopPropagation();
            });
        }

        this._renderTimeframeCheckboxes(ray);
        
        settings.style.display = 'block';
        settings.style.left = '50%';
        settings.style.top = '50%';
        settings.style.transform = 'translate(-50%, -50%)';
        
        settings.addEventListener('mousedown', (e) => e.stopPropagation());
        settings.addEventListener('mousemove', (e) => e.stopPropagation());
        settings.addEventListener('mouseup', (e) => e.stopPropagation());
        settings.addEventListener('click', (e) => e.stopPropagation());
        
        let header = settings.querySelector('.settings-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'settings-header';
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #404040;';
            
            const title = document.createElement('span');
            title.textContent = 'Настройки луча';
            title.style.color = '#FFFFFF';
            title.style.fontSize = '14px';
            title.style.fontWeight = 'bold';
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = 'background: transparent; border: none; color: #B0B0B0; font-size: 18px; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px;';
            closeBtn.onmouseover = () => closeBtn.style.background = '#404040';
            closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                settings.style.display = 'none';
            };
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            settings.insertBefore(header, settings.firstChild);
        }
        
        const closeOnOutsideClick = (e) => {
            if (!settings.contains(e.target) && settings.style.display === 'block') {
                settings.style.display = 'none';
                document.removeEventListener('mousedown', closeOnOutsideClick);
            }
        };
        
        document.removeEventListener('mousedown', closeOnOutsideClick);
        setTimeout(() => {
            document.addEventListener('mousedown', closeOnOutsideClick);
        }, 100);
        
        const stylePanel = document.getElementById('stylePanel');
        const visibilityPanel = document.getElementById('visibilityPanel');
        const tabs = document.querySelectorAll('#drawingSettings .settings-tab');
        
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.settingsTab === 'style') {
                tab.classList.add('active');
            }
        });
        stylePanel.classList.add('active');
        visibilityPanel.classList.remove('active');
        
        tabs.forEach(tab => {
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
        });
        
        document.querySelectorAll('#drawingSettings .settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#drawingSettings .settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if (tab.dataset.settingsTab === 'style') {
                    stylePanel.classList.add('active');
                    visibilityPanel.classList.remove('active');
                } else {
                    stylePanel.classList.remove('active');
                    visibilityPanel.classList.add('active');
                }
            });
        });
        
        const applyBtn = document.getElementById('applyPriceBtn');
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        
        newApplyBtn.addEventListener('click', () => {
            const newPrice = parseFloat(document.getElementById('settingsPriceInput').value);
            if (!isNaN(newPrice)) {
                ray.price = newPrice;
                this._requestRedraw();
                this._saveRays();
            }
        });
        
        const saveBtn = document.getElementById('saveSettings');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', () => {
            ray.updateOptions({
                color: document.getElementById('currentColorBox').style.backgroundColor,
                lineWidth: parseInt(document.getElementById('settingThickness').value),
                lineStyle: document.getElementById('templateSelect').value,
                opacity: parseInt(document.getElementById('colorOpacity').value) / 100
            });
            this._requestRedraw();
            settings.style.display = 'none';
            this._saveRays();
        });
        
        const deleteBtn = document.getElementById('deleteDrawing');
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', () => {
            this.deleteRay(ray.id);
            settings.style.display = 'none';
            this._requestRedraw();
        });
    }

    _renderTimeframeCheckboxes(ray) {
        const container = document.getElementById('timeframeCheckboxList');
        if (!container) return;
        
        const tfLabels = {
            '1m': '1 минута', '3m': '3 минуты', '5m': '5 минут', '15m': '15 минут',
            '30m': '30 минут', '1h': '1 час', '4h': '4 часа', '6h': '6 часов',
            '12h': '12 часов', '1d': '1 день', '1w': '1 неделя', '1M': '1 месяц'
        };
        
        let html = '';
        const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d', '1w', '1M'];
        
        timeframes.forEach(tf => {
            const isChecked = ray.timeframeVisibility[tf] !== false;
            const label = tfLabels[tf] || tf;
            const shortLabel = tf;
            
            html += `
                <div class="timeframe-checkbox-item">
                    <input type="checkbox" id="tf_${tf}_${ray.id}" data-timeframe="${tf}" ${isChecked ? 'checked' : ''}>
                    <label for="tf_${tf}_${ray.id}">${label}</label>
                    <span class="tf-badge">${shortLabel}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const tf = e.target.dataset.timeframe;
                ray.timeframeVisibility[tf] = e.target.checked;
                this._requestRedraw(); // FIX: обновляем отображение при изменении видимости
            });
        });
        
        const selectAllBtn = document.getElementById('selectAllTimeframes');
        const deselectAllBtn = document.getElementById('deselectAllTimeframes');
        
        if (selectAllBtn) {
            const newSelectAll = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode.replaceChild(newSelectAll, selectAllBtn);
            
            newSelectAll.addEventListener('click', () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                    const tf = cb.dataset.timeframe;
                    ray.timeframeVisibility[tf] = true;
                });
                this._requestRedraw(); // FIX: обновляем отображение
            });
        }
        
        if (deselectAllBtn) {
            const newDeselectAll = deselectAllBtn.cloneNode(true);
            deselectAllBtn.parentNode.replaceChild(newDeselectAll, deselectAllBtn);
            
            newDeselectAll.addEventListener('click', () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                    const tf = cb.dataset.timeframe;
                    ray.timeframeVisibility[tf] = false;
                });
                this._requestRedraw(); // FIX: обновляем отображение
            });
        }
    }
    
    // FIX: добавлен метод для синхронизации с новым таймфреймом
    syncWithNewTimeframe() {
        // Обновляем все лучи через updateAllViews
        const raysForCurrent = this._getRaysForCurrentSymbol();
        raysForCurrent.forEach(item => {
            if (item.primitive && item.primitive.updateAllViews) {
                item.primitive.updateAllViews();
            }
            if (item.primitive && item.primitive.requestRedraw) {
                item.primitive.requestRedraw();
            }
        });
        this._requestRedraw();
    }
    
    _requestRedraw() {
        const raysForCurrent = this._getRaysForCurrentSymbol();
        raysForCurrent.forEach(item => { 
            if (item.primitive?.requestRedraw) {
                item.primitive.requestRedraw();
            }
        });
    }

   async _saveRays() {
    if (this._rays.length === 0) return;
    
    const promises = this._rays.map(({ ray }) => 
        window.db.put('drawings', {
            id: ray.id,
            type: 'ray',
            symbolKey: ray.symbolKey,
            data: {
                price: ray.price,
                time: ray.time,
                anchorTime: ray.anchorTime,
                options: ray.options,
                timeframeVisibility: ray.timeframeVisibility,
                anchorCandle: ray.anchorCandle
            }
        }).catch(e => console.warn('Save ray error:', e))
    );
    
    await Promise.all(promises);
    console.log(`💾 Saved ${this._rays.length} rays`);
}
async loadRays() {
    while (this._isLoading) {
        await new Promise(r => setTimeout(r, 50));
    }
    this._isLoading = true;

    try {
        await waitForReady([
            () => window.dbReady === true,
            () => this._chartManager?.chartData?.length > 0
        ]);

        const currentKey = this._getCurrentSymbolKey();
        console.log('📊 Loading rays for:', currentKey);

        const raysData = await window.db.getByIndex('drawings', 'symbolKey', currentKey);
        const rayRecords = raysData.filter(r => r.type === 'ray');

        const newRays = [];
        
        for (const rec of rayRecords) {
            // ⚠️ ПРОВЕРКА: если во время загрузки символ сменился – прерываем
            if (this._getCurrentSymbolKey() !== currentKey) {
                console.warn('⏹️ Symbol changed during load, aborting');
                return;
            }

            // 🔁 ПОЛУЧАЕМ АКТУАЛЬНУЮ СЕРИЮ ПРЯМО СЕЙЧАС
            const series = this._chartManager.currentChartType === 'candle' 
                ? this._chartManager.candleSeries 
                : this._chartManager.barSeries;

            if (!series) {
                console.warn('Series not ready for ray, skipping');
                continue;
            }

            try {
                const ray = new HorizontalRay(rec.data.price, rec.data.time, rec.data.options);
                ray.id = rec.id;
                ray.anchorTime = rec.data.anchorTime;
                ray.timeframeVisibility = rec.data.timeframeVisibility;
                ray.anchorCandle = rec.data.anchorCandle;
                ray.symbolKey = rec.symbolKey;

                const primitive = new HorizontalRayPrimitive(ray, this._chartManager);
                series.attachPrimitive(primitive);
                newRays.push({ ray, primitive, series });
            } catch (e) {
                console.warn('Failed to attach ray:', rec.id, e);
            }
        }

        // Удаляем старые примитивы (только те, что относятся к текущему символу)
        this._rays.forEach(item => {
            if (item.ray.symbolKey === currentKey) {
                try { item.series?.detachPrimitive(item.primitive); } catch(e) {}
            }
        });

        // Заменяем только лучи текущего символа
        this._rays = [
            ...this._rays.filter(item => item.ray.symbolKey !== currentKey),
            ...newRays
        ];

        this._requestRedraw();
        console.log(`✅ Loaded ${newRays.length} rays for ${currentKey}`);
    } catch (error) {
        console.error('❌ loadRays failed:', error);
    } finally {
        this._isLoading = false;
    }
}
    
    // FIX: добавлен метод для переприкрепления лучей при смене серии
    reattachRays() {
        const currentKey = this._getCurrentSymbolKey();
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        
        this._rays.forEach(item => {
            if (item.ray.symbolKey === currentKey) {
                try {
                    if (item.series && item.primitive) {
                        item.series.detachPrimitive(item.primitive);
                    }
                    if (series && item.primitive) {
                        series.attachPrimitive(item.primitive);
                    }
                    item.series = series;
                } catch(e) {
                    console.warn('Ошибка переприкрепления луча:', e);
                }
            }
        });
        
        this._requestRedraw();
    }
} 
// ========== ТРЕНДОВАЯ ЛИНИЯ (ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ) ==========
class TrendLine {
    constructor(point1, point2, options = {}) {
        this.id = `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.point1 = point1 || { price: 0, time: 0 };
        this.point2 = point2 || { price: 0, time: 0 };
        this.anchorTime1 = point1?.time || 0;
        this.anchorTime2 = point2?.time || 0;
        this.options = {
            color: options.color || '#4A90E2',
            lineWidth: options.lineWidth || 2,
            lineStyle: options.lineStyle || 'solid',
            opacity: options.opacity !== undefined ? options.opacity : 0.9,
            extendRight: options.extendRight || false,   // <-- НОВОЕ: продолжение вправо
            ...options
        };
        this.anchorCandle1 = options.anchorCandle1 || null;
        this.anchorCandle2 = options.anchorCandle2 || null;
        this.timeframeVisibility = options.timeframeVisibility || {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        this.selected = false;
        this.hovered = false;
        this.dragging = false;
        this.showDragPoint1 = false;
        this.showDragPoint2 = false;
        this.dragPointX1 = 0;
        this.dragPointY1 = 0;
        this.dragPointX2 = 0;
        this.dragPointY2 = 0;
        this._tempPixel1 = null;
        this._tempPixel2 = null;
        this._pixelStart1 = null;
        this._pixelStart2 = null;
        this.symbolKey = options.symbolKey || null;
        this.symbol = options.symbol || null;
        this.exchange = options.exchange || null;
        this.marketType = options.marketType || null;
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }
    
    isVisibleOnTimeframe(timeframe) {
        return this.timeframeVisibility[timeframe] !== false;
    }
}

class TrendLineRenderer {
    constructor(trendLine, chartManager) {
        this._trendLine = trendLine;
        this._chartManager = chartManager;
        this._hitAreaLine = null;
        this._hitAreaPoint1 = null;
        this._hitAreaPoint2 = null;
        // КЭШ ПОСЛЕДНИХ ВАЛИДНЫХ КООРДИНАТ – предотвращает исчезновение при null
        this._lastValidPoint1 = null;
        this._lastValidPoint2 = null;
        this._isMac = /Mac/.test(navigator.userAgent);
        this._pixelRatio = window.devicePixelRatio || 1;
    }

    draw(target) {
        const currentKey = this._chartManager.getCurrentSymbolKey?.();
        if (currentKey && this._trendLine.symbolKey !== currentKey) return;

        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const line = this._trendLine;
            const chartManager = this._chartManager;

            const currentTf = chartManager.currentInterval;
            if (!line.isVisibleOnTimeframe(currentTf)) return;

            let point1X, point1Y, point2X, point2Y;

            // ===== ИСПОЛЬЗУЕМ FALLBACK-МЕТОДЫ =====
            if (line._tempPixel1) {
                point1X = line._tempPixel1.x / scope.horizontalPixelRatio;
                point1Y = line._tempPixel1.y / scope.verticalPixelRatio;
            } else {
                point1X = chartManager.timeToCoordinateWithFallback?.(line.point1.time) 
                          ?? chartManager.timeToCoordinate(line.point1.time);
                point1Y = chartManager.priceToCoordinateWithFallback?.(line.point1.price)
                          ?? chartManager.priceToCoordinate(line.point1.price);
            }

            if (line._tempPixel2) {
                point2X = line._tempPixel2.x / scope.horizontalPixelRatio;
                point2Y = line._tempPixel2.y / scope.verticalPixelRatio;
            } else {
                point2X = chartManager.timeToCoordinateWithFallback?.(line.point2.time) 
                          ?? chartManager.timeToCoordinate(line.point2.time);
                point2Y = chartManager.priceToCoordinateWithFallback?.(line.point2.price)
                          ?? chartManager.priceToCoordinate(line.point2.price);
            }

            // ===== ЕСЛИ ДАННЫЕ ПРОПАЛИ, ИСПОЛЬЗУЕМ КЭШ =====
            if (point1X === null || point1Y === null || point2X === null || point2Y === null) {
                if (this._lastValidPoint1 && this._lastValidPoint2) {
                    point1X = this._lastValidPoint1.x;
                    point1Y = this._lastValidPoint1.y;
                    point2X = this._lastValidPoint2.x;
                    point2Y = this._lastValidPoint2.y;
                } else {
                    return; // нечего рисовать
                }
            } else {
                // Сохраняем валидные координаты
                this._lastValidPoint1 = { x: point1X, y: point1Y };
                this._lastValidPoint2 = { x: point2X, y: point2Y };
            }

            const { position: x1 } = positionsLine(point1X, scope.horizontalPixelRatio, 1, true);
            const { position: y1, length: y1Length } = positionsLine(point1Y, scope.verticalPixelRatio, line.options.lineWidth, false);
            const { position: x2 } = positionsLine(point2X, scope.horizontalPixelRatio, 1, true);
            const { position: y2, length: y2Length } = positionsLine(point2Y, scope.verticalPixelRatio, line.options.lineWidth, false);

            this._hitAreaPoint1 = { x: x1, y: y1 + y1Length/2, radius: 10 };
            this._hitAreaPoint2 = { x: x2, y: y2 + y2Length/2, radius: 10 };
            this._hitAreaLine = {
                x1, y1: y1 + y1Length/2,
                x2, y2: y2 + y2Length/2,
                height: y1Length
            };

            ctx.save();

            const color = line.options.color;
            const opacity = line.options.opacity !== undefined ? line.options.opacity : 0.9;

            const parseHex = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
            };
            const parseRgb = (rgb) => {
                const result = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(rgb);
                return result ? { r: parseInt(result[1], 10), g: parseInt(result[2], 10), b: parseInt(result[3], 10) } : null;
            };

            let rgbaColor;
            let parsed = parseHex(color) || parseRgb(color);
            if (parsed) {
                rgbaColor = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${opacity})`;
            } else {
                rgbaColor = color;
            }

            ctx.strokeStyle = rgbaColor;
            ctx.lineWidth = y1Length;

            if (line.options.lineStyle === 'dashed') ctx.setLineDash([10, 8]);
            else if (line.options.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
            else ctx.setLineDash([]);

            // ===== ОСНОВНАЯ ЛИНИЯ МЕЖДУ ТОЧКАМИ =====
            ctx.beginPath();
            ctx.moveTo(x1, y1 + y1Length/2);
            ctx.lineTo(x2, y2 + y2Length/2);
            ctx.stroke();

            // ===== ПРОДОЛЖЕНИЕ ВПРАВО (ЕСЛИ ВКЛЮЧЕНО) =====
            if (line.options.extendRight) {
                // Находим правую границу графика в координатах контекста
                const rightBoundX = scope.bitmapSize.width;
                
                // Вычисляем точку пересечения с правой границей
                let extendX, extendY;
                
                if (Math.abs(x2 - x1) < 0.001) {
                    // Вертикальная линия
                    extendX = x1;
                    extendY = y2 + y2Length/2;
                } else {
                    const slope = ( (y2 + y2Length/2) - (y1 + y1Length/2) ) / (x2 - x1);
                    const intercept = (y1 + y1Length/2) - slope * x1;
                    extendX = rightBoundX;
                    extendY = slope * extendX + intercept;
                }
                
                // Рисуем продолжение (от правой точки до правой границы)
                ctx.beginPath();
                ctx.moveTo(x2, y2 + y2Length/2);
                ctx.lineTo(extendX, extendY);
                ctx.stroke();
            }

            if (line.hovered || line.dragging || line.selected) {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x1, y1 + y1Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = rgbaColor;
                ctx.beginPath();
                ctx.arc(x1, y1 + y1Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x2, y2 + y2Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = rgbaColor;
                ctx.beginPath();
                ctx.arc(x2, y2 + y2Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();

                ctx.shadowBlur = 0;
            }

            ctx.restore();
        });
    }

    hitTest(x, y) {
    const mac = this._isMac && this._pixelRatio > 1;
    
    if (this._hitAreaPoint1) {
        const radius = mac ? 20 : this._hitAreaPoint1.radius;
        const dx = x - this._hitAreaPoint1.x;
        const dy = y - this._hitAreaPoint1.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < radius) return { type: 'point1', trendLine: this._trendLine };
    }
    if (this._hitAreaPoint2) {
        const radius = mac ? 20 : this._hitAreaPoint2.radius;
        const dx = x - this._hitAreaPoint2.x;
        const dy = y - this._hitAreaPoint2.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < radius) return { type: 'point2', trendLine: this._trendLine };
    }
    if (this._hitAreaLine) {
        const buffer = mac ? 25 : 15;
        const x1 = this._hitAreaLine.x1, y1 = this._hitAreaLine.y1;
        const x2 = this._hitAreaLine.x2, y2 = this._hitAreaLine.y2;
        const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        const dx = x - xx, dy = y - yy;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < buffer) return { type: 'line', trendLine: this._trendLine };
    }
    return null;
}
}
class TrendLinePaneView {
    constructor(trendLine, chartManager) {
        this._trendLine = trendLine;
        this._chartManager = chartManager;
        this._renderer = new TrendLineRenderer(trendLine, chartManager);
    }
    renderer() { return this._renderer; }
    zOrder() { return 'top'; }
}

class TrendLinePrimitive {
    constructor(trendLine, chartManager) {
        this._trendLine = trendLine;
        this._chartManager = chartManager;
        this._paneView = new TrendLinePaneView(trendLine, chartManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    paneViews() { return [this._paneView]; }
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
        this._syncPointsTime();
    }
    updateAllViews() {
        const oldTime1 = this._trendLine.point1.time;
        const oldTime2 = this._trendLine.point2.time;
        this._syncPointsTime();
        if (this._trendLine.point1.time !== oldTime1 || this._trendLine.point2.time !== oldTime2) {
            if (this._requestUpdate) this._requestUpdate();
        }
    }
    _syncPointsTime() {
        const chartData = this._chartManager.chartData;
        if (!chartData || chartData.length === 0) return;
        const syncPoint = (anchorTime) => {
            let intervalMs = 60 * 60 * 1000;
            if (chartData.length >= 2) intervalMs = chartData[1].time - chartData[0].time;
            let newTime = anchorTime;
            for (let i = 0; i < chartData.length; i++) {
                const start = chartData[i].time;
                const end = start + intervalMs;
                if (anchorTime >= start && anchorTime < end) { newTime = start; break; }
            }
            if (newTime === anchorTime && chartData.length) {
                let closest = chartData[0];
                let minDiff = Math.abs(closest.time - anchorTime);
                for (let i = 1; i < chartData.length; i++) {
                    const diff = Math.abs(chartData[i].time - anchorTime);
                    if (diff < minDiff) { minDiff = diff; closest = chartData[i]; }
                }
                newTime = closest.time;
            }
            return newTime;
        };
        this._trendLine.point1.time = syncPoint(this._trendLine.anchorTime1);
        this._trendLine.point2.time = syncPoint(this._trendLine.anchorTime2);
    }
    getTrendLine() { return this._trendLine; }
    requestRedraw() { if (this._requestUpdate) this._requestUpdate(); }
}

class TempTrendLinePrimitive {
    constructor(trendLineManager) {
        this._manager = trendLineManager;
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    paneViews() {
        if (!this._manager || !this._manager._tempLine) return [];
        return [{
            zOrder: () => 'top',
            renderer: () => ({
                draw: (target) => {
                    target.useBitmapCoordinateSpace(scope => {
                        const ctx = scope.context;
                        const tempLine = this._manager._tempLine;
                        const chartManager = this._manager._chartManager;
                        if (!tempLine || !tempLine.point1 || !tempLine.point2) return;

                        // ===== ИСПОЛЬЗУЕМ FALLBACK =====
                        const point1X = chartManager.timeToCoordinateWithFallback?.(tempLine.point1.time) 
                                        ?? chartManager.timeToCoordinate(tempLine.point1.time);
                        const point1Y = chartManager.priceToCoordinateWithFallback?.(tempLine.point1.price)
                                        ?? chartManager.priceToCoordinate(tempLine.point1.price);
                        const point2X = chartManager.timeToCoordinateWithFallback?.(tempLine.point2.time) 
                                        ?? chartManager.timeToCoordinate(tempLine.point2.time);
                        const point2Y = chartManager.priceToCoordinateWithFallback?.(tempLine.point2.price)
                                        ?? chartManager.priceToCoordinate(tempLine.point2.price);

                        if (point1X === null || point1Y === null || point2X === null || point2Y === null) return;

                        const { position: x1 } = positionsLine(point1X, scope.horizontalPixelRatio, 1, true);
                        const { position: y1, length: y1Length } = positionsLine(point1Y, scope.verticalPixelRatio, tempLine.options.lineWidth || 2, false);
                        const { position: x2 } = positionsLine(point2X, scope.horizontalPixelRatio, 1, true);
                        const { position: y2, length: y2Length } = positionsLine(point2Y, scope.verticalPixelRatio, tempLine.options.lineWidth || 2, false);

                        ctx.save();
                        ctx.strokeStyle = tempLine.options.color || '#4A90E2';
                        ctx.lineWidth = y1Length;
                        if (tempLine.options.lineStyle === 'dashed') ctx.setLineDash([10, 8]);
                        else if (tempLine.options.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
                        else ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.moveTo(x1, y1 + y1Length/2);
                        ctx.lineTo(x2, y2 + y2Length/2);
                        ctx.stroke();
                        
                        // Рисуем точки для временной линии
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.shadowBlur = 4;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(x1, y1 + y1Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = tempLine.options.color;
                        ctx.beginPath();
                        ctx.arc(x1, y1 + y1Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(x2, y2 + y2Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = tempLine.options.color;
                        ctx.beginPath();
                        ctx.arc(x2, y2 + y2Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        ctx.restore();
                    });
                }
            })
        }];
    }
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
    }
    updateAllViews() {}
    requestRedraw() { if (this._requestUpdate) this._requestUpdate(); }
}

// ========== МЕНЕДЖЕР ТРЕНДОВЫХ ЛИНИЙ (ИСПРАВЛЕН) ==========
class TrendLineManager {
    constructor(chartManager) {
        this._trendLines = [];
        this._chartManager = chartManager;
        this._selectedLine = null;
        this._hoveredLine = null;
        this._isDrawingMode = false;
        this._magnetEnabled = true;
        this._tempLine = null;
        this._tempPrimitive = null;
        this._isDragging = false;
        this._dragLine = null;
        this._dragPoint = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartPoint1 = { price: 0, time: 0 };
        this._dragStartPoint2 = { price: 0, time: 0 };
        this._drawingStartPoint = null;
        this._isDrawingSecondPoint = false;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._potentialDrag = null;
        this._dragThreshold = 5;
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
        this._handleMouseLeave = this._handleMouseLeave.bind(this);
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._handleDblClick = this._handleDblClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._setupEventListeners();
        this._setupHotkeys();
        this._autoLoadTrendLines();
        this._isLoading = false;
        this._isMac = /Mac/.test(navigator.userAgent);
        this._pixelRatio = window.devicePixelRatio || 1;
    }

    _setupEventListeners() {
        const container = this._chartManager.chartContainer;
        container.addEventListener('mousedown', this._handleMouseDown);
        container.addEventListener('mousemove', this._handleMouseMove);
        container.addEventListener('mouseup', this._handleMouseUp);
        container.addEventListener('mouseleave', this._handleMouseLeave);
        container.addEventListener('contextmenu', this._handleContextMenu);
        container.addEventListener('dblclick', this._handleDblClick);
        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            this._lastMouseX = e.clientX - rect.left;
            this._lastMouseY = e.clientY - rect.top;
        });
    }

    _setupHotkeys() {
        document.addEventListener('keydown', this._handleKeyDown);
    }
    
    _getCurrentSymbolKey() {
        const symbol = this._chartManager.currentSymbol || 'BTCUSDT';
        const exchange = this._chartManager.currentExchange || 'binance';
        const marketType = this._chartManager.currentMarketType || 'futures';
        return `${symbol}:${exchange}:${marketType}`;
    }

    setDrawingMode(enabled) {
        this._isDrawingMode = enabled;
        const trendBtn = document.getElementById('toolTrendLine');
        if (trendBtn) {
            if (enabled) {
                trendBtn.style.background = '#4A90E2';
                trendBtn.style.color = '#FFFFFF';
                trendBtn.classList.add('active');
            } else {
                trendBtn.style.background = '';
                trendBtn.style.color = '';
                trendBtn.classList.remove('active');
            }
        }
        if (!enabled) {
            if (this._tempPrimitive) {
                const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
                if (series) try { series.detachPrimitive(this._tempPrimitive); } catch(e) {}
                this._tempPrimitive = null;
            }
            this._drawingStartPoint = null;
            this._isDrawingSecondPoint = false;
            this._tempLine = null;
            this._requestRedraw();
        }
    }

    setMagnetEnabled(enabled) {
        this._magnetEnabled = enabled;
        const magnetBtn = document.getElementById('toolMagnet');
        if (magnetBtn) {
            if (enabled) magnetBtn.classList.add('magnet-active');
            else magnetBtn.classList.remove('magnet-active');
        }
    }

    _getTimeFromCoordinate(x) {
        let time = this._chartManager.coordinateToTime(x);
        if (time !== null) return time;
        const data = this._chartManager.chartData;
        if (!data.length) return null;
        let intervalMs = 60 * 60 * 1000;
        if (data.length >= 2) intervalMs = data[1].time - data[0].time;
        const firstCandle = data[0];
        const lastCandle = data[data.length - 1];
        const firstX = this._chartManager.timeToCoordinate(firstCandle.time);
        const lastX = this._chartManager.timeToCoordinate(lastCandle.time);
        if (firstX === null || lastX === null) return null;
        if (x > lastX) {
            const deltaX = x - lastX;
            const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
            return lastCandle.time + deltaX / pixelsPerMs;
        }
        if (x < firstX) {
            const deltaX = firstX - x;
            const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
            return firstCandle.time - deltaX / pixelsPerMs;
        }
        return null;
    }

    createTrendLine(point1, point2, options = {}) {
        const defaultVisibility = { '1m': true, '3m': true, '5m': true, '15m': true, '30m': true, '1h': true, '4h': true, '6h': true, '12h': true, '1d': true, '1w': true, '1M': true };
        const timeframeVisibility = options.timeframeVisibility || defaultVisibility;
        const trendLine = new TrendLine(point1, point2, { ...options, timeframeVisibility });
        trendLine.anchorTime1 = point1.time;
        trendLine.anchorTime2 = point2.time;
        trendLine.symbolKey = this._getCurrentSymbolKey();
        trendLine.symbol = this._chartManager.currentSymbol;
        trendLine.exchange = this._chartManager.currentExchange;
        trendLine.marketType = this._chartManager.currentMarketType;
        
        const primitive = new TrendLinePrimitive(trendLine, this._chartManager);
        const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
        series.attachPrimitive(primitive);
        this._trendLines.push({ trendLine, primitive, series });
        this._saveTrendLines();
        return trendLine;
    }

    deleteTrendLine(lineId) {
        const index = this._trendLines.findIndex(item => item.trendLine.id === lineId);
        if (index !== -1) {
            const { primitive, series } = this._trendLines[index];
            window.db.delete('drawings', lineId).catch(e => console.warn(e));
            try { series.detachPrimitive(primitive); } catch (e) {}
            this._trendLines.splice(index, 1);
            if (this._selectedLine && this._selectedLine.id === lineId) this._selectedLine = null;
            if (this._dragLine && this._dragLine.id === lineId) this._dragLine = null;
            this._saveTrendLines();
            this._requestRedraw();
            return true;
        }
        return false;
    }

    deleteAllTrendLines() {
        for (const item of this._trendLines) {
            window.db.delete('drawings', item.trendLine.id).catch(e => console.warn(e));
        }
        this._trendLines.forEach(({ primitive, series }) => { try { series.detachPrimitive(primitive); } catch(e) {} });
        this._trendLines = [];
        this._selectedLine = null;
        this._dragLine = null;
        this._saveTrendLines();
        this._requestRedraw();
    }

   _handleMouseDown(e) {
    if (e.button !== 0) return;
    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (this._isMac && this._pixelRatio > 1) {
        x *= this._pixelRatio;
        y *= this._pixelRatio;
    }
    const trendMenu = document.getElementById('trendContextMenu');
    if (trendMenu && trendMenu.style.display === 'flex') {
        const menuRect = trendMenu.getBoundingClientRect();
        const isClickInsideMenu = e.clientX >= menuRect.left && e.clientX <= menuRect.right && e.clientY >= menuRect.top && e.clientY <= menuRect.bottom;
        if (isClickInsideMenu) return;
    }
    if (this._isDrawingMode && this._isDrawingSecondPoint && this._drawingStartPoint) {
        this._completeDrawing(x, y);
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    const hit = this.hitTest(x, y);
    if (hit && hit.trendLine) {
        e.preventDefault();
        e.stopPropagation();
        if (this._selectedLine && this._selectedLine !== hit.trendLine) {
            this._selectedLine.selected = false;
            this._selectedLine.showDragPoint1 = false;
            this._selectedLine.showDragPoint2 = false;
        }
        hit.trendLine.selected = true;
        this._selectedLine = hit.trendLine;

        const point1X = this._chartManager.timeToCoordinateWithFallback?.(hit.trendLine.point1.time) ?? this._chartManager.timeToCoordinate(hit.trendLine.point1.time);
        const point1Y = this._chartManager.priceToCoordinateWithFallback?.(hit.trendLine.point1.price) ?? this._chartManager.priceToCoordinate(hit.trendLine.point1.price);
        const point2X = this._chartManager.timeToCoordinateWithFallback?.(hit.trendLine.point2.time) ?? this._chartManager.timeToCoordinate(hit.trendLine.point2.time);
        const point2Y = this._chartManager.priceToCoordinateWithFallback?.(hit.trendLine.point2.price) ?? this._chartManager.priceToCoordinate(hit.trendLine.point2.price);

        if (point1X !== null && point1Y !== null) { hit.trendLine.dragPointX1 = point1X; hit.trendLine.dragPointY1 = point1Y; }
        if (point2X !== null && point2Y !== null) { hit.trendLine.dragPointX2 = point2X; hit.trendLine.dragPointY2 = point2Y; }
        hit.trendLine.showDragPoint1 = hit.type === 'point1';
        hit.trendLine.showDragPoint2 = hit.type === 'point2';
        this._potentialDrag = { line: hit.trendLine, pointType: hit.type, startX: x, startY: y, startPoint1: { ...hit.trendLine.point1 }, startPoint2: { ...hit.trendLine.point2 } };
        this._requestRedraw();
    } else {
        if (this._isDrawingMode && !this._isDrawingSecondPoint) {
            this._startDrawing(x, y);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (this._selectedLine) {
            this._selectedLine.selected = false;
            this._selectedLine.showDragPoint1 = false;
            this._selectedLine.showDragPoint2 = false;
            this._selectedLine = null;
            this._requestRedraw();
        }
        if (trendMenu) trendMenu.style.display = 'none';
    }
}
   _handleMouseMove(e) {
    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (this._isMac && this._pixelRatio > 1) {
        x *= this._pixelRatio;
        y *= this._pixelRatio;
    }
    this._lastMouseX = x;
    this._lastMouseY = y;
    
    if (this._isDrawingMode && this._isDrawingSecondPoint && this._drawingStartPoint) {
        let price = this._chartManager.coordinateToPrice(y);
        let time = this._getTimeFromCoordinate(x);
        if (price !== null && time !== null) {
            if (this._tempLine) {
                this._tempLine.point2 = { price, time };
            } else {
                this._tempLine = { 
                    point1: this._drawingStartPoint, 
                    point2: { price, time }, 
                    options: { 
                        color: document.getElementById('currentColorBox')?.style.backgroundColor || '#4A90E2', 
                        lineWidth: parseInt(document.getElementById('settingThickness')?.value) || 2, 
                        lineStyle: document.getElementById('templateSelect')?.value || 'solid' 
                    } 
                };
                const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
                if (series && !this._tempPrimitive) { 
                    this._tempPrimitive = new TempTrendLinePrimitive(this); 
                    try { series.attachPrimitive(this._tempPrimitive); } catch(e) {} 
                }
            }
            this._requestRedraw();
        }
        return;
    }

    if (this._potentialDrag && !this._isDragging) {
        const dx = Math.abs(x - this._potentialDrag.startX);
        const dy = Math.abs(y - this._potentialDrag.startY);
        if (dx > 3 || dy > 3) {
            this._isDragging = true;
            this._dragLine = this._potentialDrag.line;
            this._dragPoint = this._potentialDrag.pointType;
            this._dragLine.dragging = true;

            const p1x = this._chartManager.timeToCoordinateWithFallback?.(this._dragLine.point1.time) ?? this._chartManager.timeToCoordinate(this._dragLine.point1.time);
            const p1y = this._chartManager.priceToCoordinateWithFallback?.(this._dragLine.point1.price) ?? this._chartManager.priceToCoordinate(this._dragLine.point1.price);
            const p2x = this._chartManager.timeToCoordinateWithFallback?.(this._dragLine.point2.time) ?? this._chartManager.timeToCoordinate(this._dragLine.point2.time);
            const p2y = this._chartManager.priceToCoordinateWithFallback?.(this._dragLine.point2.price) ?? this._chartManager.priceToCoordinate(this._dragLine.point2.price);

            if (p1x !== null && p1y !== null) this._dragLine._pixelStart1 = { x: p1x, y: p1y };
            if (p2x !== null && p2y !== null) this._dragLine._pixelStart2 = { x: p2x, y: p2y };
            this._dragStartX = this._potentialDrag.startX;
            this._dragStartY = this._potentialDrag.startY;
            this._dragStartPoint1 = { ...this._potentialDrag.startPoint1 };
            this._dragStartPoint2 = { ...this._potentialDrag.startPoint2 };
            this._chartManager.chartContainer.style.cursor = 'grabbing';
        }
    }
    if (this._isDragging && this._dragLine) {
        e.preventDefault();
        e.stopPropagation();
        const deltaX = x - this._dragStartX;
        const deltaY = y - this._dragStartY;
        if (this._dragPoint === 'point1') {
            if (this._dragLine._pixelStart1) {
                this._dragLine._tempPixel1 = { x: this._dragLine._pixelStart1.x + deltaX, y: this._dragLine._pixelStart1.y + deltaY };
                delete this._dragLine._tempPixel2;
            }
        } else if (this._dragPoint === 'point2') {
            if (this._dragLine._pixelStart2) {
                this._dragLine._tempPixel2 = { x: this._dragLine._pixelStart2.x + deltaX, y: this._dragLine._pixelStart2.y + deltaY };
                delete this._dragLine._tempPixel1;
            }
        } else if (this._dragPoint === 'line') {
            if (this._dragLine._pixelStart1 && this._dragLine._pixelStart2) {
                this._dragLine._tempPixel1 = { x: this._dragLine._pixelStart1.x + deltaX, y: this._dragLine._pixelStart1.y + deltaY };
                this._dragLine._tempPixel2 = { x: this._dragLine._pixelStart2.x + deltaX, y: this._dragLine._pixelStart2.y + deltaY };
            }
        }
        this._requestRedraw();
    } else {
        const hit = this.hitTest(x, y);
        const hitLine = hit ? hit.trendLine : null;
        this._chartManager.chartContainer.style.cursor = hitLine ? (hit.type === 'point1' || hit.type === 'point2' ? 'move' : 'grab') : 'crosshair';
        if (this._hoveredLine !== hitLine) {
            if (this._hoveredLine) this._hoveredLine.hovered = false;
            this._hoveredLine = hitLine;
            if (hitLine) hitLine.hovered = true;
            this._requestRedraw();
        }
    }
}
    _handleMouseUp(e) {
        if (this._isDragging) {
            e.preventDefault();
            e.stopPropagation();
            this._isDragging = false;
            if (this._dragLine) {
                if (this._dragPoint === 'point1' && this._dragLine._tempPixel1) {
                    const price = this._chartManager.coordinateToPrice(this._dragLine._tempPixel1.y);
                    const time = this._getTimeFromCoordinate(this._dragLine._tempPixel1.x);
                    if (price !== null && time !== null) {
                        let newPrice = price, newTime = time;
                        if (this._magnetEnabled) {
                            const snapped = this._snapToPrice(price, time);
                            newPrice = snapped.price;
                            newTime = snapped.time;
                            this._dragLine.anchorCandle1 = snapped.anchorCandle;
                        }
                        this._dragLine.point1.price = newPrice;
                        this._dragLine.point1.time = newTime;
                    }
                    delete this._dragLine._tempPixel1;
                }
                else if (this._dragPoint === 'point2' && this._dragLine._tempPixel2) {
                    const price = this._chartManager.coordinateToPrice(this._dragLine._tempPixel2.y);
                    const time = this._getTimeFromCoordinate(this._dragLine._tempPixel2.x);
                    if (price !== null && time !== null) {
                        let newPrice = price, newTime = time;
                        if (this._magnetEnabled) {
                            const snapped = this._snapToPrice(price, time);
                            newPrice = snapped.price;
                            newTime = snapped.time;
                            this._dragLine.anchorCandle2 = snapped.anchorCandle;
                        }
                        this._dragLine.point2.price = newPrice;
                        this._dragLine.point2.time = newTime;
                    }
                    delete this._dragLine._tempPixel2;
                }
                else if (this._dragPoint === 'line' && this._dragLine._tempPixel1 && this._dragLine._tempPixel2) {
                    const price1 = this._chartManager.coordinateToPrice(this._dragLine._tempPixel1.y);
                    const time1 = this._getTimeFromCoordinate(this._dragLine._tempPixel1.x);
                    const price2 = this._chartManager.coordinateToPrice(this._dragLine._tempPixel2.y);
                    const time2 = this._getTimeFromCoordinate(this._dragLine._tempPixel2.x);
                    if (price1 !== null && time1 !== null && price2 !== null && time2 !== null) {
                        let newPrice1 = price1, newTime1 = time1;
                        let newPrice2 = price2, newTime2 = time2;
                        if (this._magnetEnabled) {
                            const snapped1 = this._snapToPrice(price1, time1);
                            const snapped2 = this._snapToPrice(price2, time2);
                            newPrice1 = snapped1.price; newTime1 = snapped1.time;
                            newPrice2 = snapped2.price; newTime2 = snapped2.time;
                            this._dragLine.anchorCandle1 = snapped1.anchorCandle;
                            this._dragLine.anchorCandle2 = snapped2.anchorCandle;
                        }
                        this._dragLine.point1.price = newPrice1;
                        this._dragLine.point1.time = newTime1;
                        this._dragLine.point2.price = newPrice2;
                        this._dragLine.point2.time = newTime2;
                    }
                    delete this._dragLine._tempPixel1;
                    delete this._dragLine._tempPixel2;
                }
                delete this._dragLine._pixelStart1;
                delete this._dragLine._pixelStart2;
                this._dragLine.dragging = false;
                this._dragLine.anchorTime1 = this._dragLine.point1.time;
                this._dragLine.anchorTime2 = this._dragLine.point2.time;
                if (this._selectedLine !== this._dragLine) {
                    this._dragLine.showDragPoint1 = false;
                    this._dragLine.showDragPoint2 = false;
                }
                this._saveTrendLines();
                this._dragLine = null;
                this._requestRedraw();
            }
            this._chartManager.chartContainer.style.cursor = 'crosshair';
        }
        this._potentialDrag = null;
    }

    _handleMouseLeave() {
        if (this._hoveredLine) { this._hoveredLine.hovered = false; this._hoveredLine = null; this._requestRedraw(); }
        this._chartManager.chartContainer.style.cursor = 'crosshair';
    }

  _handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (this._isMac && this._pixelRatio > 1) {
        x *= this._pixelRatio;
        y *= this._pixelRatio;
    }
    const hit = this.hitTest(x, y);
    if (hit && hit.trendLine) {
        if (this._selectedLine && this._selectedLine !== hit.trendLine) {
            this._selectedLine.selected = false;
            this._selectedLine.showDragPoint1 = false;
            this._selectedLine.showDragPoint2 = false;
        }
        hit.trendLine.selected = true;
        hit.trendLine.showDragPoint1 = true;
        hit.trendLine.showDragPoint2 = true;
        this._selectedLine = hit.trendLine;

        const point1X = this._chartManager.timeToCoordinateWithFallback?.(hit.trendLine.point1.time) ?? this._chartManager.timeToCoordinate(hit.trendLine.point1.time);
        const point1Y = this._chartManager.priceToCoordinateWithFallback?.(hit.trendLine.point1.price) ?? this._chartManager.priceToCoordinate(hit.trendLine.point1.price);
        const point2X = this._chartManager.timeToCoordinateWithFallback?.(hit.trendLine.point2.time) ?? this._chartManager.timeToCoordinate(hit.trendLine.point2.time);
        const point2Y = this._chartManager.priceToCoordinateWithFallback?.(hit.trendLine.point2.price) ?? this._chartManager.priceToCoordinate(hit.trendLine.point2.price);
        if (point1X !== null && point1Y !== null) { hit.trendLine.dragPointX1 = point1X; hit.trendLine.dragPointY1 = point1Y; }
        if (point2X !== null && point2Y !== null) { hit.trendLine.dragPointX2 = point2X; hit.trendLine.dragPointY2 = point2Y; }
        this._requestRedraw();

        const menu = document.getElementById('trendContextMenu');
        if (menu) {
            document.getElementById('drawingContextMenu').style.display = 'none';
            document.getElementById('alertContextMenu').style.display = 'none';

            const extendBtn = document.getElementById('trendExtendRightBtn');
            if (extendBtn) {
                if (hit.trendLine.options.extendRight) {
                    extendBtn.classList.add('active');
                } else {
                    extendBtn.classList.remove('active');
                }
                const newExtendBtn = extendBtn.cloneNode(true);
                extendBtn.parentNode.replaceChild(newExtendBtn, extendBtn);
                newExtendBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (this._selectedLine) {
                        const newState = !this._selectedLine.options.extendRight;
                        this._selectedLine.updateOptions({ extendRight: newState });
                        if (newState) {
                            newExtendBtn.classList.add('active');
                        } else {
                            newExtendBtn.classList.remove('active');
                        }
                        this._requestRedraw();
                        this._saveTrendLines();
                    }
                });
            }

            const settingsBtn = document.getElementById('trendSettingsBtn');
            const newSettingsBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);
            newSettingsBtn.onclick = (event) => { event.stopPropagation(); this._showSettings(hit.trendLine); menu.style.display = 'none'; };

            const deleteBtn = document.getElementById('trendDeleteBtn');
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.onclick = (event) => { event.stopPropagation(); this.deleteTrendLine(hit.trendLine.id); menu.style.display = 'none'; };

            menu.style.display = 'flex';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
        }
    } else {
        const menu = document.getElementById('trendContextMenu');
        if (menu) menu.style.display = 'none';
    }
}
    _handleDblClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const hit = this.hitTest(x, y);
        if (hit) this.deleteTrendLine(hit.trendLine.id);
    }
    _handleKeyDown(e) {
        if (e.key === 'Delete' && this._selectedLine) { this.deleteTrendLine(this._selectedLine.id); this._selectedLine = null; }
    }

   _startDrawing(x, y) {
    let price = this._chartManager.coordinateToPrice(y);
    let time = this._getTimeFromCoordinate(x);
    let anchorCandle = null;
    if (price === null || time === null) {
        const lastCandle = this._chartManager.getLastCandle();
        if (lastCandle) { price = lastCandle.close; time = lastCandle.time; } else return;
    }
    if (this._magnetEnabled) {
        const snapped = this._snapToPrice(price, time);
        price = snapped.price;
        time = snapped.time;
        anchorCandle = snapped.anchorCandle;
    } else {
        const snappedTime = this._findClosestCandleTime(time);
        if (snappedTime) time = snappedTime;
    }
    this._drawingStartPoint = { price, time, x, y, anchorCandle };
    this._isDrawingSecondPoint = true;
    this._tempLine = null;
    this._requestRedraw();
}

_completeDrawing(x, y) {
    if (!this._drawingStartPoint) return;
    let price = this._chartManager.coordinateToPrice(y);
    let time = this._getTimeFromCoordinate(x);
    
    if (price === null || time === null) {
        const lastCandle = this._chartManager.getLastCandle();
        if (lastCandle) {
            price = lastCandle.close;
            time = lastCandle.time;
        } else {
            return;
        }
    }
    
    // Вторая точка – БЕЗ МАГНИТА И БЕЗ ПРИВЯЗКИ К СВЕЧАМ
    // Используем точные координаты как есть
    
    const startTime = this._drawingStartPoint.time;
    const endTime = time;
    let point1, point2, anchorCandle1, anchorCandle2;
    
    if (startTime <= endTime) {
        point1 = { price: this._drawingStartPoint.price, time: startTime };
        point2 = { price, time: endTime };
        anchorCandle1 = this._drawingStartPoint.anchorCandle;
        anchorCandle2 = null;
    } else {
        point1 = { price, time: endTime };
        point2 = { price: this._drawingStartPoint.price, time: startTime };
        anchorCandle1 = null;
        anchorCandle2 = this._drawingStartPoint.anchorCandle;
    }
    
    this.createTrendLine(point1, point2, {
        anchorCandle1, 
        anchorCandle2,
        color: document.getElementById('currentColorBox')?.style.backgroundColor || '#4A90E2',
        lineWidth: parseInt(document.getElementById('settingThickness')?.value) || 2,
        lineStyle: document.getElementById('templateSelect')?.value || 'solid',
        opacity: parseInt(document.getElementById('colorOpacity')?.value) / 100 || 0.9
    });
    
    if (this._tempPrimitive) {
        const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
        if (series) try { series.detachPrimitive(this._tempPrimitive); } catch(e) {}
        this._tempPrimitive = null;
    }
    
    this._drawingStartPoint = null;
    this._isDrawingSecondPoint = false;
    this._tempLine = null;
    this._requestRedraw();
    
    // ВАЖНО: выключаем режим рисования
    this.setDrawingMode(false);
}
    hitTest(x, y) {
        for (const item of this._trendLines) {
            if (!item.primitive) continue;
            try {
                const hit = item.primitive._paneView._renderer.hitTest(x, y);
                if (hit) return hit;
            } catch (e) {}
        }
        return null;
    }

    _snapToPrice(price, time) {
        if (!this._chartManager.chartData.length) return { price, time, anchorCandle: null };
        const data = this._chartManager.chartData;
        let closestCandle;
        if (time <= data[0].time) closestCandle = data[0];
        else if (time >= data[data.length-1].time) closestCandle = data[data.length-1];
        else {
            closestCandle = data[0];
            let minTimeDiff = Math.abs(data[0].time - time);
            for (let i = 1; i < data.length; i++) {
                const diff = Math.abs(data[i].time - time);
                if (diff < minTimeDiff) { minTimeDiff = diff; closestCandle = data[i]; }
            }
        }
        const priceY = this._chartManager.priceToCoordinate(price);
        const highY = this._chartManager.priceToCoordinate(closestCandle.high);
        const lowY = this._chartManager.priceToCoordinate(closestCandle.low);
        const closeY = this._chartManager.priceToCoordinate(closestCandle.close);
        if (priceY === null || highY === null) return { price, time, anchorCandle: null };
        const dHighPx = Math.abs(highY - priceY), dLowPx = Math.abs(lowY - priceY), dClosePx = Math.abs(closeY - priceY);
        let snappedPrice = price, anchorType = null;
        const MAGNET_THRESHOLD = 150;
        const minDistPx = Math.min(dHighPx, dLowPx, dClosePx);
        if (minDistPx < MAGNET_THRESHOLD) {
            if (minDistPx === dHighPx) { snappedPrice = closestCandle.high; anchorType = 'high'; }
            else if (minDistPx === dLowPx) { snappedPrice = closestCandle.low; anchorType = 'low'; }
            else { snappedPrice = closestCandle.close; anchorType = 'close'; }
        }
        return { price: snappedPrice, time: closestCandle.time, anchorCandle: { time: closestCandle.time, type: anchorType, price: snappedPrice } };
    }

    _findClosestCandleTime(time) {
        if (!this._chartManager.chartData.length) return time;
        const data = this._chartManager.chartData;
        if (time <= data[0].time) return data[0].time;
        if (time >= data[data.length-1].time) return data[data.length-1].time;
        let closestCandle = data[0];
        let minDiff = Math.abs(data[0].time - time);
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minDiff) { minDiff = diff; closestCandle = data[i]; }
        }
        return closestCandle.time;
    }

    _renderTrendColors(selectedColor) {
        const grid = document.getElementById('trendInlineColorsGrid');
        if (!grid) return;
        const colors = ['#4A90E2', '#EF5350', '#26A69A', '#FFA726', '#AB47BC', '#5C6BC0', '#66BB6A', '#FF7043', '#7E57C2', '#42A5F5', '#EC407A', '#FFCA28', '#8D6E63', '#B0BEC5', '#FFFFFF', '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50'];
        grid.innerHTML = '';
        colors.forEach(color => {
            const square = document.createElement('div');
            square.className = 'color-square';
            square.style.backgroundColor = color;
            if (color === selectedColor) square.classList.add('selected');
            square.addEventListener('click', () => {
                document.querySelectorAll('#trendInlineColorsGrid .color-square').forEach(s => s.classList.remove('selected'));
                square.classList.add('selected');
                document.getElementById('trendCurrentColorBox').style.backgroundColor = color;
                document.getElementById('trendHexInputInline').value = color;
            });
            grid.appendChild(square);
        });
        const addBtn = document.getElementById('trendAddColorInline');
        const hexInput = document.getElementById('trendHexInputInline');
        if (addBtn && hexInput) {
            addBtn.onclick = null;
            addBtn.onclick = () => {
                let hex = hexInput.value.trim();
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[0-9A-F]{6}$/i.test(hex)) this._addTrendColor(hex);
            };
        }
    }

    _addTrendColor(hex) {
        const grid = document.getElementById('trendInlineColorsGrid');
        if (!grid) return;
        const square = document.createElement('div');
        square.className = 'color-square';
        square.style.backgroundColor = hex;
        square.addEventListener('click', () => {
            document.querySelectorAll('#trendInlineColorsGrid .color-square').forEach(s => s.classList.remove('selected'));
            square.classList.add('selected');
            document.getElementById('trendCurrentColorBox').style.backgroundColor = hex;
            document.getElementById('trendHexInputInline').value = hex;
        });
        grid.appendChild(square);
    }

    _showSettings(trendLine) {
        const settings = document.getElementById('trendSettings');
        if (!settings) return;
        document.getElementById('trendCurrentColorBox').style.backgroundColor = trendLine.options.color;
        document.getElementById('trendHexInputInline').value = trendLine.options.color;
        document.getElementById('trendSettingThickness').value = trendLine.options.lineWidth;
        document.getElementById('trendTemplateSelect').value = trendLine.options.lineStyle;
        document.getElementById('trendColorOpacity').value = Math.round(trendLine.options.opacity * 100);
        document.getElementById('trendColorOpacityValue').textContent = document.getElementById('trendColorOpacity').value + '%';
        
        // НОВОЕ: установка чекбокса "Продолжить вправо"
        const extendRightCheckbox = document.getElementById('trendExtendRight');
        if (extendRightCheckbox) {
            extendRightCheckbox.checked = trendLine.options.extendRight || false;
        }
        
        const hexInput = document.getElementById('trendHexInputInline');
        if (hexInput) hexInput.addEventListener('contextmenu', (e) => e.stopPropagation());
        this._renderTrendColors(trendLine.options.color);
        this._renderTimeframeCheckboxes(trendLine);
        settings.style.display = 'block';
        settings.style.left = '50%';
        settings.style.top = '50%';
        settings.style.transform = 'translate(-50%, -50%)';
        let header = settings.querySelector('.settings-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'settings-header';
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #404040;';
            const title = document.createElement('span');
            title.textContent = 'Настройки линии';
            title.style.color = '#FFFFFF';
            title.style.fontSize = '14px';
            title.style.fontWeight = 'bold';
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = 'background: transparent; border: none; color: #B0B0B0; font-size: 18px; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px;';
            closeBtn.onmouseover = () => closeBtn.style.background = '#404040';
            closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
            closeBtn.onclick = (e) => { e.stopPropagation(); settings.style.display = 'none'; };
            header.appendChild(title);
            header.appendChild(closeBtn);
            settings.insertBefore(header, settings.firstChild);
        }
        const closeOnOutsideClick = (e) => { if (!settings.contains(e.target) && settings.style.display === 'block') { settings.style.display = 'none'; document.removeEventListener('mousedown', closeOnOutsideClick); } };
        document.removeEventListener('mousedown', closeOnOutsideClick);
        setTimeout(() => { document.addEventListener('mousedown', closeOnOutsideClick); }, 100);
        const stylePanel = document.getElementById('trendStylePanel');
        const visibilityPanel = document.getElementById('trendVisibilityPanel');
        const tabs = document.querySelectorAll('#trendSettings .settings-tab');
        tabs.forEach(tab => { const newTab = tab.cloneNode(true); tab.parentNode.replaceChild(newTab, tab); });
        document.querySelectorAll('#trendSettings .settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#trendSettings .settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.settingsTab === 'style') { stylePanel.classList.add('active'); visibilityPanel.classList.remove('active'); }
                else { stylePanel.classList.remove('active'); visibilityPanel.classList.add('active'); }
            });
        });
        const saveBtn = document.getElementById('trendSaveSettings');
        const deleteBtn = document.getElementById('trendDeleteDrawing');
        const newSaveBtn = saveBtn.cloneNode(true);
        const newDeleteBtn = deleteBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newSaveBtn.addEventListener('click', () => {
            trendLine.updateOptions({
                color: document.getElementById('trendCurrentColorBox').style.backgroundColor,
                lineWidth: parseInt(document.getElementById('trendSettingThickness').value),
                lineStyle: document.getElementById('trendTemplateSelect').value,
                opacity: parseInt(document.getElementById('trendColorOpacity').value) / 100,
                extendRight: document.getElementById('trendExtendRight')?.checked || false   // НОВОЕ
            });
            this._requestRedraw();
            settings.style.display = 'none';
            this._saveTrendLines();
        });
        newDeleteBtn.addEventListener('click', () => {
            this.deleteTrendLine(trendLine.id);
            settings.style.display = 'none';
            this._requestRedraw();
        });
    }

    _renderTimeframeCheckboxes(trendLine) {
        const container = document.getElementById('trendTimeframeCheckboxList');
        if (!container) return;
        const tfLabels = { '1m':'1 минута','3m':'3 минуты','5m':'5 минут','15m':'15 минут','30m':'30 минут','1h':'1 час','4h':'4 часа','6h':'6 часов','12h':'12 часов','1d':'1 день','1w':'1 неделя','1M':'1 месяц' };
        let html = '';
        const timeframes = ['1m','3m','5m','15m','30m','1h','4h','6h','12h','1d','1w','1M'];
        timeframes.forEach(tf => {
            const isChecked = trendLine.timeframeVisibility[tf] !== false;
            const label = tfLabels[tf] || tf;
            html += `<div class="timeframe-checkbox-item"><input type="checkbox" id="trend_tf_${tf}_${trendLine.id}" data-timeframe="${tf}" ${isChecked ? 'checked' : ''}><label for="trend_tf_${tf}_${trendLine.id}">${label}</label><span class="tf-badge">${tf}</span></div>`;
        });
        container.innerHTML = html;
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => { const tf = e.target.dataset.timeframe; trendLine.timeframeVisibility[tf] = e.target.checked; });
        });
        const selectAllBtn = document.getElementById('trendSelectAllTimeframes');
        const deselectAllBtn = document.getElementById('trendDeselectAllTimeframes');
        if (selectAllBtn) {
            const newSelectAll = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode.replaceChild(newSelectAll, selectAllBtn);
            newSelectAll.addEventListener('click', () => { container.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; const tf = cb.dataset.timeframe; trendLine.timeframeVisibility[tf] = true; }); });
        }
        if (deselectAllBtn) {
            const newDeselectAll = deselectAllBtn.cloneNode(true);
            deselectAllBtn.parentNode.replaceChild(newDeselectAll, deselectAllBtn);
            newDeselectAll.addEventListener('click', () => { container.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; const tf = cb.dataset.timeframe; trendLine.timeframeVisibility[tf] = false; }); });
        }
    }

    _requestRedraw() {
        this._trendLines.forEach(item => { if (item.primitive?.requestRedraw) item.primitive.requestRedraw(); });
        if (this._tempPrimitive) this._tempPrimitive.requestRedraw();
    }

    async _saveTrendLines() {
        if (this._trendLines.length === 0) return;
        
        const promises = this._trendLines.map(item => 
            window.db.put('drawings', {
                id: item.trendLine.id,
                type: 'trendline',
                symbolKey: item.trendLine.symbolKey,
                data: {
                    point1: item.trendLine.point1,
                    point2: item.trendLine.point2,
                    options: item.trendLine.options,
                    timeframeVisibility: item.trendLine.timeframeVisibility,
                    anchorCandle1: item.trendLine.anchorCandle1,
                    anchorCandle2: item.trendLine.anchorCandle2,
                    anchorTime1: item.trendLine.anchorTime1,
                    anchorTime2: item.trendLine.anchorTime2
                }
            }).catch(e => console.warn('Save trend line error:', e))
        );
        
        await Promise.all(promises);
        console.log(`💾 Saved ${this._trendLines.length} trend lines`);
    }

    async loadTrendLines() {
        try {
            await waitForReady([
                () => window.dbReady === true,
                () => this._chartManager?.chartData?.length > 0,
                () => !!(this._chartManager?.candleSeries || this._chartManager?.barSeries)
            ]);

            const currentKey = this._getCurrentSymbolKey();
            console.log('📊 Loading trend lines for:', currentKey);

            const allDrawings = await window.db.getByIndex('drawings', 'symbolKey', currentKey);
            const lineRecords = allDrawings.filter(d => d.type === 'trendline');
            const series = this._chartManager.currentChartType === 'candle' 
                ? this._chartManager.candleSeries 
                : this._chartManager.barSeries;

            const newTrendLines = [];
            for (const rec of lineRecords) {
                try {
                    const line = new TrendLine(rec.data.point1, rec.data.point2, rec.data.options);
                    line.id = rec.id;
                    line.symbolKey = rec.symbolKey;
                    line.timeframeVisibility = rec.data.timeframeVisibility || {};
                    line.anchorCandle1 = rec.data.anchorCandle1;
                    line.anchorCandle2 = rec.data.anchorCandle2;
                    line.anchorTime1 = rec.data.anchorTime1;
                    line.anchorTime2 = rec.data.anchorTime2;

                    const primitive = new TrendLinePrimitive(line, this._chartManager);
                    series.attachPrimitive(primitive);
                    newTrendLines.push({ trendLine: line, primitive, series });
                } catch (e) {
                    console.warn('Failed to load trend line:', rec.id, e);
                }
            }

            // Удаляем старые примитивы
            this._trendLines.forEach(item => {
                try { item.series?.detachPrimitive(item.primitive); } catch(e) {}
            });

            this._trendLines = newTrendLines;
            this._requestRedraw();
            console.log(`✅ Loaded ${this._trendLines.length} trend lines for ${currentKey}`);
        } catch (error) {
            console.error('❌ loadTrendLines failed:', error);
        }
    }

    _autoLoadTrendLines() {
        setTimeout(async () => {
            try {
                if (!window.dbReady) {
                    await new Promise(resolve => {
                        const check = () => {
                            if (window.dbReady) resolve();
                            else setTimeout(check, 50);
                        };
                        check();
                    });
                }
                
                console.log('🚀 Auto-loading trend lines...');
                await this.loadTrendLines();
                console.log('✅ Trend lines loaded');
            } catch (error) {
                console.error('❌ Auto-load trend lines failed:', error);
            }
        }, 150);
    }

    syncWithNewTimeframe() {
        // Ничего не делаем – updateAllViews сам всё обновит
    }
}
              
// ========== ЛИНЕЙКА-ИЗМЕРИТЕЛЬ (ИСПРАВЛЕННАЯ - НЕ ПРОПАДАЕТ ПРИ СМЕНЕ ТАЙМФРЕЙМА) ==========
class RulerLine {
    constructor(point1, point2, chartManager, options = {}) {
        this.id = `ruler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.point1 = point1 || { price: 0, time: 0 };
        this.point2 = point2 || { price: 0, time: 0 };
        this.chartManager = chartManager;
        
        // Якоря для каждой точки (неизменное время свечи)
        this.anchorTime1 = point1?.time || 0;
        this.anchorTime2 = point2?.time || 0;
        
        this.options = {
            color: options.color || (this._isBullish() ? '#00bcd4' : '#f23645'),
            lineWidth: options.lineWidth || 1,
            lineStyle: options.lineStyle || 'solid',
            opacity: options.opacity !== undefined ? options.opacity : 0.25,
            fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.25,
            ...options
        };
        
        this.anchorCandle1 = options.anchorCandle1 || null;
        this.anchorCandle2 = options.anchorCandle2 || null;
        
        this.timeframeVisibility = options.timeframeVisibility || {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        
        this.selected = false;
        this.hovered = false;
        this.dragging = false;
        this.showDragPoint1 = false;
        this.showDragPoint2 = false;
        this.dragPointX1 = 0;
        this.dragPointY1 = 0;
        this.dragPointX2 = 0;
        this.dragPointY2 = 0;

        this.symbolKey = options.symbolKey || null;
this.symbol = options.symbol || null;
this.exchange = options.exchange || null;
this.marketType = options.marketType || null;
    }

    _isBullish() {
        return this.point2.price >= this.point1.price;
    }

    get fillColor() {
        const bullishColor = this.chartManager?.bullishColor || '#00bcd4';
        const bearishColor = this.chartManager?.bearishColor || '#f23645';
        return this._isBullish() ? bullishColor : bearishColor;
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    isVisibleOnTimeframe(timeframe) {
        return this.timeframeVisibility[timeframe] !== false;
    }
}

class RulerLineRenderer {
    constructor(ruler, chartManager) {
        this._ruler = ruler;
        this._chartManager = chartManager;
        this._hitAreaLine = null;
        this._hitAreaPoint1 = null;
        this._hitAreaPoint2 = null;
        this._hitAreaInfo = null;
        this._isMac = /Mac/.test(navigator.userAgent);
        this._pixelRatio = window.devicePixelRatio || 1;
    }

     draw(target) {
         const currentKey = this._chartManager.getCurrentSymbolKey?.();
    if (currentKey && this._ruler.symbolKey !== currentKey) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const ruler = this._ruler;
            const chartManager = this._chartManager;

            const currentTf = chartManager.currentInterval;
            if (!ruler.isVisibleOnTimeframe(currentTf)) return;

            const point1X = chartManager.timeToCoordinate(ruler.point1.time);
            const point1Y = chartManager.priceToCoordinate(ruler.point1.price);
            const point2X = chartManager.timeToCoordinate(ruler.point2.time);
            const point2Y = chartManager.priceToCoordinate(ruler.point2.price);

            if (point1X === null || point1Y === null || point2X === null || point2Y === null) return;

            const { position: x1 } = positionsLine(point1X, scope.horizontalPixelRatio, 1, true);
            const { position: y1, length: y1Length } = positionsLine(point1Y, scope.verticalPixelRatio, ruler.options.lineWidth, false);
            const { position: x2 } = positionsLine(point2X, scope.horizontalPixelRatio, 1, true);
            const { position: y2, length: y2Length } = positionsLine(point2Y, scope.verticalPixelRatio, ruler.options.lineWidth, false);

            this._hitAreaPoint1 = { x: x1, y: y1 + y1Length/2, radius: 10 };
            this._hitAreaPoint2 = { x: x2, y: y2 + y2Length/2, radius: 10 };
            this._hitAreaLine = {
                x1, y1: y1 + y1Length/2,
                x2, y2: y2 + y2Length/2,
                height: y1Length
            };

            ctx.save();

            const leftX = Math.min(x1, x2);
            const rightX = Math.max(x1, x2);
            const topY = Math.min(y1, y2) - y1Length/2;
            const bottomY = Math.max(y1, y2) + y1Length/2;
            const width = rightX - leftX;
            const height = bottomY - topY;

            if (width > 0 && height > 0) {
                const fillColor = ruler.fillColor;
                const opacity = ruler.options.fillOpacity !== undefined ? ruler.options.fillOpacity : 0.25;

                const parseHex = (hex) => {
                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16)
                    } : null;
                };
                const parseRgb = (rgb) => {
                    const result = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(rgb);
                    return result ? {
                        r: parseInt(result[1], 10),
                        g: parseInt(result[2], 10),
                        b: parseInt(result[3], 10)
                    } : null;
                };
                let rgbaFill;
                let parsed = parseHex(fillColor) || parseRgb(fillColor);
                if (parsed) {
                    rgbaFill = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${opacity})`;
                } else {
                    rgbaFill = fillColor;
                }

                ctx.fillStyle = rgbaFill;
                ctx.fillRect(leftX, topY, width, height);
                ctx.strokeStyle = fillColor;
                ctx.lineWidth = 1 * scope.horizontalPixelRatio;
                ctx.setLineDash([]);
                ctx.strokeRect(leftX, topY, width, height);
            }

            ctx.strokeStyle = ruler.fillColor;
            ctx.lineWidth = y1Length;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(x1, y1 + y1Length/2);
            ctx.lineTo(x2, y2 + y2Length/2);
            ctx.stroke();
            ctx.setLineDash([]);

            if (ruler.hovered || ruler.dragging || ruler.selected) {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x1, y1 + y1Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = ruler.fillColor;
                ctx.beginPath();
                ctx.arc(x1, y1 + y1Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x2, y2 + y2Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillStyle = ruler.fillColor;
                ctx.beginPath();
                ctx.arc(x2, y2 + y2Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();

                ctx.shadowBlur = 0;
            }

            const infoY = topY - 20 * scope.verticalPixelRatio;
            if (infoY > 10) {
                const priceChange = ruler.point2.price - ruler.point1.price;
                const percentChange = (priceChange / ruler.point1.price) * 100;
                const timeDiffSec = Math.abs(ruler.point2.time - ruler.point1.time);
                const timeStr = Utils.formatTime(timeDiffSec);
                const sign = priceChange >= 0 ? '+' : '';
                const percentStr = `${sign}${percentChange.toFixed(2)}%`;
                const infoText = `${percentStr}  |  ${timeStr}  |  ${sign}${Utils.formatPrice(Math.abs(priceChange))}`;

                ctx.font = `bold 12px 'Inter', Arial, sans-serif`;
                const textWidth = ctx.measureText(infoText).width;
                const padding = 8 * scope.horizontalPixelRatio;
                const labelWidth = textWidth + padding * 2;
                const labelHeight = 20 * scope.verticalPixelRatio;
                const labelX = leftX + width/2 - labelWidth/2;
                const labelY = infoY - labelHeight;

                this._hitAreaInfo = {
                    x: labelX, y: labelY,
                    width: labelWidth, height: labelHeight
                };

                ctx.fillStyle = '#1E1E1E';
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                this._roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 4 * scope.horizontalPixelRatio);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold 12px 'Inter', Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(infoText, labelX + labelWidth/2, labelY + labelHeight/2);
            }

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

    hitTest(x, y) {
        const mac = this._isMac && this._pixelRatio > 1;
        
        if (this._hitAreaPoint1) {
            const radius = mac ? 20 : 10;
            const dx = x - this._hitAreaPoint1.x;
            const dy = y - this._hitAreaPoint1.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < radius) return { type: 'point1', ruler: this._ruler };
        }
        if (this._hitAreaPoint2) {
            const radius = mac ? 20 : 10;
            const dx = x - this._hitAreaPoint2.x;
            const dy = y - this._hitAreaPoint2.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < radius) return { type: 'point2', ruler: this._ruler };
        }
        if (this._hitAreaLine) {
            const buffer = mac ? 25 : 15;
            const x1 = this._hitAreaLine.x1, y1 = this._hitAreaLine.y1;
            const x2 = this._hitAreaLine.x2, y2 = this._hitAreaLine.y2;

            const A = x - x1;
            const B = y - y1;
            const C = x2 - x1;
            const D = y2 - y1;

            const dot = A * C + B * D;
            const len_sq = C * C + D * D;
            let param = -1;
            if (len_sq !== 0) param = dot / len_sq;

            let xx, yy;
            if (param < 0) { xx = x1; yy = y1; }
            else if (param > 1) { xx = x2; yy = y2; }
            else { xx = x1 + param * C; yy = y1 + param * D; }

            const dx = x - xx, dy = y - yy;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < buffer) return { type: 'line', ruler: this._ruler };
        }
        if (this._hitAreaInfo) {
            const inX = x >= this._hitAreaInfo.x && x <= this._hitAreaInfo.x + this._hitAreaInfo.width;
            const inY = y >= this._hitAreaInfo.y && y <= this._hitAreaInfo.y + this._hitAreaInfo.height;
            if (inX && inY) return { type: 'info', ruler: this._ruler };
        }
        return null;
    }
}

class TempRulerPointPrimitive {
    constructor(rulerManager) {
        this._manager = rulerManager;
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }

    paneViews() {
        if (!this._manager || !this._manager._tempPoint) return [];
        
        const paneView = {
            zOrder: () => 'top',
            renderer: () => ({
                draw: (target) => {
                    target.useBitmapCoordinateSpace(scope => {
                        const ctx = scope.context;
                        const point = this._manager._tempPoint;
                        const chartManager = this._manager._chartManager;
                        
                        if (!point) return;
                        
                        const xCoord = chartManager.timeToCoordinate(point.time);
                        const yCoord = chartManager.priceToCoordinate(point.price);
                        
                        if (xCoord === null || yCoord === null) return;
                        
                        const { position: x } = positionsLine(xCoord, scope.horizontalPixelRatio, 1, true);
                        const { position: y, length: yLength } = positionsLine(yCoord, scope.verticalPixelRatio, 2, false);
                        
                        ctx.save();
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.shadowBlur = 4;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(x, y + yLength/2, 8 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = '#4A90E2';
                        ctx.beginPath();
                        ctx.arc(x, y + yLength/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.restore();
                    });
                }
            })
        };
        
        return [paneView];
    }

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

class TempRulerLinePrimitive {
    constructor(rulerManager) {
        this._manager = rulerManager;
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }

    paneViews() {
        if (!this._manager || !this._manager._tempLine) return [];
        
        const paneView = {
            zOrder: () => 'top',
            renderer: () => ({
                draw: (target) => {
                    target.useBitmapCoordinateSpace(scope => {
                        const ctx = scope.context;
                        const tempLine = this._manager._tempLine;
                        const chartManager = this._manager._chartManager;
                        
                        if (!tempLine || !tempLine.point1 || !tempLine.point2) return;
                        
                        const point1X = chartManager.timeToCoordinate(tempLine.point1.time);
                        const point1Y = chartManager.priceToCoordinate(tempLine.point1.price);
                        const point2X = chartManager.timeToCoordinate(tempLine.point2.time);
                        const point2Y = chartManager.priceToCoordinate(tempLine.point2.price);
                        
                        if (point1X === null || point1Y === null || point2X === null || point2Y === null) return;
                        
                        const { position: x1 } = positionsLine(point1X, scope.horizontalPixelRatio, 1, true);
                        const { position: y1, length: y1Length } = positionsLine(point1Y, scope.verticalPixelRatio, 2, false);
                        const { position: x2 } = positionsLine(point2X, scope.horizontalPixelRatio, 1, true);
                        const { position: y2, length: y2Length } = positionsLine(point2Y, scope.verticalPixelRatio, 2, false);
                        
                        ctx.save();
                        const isBullish = point2Y <= point1Y;
                        const lineColor = isBullish ? '#00bcd4' : '#f23645';
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = y1Length;
                        ctx.setLineDash([5, 3]);
                        ctx.beginPath();
                        ctx.moveTo(x1, y1 + y1Length/2);
                        ctx.lineTo(x2, y2 + y2Length/2);
                        ctx.stroke();
                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.shadowBlur = 4;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(x1, y1 + y1Length/2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = lineColor;
                        ctx.beginPath();
                        ctx.arc(x1, y1 + y1Length/2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.restore();
                    });
                }
            })
        };
        
        return [paneView];
    }

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

class RulerLinePaneView {
    constructor(ruler, chartManager) {
        this._ruler = ruler;
        this._chartManager = chartManager;
        this._renderer = new RulerLineRenderer(ruler, chartManager);
    }
    renderer() { return this._renderer; }
    zOrder() { return 'top'; }
}

class RulerLinePrimitive {
    constructor(ruler, chartManager) {
        this._ruler = ruler;
        this._chartManager = chartManager;
        this._paneView = new RulerLinePaneView(ruler, chartManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }

    paneViews() { return [this._paneView]; }

    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
        this._syncPointsTime(); // первая синхронизация
    }

    updateAllViews() {
        const oldTime1 = this._ruler.point1.time;
        const oldTime2 = this._ruler.point2.time;
        this._syncPointsTime();
        if (this._ruler.point1.time !== oldTime1 || this._ruler.point2.time !== oldTime2) {
            if (this._requestUpdate) this._requestUpdate();
        }
    }

    _syncPointsTime() {
        const chartData = this._chartManager.chartData;
        if (!chartData || chartData.length === 0) return;
        
        const syncPoint = (anchorTime) => {
            let intervalMs = 60 * 60 * 1000;
            if (chartData.length >= 2) intervalMs = chartData[1].time - chartData[0].time;
            let newTime = anchorTime;
            for (let i = 0; i < chartData.length; i++) {
                const start = chartData[i].time;
                const end = start + intervalMs;
                if (anchorTime >= start && anchorTime < end) {
                    newTime = start;
                    break;
                }
            }
            if (newTime === anchorTime && chartData.length) {
                let closest = chartData[0];
                let minDiff = Math.abs(closest.time - anchorTime);
                for (let i = 1; i < chartData.length; i++) {
                    const diff = Math.abs(chartData[i].time - anchorTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = chartData[i];
                    }
                }
                newTime = closest.time;
            }
            return newTime;
        };
        
        this._ruler.point1.time = syncPoint(this._ruler.anchorTime1);
        this._ruler.point2.time = syncPoint(this._ruler.anchorTime2);
    }

    getRuler() { return this._ruler; }

    requestRedraw() { if (this._requestUpdate) this._requestUpdate(); }
}

class RulerLineManager {
    constructor(chartManager) {
        this._isMac = /Mac/.test(navigator.userAgent);
        this._pixelRatio = window.devicePixelRatio || 1;
        this._rulers = [];
        this._chartManager = chartManager;
        this._selectedRuler = null;
        this._hoveredRuler = null;
        this._isDrawingMode = false;
        this._isDragging = false;
        this._dragRuler = null;
        this._dragPoint = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartPoint1 = { price: 0, time: 0 };
        this._dragStartPoint2 = { price: 0, time: 0 };
        this._drawingStartPoint = null;
        this._isDrawingSecondPoint = false;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._potentialDrag = null;
        this._dragThreshold = 5;
        this._tempLine = null;
        this._tempPoint = null;
        this._tempLinePrimitive = null;
        this._tempPointPrimitive = null;
        this._magnetEnabled = true;

        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
        this._handleMouseLeave = this._handleMouseLeave.bind(this);
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._handleDblClick = this._handleDblClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);

        this._setupEventListeners();
        this._setupHotkeys();
        this._autoLoadRulers();
        this._isLoading = false;
    }

    _setupEventListeners() {
        const container = this._chartManager.chartContainer;
        container.addEventListener('mousedown', this._handleMouseDown);
        container.addEventListener('mousemove', this._handleMouseMove);
        container.addEventListener('mouseup', this._handleMouseUp);
        container.addEventListener('mouseleave', this._handleMouseLeave);
        container.addEventListener('contextmenu', this._handleContextMenu);
        container.addEventListener('dblclick', this._handleDblClick);

        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            let mx = e.clientX - rect.left;
            let my = e.clientY - rect.top;
            if (this._isMac && this._pixelRatio > 1) {
                mx *= this._pixelRatio;
                my *= this._pixelRatio;
            }
            this._lastMouseX = mx;
            this._lastMouseY = my;
        });
    }

    _setupHotkeys() {
        document.addEventListener('keydown', this._handleKeyDown);
    }

    _getCurrentSymbolKey() {
        const symbol = this._chartManager.currentSymbol || 'BTCUSDT';
        const exchange = this._chartManager.currentExchange || 'binance';
        const marketType = this._chartManager.currentMarketType || 'futures';
        return `${symbol}:${exchange}:${marketType}`;
    }

    setDrawingMode(enabled) {
        this._isDrawingMode = enabled;
        const rulerBtn = document.getElementById('toolRuler');
        if (rulerBtn) {
            if (enabled) {
                rulerBtn.style.background = '#4A90E2';
                rulerBtn.style.color = '#FFFFFF';
                rulerBtn.classList.add('active');
            } else {
                rulerBtn.style.background = '';
                rulerBtn.style.color = '';
                rulerBtn.classList.remove('active');
            }
        }
        if (!enabled) {
            this._drawingStartPoint = null;
            this._isDrawingSecondPoint = false;
            if (this._tempLinePrimitive) {
                const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
                if (series) try { series.detachPrimitive(this._tempLinePrimitive); } catch(e) {}
                this._tempLinePrimitive = null;
                this._tempLine = null;
            }
            if (this._tempPointPrimitive) {
                const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
                if (series) try { series.detachPrimitive(this._tempPointPrimitive); } catch(e) {}
                this._tempPointPrimitive = null;
                this._tempPoint = null;
            }
            this._requestRedraw();
        }
    }

    setMagnetEnabled(enabled) {
        this._magnetEnabled = enabled;
        const magnetBtn = document.getElementById('toolMagnet');
        if (magnetBtn) {
            if (enabled) magnetBtn.classList.add('magnet-active');
            else magnetBtn.classList.remove('magnet-active');
        }
    }

    createRuler(point1, point2, options = {}) {
        const defaultVisibility = {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        const timeframeVisibility = options.timeframeVisibility || defaultVisibility;

        const ruler = new RulerLine(point1, point2, this._chartManager, {
            ...options,
            timeframeVisibility
        });
        
        ruler.anchorTime1 = point1.time;
        ruler.anchorTime2 = point2.time;
        ruler.symbolKey = this._getCurrentSymbolKey();
        ruler.symbol = this._chartManager.currentSymbol;
        ruler.exchange = this._chartManager.currentExchange;
        ruler.marketType = this._chartManager.currentMarketType;

        const primitive = new RulerLinePrimitive(ruler, this._chartManager);
        const series = this._chartManager.currentChartType === 'candle'
            ? this._chartManager.candleSeries
            : this._chartManager.barSeries;
        series.attachPrimitive(primitive);
        this._rulers.push({ ruler, primitive, series });
        this._saveRulers();
        return ruler;
    }

    deleteRuler(rulerId) {
        const index = this._rulers.findIndex(r => r.ruler.id === rulerId);
        if (index !== -1) {
            const { primitive, series } = this._rulers[index];
            window.db.delete('drawings', rulerId).catch(e => console.warn(e));
            try { series.detachPrimitive(primitive); } catch (e) {}
            this._rulers.splice(index, 1);
            if (this._selectedRuler && this._selectedRuler.id === rulerId) this._selectedRuler = null;
            if (this._dragRuler && this._dragRuler.id === rulerId) this._dragRuler = null;
            this._saveRulers();
            this._requestRedraw();
            return true;
        }
        return false;
    }

    deleteAllRulers() {
        for (const item of this._rulers) {
            window.db.delete('drawings', item.ruler.id).catch(e => console.warn(e));
        }
        this._rulers.forEach(({ primitive, series }) => {
            try { series.detachPrimitive(primitive); } catch (e) {}
        });
        this._rulers = [];
        this._selectedRuler = null;
        this._dragRuler = null;
        this._saveRulers();
        this._requestRedraw();
    }

    hitTest(x, y) {
        for (const item of this._rulers) {
            if (!item.primitive) continue;
            try {
                const hit = item.primitive._paneView._renderer.hitTest(x, y);
                if (hit) return hit;
            } catch (e) {}
        }
        return null;
    }

    _handleMouseDown(e) {
        if (e.button !== 0) return;
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }

        const rulerMenu = document.getElementById('rulerContextMenu');
        if (rulerMenu && rulerMenu.style.display === 'flex') {
            const menuRect = rulerMenu.getBoundingClientRect();
            const isClickInsideMenu = 
                e.clientX >= menuRect.left && e.clientX <= menuRect.right &&
                e.clientY >= menuRect.top && e.clientY <= menuRect.bottom;
            if (isClickInsideMenu) return;
        }

        if (this._isDrawingMode && this._isDrawingSecondPoint && this._drawingStartPoint) {
            this._completeDrawing(x, y);
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const hit = this.hitTest(x, y);
        if (hit && hit.ruler) {
            e.preventDefault();
            e.stopPropagation();
            if (this._selectedRuler && this._selectedRuler !== hit.ruler) {
                this._selectedRuler.selected = false;
                this._selectedRuler.showDragPoint1 = false;
                this._selectedRuler.showDragPoint2 = false;
            }
            hit.ruler.selected = true;
            this._selectedRuler = hit.ruler;
            if (hit.type === 'point1' || hit.type === 'point2') {
                hit.ruler.showDragPoint1 = hit.type === 'point1';
                hit.ruler.showDragPoint2 = hit.type === 'point2';
            } else {
                hit.ruler.showDragPoint1 = false;
                hit.ruler.showDragPoint2 = false;
            }
            const point1X = this._chartManager.timeToCoordinate(hit.ruler.point1.time);
            const point1Y = this._chartManager.priceToCoordinate(hit.ruler.point1.price);
            const point2X = this._chartManager.timeToCoordinate(hit.ruler.point2.time);
            const point2Y = this._chartManager.priceToCoordinate(hit.ruler.point2.price);
            if (point1X !== null && point1Y !== null) {
                hit.ruler.dragPointX1 = point1X;
                hit.ruler.dragPointY1 = point1Y;
            }
            if (point2X !== null && point2Y !== null) {
                hit.ruler.dragPointX2 = point2X;
                hit.ruler.dragPointY2 = point2Y;
            }
            this._potentialDrag = {
                ruler: hit.ruler,
                pointType: hit.type,
                startX: x,
                startY: y,
                startPoint1: { ...hit.ruler.point1 },
                startPoint2: { ...hit.ruler.point2 }
            };
            this._requestRedraw();
        } else {
            if (this._isDrawingMode && !this._isDrawingSecondPoint) {
                this._startDrawing(x, y);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (this._selectedRuler) {
                this._selectedRuler.selected = false;
                this._selectedRuler.showDragPoint1 = false;
                this._selectedRuler.showDragPoint2 = false;
                this._selectedRuler = null;
                this._requestRedraw();
            }
            if (rulerMenu) rulerMenu.style.display = 'none';
        }
    }

    _handleMouseMove(e) {
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }
        this._lastMouseX = x;
        this._lastMouseY = y;

        if (this._isDrawingMode && this._isDrawingSecondPoint && this._drawingStartPoint) {
            let price = this._chartManager.coordinateToPrice(y);
            let time = this._chartManager.coordinateToTime(x);
            if (price !== null && time !== null) {
                if (!this._tempLine) {
                    this._tempLine = { point1: this._drawingStartPoint, point2: { price, time } };
                    if (!this._tempLinePrimitive) {
                        this._tempLinePrimitive = new TempRulerLinePrimitive(this);
                        const series = this._chartManager.currentChartType === 'candle' ? this._chartManager.candleSeries : this._chartManager.barSeries;
                        if (series) series.attachPrimitive(this._tempLinePrimitive);
                    }
                } else {
                    this._tempLine.point2 = { price, time };
                }
                this._requestRedraw();
            }
            return;
        }

        if (this._potentialDrag && !this._isDragging) {
            const dx = Math.abs(x - this._potentialDrag.startX);
            const dy = Math.abs(y - this._potentialDrag.startY);
            if (dx > 3 || dy > 3) {
                this._isDragging = true;
                this._dragRuler = this._potentialDrag.ruler;
                this._dragPoint = this._potentialDrag.pointType;
                this._dragRuler.dragging = true;
                this._dragStartX = this._potentialDrag.startX;
                this._dragStartY = this._potentialDrag.startY;
                this._dragStartPoint1 = { ...this._potentialDrag.startPoint1 };
                this._dragStartPoint2 = { ...this._potentialDrag.startPoint2 };
                this._chartManager.chartContainer.style.cursor = 'grabbing';
            }
        }

        if (this._isDragging && this._dragRuler) {
            e.preventDefault();
            e.stopPropagation();
            const deltaX = x - this._dragStartX;
            const deltaY = y - this._dragStartY;
            if (this._dragPoint === 'point1') {
                const p1x = this._chartManager.timeToCoordinate(this._dragStartPoint1.time);
                const p1y = this._chartManager.priceToCoordinate(this._dragStartPoint1.price);
                if (p1x !== null && p1y !== null) {
                    const newX = p1x + deltaX;
                    const newY = p1y + deltaY;
                    const newPrice = this._chartManager.coordinateToPrice(newY);
                    const newTime = this._chartManager.coordinateToTime(newX);
                    if (newPrice !== null) this._dragRuler.point1.price = newPrice;
                    if (newTime !== null) {
                        this._dragRuler.point1.time = newTime;
                        this._dragRuler.anchorTime1 = newTime;
                    }
                }
            } else if (this._dragPoint === 'point2') {
                const p2x = this._chartManager.timeToCoordinate(this._dragStartPoint2.time);
                const p2y = this._chartManager.priceToCoordinate(this._dragStartPoint2.price);
                if (p2x !== null && p2y !== null) {
                    const newX = p2x + deltaX;
                    const newY = p2y + deltaY;
                    const newPrice = this._chartManager.coordinateToPrice(newY);
                    const newTime = this._chartManager.coordinateToTime(newX);
                    if (newPrice !== null) this._dragRuler.point2.price = newPrice;
                    if (newTime !== null) {
                        this._dragRuler.point2.time = newTime;
                        this._dragRuler.anchorTime2 = newTime;
                    }
                }
            } else if (this._dragPoint === 'line') {
                const p1x = this._chartManager.timeToCoordinate(this._dragStartPoint1.time);
                const p1y = this._chartManager.priceToCoordinate(this._dragStartPoint1.price);
                const p2x = this._chartManager.timeToCoordinate(this._dragStartPoint2.time);
                const p2y = this._chartManager.priceToCoordinate(this._dragStartPoint2.price);
                if (p1x !== null && p1y !== null && p2x !== null && p2y !== null) {
                    const newX1 = p1x + deltaX;
                    const newY1 = p1y + deltaY;
                    const newX2 = p2x + deltaX;
                    const newY2 = p2y + deltaY;
                    const newPrice1 = this._chartManager.coordinateToPrice(newY1);
                    const newTime1 = this._chartManager.coordinateToTime(newX1);
                    const newPrice2 = this._chartManager.coordinateToPrice(newY2);
                    const newTime2 = this._chartManager.coordinateToTime(newX2);
                    if (newPrice1 !== null) this._dragRuler.point1.price = newPrice1;
                    if (newTime1 !== null) {
                        this._dragRuler.point1.time = newTime1;
                        this._dragRuler.anchorTime1 = newTime1;
                    }
                    if (newPrice2 !== null) this._dragRuler.point2.price = newPrice2;
                    if (newTime2 !== null) {
                        this._dragRuler.point2.time = newTime2;
                        this._dragRuler.anchorTime2 = newTime2;
                    }
                }
            }
            const newColor = this._dragRuler._isBullish() ? '#00bcd4' : '#f23645';
            this._dragRuler.options.color = newColor;
            this._requestRedraw();
        } else {
            const hit = this.hitTest(x, y);
            const hitRuler = hit ? hit.ruler : null;
            if (hitRuler) {
                this._chartManager.chartContainer.style.cursor = (hit.type === 'point1' || hit.type === 'point2') ? 'move' : 'grab';
            } else {
                this._chartManager.chartContainer.style.cursor = 'crosshair';
            }
            if (this._hoveredRuler !== hitRuler) {
                if (this._hoveredRuler) this._hoveredRuler.hovered = false;
                this._hoveredRuler = hitRuler;
                if (hitRuler) hitRuler.hovered = true;
                this._requestRedraw();
            }
        }
    }

    _handleMouseUp(e) {
        if (this._isDragging) {
            e.preventDefault();
            e.stopPropagation();
            this._isDragging = false;
            if (this._dragRuler) {
                this._dragRuler.dragging = false;
                this._dragRuler.anchorTime1 = this._dragRuler.point1.time;
                this._dragRuler.anchorTime2 = this._dragRuler.point2.time;
                if (this._selectedRuler !== this._dragRuler) {
                    this._dragRuler.showDragPoint1 = false;
                    this._dragRuler.showDragPoint2 = false;
                }
                this._saveRulers();
                this._dragRuler = null;
                this._requestRedraw();
            }
            this._chartManager.chartContainer.style.cursor = 'crosshair';
        }
        this._potentialDrag = null;
    }

    _handleMouseLeave() {
        if (this._hoveredRuler) {
            this._hoveredRuler.hovered = false;
            this._hoveredRuler = null;
            this._requestRedraw();
        }
        this._chartManager.chartContainer.style.cursor = 'crosshair';
    }

    _handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }
        const hit = this.hitTest(x, y);
        if (hit && hit.ruler) {
            if (this._selectedRuler && this._selectedRuler !== hit.ruler) {
                this._selectedRuler.selected = false;
                this._selectedRuler.showDragPoint1 = false;
                this._selectedRuler.showDragPoint2 = false;
            }
            hit.ruler.selected = true;
            hit.ruler.showDragPoint1 = true;
            hit.ruler.showDragPoint2 = true;
            this._selectedRuler = hit.ruler;
            this._requestRedraw();

            const menu = document.getElementById('rulerContextMenu');
            if (menu) {
                const otherMenus = ['drawingContextMenu', 'trendContextMenu', 'alertContextMenu'];
                otherMenus.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                menu.style.display = 'flex';
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';

                const settingsBtn = document.getElementById('rulerSettingsBtn');
                settingsBtn.onclick = null;
                settingsBtn.onclick = (event) => {
                    event.stopPropagation();
                    this._showSettings(hit.ruler);
                    menu.style.display = 'none';
                };

                const deleteBtn = document.getElementById('rulerDeleteBtn');
                deleteBtn.onclick = null;
                deleteBtn.onclick = (event) => {
                    event.stopPropagation();
                    this.deleteRuler(hit.ruler.id);
                    menu.style.display = 'none';
                };
            }
        } else {
            const menu = document.getElementById('rulerContextMenu');
            if (menu) menu.style.display = 'none';
        }
    }

    _handleDblClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) {
            x *= this._pixelRatio;
            y *= this._pixelRatio;
        }
        const hit = this.hitTest(x, y);
        if (hit) this.deleteRuler(hit.ruler.id);
    }

    _handleKeyDown(e) {
        if (e.key === 'Delete' && this._selectedRuler) {
            this.deleteRuler(this._selectedRuler.id);
            this._selectedRuler = null;
        }
    }

    _startDrawing(x, y) {
        let price = this._chartManager.coordinateToPrice(y);
        let time = this._chartManager.coordinateToTime(x);
        let anchorCandle = null;
        if (price === null || time === null) {
            const lastCandle = this._chartManager.getLastCandle();
            if (lastCandle) { price = lastCandle.close; time = lastCandle.time; } else return;
        }
        if (this._magnetEnabled) {
            const snapped = this._snapToPrice(price, time);
            price = snapped.price;
            time = snapped.time;
            anchorCandle = snapped.anchorCandle;
        } else {
            const snappedTime = this._findClosestCandleTime(time);
            if (snappedTime) time = snappedTime;
        }
        this._drawingStartPoint = { price, time, x, y, anchorCandle };
        this._isDrawingSecondPoint = true;
        this._tempPoint = { price, time, x, y };
        this._tempLine = null;
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        if (series && !this._tempPointPrimitive) {
            this._tempPointPrimitive = new TempRulerPointPrimitive(this);
            try { series.attachPrimitive(this._tempPointPrimitive); } catch (e) {}
        }
        this._requestRedraw();
    }

    _completeDrawing(x, y) {
        if (!this._drawingStartPoint) return;
        let price = this._chartManager.coordinateToPrice(y);
        let time = this._chartManager.coordinateToTime(x);
        let anchorCandle = null;
        if (price === null || time === null) {
            const lastCandle = this._chartManager.getLastCandle();
            if (lastCandle) { price = lastCandle.close; time = lastCandle.time; } else return;
        }
        if (this._magnetEnabled) {
            const snapped = this._snapToPrice(price, time);
            price = snapped.price;
            time = snapped.time;
            anchorCandle = snapped.anchorCandle;
        } else {
            const snappedTime = this._findClosestCandleTime(time);
            if (snappedTime) time = snappedTime;
        }
        const startTime = this._drawingStartPoint.time;
        const endTime = time;
        let point1, point2, anchorCandle1, anchorCandle2;
        if (startTime <= endTime) {
            point1 = { price: this._drawingStartPoint.price, time: startTime };
            point2 = { price, time: endTime };
            anchorCandle1 = this._drawingStartPoint.anchorCandle;
            anchorCandle2 = anchorCandle;
        } else {
            point1 = { price, time: endTime };
            point2 = { price: this._drawingStartPoint.price, time: startTime };
            anchorCandle1 = anchorCandle;
            anchorCandle2 = this._drawingStartPoint.anchorCandle;
        }
        this.createRuler(point1, point2, { anchorCandle1, anchorCandle2 });
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;
        if (this._tempLinePrimitive) {
            if (series) try { series.detachPrimitive(this._tempLinePrimitive); } catch(e) {}
            this._tempLinePrimitive = null;
            this._tempLine = null;
        }
        if (this._tempPointPrimitive) {
            if (series) try { series.detachPrimitive(this._tempPointPrimitive); } catch(e) {}
            this._tempPointPrimitive = null;
            this._tempPoint = null;
        }
        this._drawingStartPoint = null;
        this._isDrawingSecondPoint = false;
        this._requestRedraw();
        this.setDrawingMode(false);
    }

    _snapToPrice(price, time) {
        if (!this._chartManager.chartData.length) return { price, time, anchorCandle: null };
        const data = this._chartManager.chartData;
        let closestCandle;
        if (time <= data[0].time) closestCandle = data[0];
        else if (time >= data[data.length-1].time) closestCandle = data[data.length-1];
        else {
            closestCandle = data[0];
            let minTimeDiff = Math.abs(data[0].time - time);
            for (let i = 1; i < data.length; i++) {
                const diff = Math.abs(data[i].time - time);
                if (diff < minTimeDiff) { minTimeDiff = diff; closestCandle = data[i]; }
            }
        }
        const priceY = this._chartManager.priceToCoordinate(price);
        const highY = this._chartManager.priceToCoordinate(closestCandle.high);
        const lowY = this._chartManager.priceToCoordinate(closestCandle.low);
        const closeY = this._chartManager.priceToCoordinate(closestCandle.close);
        if (priceY === null || highY === null) return { price, time, anchorCandle: null };
        const dHighPx = Math.abs(highY - priceY), dLowPx = Math.abs(lowY - priceY), dClosePx = Math.abs(closeY - priceY);
        let snappedPrice = price, anchorType = null;
        const MAGNET_THRESHOLD = 150;
        const minDistPx = Math.min(dHighPx, dLowPx, dClosePx);
        if (minDistPx < MAGNET_THRESHOLD) {
            if (minDistPx === dHighPx) { snappedPrice = closestCandle.high; anchorType = 'high'; }
            else if (minDistPx === dLowPx) { snappedPrice = closestCandle.low; anchorType = 'low'; }
            else { snappedPrice = closestCandle.close; anchorType = 'close'; }
        }
        return { price: snappedPrice, time: closestCandle.time, anchorCandle: { time: closestCandle.time, type: anchorType, price: snappedPrice } };
    }

    _findClosestCandleTime(time) {
        if (!this._chartManager.chartData.length) return time;
        const data = this._chartManager.chartData;
        if (time <= data[0].time) return data[0].time;
        if (time >= data[data.length-1].time) return data[data.length-1].time;
        let closestCandle = data[0];
        let minDiff = Math.abs(data[0].time - time);
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minDiff) { minDiff = diff; closestCandle = data[i]; }
        }
        return closestCandle.time;
    }

    _showSettings(ruler) {
        const panel = document.getElementById('rulerSettingsPanel');
        if (!panel) return;
        const opacitySlider = panel.querySelector('#rulerFillOpacity');
        const opacityValue = panel.querySelector('#rulerFillOpacityValue');
        if (opacitySlider && opacityValue) {
            opacitySlider.value = Math.round((ruler.options.fillOpacity || 0.25) * 100);
            opacityValue.textContent = opacitySlider.value + '%';
            const newSlider = opacitySlider.cloneNode(true);
            opacitySlider.parentNode.replaceChild(newSlider, opacitySlider);
            newSlider.oninput = () => {
                const val = newSlider.value;
                const valDisplay = panel.querySelector('#rulerFillOpacityValue');
                if (valDisplay) valDisplay.textContent = val + '%';
            };
        }
        const closeBtn = panel.querySelector('.close-settings');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.onclick = () => { panel.style.display = 'none'; };
        }
        const saveBtn = panel.querySelector('#rulerSaveSettings');
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            newSaveBtn.onclick = () => {
                const slider = panel.querySelector('#rulerFillOpacity');
                if (slider) {
                    ruler.updateOptions({ fillOpacity: parseInt(slider.value) / 100 });
                    this._requestRedraw();
                    this._saveRulers();
                }
                panel.style.display = 'none';
            };
        }
        const deleteBtn = panel.querySelector('#rulerDeleteFromSettings');
        if (deleteBtn) {
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.onclick = () => {
                this.deleteRuler(ruler.id);
                panel.style.display = 'none';
            };
        }
        panel.style.display = 'block';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        const closeOnOutsideClick = (e) => {
            if (!panel.contains(e.target) && panel.style.display === 'block') {
                panel.style.display = 'none';
                document.removeEventListener('mousedown', closeOnOutsideClick);
            }
        };
        setTimeout(() => { document.addEventListener('mousedown', closeOnOutsideClick); }, 100);
    }

    _requestRedraw() {
        this._rulers.forEach(item => {
            if (item.primitive?.requestRedraw) item.primitive.requestRedraw();
        });
        if (this._tempLinePrimitive) this._tempLinePrimitive.requestRedraw();
        if (this._tempPointPrimitive) this._tempPointPrimitive.requestRedraw();
    }

    async _saveRulers() {
        if (this._rulers.length === 0) return;
        const promises = this._rulers.map(item => 
            window.db.put('drawings', {
                id: item.ruler.id,
                type: 'ruler',
                symbolKey: item.ruler.symbolKey,
                data: {
                    point1: item.ruler.point1,
                    point2: item.ruler.point2,
                    options: item.ruler.options,
                    timeframeVisibility: item.ruler.timeframeVisibility,
                    anchorCandle1: item.ruler.anchorCandle1,
                    anchorCandle2: item.ruler.anchorCandle2,
                    anchorTime1: item.ruler.anchorTime1,
                    anchorTime2: item.ruler.anchorTime2,
                    symbol: item.ruler.symbol,
                    exchange: item.ruler.exchange,
                    marketType: item.ruler.marketType
                }
            }).catch(e => console.warn('Save ruler error:', e))
        );
        await Promise.all(promises);
    }

    async loadRulers() {
        try {
            await waitForReady([
                () => window.dbReady === true,
                () => this._chartManager?.chartData?.length > 0,
                () => !!(this._chartManager?.candleSeries || this._chartManager?.barSeries)
            ]);
            const currentKey = this._getCurrentSymbolKey();
            const allDrawings = await window.db.getByIndex('drawings', 'symbolKey', currentKey);
            const rulerRecords = allDrawings.filter(d => d.type === 'ruler');
            const series = this._chartManager.currentChartType === 'candle' 
                ? this._chartManager.candleSeries 
                : this._chartManager.barSeries;
            const newRulers = [];
            for (const rec of rulerRecords) {
                try {
                    const ruler = new RulerLine(rec.data.point1, rec.data.point2, this._chartManager, rec.data.options);
                    ruler.id = rec.id;
                    ruler.symbolKey = rec.symbolKey;
                    ruler.symbol = rec.data.symbol;
                    ruler.exchange = rec.data.exchange;
                    ruler.marketType = rec.data.marketType;
                    ruler.timeframeVisibility = rec.data.timeframeVisibility || {};
                    ruler.anchorCandle1 = rec.data.anchorCandle1;
                    ruler.anchorCandle2 = rec.data.anchorCandle2;
                    ruler.anchorTime1 = rec.data.anchorTime1;
                    ruler.anchorTime2 = rec.data.anchorTime2;
                    const primitive = new RulerLinePrimitive(ruler, this._chartManager);
                    series.attachPrimitive(primitive);
                    newRulers.push({ ruler, primitive, series });
                } catch (e) { console.warn('Failed to load ruler:', rec.id, e); }
            }
            this._rulers.forEach(item => {
                try { item.series?.detachPrimitive(item.primitive); } catch(e) {}
            });
            this._rulers = newRulers;
            this._requestRedraw();
        } catch (error) { console.error('❌ loadRulers failed:', error); }
    }

    _autoLoadRulers() {
        setTimeout(async () => {
            try {
                if (this._rulers.length > 0) return;
                if (!window.dbReady) {
                    await new Promise(resolve => {
                        const check = () => window.dbReady ? resolve() : setTimeout(check, 50);
                        check();
                    });
                }
                await this.loadRulers();
            } catch (error) { console.error('❌ Auto-load rulers failed:', error); }
        }, 200);
    }

    syncWithNewTimeframe() {}
}
   
// ========== АЛЕРТ (ИСПРАВЛЕННЫЙ - НЕ ПРОПАДАЕТ ПРИ СМЕНЕ ТАЙМФРЕЙМА) ==========
class AlertLine {  
    constructor(price, time, options = {}) {
        this.price = price;
        this.time = time;
        this.anchorTime = time; // Якорь - неизменное время свечи
        this.triggered = options.triggered || false;
        this.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Информация о символе
        this.symbol = options.symbol || 'BTCUSDT';
        this.exchange = options.exchange || 'binance';
        this.marketType = options.marketType || 'futures';
        
        this.createdAt = Date.now();
        this.active = options.active || false;
        
        // Параметры повторений
        this.triggerCount = options.triggerCount || 0;
        this.repeatCount = options.repeatCount || 5;
        this.repeatInterval = options.repeatInterval || 1;
        this.lastTriggerTime = options.lastTriggerTime || null;
        this.triggerLimit = options.repeatCount === Infinity ? Infinity : (options.repeatCount || 5);
        
        // Стили
        this.options = {
            color: options.color || '#808080',
            lineWidth: options.lineWidth || 2,
            lineStyle: options.lineStyle || 'dotted',
            opacity: options.opacity !== undefined ? options.opacity : 0.26,
            extendLeft: options.extendLeft || true,
            extendRight: options.extendRight || true,
            showPrice: options.showPrice !== undefined ? options.showPrice : true,
            showBell: options.showBell !== undefined ? options.showBell : true,
            fontSize: options.fontSize || 10,
            ...options
        };
        
        this.anchorCandle = options.anchorCandle || null;
        
        this.timeframeVisibility = options.timeframeVisibility || {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        
        this.selected = false;
        this.hovered = false;
        this.dragging = false;
        this.showDragPoint = false;
        this.attached = false;
        this.dragPointX = 0;
        this.dragPointY = 0;
        this.symbolKey = options.symbolKey || null;
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        if (newOptions.repeatCount !== undefined) {
            this.repeatCount = newOptions.repeatCount;
            this.triggerLimit = newOptions.repeatCount === Infinity ? Infinity : newOptions.repeatCount;
        }
        if (newOptions.repeatInterval !== undefined) {
            this.repeatInterval = newOptions.repeatInterval;
        }
    }
    
    isVisibleOnTimeframe(timeframe) {
        return this.timeframeVisibility[timeframe] !== false;
    }
    
    canTriggerAgain() {
        if (this.triggerLimit === Infinity) return true;
        return this.triggerCount < this.triggerLimit;
    }
    
    shouldTriggerByTimer(now) {
        if (!this.lastTriggerTime) return true;
        const minutesSinceLast = (now - this.lastTriggerTime) / (60 * 1000);
        return minutesSinceLast >= this.repeatInterval;
    }
}

class AlertLineRenderer {
    constructor(alert, chartManager) {
        this._alert = alert;
        this._chartManager = chartManager;
        this._hitArea = null;
        this._priceLabelHitArea = null;
        this._isMac = /Mac/.test(navigator.userAgent);
        this._pixelRatio = window.devicePixelRatio || 1;
    }
    
    draw(target) {
        const currentKey = this._chartManager.getCurrentSymbolKey?.();
        if (currentKey && this._alert.symbolKey !== currentKey) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const alert = this._alert;
            const chartManager = this._chartManager;

            const currentTf = chartManager.currentInterval;
            if (!alert.isVisibleOnTimeframe(currentTf)) return;

            let yCoordinate = chartManager.priceToCoordinate(alert.price);
            let xCoordinate = chartManager.timeToCoordinate(alert.time);
            if (yCoordinate === null || xCoordinate === null) return;

            

            const timeScale = chartManager.chart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (!visibleRange) return;

            let startX = 0;
            let endX = scope.mediaSize.width;
            if (!alert.options.extendLeft) startX = xCoordinate;
            if (!alert.options.extendRight) endX = xCoordinate;

            const { position: startPos } = positionsLine(startX, scope.horizontalPixelRatio, 1, true);
            const { position: endPos } = positionsLine(endX, scope.horizontalPixelRatio, 1, true);
            const { position: yPos, length: yLength } = positionsLine(
                yCoordinate, scope.verticalPixelRatio, alert.options.lineWidth, false
            );

            this._hitArea = { y: yPos, height: yLength, x1: Math.min(startPos, endPos), x2: Math.max(startPos, endPos) };

            ctx.save();

            const color = alert.options.color;
            const opacity = alert.options.opacity !== undefined ? alert.options.opacity : 0.26;

            const parseHex = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
            };
            const parseRgb = (rgb) => {
                const result = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(rgb);
                return result ? { r: parseInt(result[1], 10), g: parseInt(result[2], 10), b: parseInt(result[3], 10) } : null;
            };

            let rgbaColor;
            let parsed = parseHex(color) || parseRgb(color);
            if (parsed) {
                rgbaColor = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${opacity})`;
            } else {
                rgbaColor = color;
            }

            ctx.strokeStyle = rgbaColor;
            ctx.lineWidth = yLength;
            
            if (alert.options.lineStyle === 'dashed') ctx.setLineDash([10, 8]);
            else if (alert.options.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
            else ctx.setLineDash([]);
            
            ctx.beginPath();
            ctx.moveTo(startPos, yPos + yLength / 2);
            ctx.lineTo(endPos, yPos + yLength / 2);
            ctx.stroke();

            if (alert.hovered || alert.dragging || alert.selected || alert.attached) {
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(Math.round(xCoordinate * scope.horizontalPixelRatio), yPos + yLength / 2, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = rgbaColor;
                ctx.beginPath();
                ctx.arc(Math.round(xCoordinate * scope.horizontalPixelRatio), yPos + yLength / 2, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();
            }

            if (alert.options.showPrice) {
                let priceText = Utils.formatPrice(alert.price);
                if (alert.options.showBell) {
                    priceText = '🔔 ' + priceText;
                }

                ctx.font = `bold ${alert.options.fontSize * scope.horizontalPixelRatio}px 'Inter', Arial, sans-serif`;
                const textMetrics = ctx.measureText(priceText);
                const textWidth = textMetrics.width;
                const padding = 8 * scope.horizontalPixelRatio;
                const labelWidth = textWidth + padding * 2;
                const labelHeight = (alert.options.fontSize + 6) * scope.verticalPixelRatio;

                const labelXPos = scope.mediaSize.width * scope.horizontalPixelRatio - labelWidth - 2;
                const labelYPos = yPos - labelHeight / 2;

                this._priceLabelHitArea = { x: labelXPos, y: labelYPos, width: labelWidth, height: labelHeight };

                ctx.fillStyle = rgbaColor;
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                this._roundRect(ctx, labelXPos, labelYPos, labelWidth, labelHeight, 4 * scope.horizontalPixelRatio);
                ctx.fill();

                ctx.shadowBlur = 0;
                
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold ${(alert.options.fontSize + 1) * scope.horizontalPixelRatio}px 'Inter', Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(priceText, labelXPos + labelWidth / 2, labelYPos + labelHeight / 2);
                
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
            
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

    hitTest(x, y) {
        const isMac = this._isMac;
        const pixelRatio = this._pixelRatio;
        const mac = isMac && pixelRatio > 1;
        
        if (this._hitArea) {
            if (mac) {
                const buffer = 30;
                const inY = Math.abs(y - this._hitArea.y - this._hitArea.height / 2) < (this._hitArea.height / 2 + buffer);
                const chartWidth = (this._chartManager?.chartContainer?.offsetWidth || 426) * pixelRatio;
                const inX = x >= 0 && x <= chartWidth;
                if (inX && inY) return 'line';
            } else {
                const buffer = 10;
                const inY = Math.abs(y - this._hitArea.y - this._hitArea.height / 2) < (this._hitArea.height / 2 + buffer);
                const inX = x >= this._hitArea.x1 - buffer && x <= this._hitArea.x2 + buffer;
                if (inX && inY) return 'line';
            }
        }
        if (this._priceLabelHitArea) {
            if (mac) {
                const padding = 15;
                const inX = x >= this._priceLabelHitArea.x - padding && 
                            x <= this._priceLabelHitArea.x + this._priceLabelHitArea.width + padding;
                const inY = y >= this._priceLabelHitArea.y - padding && 
                            y <= this._priceLabelHitArea.y + this._priceLabelHitArea.height + padding;
                if (inX && inY) return 'label';
            } else {
                const inX = x >= this._priceLabelHitArea.x && x <= this._priceLabelHitArea.x + this._priceLabelHitArea.width;
                const inY = y >= this._priceLabelHitArea.y && y <= this._priceLabelHitArea.y + this._priceLabelHitArea.height;
                if (inX && inY) return 'label';
            }
        }
        return null;
    }
}
class AlertLinePaneView {
    constructor(alert, chartManager) {
        this._alert = alert;
        this._chartManager = chartManager;
        this._renderer = new AlertLineRenderer(alert, chartManager);
    }
    renderer() { return this._renderer; }
    zOrder() { return 'top'; }
}

class AlertLinePrimitive {
    constructor(alert, chartManager) {
        this._alert = alert;
        this._chartManager = chartManager;
        this._paneView = new AlertLinePaneView(alert, chartManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    
    paneViews() { return [this._paneView]; }
    
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
        this._syncTime(); // первая синхронизация
    }
    
    updateAllViews() {
        const oldTime = this._alert.time;
        this._syncTime();
        if (this._alert.time !== oldTime && this._requestUpdate) {
            this._requestUpdate();
        }
    }
    
    _syncTime() {
        const chartData = this._chartManager.chartData;
        if (!chartData || chartData.length === 0) return;
        
        const anchor = this._alert.anchorTime;
        
        let intervalMs = 60 * 60 * 1000;
        if (chartData.length >= 2) intervalMs = chartData[1].time - chartData[0].time;
        
        let newTime = anchor;
        for (let i = 0; i < chartData.length; i++) {
            const start = chartData[i].time;
            const end = start + intervalMs;
            if (anchor >= start && anchor < end) {
                newTime = start;
                break;
            }
        }
        
        if (newTime === anchor && chartData.length) {
            let closest = chartData[0];
            let minDiff = Math.abs(closest.time - anchor);
            for (let i = 1; i < chartData.length; i++) {
                const diff = Math.abs(chartData[i].time - anchor);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = chartData[i];
                }
            }
            newTime = closest.time;
        }
        
        this._alert.time = newTime;
    }
    
    getAlert() { return this._alert; }
    
    requestRedraw() { if (this._requestUpdate) this._requestUpdate(); }
}

class AlertLineManager {
    constructor(chartManager) {
        this._isMac = /Mac/.test(navigator.userAgent);
        this._pixelRatio = window.devicePixelRatio || 1;
        this._alerts = [];
        this._chartManager = chartManager;
        this._selectedAlert = null;
        this._hoveredAlert = null;
        this._isDrawingMode = false;
        this._isDragging = false;
        this._dragAlert = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartPrice = 0;
        this._dragStartTime = 0;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._isLoading = false;
        this._lastPrices = new Map();
        this._subscribedSymbols = new Set();
        this._alertWebSockets = new Map();
        this._potentialDrag = null;
        this._dragThreshold = 5;
        this._magnetEnabled = true;
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._setupEventListeners();
        this._setupHotkeys();
        this._autoLoadAlerts();
        this._setupSettingsListeners();
        setInterval(() => { this.checkTimerAlerts(); }, 1000);
    }

    _getCurrentSymbolKey() {
        const symbol = this._chartManager.currentSymbol || 'BTCUSDT';
        const exchange = this._chartManager.currentExchange || 'binance';
        const marketType = this._chartManager.currentMarketType || 'futures';
        return `${symbol}:${exchange}:${marketType}`;
    }

    _getTimeFromCoordinate(x) {
        let time = this._chartManager.coordinateToTime(x);
        if (time !== null) return time;
        const data = this._chartManager.chartData;
        if (!data.length) return null;
        let intervalMs = 60 * 60 * 1000;
        if (data.length >= 2) intervalMs = data[1].time - data[0].time;
        const firstCandle = data[0];
        const lastCandle = data[data.length - 1];
        const firstX = this._chartManager.timeToCoordinate(firstCandle.time);
        const lastX = this._chartManager.timeToCoordinate(lastCandle.time);
        if (firstX === null || lastX === null) return null;
        if (x > lastX) {
            const deltaX = x - lastX;
            const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
            return lastCandle.time + deltaX / pixelsPerMs;
        }
        if (x < firstX) {
            const deltaX = firstX - x;
            const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
            return firstCandle.time - deltaX / pixelsPerMs;
        }
        return null;
    }

    _subscribeToSymbol(symbol) {
        if (this._subscribedSymbols.has(symbol)) return;
        this._subscribedSymbols.add(symbol);
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@trade`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.p) {
                const price = parseFloat(data.p);
                this.updatePriceForSymbol(symbol, price);
            }
        };
        ws.onclose = () => {
            this._subscribedSymbols.delete(symbol);
            this._alertWebSockets.delete(symbol);
        };
        this._alertWebSockets.set(symbol, ws);
    }

    _unsubscribeFromSymbol(symbol) {
        const ws = this._alertWebSockets.get(symbol);
        if (ws) {
            ws.onclose = null;
            ws.close();
            this._alertWebSockets.delete(symbol);
        }
        this._subscribedSymbols.delete(symbol);
    }

    _setupHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                const container = this._chartManager.chartContainer;
                const rect = container.getBoundingClientRect();
                const mouseX = this._lastMouseX !== undefined ? this._lastMouseX : rect.width / 2;
                const mouseY = this._lastMouseY !== undefined ? this._lastMouseY : rect.height / 2;
                let price = this._chartManager.coordinateToPrice(mouseY);
                let time = this._chartManager.coordinateToTime(mouseX);
                if (price === null || time === null) {
                    const lastCandle = this._chartManager.getLastCandle();
                    if (lastCandle) { price = lastCandle.close; time = lastCandle.time; } else return;
                }
                if (this._magnetEnabled) {
                    const snapped = this._snapToPrice(price, time);
                    price = snapped.price;
                    time = snapped.time;
                }
                this.createAlert(price, time, {
                    color: document.getElementById('alertCurrentColorBox')?.style.backgroundColor || '#808080',
                    lineWidth: parseInt(document.getElementById('alertSettingThickness')?.value) || 2,
                    lineStyle: document.getElementById('alertTemplateSelect')?.value || 'dotted',
                    opacity: parseInt(document.getElementById('alertColorOpacity')?.value) / 100 || 0.26,
                    showPrice: true,
                    showBell: document.getElementById('alertShowBell')?.checked || true,
                    repeatCount: document.getElementById('alertRepeatCount')?.value === 'Infinity' ? Infinity : parseInt(document.getElementById('alertRepeatCount')?.value) || 5,
                    repeatInterval: parseInt(document.getElementById('alertRepeatInterval')?.value) || 1
                });
            }
            if (e.key === 'Delete' && this._selectedAlert) {
                e.preventDefault();
                this.deleteAlert(this._selectedAlert.id);
                this._selectedAlert = null;
            }
        });
    }

    _setupEventListeners() {
        const container = this._chartManager.chartContainer;

        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const rect = container.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            if (this._isMac && this._pixelRatio > 1) { x *= this._pixelRatio; y *= this._pixelRatio; }
            const hit = this.hitTest(x, y);
            if (hit) {
                e.preventDefault();
                e.stopPropagation();
                if (this._selectedAlert && this._selectedAlert === hit.alert) {
                    this._selectedAlert.selected = false;
                    this._selectedAlert.showDragPoint = false;
                    this._selectedAlert.attached = false;
                    this._selectedAlert = null;
                    this._requestRedraw();
                    return;
                }
                if (this._selectedAlert) {
                    this._selectedAlert.selected = false;
                    this._selectedAlert.showDragPoint = false;
                    this._selectedAlert.attached = false;
                }
                hit.alert.selected = true;
                hit.alert.showDragPoint = true;
                hit.alert.attached = true;
                this._selectedAlert = hit.alert;
                const alertX = this._chartManager.timeToCoordinate(hit.alert.time);
                const alertY = this._chartManager.priceToCoordinate(hit.alert.price);
                if (alertX !== null && alertY !== null) {
                    hit.alert.dragPointX = alertX;
                    hit.alert.dragPointY = alertY;
                }
                this._potentialDrag = { alert: hit.alert, startX: x, startY: y, startPrice: hit.alert.price, startTime: hit.alert.time };
                this._requestRedraw();
            } else {
                const alertMenu = document.getElementById('alertContextMenu');
                if (alertMenu && alertMenu.style.display === 'flex') {
                    const menuRect = alertMenu.getBoundingClientRect();
                    const isClickInsideMenu = e.clientX >= menuRect.left && e.clientX <= menuRect.right && e.clientY >= menuRect.top && e.clientY <= menuRect.bottom;
                    if (isClickInsideMenu) return;
                }
                if (this._dragAlert) { this._dragAlert.selected = false; this._dragAlert.showDragPoint = false; this._dragAlert.attached = false; this._dragAlert = null; }
                if (this._selectedAlert) { this._selectedAlert.selected = false; this._selectedAlert.showDragPoint = false; this._selectedAlert.attached = false; this._selectedAlert = null; }
                if (alertMenu) alertMenu.style.display = 'none';
                this._requestRedraw();
            }
        });

        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            if (this._isMac && this._pixelRatio > 1) { x *= this._pixelRatio; y *= this._pixelRatio; }
            this._lastMouseX = x;
            this._lastMouseY = y;

            if (this._potentialDrag && !this._isDragging) {
                const dx = Math.abs(x - this._potentialDrag.startX);
                const dy = Math.abs(y - this._potentialDrag.startY);
                if (dx > this._dragThreshold || dy > this._dragThreshold) {
                    this._isDragging = true;
                    this._dragAlert = this._potentialDrag.alert;
                    this._dragAlert.dragging = true;
                    this._dragStartX = this._potentialDrag.startX;
                    this._dragStartY = this._potentialDrag.startY;
                    this._dragStartPrice = this._potentialDrag.startPrice;
                    this._dragStartTime = this._potentialDrag.startTime;
                    container.style.cursor = 'grabbing';
                }
            }
            if (this._isDragging && this._dragAlert) {
                e.preventDefault();
                e.stopPropagation();
                const deltaX = x - this._dragStartX;
                const deltaY = y - this._dragStartY;
                const alertX = this._chartManager.timeToCoordinate(this._dragStartTime);
                const alertY = this._chartManager.priceToCoordinate(this._dragStartPrice);
                if (alertX !== null && alertY !== null) {
                    const newX = alertX + deltaX;
                    const newY = alertY + deltaY;
                    const newPrice = this._chartManager.coordinateToPrice(newY);
                    const newTime = this._chartManager.coordinateToTime(newX);
                    if (newPrice !== null) this._dragAlert.price = newPrice;
                    if (newTime !== null) { this._dragAlert.time = newTime; this._dragAlert.anchorTime = newTime; }
                    const newAlertX = this._chartManager.timeToCoordinate(this._dragAlert.time);
                    const newAlertY = this._chartManager.priceToCoordinate(this._dragAlert.price);
                    if (newAlertX !== null && newAlertY !== null) {
                        this._dragAlert.dragPointX = newAlertX;
                        this._dragAlert.dragPointY = newAlertY;
                    }
                    this._requestRedraw();
                }
            } else {
                const hit = this.hitTest(x, y);
                const hitAlert = hit ? hit.alert : null;
                container.style.cursor = hitAlert ? 'grab' : 'crosshair';
                if (this._hoveredAlert !== hitAlert) {
                    if (this._hoveredAlert) this._hoveredAlert.hovered = false;
                    this._hoveredAlert = hitAlert;
                    if (hitAlert) hitAlert.hovered = true;
                    this._requestRedraw();
                }
            }
        });

        container.addEventListener('mouseup', (e) => {
            this._potentialDrag = null;
            if (this._isDragging) {
                e.preventDefault();
                e.stopPropagation();
                this._isDragging = false;
                if (this._dragAlert) {
                    this._dragAlert.dragging = false;
                    this._dragAlert.attached = false;
                    this._dragAlert.anchorTime = this._dragAlert.time;
                    this._saveAlerts();
                    this._dragAlert = null;
                    this._requestRedraw();
                }
                container.style.cursor = 'crosshair';
                setTimeout(() => {
                    const moveEvent = new MouseEvent('mousemove', { clientX: e.clientX, clientY: e.clientY });
                    container.dispatchEvent(moveEvent);
                }, 10);
            }
        });

        container.addEventListener('mouseleave', () => {
            if (this._hoveredAlert) { this._hoveredAlert.hovered = false; this._hoveredAlert = null; this._requestRedraw(); }
            container.style.cursor = 'crosshair';
        });

        container.addEventListener('click', (e) => {
            if (this._isDragging) { e.preventDefault(); e.stopPropagation(); }
            if (this._isDrawingMode) this._handleChartClick(e);
        });

        container.addEventListener('contextmenu', this._handleContextMenu);

        container.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = container.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            if (this._isMac && this._pixelRatio > 1) { x *= this._pixelRatio; y *= this._pixelRatio; }
            const hit = this.hitTest(x, y);
            if (hit) {
                this.deleteAlert(hit.alert.id);
                if (this._selectedAlert && this._selectedAlert.id === hit.alert.id) this._selectedAlert = null;
                if (this._hoveredAlert && this._hoveredAlert.id === hit.alert.id) this._hoveredAlert = null;
                this._requestRedraw();
            }
        });
    }

    _handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (this._isMac && this._pixelRatio > 1) { x *= this._pixelRatio; y *= this._pixelRatio; }
        const hit = this.hitTest(x, y);
        if (hit) {
            if (this._selectedAlert && this._selectedAlert !== hit.alert) {
                this._selectedAlert.selected = false;
                this._selectedAlert.showDragPoint = false;
                this._selectedAlert.attached = false;
            }
            hit.alert.selected = true;
            hit.alert.showDragPoint = true;
            hit.alert.attached = false;
            const alertX = this._chartManager.timeToCoordinate(hit.alert.time);
            const alertY = this._chartManager.priceToCoordinate(hit.alert.price);
            if (alertX !== null && alertY !== null) {
                hit.alert.dragPointX = alertX;
                hit.alert.dragPointY = alertY;
            }
            this._selectedAlert = hit.alert;
            this._requestRedraw();

            const menu = document.getElementById('alertContextMenu');
            if (menu) {
                document.getElementById('drawingContextMenu').style.display = 'none';
                document.getElementById('trendContextMenu').style.display = 'none';
                menu.style.display = 'flex';
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';
                
                const copyBtn = document.getElementById('alertContextCopyBtn');
                const newCopyBtn = copyBtn.cloneNode(true);
                copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
                newCopyBtn.onclick = (event) => { event.stopPropagation(); navigator.clipboard?.writeText(Utils.formatPrice(hit.alert.price)); menu.style.display = 'none'; };
                
                const settingsBtn = document.getElementById('alertContextSettingsBtn');
                const newSettingsBtn = settingsBtn.cloneNode(true);
                settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);
                newSettingsBtn.onclick = (event) => { event.stopPropagation(); this._showSettings(hit.alert); menu.style.display = 'none'; };
                
                const deleteBtn = document.getElementById('alertContextDeleteBtn');
                const newDeleteBtn = deleteBtn.cloneNode(true);
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.onclick = (event) => { event.stopPropagation(); this.deleteAlert(hit.alert.id); menu.style.display = 'none'; };
            }
        } else {
            const menu = document.getElementById('alertContextMenu');
            if (menu) menu.style.display = 'none';
        }
    }

    setDrawingMode(enabled) {
        this._isDrawingMode = enabled;
        
        const alertBtn = document.getElementById('toolAlert');
        if (alertBtn) {
            if (enabled) {
                alertBtn.style.background = '#4A90E2';
                alertBtn.style.color = '#FFFFFF';
                alertBtn.classList.add('active');
            } else {
                alertBtn.style.background = '';
                alertBtn.style.color = '';
                alertBtn.classList.remove('active');
            }
        }
    }

    setMagnetEnabled(enabled) {
        this._magnetEnabled = enabled;
    }

  updatePriceForSymbol(symbol, price, exchange = null) {
    if (!symbol || !price || isNaN(price)) return;
    
    const now = Date.now();
    const lastPrice = this._lastPrices.get(symbol);
    
    this._lastPrices.set(symbol, price);
    
    if (lastPrice === undefined) return;
    
    // Находим ВСЕ алерты для этого символа (независимо от биржи)
    const symbolAlerts = this._alerts.filter(item => 
        item.alert.symbol === symbol && 
        !item.alert.triggered
    );
    
    if (symbolAlerts.length === 0) return;
    
    symbolAlerts.forEach(item => {
        const alert = item.alert;
        
        if (now - alert.createdAt < 2000) return;
        
        const alertPrice = alert.price;
        const crossedAbove = lastPrice < alertPrice && price >= alertPrice;
        const crossedBelow = lastPrice > alertPrice && price <= alertPrice;
        
        if ((crossedAbove || crossedBelow) && !alert.active) {
            console.log(`🔔 Алерт сработал! ${symbol} ${lastPrice} -> ${price} (цель: ${alertPrice})`);
            
            alert.active = true;
            alert.lastTriggerTime = now;
            alert.triggerCount = 1;
            
            this._showAlertNotification(alert, price);
            this._sendTelegramAlert(alert, price);
            
            if (!alert.canTriggerAgain()) {
                alert.triggered = true;
                if (item.primitive && item.series) {
                    try { item.series.detachPrimitive(item.primitive); } catch(e) {}
                    item.primitive = null;
                    item.series = null;
                }
            }
            
            this._updateAlertsListUI();
            this._requestRedraw();
            this._saveAlerts();
        }
    });
}

    checkTimerAlerts() {
        const now = Date.now();
        
        this._alerts.forEach(item => {
            const alert = item.alert;
            
            if (alert.triggered) return;
            if (!alert.active) return;
            
            if (alert.canTriggerAgain() && alert.shouldTriggerByTimer(now)) {
                const currentPrice = this._lastPrices.get(alert.symbol);
                
                if (currentPrice !== undefined) {
                    console.log(`⏰ Таймерный алерт: ${alert.symbol} - срабатывание #${alert.triggerCount + 1}`);
                    
                    alert.triggerCount++;
                    alert.lastTriggerTime = now;
                    
                    this._showAlertNotification(alert, currentPrice, true);
                    this._sendTelegramAlert(alert, currentPrice, true);
                    
                    if (!alert.canTriggerAgain()) {
                        alert.triggered = true;
                        
                        if (item.primitive) {
                            try {
                                item.series.detachPrimitive(item.primitive);
                                item.primitive = null;
                                item.series = null;
                            } catch (e) {}
                        }
                    }
                    
                    this._updateAlertsListUI();
                    this._requestRedraw();
                    this._saveAlerts();
                }
            }
        });
    }

    createAlert(price, time, options = {}) {
        const defaultVisibility = {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        
        const timeframeVisibility = options.timeframeVisibility || defaultVisibility;
        
        const alert = new AlertLine(price, time, {
            ...options,
            symbol: this._chartManager.currentSymbol,
            exchange: this._chartManager.currentExchange,
            marketType: this._chartManager.currentMarketType,
            timeframeVisibility: timeframeVisibility,
            repeatCount: options.repeatCount || 5,
            repeatInterval: options.repeatInterval || 1,
            triggerCount: options.triggerCount || 0,
            lastTriggerTime: options.lastTriggerTime || null,
            active: options.active || false
        });
        
        alert.anchorTime = time;
        alert.triggered = options.triggered || false;
        alert.symbolKey = this._getCurrentSymbolKey();
        
        if (!alert.triggered) {
            const primitive = new AlertLinePrimitive(alert, this._chartManager);
            const series = this._chartManager.currentChartType === 'candle' 
                ? this._chartManager.candleSeries 
                : this._chartManager.barSeries;
            series.attachPrimitive(primitive);
            this._alerts.push({ alert, primitive, series });
        } else {
            this._alerts.push({ alert, primitive: null, series: null });
        }
        
        // ========== ПОДПИСАТЬСЯ НА СИМВОЛ НОВОГО АЛЕРТА ==========
        this._subscribeToSymbol(alert.symbol);
        
        this._saveAlerts();
        this._updateAlertsListUI();
        
        return alert;
    }

    deleteAlert(alertId) {
        const index = this._alerts.findIndex(a => a.alert.id === alertId);
        if (index !== -1) {
            const { alert, primitive, series } = this._alerts[index];
            const symbol = alert.symbol;
            
            window.db.delete('drawings', alertId).catch(e => console.warn(e));
            
            if (primitive && series) {
                try { series.detachPrimitive(primitive); } catch (e) {}
            }
            this._alerts.splice(index, 1);
            
            // ========== ОТПИСАТЬСЯ, ЕСЛИ БОЛЬШЕ НЕТ АЛЕРТОВ ДЛЯ ЭТОГО СИМВОЛА ==========
            const hasOtherAlerts = this._alerts.some(item => item.alert.symbol === symbol && !item.alert.triggered);
            if (!hasOtherAlerts) {
                this._unsubscribeFromSymbol(symbol);
            }
            
            if (this._selectedAlert && this._selectedAlert.id === alertId) this._selectedAlert = null;
            if (this._dragAlert && this._dragAlert.id === alertId) this._dragAlert = null;
            this._saveAlerts();
            this._updateAlertsListUI();
            this._requestRedraw();
            return true;
        }
        return false;
    }

    deleteAllAlerts() {
        // ========== ОТПИСАТЬСЯ ОТ ВСЕХ СИМВОЛОВ ==========
        for (const symbol of this._subscribedSymbols) {
            this._unsubscribeFromSymbol(symbol);
        }
        
        for (const item of this._alerts) {
            window.db.delete('drawings', item.alert.id).catch(e => console.warn(e));
        }
        
        this._alerts.forEach(({ primitive, series }) => {
            if (primitive && series) {
                try { series.detachPrimitive(primitive); } catch (e) {}
            }
        });
        this._alerts = [];
        this._selectedAlert = null;
        this._dragAlert = null;
        this._saveAlerts();
        this._updateAlertsListUI();
        this._requestRedraw();
    }

    hitTest(x, y) {
        for (const item of this._alerts) {
            if (!item.primitive) continue;
            try {
                const hitType = item.primitive._paneView._renderer.hitTest(x, y);
                if (hitType) return { alert: item.alert, type: hitType };
            } catch (e) {}
        }
        return null;
    }

    syncWithNewTimeframe() {
        // Ничего не делаем – updateAllViews сам всё обновит
    }

 _handleChartClick(event) {
    if (!this._isDrawingMode) return;
    
    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    let price = this._chartManager.coordinateToPrice(y);
    let time = this._getTimeFromCoordinate(x);
    let anchorCandle = null;
    
    if (price === null || time === null) {
        const lastCandle = this._chartManager.getLastCandle();
        if (lastCandle) {
            price = lastCandle.close;
            time = lastCandle.time;
        } else {
            return;
        }
    }
    
    if (this._magnetEnabled) {
        const snapped = this._snapToPrice(price, time);
        price = snapped.price;
        time = snapped.time;
        anchorCandle = snapped.anchorCandle;
    }
    
    console.log('🔔 Создаём алерт:', {
        symbol: this._chartManager.currentSymbol,
        price: price,
        time: new Date(time * 1000).toLocaleString()
    });
    
    this.createAlert(price, time, {
        color: document.getElementById('alertCurrentColorBox')?.style.backgroundColor || '#808080',
        lineWidth: parseInt(document.getElementById('alertSettingThickness')?.value) || 2,
        lineStyle: document.getElementById('alertTemplateSelect')?.value || 'dotted',
        opacity: parseInt(document.getElementById('alertColorOpacity')?.value) / 100 || 0.26,
        showPrice: true,
        showBell: document.getElementById('alertShowBell')?.checked || true,
        repeatCount: document.getElementById('alertRepeatCount')?.value === 'Infinity' ? Infinity : parseInt(document.getElementById('alertRepeatCount')?.value) || 5,
        repeatInterval: parseInt(document.getElementById('alertRepeatInterval')?.value) || 1,
        anchorCandle: anchorCandle
    });
    
    this.setDrawingMode(false);
}
    _snapToPrice(price, time) {
        if (!this._chartManager.chartData.length) return { price, time, anchorCandle: null };
        
        const data = this._chartManager.chartData;
        
        let closestCandle = data[0];
        let minTimeDiff = Math.abs(data[0].time - time);
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minTimeDiff) { 
                minTimeDiff = diff; 
                closestCandle = data[i]; 
            }
        }
        
        const priceY = this._chartManager.priceToCoordinate(price);
        const highY = this._chartManager.priceToCoordinate(closestCandle.high);
        const lowY = this._chartManager.priceToCoordinate(closestCandle.low);
        const closeY = this._chartManager.priceToCoordinate(closestCandle.close);
        
        if (priceY === null || highY === null) return { price, time, anchorCandle: null };
        
        const dHighPx = Math.abs(highY - priceY);
        const dLowPx = Math.abs(lowY - priceY);
        const dClosePx = Math.abs(closeY - priceY);
        
        let snappedPrice = price;
        let anchorType = null;
        const MAGNET_THRESHOLD = 150;
        
        const minDistPx = Math.min(dHighPx, dLowPx, dClosePx);
        
        if (minDistPx < MAGNET_THRESHOLD) {
            if (minDistPx === dHighPx) {
                snappedPrice = closestCandle.high;
                anchorType = 'high';
            } else if (minDistPx === dLowPx) {
                snappedPrice = closestCandle.low;
                anchorType = 'low';
            } else {
                snappedPrice = closestCandle.close;
                anchorType = 'close';
            }
        }
        
        return { 
            price: snappedPrice, 
            time: closestCandle.time,
            anchorCandle: {
                time: closestCandle.time,
                type: anchorType,
                price: snappedPrice
            }
        };
    }

    _findClosestCandleTime(time) {
        if (!this._chartManager.chartData.length) return time;
        
        const data = this._chartManager.chartData;
        let closestCandle = data[0];
        let minDiff = Math.abs(data[0].time - time);
        
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minDiff) {
                minDiff = diff;
                closestCandle = data[i];
            }
        }
        
        return closestCandle.time;
    }

    _showSettings(alert) {
    const settings = document.getElementById('alertSettings');
    if (!settings) return;
    
    document.getElementById('alertCurrentColorBox').style.backgroundColor = alert.options.color;
    document.getElementById('alertHexInputInline').value = alert.options.color;
    document.getElementById('alertSettingThickness').value = alert.options.lineWidth;
    document.getElementById('alertTemplateSelect').value = alert.options.lineStyle;
    document.getElementById('alertColorOpacity').value = Math.round(alert.options.opacity * 100);
    document.getElementById('alertColorOpacityValue').textContent = document.getElementById('alertColorOpacity').value + '%';
    
    const bellCheckbox = document.getElementById('alertShowBell');
    if (bellCheckbox) bellCheckbox.checked = alert.options.showBell !== false;
    
    const priceInput = document.getElementById('alertSettingsPriceInput');
    if (priceInput) priceInput.value = Utils.formatPrice(alert.price);
    
    const repeatCountSelect = document.getElementById('alertRepeatCount');
    if (repeatCountSelect) repeatCountSelect.value = alert.repeatCount === Infinity ? 'Infinity' : alert.repeatCount;
    
    const repeatIntervalSelect = document.getElementById('alertRepeatInterval');
    if (repeatIntervalSelect) repeatIntervalSelect.value = alert.repeatInterval;
    
    this._renderTimeframeCheckboxes(alert);
    
    settings.style.display = 'block';
    settings.style.left = '50%';
    settings.style.top = '50%';
    settings.style.transform = 'translate(-50%, -50%)';
    
    // Сохраняем ссылку на алерт в датасете панели
    settings.dataset.alertId = alert.id;
    
    // Показываем нужную вкладку
    const stylePanel = document.getElementById('alertStylePanel');
    const repeatPanel = document.getElementById('alertRepeatPanel');
    const visibilityPanel = document.getElementById('alertVisibilityPanel');
    
    stylePanel.classList.add('active');
    repeatPanel.classList.remove('active');
    visibilityPanel.classList.remove('active');
    
    document.querySelectorAll('#alertSettings .settings-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.alertSettingsTab === 'style') tab.classList.add('active');
    });
}

// Обработчики навешиваем ОДИН РАЗ при загрузке
_setupSettingsListeners() {
    const settings = document.getElementById('alertSettings');
    if (!settings || settings._listenersSetup) return;
    settings._listenersSetup = true;
    
    // Вкладки
    settings.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.alertSettingsTab;
            document.getElementById('alertStylePanel').classList.toggle('active', tabName === 'style');
            document.getElementById('alertRepeatPanel').classList.toggle('active', tabName === 'repeat');
            document.getElementById('alertVisibilityPanel').classList.toggle('active', tabName === 'visibility');
            settings.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
    
    // Кнопка Применить цену
    document.getElementById('alertApplyPriceBtn').addEventListener('click', () => {
        const alertId = settings.dataset.alertId;
        const alert = this._alerts.find(a => a.alert.id === alertId)?.alert;
        if (!alert) return;
        const newPrice = parseFloat(document.getElementById('alertSettingsPriceInput').value);
        if (!isNaN(newPrice)) {
            alert.price = newPrice;
            this._requestRedraw();
            this._saveAlerts();
        }
    });
    
    // Кнопка Сохранить
    document.getElementById('alertSaveSettings').addEventListener('click', () => {
        const alertId = settings.dataset.alertId;
        const alert = this._alerts.find(a => a.alert.id === alertId)?.alert;
        if (!alert) return;
        const repeatCountVal = document.getElementById('alertRepeatCount').value;
        alert.updateOptions({
            color: document.getElementById('alertCurrentColorBox').style.backgroundColor,
            lineWidth: parseInt(document.getElementById('alertSettingThickness').value),
            lineStyle: document.getElementById('alertTemplateSelect').value,
            opacity: parseInt(document.getElementById('alertColorOpacity').value) / 100,
            showBell: document.getElementById('alertShowBell').checked,
            repeatCount: repeatCountVal === 'Infinity' ? Infinity : parseInt(repeatCountVal),
            repeatInterval: parseInt(document.getElementById('alertRepeatInterval').value)
        });
        this._requestRedraw();
        settings.style.display = 'none';
        this._saveAlerts();
        this._updateAlertsListUI();
    });
    
    // Кнопка Удалить
    document.getElementById('alertDeleteDrawing').addEventListener('click', () => {
        const alertId = settings.dataset.alertId;
        this.deleteAlert(alertId);
        settings.style.display = 'none';
        this._requestRedraw();
    });
}

    _renderTimeframeCheckboxes(alert) {
        const container = document.getElementById('alertTimeframeCheckboxList');
        if (!container) return;
        
        const tfLabels = {
            '1m': '1 минута', '3m': '3 минуты', '5m': '5 минут', '15m': '15 минут',
            '30m': '30 минут', '1h': '1 час', '4h': '4 часа', '6h': '6 часов',
            '12h': '12 часов', '1d': '1 день', '1w': '1 неделя', '1M': '1 месяц'
        };
        
        let html = '';
        const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d', '1w', '1M'];
        
        timeframes.forEach(tf => {
            const isChecked = alert.timeframeVisibility[tf] !== false;
            const label = tfLabels[tf] || tf;
            const shortLabel = tf;
            
            html += `
                <div class="timeframe-checkbox-item">
                    <input type="checkbox" id="alert_tf_${tf}_${alert.id}" data-timeframe="${tf}" ${isChecked ? 'checked' : ''}>
                    <label for="alert_tf_${tf}_${alert.id}">${label}</label>
                    <span class="tf-badge">${shortLabel}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const tf = e.target.dataset.timeframe;
                alert.timeframeVisibility[tf] = e.target.checked;
            });
        });
        
        const selectAllBtn = document.getElementById('alertSelectAllTimeframes');
        const deselectAllBtn = document.getElementById('alertDeselectAllTimeframes');
        
        if (selectAllBtn) {
            const newSelectAll = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode.replaceChild(newSelectAll, selectAllBtn);
            newSelectAll.addEventListener('click', () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                    const tf = cb.dataset.timeframe;
                    alert.timeframeVisibility[tf] = true;
                });
            });
        }
        
        if (deselectAllBtn) {
            const newDeselectAll = deselectAllBtn.cloneNode(true);
            deselectAllBtn.parentNode.replaceChild(newDeselectAll, deselectAllBtn);
            newDeselectAll.addEventListener('click', () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                    const tf = cb.dataset.timeframe;
                    alert.timeframeVisibility[tf] = false;
                });
            });
        }
    }

    _requestRedraw() {
        this._alerts.forEach(item => { 
            if (item.primitive?.requestRedraw) {
                item.primitive.requestRedraw();
            }
        });
    }

    _showAlertNotification(alert, currentPrice, isRepeat = false) {
        const notification = document.getElementById('alertNotification');
        
        const priceFormatted = Utils.formatPrice(currentPrice);
        const alertPriceFormatted = Utils.formatPrice(alert.price);
        const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const repeatText = isRepeat ? ` (повтор ${alert.triggerCount}/${alert.repeatCount === Infinity ? '∞' : alert.repeatCount})` : '';
        
        if (notification) {
            notification.innerHTML = `
                <div class="alert-title">🔔 ${alert.symbol} - АЛЕРТ СРАБОТАЛ${repeatText}</div>
                <div class="alert-price">${priceFormatted} / ${alertPriceFormatted}</div>
                <div class="alert-repeat">${timeStr}</div>
            `;
            notification.style.display = 'block';
            notification.style.borderLeftColor = alert.options.color;
            setTimeout(() => {
                notification.style.display = 'none';
            }, 5000);
        }
        
        this._playAlertSound();
        this._showSystemNotification(alert, currentPrice, isRepeat);
    }

  _playAlertSound() {
    try {
        const audio = document.getElementById('alertSound');
        
        // Если есть элемент audio с src - используем его
        if (audio && audio.src && audio.src !== '') {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Звук не воспроизвёлся:', e));
            return;
        }
        
        // Если нет - создаём встроенный звук (бип)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            
            oscillator.frequency.value = 800;
            gain.gain.value = 0.3;
            
            oscillator.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            
            // Resume context если он в suspended состоянии
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
        } else {
            console.log('AudioContext не поддерживается');
        }
    } catch (e) {
        console.warn('Ошибка воспроизведения звука:', e);
    }
}

    _showSystemNotification(alert, currentPrice, isRepeat = false) {
        if (!("Notification" in window)) {
            console.log("Этот браузер не поддерживает системные уведомления");
            return;
        }
        
        const priceFormatted = Utils.formatPrice(currentPrice);
        const repeatText = isRepeat ? ` (повтор ${alert.triggerCount}/${alert.repeatCount === Infinity ? '∞' : alert.repeatCount})` : '';
        
        const showNotification = () => {
            const notification = new Notification(`🔔 ${alert.symbol} - АЛЕРТ${repeatText}`, {
                body: `Цена: ${priceFormatted} | Уровень: ${Utils.formatPrice(alert.price)}`,
                icon: 'https://tradingview.com/favicon.ico',
                silent: false,
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            setTimeout(() => notification.close(), 10000);
        };
        
        if (Notification.permission === "granted") {
            showNotification();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showNotification();
                }
            });
        }
    }

    _sendTelegramAlert(alert, currentPrice, isRepeat = false) {
        const chatId = localStorage.getItem('telegramChatId');
        if (!chatId) return;
        
        const priceFormatted = Utils.formatPrice(currentPrice);
        const alertPriceFormatted = Utils.formatPrice(alert.price);
        
        const direction = currentPrice > alert.price ? '⬆️ Выше' : '⬇️ Ниже';
        const repeatText = isRepeat ? `\n🔄 Повтор: ${alert.triggerCount}/${alert.repeatCount === Infinity ? '∞' : alert.repeatCount}` : '';
        
        const message = `🚨 АЛЕРТ СРАБОТАЛ!\n\n` +
            `📊 Пара: ${alert.symbol}\n` +
            `💰 Цена алерта: ${alertPriceFormatted}\n` +
            `📈 Текущая цена: ${priceFormatted}\n` +
            `🧭 Направление: ${direction}${repeatText}\n` +
            `⏰ Время: ${new Date().toLocaleString('ru-RU')}`;
        
        const formData = new URLSearchParams();
        formData.append('chat_id', chatId);
        formData.append('text', message);
        
        fetch(CONFIG.telegramProxyUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        }).catch(err => console.warn('Ошибка отправки в Telegram:', err));
    }

    async _saveAlerts() {
        if (this._alerts.length === 0) return;
        
        const promises = this._alerts.map(item => 
            window.db.put('drawings', {
                id: item.alert.id,
                type: 'alert',
                symbolKey: item.alert.symbolKey,
                data: {
                    price: item.alert.price,
                    time: item.alert.time,
                    anchorTime: item.alert.anchorTime,
                    symbol: item.alert.symbol,
                    exchange: item.alert.exchange,
                    marketType: item.alert.marketType,
                    options: item.alert.options,
                    timeframeVisibility: item.alert.timeframeVisibility,
                    triggered: item.alert.triggered,
                    triggerCount: item.alert.triggerCount,
                    repeatCount: item.alert.repeatCount,
                    repeatInterval: item.alert.repeatInterval,
                    lastTriggerTime: item.alert.lastTriggerTime,
                    active: item.alert.active,
                    anchorCandle: item.alert.anchorCandle
                }
            }).catch(e => console.warn('Save alert error:', e))
        );
        
        await Promise.all(promises);
        console.log(`💾 Saved ${this._alerts.length} alerts`);
    }

   async loadAlerts() {
    try {
        await waitForReady([
            () => window.dbReady === true,
            () => this._chartManager?.chartData?.length > 0,
            () => !!(this._chartManager?.candleSeries || this._chartManager?.barSeries)
        ]);

        console.log('📊 Loading ALL alerts from database...');

        // ✅ ЗАГРУЖАЕМ ВСЕ АЛЕРТЫ (без фильтра по symbolKey)
        const allDrawings = await window.db.getAll('drawings');
        const alertRecords = allDrawings.filter(d => d.type === 'alert');
        
        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;

        const newAlerts = [];
        for (const rec of alertRecords) {
            try {
                const alert = new AlertLine(rec.data.price, rec.data.time, rec.data.options);
                alert.id = rec.id;
                alert.symbolKey = rec.symbolKey;
                alert.anchorTime = rec.data.anchorTime || rec.data.time;
                alert.symbol = rec.data.symbol;
                alert.exchange = rec.data.exchange;
                alert.marketType = rec.data.marketType;
                alert.timeframeVisibility = rec.data.timeframeVisibility || {};
                alert.triggered = rec.data.triggered || false;
                alert.triggerCount = rec.data.triggerCount || 0;
                alert.repeatCount = rec.data.repeatCount || 1;
                alert.repeatInterval = rec.data.repeatInterval || 1;
                alert.lastTriggerTime = rec.data.lastTriggerTime || null;
                alert.active = rec.data.active || false;
                alert.anchorCandle = rec.data.anchorCandle || null;

                // ✅ Примитив создаём только для алертов ТЕКУЩЕГО символа (отображаются на графике)
                // и только для не сработавших
                const isCurrentSymbol = rec.symbolKey === this._getCurrentSymbolKey();
                
                if (!alert.triggered && isCurrentSymbol) {
                    const primitive = new AlertLinePrimitive(alert, this._chartManager);
                    series.attachPrimitive(primitive);
                    newAlerts.push({ alert, primitive, series });
                } else {
                    // Алерты других символов или сработавшие — без примитива
                    newAlerts.push({ alert, primitive: null, series: null });
                }
            } catch (e) {
                console.warn('Failed to load alert:', rec.id, e);
            }
        }

        // Удаляем старые примитивы
        this._alerts.forEach(item => {
            try { item.series?.detachPrimitive(item.primitive); } catch(e) {}
        });

        this._alerts = newAlerts;
        
        // Подписываемся на символы ВСЕХ активных алертов
        const activeSymbols = new Set();
        for (const item of this._alerts) {
            if (!item.alert.triggered) {
                activeSymbols.add(item.alert.symbol);
            }
        }
        for (const symbol of activeSymbols) {
            this._subscribeToSymbol(symbol);
        }
        
        this._updateAlertsListUI();
        this._requestRedraw();
        console.log(`✅ Loaded ${this._alerts.length} alerts (all symbols)`);
    } catch (error) {
        console.error('❌ loadAlerts failed:', error);
    }
}

    _updateAlertsListUI() {
        const content = document.getElementById('alertHistoryContent');
        if (!content) return;
        
        const activeAlerts = this._alerts
            .map(a => a.alert)
            .filter(alert => !alert.triggered);
            
        const triggeredAlerts = this._alerts
            .map(a => a.alert)
            .filter(alert => alert.triggered)
            .sort((a, b) => (b.lastTriggerTime || 0) - (a.lastTriggerTime || 0));
        
        const activeTab = document.querySelector('.history-tab.active')?.dataset.tab || 'active';
        
        let html = '';
        
        if (activeTab === 'active') {
            if (activeAlerts.length === 0) {
                html = '<div class="empty-alerts">Нет активных алертов</div>';
            } else {
                html = '<div class="alert-list">';
                activeAlerts.forEach(alert => {
                    const priceFormatted = Utils.formatPrice(alert.price);
                    const color = alert.options.color;
                    
                    html += `
                        <div class="alert-list-item" style="border-left-color: ${color};" data-id="${alert.id}">
                            <div>
                                <div class="price"><span style="color:#FFD700; font-weight:bold;">${alert.symbol}</span> ${priceFormatted}</div>
                                <div class="info">
                                    <span>${alert.repeatCount === Infinity ? '♾️' : alert.repeatCount} × ${alert.repeatInterval} мин</span>
                                    <span>${alert.exchange === 'binance' ? 'B' : 'BY'} ${alert.marketType === 'futures' ? 'F' : 'S'}</span>
                                </div>
                            </div>
                            <div class="actions">
                                <button class="delete-alert" data-id="${alert.id}" title="Удалить"><svg width="16" height="16" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path fill="currentColor" d="M 103.5 0 L 152.5 0 L 160.5 2 L 167 7.5 L 170 13.5 L 170 31 L 207.5 31 L 215.5 33 L 222 38.5 L 225 44.5 L 225 62.5 L 218.5 72 Q 215.7 75.8 210 75 L 209 77.5 L 209 91.5 L 208 92.5 L 208 106.5 L 207 107.5 L 207 121.5 L 206 122.5 L 206 136.5 L 205 137.5 L 205 151.5 L 204 152.5 L 204 166.5 L 203 167.5 L 203 182.5 L 202 183.5 L 201 206.5 Q 199.2 216.2 192.5 221 L 185 224 Q 187.3 243.5 176.5 251 L 171.5 254 L 162.5 256 L 93.5 256 L 82.5 253 L 75 246.5 Q 69.1 238.6 71 224 Q 62.9 223.2 59 216.5 L 56 210.5 L 55 198.5 L 54 197.5 L 54 183.5 L 53 182.5 L 53 167.5 L 52 166.5 L 52 152.5 L 51 151.5 L 51 137.5 L 50 136.5 L 50 122.5 L 49 121.5 L 49 107.5 L 48 106.5 L 48 92.5 L 47 91.5 L 47 77.5 L 46 75 Q 37.7 74.7 34 68.5 L 31 62.5 L 31 44.5 L 37.5 35 L 42.5 32 Q 47.3 33.2 48.5 31 L 86 31 L 86 13.5 L 92.5 4 L 97.5 1 Q 102.2 2.3 103.5 0 Z M 100 15 L 100 31 L 156 31 L 156 31 L 156 17 L 155 15 L 100 15 Z M 47 46 L 45 48 L 45 60 L 47 61 L 210 61 L 211 60 L 211 48 L 210 46 L 47 46 Z M 61 76 L 62 105 L 63 106 L 63 121 L 64 122 L 64 136 L 65 137 L 65 151 L 66 152 L 66 166 L 67 167 L 67 181 L 68 182 L 68 196 L 69 197 Q 68 204 70 208 L 74 211 L 183 211 L 187 206 L 189 167 L 190 166 L 190 152 L 191 151 L 191 137 L 192 136 L 192 122 L 193 121 L 193 106 L 194 105 L 194 91 L 195 90 L 195 77 L 195 76 L 61 76 Z M 85 226 L 85 237 L 90 241 L 167 241 L 171 237 L 171 227 L 171 226 L 85 226 Z" /><path fill="currentColor" d="M 88.5 92 Q 96.5 90.5 98 95.5 L 99 98.5 L 99 127.5 L 100 128.5 L 100 157.5 L 101 158.5 L 101 191.5 Q 99.5 196.5 91.5 195 L 87 188.5 L 85 95.5 L 88.5 92 Z" /><path fill="currentColor" d="M 124.5 92 Q 132.3 90.2 134 94.5 L 135 96.5 L 135 190.5 L 131.5 195 Q 123.8 196.8 122 192.5 L 121 190.5 L 121 96.5 L 124.5 92 Z" /><path fill="currentColor" d="M 161.5 92 Q 169.5 90.5 171 95.5 L 169 188.5 L 164.5 195 Q 156.5 196.5 155 191.5 L 157 98.5 L 161.5 92 Z" /></svg></button>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        } else {
            if (triggeredAlerts.length === 0) {
                html = '<div class="empty-alerts">Нет сработавших алертов</div>';
            } else {
                html = '<div class="alert-list">';
                triggeredAlerts.forEach(alert => {
                    const priceFormatted = Utils.formatPrice(alert.price);
                    const color = alert.options.color;
                    const timeStr = alert.lastTriggerTime  
                        ? new Date(alert.lastTriggerTime).toLocaleTimeString()
                        : 'только что';
                    const repeatInfo = alert.triggerCount > 0 ? ` (${alert.triggerCount}/${alert.triggerLimit === Infinity ? '∞' : alert.triggerLimit})` : '';
                    
                    html += `
                        <div class="alert-list-item triggered" style="border-left-color: ${color};" data-id="${alert.id}">
                            <div>
                                <div class="price"><span style="color:#FFD700; font-weight:bold;">${alert.symbol}</span> ${priceFormatted}${repeatInfo}</div>
                                <div class="info">
                                    <span>Сработал: ${timeStr}</span>
                                    <span>${alert.exchange === 'binance' ? 'B' : 'BY'} ${alert.marketType === 'futures' ? 'F' : 'S'}</span>
                                </div>
                            </div>
                            <div class="actions">
                                <button class="delete-alert" data-id="${alert.id}" title="Удалить"><svg width="16" height="16" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path fill="currentColor" d="M 103.5 0 L 152.5 0 L 160.5 2 L 167 7.5 L 170 13.5 L 170 31 L 207.5 31 L 215.5 33 L 222 38.5 L 225 44.5 L 225 62.5 L 218.5 72 Q 215.7 75.8 210 75 L 209 77.5 L 209 91.5 L 208 92.5 L 208 106.5 L 207 107.5 L 207 121.5 L 206 122.5 L 206 136.5 L 205 137.5 L 205 151.5 L 204 152.5 L 204 166.5 L 203 167.5 L 203 182.5 L 202 183.5 L 201 206.5 Q 199.2 216.2 192.5 221 L 185 224 Q 187.3 243.5 176.5 251 L 171.5 254 L 162.5 256 L 93.5 256 L 82.5 253 L 75 246.5 Q 69.1 238.6 71 224 Q 62.9 223.2 59 216.5 L 56 210.5 L 55 198.5 L 54 197.5 L 54 183.5 L 53 182.5 L 53 167.5 L 52 166.5 L 52 152.5 L 51 151.5 L 51 137.5 L 50 136.5 L 50 122.5 L 49 121.5 L 49 107.5 L 48 106.5 L 48 92.5 L 47 91.5 L 47 77.5 L 46 75 Q 37.7 74.7 34 68.5 L 31 62.5 L 31 44.5 L 37.5 35 L 42.5 32 Q 47.3 33.2 48.5 31 L 86 31 L 86 13.5 L 92.5 4 L 97.5 1 Q 102.2 2.3 103.5 0 Z M 100 15 L 100 31 L 156 31 L 156 31 L 156 17 L 155 15 L 100 15 Z M 47 46 L 45 48 L 45 60 L 47 61 L 210 61 L 211 60 L 211 48 L 210 46 L 47 46 Z M 61 76 L 62 105 L 63 106 L 63 121 L 64 122 L 64 136 L 65 137 L 65 151 L 66 152 L 66 166 L 67 167 L 67 181 L 68 182 L 68 196 L 69 197 Q 68 204 70 208 L 74 211 L 183 211 L 187 206 L 189 167 L 190 166 L 190 152 L 191 151 L 191 137 L 192 136 L 192 122 L 193 121 L 193 106 L 194 105 L 194 91 L 195 90 L 195 77 L 195 76 L 61 76 Z M 85 226 L 85 237 L 90 241 L 167 241 L 171 237 L 171 227 L 171 226 L 85 226 Z" /><path fill="currentColor" d="M 88.5 92 Q 96.5 90.5 98 95.5 L 99 98.5 L 99 127.5 L 100 128.5 L 100 157.5 L 101 158.5 L 101 191.5 Q 99.5 196.5 91.5 195 L 87 188.5 L 85 95.5 L 88.5 92 Z" /><path fill="currentColor" d="M 124.5 92 Q 132.3 90.2 134 94.5 L 135 96.5 L 135 190.5 L 131.5 195 Q 123.8 196.8 122 192.5 L 121 190.5 L 121 96.5 L 124.5 92 Z" /><path fill="currentColor" d="M 161.5 92 Q 169.5 90.5 171 95.5 L 169 188.5 L 164.5 195 Q 156.5 196.5 155 191.5 L 157 98.5 L 161.5 92 Z" /></svg></button>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
        }
        
        content.innerHTML = html;
        
        content.querySelectorAll('.delete-alert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.deleteAlert(id);
            });
        });
    }

    _autoLoadAlerts() {
        setTimeout(async () => {
            try {
                if (this._alerts.length > 0) {
                    console.log('📊 Alerts already loaded, skipping auto-load');
                    return;
                }
                
                if (!window.dbReady) {
                    await new Promise(resolve => {
                        const check = () => window.dbReady ? resolve() : setTimeout(check, 50);
                        check();
                    });
                }
                console.log('🚀 Auto-loading alerts...');
                await this.loadAlerts();
                console.log('✅ Alerts loaded');
            } catch (error) {
                console.error('❌ Auto-load alerts failed:', error);
            }
        }, 200);
    }
}
// ========== ТЕКСТ (ИСПРАВЛЕННЫЙ - С ЭКСТРАПОЛЯЦИЕЙ ВРЕМЕНИ) ==========
class TextDrawing {
    constructor(text, time, price, options = {}) {
        this.text = text || 'Текст';
        this.time = time;
        this.price = price;
        this.anchorTime = time; // Якорь - неизменное время свечи
        this.id = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.options = {
            color: options.color || '#FFFFFF',
            bgColor: options.bgColor || '#000000',
            fontSize: options.fontSize || 12,
            bold: options.bold || false,
            opacity: options.opacity !== undefined ? options.opacity : 1,
            bgOpacity: options.bgOpacity !== undefined ? options.bgOpacity : 0.8,
            ...options
        };
        this.anchorCandle = options.anchorCandle || null;
        this.timeframeVisibility = options.timeframeVisibility || {
            '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
            '1h': true, '4h': true, '6h': true, '12h': true,
            '1d': true, '1w': true, '1M': true
        };
        this.selected = false;
        this.hovered = false;
        this.dragging = false;
        this.showDragPoint = false;
        this.attached = false;
        this.dragPointX = 0;
        this.dragPointY = 0;
        this.symbolKey = options.symbolKey || null;
this.symbol = options.symbol || null;
this.exchange = options.exchange || null;
this.marketType = options.marketType || null;
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        if (newOptions.text !== undefined) this.text = newOptions.text;
    }
    
    isVisibleOnTimeframe(timeframe) {
        return this.timeframeVisibility[timeframe] !== false;
    }
}

class TextRenderer {
    constructor(textDrawing, chartManager) {
        this._text = textDrawing;
        this._chartManager = chartManager;
        this._hitArea = null;
        this._dragHitArea = null;
    }

    draw(target) {
        const currentKey = this._chartManager.getCurrentSymbolKey?.();
    if (currentKey && this._text.symbolKey !== currentKey) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const text = this._text;
            const chartManager = this._chartManager;

            const currentTf = chartManager.currentInterval;
            if (!text.isVisibleOnTimeframe(currentTf)) return;

            const xCoordinate = chartManager.timeToCoordinate(text.time);
            const yCoordinate = chartManager.priceToCoordinate(text.price);
            if (xCoordinate === null || yCoordinate === null) return;

            const { position: x } = positionsLine(xCoordinate, scope.horizontalPixelRatio, 1, true);
            const { position: y } = positionsLine(yCoordinate, scope.verticalPixelRatio, 1, true);

            const fontSize = text.options.fontSize * scope.verticalPixelRatio;
            const font = `${text.options.bold ? 'bold ' : ''}${fontSize}px 'Inter', Arial, sans-serif`;
            ctx.font = font;
            const textWidth = ctx.measureText(text.text).width;
            const textHeight = fontSize * 1.2;

            const padding = 8 * scope.horizontalPixelRatio;
            const rectWidth = textWidth + padding * 2;
            const rectHeight = textHeight + padding * 2;
            const rectX = x;
            const rectY = y - rectHeight / 2;

            this._hitArea = { x: rectX, y: rectY, width: rectWidth, height: rectHeight };

            ctx.save();

            let bgColor = text.options.bgColor;
            const bgOpacity = text.options.bgOpacity !== undefined ? text.options.bgOpacity : 0.8;

            const parseHex = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
            };
            const parseRgb = (rgb) => {
                const result = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(rgb);
                return result ? { r: parseInt(result[1], 10), g: parseInt(result[2], 10), b: parseInt(result[3], 10) } : null;
            };

            let parsedBg = parseHex(bgColor) || parseRgb(bgColor);
            let rgbaBg;
            if (parsedBg) {
                rgbaBg = `rgba(${parsedBg.r}, ${parsedBg.g}, ${parsedBg.b}, ${bgOpacity})`;
            } else {
                rgbaBg = bgColor;
            }

            ctx.fillStyle = rgbaBg;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            this._roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 6 * scope.horizontalPixelRatio);
            ctx.fill();

            let textColor = text.options.color;
            const textOpacity = text.options.opacity !== undefined ? text.options.opacity : 1;
            let parsedText = parseHex(textColor) || parseRgb(textColor);
            let rgbaText;
            if (parsedText) {
                rgbaText = `rgba(${parsedText.r}, ${parsedText.g}, ${parsedText.b}, ${textOpacity})`;
            } else {
                rgbaText = textColor;
            }

            ctx.fillStyle = rgbaText;
            ctx.shadowBlur = 0;
            ctx.font = font;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text.text, rectX + padding, rectY + rectHeight / 2);

            if (text.selected || text.hovered || text.dragging) {
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, 6 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = text.options.color;
                ctx.beginPath();
                ctx.arc(x, y, 4 * scope.horizontalPixelRatio, 0, 2 * Math.PI);
                ctx.fill();

                this._dragHitArea = { x: x, y: y, radius: 10 * scope.horizontalPixelRatio };
            }

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

    hitTest(x, y) {
        // ВСЯ область текста теперь возвращает 'drag'
        if (this._hitArea) {
            const inX = x >= this._hitArea.x && x <= this._hitArea.x + this._hitArea.width;
            const inY = y >= this._hitArea.y && y <= this._hitArea.y + this._hitArea.height;
            if (inX && inY) return 'drag';  // ← ИЗМЕНЕНО: было 'label', стало 'drag'
        }
        if (this._dragHitArea) {
            const dx = x - this._dragHitArea.x;
            const dy = y - this._dragHitArea.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < this._dragHitArea.radius) return 'drag';
        }
        return null;
    }
}

class TextPaneView {
    constructor(text, chartManager) {
        this._text = text;
        this._chartManager = chartManager;
        this._renderer = new TextRenderer(text, chartManager);
    }
    renderer() { return this._renderer; }
    zOrder() { return 'top'; }
}

class TextPrimitive {
    constructor(text, chartManager) {
        this._text = text;
        this._chartManager = chartManager;
        this._paneView = new TextPaneView(text, chartManager);
        this._chart = null;
        this._series = null;
        this._requestUpdate = null;
    }
    
    paneViews() { return [this._paneView]; }
    
    attached({ chart, series, requestUpdate }) {
        this._chart = chart;
        this._series = series;
        this._requestUpdate = requestUpdate;
        this._syncTime();
    }
    
    updateAllViews() {
        const oldTime = this._text.time;
        this._syncTime();
        if (this._text.time !== oldTime && this._requestUpdate) {
            this._requestUpdate();
        }
    }
    
    _syncTime() {
        const chartData = this._chartManager.chartData;
        if (!chartData || chartData.length === 0) return;
        
        const anchor = this._text.anchorTime;
        
        let intervalMs = 60 * 60 * 1000;
        if (chartData.length >= 2) intervalMs = chartData[1].time - chartData[0].time;
        
        let newTime = anchor;
        for (let i = 0; i < chartData.length; i++) {
            const start = chartData[i].time;
            const end = start + intervalMs;
            if (anchor >= start && anchor < end) {
                newTime = start;
                break;
            }
        }
        
        if (newTime === anchor && chartData.length) {
            let closest = chartData[0];
            let minDiff = Math.abs(closest.time - anchor);
            for (let i = 1; i < chartData.length; i++) {
                const diff = Math.abs(chartData[i].time - anchor);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = chartData[i];
                }
            }
            newTime = closest.time;
        }
        
        this._text.time = newTime;
    }
    
    getText() { return this._text; }
    
    requestRedraw() { if (this._requestUpdate) this._requestUpdate(); }
}

class TextManager {
    constructor(chartManager) {
        this._texts = [];
        this._chartManager = chartManager;
        this._selectedText = null;
        this._hoveredText = null;
        this._isDrawingMode = false;
        
        this._isDragging = false;
        this._dragText = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragStartPrice = 0;
        this._dragStartTime = 0;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._potentialDrag = null;
        this._dragThreshold = 5;
        this._isLoading = false;
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._setupEventListeners();
        this._setupHotkeys();
        this._autoLoadTexts();
    }
_autoLoadTexts() {
    setTimeout(async () => {
        try {
            if (!window.dbReady) {
                await new Promise(resolve => {
                    const check = () => window.dbReady ? resolve() : setTimeout(check, 50);
                    check();
                });
            }
            console.log('🚀 Auto-loading texts...');
            await this.loadTexts();
            console.log('✅ Texts loaded');
        } catch (error) {
            console.error('❌ Auto-load texts failed:', error);
        }
    }, 200);
}

  _getCurrentSymbolKey() {
        const symbol = this._chartManager.currentSymbol || 'BTCUSDT';
        const exchange = this._chartManager.currentExchange || 'binance';
        const marketType = this._chartManager.currentMarketType || 'futures';
        return `${symbol}:${exchange}:${marketType}`;
    }
    _setupHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this._selectedText) {
                this.deleteText(this._selectedText.id);
                this._selectedText = null;
            }
        });
    }

    _handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        const rect = this._chartManager.chartContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const hit = this.hitTest(x, y);

        if (hit) {
            if (this._selectedText && this._selectedText !== hit.text) {
                this._selectedText.selected = false;
                this._selectedText.showDragPoint = false;
                this._selectedText.attached = false;
            }

            hit.text.selected = true;
            hit.text.showDragPoint = true;
            hit.text.attached = false;

            const textX = this._chartManager.timeToCoordinate(hit.text.time);
            const textY = this._chartManager.priceToCoordinate(hit.text.price);
            if (textX !== null && textY !== null) {
                hit.text.dragPointX = textX;
                hit.text.dragPointY = textY;
            }

            this._selectedText = hit.text;
            this._requestRedraw();

            const menu = document.getElementById('textContextMenu');
            if (menu) {
                document.getElementById('drawingContextMenu').style.display = 'none';
                document.getElementById('trendContextMenu').style.display = 'none';
                document.getElementById('alertContextMenu').style.display = 'none';

                menu.style.display = 'flex';
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';

                const copyBtn = document.getElementById('textContextCopyBtn');
                const newCopyBtn = copyBtn.cloneNode(true);
                copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
                newCopyBtn.onclick = (event) => {
                    event.stopPropagation();
                    navigator.clipboard?.writeText(hit.text.text);
                    menu.style.display = 'none';
                };

                const settingsBtn = document.getElementById('textContextSettingsBtn');
                const newSettingsBtn = settingsBtn.cloneNode(true);
                settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);
                newSettingsBtn.onclick = (event) => {
                    event.stopPropagation();
                    this._showSettings(hit.text);
                    menu.style.display = 'none';
                };

                const deleteBtn = document.getElementById('textContextDeleteBtn');
                const newDeleteBtn = deleteBtn.cloneNode(true);
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.onclick = (event) => {
                    event.stopPropagation();
                    this.deleteText(hit.text.id);
                    menu.style.display = 'none';
                };
            }
        } else {
            const menu = document.getElementById('textContextMenu');
            if (menu) menu.style.display = 'none';
        }
    }

    _setupEventListeners() {
        const container = this._chartManager.chartContainer;

        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = this.hitTest(x, y);

            if (hit) {
                e.preventDefault();
                e.stopPropagation();

                if (this._selectedText && this._selectedText === hit.text) {
                    this._selectedText.selected = false;
                    this._selectedText.showDragPoint = false;
                    this._selectedText.attached = false;
                    this._selectedText = null;
                    this._requestRedraw();
                    return;
                }

                if (this._selectedText) {
                    this._selectedText.selected = false;
                    this._selectedText.showDragPoint = false;
                    this._selectedText.attached = false;
                }

                hit.text.selected = true;
                hit.text.showDragPoint = true;
                hit.text.attached = true;
                this._selectedText = hit.text;

                const textX = this._chartManager.timeToCoordinate(hit.text.time);
                const textY = this._chartManager.priceToCoordinate(hit.text.price);

                if (textX !== null && textY !== null) {
                    hit.text.dragPointX = textX;
                    hit.text.dragPointY = textY;
                }

                this._potentialDrag = {
                    text: hit.text,
                    startX: x,
                    startY: y,
                    startPrice: hit.text.price,
                    startTime: hit.text.time
                };

                this._requestRedraw();
            } else {
                const textMenu = document.getElementById('textContextMenu');
                if (textMenu && textMenu.style.display === 'flex') {
                    const menuRect = textMenu.getBoundingClientRect();
                    const isClickInsideMenu = 
                        e.clientX >= menuRect.left && e.clientX <= menuRect.right &&
                        e.clientY >= menuRect.top && e.clientY <= menuRect.bottom;
                    if (isClickInsideMenu) return;
                }

                if (this._dragText) {
                    this._dragText.selected = false;
                    this._dragText.showDragPoint = false;
                    this._dragText.attached = false;
                    this._dragText = null;
                }
                if (this._selectedText) {
                    this._selectedText.selected = false;
                    this._selectedText.showDragPoint = false;
                    this._selectedText.attached = false;
                    this._selectedText = null;
                }
                
                if (textMenu) textMenu.style.display = 'none';
                this._requestRedraw();
            }
        });

        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this._lastMouseX = x;
            this._lastMouseY = y;

            if (this._potentialDrag && !this._isDragging) {
                const dx = Math.abs(x - this._potentialDrag.startX);
                const dy = Math.abs(y - this._potentialDrag.startY);

                if (dx > this._dragThreshold || dy > this._dragThreshold) {
                    this._isDragging = true;
                    this._dragText = this._potentialDrag.text;
                    this._dragText.dragging = true;

                    this._dragStartX = this._potentialDrag.startX;
                    this._dragStartY = this._potentialDrag.startY;
                    this._dragStartPrice = this._potentialDrag.startPrice;
                    this._dragStartTime = this._potentialDrag.startTime;

                    container.style.cursor = 'grabbing';
                }
            }

            if (this._isDragging && this._dragText) {
                e.preventDefault();
                e.stopPropagation();

                const deltaX = x - this._dragStartX;
                const deltaY = y - this._dragStartY;

                const textX = this._chartManager.timeToCoordinate(this._dragStartTime);
                const textY = this._chartManager.priceToCoordinate(this._dragStartPrice);

                if (textX !== null && textY !== null) {
                    const newX = textX + deltaX;
                    const newY = textY + deltaY;

                    const newPrice = this._chartManager.coordinateToPrice(newY);
                    const newTime = this._getTimeFromCoordinate(newX); // ← ИСПОЛЬЗУЕМ ЭКСТРАПОЛЯЦИЮ

                    if (newPrice !== null) this._dragText.price = newPrice;
                   if (newTime !== null) {
    this._dragText.time = newTime;
    this._dragText.anchorTime = newTime;
}

                    const newTextX = this._chartManager.timeToCoordinate(this._dragText.time);
                    const newTextY = this._chartManager.priceToCoordinate(this._dragText.price);
                    if (newTextX !== null && newTextY !== null) {
                        this._dragText.dragPointX = newTextX;
                        this._dragText.dragPointY = newTextY;
                    }

                    this._requestRedraw();
                }
            } else {
                const hit = this.hitTest(x, y);
                const hitText = hit ? hit.text : null;

                if (hitText) {
                    container.style.cursor = 'grab';
                } else {
                    container.style.cursor = 'crosshair';
                }

                if (this._hoveredText !== hitText) {
                    if (this._hoveredText) this._hoveredText.hovered = false;
                    this._hoveredText = hitText;
                    if (hitText) hitText.hovered = true;
                    this._requestRedraw();
                }
            }
        });

        container.addEventListener('mouseup', (e) => {
            this._potentialDrag = null;

            if (this._isDragging) {
                e.preventDefault();
                e.stopPropagation();

                this._isDragging = false;
                if (this._dragText) {
                    this._dragText.dragging = false;
                    this._dragText.attached = false;
                    
                    this._dragText.anchorTime = this._dragText.time;

                    this._saveTexts();
                    this._dragText = null;
                    this._requestRedraw();
                }

                container.style.cursor = 'crosshair';

                setTimeout(() => {
                    const moveEvent = new MouseEvent('mousemove', {
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    container.dispatchEvent(moveEvent);
                }, 10);
            }
        });

        container.addEventListener('mouseleave', () => {
            if (this._hoveredText) {
                this._hoveredText.hovered = false;
                this._hoveredText = null;
                this._requestRedraw();
            }
            container.style.cursor = 'crosshair';
        });

        container.addEventListener('click', (e) => {
            if (this._isDragging) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (this._isDrawingMode) {
                this._handleChartClick(e);
            }
        });

        container.addEventListener('contextmenu', this._handleContextMenu);

        container.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = this.hitTest(x, y);
            
            if (hit) {
                this.deleteText(hit.text.id);
                if (this._selectedText && this._selectedText.id === hit.text.id) this._selectedText = null;
                if (this._hoveredText && this._hoveredText.id === hit.text.id) this._hoveredText = null;
                this._requestRedraw();
            }
        });
    }

    // ========== НОВЫЙ МЕТОД ДЛЯ ЭКСТРАПОЛЯЦИИ ВРЕМЕНИ ==========
    _getTimeFromCoordinate(x) {
        let time = this._chartManager.coordinateToTime(x);
        if (time !== null) return time;
        
        const data = this._chartManager.chartData;
        if (!data.length) return null;
        
        let intervalMs = 60 * 60 * 1000;
        if (data.length >= 2) intervalMs = data[1].time - data[0].time;
        
        const firstCandle = data[0];
        const lastCandle = data[data.length - 1];
        const firstX = this._chartManager.timeToCoordinate(firstCandle.time);
        const lastX = this._chartManager.timeToCoordinate(lastCandle.time);
        
        if (firstX === null || lastX === null) return null;
        
        if (x > lastX) {
            const deltaX = x - lastX;
            const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
            const deltaTime = deltaX / pixelsPerMs;
            return lastCandle.time + deltaTime;
        }
        
        if (x < firstX) {
            const deltaX = firstX - x;
            const pixelsPerMs = (lastX - firstX) / (lastCandle.time - firstCandle.time);
            const deltaTime = deltaX / pixelsPerMs;
            return firstCandle.time - deltaTime;
        }
        
        return null;
    }

    setDrawingMode(enabled) {
        this._isDrawingMode = enabled;
        const textBtn = document.getElementById('toolText');
        if (textBtn) {
            if (enabled) {
                textBtn.style.background = '#4A90E2';
                textBtn.style.color = '#FFFFFF';
                textBtn.classList.add('active');
            } else {
                textBtn.style.background = '';
                textBtn.style.color = '';
                textBtn.classList.remove('active');
            }
        }
    }
_handleMouseMove(e) {
    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this._lastMouseX = x;
    this._lastMouseY = y;

    if (this._potentialDrag && !this._isDragging) {
        const dx = Math.abs(x - this._potentialDrag.startX);
        const dy = Math.abs(y - this._potentialDrag.startY);

        if (dx > this._dragThreshold || dy > this._dragThreshold) {
            this._isDragging = true;
            this._dragText = this._potentialDrag.text;
            this._dragText.dragging = true;
            this._dragStartX = this._potentialDrag.startX;
            this._dragStartY = this._potentialDrag.startY;
            this._dragStartPrice = this._potentialDrag.startPrice;
            this._dragStartTime = this._potentialDrag.startTime;
            this._chartManager.chartContainer.style.cursor = 'grabbing';
        }
    }

    if (this._isDragging && this._dragText) {
        e.preventDefault();
        e.stopPropagation();

        const deltaX = x - this._dragStartX;
        const deltaY = y - this._dragStartY;

        const textX = this._chartManager.timeToCoordinate(this._dragStartTime);
        const textY = this._chartManager.priceToCoordinate(this._dragStartPrice);

        if (textX !== null && textY !== null) {
            const newX = textX + deltaX;
            const newY = textY + deltaY;

            const newPrice = this._chartManager.coordinateToPrice(newY);
            const newTime = this._getTimeFromCoordinate(newX);

            if (newPrice !== null) this._dragText.price = newPrice;
            if (newTime !== null) {
    this._dragText.time = newTime;
    this._dragText.anchorTime = newTime;  // ДОБАВЬ ЭТУ СТРОКУ
};

            const newTextX = this._chartManager.timeToCoordinate(this._dragText.time);
            const newTextY = this._chartManager.priceToCoordinate(this._dragText.price);
            if (newTextX !== null && newTextY !== null) {
                this._dragText.dragPointX = newTextX;
                this._dragText.dragPointY = newTextY;
            }

            this._requestRedraw();
        }
    } else {
        const hit = this.hitTest(x, y);
        const hitText = hit ? hit.text : null;

        if (hitText) {
            this._chartManager.chartContainer.style.cursor = 'grab';
        } else {
            this._chartManager.chartContainer.style.cursor = 'crosshair';
        }

        if (this._hoveredText !== hitText) {
            if (this._hoveredText) this._hoveredText.hovered = false;
            this._hoveredText = hitText;
            if (hitText) hitText.hovered = true;
            this._requestRedraw();
        }
    }
}
    setMagnetEnabled(enabled) {
        this._magnetEnabled = enabled;
    }

 createText(text, time, price, options = {}) {
    const defaultVisibility = {
        '1m': true, '3m': true, '5m': true, '15m': true, '30m': true,
        '1h': true, '4h': true, '6h': true, '12h': true,
        '1d': true, '1w': true, '1M': true
    };
    const timeframeVisibility = options.timeframeVisibility || defaultVisibility;

    const textDrawing = new TextDrawing(text, time, price, {
        ...options,
        timeframeVisibility
    });
    
    textDrawing.anchorTime = time;

    // ========== ДОБАВИТЬ ЭТИ 4 СТРОКИ ==========
    textDrawing.symbolKey = this._getCurrentSymbolKey();
    textDrawing.symbol = this._chartManager.currentSymbol;
    textDrawing.exchange = this._chartManager.currentExchange;
    textDrawing.marketType = this._chartManager.currentMarketType;
    // ============================================

    const primitive = new TextPrimitive(textDrawing, this._chartManager);
    const series = this._chartManager.currentChartType === 'candle'
        ? this._chartManager.candleSeries
        : this._chartManager.barSeries;
    series.attachPrimitive(primitive);
    this._texts.push({ text: textDrawing, primitive, series });
    this._saveTexts();
    return textDrawing;
}
   deleteText(textId) {
    const index = this._texts.findIndex(t => t.text.id === textId);
    if (index !== -1) {
        const { primitive, series } = this._texts[index];
        
        // ========== ДОБАВИТЬ ==========
        window.db.delete('drawings', textId).catch(e => console.warn(e));
        // ==============================
        
        try { series.detachPrimitive(primitive); } catch (e) {}
        this._texts.splice(index, 1);
        if (this._selectedText && this._selectedText.id === textId) this._selectedText = null;
        if (this._dragText && this._dragText.id === textId) this._dragText = null;
        this._saveTexts();
        this._requestRedraw();
        return true;
    }
    return false;
}

deleteAllTexts() {
    // ========== ДОБАВИТЬ ==========
    for (const item of this._texts) {
        window.db.delete('drawings', item.text.id).catch(e => console.warn(e));
    }
    // ==============================
    
    this._texts.forEach(({ primitive, series }) => {
        try { series.detachPrimitive(primitive); } catch (e) {}
    });
    this._texts = [];
    this._selectedText = null;
    this._dragText = null;
    this._saveTexts();
    this._requestRedraw();
}
    hitTest(x, y) {
        for (const item of this._texts) {
            try {
                const hitType = item.primitive._paneView._renderer.hitTest(x, y);
                if (hitType) return { text: item.text, type: hitType };
            } catch (e) {}
        }
        return null;
    }

    _handleChartClick(event) {
    if (!this._isDrawingMode) return;
    
    const rect = this._chartManager.chartContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    let price = this._chartManager.coordinateToPrice(y);
    let time = this._chartManager.coordinateToTime(x);
    let anchorCandle = null;
    
    if (price === null || time === null) {
        const lastCandle = this._chartManager.getLastCandle();
        if (lastCandle) {
            price = lastCandle.close;
            time = lastCandle.time;
        } else {
            return;
        }
    }
    
    if (this._magnetEnabled) {
        const snapped = this._snapToPrice(price, time);
        price = snapped.price;
        time = snapped.time;
        anchorCandle = snapped.anchorCandle;
    } else {
        const snappedTime = this._findClosestCandleTime(time);
        if (snappedTime) time = snappedTime;
    }
    
    const color = document.getElementById('textCurrentColorBox')?.style.backgroundColor || '#FFFFFF';
    const bgColor = document.getElementById('textBgColorBox')?.style.backgroundColor || '#000000';
    const fontSize = parseInt(document.getElementById('textFontSize')?.value) || 12;
    const bold = document.getElementById('textBold')?.checked || false;
    const opacity = parseInt(document.getElementById('textOpacity')?.value) / 100 || 1;
    const bgOpacity = parseInt(document.getElementById('textBgOpacity')?.value) / 100 || 0.8;
    
    const newText = this.createText('Текст', time, price, {
        color, bgColor, fontSize, bold, opacity, bgOpacity, anchorCandle
    });
    
    console.log('✅ Текст создан на', time, price); // ← добавил отладку
    
    setTimeout(() => {
        this._showSettings(newText);
    }, 100);
    
    this.setDrawingMode(false);
}
    _snapToPrice(price, time) {
        if (!this._chartManager.chartData.length) return { price, time, anchorCandle: null };
        
        const data = this._chartManager.chartData;
        
        let closestCandle = data[0];
        let minTimeDiff = Math.abs(data[0].time - time);
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minTimeDiff) { 
                minTimeDiff = diff; 
                closestCandle = data[i]; 
            }
        }
        
        const priceY = this._chartManager.priceToCoordinate(price);
        const highY = this._chartManager.priceToCoordinate(closestCandle.high);
        const lowY = this._chartManager.priceToCoordinate(closestCandle.low);
        const closeY = this._chartManager.priceToCoordinate(closestCandle.close);
        
        if (priceY === null || highY === null) return { price, time, anchorCandle: null };
        
        const dHighPx = Math.abs(highY - priceY);
        const dLowPx = Math.abs(lowY - priceY);
        const dClosePx = Math.abs(closeY - priceY);
        
        let snappedPrice = price;
        let anchorType = null;
        const MAGNET_THRESHOLD = 150;
        
        const minDistPx = Math.min(dHighPx, dLowPx, dClosePx);
        
        if (minDistPx < MAGNET_THRESHOLD) {
            if (minDistPx === dHighPx) {
                snappedPrice = closestCandle.high;
                anchorType = 'high';
            } else if (minDistPx === dLowPx) {
                snappedPrice = closestCandle.low;
                anchorType = 'low';
            } else {
                snappedPrice = closestCandle.close;
                anchorType = 'close';
            }
        }
        
        return { 
            price: snappedPrice, 
            time: closestCandle.time,
            anchorCandle: {
                time: closestCandle.time,
                type: anchorType,
                price: snappedPrice
            }
        };
    }

    _findClosestCandleTime(time) {
        if (!this._chartManager.chartData.length) return time;
        
        const data = this._chartManager.chartData;
        let closestCandle = data[0];
        let minDiff = Math.abs(data[0].time - time);
        
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(data[i].time - time);
            if (diff < minDiff) {
                minDiff = diff;
                closestCandle = data[i];
            }
        }
        
        return closestCandle.time;
    }

    _showSettings(text) {
        const settings = document.getElementById('textSettings');
        if (!settings) return;
        
        document.getElementById('textCurrentColorBox').style.backgroundColor = text.options.color;
        document.getElementById('textHexInputInline').value = text.options.color;
        document.getElementById('textBgColorBox').style.backgroundColor = text.options.bgColor;
        document.getElementById('textBgHexInput').value = text.options.bgColor;
        document.getElementById('textFontSize').value = text.options.fontSize;
        document.getElementById('textBold').checked = text.options.bold || false;
        document.getElementById('textOpacity').value = Math.round(text.options.opacity * 100);
        document.getElementById('textOpacityValue').textContent = document.getElementById('textOpacity').value + '%';
        document.getElementById('textBgOpacity').value = Math.round(text.options.bgOpacity * 100);
        document.getElementById('textBgOpacityValue').textContent = document.getElementById('textBgOpacity').value + '%';
        document.getElementById('textContentInput').value = text.text;
        
        setTimeout(() => {
            const textarea = document.getElementById('textContentInput');
            if (textarea) {
                textarea.focus();
                textarea.select();
            }
        }, 200);
        
        this._renderColorGrid('textInlineColorsGrid', 'textCurrentColorBox', 'textHexInputInline', text.options.color);
        this._renderColorGrid('textBgColorsGrid', 'textBgColorBox', 'textBgHexInput', text.options.bgColor);
        this._renderTimeframeCheckboxes(text);
        
        settings.style.display = 'block';
        settings.style.left = '50%';
        settings.style.top = '50%';
        settings.style.transform = 'translate(-50%, -50%)';
        
        settings.addEventListener('mousedown', (e) => e.stopPropagation());
        settings.addEventListener('mousemove', (e) => e.stopPropagation());
        settings.addEventListener('mouseup', (e) => e.stopPropagation());
        settings.addEventListener('click', (e) => e.stopPropagation());
        
        let header = settings.querySelector('.settings-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'settings-header';
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #404040;';
            
            const title = document.createElement('span');
            title.textContent = 'Настройки текста';
            title.style.color = '#FFFFFF';
            title.style.fontSize = '14px';
            title.style.fontWeight = 'bold';
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = 'background: transparent; border: none; color: #B0B0B0; font-size: 18px; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px;';
            closeBtn.onmouseover = () => closeBtn.style.background = '#404040';
            closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                settings.style.display = 'none';
            };
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            settings.insertBefore(header, settings.firstChild);
        }
        
        const closeOnOutsideClick = (e) => {
            if (!settings.contains(e.target) && settings.style.display === 'block') {
                settings.style.display = 'none';
                document.removeEventListener('mousedown', closeOnOutsideClick);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('mousedown', closeOnOutsideClick);
        }, 100);
        
        const textPanel = document.getElementById('textEditPanel');
        const stylePanel = document.getElementById('textStylePanel');
        const visibilityPanel = document.getElementById('textVisibilityPanel');
        const tabs = document.querySelectorAll('#textSettings .settings-tab');
        
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.textSettingsTab === 'text') {
                tab.classList.add('active');
            }
        });
        
        if (textPanel) {
            textPanel.classList.add('active');
        }
        if (stylePanel) {
            stylePanel.classList.remove('active');
        }
        if (visibilityPanel) {
            visibilityPanel.classList.remove('active');
        }
        
        tabs.forEach(tab => {
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
        });
        
        document.querySelectorAll('#textSettings .settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#textSettings .settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if (textPanel) textPanel.classList.remove('active');
                if (stylePanel) stylePanel.classList.remove('active');
                if (visibilityPanel) visibilityPanel.classList.remove('active');
                
                if (tab.dataset.textSettingsTab === 'text' && textPanel) {
                    textPanel.classList.add('active');
                } else if (tab.dataset.textSettingsTab === 'style' && stylePanel) {
                    stylePanel.classList.add('active');
                } else if (tab.dataset.textSettingsTab === 'visibility' && visibilityPanel) {
                    visibilityPanel.classList.add('active');
                }
            });
        });
        
        const saveBtn = document.getElementById('textSaveSettings');
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.addEventListener('click', () => {
                text.updateOptions({
                    color: document.getElementById('textCurrentColorBox').style.backgroundColor,
                    bgColor: document.getElementById('textBgColorBox').style.backgroundColor,
                    fontSize: parseInt(document.getElementById('textFontSize').value),
                    bold: document.getElementById('textBold').checked,
                    opacity: parseInt(document.getElementById('textOpacity').value) / 100,
                    bgOpacity: parseInt(document.getElementById('textBgOpacity').value) / 100,
                    text: document.getElementById('textContentInput').value
                });
                this._requestRedraw();
                settings.style.display = 'none';
                this._saveTexts();
            });
        }
        
        const deleteBtn = document.getElementById('textDeleteDrawing');
        if (deleteBtn) {
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            
            newDeleteBtn.addEventListener('click', () => {
                this.deleteText(text.id);
                settings.style.display = 'none';
                this._requestRedraw();
            });
        }
    }

    _renderColorGrid(gridId, colorBoxId, hexInputId, selectedColor) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        
        const colors = [
            '#FFFFFF', '#EF5350', '#26A69A', '#FFA726', '#AB47BC',
            '#5C6BC0', '#66BB6A', '#FF7043', '#7E57C2', '#42A5F5',
            '#EC407A', '#FFCA28', '#8D6E63', '#B0BEC5', '#000000',
            '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
            '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50'
        ];
        
        grid.innerHTML = '';
        
        colors.forEach(color => {
            const square = document.createElement('div');
            square.className = 'color-square';
            square.style.backgroundColor = color;
            if (color === selectedColor) square.classList.add('selected');
            
            square.addEventListener('click', () => {
                document.querySelectorAll(`#${gridId} .color-square`).forEach(s => s.classList.remove('selected'));
                square.classList.add('selected');
                document.getElementById(colorBoxId).style.backgroundColor = color;
                document.getElementById(hexInputId).value = color;
            });
            
            grid.appendChild(square);
        });
        
        const addBtnId = gridId === 'textInlineColorsGrid' ? 'textAddColorInline' : 'textBgAddColor';
        const addBtn = document.getElementById(addBtnId);
        const hexInput = document.getElementById(hexInputId);
        
        if (addBtn && hexInput) {
            addBtn.onclick = () => {
                let hex = hexInput.value.trim();
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[0-9A-F]{6}$/i.test(hex)) {
                    const square = document.createElement('div');
                    square.className = 'color-square';
                    square.style.backgroundColor = hex;
                    
                    square.addEventListener('click', () => {
                        document.querySelectorAll(`#${gridId} .color-square`).forEach(s => s.classList.remove('selected'));
                        square.classList.add('selected');
                        document.getElementById(colorBoxId).style.backgroundColor = hex;
                        hexInput.value = hex;
                    });
                    
                    grid.appendChild(square);
                    
                    document.querySelectorAll(`#${gridId} .color-square`).forEach(s => s.classList.remove('selected'));
                    square.classList.add('selected');
                    document.getElementById(colorBoxId).style.backgroundColor = hex;
                }
            };
        }
    }

    _renderTimeframeCheckboxes(text) {
        const container = document.getElementById('textTimeframeCheckboxList');
        if (!container) return;
        
        const tfLabels = {
            '1m': '1 минута', '3m': '3 минуты', '5m': '5 минут', '15m': '15 минут',
            '30m': '30 минут', '1h': '1 час', '4h': '4 часа', '6h': '6 часов',
            '12h': '12 часов', '1d': '1 день', '1w': '1 неделя', '1M': '1 месяц'
        };
        
        let html = '';
        const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d', '1w', '1M'];
        
        timeframes.forEach(tf => {
            const isChecked = text.timeframeVisibility[tf] !== false;
            const label = tfLabels[tf] || tf;
            
            html += `
                <div class="timeframe-checkbox-item">
                    <input type="checkbox" id="text_tf_${tf}_${text.id}" data-timeframe="${tf}" ${isChecked ? 'checked' : ''}>
                    <label for="text_tf_${tf}_${text.id}">${label}</label>
                    <span class="tf-badge">${tf}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const tf = e.target.dataset.timeframe;
                text.timeframeVisibility[tf] = e.target.checked;
            });
        });
        
        const selectAllBtn = document.getElementById('textSelectAllTimeframes');
        const deselectAllBtn = document.getElementById('textDeselectAllTimeframes');
        
        if (selectAllBtn) {
            const newSelectAll = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode.replaceChild(newSelectAll, selectAllBtn);
            newSelectAll.addEventListener('click', () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                    const tf = cb.dataset.timeframe;
                    text.timeframeVisibility[tf] = true;
                });
            });
        }
        
        if (deselectAllBtn) {
            const newDeselectAll = deselectAllBtn.cloneNode(true);
            deselectAllBtn.parentNode.replaceChild(newDeselectAll, deselectAllBtn);
            newDeselectAll.addEventListener('click', () => {
                container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                    const tf = cb.dataset.timeframe;
                    text.timeframeVisibility[tf] = false;
                });
            });
        }
    }

    _requestRedraw() {
        this._texts.forEach(item => {
            if (item.primitive?.requestRedraw) item.primitive.requestRedraw();
        });
    }

 async _saveTexts() {
    if (this._texts.length === 0) return;

    const promises = this._texts.map(item => 
        window.db.put('drawings', {
            id: item.text.id,
            type: 'text',
            symbolKey: item.text.symbolKey,
            data: {
                text: item.text.text,
                time: item.text.time,
                anchorTime: item.text.anchorTime,
                price: item.text.price,
                options: item.text.options,
                timeframeVisibility: item.text.timeframeVisibility,
                anchorCandle: item.text.anchorCandle,
                symbol: item.text.symbol,
                exchange: item.text.exchange,
                marketType: item.text.marketType
            }
        }).catch(e => console.warn('Save text error:', e))
    );

    await Promise.all(promises);
    console.log(`💾 Saved ${this._texts.length} texts`);
}

async loadTexts() {
    // Блокировка: ждём завершения предыдущей загрузки
    while (this._isLoading) {
        await new Promise(r => setTimeout(r, 50));
    }
    this._isLoading = true;

    try {
        // Ждём готовности БД, данных графика и серии
        await waitForReady([
            () => window.dbReady === true,
            () => this._chartManager?.chartData?.length > 0,
            () => !!(this._chartManager?.candleSeries || this._chartManager?.barSeries)
        ]);

        const currentKey = this._getCurrentSymbolKey();
        console.log('📊 Loading texts for:', currentKey);

        // Загружаем только для текущего символа через индекс
        const allDrawings = await window.db.getByIndex('drawings', 'symbolKey', currentKey);
        const textRecords = allDrawings.filter(d => d.type === 'text');

        const series = this._chartManager.currentChartType === 'candle' 
            ? this._chartManager.candleSeries 
            : this._chartManager.barSeries;

        const newTexts = [];
        for (const rec of textRecords) {
            try {
                const textDrawing = new TextDrawing(rec.data.text, rec.data.time, rec.data.price, rec.data.options);
                textDrawing.id = rec.id;
                textDrawing.symbolKey = rec.symbolKey;
                textDrawing.symbol = rec.data.symbol;
                textDrawing.exchange = rec.data.exchange;
                textDrawing.marketType = rec.data.marketType;
                textDrawing.anchorTime = rec.data.anchorTime || rec.data.time;
                textDrawing.timeframeVisibility = rec.data.timeframeVisibility || {};
                textDrawing.anchorCandle = rec.data.anchorCandle || null;

                const primitive = new TextPrimitive(textDrawing, this._chartManager);
                series.attachPrimitive(primitive);
                newTexts.push({ text: textDrawing, primitive, series });
            } catch (e) {
                console.warn('Failed to load text:', rec.id, e);
            }
        }

        // Удаляем старые примитивы с графика
        this._texts.forEach(item => {
            try { item.series?.detachPrimitive(item.primitive); } catch(e) {}
        });

        this._texts = newTexts;
        this._requestRedraw();
        console.log(`✅ Loaded ${this._texts.length} texts for ${currentKey}`);
    } catch (error) {
        console.error('❌ loadTexts failed:', error);
    } finally {
        this._isLoading = false;
    }
}

    syncWithNewTimeframe() {
        // Ничего не делаем – updateAllViews сам всё обновит
    }
}
// DrawingManagers.js - в самом конце файла

// ========== ГОРЯЧАЯ КЛАВИША ДЛЯ МАГНИТА ==========
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyZ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        
        // Переключаем магнит во всех менеджерах
        const newState = !window.rayManager?._magnetEnabled;
        
        if (window.rayManager) window.rayManager.setMagnetEnabled(newState);
        if (window.trendLineManager) window.trendLineManager.setMagnetEnabled(newState);
        if (window.rulerLineManager) window.rulerLineManager.setMagnetEnabled(newState);
        if (window.alertLineManager) window.alertLineManager.setMagnetEnabled(newState);
        if (window.textManager) window.textManager.setMagnetEnabled(newState);
        
        // Меняем стиль кнопки
        const magnetBtn = document.getElementById('toolMagnet');
        if (magnetBtn) {
            if (newState) {
                magnetBtn.classList.add('magnet-active');
            } else {
                magnetBtn.classList.remove('magnet-active');
            }
        }
        
        console.log(`Магнит ${newState ? 'включён' : 'выключён'}`);
    }
});

if (typeof window !== 'undefined') {
    window.HorizontalRayManager = HorizontalRayManager;
    window.TrendLineManager = TrendLineManager;
    window.RulerLineManager = RulerLineManager;
    window.AlertLineManager = AlertLineManager;
    window.TextManager = TextManager;
}
