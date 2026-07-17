import {
    pad2,
    nowMs,
    getMSKDatePartsFromUtcMs,
    formatTimeMSK,
    dayUtcMsFromUnixByTZ,
    getTodayUtcMsByTZ,
    addDaysUtcMs,
    getDayBoundsUnix,
    getUnixForDayAtHour,
    isSameDayByTZ,
    isThursdayByTZ,
    initServerTimeOffset,
    getNowUnix,
} from '../../utils/time.js';
import { makeGisaaVekselKey, getSavedGisaaVekselInfo, getSavedGisaaTablesSnapshot } from '../../utils/gisaa.js';
import {
    ICON_GISAA_OVERLAY,
    VEKSEL_BASE,
    findQuestMetaForMarathonQuest,
} from '../../data/quests.js';
import { SERVERS } from '../../data/servers.js';
import type { ItemBase } from '../../data/items.js';
import { makeTaskCard } from '../../components/taskCard/taskCard.js';
import { updateLevelBlock } from '../../components/levelBlock/levelBlock.js';
import { initDateNavDeps, ensureDateNavInHeader, updateDateNavLabel, updateDateNavButtons } from '../../components/dateNav/dateNav.js';
import {
    initApiDeps,
    API_INFO_CACHE,
    API_INFO_PROMISE,
    API_INFO_DATA_JSON,
    isRefreshing,
    fetchJson,
    fetchText,
    fetchApiInfo,
    getApiInfoCached,
    getUidFromCheckUser,
    refreshApiInfo,
    startAutoRefresh,
    stopAutoRefresh,
    restartAutoRefresh,
    showRefreshLoader,
    hideRefreshLoader,
    setApiInfoDataJson,
} from './api.js';

export { formatTimeMSK };
export {
    initApiDeps,
    API_INFO_CACHE,
    API_INFO_PROMISE,
    API_INFO_DATA_JSON,
    isRefreshing,
    fetchJson,
    fetchText,
    fetchApiInfo,
    getApiInfoCached,
    getUidFromCheckUser,
    refreshApiInfo,
    startAutoRefresh,
    stopAutoRefresh,
    restartAutoRefresh,
    showRefreshLoader,
    hideRefreshLoader,
};

// ==================== Константы ====================

export const DONE_CLASS: string = 'tm-task-completed';
export const JUST_DONE_CLASS: string = 'tm-task-just-completed';
// TZ, MSK_OFFSET_HOURS → imported from utils.js
export const THU_PRE_HOUR: number = 3;
export const DEFAULT_HOUR: number = 16;
export const LS_KEYS: Record<string, string> = {
    HIDE_DONE: 'tm_aa_hide_done',
    AUTO_CLAIM: 'tm_aa_auto_claim',
    QUEST_HISTORY: 'tm_aa_qh',
    AUTO_OPEN_BOXES: 'tm_aa_auto_open_boxes',
    IR_PER_PAGE: 'tm_aa_ir_per_page',
    EVENT_VISIBILITY: 'tm_aa_ev_vis',
    VEKSEL_SERVER_ID: 'tm_aa_veksel_server_id',
    ICON_SEX: 'tm_aa_icon_sex',
    NOTIFICATIONS: 'tm_aa_notifications',
    DYNAMIC_TOOLTIPS: 'tm_aa_dynamic_tooltips',
    ITEM_RESTORE_ITEMS: 'tm_aa_itemrestore_items',
};
export const HISTORY_MAX_ENTRIES: number = 500;
export const HISTORY_PER_PAGE: number = 10;
export const DEBUG_PREFIX: string = '[ArcheAgeExtraUI]';
export const DEBUG_ENABLED: boolean = true;

export const debugLog = (...args: unknown[]): void => {
    if (DEBUG_ENABLED) console.log(DEBUG_PREFIX, ...args);
};

export const debugWarn = (...args: unknown[]): void => {
    console.warn(DEBUG_PREFIX, ...args);
};
export const DAY_RESET_HOUR: number = 0;
export const CLAIM_DELAY_MS: number = 400;

// ==================== Типы API ====================

export type DayUtcMs = number;
export type Segment = 'pre' | 'post' | 'auto' | null;
export type EffectiveSegment = 'pre' | 'post' | null;

export interface ApiRewardValue {
    amount?: number;
    id?: number;
    count?: number;
    site_count?: number;
    code?: string;
}

export interface ApiReward {
    type: 'moh_experience' | 'cart_item' | 'currency' | string;
    value: ApiRewardValue;
    /** Название (для `cart_item`). */
    title?: string;
}

export interface ApiQuestStep {
    id: number;
    target: number;
    rewards: ApiReward[];
}

export interface ApiQuest {
    /** ID задания марафона. */
    id: number;
    /** Код задания марафона. */
    code: string;
    type: string;
    group: string;
    /** Время окончания задания. */
    end_time: number;
    /** Время начала задания. */
    start_time: number;
    time_status: 'now' | 'future' | 'past';
    max_completed_step: number;
    progress: number;
    max_target: number;
    /** Заголовок марафона. */
    title: string;
    /** Описание задания марафона. */
    description: string;
    payload: unknown[];
    reset_time: number | null;
    stop_time: number | null;
    last_complete_time: number;
    steps: Record<string, ApiQuestStep>;
}

export interface ApiUserInfo {
    level: number;
    status: 'trial' | 'premium';
    count_boxes_for_open: number;
    week_exp: number;
    exp_total: number;
    farmed_rewards: Record<string, string[]>;
}

export interface ApiActionInfo {
    count_levels_for_box: number;
    exp_for_level: number;
    increase_max_exp_per_week: number;
    level_prizes: Record<string, Record<string, ApiReward[]>>;
    box_rewards: ApiReward[];
}

export interface ApiInfoData {
    user_info: ApiUserInfo;
    quests: Record<string, ApiQuest>;
    week_number: number;
    next_week_at: number;
    action_info: ApiActionInfo;
    pins: unknown[];
    prices: Record<string, Record<string, number>>;
}

export interface ApiInfoResponse {
    data: ApiInfoData;
    meta: unknown;
    state: 'Success' | 'Fail';
}

export interface HistoryEntry {
    code: string;
    /** unix timestamp (last_complete_time) */
    completedAt: number;
}

export interface SlotPosition {
    dayUtcMs: DayUtcMs;
    segment: Segment;
}

export interface Slot {
    /** Предмет. */
    item: ItemBase;
    /** Количество предмета. */
    count?: number;
}

export interface EventSchedule {
    /** Время начала события (HH:MM). */
    timeStart: string;
    /** Время окончания события (HH:MM). Если указано — событие длится диапазон. */
    timeEnd?: string;
    /** Дни недели (1–7), если не каждый день. */
    weekdays?: number[];
    /** Примерная длительность события (в минутах). */
    duration?: number;
}

export interface MarathonQuestMeta {
    id: number;
    title: string;
    marathonId: number[];
    short: string;
    veksel?: VekselType;
    locations?: string[];
    availableWeekdays?: number[];
    slot?: Slot;
    schedule?: EventSchedule[];
}

export interface CartItem {
    /** Название предмета. */
    title: string;
    /** Количество. */
    count: number;
    /** Дата получения. */
    date: Date;
    /** ID предмета (из data-item чекбокса). */
    itemId: string;
    /** Название акции. */
    campaign: string;
    /** Заблокирован (таймер передачи). */
    disabled: boolean;
    /** Текст таймера ("Можно передать через: XXX мин."). */
    timerText: string;
}

export interface CartCharacter {
    /** Имя персонажа. */
    name: string;
    /** Название сервера. */
    server: string;
    /** Значение radio (для отправки формы). */
    value: string;
    /** Доступен для выбора. */
    enabled: boolean;
}

export type VekselType = 'blue_salt' | 'north';
export type VekselTypeMaybe = VekselType | undefined;
export type MakeItemIconLink = (params: { item: ItemBase; linked?: boolean; size?: string; count?: number | string; noTooltip?: boolean }) => HTMLElement;
export type MakeIconLink = (params: { href: string; iconSrc: string; title?: string; className?: string }) => HTMLElement;

export interface DOMCache {
    nav: HTMLDivElement | null;
    label: HTMLDivElement | null;
    prevBtn: HTMLButtonElement | null;
    nextBtn: HTMLButtonElement | null;
    todayBtn: HTMLButtonElement | null;
    hideDoneCheckbox: HTMLInputElement | null;
    refreshLoader: HTMLButtonElement | null;
    tasksHeader: Element | null;
    tasksList: Element | null;
}

export interface SlotBoundsUnix {
    start: number;
    end: number;
}

export interface QuestDebugSummary {
    id: number;
    code: string;
    title: string;
    group: string;
    type: string;
    time_status: ApiQuest['time_status'];
    start_time: number;
    start_iso: string | null;
    end_time: number;
    end_iso: string | null;
    progress: number;
    max_completed_step: number;
    reward: number;
    known_meta: boolean;
}

export type GisaaRowStatus = 'match' | 'unknown' | 'exclude';

export interface GisaaStatusRow {
    location: string;
    status: GisaaRowStatus;
}

export interface GisaaInfo {
    status: 'available' | 'unavailable';
    locations: string[];
    unknownLocations: string[];
    excludedLocations: string[];
}

export interface MakeVekselIconLinkParams {
    href: string;
    title?: string;
    vekselIcon: string;
}

export interface MakeLinksRowParams {
    id: number | null;
    short: string;
    questTitle: string;
    slot?: Slot | null;
    veksel?: VekselType;
    locations?: string[];
    availableWeekdays?: number[];
    schedule?: EventSchedule[];
    makeItemIconLink: MakeItemIconLink;
    makeIconLink: MakeIconLink;
}

export interface MakeTaskCardParams extends MakeLinksRowParams {
    q: ApiQuest;
    amount: number;
    isDone: boolean;
    showLastDone: boolean;
    completionTime?: number;
    isToday: boolean;
    animateCompletion?: boolean;
}

export interface TaskCardFactories {
    makeItemIconLink: MakeItemIconLink | null;
    makeIconLink: MakeIconLink | null;
}

export interface RenderTasksOptions {
    animateNewlyDone?: boolean;
    makeItemIconLink?: MakeItemIconLink | null;
    makeIconLink?: MakeIconLink | null;
}

export interface RefreshApiInfoOptions {
    loadAutoClaimState?: () => boolean;
    claimAllLevelRewards?: () => Promise<void>;
}

export interface InitOptions {
    injectStyles?: () => void;
    startCountdownInterval?: () => void;
    initPrizes?: () => Promise<void>;
    initAutoOpenBoxesCheckbox?: () => void;
    makeItemIconLink?: MakeItemIconLink;
    makeIconLink?: MakeIconLink;
}

export interface PaginationPageItemParams {
    page: number;
    text: string;
    className: string;
    disabled: boolean;
    onClick: (page: number) => void;
}

// ==================== Состояние ====================

export let selectedDayUtcMs: DayUtcMs | null = null;
export let selectedSegment: Segment = 'auto';

// NOW_MS, SERVER_TIME_OFFSET → imported from utils.js
export const autoRefreshIntervalRef: { current: ReturnType<typeof setInterval> | null } = { current: null };

/** ID квестов, которые были выполнены на прошлой отрисовке */
export let previouslyDoneQuestIds: Set<number> = new Set();

export let MIN_DAY_UTC_MS: DayUtcMs | null = null;
export let MAX_DAY_UTC_MS: DayUtcMs | null = null;
export let MIN_SEG: Segment = null;
export let MAX_SEG: Segment = null;

export const DOM: DOMCache = {
    nav: null,
    label: null,
    prevBtn: null,
    nextBtn: null,
    todayBtn: null,
    hideDoneCheckbox: null,
    refreshLoader: null,
    tasksHeader: null,
    tasksList: null,
};

export const clearDOMCache = (): void => {
    for (const key of Object.keys(DOM) as (keyof DOMCache)[]) {
        DOM[key] = null;
    }
};

// ==================== Форматирование title квеста ====================

export const toRoman = (num: number): string => {
    const numerals: [string, number][] = [
        ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
        ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
        ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
    ];
    let result = '';
    for (const [roman, value] of numerals) {
        while (num >= value) {
            result += roman;
            num -= value;
        }
    }
    return result;
};

export const formatQuestTitle = (title: string): string => {
    if (!title) return '';
    let result = title.replace(/\*+$/, '');
    const match = result.match(/(\s*)(\d+)$/);
    if (match) {
        const num = parseInt(match[2], 10);
        if (num > 0 && num < 100) {
            const roman = toRoman(num);
            result = result.slice(0, -match[0].length) + ' ' + roman;
        }
    }
    return result.trim();
};

// ==================== LocalStorage для "Скрыть выполненные" ====================

export const getHideDoneDayKey = (): string => {
    const ms = nowMs();
    const shiftedMs = ms - DAY_RESET_HOUR * 3600 * 1000;
    const { y, m, d } = getMSKDatePartsFromUtcMs(shiftedMs);
    return `${y}-${pad2(m)}-${pad2(d)}`;
};

export const loadHideDoneState = (): boolean => {
    try {
        const raw = localStorage.getItem(LS_KEYS.HIDE_DONE);
        if (!raw) return false;
        const data = JSON.parse(raw) as { dayKey?: string; checked?: boolean };
        if (data.dayKey !== getHideDoneDayKey()) return false;
        return !!data.checked;
    } catch {
        return false;
    }
};

export const saveHideDoneState = (checked: boolean): void => {
    try {
        localStorage.setItem(LS_KEYS.HIDE_DONE, JSON.stringify({
            checked,
            dayKey: getHideDoneDayKey(),
        }));
    } catch {
        // ignore
    }
};

// ==================== История выполнений заданий ====================

export const loadAllQuestHistory = (): Record<string, HistoryEntry[]> => {
    try {
        return (JSON.parse(localStorage.getItem(LS_KEYS.QUEST_HISTORY) || 'null') as Record<string, HistoryEntry[]> | null) || {};
    } catch {
        return {};
    }
};

/** UID текущего пользователя; заполняется при инициализации. */
export let cachedUid: string | null = null;
export let historyCurrentPage: number = 1;
export let historyEntries: HistoryEntry[] = [];

/**
 * Читает историю из localStorage, мержит новые записи из API и сохраняет обратно.
 */
export const mergeQuestHistory = (quests: ApiQuest[]): HistoryEntry[] => {
    if (!cachedUid) return [];
    const all = loadAllQuestHistory();
    const history = all[cachedUid] || [];
    const existing = new Set(history.map(e => `${e.code}:${e.completedAt}`));

    for (const q of quests) {
        const t = Number(q.last_complete_time || 0);
        if (!t) continue;
        const key = `${q.code}:${t}`;
        if (existing.has(key)) continue;
        history.push({ code: q.code, completedAt: t });
        existing.add(key);
    }

    history.sort((a, b) => b.completedAt - a.completedAt);
    if (history.length > HISTORY_MAX_ENTRIES) history.length = HISTORY_MAX_ENTRIES;

    try {
        all[cachedUid] = history;
        localStorage.setItem(LS_KEYS.QUEST_HISTORY, JSON.stringify(all));
    } catch {
        // ignore
    }

    return history;
};

/** Форматирует unix-секунды в строку «DD.MM.YYYY HH:MM» (МСК). */
export const formatDateTimeMSK = (unixSec: number): string => {
    if (!unixSec) return '';
    const ms = unixSec * 1000;
    const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
    const time = formatTimeMSK(unixSec);
    return `${pad2(d)}.${pad2(m)}.${y} ${time}`;
};

/** Перерисовывает таблицу истории выполнений в DOM. */
export const renderHistoryTable = (): void => {
    const section = document.querySelector('section.history-events');
    if (!section) return;
    const layout = section.querySelector('.layout');
    if (!layout) return;
    const oldWrap = layout.querySelector('.table__wrap');
    if (oldWrap) oldWrap.remove();
    if (!historyEntries.length) return;

    const totalPages = Math.ceil(historyEntries.length / HISTORY_PER_PAGE);
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    const start = (historyCurrentPage - 1) * HISTORY_PER_PAGE;
    const pageItems = historyEntries.slice(start, start + HISTORY_PER_PAGE);
    const questsMap = API_INFO_CACHE?.data?.quests || {};

    const table = document.createElement('table');
    table.className = 'table table--history_events';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Дата</th><th>Задание</th><th>Опыт</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const entry of pageItems) {
        const tr = document.createElement('tr');
        const tdDate = document.createElement('td');
        tdDate.textContent = formatDateTimeMSK(entry.completedAt);
        tr.appendChild(tdDate);
        const tdTitle = document.createElement('td');
        tdTitle.textContent = questsMap[entry.code]?.description || entry.code;
        tr.appendChild(tdTitle);
        const tdReward = document.createElement('td');
        const quest = questsMap[entry.code];
        if (quest) {
            const span = document.createElement('span');
            span.className = 'table__status';
            const dots = Math.max(1, getRewardAmount(quest));
            for (let i = 0; i < dots; i++) {
                const dot = document.createElement('div');
                dot.className = 'icon-point icon-point--received';
                span.appendChild(dot);
            }
            tdReward.appendChild(span);
        }
        tr.appendChild(tdReward);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const wrap = document.createElement('div');
    wrap.className = 'table__wrap';
    wrap.appendChild(table);

    if (totalPages > 1) {
        const ul = document.createElement('ul');
        ul.className = 'pagination';
        const makePageItem = (page: number, text: string, className: string, disabled: boolean, onClick: (page: number) => void): HTMLLIElement => {
            const li = document.createElement('li');
            li.className = 'pagination__item' + (className ? ' ' + className : '') + (disabled ? ' disabled' : '');
            li.textContent = text;
            li.addEventListener('click', () => { if (!disabled) onClick(page); });
            return li;
        };
        const makeEllipsisItem = (): HTMLLIElement => {
            const li = document.createElement('li');
            li.className = 'pagination__item pagination__item--ellipsis disabled';
            li.textContent = '...';
            return li;
        };
        const maxVisiblePages = 9;
        let firstPage = Math.max(1, historyCurrentPage - 4);
        let lastPage = Math.min(totalPages, historyCurrentPage + 4);
        if (lastPage - firstPage + 1 < maxVisiblePages) {
            if (firstPage === 1) lastPage = Math.min(totalPages, firstPage + maxVisiblePages - 1);
            else if (lastPage === totalPages) firstPage = Math.max(1, lastPage - maxVisiblePages + 1);
        }
        const firstLi = makePageItem(1, '«', 'pagination__item--first', historyCurrentPage <= 1, () => {
            historyCurrentPage = 1;
            renderHistoryTable();
        });
        firstLi.title = 'Первая страница';
        ul.appendChild(firstLi);
        const prevLi = document.createElement('li');
        prevLi.className = 'pagination__item pagination__item--prev' + (historyCurrentPage <= 1 ? ' disabled' : '');
        prevLi.title = 'Предыдущая страница';
        prevLi.innerHTML = '<i class="icons-arrow"></i>';
        prevLi.addEventListener('click', () => {
            if (historyCurrentPage > 1) {
                historyCurrentPage--;
                renderHistoryTable();
            }
        });
        ul.appendChild(prevLi);
        if (firstPage > 1) ul.appendChild(makeEllipsisItem());
        for (let p = firstPage; p <= lastPage; p++) {
            const li = document.createElement('li');
            li.className = 'pagination__item' + (p === historyCurrentPage ? ' active' : '');
            li.textContent = String(p);
            li.addEventListener('click', () => {
                historyCurrentPage = p;
                renderHistoryTable();
            });
            ul.appendChild(li);
        }
        if (lastPage < totalPages) ul.appendChild(makeEllipsisItem());
        const nextLi = document.createElement('li');
        nextLi.className = 'pagination__item pagination__item--next' + (historyCurrentPage >= totalPages ? ' disabled' : '');
        nextLi.title = 'Следующая страница';
        nextLi.innerHTML = '<i class="icons-arrow"></i>';
        nextLi.addEventListener('click', () => {
            if (historyCurrentPage < totalPages) {
                historyCurrentPage++;
                renderHistoryTable();
            }
        });
        ul.appendChild(nextLi);
        const lastLi = makePageItem(totalPages, '»', 'pagination__item--last', historyCurrentPage >= totalPages, () => {
            historyCurrentPage = totalPages;
            renderHistoryTable();
        });
        lastLi.title = 'Последняя страница';
        ul.appendChild(lastLi);
        wrap.appendChild(ul);
    }

    layout.appendChild(wrap);
};

export const updateQuestHistory = (): void => {
    if (!API_INFO_CACHE) return;
    try {
        const quests = getQuestsArrayFromInfo(API_INFO_CACHE);
        historyEntries = mergeQuestHistory(quests);
    } catch (e) {
        console.warn('[ArcheAgeExtraUI] updateQuestHistory failed:', e);
    }
    renderHistoryTable();
};

// ==================== Слоты и сегменты (четверг pre/post) ====================

export const slotKey = (dayUtcMs: DayUtcMs | null, segment: Segment): number => {
    if (dayUtcMs == null) return 0;
    const seg = segment === 'pre' ? 0 : segment === 'post' ? 2 : 1;
    return dayUtcMs * 10 + seg;
};

export const normalizeSegmentForDay = (dayUtcMs: DayUtcMs, seg: Segment): Segment => {
    if (!isThursdayByTZ(dayUtcMs)) return null;
    if (seg === 'pre' || seg === 'post' || seg === 'auto') return seg;
    return 'post';
};

export const effectiveSegment = (dayUtcMs: DayUtcMs, seg: Segment): EffectiveSegment => {
    if (!isThursdayByTZ(dayUtcMs)) return null;
    if (seg === 'pre' || seg === 'post') return seg;
    const todayUtc = getTodayUtcMsByTZ();
    const isToday = isSameDayByTZ(dayUtcMs, todayUtc);
    if (!isToday) return 'post';
    const { start } = getDayBoundsUnix(dayUtcMs);
    const cut = start + 9 * 3600;
    return getNowUnix() < cut ? 'pre' : 'post';
};

export const getSlotBoundsUnix = (dayUtcMs: DayUtcMs, seg: Segment): SlotBoundsUnix => {
    const { start, end } = getDayBoundsUnix(dayUtcMs);
    if (!isThursdayByTZ(dayUtcMs)) return { start, end };
    const cut = start + 9 * 3600;
    const s = effectiveSegment(dayUtcMs, seg);
    if (s === 'pre') return { start, end: cut };
    return { start: cut, end };
};

export const getPrevSlot = (dayUtcMs: DayUtcMs, seg: Segment): SlotPosition => {
    const isThu = isThursdayByTZ(dayUtcMs);
    if (isThu) {
        if (seg === 'post') return { dayUtcMs, segment: 'pre' };
        if (seg === 'pre') {
            const prevDay = addDaysUtcMs(dayUtcMs, -1);
            return { dayUtcMs: prevDay, segment: normalizeSegmentForDay(prevDay, null) };
        }
        return { dayUtcMs, segment: 'pre' };
    }
    const prevDay = addDaysUtcMs(dayUtcMs, -1);
    if (isThursdayByTZ(prevDay)) return { dayUtcMs: prevDay, segment: 'post' };
    return { dayUtcMs: prevDay, segment: null };
};

export const getNextSlot = (dayUtcMs: DayUtcMs, seg: Segment): SlotPosition => {
    const isThu = isThursdayByTZ(dayUtcMs);
    if (isThu) {
        if (seg === 'pre') return { dayUtcMs, segment: 'post' };
        if (seg === 'post') {
            const nextDay = addDaysUtcMs(dayUtcMs, +1);
            return { dayUtcMs: nextDay, segment: normalizeSegmentForDay(nextDay, null) };
        }
        return { dayUtcMs, segment: 'post' };
    }
    const nextDay = addDaysUtcMs(dayUtcMs, +1);
    if (isThursdayByTZ(nextDay)) return { dayUtcMs: nextDay, segment: 'pre' };
    return { dayUtcMs: nextDay, segment: null };
};

export const clampNotPast = (dayUtcMs: DayUtcMs, segment: Segment): SlotPosition => {
    const todayUtc = getTodayUtcMsByTZ();
    if (dayUtcMs < todayUtc) {
        dayUtcMs = todayUtc;
        if (isThursdayByTZ(dayUtcMs)) segment = (segment === 'auto') ? 'auto' : 'post';
        else segment = 'auto';
    }
    return { dayUtcMs, segment };
};

export const clampSelectedDay = (dayUtcMs: DayUtcMs | null, segment: Segment): SlotPosition => {
    if (dayUtcMs == null) return { dayUtcMs, segment };
    segment = normalizeSegmentForDay(dayUtcMs, segment);
    const curKey = slotKey(dayUtcMs, segment);
    const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
    const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;
    if (minKey != null && curKey < minKey) return { dayUtcMs: MIN_DAY_UTC_MS, segment: MIN_SEG };
    if (maxKey != null && curKey > maxKey) return { dayUtcMs: MAX_DAY_UTC_MS, segment: MAX_SEG };
    segment = normalizeSegmentForDay(dayUtcMs, segment);
    return { dayUtcMs, segment };
};

export const applySlot = (dayUtcMs: DayUtcMs, segment: Segment): void => {
    segment = effectiveSegment(dayUtcMs, segment) ?? segment;
    const c = clampSelectedDay(dayUtcMs, segment);
    selectedDayUtcMs = c.dayUtcMs;
    selectedSegment = c.segment;
};

// ==================== Квесты ====================

export const isQuestActiveAtUnix = (q: ApiQuest, unix: number): boolean => {
    const qs = Number(q?.start_time || 0);
    const qe = Number(q?.end_time || 0);
    if (!qs || !qe) return false;
    return qs <= unix && unix < qe;
};

export const getCompletionTimeInSlot = (code: string, dayUtcMs: DayUtcMs, seg: Segment): number => {
    const b = getSlotBoundsUnix(dayUtcMs, seg);
    const entry = historyEntries.find(e => e.code === code && b.start <= e.completedAt && e.completedAt < b.end);
    return entry ? entry.completedAt : 0;
};

export const isDoneInSelectedSlot = (q: ApiQuest, dayUtcMs: DayUtcMs, seg: Segment): boolean => {
    return getCompletionTimeInSlot(q.code, dayUtcMs, seg) > 0;
};

export const getRewardAmount = (q: ApiQuest): number => {
    const steps = q?.steps;
    const step1 = steps?.['1'] || steps?.[1];
    const amount = step1?.rewards?.[0]?.value?.amount;
    return Number(amount || 0);
};

export const getQuestsArrayFromInfo = (json: ApiInfoResponse): ApiQuest[] => {
    const quests = json?.data?.quests;
    if (!quests || typeof quests !== 'object') throw new Error('api/info: quests not found');
    return Object.values(quests);
};

export const debugTime = (unix: number): string | null => {
    if (!unix) return null;
    return new Date(unix * 1000).toISOString();
};

export const summarizeQuestForDebug = (q: ApiQuest): QuestDebugSummary => ({
    id: q?.id,
    code: q?.code,
    title: q?.title,
    group: q?.group,
    type: q?.type,
    time_status: q?.time_status,
    start_time: q?.start_time,
    start_iso: debugTime(Number(q?.start_time || 0)),
    end_time: q?.end_time,
    end_iso: debugTime(Number(q?.end_time || 0)),
    progress: q?.progress,
    max_completed_step: q?.max_completed_step,
    reward: getRewardAmount(q),
    known_meta: !!findQuestMetaForMarathonQuest(q),
});

export const renderEmptyTasksDiagnostic = (listEl: Element, message: string): void => {
    const empty = document.createElement('div');
    empty.className = 'tasks__item tm-tasks-empty';
    empty.textContent = message;
    listEl.appendChild(empty);
};

// ==================== Внешние ссылки (Codex, Veksel) ====================

export let vekselUrlResolved: string = VEKSEL_BASE;
export let vekselAutoDetectedServerId: string = '';

export const loadVekselServerIdOverride = (): string => {
    try {
        const id = localStorage.getItem(LS_KEYS.VEKSEL_SERVER_ID);
        return id && SERVERS[id] ? id : '';
    } catch {
        return '';
    }
};

export const saveVekselServerIdOverride = (serverId: string): void => {
    try {
        if (serverId && SERVERS[serverId]) localStorage.setItem(LS_KEYS.VEKSEL_SERVER_ID, serverId);
        else localStorage.removeItem(LS_KEYS.VEKSEL_SERVER_ID);
    } catch {
        // ignore
    }
};

export const getVekselAutoOptionText = (): string => {
    const serverName = SERVERS[vekselAutoDetectedServerId];
    return `Автоопределение${serverName ? ` (${serverName})` : ''}`;
};

export const updateVekselServerAutoOptionText = (): void => {
    document.querySelectorAll('[data-veksel-server-auto-option="1"]').forEach(option => {
        option.textContent = getVekselAutoOptionText();
    });
};

export const updateRenderedVekselLinks = (): void => {
    document.querySelectorAll<HTMLAnchorElement>('.tm-veksel-link').forEach(link => {
        const veksel = link.dataset.veksel;
        let slot: Slot | null = null;
        let locations: string[] | undefined;
        try { slot = link.dataset.slot ? JSON.parse(link.dataset.slot) as Slot : null; } catch {}
        try { locations = link.dataset.locations ? JSON.parse(link.dataset.locations) as string[] : undefined; } catch {}
        link.href = buildVekselUrl(veksel, slot, locations);
    });
};

export const buildVekselUrl = (veksel: string | undefined, slot: Slot | null | undefined, locations: string[] | undefined): string => {
    const isBlueSalt = veksel === 'blue_salt';
    const isNorth = veksel === 'north';
    if (!isBlueSalt && !isNorth) return vekselUrlResolved;
    let params: string | null = null;
    const item = slot?.item;
    if (slot?.count && (item?.vekselName || item?.name)) {
        if (isBlueSalt) params = `res=${encodeURIComponent(item.vekselName || item.name)}&amount=${slot.count}`;
        else if (isNorth) {
            const iconType = item.vekselType || 'sack';
            if (locations && locations.length > 0) params = `loc=${encodeURIComponent(locations.join(','))}&amount=${slot.count}&icon=${iconType}`;
            else params = `amount=${slot.count}&icon=${iconType}`;
        }
    }
    if (!params) return vekselUrlResolved;
    const separator = vekselUrlResolved.includes('?') ? '&' : '?';
    return `${vekselUrlResolved}${separator}${params}`;
};

export const getGisaaVekselKeyForQuest = (veksel: string | undefined, slot: Slot | null | undefined, locations: string[] | undefined): string | null => {
    const item = slot?.item;
    const amount = Number(slot?.count || 0);
    if (!amount || !item) return null;
    if (veksel === 'blue_salt' && (item.vekselName || item.name)) {
        return makeGisaaVekselKey({ type: 'blue_salt', resourceName: item.vekselName || item.name, amount });
    }
    if (veksel === 'north') {
        return makeGisaaVekselKey({ type: 'north', amount, iconType: item.vekselType || 'sack', locations });
    }
    return null;
};

export const makeGisaaInfoFromRows = (rows: GisaaStatusRow[]): GisaaInfo | null => {
    const unique = (values: string[]): string[] => [...new Set((values || []).filter(Boolean))];
    const matches = unique(rows.filter(row => row.status === 'match').map(row => row.location));
    const unknown = unique(rows.filter(row => row.status === 'unknown').map(row => row.location));
    const excludes = unique(rows.filter(row => row.status === 'exclude').map(row => row.location));
    if (matches.length) return { status: 'available', locations: matches, unknownLocations: unknown, excludedLocations: excludes };
    if (!unknown.length && excludes.length) return { status: 'unavailable', locations: [], unknownLocations: unknown, excludedLocations: excludes };
    return null;
};

export const getGisaaVekselInfoFromSavedTable = (veksel: string | undefined, slot: Slot | null | undefined, locations: string[] | undefined): GisaaInfo | null => {
    const snapshot = getSavedGisaaTablesSnapshot();
    if (!snapshot) return null;
    const item = slot?.item;
    const amount = Number(slot?.count || 0);
    if (!item || !amount) return null;
    if (veksel === 'blue_salt') {
        const resourceName = item.vekselName || item.name;
        const rows = snapshot.resources?.[resourceName];
        if (!rows?.length) return null;
        return makeGisaaInfoFromRows(rows.map(row => ({
            location: row.location,
            status: row.unknown ? 'unknown' : row.amount === amount ? 'match' : 'exclude',
        })));
    }
    if (veksel === 'north') {
        const iconType = item.vekselType || 'sack';
        const wantedLocations = locations || [];
        const rows = (snapshot.north || []).filter(row => wantedLocations.some(loc =>
            row.location.toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase().includes(row.location.toLowerCase())
        ));
        if (!rows.length) return null;
        return makeGisaaInfoFromRows(rows.map(row => ({
            location: row.location,
            status: row.unknown ? 'unknown' : row.amount === amount && row.iconType === iconType ? 'match' : 'exclude',
        })));
    }
    return null;
};

export const getGisaaVekselInfoForQuest = (veksel: string | undefined, slot: Slot | null | undefined, locations: string[] | undefined): GisaaInfo | null => (
    getGisaaVekselInfoFromSavedTable(veksel, slot, locations)
    || getSavedGisaaVekselInfo(getGisaaVekselKeyForQuest(veksel, slot, locations))
);

export const handleVisibilityChange = (): void => {
    if (document.hidden) restartAutoRefresh();
    else {
        refreshApiInfo();
        restartAutoRefresh();
    }
};

export const parseServersFromCharListHtml = (html: string): string[] => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.querySelectorAll('li')]
        .map(li => {
            const spans = li.querySelectorAll('span');
            const last = spans?.[spans.length - 1];
            return last ? last.textContent?.trim() || null : null;
        })
        .filter((server): server is string => Boolean(server));
};

export const pickMainServer = (servers: string[]): string | null => {
    if (!servers.length) return null;
    const counts = new Map<string, number>();
    const order: string[] = [];
    for (const s of servers) {
        if (!counts.has(s)) order.push(s);
        counts.set(s, (counts.get(s) || 0) + 1);
    }
    let best: string | null = null;
    let bestCount = -1;
    for (const s of order) {
        const c = counts.get(s);
        if (c > bestCount) { best = s; bestCount = c; }
    }
    return best;
};

export const resolveVekselUrl = async (): Promise<void> => {
    try {
        const serverIdOverride = loadVekselServerIdOverride();
        if (serverIdOverride) {
            vekselUrlResolved = `${VEKSEL_BASE}${serverIdOverride}`;
            updateRenderedVekselLinks();
            updateVekselServerAutoOptionText();
            return;
        }
        const uid = await getUidFromCheckUser();
        const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
        const servers = parseServersFromCharListHtml(html);
        const mainServer = pickMainServer(servers);
        if (!mainServer) {
            vekselAutoDetectedServerId = '';
            vekselUrlResolved = VEKSEL_BASE;
            updateVekselServerAutoOptionText();
            return;
        }
        const vekselId = Object.keys(SERVERS).find(id => SERVERS[id] === mainServer);
        vekselAutoDetectedServerId = vekselId || '';
        vekselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;
        updateRenderedVekselLinks();
        updateVekselServerAutoOptionText();
    } catch {
        vekselAutoDetectedServerId = '';
        vekselUrlResolved = VEKSEL_BASE;
        updateVekselServerAutoOptionText();
    }
};

// ==================== UI: карточки и список ====================

export const makeVekselIconLink = ({ href, title, vekselIcon }: MakeVekselIconLinkParams): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.className = 'tm-veksel-icon-link';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (title) a.title = title;
    const mainImg = document.createElement('img');
    mainImg.className = 'tm-veksel-icon-main';
    mainImg.src = ICON_GISAA_OVERLAY;
    mainImg.alt = 'gisaa';
    const badgeImg = document.createElement('img');
    badgeImg.className = 'tm-veksel-icon-badge';
    badgeImg.src = vekselIcon;
    badgeImg.alt = 'veksel';
    a.appendChild(mainImg);
    a.appendChild(badgeImg);
    return a;
};

export const updateTasksHeader = (json: ApiInfoResponse): void => {
    const userInfo = json?.data?.user_info;
    if (!userInfo) return;
    const weekExp = Number(userInfo.week_exp || 0);
    const maxWeekExp = Number(json?.data?.action_info?.increase_max_exp_per_week || 100);
    if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) DOM.tasksHeader = document.querySelector('.section.tasks .tasks__header');
    if (!DOM.tasksHeader) return;
    let balanceEl = DOM.tasksHeader.querySelector('.tasks__balance');
    if (!balanceEl) {
        balanceEl = document.createElement('div');
        balanceEl.className = 'tasks__balance';
        DOM.tasksHeader.appendChild(balanceEl);
    }
    balanceEl.innerHTML = '';
    const label = document.createTextNode(`Заработано за эту неделю: ${weekExp} / ${maxWeekExp}`);
    balanceEl.appendChild(label);
    const iconPoint = document.createElement('div');
    iconPoint.className = 'icon-point icon-point--received';
    balanceEl.appendChild(iconPoint);
};

export const ensureTasksListEl = (): Element | null => {
    if (!DOM.tasksList || !DOM.tasksList.isConnected) DOM.tasksList = document.querySelector('.section.tasks .tasks__list');
    if (!DOM.tasksList) {
        debugWarn('tasks list element not found', {
            path: location.pathname,
            hasTasksSection: !!document.querySelector('.section.tasks'),
            taskSectionHtml: document.querySelector('.section.tasks')?.outerHTML?.slice(0, 1000) || null,
        });
    }
    return DOM.tasksList;
};

export const onSelectedDateChanged = async (): Promise<void> => {
    updateDateNavLabel();
    updateDateNavButtons();
    try { await renderTasksForSelectedDay(); }
    catch (e) { console.warn('[ArcheAgeExtraUI] renderTasksForSelectedDay failed:', e); }
};

export const computeThuSegmentsAvailability = (dayUtcMs: DayUtcMs, questsArr: ApiQuest[]): { hasPre: boolean; hasPost: boolean } => {
    const preUnix = getUnixForDayAtHour(dayUtcMs, THU_PRE_HOUR);
    const postUnix = getUnixForDayAtHour(dayUtcMs, DEFAULT_HOUR);
    const hasPre = questsArr.some(q => isQuestActiveAtUnix(q, preUnix));
    const hasPost = questsArr.some(q => isQuestActiveAtUnix(q, postUnix));
    return { hasPre, hasPost };
};

export const computeDateBoundsFromApiInfo = async (): Promise<void> => {
    if (MIN_DAY_UTC_MS != null && MAX_DAY_UTC_MS != null) return;
    const json = await getApiInfoCached();
    const questsArr = getQuestsArrayFromInfo(json);
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const q of questsArr) {
        const s = Number(q?.start_time || 0);
        const e = Number(q?.end_time || 0);
        if (!s || !e) continue;
        if (s < minStart) minStart = s;
        if (e > maxEnd) maxEnd = e;
    }
    if (!isFinite(minStart) || !isFinite(maxEnd)) {
        MIN_DAY_UTC_MS = null; MAX_DAY_UTC_MS = null; MIN_SEG = null; MAX_SEG = null; return;
    }
    MIN_DAY_UTC_MS = dayUtcMsFromUnixByTZ(minStart);
    MAX_DAY_UTC_MS = dayUtcMsFromUnixByTZ(maxEnd - 1);
    MIN_SEG = null; MAX_SEG = null;
    if (MIN_DAY_UTC_MS != null && isThursdayByTZ(MIN_DAY_UTC_MS)) {
        const { hasPre, hasPost } = computeThuSegmentsAvailability(MIN_DAY_UTC_MS, questsArr);
        if (hasPre) MIN_SEG = 'pre'; else if (hasPost) MIN_SEG = 'post'; else MIN_SEG = 'post';
    }
    if (MAX_DAY_UTC_MS != null && isThursdayByTZ(MAX_DAY_UTC_MS)) {
        const { hasPre, hasPost } = computeThuSegmentsAvailability(MAX_DAY_UTC_MS, questsArr);
        if (hasPost) MAX_SEG = 'post'; else if (hasPre) MAX_SEG = 'pre'; else MAX_SEG = 'pre';
    }
};

export let taskCardFactories: TaskCardFactories = { makeItemIconLink: null, makeIconLink: null };
export const setTaskCardFactories = (factories: Partial<TaskCardFactories>): void => {
    taskCardFactories = { ...taskCardFactories, ...factories };
};

export const renderTasksForSelectedDay = async ({ animateNewlyDone = false, makeItemIconLink = taskCardFactories.makeItemIconLink, makeIconLink = taskCardFactories.makeIconLink }: RenderTasksOptions = {}): Promise<void> => {
    const listEl = ensureTasksListEl();
    if (!listEl) return;
    if (!makeItemIconLink || !makeIconLink) throw new Error('[ArcheAgeExtraUI] makeItemIconLink/makeIconLink are required');
    const json = await getApiInfoCached();
    setApiInfoDataJson(JSON.stringify(json?.data));
    const all = getQuestsArrayFromInfo(json);
    updateLevelBlock(json);
    updateTasksHeader(json);
    const todayUtc = getTodayUtcMsByTZ();
    const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
    const isThu = isThursdayByTZ(selectedDayUtcMs);
    if (selectedDayUtcMs == null) return;
    let unixPoint: number;
    if (isThu && selectedSegment === 'pre') unixPoint = getUnixForDayAtHour(selectedDayUtcMs, THU_PRE_HOUR);
    else unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR);
    const active = all.filter(q => isQuestActiveAtUnix(q, unixPoint));
    const questMetaByApiQuest = new Map<ApiQuest, MarathonQuestMeta | undefined>(active.map(q => [q, findQuestMetaForMarathonQuest(q) as MarathonQuestMeta | undefined]));
    const knownActive = active.filter(q => questMetaByApiQuest.get(q));
    const unknownActive = active.filter(q => !questMetaByApiQuest.get(q));
    debugLog('renderTasksForSelectedDay', {
        selectedDayUtcMs, selectedSegment, unixPoint, unixPointIso: debugTime(unixPoint), totalQuests: all.length,
        activeQuests: active.length, knownActiveQuests: knownActive.length, unknownActiveQuests: unknownActive.length,
        minDayIso: MIN_DAY_UTC_MS ? new Date(MIN_DAY_UTC_MS).toISOString() : null,
        maxDayIso: MAX_DAY_UTC_MS ? new Date(MAX_DAY_UTC_MS).toISOString() : null,
    });
    if (!active.length) debugWarn('No active quests for selected slot. First API quests:', all.slice(0, 10).map(summarizeQuestForDebug));
    else if (unknownActive.length) debugWarn('Active quests without local QUESTS metadata:', unknownActive.map(summarizeQuestForDebug));
    active.sort((a, b) => {
        const da = getRewardAmount(a);
        const db = getRewardAmount(b);
        if (da !== db) return da - db;
        return Number(a?.id || 0) - Number(b?.id || 0);
    });
    listEl.innerHTML = '';
    const currentDoneIds: Set<number> = new Set();
    let renderedCount = 0;
    for (const q of active) {
        const questId = Number(q.id);
        const meta = questMetaByApiQuest.get(q);
        const id = meta?.id ? Number(meta.id) : null;
        const short = (meta?.short || '').trim();
        const amount = getRewardAmount(q);
        const completionTime = getCompletionTimeInSlot(q.code, selectedDayUtcMs, selectedSegment);
        const doneInSlot = completionTime > 0;
        if (doneInSlot) currentDoneIds.add(questId);
        const isNewlyDone = animateNewlyDone && doneInSlot && !previouslyDoneQuestIds.has(questId);
        const card = makeTaskCard({
            q, amount, id, short, isDone: doneInSlot, showLastDone: doneInSlot, completionTime, isToday,
            slot: meta?.slot || null, veksel: meta?.veksel, locations: meta?.locations,
            availableWeekdays: meta?.availableWeekdays, schedule: meta?.schedule, animateCompletion: isNewlyDone,
            makeItemIconLink, makeIconLink,
            buildVekselUrl, getGisaaVekselInfoForQuest, makeVekselIconLink,
        });
        listEl.appendChild(card);
        renderedCount++;
    }
    if (active.length && !renderedCount) renderEmptyTasksDiagnostic(listEl, 'ArcheAgeExtraUI: активные задания есть в API, но карточки не были отрисованы. Проверьте консоль.');
    else if (!active.length) renderEmptyTasksDiagnostic(listEl, 'ArcheAgeExtraUI: для выбранного дня активные задания не найдены. Проверьте консоль.');
    previouslyDoneQuestIds = currentDoneIds;
};

// ==================== Инициализация ====================

export const init = async ({
    injectStyles = () => {},
    startCountdownInterval = () => {},
    initPrizes = async () => {},
    initAutoOpenBoxesCheckbox = () => {},
    makeItemIconLink,
    makeIconLink,
}: InitOptions = {}): Promise<void> => {
    if (makeItemIconLink || makeIconLink) setTaskCardFactories({ makeItemIconLink, makeIconLink });
    initApiDeps({
        debugLog,
        debugWarn,
        DOM,
        autoRefreshIntervalId: autoRefreshIntervalRef,
        AUTO_REFRESH_INTERVAL_FOCUSED_MS: 30000,
        AUTO_REFRESH_INTERVAL_HIDDEN_MS: 1800000,
        API_INFO_PATH: '/minigames/marathon_of_heroes/api/info',
        getSelectedDayUtcMs: () => selectedDayUtcMs,
        getSelectedSegment: () => selectedSegment,
        getSlotKey: (day, seg) => slotKey(day, seg),
        getTodayUtcMsByTZ,
        getEffectiveSegment: effectiveSegment,
        applySlot,
        updateQuestHistory,
        onSelectedDateChanged,
        renderTasksForSelectedDay,
    });
    fetchApiInfo().catch(() => {});  // sync server time on init
    injectStyles();
    debugLog('init marathon page', {
        path: location.pathname,
        hasTasksSection: !!document.querySelector('.section.tasks'),
        hasTasksHeader: !!document.querySelector('.section.tasks .tasks__header'),
        hasTasksList: !!document.querySelector('.section.tasks .tasks__list'),
    });
    try { await getApiInfoCached(); }
    catch (e) { debugWarn('getApiInfoCached failed during init', e); return; }
    try { cachedUid = await getUidFromCheckUser(); }
    catch (e) { console.warn('[ArcheAgeExtraUI] getUidFromCheckUser failed:', e); }
    initServerTimeOffset();
    startCountdownInterval();
    initDateNavDeps({
        DOM,
        getSelectedDay: () => selectedDayUtcMs,
        getSelectedSegment: () => selectedSegment,
        loadHideDoneState,
        saveHideDoneState,
        ensureTasksListEl,
        getPrevSlot,
        getNextSlot,
        applySlot,
        onSelectedDateChanged,
        refreshApiInfo,
        restartAutoRefresh,
        slotKey,
        getMinDay: () => MIN_DAY_UTC_MS,
        getMaxDay: () => MAX_DAY_UTC_MS,
        getMinSegment: () => MIN_SEG,
        getMaxSegment: () => MAX_SEG,
    });
    ensureDateNavInHeader();
    try { await computeDateBoundsFromApiInfo(); }
    catch (e) { console.warn('[ArcheAgeExtraUI] computeDateBoundsFromApiInfo failed:', e); }
    applySlot(selectedDayUtcMs || getTodayUtcMsByTZ(), 'auto');
    updateQuestHistory();
    try { await onSelectedDateChanged(); }
    catch (e) { console.warn('[ArcheAgeExtraUI] renderTasksForSelectedDay failed:', e); }
    requestAnimationFrame(() => {
        const el = document.querySelector('.section.tasks .tasks__header');
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 85;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    });
    resolveVekselUrl();
    try { await initPrizes(); }
    catch (e) { console.warn('[ArcheAgeExtraUI] initPrizes failed:', e); }
    try { initAutoOpenBoxesCheckbox(); }
    catch (e) { console.warn('[ArcheAgeExtraUI] initAutoOpenBoxesCheckbox failed:', e); }
    restartAutoRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
};
