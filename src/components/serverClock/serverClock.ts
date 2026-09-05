import {
    TZ,
    getServerNowMs,
    syncServerTime,
} from '../../utils/time.ts';
import { appendStyleElement } from '../../utils/dom.js';
import { getGameTime } from '../../utils/gameTime.ts';
import { formatCountdown, getSecondsUntilNextEvent } from '../../utils/eventsTime.ts';
import { EVENTS } from '../../data/events.ts';
import serverClockStyles from './serverClock.scss';

interface EventInfo {
    title: string;
    secondsUntil: number;
}

export let serverClockEl: HTMLElement | null = null;
export let serverClockStylesInjected: boolean = false;

type MarathonStatus = 'guest' | 'trial' | 'premium';

interface MarathonInfoResponse {
    state?: 'Success' | 'Fail';
    data?: {
        user_info?: {
            status?: MarathonStatus;
        };
        quests?: Record<string, {
            end_time?: number;
        }>;
    };
}

const MARATHON_INFO_PATH = '/minigames/marathon_of_heroes/api/info';
const MARATHON_REGISTER_PATH = '/minigames/marathon_of_heroes/api/register';
const MARATHON_PAGE_PATH = '/promo/marathon/';
const MARATHON_STATUS_CACHE_KEY = 'tm_aa_marathon_status';
const MARATHON_STATUS_RECHECK_MS = 12 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_000_000;

interface MarathonStatusCache {
    available: boolean;
    status?: MarathonStatus;
    nextCheckAt: number;
}

let marathonButtonEl: HTMLButtonElement | null = null;
let marathonStatusTimer: ReturnType<typeof setTimeout> | null = null;

const isMarathonPage = (): boolean => location.pathname.startsWith('/promo/marathon');

const fetchMarathonResponse = async (path: string): Promise<MarathonInfoResponse> => {
    const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
    return response.json() as Promise<MarathonInfoResponse>;
};

const loadMarathonStatusCache = (): MarathonStatusCache | null => {
    try {
        const cache = JSON.parse(localStorage.getItem(MARATHON_STATUS_CACHE_KEY) || 'null') as MarathonStatusCache | null;
        return cache && typeof cache.available === 'boolean' && Number.isFinite(cache.nextCheckAt) ? cache : null;
    } catch {
        return null;
    }
};

const saveMarathonStatusCache = (cache: MarathonStatusCache): void => {
    try {
        localStorage.setItem(MARATHON_STATUS_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // ignore
    }
};

const getMarathonEndMs = (info: MarathonInfoResponse): number | null => {
    const endTimes = Object.values(info.data?.quests || {})
        .map(quest => Number(quest.end_time || 0))
        .filter(Number.isFinite)
        .filter(endTime => endTime > 0);
    return endTimes.length ? Math.max(...endTimes) * 1000 : null;
};

const getNextMarathonStatusCheckAt = (info: MarathonInfoResponse): number => {
    const marathonEndMs = getMarathonEndMs(info);
    return marathonEndMs && marathonEndMs > Date.now()
        ? marathonEndMs
        : Date.now() + MARATHON_STATUS_RECHECK_MS;
};

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

const scheduleMarathonStatusCheck = (container: HTMLElement, nextCheckAt: number): void => {
    if (marathonStatusTimer != null) clearTimeout(marathonStatusTimer);
    const delay = Math.max(0, nextCheckAt - Date.now());
    marathonStatusTimer = setTimeout(
        () => {
            if (Date.now() < nextCheckAt) {
                scheduleMarathonStatusCheck(container, nextCheckAt);
                return;
            }
            void initMarathonButton(container, true);
        },
        Math.min(delay, MAX_TIMEOUT_MS),
    );
};

const hideMarathonButton = (): void => {
    marathonButtonEl?.remove();
    marathonButtonEl = null;
};

const initMarathonButton = async (container: HTMLElement, forceCheck = false): Promise<void> => {
    if (isMarathonPage()) return;

    let cache = loadMarathonStatusCache();
    if (!forceCheck && cache && cache.nextCheckAt > Date.now()) {
        if (!cache.available) {
            hideMarathonButton();
            scheduleMarathonStatusCheck(container, cache.nextCheckAt);
            return;
        }
    } else {
        let info: MarathonInfoResponse;
        try {
            info = await fetchMarathonResponse(MARATHON_INFO_PATH);
        } catch {
            cache = { available: false, nextCheckAt: Date.now() + MARATHON_STATUS_RECHECK_MS };
            saveMarathonStatusCache(cache);
            hideMarathonButton();
            scheduleMarathonStatusCheck(container, cache.nextCheckAt);
            return;
        }

        if (info.state !== 'Success' || !info.data?.user_info) {
            cache = { available: false, nextCheckAt: Date.now() + MARATHON_STATUS_RECHECK_MS };
            saveMarathonStatusCache(cache);
            hideMarathonButton();
            scheduleMarathonStatusCheck(container, cache.nextCheckAt);
            return;
        }

        cache = {
            available: true,
            status: info.data.user_info.status,
            nextCheckAt: getNextMarathonStatusCheckAt(info),
        };
        saveMarathonStatusCache(cache);
    }

    if (!cache?.available) return;

    if (!marathonButtonEl) {
        marathonButtonEl = document.createElement('button');
        marathonButtonEl.type = 'button';
        marathonButtonEl.className = 'tm-marathon-button';
        container.appendChild(marathonButtonEl);
    }

    const button = marathonButtonEl;
    const render = (status: MarathonStatus | undefined): void => {
        const isGuest = status === 'guest';
        button.disabled = false;
        button.textContent = isGuest ? 'Начать марафон' : 'Марафон';
        button.onclick = isGuest
            ? async () => {
                button.disabled = true;
                button.textContent = 'Регистрация…';
                try {
                    const registration = await fetchMarathonResponse(MARATHON_REGISTER_PATH);
                    if (registration.state !== 'Success') throw new Error('Marathon registration failed');
                    await initMarathonButton(container, true);
                } catch {
                    button.textContent = 'Начать марафон';
                    button.disabled = false;
                }
            }
            : () => { location.assign(MARATHON_PAGE_PATH); };
    };

    render(cache.status);
    scheduleMarathonStatusCheck(container, cache.nextCheckAt);
};

export const initServerClock: (
    openEventsPopup: () => void,
    checkEventNotifications?: () => void,
) => Promise<void> = async (openEventsPopup, checkEventNotifications) => {
    await syncServerTime();
    injectServerClockStyles();
    const container = document.createElement('div');
    container.className = 'tm-server-clock-container';
    serverClockEl = document.createElement('div');
    serverClockEl.className = 'tm-server-clock';
    serverClockEl.addEventListener('click', openEventsPopup);
    container.appendChild(serverClockEl);
    document.body.appendChild(container);
    updateServerClockContent();
    void initMarathonButton(container);
    setInterval(updateServerClockContent, 1000);
    if (checkEventNotifications) setInterval(checkEventNotifications, 30000);
    if (checkEventNotifications) checkEventNotifications();
};
