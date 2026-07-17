/**
 * Скрипт, инжектируемый в основной мир страницы (page context).
 * Перехватывает fetch для itemrestore API и проксирует popup_open/popup_close.
 */
(function() {
    if (window.__tmAA_pageBridge) return;
    window.__tmAA_pageBridge = true;

    const origFetch = window.fetch.bind(window);
    const origPopupOpen = window.popup_open;
    const origPopupClose = window.popup_close;

    function send(msg) {
        window.postMessage({ source: 'tmAA-page', ...msg }, '*');
    }

    // Перехват itemrestore API
    const intercepted = { grades: null, info: null, items: null };
    let count = 0;

    window.fetch = async function(...args) {
        const res = await origFetch(...args);
        const urlStr = typeof args[0] === 'string' ? args[0] : String(args[0]?.url || args[0]);

        if (urlStr.includes('a=get_item_grades')) {
            intercepted.grades = await res.clone().json();
            count++;
        } else if (urlStr.includes('a=get_restore_info')) {
            intercepted.info = await res.clone().json();
            count++;
        } else if (urlStr.includes('a=get_user_items')) {
            intercepted.items = await res.clone().json();
            count++;
        }

        if (count >= 3) {
            count = -1;
            send({ type: 'IR_DATA', body: JSON.parse(JSON.stringify(intercepted)) });
        }

        return res;
    };

    // popup_open / popup_close + scroll prizes
    window.addEventListener('message', function(event) {
        if (event.data?.source !== 'tmAA-cs') return;

        if (event.data.type === 'POPUP_OPEN' && typeof origPopupOpen === 'function') {
            origPopupOpen(event.data.args?.[0], event.data.args?.[1]);
        }
        if (event.data.type === 'POPUP_CLOSE' && typeof origPopupClose === 'function') {
            origPopupClose();
        }
        if (event.data.type === 'SCROLL_PRIZES') {
            var el = document.querySelector('.game__right');
            var vm = el && el.__vue__;
            if (vm) {
                var perPage = vm.per_on_page || 10;
                vm.current_page = Math.floor((event.data.level - 1) / perPage);
            }
        }
    });

    send({ type: 'READY' });
})();
