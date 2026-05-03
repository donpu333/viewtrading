 const TF_LABELS = {
            '1m': '1м', '3m': '3м', '5m': '5м', '15m': '15м', '30m': '30м',
            '1h': '1ч', '4h': '4ч', '6h': '6ч', '12h': '12ч',
            '1d': '1D', '1w': '1W', '1M': '1M'
        };

        const TF_DURATIONS = {
            '1m': 60 * 1000,
            '3m': 3 * 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000
        };
        if (typeof window !== 'undefined') {
    window.TF_LABELS = TF_LABELS;
    window.TF_DURATIONS = TF_DURATIONS;
}