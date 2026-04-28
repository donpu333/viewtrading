
function safeChart() {
    if (!window.chartManagerInstance) {
        console.warn('⚠️ chartManagerInstance не инициализирован');
        return null;
    }
    return window.chartManagerInstance;
}

function safeChartMethod(methodName, ...args) {
    const chart = safeChart();
    if (chart && typeof chart[methodName] === 'function') {
        return chart[methodName](...args);
    }
    console.warn(`⚠️ Метод ${methodName} не доступен`);
    return null;
}

async function safeDB() {
    if (!window.db) {
        console.warn('⚠️ window.db не существует');
        return null;
    }
    
    // Ждем готовность IndexedDB
    if (!window.dbReady) {
        console.log('⏳ Ожидание инициализации IndexedDB...');
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (window.dbReady) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
    
    return window.db;
}
        
      if (typeof window !== 'undefined') {
    window.safeChart = safeChart;
    window.safeChartMethod = safeChartMethod;
    window.safeDB = safeDB;
}