class TickerEvents {
    constructor(parent) {
        this.parent = parent;
    }
    
    setupDelegatedEvents() {
        const container = document.getElementById('tickerListContainer');
        if (!container) return;
        
        container.removeEventListener('click', this.parent.handleTickerClick);
        container.removeEventListener('contextmenu', this.parent.handleContextMenu);
        container.removeEventListener('dblclick', this.parent.handleDoubleClick);
        
        container.addEventListener('click', this.parent.handleTickerClick);
        container.addEventListener('contextmenu', this.parent.handleContextMenu);
        container.addEventListener('dblclick', this.parent.handleDoubleClick);
        
        document.addEventListener('keydown', this.parent.handleKeyDelete);
        
        console.log('✅ Обработчики событий обновлены');
    }
    
    setupFilters() {
        document.querySelectorAll('[data-filter="market"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter="market"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.parent.state.marketFilter = btn.dataset.value;
                this.parent.filterCache = null;
                this.parent.renderTickerList();
            });
        });
        
        document.querySelectorAll('[data-filter="exchange"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter="exchange"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.parent.state.exchangeFilter = btn.dataset.value;
                this.parent.filterCache = null;
                this.parent.renderTickerList();
            });
        });
    }
    
    setupClearAllButton() {
        const clearBtn = document.getElementById('clearAllBtn');
        if (clearBtn) {
            clearBtn.addEventListener('dblclick', () => {
                this.parent.clearAllSymbols();
            });
        }
    }
    
    setupFlagContextMenu() {
        const contextMenu = document.getElementById('flagContextMenu');
        
        contextMenu.querySelectorAll('.context-menu-item').forEach(menuItem => {
            menuItem.removeEventListener('click', this.parent.handleFlagSelect);
            menuItem.addEventListener('click', this.parent.handleFlagSelect);
        });
        
        document.removeEventListener('click', this.parent.closeContextMenu);
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });
    }
    
    setupUIEventListeners() {
        document.querySelectorAll('.tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.parent.state.activeTab = tab.dataset.tab;
                
                const flagTabs = document.getElementById('flagTabs');
                if (flagTabs) {
                    if (this.parent.state.activeTab === 'flags') {
                        flagTabs.style.display = 'flex';
                        this.parent.state.activeFlagTab = null;
                        document.querySelectorAll('.tab[data-flag]').forEach(t => t.classList.remove('active'));
                    } else {
                        flagTabs.style.display = 'none';
                        this.parent.state.activeFlagTab = null;
                    }
                }
                
                this.parent.filterCache = null;
                this.parent.renderTickerList();
            });
        });
        
        document.querySelectorAll('.tab[data-flag]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (this.parent.state.activeTab !== 'flags') {
                    document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
                    document.querySelector('.tab[data-tab="flags"]').classList.add('active');
                    this.parent.state.activeTab = 'flags';
                    
                    const flagTabs = document.getElementById('flagTabs');
                    if (flagTabs) {
                        flagTabs.style.display = 'flex';
                    }
                }
                
                document.querySelectorAll('.tab[data-flag]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.parent.state.activeFlagTab = tab.dataset.flag;
                
                this.parent.filterCache = null;
                this.parent.renderTickerList();
            });
        });
    }
}

if (typeof window !== 'undefined') {
    window.TickerEvents = TickerEvents;
}