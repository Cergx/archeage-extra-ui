import { updateCountdownEl, getSecondsUntilNextEvent } from '../../utils/eventsTime.js';
import { init as initMarathon, debugWarn } from './core.js';
import { claimAllLevelRewards, initPrizes, initAutoOpenBoxesCheckbox, loadAutoClaimState } from './prizes.js';
import { injectMarathonStyles } from './styles.js';
import { makeItemIconLink } from '../../components/tooltip/tooltip.js';
import { injectItemIconStyles, makeIconLink } from '../../components/itemIcon/itemIcon.js';
import { initArcheageCommon } from '../../utils/archeageCommon.js';

initArcheageCommon();
let countdownIntervalId: ReturnType<typeof setInterval> | null = null;
const startCountdownInterval = (): void => {
    if (countdownIntervalId !== null) return;
    countdownIntervalId = setInterval(() => {
        document.querySelectorAll<HTMLElement>('.tm-countdown').forEach(el => {
            const value = el.dataset.schedule;
            if (!value) return;
            try { updateCountdownEl(el, getSecondsUntilNextEvent(JSON.parse(value))); } catch { /* Ignore malformed page data. */ }
        });
    }, 1000);
};

const start = (): void => {
    if (!document.querySelector('.section.tasks')) return;
    observer.disconnect();
    initMarathon({
        injectStyles: () => { injectItemIconStyles(); injectMarathonStyles(); },
        startCountdownInterval,
        initPrizes,
        initAutoOpenBoxesCheckbox,
        loadAutoClaimState,
        claimAllLevelRewards,
        makeItemIconLink,
        makeIconLink,
    });
};
const observer = new MutationObserver(start);
const observe = (): void => {
    observer.observe(document.body, { childList: true, subtree: true });
    start();
};
if (document.body) observe();
else document.addEventListener('DOMContentLoaded', observe, { once: true });
setTimeout(() => {
    if (!document.querySelector('.section.tasks')) debugWarn('marathon tasks section did not appear after 10s', { path: location.pathname });
}, 10_000);
