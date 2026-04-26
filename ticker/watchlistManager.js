// ========== СИСТЕМА ВОТЧЛИСТОВ (TradingView Style - Dropdown) ==========

class WatchlistManager {
    constructor(tickerPanel) {
        this.tickerPanel = tickerPanel;
        this.lists = new Map();
        this.activeListId = 'default';
        this.listOrder = ['default'];
        this.renderCache = new Map();
        this._dropdownOpen = false;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('watchlists');
            if (saved) {
                const data = JSON.parse(saved);
                this.lists = new Map(Object.entries(data.lists || {}));
                this.listOrder = data.listOrder || ['default'];
                this.activeListId = data.activeListId || 'default';
            }
        } catch (e) {
            console.warn('Ошибка загрузки вотчлистов:', e);
        }
        
        if (!this.lists.has('default')) {
            this.lists.set('default', {
                name: 'Основной',
                symbols: [],
                isDefault: true
            });
        }
    }
    
    saveToStorage() {
        const data = {
            lists: Object.fromEntries(this.lists),
            listOrder: this.listOrder,
            activeListId: this.activeListId
        };
        localStorage.setItem('watchlists', JSON.stringify(data));
    }
    
    createList(name) {
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
    
    deleteList(listId) {
        if (listId === 'default') return false;
        if (!this.lists.has(listId)) return false;
        
        this.lists.delete(listId);
        this.listOrder = this.listOrder.filter(id => id !== listId);
        this.renderCache.delete(listId);
        
        if (this.activeListId === listId) {
            this.activateList('default');
        }
        
        this.saveToStorage();
        this.renderDropdown();
        return true;
    }
    
    renameList(listId, newName) {
        const list = this.lists.get(listId);
        if (!list) return false;
        list.name = newName;
        this.saveToStorage();
        this.renderDropdown();
        return true;
    }
    
    activateList(listId) {
        if (!this.lists.has(listId)) return;
        if (this.activeListId === listId) {
            this.closeDropdown();
            return;
        }
        
        this.saveCurrentSymbolsToList(this.activeListId);
        this.activeListId = listId;
        this.saveToStorage();
        this.loadSymbolsFromList(listId);
        this.renderDropdown();
        this.tickerPanel.renderTickerList();
        this.tickerPanel.updateModalCount();
        this.fetchPricesForActiveList();
        this.closeDropdown();
    }
    
    saveCurrentSymbolsToList(listId) {
        const list = this.lists.get(listId);
        if (!list) return;
        list.symbols = [...this.tickerPanel.state.customSymbols];
        this.renderCache.delete(listId);
    }
    
    loadSymbolsFromList(listId) {
        const list = this.lists.get(listId);
        if (!list) return;
        
        this.tickerPanel.clearAllSymbols();
        
        const symbolsToAdd = [...list.symbols];
        this.tickerPanel.state.customSymbols = symbolsToAdd;
        
        symbolsToAdd.forEach(symbolKey => {
            const parts = symbolKey.split(':');
            if (parts.length === 3) {
                const [symbol, exchange, marketType] = parts;
                this.tickerPanel.addSymbol(symbol, true, exchange, marketType, false, true);
            }
        });
        
        this.tickerPanel.renderTickerList();
    }
    // Добавь этот метод в WatchlistManager:
clearActiveList() {
    const list = this.lists.get(this.activeListId);
    if (!list) return;
    
    list.symbols = [];
    this.renderCache.delete(this.activeListId);
    this.saveToStorage();
    this.renderDropdown();
}
    addSymbolToActiveList(symbol, exchange, marketType) {
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
    
    removeSymbolFromActiveList(symbol, exchange, marketType) {
        const list = this.lists.get(this.activeListId);
        if (!list) return;
        
        const key = `${symbol}:${exchange}:${marketType}`;
        list.symbols = list.symbols.filter(s => s !== key);
        this.renderCache.delete(this.activeListId);
        this.saveToStorage();
        this.renderDropdown(); 
    }
    
    async initializeWithPriority() {
        console.log('📋 WatchlistManager: приоритетная загрузка');
        
        this.renderDropdown();
        
        const activeList = this.lists.get(this.activeListId);
        if (activeList && activeList.symbols.length > 0) {
            this.loadSymbolsFromList(this.activeListId);
            this.tickerPanel.renderTickerList();
            await this.fetchPricesForActiveList();
        }
        
        setTimeout(() => {
            this.preloadOtherLists();
        }, 500);
    }
    
    async fetchPricesForActiveList() {
        const activeList = this.lists.get(this.activeListId);
        if (!activeList || activeList.symbols.length === 0) return;
        
        const binanceSymbols = [];
        const bybitSymbols = [];
        
        activeList.symbols.forEach(key => {
            const [symbol, exchange, marketType] = key.split(':');
            if (exchange === 'binance') binanceSymbols.push(symbol);
            else if (exchange === 'bybit') bybitSymbols.push({ symbol, marketType });
        });
        
        const promises = [];
        
        if (binanceSymbols.length > 0) {
            promises.push(
                fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
                    .then(r => r.json())
                    .then(data => {
                        const symbolSet = new Set(binanceSymbols);
                        data.forEach(t => {
                            if (symbolSet.has(t.symbol)) {
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
                    .catch(e => console.warn('Binance error:', e))
            );
        }
        
        await Promise.allSettled(promises);
        this.tickerPanel.renderTickerList();
    }
    
    async preloadOtherLists() {
        for (const listId of this.listOrder) {
            if (listId === this.activeListId) continue;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('✅ Фоновая загрузка завершена');
    }
    
    // ====== ВЫПАДАЮЩЕЕ МЕНЮ ======
   renderDropdown() {
    const container = document.getElementById('watchlistDropdown');
    if (!container) {
        this.createDropdownContainer();
        return;
    }
    
    const activeList = this.lists.get(this.activeListId);
    const listName = activeList ? activeList.name : 'Списки';
    const itemCount = activeList ? activeList.symbols.length : 0;
    
    // Обновляем ТОЛЬКО счётчик и имя на кнопке (НЕ ПЕРЕСОЗДАЁМ КНОПКУ!)
    const btnText = container.querySelector('.wl-btn-text');
    const btnCount = container.querySelector('.wl-btn-count');
    if (btnText) btnText.textContent = this.escapeHtml(listName);
    if (btnCount) btnCount.textContent = itemCount;
    
    // Выпадающий список обновляем только если он открыт
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
                    <span class="wl-item-icon">${isActive ? '✓' : ''}</span>
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
        
        dropdown.querySelector('[data-action="add"]')?.addEventListener('click', () => {
            this.createListPrompt();
        });
    }
}
    
    createDropdownContainer() {
        // Ищем панель тикеров
        const tickerPanel = document.getElementById('tickerPanel');
        
        // Ищем или создаём контейнер
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
            
            // Вставляем перед списком тикеров
            const tabsContainer = tickerPanel?.querySelector('.tabs-container');
            if (tabsContainer) {
                tabsContainer.parentNode.insertBefore(container, tabsContainer);
            } else {
                tickerPanel?.insertBefore(container, tickerPanel.firstChild);
            }
            
            // Привязываем события
            this.bindDropdownEvents(container);
        }
        
        this.renderDropdown();
    }
    
    bindDropdownEvents(container) {
        const button = container.querySelector('.wl-dropdown-btn');
        const dropdown = container.querySelector('.wl-dropdown-menu');
        
        // Клик по кнопке - открыть/закрыть
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }
    
    toggleDropdown() {
        const container = document.getElementById('watchlistDropdown');
        if (!container) return;
        
        this._dropdownOpen = !this._dropdownOpen;
        container.classList.toggle('open', this._dropdownOpen);
        
        if (this._dropdownOpen) {
            this.renderDropdown();
        }
    }
    
    closeDropdown() {
        const container = document.getElementById('watchlistDropdown');
        if (container) {
            container.classList.remove('open');
            this._dropdownOpen = false;
        }
    }
    
    createListPrompt() {
        const name = prompt('Название нового списка:');
        if (name && name.trim()) {
            const newId = this.createList(name.trim());
            this.activateList(newId);
        }
    }
    
    editListPrompt(listId) {
        const list = this.lists.get(listId);
        if (!list) return;
        const newName = prompt('Новое название:', list.name);
        if (newName && newName.trim()) {
            this.renameList(listId, newName.trim());
        }
    }
    
    deleteListPrompt(listId) {
        const list = this.lists.get(listId);
        if (!list) return;
        if (confirm(`Удалить список «${list.name}»?`)) {
            this.deleteList(listId);
        }
    }
    
    showNotification(message) {
        const notification = document.getElementById('alertNotification');
        if (notification) {
            notification.innerHTML = `<div class="alert-title">📋 ${message}</div>`;
            notification.style.display = 'block';
            notification.style.borderLeftColor = '#4A90E2';
            setTimeout(() => { notification.style.display = 'none'; }, 2000);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (typeof window !== 'undefined') {
    window.WatchlistManager = WatchlistManager;
    console.log('✅ WatchlistManager зарегистрирован');
}