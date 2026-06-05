import {
    TZ,
    getServerNowMs,
    getGameTime,
    formatCountdown,
    getMSKWeekday,
    getMSKTimeOfDaySeconds,
    getSecondsUntilNextEvent,
    setNowMs,
    setServerTimeOffset,
    getNowMs,
    syncServerTime,
} from '../utils.js';
import { EVENTS } from '../data/events.js';
import serverClockStyles from './serverClock.scss';

export let serverClockEl = null;
export let serverClockStylesInjected = false;

const loadEventVisibility = () => JSON.parse(localStorage.getItem('tm_aa_ev_vis') || '{}');
const isEventVisible = (ev, vis) => ev.code in vis ? vis[ev.code] : !!ev.defaultVisible;

export const injectServerClockStyles = () => {
    if (serverClockStylesInjected) return;
    serverClockStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = serverClockStyles;
    document.head.appendChild(style);
};

/** Находит ближайшее видимое событие из таблицы «Расписание событий». */
export const getNextVisibleEventInfo = () => {
    const visOverrides = loadEventVisibility();
    let bestActive = null;
    let bestUpcoming = null;

    for (const ev of EVENTS) {
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

export const updateServerClockContent = () => {
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

export const initServerClock = async (openEventsPopup, checkEventNotifications) => {
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
