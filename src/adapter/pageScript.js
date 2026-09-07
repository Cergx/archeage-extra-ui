/**
 * Скрипт, инжектируемый в основной мир страницы (page context).
 * Перехватывает fetch для itemrestore API и проксирует popup_open/popup_close.
 */
(function() {
    if (window.__tmAA_pageBridge) return;
    window.__tmAA_pageBridge = true;

    const origFetch = window.fetch.bind(window);

    function getVueStore() {
        const roots = [
            document.querySelector('.game__right'),
            document.querySelector('.page'),
            document.body,
        ];
        for (const root of roots) {
            let el = root;
            while (el) {
                const store = el.__vue__ && el.__vue__.$store;
                if (store && typeof store.dispatch === 'function') return store;
                el = el.parentElement;
            }
        }
        return null;
    }

    function claimLevelPrize(level, isPremium, requestId) {
        const store = getVueStore();
        if (!store) {
            send({ type: 'CLAIM_LEVEL_PRIZE_ERROR', requestId, error: 'Vue store not found' });
            return;
        }
        let settled = false;
        const succeed = data => {
            if (settled) return;
            settled = true;
            send({ type: 'CLAIM_LEVEL_PRIZE_SUCCESS', requestId, data });
        };
        const fail = error => {
            if (settled) return;
            settled = true;
            send({ type: 'CLAIM_LEVEL_PRIZE_ERROR', requestId, error: String(error || 'getLevelPrize failed') });
        };
        try {
            const result = store.dispatch('maininfo/getLevelPrize', {
                level,
                is_premium: isPremium ? 1 : 0,
                callback_success: succeed,
                callback_error: fail,
            });
            if (result && typeof result.then === 'function') result.then(succeed, fail);
        } catch (error) {
            fail(error);
        }
    }

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

        // popup_open создаётся скриптами сайта после document_start. Получаем
        // функцию в момент вызова, иначе в расширении остаётся undefined.
        if (event.data.type === 'POPUP_OPEN' && typeof window.popup_open === 'function') {
            window.popup_open(event.data.args?.[0], event.data.args?.[1]);
        }
        if (event.data.type === 'POPUP_CLOSE' && typeof window.popup_close === 'function') {
            window.popup_close();
        }
        if (event.data.type === 'SCROLL_PRIZES') {
            var el = document.querySelector('.game__right');
            var vm = el && el.__vue__;
            if (vm) {
                var perPage = vm.per_on_page || 10;
                vm.current_page = Math.floor((event.data.level - 1) / perPage);
            }
        }
        if (event.data.type === 'CLAIM_LEVEL_PRIZE') {
            claimLevelPrize(event.data.level, event.data.isPremium, event.data.requestId);
        }
    });

    send({ type: 'READY' });
})();
