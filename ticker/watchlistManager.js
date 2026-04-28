class WatchlistManager {
    constructor(tickerPanel) {
        this.tickerPanel = tickerPanel;
        this.lists = new Map();
        this.activeListId = 'default';
        this.listOrder = ['default'];
        this.renderCache = new Map();
        this._dropdownOpen = false;
        this._loaded = false;
        this._saveDebounceTimer = null;
        this._dbReady = false;
        this._initPromise = this._waitForDBAndLoad();
    }

    async _waitForDBAndLoad() {
        // Ждём готовности IndexedDB
        if (!window.db || !window.dbReady) {
            console.log('⏳ WatchlistManager: жду IndexedDB...');
            await new Promise((resolve) => {
                const check = setInterval(() => {
                    if (window.db && window.dbReady) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
                setTimeout(() => { clearInterval(check); resolve(); }, 10000);
            });
        }
        this._dbReady = !!(window.db && window.dbReady);
        console.log('📋 WatchlistManager: IndexedDB ' + (this._dbReady ? 'готова' : 'недоступна, использую localStorage'));
        await this._loadFromStorage();
    }

    async _loadFromStorage() {
        try {
            let saved = null;
            
            if (this._dbReady) {
                try {
                    const data = await window.db.get('settings', 'watchlists');
                    if (data?.value) {
                        saved = data.value;
                        console.log('📋 Вотчлисты загружены из IndexedDB');
                    }
                } catch (e) {
                    console.warn('⚠️ Ошибка чтения IndexedDB:', e);
                }
            }
            
            if (!saved) {
                const localData = localStorage.getItem('watchlists');
                if (localData) {
                    saved = JSON.parse(localData);
                    console.log('📋 Вотчлисты загружены из localStorage (fallback)');
                }
            }
            
            if (saved?.lists) {
                this.lists = new Map(Object.entries(saved.lists));
                this.listOrder = saved.listOrder || ['default'];
                this.activeListId = saved.activeListId || 'default';
            }
        } catch (e) {
            console.warn('⚠️ Ошибка загрузки вотчлистов:', e);
        }

        if (!this.lists.has('default')) {
            this.lists.set('default', {
                name: 'Основной',
                symbols: [],
                isDefault: true
            });
        }
        if (!this.lists.has(this.activeListId)) {
            this.activeListId = 'default';
        }

        const activeList = this.lists.get(this.activeListId);
        if (this.tickerPanel.state.customSymbols.length > 0) {
            activeList.symbols = [...this.tickerPanel.state.customSymbols];
        } else if (activeList && activeList.symbols.length > 0) {
            this.tickerPanel.state.customSymbols = [...activeList.symbols];
        }

        this._loaded = true;
    }

    async _saveToDB(data) {
        if (this._dbReady && window.db) {
            try {
                await window.db.put('settings', {
                    key: 'watchlists',
                    value: data,
                    timestamp: Date.now()
                });
                console.log('📋 Вотчлисты сохранены в IndexedDB');
                return true;
            } catch (e) {
                console.error('❌ Ошибка сохранения в IndexedDB:', e);
            }
        }
        // Fallback на localStorage
        localStorage.setItem('watchlists', JSON.stringify(data));
        console.log('📋 Вотчлисты сохранены в localStorage');
        return false;
    }

    saveToStorage() {
        if (this._saveDebounceTimer) clearTimeout(this._saveDebounceTimer);
        this._saveDebounceTimer = setTimeout(() => this._saveNow(), 300);
    }

    saveToStorageImmediate() {
        if (this._saveDebounceTimer) clearTimeout(this._saveDebounceTimer);
        this._saveNow();
    }

    async _saveNow() {
        if (!this._loaded) return;
        const data = {
            lists: Object.fromEntries(this.lists),
            listOrder: this.listOrder,
            activeListId: this.activeListId
        };
        await this._saveToDB(data);
    }

    // ========== СИНХРОНИЗАЦИЯ ==========

    async syncActiveListFromPanel() {
        await this._initPromise; // ждём загрузки
        const list = this.lists.get(this.activeListId);
        if (!list) return;
        const panelSymbols = this.tickerPanel.state.customSymbols;
        if (JSON.stringify(list.symbols) !== JSON.stringify(panelSymbols)) {
            list.symbols = [...panelSymbols];
            this.renderCache.delete(this.activeListId);
            await this._saveNow();
            this.renderDropdown();
            console.log('🔄 Вотчлист синхронизирован с панелью');
        }
    }

    // ========== CRUD СПИСКОВ ==========

    async createList(name) {
        await this._initPromise;
        const id = `wl_${Date.now()}`;
        this.lists.set(id, {
            name: name || `Список ${this.lists.size}`,
            symbols: [],
            isDefault: false
        });
        this.listOrder.push(id);
        this.renderCache.delete(id);
        this.saveToStorage();
        this.renderDropdown();
        return id;
    }

    async deleteList(listId) {
        await this._initPromise;
        if (listId === 'default') return false;
        if (!this.lists.has(listId)) return false;

        this.lists.delete(listId);
        this.listOrder = this.listOrder.filter(id => id !== listId);
        this.renderCache.delete(listId);

        if (this.activeListId === listId) {
            await this.activateList('default');
        }

        this.saveToStorage();
        this.renderDropdown();
        return true;
    }

    async renameList(listId, newName) {
        await this._initPromise;
        const list = this.lists.get(listId);
        if (!list) return false;
        list.name = newName;
        this.renderCache.delete(listId);
        this.saveToStorage();
        this.renderDropdown();
        return true;
    }

    // ========== АКТИВАЦИЯ ==========

    async activateList(listId) {
        await this._initPromise;
        if (!this.lists.has(listId)) return;
        if (this.activeListId === listId) {
            this.closeDropdown();
            return;
        }

        const oldList = this.lists.get(this.activeListId);
        if (oldList) {
            oldList.symbols = [...this.tickerPanel.state.customSymbols];
            this.renderCache.delete(this.activeListId);
        }

        this.activeListId = listId;
        this.saveToStorageImmediate();

        // Очистка панели
        this.tickerPanel.tickers = [];
        this.tickerPanel.tickersMap.clear();
        this.tickerPanel.state.customSymbols = [];
        this.tickerPanel.state.favorites = [];
        this.tickerPanel.state.flags = {};
        this.tickerPanel.tickerElements.clear();
        this.tickerPanel.displayedTickers = [];
        this.tickerPanel.totalItems = 0;
        this.tickerPanel.filterCache = null;

        const container = document.getElementById('tickerListContainer');
        if (container) {
            container.innerHTML = '';
            container.style.height = 'auto';
            container.scrollTop = 0;
        }

        const newList = this.lists.get(listId);
        if (newList && newList.symbols.length > 0) {
            this.tickerPanel.state.customSymbols = [...newList.symbols];
            newList.symbols.forEach(symbolKey => {
                const parts = symbolKey.split(':');
                if (parts.length === 3) {
                    const [symbol, exchange, marketType] = parts;
                    this.tickerPanel.addSymbol(symbol, true, exchange, marketType, false, true, true);
                }
            });
        }

        this.tickerPanel.renderTickerList();
        this.tickerPanel.updateModalCount();
        this.renderDropdown();
        this.fetchPricesForActiveList();
        this.closeDropdown();
    }

    // ========== УПРАВЛЕНИЕ СИМВОЛАМИ ==========

    async addSymbolToActiveList(symbol, exchange, marketType) {
        await this._initPromise;
        const list = this.lists.get(this.activeListId);
        if (!list) return;
        const key = `${symbol}:${exchange}:${marketType}`;
        if (!list.symbols.includes(key)) {
            list.symbols.push(key);
            this.renderCache.delete(this.activeListId);
            this.saveToStorage();
            this.renderDropdown();
        }
    }

    // ========== ДОБАВЛЕНИЕ В ЛЮБОЙ СПИСОК ==========

async addSymbolToList(listId, symbol, exchange, marketType) {
    await this._initPromise;
    const list = this.lists.get(listId);
    if (!list) return false;
    
    const key = `${symbol}:${exchange}:${marketType}`;
    if (!list.symbols.includes(key)) {
        list.symbols.push(key);
        this.renderCache.delete(listId);
        this.saveToStorage();
        this.renderDropdown();
        
        // Если добавляем в активный список — сразу добавляем на панель
        if (listId === this.activeListId) {
            this.tickerPanel.addSymbol(symbol, true, exchange, marketType, true, false, true);
            this.fetchPricesForActiveList();
        }
        
        return true;
    }
    return false;
}


    async removeSymbolFromActiveList(symbol, exchange, marketType) {
        await this._initPromise;
        const list = this.lists.get(this.activeListId);
        if (!list) return;
        const key = `${symbol}:${exchange}:${marketType}`;
        const before = list.symbols.length;
        list.symbols = list.symbols.filter(s => s !== key);
        if (list.symbols.length !== before) {
            this.renderCache.delete(this.activeListId);
            this.saveToStorage();
            this.renderDropdown();
        }
    }

    async clearActiveList() {
        await this._initPromise;
        const list = this.lists.get(this.activeListId);
        if (!list) return;
        list.symbols = [];
        this.renderCache.delete(this.activeListId);
        this.saveToStorage();
        this.renderDropdown();
    }

    // ========== РЕНДЕР ДРОПДАУНА ==========

    renderDropdown() {
        const container = document.getElementById('watchlistDropdown');
        if (!container) {
            this.createDropdownContainer();
            return;
        }

        const activeList = this.lists.get(this.activeListId);
        const listName = activeList ? activeList.name : 'Списки';
        const itemCount = activeList ? activeList.symbols.length : 0;

        const btnText = container.querySelector('.wl-btn-text');
        const btnCount = container.querySelector('.wl-btn-count');
        if (btnText) btnText.textContent = this.escapeHtml(listName);
        if (btnCount) btnCount.textContent = itemCount;

        if (!this._dropdownOpen) return;

        const dropdown = container.querySelector('.wl-dropdown-menu');
        if (dropdown) {
            let html = '';
            this.listOrder.forEach(listId => {
                const list = this.lists.get(listId);
                if (!list) return;
                const isActive = listId === this.activeListId;
                html += `
                    <div class="wl-dropdown-item ${isActive ? 'active' : ''}" data-list-id="${listId}">
                       <span class="wl-item-icon">${isActive ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color:#4caf50;"><path d="m17,15c-4.188,0-6.33,3.499-6.849,4.5.52,1.001,2.661,4.5,6.849,4.5s6.33-3.499,6.849-4.5c-.52-1.001-2.661-4.5-6.849-4.5Zm0,8c-3.302,0-5.033-2.288-5.717-3.5.685-1.212,2.415-3.5,5.717-3.5s5.033,2.288,5.717,3.5c-.685,1.212-2.415,3.5-5.717,3.5Zm-8-12.5h11v1h-11v-1Zm8,7c-1.103,0-2,.897-2,2s.897,2,2,2,2-.897,2-2-.897-2-2-2Zm0,3c-.551,0-1-.448-1-1s.449-1,1-1,1,.448,1,1-.449,1-1,1ZM6,5.5c0,.552-.448,1-1,1s-1-.448-1-1,.448-1,1-1,1,.448,1,1Zm0,5.5c0,.552-.448,1-1,1s-1-.448-1-1,.448-1,1-1,1,.448,1,1Zm14-5h-11v-1h11v1Zm-14,10.5c0,.552-.448,1-1,1s-1-.448-1-1,.448-1,1-1,1,.448,1,1ZM24,2.5v13.684c-.292-.327-.624-.66-1-.981V2.5c0-.827-.673-1.5-1.5-1.5H2.5c-.827,0-1.5.673-1.5,1.5v18.5h7.686c.161.279.377.624.653,1H0V2.5C0,1.122,1.122,0,2.5,0h19c1.378,0,2.5,1.122,2.5,2.5Z"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.5;"><path d="M17.5,24H6.5c-2.481,0-4.5-2.019-4.5-4.5V4.5C2,2.019,4.019,0,6.5,0h11c2.481,0,4.5,2.019,4.5,4.5v15c0,2.481-2.019,4.5-4.5,4.5ZM6.5,1c-1.93,0-3.5,1.57-3.5,3.5v15c0,1.93,1.57,3.5,3.5,3.5h11c1.93,0,3.5-1.57,3.5-3.5V4.5c0-1.93-1.57-3.5-3.5-3.5H6.5Zm11.5,4.5c0-.276-.224-.5-.5-.5h-6c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5h6c.276,0,.5-.224,.5-.5Zm0,6c0-.276-.224-.5-.5-.5h-6c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5h6c.276,0,.5-.224,.5-.5Zm0,6c0-.276-.224-.5-.5-.5h-6c-.276,0-.5,.224-.5,.5s.224,.5,.5,.5h6c.276,0,.5-.224,.5-.5ZM8.5,7h-2c-.276,0-.5-.224-.5-.5v-2c0-.276,.224-.5,.5-.5h2c.276,0,.5,.224,.5,.5v2c0,.276-.224,.5-.5,.5Zm-1.5-1h1v-1h-1v1Zm1.5,7h-2c-.276,0-.5-.224-.5-.5v-2c0-.276,.224-.5,.5-.5h2c.276,0,.5,.224,.5,.5v2c0,.276-.224,.5-.5,.5Zm-1.5-1h1v-1h-1v1Zm1.5,7h-2c-.276,0-.5-.224-.5-.5v-2c0-.276,.224-.5,.5-.5h2c.276,0,.5,.224,.5,.5v2c0,.276-.224,.5-.5,.5Zm-1.5-1h1v-1h-1v1Z"/></svg>'}</span>
                        <span class="wl-item-name">${this.escapeHtml(list.name)}</span>
                        <span class="wl-item-count">${list.symbols.length}</span>
                        <span class="wl-item-actions">
                            ${!list.isDefault ? `<span class="wl-item-edit" data-action="edit" title="Переименовать">✎</span>` : ''}
                            ${!list.isDefault ? `<span class="wl-item-delete" data-action="delete" title="Удалить">×</span>` : ''}
                        </span>
                    </div>
                `;
            });

            html += `
                <div class="wl-dropdown-divider"></div>
                <div class="wl-dropdown-item wl-add-item" data-action="add">
                    <span class="wl-item-icon">+</span>
                    <span class="wl-item-name">Создать новый список</span>
                </div>
            `;

            dropdown.innerHTML = html;

            dropdown.querySelectorAll('.wl-dropdown-item[data-list-id]').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('[data-action="edit"]')) {
                        e.stopPropagation();
                        this.editListPrompt(item.dataset.listId);
                        return;
                    }
                    if (e.target.closest('[data-action="delete"]')) {
                        e.stopPropagation();
                        this.deleteListPrompt(item.dataset.listId);
                        return;
                    }
                    this.activateList(item.dataset.listId);
                });
            });

            const addBtn = dropdown.querySelector('[data-action="add"]');
            if (addBtn) addBtn.addEventListener('click', () => this.createListPrompt());
        }
    }

    createDropdownContainer() {
        const tickerPanel = document.getElementById('tickerPanel');
        let container = document.getElementById('watchlistDropdown');
        if (!container) {
            container = document.createElement('div');
            container.id = 'watchlistDropdown';
            container.className = 'wl-dropdown-container';
            container.innerHTML = `
                <div class="wl-dropdown-btn">
                    <span class="wl-btn-text">Основной</span>
                    <span class="wl-btn-count">0</span>
                    <svg class="wl-btn-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="wl-dropdown-menu"></div>
            `;
            const tabsContainer = tickerPanel?.querySelector('.tabs-container');
            if (tabsContainer) {
                tabsContainer.parentNode.insertBefore(container, tabsContainer);
            } else {
                tickerPanel?.insertBefore(container, tickerPanel.firstChild);
            }
            this.bindDropdownEvents(container);
        }
        this.renderDropdown();
    }

    bindDropdownEvents(container) {
        container.querySelector('.wl-dropdown-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) this.closeDropdown();
        });
    }

    toggleDropdown() {
        const container = document.getElementById('watchlistDropdown');
        if (!container) return;
        this._dropdownOpen = !this._dropdownOpen;
        container.classList.toggle('open', this._dropdownOpen);
        if (this._dropdownOpen) this.renderDropdown();
    }

    closeDropdown() {
        const container = document.getElementById('watchlistDropdown');
        if (container) {
            container.classList.remove('open');
            this._dropdownOpen = false;
        }
    }

    // ========== DIALOG PROMPTS ==========

    createListPrompt() {
        const name = prompt('Название нового списка:');
        if (name && name.trim()) {
            this.createList(name.trim()).then(newId => this.activateList(newId));
        }
    }

    editListPrompt(listId) {
        const list = this.lists.get(listId);
        if (!list) return;
        const newName = prompt('Новое название:', list.name);
        if (newName && newName.trim()) this.renameList(listId, newName.trim());
    }

    deleteListPrompt(listId) {
        const list = this.lists.get(listId);
        if (!list) return;
        if (confirm(`Удалить список «${list.name}»?`)) this.deleteList(listId);
    }

    // ========== ЗАГРУЗКА ЦЕН ==========

    async initializeWithPriority() {
        await this._initPromise;
        console.log('📋 WatchlistManager: приоритетная загрузка');
        this.renderDropdown();

        const activeList = this.lists.get(this.activeListId);
        const panelHasTickers = this.tickerPanel.tickers.length > 0;

        if (!panelHasTickers && activeList && activeList.symbols.length > 0) {
            this.loadSymbolsFromList(this.activeListId);
            this.tickerPanel.renderTickerList();
            await this.fetchPricesForActiveList();
        } else if (panelHasTickers) {
            await this.fetchPricesForActiveList();
        }
    }

    async fetchPricesForActiveList() {
        const activeList = this.lists.get(this.activeListId);
        if (!activeList || activeList.symbols.length === 0) return;

        const binanceSymbols = [];
        const bybitFuturesSymbols = [];
        const bybitSpotSymbols = [];

        activeList.symbols.forEach(key => {
            const parts = key.split(':');
            if (parts.length !== 3) return;
            const [symbol, exchange, marketType] = parts;
            if (exchange === 'binance') binanceSymbols.push(symbol);
            else if (exchange === 'bybit') {
                if (marketType === 'futures') bybitFuturesSymbols.push(symbol);
                else bybitSpotSymbols.push(symbol);
            }
        });

        const promises = [];

        if (binanceSymbols.length > 0) {
            const set = new Set(binanceSymbols);
            promises.push(
                fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
                    .then(r => r.json())
                    .then(data => {
                        if (!Array.isArray(data)) return;
                        data.forEach(t => {
                            if (set.has(t.symbol)) {
                                this.tickerPanel.tickersMap.forEach(ticker => {
                                    if (ticker.symbol === t.symbol && ticker.exchange === 'binance') {
                                        ticker.price = parseFloat(t.lastPrice);
                                        ticker.change = parseFloat(t.priceChangePercent);
                                        ticker.volume = parseFloat(t.quoteVolume);
                                        ticker.trades = parseInt(t.count);
                                    }
                                });
                            }
                        });
                    })
                    .catch(e => console.warn('Binance prices error:', e))
            );
        }

        if (bybitFuturesSymbols.length > 0) {
            const set = new Set(bybitFuturesSymbols);
            promises.push(
                fetch('https://api.bybit.com/v5/market/tickers?category=linear')
                    .then(r => r.json())
                    .then(data => {
                        if (data.retCode !== 0 || !data.result?.list) return;
                        data.result.list.forEach(t => {
                            if (set.has(t.symbol)) {
                                this.tickerPanel.tickersMap.forEach(ticker => {
                                    if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'futures') {
                                        ticker.price = parseFloat(t.lastPrice);
                                        ticker.change = parseFloat(t.price24hPcnt) * 100;
                                        ticker.volume = parseFloat(t.volume24h) * parseFloat(t.lastPrice);
                                        ticker.trades = 0;
                                    }
                                });
                            }
                        });
                    })
                    .catch(e => console.warn('Bybit futures error:', e))
            );
        }

        if (bybitSpotSymbols.length > 0) {
            const set = new Set(bybitSpotSymbols);
            promises.push(
                fetch('https://api.bybit.com/v5/market/tickers?category=spot')
                    .then(r => r.json())
                    .then(data => {
                        if (data.retCode !== 0 || !data.result?.list) return;
                        data.result.list.forEach(t => {
                            if (set.has(t.symbol)) {
                                this.tickerPanel.tickersMap.forEach(ticker => {
                                    if (ticker.symbol === t.symbol && ticker.exchange === 'bybit' && ticker.marketType === 'spot') {
                                        ticker.price = parseFloat(t.lastPrice);
                                        ticker.change = parseFloat(t.price24hPcnt) * 100;
                                        ticker.volume = parseFloat(t.volume24h) * parseFloat(t.lastPrice);
                                        ticker.trades = 0;
                                    }
                                });
                            }
                        });
                    })
                    .catch(e => console.warn('Bybit spot error:', e))
            );
        }

        await Promise.allSettled(promises);
        this.tickerPanel.renderTickerList();
    }

    loadSymbolsFromList(listId) {
        const list = this.lists.get(listId);
        if (!list) return;

        this.tickerPanel.tickers = [];
        this.tickerPanel.tickersMap.clear();
        this.tickerPanel.state.customSymbols = [];
        this.tickerPanel.state.favorites = [];
        this.tickerPanel.state.flags = {};
        this.tickerPanel.tickerElements.clear();
        this.tickerPanel.displayedTickers = [];
        this.tickerPanel.totalItems = 0;
        this.tickerPanel.filterCache = null;

        const container = document.getElementById('tickerListContainer');
        if (container) container.innerHTML = '';

        this.tickerPanel.state.customSymbols = [...list.symbols];
        list.symbols.forEach(symbolKey => {
            const parts = symbolKey.split(':');
            if (parts.length === 3) {
                const [symbol, exchange, marketType] = parts;
                this.tickerPanel.addSymbol(symbol, true, exchange, marketType, false, true, true);
            }
        });
        this.tickerPanel.renderTickerList();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (typeof window !== 'undefined') {
    window.WatchlistManager = WatchlistManager;
}