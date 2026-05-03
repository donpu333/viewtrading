function safeElement(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`⚠️ Элемент "${id}" не найден в DOM`);
    return el;
}
if (typeof window !== 'undefined') {
    window.safeElement = safeElement;
}