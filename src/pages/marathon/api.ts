import type { ApiInfoResponse, RefreshApiInfoOptions, DayUtcMs, Segment } from './core.js';
import { NOW_MS, setNowMs, setServerTimeOffset } from '../../utils/time.js';

// ==================== Типы ====================

export interface ApiDeps {
    debugLog: (...args: unknown[]) => void;
    debugWarn: (...args: unknown[]) => void;
    DOM: { refreshLoader: HTMLElement | null };
    autoRefreshIntervalId: { current: ReturnType<typeof setInterval> | null };
    AUTO_REFRESH_INTERVAL_FOCUSED_MS: number;
    AUTO_REFRESH_INTERVAL_HIDDEN_MS: number;
    API_INFO_PATH: string;
    /** Current selection state */
    getSelectedDayUtcMs: () => DayUtcMs | null;
    getSelectedSegment: () => Segment;
    /** Slot key function */
    getSlotKey: (day: DayUtcMs | null, seg: Segment | null) => number;
    /** Today utilities */
    getTodayUtcMsByTZ: () => number;
    getEffectiveSegment: (dayUtcMs: number, seg: Segment) => 'pre' | 'post' | null;
    /** Side effects after refresh */
    applySlot: (day: DayUtcMs, seg: Segment) => void;
    updateQuestHistory: () => void;
    onSelectedDateChanged: () => Promise<void>;
    renderTasksForSelectedDay: (opts?: { animateNewlyDone?: boolean }) => Promise<void>;
}

let deps: ApiDeps | null = null;

export const initApiDeps = (d: ApiDeps): void => { deps = d; };

// ==================== Fetch interceptor ====================

export const normalizeUrlToPath = (url: string | URL): string => {
    try { return new URL(url, location.href).pathname; }
    catch { return String(url || ''); }
};

export const installApiInfoInterceptor = (): void => {
    if ((window as any).__tmAA_fetchPatched) return;
    (window as any).__tmAA_fetchPatched = true;

    const origFetch = window.fetch.bind(window);

    window.fetch = (async (...args) => {
        const input = args[0];
        const urlStr =
            typeof input === 'string' ? input :
                (input && typeof input === 'object' && 'url' in input) ? (input as any).url :
                    String(input);

        const path = normalizeUrlToPath(urlStr);
        const t0 = Date.now();
        const res = await origFetch(...args);
        const t1 = Date.now();

        if (!deps) return res;

        if (path === deps.API_INFO_PATH) {
            if (NOW_MS == null) {
                const dateHeader = res.headers.get('Date');
                const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
                if (Number.isFinite(parsed)) {
                    const halfRtt = (t1 - t0) / 2;
                    setNowMs(parsed + halfRtt);
                }
            }

            if (API_INFO_PROMISE == null) {
                API_INFO_PROMISE = res.clone().json() as Promise<ApiInfoResponse>;
                API_INFO_PROMISE
                    .then((json: ApiInfoResponse) => { API_INFO_CACHE = json; })
                    .catch(() => {});
            }
        }

        return res;
    }) as typeof window.fetch;
};

// ==================== Состояние ====================

export let API_INFO_CACHE: ApiInfoResponse | null = null;
export let API_INFO_PROMISE: Promise<ApiInfoResponse> | null = null;
export let API_INFO_DATA_JSON: string | null = null;
export let isRefreshing: boolean = false;

export const setApiInfoDataJson = (value: string | null): void => { API_INFO_DATA_JSON = value; };

// ==================== API-запросы ====================

export const fetchJson = async <T = unknown>(url: string): Promise<T> => {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json() as Promise<T>;
};

export const fetchText = async (url: string): Promise<string> => {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
};

export const fetchApiInfo = async (): Promise<ApiInfoResponse> => {
    if (!deps) throw new Error('ApiDeps not initialized');
    const t0 = Date.now();
    const res = await fetch(deps.API_INFO_PATH, { credentials: 'include', cache: 'no-store' });
    const t1 = Date.now();
    if (!res.ok) throw new Error(`api/info failed: ${res.status}`);
    const dateHeader = res.headers.get('Date');
    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
    if (Number.isFinite(parsed)) {
        const halfRtt = (t1 - t0) / 2;
        setNowMs(parsed + halfRtt);
    } else if (NOW_MS == null) {
        throw new Error('[ArcheAgeExtraUI] Cannot read server Date header');
    }
    const json = await res.json() as ApiInfoResponse;
    deps.debugLog('api/info loaded', {
        state: json?.state,
        hasData: !!json?.data,
        questContainerType: json?.data?.quests == null ? String(json?.data?.quests) : Array.isArray(json?.data?.quests) ? 'array' : typeof json?.data?.quests,
        questCount: json?.data?.quests && typeof json?.data?.quests === 'object' ? Object.keys(json?.data?.quests).length : 0,
        weekNumber: json?.data?.week_number,
        nextWeekAt: json?.data?.next_week_at,
        serverNowIso: NOW_MS ? new Date(NOW_MS).toISOString() : null,
    });
    return json;
};

export const getApiInfoCached = async (): Promise<ApiInfoResponse> => {
    if (API_INFO_CACHE) return API_INFO_CACHE;
    if (API_INFO_PROMISE) {
        try {
            API_INFO_CACHE = await API_INFO_PROMISE;
            return API_INFO_CACHE;
        } catch {
            // fallback to manual fetch
        }
    }
    API_INFO_CACHE = await fetchApiInfo();
    return API_INFO_CACHE;
};

export const getUidFromCheckUser = async (): Promise<string> => {
    const json = await fetchJson<{ user?: { uid?: string | number } }>('/dynamic/auth/?a=checkuser');
    const uid = json?.user?.uid;
    if (!uid) throw new Error('uid not found');
    return String(uid);
};

// ==================== Refresh + Auto-refresh ====================

export const showRefreshLoader = (): void => {
    if (deps?.DOM.refreshLoader) deps.DOM.refreshLoader.classList.add('tm-refresh-loader--active');
};

export const hideRefreshLoader = (): void => {
    if (deps?.DOM.refreshLoader) deps.DOM.refreshLoader.classList.remove('tm-refresh-loader--active');
};

export const refreshApiInfo = async ({ loadAutoClaimState = () => false, claimAllLevelRewards = async () => {} }: RefreshApiInfoOptions = {}): Promise<void> => {
    if (!deps) return;
    if (isRefreshing) return;
    isRefreshing = true;
    showRefreshLoader();
    try {
        const prevDataJson = API_INFO_DATA_JSON;
        API_INFO_CACHE = null;
        API_INFO_PROMISE = null;
        API_INFO_CACHE = await fetchApiInfo();
        if (NOW_MS !== null) {
            setServerTimeOffset(NOW_MS - Date.now());
        }
        const oldSelectedKey = deps.getSlotKey(deps.getSelectedDayUtcMs(), deps.getSelectedSegment());
        const newTodayUtc = deps.getTodayUtcMsByTZ();
        const newTodaySegment = deps.getEffectiveSegment(newTodayUtc, 'auto');
        const newTodayKey = deps.getSlotKey(newTodayUtc, newTodaySegment);
        const dayChanged = oldSelectedKey !== newTodayKey && oldSelectedKey! < newTodayKey!;
        if (dayChanged) deps.applySlot(newTodayUtc, 'auto');
        const newDataJson = JSON.stringify(API_INFO_CACHE?.data);
        API_INFO_DATA_JSON = newDataJson;
        if (newDataJson === prevDataJson && !dayChanged) return;
        deps.updateQuestHistory();
        if (dayChanged) await deps.onSelectedDateChanged();
        else await deps.renderTasksForSelectedDay({ animateNewlyDone: true });
        if (loadAutoClaimState()) await claimAllLevelRewards();
    } catch (e) {
        deps.debugWarn('refreshApiInfo failed:', e);
    } finally {
        isRefreshing = false;
        hideRefreshLoader();
    }
};

export const stopAutoRefresh = (): void => {
    if (!deps) return;
    if (deps.autoRefreshIntervalId.current != null) {
        clearInterval(deps.autoRefreshIntervalId.current);
        deps.autoRefreshIntervalId.current = null;
    }
};

export const startAutoRefresh = (intervalMs: number): void => {
    if (!deps) return;
    stopAutoRefresh();
    deps.autoRefreshIntervalId.current = setInterval(refreshApiInfo, intervalMs);
};

export const restartAutoRefresh = (): void => {
    if (!deps) return;
    const interval = document.hidden ? deps.AUTO_REFRESH_INTERVAL_HIDDEN_MS : deps.AUTO_REFRESH_INTERVAL_FOCUSED_MS;
    startAutoRefresh(interval);
};
