// ==UserScript==
// @name         ArcheAgeExtraUI
// @namespace    https://archeage.ru/
// @version      4.10.0
// @description  Доработка страниц марафона, корзины и восстановления предметов
// @author       Cergx
// @match        *://archeage.ru/*
// @match        *://gisaa.ru/veksel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const pageDocument = pageWindow.document || document;
    const GISAA_VEKSEL_INFO_KEY = 'tm_aa_gisaa_veksel_info_v1';
    const GISAA_VEKSEL_TABLE_KEY = 'tm_aa_gisaa_veksel_table_v1';

    const getMskDateKey = () => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Moscow',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date());
        const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${map.year}-${map.month}-${map.day}`;
    };

    const readSharedJson = (key, fallback) => {
        try {
            if (typeof GM_getValue === 'function') {
                const value = GM_getValue(key);
                return value ? JSON.parse(value) : fallback;
            }
        } catch {
            // ignore
        }

        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    };

    const writeSharedJson = (key, value) => {
        const json = JSON.stringify(value);
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, json);
                return;
            }
        } catch {
            // ignore
        }

        try {
            localStorage.setItem(key, json);
        } catch {
            // ignore
        }
    };

    const normalizeGisaaPart = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const makeGisaaVekselKey = ({ type, resourceName, amount, iconType, locations }) => {
        if (type === 'blue_salt') {
            return `blue_salt|${normalizeGisaaPart(resourceName)}|${Number(amount || 0)}`;
        }

        const locKey = (locations || [])
            .map(normalizeGisaaPart)
            .filter(Boolean)
            .sort()
            .join(',');
        return `north|${Number(amount || 0)}|${normalizeGisaaPart(iconType)}|${locKey}`;
    };

    const saveGisaaVekselInfo = (key, info) => {
        if (!key || !info) return;
        const all = readSharedJson(GISAA_VEKSEL_INFO_KEY, {});
        all[key] = {
            ...info,
            date: getMskDateKey(),
            updatedAt: Date.now(),
        };
        writeSharedJson(GISAA_VEKSEL_INFO_KEY, all);
    };

    const getSavedGisaaVekselInfo = (key) => {
        if (!key) return null;
        const info = readSharedJson(GISAA_VEKSEL_INFO_KEY, {})?.[key];
        if (!info || info.date !== getMskDateKey()) return null;
        if (info.status !== 'available' && info.status !== 'unavailable') return null;
        return info;
    };

    const getSavedGisaaTablesSnapshot = () => {
        const snapshot = readSharedJson(GISAA_VEKSEL_TABLE_KEY, null);
        if (!snapshot || snapshot.date !== getMskDateKey()) return null;
        return snapshot;
    };

    const cleanGisaaText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

    const parseGisaaMaxCell = (maxCell) => {
        const text = cleanGisaaText(maxCell?.textContent);
        const amount = parseInt(text, 10);
        const iconType = maxCell?.querySelector('.fa-archive')
            ? 'archive'
            : maxCell?.querySelector('.fa-sack')
                ? 'sack'
                : null;

        return {
            text,
            unknown: !text || text.includes('?') || !Number.isFinite(amount),
            amount: Number.isFinite(amount) ? amount : null,
            iconType,
        };
    };

    const parseGisaaRow = (row) => {
        const location = cleanGisaaText(row.querySelector('.row__cell-name .name.fix_size, .name.fix_size')?.textContent);
        const max = parseGisaaMaxCell(row.querySelector('.row__cell-max'));
        return { location, ...max };
    };

    const readGisaaTableRows = (table) => (
        Array.from(table.querySelectorAll('.row-table'))
            .map(parseGisaaRow)
            .filter(row => row.location)
    );

    const readGisaaTablesSnapshot = () => {
        const resources = {};

        for (const blockId of ['#table-block-west', '#table-block-east']) {
            const block = document.querySelector(blockId);
            if (!block) continue;

            for (const table of block.querySelectorAll('table')) {
                const resourceName = cleanGisaaText(table.querySelector('th.table__name')?.textContent);
                if (!resourceName) continue;
                resources[resourceName] = [
                    ...(resources[resourceName] || []),
                    ...readGisaaTableRows(table),
                ];
            }
        }

        const northBlock = document.querySelector('#table-block-north');
        const north = northBlock
            ? Array.from(northBlock.querySelectorAll('.row-table')).map(parseGisaaRow).filter(row => row.location)
            : [];

        return { resources, north };
    };

    const saveGisaaTablesSnapshot = (snapshot) => {
        writeSharedJson(GISAA_VEKSEL_TABLE_KEY, {
            date: getMskDateKey(),
            updatedAt: Date.now(),
            ...snapshot,
        });
    };

    const isGisaaSite = location.hostname.includes('gisaa.ru');
    const isArcheageSite = location.hostname.includes('archeage.ru');
    const isCartPage = isArcheageSite && (location.pathname === '/cart' || location.pathname === '/cart/');
    const isItemRestorePage = isArcheageSite && (location.pathname === '/itemrestore' || location.pathname === '/itemrestore/');

    // ============================================================
    // ====================== GISAA.RU ============================
    // ============================================================

    if (isGisaaSite) {
        const GISAA_MATCH_CLASS = 'tm-gisaa-match';
        const GISAA_EXCLUDE_CLASS = 'tm-gisaa-exclude';
        const GISAA_UNKNOWN_CLASS = 'tm-gisaa-unknown';

        const injectGisaaStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                td.${GISAA_MATCH_CLASS} {
                    --bs-table-accent-bg: #005f1940;
                    background-color: #005f1940 !important;
                }
                td.${GISAA_EXCLUDE_CLASS} {
                    --bs-table-accent-bg: #5f000040;
                    background-color: #5f000040 !important;
                }
                td.${GISAA_UNKNOWN_CLASS} {
                    --bs-table-accent-bg: #5f5f0040;
                    background-color: #5f5f0040 !important;
                }
                .btn_vote.${GISAA_EXCLUDE_CLASS} {
                    opacity: 0.4;
                }
            `;
            document.head.appendChild(style);
        };

        /**
         * Подсвечивает строки в таблицах Запад/Восток: зелёным - подходящие, красным - неподходящие, жёлтым - неизвестные.
         * @param {string} resourceName
         * @param {number} amount - количество ресурсов
         */
        const highlightWestEastRow = (resourceName, amount) => {
            const blocks = ['#table-block-west', '#table-block-east'];
            const result = { match: [], exclude: [], unknown: [] };
            for (const blockId of blocks) {
                const block = document.querySelector(blockId);
                if (!block) continue;
                const tables = block.querySelectorAll('table');
                for (const table of tables) {
                    const header = table.querySelector('th.table__name');
                    if (!header) continue;
                    // Работаем только с таблицей нужного ресурса
                    if (header.textContent.trim() !== resourceName) continue;
                    const rows = table.querySelectorAll('.row-table');
                    for (const row of rows) {
                        const maxCell = row.querySelector('.row__cell-max');
                        if (!maxCell) continue;
                        const parsedRow = parseGisaaRow(row);
                        if (!parsedRow.location) continue;
                        if (parsedRow.unknown) {
                            // В таблице неизвестное значение - жёлтым
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_UNKNOWN_CLASS));
                            result.unknown.push(parsedRow.location);
                        } else if (parsedRow.amount === amount) {
                            // Подходит - зелёным
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_MATCH_CLASS));
                            result.match.push(parsedRow.location);
                        } else {
                            // Не подходит - красным
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_EXCLUDE_CLASS));
                            result.exclude.push(parsedRow.location);
                        }
                    }
                }
            }
            return result;
        };

        /**
         * Подсвечивает только запрошенные локации в таблице Север: зелёным подходящие, красным неподходящие, жёлтым если в таблице ?.
         * @param {string[]} locations
         * @param {number} amount - количество ресурсов
         * @param {'archive'|'sack'} iconType
         */
        const highlightNorthRow = (locations, amount, iconType) => {
            const block = document.querySelector('#table-block-north');
            const result = { match: [], exclude: [], unknown: [] };
            if (!block) return result;
            if (!locations || locations.length === 0) return result;

            const rows = block.querySelectorAll('.row-table');
            for (const row of rows) {
                const nameEl = row.querySelector('.name.fix_size');
                if (!nameEl) continue;
                const rowLocation = nameEl.textContent.trim();

                // Проверяем, входит ли локация в список запрошенных
                const locationMatch = locations.some(loc =>
                    rowLocation.toLowerCase().includes(loc.toLowerCase()) ||
                    loc.toLowerCase().includes(rowLocation.toLowerCase())
                );

                // Работаем только с запрошенными локациями
                if (!locationMatch) continue;

                const maxCell = row.querySelector('.row__cell-max');
                if (!maxCell) continue;

                const parsedRow = parseGisaaRow(row);
                const rowLabel = parsedRow.location || rowLocation;

                // Сначала проверяем на неизвестное значение
                if (parsedRow.unknown) {
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_UNKNOWN_CLASS));
                    if (rowLabel) result.unknown.push(rowLabel);
                    continue;
                }

                // Проверяем, подходит ли по amount и iconType
                let isFullMatch = false;
                if (parsedRow.iconType === iconType && parsedRow.amount === amount) {
                    isFullMatch = true;
                }

                if (isFullMatch) {
                    // Полностью подходит - зелёным
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_MATCH_CLASS));
                    if (rowLabel) result.match.push(rowLabel);
                } else {
                    // Локация та, но amount/type не тот - красным
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_EXCLUDE_CLASS));
                    row.querySelectorAll('.btn_vote').forEach(btn => btn.classList.add(GISAA_EXCLUDE_CLASS));
                    if (rowLabel) result.exclude.push(rowLabel);
                }
            }

            return result;
        };

        const saveHighlightResult = (key, result) => {
            if (!key || !result) return;

            const unique = (values) => [...new Set((values || []).filter(Boolean))];
            const matches = unique(result.match);
            const unknown = unique(result.unknown);
            const excludes = unique(result.exclude);

            let status = 'unknown';
            if (matches.length) {
                status = 'available';
            } else if (!unknown.length && excludes.length) {
                status = 'unavailable';
            }

            saveGisaaVekselInfo(key, {
                status,
                locations: matches,
                unknownLocations: unknown,
                excludedLocations: excludes,
            });
        };

        const applyHighlightsFromUrl = ({ scrollNorth = true } = {}) => {
            const snapshot = readGisaaTablesSnapshot();
            saveGisaaTablesSnapshot(snapshot);

            const params = new URLSearchParams(location.search);

            // Западные/восточные ресурсы: ?res=Слиток железа&amount=60
            const res = params.get('res');
            const amount = parseInt(params.get('amount'), 10);
            if (res && amount) {
                const result = highlightWestEastRow(res, amount);
                saveHighlightResult(
                    makeGisaaVekselKey({ type: 'blue_salt', resourceName: res, amount }),
                    result
                );
            }

            // Северные локации: ?loc=Бездна,Солнечные поля&amount=25&icon=sack
            const locParam = params.get('loc');
            const icon = params.get('icon');
            if (locParam && amount && icon) {
                const locations = locParam.split(',').map(s => s.trim()).filter(Boolean);
                const result = highlightNorthRow(locations, amount, icon);
                saveHighlightResult(
                    makeGisaaVekselKey({ type: 'north', amount, iconType: icon, locations }),
                    result
                );

                // Скроллим к северной таблице
                const northBlock = document.querySelector('#table-block-north');
                if (scrollNorth && northBlock) {
                    northBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        };

        const startGisaaResultSync = () => {
            setInterval(() => applyHighlightsFromUrl({ scrollNorth: false }), 5000);
        };

        const initGisaa = () => {
            injectGisaaStyles();
            // Даём странице время загрузиться
            setTimeout(applyHighlightsFromUrl, 500);
            setTimeout(startGisaaResultSync, 1500);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGisaa);
        } else {
            initGisaa();
        }

        return; // Выходим из IIFE, не выполняем код для archeage.ru
    }

    // ============================================================
    // ===================== ARCHEAGE.RU ==========================
    // ============================================================

    if (!isArcheageSite) return;

    // ==================== Константы ====================

    const DONE_CLASS = 'tm-task-completed';
    const JUST_DONE_CLASS = 'tm-task-just-completed';
    const TZ = 'Europe/Moscow';
    const MSK_OFFSET_HOURS = 3;
    const THU_PRE_HOUR = 3;   // 03:00 МСК — до профработ
    const DEFAULT_HOUR = 16;  // 16:00 МСК — после профработ
    /** Эндпоинт информации о марафоне. Ответ: {@link ApiInfoResponse}. */
    const API_INFO_PATH = '/minigames/marathon_of_heroes/api/info';
    const LS_KEYS = {
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
    };
    const HISTORY_MAX_ENTRIES = 500;
    const HISTORY_PER_PAGE = 10;
    const DEBUG_PREFIX = '[ArcheAgeExtraUI]';
    const DEBUG_ENABLED = true;

    const debugLog = (...args) => {
        if (DEBUG_ENABLED) console.log(DEBUG_PREFIX, ...args);
    };

    const debugWarn = (...args) => {
        console.warn(DEBUG_PREFIX, ...args);
    };
    const DAY_RESET_HOUR = 0; // 00:00 МСК — начало нового дня для сброса галочки
    const CLAIM_DELAY_MS = 400; // Задержка между запросами автозабора

    // ==================== Типы API ====================

    /**
     * @typedef {Object} ApiReward
     * @property {'moh_experience'|'cart_item'|'currency'|string} type
     * @property {{ amount?: number, id?: number, count?: number, site_count?: number, code?: string }} value
     * @property {string} [title] - Название (для `cart_item`).
     */

    /**
     * @typedef {Object} ApiQuestStep
     * @property {number} id
     * @property {number} target
     * @property {ApiReward[]} rewards
     */

    /**
     * @typedef {Object} ApiQuest
     * @property {number} id - ID задания марафона.
     * @property {string} code - Код задания марафона.
     * @property {string} type
     * @property {string} group
     * @property {number} end_time - Время окончания задания.
     * @property {number} start_time - Время начала задания.
     * @property {'now'|'future'|'past'} time_status
     * @property {number} max_completed_step
     * @property {number} progress
     * @property {number} max_target
     * @property {string} title - Заголовок марафона.
     * @property {string} description - Описание задания марафона.
     * @property {any[]} payload
     * @property {number|null} reset_time
     * @property {number|null} stop_time
     * @property {number} last_complete_time
     * @property {Record<string, ApiQuestStep>} steps
     */

    /**
     * @typedef {Object} ApiUserInfo
     * @property {number} level
     * @property {'trial'|'premium'} status
     * @property {number} count_boxes_for_open
     * @property {number} week_exp
     * @property {number} exp_total
     * @property {Record<string, string[]>} farmed_rewards
     */

    /**
     * @typedef {Object} ApiActionInfo
     * @property {number} count_levels_for_box
     * @property {number} exp_for_level
     * @property {number} increase_max_exp_per_week
     * @property {Record<string, Record<string, ApiReward[]>>} level_prizes
     * @property {ApiReward[]} box_rewards
     */

    /**
     * @typedef {Object} ApiInfoData
     * @property {ApiUserInfo} user_info
     * @property {Record<string, ApiQuest>} quests
     * @property {number} week_number
     * @property {number} next_week_at
     * @property {ApiActionInfo} action_info
     * @property {any[]} pins
     * @property {Record<string, Record<string, number>>} prices
     */

    /**
     * @typedef {Object} ApiInfoResponse
     * @property {ApiInfoData} data
     * @property {any} meta
     * @property {'Success'|'Fail'} state
     */

        // ==================== Состояние ====================

    let selectedDayUtcMs = null;
    let selectedSegment = 'auto'; // 'auto' | 'pre' | 'post' | null

    /** @type {ApiInfoResponse|null} */
    let API_INFO_CACHE = null;
    let API_INFO_PROMISE = null;
    /** @type {number|null} */
    let NOW_MS = null;

    // Автообновление API
    const AUTO_REFRESH_INTERVAL_FOCUSED_MS = 30000; // 30 секунд в фокусе
    const AUTO_REFRESH_INTERVAL_HIDDEN_MS = 1800000; // 30 минут без фокуса
    let autoRefreshIntervalId = null;
    let isRefreshing = false;

    /** @type {Set<number>} ID квестов, которые были выполнены на прошлой отрисовке */
    let previouslyDoneQuestIds = new Set();

    let MIN_DAY_UTC_MS = null;
    let MAX_DAY_UTC_MS = null;
    let MIN_SEG = null;
    let MAX_SEG = null;

    // Смещение серверного времени относительно локального (мс)
    let SERVER_TIME_OFFSET = null;

    // ==================== DOM-кэш ====================

    const DOM = {
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

    const clearDOMCache = () => {
        for (const key of Object.keys(DOM)) {
            DOM[key] = null;
        }
    };

    // ==================== Перехват API ====================

    /** @param {string|URL} url */
    const normalizeUrlToPath = (url) => {
        try {
            return new URL(url, location.href).pathname;
        } catch {
            return String(url || '');
        }
    };

    const installApiInfoInterceptor = () => {
        if (pageWindow.__tmAA_fetchPatched) return;
        pageWindow.__tmAA_fetchPatched = true;

        const origFetch = pageWindow.fetch.bind(pageWindow);

        pageWindow.fetch = async (...args) => {
            const input = args[0];
            const urlStr =
                typeof input === 'string' ? input :
                    (input && typeof input === 'object' && 'url' in input) ? input.url :
                        String(input);

            const path = normalizeUrlToPath(urlStr);
            const t0 = Date.now();
            const res = await origFetch(...args);
            const t1 = Date.now();

            if (path === API_INFO_PATH) {
                if (NOW_MS == null) {
                    const dateHeader = res.headers.get('Date');
                    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
                    if (Number.isFinite(parsed)) {
                        const halfRtt = (t1 - t0) / 2;
                        NOW_MS = parsed + halfRtt;
                    }
                }

                if (API_INFO_PROMISE == null) {
                    API_INFO_PROMISE = res.clone().json();
                    API_INFO_PROMISE
                        .then((json) => { API_INFO_CACHE = json; })
                        .catch(() => {});
                }
            }

            return res;
        };
    };

    installApiInfoInterceptor();

    // ==================== Форматирование title квеста ====================

    /** @param {number} num */
    const toRoman = (num) => {
        const numerals = [
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

    /** @param {string} title */
    const formatQuestTitle = (title) => {
        if (!title) return '';

        // Убираем * в конце
        let result = title.replace(/\*+$/, '');

        // Находим число в конце (может быть вплотную к слову или через пробел)
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

    // ==================== Утилиты даты/времени (МСК) ====================

    const pad2 = (n) => String(n).padStart(2, '0');

    const nowMs = () => {
        if (NOW_MS == null) {
            throw new Error('[ArcheAgeExtraUI] NOW_MS is not initialized');
        }
        return NOW_MS;
    };

    const getNowUnix = () => Math.floor(nowMs() / 1000);

    /**
     * @param {number} utcMs
     * @returns {{ y: number, m: number, d: number }}
     * */
    const getMSKDatePartsFromUtcMs = (utcMs) => {
        const d = new Date(utcMs);
        const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = fmt.formatToParts(d);
        const y = Number(parts.find(p => p.type === 'year')?.value);
        const m = Number(parts.find(p => p.type === 'month')?.value);
        const day = Number(parts.find(p => p.type === 'day')?.value);
        return { y, m, d: day };
    };

    /** @param {{ y: number, m: number, d: number }} params */
    const formatDMY = ({ y, m, d }) => `${pad2(d)}.${pad2(m)}.${y}`;

    /** @param {number} unixSec */
    const formatTimeMSK = (unixSec) => {
        if (!unixSec) return '';
        return new Intl.DateTimeFormat('ru-RU', {
            timeZone: TZ,
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(unixSec * 1000));
    };

    /** @param {number} unixSec — Unix-секунды. */
    const dayUtcMsFromUnixByTZ = (unixSec) => {
        const ms = Number(unixSec || 0) * 1000;
        const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
        return Date.UTC(y, m - 1, d, 0, 0, 0);
    };

    const getTodayUtcMsByTZ = () => {
        const { y, m, d } = getMSKDatePartsFromUtcMs(nowMs());
        return Date.UTC(y, m - 1, d, 0, 0, 0);
    };

    const addDaysUtcMs = (dayUtcMs, deltaDays) => dayUtcMs + deltaDays * 86400000;

    /**
     * @param {number} dayUtcMs
     * @returns {{ start: number, end: number }} Unix-границы дня в МСК.
     * */
    const getDayBoundsUnix = (dayUtcMs) => {
        const { y, m, d } = getMSKDatePartsFromUtcMs(dayUtcMs);
        const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MSK_OFFSET_HOURS * 3600 * 1000;
        const endMs = startMs + 86400000;
        return { start: Math.floor(startMs / 1000), end: Math.floor(endMs / 1000) };
    };

    /**
     * @param {number} dayUtcMs
     * @param {number} hourMsk — час МСК (0–23).
     */
    const getUnixForDayAtHour = (dayUtcMs, hourMsk) => {
        const { start } = getDayBoundsUnix(dayUtcMs);
        return start + hourMsk * 3600;
    };

    const isSameDayByTZ = (aUtcMs, bUtcMs) => {
        const a = getMSKDatePartsFromUtcMs(aUtcMs);
        const b = getMSKDatePartsFromUtcMs(bUtcMs);
        return a.y === b.y && a.m === b.m && a.d === b.d;
    };

    const isThursdayByTZ = (dayUtcMs) => {
        const w = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
            .format(new Date(dayUtcMs));
        return w === 'Thu';
    };

    // ==================== Обратный отсчёт до событий ====================

    // Получить текущее серверное время (с учётом смещения)
    const getServerNowMs = () => {
        if (SERVER_TIME_OFFSET == null) return Date.now();
        return Date.now() + SERVER_TIME_OFFSET;
    };

    // Инициализировать смещение серверного времени
    const initServerTimeOffset = () => {
        if (NOW_MS != null && SERVER_TIME_OFFSET == null) {
            SERVER_TIME_OFFSET = NOW_MS - Date.now();
        }
    };

    // Синхронизировать серверное время (для страниц без API марафона)
    const syncServerTime = async () => {
        if (SERVER_TIME_OFFSET != null) return;
        try {
            const t0 = Date.now();
            const res = await fetch(location.href, { method: 'HEAD', credentials: 'include', cache: 'no-store' });
            const t1 = Date.now();
            const dateHeader = res.headers.get('Date');
            const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
            if (Number.isFinite(parsed)) {
                NOW_MS = parsed + (t1 - t0) / 2;
                SERVER_TIME_OFFSET = NOW_MS - Date.now();
            }
        } catch {
            // ignore
        }
    };

    // Получить день недели в МСК (1=Пн, 2=Вт, ..., 6=Сб, 7=Вс)
    const getMSKWeekday = (utcMs) => {
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
        const dayStr = fmt.format(new Date(utcMs));
        const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
        return map[dayStr] ?? 1;
    };

    // Получить текущее время МСК в секундах от начала дня
    const getMSKTimeOfDaySeconds = (utcMs) => {
        const fmt = new Intl.DateTimeFormat('ru-RU', {
            timeZone: TZ,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const str = fmt.format(new Date(utcMs));
        const [h, m, s] = str.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    };

    // Названия дней недели для отображения (1=Пн, ..., 7=Вс)
    const WEEKDAY_NAMES = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс' };

    // Парсит время из строки "HH:MM" в { hours, minutes }
    const parseTime = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return { hours: h, minutes: m };
    };

    /**
     * Вычисляет секунды до ближайшего события.
     * Возвращает 0, если событие идёт прямо сейчас; положительное число — секунды до начала; null — нет событий.
     * @param {EventSchedule[]} events
     */
    const getSecondsUntilNextEvent = (events) => {
        if (!events || !events.length) return null;

        const serverNow = getServerNowMs();
        const nowWeekday = getMSKWeekday(serverNow);
        const nowSeconds = getMSKTimeOfDaySeconds(serverNow);

        let minDiff = Infinity;

        for (const event of events) {
            const start = parseTime(event.timeStart);
            const startSeconds = start.hours * 3600 + start.minutes * 60;

            if (event.timeEnd) {
                const end = parseTime(event.timeEnd);
                const endSeconds = end.hours * 3600 + end.minutes * 60;

                // Проверяем, идёт ли событие сейчас (для текущего дня/дней недели)
                const isToday = !event.weekdays || event.weekdays.length === 0 || event.weekdays.includes(nowWeekday);
                if (isToday && nowSeconds >= startSeconds && nowSeconds < endSeconds) {
                    return -(endSeconds - nowSeconds); // Отрицательное = идёт, abs = секунд до конца
                }
            }

            if (!event.weekdays || event.weekdays.length === 0) {
                let diff = startSeconds - nowSeconds;
                if (diff <= 0) diff += 24 * 3600;
                if (diff < minDiff) minDiff = diff;
            } else {
                for (const targetWeekday of event.weekdays) {
                    let daysUntil = targetWeekday - nowWeekday;
                    if (daysUntil < 0) daysUntil += 7;

                    let diff = daysUntil * 24 * 3600 + (startSeconds - nowSeconds);
                    if (diff <= 0) diff += 7 * 24 * 3600;

                    if (diff < minDiff) minDiff = diff;
                }
            }
        }

        return minDiff === Infinity ? null : minDiff;
    };

    /** @param {EventSchedule} event */
    const formatEventTime = (event) =>
        event.timeEnd ? `${event.timeStart}–${event.timeEnd}` : event.timeStart;

    /** @param {EventSchedule[]} events */
    const formatEventsToString = (events) => {
        if (!events || !events.length) return '';

        // Группируем события: с днями недели отдельно, ежедневные отдельно
        const daily = [];
        const withWeekdays = [];

        for (const event of events) {
            if (!event.weekdays || event.weekdays.length === 0) {
                daily.push(formatEventTime(event));
            } else {
                withWeekdays.push(event);
            }
        }

        const parts = [];

        // Ежедневные времена
        if (daily.length > 0) {
            parts.push(daily.join(' / '));
        }

        // События с днями недели
        for (const event of withWeekdays) {
            const days = event.weekdays.map(d => WEEKDAY_NAMES[d]).join(', ');
            parts.push(`${days} ${formatEventTime(event)}`);
        }

        return parts.join(' / ');
    };

    // ==================== Уведомления о событиях ====================

    const loadNotificationState = () => {
        try {
            const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    enabled: !!parsed.enabled,
                    events: parsed.events || {},
                    notified: parsed.notified || {},
                };
            }
        } catch { /* ignore */ }
        return { enabled: false, events: {}, notified: {} };
    };

    const saveNotificationState = (state) => {
        try {
            localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(state));
        } catch { /* ignore */ }
    };

    const getMSKDateString = (utcMs) => {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: TZ,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return fmt.format(new Date(utcMs)); // "YYYY-MM-DD"
    };

    const cleanOldNotifiedKeys = (state) => {
        const today = getMSKDateString(getServerNowMs());
        const keys = Object.keys(state.notified);
        let changed = false;
        for (const key of keys) {
            const datePrefix = key.split('_')[0];
            if (datePrefix < today) {
                delete state.notified[key];
                changed = true;
            }
        }
        if (changed) saveNotificationState(state);
    };

    const showEventNotification = (ev, entry) => {
        const timeLabel = entry.timeEnd ? `${entry.timeStart}\u2013${entry.timeEnd}` : entry.timeStart;
        const location = ev.locations?.length ? ev.locations.join(', ') : '';
        const body = location ? `${timeLabel} \u2014 ${location}` : timeLabel;
        try {
            new Notification(ev.title, { body, icon: 'https://aa.cdn.gmru.net/ms/data/old/9d56835cb7de079738b7e95471186c09.png', tag: `aa-ev-${ev.title}-${entry.timeStart}` });
        } catch { /* ignore */ }
    };

    const checkEventNotifications = () => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const state = loadNotificationState();
        if (!state.enabled) return;

        cleanOldNotifiedKeys(state);

        const visOverrides = loadEventVisibility();
        const serverNow = getServerNowMs();
        const nowWd = getMSKWeekday(serverNow);
        const nowSec = getMSKTimeOfDaySeconds(serverNow);
        const todayStr = getMSKDateString(serverNow);

        let changed = false;

        for (const ev of EVENTS) {
            const evNotif = ev.code in state.events ? state.events[ev.code] : !!ev.defaultNotifications;
            if (!evNotif) continue;
            if (!isEventVisible(ev, visOverrides)) continue; // скрытые — без уведомлений

            for (const entry of ev.schedule) {
                const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
                if (!isToday) continue;

                const { hours, minutes } = parseTime(entry.timeStart);
                const startSec = hours * 3600 + minutes * 60;
                const diff = startSec - nowSec;

                // 5 минут = 300 секунд, допуск ±30с для интервала проверки
                if (diff >= 270 && diff <= 330) {
                    const key = `${todayStr}_${ev.code}_${entry.timeStart}`;
                    if (!state.notified[key]) {
                        showEventNotification(ev, entry);
                        state.notified[key] = true;
                        changed = true;
                    }
                }
            }
        }

        if (changed) saveNotificationState(state);
    };

    /** @param {number|null} seconds */
    const formatCountdown = (seconds) => {
        if (seconds == null || seconds < 0) return '';

        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (d > 0) {
            return `${d}д ${h}ч`;
        } else if (h > 0) {
            return `${h}ч ${m}м`;
        } else if (m > 0) {
            return `${m}м ${s}с`;
        } else {
            return `${s}с`;
        }
    };

    /** @param {HTMLElement} el @param {number|null} seconds */
    const updateCountdownEl = (el, seconds) => {
        el.classList.remove('tm-countdown--active', 'tm-countdown--waiting');
        if (seconds == null) {
            el.textContent = '';
        } else if (seconds <= 0) {
            el.textContent = ` (идёт, ещё ${formatCountdown(-seconds)})`;
            el.classList.add('tm-countdown--active');
        } else {
            el.textContent = ` (через ${formatCountdown(seconds)})`;
            el.classList.add('tm-countdown--waiting');
        }
    };

    // Игровое время: 1 игровая минута = 10 реальных секунд,
    // игровая полночь (00:00) = 02:20 МСК (цикл 4 реальных часа).
    const GAME_MIDNIGHT_MSK_SECONDS = 2 * 3600 + 20 * 60; // 02:20:00 = 8400с
    const GAME_DAY_REAL_SECONDS = 14400; // 4 часа
    const REAL_TO_GAME_FACTOR = 6; // 1 реальная секунда = 6 игровых

    const getGameTime = (serverNowMs) => {
        const d = new Date(serverNowMs);
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
        }).formatToParts(d);
        const h = +parts.find(p => p.type === 'hour').value;
        const m = +parts.find(p => p.type === 'minute').value;
        const s = +parts.find(p => p.type === 'second').value;
        const mskSeconds = h * 3600 + m * 60 + s;

        const realSinceGameMidnight = ((mskSeconds - GAME_MIDNIGHT_MSK_SECONDS) % GAME_DAY_REAL_SECONDS
            + GAME_DAY_REAL_SECONDS) % GAME_DAY_REAL_SECONDS;
        const gameSeconds = realSinceGameMidnight * REAL_TO_GAME_FACTOR;

        const gh = Math.floor(gameSeconds / 3600) % 24;
        const gm = Math.floor((gameSeconds % 3600) / 60);
        return `${pad2(gh)}:${pad2(gm)}`;
    };

    // Обновляет все countdown элементы на странице
    const updateAllCountdowns = () => {
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
    };

    // Запуск интервала обновления countdown
    let countdownIntervalId = null;
    const startCountdownInterval = () => {
        if (countdownIntervalId != null) return;
        countdownIntervalId = setInterval(updateAllCountdowns, 1000);
    };

    // ==================== LocalStorage для "Скрыть выполненные" ====================

    const getHideDoneDayKey = () => {
        const ms = nowMs();
        // Вычитаем 2 часа, чтобы граница дня была в 00:00 МСК
        const shiftedMs = ms - DAY_RESET_HOUR * 3600 * 1000;
        const { y, m, d } = getMSKDatePartsFromUtcMs(shiftedMs);
        return `${y}-${pad2(m)}-${pad2(d)}`;
    };

    const loadHideDoneState = () => {
        try {
            const raw = localStorage.getItem(LS_KEYS.HIDE_DONE);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.dayKey !== getHideDoneDayKey()) return false;
            return !!data.checked;
        } catch {
            return false;
        }
    };

    const saveHideDoneState = (checked) => {
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

    /**
     * @typedef {Object} HistoryEntry
     * @property {string} code
     * @property {number} completedAt — unix timestamp (last_complete_time)
     */

    /** @returns {Record<string, HistoryEntry[]>} */
    const loadAllQuestHistory = () => {
        try {
            return JSON.parse(localStorage.getItem(LS_KEYS.QUEST_HISTORY)) || {};
        } catch {
            return {};
        }
    };

    /**
     * Читает историю из localStorage, мержит новые записи из API и сохраняет обратно.
     * Один read–modify–write цикл без промежуточных чтений,
     * чтобы минимизировать гонку между вкладками.
     * @param {ApiQuest[]} quests
     * @returns {HistoryEntry[]}
     */
    const mergeQuestHistory = (quests) => {
        if (!cachedUid) return [];

        // Единственное чтение — максимально свежее состояние
        const all = loadAllQuestHistory();
        const history = all[cachedUid] || [];
        const existing = new Set(history.map(e => `${e.code}:${e.completedAt}`));

        for (const q of quests) {
            const t = Number(q.last_complete_time || 0);
            if (!t) continue;
            const key = `${q.code}:${t}`;
            if (existing.has(key)) continue;
            history.push({
                code: q.code,
                completedAt: t,
            });
            existing.add(key);
        }

        history.sort((a, b) => b.completedAt - a.completedAt);

        // Обрезаем до лимита
        if (history.length > HISTORY_MAX_ENTRIES) {
            history.length = HISTORY_MAX_ENTRIES;
        }

        // Единственная запись — используем тот же объект all,
        // чтобы данные других пользователей не потерялись
        try {
            all[cachedUid] = history;
            localStorage.setItem(LS_KEYS.QUEST_HISTORY, JSON.stringify(all));
        } catch {
            // ignore
        }

        return history;
    };

    /** UID текущего пользователя; заполняется при инициализации. */
    let cachedUid = null;

    let historyCurrentPage = 1;
    /** @type {HistoryEntry[]} */
    let historyEntries = [];

    /** Форматирует unix-секунды в строку «DD.MM.YYYY HH:MM» (МСК). */
    const formatDateTimeMSK = (unixSec) => {
        if (!unixSec) return '';
        const ms = unixSec * 1000;
        const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
        const time = formatTimeMSK(unixSec);
        return `${pad2(d)}.${pad2(m)}.${y} ${time}`;
    };

    /** Перерисовывает таблицу истории выполнений в DOM. */
    const renderHistoryTable = () => {
        const section = document.querySelector('section.history-events');
        if (!section) return;

        const layout = section.querySelector('.layout');
        if (!layout) return;

        // Удаляем старую таблицу и пагинацию (нативные или наши)
        const oldWrap = layout.querySelector('.table__wrap');
        if (oldWrap) oldWrap.remove();

        if (!historyEntries.length) return;

        const totalPages = Math.ceil(historyEntries.length / HISTORY_PER_PAGE);
        if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;

        const start = (historyCurrentPage - 1) * HISTORY_PER_PAGE;
        const pageItems = historyEntries.slice(start, start + HISTORY_PER_PAGE);

        // Маппинг code → description из текущего кэша API
        const questsMap = API_INFO_CACHE?.data?.quests || {};

        // Таблица
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

        // Обёртка
        const wrap = document.createElement('div');
        wrap.className = 'table__wrap';
        wrap.appendChild(table);

        // Пагинация
        if (totalPages > 1) {
            const ul = document.createElement('ul');
            ul.className = 'pagination';

            const makePageItem = (page, text, className, disabled, onClick) => {
                const li = document.createElement('li');
                li.className = 'pagination__item' + (className ? ' ' + className : '') + (disabled ? ' disabled' : '');
                li.textContent = text;
                li.addEventListener('click', () => {
                    if (!disabled) onClick(page);
                });
                return li;
            };

            const makeEllipsisItem = () => {
                const li = document.createElement('li');
                li.className = 'pagination__item pagination__item--ellipsis disabled';
                li.textContent = '...';
                return li;
            };

            const maxVisiblePages = 9;
            let firstPage = Math.max(1, historyCurrentPage - 4);
            let lastPage = Math.min(totalPages, historyCurrentPage + 4);

            if (lastPage - firstPage + 1 < maxVisiblePages) {
                if (firstPage === 1) {
                    lastPage = Math.min(totalPages, firstPage + maxVisiblePages - 1);
                } else if (lastPage === totalPages) {
                    firstPage = Math.max(1, lastPage - maxVisiblePages + 1);
                }
            }

            const firstLi = makePageItem(1, '«', 'pagination__item--first', historyCurrentPage <= 1, () => {
                historyCurrentPage = 1;
                renderHistoryTable();
            });
            firstLi.title = 'Первая страница';
            ul.appendChild(firstLi);

            // «←»
            const prevLi = document.createElement('li');
            prevLi.className = 'pagination__item pagination__item--prev'
                + (historyCurrentPage <= 1 ? ' disabled' : '');
            prevLi.title = 'Предыдущая страница';
            prevLi.innerHTML = '<i class="icons-arrow"></i>';
            prevLi.addEventListener('click', () => {
                if (historyCurrentPage > 1) {
                    historyCurrentPage--;
                    renderHistoryTable();
                }
            });
            ul.appendChild(prevLi);

            // Номера страниц
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

            // «→»
            const nextLi = document.createElement('li');
            nextLi.className = 'pagination__item pagination__item--next'
                + (historyCurrentPage >= totalPages ? ' disabled' : '');
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

    /**
     * Обновляет историю из текущего кэша API и перерисовывает таблицу.
     * Вызывается при загрузке и после каждого обновления данных.
     */
    const updateQuestHistory = () => {
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

    /** @typedef {'pre'|'post'|'auto'|null} Segment */

    /** @typedef {{ dayUtcMs: number, segment: Segment }} SlotPosition */

    /**
     * @param {number} dayUtcMs
     * @param {Segment} segment
     * @returns {number}
     */
    const slotKey = (dayUtcMs, segment) => {
        const seg = segment === 'pre' ? 0 : segment === 'post' ? 2 : 1;
        return dayUtcMs * 10 + seg;
    };

    /**
     * @param {number} dayUtcMs
     * @param {Segment} seg
     * @returns {Segment}
     */
    const normalizeSegmentForDay = (dayUtcMs, seg) => {
        if (!isThursdayByTZ(dayUtcMs)) return null;
        if (seg === 'pre' || seg === 'post' || seg === 'auto') return seg;
        return 'post';
    };

    /**
     * Резолвит 'auto' в конкретный сегмент ('pre'/'post') или null для не-четверга.
     * @param {number} dayUtcMs
     * @param {Segment} seg
     * @returns {'pre'|'post'|null}
     */
    const effectiveSegment = (dayUtcMs, seg) => {
        if (!isThursdayByTZ(dayUtcMs)) return null;
        if (seg === 'pre' || seg === 'post') return seg;

        const todayUtc = getTodayUtcMsByTZ();
        const isToday = isSameDayByTZ(dayUtcMs, todayUtc);
        if (!isToday) return 'post';

        const { start } = getDayBoundsUnix(dayUtcMs);
        const cut = start + 9 * 3600;
        return getNowUnix() < cut ? 'pre' : 'post';
    };

    /**
     * @param {number} dayUtcMs
     * @param {Segment} seg
     * @returns {{ start: number, end: number }}
     */
    const getSlotBoundsUnix = (dayUtcMs, seg) => {
        const { start, end } = getDayBoundsUnix(dayUtcMs);
        if (!isThursdayByTZ(dayUtcMs)) return { start, end };

        const cut = start + 9 * 3600;
        const s = effectiveSegment(dayUtcMs, seg);
        if (s === 'pre') return { start, end: cut };
        return { start: cut, end };
    };

    /**
     * @param {number} dayUtcMs
     * @param {Segment} seg
     * @returns {SlotPosition}
     */
    const getPrevSlot = (dayUtcMs, seg) => {
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

    /**
     * @param {number} dayUtcMs
     * @param {Segment} seg
     * @returns {SlotPosition}
     */
    const getNextSlot = (dayUtcMs, seg) => {
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

    /**
     * @param {number} dayUtcMs
     * @param {Segment} segment
     * @returns {SlotPosition}
     */
    const clampNotPast = (dayUtcMs, segment) => {
        const todayUtc = getTodayUtcMsByTZ();

        if (dayUtcMs < todayUtc) {
            dayUtcMs = todayUtc;
            if (isThursdayByTZ(dayUtcMs)) {
                segment = (segment === 'auto') ? 'auto' : 'post';
            } else {
                segment = 'auto';
            }
        }

        return { dayUtcMs, segment };
    };

    /**
     * @param {number} dayUtcMs
     * @param {Segment} segment
     * @returns {SlotPosition}
     */
    const clampSelectedDay = (dayUtcMs, segment) => {
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

    /**
     * Единая точка навигации: резолвит 'auto', клампит и применяет.
     * Все навигационные действия (стрелки, «Сегодня», инициализация) должны идти через неё.
     */
    const applySlot = (dayUtcMs, segment) => {
        // Резолвим 'auto' в конкретный сегмент
        segment = effectiveSegment(dayUtcMs, segment) ?? segment;
        // Клампим в границы API
        const c = clampSelectedDay(dayUtcMs, segment);
        selectedDayUtcMs = c.dayUtcMs;
        selectedSegment = c.segment;
    };

    // ==================== Квесты ====================

    /**
     * @param {ApiQuest} q
     * @param {number} unix
     */
    const isQuestActiveAtUnix = (q, unix) => {
        const qs = Number(q?.start_time || 0);
        const qe = Number(q?.end_time || 0);
        if (!qs || !qe) return false;
        return qs <= unix && unix < qe;
    };

    /**
     * @param {ApiQuest} q
     * @param {number} dayUtcMs
     * @param {Segment} seg
     */
    /**
     * Ищет в истории время выполнения квеста в указанном слоте.
     * @param {string} code
     * @param {number} dayUtcMs
     * @param {Segment} seg
     * @returns {number} unix timestamp или 0
     */
    const getCompletionTimeInSlot = (code, dayUtcMs, seg) => {
        const b = getSlotBoundsUnix(dayUtcMs, seg);
        const entry = historyEntries.find(e => e.code === code && b.start <= e.completedAt && e.completedAt < b.end);
        return entry ? entry.completedAt : 0;
    };

    const isDoneInSelectedSlot = (q, dayUtcMs, seg) => {
        return getCompletionTimeInSlot(q.code, dayUtcMs, seg) > 0;
    };

    /** @param {ApiQuest} q */
    const getRewardAmount = (q) => {
        const steps = q?.steps;
        const step1 = steps?.['1'] || steps?.[1];
        const amount = step1?.rewards?.[0]?.value?.amount;
        return Number(amount || 0);
    };

    /**
     * @param {ApiInfoResponse} json
     * @returns {ApiQuest[]}
     */
    const getQuestsArrayFromInfo = (json) => {
        const quests = json?.data?.quests;
        if (!quests || typeof quests !== 'object') throw new Error('api/info: quests not found');
        return Object.values(quests);
    };

    /** @param {number} unix */
    const debugTime = (unix) => {
        if (!unix) return null;
        return new Date(unix * 1000).toISOString();
    };

    /** @param {ApiQuest} q */
    const summarizeQuestForDebug = (q) => ({
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

    const renderEmptyTasksDiagnostic = (listEl, message) => {
        const empty = document.createElement('div');
        empty.className = 'tasks__item tm-tasks-empty';
        empty.textContent = message;
        listEl.appendChild(empty);
    };

    // ==================== Внешние ссылки (Codex, Veksel) ====================

    const CODEX_BASE = 'https://archeagecodex.com/ru/quest/';
    const CODEX_IMAGES_BASE = 'https://archeagecodex.com/images/';
    const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
    const ICON_VEKSEL = 'https://aa.cdn.gmru.net/ms/data/game-icons/e046763d68cd5d1b2dbd5513fc845e07.png';
    const ICON_VEKSEL_NORTH = 'https://aa.cdn.gmru.net/ms/data/game-icons/6a0ac94699b0c4d678470feb07f3fa85.png';
    const ICON_GISAA_OVERLAY = 'https://gisaa.ru/img/gisaa.svg?v=1';
    const VEKSEL_BASE = 'https://gisaa.ru/veksel/';

    /** @type {Record<number, string>} */
    const SERVERS = {
        1: 'Луций', 2: 'Кипроза', 3: 'Мелисара',
        24: 'Невер', 31: 'Гартарейн', 32: 'Левиафан', 33: 'Ария', 34: 'Иштар', 35: 'Хазе',
        42: 'Корвус', 43: 'Каиль',  44: 'Нуи', 45: 'Фанем', 46: 'Шаеда', 47: 'Ренессанс', 48: 'Кракен', 49: 'Ифнир',
        51: 'Эрнард', 52: 'Морфеос', 53: 'Марли', 54: 'Ашьяра', 55: 'Гленн', 56: 'Лорея',
        61: 'Ксанатос', 62: 'Тарон', 63: 'Рейвен', 64: 'Нагашар', 65: 'Мираж', 66: 'Фесаникс',
    };

    let vekselUrlResolved = VEKSEL_BASE;
    let vekselAutoDetectedServerId = '';

    const loadVekselServerIdOverride = () => {
        try {
            const id = localStorage.getItem(LS_KEYS.VEKSEL_SERVER_ID);
            return id && SERVERS[id] ? id : '';
        } catch {
            return '';
        }
    };

    const saveVekselServerIdOverride = (serverId) => {
        try {
            if (serverId && SERVERS[serverId]) {
                localStorage.setItem(LS_KEYS.VEKSEL_SERVER_ID, serverId);
            } else {
                localStorage.removeItem(LS_KEYS.VEKSEL_SERVER_ID);
            }
        } catch {
            // ignore
        }
    };

    const getVekselAutoOptionText = () => {
        const serverName = SERVERS[vekselAutoDetectedServerId];
        return `Автоопределение${serverName ? ` (${serverName})` : ''}`;
    };

    const updateVekselServerAutoOptionText = () => {
        document.querySelectorAll('[data-veksel-server-auto-option="1"]').forEach(option => {
            option.textContent = getVekselAutoOptionText();
        });
    };

    const updateRenderedVekselLinks = () => {
        document.querySelectorAll('.tm-veksel-link').forEach(link => {
            const veksel = link.dataset.veksel;
            let slot = null;
            let locations = null;
            try { slot = link.dataset.slot ? JSON.parse(link.dataset.slot) : null; } catch {}
            try { locations = link.dataset.locations ? JSON.parse(link.dataset.locations) : null; } catch {}
            link.href = buildVekselUrl(veksel, slot, locations);
        });
    };

    /**
     * Формирует URL для gisaa с параметрами.
     * @param {'blue_salt'|'north'|undefined} veksel
     * @param {Slot|null} slot
     * @param {string[]|undefined} locations — локации для северных квестов.
     */
    const buildVekselUrl = (veksel, slot, locations) => {
        const isBlueSalt = veksel === 'blue_salt';
        const isNorth = veksel === 'north';
        if (!isBlueSalt && !isNorth) return vekselUrlResolved;

        let params = null;
        const item = slot?.item;

        if (slot?.count && (item?.vekselName || item?.name)) {
            if (isBlueSalt) {
                params = `res=${encodeURIComponent(item.vekselName || item.name)}&amount=${slot.count}`;
            } else if (isNorth) {
                // Для северных - тип иконки берём из item.vekselType, локации из locations
                const iconType = item.vekselType || 'sack';
                if (locations && locations.length > 0) {
                    params = `loc=${encodeURIComponent(locations.join(','))}&amount=${slot.count}&icon=${iconType}`;
                } else {
                    params = `amount=${slot.count}&icon=${iconType}`;
                }
            }
        }

        if (!params) return vekselUrlResolved;

        const separator = vekselUrlResolved.includes('?') ? '&' : '?';
        return `${vekselUrlResolved}${separator}${params}`;
    };

    const getGisaaVekselKeyForQuest = (veksel, slot, locations) => {
        const item = slot?.item;
        const amount = Number(slot?.count || 0);
        if (!amount || !item) return null;

        if (veksel === 'blue_salt' && (item.vekselName || item.name)) {
            return makeGisaaVekselKey({
                type: 'blue_salt',
                resourceName: item.vekselName || item.name,
                amount,
            });
        }

        if (veksel === 'north') {
            return makeGisaaVekselKey({
                type: 'north',
                amount,
                iconType: item.vekselType || 'sack',
                locations,
            });
        }

        return null;
    };

    const makeGisaaInfoFromRows = (rows) => {
        const unique = (values) => [...new Set((values || []).filter(Boolean))];
        const matches = unique(rows.filter(row => row.status === 'match').map(row => row.location));
        const unknown = unique(rows.filter(row => row.status === 'unknown').map(row => row.location));
        const excludes = unique(rows.filter(row => row.status === 'exclude').map(row => row.location));

        if (matches.length) {
            return { status: 'available', locations: matches, unknownLocations: unknown, excludedLocations: excludes };
        }

        if (!unknown.length && excludes.length) {
            return { status: 'unavailable', locations: [], unknownLocations: unknown, excludedLocations: excludes };
        }

        return null;
    };

    const getGisaaVekselInfoFromSavedTable = (veksel, slot, locations) => {
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

    const getGisaaVekselInfoForQuest = (veksel, slot, locations) => (
        getGisaaVekselInfoFromSavedTable(veksel, slot, locations)
        || getSavedGisaaVekselInfo(getGisaaVekselKeyForQuest(veksel, slot, locations))
    );

    /**
     * @typedef {Object} Grade
     * @property {string} overlay - URL изображения рамки грейда.
     * @property {string} title - Название грейда.
     * @property {string} color - Цвет грейда (CSS).
     * @property {RegExp[]} [cartNamePatterns] - Паттерны грейда в названии предмета корзины.
     */

    /** @type {Grade[]} */
    const GRADES = [
        /* 0  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade0.png`, title: 'Бесполезный предмет', color: '#949293' },
        /* 1  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade1.png`, title: 'Обычный предмет', color: '#ba976d', cartNamePatterns: [/^обычн(?:ый|ая|ое|ые)\s+/] },
        /* 2  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade2.png`, title: 'Необычный предмет', color: '#77b064', cartNamePatterns: [/^необычн(?:ый|ая|ое|ые)\s+/] },
        /* 3  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade3.png`, title: 'Редкий предмет', color: '#558fd7', cartNamePatterns: [/^редк(?:ий|ая|ое|ие)\s+/] },
        /* 4  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade4.png`, title: 'Уникальный предмет', color: '#cb72d8', cartNamePatterns: [/^уникальн(?:ый|ая|ое|ые)\s+/] },
        /* 5  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade5.png`, title: 'Эпический предмет', color: '#d78b06', cartNamePatterns: [/^эпическ(?:ий|ая|ое|ие)\s+/] },
        /* 6  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade6.png`, title: 'Легендарный предмет', color: '#e17853', cartNamePatterns: [/^легендарн(?:ый|ая|ое|ые)\s+/] },
        /* 7  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade7.png`, title: 'Реликвия', color: '#f95252', cartNamePatterns: [/^реликвийн(?:ый|ая|ое|ые)\s+/] },
        /* 8  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade8.png`, title: 'Предмет эпохи чудес', color: '#cf7d5d', cartNamePatterns: [/\s+эпохи чудес$/] },
        /* 9  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade9.png`, title: 'Предмет эпохи сказаний', color: '#8fa5ca', cartNamePatterns: [/\s+эпохи сказаний$/] },
        /* 10 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade10.png`, title: 'Предмет эпохи легенд', color: '#bf7900', cartNamePatterns: [/\s+эпохи легенд$/] },
        /* 11 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade11.png`, title: 'Предмет эпохи мифов', color: '#c90b0b', cartNamePatterns: [/\s+эпохи мифов$/] },
        /* 12 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade12.png`, title: 'Предмет эпохи Двенадцати', color: '#ae98fe', cartNamePatterns: [/\s+эпохи двенадцати$/] },
    ];

    /**
     * @typedef {Object} ItemType
     * @property {string} [icon] - URL overlay-изображения типа.
     * @property {string} title - Название типа предмета.
     */

    /** @type {Record<string, ItemType>} */
    const ITEM_TYPES = {
        'unidentified': { title: 'Неопознанный предмет' },
        'quest':        { title: 'Задание' },
        'magical':      { title: 'Магический предмет' },
        'box':          { title: 'Ящик' },
        'equipment':    { title: 'Снаряжение' },
        'material':     { title: 'Материал' },
        'potion':       { title: 'Микстура' },
        'other':        { title: 'Прочее' },
        'rareMaterial': { title: 'Редкий материал' },
        'mount':        { title: 'Ездовой питомец' },
        'battlePet':    { title: 'Боевой питомец' },
        'lightArmor':   { title: 'Легкий доспех' },
        'furniture':    { title: 'Предмет интерьера' },
        'craftItem':    { title: 'Ремесленный предмет' },
    };

    /**
     * @typedef {Object} ItemSubType
     * @property {string} title - Название подтипа предмета.
     */

    /** @type {Record<string, ItemSubType>} */
    const ITEM_SUB_TYPES = {
        'ingot':          { title: 'Слиток металла' },
        'leather':        { title: 'Кожа' },
        'cloth':          { title: 'Ткань' },
        'lumber':         { title: 'Древесина' },

        'costume':        { title: 'Костюм' },
        'cloak':          { title: 'Плащ' },
        'windInstrument': { title: 'Духовой инструмент' },
    };

    /**
     * @typedef {Object} EquipmentSubType
     * @property {string} title - Название подтипа снаряжения.
     */

    /** @type {Record<string, EquipmentSubType>} */
    const EQUIPMENT_SUB_TYPES = {
        'helmet':            { title: 'Шлем' },
        'armor':             { title: 'Нагрудник' },
        'belt':              { title: 'Пояс' },
        'bracer':            { title: 'Наручи' },
        'gloves':            { title: 'Перчатки' },
        'cloak':             { title: 'Плащ' },
        'pants':             { title: 'Поножи' },
        'boots':             { title: 'Обувь' },
        'underwear':         { title: 'Нижнее бельё' },
        'necklace':          { title: 'Ожерелье' },
        'earrings':          { title: 'Серьга' },
        'ring':              { title: 'Кольцо' },
        'two_handed_weapon': { title: 'Двуручное оружие' },
        'ranged weapon':     { title: 'Оружие дальнего боя' },
        'instrument':        { title: 'Инструмент' },
        'weight':            { title: 'Груз' },
        'costume':           { title: 'Костюм' },
    };

    /**
     * @typedef {Object} ItemOverlay
     * @property {string} icon - URL overlay-изображения типа.
     */

    /** @type {Record<string, ItemOverlay>} */
    const ICON_OVERLAY = {
        'unconfirmed': { icon: 'https://archeagecodex.com/items/top_unconfirmed.png' },
        'seal':        { icon: 'https://archeagecodex.com/items/top_seal_08.png' },
        'quest_y':     { icon: 'https://archeagecodex.com/items/top_quest_y.png' },
        'quest_cash':  { icon: 'https://archeagecodex.com/items/top_quest_cash.png' },
    };

    const HERO_LEVEL_ICON = 'https://archeagecodex.com/images/icon_hlv.png';
    const MAX_HERO_LEVEL = 70;
    const MAX_LEVEL = 55 + MAX_HERO_LEVEL;
    const CURRENCY_ICONS = {
        gold: 'https://archeagecodex.com/items/gold.png',
        silver: 'https://archeagecodex.com/items/silver.png',
        bronze: 'https://archeagecodex.com/items/bronze.png',
    };

    /**
     * @typedef {Object} ItemBase
     * @property {number} id - ID предмета (используется для генерации URL на ArcheageCodex).
     * @property {string} icon - Полный URL иконки. Может содержать плейсхолдер {sex}.
     * @property {string} [iconM] - Значение для {sex} при мужском поле.
     * @property {string} [iconF] - Значение для {sex} при женском поле.
     * @property {number} [grade] - Грейд (индекс в массиве GRADES, 0–12).
     * @property {string} name - Название предмета.
     * @property {string} [type] - Ключ в ITEM_TYPES.
     * @property {string} [overlay] - Ключ в ICON_OVERLAY.
     * @property {string} [subType] - Ключ в ITEM_SUB_TYPES (например, 'ingot', 'costume').
     * @property {string} [equipmentSubType] - Ключ в EQUIPMENT_SUB_TYPES (например, 'helmet').
     * @property {string} [vekselName] - Название предмета для таблицы векселей (если отличается от name).
     * @property {string} [vekselType] - Тип для таблицы векселей ('sack' | 'archive' | 'license').
     * @property {boolean} [isPersonal] - Персональный предмет (отображается в секции требований).
     * @property {string} [description] - Описание предмета (отображается во второй секции всплывашки).
     * @property {string} [useDescription] - Описание использования (выводится под description зелёным цветом).
     * @property {string} [equipDescription] - Описание экипировки (выводится аналогично useDescription).
     * @property {boolean} [isEquipDescriptionTemporary] - Подписывать описание экипировки как временное.
     * @property {number|null} [price] - Цена продажи в бронзе (null = не нужен торговцам).
     * @property {number} [reqLevel] - Требуемый уровень.
     * @property {number} [maxLevel] - Максимальный уровень (0 = текущий максимум).
     * @property {string} [apiCategoryTitle] - Категория предмета из dynamic tooltip API.
     * @property {number|string} [speed] - Сноровка.
     * @property {number|string} [durability] - Прочность.
     * @property {number|string} [dps] - Урон.
     * @property {number|string} [armor] - Защита.
     * @property {number|string} [magicResistance] - Сопротивление.
     * @property {number|string} [mdps] - Сила заклинаний.
     * @property {number|string} [hdps] - Эффективность исцеления.
     * @property {number|string} [str] - Сила.
     * @property {number|string} [dex] - Ловкость.
     * @property {number|string} [sta] - Выносливость.
     * @property {number|string} [int] - Интеллект.
     * @property {number|string} [spi] - Мудрость.
     * @property {Record<string, string>} [buff] - Параметры эффекта.
     * @property {number|string} [buffDuration] - Длительность эффекта в секундах.
     */

    const snakeToCamel = (value) => (
        String(value || '').replace(/_([a-z])/g, (_, char) => char.toUpperCase())
    );

    const formatDurationValue = (value) => {
        const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];

        if (hours) parts.push(`${hours} ч.`);
        if (minutes) parts.push(`${minutes} м.`);
        if (seconds) parts.push(`${seconds} с.`);
        return parts.join(' ') || '0 с.';
    };

    const ITEM_PLACEHOLDER_FORMATTERS = {
        buffDuration: value => formatDurationValue(value),
    };

    const escapeHtmlAttribute = (value) => (
        String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
    );

    const decapitalize = (value) => (
        String(value || '').replace(/^./, char => char.toLowerCase())
    );

    const getItemPlaceholderValue = (item, field) => {
        const directValue = item?.[field];
        if (directValue != null) return directValue;

        if (!field.startsWith('buff') || !item?.buff || typeof item.buff !== 'object') return null;
        const buffField = decapitalize(field.slice('buff'.length));
        return item.buff[buffField] ?? null;
    };

    const resolveItemPlaceholders = (text, item) => (
        String(text || '').replace(/#\{([a-zA-Z0-9_]+)\}/g, (match, rawField) => {
            const field = snakeToCamel(rawField);
            const value = getItemPlaceholderValue(item, field);
            if (value == null) return `<span>(${rawField})</span>`;

            const formatter = ITEM_PLACEHOLDER_FORMATTERS[field];
            return formatter ? formatter(value, item) : String(value);
        })
    );

    /**
     * Парсит игровую разметку цвета (WoW/XLGames-формат) в HTML.
     * |cAARRGGBB...text...|r → <span style="color:#RRGGBBAA">text</span>
     * |nc;...text...|r       → <span class="inv-nc">text</span>
     * |nd;...text...|r       → <span class="inv-nd">text</span>
     * |ni;...text...|r       → <span class="inv-ni">text</span>
     * |nr;...text...|r       → <span class="inv-nr">text</span>
     * \n                     → <br>
     * @param {string} text
     * @returns {string} HTML-строка
     */
    const parseGameMarkup = (text, { preserveNewlines = false } = {}) => {
        if (!text) return '';
        const html = text
            .replace(/\|c([\da-fA-F]{2})([\da-fA-F]{6})(.*?)\|r/g,
                (_, alpha, color, inner) => `<span style="color:#${color}${alpha}">${inner}</span>`)
            .replace(/\|nc;(.*?)\|r/g,
                (_, inner) => `<span class="inv-nc">${inner}</span>`)
            .replace(/\|buffvar;(.*?)\|r/g,
                (_, inner) => `<span class="inv-buffvar">${inner}</span>`)
            .replace(/\|nn;(.*?)\|r/g,
                (_, inner) => `<span class="inv-nn">${inner}</span>`)
            .replace(/\|nd;(.*?)\|r/g,
                (_, inner) => `<span class="inv-nd">${inner}</span>`)
            .replace(/\|ni;(.*?)\|r/g,
                (_, inner) => `<span class="inv-ni">${inner}</span>`)
            .replace(/\|nr;(.*?)\|r/g,
                (_, inner) => `<span class="inv-nr">${inner}</span>`);

        return preserveNewlines ? html : html.replace(/\n/g, '<br/>');
    };

    const hasVisibleTooltipText = (value) => (
        String(value || '').replace(/\n|<br\s*\/?>/gi, '').trim().length > 0
    );

    /**
     * @typedef {string|number|boolean|null|Record<string, string|null|number|boolean>} DynamicTooltipFieldValue
     */

    /**
     * @typedef {Object} DynamicTooltipKnownFields
     * @property {string} [grade]
     * @property {string} [name]
     * @property {string} [name_metaphone]
     * @property {string} [category_id]
     * @property {string} [level_requirement]
     * @property {string} [level_limit]
     * @property {string} [description]
     * @property {string|null} [refund]
     * @property {string} [gradable]
     * @property {string} [disenchantable]
     * @property {string} [grade_enchantable]
     * @property {string} [fixed_grade]
     * @property {string} [filename]
     * @property {string} [c_dps]
     * @property {string} [c_mdps]
     * @property {string} [c_hdps]
     * @property {string} [c_speed]
     * @property {string} [c_armor]
     * @property {string} [c_magic_resistance]
     * @property {string} [c_str]
     * @property {string} [c_dex]
     * @property {string} [c_sta]
     * @property {string} [c_int]
     * @property {string} [c_spi]
     * @property {string} [c_durability]
     * @property {Record<string, string|null|number|boolean>|null} [buff]
     * @property {string} [num_sockets]
     * @property {string} [dyeing]
     * @property {string} [equip_tooltip]
     * @property {string} [set_description]
     * @property {string} [cat_name]
     * @property {string} [grade_name]
     * @property {string} [grade_color]
     */

    /** @typedef {DynamicTooltipKnownFields & Record<string, DynamicTooltipFieldValue|undefined>} DynamicTooltipData */

    /**
     * @param {DynamicTooltipFieldValue|undefined} value
     * @returns {string|null}
     */
    const cleanDynamicTooltipMarkup = (value) => {
        if (value == null) return null;
        let result = String(value)
            .replace(/\\+"/g, '"')
            .replace(/\\+'/g, "'")
            .replace(/<br\s*\/?>\s*\n/gi, '<br/>')
            .replace(/^(?:\s|\n|<br\s*\/?>)+/gi, '')
            .replace(/(?:\s|\n|<br\s*\/?>)+$/gi, '');

        return result ? result : null;
    };

    const stripHtmlForMatch = (value) => (
        String(value || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    );

    const DYNAMIC_EQUIP_TOOLTIP_PATTERNS = [
        /Здоровье/,
        /Защита/,
        /Сопротивление/,
        /Скорость\s+(?:передвижения|плавания|занятия|сбора)/,
        /Опыт\s+при\s+занятии/,
        /Время\s+применения\s+умений/,
    ];

    const isDynamicEquipTooltipPart = (value) => {
        const text = stripHtmlForMatch(value);
        return DYNAMIC_EQUIP_TOOLTIP_PATTERNS.some(pattern => pattern.test(text));
    };

    /**
     * @param {DynamicTooltipFieldValue|undefined} value
     * @returns {Partial<ItemBase>}
     */
    const mapDynamicEquipTooltip = (value) => {
        const raw = dynamicTooltipFieldValue(value);
        if (!raw) return {};

        const parts = raw
            .split(/<br\s*\/?>/i)
            .map(part => cleanDynamicTooltipMarkup(part))
            .filter(Boolean);

        const equipIndex = parts.findIndex(isDynamicEquipTooltipPart);
        if (equipIndex === -1) {
            const useDescription = cleanDynamicTooltipMarkup(raw);
            return useDescription ? { useDescription } : {};
        }

        const equipParts = [];
        let nextIndex = equipIndex;
        while (nextIndex < parts.length && isDynamicEquipTooltipPart(parts[nextIndex])) {
            equipParts.push(parts[nextIndex]);
            nextIndex++;
        }

        const result = {
            equipDescription: equipParts.join('<br/>'),
        };

        if (equipIndex > 0 && /^Действует\b/i.test(stripHtmlForMatch(parts[equipIndex - 1]))) {
            result.isEquipDescriptionTemporary = true;
        }

        const useDescription = cleanDynamicTooltipMarkup(parts.slice(nextIndex).join('<br/>'));
        if (useDescription) result.useDescription = useDescription;

        return result;
    };

    const CODEX_ITEM_URL = 'https://archeagecodex.com/ru/item/';
    const CODEX_ITEM_ICONS = 'https://archeagecodex.com/items/';
    const GMRU_CDN_ICONS = 'https://aa.cdn.gmru.net/ms/data/game-icons/';
    const ICON_SEX_VALUES = {
        m: { title: 'Мужской', field: 'iconM' },
        f: { title: 'Женский', field: 'iconF' },
    };

    const loadIconSex = () => {
        try {
            const sex = localStorage.getItem(LS_KEYS.ICON_SEX);
            return ICON_SEX_VALUES[sex] ? sex : 'm';
        } catch {
            return 'm';
        }
    };

    const saveIconSex = (sex) => {
        try {
            if (ICON_SEX_VALUES[sex]) {
                localStorage.setItem(LS_KEYS.ICON_SEX, sex);
            } else {
                localStorage.removeItem(LS_KEYS.ICON_SEX);
            }
        } catch {
            // ignore
        }
    };

    /**
     * @param {string} icon
     * @param {string} iconM
     * @param {string} iconF
     * @returns {string}
     */
    const getItemIconUrlFromParts = (icon, iconM, iconF) => {
        const sex = loadIconSex();
        const sexIcon = sex === 'm' ? iconM || iconF || 'm' : iconF || iconM || 'f';
        return sexIcon ? icon.replace(/\{sex\}/g, sexIcon) : icon;
    };

    /**
     * @param {ItemBase} item
     * @returns {string}
     */
    const getItemIconUrl = (item) => (
        getItemIconUrlFromParts(item?.icon || '', item?.iconM || '', item?.iconF || '')
    );

    const updateRenderedItemIcons = () => {
        document.querySelectorAll('.tm-item-icon-img[data-icon-template]').forEach(img => {
            img.src = getItemIconUrlFromParts(
                img.dataset.iconTemplate || '',
                img.dataset.iconM || '',
                img.dataset.iconF || ''
            );
        });
    };

    /** @type {Record<number, ItemBase>} */
    const ITEMS = Object.fromEntries([
        { id: 8256, type: 'material', subType: 'cloth', icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "Ткань" }, // icon_item_0356.png
        { id: 8318, type: 'material', subType: 'ingot', icon: `${GMRU_CDN_ICONS}9d60cae3016a14b2cfc17a90de8e5f5b.png`, grade: 1, name: "Слиток железа" }, // icon_item_quest053.png
        { id: 8337, type: 'material', subType: 'lumber', icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, name: "Упаковка строительной древесины", vekselName: "Строительная древесина" }, // icon_item_0041.png
        { id: 16327, type: 'material', subType: 'leather', icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, name: "Сыромятная кожа" }, // icon_item_0352.png
        { id: 35461, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Полновесный мешочек с серебром" }, // icon_item_1839.png
        { id: 40928, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, name: "Расшитый жемчугом кошелёк" }, // icon_item_3101.png
        { id: 42076, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, name: "Резной сундучок со всякой всячиной" }, // icon_item_3619.png
        { id: 42077, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, name: "Фермерский сундучок со всякой всячиной" }, // icon_item_3620.png
        { id: 43176, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, name: "Котомка эфенского странника" }, // icon_item_3906.png
        { id: 43177, type: 'unidentified', overlay: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, name: "Эфенский сундучок со всякой всячиной" }, // icon_item_3907.png
        { id: 8000749, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, name: "Лицензия на убийство: Баррага Безумный", description: 'Позволяет получить задание.' }, // icon_item_2762.png
        { id: 8000751, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, name: "Лицензия на убийство: иферийцы", description: 'Позволяет получить задание.' },
        { id: 8000752, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, name: "Лицензия на убийство: Иштар" },
        { id: 8000753, type: 'quest', overlay: 'quest_y', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, name: "Лицензия на убийство: повелитель подземелья" },

        { id: 48894, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4820.png', grade: 10, name: 'Драгоценная эфенская сфера бронника', description: 'Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет. Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r.' },
        { id: 54915, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1695.png', grade: 1, name: 'Свиток чар ифнирского героя' },
        { id: 45508, icon: 'https://archeagecodex.com/items/icon_item_4212.png', grade: 2, name: 'Сфера анимага' },
        { id: 8001565, icon: 'https://archeagecodex.com/items/icon_item_3628.png', grade: 1, name: 'Новенькая кирка' },
        { id: 8002452, overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_3349.png', grade: 1, name: 'Универсальный алхимический кристалл' },
        { id: 8002449, icon: 'https://archeagecodex.com/items/charge_wider.png', grade: 1, name: 'Дополнительная сумка' },
        { id: 47943, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_4710.png', grade: 1, name: 'Настойка усердного ремесленника' },
        { id: 39424, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_3017.png', grade: 1, name: 'Ирамийская гадальная руна', description: 'Позволяет заменить один из |nc;эффектов синтеза костюма, эфенского снаряжения, рамианского снаряжения или трофейного снаряжения мифических противников|r другим, выбранным случайным образом.', useDescription: 'Распаковать.\nУдерживая Shift, щелкните левой кнопкой мыши, чтобы распаковать все предметы этого типа, находящиеся в рюкзаке.' },
        { id: 46180, icon: 'https://archeagecodex.com/items/icon_item_1395.png', grade: 3, name: 'Солнечный настой' },
        { id: 47130, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2679.png', grade: 6, name: 'Хрустальная руна', description: '|nd;Можно получить одну из хрустальных рун на выбор:|r\n- хрустальная руна багровой луны,\n- хрустальная руна осенней луны,\n- хрустальная руна молодой луны,\n- хрустальная руна безмолвной луны,\n- хрустальная руна колдовской луны.' },
        { id: 47104, icon: 'https://archeagecodex.com/items/icon_item_4570.png', grade: 2, name: 'Парниковый купол' },
        { id: 48903, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3282.png', grade: 1, name: 'Набор сверкающих эфенских сфер' },
        { id: 48474, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3275.png', grade: 11, name: 'Большой набор мифических эссенций' },
        { id: 8002297, type: 'unidentified', overlay: 'seal', icon: 'https://archeagecodex.com/items/icon_item_2267.png', grade: 3, name: 'Королевский лунный изумруд' },
        { id: 35727, icon: 'https://archeagecodex.com/items/icon_item_1982.png', grade: 2, name: 'Буровая установка' },
        { id: 47082, icon: 'https://archeagecodex.com/items/icon_item_3369.png', grade: 1, name: 'Патент на транспортное средство' },
        { id: 31892, icon: 'https://archeagecodex.com/items/icon_item_1733.png', grade: 1, name: 'Земельный вексель' },
        { id: 55722, icon: 'https://archeagecodex.com/items/icon_item_5864.png', grade: 4, name: 'Искусная цитриновая гравировка' },
        { id: 48886, icon: 'https://archeagecodex.com/items/icon_item_4818.png', grade: 8, name: 'Сверкающая эфенская сфера бронника', description: 'Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r.' },
        { id: 55723, icon: 'https://archeagecodex.com/items/icon_item_5865.png', grade: 4, name: 'Искусная аквамариновая гравировка' },
        { id: 45747, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_4385.png', grade: 5, name: 'Драгоценный флакон с зельем охотника' },
        { id: 49270, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2273.png', grade: 5, name: 'Набор больших эфенских кубов' },
        { id: 45160, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_2376.png', grade: 4, name: 'Настойка спорыньи' },
        { id: 46623, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_0986.png', grade: 4, name: 'Настойка остролиста', buff: { duration: 1800 } },
        { id: 8001268, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток дельфийской библиотеки', buff: { duration: 3600 } },
        { id: 8001169, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток опыта V', buff: { duration: 3600 }, isPersonal: true },
        { id: 8001172, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток опыта VIII', buff: { duration: 3600 }, isPersonal: true },
        { id: 46181, icon: 'https://archeagecodex.com/items/icon_item_1396.png', grade: 3, name: 'Лунный настой' },
        { id: 48546, icon: 'https://archeagecodex.com/items/icon_item_3595.png', grade: 1, name: 'Письмена войны' },
        { id: 47655, icon: 'https://archeagecodex.com/items/icon_item_4709.png', grade: 4, name: 'Фиона Розовый Лепесток' },
        { id: 47581, icon: 'https://archeagecodex.com/items/icon_item_4211.png', grade: 3, name: 'Лиловое эмалевое стекло' },
        { id: 47479, icon: 'https://archeagecodex.com/items/icon_item_3519.png', grade: 1, name: 'Инкрустированный флакон с целебным эликсиром' },
        { id: 47480, icon: 'https://archeagecodex.com/items/icon_item_3520.png', grade: 1, name: 'Инкрустированный флакон с эликсиром маны' },
        { id: 8002996, icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела', description: 'Этот осколок – фрагмент отражения божественных сил в материальном мире. На |ni;станке для акхиума|r из таких частиц можно создать нумены.', price: 100 },
        { id: 8003072, icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела' },
        { id: 8001288, icon: 'https://archeagecodex.com/items/icon_item_0966.png', grade: 1, name: 'Цитрусовая карамелька', buff: { duration: 3600 } },
        { id: 8002649, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3259.png', grade: 4, name: 'Набор неверинских фейерверков' },
        { id: 8000540, icon: 'https://archeagecodex.com/items/icon_item_3207.png', grade: 1, name: 'Пушистая неверинская елочка' },
        { id: 49769, icon: 'https://archeagecodex.com/items/icon_item_4950.png', grade: 6, name: 'Зачарованный свиток пробуждения хранителя знаний' },
        { id: 54653, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 12, name: 'Сундук с обновленным рамианским снаряжением' },
        { id: 53515, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5266.png', grade: 2, isPersonal: true, price: 0, reqLevel: 1, name: 'Заговоренная рамианская руна', description: 'Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для проклятого, изначального, обновленного и совершенного рамианского снаряжения.|r', useDescription: 'Приступить к замене эффекта.\nРасход очков работы: |nc;50|r.' },
        { id: 52207, icon: 'https://archeagecodex.com/items/icon_item_3022.png', grade: 1, name: 'Мешочек с микстурами', description: 'Содержимое:\n- инкрустированный флакон с эликсиром маны (300 шт.),\n- инкрустированный флакон с целебным эликсиром (300 шт.),\n- солнечный настой (30 шт.),\n- лунный настой (30 шт.)' },
        { id: 51239, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с изначальным рамианским оружием эпохи мифов' },
        { id: 51240, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с изначальным рамианским оружием эпохи Двенадцати' },
        { id: 54654, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с обновленным рамианским оружием эпохи Двенадцати' },
        { id: 54655, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с обновленными рамианскими доспехами эпохи мифов' },
        { id: 47941, type: 'box', icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 10, name: 'Сундук с оружием Библиотеки Эрнарда эпохи легенд' },
        { id: 51243, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с магистерским эрнардским оружием эпохи Двенадцати' },
        { id: 55501, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5850.png', grade: 6, name: 'Сундучок с легендарным украшением ифнирского героя', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- легендарная серьга ифнирского героя,\n- легендарное кольцо ифнирского героя.' },
        { id: 51940, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Сундучок с ценным украшением эпохи чудес' },
        { id: 51236, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундучок с драгоценным украшением эпохи мифов', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов качества эпохи мифов:\n- перстень чемпиона Дома Норьетт,\n- серьга чемпиона Дома Норьетт,\n- ожерелье последнего рубежа,\n- ожерелье доблести воина XIII ранга,\n- ожерелье доблести целителя XIII ранга.' },
        { id: 55783, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2992.png', grade: 5, name: 'Сундучок с зачарованной гравировкой для украшений' },
        { id: 50924, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png', grade: 2, name: 'Дизайн широкополой шляпы стрелка' },
        { id: 50925, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth519.png', grade: 2, name: 'Дизайн соломенной шляпы' },
        { id: 8002486, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_{sex}_sk_korean006.png', grade: 1, name: 'Дизайн костюма хоури эпохи Фарвати' },
        { id: 51092, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_{sex}_sk_uniform004.png', grade: 2, name: 'Дизайн одеяния правителя северного Мейра' },
        { id: 129, type: 'magical', icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 1, name: 'Дельфийская руна', description: 'Неказистая руна из светлого песчаника.', useDescription: 'Позволяет мгновенно получить 200.000 очков опыта.', reqLevel: 50 },
        { id: 8003128, type: 'magical', icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 10, name: 'Дельфийская руна эпохи легенд', description: 'Древняя руна, наполненная невероятной магической силой.', useDescription: 'Позволяет мгновенно получить 125,000,000 очков опыта.', reqLevel: 91 },
        { id: 55280, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 6, name: 'Легендарная руна ифнирского героя' },
        { id: 55683, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями для украшений' },
        { id: 50536, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями', description: 'Открыв мешочек, вы сможете выбрать один из следующих предметов:\n- мешочек с рубиновыми магистериями,\n- мешочек с кварцевыми магистериями,\n- мешочек с сапфировыми магистериями,\n- мешочек с изумрудными магистериями,\n- мешочек с янтарными магистериями.' },
        { id: 8001148, icon: 'https://archeagecodex.com/items/icon_item_3807.png', grade: 2, name: 'Статуя «Орхидна на троне»' },
        { id: 8001203, icon: 'https://archeagecodex.com/items/icon_item_3277.png', grade: 1, name: 'Сундучок с фамильными ценностями' },
        { id: 54933, icon: 'https://archeagecodex.com/items/icon_item_5809.png', grade: 2, name: 'Замерзший пруд' },
        { id: 48860, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4002.png', grade: 6, name: 'Большая эфенская сфера оружейника', description: 'Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.' },
        { id: 48861, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4816.png', grade: 6, name: 'Большая эфенская сфера бронника', description: 'Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.' },
        { id: 44359, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_3559.png', grade: 1, name: 'Походный фиал славы' },
        { id: 55800, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5486.png', grade: 4, name: 'Сундучок с фрагментами судьбы', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- пыль судьбы (25 шт.),\n- слиток судьбы (5 шт.),\n- призма судьбы.' },
        { id: 8002772, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с боевым питомцем', description: 'Сняв печать, вы получите Квадрума, Мистериона или Мистериона, Ужаса Ночи (на выбор).' },
        { id: 50635, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5058.png', grade: 2, isPersonal: true, name: 'Заговоренная гадальная руна', description: 'Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для эфенского и рамианского снаряжения; трофеев, полученных за победу над мифическими противниками; ожерелий, полученных на Последнем рубеже; перстней говорящего с духами; а также для костюмов, плащей и украшений чемпионов Порт-Аргенто.|r', useDescription: 'Приступить к замене эффекта.<br>Расход очков работы: <span class="orange_text">50</span>.' },
        { id: 8002769, icon: 'https://archeagecodex.com/items/quest/icon_item_quest217.png', grade: 3, isPersonal: true, name: 'Знак «Ключевая фигура»', description: 'Позволяет получить титул «Ключевая фигура».', useDescription: 'Получить титул.' },
        { id: 30604, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x100' },
        { id: 28814, icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x180' },
        { id: 55450, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийное кольцо ифнирского героя' },
        { id: 8002410, type: 'equipment', subType: 'cloak', icon: 'https://archeagecodex.com/items/icon_item_0936.png', grade: 5, name: 'Алый шарф', description: 'Неизвестно, в чем причина, но к человеку в таком шарфе окружающие почему-то относятся с особенным уважением (и даже с некоторой опаской).\n\n|nc;Усиливающие эффекты костюма действуют 30 дней. Чтобы активировать их заново, костюм нужно постирать.|r', equipDescription: 'Скорость передвижения +|nc;3|r%\nСкорость плавания +|nc;3|r%\nСкорость занятия ремеслом |nc;+10%|r\nСкорость занятия животноводством |nc;+10%|r\nОпыт при занятии ремеслом |nc;+10|r%', isEquipDescriptionTemporary: true },
        { id: 34684, type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_s_0051.png', name: 'Укрепленная аргенитовая лютня' },
        { id: 34685, type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0025.png', name: 'Укрепленный аргенитовый кларнет' },
        { id: 417, icon: 'https://archeagecodex.com/items/icon_item_0418.png', grade: 1, name: 'Редкий камень странствий', isPersonal: true, description: 'Необходим для перемещения с помощью книги порталов.', price: 0, reqLevel: 1 },
        { id: 52701, icon: 'https://archeagecodex.com/items/icon_item_5282.png', grade: 1, name: 'Кристалл изначального анадия', description: 'Эти лиловые кристаллы – достойное подношение духам-хранителям.\nОдновременно в рюкзаке может быть не более пяти кристаллов. Кристаллы исчезнут через один час.', useDescription: 'Поднести кристалл духам-хранителям у древнего тотема или усилить призванного духа-хранителя.', price: 0 },
        { id: 40491, icon: 'https://archeagecodex.com/items/icon_item_3090.png', grade: 2, name: 'Знак отваги' },
        { id: 46695, icon: 'https://archeagecodex.com/items/icon_item_4557.png', grade: 3, name: 'Белоснежный олененок' },
        { id: 48521, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_2070.png', grade: 5, name: 'Большой эфенский куб оружейника' },
        { id: 48522, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_2069.png', grade: 5, name: 'Большой эфенский куб бронника' },
        { id: 8002273, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_1668.png', grade: 1, name: 'Набор анимага' },
        { id: 8002483, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3261.png', grade: 1, name: 'Коробка с бельем «Ночи Аль-Харбы»' },
        { id: 45409, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth292.png', grade: 2, name: 'Рамианское матерчатое снаряжение' },
        { id: 53586, type: 'unidentified', icon: 'https://archeagecodex.com/items/icon_item_5144.png', grade: 4, name: 'Золотой сундучок со знаками культистов' },
        { id: 46151, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4467.png', grade: 3, name: 'Заготовка огранщика', isPersonal: true },
        { id: 49252, type: 'quest', icon: 'https://archeagecodex.com/items/icon_item_4878.png', grade: 2, name: 'Образцы флоры Сада', isPersonal: true, price: 0, description: 'Пакетик с образцами флоры Сада Матери.' },
        { id: 31151, type: 'other', icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 1, name: 'Перевязанный ленточкой подарок', description: 'Похоже, один из снеговиков вместе с украшениями прихватил подарок из тех, что должен был раздавать на улицах города.', useDescription: 'Открыть подарок.\nУдерживая Shift, щелкните правой кнопкой мыши, чтобы открыть все подарки этого вида один за другим.', isPersonal: true, price: 0 },
        { id: 28188, type: 'rareMaterial', icon: `${GMRU_CDN_ICONS}d2f377e3c3118826089a2caf9e794a50.png`, grade: 3, name: 'Сплав стихий', description: 'Можно изготовить с помощью |ni;тигля стихий|r.\nИспользуется в ремесле.', isPersonal: true, price: 360 },
        { id: 55516, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 5, name: 'Эпическая руна ифнирского героя', isPersonal: true },
        { id: 55490, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Серьга ифнирского героя эпохи чудес', isPersonal: true },
        { id: 55255, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийная серьга ифнирского героя', isPersonal: true },
        { id: 52808, type: 'unidentified', overlay: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_teleport.png', grade: 1, name: 'Книга порталов (7 д.)', isPersonal: true },
        { id: 34702, type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0049.png', name: 'Зеркальный аргенитовый кларнет', buff: { avgRestoreMana: 16 } },
        { id: 51723, type: 'mount', icon: 'https://archeagecodex.com/items/icon_item_5149.png', grade: 4, name: 'Ящик с Мару, покорителем просторов', isPersonal: true },
        { id: 8002771, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с глайдером', isPersonal: true },
        { id: 39363, type: 'battlePet', icon: 'https://archeagecodex.com/items/icon_item_2275.png', grade: 1, name: 'Осенний Лоскутик' },
        { id: 34972, icon: 'https://archeagecodex.com/items/doll_pet_hm_001.png', grade: 1, name: 'Красные очки-сердечки' },
        { id: 34975, icon: 'https://archeagecodex.com/items/doll_pet_bo_001.png', grade: 1, name: 'Кулинарные перчатки в красный горошек' },
        { id: 36183, icon: 'https://archeagecodex.com/items/doll_pet_ar_007.png', grade: 1, name: 'Красный заводной ключик' },
        { id: 34981, type: 'battlePet', icon: 'https://archeagecodex.com/items/icon_item_2720.png', grade: 1, name: 'Детеныш Гартарейн' },
        { id: 37018, type: 'lightArmor', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth560.png', grade: 3, name: 'Вязаная шапочка' },
        { id: 49630, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_4862.png', grade: 5, name: 'Статуэтка «Аранзеб»' },
        { id: 31787, type: 'lightArmor', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth550.png', grade: 3, name: 'Ободок со снеговичками' },
        { id: 28242, type: 'craftItem', icon: 'https://archeagecodex.com/items/icon_item_1243.png', grade: 1, name: 'Мыло' },
        { id: 43298, type: 'craftItem', icon: 'https://archeagecodex.com/items/icon_item_3952.png', grade: 1, name: 'Теневой делец' },
        { id: 8002004, type: 'mount', icon: 'https://archeagecodex.com/items/icon_item_2774.png', grade: 1, name: 'Призрачный конь (30 д.)' },
        { id: 8000315, type: 'lightArmor', icon: 'https://archeagecodex.com/items/costume_cp/nu_f_cp_leather002.png', grade: 1, name: 'Накидка из грифоньих перьев' },
        { id: 8000127, type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_f_sk_party001.png', grade: 2, name: 'Бальный наряд Двух Корон' },
        { id: 55495, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 9, name: 'Кольцо ифнирского героя эпохи сказаний' },

        { id: 33156, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth554.png', name: 'Вишневая шляпа-торт' },

        { id: 45373, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_4353.png', grade: 2, name: 'Фонтан «Лесная гармония»' },
        { id: 8000346, icon: 'https://archeagecodex.com/items/icon_item_1360.png', grade: 2, name: 'Белая субмарина (30 д.)' },
        { id: 8000309, type: 'mount', icon: 'https://archeagecodex.com/items/icon_item_1502.png', grade: 3, name: 'Цирковой медведь (на 30 дней)' },
        { id: 31878, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_1670.png', grade: 2, name: 'Неверинский патефон' },
        { id: 8002069, icon: 'https://archeagecodex.com/items/icon_item_moonstone05.png', grade: 1, name: 'Дар жрицы Нуи' },
        { id: 39551, type: 'furniture', icon: 'https://archeagecodex.com/items/icon_item_2847.png', grade: 2, name: 'Песчаная скульптура Победы' },
        { id: 8000310, icon: 'https://archeagecodex.com/items/icon_item_2979.png', grade: 1, name: 'Жетон на покупку оружия' },
        { id: 8000311, icon: 'https://archeagecodex.com/items/icon_item_2980.png', grade: 1, name: 'Жетон на покупку доспехов' },
        { id: 8000441, icon: 'https://archeagecodex.com/items/icon_item_2993.png', grade: 1, name: 'Иферийская монетка' },
        { id: 8000442, icon: 'https://archeagecodex.com/items/icon_item_2982.png', grade: 1, name: 'Заколдованная монетка' },

        { id: 45880, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png', name: 'Диадема эрнардского мнемоника', isPersonal: true },
        { id: 45881, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png', name: 'Матерчатый камзол эрнардского мнемоника', isPersonal: true },
        { id: 45882, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png', name: 'Матерчатые поножи эрнардского мнемоника', isPersonal: true },
        { id: 45883, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png', name: 'Матерчатые перчатки эрнардского мнемоника', isPersonal: true },
        { id: 45884, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png', name: 'Матерчатые сапоги эрнардского мнемоника', isPersonal: true },
        { id: 45885, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_cloth_0020.png', name: 'Матерчатые наручи эрнардского мнемоника', isPersonal: true },
        { id: 45886, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_cloth_0021.png', name: 'Матерчатый пояс эрнардского мнемоника', isPersonal: true },

        { id: 45991, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png', name: 'Диадема смотрителя тайных архивов', isPersonal: true },
        { id: 45990, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png', name: 'Матерчатый камзол смотрителя тайных архивов', isPersonal: true },
        { id: 45989, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png', name: 'Матерчатые поножи смотрителя тайных архивов', isPersonal: true },
        { id: 45988, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png', name: 'Матерчатые перчатки смотрителя тайных архивов', isPersonal: true },
        { id: 45987, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png', name: 'Матерчатые сапоги смотрителя тайных архивов', isPersonal: true },
        { id: 45986, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_cloth_0020.png', name: 'Матерчатые наручи смотрителя тайных архивов', isPersonal: true },
        { id: 45985, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_cloth_0021.png', name: 'Матерчатый пояс смотрителя тайных архивов', isPersonal: true },

        { id: 45887, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png', name: 'Фибула заклинателя гримуаров', isPersonal: true },
        { id: 45888, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png', name: 'Кожаная куртка заклинателя гримуаров', isPersonal: true },
        { id: 45889, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png', name: 'Кожаные поножи заклинателя гримуаров', isPersonal: true },
        { id: 45890, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png', name: 'Кожаные перчатки заклинателя гримуаров', isPersonal: true },
        { id: 47047, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png', name: 'Кожаные сапоги заклинателя гримуаров', isPersonal: true },
        { id: 47048, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_leather_0020.png', name: 'Кожаные наручи заклинателя гримуаров', isPersonal: true },
        { id: 47049, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_leather_0021.png', name: 'Кожаный пояс заклинателя гримуаров', isPersonal: true },

        { id: 47043, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png', name: 'Фибула укротителя гримуаров', isPersonal: true },
        { id: 47044, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png', name: 'Кожаная куртка укротителя гримуаров', isPersonal: true },
        { id: 47045, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png', name: 'Кожаные поножи укротителя гримуаров', isPersonal: true },
        { id: 47046, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png', name: 'Кожаные перчатки укротителя гримуаров', isPersonal: true },
        { id: 45891, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png', name: 'Кожаные сапоги укротителя гримуаров', isPersonal: true },
        { id: 45892, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_leather_0020.png', name: 'Кожаные наручи укротителя гримуаров', isPersonal: true },
        { id: 45893, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_leather_0021.png', name: 'Кожаный пояс укротителя гримуаров', isPersonal: true },

        { id: 45894, type: 'equipment', equipmentSubType: 'helmet', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_metal295.png', name: 'Латный шлем эрнардского архивариуса', isPersonal: true },
        { id: 45895, type: 'equipment', equipmentSubType: 'armor', icon: 'https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_metal295.png', name: 'Латный нагрудник эрнардского архивариуса', isPersonal: true },
        { id: 45896, type: 'equipment', equipmentSubType: 'pants', icon: 'https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_metal295.png', name: 'Латные поножи эрнардского архивариуса', isPersonal: true },
        { id: 45897, type: 'equipment', equipmentSubType: 'gloves', icon: 'https://archeagecodex.com/items/costume_gv/nu_m_gv_metal295.png', name: 'Латные перчатки эрнардского архивариуса', isPersonal: true },
        { id: 45898, type: 'equipment', equipmentSubType: 'boots', icon: 'https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_metal295.png', name: 'Латные сапоги эрнардского архивариуса', isPersonal: true },
        { id: 45899, type: 'equipment', equipmentSubType: 'bracer', icon: 'https://archeagecodex.com/items/icon_item_arm_metal_0020.png', name: 'Латные наручи эрнардского архивариуса', isPersonal: true },
        { id: 45900, type: 'equipment', equipmentSubType: 'belt', icon: 'https://archeagecodex.com/items/icon_item_belt_metal_0021.png', name: 'Латный пояс эрнардского архивариуса', isPersonal: true },

        { id: 53522, type: 'other', icon: 'https://archeagecodex.com/items/quest/icon_item_quest169.png', grade: 2, name: 'Большой сундук Кириоса', description: 'Сундук с медными драконами.\nВнутри:\n\n- 60-100 медных драконов.', isPersonal: true },
        { id: 55367, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_1482.png', grade: 9, name: 'Ларец со свитками пробуждения 3 ранга' },
        { id: 8000926, type: 'other', icon: 'https://archeagecodex.com/items/icon_item_3368.png', grade: 1, name: '[1 день] Покровительство Сиоль' },
        { id: 51922, type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4413.png', grade: 2, name: 'Корзинка с жетоном' },
        { id: 33382, type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_0843.png', grade: 1, name: 'Бутыль с имбирным напитком' },
        { id: 8003057, type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_6009.png', grade: 2, name: 'Мимолетное благословение предела' },

        { id: 56010, name: 'Бенедикт', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OTdFODYzN0UzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OTdFODYzN0YzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5N0U4NjM3QzNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5N0U4NjM3RDNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PjAKMw0AABTfSURBVHjaNFlpjBzHdX7d1XfPPTszO7Mnd8ldXhJJUeJK1mVJlm34iJ04dpxECIIgMWLYjg3byJ8gQQzEgRMYQWDHBvwrAezAiYPEcKIocnT5EGVJFEmRIiVyuUvufczdM9N3VVde9Sozy93Z2emqV+9973vf15SeerJeyivFvFwuQDEn5W1im1xXgRDgHOJYCkLwfWnogetKrpf4PkSRFIVSzHjC8DMSBw4AEojPE5ANWSkRvaKYZWJokhIltEujrXDUCsM+Df2EJQlQyhnnlHGWcMqBUU4T8RUnXGGJHDPcmIchhKEU4JIgJTSRiYQbUIrbQxhzGkt4WZJIwMXWsswVLjGMAwPikoTvAU9AkjlIEg+BOTyMWaKAHCXJiFEPGJMSWZZUTqicgAKAF6fnwMtAFtcSAHypYJhpNFIQgIeb4JVMDlSJyLiyRBOMNU1JBBgTHgejlBIJg8anLMIT8aVry4p4JZ6xRIcJ+BLD+GLOgyQJAI/IZS4pGHwiDiBWZzyNIeEEr8WFMTCuJBTiCAKFu4r4GB4kjLiuSLLYU2zPqJTGhHGLY0qJuFDGg2G+4pjhaTgeXSEqkWSViHOIw+Mx5TR5eAQqccyspOCHZCkBTBAuImPlMF78OMUfuChT8CyypMQUkwtKCEp6VMa4HskaAYIB4QM/m+CbaVhMLCzqGHgsZopmZcrlTLYgS3IYeGHgRn4Q+V4UekQzVMOmkpIkaZFxJdwJd8Oo8HKEGqKHYd0x1ZguhrlKBAQTkULcBo8eyCKCBHenMsUKEklBMAmAYASYSFxY/Bb7URj4ucpUY2YuVypZ2ZKWLSiKljAaRyENXG84GnY6nZ2N3fVlzKGeK8qymnBRZMyWjNnhMsGYFDwk7sYgwpzLIMomaoaAV1LMA5UhFOUX6MJ8qJghCRTyLloFXhAN3lCW9akT904cOWbny9gVcRy6XgAa1QjRTFvL5bLjauOYgsH1ttZXrry+ffOaYth6roypZUAUWWYHkaX9hbiSEGNSLLAs8IpYSsj8eBZT+W59cOsEI5UTJtCDsXIsk+htEg4HZm5s/t6Ha4cWsOH7w2EYMgQVIbhTEkYxjUI/jIf+MECSINLYzKHp42ezlfqwtT/qtPRMlmi6jBAjGLwqKRibwHfaE4gEZIHk4EnmMCBEQdoy+DdMBk+bBnMLBy0NMkZjFSrz9z1mFvLuwPH8CAvMVUi7WFRXVCQIcQWmyAR0WSah08Eeqi+emDp6GoHV2ryjm7aqWwTTRDSZICGIXQWNcdH4AhQc05YGRERLQZojEC8Q+zxtaEmAMXI9M1uav+9hyTB6Tg+vyeeKmYxtmAZmHAFJFFVVlEQ3JU2rGVpGYaJ9ZVUFZjDPGqvN3rOk60Z7fUW8aWbSPIk2FvuIQLAUiCjkPmQcpK6UY0ULpvlgKccg9EmapNjzdd2cu+dhZqjOwNGw/1RyfWUliGljZmq8WjGIauhGgswbeBktenFD3uiNiuCNSSHYtT2qHIUb8ydPzS49TiX9zhvnEaSSZghISESgiGK2GAYoC+JDDpAOyExKkfvut4NH+h5jEa2cOiOVbHfgYr8ouhrSZOgNaRRfPv9avVH/4HuXnO7erXduZMvVHyXTP1zDJNfAwk53YU+DKDv+9st3f/9H8+eWlh5+7ND9j62+9gtV1UBRCGcYgagbEXUQtJfChsxVM5hCBTsS/0QEk+KHxHccHYFfaExUj94VUirQqGm5jJm3lB+sGz/ujT00rpQb9Wd3tVdut9vUfFE+9KxXg3xGzlvcNiHbAJ/B5vqourj/5hubr72x39qZWjw+Xm/0dzYlgkzERYmQWGNGGcUH/ohxo8ON/EEE+CWyhrlLX+BsRVSXjp008wUpYhQgitni9Pi/XOo987/b4EivB/IL6/7Vl/eXA/ta+ciWMWZZcsOUKrpUIaRuGk0agzuA6clo8fTh9ttua3N9Y6u2eGyiXG5v3pGJehAHjcVTfEujIqcWplLuw8GIE16UUU4D4jS0SpXCofkojATYgmEpo76yR77zT2+CjEzahPUWdAMwKPieGEm10rRtUMw7F2MUSaMTeGAY4DhQmdSL+drmZVC0tbW1xdNn8xmzub2JbZWGgZwhIqI0wRDJEw8tgchdhBmU/x9a+B1nqdGYyo03cpqq5yv/+mb36Wu9p59fB2QfmYpJWq/A1CTkSqBz2G/DcNjLZ/OGgSutReAgKUch3Fq/L6PfM559PciV3P2xqIMQ3Pfc6akZZ/sOcqOIAylMxHVQOCbPHT1ZqtY13RQEdUBBKZqxF9RC0fdGRw81LrbIy/+2fPv8jiD7rA6VcbjvHsgWYXUDrt+Am5vAY1hZgZsrmJktq3q0WLCJDp4BcfClpcIP31//3IOLl8fPRMDMnFXWyc61N1KxFWF6GBOZwc4XvIi1qtWnM7mCgsgX3c9TGsL1I9nKZgrl8ULh/PWt7/3Hq5ABKIBIhmmgkIPdDrDgS5++/1t/+vFPfPQc9Prgj2B3d73Nf2fwxn8b335j7tmHqw4cuftb3/32E5/47fv2Lp4+98BFtW4q/Mh0I+w1kdxFQDH+EJAQqGBpQPzdx7vdju+lokNSsoXyWA0J9e9/eh12+5AlOAgFVrCau23otL750eOf/fVH7prPL5W7Z2YtkPFIJqxffPLS11rPvXh49NwvHnnzcHHw9oC9vtr966/9+UMkavOJnEGc5g7KyDgOaBweYAd7TWRIpAiU7a01p9+JolBQuJihAlESwmZyZvfOyoWXntvvzUB9CvotwDGNc9AykPUfmbQnS9m//Oa3X3zp5f1m58ThMhx5LwyND/qXZhW4OQR2aeM98U+/ONp6+gOPh2z13rNnw2EPJk/ldSe4fTnWxgTFYa2oyAtGhDx9UDVl9e2rTrcZBb5QxGJioPShVr4Mqn7n4vkgiKBYxQEBqUgU+o6YYFsZud/rjTrNDYwG83rXnHWdZGHH+90zy7MUfvor+P5FqAZ7D4/tVX7j9OiTX9Q18s11Bx58yB1o6kvfoJDBkYDIOShUIkZriiDGld3NtYSh9GCqfFAySGJqFYsQ+7al5uoTsIvRcEDdj7qEEtjcBdCe6YYny7fuPnbMpL1s2Gf1c3CJ/cHki+9N2l95Wv5ROzkAAN2Aj01lvld94usXL0DBnLOT89XH7r35qrX+S5qZZCJBPEm/BE+KU0vKaDRQ8YcqyIilHgI5SjdMS1d8XVOtjFB4GZS8KozakAOYn4Uji7DZ+dtrqx+asjNzj6547FV3avEDY+93fvbMy7Dd5r9P9EfmJhvFyoX1S9Vq5hunCm/mjl1w5cuj6M0Y4MiHljYv8sjFThYTnr0LYiJ0sKrgr2KM8IPpKiXCOpAQqxpECSGhmgNcAuFM+bFjpYWZ6k9yE1CpT0zObG/UntlqQtmGKeuJMf2rDxwfdr7Z3v6tL1f4/fVMY3IeErsxZS1TKg3cpRyZ0qDIld7uflRoZBYebr/1LLdrqQ5KrQMqSVUz7CyZrmTld4WGUEWIE6IowdBBVZzJ5a/uDLcHOCPZxGzhC48stEbsrStbMPCGOj/SqHQnGwsTlaem85+ayuQTatTn1PJd71x6pkf9Hlm9uXujnQ/0pc+jHoyoXzaUxYIadNo3e6P3TeTay5eiROh9xJDod5BVrEuuqBx0uVCuspBBmCqcxIE76q68Uzs8SVGfiBjDxyYM3S4M/Q6M+rDNIRzeqnUKU4279ey5fGHcUvsRhfb67L2Pru/+xc9+8PXDXSwIxI2PHE6MOvVc1OI0yRjKUlnWIsmyS8TIxq4nEZ0JaZpqVTHXZTIxlklNgRDRqV8SCFY0TRruh43T1/Mne8s7YEd3FxQzP5bRUW0PN5wh9EPo9iY4++RC5Wg1NxTySniGwO23RrSpN/bN2Z3yPZmps3biuoHnjfxw5HbaXQukcwszqOSvvPazIPAkWWNCW2PhUoEhK0L+C/yIoYBGRXg5RJXl9/aqZ/+5+jG4cgGkWMhsRRu6oZ2x37Mwx5P189jDknp/jhYh7HluDBL1ggDNKostKTw0M9X3xy1TL2c03w99nFZIyq6P+9Zq1WmsjaaiNY7Rhio8le+C/AKRREehRJeFs0MLFyexwlS0Q2gL2fO1U9DcgeXroKhZg+Ss3MhzB747li08eHyhXmkVTXNhotp03Baq+pTUVEXDhk0kpVzK52KK8EBcCqeAAaFlS6dnSCMPIxTeR/VdT9bs1P2AaPswDsKhMiLY4OSCNj2VdE72LoeqjtLY4wSwg2hPDIocOWnL/TCwFBL7QYcluWz2zMwUyMTlBAsS9QKCTkLTLBNkQ8dJKOYTWl0OqoImgPCUYxAe+HF0mL7niYxbdhCyZDC0cjnhJ9GNoRMWSlCW1yMtLk31xudo45is2qaz6ZjjG6wGowBseSGL60QJizKGqSmYauEEojgJ0JXhxIl8dBxE0VDWYUwYDRUHRTsZgCARHAtxarDQxFEEqkqUjK2P/IjK5A8/90ebG5vL7yybdoaK4ZHiZraUadZOQ30eDh9ZNcqroXuWfvxix4XuENbeMiQ6iMiAhjlVuHrVMNGl4aU+D8RNCc5N25YSgqJGQ+PBWBgESiILxSCUMmr4SBLOkItpTgXdBDEg2LieX+vEyIMf/vRTr/z8Ag6Q7c0mGohypUb+8R/+7PEPPvmTfhYM9cvjw3P1/I/DEmQs8Bxo71DgowjcJJnOqONjY+hAgijEpVHC4bZE9AWa0URFhkX3cPAQHYMFkuHA4+CxcYJyRjlCnpmmmc9k8Ejfve23blz5yAP3bew2r129/sSHfy2XL22srcrl6amTpPv8o9nvTHSLN/7z8xPDP84HcH0ZDwI9GVxxIwMtC2IdtQAVLknWDSyejoWIAKU2E7c0WOL7vut7uHXMGcoCTdhfMdEQxUHghyG1dNMyDFwrjGjO4J99/PR/TT26GqjHFmdbbvLZr/7N733mT/b6gex0HIR+kTdr8e7Vd3aeP//KV84ZR6wQLl564gPH4dgibHsQIgJQwAQxj2zLwmhw3mHtkD/wPRmJ2It39tsYEfY3VhZDd6PIj+KRH4wcvzdwCYQ5HQ/XQ4+hKKoX9k85rz5VUZZLR4tj2Yyq7m/vs8hDs62MnKFerW45g07AC/n85Zu3z9zb/s5v3vWLSe++Q9pfzT/0lGWv/vsL1zR5ujJSYytIfCnle8xU3gDdYNMTuWKp0O97rabTHfpoUHAUTk6MVQq60xs6Q+y4Ecijra0Wetxao6YRLwqHr7x9++SUlPRn8ofuPnH3iThu7Te3fLTSR+cbV6+/vddqjQbDoetiTNlcUeb+4XrxuRdeTbz+333hk9187vwLrxZVli8UEUI45sbHC9WqUcgm6BwdZzeJvBNHpo+fnJuojdm6MTNbNSWHeZ0gcBTCpuul3Z19ZxQ+dO7s/OE6C1wWR6plZTXu7yznswVO6eHjE7du3vz5L18nh2bH3DBwHQzH1xRN9HIcjTfG17f2V9fWIokbEvvUk/fMzkzcWF6vVUszk8WxAjEMT6J96ruh5yK9DEYB9o6qEnfQzhVUTaGXL15s9/rt7hAPvt9s4Zw6cfTI9GTd1M293d3dvc2JWjWIYsLD1v4eVvbc0tn/eea56++sKlbGwpGrII0C2nlUcezO2m0cL6OBb+lG1jIvXb9xe2Nn6eyZ8c98pN9qJZHfHzhOz5OYpCuqnE7ErKXkMtqVy1fbzfZYtRSGvmnZ+WymO/RYlo0GTqVgVAsWjvXhYNgbdnFudlt7XsTy+fJ4XjeszM7GJnISrkWWTi2gbkWDRwQWIxxrBKS9dgcVeNa0EMpI+FFEO519FTx8hbyPoKAoorCL0DRg2xFm4r8oHkMxZpv453KlkS9XEAB2xtQsQ05ZQFXNbMbsd/Y63S5ulQShuBVFw1qlfGRx3mntv/DShWZ3gHM3kDg6P+EMxR0SnGoM9SrSCkkVb8CxxZRQjoNhB38X9zpQ7NogBZQjJ4G4Rai4HEauly+U8oV8a3dNpYMRBk092zZURmwibhqog3gnbrtI4GGkYIgJchnXgQ17HU3jTqe533LEbayYxYq4RyqEfBIiyVHQcfyglMTokGdj2usRzeyhJZUV7C5sWjFDFXG7QuZCROmyinNgNOpe/fnTWtBxnb18QZ2rFjaGbBQIqeOFoW1k97lLs3OV+ftV5EhGQ46n0sQdjYETatKNlfVW38lYpqKGSSTFOkbLlDgKMIeJZKV31FCCo25LZMNErYLzP4rEECV0lMSBhJfqZr5YZEG8fXOZDtbAbcsh5LKSmqlrhZqsK2YSOWbJT5DUqS+kF9FVI/I6SGZCXuA8QekjZ9FfZCR4Z2UH/ZnjMwVNKsEhKP6jACkOtZnMI19BqS3rLsXJkSgqEbfbma+wdHzRUAHIqCbOiM0b1/bWbrW3aE6HiRm5MDnJsxOSlbtNo7UerWp6Vgo001bMiozzRMUqJOGoj6JMwgpiqtHjBP1aY5IG8bjUf+Jo7oGjFaxCqMoYVSL+l0DCvRFAhGH3j9oZU0IM+Lw48iJVjSWiyHGsqHrM4c76+vrKHadJi1k4NJ8t1CftYhnNSxgjdY64F3GFuIodu11N9yxQcOKboCa4M2okPCx35eGwF/a6rc6wOb+62++t337fXdVlBDUPXcePsjjwYhgOHMM0B3HY3FrLm7w0WU7Q0CY7JimNPAX1GyonULzba9tvrnqNLNxzjNSrufnZQzhju73uII6rhrpyZ7tSzi/MzNy+fU0CZX0rvNi/eWZh7FbXnaw36uNVNH6x1+x0m5RkavX5t966cXN1WGvIkmGrGiNPzlNOceR0qjnj9MnDe/s7V95awy6wsjbH9KkWATlnxM32/sZGjzAUh92JHDs1n6uWCQoxx0FK7EZua9Tfl2lsCDPnH1uY5l7v2pWN66vD5XXPi2hWHuDk7/S7JGjqENq2juLDwEGRRIVq+cEHFhZn6rhUw2Zk2oycQdTvx1rSn5+yTy1MzzeKURI4I7/ZDZp9pEF/MAhqlfzsoVoQJK1etDvgt3ajyyvRnsPHy2o2Z++03V9d5VSmqm3dWR9duNbc3O62R+TtDkoXfmKKFHNKRrOmy1lThb7rA9H90NvY3N5pjQK/o/MIZWW7s/Psy63/E2AAOTY7Y/TCa8QAAAAASUVORK5CYII=' },

        { id: 1, type: '', icon: '', grade: 1, name: '' },
    ].map(i => [i.id, i]));

    /**
     * @typedef {Object} Slot
     * @property {ItemBase} item - Предмет.
     * @property {number} [count] - Количество предмета.
     */

    /**
     * @typedef {Object} EventSchedule
     * @property {string} timeStart - Время начала события (HH:MM).
     * @property {string} [timeEnd] - Время окончания события (HH:MM). Если указано — событие длится диапазон.
     * @property {number[]} [weekdays] - Дни недели (1–7), если не каждый день.
     * @property {number} [duration] - Примерная длительность события (в минутах).
     */

    /**
     * @typedef {Object} Quest
     * @property {number} id - ID квеста.
     * @property {string} title - Название квеста.
     * @property {number[]} marathonId - Известные ID заданий в марафоне для точного сопоставления.
     * @property {string} short - Краткое описание / пояснение.
     * @property {'blue_salt'|'north'} [veksel] - Тип векселя.
     * @property {string[]} [locations] - Локации выполнения.
     * @property {number[]} [availableWeekdays] - Дни недели, в которые квест можно взять (0 - понедельник, 6 - воскресенье).
     * @property {Slot} [slot] - Предмет с количеством.
     * @property {EventSchedule[]} [schedule] - Расписание событий.
     */

    /** @type {Quest[]} */
    const QUESTS = [
        { marathonId: [8246], id: 10559, title: "Чужие коконы", short: "Ифнир (Каменные крылья) - 10 коконов" },
        { marathonId: [8248, 8804], id: 9142, title: "Плотницкая нужда", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8337], count: 60 } },
        { marathonId: [8250, 8806], id: 9318, title: "Дети Ольха", short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
        { marathonId: [8252, 8808], id: 10512, title: "Котомки эфенского странника I", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43176], count: 20 } },
        { marathonId: [8254, 8810], id: 10513, title: "Котомки эфенского странника II", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43176], count: 60 } },
        { marathonId: [8256, 8812], id: 9100, title: "Старый враг", short: "Библа, 2-ой босс" },
        { marathonId: [8258, 8814], id: 7658, title: "Требуется экзорцист (героич.)", short: "" },
        { marathonId: [8260, 8816], id: 6797, title: "Опасность для моряков", short: "15 жуков/медуз в море (не забыть сдать)" },
        { marathonId: [8262, 8818], id: 8998, title: "Бесконечный бой", short: "" },
        { marathonId: [8268, 8824], id: 5972, title: "И на дару бывает прору...", short: "Чешуя Ашьяры, Кольцо Лореи, Кольцо Гленна" },
        { marathonId: [8274, 8830], id: 10480, title: "Состязание союзов в Академии", short: "" },
        { marathonId: [8282, 8838], id: 7154, title: "Темница Дауты", short: "" },
        { marathonId: [8284, 8840], id: 9137, title: "Железо для корабелов", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8318], count: 60 } },
        { marathonId: [8286, 8842], id: 8000131, title: "Вдали от обезумевшего мира", short: "Квест Нуи на 500 очков работы" },
        { marathonId: [8288, 8844], id: 10508, title: "Расшитые жемчугом кошельки I", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[40928], count: 25 } },
        { marathonId: [8290, 8846], id: 10509, title: "Расшитые жемчугом кошельки II", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[40928], count: 75 } },
        { marathonId: [8292, 8848], id: 5092, title: "Отличные фитили", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#porychenie" target="_blank">Парфюмер на востоке</a>` },
        { marathonId: [8294, 8850], id: 7659, title: "Требуются работники (героич.)", short: "" },
        { marathonId: [8296, 8852], id: 7817, title: "Опасности окольных дорог", short: "" },
        { marathonId: [8298, 8854], id: 8000058, title: "Лицензия на убийство: Баррага Безумный", short: "Нагашар (только обычка)", slot: { item: ITEMS[8000749] } },
        { marathonId: [8300, 8856], id: 5971, title: "Чешуя Ашьяры", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
        { marathonId: [8314, 8870], id: 10564, title: "Освобожденные узницы Нагашара", short: "Ифнир - змея", schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }] },
        { marathonId: [8316, 8872], id: 8000061, title: "Лицензия на убийство: Иштар", short: "Сады наслаждений (только хард)", slot: { item: ITEMS[8000752] } },
        { marathonId: [8318, 8874], id: 9317, title: "Охота на крупную дичь", short: 'Квест на Космача (портал "Зимний Очаг")' },
        { marathonId: [8320, 8876], id: 9152, title: "Книжные обложки", short: "", veksel: 'blue_salt', slot: { item: ITEMS[16327], count: 60 } },
        { marathonId: [8322, 8878], id: 8435, title: "Чистота и порядок", short: 'Портал "Лягушачьи пруды"' },
        { marathonId: [8324, 8880], id: 10510, title: "Фермерские сундучки со всякой всячиной I", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[42077], count: 8 } },
        { marathonId: [8326, 8882], id: 10511, title: "Фермерские сундучки со всякой всячиной II", short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[42077], count: 25 } },
        { marathonId: [8328, 8884], id: 7657, title: "Разыскивается: О'Карф (героич.)", short: "" },
        { marathonId: [8330, 8886], id: 7813, title: "Преграда на пути", short: "" },
        { marathonId: [8336, 8892], id: 5144, title: "Разгром призрачного легиона", short: "Призрачный (ночной) разлом", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
        { marathonId: [8338, 8894], id: 5885, title: "Советник Кириоса", short: "Анталлон на Солнечных полях", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
        { marathonId: [8340, 8896], id: 8000060, title: "Лицензия на убийство: иферийцы (низк., обычн.)", short: "Сады наслаждений (изи или нормал)", slot: { item: ITEMS[8000751] } },
        { marathonId: [8346, 8902], id: 10056, title: "Садовые работы**", short: "Квест можно взять в любое время, боссы:", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }] },
        { marathonId: [8348, 8904], id: 11154, title: "Бой с тенью", short: "Лиловый (армия фантомов)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }] },
        { marathonId: [8350, 8906], id: 11227, title: "Билет в один конец", short: 'Превратиться в <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="Перевоплощение в дару" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>дару, получить и использовать <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="Разрешение на работу: билет в один конец" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, потратить 500 ОР (идти в данж не надо)' },
        { marathonId: [8352, 8908], id: 9147, title: "С миру по нитке", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8256], count: 60 } },
        { marathonId: [8354, 8910], id: 8000136, title: "В гармонии с собой", short: "Квест Нуи на 2500 ремесленки" },
        { marathonId: [8356, 8912], id: 10506, title: "Резные сундучки со всякой всячиной I", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[42076], count: 10 } },
        { marathonId: [8358, 8914], id: 10507, title: "Резные сундучки со всякой всячиной II", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[42076], count: 30 } },
        { marathonId: [8360, 8916], id: 5091, title: "Взрывоопасное поручение", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#porychenie" target="_blank">Парфюмер на западе</a>` },
        { marathonId: [8362, 8918], id: 9101, title: "Неприступная башня", short: "Библа, 3-ий босс" },
        { marathonId: [8364, 8920], id: 7656, title: "Разыскивается: Акмит (героич.)", short: "" },
        { marathonId: [8366, 8922], id: 9320, title: "Война во имя славы союза", short: "" },
        { marathonId: [8372, 8928], id: 9297, title: "Орды Земель покоя", short: "", availableWeekdays: [6] },
        { marathonId: [8380, 8936], id: 7815, title: "Три новости, и все плохие", short: "Изи/нормал Сады наслаждений" },
        { marathonId: [8382, 8938], id: 10735, title: "Предводитель демонов", short: "Эншака на Солнечных полях", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
        { marathonId: [8388, 8944], id: 9153, title: "Ремесленная одежда", short: "", veksel: 'blue_salt', slot: { item: ITEMS[16327], count: 100 } },
        { marathonId: [8390, 8946], id: 5062, title: "Бей мандрагору!", short: "" },
        { marathonId: [8392, 8948], id: 10514, title: "Эфенские сундучки со всякой всячиной I", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43177], count: 7 } },
        { marathonId: [8394, 8950], id: 10515, title: "Эфенские сундучки со всякой всячиной II", short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43177], count: 20 } },
        { marathonId: [8396, 8952], id: 7155, title: "Откровение Бездны", short: "Нагашар обычка" },
        { marathonId: [8398, 8954], id: 9398, title: "Состязание союзов", short: "100 мобов на Пустоши Корвуса" },
        { marathonId: [8400, 8956], id: 7152, title: "Мемориальная доска (гер.)", short: "" },
        { marathonId: [8402, 8958], id: 9102, title: "Стокнижное чудище", short: "Библа, голем" },
        { marathonId: [8404], id: 9205, title: "Последний день Ирамканда", short: "", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }] },
        { marathonId: [8414, 8972], id: 10952, title: "Бой с «Летучим харнийцем»", short: "" },
        { marathonId: [8422, 8980], id: 10304, title: "Тайны святилища", short: "" },
        { marathonId: [8424, 8982], id: 9099, title: "Обитель архивариуса", short: "Библа, первый босс" },
        { marathonId: [8426, 8984], id: 9143, title: "Раз трактир, два трактир", short: "", veksel: 'blue_salt', slot: { item: ITEMS[8337], count: 100 } },
        { marathonId: [8434, 8992], id: 10504, title: "Полновесные мешочки с серебром I", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[35461], count: 30 } },
        { marathonId: [8436, 8994], id: 10505, title: "Полновесные мешочки с серебром II", short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS[35461], count: 90 } },
        { marathonId: [8438, 8996], id: 8000062, title: "Лицензия на убийство: повелитель подземелья (героич.)", short: "Аль-Харба / Ферма / Колыбель / Воющая Бездна / Копи / Арсенал", slot: { item: ITEMS[8000753] } },
        { marathonId: [8448, 9006], id: 2943, title: "Элитные войска Кровавой армии", short: "Кровавый (дневной) разлом - 3-я волна", schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }] },
        { marathonId: [8450, 9008], id: 7935, title: "Хранитель Звенящего ущелья**", short: "Гардум", schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }] },
        { marathonId: [8452, 9010], id: 7660, title: "Герой с крепким рассудком (героич.)", short: "" },
        { marathonId: [8470, 9028], id: 10739, title: "Призрачный предводитель", short: "Призрачный (ночной) разлом - Эншака", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
        { marathonId: [8478, 9030], id: 10423, title: "Голиаф, механический скарабей", short: "" },
        { marathonId: [8494, 9032], id: 8635, title: "Срочная доставка", short: "" },
        { marathonId: [8496, 9034], id: 9295, title: "Орды Сальфимара", short: "", availableWeekdays: [1, 4] },
        { marathonId: [8498, 9036], id: 9294, title: "Орды Нуимара", short: "", availableWeekdays: [0, 3] },
        { marathonId: [8500, 9050], id: 8637, title: "Старый друг – новый враг", short: "Бухта - Жакар" },
        { marathonId: [8502, 9040], id: 7327, title: "Взгляд слепца", short: "50 мобов (100 очков) на Сверкающем побережье" },
        { marathonId: [8504, 9042], id: 9296, title: "Орды Сангемара", short: "", availableWeekdays: [2, 5] },
        { marathonId: [8506, 9044], id: 5969, title: "Кольцо Лореи", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
        { marathonId: [8508, 9062], id: 8641, title: "Наступление кир'феров", short: "Эфен - жаба (через 5 минут после начала войны)" },
        { marathonId: [8510, 9048], id: 5077, title: "Аромат для важной особы", short: `Парфюмер (<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#aroma" target="_blank">запад</a>/<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#aroma" target="_blank">восток</a>)` },
        { marathonId: [8512, 9038], id: 8605, title: "Битва в Бухте китобоев", short: "" },
        { marathonId: [8514, 9052], id: 11096, title: "Турнир в честь Отца-Солнца", short: "Луг - Битва хранителей", schedule: [{ timeStart: "18:00", weekdays: [6, 0] }] },
        { marathonId: [8516, 9054], id: 8000129, title: "Во славу Орхидны", short: "" },
        { marathonId: [8518, 9056], id: 1415, title: "Сирота", short: "" },
        { marathonId: [8520, 9058], id: 5970, title: "Кольцо капитана Гленна", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
        { marathonId: [8522, 9060], id: 10188, title: "Образцы флоры Сада", short: "", slot: { item: ITEMS[49252], count: 20 } },
        { marathonId: [8524, 9046], id: 8618, title: "Битва за Эфен'Хал", short: "Эфен - мобы" },
        { marathonId: [9064], id: 8000311, title: "Охота на призраков", short: "Предпоследнее испытание для осколков предела" },
    ];

    /** @param {string} value */
    const normalizeQuestTitleForMatch = (value) => {
        const roman = (num) => {
            const map = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'];
            return map[num] || String(num);
        };

        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/(\D)(\d+)$/u, (_, prefix, num) => `${prefix} ${roman(Number(num))}`)
            .replace(/\*+/g, '')
            .replace(/героич/g, 'гер')
            .replace(/[«»"'`´’‘“”()[\]{}.,:;!?\-–—_/\\]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    /** @param {string} value */
    const getQuestTitleMatchWords = (value) => (
        normalizeQuestTitleForMatch(value)
            .split(' ')
            .filter(word => word.length >= 3 || /^[ivx]+$/.test(word))
    );

    /**
     * Оценивает похожесть заголовка марафон-квеста из API и локального заголовка QUESTS.
     * Сначала ценит точное/подстрочное совпадение, затем сумму совпавших значимых слов.
     * @param {string} apiTitle
     * @param {string} localTitle
     * @returns {number}
     */
    const getQuestTitleMatchScore = (apiTitle, localTitle) => {
        const apiNorm = normalizeQuestTitleForMatch(apiTitle);
        const localNorm = normalizeQuestTitleForMatch(localTitle);
        if (!apiNorm || !localNorm) return 0;
        if (apiNorm === localNorm) return 1000;
        if (apiNorm.includes(localNorm) || localNorm.includes(apiNorm)) {
            return Math.min(apiNorm.length, localNorm.length);
        }

        const apiWords = new Set(getQuestTitleMatchWords(apiTitle));
        const commonWords = getQuestTitleMatchWords(localTitle).filter(word => apiWords.has(word));
        return commonWords.join('').length + commonWords.length * 2;
    };

    /**
     * Находит локальные метаданные QUESTS для марафон-квеста из API.
     * Сначала ищет по текущему ID марафон-квеста, затем по похожести title.
     * @param {ApiQuest} marathonQuest
     * @returns {Quest|null}
     */
    const findQuestMetaForMarathonQuest = (marathonQuest) => {
        const marathonQuestId = Number(marathonQuest?.id || 0);
        if (marathonQuestId) {
            const byId = QUESTS.find(q => q.marathonId.includes(marathonQuestId));
            if (byId) return byId;
        }

        let bestQuest = null;
        let bestScore = 0;
        for (const quest of QUESTS) {
            const score = getQuestTitleMatchScore(marathonQuest?.title, quest.title);
            if (score > bestScore) {
                bestQuest = quest;
                bestScore = score;
            }
        }

        return bestScore >= 12 ? bestQuest : null;
    };

    /**
     * @typedef {Object} EventQuest
     * @property {number} id - ID квеста.
     * @property {string} title - Название квеста.
     */

    /**
     * @typedef {Object} EventEntry
     * @property {string} title - Название события.
     * @property {EventQuest[]} [quests] - Связанные квесты.
     * @property {string[]} [locations] - Локации проведения.
     * @property {EventSchedule[]} schedule - Расписание события.
     */

    /** @type {EventEntry[]} Расписание игровых событий (для страницы /a). */
    const EVENTS = [
        { code: "ifnir", title: "Оборона Ифнира", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }], locations: ["Ифнир"], quests: [{ id: 10569, title: "Оборона Ифнира" }, { id: 10564, title: "Освобожденные узницы Нагашара" }] },
        { code: "lug_guardians", title: "Луг - Битва хранителей", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "18:00", weekdays: [6, 7] }], locations: ["Великий луг"], quests: [{ id: 11132, title: "Битва хранителей" }, { id: 11096, title: "Турнир в честь Отца-Солнца" }] },
        { code: "storm_eye", title: "Око бури", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [2, 4, 6] }], locations: ["Архипелаг погибших кораблей"], quests: [{ id: 6791, title: "Битва на Оке бури" }] },
        { code: "storm_eye_sea", title: "Гроза над морем", schedule: [{ timeStart: "14:00", timeEnd: "15:00" }, { timeStart: "22:00", timeEnd: "23:00" }], locations: ["Архипелаг погибших кораблей"], quests: [{ id: 5765, title: "Гроза над морем" }] },
        { code: "carrion", title: "Падаль", defaultVisible: true, schedule: [{ timeStart: "10:00" }, { timeStart: "22:00" }] },
        { code: "siege", title: "Осада", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [3] }] },

        { code: "rift_blood_antallon", title: "Кровавый (дневной) разлом - Анталлон/Эншака", defaultVisible: true, schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }], locations: ["Солнечные поля"], quests: [{ id: 5885, title: "Советник Кириоса" }] },
        { code: "rift_blood_garron", title: "Кровавый (дневной) разлом - Гигантский гаррон", defaultVisible: true, schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }], locations: ["Инистра", "Полуостров Падающих Звезд"], quests: [{ id: 2943, title: "Элитные войска Кровавой армии" }] },
        { code: "rift_ghost", title: "Призрачный (ночной) разлом - Призрак Эншаки", defaultVisible: true, schedule: [{ timeStart: "02:20", duration: 15 }, { timeStart: "06:20", duration: 15 }, { timeStart: "10:20", duration: 15 }, { timeStart: "14:20", duration: 15 }, { timeStart: "18:20", duration: 15 }, { timeStart: "22:20", duration: 15 }], locations: ["Инистра", "Полуостров Падающих Звезд"], quests: [{ id: 5144, title: "Разгром призрачного легиона" }] },
        { code: "rift_phantom", title: "Фантомы (лиловый разлом)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }], locations: ["Сокрытая долина", "Ирамийский хребет"], quests: [{ id: 11154, title: "Бой с тенью" }] },

        /* Инстансы - Рейды */
        { code: "dragon_lair", title: "Логово дракона", defaultVisible: true, schedule: [{ timeStart: "13:20", timeEnd: "14:00" }, { timeStart: "18:20", timeEnd: "19:00" }, { timeStart: "21:20", timeEnd: "22:00" }], locations: ["Инстансы - Рейды"] },
        { code: "gardum", title: "Гардум (Ущелье кровавой росы)", defaultVisible: true, schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }], locations: ["Инстансы - Рейды"], quests: [{ id: 7935, title: "Хранитель Звенящего ущелья" }] },
        { code: "iramkand", title: "Последний день Ирамканда", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }], locations: ["Инстансы - Рейды"], quests: [{ id: 9205, title: "Последний день Ирамканда" }] },

        /* Инстансы - Фракции */
        { code: "daskshir", title: "Битва за Даскшир", defaultVisible: true, schedule: [{ timeStart: "16:00", timeEnd: "17:00", weekdays: [2, 4, 6] }, { timeStart: "22:30", timeEnd: "23:59", weekdays: [2, 4, 6] }, { timeStart: "19:00", timeEnd: "20:00", weekdays: [1, 3, 5, 7] }], locations: ["Инстансы - Фракции"] },
        { code: "gorge_battle", title: "Битва в Ущелье кровавой росы", schedule: [{ timeStart: "15:15", timeEnd: "16:00" }, { timeStart: "18:00", timeEnd: "19:00" }, { timeStart: "21:45", timeEnd: "22:30" }], locations: ["Инстансы - Фракции"] },
        { code: "enchanted_ponds", title: "Битва за Зачарованные пруды", defaultVisible: true, schedule: [{ timeStart: "14:30", timeEnd: "15:15" }, { timeStart: "17:00", timeEnd: "18:00" }, { timeStart: "21:00", timeEnd: "21:45" }], locations: ["Инстансы - Фракции"] },

        /* Мировые боссы */
        { code: "kraken", title: "Кракен", schedule: [{ timeStart: "19:30", weekdays: [1, 4, 6] }], locations: ["Безмятежное море"] },
        { code: "kalidis", title: "Калидис", schedule: [{ timeStart: "20:30", weekdays: [1, 5, 6] }], locations: ["Туманный пролив"] },
        { code: "leviathan", title: "Левиафан", schedule: [{ timeStart: "20:30", weekdays: [2, 4, 7] }], locations: ["Безмятежное море"] },
        { code: "dolphin", title: "Летучий дельфиец", schedule: [{ timeStart: "21:00", weekdays: [1, 3, 5, 7] }], locations: ["Золотое море"] },
        { code: "ashyara_glenn_loreya", title: "Ашьяра/Гленн/Лорея", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }], locations: ["Бездна", "Солнечные поля"], quests: [{ id: 5971, title: "Чешуя Ашьяры" }, { id: 5970, title: "Кольцо капитана Гленна" }, { id: 5969, title: "Кольцо Лореи" }] },
        { code: "xanatos", title: "Ксанатос", schedule: [{ timeStart: "19:30", weekdays: [2, 5, 7] }], locations: ["Кладбище драконов"] },

        { code: "gardens_bosses", title: "Эншака/Лернея/Таврос/М'гер", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }], locations: ["Сады матери"], quests: [{ id: 10056, title: "Садовые работы" }] },
        { code: "gardens_antallon", title: "Анталлон в садах", schedule: [{ timeStart: "21:30", weekdays: [1, 5, 7] }], locations: ["Сады матери"] },

        { code: "altars", title: "Битва за алтари", schedule: [{ timeStart: "16:00", timeEnd: "16:30", weekdays: [1, 3, 4, 5, 6] }, { timeStart: "20:00", timeEnd: "20:30", weekdays: [0, 2, 3, 4, 5] }], locations: ["Пепельные равнины"] },
        { code: "fesanix", title: "Фесаникс", schedule: [{ timeStart: "22:30", timeEnd: "23:30", weekdays: [2] }], locations: ["Пепельные равнины"] },
    ];

    // ==================== API-запросы ====================

    /** @param {string} url */
    const fetchJson = async (url) => {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const json = await res.json();
        const quests = json?.data?.quests;
        debugLog('api/info loaded', {
            state: json?.state,
            hasData: !!json?.data,
            questContainerType: quests == null ? String(quests) : Array.isArray(quests) ? 'array' : typeof quests,
            questCount: quests && typeof quests === 'object' ? Object.keys(quests).length : 0,
            weekNumber: json?.data?.week_number,
            nextWeekAt: json?.data?.next_week_at,
            serverNowIso: NOW_MS ? new Date(NOW_MS).toISOString() : null,
            sampleQuests: quests && typeof quests === 'object'
                ? Object.values(quests).slice(0, 5).map(summarizeQuestForDebug)
                : [],
        });
        return json;
    };

    /** @param {string} url */
    const fetchText = async (url) => {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text();
    };

    /** @returns {Promise<ApiInfoResponse>} */
    const fetchApiInfo = async () => {
        const t0 = Date.now();
        const res = await fetch(API_INFO_PATH, {
            credentials: 'include',
            cache: 'no-store',
        });
        const t1 = Date.now();
        if (!res.ok) throw new Error(`api/info failed: ${res.status}`);

        const dateHeader = res.headers.get('Date');
        const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
        if (Number.isFinite(parsed)) {
            // Date header фиксируется сервером при формировании ответа.
            // К моменту получения прошло примерно половина RTT.
            const halfRtt = (t1 - t0) / 2;
            NOW_MS = parsed + halfRtt;
        } else if (NOW_MS == null) {
            throw new Error('[ArcheAgeExtraUI] Cannot read server Date header');
        }

        return res.json();
    };

    /** @returns {Promise<ApiInfoResponse>} */
    const getApiInfoCached = async () => {
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

    // ==================== Автообновление API ====================

    const showRefreshLoader = () => {
        if (DOM.refreshLoader) {
            DOM.refreshLoader.classList.add('tm-refresh-loader--active');
        }
    };

    const hideRefreshLoader = () => {
        if (DOM.refreshLoader) {
            DOM.refreshLoader.classList.remove('tm-refresh-loader--active');
        }
    };

    let API_INFO_DATA_JSON = null; // JSON-строка data для сравнения

    /** Сбрасывает кэш, загружает свежие данные и перерисовывает UI, если данные изменились. */
    const refreshApiInfo = async () => {
        if (isRefreshing) return;
        isRefreshing = true;
        showRefreshLoader();

        try {
            // Сбрасываем кэш и промис для получения свежих данных
            const prevDataJson = API_INFO_DATA_JSON;
            API_INFO_CACHE = null;
            API_INFO_PROMISE = null;

            // Загружаем свежие данные (fetchApiInfo обновит NOW_MS из Date header)
            API_INFO_CACHE = await fetchApiInfo();

            // Обновляем смещение серверного времени
            if (NOW_MS !== null) {
                SERVER_TIME_OFFSET = NOW_MS - Date.now();
            }

            // Проверяем, не сменился ли день/сегмент (полночь МСК или граница четверга)
            // Переключаем автоматически, только если пользователь смотрел на «сегодня»
            const oldSelectedKey = slotKey(selectedDayUtcMs, selectedSegment);
            const newTodayUtc = getTodayUtcMsByTZ();
            const newTodaySegment = effectiveSegment(newTodayUtc, 'auto');
            const newTodayKey = slotKey(newTodayUtc, newTodaySegment);
            // «Смотрел на сегодня» = его слот совпадал с тем, что было «сегодня»
            // до обновления времени, или с новым «сегодня» (уже совпадает).
            // Безопаснее: переключаем, если выбранный слот отстаёт от нового «сегодня»
            // и при этом не является будущим днём, намеренно выбранным пользователем.
            const dayChanged = oldSelectedKey !== newTodayKey
                && oldSelectedKey < newTodayKey;

            if (dayChanged) {
                applySlot(newTodayUtc, 'auto');
            }

            // Сравниваем data — если не изменилось и день не сменился, пропускаем перерисовку
            const newDataJson = JSON.stringify(API_INFO_CACHE?.data);
            API_INFO_DATA_JSON = newDataJson;

            if (newDataJson === prevDataJson && !dayChanged) return;

            // Обновляем историю выполнений ДО рендера,
            // т.к. renderTasksForSelectedDay читает historyEntries
            updateQuestHistory();

            // Перерисовываем список задач (и обновляем лейбл/кнопки навигации при смене дня)
            if (dayChanged) {
                await onSelectedDateChanged();
            } else {
                await renderTasksForSelectedDay({ animateNewlyDone: true });
            }

            // Автозабор подарков (если включён и данные изменились)
            if (loadAutoClaimState()) {
                await claimAllLevelRewards();
            }
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] refreshApiInfo failed:', e);
        } finally {
            isRefreshing = false;
            hideRefreshLoader();
        }
    };

    const stopAutoRefresh = () => {
        if (autoRefreshIntervalId != null) {
            clearInterval(autoRefreshIntervalId);
            autoRefreshIntervalId = null;
        }
    };

    /** @param {number} intervalMs */
    const startAutoRefresh = (intervalMs) => {
        stopAutoRefresh();
        autoRefreshIntervalId = setInterval(refreshApiInfo, intervalMs);
    };

    const restartAutoRefresh = () => {
        const interval = document.hidden
            ? AUTO_REFRESH_INTERVAL_HIDDEN_MS
            : AUTO_REFRESH_INTERVAL_FOCUSED_MS;
        startAutoRefresh(interval);
    };

    const handleVisibilityChange = () => {
        if (document.hidden) {
            // Страница потеряла фокус - переключаемся на редкое обновление
            startAutoRefresh(AUTO_REFRESH_INTERVAL_HIDDEN_MS);
        } else {
            // Страница вернулась в фокус - сразу обновляем и запускаем частый интервал
            refreshApiInfo();
            startAutoRefresh(AUTO_REFRESH_INTERVAL_FOCUSED_MS);
        }
    };

    const getUidFromCheckUser = async () => {
        const json = await fetchJson('/dynamic/auth/?a=checkuser');
        const uid = json?.user?.uid;
        if (!uid) throw new Error('uid not found');
        return String(uid);
    };

    /**
     * @param {string} html
     * @returns {string[]}
     * */
    const parseServersFromCharListHtml = (html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return [...doc.querySelectorAll('li')]
            .map(li => {
                const spans = li.querySelectorAll('span');
                const last = spans?.[spans.length - 1];
                return last ? last.textContent.trim() : null;
            })
            .filter(Boolean);
    };

    /**
     * @param {string[]} servers
     * @returns {string|null}
     * */
    const pickMainServer = (servers) => {
        if (!servers.length) return null;

        const counts = new Map();
        const order = [];
        for (const s of servers) {
            if (!counts.has(s)) order.push(s);
            counts.set(s, (counts.get(s) || 0) + 1);
        }

        let best = null;
        let bestCount = -1;
        for (const s of order) {
            const c = counts.get(s);
            if (c > bestCount) { best = s; bestCount = c; }
        }
        return best;
    };

    const resolveVekselUrl = async () => {
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

            // Обновляем href всех уже отрендеренных ссылок на вексель
            updateRenderedVekselLinks();
            updateVekselServerAutoOptionText();
        } catch {
            vekselAutoDetectedServerId = '';
            vekselUrlResolved = VEKSEL_BASE;
            updateVekselServerAutoOptionText();
        }
    };

    // ==================== UI: создание карточек ====================

    /** @param {{ href: string, iconSrc: string, title: string, className?: string }} params */
    const makeIconLink = ({ href, iconSrc, title, className }) => {
        const a = document.createElement('a');
        a.className = `tm-icon-link ${className || ''}`.trim();
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = title;

        const img = document.createElement('img');
        img.src = iconSrc;
        img.alt = title;
        a.appendChild(img);
        return a;
    };

    /**
     * Создаёт иконку для ссылки на таблицу векселей (gisaa + маленькая иконка векселя).
     * @param {{ href: string, title?: string, vekselIcon: string }} params
     * */
    const makeVekselIconLink = ({ href, title, vekselIcon }) => {
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

    // ==================== Глобальный тултип ====================

    /** @type {HTMLElement|null} */
    let globalTooltip = null;

    /** Создаёт или возвращает глобальный контейнер тултипа. */
    const getTooltipContainer = () => {
        if (globalTooltip) return globalTooltip;

        globalTooltip = document.createElement('div');
        globalTooltip.className = 'tm-item-tooltip';
        document.body.appendChild(globalTooltip);
        return globalTooltip;
    };

    const resolveItemLevelValue = (levelValue, isMaxLevel = false) => {
        if (isMaxLevel && Number(levelValue) === 0) return MAX_LEVEL;
        return Number(levelValue);
    };

    const appendItemLevelValue = (container, levelValue, isMaxLevel = false) => {
        const level = resolveItemLevelValue(levelValue, isMaxLevel);
        if (Number.isFinite(level) && level > 55) {
            const icon = document.createElement('img');
            icon.className = 'tm-item-tooltip-hero-level-icon';
            icon.src = HERO_LEVEL_ICON;
            icon.alt = 'героический уровень';
            container.appendChild(icon);

            const value = document.createElement('span');
            value.className = 'inv-nc';
            value.textContent = String(level - 55);
            container.appendChild(value);
        } else {
            container.appendChild(document.createTextNode(String(levelValue)));
        }
    };

    const makeRequiredLevelLine = (reqLevel, maxLevel) => {
        const line = document.createElement('div');
        line.className = 'tm-item-tooltip-level';
        line.appendChild(document.createTextNode('Требуемый уровень: '));

        if (reqLevel != null) {
            appendItemLevelValue(line, reqLevel);
        }

        if (maxLevel != null) {
            line.appendChild(document.createTextNode('~'));
            appendItemLevelValue(line, maxLevel, true);
        }

        return line;
    };

    const formatSpeedStat = (value) => {
        const str = String(value).trim();
        if (!str.includes('.')) return `${str}.0`;

        const [whole, fraction = ''] = str.split('.');
        return `${whole}.${fraction || '0'}`;
    };

    const ITEM_UTILITY_STATS = [
        { field: 'speed', label: 'Сноровка', format: formatSpeedStat },
        { field: 'durability', label: 'Прочность', format: value => `${value}/${value}` },
    ];

    const ITEM_COMBAT_STATS = [
        { field: 'dps', label: 'Урон', colon: true },
        { field: 'armor', label: 'Защита', colon: true },
        { field: 'magicResistance', label: 'Сопротивление', colon: true },
        { field: 'mdps', label: 'Сила заклинаний' },
        { field: 'hdps', label: 'Эффективность исцеления' },
        { field: 'str', label: 'Сила' },
        { field: 'dex', label: 'Ловкость' },
        { field: 'sta', label: 'Выносливость' },
        { field: 'int', label: 'Интеллект' },
        { field: 'spi', label: 'Мудрость' },
    ];

    const isDisplayableItemStatValue = (value) => {
        if (value == null || value === '') return false;
        const num = Number(value);
        return !Number.isFinite(num) || num !== 0;
    };

    const getItemStatEntries = (item, stats) => (
        stats
            .map(stat => ({ ...stat, value: item[stat.field] }))
            .filter(stat => isDisplayableItemStatValue(stat.value))
    );

    const makeItemStatsSection = (entries) => {
        const section = document.createElement('div');
        section.className = 'tm-item-tooltip-stats';

        for (const entry of entries) {
            const row = document.createElement('div');
            row.className = 'tm-item-tooltip-stat-row';

            const label = document.createElement('span');
            label.className = 'tm-item-tooltip-stat-label';
            label.textContent = entry.colon ? `${entry.label}:` : entry.label;

            const value = document.createElement('span');
            value.className = 'tm-item-tooltip-stat-value';
            value.textContent = entry.format ? entry.format(entry.value) : String(entry.value);

            row.appendChild(label);
            row.appendChild(value);
            section.appendChild(row);
        }

        return section;
    };

    const appendPricePart = (container, amount, iconSrc, title) => {
        const part = document.createElement('span');
        part.className = 'tm-item-tooltip-price-part';

        const value = document.createElement('span');
        value.textContent = String(amount);
        part.appendChild(value);

        const icon = document.createElement('img');
        icon.className = 'tm-item-tooltip-price-icon';
        icon.src = iconSrc;
        icon.alt = title;
        icon.title = title;
        part.appendChild(icon);

        container.appendChild(part);
    };

    const makeItemPriceValue = (price) => {
        const value = document.createElement('span');
        value.className = 'tm-item-tooltip-price-value';

        const totalBronze = Math.max(0, Math.floor(Number(price) || 0));
        const gold = Math.floor(totalBronze / 10000);
        const silver = Math.floor((totalBronze % 10000) / 100);
        const bronze = totalBronze % 100;

        if (gold > 0) appendPricePart(value, gold, CURRENCY_ICONS.gold, 'золото');
        if (silver > 0) appendPricePart(value, silver, CURRENCY_ICONS.silver, 'серебро');
        if (bronze > 0 || totalBronze === 0) appendPricePart(value, bronze, CURRENCY_ICONS.bronze, 'бронза');

        return value;
    };

    /** @type {Map<string, DynamicTooltipData|null|Promise<DynamicTooltipData|null>>} */
    const dynamicTooltipCache = new Map();
    let activeTooltipKey = null;

    const getItemDynamicTooltipKey = (item) => {
        if (item?.id == null || item.id === '') return null;
        const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
        return `${item.id}|${grade}`;
    };

    /**
     * @param {number|string} itemId
     * @param {number|string} grade
     * @param {DynamicTooltipData} data
     */
    const saveDynamicTooltipSnapshot = (itemId, grade, data) => {
        if (itemId == null || !data) return;

        try {
            const raw = localStorage.getItem(LS_KEYS.DYNAMIC_TOOLTIPS);
            const all = raw ? JSON.parse(raw) : {};
            all[String(itemId)] = {
                id: String(itemId),
                grade: String(grade ?? 0),
                updatedAt: Date.now(),
                data,
            };
            localStorage.setItem(LS_KEYS.DYNAMIC_TOOLTIPS, JSON.stringify(all));
        } catch (e) {
            debugWarn('Failed to save dynamic tooltip snapshot:', e);
        }
    };

    /**
     * @param {DynamicTooltipFieldValue|undefined} value
     * @returns {string|null}
     */
    const dynamicTooltipFieldValue = (value) => {
        if (value == null) return null;
        const str = String(value).trim();
        return str ? str : null;
    };

    /**
     * @param {DynamicTooltipFieldValue|undefined} value
     * @returns {number|null}
     */
    const dynamicTooltipNumberValue = (value) => {
        if (value == null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    /**
     * @param {DynamicTooltipFieldValue|undefined} value
     * @returns {number|string|null}
     */
    const dynamicTooltipStatValue = (value) => {
        if (value == null || value === '') return null;
        const str = String(value).trim();
        if (!str) return null;

        const num = Number(str);
        return Number.isFinite(num) ? num : str;
    };

    /**
     * @param {DynamicTooltipData|null} data
     * @returns {Partial<ItemBase>}
     */
    const mapDynamicTooltipToItem = (data) => {
        if (!data || typeof data !== 'object') return {};

        const fixedGrade = dynamicTooltipNumberValue(data.fixed_grade);
        const apiGrade = dynamicTooltipNumberValue(data.grade);
        const grade = fixedGrade != null && fixedGrade >= 0 ? fixedGrade : apiGrade;
        const reqLevel = dynamicTooltipNumberValue(data.level_requirement);
        const maxLevel = dynamicTooltipNumberValue(data.level_limit);
        const hasRefund = Object.prototype.hasOwnProperty.call(data, 'refund');
        const price = data.refund === null ? null : dynamicTooltipNumberValue(data.refund);
        const description = cleanDynamicTooltipMarkup(data.description);
        const equipTooltipFields = mapDynamicEquipTooltip(data.equip_tooltip);
        const setDescription = cleanDynamicTooltipMarkup(data.set_description);

        return {
            ...(dynamicTooltipFieldValue(data.filename) ? { icon: dynamicTooltipFieldValue(data.filename) } : {}),
            ...(dynamicTooltipFieldValue(data.name) ? { name: dynamicTooltipFieldValue(data.name) } : {}),
            ...(grade != null && grade >= 0 ? { grade } : {}),
            ...(description ? { description } : {}),
            ...equipTooltipFields,
            ...(setDescription ? { equipDescription: setDescription } : {}),
            ...(dynamicTooltipFieldValue(data.cat_name) ? { apiCategoryTitle: dynamicTooltipFieldValue(data.cat_name) } : {}),
            ...(reqLevel != null && reqLevel > 0 ? { reqLevel } : {}),
            ...(maxLevel != null && maxLevel >= 0 ? { maxLevel } : {}),
            ...(hasRefund && (price !== null || data.refund === null) ? { price } : {}),
            ...(dynamicTooltipStatValue(data.c_speed) != null ? { speed: dynamicTooltipStatValue(data.c_speed) } : {}),
            ...(dynamicTooltipStatValue(data.c_durability) != null ? { durability: dynamicTooltipStatValue(data.c_durability) } : {}),
            ...(dynamicTooltipStatValue(data.c_dps) != null ? { dps: dynamicTooltipStatValue(data.c_dps) } : {}),
            ...(dynamicTooltipStatValue(data.c_armor) != null ? { armor: dynamicTooltipStatValue(data.c_armor) } : {}),
            ...(dynamicTooltipStatValue(data.c_magic_resistance) != null ? { magicResistance: dynamicTooltipStatValue(data.c_magic_resistance) } : {}),
            ...(dynamicTooltipStatValue(data.c_mdps) != null ? { mdps: dynamicTooltipStatValue(data.c_mdps) } : {}),
            ...(dynamicTooltipStatValue(data.c_hdps) != null ? { hdps: dynamicTooltipStatValue(data.c_hdps) } : {}),
            ...(dynamicTooltipStatValue(data.c_str) != null ? { str: dynamicTooltipStatValue(data.c_str) } : {}),
            ...(dynamicTooltipStatValue(data.c_dex) != null ? { dex: dynamicTooltipStatValue(data.c_dex) } : {}),
            ...(dynamicTooltipStatValue(data.c_sta) != null ? { sta: dynamicTooltipStatValue(data.c_sta) } : {}),
            ...(dynamicTooltipStatValue(data.c_int) != null ? { int: dynamicTooltipStatValue(data.c_int) } : {}),
            ...(dynamicTooltipStatValue(data.c_spi) != null ? { spi: dynamicTooltipStatValue(data.c_spi) } : {}),
        };
    };

    const itemHasTooltipField = (item, field) => (
        field === 'price'
            ? Object.prototype.hasOwnProperty.call(item, field)
            : item[field] != null && item[field] !== ''
    );

    /**
     * @param {ItemBase} item
     * @param {DynamicTooltipData|null} data
     * @returns {ItemBase}
     */
    const mergeDynamicTooltipItem = (item, data) => {
        const apiItem = mapDynamicTooltipToItem(data);
        const merged = { ...item };

        for (const [field, value] of Object.entries(apiItem)) {
            if (field === 'buff') {
                merged.buff = { ...(value || {}), ...(merged.buff || {}) };
                continue;
            }
            if (!itemHasTooltipField(merged, field)) merged[field] = value;
        }

        return merged;
    };

    /**
     * @param {ItemBase} item
     * @returns {Promise<DynamicTooltipData|null>}
     */
    const fetchDynamicTooltipData = async (item) => {
        if (!isArcheageSite) return null;

        const key = getItemDynamicTooltipKey(item);
        if (!key) return null;
        if (dynamicTooltipCache.has(key)) return dynamicTooltipCache.get(key);

        const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
        const promise = fetch(`/dynamic/tooltip/?a=item&id=${encodeURIComponent(item.id)}&g=${encodeURIComponent(grade)}`, {
            credentials: 'include',
            cache: 'no-store',
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && typeof data === 'object') saveDynamicTooltipSnapshot(item.id, grade, data);
                return data && typeof data === 'object' ? data : null;
            })
            .catch(e => {
                debugWarn(`Failed to fetch dynamic tooltip for item ${item.id}:`, e);
                return null;
            });

        dynamicTooltipCache.set(key, promise);
        const data = await promise;
        dynamicTooltipCache.set(key, data);
        return data;
    };

    /**
     * Заполняет тултип данными предмета.
     * @param {ItemBase} item
     */
    const populateTooltip = (item) => {
        const tooltip = getTooltipContainer();
        tooltip.innerHTML = '';

        const gradeInfo = GRADES[item.grade];

        // Секция 1: иконка + мета
        const headerSection = document.createElement('div');
        headerSection.className = 'tm-item-tooltip-header';

        const iconEl = makeItemIconLink({ item, noTooltip: true });
        headerSection.appendChild(iconEl);

        const tipMeta = document.createElement('div');
        tipMeta.className = 'tm-item-tooltip-meta';

        const subTypeInfo = ITEM_SUB_TYPES[item.subType];
        const typeInfo = subTypeInfo || ITEM_TYPES[item.type];
        const typeTitle = typeInfo?.title || item.apiCategoryTitle;
        if (typeTitle) {
            const typeLine = document.createElement('div');
            typeLine.className = 'tm-item-tooltip-type';
            typeLine.textContent = typeTitle;
            tipMeta.appendChild(typeLine);
        }

        if (gradeInfo?.title && !(item.grade === 1 && item.type !== 'equipment')) {
            const gradeLine = document.createElement('div');
            gradeLine.className = 'tm-item-tooltip-grade';
            if (gradeInfo.color) gradeLine.style.color = gradeInfo.color;
            gradeLine.textContent = gradeInfo.title;
            tipMeta.appendChild(gradeLine);
        }

        const nameLine = document.createElement('div');
        nameLine.className = 'tm-item-tooltip-name';
        if (gradeInfo?.color) nameLine.style.color = gradeInfo.color;
        nameLine.textContent = item.name || '';
        tipMeta.appendChild(nameLine);

        headerSection.appendChild(tipMeta);
        tooltip.appendChild(headerSection);

        // Секция: требования (если есть)
        if (item.isPersonal || item.reqLevel != null || item.maxLevel != null) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const reqSection = document.createElement('div');
            reqSection.className = 'tm-item-tooltip-req';
            if (item.reqLevel != null || item.maxLevel != null) {
                reqSection.appendChild(makeRequiredLevelLine(item.reqLevel, item.maxLevel));
            }
            if (item.isPersonal) {
                const p = document.createElement('div');
                p.textContent = 'Персональный предмет';
                reqSection.appendChild(p);
            }
            tooltip.appendChild(reqSection);
        }

        const utilityStatEntries = getItemStatEntries(item, ITEM_UTILITY_STATS);
        if (utilityStatEntries.length) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);
            tooltip.appendChild(makeItemStatsSection(utilityStatEntries));
        }

        const combatStatEntries = getItemStatEntries(item, ITEM_COMBAT_STATS);
        if (combatStatEntries.length) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);
            tooltip.appendChild(makeItemStatsSection(combatStatEntries));
        }

        const equipmentSubTypeInfo = EQUIPMENT_SUB_TYPES[item.equipmentSubType];
        if (equipmentSubTypeInfo?.title) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const equipmentSubTypeSection = document.createElement('div');
            equipmentSubTypeSection.className = 'tm-item-tooltip-equipment-subtype';
            equipmentSubTypeSection.textContent = equipmentSubTypeInfo.title;
            tooltip.appendChild(equipmentSubTypeSection);
        }

        // Секция: описание (если есть)
        const hasUseDescription = item.useDescription && hasVisibleTooltipText(item.useDescription);
        if (item.description || hasUseDescription || item.equipDescription) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const descriptionSection = document.createElement('div');
            descriptionSection.className = 'tm-item-tooltip-desc';
            if (item.description) {
                const descText = document.createElement('div');
                descText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.description, item));
                descriptionSection.appendChild(descText);
            }
            if (hasUseDescription) {
                const useBlock = document.createElement('div');
                useBlock.className = 'tm-item-tooltip-use';
                const useLabel = document.createElement('div');
                useLabel.className = 'tm-item-tooltip-use-label';
                useLabel.textContent = 'Использование';
                const useText = document.createElement('div');
                useText.className = 'tm-item-tooltip-use-text';
                useText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.useDescription, item));
                useBlock.appendChild(useLabel);
                useBlock.appendChild(useText);
                descriptionSection.appendChild(useBlock);
            }
            if (item.equipDescription) {
                const equipBlock = document.createElement('div');
                equipBlock.className = 'tm-item-tooltip-use';
                const equipLabel = document.createElement('div');
                equipLabel.className = 'tm-item-tooltip-use-label';
                equipLabel.textContent = item.isEquipDescriptionTemporary ? 'Экипировка (временно)' : 'Экипировка';
                const equipText = document.createElement('div');
                equipText.className = 'tm-item-tooltip-use-text';
                equipText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.equipDescription, item));
                equipBlock.appendChild(equipLabel);
                equipBlock.appendChild(equipText);
                descriptionSection.appendChild(equipBlock);
            }
            tooltip.appendChild(descriptionSection);
        }

        // Секция: цена
        if (item.price !== undefined) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const priceSection = document.createElement('div');
            priceSection.className = 'tm-item-tooltip-price';
            if (item.price === null || Number(item.price) === 0) {
                priceSection.className = 'tm-item-tooltip-price tm-item-tooltip-price--none';
                priceSection.textContent = 'Этот предмет не нужен торговцам.';
            } else {
                const label = document.createElement('span');
                label.textContent = 'Цена\nпродажи:';
                priceSection.appendChild(label);
                priceSection.appendChild(makeItemPriceValue(item.price));
            }
            tooltip.appendChild(priceSection);
        }
    };

    /**
     * Показывает тултип рядом с элементом.
     * @param {HTMLElement} anchorEl
     * @param {ItemBase} item
     */
    const TOOLTIP_VISIBLE_CLASS = 'tm-item-tooltip--visible';
    const TOOLTIP_RIGHT_CLASS = 'tm-item-tooltip--right';
    const TOOLTIP_BOTTOM_CLASS = 'tm-item-tooltip--bottom';
    const TOOLTIP_WIDTH = 248;

    const positionTooltip = (anchorEl) => {
        const tooltip = getTooltipContainer();
        const rect = anchorEl.getBoundingClientRect();
        const screenScale = getSystemScale();
        const scale = 1 / screenScale;

        // Проверяем, поместится ли тултип слева
        const tooltipLeftEdge = rect.left + 8 - TOOLTIP_WIDTH * scale;
        const showOnRight = tooltipLeftEdge < 0;

        // Проверяем, поместится ли тултип снизу
        tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
        tooltip.style.setProperty('--tm-tooltip-scale', `${scale}`);
        const tooltipHeight = tooltip.offsetHeight * scale;
        const showFromBottom = (rect.bottom - 8 + tooltipHeight) > window.innerHeight;

        if (showFromBottom) {
            const topEdge = rect.top + 8 - tooltipHeight;
            if (topEdge < 0) {
                // Не помещается ни снизу, ни сверху — прижимаем к верху окна
                tooltip.style.setProperty('--tm-tooltip-top', '0px');
                tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
            } else {
                // От верхнего угла иконки: нижний край тултипа = верх иконки + 8px
                tooltip.style.setProperty('--tm-tooltip-top', `${rect.top + 8}px`);
                tooltip.classList.add(TOOLTIP_BOTTOM_CLASS);
            }
        } else {
            // От нижнего угла иконки (по умолчанию)
            tooltip.style.setProperty('--tm-tooltip-top', `${rect.bottom - 8}px`);
            tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
        }

        if (showOnRight) {
            tooltip.style.setProperty('--tm-tooltip-left', `${rect.right - 8}px`);
            tooltip.classList.add(TOOLTIP_RIGHT_CLASS);
        } else {
            tooltip.style.setProperty('--tm-tooltip-left', `${rect.left + 8}px`);
            tooltip.classList.remove(TOOLTIP_RIGHT_CLASS);
        }
    };

    const showTooltip = (anchorEl, item) => {
        const tooltipKey = getItemDynamicTooltipKey(item) || `${Date.now()}:${Math.random()}`;
        activeTooltipKey = tooltipKey;
        populateTooltip(item);
        positionTooltip(anchorEl);

        fetchDynamicTooltipData(item).then(data => {
            if (!data || activeTooltipKey !== tooltipKey) return;

            populateTooltip(mergeDynamicTooltipItem(item, data));
            positionTooltip(anchorEl);
        });
    };

    /** Скрывает тултип. */
    const hideTooltip = () => {
        activeTooltipKey = null;
        if (globalTooltip) {
            globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS, TOOLTIP_BOTTOM_CLASS);
        }
    };

    // ==================== Иконка предмета ====================

    /**
     * Создаёт иконку предмета с рамкой редкости, overlay типа и всплывашкой.
     * Иконка состоит из слоёв: изображение предмета → overlay типа → рамка грейда.
     *
     * @param {Object} params
     * @param {ItemBase} params.item - Предмет.
     * @param {boolean} [params.linked=false] - Создать как `<a>` со ссылкой на ArcheageCodex.
     * @param {'small'|'medium'} [params.size='medium'] - Размер иконки: `'small'` (30px) или `'medium'` (42px).
     * @param {number} [params.count] - Количество предмета (бейдж снизу-справа, показывается при > 1).
     * @param {boolean} [params.noTooltip=false] - Не добавлять всплывашку (для иконки внутри тултипа).
     * @returns {HTMLElement} `.tm-item-icon`
     */
    /**
     * @param {ItemBase} item
     * @returns {string}
     */
    const getItemCodexUrl = (item) => (
        `${CODEX_ITEM_URL}${item.id}/${item.isGradeInferred ? `?grade=${item.grade}` : ''}`
    );

    const makeItemIconLink = ({ item, linked = false, size = 'medium', count, noTooltip = false }) => {
        const icon = document.createElement(linked ? 'a' : 'div');
        icon.className = `tm-item-icon tm-item-icon--${size}`;

        if (linked) {
            icon.href = getItemCodexUrl(item);
            icon.target = '_blank';
            icon.rel = 'noopener noreferrer';
            icon.addEventListener('click', (e) => e.stopPropagation());
        }

        const itemImg = document.createElement('img');
        itemImg.className = 'tm-item-icon-img';
        itemImg.src = getItemIconUrl(item);
        itemImg.dataset.itemId = item.id;
        itemImg.dataset.iconTemplate = item.icon || '';
        itemImg.dataset.iconM = item.iconM || '';
        itemImg.dataset.iconF = item.iconF || '';

        icon.appendChild(itemImg);

        const overlay = ICON_OVERLAY[item.overlay]?.icon;
        // Overlay слой (между иконкой и рамкой редкости)
        if (overlay) {
            const overlayImg = document.createElement('img');
            overlayImg.className = 'tm-item-icon-overlay';
            overlayImg.src = overlay;
            icon.appendChild(overlayImg);
        }

        const gradeInfo = GRADES[item.grade];
        if (gradeInfo) {
            const gradeImg = document.createElement('img');
            gradeImg.className = 'tm-item-icon-grade';
            gradeImg.src = gradeInfo.overlay;
            gradeImg.alt = gradeInfo.title || '';
            icon.appendChild(gradeImg);
        }

        if (count && count > 1) {
            const countEl = document.createElement('div');
            countEl.className = 'tm-item-icon-count';
            countEl.textContent = count;
            icon.appendChild(countEl);
        }

        if (!noTooltip) {
            icon.addEventListener('mouseenter', () => showTooltip(icon, item));
            icon.addEventListener('mouseleave', hideTooltip);
        }

        return icon;
    };

    /**
     * @param {number} amount
     * @param {boolean} isDone
     */
    const makeRewardBlock = (amount, isDone) => {
        const reward = document.createElement('div');
        reward.className = 'tasks__item-reward';

        const name = document.createElement('span');
        name.className = 'tasks__item-reward-name';
        name.textContent = 'Награда:';
        reward.appendChild(name);

        const n = Math.max(0, Math.min(20, amount));
        const cls = isDone ? 'icon-point--received' : 'icon-point--not-received';

        for (let i = 0; i < n; i++) {
            const icon = document.createElement('div');
            icon.className = `icon-point ${cls}`;
            reward.appendChild(icon);
        }

        return reward;
    };

    /** @param {string} desc */
    const makeTaskText = (desc) => {
        const t = document.createElement('div');
        t.className = 'tasks__item-text';
        t.textContent = desc || '';
        return t;
    };

    const makeGisaaStatusLine = (info) => {
        if (!info) return null;

        const line = document.createElement('div');
        line.className = `tm-gisaa-status tm-gisaa-status--${info.status}`;

        if (info.status === 'available') {
            const places = (info.locations || [])
                .filter(location => !/^copy$/i.test(String(location).trim()))
                .join(' / ');
            line.textContent = places
                ? `Сегодня можно выполнить: ${places}`
                : 'Сегодня можно выполнить';
        } else if (info.status === 'unavailable') {
            line.textContent = 'Сегодня нельзя выполнить';
        } else {
            return null;
        }

        return line;
    };

    const getTodayWeekdayMonFirst = () => {
        return (getMSKWeekday(getServerNowMs()) + 6) % 7;
    };

    /** @param {number[]|undefined} weekdays */
    const formatAvailableWeekdaysStatus = (weekdays) => {
        if (!weekdays?.length) return '';
        return weekdays.includes(getTodayWeekdayMonFirst())
            ? 'Можно сегодня взять'
            : 'Сегодня нельзя взять';
    };

    /**
     * @param {Object} params
     * @param {number|null} params.id
     * @param {string} params.short
     * @param {string} params.questTitle
     * @param {Slot|null} [params.slot]
     * @param {'blue_salt'|'north'} [params.veksel]
     * @param {string[]} [params.locations]
     * @param {number[]} [params.availableWeekdays]
     * @param {EventSchedule[]} [params.schedule]
     */
    const makeLinksRow = ({ id, short, questTitle, slot, veksel, locations, availableWeekdays, schedule }) => {
        const row = document.createElement('div');
        row.className = 'tm-links-row';

        // Левая часть: иконка предмета + локации + short-описание
        const leftPart = document.createElement('div');
        leftPart.className = 'tm-links-left';

        // Предмет с количеством и иконкой (если есть данные)
        const item = slot?.item;
        if (item?.id) {
            const hasIcon = item.icon && item.grade;

            if (hasIcon) {
                leftPart.appendChild(makeItemIconLink({
                    item,
                    linked: true,
                    size: 'small',
                    count: slot.count,
                }));
            } else if (item.name) {
                // Без иконки - показываем название ссылкой
                const nameLink = document.createElement('a');
                nameLink.className = 'tm-item-name-link';
                nameLink.href = getItemCodexUrl(item);
                nameLink.target = '_blank';
                nameLink.rel = 'noopener noreferrer';
                nameLink.textContent = item.name;
                leftPart.appendChild(nameLink);
            }
        }

        // Контейнер для локаций/short и schedule
        const hasLocations = locations && locations.length > 0;
        const hasShort = !!short;
        const availableWeekdaysStatus = formatAvailableWeekdaysStatus(availableWeekdays);
        const hasAvailableWeekdays = !!availableWeekdaysStatus;
        const hasSchedule = schedule && schedule.length > 0;
        const gisaaInfo = getGisaaVekselInfoForQuest(veksel, slot, locations);

        if (hasLocations || hasShort || hasAvailableWeekdays || hasSchedule || gisaaInfo) {
            const infoWrapper = document.createElement('div');
            infoWrapper.className = 'tm-info-wrapper';

            // Первая строка: локации + short
            if (hasLocations || hasShort) {
                const infoLine = document.createElement('div');
                infoLine.className = 'tm-info-line';

                if (hasLocations) {
                    const locEl = document.createElement('span');
                    locEl.className = 'tm-locations';
                    locEl.textContent = locations.join(' / ');
                    infoLine.appendChild(locEl);
                }

                if (hasShort) {
                    const d = document.createElement('span');
                    d.className = 'tm-short';
                    d.innerHTML = short;
                    infoLine.appendChild(d);
                }

                infoWrapper.appendChild(infoLine);
            }

            if (hasAvailableWeekdays) {
                const daysEl = document.createElement('div');
                daysEl.className = 'tm-available-days';
                daysEl.textContent = availableWeekdaysStatus;
                infoWrapper.appendChild(daysEl);
            }

            // Вторая строка: события (времена)
            if (hasSchedule) {
                const eventsEl = document.createElement('div');
                eventsEl.className = 'tm-events';
                eventsEl.textContent = formatEventsToString(schedule);

                // Countdown
                const countdown = document.createElement('span');
                countdown.className = 'tm-countdown';
                countdown.dataset.schedule = JSON.stringify(schedule);
                const seconds = getSecondsUntilNextEvent(schedule);
                updateCountdownEl(countdown, seconds);
                eventsEl.appendChild(countdown);

                infoWrapper.appendChild(eventsEl);
            }

            const gisaaStatusLine = makeGisaaStatusLine(gisaaInfo);
            if (gisaaStatusLine) {
                infoWrapper.appendChild(gisaaStatusLine);
            }

            leftPart.appendChild(infoWrapper);
        }

        row.appendChild(leftPart);

        const icons = document.createElement('div');
        icons.className = 'tm-icons';
        row.appendChild(icons);

        const codexTitle = questTitle
            ? `${formatQuestTitle(questTitle)} - ArcheageCodex`
            : 'Открыть задание в ArcheageCodex';

        // Иконка квеста (всегда справа, добавляем первой из-за row-reverse)
        if (id) {
            icons.appendChild(makeIconLink({
                href: `${CODEX_BASE}${id}/`,
                iconSrc: ICON_QUEST,
                title: codexTitle,
                className: 'tm-codex-link',
            }));
        }

        if (veksel === 'blue_salt' || veksel === 'north') {
            const link = makeVekselIconLink({
                href: buildVekselUrl(veksel, slot, locations),
                title: 'Открыть таблицу векселей',
                vekselIcon: veksel === 'blue_salt' ? ICON_VEKSEL : ICON_VEKSEL_NORTH,
            });
            link.classList.add('tm-veksel-link');
            link.dataset.veksel = veksel;
            if (slot) link.dataset.slot = JSON.stringify(slot);
            if (locations) link.dataset.locations = JSON.stringify(locations);
            icons.appendChild(link);
        }

        return row;
    };

    /**
     * @param {Object} params
     * @param {ApiQuest} params.q
     * @param {number} params.amount
     * @param {number} params.id
     * @param {string} params.short
     * @param {boolean} params.isDone
     * @param {boolean} params.showLastDone
     * @param {Slot|null} [params.slot]
     * @param {'blue_salt'|'north'} [params.veksel]
     * @param {string[]} [params.locations]
     * @param {number[]} [params.availableWeekdays]
     * @param {EventSchedule[]} [params.schedule]
     * @param {boolean} [params.animateCompletion=false] - Добавить анимацию "только что выполнено"
     */
    const makeTaskCard = ({ q, amount, id, short, isDone, showLastDone, completionTime, isToday, slot, veksel, locations, availableWeekdays, schedule, animateCompletion = false }) => {
        const card = document.createElement('div');
        card.className = `tasks__item tasks__item--${amount || 1}`;

        if (isDone) {
            card.classList.add(DONE_CLASS);
            if (animateCompletion) {
                card.classList.add(JUST_DONE_CLASS);
                card.addEventListener('animationend', () => {
                    card.classList.remove(JUST_DONE_CLASS);
                }, { once: true });
            }

            const done = document.createElement('div');
            done.className = 'tasks__item-done';

            const row = document.createElement('div');
            row.className = 'tm-done-row';

            const maxStep = Number(q?.max_completed_step || 0);
            const progress = Number(q?.progress || 0);
            const progressEl = document.createElement('span');
            progressEl.className = 'tm-done-progress';
            if (maxStep === 0 && isToday) {
                progressEl.textContent = 'Можно выполнить повторно';
            } else if (maxStep === 0) {
                progressEl.textContent = '';
            } else {
                progressEl.textContent = `${progress}/${maxStep}`;
            }
            row.appendChild(progressEl);

            const checkEl = document.createElement('span');
            checkEl.className = 'tm-done-check';
            checkEl.textContent = '✔';
            row.appendChild(checkEl);

            done.appendChild(row);

            if (showLastDone) {
                const time = formatTimeMSK(completionTime || 0);
                if (time) {
                    const timeEl = document.createElement('span');
                    timeEl.className = 'tm-done-time';
                    timeEl.textContent = time;
                    done.appendChild(timeEl);
                }
            }

            card.appendChild(done);
        }

        card.appendChild(makeRewardBlock(amount, isDone));
        card.appendChild(makeTaskText(q.description));
        card.appendChild(makeLinksRow({ id, short, questTitle: q.title, slot, veksel, locations, availableWeekdays, schedule }));

        return card;
    };

    // ==================== UI: обновление блока уровня ====================

    /** @param {ApiInfoResponse} json */
    const updateLevelBlock = (json) => {
        const userInfo = json?.data?.user_info;
        if (!userInfo) return;

        const level = Number(userInfo.level || 1);
        const expTotal = Number(userInfo.exp_total || 0);
        const expForLevel = Number(json?.data?.action_info?.exp_for_level || 10);

        // Прогресс до следующего уровня
        const progress = expTotal - (level - 1) * expForLevel;
        const clampedProgress = Math.max(0, Math.min(expForLevel, progress));

        const levelBlock = document.querySelector('.level');
        if (!levelBlock) return;

        // Пересобираем блок level
        levelBlock.innerHTML = '';

        // Левая часть - текущий уровень
        const levelCurrent = document.createElement('div');
        levelCurrent.className = 'level__current';

        const levelCurrentTitle = document.createElement('div');
        levelCurrentTitle.className = 'level__current-title';
        levelCurrentTitle.textContent = 'Ваш уровень:';
        levelCurrent.appendChild(levelCurrentTitle);

        const iconLevel = document.createElement('div');
        iconLevel.className = 'icon_level';

        const iconLevelText = document.createElement('div');
        iconLevelText.className = 'icon_level-text';
        iconLevelText.textContent = String(level);
        iconLevel.appendChild(iconLevelText);

        const iconsStar = document.createElement('div');
        iconsStar.className = 'icons-star';
        iconLevel.appendChild(iconsStar);

        levelCurrent.appendChild(iconLevel);

        // Tooltip
        const iconInfo = document.createElement('div');
        iconInfo.className = 'icon-info tooltip-on';

        const tooltipWrap = document.createElement('div');
        tooltipWrap.className = 'tooltip-wrap';

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';

        const tooltipText = document.createElement('div');
        tooltipText.className = 'tooltip__text';
        tooltipText.textContent = 'Выполняйте внутриигровые задания — и получайте за это уровни в событии «Марафон героев»!';
        tooltip.appendChild(tooltipText);
        tooltipWrap.appendChild(tooltip);
        iconInfo.appendChild(tooltipWrap);

        levelCurrent.appendChild(iconInfo);
        levelBlock.appendChild(levelCurrent);

        // Правая часть - прогресс до следующего уровня
        const levelNext = document.createElement('div');
        levelNext.className = 'level__next';

        const levelNextTitle = document.createElement('div');
        levelNextTitle.className = 'level__next-title';
        levelNextTitle.textContent = 'Прогресс до следующего уровня:';
        levelNext.appendChild(levelNextTitle);

        const levelNextList = document.createElement('div');
        levelNextList.className = 'level__next-list';

        for (let i = 0; i < expForLevel; i++) {
            const iconPoint = document.createElement('div');
            iconPoint.className = i < clampedProgress ? 'icon-point icon-point--received' : 'icon-point icon-point--not-received';
            levelNextList.appendChild(iconPoint);
        }

        levelNext.appendChild(levelNextList);
        levelBlock.appendChild(levelNext);
    };

    // ==================== UI: обновление tasks__header ====================

    /** @param {ApiInfoResponse} json */
    const updateTasksHeader = (json) => {
        const userInfo = json?.data?.user_info;
        if (!userInfo) return;

        const weekExp = Number(userInfo.week_exp || 0);
        const maxWeekExp = Number(json?.data?.action_info?.increase_max_exp_per_week || 100);

        if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) {
            DOM.tasksHeader = document.querySelector('.section.tasks .tasks__header');
        }
        if (!DOM.tasksHeader) return;

        // Ищем или создаём tasks__balance
        let balanceEl = DOM.tasksHeader.querySelector('.tasks__balance');
        if (!balanceEl) {
            balanceEl = document.createElement('div');
            balanceEl.className = 'tasks__balance';
            DOM.tasksHeader.appendChild(balanceEl);
        }

        // Обновляем содержимое
        balanceEl.innerHTML = '';

        const label = document.createTextNode(`Заработано за эту неделю: ${weekExp} / ${maxWeekExp}`);
        balanceEl.appendChild(label);

        const iconPoint = document.createElement('div');
        iconPoint.className = 'icon-point icon-point--received';
        balanceEl.appendChild(iconPoint);
    };

    // ==================== UI: навигация по датам ====================

    const ensureTasksListEl = () => {
        if (!DOM.tasksList || !DOM.tasksList.isConnected) {
            DOM.tasksList = document.querySelector('.section.tasks .tasks__list');
        }
        if (!DOM.tasksList) {
            debugWarn('tasks list element not found', {
                path: location.pathname,
                hasTasksSection: !!document.querySelector('.section.tasks'),
                taskSectionHtml: document.querySelector('.section.tasks')?.outerHTML?.slice(0, 1000) || null,
            });
        }
        return DOM.tasksList;
    };

    const ensureDateNavInHeader = () => {
        if (DOM.nav && DOM.nav.isConnected) return DOM.nav;

        if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) {
            DOM.tasksHeader = document.querySelector('.section.tasks .tasks__header');
        }
        if (!DOM.tasksHeader) return null;

        let nav = DOM.tasksHeader.querySelector('.tm-date-nav');
        if (nav) {
            DOM.nav = nav;
            DOM.label = nav.querySelector('.tm-date-label');
            DOM.prevBtn = nav.querySelector('.tm-date-prev');
            DOM.nextBtn = nav.querySelector('.tm-date-next');
            DOM.todayBtn = nav.querySelector('.tm-date-today');
            return nav;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'tm-nav-wrapper';

        const todayBtn = document.createElement('button');
        todayBtn.className = 'tm-date-btn tm-date-today';
        todayBtn.type = 'button';
        todayBtn.textContent = 'Сегодня';

        nav = document.createElement('div');
        nav.className = 'tm-date-nav';

        const left = document.createElement('button');
        left.className = 'tm-date-btn tm-date-prev';
        left.type = 'button';
        left.textContent = '←';

        const right = document.createElement('button');
        right.className = 'tm-date-btn tm-date-next';
        right.type = 'button';
        right.textContent = '→';

        const label = document.createElement('div');
        label.className = 'tm-date-label';
        label.textContent = '...';

        nav.appendChild(left);
        nav.appendChild(label);
        nav.appendChild(right);

        const hideDoneLabel = document.createElement('label');
        hideDoneLabel.className = 'tm-hide-done-label';

        const hideDoneCheckbox = document.createElement('input');
        hideDoneCheckbox.type = 'checkbox';
        hideDoneCheckbox.className = 'tm-hide-done-checkbox';

        const hideDoneText = document.createTextNode(' Скрыть выполненные');
        hideDoneLabel.appendChild(hideDoneCheckbox);
        hideDoneLabel.appendChild(hideDoneText);

        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'tm-refresh-btn';
        refreshBtn.title = 'Обновить данные';
        refreshBtn.innerHTML = '&#x21bb;'; // ↻ символ обновления
        DOM.refreshLoader = refreshBtn;

        refreshBtn.addEventListener('click', () => {
            refreshApiInfo();
            restartAutoRefresh();
        });

        wrapper.appendChild(todayBtn);
        wrapper.appendChild(nav);
        wrapper.appendChild(hideDoneLabel);
        wrapper.appendChild(refreshBtn);

        DOM.tasksHeader.insertAdjacentElement('afterbegin', wrapper);
        DOM.nav = nav;
        DOM.label = label;
        DOM.prevBtn = left;
        DOM.nextBtn = right;
        DOM.todayBtn = todayBtn;
        DOM.hideDoneCheckbox = hideDoneCheckbox;

        // Инициализация из localStorage
        const savedState = loadHideDoneState();
        hideDoneCheckbox.checked = savedState;
        if (savedState) {
            const listEl = ensureTasksListEl();
            if (listEl) listEl.classList.add('tm-hide-done');
        }

        hideDoneCheckbox.addEventListener('change', () => {
            const listEl = ensureTasksListEl();
            if (listEl) {
                listEl.classList.toggle('tm-hide-done', hideDoneCheckbox.checked);
            }
            saveHideDoneState(hideDoneCheckbox.checked);
        });

        left.addEventListener('click', async () => {
            const prev = getPrevSlot(selectedDayUtcMs, selectedSegment);
            applySlot(prev.dayUtcMs, prev.segment);
            await onSelectedDateChanged();
        });

        right.addEventListener('click', async () => {
            const next = getNextSlot(selectedDayUtcMs, selectedSegment);
            applySlot(next.dayUtcMs, next.segment);
            await onSelectedDateChanged();
        });

        todayBtn.addEventListener('click', async () => {
            applySlot(getTodayUtcMsByTZ(), 'auto');
            await onSelectedDateChanged();
        });

        return nav;
    };

    const updateDateNavLabel = () => {
        if (!DOM.label) return;

        const parts = getMSKDatePartsFromUtcMs(selectedDayUtcMs);
        const dateStr = formatDMY(parts);

        const isThu = isThursdayByTZ(selectedDayUtcMs);

        let suffix = '';
        if (isThu && selectedSegment === 'pre') {
            suffix = 'до 09:00';
        } else if (isThu && selectedSegment === 'post') {
            suffix = 'после 09:00';
        }

        DOM.label.innerHTML = '';

        const dateEl = document.createElement('span');
        dateEl.className = 'tm-date-label-date';
        dateEl.textContent = dateStr;
        DOM.label.appendChild(dateEl);

        if (suffix) {
            const suffixEl = document.createElement('span');
            suffixEl.className = 'tm-date-label-suffix';
            suffixEl.textContent = suffix;
            DOM.label.appendChild(suffixEl);
        }

        updateDateNavButtons();
    };

    const updateDateNavButtons = () => {
        if (!DOM.prevBtn && !DOM.nextBtn) return;

        const curKey = slotKey(selectedDayUtcMs, selectedSegment);
        const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
        const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;

        if (DOM.prevBtn) {
            DOM.prevBtn.disabled = (minKey != null && curKey <= minKey);
        }

        if (DOM.nextBtn) {
            DOM.nextBtn.disabled = (maxKey != null) && (curKey >= maxKey);
        }

        if (DOM.todayBtn) {
            DOM.todayBtn.disabled = isSameDayByTZ(selectedDayUtcMs, getTodayUtcMsByTZ());
        }
    };

    const onSelectedDateChanged = async () => {
        updateDateNavLabel();
        updateDateNavButtons();
        try {
            await renderTasksForSelectedDay();
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] renderTasksForSelectedDay failed:', e);
        }
    };

    // ==================== Рендеринг списка ====================

    /**
     * @param {number} dayUtcMs
     * @param {ApiQuest[]} questsArr
     * @returns {{ hasPre: boolean, hasPost: boolean }}
     */
    const computeThuSegmentsAvailability = (dayUtcMs, questsArr) => {
        const preUnix = getUnixForDayAtHour(dayUtcMs, THU_PRE_HOUR);
        const postUnix = getUnixForDayAtHour(dayUtcMs, DEFAULT_HOUR);
        const hasPre = questsArr.some(q => isQuestActiveAtUnix(q, preUnix));
        const hasPost = questsArr.some(q => isQuestActiveAtUnix(q, postUnix));
        return { hasPre, hasPost };
    };

    const computeDateBoundsFromApiInfo = async () => {
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
            MIN_DAY_UTC_MS = null;
            MAX_DAY_UTC_MS = null;
            MIN_SEG = null;
            MAX_SEG = null;
            return;
        }

        MIN_DAY_UTC_MS = dayUtcMsFromUnixByTZ(minStart);
        MAX_DAY_UTC_MS = dayUtcMsFromUnixByTZ(maxEnd - 1);
        MIN_SEG = null;
        MAX_SEG = null;

        if (MIN_DAY_UTC_MS != null && isThursdayByTZ(MIN_DAY_UTC_MS)) {
            const { hasPre, hasPost } = computeThuSegmentsAvailability(MIN_DAY_UTC_MS, questsArr);
            if (hasPre) MIN_SEG = 'pre';
            else if (hasPost) MIN_SEG = 'post';
            else MIN_SEG = 'post';
        }

        if (MAX_DAY_UTC_MS != null && isThursdayByTZ(MAX_DAY_UTC_MS)) {
            const { hasPre, hasPost } = computeThuSegmentsAvailability(MAX_DAY_UTC_MS, questsArr);
            if (hasPost) MAX_SEG = 'post';
            else if (hasPre) MAX_SEG = 'pre';
            else MAX_SEG = 'pre';
        }
    };

    /**
     * @param {Object} [options]
     * @param {boolean} [options.animateNewlyDone=false] - Анимировать задания, которые стали выполненными с прошлого рендера
     */
    const renderTasksForSelectedDay = async ({ animateNewlyDone = false } = {}) => {
        const listEl = ensureTasksListEl();
        if (!listEl) return;

        const json = await getApiInfoCached();
        API_INFO_DATA_JSON = JSON.stringify(json?.data);
        const all = getQuestsArrayFromInfo(json);

        // Обновляем блок уровня и баланс очков
        updateLevelBlock(json);
        updateTasksHeader(json);

        const todayUtc = getTodayUtcMsByTZ();
        const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
        const isThu = isThursdayByTZ(selectedDayUtcMs);

        let unixPoint;
        if (isThu && selectedSegment === 'pre') {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, THU_PRE_HOUR);
        } else {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR);
        }

        const active = all.filter(q => isQuestActiveAtUnix(q, unixPoint));
        const questMetaByApiQuest = new Map(active.map(q => [q, findQuestMetaForMarathonQuest(q)]));
        const knownActive = active.filter(q => questMetaByApiQuest.get(q));
        const unknownActive = active.filter(q => !questMetaByApiQuest.get(q));

        debugLog('renderTasksForSelectedDay', {
            selectedDayUtcMs,
            selectedSegment,
            unixPoint,
            unixPointIso: debugTime(unixPoint),
            totalQuests: all.length,
            activeQuests: active.length,
            knownActiveQuests: knownActive.length,
            unknownActiveQuests: unknownActive.length,
            minDayIso: MIN_DAY_UTC_MS ? new Date(MIN_DAY_UTC_MS).toISOString() : null,
            maxDayIso: MAX_DAY_UTC_MS ? new Date(MAX_DAY_UTC_MS).toISOString() : null,
        });

        if (!active.length) {
            debugWarn('No active quests for selected slot. First API quests:', all.slice(0, 10).map(summarizeQuestForDebug));
        } else if (unknownActive.length) {
            debugWarn('Active quests without local QUESTS metadata:', unknownActive.map(summarizeQuestForDebug));
        }

        active.sort((a, b) => {
            const da = getRewardAmount(a);
            const db = getRewardAmount(b);
            if (da !== db) return da - db;
            return Number(a?.id || 0) - Number(b?.id || 0);
        });

        listEl.innerHTML = '';

        /** @type {Set<number>} */
        const currentDoneIds = new Set();
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

            // Анимируем только если: включён флаг + задание выполнено + его не было в прошлом списке
            const isNewlyDone = animateNewlyDone && doneInSlot && !previouslyDoneQuestIds.has(questId);

            const card = makeTaskCard({
                q, amount, id, short,
                isDone: doneInSlot,
                showLastDone: doneInSlot,
                completionTime,
                isToday,
                slot: meta?.slot || null,
                veksel: meta?.veksel,
                locations: meta?.locations,
                availableWeekdays: meta?.availableWeekdays,
                schedule: meta?.schedule,
                animateCompletion: isNewlyDone,
            });

            listEl.appendChild(card);
            renderedCount++;
        }

        if (active.length && !renderedCount) {
            renderEmptyTasksDiagnostic(listEl, 'ArcheAgeExtraUI: активные задания есть в API, но карточки не были отрисованы. Проверьте консоль.');
        } else if (!active.length) {
            renderEmptyTasksDiagnostic(listEl, 'ArcheAgeExtraUI: для выбранного дня активные задания не найдены. Проверьте консоль.');
        }

        previouslyDoneQuestIds = currentDoneIds;
    };

    // ==================== Стили ====================

    /** Вычисляет множитель масштабирования системы (1 при 100%, 1.25 при 125% и т.д.) */
    /** Вычисляет множитель масштабирования системы (1 при 100%, 1.25 при 125% и т.д.) */
    const getSystemScale = () => window.devicePixelRatio / (window.visualViewport?.scale || 1);

    /**
     * Стили для иконок и всплывашек предметов (используются на странице марафона и корзины).
     */
    const getItemIconStyles = () => {
        const screenScale = getSystemScale();
        return `
            :root {
                --tm-screen-scale: ${1 / screenScale};
            }

            .tm-item-icon {
                position: relative;
                display: inline-block;
                flex-shrink: 0;
            }

            .tm-item-icon--small {
                width: 30px;
                height: 30px;
                font-size: 11.5px;
            }

            .tm-item-icon--medium {
                width: 42px;
                height: 42px;
                font-size: 11.5px;
            }

            .tm-item-icon::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                opacity: 0;
                box-shadow:
                    inset 0 0 12px rgba(255, 255, 255, 0.35),
                    inset 0 0 4px rgba(255, 255, 255, 0.6);
            }

            .tm-item-icon:hover::after {
                opacity: 1;
            }

            .tm-item-icon-img {
                position: relative;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
            }

            .tm-item-icon-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: auto;
            }

            .tm-item-icon-grade {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .tm-item-icon-count {
                position: absolute;
                right: 9%;
                bottom: 12.5%;
                line-height: 0.5;
                letter-spacing: 0.02em;
                color: #fff;
                text-shadow: -1px -2px 2px #000, 1px 1px 2px #000;
                pointer-events: none;
                z-index: 3;
            }

            /* Всплывашка предмета (глобальная, в body) */
            .tm-item-tooltip {
                display: none;
                position: fixed;
                top: var(--tm-tooltip-top, 0);
                left: var(--tm-tooltip-left, 0);
                z-index: 10000;
                box-sizing: border-box;
                width: 248px;
                padding: 15px 15px 14px;
                background: rgba(0, 8, 24, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.25);
                pointer-events: none;
                white-space: normal;
                font-family: Calibri, Arial, Verdana, Tahoma;
                font-size: 14px;
                line-height: 18px;
                color: #cfd6e0;
                transform: translateX(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: top right;
            }

            .tm-item-tooltip--visible {
                display: block;
            }

            .tm-item-tooltip--right {
                transform: scale(var(--tm-tooltip-scale, 1));
                transform-origin: top left;
            }

            .tm-item-tooltip--bottom {
                transform: translateX(-100%) translateY(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: bottom right;
            }

            .tm-item-tooltip--bottom.tm-item-tooltip--right {
                transform: translateY(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: bottom left;
            }

            .tm-item-tooltip-header {
                display: flex;
                gap: 6px;
                align-items: flex-start;
                padding: 0;
            }

            .tm-item-tooltip-header > .tm-item-icon {
                flex-shrink: 0;
            }

            .tm-item-tooltip-meta {
                display: flex;
                flex-direction: column;
                padding: 6px 0 2px;
            }

            .tm-item-tooltip-type {
                opacity: 0.7;
            }

            .tm-item-tooltip-grade {
            }

            .tm-item-tooltip-name {
                font-size: 16px;
                line-height: 20px;
            }

            .tm-item-tooltip-sep {
                height: 2px;
                margin: 4px 0;
                background: linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.10));
                -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                padding: 0;
            }

            .tm-item-tooltip-req {
                padding: 0 3px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-level {
                display: flex;
                align-items: center;
            }

            .tm-item-tooltip-hero-level-icon {
                width: 16px;
                height: 16px;
                margin: 0 2px;
                flex: 0 0 auto;
            }

            .tm-item-tooltip-stats {
                padding: 0 3px;
                display: flex;
                flex-direction: column;
                gap: 1px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-stat-row {
                display: flex;
                gap: 4px;
            }

            .tm-item-tooltip-stat-value {
                color: #cfd6e0;
                text-align: right;
            }

            .tm-item-tooltip-equipment-subtype {
                padding: 0 3px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-desc {
                padding: 4px 3px 2px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .tm-item-tooltip-use-label {
                color: #888;
            }

            .tm-item-tooltip-use-text {
                color: #4caf50;
            }

            .tm-item-tooltip-price {
                padding: 0 3px;
                display: grid;
                grid-template-columns: min-content 1fr;
                gap: 8px;
            }
            .tm-item-tooltip-price--none {
                display: block;
                color: #d02e2e;
            }
            .tm-item-tooltip-price-value {
                color: #cfd6e0;
                display: inline-flex;
                align-items: center;
                justify-content: flex-end;
                flex-wrap: wrap;
                gap: 4px;
                text-align: right;
            }
            .tm-item-tooltip-price-part {
                display: inline-flex;
                align-items: center;
                gap: 2px;
                white-space: nowrap;
            }
            .tm-item-tooltip-price-icon {
                width: 16px;
                height: 16px;
                flex: 0 0 auto;
            }

            .orange_text,
            .inv-nc,
            .inv-nn,
            .inv-buffvar {
                color: #ff9c27;
            }

            .light_blue_text,
            .inv-nd {
                color: #74b0ca;
            }

            .blue_text,
            .inv-ni {
                color: #27b1c6;
            }

            .red_text,
            .inv-nr {
                color: #de482f;
            }
        `;
    };

    /**
     * Стили для страницы марафона.
     */
    const getMarathonStyles = () => `
        .${DONE_CLASS} {
            background-color: #fff0e2bf;
        }

        /* Анимация "только что выполнено" */
        @keyframes tm-just-completed-glow {
            0% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7), inset 0 0 20px rgba(76, 175, 80, 0.3);
                transform: scale(1);
            }
            15% {
                box-shadow: 0 0 25px 8px rgba(76, 175, 80, 0.6), inset 0 0 30px rgba(76, 175, 80, 0.4);
                transform: scale(1.02);
            }
            30% {
                box-shadow: 0 0 35px 12px rgba(255, 215, 0, 0.5), inset 0 0 40px rgba(255, 215, 0, 0.3);
                transform: scale(1.03);
            }
            50% {
                box-shadow: 0 0 20px 6px rgba(76, 175, 80, 0.4), inset 0 0 25px rgba(76, 175, 80, 0.2);
                transform: scale(1.01);
            }
            100% {
                box-shadow: 0 0 0 0 transparent, inset 0 0 0 transparent;
                transform: scale(1);
            }
        }

        @keyframes tm-just-completed-bg {
            0% { background-color: #fff0e2bf; }
            20% { background-color: rgba(76, 175, 80, 0.35); }
            40% { background-color: rgba(255, 215, 0, 0.3); }
            60% { background-color: rgba(76, 175, 80, 0.25); }
            100% { background-color: #fff0e2bf; }
        }

        @keyframes tm-checkmark-pop {
            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
            50% { transform: scale(1.4) rotate(10deg); opacity: 1; }
            70% { transform: scale(0.9) rotate(-5deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        .${JUST_DONE_CLASS} {
            animation:
                tm-just-completed-glow 2s ease-out forwards,
                tm-just-completed-bg 2s ease-out forwards;
            position: relative;
            z-index: 9;
        }

        .${JUST_DONE_CLASS} .tm-done-check {
            animation: tm-checkmark-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            animation-delay: 0.2s;
            transform: scale(0);
        }

        .tasks__item {
            overflow: visible;
        }

        .tasks__item-done {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            pointer-events: none;
            opacity: 0.8;
        }

        .tm-done-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .tm-done-time {
            font-size: 12px;
        }

        .tm-done-progress {
            font-size: 12px;
        }

        .tm-done-check {
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
            color: #3cb45a;
        }

        .tm-links-row {
            margin-top: 6px;
            display: flex;
            gap: 4px;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
        }

        .tm-links-left {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }

        .tm-item-name-link {
            font-size: 12px;
            color: inherit;
            opacity: 0.85;
            text-decoration: none;
        }

        .tm-item-name-link:hover {
            opacity: 1;
            text-decoration: underline;
        }

        .tm-info-wrapper {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .tm-info-line {
            display: flex;
            align-items: baseline;
            gap: 6px;
        }

        .tm-locations {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-short {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-available-days {
            font-size: 12px;
            line-height: 1.25;
            color: #8a6230;
            font-weight: 600;
        }

        .tm-gisaa-status {
            font-size: 12px;
            line-height: 1.25;
            font-weight: 600;
        }

        .tm-gisaa-status--available {
            color: #3f8f3a;
        }

        .tm-gisaa-status--unavailable {
            color: #b04a44;
        }

        .tm-short a {
            color: inherit;
        }

        .tm-events {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-inline-icon {
            display: inline-block;
            position: relative;
            width: 18px;
            height: 18px;
            vertical-align: middle;
            margin: 0 2px;
        }

        .tm-inline-icon img:first-child {
            width: 100%;
            height: 100%;
            display: block;
        }

        .tm-inline-icon-grade {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .tm-countdown {
            font-weight: 500;
            white-space: nowrap;
        }
        .tm-countdown.tm-countdown--active {
            color: #4caf50;
        }
        .tm-countdown.tm-countdown--waiting {
            color: #d02e2e;
        }

        .tm-icons {
            display: flex;
            flex-direction: row-reverse;
            gap: 8px;
            align-items: center;
            flex: 0 0 auto;
        }

        .tm-icon-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: rgba(255,255,255,0.06);
            transition: box-shadow 150ms ease, opacity 150ms ease;
        }

        .tm-icon-link:hover {
            transform: translateY(-1px);
        }

        .tm-icon-link img {
            width: 30px;
            display: block;
        }

        .tm-veksel-icon-link {
            position: relative;
            display: inline-block;
            width: 30px;
            height: 30px;
            flex-shrink: 0;
            transition: transform 120ms ease, opacity 120ms ease;
        }

        .tm-veksel-icon-link:hover {
            transform: translateY(-1px);
            opacity: 1;
        }

        .tm-veksel-icon-main {
            width: 100%;
            height: 100%;
            display: block;
        }

        .tm-veksel-icon-badge {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 18px;
            height: 18px;
            border-radius: 2px;
            background: rgba(0, 0, 0, 0.6);
        }

        .tm-nav-wrapper {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .tm-date-nav {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        @media (max-width: 1300px) {
            .tm-nav-wrapper {
                padding: 0 20px;
            }
        }

        .tm-date-btn {
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255,0.18);
            background: rgba(255, 255, 255, 0.06);
            color: inherit;
            font: inherit;
            font-size: 14px;
            text-transform: uppercase;
        }

        .tm-date-btn:hover {
            background: rgba(255, 255, 255, 0.10);
        }

        .tm-date-label {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 150px;
            text-align: center;
        }

        .tm-date-label-date {
            font-size: 16px;
        }

        .tm-date-label-suffix {
            font-size: 12px;
            opacity: 0.75;
            line-height: 1;
        }

        .tasks__header {
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 16px;
        }

        .tm-date-btn:disabled {
            opacity: 0.35;
            cursor: default;
        }

        .tm-hide-done-label {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        .tm-hide-done-label:hover {
            opacity: 1;
        }

        .tm-hide-done-checkbox {
            cursor: pointer;
        }

        .tm-hide-done .${DONE_CLASS} {
            display: none;
        }

        .tm-refresh-btn {
            width: 26px;
            height: 26px;
            padding: 0;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.7);
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            transition: background 150ms ease, color 150ms ease, transform 150ms ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .tm-refresh-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.95);
        }

        .tm-refresh-btn:active {
            transform: scale(0.92);
        }

        .tm-refresh-loader--active {
            pointer-events: none;
            animation: tm-spin 0.7s linear infinite;
        }

        @keyframes tm-spin {
            to {
                transform: rotate(360deg);
            }
        }

        /* Автозабор подарков */
        .prizes__title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .tm-auto-claim-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }

        .tm-auto-claim-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        /* Автооткрытие сундуков */
        .lootbox__title {
            gap: 30px;
            flex-wrap: wrap;
        }

        .lootbox__title .icon-info {
            margin-left: 0;
        }

        .tm-auto-open-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            text-transform: none;
        }

        .tm-auto-open-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .pagination__item--ellipsis {
            cursor: default;
            color: #777;
        }
    `;

    /** Инжектит стили для иконок предметов (используется на cart и marathon). */
    const injectItemIconStyles = () => {
        const style = document.createElement('style');
        style.textContent = getItemIconStyles();
        document.head.appendChild(style);
    };

    /** Инжектит стили для страницы марафона. */
    const injectMarathonStyles = () => {
        const style = document.createElement('style');
        style.textContent = getMarathonStyles();
        document.head.appendChild(style);
    };

    /**
     * Стили для страницы корзины.
     */
    const getCartStyles = () => `
        #block_content {
            overflow: unset;
        }

        .cart_right {
            position: sticky;
            top: 0;
        }

        .guild_tab.cart_items .gh_1,
        .guild_tab.cart_items .gс_1 {
            width: 1%;
        }

        .guild_tab.cart_items .gh_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .gh_3 {
            width: 1px;
            min-width: 170px;
            border-right: none;
        }

        .guild_tab.cart_items .gh_4 {
            width: 1%;
        }

        .guild_tab.cart_items .gс_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .gс_4 {
            white-space: nowrap;
            text-align: right;
            border-right: none;
            width: 1%;
        }

        .cart_items .item:hover {
            background: #edf4fa;
        }

        .cart_items .item.disabled:hover {
            background: transparent;
        }

        .cart_items .item.tm-selected {
            display: none;
        }


        .tm-cart-timer {
            display: block;
        }

        .tm-char-face {
            width: 100%;
            height: 100%;
            /*border-radius: 50%;*/
            opacity: 0;
            -webkit-mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent),
                                linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);
            -webkit-mask-composite: destination-in;
            mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent),
                        linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);
            mask-composite: intersect;
            filter: brightness(1.1);
            mix-blend-mode: multiply;
        }

        .tm-char-face--loaded {
            opacity: 1;
        }

        .tm-char-face--error {
            opacity: 0;
        }

        .tm-char-face-ready div {
            background: none !important;
        }
    `;

    /** Инжектит стили для страницы корзины. */
    const injectCartStyles = () => {
        const style = document.createElement('style');
        style.textContent = getCartStyles();
        document.head.appendChild(style);
    };

    /** Инжектит стили для блока списка выбранных предметов. */
    const injectSelectedItemsStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .tm-selected-container {
                position: relative;
                min-height: 100px;
                padding: 18px 14px 18px 11px;
            }

            .tm-selected-container::before {
                content: '';
                position: absolute;
                left: -1px;
                top: 0;
                bottom: 0;
                width: 100%;
                pointer-events: none;
                background:
                    url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_top.png) left top no-repeat,
                    url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bottom.png) left bottom no-repeat;
            }

            .tm-selected-list {
                display: flex;
                flex-direction: column;
                min-height: 181px;
                padding: 13px 15px;
                background: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bg.jpg) left bottom no-repeat;
                max-height: 181px;
                overflow: auto;
                position: relative;
            }

            .tm-selected-items-help {
                margin: auto;
                color: #495a6d;
                font: 14px / 16px Cambria, Georgia, "Times New Roman", Times, serif;
                text-align: center;
                cursor: default;
            }

            .tm-selected-item {
                position: relative;
                display: flex;
                align-items: center;
                padding: 2px 36px 2px 0;
                font: 14px / 16px Cambria, Georgia, "Times New Roman", Times, serif;
                border-bottom: 1px solid #d6dde5;
                border-top: 1px solid #d6dde5;
                cursor: default;
                z-index: 1;
            }

            .tm-cart-item-name {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .tm-selected-item .del_btn {
                position: absolute;
                display: block;
                top: 50%;
                margin-top: -12px;
                right: 0;
                width: 25px;
                height: 25px;
                background-image: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/icons.png);
                background-repeat: no-repeat;
                background-position: left 0px;
                cursor: pointer;
            }

        `;
        document.head.appendChild(style);
    };

    // ==================== Компонент: кнопка перезагрузки ====================

    let reloadBtnStylesInjected = false;

    const injectReloadBtnStyles = () => {
        if (reloadBtnStylesInjected) return;
        reloadBtnStylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .guild_header2.tm-has-reload {
                display: flex;
                align-items: center;
            }
            .tm-reload-btn {
                width: 22px;
                height: 22px;
                margin-left: 8px;
                padding: 0;
                border: none;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                color: rgba(255, 255, 255, 0.75);
                font-size: 15px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 150ms ease, color 150ms ease;
                flex-shrink: 0;
            }
            .tm-reload-btn:hover {
                background: rgba(255, 255, 255, 0.25);
                color: #fff;
            }
            .tm-reload-btn:active {
                transform: scale(0.92);
            }
        `;
        document.head.appendChild(style);
    };

    /**
     * Создаёт кнопку ↻ для перезагрузки страницы и вставляет её в заголовок.
     * Автоматически инжектит стили при первом вызове.
     * @param {HTMLElement} header — элемент `.guild_header2`, в который добавляется кнопка.
     */
    const appendReloadBtn = (header) => {
        injectReloadBtnStyles();
        header.classList.add('tm-has-reload');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tm-reload-btn';
        btn.title = 'Обновить страницу';
        btn.innerHTML = '&#x21bb;';
        btn.addEventListener('click', () => location.reload());
        header.appendChild(btn);
    };

    // ==================== Компонент: серверные часы ====================

    let serverClockEl = null;
    let serverClockStylesInjected = false;

    const injectServerClockStyles = () => {
        if (serverClockStylesInjected) return;
        serverClockStylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .tm-server-clock {
                position: fixed;
                top: 50%;
                right: 12px;
                transform: translateY(-50%);
                z-index: 9999;
                padding: 6px 12px;
                border-radius: 6px;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                font-size: 13px;
                font-family: monospace;
                color: rgba(255, 255, 255, 0.85);
                max-width: 150px;
                white-space: nowrap;
                user-select: none;
                line-height: 1.4;
                text-decoration: none;
                display: block;
                cursor: pointer;
            }
            .tm-server-clock-event {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 5px;
            }
        `;
        document.head.appendChild(style);
    };

    /** Находит ближайшее видимое событие из таблицы «Расписание событий». */
    const getNextVisibleEventInfo = () => {
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

    const updateServerClockContent = () => {
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

    const initServerClock = async () => {
        await syncServerTime();
        injectServerClockStyles();
        serverClockEl = document.createElement('div');
        serverClockEl.className = 'tm-server-clock';
        serverClockEl.addEventListener('click', openEventsPopup);
        document.body.appendChild(serverClockEl);
        updateServerClockContent();
        setInterval(updateServerClockContent, 1000);
        setInterval(checkEventNotifications, 30000);
        checkEventNotifications();
    };

    /** Инжектит все стили для страницы марафона (itemIcon + marathon). */
    const injectStyles = () => {
        injectItemIconStyles();
        injectMarathonStyles();
    };

    // ==================== Подарки за уровни ====================

    // Загрузить состояние автозабора из localStorage
    const loadAutoClaimState = () => {
        try {
            return localStorage.getItem(LS_KEYS.AUTO_CLAIM) === 'true';
        } catch {
            return false;
        }
    };

    /** Сохранить состояние автозабора в localStorage. @param {boolean} enabled */
    const saveAutoClaimState = (enabled) => {
        try {
            localStorage.setItem(LS_KEYS.AUTO_CLAIM, enabled ? 'true' : 'false');
        } catch {
            // ignore
        }
    };

    // Определить целевой уровень из данных API
    const getTargetPrizeLevelFromApi = () => {
        const userInfo = API_INFO_CACHE?.data?.user_info;
        if (!userInfo) return 1;

        const currentLevel = userInfo.level || 1;
        const status = userInfo.status || 'trial';
        const farmedKey = status === 'premium' ? 'premium' : 'trial';
        const farmedRewards = userInfo.farmed_rewards?.[farmedKey] || [];

        // Преобразуем в Set чисел для быстрого поиска
        const farmedSet = new Set(farmedRewards.map(x => parseInt(x, 10)));

        // Ищем первый незабранный подарок (от 1 до currentLevel)
        for (let level = 1; level <= currentLevel; level++) {
            if (!farmedSet.has(level)) {
                return level; // Первый активный (незабранный)
            }
        }

        // Все забраны - показываем следующий уровень (первый disabled)
        return currentLevel + 1;
    };

    /**
     * Найти Vue-инстанс компонента Prizes (хранит current_page / per_on_page).
     * Корневой элемент Prizes — div.game__right.
     * @returns {Vue|null}
     */
    const getPrizesVm = () => {
        const el = pageDocument.querySelector('.game__right');
        return el?.__vue__ ?? null;
    };

    // Пролистать к первому нужному подарку, выставив current_page напрямую
    const scrollToFirstRelevantPrize = () => {
        const targetLevel = getTargetPrizeLevelFromApi();
        const vm = getPrizesVm();
        if (!vm) return;

        const perPage = vm.per_on_page || 10;
        vm.current_page = Math.floor((targetLevel - 1) / perPage);
    };

    // Забрать все доступные подарки через родной Vuex store (без кликов по DOM)
    const claimAllActivePrizes = async () => {
        await claimAllLevelRewards();
    };

    /** Получить Vuex store родного приложения. */
    const getVueStore = () => {
        const page = pageDocument.querySelector('.page');
        return page?.parentElement?.__vue__?.$store ?? null;
    };

    /**
     * Забирает подарок за уровень через родной Vuex store dispatch.
     * Это обновляет farmed_rewards в Vue-стейте и перерисовывает UI подарков.
     * @param {number} level
     * @param {boolean} isPremium
     * @returns {Promise<void>}
     */
    const farmLevelReward = (level, isPremium) => {
        const store = getVueStore();
        if (!store) return Promise.reject(new Error('Vue store not found'));

        return new Promise((resolve, reject) => {
            store.dispatch('maininfo/getLevelPrize', {
                level,
                is_premium: isPremium ? 1 : 0,
                callback_success: (data) => {
                    // Синхронизируем собственный кэш с обновлёнными данными
                    const userInfo = API_INFO_CACHE?.data?.user_info;
                    if (userInfo && data?.data?.farmed_rewards) {
                        userInfo.farmed_rewards = data.data.farmed_rewards;
                    }
                    resolve(data);
                },
                callback_error: () => {
                    reject(new Error(`getLevelPrize failed for level=${level}`));
                },
            });
        });
    };

    /**
     * Точечно обновляет farmed_rewards и баланс магазина в Vuex store.
     * Не трогает quests/action_info, чтобы не перерисовать блок заданий.
     * Принудительно пересоздаёт компоненты PrizesItem через смену ключа слайдера.
     */
    const syncNativeRewardsState = () => {
        const store = getVueStore();
        if (!store) return;
        const farmedRewards = API_INFO_CACHE?.data?.user_info?.farmed_rewards;
        if (farmedRewards) {
            // Deep copy — гарантируем новую ссылку для Vue 2 reactivity
            store.commit('maininfo/setUserRewards', JSON.parse(JSON.stringify(farmedRewards)));
        }
        // Обновляем баланс монет в магазине (подарки могут содержать валюту)
        store.dispatch('shop/getShopInfo');

        // Принудительно пересоздаём PrizesItem:
        // <transition :key="current_page"> уничтожает/создаёт компоненты при смене ключа
        const vm = getPrizesVm();
        if (vm) {
            const page = vm.current_page;
            vm.current_page = -1;
            vm.$nextTick(() => { vm.current_page = page; });
        }
    };

    /**
     * Забирает все доступные подарки за уровни через родной Vuex store.
     * После забора точечно обновляет farmed_rewards в нативном store,
     * чтобы UI подарков перерисовался без затрагивания блока заданий.
     */
    const claimAllLevelRewards = async () => {
        const userInfo = API_INFO_CACHE?.data?.user_info;
        if (!userInfo) return;
        if (!getVueStore()) return;

        const currentLevel = userInfo.level || 1;
        const status = userInfo.status || 'trial';
        const isPremium = status === 'premium';

        // Какие типы наград забирать
        const rewardTypes = isPremium ? ['trial', 'premium'] : ['trial'];

        let claimed = false;

        for (const type of rewardTypes) {
            const farmed = new Set((userInfo.farmed_rewards?.[type] || []).map(Number));

            for (let level = 1; level <= currentLevel; level++) {
                if (farmed.has(level)) continue;

                try {
                    await farmLevelReward(level, type === 'premium');
                    claimed = true;
                    await new Promise(r => setTimeout(r, CLAIM_DELAY_MS));
                } catch (e) {
                    console.warn(`[ArcheAgeExtraUI] claimLevelReward(${level}, ${type}) failed:`, e);
                }
            }
        }

        // Точечно обновляем farmed_rewards в нативном store
        if (claimed) {
            syncNativeRewardsState();
        }
    };

    // ==================== Автооткрытие сундуков ====================

    const loadAutoOpenBoxesState = () => {
        try {
            return localStorage.getItem(LS_KEYS.AUTO_OPEN_BOXES) === 'true';
        } catch {
            return false;
        }
    };

    const saveAutoOpenBoxesState = (enabled) => {
        try {
            localStorage.setItem(LS_KEYS.AUTO_OPEN_BOXES, String(enabled));
        } catch {
            // ignore
        }
    };

    /**
     * Получить Vue-инстанс компонента Lootbox.
     * @returns {Vue|null}
     */
    const getLootboxVm = () => {
        const el = pageDocument.querySelector('.lootbox');
        return el?.__vue__ ?? null;
    };

    const hasPremiumMarathonAccess = () => {
        if (API_INFO_CACHE?.data?.user_info?.status === 'premium') return true;

        const store = getVueStore();
        return store?.state?.maininfo?.user_info?.status === 'premium'
            || store?.state?.maininfo?.userInfo?.status === 'premium'
            || store?.state?.maininfo?.info?.user_info?.status === 'premium';
    };

    let autoOpenBoxesIntervalId = null;

    /**
     * Проверяет условия и открывает один сундук, если возможно.
     * Вызывается по интервалу.
     */
    const tryOpenNextBox = () => {
        if (!loadAutoOpenBoxesState()) return;

        const lootbox = getLootboxVm();
        if (!lootbox || typeof lootbox.openBox !== 'function') return;

        // Проверяем, что popup закрыт и не идёт открытие
        if (lootbox.is_show_popup || lootbox.is_button_pushed) return;

        // Проверяем, есть ли сундуки
        const boxesAvailable = lootbox.getChestNum;
        if (boxesAvailable <= 0 || !hasPremiumMarathonAccess()) return;

        console.log(`[ArcheAgeExtraUI] Автооткрытие сундука (осталось: ${boxesAvailable})`);
        lootbox.openBox();
    };

    const startAutoOpenBoxesInterval = () => {
        if (autoOpenBoxesIntervalId != null) return;
        autoOpenBoxesIntervalId = setInterval(tryOpenNextBox, 1000);
    };

    const stopAutoOpenBoxesInterval = () => {
        if (autoOpenBoxesIntervalId != null) {
            clearInterval(autoOpenBoxesIntervalId);
            autoOpenBoxesIntervalId = null;
        }
    };

    /**
     * Инициализация галочки "Открывать при получении" в блоке lootbox.
     */
    const initAutoOpenBoxesCheckbox = () => {
        const lootboxTitle = document.querySelector('.lootbox__title');
        if (!lootboxTitle) return;

        // Проверяем, что галочка ещё не добавлена
        if (lootboxTitle.querySelector('.tm-auto-open-label')) return;

        const label = document.createElement('label');
        label.className = 'tm-auto-open-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tm-auto-open-checkbox';
        checkbox.checked = loadAutoOpenBoxesState();

        const text = document.createTextNode('Открывать при получении');
        label.appendChild(checkbox);
        label.appendChild(text);

        lootboxTitle.appendChild(label);

        checkbox.addEventListener('change', () => {
            saveAutoOpenBoxesState(checkbox.checked);
            if (checkbox.checked) {
                startAutoOpenBoxesInterval();
            } else {
                stopAutoOpenBoxesInterval();
            }
        });

        // Запускаем интервал, если галочка уже включена
        if (checkbox.checked) {
            startAutoOpenBoxesInterval();
        }
    };

    // Инициализация галочки автозабора
    const initAutoClaimCheckbox = () => {
        const prizesTitle = document.querySelector('.prizes__title');
        if (!prizesTitle) return;

        // Проверяем, что галочка ещё не добавлена
        if (prizesTitle.querySelector('.tm-auto-claim-label')) return;

        const label = document.createElement('label');
        label.className = 'tm-auto-claim-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tm-auto-claim-checkbox';
        checkbox.checked = loadAutoClaimState();

        const text = document.createTextNode(' Забирать автоматически');
        label.appendChild(checkbox);
        label.appendChild(text);

        prizesTitle.appendChild(label);

        // Обработчик изменения
        checkbox.addEventListener('change', async () => {
            saveAutoClaimState(checkbox.checked);
            if (checkbox.checked) {
                await claimAllActivePrizes();
            }
        });

    };

    // Инициализация блока подарков
    const initPrizes = async () => {
        // Ждём появления блока подарков
        const prizesWrap = document.querySelector('.prizes__wrap');
        if (!prizesWrap) return;

        // Добавляем галочку автозабора
        initAutoClaimCheckbox();

        // Пролистываем к первому нужному подарку
        scrollToFirstRelevantPrize();

        // Автозабор при загрузке (кликаем по DOM, т.к. блок подарков уже отрендерен)
        if (loadAutoClaimState()) {
            await claimAllActivePrizes();
        }
    };

    // ==================== Инициализация ====================

    const init = async () => {
        injectStyles();
        debugLog('init marathon page', {
            path: location.pathname,
            hasTasksSection: !!document.querySelector('.section.tasks'),
            hasTasksHeader: !!document.querySelector('.section.tasks .tasks__header'),
            hasTasksList: !!document.querySelector('.section.tasks .tasks__list'),
        });

        try {
            await getApiInfoCached();
        } catch (e) {
            debugWarn('getApiInfoCached failed during init', e);
            return;
        }

        // Получаем UID текущего пользователя для per-user хранения истории
        try {
            cachedUid = await getUidFromCheckUser();
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] getUidFromCheckUser failed:', e);
        }

        // Инициализируем смещение серверного времени и запускаем countdown
        initServerTimeOffset();
        startCountdownInterval();

        ensureDateNavInHeader();

        try {
            await computeDateBoundsFromApiInfo();
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] computeDateBoundsFromApiInfo failed:', e);
        }

        // Применяем сегодняшний слот (резолвим 'auto' после вычисления границ)
        applySlot(selectedDayUtcMs || getTodayUtcMsByTZ(), 'auto');

        updateQuestHistory();

        try {
            await onSelectedDateChanged();
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] renderTasksForSelectedDay failed:', e);
        }

        requestAnimationFrame(() => {
            const el = document.querySelector('.section.tasks .tasks__header');
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 85;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        });

        resolveVekselUrl();

        // Инициализация блока подарков
        try {
            await initPrizes();
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] initPrizes failed:', e);
        }

        // Инициализация автооткрытия сундуков
        try {
            initAutoOpenBoxesCheckbox();
        } catch (e) {
            console.warn('[ArcheAgeExtraUI] initAutoOpenBoxesCheckbox failed:', e);
        }

        // Запускаем автообновление с нужным интервалом
        const initialInterval = document.hidden
            ? AUTO_REFRESH_INTERVAL_HIDDEN_MS
            : AUTO_REFRESH_INTERVAL_FOCUSED_MS;
        startAutoRefresh(initialInterval);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    };

    // ============================================================
    // ================== Общие UI-компоненты ===================
    // ============================================================

    /**
     * Создаёт стилизованный select в обёртке itemrestore__select_wrapper.
     * @param {{ options: Array<{value: string|number, label: string}>, selected: string|number, onChange: (value: string) => void }} opts
     * @returns {HTMLDivElement} обёртка с select внутри
     */
    const makeSelect = ({ options, selected, onChange }) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'itemrestore__select_wrapper';
        const select = document.createElement('select');
        select.className = 'itemrestore__filter-grades';
        for (const { value, label } of options) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if (String(value) === String(selected)) opt.selected = true;
            select.appendChild(opt);
        }
        select.addEventListener('change', () => onChange(select.value));
        wrapper.appendChild(select);
        return wrapper;
    };

    // ============================================================
    // ============= Общий блок выбранных предметов ==============
    // ============================================================

    /**
     * Рендерит список выбранных предметов в контейнер.
     * @param {HTMLElement} container - Контейнер для вставки элементов.
     * @param {Array<Object>} items - Массив выбранных предметов.
     * @param {Object} opts
     * @param {string} opts.emptyText - Текст-плейсхолдер, когда список пуст.
     * @param {(item: Object) => void} opts.onRemove - Обработчик удаления предмета.
     * @param {(item: Object) => { iconUrl: string, name: string, itemBase?: ItemBase, count?: number }} opts.mapItem - Маппер предмета в данные для отображения.
     */
    const renderSelectedItems = (container, items, { emptyText, onRemove, mapItem }) => {
        container.innerHTML = '';

        if (items.length === 0) {
            const p = document.createElement('div');
            p.className = 'tm-selected-items-help';
            p.textContent = emptyText;
            container.appendChild(p);
            return;
        }

        for (const item of items) {
            const mapped = mapItem(item);
            const entry = document.createElement('div');
            entry.className = 'tm-selected-item';

            const nameWrap = document.createElement('div');
            nameWrap.className = 'tm-cart-item-name';

            if (mapped.itemBase) {
                const icon = makeItemIconLink({
                    item: mapped.itemBase,
                    linked: true,
                    size: 'small',
                    count: mapped.count,
                });
                nameWrap.appendChild(icon);
            } else if (mapped.iconUrl) {
                const img = document.createElement('img');
                img.width = 24;
                img.height = 24;
                img.src = mapped.iconUrl;
                nameWrap.appendChild(img);
            }

            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = mapped.name || mapped.itemBase.name || '';
            nameWrap.appendChild(title);
            entry.appendChild(nameWrap);

            const delBtn = document.createElement('div');
            delBtn.className = 'del_btn';
            delBtn.addEventListener('click', () => onRemove(item));
            entry.appendChild(delBtn);

            container.appendChild(entry);
        }
    };

    // ============================================================
    // ===================== CART PAGE ============================
    // ============================================================

    /**
     * Нормализует название предмета из таблицы корзины.
     * @param {string} itemName
     * @returns {string}
     */
    const normalizeCartItemName = (itemName) => (
        (itemName || '').trim().replace(/\*$/, '').trim().toLowerCase().replace(/\bc\b/g, 'с').replace(/\s+/g, ' ')
    );

    /**
     * Пытается определить грейд предмета по названию из таблицы корзины.
     * @param {string} itemName
     * @returns {number|null}
     */
    const inferGradeFromCartItemName = (itemName) => {
        const normalized = normalizeCartItemName(itemName);
        if (!normalized) return null;

        for (let grade = GRADES.length - 1; grade >= 0; grade--) {
            const patterns = GRADES[grade].cartNamePatterns || [];
            if (patterns.some(pattern => pattern.test(normalized))) return grade;
        }

        return null;
    };

    const CART_GRADE_BY_CAMPAIGN = [
        {
            itemId: [
                45880, 45881, 45882, 45883, 45884, 45885, 45886, // эрнардский мнемоник
                45985, 45986, 45987, 45988, 45989, 45990, 45991, // смотритель тайных архивов
                45887, 45888, 45889, 45890, 47047, 47048, 47049, // заклинатель гримуаров
                47043, 47044, 47045, 47046, 45891, 45892, 45893, // укротитель гримуаров
                45894, 45895, 45896, 45897, 45898, 45899, 45900, // эрнардский архивариус
            ],
            campaign: 'Марафон героев, руру',
            grade: 12,
        },
        {
            itemId: [34684, 34685], // укрепленный аргенитовый кларнет/лютня
            campaign: 'Неверинский марафон героев',
            grade: 8,
        },
    ];

    /**
     * Пытается определить грейд предмета по названию акции в корзине.
     * @param {ItemBase} item
     * @param {string} campaign
     * @returns {number|null}
     */
    const inferGradeFromCartCampaign = (item, campaign) => {
        const normalizedCampaign = normalizeCartItemName(campaign);
        if (!normalizedCampaign) return null;

        const rule = CART_GRADE_BY_CAMPAIGN.find(entry => {
            if (!entry.itemId.includes(item.id)) return false;

            const normalizedRuleCampaign = normalizeCartItemName(entry.campaign);
            return normalizedRuleCampaign && normalizedCampaign.includes(normalizedRuleCampaign);
        });

        return rule?.grade ?? null;
    };

    /**
     * Убирает грейдовую часть из названия предмета корзины для поиска базового имени в ITEMS.
     * @param {string} itemName
     * @returns {string}
     */
    const stripGradeFromCartItemName = (itemName) => {
        let normalized = normalizeCartItemName(itemName);
        if (!normalized) return '';

        for (const grade of GRADES) {
            for (const pattern of grade.cartNamePatterns || []) {
                normalized = normalized.replace(pattern, '');
            }
        }

        return normalized.trim();
    };

    /**
     * Возвращает предмет с грейдом, выведенным из названия корзины, если в ITEMS грейд не задан.
     * @param {ItemBase} item
     * @param {string} itemName
     * @param {string} [campaign]
     * @returns {ItemBase}
     */
    const withInferredCartGrade = (item, itemName, campaign = '') => {
        if (item.grade != null) return item;

        const inferredGrade = inferGradeFromCartItemName(itemName) ?? inferGradeFromCartCampaign(item, campaign);
        return {
            ...item,
            grade: inferredGrade ?? 1,
            ...(inferredGrade == null ? {} : { isGradeInferred: true }),
        };
    };

    /**
     * Находит предмет в ITEMS по названию (name).
     * @param {string} itemName
     * @param {string} [campaign]
     * @returns {ItemBase|null}
     */
    const findItemByName = (itemName, campaign = '') => {
        const normalized = normalizeCartItemName(itemName);
        const normalizedWithoutGrade = stripGradeFromCartItemName(itemName);

        for (const item of Object.values(ITEMS)) {
            const name = normalizeCartItemName(item.name || '');
            if (name === normalized) return withInferredCartGrade(item, itemName, campaign);
        }

        for (const item of Object.values(ITEMS)) {
            const name = normalizeCartItemName(item.name || '');
            if (name === normalizedWithoutGrade) return withInferredCartGrade(item, itemName, campaign);
        }

        return null;
    };

    /**
     * @typedef {Object} CartItem
     * @property {string} title - Название предмета.
     * @property {number} count - Количество.
     * @property {Date} date - Дата получения.
     * @property {string} itemId - ID предмета (из data-item чекбокса).
     * @property {string} campaign - Название акции.
     * @property {boolean} disabled - Заблокирован (таймер передачи).
     * @property {string} timerText - Текст таймера ("Можно передать через: XXX мин.").
     */

    /**
     * @typedef {Object} CartCharacter
     * @property {string} name - Имя персонажа.
     * @property {string} server - Название сервера.
     * @property {string} value - Значение radio (для отправки формы).
     * @property {boolean} enabled - Доступен для выбора.
     */

    /**
     * Парсит строки таблицы корзины из DOM.
     * @param {Element} layout - Корневой элемент .cart_layout
     * @returns {CartItem[]}
     */
    const parseCartItems = (layout) => {
        const rows = layout.querySelectorAll('.js-cart-item');
        /** @type {CartItem[]} */
        const items = [];

        for (const row of rows) {
            const checkbox = row.querySelector('input[data-item]');
            if (!checkbox) continue;

            const nameCell = row.querySelector('.js-cart-item-name');
            const title = nameCell?.textContent?.trim() || '';

            const countCell = row.querySelector('td:last-child');
            const countText = (countCell?.textContent?.trim() || '1').replace(/[^\d]/g, '');
            const count = parseInt(countText, 10) || 1;

            const dateCell = row.querySelector('td:first-child');
            const dateStr = dateCell?.textContent?.trim() || '';
            const dp = dateStr.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})$/);
            const date = dp ? new Date(+dp[6], +dp[5] - 1, +dp[4], +dp[1], +dp[2], +dp[3]) : new Date(dateStr);

            const itemId = checkbox.getAttribute('data-item') || '';

            const campaignCell = row.querySelector('td:nth-child(3)');
            // Текст акции — всё до input; текст таймера — после input
            let campaign = '';
            let timerText = '';
            if (campaignCell) {
                for (const node of campaignCell.childNodes) {
                    if (node === checkbox) continue;
                    const t = (node.textContent || '').trim();
                    if (!t) continue;
                    if (t.startsWith('(') && t.includes('мин.')) {
                        timerText = t;
                    } else {
                        campaign = t;
                    }
                }
            }

            const disabled = row.classList.contains('js-disabled');

            items.push({ title, count, date, itemId, campaign, disabled, timerText });
        }

        return items;
    };

    /**
     * Парсит персонажей из DOM.
     * @param {Element} layout - Корневой элемент .cart_layout
     */
    const parseCartCharacters = (layout) => {
        const labels = layout.querySelectorAll('.char_select label');
        /** @type {CartCharacter[]} */
        const chars = [];

        for (const label of labels) {
            const radio = label.querySelector('input[name="shard_char"]');
            if (!radio) continue;

            const name = label.querySelector('.name')?.textContent?.trim() || '';
            const server = label.querySelector('.info')?.textContent?.trim() || '';
            const value = radio.value || '';
            const enabled = !radio.disabled;

            if (!enabled) continue; // Пропускаем "Нет персонажа"

            chars.push({ name, server, value, enabled });
        }

        return chars;
    };

    /**
     * Создаёт строку таблицы для предмета корзины.
     * @param {CartItem} cartItem
     */
    const makeCartRow = (cartItem) => {
        const tr = document.createElement('tr');
        tr.className = 'item';
        if (cartItem.disabled) tr.classList.add('disabled');

        // Ячейка: дата
        const tdDate = document.createElement('td');
        tdDate.className = 'gс_1';
        const d = cartItem.date;
        const pad = (n) => n < 10 ? '0' + n : '' + n;
        tdDate.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
        tr.appendChild(tdDate);

        // Ячейка: количество
        const tdCount = document.createElement('td');
        tdCount.className = 'gс_4';
        tdCount.textContent = cartItem.count > 1 ? `${cartItem.count}×` : '';
        tr.appendChild(tdCount);

        // Ячейка: иконка + название
        const tdName = document.createElement('td');
        tdName.className = 'gс_2';
        const nameContainer = document.createElement('div');
        nameContainer.className = 'tm-cart-item-name';

        const itemData = findItemByName(cartItem.title, cartItem.campaign);
        if (itemData) {
            const iconEl = makeItemIconLink({
                item: itemData,
                linked: true,
                size: 'small',
            });
            nameContainer.appendChild(iconEl);
        }

        nameContainer.appendChild(document.createTextNode(cartItem.title));
        tdName.appendChild(nameContainer);

        tr.appendChild(tdName);

        // Ячейка: акция
        const tdCampaign = document.createElement('td');
        tdCampaign.className = 'gс_3';
        tdCampaign.textContent = cartItem.campaign;
        if (cartItem.disabled && cartItem.timerText) {
            const timer = document.createElement('span');
            timer.className = 'tm-cart-timer';
            timer.textContent = cartItem.timerText;
            tdCampaign.appendChild(timer);
        }
        tr.appendChild(tdCampaign);

        return tr;
    };

    /**
     * Показывает модальное окно в стиле сайта.
     * @param {Object} params
     * @param {string} params.title
     * @param {string} params.body - HTML-содержимое.
     * @param {{ label: string, icon: string, action: function|null }[]} params.buttons
     */
    const showCartPopup = ({ title, body, buttons }) => {
        // Подготавливаем скрытый div-источник для popup_open
        let src = document.getElementById('tm_cart_popup_src');
        if (!src) {
            src = document.createElement('div');
            src.id = 'tm_cart_popup_src';
            src.style.display = 'none';
            document.body.appendChild(src);
        }

        src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map((btn, i) =>
            `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
        ).join('')}
                </div>
            </div>`;

        // Используем нативную функцию сайта
        popup_open(false, 'tm_cart_popup_src');

        // Навешиваем обработчики на кнопки внутри попапа
        const popupBlock = document.getElementById('popup_block');
        if (popupBlock) {
            popupBlock.querySelectorAll('a[data-tm-btn]').forEach(a => {
                const btn = buttons[parseInt(a.dataset.tmBtn)];
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    popup_close();
                    btn.action?.();
                });
            });
        }
    };

    /**
     * Строит и инжектит полный UI корзины, используя родные классы сайта.
     * @param {CartItem[]} cartItems
     * @param {CartCharacter[]} characters
     * @param {Element} container - #mr_block_cart
     * @param {Element} origLayout - оригинальный .cart_layout для извлечения разметки персонажей
     */
    const buildCartUI = (cartItems, characters, container, origLayout) => {
        container.innerHTML = '';

        const layout = document.createElement('div');
        layout.className = 'cart_layout';

        const form = document.createElement('form');
        form.id = 'cart_items_form';
        form.onsubmit = () => false;

        // === Состояние ===
        /** @type {Set<string>} */
        const selectedIds = new Set();
        let selectedChar = '';

        /** @type {Map<string, HTMLTableRowElement>} */
        const rowMap = new Map();

        // === Левая панель ===
        const left = document.createElement('div');
        left.className = 'cart_left';

        const leftHeader = document.createElement('div');
        leftHeader.className = 'guild_header2 blue';
        leftHeader.textContent = 'Список доступных предметов';
        appendReloadBtn(leftHeader);
        left.appendChild(leftHeader);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'guild_tab_wrapper';

        const table = document.createElement('table');
        table.className = 'guild_tab no_lines cart_items';
        table.cellSpacing = '0';
        table.cellPadding = '0';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const [cls, text] of [['gh_1', 'Дата получения'], ['gh_4', ''], ['gh_2', 'Предмет'], ['gh_3', 'Акция']]) {
            const th = document.createElement('th');
            th.className = cls;
            th.textContent = text;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        for (const cartItem of cartItems) {
            const tr = makeCartRow(cartItem);
            rowMap.set(cartItem.itemId, tr);
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        left.appendChild(tableWrapper);

        // === Правая панель ===
        const right = document.createElement('div');
        right.className = 'cart_right';

        // Выбранные предметы
        const selectedHeader = document.createElement('div');
        selectedHeader.className = 'guild_header2 blue';
        selectedHeader.textContent = 'Список выбранных предметов';
        right.appendChild(selectedHeader);

        const selectedOuter = document.createElement('div');
        selectedOuter.className = 'tm-selected-container';
        const selectedWrap = document.createElement('div');
        selectedWrap.className = 'tm-selected-list';
        selectedOuter.appendChild(selectedWrap);
        right.appendChild(selectedOuter);

        // Персонажи — берём оригинальный блок .char_select из ответа
        const charsHeader = document.createElement('div');
        charsHeader.className = 'guild_header2 blue';
        charsHeader.textContent = 'Выберите персонажа';
        right.appendChild(charsHeader);

        const origCharSelect = origLayout.querySelector('.char_select');
        if (origCharSelect) {
            right.appendChild(origCharSelect);

            // Навешиваем свой обработчик выбора
            origCharSelect.querySelectorAll('.js-char').forEach(label => {
                const radio = label.querySelector('input[name="shard_char"]');
                if (!radio || radio.disabled) return;

                label.addEventListener('click', () => {
                    selectedChar = radio.value;
                    radio.checked = true;
                    updateTransferBtn();
                });
            });

            // Подгружаем аватары персонажей из char_list
            (async () => {
                try {
                    const uid = await getUidFromCheckUser();
                    const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
                    const doc = new DOMParser().parseFromString(html, 'text/html');

                    /** @type {Map<string, string>} имя → URL лица */
                    const faceMap = new Map();
                    for (const li of doc.querySelectorAll('li[data-face]')) {
                        const name = li.querySelector('strong')?.textContent?.trim();
                        const face = li.getAttribute('data-face');
                        if (name && face) faceMap.set(name, face);
                    }

                    origCharSelect.querySelectorAll('label.js-char').forEach(label => {
                        const name = label.querySelector('.name')?.textContent?.trim();
                        const face = faceMap.get(name);
                        if (!face) return;

                        const iconDiv = label.querySelector('div');
                        if (!iconDiv) return;

                        const img = document.createElement('img');
                        img.className = 'tm-char-face';
                        img.addEventListener('load', () => {
                            img.classList.add('tm-char-face--loaded');
                            label.classList.add('tm-char-face-ready');
                        }, { once: true });
                        img.addEventListener('error', () => { img.classList.add('tm-char-face--error'); });
                        img.src = face;
                        iconDiv.appendChild(img);
                    });
                } catch {
                    // не критично — аватары просто не появятся
                }
            })();
        }

        // Кнопка "Передать"
        const transferBtn = document.createElement('span');
        transferBtn.className = 'guild_button1 ico_done';
        transferBtn.innerHTML = '<em></em>Передать';
        transferBtn.style.opacity = '0.5';
        transferBtn.style.pointerEvents = 'none';
        right.appendChild(document.createElement('br'));
        right.appendChild(transferBtn);

        form.appendChild(left);
        form.appendChild(right);

        const clear = document.createElement('div');
        clear.className = 'clear';
        form.appendChild(clear);

        layout.appendChild(form);
        container.appendChild(layout);

        // === Логика ===

        const updateTransferBtn = () => {
            const enabled = selectedIds.size > 0 && !!selectedChar;
            transferBtn.style.opacity = enabled ? '' : '0.5';
            transferBtn.style.pointerEvents = enabled ? '' : 'none';
        };

        const renderSelectedList = () => {
            const selectedArray = [...selectedIds].map(id => cartItems.find(i => i.itemId === id)).filter(Boolean);
            renderSelectedItems(selectedWrap, selectedArray, {
                emptyText: 'Выберите предметы для передачи из списка слева',
                onRemove: (cartItem) => deselectItem(cartItem.itemId),
                mapItem: (cartItem) => {
                    const itemData = findItemByName(cartItem.title, cartItem.campaign);
                    return {
                        iconUrl: '',
                        name: !itemData && cartItem.count > 1 ? `${cartItem.title} ${cartItem.count}×` : cartItem.title,
                        itemBase: itemData || undefined,
                        count: cartItem.count,
                    };
                },
            });
        };

        const selectItem = (id) => {
            selectedIds.add(id);
            const row = rowMap.get(id);
            if (row) row.classList.add('tm-selected');
            renderSelectedList();
            updateTransferBtn();
        };

        const deselectItem = (id) => {
            selectedIds.delete(id);
            const row = rowMap.get(id);
            if (row) row.classList.remove('tm-selected');
            renderSelectedList();
            updateTransferBtn();
        };

        // Клик по строке — выбрать предмет
        for (const cartItem of cartItems) {
            if (cartItem.disabled) continue;
            const row = rowMap.get(cartItem.itemId);
            if (!row) continue;

            row.addEventListener('click', (e) => {
                if (e.target.closest('a')) return;
                if (selectedIds.has(cartItem.itemId)) return;
                selectItem(cartItem.itemId);
            });
        }

        // Кнопка "Передать" — подтверждение + отправка
        transferBtn.addEventListener('click', () => {
            showCartPopup({
                title: 'Вы уверены?',
                body: '<p>Предметы будут переданы выбранному персонажу</p>',
                buttons: [
                    {
                        label: 'Передать',
                        icon: 'ico_done',
                        action: async () => {
                            const allIds = [...selectedIds];
                            const chunks = [];
                            for (let i = 0; i < allIds.length; i += 5) {
                                chunks.push(allIds.slice(i, i + 5));
                            }

                            const messages = [];
                            const transferred = [];

                            try {
                                for (const chunk of chunks) {
                                    const fd = new FormData();
                                    for (const id of chunk) {
                                        fd.append(`items[${id}]`, 'on');
                                    }
                                    fd.append('shard_char', selectedChar);

                                    const res = await fetch('/dynamic/cart/?a=item_process', {
                                        method: 'POST',
                                        body: fd,
                                    });
                                    const json = await res.json();

                                    if (json.result === 1) {
                                        transferred.push(...chunk);
                                        if (json.msg) messages.push(json.msg);
                                    } else {
                                        showCartPopup({
                                            title: 'Ошибка',
                                            body: `<p>${json.msg || 'Неизвестная ошибка'}</p>`,
                                            buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                        });
                                        break;
                                    }
                                }

                                for (const id of transferred) {
                                    const row = rowMap.get(id);
                                    if (row) row.remove();
                                    rowMap.delete(id);
                                    selectedIds.delete(id);
                                    const idx = cartItems.findIndex(i => i.itemId === id);
                                    if (idx !== -1) cartItems.splice(idx, 1);
                                }
                                renderSelectedList();
                                updateTransferBtn();

                                if (messages.length > 0) {
                                    const body = messages
                                        .flatMap(m => m.split('&nbsp;'))
                                        .filter(Boolean)
                                        .join('<br/>');
                                    showCartPopup({
                                        title: 'Результат передачи',
                                        body: `<p>${body}</p>`,
                                        buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                    });
                                }
                            } catch (e) {
                                showCartPopup({
                                    title: 'Ошибка',
                                    body: `<p>Не удалось выполнить запрос: ${e.message}</p>`,
                                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                });
                            }
                        },
                    },
                    { label: 'Отмена', icon: 'ico_cancel', action: null },
                ],
            });
        });

        renderSelectedList();
    };

    const initCart = () => {
        injectItemIconStyles();
        injectSelectedItemsStyles();
        injectCartStyles();

        const cartObserver = new MutationObserver((mutations, obs) => {
            const layout = document.querySelector('.cart_layout');
            if (!layout) return;

            obs.disconnect();

            const cartItems = parseCartItems(layout);
            cartItems.sort((a, b) => b.date - a.date);
            const characters = parseCartCharacters(layout);
            const container = document.getElementById('mr_block_cart');
            if (!container) return;

            buildCartUI(cartItems, characters, container, layout);
        });

        cartObserver.observe(document.body, { childList: true, subtree: true });
    };

    // ============================================================
    // =================== ITEMRESTORE PAGE ======================
    // ============================================================

    /**
     * @typedef {Object} IRItem
     * @property {string} world_id
     * @property {string} char_id - id персонажа
     * @property {string} name - Имя персонажа.
     * @property {string} itemid - ID удалённого экземпляра предмета.
     * @property {string} type - ID предмета (для ссылки на codex).
     * @property {string} grade - ID качества (строка, напр. "0").
     * @property {string} stack - Количество (строка, напр. "1").
     * @property {string} expire - Дата истечения (напр. "2026-02-11 18:29:47.0000000").
     * @property {string} reason - id причины
     * @property {string|null} slave_id
     * @property {string|null} npc_id
     * @property {string} deleted - Дата удаления (напр. "2026-01-12 18:29:47.0300000").
     * @property {string} nn
     * @property {string} gi_name - Название предмета.
     * @property {string} gi_description - Описание предмета.
     * @property {string} gi_filename
     * @property {string|null} gi_refund
     * @property {string} gg_id - ID качества (строка, напр. "0").
     * @property {string} color - Цвет названия (hex без #, напр. "BA976D").
     * @property {string} bind
     * @property {string} iconurl - URL иконки предмета.
     * @property {number} shard_id - Сервер персонажа.
     * @property {boolean} [selected] - Флаг выбора (добавляется фронтендом).
     */

    const IR_URL = {
        grades: '/dynamic/itemrestore/index.php?a=get_item_grades',
        info: '/dynamic/itemrestore/index.php?a=get_restore_info',
        items: '/dynamic/itemrestore/index.php?a=get_user_items',
        restore: '/dynamic/itemrestore/index.php?a=post_restore_items',
    };

    /**
     * Показывает модальное окно для страницы восстановления.
     * @param {Object} params
     * @param {string} params.title
     * @param {string} params.body
     * @param {{ label: string, icon: string, action: function|null }[]} params.buttons
     */
    const showItemRestorePopup = ({ title, body, buttons }) => {
        let src = document.getElementById('tm_ir_popup_src');
        if (!src) {
            src = document.createElement('div');
            src.id = 'tm_ir_popup_src';
            src.style.display = 'none';
            document.body.appendChild(src);
        }

        src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map((btn, i) =>
            `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
        ).join('')}
                </div>
            </div>`;

        popup_open(false, 'tm_ir_popup_src');

        const popupBlock = document.getElementById('popup_block');
        if (popupBlock) {
            popupBlock.querySelectorAll('a[data-tm-btn]').forEach(a => {
                const btn = buttons[parseInt(a.dataset.tmBtn)];
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    popup_close();
                    btn.action?.();
                });
            });
        }
    };

    /**
     * Строит UI страницы восстановления предметов.
     * @param {HTMLElement} container
     * @param {Array<{id: number, name: string}>} grades
     * @param {{lastRestored_at: number, restoreIsAvailable: number, restoredByeLastMonth: number}} info
     * @param {Array<Object>} items
     */
    const buildItemRestoreUI = (container, grades, info, items) => {
        // --- State ---
        const allItems = items.map(item => ({ ...item, selected: false }));
        const selectedItems = [];
        let restoredItems = info.restoredByeLastMonth || 0;
        const recoveryLimit = 10;
        const savedPerPage = parseInt(localStorage.getItem(LS_KEYS.IR_PER_PAGE));
        let itemsPerPage = [10, 20, 30].includes(savedPerPage) ? savedPerPage : savedPerPage === 0 ? 0 : 10;
        let filterGrade = -1;
        let findString = '';
        let activePage = 1;
        let sortAsc = false;

        // --- Helpers ---

        /**
         * Маппинг grade из API (строка) → индекс в GRADES.
         * API grade → название из grades API → ищем совпадение title в GRADES.
         * Если не нашли — используем числовое значение grade напрямую.
         * @param {string} apiGrade
         * @returns {number}
         */
        const mapGrade = (apiGrade) => {
            const gradeName = getGradeName(apiGrade);
            if (gradeName !== '-') {
                const idx = GRADES.findIndex(g => g.title === gradeName);
                if (idx !== -1) return idx;
            }
            return parseInt(apiGrade) || 0;
        };

        /**
         * Создаёт объект ItemBase для makeItemIconLink из IRItem.
         * @param {IRItem} item
         * @returns {ItemBase}
         */
        const toItemBase = (item) => {
            const known = ITEMS[item.type];
            const apiGrade = item.grade != null ? mapGrade(item.grade) : null;
            const inferredGrade = inferGradeFromCartItemName(item.gi_name || known?.name || '');
            const grade = known?.grade ?? apiGrade ?? inferredGrade ?? 1;
            const isGradeInferred = known?.grade == null && apiGrade == null && inferredGrade != null;
            return {
                id: String(item.type || ''),
                icon: item.iconurl || '',
                name: item.gi_name || '',
                description: item.gi_description || '',
                ...known,
                ...(item.iconurl ? { icon: item.iconurl } : {}),
                ...(item.gi_name ? { name: item.gi_name } : {}),
                ...(item.gi_description ? { description: item.gi_description } : {}),
                grade,
                ...(isGradeInferred ? { isGradeInferred: true } : {}),
            };
        };

        const addZero = (n) => n < 10 ? '0' + n : '' + n;

        const formatDate = (ts) => {
            const dt = new Date(ts);
            return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
        };

        const formatDateTime = (ts) => {
            const dt = new Date(ts);
            return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()} ${addZero(dt.getHours())}:${addZero(dt.getMinutes())}`;
        };

        const formatDateTimeFull = (ts) => {
            const dt = new Date(ts);
            return `${addZero(dt.getHours())}:${addZero(dt.getMinutes())}:${addZero(dt.getSeconds())} ${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
        };

        const getExpireTime = (dateStr) => {
            const expire = Date.parse(dateStr);
            const now = Date.now();
            const hoursAll = (expire - now) / (1000 * 60 * 60);
            const days = Math.floor(hoursAll / 24);
            const hours = Math.round(hoursAll - days * 24);
            return `${days} д. ${hours} ч.`;
        };

        const getGradeName = (id) => {
            const g = grades.find(v => String(v.id) === String(id));
            return g ? g.name : '-';
        };

        const getFilteredItems = () => {
            const filtered = allItems.filter(v => {
                const gradeOk = filterGrade === -1 || String(v.grade) === String(filterGrade);
                const nameOk = !findString || (v.gi_name && v.gi_name.toLowerCase().includes(findString.toLowerCase()));
                return gradeOk && nameOk;
            });
            const dir = sortAsc ? 1 : -1;
            filtered.sort((a, b) => dir * ((a.deleted || '') > (b.deleted || '') ? 1 : (a.deleted || '') < (b.deleted || '') ? -1 : 0));
            return filtered;
        };

        const getPageItems = () => {
            const filtered = getFilteredItems();
            if (!itemsPerPage) return filtered;
            const start = (activePage - 1) * itemsPerPage;
            const end = Math.min(start + itemsPerPage, filtered.length);
            return filtered.slice(start, end);
        };

        const getPagesCount = () => itemsPerPage ? Math.ceil(getFilteredItems().length / itemsPerPage) : 1;

        // --- Build DOM ---
        const section = document.createElement('section');

        // == Filter ==
        const filterDiv = document.createElement('div');
        filterDiv.className = 'itemrestore__filter';

        const gradeTitle = document.createElement('div');
        gradeTitle.className = 'itemrestore__filter-title';
        gradeTitle.textContent = 'Качество';
        filterDiv.appendChild(gradeTitle);

        const gradeOptions = [{ value: -1, label: 'Не выбрано' }, ...grades.map(g => ({ value: g.id, label: g.name }))];
        const gradeSelectWrapper = makeSelect({
            options: gradeOptions,
            selected: filterGrade,
            onChange: (val) => { filterGrade = parseInt(val); activePage = 1; renderTable(); },
        });
        filterDiv.appendChild(gradeSelectWrapper);

        const gradeReset = document.createElement('div');
        gradeReset.className = 'itemrestore__grades-reset';
        filterDiv.appendChild(gradeReset);

        const nameTitle = document.createElement('div');
        nameTitle.className = 'itemrestore__filter-title';
        nameTitle.textContent = 'Название';
        filterDiv.appendChild(nameTitle);

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'itemrestore__input-wrapper';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'itemrestore__filter-name';
        inputWrapper.appendChild(nameInput);
        filterDiv.appendChild(inputWrapper);

        const searchBtn = document.createElement('div');
        searchBtn.className = 'itemrestore__search-btn';
        const searchSpan = document.createElement('span');
        searchSpan.textContent = ' Искать';
        searchBtn.appendChild(searchSpan);
        filterDiv.appendChild(searchBtn);

        section.appendChild(filterDiv);

        // == Panels ==
        const panelWrapper = document.createElement('div');
        panelWrapper.className = 'itemrestore__panel-wrapper';
        const panel = document.createElement('div');
        panel.className = 'itemrestore__panel';

        // -- Left panel --
        const panelLeft = document.createElement('div');
        panelLeft.className = 'itemrestore__panel-left';

        const leftTitle = document.createElement('div');
        leftTitle.className = 'guild_header2 green';
        leftTitle.textContent = 'Удалённые предметы';
        appendReloadBtn(leftTitle);
        panelLeft.appendChild(leftTitle);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'itemrestore__table-wrapper';
        const table = document.createElement('table');
        table.className = 'itemrestore__table';
        table.cellSpacing = '0';
        table.cellPadding = '0';

        const headerRow = document.createElement('tr');
        headerRow.className = 'itemrestore__table-header';
        const headers = [
            { cls: 'n4', text: '' },
            { cls: 'n1', text: 'Наименование' },
            { cls: 'n5', text: 'До\u00a0удаления' },
            { cls: 'n6', text: 'Персонаж' },
        ];

        const thDate = document.createElement('th');
        thDate.className = 'n2 tm-sortable';
        const thDateText = document.createElement('span');
        thDateText.textContent = 'Удалён';
        const thDateArrow = document.createElement('span');
        thDateArrow.className = 'tm-sort-arrow';
        thDateArrow.textContent = sortAsc ? ' \u25B2' : ' \u25BC';
        thDate.appendChild(thDateText);
        thDate.appendChild(thDateArrow);
        thDate.addEventListener('click', () => {
            sortAsc = !sortAsc;
            thDateArrow.textContent = sortAsc ? ' \u25B2' : ' \u25BC';
            activePage = 1;
            renderTable();
        });
        headerRow.appendChild(thDate);

        for (const h of headers) {
            const th = document.createElement('th');
            if (h.cls) th.className = h.cls;
            th.textContent = h.text;
            headerRow.appendChild(th);
        }

        const tbody = document.createElement('tbody');
        tbody.appendChild(headerRow);
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        panelLeft.appendChild(tableWrapper);

        // Footer (pagination + per-page selector)
        const tableFooter = document.createElement('div');
        tableFooter.className = 'tm-table-footer';
        const pagination = document.createElement('div');
        pagination.className = 'itemrestore__pagintation';
        tableFooter.appendChild(pagination);
        const perPageWrap = makeSelect({
            options: [{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 30, label: '30' }, { value: 0, label: 'Все' }],
            selected: itemsPerPage,
            onChange: (val) => {
                itemsPerPage = parseInt(val);
                localStorage.setItem(LS_KEYS.IR_PER_PAGE, itemsPerPage);
                activePage = 1;
                renderTable();
            },
        });
        tableFooter.appendChild(perPageWrap);
        panelLeft.appendChild(tableFooter);

        panel.appendChild(panelLeft);

        // -- Right panel --
        const panelRight = document.createElement('div');
        panelRight.className = 'itemrestore__panel-right';

        const rightTitle = document.createElement('div');
        rightTitle.className = 'guild_header2 green';
        rightTitle.textContent = 'Список выбранных предметов';
        panelRight.appendChild(rightTitle);

        const selectedContainer = document.createElement('div');
        selectedContainer.className = 'tm-selected-container';
        const selectedList = document.createElement('div');
        selectedList.className = 'tm-selected-list';
        selectedContainer.appendChild(selectedList);
        panelRight.appendChild(selectedContainer);

        const restoreBtn = document.createElement('div');
        restoreBtn.className = 'itemrestore-recovery_btn';
        const restoreBtnSpan = document.createElement('span');
        restoreBtnSpan.textContent = 'Восстановить';
        restoreBtn.appendChild(restoreBtnSpan);
        panelRight.appendChild(restoreBtn);

        panel.appendChild(panelRight);
        panelWrapper.appendChild(panel);
        section.appendChild(panelWrapper);

        // == Info text ==
        const infoRestoredP = document.createElement('p');
        const infoDateP = document.createElement('p');
        section.appendChild(infoRestoredP);
        section.appendChild(infoDateP);

        const updateInfoText = () => {
            infoRestoredP.textContent = `За последний календарный месяц восстановлено предметов: ${restoredItems} из ${recoveryLimit} возможных.`;
            infoDateP.textContent = info.lastRestored_at
                ? `Последнее восстановление: ${formatDateTime(info.lastRestored_at * 1000)}`
                : '';
        };
        updateInfoText();

        container.appendChild(section);

        // --- Rendering ---
        const renderTable = () => {
            const pageItems = getPageItems();
            while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);

            for (const item of pageItems) {
                const tr = document.createElement('tr');
                if (item.selected) tr.className = 'selected';

                const tdDate = document.createElement('td');
                tdDate.className = 'n2';
                tdDate.textContent = item.deleted ? formatDateTimeFull(Date.parse(item.deleted)) : '';
                tr.appendChild(tdDate);

                const tdCount = document.createElement('td');
                tdCount.className = 'n4';
                tdCount.textContent = parseInt(item.stack) > 1 ? `${item.stack}×` : '';
                tr.appendChild(tdCount);

                const tdName = document.createElement('td');
                tdName.className = 'n1';
                const nameWrap = document.createElement('div');
                nameWrap.className = 'tm-cart-item-name';
                const itemBase = toItemBase(item);
                nameWrap.appendChild(makeItemIconLink({
                    item: itemBase,
                    linked: true,
                    size: 'small',
                }));
                const nameText = document.createElement('span');
                nameText.textContent = item.gi_name || itemBase.name || '';
                if (item.color) {
                    nameText.style.color = `#${item.color}`;
                }
                else if (itemBase.grade) {
                    nameText.style.color = GRADES[itemBase.grade].color;
                }
                nameWrap.appendChild(nameText);
                tdName.appendChild(nameWrap);
                tr.appendChild(tdName);

                const tdExpire = document.createElement('td');
                tdExpire.className = 'n5';
                tdExpire.textContent = item.expire ? getExpireTime(item.expire) : '';
                tr.appendChild(tdExpire);

                const tdChar = document.createElement('td');
                tdChar.className = 'n6';
                const serverName = SERVERS[item.shard_id] || '';
                tdChar.appendChild(document.createTextNode(item.name || ''));
                if (serverName) {
                    const serverSpan = document.createElement('span');
                    serverSpan.className = 'tm-server-name';
                    serverSpan.textContent = ` (${serverName})`;
                    tdChar.appendChild(serverSpan);
                }
                tr.appendChild(tdChar);

                tr.addEventListener('click', () => {
                    if (!item.selected) {
                        selectItem(item);
                    }
                });

                tbody.appendChild(tr);
            }

            renderPagination();
        };

        const renderPagination = () => {
            pagination.innerHTML = '';
            const pagesCount = getPagesCount();

            if (pagesCount > 1) {
                const makeNavButton = (className, label, title, isActive, onClick) => {
                    const btn = document.createElement('div');
                    btn.className = 'itemrestore__pagintation-btn ' + className + (isActive ? ' active' : '');
                    btn.textContent = label;
                    btn.title = title;
                    btn.addEventListener('click', onClick);
                    return btn;
                };

                const makeEllipsis = () => {
                    const ellipsis = document.createElement('div');
                    ellipsis.className = 'itemrestore__pagintation-ellipsis';
                    ellipsis.textContent = '...';
                    return ellipsis;
                };

                const btnFirst = document.createElement('div');
                btnFirst.className = 'itemrestore__pagintation-btn first' + (activePage > 1 ? ' active' : '');
                btnFirst.textContent = '«';
                btnFirst.title = 'Первая страница';
                btnFirst.addEventListener('click', () => { if (activePage > 1) { activePage = 1; renderTable(); } });
                pagination.appendChild(btnFirst);

                const btnPrev = document.createElement('div');
                btnPrev.className = 'itemrestore__pagintation-btn prev' + (activePage > 1 ? ' active' : '');
                btnPrev.textContent = '‹';
                btnPrev.title = 'Предыдущая страница';
                btnPrev.addEventListener('click', () => { if (activePage > 1) { activePage--; renderTable(); } });
                pagination.appendChild(btnPrev);

                const pagesDiv = document.createElement('div');
                pagesDiv.className = 'itemrestore__pagintation-pages';

                const maxVisiblePages = 9;
                let start = Math.max(1, activePage - 4);
                let end = Math.min(pagesCount, activePage + 4);

                if (end - start + 1 < maxVisiblePages) {
                    if (start === 1) {
                        end = Math.min(pagesCount, start + maxVisiblePages - 1);
                    } else if (end === pagesCount) {
                        start = Math.max(1, end - maxVisiblePages + 1);
                    }
                }

                if (start > 1) pagesDiv.appendChild(makeEllipsis());

                for (let i = start; i <= end; i++) {
                    const page = document.createElement('div');
                    page.className = 'itemrestore__pagintation-page' + (i === activePage ? ' active' : '');
                    page.textContent = i;
                    const pageNum = i;
                    page.addEventListener('click', () => { activePage = pageNum; renderTable(); });
                    pagesDiv.appendChild(page);
                }

                if (end < pagesCount) pagesDiv.appendChild(makeEllipsis());
                pagination.appendChild(pagesDiv);

                const btnNext = makeNavButton(
                    'next',
                    '›',
                    'Следующая страница',
                    activePage < pagesCount,
                    () => { if (activePage < pagesCount) { activePage++; renderTable(); } }
                );
                pagination.appendChild(btnNext);

                const btnLast = makeNavButton(
                    'last',
                    '»',
                    'Последняя страница',
                    activePage < pagesCount,
                    () => { if (activePage < pagesCount) { activePage = pagesCount; renderTable(); } }
                );
                pagination.appendChild(btnLast);
            }
        };


        const renderSelected = () => {
            renderSelectedItems(selectedList, selectedItems, {
                emptyText: 'Выберите предметы для восстановления из списка слева',
                onRemove: (item) => deselectItem(item),
                mapItem: (item) => ({
                    iconUrl: item.iconurl || '',
                    name: item.gi_name || '',
                    itemBase: toItemBase(item),
                }),
            });
            restoreBtn.classList.toggle('active', selectedItems.length > 0);
        };

        // --- Selection ---
        const selectItem = (item) => {
            if (item.selected) return;

            if (restoredItems >= recoveryLimit) {
                showItemRestorePopup({
                    title: 'Внимание',
                    body: '<p>Достигнут лимит восстановления предметов за текущий месяц.</p>',
                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                });
                return;
            }

            if (selectedItems.length + restoredItems >= recoveryLimit) {
                showItemRestorePopup({
                    title: 'Внимание',
                    body: '<p>Выбранное количество предметов превышает лимит восстановления.</p>',
                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                });
                return;
            }

            item.selected = true;
            selectedItems.push(item);
            renderTable();
            renderSelected();
        };

        const deselectItem = (item) => {
            if (!item.selected) return;
            item.selected = false;
            const idx = selectedItems.indexOf(item);
            if (idx !== -1) selectedItems.splice(idx, 1);
            renderTable();
            renderSelected();
        };

        // --- Restore ---
        const restoreItems = () => {
            if (selectedItems.length === 0) return;

            showItemRestorePopup({
                title: 'Восстановление предметов',
                body: `<p>Восстановить выбранные предметы (${selectedItems.length} шт.)?</p>`,
                buttons: [
                    {
                        label: 'Восстановить', icon: 'ico_done', action: async () => {
                            const ids = selectedItems.map(v => v.itemid);
                            try {
                                const res = await fetch(IR_URL.restore, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(ids),
                                });
                                const json = await res.json();

                                if (json && json.success) {
                                    let successCount = 0;
                                    const results = json.data || {};
                                    for (const [id, result] of Object.entries(results)) {
                                        if (result.status === 'ok') {
                                            const allIdx = allItems.findIndex(v => v.itemid == id);
                                            if (allIdx !== -1) allItems.splice(allIdx, 1);
                                            const selIdx = selectedItems.findIndex(v => v.itemid == id);
                                            if (selIdx !== -1) selectedItems.splice(selIdx, 1);
                                            if (allIdx !== -1 && selIdx !== -1) successCount++;
                                        }
                                    }
                                    restoredItems += successCount;
                                    activePage = 1;
                                    updateInfoText();
                                    renderTable();
                                    renderSelected();

                                    const resultLines = Object.entries(results).map(([id, r]) => {
                                        const item = items.find(v => v.itemid == id);
                                        const name = item ? item.gi_name : id;
                                        return `${name}: ${r.status === 'ok' ? 'восстановлен' : 'ошибка'}`;
                                    });
                                    showItemRestorePopup({
                                        title: 'Результат',
                                        body: `<p>${resultLines.join('<br>')}</p>`,
                                        buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                    });
                                } else if (json.error) {
                                    showItemRestorePopup({
                                        title: 'Ошибка',
                                        body: `<p>${json.error}</p>`,
                                        buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                    });
                                }
                            } catch (e) {
                                showItemRestorePopup({
                                    title: 'Ошибка',
                                    body: `<p>Ошибка сети: ${e.message}</p>`,
                                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                });
                            }
                        }
                    },
                    { label: 'Отмена', icon: '', action: null },
                ],
            });
        };

        // --- Events ---
        gradeReset.addEventListener('click', () => {
            if (filterGrade !== -1) activePage = 1;
            filterGrade = -1;
            gradeSelectWrapper.querySelector('select').value = '-1';
            renderTable();
        });

        searchBtn.addEventListener('click', () => {
            findString = nameInput.value.trim();
            activePage = 1;
            renderTable();
        });

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                findString = nameInput.value.trim();
                activePage = 1;
                renderTable();
            }
        });

        restoreBtn.addEventListener('click', restoreItems);

        // --- Initial render ---
        renderTable();
        renderSelected();
    };

    /** Инициализация страницы восстановления предметов. */
    /** Инжектит стили для страницы восстановления предметов. */
    const injectItemRestoreStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            #block_content {
                overflow: unset;
            }

            .itemrestore__panel-left {
                min-height: 615px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .itemrestore__table-wrapper {
                min-height: unset;
                margin-bottom: auto;
            }

            .itemrestore__panel-right {
                position: sticky;
                top: 0;
                align-self: flex-start;
            }

            .itemrestore__table tr:last-child td {
                border-bottom: 0;
            }

            .itemrestore__table .n2 {
                width: 0%;
            }

            .itemrestore__table .n4 {
                white-space: nowrap;
                width: 0%;
                text-align: right;
                min-width: 24px;
            }

            .itemrestore__table .n5,
            .itemrestore__table .n6 {
                width: 0%;
            }

            .tm-server-name {
                color: #999;
                font-size: 0.85em;
            }

            .tm-sortable {
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
            }

            .tm-table-footer {
                position: sticky;
                bottom: 0;
                background: #fff;
                padding: 10px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 12px;
                border: 1px solid #e1e1e1;
                border-radius: 8px;
            }

            .itemrestore__pagintation {
                margin: 0;
            }

            .itemrestore__pagintation,
            .itemrestore__pagintation-pages {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .itemrestore__pagintation-btn,
            .itemrestore__pagintation-page,
            .itemrestore__pagintation-ellipsis {
                min-width: 22px;
                height: 22px;
                line-height: 22px;
                text-align: center;
                user-select: none;
            }

            .itemrestore__pagintation-ellipsis {
                color: #777;
            }

        `;
        document.head.appendChild(style);
    };

    const initItemRestore = () => {
        injectItemIconStyles();
        injectSelectedItemsStyles();
        injectItemRestoreStyles();

        // Перехватываем fetch-ответы Vue-приложения
        const intercepted = { grades: null, info: null, items: null };
        let interceptedCount = 0;

        const origFetch = pageWindow.fetch.bind(pageWindow);
        pageWindow.fetch = async (...args) => {
            const res = await origFetch(...args);
            const urlStr = typeof args[0] === 'string' ? args[0] : String(args[0]?.url || args[0]);
            const path = urlStr.split('?')[0] + '?' + (urlStr.split('?')[1] || '');

            if (urlStr.includes('a=get_item_grades')) {
                intercepted.grades = await res.clone().json();
                interceptedCount++;
            } else if (urlStr.includes('a=get_restore_info')) {
                intercepted.info = await res.clone().json();
                interceptedCount++;
            } else if (urlStr.includes('a=get_user_items')) {
                intercepted.items = await res.clone().json();
                interceptedCount++;
            }

            if (interceptedCount === 3) {
                interceptedCount = -1; // prevent re-entry
                tryBuild();
            }

            return res;
        };

        const tryBuild = () => {
            const app = document.getElementById('app_itemrestore');
            if (!app) return;

            const grades = intercepted.grades?.data || [];
            const info = intercepted.info?.data || {};
            const items = [];
            if (intercepted.items?.data) {
                Object.values(intercepted.items.data).forEach(server =>
                    Object.values(server).forEach(item => items.push(item))
                );
            }

            app.className = '';
            app.innerHTML = '';
            buildItemRestoreUI(app, grades, info, items);
        };
    };

    // ============================================================
    // ====================== EVENTS POPUP ========================
    // ============================================================

    const CODEX_QUEST_BASE = 'https://archeagecodex.com/ru/quest/';

    // --- Event visibility (localStorage) ---

    const loadEventVisibility = () => {
        try {
            return JSON.parse(localStorage.getItem(LS_KEYS.EVENT_VISIBILITY)) || {};
        } catch {
            return {};
        }
    };

    const saveEventVisibility = (overrides) => {
        try {
            localStorage.setItem(LS_KEYS.EVENT_VISIBILITY, JSON.stringify(overrides));
        } catch { /* ignore */ }
    };

    const isEventVisible = (ev, overrides) => {
        if (ev.code in overrides) return overrides[ev.code];
        return !!ev.defaultVisible;
    };

    // --- Styles ---

    let eventsPopupStylesInjected = false;

    const injectEventsPopupStyles = () => {
        if (eventsPopupStylesInjected) return;
        eventsPopupStylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .tm-popup-overlay {
                position: fixed;
                inset: 0;
                z-index: 10001;
                background: rgba(0,0,0,0.45);
                color: #2D364E;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .tm-popup-panel {
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                font: 14px/1.5 Cambria, Georgia, "Times New Roman", Times, serif;
            }
            .tm-popup-panel--events {
                width: 1000px;
                max-width: 95vw;
            }
            .tm-popup-panel--settings {
                width: 380px;
                max-width: 90vw;
            }
            .tm-popup-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #ddd;
                gap: 8px;
                flex-shrink: 0;
            }
            .tm-popup-title {
                flex: 1;
                font-size: 18px;
                font-weight: bold;
                margin: 0;
            }
            .tm-popup-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 20px;
                padding: 2px 6px;
                border-radius: 4px;
                color: #555;
                line-height: 1;
            }
            .tm-popup-btn:hover {
                background: #eee;
                color: #000;
            }
            .tm-popup-body {
                overflow-y: auto;
                padding: 0;
                flex: 1;
            }
            .tm-popup-body--settings {
                padding: 12px 16px;
            }
            .tm-settings-section {
                margin-bottom: 14px;
            }
            .tm-settings-section:last-child {
                margin-bottom: 0;
            }
            .tm-settings-section-title {
                font-weight: bold;
                margin-bottom: 8px;
            }
            .tm-settings-server-select {
                width: 100%;
                box-sizing: border-box;
                padding: 5px 6px;
                border: 1px solid #bbb;
                border-radius: 4px;
                background: #fff;
                color: #2D364E;
                font: inherit;
            }
            /* Events table */
            .tm-events-table {
                width: 100%;
                border-collapse: collapse;
            }
            .tm-events-table th {
                background: #3d2a5a;
                color: #fff;
                padding: 8px 12px;
                text-align: left;
                font-weight: normal;
                position: sticky;
                top: 0;
                z-index: 1;
                border-bottom: none;
            }
            .tm-events-table td {
                padding: 6px 12px;
                border-bottom: 1px solid #ddd;
                vertical-align: top;
            }
            .tm-events-table tr:nth-child(even) td {
                background: #f5f5f5;
            }
            .tm-events-table tr.tm-event-active td {
                background: #d4edda;
            }
            .tm-events-table tr.tm-event-beyond td {
                opacity: 0.6;
            }
            .tm-events-table .tm-event-time {
                white-space: nowrap;
                font-family: monospace;
                font-size: 13px;
            }
            .tm-event-time details {
                cursor: pointer;
            }
            .tm-event-time summary {
                display: list-item;
            }
            .tm-event-time summary::marker {
                font-size: 10px;
            }
            .tm-event-time .tm-schedule-detail {
                margin-top: 4px;
                padding-left: 18px;
                font-size: 12px;
                color: #555;
                white-space: normal;
            }
            .tm-event-time--active summary {
                color: #155724;
                font-weight: bold;
            }
            .tm-event-time--waiting summary {
                color: #856404;
            }
            .tm-events-table a {
                color: #2a6496;
                text-decoration: none;
            }
            .tm-events-table a:hover {
                text-decoration: underline;
            }
            /* Settings checkboxes */
            .tm-ev-settings-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .tm-ev-settings-list li {
                padding: 4px 0;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .tm-ev-settings-list label {
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            .tm-ev-settings-list input[type="checkbox"] {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }
            .tm-popup-btn--bell { font-size: 16px; }
            .tm-popup-btn--bell-off { opacity: 0.4; }
            .tm-ev-bell {
                cursor: pointer;
                font-size: 14px;
                padding: 0 4px;
                user-select: none;
                border: none;
                background: none;
                vertical-align: middle;
            }
            .tm-ev-bell--off { opacity: 0.25; }
        `;
        document.head.appendChild(style);
    };

    // --- Popup logic ---

    let eventsOverlay = null;
    let eventsInterval = null;
    let settingsOverlay = null;
    let evVisOverrides = null;

    const closeSettingsPopup = () => {
        if (settingsOverlay) {
            settingsOverlay.remove();
            settingsOverlay = null;
        }
    };

    const closeEventsPopup = () => {
        closeSettingsPopup();
        if (eventsInterval) {
            clearInterval(eventsInterval);
            eventsInterval = null;
        }
        if (eventsOverlay) {
            eventsOverlay.remove();
            eventsOverlay = null;
        }
    };

    const openSettingsPopup = (onChanged) => {
        if (settingsOverlay) { closeSettingsPopup(); return; }

        settingsOverlay = document.createElement('div');
        settingsOverlay.className = 'tm-popup-overlay';
        settingsOverlay.style.zIndex = '10002';
        settingsOverlay.addEventListener('mousedown', (e) => {
            if (e.target === settingsOverlay) closeSettingsPopup();
        });

        const panel = document.createElement('div');
        panel.className = 'tm-popup-panel tm-popup-panel--settings';
        panel.addEventListener('mousedown', (e) => e.stopPropagation());

        // Header
        const header = document.createElement('div');
        header.className = 'tm-popup-header';
        const title = document.createElement('div');
        title.className = 'tm-popup-title';
        title.textContent = 'Настройки';
        header.appendChild(title);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tm-popup-btn';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', closeSettingsPopup);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'tm-popup-body tm-popup-body--settings';

        const serverSection = document.createElement('div');
        serverSection.className = 'tm-settings-section';

        const serverTitle = document.createElement('div');
        serverTitle.className = 'tm-settings-section-title';
        serverTitle.textContent = 'Основной сервер';
        serverSection.appendChild(serverTitle);

        const serverSelect = document.createElement('select');
        serverSelect.className = 'tm-settings-server-select';

        const autoOption = document.createElement('option');
        autoOption.value = '';
        autoOption.dataset.vekselServerAutoOption = '1';
        autoOption.textContent = getVekselAutoOptionText();
        serverSelect.appendChild(autoOption);

        Object.entries(SERVERS)
            .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
            .forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                serverSelect.appendChild(option);
            });

        serverSelect.value = loadVekselServerIdOverride();
        serverSelect.addEventListener('change', () => {
            saveVekselServerIdOverride(serverSelect.value);
            resolveVekselUrl();
        });
        serverSection.appendChild(serverSelect);
        body.appendChild(serverSection);

        const sexSection = document.createElement('div');
        sexSection.className = 'tm-settings-section';

        const sexTitle = document.createElement('div');
        sexTitle.className = 'tm-settings-section-title';
        sexTitle.textContent = 'Пол';
        sexSection.appendChild(sexTitle);

        const sexSelect = document.createElement('select');
        sexSelect.className = 'tm-settings-server-select';

        Object.entries(ICON_SEX_VALUES).forEach(([value, info]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = info.title;
            sexSelect.appendChild(option);
        });

        sexSelect.value = loadIconSex();
        sexSelect.addEventListener('change', () => {
            saveIconSex(sexSelect.value);
            updateRenderedItemIcons();
            onChanged();
        });
        sexSection.appendChild(sexSelect);
        body.appendChild(sexSection);

        const eventsSection = document.createElement('div');
        eventsSection.className = 'tm-settings-section';

        const eventsTitle = document.createElement('div');
        eventsTitle.className = 'tm-settings-section-title';
        eventsTitle.textContent = 'Отображаемые события';
        eventsSection.appendChild(eventsTitle);

        const ul = document.createElement('ul');
        ul.className = 'tm-ev-settings-list';

        const notifState = loadNotificationState();

        for (const ev of EVENTS) {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = isEventVisible(ev, evVisOverrides);
            cb.addEventListener('change', () => {
                if (cb.checked === !!ev.defaultVisible) {
                    delete evVisOverrides[ev.code];
                } else {
                    evVisOverrides[ev.code] = cb.checked;
                }
                saveEventVisibility(evVisOverrides);
                onChanged();
            });
            const span = document.createElement('span');
            span.textContent = ev.title;
            label.appendChild(cb);
            label.appendChild(span);
            li.appendChild(label);

            // Колокольчик уведомления
            const bell = document.createElement('button');
            const bellOn = ev.code in notifState.events ? notifState.events[ev.code] : !!ev.defaultNotifications;
            bell.className = 'tm-ev-bell' + (bellOn ? '' : ' tm-ev-bell--off');
            bell.textContent = '\u{1F514}';
            bell.title = 'Уведомление за 5 мин';
            bell.addEventListener('click', () => {
                if (typeof Notification === 'undefined') {
                    alert('Ваш браузер не поддерживает уведомления.');
                    return;
                }
                const toggle = () => {
                    const s = loadNotificationState();
                    const wasOn = ev.code in s.events ? s.events[ev.code] : !!ev.defaultNotifications;
                    const nowOn = !wasOn;
                    if (nowOn === !!ev.defaultNotifications) {
                        delete s.events[ev.code];
                    } else {
                        s.events[ev.code] = nowOn;
                    }
                    if (nowOn) s.enabled = true;
                    saveNotificationState(s);
                    bell.classList.toggle('tm-ev-bell--off', !nowOn);
                    const globalBell = document.querySelector('.tm-popup-btn--bell');
                    if (globalBell) globalBell.classList.toggle('tm-popup-btn--bell-off', !s.enabled);
                };
                if (Notification.permission === 'default') {
                    Notification.requestPermission().then((perm) => {
                        if (perm === 'granted') toggle();
                        else alert('Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.');
                    });
                    return;
                }
                if (Notification.permission === 'denied') {
                    alert('Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.');
                    return;
                }
                toggle();
            });
            li.appendChild(bell);

            ul.appendChild(li);
        }

        eventsSection.appendChild(ul);
        body.appendChild(eventsSection);
        panel.appendChild(body);
        settingsOverlay.appendChild(panel);
        document.body.appendChild(settingsOverlay);
    };

    const openEventsPopup = () => {
        if (eventsOverlay) { closeEventsPopup(); return; }

        injectEventsPopupStyles();
        evVisOverrides = loadEventVisibility();

        eventsOverlay = document.createElement('div');
        eventsOverlay.className = 'tm-popup-overlay';
        eventsOverlay.addEventListener('mousedown', (e) => {
            if (e.target === eventsOverlay) closeEventsPopup();
        });

        const panel = document.createElement('div');
        panel.className = 'tm-popup-panel tm-popup-panel--events';
        panel.addEventListener('mousedown', (e) => e.stopPropagation());

        // Header
        const header = document.createElement('div');
        header.className = 'tm-popup-header';
        const title = document.createElement('div');
        title.className = 'tm-popup-title';
        title.textContent = 'Расписание событий';
        header.appendChild(title);

        const gearBtn = document.createElement('button');
        gearBtn.className = 'tm-popup-btn';
        gearBtn.textContent = '\u2699';
        gearBtn.title = 'Настройки отображения';
        gearBtn.addEventListener('click', () => openSettingsPopup(renderTable));
        header.appendChild(gearBtn);

        const bellBtn = document.createElement('button');
        bellBtn.className = 'tm-popup-btn tm-popup-btn--bell';
        bellBtn.textContent = '\u{1F514}';
        bellBtn.title = 'Уведомления за 5 минут до событий';
        const updateBellStyle = () => {
            const s = loadNotificationState();
            bellBtn.classList.toggle('tm-popup-btn--bell-off', !s.enabled);
        };
        updateBellStyle();
        bellBtn.addEventListener('click', async () => {
            if (typeof Notification === 'undefined') {
                alert('Ваш браузер не поддерживает уведомления.');
                return;
            }
            if (Notification.permission === 'default') {
                await Notification.requestPermission();
            }
            if (Notification.permission === 'denied') {
                alert('Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.');
                return;
            }
            const state = loadNotificationState();
            state.enabled = !state.enabled;
            saveNotificationState(state);
            updateBellStyle();
        });
        header.appendChild(bellBtn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tm-popup-btn';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', closeEventsPopup);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'tm-popup-body';

        const table = document.createElement('table');
        table.className = 'tm-events-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const col of ['Время', 'Название', 'Локации']) {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        body.appendChild(table);
        panel.appendChild(body);
        eventsOverlay.appendChild(panel);
        document.body.appendChild(eventsOverlay);

        const DAY_SEC = 86400;

        /** Ключи раскрытых <details> — сохраняются между перерисовками */
        const openDetails = new Set();

        /**
         * Собирает все ближайшие вхождения видимых событий.
         * @returns {{ ev: EventEntry, evCode: string, label: string, secondsUntil: number, isActive: boolean, isBeyond: boolean }[]}
         */
        const collectOccurrences = () => {
            const serverNow = getServerNowMs();
            const nowWd = getMSKWeekday(serverNow);
            const nowSec = getMSKTimeOfDaySeconds(serverNow);

            const within = [];
            const beyond = [];

            for (const ev of EVENTS) {
                if (!isEventVisible(ev, evVisOverrides)) continue;
                let hasWithin = false;
                let nearest = null;

                for (const entry of ev.schedule) {
                    const { hours, minutes } = parseTime(entry.timeStart);
                    const startSec = hours * 3600 + minutes * 60;
                    const timeStr = entry.timeEnd ? `${entry.timeStart}\u2013${entry.timeEnd}` : entry.timeStart;

                    // Проверка: событие идёт прямо сейчас
                    if (entry.timeEnd) {
                        const end = parseTime(entry.timeEnd);
                        const endSec = end.hours * 3600 + end.minutes * 60;
                        const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
                        if (isToday && nowSec >= startSec && nowSec < endSec) {
                            within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: -(endSec - nowSec), isActive: true, isBeyond: false });
                            hasWithin = true;
                            continue;
                        }
                    } else {
                        // Без timeEnd — подсвечиваем duration минут после старта (по умолчанию 5)
                        const activeDur = (entry.duration ?? 5) * 60;
                        const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
                        if (isToday && nowSec >= startSec && nowSec < startSec + activeDur) {
                            within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: 0, isActive: true, isBeyond: false });
                            hasWithin = true;
                            continue;
                        }
                    }

                    if (!entry.weekdays?.length) {
                        let diff = startSec - nowSec;
                        if (diff <= 0) diff += DAY_SEC;
                        within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: diff, isActive: false, isBeyond: false });
                        hasWithin = true;
                    } else {
                        let minDiff = Infinity;
                        for (const wd of entry.weekdays) {
                            let d = wd - nowWd;
                            if (d < 0) d += 7;
                            let diff = d * DAY_SEC + (startSec - nowSec);
                            if (diff <= 0) diff += 7 * DAY_SEC;
                            if (diff < minDiff) minDiff = diff;
                        }
                        const dayName = WEEKDAY_NAMES[getMSKWeekday(serverNow + minDiff * 1000)];
                        const fullLabel = `${dayName} ${timeStr}`;

                        if (minDiff <= DAY_SEC) {
                            within.push({ ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: false });
                            hasWithin = true;
                        } else if (!nearest || minDiff < nearest.secondsUntil) {
                            nearest = { ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: true };
                        }
                    }
                }

                if (!hasWithin && nearest) {
                    beyond.push(nearest);
                }
            }

            within.sort((a, b) => {
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                if (a.isActive && b.isActive) return b.secondsUntil - a.secondsUntil;
                return a.secondsUntil - b.secondsUntil;
            });
            beyond.sort((a, b) => a.secondsUntil - b.secondsUntil);

            return [...within, ...beyond];
        };

        /** Формирует строки расписания для раскрывающегося списка */
        const buildScheduleLines = (schedule) => {
            const lines = [];
            for (const entry of schedule) {
                const time = entry.timeEnd ? `${entry.timeStart}\u2013${entry.timeEnd}` : entry.timeStart;
                if (entry.weekdays?.length) {
                    const days = entry.weekdays.map(d => WEEKDAY_NAMES[d]).join(', ');
                    lines.push(`${days} ${time}`);
                } else {
                    lines.push(time);
                }
            }
            return lines;
        };

        const summaryText = (occ) => {
            if (occ.isActive && occ.secondsUntil < 0) {
                return `${occ.label} \u2014 ещё ${formatCountdown(-occ.secondsUntil)}`;
            } else if (occ.isActive) {
                return occ.label;
            } else {
                return `${occ.label} \u2014 через ${formatCountdown(occ.secondsUntil)}`;
            }
        };

        const structureKey = (occs) => occs.map(o =>
            `${o.evCode}:${o.label}:${o.isActive}:${o.isBeyond}`
        ).join('|');

        let lastKey = '';
        let summaryEls = [];

        const renderTable = () => {
            const occs = collectOccurrences();
            lastKey = structureKey(occs);
            summaryEls = [];
            const frag = document.createDocumentFragment();

            for (const occ of occs) {
                const key = `${occ.evCode}:${occ.label}`;
                const tr = document.createElement('tr');
                if (occ.isActive) tr.classList.add('tm-event-active');
                if (occ.isBeyond) tr.classList.add('tm-event-beyond');

                // Время
                const timeTd = document.createElement('td');
                timeTd.className = 'tm-event-time';
                if (occ.isActive) timeTd.classList.add('tm-event-time--active');
                else timeTd.classList.add('tm-event-time--waiting');

                const details = document.createElement('details');
                if (openDetails.has(key)) details.open = true;
                details.addEventListener('toggle', () => {
                    if (details.open) openDetails.add(key);
                    else openDetails.delete(key);
                });

                const summary = document.createElement('summary');
                summary.textContent = summaryText(occ);
                details.appendChild(summary);
                summaryEls.push(summary);

                const schedDiv = document.createElement('div');
                schedDiv.className = 'tm-schedule-detail';
                for (const line of buildScheduleLines(occ.ev.schedule)) {
                    const div = document.createElement('div');
                    div.textContent = line;
                    schedDiv.appendChild(div);
                }
                details.appendChild(schedDiv);

                timeTd.appendChild(details);
                tr.appendChild(timeTd);

                // Название
                const nameTd = document.createElement('td');
                nameTd.textContent = occ.ev.title || '\u2014';
                if (occ.ev.quests?.length) {
                    for (const q of occ.ev.quests) {
                        const a = document.createElement('a');
                        a.href = CODEX_QUEST_BASE + q.id + '/';
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.textContent = ` (#${q.id})`;
                        nameTd.appendChild(a);
                    }
                }
                tr.appendChild(nameTd);

                // Локации
                const locTd = document.createElement('td');
                locTd.textContent = (occ.ev.locations || []).join(', ');
                tr.appendChild(locTd);

                frag.appendChild(tr);
            }

            tbody.textContent = '';
            tbody.appendChild(frag);
        };

        const tickTable = () => {
            const occs = collectOccurrences();
            const key = structureKey(occs);

            if (key !== lastKey) {
                renderTable();
                return;
            }

            for (let i = 0; i < occs.length; i++) {
                summaryEls[i].textContent = summaryText(occs[i]);
            }
        };

        renderTable();
        eventsInterval = setInterval(tickTable, 1000);
    };

    // ============================================================
    // ===================== INITIALIZATION =======================
    // ============================================================

    // Серверные часы на всех страницах archeage.ru
    initServerClock();

    if (isCartPage) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCart);
        } else {
            initCart();
        }
    } else if (isItemRestorePage) {
        initItemRestore();
    } else if (location.pathname.startsWith('/promo/marathon')) {
        // Marathon page
        const observer = new MutationObserver(() => {
            if (document.querySelector('.section.tasks')) {
                observer.disconnect();
                init();
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

})();
