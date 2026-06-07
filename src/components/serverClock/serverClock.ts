import {
    TZ,
    getServerNowMs,
    syncServerTime,
} from '../../utils/time.ts';
import { appendStyleElement } from '../../utils/dom.js';
import { getGameTime } from '../../utils/game-time.ts';
import { formatCountdown, getSecondsUntilNextEvent } from '../../utils/events-time.ts';
import { EVENTS } from '../../data/events.ts';
import serverClockStyles from './serverClock.scss';

interface EventInfo {
    title: string;
    secondsUntil: number;
}

export let serverClockEl: HTMLElement | null = null;
export let serverClockStylesInjected: boolean = false;

const loadEventVisibility: () => Record<string, boolean> = () =>
    JSON.parse(localStorage.getItem('tm_aa_ev_vis') || '{}');

const isEventVisible: (ev: { code: string; defaultVisible?: boolean }, vis: Record<string, boolean>) => boolean =
    (ev, vis) => ev.code in vis ? vis[ev.code] : !!ev.defaultVisible;

export const injectServerClockStyles: () => void = () => {
    if (serverClockStylesInjected) return;
    serverClockStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = serverClockStyles;
    appendStyleElement(style);
};

export const getNextVisibleEventInfo: () => EventInfo | null = () => {
    const visOverrides = loadEventVisibility();
    let bestActive: EventInfo | null = null;
    let bestUpcoming: EventInfo | null = null;

    for (const ev of EVENTS as Array<{ code: string; title: string; defaultVisible?: boolean; schedule: Array<{ timeStart: string; timeEnd?: string; weekdays?: number[] }> }>) {
        if (!isEventVisible(ev, visOverrides)) continue;
        const sec = getSecondsUntilNextEvent(ev.schedule);
        if (sec == null) continue;

        if (sec < 0) {
            if (!bestActive || sec > bestActive.secondsUntil) {
                bestActive = { title: ev.title, secondsUntil: sec };
            }
        } else {
            if (!bestUpcoming || sec < bestUpcoming.secondsUntil) {
                bestUpcoming = { title: ev.title, secondsUntil: sec };
            }
        }
    }

    return bestActive || bestUpcoming;
};

export const updateServerClockContent: () => void = () => {
    if (!serverClockEl) return;
    const serverNow = getServerNowMs();
    const d = new Date(serverNow);
    const fmt = new Intl.DateTimeFormat('ru-RU', {
        timeZone: TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const mskTime = fmt.format(d);
    const gameTime = getGameTime(serverNow);

    let eventLine = '';
    const nextEv = getNextVisibleEventInfo();
    if (nextEv) {
        if (nextEv.secondsUntil < 0) {
            eventLine = `<div class="tm-server-clock-event">${nextEv.title}</div><span style="color:#4f8">ещё ${formatCountdown(-nextEv.secondsUntil)}</span>`;
        } else {
            eventLine = `<div class="tm-server-clock-event">${nextEv.title}</div>через ${formatCountdown(nextEv.secondsUntil)}`;
        }
    }

    serverClockEl.innerHTML = `мск: ${mskTime}<br>игровое: ${gameTime}${eventLine}`;
};

export const initServerClock: (
    openEventsPopup: () => void,
    checkEventNotifications?: () => void,
) => Promise<void> = async (openEventsPopup, checkEventNotifications) => {
    await syncServerTime();
    injectServerClockStyles();
    serverClockEl = document.createElement('div');
    serverClockEl.className = 'tm-server-clock';
    serverClockEl.addEventListener('click', openEventsPopup);
    document.body.appendChild(serverClockEl);
    updateServerClockContent();
    setInterval(updateServerClockContent, 1000);
    if (checkEventNotifications) setInterval(checkEventNotifications, 30000);
    if (checkEventNotifications) checkEventNotifications();
};
