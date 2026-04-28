class TickerRenderer {
    constructor(parent) {
        this.parent = parent;
        this.rowHeight = 36;
        this.visibleCount = 30;
        this.tickerElements = new Map();
        this.displayedTickers = [];
        this.totalItems = 0;
        this._scrollHandler = null;
        this._renderScheduled = false;
        this._renderRafId = null;
        this._firstRender = true;
    }
    
   updatePriceElements() {
    const container = document.getElementById('tickerListContainer');
    if (!container) return;
    
    const itemsContainer = container.querySelector('.ticker-items-container');
    if (!itemsContainer) return;
    
    const scrollTop = container.scrollTop;
    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight));
    const endIndex = Math.min(startIndex + this.visibleCount + 5, this.totalItems);
    
    for (let i = startIndex; i < endIndex; i++) {
        const ticker = this.displayedTickers[i];
        if (!ticker) continue;
        
        const key = `${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`;
        const el = this.tickerElements.get(key);
        
        if (!el || !el.isConnected) continue;
        
        const priceEl = el.querySelector('.ticker-price');
        const changeEl = el.querySelector('.ticker-change');
        const volumeEl = el.querySelector('.ticker-volume');
        const tradesEl = el.querySelector('.ticker-trades');
        
        const newPrice = this.formatPrice(ticker.price);
        const newChange = this.formatChange(ticker.change) + '%';
        const newVolume = this.formatVolume(ticker.volume);
        const newTrades = this.formatTrades(ticker);
        
        if (priceEl && priceEl.textContent !== newPrice) {
            priceEl.textContent = newPrice;
            priceEl.className = `ticker-price ${ticker.change > 0 ? 'positive' : ticker.change < 0 ? 'negative' : ''}`;
        }
        if (changeEl && changeEl.textContent !== newChange) {
            changeEl.textContent = newChange;
            changeEl.className = `ticker-change ${ticker.change > 0 ? 'positive' : ticker.change < 0 ? 'negative' : ''}`;
        }
        if (volumeEl && volumeEl.textContent !== newVolume) {
            volumeEl.textContent = newVolume;
        }
        if (tradesEl && tradesEl.textContent !== newTrades) {
            tradesEl.textContent = newTrades;
        }
    }
    
    // АВТОМАТИЧЕСКАЯ ПЕРЕСОРТИРОВКА УБРАНА
    // Сортировка по-прежнему работает при клике на заголовок столбца
}
    
    sortTickers(tickers) {
        return [...tickers].sort((a, b) => {
            let result = 0;
            if (this.parent.state.sortBy === 'name') result = a.symbol.localeCompare(b.symbol);
            else if (this.parent.state.sortBy === 'price') result = (a.price || 0) - (b.price || 0);
            else if (this.parent.state.sortBy === 'change') result = (a.change || 0) - (b.change || 0);
            else if (this.parent.state.sortBy === 'volume') result = (a.volume || 0) - (b.volume || 0);
            else if (this.parent.state.sortBy === 'trades') result = (a.trades || 0) - (b.trades || 0);
            return this.parent.state.sortDirection === 'asc' ? result : -result;
        });
    }
    
    getFilteredTickers() {
        const flagPart = this.parent.state.activeTab === 'flags' 
            ? this.parent.state.activeFlagTab 
            : 'none';
        
        const cacheKey = `${this.parent.state.marketFilter}:${this.parent.state.exchangeFilter}:${this.parent.state.activeTab}:${flagPart}:${this.parent.state.sortBy}:${this.parent.state.sortDirection}`;
        
        if (this.parent.filterCache && this.parent.filterCache.key === cacheKey) {
            return this.parent.filterCache.result;
        }
        
        let filtered = [...this.parent.tickers];
        
        if (this.parent.state.marketFilter !== 'all') {
            filtered = filtered.filter(t => t.marketType === this.parent.state.marketFilter);
        }
        if (this.parent.state.exchangeFilter !== 'all') {
            filtered = filtered.filter(t => t.exchange === this.parent.state.exchangeFilter);
        }
        
        if (this.parent.state.activeTab === 'favorites') {
            filtered = filtered.filter(t => this.parent.state.favorites.includes(t.symbol));
        } 
        else if (this.parent.state.activeTab === 'flags') {
            if (this.parent.state.activeFlagTab) {
                filtered = filtered.filter(t => {
                    const key = `${t.symbol}:${t.exchange}:${t.marketType}`;
                    return this.parent.state.flags[key] === this.parent.state.activeFlagTab;
                });
            } else {
                filtered = filtered.filter(t => {
                    const key = `${t.symbol}:${t.exchange}:${t.marketType}`;
                    return this.parent.state.flags[key] !== undefined;
                });
            }
        }
        
        const result = this.sortTickers(filtered);
        
        this.parent.filterCache = {
            key: cacheKey,
            result: result
        };
        
        return result;
    }
    
    renderTickerList() {
        const flagTabs = document.getElementById('flagTabs');
        if (flagTabs) {
            if (this.parent.state.activeTab === 'flags') {
                flagTabs.classList.add('show');
            } else {
                flagTabs.classList.remove('show');
            }
        }

        const container = document.getElementById('tickerListContainer');
        if (!container) return;

        const displayed = this.getFilteredTickers();
        this.displayedTickers = displayed;
        this.totalItems = displayed.length;

        // Очищаем контейнер, сохраняя обработчики
        if (this._scrollHandler) {
            container.removeEventListener('scroll', this._scrollHandler);
        }
        
        // Очищаем только элементы, не трогая сам контейнер
        const spacer = container.querySelector('.ticker-spacer');
        if (spacer) spacer.remove();
        
        const itemsContainer = container.querySelector('.ticker-items-container');
        if (itemsContainer) itemsContainer.remove();
        
        this.tickerElements.clear();

        if (this.totalItems === 0) {
            container.style.height = 'auto';
            return;
        }

        // Не устанавливаем высоту контейнера, используем спейсер
        container.style.position = 'relative';
        container.style.overflowY = 'auto';
        
        // Создаем спейсер для прокрутки
        const newSpacer = document.createElement('div');
        newSpacer.className = 'ticker-spacer';
        newSpacer.style.height = (this.totalItems * this.rowHeight) + 'px';
        newSpacer.style.width = '100%';
        newSpacer.style.pointerEvents = 'none';
        container.appendChild(newSpacer);
        
        // Создаем контейнер для элементов
        const newItemsContainer = document.createElement('div');
        newItemsContainer.className = 'ticker-items-container';
        newItemsContainer.style.position = 'absolute';
        newItemsContainer.style.top = '0';
        newItemsContainer.style.left = '0';
        newItemsContainer.style.right = '0';
        container.appendChild(newItemsContainer);
        
        // Рендерим видимые элементы
        this.renderVisibleTickers();

        // Добавляем обработчик скролла
        this._scrollHandler = () => {
            this.renderVisibleTickers();
        };
        container.addEventListener('scroll', this._scrollHandler);
    }
    
   renderVisibleTickers() {
    const container = document.getElementById('tickerListContainer');
    if (!container || !this.displayedTickers || this.totalItems === 0) return;
    
    const itemsContainer = container.querySelector('.ticker-items-container');
    if (!itemsContainer) return;
    
    const scrollTop = container.scrollTop;
    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight));
    const endIndex = Math.min(startIndex + this.visibleCount + 10, this.totalItems);
    
    if (startIndex >= endIndex) return;
    
    const visibleKeys = new Set();
    
    for (let i = startIndex; i < endIndex; i++) {
        const ticker = this.displayedTickers[i];
        if (!ticker) continue;
        
        const key = `${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`;
        visibleKeys.add(key);
        
        let el = this.tickerElements.get(key);
        if (!el) {
            el = this.createTickerElement(ticker, i);
            this.tickerElements.set(key, el);
        }
        
        // Обновляем позицию
        el.style.position = 'absolute';
        el.style.top = (i * this.rowHeight) + 'px';
        el.style.left = '0';
        el.style.right = '0';
        el.style.width = '100%';
        el.style.display = ''; // ПОКАЗЫВАЕМ
        
        // Обновляем содержимое (цена могла измениться)
        const priceEl = el.querySelector('.ticker-price');
        const changeEl = el.querySelector('.ticker-change');
        const volumeEl = el.querySelector('.ticker-volume');
        
        if (priceEl) priceEl.textContent = this.formatPrice(ticker.price);
        if (changeEl) {
            changeEl.textContent = this.formatChange(ticker.change) + '%';
            changeEl.className = `ticker-change ${ticker.change > 0 ? 'positive' : ticker.change < 0 ? 'negative' : ''}`;
        }
        if (volumeEl) volumeEl.textContent = this.formatVolume(ticker.volume);
        
        if (!el.parentNode) {
            itemsContainer.appendChild(el);
        }
    }
    
    // СКРЫВАЕМ невидимые элементы (НЕ УДАЛЯЕМ!)
    for (const [key, el] of this.tickerElements.entries()) {
        if (!visibleKeys.has(key)) {
            el.style.display = 'none'; // СКРЫВАЕМ вместо удаления
        }
    }
}
    
   createTickerElement(ticker, index) {
    const div = document.createElement('div');
    div.className = `ticker-item ${ticker.symbol === this.parent.state.currentSymbol && 
        ticker.exchange === this.parent.state.currentExchange && 
        ticker.marketType === this.parent.state.currentMarketType ? 'active' : ''}`;
    div.dataset.symbol = ticker.symbol;
    div.dataset.exchange = ticker.exchange;
    div.dataset.marketType = ticker.marketType;
    div.style.display = 'grid';
    div.style.gridTemplateColumns = '1.3fr 1fr 0.7fr 0.8fr 0.7fr';
    div.style.alignItems = 'center';
    div.style.gap = '4px';
    div.style.padding = '6px 8px';
    div.style.minHeight = '36px';
    div.style.borderBottom = '1px solid #2B3139';

    const flag = this.parent.state.flags[`${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`] || null;
    const flagHTML = flag ? 
        `<div class="flag flag-${flag}"></div>` : 
        '<div class="flag-placeholder"></div>';

    const isFavorite = this.parent.state.favorites.includes(ticker.symbol) ? 'favorite' : '';
    const markerLetter = ticker.marketType === 'futures' ? 'F' : 'S';
    const markerClass = ticker.marketType === 'futures' ? 'futures' : 'spot';
    
    let displayName = ticker.symbol.replace('USDT', '');
    const match = displayName.match(/^(\d+)([A-Z]+)$/);
    if (match) displayName = '1' + match[2];
    else if (displayName.length > 8) displayName = displayName.substring(0, 7) + '…';

    const priceClass = ticker.change > 0 ? 'positive' : (ticker.change < 0 ? 'negative' : '');

    div.innerHTML = `
        <div class="ticker-name" style="display:flex;align-items:center;gap:4px;overflow:hidden;">
            ${flagHTML}
            <sup class="market-sup ${markerClass}" style="font-size:7px;font-weight:bold;margin-right:2px;flex-shrink:0;">${markerLetter}</sup>
            <span class="symbol-text" title="${ticker.symbol}" style="font-size:0.75rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">${displayName}</span>
            <span class="star ${isFavorite}" data-symbol="${ticker.symbol}" title="Избранное" style="flex-shrink:0;margin-left:2px;">★</span>
        </div>
        <div class="ticker-price ${priceClass}" style="text-align:right;white-space:nowrap;font-size:0.7rem;font-family:monospace;">${this.formatPrice(ticker.price)}</div>
        <div class="ticker-change ${priceClass}" style="text-align:right;white-space:nowrap;font-size:0.7rem;font-family:monospace;">${this.formatChange(ticker.change)}%</div>
        <div class="ticker-volume" style="text-align:right;white-space:nowrap;font-size:0.7rem;font-family:monospace;">${this.formatVolume(ticker.volume)}</div>
        <div class="ticker-trades" style="text-align:right;white-space:nowrap;font-size:0.7rem;font-family:monospace;">${this.formatTrades(ticker)}</div>
    `;

    return div;
}
    
    formatPrice(price) {
        if (!price || price <= 0) return '...';
        
        const now = Date.now();
        const cached = this.parent.formatCache.prices.get(price);
        
        if (cached && (now - cached.timestamp) < this.parent.cacheMaxAge) {
            return cached.value;
        }
        
        let result;
        if (price < 0.00000001) {
            result = price.toExponential(4);
        } else if (price < 0.0001) {
            result = price.toFixed(8);
        } else if (price < 0.001) {
            result = price.toFixed(6);
        } else if (price < 0.01) {
            result = price.toFixed(5);
        } else if (price < 0.1) {
            result = price.toFixed(4);
        } else if (price < 1) {
            result = price.toFixed(3);
        } else if (price < 1000) {
            result = price.toFixed(2);
        } else {
            result = price.toFixed(2);
        }
        
        this.parent.formatCache.prices.set(price, { value: result, timestamp: now });
        
        if (this.parent.formatCache.prices.size > 500) {
            const oldestKey = this.parent.formatCache.prices.keys().next().value;
            this.parent.formatCache.prices.delete(oldestKey);
        }
        
        return result;
    }
    
    formatChange(change) {
        if (change === undefined || change === null) return '0.00';
        
        const now = Date.now();
        const cached = this.parent.formatCache.changes.get(change);
        
        if (cached && (now - cached.timestamp) < this.parent.cacheMaxAge) {
            return cached.value;
        }
        
        const result = (change > 0 ? '+' : '') + change.toFixed(2);
        
        this.parent.formatCache.changes.set(change, { value: result, timestamp: now });
        
        if (this.parent.formatCache.changes.size > 500) {
            const oldestKey = this.parent.formatCache.changes.keys().next().value;
            this.parent.formatCache.changes.delete(oldestKey);
        }
        
        return result;
    }
    
    formatVolume(volume) {
        if (!volume || volume === 0) return '0';
        
        const now = Date.now();
        const cached = this.parent.formatCache.volumes.get(volume);
        
        if (cached && (now - cached.timestamp) < this.parent.cacheMaxAge) {
            return cached.value;
        }
        
        let result;
        if (volume >= 1e9) result = (volume / 1e9).toFixed(2) + 'B';
        else if (volume >= 1e6) result = (volume / 1e6).toFixed(2) + 'M';
        else if (volume >= 1e3) result = (volume / 1e3).toFixed(2) + 'K';
        else if (volume < 1) result = volume.toFixed(4);
        else result = volume.toFixed(2);
        
        this.parent.formatCache.volumes.set(volume, { value: result, timestamp: now });
        
        if (this.parent.formatCache.volumes.size > 500) {
            const oldestKey = this.parent.formatCache.volumes.keys().next().value;
            this.parent.formatCache.volumes.delete(oldestKey);
        }
        
        return result;
    }
    
    formatTrades(ticker) {
        if (ticker.exchange !== 'binance' || !ticker.trades || ticker.trades <= 0) return '—';
        if (ticker.trades > 1e9) return (ticker.trades / 1e9).toFixed(1) + 'B';
        if (ticker.trades > 1e6) return (ticker.trades / 1e6).toFixed(1) + 'M';
        if (ticker.trades > 1e3) return (ticker.trades / 1e3).toFixed(1) + 'K';
        return ticker.trades.toString();
    }
    
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            for (const [key, value] of this.parent.formatCache.prices) {
                if (now - value.timestamp > this.parent.cacheMaxAge) {
                    this.parent.formatCache.prices.delete(key);
                }
            }
            
            for (const [key, value] of this.parent.formatCache.changes) {
                if (now - value.timestamp > this.parent.cacheMaxAge) {
                    this.parent.formatCache.changes.delete(key);
                }
            }
            
            for (const [key, value] of this.parent.formatCache.volumes) {
                if (now - value.timestamp > this.parent.cacheMaxAge) {
                    this.parent.formatCache.volumes.delete(key);
                }
            }
        }, 30000);
    }
    
    setupHeaderSorting() {
        if (this.parent._sortClickHandler) {
            document.querySelectorAll('.table-header span[data-sort]').forEach(header => {
                header.removeEventListener('click', this.parent._sortClickHandler);
            });
        }
        
        this.parent._sortClickHandler = (e) => {
            e.stopPropagation();
            
            const header = e.currentTarget;
            const sortBy = header.dataset.sort;
            
            if (this.parent.state.sortBy === sortBy) {
                this.parent.state.sortDirection = this.parent.state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.parent.state.sortBy = sortBy;
                this.parent.state.sortDirection = 'desc';
            }
            
            document.querySelectorAll('.table-header span[data-sort] i').forEach(icon => {
                icon.className = 'fas fa-sort';
            });
            
            const icon = header.querySelector('i');
            if (icon) {
                icon.className = this.parent.state.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
            
            this.parent.filterCache = null;
            this.parent.renderTickerList();
        };
        
        document.querySelectorAll('.table-header span[data-sort]').forEach(header => {
            header.addEventListener('click', this.parent._sortClickHandler);
        });
    }
}

if (typeof window !== 'undefined') {
    window.TickerRenderer = TickerRenderer;
}