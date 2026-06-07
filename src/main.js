// ============================================================
// Entry point — wires together all modules
// ============================================================

import {
    isGisaaSite,
    isArcheageSite,
    isCartPage,
    isItemRestorePage,
} from './utils/env.js';
import { updateCountdownEl, getSecondsUntilNextEvent } from './utils/events-time.js';

import { initGisaa } from './pages/gisaa/gisaa.js';

import { initServerClock } from './components/serverClock/serverClock.js';
import { openEventsPopup, checkEventNotifications, loadNotificationState, saveNotificationState } from './pages/events/events.js';

import { initCart } from './pages/cart/cart.js';
import { initItemRestore } from './pages/itemRestore/itemRestore.js';

import {
    init as initMarathon,
    debugWarn,
    fetchText,
    getUidFromCheckUser,
    loadVekselServerIdOverride,
    saveVekselServerIdOverride,
    resolveVekselUrl,
    getVekselAutoOptionText,
} from './pages/marathon/core.js';
import { initPrizes, initAutoOpenBoxesCheckbox } from './pages/marathon/prizes.js';
import {
    injectItemIconStyles,
    injectSelectedItemsStyles,
    injectMarathonStyles,
    injectCartStyles,
} from './pages/marathon/styles.js';
import { initTooltips, makeItemIconLink } from './components/tooltip/tooltip.js';
import { makeIconLink, updateRenderedItemIcons } from './components/itemIcon/itemIcon.js';

// ============================================================
// ====================== GISAA.RU =============================
// ============================================================

if (isGisaaSite) {
    initGisaa();
}

// ============================================================
// ===================== ARCHEAGE.RU ===========================
// ============================================================

if (!isArcheageSite) {
    // nothing more — exit
} else {
    const injectStyles = () => {
        injectItemIconStyles();
        injectMarathonStyles();
    };

    let countdownIntervalId = null;
    const startCountdownInterval = () => {
        if (countdownIntervalId != null) return;
        countdownIntervalId = setInterval(() => {
            document.querySelectorAll('.tm-countdown').forEach(el => {
                const scheduleJson = el.dataset.schedule;
                if (!scheduleJson) return;
                try {
                    const schedule = JSON.parse(scheduleJson);
                    const seconds = getSecondsUntilNextEvent(schedule);
                    updateCountdownEl(el, seconds);
                } catch {
                    // ignore
                }
            });
        }, 1000);
    };

    // --- Server clock on ALL archeage.ru pages ---
    const openEventsPopupWithDeps = () => openEventsPopup({
        loadVekselServerIdOverride,
        saveVekselServerIdOverride,
        resolveVekselUrl,
        getVekselAutoOptionText,
        loadNotificationState,
        saveNotificationState,
        updateRenderedItemIcons,
    });
    const checkEventNotificationsWithDeps = () => checkEventNotifications({
        loadNotificationState,
        saveNotificationState,
    });
    initServerClock(openEventsPopupWithDeps, checkEventNotificationsWithDeps);

    // --- Page routing ---
    if (isCartPage) {
        const startCart = () => initCart({
            injectItemIconStyles,
            injectSelectedItemsStyles,
            injectCartStyles,
            makeItemIconLink,
            fetchText,
            getUidFromCheckUser,
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startCart);
        } else {
            startCart();
        }
    } else if (isItemRestorePage) {
        initItemRestore({
            injectItemIconStyles,
            injectSelectedItemsStyles,
            makeItemIconLink,
        });
    } else if (location.pathname.startsWith('/promo/marathon')) {
        const observer = new MutationObserver(() => {
            if (document.querySelector('.section.tasks')) {
                observer.disconnect();
                initMarathon({
                    injectStyles,
                    startCountdownInterval,
                    initPrizes,
                    initAutoOpenBoxesCheckbox,
                    makeItemIconLink,
                    makeIconLink,
                });
                initTooltips();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            if (!document.querySelector('.section.tasks')) {
                debugWarn('marathon tasks section did not appear after 10s', {
                    path: location.pathname,
                    sections: [...document.querySelectorAll('section, .section')]
                        .slice(0, 20)
                        .map(el => ({
                            tag: el.tagName,
                            className: el.className,
                            id: el.id,
                            text: el.textContent?.trim().slice(0, 120),
                        })),
                });
            }
        }, 10000);
    }
}
