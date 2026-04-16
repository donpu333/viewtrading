const workerCode = `
self.addEventListener('message', function(e) {
    const { task, data, params, indicatorType, indicatorId, calculations } = e.data;
    
    if (task === 'calculate') {
        try {
            let result;
            
            switch(indicatorType) {
                case 'volume':
                    result = calculateVolume(data);
                    break;
                case 'sma':
                    result = calculateSMA(data, params.period);
                    break;
                case 'ema':
                    result = calculateEMA(data, params.period);
                    break;
                case 'rsi':
                    result = calculateRSI(data, params.period);
                    break;
                case 'macd':
                    result = calculateMACD(data, params.fastPeriod, params.slowPeriod, params.signalPeriod);
                    break;
                case 'stochrsi':
                    result = calculateStochRSI(data, params.period, params.k, params.d);
                    break;
                case 'adx':
                    result = calculateADX(data, params.period);
                    break;
                case 'atr':
                    result = calculateATR(data, params.period);
                    break;
               case 'multiatr':
    result = calculateATR(data, params.atrPeriod);
    break;
                default:
                    result = null;
            }
            
            self.postMessage({
                task: 'result',
                indicatorId: indicatorId,
                indicatorType: indicatorType,
                result: result,
                success: true
            });
            
        } catch (error) {
            self.postMessage({
                task: 'error',
                indicatorId: indicatorId,
                error: error.message,
                success: false
            });
        }
    }
    else if (task === 'calculateMultiple') {
        const results = [];
        for (const calc of calculations) {
            try {
                let result;
                switch(calc.type) {
                    case 'volume':
                        result = calculateVolume(calc.data);
                        break;
                    case 'sma':
                        result = calculateSMA(calc.data, calc.params.period);
                        break;
                    case 'ema':
                        result = calculateEMA(calc.data, calc.params.period);
                        break;
                    case 'rsi':
                        result = calculateRSI(calc.data, calc.params.period);
                        break;
                    case 'macd':
                        result = calculateMACD(calc.data, calc.params.fastPeriod, calc.params.slowPeriod, calc.params.signalPeriod);
                        break;
                    case 'stochrsi':
                        result = calculateStochRSI(calc.data, calc.params.period, calc.params.k, calc.params.d);
                        break;
                    case 'adx':
                        result = calculateADX(calc.data, calc.params.period);
                        break;
                    case 'atr':
                        result = calculateATR(calc.data, calc.params.period);
                        break;
                    case 'multiatr':
                        result = calculateATR(calc.data, calc.params.atrPeriod);
                        break;
                    default:
                        result = null;
                }
                results.push({ indicatorId: calc.indicatorId, result, success: true });
            } catch (error) {
                results.push({ indicatorId: calc.indicatorId, error: error.message, success: false });
            }
        }
        self.postMessage({ task: 'resultMultiple', results });
    }
});

function calculateSMA(data, period) {
    const times = data.map(d => d.time);
    const values = data.map(d => d.close);
    const result = [];
    for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += values[i - j];
        result.push({ time: times[i], value: sum / period });
    }
    return result;
}

function calculateVolume(data) {
    return data.map(d => ({
        time: d.time,
        value: d.volume
    }));
}

function calculateEMA(data, period) {
    const times = data.map(d => d.time);
    const values = data.map(d => d.close);
    const k = 2 / (period + 1);
    const result = [];
    for (let i = 0; i < values.length; i++) {
        if (i === 0) {
            result.push({ time: times[i], value: values[0] });
        } else {
            const ema = values[i] * k + result[i - 1].value * (1 - k);
            result.push({ time: times[i], value: ema });
        }
    }
    return result;
}

function calculateRSI(data, period = 14) {
    const times = data.map(d => d.time);
    const closes = data.map(d => d.close);
    const rsiData = [];
    if (closes.length <= period) return rsiData;
    
    let gains = [], losses = [];
    for (let i = 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i-1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) { avgGain += gains[i]; avgLoss += losses[i]; }
    avgGain /= period; avgLoss /= period;
    
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        let rsi = 100 - 100 / (1 + rs);
        rsiData.push({ time: times[i + 1], value: rsi });
    }
    return rsiData;
}

function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const times = data.map(d => d.time);
    const closes = data.map(d => d.close);
    
    const emaFast = calculateEMAArray(closes, fastPeriod);
    const emaSlow = calculateEMAArray(closes, slowPeriod);
    const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
    const signalLine = calculateEMAArray(macdLine, signalPeriod);
    const histogram = macdLine.map((v, i) => v - signalLine[i]);
    
    return macdLine.map((v, i) => ({
        time: times[i],
        macd: v,
        signal: signalLine[i],
        histogram: histogram[i]
    }));
}

function calculateEMAArray(data, period) {
    const k = 2 / (period + 1);
    const ema = [data[0]];
    for (let i = 1; i < data.length; i++) {
        ema.push(data[i] * k + ema[i-1] * (1 - k));
    }
    return ema;
}

function calculateStochRSI(data, period = 14, k = 3, d = 3) {
    const times = data.map(d => d.time);
    const closes = data.map(d => d.close);
    let rsi = [];
    if (closes.length < period + 1) return { k: [], d: [], times: [] };
    
    let gains = [], losses = [];
    for (let i = 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i-1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    
    let avgG = 0, avgL = 0;
    for (let i = 0; i < period; i++) { avgG += gains[i]; avgL += losses[i]; }
    avgG /= period; avgL /= period;
    
    for (let i = period; i < gains.length; i++) {
        avgG = (avgG * (period-1) + gains[i]) / period;
        avgL = (avgL * (period-1) + losses[i]) / period;
        let rs = avgL === 0 ? 100 : avgG / avgL;
        let rsiVal = 100 - 100 / (1 + rs);
        rsi.push(rsiVal);
    }
    
    let stochK = [];
    for (let i = period-1; i < rsi.length; i++) {
        let window = rsi.slice(i - period + 1, i + 1);
        let min = Math.min(...window);
        let max = Math.max(...window);
        let kVal = (max === min) ? 50 : (rsi[i] - min) / (max - min) * 100;
        stochK.push(kVal);
    }
    
    let stochD = [];
    for (let i = k-1; i < stochK.length; i++) {
        let sum = 0;
        for (let j = 0; j < k; j++) sum += stochK[i - j];
        stochD.push(sum / k);
    }
    
    return { k: stochK, d: stochD, times: times.slice(period * 2) };
}

function calculateADX(data, period = 14) {
    const times = data.map(d => d.time);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    if (closes.length < period + 1) return [];
    
    const tr = [];
    for (let i = 1; i < closes.length; i++) {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i-1]);
        const lc = Math.abs(lows[i] - closes[i-1]);
        tr.push(Math.max(hl, hc, lc));
    }
    
    const plusDM = [], minusDM = [];
    for (let i = 1; i < closes.length; i++) {
        const upMove = highs[i] - highs[i-1];
        const downMove = lows[i-1] - lows[i];
        plusDM.push((upMove > downMove && upMove > 0) ? upMove : 0);
        minusDM.push((downMove > upMove && downMove > 0) ? downMove : 0);
    }
    
    const smoothTR = smoothArray(tr, period);
    const smoothPlusDM = smoothArray(plusDM, period);
    const smoothMinusDM = smoothArray(minusDM, period);
    
    const plusDI = [], minusDI = [], dx = [];
    for (let i = 0; i < smoothTR.length; i++) {
        const diPlus = (smoothPlusDM[i] / smoothTR[i]) * 100;
        const diMinus = (smoothMinusDM[i] / smoothTR[i]) * 100;
        plusDI.push(diPlus);
        minusDI.push(diMinus);
        const diSum = diPlus + diMinus;
        const diDiff = Math.abs(diPlus - diMinus);
        dx.push(diSum === 0 ? 0 : (diDiff / diSum) * 100);
    }
    
    const adx = smoothArray(dx, period);
    const result = [];
    const startIndex = period * 2;
    for (let i = 0; i < adx.length; i++) {
        const timeIndex = startIndex + i;
        if (timeIndex < times.length) {
            result.push({
                time: times[timeIndex],
                value: adx[i],
                plusDI: plusDI[i],
                minusDI: minusDI[i]
            });
        }
    }
    return result;
}

function calculateATR(data, period = 14) {
    const times = data.map(d => d.time);
    const tr = [];
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i-1].close;
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        tr.push(Math.max(tr1, tr2, tr3));
    }
    
    const atr = [];
    for (let i = period - 1; i < tr.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += tr[i - j];
        atr.push({ time: times[i + 1], value: sum / period });
    }
    return atr;
}

function smoothArray(arr, period) {
    const smoothed = [];
    let sum = 0;
    for (let i = 0; i < period && i < arr.length; i++) sum += arr[i];
    smoothed.push(sum / period);
    for (let i = period; i < arr.length; i++) {
        const prev = smoothed[smoothed.length - 1];
        smoothed.push(prev + (arr[i] - prev) / period);
    }
    return smoothed;
}
`;
let indicatorWorker = null;
function initIndicatorWorker() {
    if (indicatorWorker) return indicatorWorker;
    try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        indicatorWorker = new Worker(URL.createObjectURL(blob));
        console.log('✅ Worker индикаторов инициализирован');
        
        indicatorWorker.addEventListener('error', (error) => {
            console.error('❌ Worker ошибка:', error);
        });
        
        return indicatorWorker;
    } catch (error) {
        console.error('❌ Ошибка инициализации Worker:', error);
        return null;
    }
}
if (typeof window !== 'undefined') {
    window.initIndicatorWorker = initIndicatorWorker;
}