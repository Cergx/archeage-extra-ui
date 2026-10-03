(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const path = location.pathname;
    const page = location.hostname === 'gisaa.ru' ? 'gisaa'
        : path.startsWith('/cart') ? 'cart'
        : path.startsWith('/itemrestore') ? 'itemRestore'
        : path.startsWith('/promo/marathon') ? 'marathon'
        : 'archeage';

    import(api.runtime.getURL(`modules/pages/${page}/index.js`)).catch(error => {
        console.error('[ArcheAgeExtraUI] Не удалось загрузить модули расширения:', error);
    });
})();
