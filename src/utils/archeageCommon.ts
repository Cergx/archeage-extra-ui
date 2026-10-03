import { initServerClock } from '../components/serverClock/serverClock.js';
import { initTooltips } from '../components/tooltip/tooltip.js';
import { initSiteTheme } from '../components/siteTheme/siteTheme.js';
import { openEventsPopup, checkEventNotifications, loadNotificationState, saveNotificationState } from '../pages/events/events.js';
import { loadVekselServerIdOverride, saveVekselServerIdOverride, resolveVekselUrl, getVekselAutoOptionText } from '../pages/marathon/core.js';
import { updateRenderedItemIcons } from '../components/itemIcon/itemIcon.js';

export const initArcheageCommon = (): void => {
    initSiteTheme();
    const onReady = (callback: () => void): void => {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
        else callback();
    };
    onReady(initTooltips);
    onReady(() => initServerClock(
        () => openEventsPopup({
            loadVekselServerIdOverride,
            saveVekselServerIdOverride,
            resolveVekselUrl,
            getVekselAutoOptionText,
            loadNotificationState,
            saveNotificationState,
            updateRenderedItemIcons,
        }),
        () => checkEventNotifications({ loadNotificationState, saveNotificationState }),
    ));
};
