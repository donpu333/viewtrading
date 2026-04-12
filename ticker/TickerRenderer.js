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
        
        const scrollTop = container.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight));
        const endIndex = Math.min(startIndex + this.visibleCount + 5, this.totalItems);
        
        let hasUpdates = false;
        
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
                hasUpdates = true;
            }
            if (changeEl && changeEl.textContent !== newChange) {
                changeEl.textContent = newChange;
                changeEl.className = `ticker-change ${ticker.change > 0 ? 'positive' : ticker.change < 0 ? 'negative' : ''}`;
                hasUpdates = true;
            }
            if (volumeEl && volumeEl.textContent !== newVolume) {
                volumeEl.textContent = newVolume;
                hasUpdates = true;
            }
            if (tradesEl && tradesEl.textContent !== newTrades) {
                tradesEl.textContent = newTrades;
                hasUpdates = true;
            }
        }
        
        if (hasUpdates && this.parent.state.sortBy === 'volume') {
            this.parent.filterCache = null;
            this.parent.renderTickerList();
        }
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
    // === ИСПРАВЛЕНО: кэш-ключ зависит от activeTab === 'flags' ===
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

    // === ВАЖНО: ВСЕГДА ОЧИЩАЕМ КОНТЕЙНЕР ===
    container.innerHTML = '';
    this.tickerElements.clear();

    if (this.totalItems === 0) {
        container.style.height = 'auto';
        return;
    }

    container.style.height = (this.totalItems * this.rowHeight) + 'px';
    container.style.position = 'relative';
    container.style.overflowY = 'auto';

    this.renderVisibleTickers();

    if (!this._scrollHandler) {
        this._scrollHandler = () => this.renderVisibleTickers();
        container.addEventListener('scroll', this._scrollHandler);
    }
}
    renderVisibleTickers() {
        const container = document.getElementById('tickerListContainer');
        if (!container || !this.displayedTickers) return;

        const scrollTop = container.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight));
        const endIndex = Math.min(startIndex + this.visibleCount, this.totalItems);
        if (startIndex >= endIndex) return;
        
        const visibleKeys = new Set();
        const fragment = document.createDocumentFragment();

        if (this._firstRender) {
            this._firstRender = false;
        }

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
            
            el.style.top = (i * this.rowHeight) + 'px';
            
            if (!el.parentNode) {
                fragment.appendChild(el);
            }
        }

        if (fragment.children.length > 0) {
            container.appendChild(fragment);
        }

        for (const [key, el] of this.tickerElements.entries()) {
            if (!visibleKeys.has(key) && el.parentNode === container) {
                container.removeChild(el);
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

        const flag = this.parent.state.flags[`${ticker.symbol}:${ticker.exchange}:${ticker.marketType}`] || null;
        const flagHTML = flag ? 
            `<div class="flag flag-${flag}" data-symbol="${ticker.symbol}" data-exchange="${ticker.exchange}" data-market-type="${ticker.marketType}"></div>` : 
            '<div class="flag-placeholder"></div>';

        const isFavorite = this.parent.state.favorites.includes(ticker.symbol) ? 'favorite' : '';

        div.innerHTML = `
            <div class="ticker-name">
                ${flagHTML}
                <span class="symbol-text">${ticker.symbol.replace('USDT', '')}</span>
                <span class="star ${isFavorite}" data-symbol="${ticker.symbol}" title="Избранное">★</span>
            </div>
            <div class="ticker-price ${ticker.change > 0 ? 'positive' : (ticker.change < 0 ? 'negative' : '')}">${this.formatPrice(ticker.price)}</div>
            <div class="ticker-change ${ticker.change > 0 ? 'positive' : (ticker.change < 0 ? 'negative' : '')}">${this.formatChange(ticker.change)}%</div>
            <div class="ticker-volume">${this.formatVolume(ticker.volume)}</div>
            <div class="ticker-trades">${this.formatTrades(ticker)}</div>
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