import { appendStyleElement } from '../../utils/dom.js';
import marathonButtonStyles from './marathonButton.scss';

type MarathonStatus = 'guest' | 'trial' | 'premium';

interface MarathonInfoResponse {
    state?: 'Success' | 'Fail';
    data?: {
        user_info?: {
            status?: MarathonStatus;
            week_exp?: number;
        };
        action_info?: {
            increase_max_exp_per_week?: number;
        };
        next_week_at?: number;
        quests?: Record<string, {
            end_time?: number;
        }>;
    };
}

interface MarathonStatusCache {
    available: boolean;
    status?: MarathonStatus;
    weekExp?: number;
    maxWeekExp?: number;
    marathonEndAt?: number;
    nextCheckAt: number;
}

const marathonInfoPath = '/minigames/marathon_of_heroes/api/info';
const marathonRegisterPath = '/minigames/marathon_of_heroes/api/register';
const marathonPagePath = '/promo/marathon/';
const marathonStatusCacheKey = 'tm_aa_marathon_status';
const marathonStatusRecheckMs = 12 * 60 * 60 * 1000;
const marathonUnavailableRecheckMs = 60 * 60 * 1000;
const maxTimeoutMs = 2_147_000_000;

let marathonButtonEl: HTMLButtonElement | null = null;
let marathonStatusTimer: ReturnType<typeof setTimeout> | null = null;
let marathonButtonStylesInjected = false;

const injectMarathonButtonStyles = (): void => {
    if (marathonButtonStylesInjected) return;
    marathonButtonStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = marathonButtonStyles;
    appendStyleElement(style);
};

const isMarathonPage = (): boolean => location.pathname.startsWith('/promo/marathon');

const fetchMarathonResponse = async (path: string): Promise<MarathonInfoResponse> => {
    const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
    return response.json() as Promise<MarathonInfoResponse>;
};

const loadMarathonStatusCache = (): MarathonStatusCache | null => {
    try {
        const cache = JSON.parse(localStorage.getItem(marathonStatusCacheKey) || 'null') as MarathonStatusCache | null;
        return cache && typeof cache.available === 'boolean' && Number.isFinite(cache.nextCheckAt) ? cache : null;
    } catch {
        return null;
    }
};

const saveMarathonStatusCache = (cache: MarathonStatusCache): void => {
    try {
        localStorage.setItem(marathonStatusCacheKey, JSON.stringify(cache));
    } catch {
        // ignore
    }
};

const getMarathonEndAt = (info: MarathonInfoResponse): number | null => {
    const endTimes = Object.values(info.data?.quests || {})
        .map(quest => Number(quest.end_time || 0))
        .filter(Number.isFinite)
        .filter(endTime => endTime > 0);
    return endTimes.length ? Math.max(...endTimes) * 1000 : null;
};

const getNextMarathonStatusCheckAt = (info: MarathonInfoResponse, marathonEndAt: number | null): number => {
    const now = Date.now();
    const nextWeekMs = Number(info.data?.next_week_at || 0) * 1000;
    const nextChecks = [marathonEndAt, nextWeekMs]
        .filter((time): time is number => Number.isFinite(time) && time > now);
    return nextChecks.length ? Math.min(...nextChecks) : now + marathonStatusRecheckMs;
};

const isActiveMarathonCache = (cache: MarathonStatusCache | null): cache is MarathonStatusCache =>
    !!cache?.available && (!Number.isFinite(cache.marathonEndAt) || cache.marathonEndAt > Date.now());

const preserveAvailableMarathonCache = (sidePanel: HTMLElement, cache: MarathonStatusCache): void => {
    cache.nextCheckAt = Date.now() + marathonUnavailableRecheckMs;
    saveMarathonStatusCache(cache);
    renderMarathonButton(sidePanel, cache);
    scheduleMarathonStatusCheck(sidePanel, cache.nextCheckAt);
};

const scheduleMarathonStatusCheck = (sidePanel: HTMLElement, nextCheckAt: number): void => {
    if (marathonStatusTimer != null) clearTimeout(marathonStatusTimer);
    const delay = Math.max(0, nextCheckAt - Date.now());
    marathonStatusTimer = setTimeout(
        () => {
            if (Date.now() < nextCheckAt) {
                scheduleMarathonStatusCheck(sidePanel, nextCheckAt);
                return;
            }
            void initMarathonButton(sidePanel, true);
        },
        Math.min(delay, maxTimeoutMs),
    );
};

const hideMarathonButton = (): void => {
    marathonButtonEl?.remove();
    marathonButtonEl = null;
};

const renderMarathonButton = (sidePanel: HTMLElement, cache: MarathonStatusCache): void => {
    injectMarathonButtonStyles();
    if (!marathonButtonEl) {
        marathonButtonEl = document.createElement('button');
        marathonButtonEl.type = 'button';
        marathonButtonEl.className = 'tm-marathon-button';
        sidePanel.appendChild(marathonButtonEl);
    }

    const button = marathonButtonEl;
    const isGuest = cache.status === 'guest';
    button.disabled = false;
    const weekExp = Number(cache.weekExp);
    const maxWeekExp = Number(cache.maxWeekExp);
    const hasWeekProgress = Number.isFinite(weekExp) && Number.isFinite(maxWeekExp) && maxWeekExp > 0;
    button.textContent = isGuest
        ? 'Начать марафон'
        : hasWeekProgress ? `Марафон (${weekExp}/${maxWeekExp})` : 'Марафон';
    button.onclick = isGuest
        ? async () => {
            button.disabled = true;
            button.textContent = 'Регистрация…';
            try {
                const registration = await fetchMarathonResponse(marathonRegisterPath);
                if (registration.state !== 'Success') throw new Error('Marathon registration failed');
                await initMarathonButton(sidePanel, true);
            } catch {
                button.textContent = 'Начать марафон';
                button.disabled = false;
            }
        }
        : () => { location.assign(marathonPagePath); };
};

export const initMarathonButton = async (sidePanel: HTMLElement, forceCheck = false): Promise<void> => {
    if (isMarathonPage()) return;

    let cache = loadMarathonStatusCache();
    if (isActiveMarathonCache(cache)) {
        renderMarathonButton(sidePanel, cache);
    } else {
        if (cache?.available) {
            cache.available = false;
            saveMarathonStatusCache(cache);
        }
        hideMarathonButton();
        if (!forceCheck && cache && cache.nextCheckAt > Date.now()) {
            scheduleMarathonStatusCheck(sidePanel, cache.nextCheckAt);
            return;
        }
    }

    let info: MarathonInfoResponse;
    try {
        info = await fetchMarathonResponse(marathonInfoPath);
    } catch {
        if (isActiveMarathonCache(cache)) {
            preserveAvailableMarathonCache(sidePanel, cache);
            return;
        }
        cache = { available: false, nextCheckAt: Date.now() + marathonUnavailableRecheckMs };
        saveMarathonStatusCache(cache);
        hideMarathonButton();
        scheduleMarathonStatusCheck(sidePanel, cache.nextCheckAt);
        return;
    }

    if (info.state !== 'Success') {
        if (isActiveMarathonCache(cache)) {
            preserveAvailableMarathonCache(sidePanel, cache);
            return;
        }
        cache = { available: false, nextCheckAt: Date.now() + marathonUnavailableRecheckMs };
        saveMarathonStatusCache(cache);
        hideMarathonButton();
        scheduleMarathonStatusCheck(sidePanel, cache.nextCheckAt);
        return;
    }

    const marathonEndAt = getMarathonEndAt(info);
    cache = {
        available: marathonEndAt == null || marathonEndAt > Date.now(),
        status: info.data?.user_info?.status ?? 'guest',
        weekExp: Number(info.data?.user_info?.week_exp || 0),
        maxWeekExp: Number(info.data?.action_info?.increase_max_exp_per_week || 100),
        marathonEndAt: marathonEndAt ?? undefined,
        nextCheckAt: getNextMarathonStatusCheckAt(info, marathonEndAt),
    };
    saveMarathonStatusCache(cache);
    if (!cache.available) {
        hideMarathonButton();
        return;
    }
    renderMarathonButton(sidePanel, cache);
    scheduleMarathonStatusCheck(sidePanel, cache.nextCheckAt);
};
