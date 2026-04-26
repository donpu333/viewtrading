// ========== ПЛАВАЮЩЕЕ ОКНО КАЛЬКУЛЯТОРА ==========
(function() {
    // Создаём плавающее окно
    const floatingWindow = document.createElement('div');
    floatingWindow.id = 'floatingCalculator';
    floatingWindow.style.display = 'none';
    
    floatingWindow.innerHTML = `
        <div class="calculator-header" id="calculatorHeader">
            <span>📊 Калькулятор рисков</span>
            <div class="calculator-header-buttons">
                <button id="minimizeCalculatorBtn" title="Свернуть">─</button>
                <button id="closeCalculatorBtn" title="Закрыть">✕</button>
            </div>
        </div>
        <div class="calculator-body" id="calculatorBody">
            <div class="calculator-content">
                <div style="text-align: center; padding: 20px;">Загрузка...</div>
            </div>
        </div>
    `;
    document.body.appendChild(floatingWindow);
    
    // Загружаем HTML калькулятора
    fetch('calculator.html')
        .then(response => response.text())
        .then(html => {
            const content = floatingWindow.querySelector('.calculator-content');
            content.innerHTML = html;
            
            // Выполняем скрипты из загруженного HTML
            const scripts = content.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                document.body.appendChild(newScript);
            });
            
            // Даём скриптам время выполниться и запускаем инициализацию
            setTimeout(() => {
                if (typeof initCalculator === 'function') {
                    initCalculator();
                } else {
                    console.warn('Функция initCalculator не найдена. Проверьте calculator.html');
                }
            }, 10);
        })
        .catch(err => {
            floatingWindow.querySelector('.calculator-content').innerHTML = '<div style="color: red; padding: 20px;">Ошибка загрузки калькулятора</div>';
            console.error('Ошибка загрузки калькулятора:', err);
        });
    
    // Переменные для перетаскивания
    let isDragging = false;
    let dragStartX, dragStartY;
    let windowStartLeft, windowStartTop;
    
    const header = floatingWindow.querySelector('#calculatorHeader');
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = floatingWindow.getBoundingClientRect();
        windowStartLeft = rect.left;
        windowStartTop = rect.top;
        
        floatingWindow.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        let newLeft = windowStartLeft + deltaX;
        let newTop = windowStartTop + deltaY;
        
        const maxX = window.innerWidth - floatingWindow.offsetWidth;
        const maxY = window.innerHeight - floatingWindow.offsetHeight;
        
        newLeft = Math.max(0, Math.min(newLeft, maxX));
        newTop = Math.max(0, Math.min(newTop, maxY));
        
        floatingWindow.style.left = newLeft + 'px';
        floatingWindow.style.top = newTop + 'px';
        floatingWindow.style.right = 'auto';
        floatingWindow.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        floatingWindow.style.cursor = '';
    });
    
    // Кнопка свернуть
    const minimizeBtn = floatingWindow.querySelector('#minimizeCalculatorBtn');
    const calculatorBody = floatingWindow.querySelector('#calculatorBody');
    let isMinimized = false;
    
    minimizeBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        if (isMinimized) {
            calculatorBody.style.display = 'none';
            minimizeBtn.innerHTML = '□';
            minimizeBtn.title = 'Развернуть';
        } else {
            calculatorBody.style.display = 'block';
            minimizeBtn.innerHTML = '─';
            minimizeBtn.title = 'Свернуть';
        }
    });
    
    // Кнопка закрыть
    const closeBtn = floatingWindow.querySelector('#closeCalculatorBtn');
    closeBtn.addEventListener('click', () => {
        floatingWindow.style.display = 'none';
    });
    
    // Кнопка для открытия/закрытия (toggle)
    const calculatorBtn = document.getElementById('calculatorBtn');
    if (calculatorBtn) {
        calculatorBtn.addEventListener('click', () => {
            if (floatingWindow.style.display === 'block') {
                floatingWindow.style.display = 'none';
            } else {
                floatingWindow.style.display = 'block';
            }
        });
    }
})();

// ========== ГЛОБАЛЬНЫЙ ЭКСПОРТ ==========
if (typeof window !== 'undefined') {
    window.Calculator = {
        open: () => {
            const win = document.getElementById('floatingCalculator');
            if (win) win.style.display = 'block';
        },
        close: () => {
            const win = document.getElementById('floatingCalculator');
            if (win) win.style.display = 'none';
        },
        toggle: () => {
            const win = document.getElementById('floatingCalculator');
            if (win) win.style.display = win.style.display === 'block' ? 'none' : 'block';
        },
        isOpen: () => {
            const win = document.getElementById('floatingCalculator');
            return win && win.style.display === 'block';
        }
    };
}