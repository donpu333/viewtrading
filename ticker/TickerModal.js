class TickerModal {
    constructor(parent) {
        this.parent = parent;
        this.searchTimeout = null;
        this.modalAllResults = [];
    }
    
    setupModal() {
        const modal = document.getElementById('addInstrumentModal');
        const openBtn = document.getElementById('addInstrumentBtn');
        const closeBtn = document.getElementById('modalClose');
        const modalSearch = document.getElementById('modalSearchInput');
        const modalBinanceBtn = document.getElementById('modalBinanceBtn');
        const modalBybitBtn = document.getElementById('modalBybitBtn');
        const modalFuturesBtn = document.getElementById('modalFuturesBtn');
        const modalSpotBtn = document.getElementById('modalSpotBtn');
        const modalAddAllBtn = document.getElementById('modalAddAllBtn');

        openBtn.addEventListener('click', () => {
            this.parent.state.modalExchange = 'binance';
            this.parent.state.modalMarketType = 'futures';
            this.parent.state.modalSearchQuery = '';
            this.parent.state.modalPage = 0;
            modalSearch.value = '';
            this.updateModalButtons();
            modal.classList.add('show');
            modalSearch.focus();
            this.parent.updateModalCount();
            this.updateModalResults(true);
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            this.parent.state.isAddingAllInProgress = false;
            this.parent.state.addingAllOffset = 0;
            modalAddAllBtn.classList.remove('loading');
            modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                this.parent.state.isAddingAllInProgress = false;
                this.parent.state.addingAllOffset = 0;
                modalAddAllBtn.classList.remove('loading');
                modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
            }
        });

        modalBinanceBtn.addEventListener('click', () => { 
            this.parent.state.modalExchange = 'binance'; 
            this.parent.state.modalPage = 0;
            this.updateModalButtons();
            this.parent.updateModalCount();
            this.updateModalResults(true); 
        });
        
        modalBybitBtn.addEventListener('click', () => { 
            this.parent.state.modalExchange = 'bybit'; 
            this.parent.state.modalPage = 0;
            this.updateModalButtons();
            this.parent.updateModalCount();
            this.updateModalResults(true); 
        });
        
        modalFuturesBtn.addEventListener('click', () => { 
            this.parent.state.modalMarketType = 'futures'; 
            this.parent.state.modalPage = 0;
            this.updateModalButtons();
            this.parent.updateModalCount();
            this.updateModalResults(true); 
        });
        
        modalSpotBtn.addEventListener('click', () => { 
            this.parent.state.modalMarketType = 'spot'; 
            this.parent.state.modalPage = 0;
            this.updateModalButtons();
            this.parent.updateModalCount();
            this.updateModalResults(true); 
        });

        modalAddAllBtn.addEventListener('click', async () => {
            if (this.parent.state.isAddingAllInProgress) return;
            
            const cache = this.parent.state.modalExchange === 'binance' ? this.parent.binanceSymbolsCache : this.parent.bybitSymbolsCache;
            const allPairs = cache.filter(s => 
                s.exchange === this.parent.state.modalExchange && 
                s.marketType === this.parent.state.modalMarketType && 
                s.symbol && s.symbol.endsWith('USDT')
            );
            
            if (allPairs.length === 0) return;
            
            this.parent.state.isAddingAllInProgress = true;
            this.parent.state.addingAllOffset = 0;
            modalAddAllBtn.classList.add('loading');
            modalAddAllBtn.innerHTML = '<i class="fas fa-spinner"></i> Загрузка...';
            
            this.addNextBatch();
        });

        const oldInput = modalSearch;
        const newInput = oldInput.cloneNode(true);
        oldInput.parentNode.replaceChild(newInput, oldInput);
        const modalSearchClean = document.getElementById('modalSearchInput');

        modalSearchClean.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || 
                e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' || 
                e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') {
                return;
            }
            
            if (e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }

            e.preventDefault();
            
            let char = e.key;
            
            const ruToEng = {
                'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 'e', 'н': 'n',
                'г': 'g', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': 'h', 'ъ': ']',
                'ф': 'a', 'ы': 's', 'в': 'v', 'а': 'a', 'п': 'p', 'р': 'r',
                'о': 'o', 'л': 'l', 'д': 'd', 'ж': ';', 'э': "'",
                'я': 'z', 'ч': 'x', 'с': 's', 'м': 'm', 'и': 'i', 'т': 't',
                'ь': 'b', 'б': ',', 'ю': '.',
                'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'E', 'Н': 'N',
                'Г': 'G', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': 'H', 'Ъ': ']',
                'Ф': 'A', 'Ы': 'S', 'В': 'V', 'А': 'A', 'П': 'P', 'Р': 'R',
                'О': 'O', 'Л': 'L', 'Д': 'D', 'Ж': ';', 'Э': "'",
                'Я': 'Z', 'Ч': 'X', 'С': 'S', 'М': 'M', 'И': 'I', 'Т': 'T',
                'Ь': 'B', 'Б': ',', 'Ю': '.'
            };
            
            if (ruToEng[char]) {
                char = ruToEng[char];
            }
            
            if (char.length === 1 && char.match(/[a-z]/i)) {
                char = char.toUpperCase();
            }

            const input = e.target;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            
            input.value = value.substring(0, start) + char + value.substring(end);
            input.selectionStart = input.selectionEnd = start + 1;
            
            this.parent.state.modalSearchQuery = input.value;
            this.parent.state.modalPage = 0;
            
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.updateModalResults(true);
            }, 300);
        });

        modalSearchClean.addEventListener('input', (e) => {
            const input = e.target;
            const cursor = input.selectionStart;
            
            input.value = input.value.toUpperCase();
            input.setSelectionRange(cursor, cursor);
            
            this.parent.state.modalSearchQuery = input.value;
            this.parent.state.modalPage = 0;
            
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.updateModalResults(true);
            }, 300);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                modal.classList.remove('show');
                this.parent.state.isAddingAllInProgress = false;
                this.parent.state.addingAllOffset = 0;
                modalAddAllBtn.classList.remove('loading');
                modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
            }
            
            if (e.key === 'Enter' && modal.classList.contains('show')) {
                e.preventDefault();
                const firstItem = document.querySelector('.modal-result-item:not(.added)');
                if (firstItem) {
                    const symbol = firstItem.dataset.symbol;
                    const exchange = firstItem.dataset.exchange;
                    const marketType = firstItem.dataset.marketType;
                    if (this.parent.addSymbol(symbol, true, exchange, marketType)) {
                        this.parent.updateModalCount();
                        this.updateModalResults(true);
                        this.parent.filterCache = null;
                        this.parent.renderTickerList();
                        if (e.shiftKey) modal.classList.remove('show');
                    }
                }
            }
        });
    }
    
  async addNextBatch() {
    if (!this.parent.state.isAddingAllInProgress) return;
    
    const modalAddAllBtn = document.getElementById('modalAddAllBtn');
    const cache = this.parent.state.modalExchange === 'binance' ? this.parent.binanceSymbolsCache : this.parent.bybitSymbolsCache;
    const allPairs = cache.filter(s => 
        s.exchange === this.parent.state.modalExchange && 
        s.marketType === this.parent.state.modalMarketType && 
        s.symbol && s.symbol.endsWith('USDT')
    );
    
    const batchSize = this.parent.state.addingAllBatchSize;
    const start = this.parent.state.addingAllOffset;
    const end = Math.min(start + batchSize, allPairs.length);
    
    const batchToAdd = [];
    for (let i = start; i < end; i++) {
        const symbolData = allPairs[i];
        if (symbolData && symbolData.symbol && !this.parent.tickers.some(t => 
            t.symbol === symbolData.symbol && 
            t.exchange === symbolData.exchange && 
            t.marketType === symbolData.marketType
        )) {
            batchToAdd.push({
                symbol: symbolData.symbol,
                exchange: symbolData.exchange,
                marketType: symbolData.marketType
            });
        }
    }
    
    // === ИСПРАВЛЕНО: ЖДЁМ ЗАВЕРШЕНИЯ ===
    if (batchToAdd.length > 0) {
        await this.parent.addSymbolsBatch(batchToAdd);
    }
    
    this.parent.state.addingAllOffset = end;
    const progress = Math.round((end / allPairs.length) * 100);
    if (modalAddAllBtn) {
        modalAddAllBtn.innerHTML = `<i class="fas fa-spinner"></i> Загружено ${end}/${allPairs.length} (${progress}%)`;
    }
    
    if (end < allPairs.length) {
        setTimeout(() => this.addNextBatch(), 50);
    } else {
        this.parent.state.isAddingAllInProgress = false;
        if (modalAddAllBtn) {
            modalAddAllBtn.classList.remove('loading');
            modalAddAllBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить все';
        }
        this.parent.updateModalCount();
        this.updateModalResults(true);
        
        // === ДОБАВЛЕНО: ЗАДЕРЖКА ДЛЯ ЗАВЕРШЕНИЯ ВСЕХ ОПЕРАЦИЙ ===
        setTimeout(() => {
            this.parent.filterCache = null;
            this.parent.renderTickerList();
            this.parent.setupWebSockets();
            
            setTimeout(() => {
                if (this.parent.ws && this.parent.ws.forceSubscribeAll) {
                    this.parent.ws.forceSubscribeAll();
                }
            }, 1000);
        }, 500);
    }
}
    
    updateModalButtons() {
        const binanceBtn = document.getElementById('modalBinanceBtn');
        const bybitBtn = document.getElementById('modalBybitBtn');
        const futuresBtn = document.getElementById('modalFuturesBtn');
        const spotBtn = document.getElementById('modalSpotBtn');
        
        if (binanceBtn) binanceBtn.classList.toggle('active', this.parent.state.modalExchange === 'binance');
        if (bybitBtn) bybitBtn.classList.toggle('active', this.parent.state.modalExchange === 'bybit');
        if (futuresBtn) futuresBtn.classList.toggle('active', this.parent.state.modalMarketType === 'futures');
        if (spotBtn) spotBtn.classList.toggle('active', this.parent.state.modalMarketType === 'spot');
    }
    
    updateModalResults(reset = false) {
        const resultsContainer = document.getElementById('modalResults');
        
        if (reset) {
            this.parent.state.modalPage = 0;
        }
        
        let source;
        if (this.parent.state.modalExchange === 'binance') {
            source = this.parent.state.modalMarketType === 'futures' ? this.parent.allBinanceFutures : this.parent.allBinanceSpot;
        } else {
            source = this.parent.state.modalMarketType === 'futures' ? this.parent.allBybitFutures : this.parent.allBybitSpot;
        }
        
        if (!source || source.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">Загрузка данных...</div>';
            return;
        }
        
        let filteredResults = [...source];
        
        if (this.parent.state.modalSearchQuery) {
            const query = this.parent.state.modalSearchQuery.toUpperCase();
            filteredResults = filteredResults.filter(s => s.symbol.includes(query));
        }
        
        this.modalAllResults = filteredResults;
        
        const pageSize = this.parent.state.modalPageSize;
        const startIndex = reset ? 0 : this.parent.state.modalPage * pageSize;
        const endIndex = Math.min(startIndex + pageSize, this.modalAllResults.length);
        
        if (this.modalAllResults.length === 0) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        const pageResults = this.modalAllResults.slice(startIndex, endIndex);
        
        if (!reset && startIndex < this.modalAllResults.length) {
            this.parent.state.modalPage++;
        }
        
        this.renderModalResults(pageResults, !reset && startIndex > 0);
    }
    
    renderModalResults(results, append = false) {
        const resultsContainer = document.getElementById('modalResults');
        
        if (results.length === 0 && !append) { 
            resultsContainer.innerHTML = '<div class="no-results">Инструменты не найдены</div>'; 
            return; 
        }
        
        let html = append ? resultsContainer.innerHTML : '';
        
        for (const symbolData of results) {
            if (!symbolData || !symbolData.symbol) continue;
            
            const isAdded = this.parent.tickers.some(t => 
                t.symbol === symbolData.symbol && 
                t.exchange === symbolData.exchange && 
                t.marketType === symbolData.marketType
            );
            
            const addedClass = isAdded ? 'added' : '';
            
            let exchangeIconHtml = '';
            if (symbolData.exchange === 'binance') {
                exchangeIconHtml = `
                    <div class="modal-exchange-icon binance-icon">
                       <svg width="25" height="25" viewBox="0 0 32 32">
                          <circle cx="16" cy="16" r="15" fill="none" stroke="#FFA500" stroke-width="1.2"/>
                          <g transform="translate(16, 16) scale(0.025)">
                            <g transform="translate(-500, -500)">
                              <path fill="#F0B90B" d="M500,612.7l112.7-112.7L500,387.3L387.3,500L500,612.7z M500,774.6L306.4,581L193.6,693.7L500,1000l306.4-306.3L693.7,581L500,774.6z M887.3,387.3L774.6,500l112.7,112.7L1000,500L887.3,387.3z M500,225.4l193.7,193.7L806.4,306.4L500,0L193.6,306.4l112.7,112.7L500,225.4z M225.4,500L112.7,612.7L0,500l112.7-112.7L225.4,500z"/>
                            </g>
                          </g>
                        </svg>
                    </div>
                `;
            } else {
                exchangeIconHtml = `
                    <div class="modal-exchange-icon bybit-icon">
                       <svg width="25" height="25" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="19" fill="none" stroke="#FFFFFF" stroke-width="1.2"/>
                          <g transform="translate(20, 20) scale(0.012)">
                            <g transform="translate(-1300, -420)">
                              <polygon fill="#F7A600" points="1781.6,642.2 1781.6,0 1910.7,0 1910.7,642.2"/>
                              <path fill="#FFFFFF" d="M277.3,832.9H0.6V190.8h265.6c129,0,204.3,70.4,204.3,180.4c0,71.3-48.3,117.2-81.8,132.6c39.9,18,91,58.6,91,144.3 C479.7,767.9,395.2,832.9,277.3,832.9L277.3,832.9z M256,302.7H129.6v147.9H256c54.8,0,85.5-29.8,85.5-74S310.8,302.7,256,302.7 L256,302.7z M264.3,563.3H129.6v157.8h134.6c58.6,0,86.4-36.1,86.4-79.4C350.6,598.4,322.7,563.3,264.3,563.3z"/>
                              <polygon fill="#FFFFFF" points="873.4,569.5 873.4,832.9 745.2,832.9 745.2,569.5 546.5,190.8 686.8,190.8 810.2,449.6 931.9,190.8 1072.1,190.8"/>
                              <path fill="#FFFFFF" d="M1438,832.9h-276.7V190.8h265.6c129,0,204.3,70.4,204.3,180.4c0,71.3-48.3,117.2-81.8,132.6c39.9,18,91,58.6,91,144.3 C1640.4,767.9,1556,832.9,1438,832.9L1438,832.9z M1416.7,302.7h-126.3v147.9h126.3c54.8,0,85.5-29.8,85.5-74 C1502.1,332.4,1471.4,302.7,1416.7,302.7L1416.7,302.7z M1425,563.3h-134.6v157.8H1425c58.6,0,86.4-36.1,86.4-79.4 C1511.4,598.4,1483.5,563.3,1425,563.3L1425,563.3z"/>
                              <polygon fill="#FFFFFF" points="2326.7,302.7 2326.7,833 2197.6,833 2197.6,302.7 2024.9,302.7 2024.9,190.8 2499.4,190.8 2499.4,302.7"/>
                            </g>
                          </g>
                        </svg>
                    </div>
                `;
            }
            
            if (isAdded) {
                html += `<div class="modal-result-item ${addedClass}" data-symbol="${symbolData.symbol}" data-exchange="${symbolData.exchange}" data-market-type="${symbolData.marketType}">${exchangeIconHtml}<span class="modal-result-symbol">${symbolData.symbol}</span><div class="modal-result-exchange"><span>${symbolData.exchange === 'binance' ? 'Binance' : 'Bybit'} - ${symbolData.marketType === 'futures' ? 'Futures' : 'Spot'}</span></div><div class="modal-result-actions"><span class="modal-check-icon"><i class="fas fa-check-circle"></i></span><span class="modal-target-btn" data-symbol="${symbolData.symbol}" data-exchange="${symbolData.exchange}" data-market-type="${symbolData.marketType}" title="Прицелиться"><i class="fas fa-crosshairs"></i></span></div></div>`;
            } else {
                html += `<div class="modal-result-item ${addedClass}" data-symbol="${symbolData.symbol}" data-exchange="${symbolData.exchange}" data-market-type="${symbolData.marketType}">${exchangeIconHtml}<span class="modal-result-symbol">${symbolData.symbol}</span><div class="modal-result-exchange"><span>${symbolData.exchange === 'binance' ? 'Binance' : 'Bybit'} - ${symbolData.marketType === 'futures' ? 'Futures' : 'Spot'}</span></div><span class="modal-add-icon"><i class="fas fa-plus-circle"></i></span></div>`;
            }
        }
        
        resultsContainer.innerHTML = html;
        
        document.querySelectorAll('.modal-result-item:not(.added)').forEach(item => {
            item.addEventListener('click', (e) => {
                const symbol = item.dataset.symbol;
                const exchange = item.dataset.exchange;
                const marketType = item.dataset.marketType;
                
                if (this.parent.addSymbol(symbol, true, exchange, marketType)) {
                    this.parent.updateModalCount();
                    this.updateModalResults(true);
                    this.parent.filterCache = null;
                    this.parent.renderTickerList();
                    if (e.shiftKey) {
                        document.getElementById('addInstrumentModal').classList.remove('show');
                    }
                }
            });
        });
        
        document.querySelectorAll('.modal-target-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const symbol = btn.dataset.symbol;
                const exchange = btn.dataset.exchange;
                const marketType = btn.dataset.marketType;
                
                if (this.parent.focusOnSymbol) {
                    this.parent.focusOnSymbol(symbol, exchange, marketType);
                } else {
                    document.getElementById('addInstrumentModal').classList.remove('show');
                }
            });
        });
        
        if (!resultsContainer._scrollHandler) {
            resultsContainer._scrollHandler = () => {
                const { scrollTop, scrollHeight, clientHeight } = resultsContainer;
                if (scrollHeight - scrollTop - clientHeight < 100) {
                    if (this.modalAllResults && 
                        this.parent.state.modalPage * this.parent.state.modalPageSize < this.modalAllResults.length) {
                        this.updateModalResults(false);
                    }
                }
            };
            resultsContainer.addEventListener('scroll', resultsContainer._scrollHandler);
        }
    }
}

if (typeof window !== 'undefined') {
    window.TickerModal = TickerModal;
}