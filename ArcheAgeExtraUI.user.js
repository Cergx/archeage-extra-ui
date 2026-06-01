// ==UserScript==
// @name         ArcheAgeExtraUI
// @namespace    https://archeage.ru/
// @version      4.4.1
// @description  Доработка страниц марафона, корзины и восстановления предметов
// @author       Cergx
// @match        *://archeage.ru/*
// @match        *://gisaa.ru/veksel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const isGisaaSite = location.hostname.includes('gisaa.ru');
    const isArcheageSite = location.hostname.includes('archeage.ru');
    const isCartPage = isArcheageSite && (location.pathname === '/cart' || location.pathname === '/cart/');
    const isItemRestorePage = isArcheageSite && (location.pathname === '/itemrestore' || location.pathname === '/itemrestore/');
    const isEventsPage = isArcheageSite && (location.pathname === '/a' || location.pathname === '/a/');

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
                        const maxText = maxCell.textContent.trim();
                        const maxVal = parseInt(maxText, 10);
                        if (isNaN(maxVal) || maxText.includes('?')) {
                            // В таблице неизвестное значение - жёлтым
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_UNKNOWN_CLASS));
                        } else if (maxVal === amount) {
                            // Подходит - зелёным
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_MATCH_CLASS));
                        } else {
                            // Не подходит - красным
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_EXCLUDE_CLASS));
                        }
                    }
                }
            }
        };

        /**
         * Подсвечивает только запрошенные локации в таблице Север: зелёным подходящие, красным неподходящие, жёлтым если в таблице ?.
         * @param {string[]} locations
         * @param {number} amount - количество ресурсов
         * @param {'archive'|'sack'} iconType
         */
        const highlightNorthRow = (locations, amount, iconType) => {
            const block = document.querySelector('#table-block-north');
            if (!block) return;
            if (!locations || locations.length === 0) return;

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

                const maxText = maxCell.textContent.trim();

                // Сначала проверяем на неизвестное значение
                if (maxText.includes('?')) {
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_UNKNOWN_CLASS));
                    continue;
                }

                // Проверяем, подходит ли по amount и iconType
                let isFullMatch = false;
                const maxHasIcon = iconType === 'archive'
                    ? maxCell.querySelector('.fa-archive')
                    : maxCell.querySelector('.fa-sack');
                if (maxHasIcon) {
                    const maxMatch = maxText.match(/^(\d+)/);
                    if (maxMatch) {
                        const maxAmount = parseInt(maxMatch[1], 10);
                        if (maxAmount === amount) {
                            isFullMatch = true;
                        }
                    }
                }

                if (isFullMatch) {
                    // Полностью подходит - зелёным
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_MATCH_CLASS));
                } else {
                    // Локация та, но amount/type не тот - красным
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_EXCLUDE_CLASS));
                    row.querySelectorAll('.btn_vote').forEach(btn => btn.classList.add(GISAA_EXCLUDE_CLASS));
                }
            }
        };

        const applyHighlightsFromUrl = () => {
            const params = new URLSearchParams(location.search);

            // Западные/восточные ресурсы: ?res=Слиток железа&amount=60
            const res = params.get('res');
            const amount = parseInt(params.get('amount'), 10);
            if (res && amount) {
                highlightWestEastRow(res, amount);
            }

            // Северные локации: ?loc=Бездна,Солнечные поля&amount=25&icon=sack
            const locParam = params.get('loc');
            const icon = params.get('icon');
            if (locParam && amount && icon) {
                const locations = locParam.split(',').map(s => s.trim()).filter(Boolean);
                highlightNorthRow(locations, amount, icon);

                // Скроллим к северной таблице
                const northBlock = document.querySelector('#table-block-north');
                if (northBlock) {
                    northBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        };

        const initGisaa = () => {
            injectGisaaStyles();
            // Даём странице время загрузиться
            setTimeout(applyHighlightsFromUrl, 500);
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
    };
    const HISTORY_MAX_ENTRIES = 500;
    const HISTORY_PER_PAGE = 10;
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
     * @property {number} id
     * @property {string} code
     * @property {string} type
     * @property {string} group
     * @property {number} end_time
     * @property {number} start_time
     * @property {'now'|'future'|'past'} time_status
     * @property {number} max_completed_step
     * @property {number} progress
     * @property {number} max_target
     * @property {string} title
     * @property {string} description
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
        if (window.__tmAA_fetchPatched) return;
        window.__tmAA_fetchPatched = true;

        const origFetch = window.fetch.bind(window);

        window.fetch = async (...args) => {
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

    // Получить день недели в МСК (0 = воскресенье)
    const getMSKWeekday = (utcMs) => {
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
        const dayStr = fmt.format(new Date(utcMs));
        const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        return map[dayStr] ?? 0;
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

    // Названия дней недели для отображения
    const WEEKDAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    // Парсит время из строки "HH:MM" в { hours, minutes }
    const parseTime = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return { hours: h, minutes: m };
    };

    /**
     * Вычисляет секунды до ближайшего события.
     * Возвращает 0, если событие идёт прямо сейчас; положительное число — секунды до начала; null — нет событий.
     * @param {QuestEvent[]} events
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

    /** @param {QuestEvent} event */
    const formatEventTime = (event) =>
        event.timeEnd ? `${event.timeStart}–${event.timeEnd}` : event.timeStart;

    /** @param {QuestEvent[]} events */
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
            const eventsJson = el.dataset.events;
            if (!eventsJson) return;
            try {
                const events = JSON.parse(eventsJson);
                const seconds = getSecondsUntilNextEvent(events);
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

            // «←»
            const prevLi = document.createElement('li');
            prevLi.className = 'pagination__item pagination__item--prev'
                + (historyCurrentPage <= 1 ? ' disabled' : '');
            prevLi.innerHTML = '<i class="icons-arrow"></i>';
            prevLi.addEventListener('click', () => {
                if (historyCurrentPage > 1) {
                    historyCurrentPage--;
                    renderHistoryTable();
                }
            });
            ul.appendChild(prevLi);

            // Номера страниц
            for (let p = 1; p <= totalPages; p++) {
                const li = document.createElement('li');
                li.className = 'pagination__item' + (p === historyCurrentPage ? ' active' : '');
                li.textContent = String(p);
                li.addEventListener('click', () => {
                    historyCurrentPage = p;
                    renderHistoryTable();
                });
                ul.appendChild(li);
            }

            // «→»
            const nextLi = document.createElement('li');
            nextLi.className = 'pagination__item pagination__item--next'
                + (historyCurrentPage >= totalPages ? ' disabled' : '');
            nextLi.innerHTML = '<i class="icons-arrow"></i>';
            nextLi.addEventListener('click', () => {
                if (historyCurrentPage < totalPages) {
                    historyCurrentPage++;
                    renderHistoryTable();
                }
            });
            ul.appendChild(nextLi);

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

    // ==================== Внешние ссылки (Codex, Veksel) ====================

    const CODEX_BASE = 'https://archeagecodex.com/ru/quest/';
    const CODEX_IMAGES_BASE = 'https://archeagecodex.com/images/';
    const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
    const ICON_VEKSEL = 'https://archeagecodex.com/items/icon_item_3493.png';
    const ICON_VEKSEL_NORTH = 'https://archeagecodex.com/items/icon_item_5054.png';
    const ICON_GISAA_OVERLAY = 'https://gisaa.ru/img/gisaa.svg?v=1';
    const VEKSEL_BASE = 'https://gisaa.ru/veksel/';

    /** @type {Record<number, string>} */
    const SERVERS = {
        49: 'Ифнир', 42: 'Корвус', 61: 'Ксанатос', 1: 'Луций',
        65: 'Мираж', 64: 'Нагашар', 63: 'Рейвен', 62: 'Тарон',
        45: 'Фанем', 66: 'Фесаникс', 46: 'Шаеда',
    };

    let vekselUrlResolved = VEKSEL_BASE;

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

    /**
     * @typedef {Object} Grade
     * @property {string} overlay - URL изображения рамки грейда.
     * @property {string} title - Название грейда.
     * @property {string} color - Цвет грейда (CSS).
     */

    /** @type {Grade[]} */
    const GRADES = [
        /* 0  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade0.png`, title: 'Бесполезный предмет', color: '#949293' },
        /* 1  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade1.png`, title: 'Обычный предмет', color: '#ba976d' },
        /* 2  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade2.png`, title: 'Необычный предмет', color: '#77b064' },
        /* 3  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade3.png`, title: 'Редкий предмет', color: '#558fd7' },
        /* 4  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade4.png`, title: 'Уникальный предмет', color: '#cb72d8' },
        /* 5  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade5.png`, title: 'Эпический предмет', color: '#d78b06' },
        /* 6  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade6.png`, title: 'Легендарный предмет', color: '#e17853' },
        /* 7  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade7.png`, title: 'Реликвия', color: '#f95252' },
        /* 8  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade8.png`, title: 'Предмет эпохи чудес', color: '#cf7d5d' },
        /* 9  */ { overlay: `${CODEX_IMAGES_BASE}icon_grade9.png`, title: 'Предмет эпохи сказаний', color: '#8fa5ca' },
        /* 10 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade10.png`, title: 'Предмет эпохи легенд', color: '#bf7900' },
        /* 11 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade11.png`, title: 'Предмет эпохи мифов', color: '#c90b0b' },
        /* 12 */ { overlay: `${CODEX_IMAGES_BASE}icon_grade12.png`, title: 'Предмет эпохи Двенадцати', color: '#ae98fe' },
    ];

    /**
     * @typedef {Object} ItemType
     * @property {string|undefined} icon - URL overlay-изображения типа.
     * @property {string} title - Название типа предмета.
     */

    /** @type {Record<string, ItemType>} */
    const ITEM_TYPES = {
        'unconfirmed': { icon: 'https://wiki.archerage.to/static/images/icons/top_unconfirmed.dds.png', title: 'Неопознанный предмет' },
        'seal':        { icon: 'https://wiki.archerage.to/static/images/icons/top_seal_08.dds.png', title: 'Неопознанный предмет' },
        'top_quest':   { icon: 'https://wiki.archerage.to/static/images/icons/top_quest_y.dds.png', title: 'Задание' },
        'magical':     { title: 'Магический предмет' },
        'box':         { title: 'Ящик' },
        'equipment':   { title: 'Снаряжение' },
        'material':    { title: 'Материал' },
        'potion':      { title: 'Микстура' }
    };

    /** @type {Record<string, ItemType>} */
    const ITEM_SUB_TYPES = {
        'ingot':   { title: 'Слиток металла' },
        'leather': { title: 'Кожа' },
        'cloth':   { title: 'Ткань' },
        'lumber':  { title: 'Древесина' },
        'costume': { title: 'Костюм' },
        'cloak':   { title: 'Плащ' },
        'windInstrument':   { title: 'Духовой инструмент' },
    };

    /**
     * @typedef {Object} ItemBase
     * @property {string} id - ID предмета (используется для генерации URL на ArcheageCodex).
     * @property {string} icon - Полный URL иконки.
     * @property {number} grade - Грейд (индекс в массиве GRADES, 0–12).
     * @property {string} name - Название предмета.
     * @property {string} [type] - Ключ в ITEM_TYPES (например, 'top_quest', 'unconfirmed').
     * @property {string} [subType] - Ключ в ITEM_SUB_TYPES (например, 'ingot', 'costume').
     * @property {string} [vekselName] - Название предмета для таблицы векселей (если отличается от name).
     * @property {string} [vekselType] - Тип для таблицы векселей ('sack' | 'archive' | 'license').
     * @property {boolean} [isPersonal] - Персональный предмет (отображается в секции требований).
     * @property {string} [description] - Описание предмета (отображается во второй секции всплывашки).
     * @property {string} [useDescription] - Описание использования (выводится под description зелёным цветом).
     * @property {string} [tempEquipDescription] - Описание временной экипировки (выводится аналогично useDescription).
     * @property {number} [price] - Цена продажи (0 = не продаётся).
     * @property {number} [reqLevel] - Требуемый уровень.
     */

    /**
     * Парсит игровую разметку цвета (WoW/XLGames-формат) в HTML.
     * |cAARRGGBB...text...|r → <span style="color:#RRGGBBAA">text</span>
     * |nc;...text...|r       → <span class="orange_text">text</span>
     * |nd;...text...|r       → <span class="light_blue_text">text</span>
     * |ni;...text...|r       → <span class="blue_text">text</span>
     * |nr;...text...|r       → <span class="red_text">text</span>
     * \n                     → <br>
     * @param {string} text
     * @returns {string} HTML-строка
     */
    const parseGameMarkup = (text) => {
        if (!text) return '';
        return text
            .replace(/\|c([\da-fA-F]{2})([\da-fA-F]{6})(.*?)\|r/g,
                (_, alpha, color, inner) => `<span style="color:#${color}${alpha}">${inner}</span>`)
            .replace(/\|nc;(.*?)\|r/g,
                (_, inner) => `<span class="orange_text">${inner}</span>`)
            .replace(/\|nd;(.*?)\|r/g,
                (_, inner) => `<span class="light_blue_text">${inner}</span>`)
            .replace(/\|ni;(.*?)\|r/g,
                (_, inner) => `<span class="blue_text">${inner}</span>`)
            .replace(/\|nr;(.*?)\|r/g,
                (_, inner) => `<span class="red_text">${inner}</span>`)
            .replace(/\n/g, '<br>');
    };

    const CODEX_ITEM_URL = 'https://archeagecodex.com/ru/item/';
    const CODEX_ITEM_ICONS = 'https://archeagecodex.com/items/';
    const GMRU_CDN_ICONS = 'https://aa.cdn.gmru.net/ms/data/game-icons/';

    /** @type {Record<string, ItemBase>} */

    /** @type {Record<string, ItemBase>} */
    const ITEMS = Object.fromEntries([
        { id: '8256', type: 'material', subType: 'cloth', icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "Ткань" }, // icon_item_0356.png
        { id: '8318', type: 'material', subType: 'ingot', icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "Слиток железа" }, // icon_item_quest053.png
        { id: '8337', type: 'material', subType: 'lumber', icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, name: "Упаковка строительной древесины", vekselName: "Строительная древесина" }, // icon_item_0041.png
        { id: '16327', type: 'material', subType: 'leather', icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, name: "Сыромятная кожа" }, // icon_item_0352.png
        { id: '35461', type: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Полновесный мешочек с серебром" }, // icon_item_1839.png
        { id: '40928', type: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, name: "Расшитый жемчугом кошелёк" }, // icon_item_3101.png
        { id: '42076', type: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, name: "Резной сундучок со всякой всячиной" }, // icon_item_3619.png
        { id: '42077', type: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, name: "Фермерский сундучок со всякой всячиной" }, // icon_item_3620.png
        { id: '43176', type: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, name: "Котомка эфенского странника" }, // icon_item_3906.png
        { id: '43177', type: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, name: "Эфенский сундучок со всякой всячиной" }, // icon_item_3907.png
        { id: '8000749', type: 'top_quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, name: "Лицензия на убийство: Баррага Безумный", description: 'Позволяет получить задание.' }, // icon_item_2762.png
        { id: '8000751', type: 'top_quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, name: "Лицензия на убийство: иферийцы", description: 'Позволяет получить задание.' },
        { id: '8000752', type: 'top_quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, name: "Лицензия на убийство: Иштар" },
        { id: '8000753', type: 'top_quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, name: "Лицензия на убийство: повелитель подземелья" },

        { id: '48894', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4820.png', grade: 10, name: 'Драгоценная эфенская сфера бронника', description: 'Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет. Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r.' },
        { id: '54915', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1695.png', grade: 1, name: 'Свиток чар ифнирского героя' },
        { id: '45508', icon: 'https://archeagecodex.com/items/icon_item_4212.png', grade: 2, name: 'Сфера анимага' },
        { id: '8001565', icon: 'https://archeagecodex.com/items/icon_item_3628.png', grade: 1, name: 'Новенькая кирка' },
        { id: '8002452', icon: 'https://archeagecodex.com/items/icon_item_3349.png', grade: 1, name: 'Универсальный алхимический кристалл' },
        { id: '8002449', icon: 'https://archeagecodex.com/items/charge_wider.png', grade: 1, name: 'Дополнительная сумка' },
        { id: '47943', type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_4710.png', grade: 1, name: 'Настойка усердного ремесленника' },
        { id: '39424', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_3017.png', grade: 1, name: 'Ирамийская гадальная руна', description: 'Позволяет заменить один из |nc;эффектов синтеза костюма, эфенского снаряжения, рамианского снаряжения или трофейного снаряжения мифических противников|r другим, выбранным случайным образом.', useDescription: 'Распаковать.\nУдерживая Shift, щелкните левой кнопкой мыши, чтобы распаковать все предметы этого типа, находящиеся в рюкзаке.' },
        { id: '46180', icon: 'https://archeagecodex.com/items/icon_item_1395.png', grade: 3, name: 'Солнечный настой' },
        { id: '47130', type: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2679.png', grade: 6, name: 'Хрустальная руна', description: '|nd;Можно получить одну из хрустальных рун на выбор:|r\n- хрустальная руна багровой луны,\n- хрустальная руна осенней луны,\n- хрустальная руна молодой луны,\n- хрустальная руна безмолвной луны,\n- хрустальная руна колдовской луны.' },
        { id: '47104', icon: 'https://archeagecodex.com/items/icon_item_4570.png', grade: 2, name: 'Парниковый купол' },
        { id: '48903', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3282.png', grade: 1, name: 'Набор сверкающих эфенских сфер' },
        { id: '48474', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3275.png', grade: 11, name: 'Большой набор мифических эссенций' },
        { id: '8002297', type: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2267.png', grade: 3, name: 'Королевский лунный изумруд' },
        { id: '35727', icon: 'https://archeagecodex.com/items/icon_item_1982.png', grade: 2, name: 'Буровая установка' },
        { id: '47082', icon: 'https://archeagecodex.com/items/icon_item_3369.png', grade: 1, name: 'Патент на транспортное средство' },
        { id: '55783', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2992.png', grade: 5, name: 'Сундучок с зачарованной гравировкой для украшений' },
        { id: '31892', icon: 'https://archeagecodex.com/items/icon_item_1733.png', grade: 1, name: 'Земельный вексель' },
        { id: '55722', icon: 'https://archeagecodex.com/items/icon_item_5864.png', grade: 4, name: 'Искусная цитриновая гравировка' },
        { id: '48886', icon: 'https://archeagecodex.com/items/icon_item_4818.png', grade: 8, name: 'Сверкающая эфенская сфера бронника', description: 'Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r.' },
        { id: '55723', icon: 'https://archeagecodex.com/items/icon_item_5865.png', grade: 4, name: 'Искусная аквамариновая гравировка' },
        { id: '45747', type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_4385.png', grade: 5, name: 'Драгоценный флакон с зельем охотника' },
        { id: '49270', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2273.png', grade: 5, name: 'Набор больших эфенских кубов' },
        { id: '45160', type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_2376.png', grade: 4, name: 'Настойка спорыньи' },
        { id: '46623', type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_0986.png', grade: 4, name: 'Настойка остролиста' },
        { id: '8001268', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, name: 'Свиток дельфийской библиотеки' },
        { id: '46181', icon: 'https://archeagecodex.com/items/icon_item_1396.png', grade: 3, name: 'Лунный настой' },
        { id: '48546', icon: 'https://archeagecodex.com/items/icon_item_3595.png', grade: 1, name: 'Письмена войны' },
        { id: '8002486', type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_set/nu_f_sk_korean006.png', grade: 1, name: 'Дизайн костюма хоури эпохи Фарвати' },
        { id: '47655', icon: 'https://archeagecodex.com/items/icon_item_4709.png', grade: 4, name: 'Фиона Розовый Лепесток' },
        { id: '47581', icon: 'https://archeagecodex.com/items/icon_item_4211.png', grade: 3, name: 'Лиловое эмалевое стекло' },
        { id: '47479', icon: 'https://archeagecodex.com/items/icon_item_3519.png', grade: 1, name: 'Инкрустированный флакон с целебным эликсиром' },
        { id: '47480', icon: 'https://archeagecodex.com/items/icon_item_3520.png', grade: 1, name: 'Инкрустированный флакон с эликсиром маны' },
        { id: '8003072', icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, name: 'Осколок предела' },
        { id: '8001288', icon: 'https://archeagecodex.com/items/icon_item_0966.png', grade: 1, name: 'Цитрусовая карамелька' },
        { id: '8002649', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_3259.png', grade: 4, name: 'Набор неверинских фейерверков' },
        { id: '8000540', icon: 'https://archeagecodex.com/items/icon_item_3207.png', grade: 1, name: 'Пушистая неверинская елочка' },
        { id: '49769', icon: 'https://archeagecodex.com/items/icon_item_4950.png', grade: 6, name: 'Зачарованный свиток пробуждения хранителя знаний' },
        { id: '54653', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 12, name: 'Сундук с обновленным рамианским снаряжением' },
        { id: '51236', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундучок с драгоценным украшением эпохи мифов' },
        { id: '53515', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5266.png', grade: 2, isPersonal: true, price: 0, reqLevel: 1, name: 'Заговоренная рамианская руна', description: 'Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для проклятого, изначального, обновленного и совершенного рамианского снаряжения.|r', useDescription: 'Приступить к замене эффекта.\nРасход очков работы: |nc;50|r.' },
        { id: '52207', icon: 'https://archeagecodex.com/items/icon_item_3022.png', grade: 1, name: 'Мешочек с микстурами', description: 'Содержимое:\n- инкрустированный флакон с эликсиром маны (300 шт.),\n- инкрустированный флакон с целебным эликсиром (300 шт.),\n- солнечный настой (30 шт.),\n- лунный настой (30 шт.)' },
        { id: '54655', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с обновленными рамианскими доспехами эпохи мифов' },
        { id: '54654', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, name: 'Сундук с обновленным рамианским оружием эпохи Двенадцати' },
        { id: '51239', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, name: 'Сундук с изначальным рамианским оружием эпохи мифов' },
        { id: '50924', type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png', grade: 2, name: 'Дизайн широкополой шляпы стрелка' },
        { id: '51940', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, name: 'Сундучок с ценным украшением эпохи чудес' },
        { id: '129', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_accessory_0001.png', grade: 1, name: 'Дельфийская руна' },
        { id: '50925', type: 'equipment', subType: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_f_hm_cloth519.png', grade: 2, name: 'Дизайн соломенной шляпы' },
        { id: '55280', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 6, name: 'Легендарная руна ифнирского героя' },
        { id: '55683', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями для украшений' },
        { id: '50536', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, name: 'Мешочек с магистериями', description: 'Открыв мешочек, вы сможете выбрать один из следующих предметов:\n- мешочек с рубиновыми магистериями,\n- мешочек с кварцевыми магистериями,\n- мешочек с сапфировыми магистериями,\n- мешочек с изумрудными магистериями,\n- мешочек с янтарными магистериями.' },
        { id: '8001148', icon: 'https://archeagecodex.com/items/icon_item_3807.png', grade: 2, name: 'Статуя «Орхидна на троне»' },
        { id: '8001203', icon: 'https://archeagecodex.com/items/icon_item_3277.png', grade: 1, name: 'Сундучок с фамильными ценностями' },
        { id: '54933', icon: 'https://archeagecodex.com/items/icon_item_5809.png', grade: 2, name: 'Замерзший пруд' },
        { id: '48860', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4002.png', grade: 6, name: 'Большая эфенская сфера оружейника', description: 'Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.' },
        { id: '48861', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4816.png', grade: 6, name: 'Большая эфенская сфера бронника', description: 'Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.' },
        { id: '44359', type: 'potion', icon: 'https://archeagecodex.com/items/icon_item_3559.png', grade: 1, name: 'Походный фиал славы' },
        { id: '47941', type: 'box', icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 10, name: 'Сундук с оружием Библиотеки Эрнарда эпохи легенд' },
        { id: '55800', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5486.png', grade: 4, name: 'Сундучок с фрагментами судьбы', description: 'Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- пыль судьбы (25 шт.),\n- слиток судьбы (5 шт.),\n- призма судьбы.' },
        { id: '8002772', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 5, name: 'Окованный сталью ящик с боевым питомцем', description: 'Сняв печать, вы получите Квадрума, Мистериона или Мистериона, Ужаса Ночи (на выбор).' },
        { id: '50635', type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5058.png', grade: 2, isPersonal: true, name: 'Заговоренная гадальная руна', description: 'Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для эфенского и рамианского снаряжения; трофеев, полученных за победу над мифическими противниками; ожерелий, полученных на Последнем рубеже; перстней говорящего с духами; а также для костюмов, плащей и украшений чемпионов Порт-Аргенто.|r', useDescription: 'Приступить к замене эффекта.<br>Расход очков работы: <span class="orange_text">50</span>.' },
        { id: '8002769', icon: 'https://archeagecodex.com/items/quest/icon_item_quest217.png', grade: 3, isPersonal: true, name: 'Знак «Ключевая фигура»', description: 'Позволяет получить титул «Ключевая фигура».', useDescription: 'Получить титул.' },
        { id: '30604', icon: 'https://archeagecodex.com/items/icon_item_1643.png', grade: 5, name: 'Монеты дару x100' },
        { id: '55450', type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 7, name: 'Реликвийное кольцо ифнирского героя' },
        { id: '8002410', type: 'equipment', subType: 'cloak', icon: 'https://archeagecodex.com/items/icon_item_0936.png', grade: 5, name: 'Алый шарф', description: 'Неизвестно, в чем причина, но к человеку в таком шарфе окружающие почему-то относятся с особенным уважением (и даже с некоторой опаской).\n\n|nc;Усиливающие эффекты костюма действуют 30 дней. Чтобы активировать их заново, костюм нужно постирать.|r', tempEquipDescription: 'Скорость передвижения +|nc;3|r%\nСкорость плавания +|nc;3|r%\nСкорость занятия ремеслом |nc;+10%|r\nСкорость занятия животноводством |nc;+10%|r\nОпыт при занятии ремеслом |nc;+10|r%' },
        { id: '34685', type: 'equipment', subType: 'windInstrument', icon: 'https://archeagecodex.com/items/icon_item_ins_w_0025.png', grade: 1, name: 'Укрепленный аргенитовый кларнет' },
        { id: '', type: '', icon: '', grade: 1, name: '' },
    ].map(i => [i.id, i]));

    /**
     * @typedef {Object} Slot
     * @property {ItemBase} item - Предмет.
     * @property {number} [count] - Количество предмета.
     */

    /**
     * @typedef {Object} QuestEvent
     * @property {string} timeStart - Время начала события (HH:MM).
     * @property {string} [timeEnd] - Время окончания события (HH:MM). Если указано — событие длится диапазон.
     * @property {number[]} [weekdays] - Дни недели (1–7), если не каждый день.
     */

    /**
     * @typedef {Object} QuestMeta
     * @property {number} id - ID квеста в ArcheageCodex.
     * @property {string} eventId - ID квеста в ивенте (ключ в QUEST_META).
     * @property {string} short - Краткое описание / пояснение.
     * @property {'blue_salt'|'north'} [veksel] - Тип векселя.
     * @property {string[]} [locations] - Локации выполнения.
     * @property {Slot} [slot] - Предмет с количеством.
     * @property {QuestEvent[]} [events] - Расписание событий.
     */

    /** @type {QuestMeta[]} */
    const QUESTS = [
        { eventId: '8246', id: 10559, short: "" },
        { eventId: '8248', id: 9142, short: "", veksel: 'blue_salt' },
        { eventId: '8250', id: 9318, short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
        { eventId: '8252', id: 10512, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43176"], count: 20 } },
        { eventId: '8254', id: 10513, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43176"], count: 60 } },
        { eventId: '8256', id: 9100, short: "" },
        { eventId: '8258', id: 7658, short: "" },
        { eventId: '8260', id: 6797, short: "" },
        { eventId: '8262', id: 8998, short: "" },
        { eventId: '8268', id: 5972, short: "" },
        { eventId: '8274', id: 10480, short: "" },
        { eventId: '8282', id: 7154, short: "" },
        { eventId: '8284', id: 9137, short: "", veksel: 'blue_salt', slot: { item: ITEMS["8318"], count: 60 } },
        { eventId: '8286', id: 8000131, short: "Квест Нуи на 500 очков работы" },
        { eventId: '8288', id: 10508, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["40928"], count: 25 } },
        { eventId: '8290', id: 10509, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["40928"], count: 75 } },
        { eventId: '8292', id: 5092, short: "" },
        { eventId: '8294', id: 7659, short: "" },
        { eventId: '8296', id: 7817, short: "" },
        { eventId: '8298', id: 8000058, short: "Нагашар (только обычка)", slot: { item: ITEMS["8000749"] } },
        { eventId: '8300', id: 5971, short: "", events: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
        { eventId: '8314', id: 10564, short: "Ифнир - змея", events: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }] },
        { eventId: '8316', id: 8000061, short: "Сады наслаждений (только хард)", slot: { item: ITEMS["8000752"] } },
        { eventId: '8318', id: 9317, short: 'Квест на Космача (портал "Зимний Очаг")' },
        { eventId: '8320', id: 9152, short: "", veksel: 'blue_salt', slot: { item: ITEMS["16327"], count: 60 } },
        { eventId: '8322', id: 8435, short: 'Портал "Лягушачьи пруды"' },
        { eventId: '8324', id: 10510, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["42077"], count: 8 } },
        { eventId: '8326', id: 10511, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["42077"], count: 25 } },
        { eventId: '8328', id: 7657, short: "" },
        { eventId: '8330', id: 7813, short: "" },
        { eventId: '8336', id: 5144, short: "Призрачный (ночной) разлом", events: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
        { eventId: '8338', id: 5885, short: "Анталлон на Солнечных полях", events: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
        { eventId: '8340', id: 8000060, short: "Сады наслаждений (изи или нормал)", slot: { item: ITEMS["8000751"] } },
        { eventId: '8346', id: 10056, short: "Квест можно взять в любое время, боссы:", events: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }] },
        { eventId: '8348', id: 11154, short: "Лиловый (армия фантомов)", events: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }] },
        { eventId: '8350', id: 11227, short: 'Превратиться в <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="Перевоплощение в дару" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>дару, получить и использовать <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="Разрешение на работу: билет в один конец" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, потратить 500 ОР (идти в данж не надо)' },
        { eventId: '8352', id: 9147, short: "", veksel: 'blue_salt', slot: { item: ITEMS["8256"], count: 60 } },
        { eventId: '8354', id: 8000136, short: "Квест Нуи на 2500 ремесленки" },
        { eventId: '8356', id: 10506, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["42076"], count: 10 } },
        { eventId: '8358', id: 10507, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["42076"], count: 30 } },
        { eventId: '8360', id: 5091, short: "" },
        { eventId: '8362', id: 9101, short: "Библа, 3-ий босс" },
        { eventId: '8364', id: 7656, short: "" },
        { eventId: '8366', id: 9320, short: "" },
        { eventId: '8372', id: 9297, short: "" },
        { eventId: '8380', id: 7815, short: "Изи/нормал Сады наслаждений" },
        { eventId: '8382', id: 10735, short: "Эншака на Солнечных полях", events: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
        { eventId: '8388', id: 9153, short: "", veksel: 'blue_salt', slot: { item: ITEMS["16327"], count: 100 } },
        { eventId: '8390', id: 5062, short: "" },
        { eventId: '8392', id: 10514, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43177"], count: 7 } },
        { eventId: '8394', id: 10515, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43177"], count: 20 } },
        { eventId: '8396', id: 7155, short: "Нагашар обычка" },
        { eventId: '8398', id: 9398, short: "100 мобов на Пустоши Корвуса" },
        { eventId: '8400', id: 7152, short: "" },
        { eventId: '8402', id: 9102, short: "Библа, голем" },
        { eventId: '8404', id: 9205, short: "", events: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }] },
        { eventId: '8414', id: 10952, short: "" },
        { eventId: '8422', id: 10304, short: "" },
        { eventId: '8424', id: 9099, short: "Библа, первый босс" },
        { eventId: '8426', id: 9143, short: "", veksel: 'blue_salt', slot: { item: ITEMS["8337"], count: 100 } },
        { eventId: '8434', id: 10504, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["35461"], count: 30 } },
        { eventId: '8436', id: 10505, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["35461"], count: 90 } },
        { eventId: '8438', id: 8000062, short: "Аль-Харба / Ферма / Колыбель / Воющая Бездна / Копи / Арсенал", slot: { item: ITEMS["8000753"] } },
        { eventId: '8448', id: 2943, short: "Кровавый (дневной) разлом - 3-я волна", events: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }] },
        { eventId: '8450', id: 7935, short: "", events: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }] },
        { eventId: '8452', id: 7660, short: "" },
        { eventId: '8470', id: 10739, short: "Призрачный (ночной) разлом - Эншака", events: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
        { eventId: '8478', id: 10423, short: "" },
        { eventId: '8494', id: 8635, short: "" },
        { eventId: '8496', id: 9295, short: "" },
        { eventId: '8498', id: 9294, short: "" },
        { eventId: '8500', id: 8637, short: "Бухта - Жакар" },
        { eventId: '8502', id: 7327, short: "50 мобов (100 очков) на Сверкающем побережье" },
        { eventId: '8504', id: 9296, short: "" },
        { eventId: '8506', id: 5969, short: "", events: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
        { eventId: '8508', id: 8641, short: "Эфен - жаба (через 5 минут после начала войны)" },
        { eventId: '8510', id: 5077, short: "" },
        { eventId: '8512', id: 8605, short: "" },
        { eventId: '8514', id: 11096, short: "Луг - Битва хранителей", events: [{ timeStart: "18:00", weekdays: [6, 0] }] },
        { eventId: '8516', id: 8000129, short: "" },
        { eventId: '8518', id: 1415, short: "" },
        { eventId: '8520', id: 5970, short: "", events: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
        { eventId: '8522', id: 10188, short: "" },
        { eventId: '8524', id: 8618, short: "Эфен - мобы" },
    ];

    /** @type {Record<string, QuestMeta>} */
    const QUEST_META = Object.fromEntries(QUESTS.map(q => [q.eventId, q]));

    /**
     * @typedef {Object} EventQuest
     * @property {number} id - ID квеста в ArcheageCodex.
     * @property {string} title - Название квеста.
     */

    /**
     * @typedef {Object} EventEntry
     * @property {string} title - Название события.
     * @property {EventQuest[]} [quests] - Связанные квесты.
     * @property {string[]} [locations] - Локации проведения.
     * @property {QuestEvent[]} schedule - Расписание события.
     */

    /** @type {EventEntry[]} Расписание игровых событий (для страницы /a). */
    const EVENTS = [
        { title: "Ифнир", quests: [{ id: 10569, title: "Оборона Ифнира" }, { id: 10564, title: "Освобожденные узницы Нагашара" }], locations: ["Ифнир"], schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }] },
        { title: "Луг - Битва хранителей", locations: ["Великий луг"], quests: [{ id: 11132, title: "Битва хранителей" }, { id: 11096, title: "Турнир в честь Отца-Солнца" }], schedule: [{ timeStart: "18:00", weekdays: [6, 0] }] },

        { title: "Сады матери - 4 босса", quests: [{ id: 10056, title: "Садовые работы" }], schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }] },

        { title: "Кровавый (дневной) разлом - Анталлон/Эншака", quests: [{ id: 5885, title: "Советник Кириоса" }], locations: ["Солнечные поля"], schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
        { title: "Кровавый (дневной) разлом - собака", quests: [{ id: 2943, title: "Элитные войска Кровавой армии" }], schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }] },
        { title: "Призрачный (ночной) разлом", quests: [{ id: 5144, title: "Разгром призрачного легиона" }], schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
        { title: "Лиловый (армия фантомов)", quests: [{ id: 11154, title: "Бой с тенью" }], schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }] },

        { title: "Ашьяра/Гленн/Лорея", quests: [{ id: 5971, title: "Чешуя Ашьяры" }, { id: 5970, title: "Кольцо капитана Гленна" }, { id: 5969, title: "Кольцо Лореи" }], locations: ["Бездна", "Солнечные поля"], schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },

        /* Инстансы - Рейды */
        { title: "Логово дракона", schedule: [{ timeStart: "13:20", timeEnd: "14:00" }, { timeStart: "18:20", timeEnd: "19:00" }, { timeStart: "21:20", timeEnd: "22:00" }] },
        { title: "Гардум (Ущелье кровавой росы)", quests: [{ id: 7935, title: "Хранитель Звенящего ущелья" }], schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }] },
        { title: "Последний день Ирамканда", quests: [{ id: 9205, title: "Последний день Ирамканда" }], schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }] },

        /* Инстансы - Фракции */
        { title: "Битва за Даскшир", schedule: [{ timeStart: "16:00", timeEnd: "17:00", weekdays: [1, 3, 5] }, { timeStart: "22:30", timeEnd: "23:59", weekdays: [1, 3, 5] }, { timeStart: "19:00", timeEnd: "20:00", weekdays: [0, 2, 3, 6] }] },
        { title: "Битва за Зачарованные пруды", schedule: [{ timeStart: "14:30", timeEnd: "15:15" }, { timeStart: "17:00", timeEnd: "18:00" }, { timeStart: "21:00", timeEnd: "21:45" }] },
    ];

    // ==================== API-запросы ====================

    /** @param {string} url */
    const fetchJson = async (url) => {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.json();
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
            const uid = await getUidFromCheckUser();
            const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
            const servers = parseServersFromCharListHtml(html);
            const mainServer = pickMainServer(servers);

            if (!mainServer) {
                vekselUrlResolved = VEKSEL_BASE;
                return;
            }

            const vekselId = Object.keys(SERVERS).find(id => SERVERS[id] === mainServer);
            vekselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;

            // Обновляем href всех уже отрендеренных ссылок на вексель
            document.querySelectorAll('.tm-veksel-link').forEach(link => {
                const veksel = link.dataset.veksel;
                let slot = null;
                let locations = null;
                try { slot = link.dataset.slot ? JSON.parse(link.dataset.slot) : null; } catch {}
                try { locations = link.dataset.locations ? JSON.parse(link.dataset.locations) : null; } catch {}
                link.href = buildVekselUrl(veksel, slot, locations);
            });
        } catch {
            vekselUrlResolved = VEKSEL_BASE;
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

    /**
     * Заполняет тултип данными предмета.
     * @param {ItemBase} item
     * @param {string} [overlay]
     */
    const populateTooltip = (item, overlay) => {
        const tooltip = getTooltipContainer();
        tooltip.innerHTML = '';

        const gradeInfo = GRADES[item.grade];

        // Секция 1: иконка + мета
        const headerSection = document.createElement('div');
        headerSection.className = 'tm-item-tooltip-header';

        const iconEl = makeItemIconLink({ item, overlay, noTooltip: true });
        headerSection.appendChild(iconEl);

        const tipMeta = document.createElement('div');
        tipMeta.className = 'tm-item-tooltip-meta';

        const subTypeInfo = ITEM_SUB_TYPES[item.subType];
        const typeInfo = subTypeInfo || ITEM_TYPES[item.type];
        if (typeInfo?.title) {
            const typeLine = document.createElement('div');
            typeLine.className = 'tm-item-tooltip-type';
            typeLine.textContent = typeInfo.title;
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
        if (item.isPersonal || item.reqLevel != null) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const reqSection = document.createElement('div');
            reqSection.className = 'tm-item-tooltip-req';
            if (item.reqLevel != null) {
                const lvl = document.createElement('div');
                lvl.textContent = `Требуемый уровень: ${item.reqLevel}`;
                reqSection.appendChild(lvl);
            }
            if (item.isPersonal) {
                const p = document.createElement('div');
                p.textContent = 'Персональный предмет';
                reqSection.appendChild(p);
            }
            tooltip.appendChild(reqSection);
        }

        // Секция: описание (если есть)
        if (item.description || item.useDescription || item.tempEquipDescription) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const descriptionSection = document.createElement('div');
            descriptionSection.className = 'tm-item-tooltip-desc';
            if (item.description) {
                const descText = document.createElement('div');
                descText.innerHTML = parseGameMarkup(item.description);
                descriptionSection.appendChild(descText);
            }
            if (item.useDescription) {
                const useBlock = document.createElement('div');
                useBlock.className = 'tm-item-tooltip-use';
                const useLabel = document.createElement('div');
                useLabel.className = 'tm-item-tooltip-use-label';
                useLabel.textContent = 'Использование';
                const useText = document.createElement('div');
                useText.className = 'tm-item-tooltip-use-text';
                useText.innerHTML = parseGameMarkup(item.useDescription);
                useBlock.appendChild(useLabel);
                useBlock.appendChild(useText);
                descriptionSection.appendChild(useBlock);
            }
            if (item.tempEquipDescription) {
                const equipBlock = document.createElement('div');
                equipBlock.className = 'tm-item-tooltip-use';
                const equipLabel = document.createElement('div');
                equipLabel.className = 'tm-item-tooltip-use-label';
                equipLabel.textContent = 'Экипировка (временно)';
                const equipText = document.createElement('div');
                equipText.className = 'tm-item-tooltip-use-text';
                equipText.innerHTML = parseGameMarkup(item.tempEquipDescription);
                equipBlock.appendChild(equipLabel);
                equipBlock.appendChild(equipText);
                descriptionSection.appendChild(equipBlock);
            }
            tooltip.appendChild(descriptionSection);
        }

        // Секция: цена
        if (item.price != null) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const priceSection = document.createElement('div');
            priceSection.className = 'tm-item-tooltip-price';
            if (item.price === 0) {
                priceSection.className = 'tm-item-tooltip-price tm-item-tooltip-price--none';
                priceSection.textContent = 'Этот предмет не нужен торговцам.';
            } else {
                const label = document.createElement('span');
                label.textContent = 'Цена продажи: ';
                const value = document.createElement('span');
                value.className = 'tm-item-tooltip-price-value';
                value.textContent = item.price;
                priceSection.appendChild(label);
                priceSection.appendChild(value);
            }
            tooltip.appendChild(priceSection);
        }
    };

    /**
     * Показывает тултип рядом с элементом.
     * @param {HTMLElement} anchorEl
     * @param {ItemBase} item
     * @param {string} [overlay]
     */
    const TOOLTIP_VISIBLE_CLASS = 'tm-item-tooltip--visible';
    const TOOLTIP_RIGHT_CLASS = 'tm-item-tooltip--right';
    const TOOLTIP_BOTTOM_CLASS = 'tm-item-tooltip--bottom';
    const TOOLTIP_WIDTH = 248;

    const showTooltip = (anchorEl, item, overlay) => {
        populateTooltip(item, overlay);

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

    /** Скрывает тултип. */
    const hideTooltip = () => {
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
     * @param {string} [params.overlay] - URL overlay-изображения типа предмета (из ITEM_TYPES).
     * @param {boolean} [params.linked=false] - Создать как `<a>` со ссылкой на ArcheageCodex.
     * @param {'small'|'medium'} [params.size='medium'] - Размер иконки: `'small'` (30px) или `'medium'` (42px).
     * @param {number} [params.count] - Количество предмета (бейдж снизу-справа, показывается при > 1).
     * @param {boolean} [params.noTooltip=false] - Не добавлять всплывашку (для иконки внутри тултипа).
     * @returns {HTMLElement} `.tm-item-icon`
     */
    const makeItemIconLink = ({ item, overlay, linked = false, size = 'medium', count, noTooltip = false }) => {
        const icon = document.createElement(linked ? 'a' : 'div');
        icon.className = `tm-item-icon tm-item-icon--${size}`;

        if (linked) {
            icon.href = `${CODEX_ITEM_URL}${item.id}/`;
            icon.target = '_blank';
            icon.rel = 'noopener noreferrer';
            icon.addEventListener('click', (e) => e.stopPropagation());
        }

        const itemImg = document.createElement('img');
        itemImg.className = 'tm-item-icon-img';
        itemImg.src = item.icon;

        icon.appendChild(itemImg);

        // Overlay слой (между иконкой и рамкой редкости)
        if (overlay) {
            const overlayImg = document.createElement('img');
            overlayImg.className = 'tm-item-icon-overlay';
            overlayImg.src = overlay;
            icon.appendChild(overlayImg);
        }

        const gradeInfo = GRADES[item.grade];
        const gradeImg = document.createElement('img');
        gradeImg.className = 'tm-item-icon-grade';
        gradeImg.src = gradeInfo?.overlay || `${CODEX_IMAGES_BASE}icon_grade${item.grade}.png`;
        gradeImg.alt = gradeInfo?.title || '';

        icon.appendChild(gradeImg);

        if (count && count > 1) {
            const countEl = document.createElement('div');
            countEl.className = 'tm-item-icon-count';
            countEl.textContent = count;
            icon.appendChild(countEl);
        }

        if (!noTooltip) {
            icon.addEventListener('mouseenter', () => showTooltip(icon, item, overlay));
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

    /**
     * @param {Object} params
     * @param {number} params.id
     * @param {string} params.short
     * @param {string} params.questTitle
     * @param {Slot|null} [params.slot]
     * @param {'blue_salt'|'north'} [params.veksel]
     * @param {string[]} [params.locations]
     * @param {QuestEvent[]} [params.events]
     */
    const makeLinksRow = ({ id, short, questTitle, slot, veksel, locations, events }) => {
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
                    overlay: ITEM_TYPES[item.type]?.icon || null,
                    linked: true,
                    size: 'small',
                    count: slot.count,
                }));
            } else if (item.name) {
                // Без иконки - показываем название ссылкой
                const nameLink = document.createElement('a');
                nameLink.className = 'tm-item-name-link';
                nameLink.href = `${CODEX_ITEM_URL}${item.id}/`;
                nameLink.target = '_blank';
                nameLink.rel = 'noopener noreferrer';
                nameLink.textContent = item.name;
                leftPart.appendChild(nameLink);
            }
        }

        // Контейнер для локаций/short и events
        const hasLocations = locations && locations.length > 0;
        const hasShort = !!short;
        const hasEvents = events && events.length > 0;

        if (hasLocations || hasShort || hasEvents) {
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

            // Вторая строка: события (времена)
            if (hasEvents) {
                const eventsEl = document.createElement('div');
                eventsEl.className = 'tm-events';
                eventsEl.textContent = formatEventsToString(events);

                // Countdown
                const countdown = document.createElement('span');
                countdown.className = 'tm-countdown';
                countdown.dataset.events = JSON.stringify(events);
                const seconds = getSecondsUntilNextEvent(events);
                updateCountdownEl(countdown, seconds);
                eventsEl.appendChild(countdown);

                infoWrapper.appendChild(eventsEl);
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
        icons.appendChild(makeIconLink({
            href: `${CODEX_BASE}${id}/`,
            iconSrc: ICON_QUEST,
            title: codexTitle,
            className: 'tm-codex-link',
        }));

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
     * @param {QuestEvent[]} [params.events]
     * @param {boolean} [params.animateCompletion=false] - Добавить анимацию "только что выполнено"
     */
    const makeTaskCard = ({ q, amount, id, short, isDone, showLastDone, completionTime, isToday, slot, veksel, locations, events, animateCompletion = false }) => {
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
        card.appendChild(makeLinksRow({ id, short, questTitle: q.title, slot, veksel, locations, events }));

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

        active.sort((a, b) => {
            const da = getRewardAmount(a);
            const db = getRewardAmount(b);
            if (da !== db) return da - db;
            return Number(a?.id || 0) - Number(b?.id || 0);
        });

        listEl.innerHTML = '';

        /** @type {Set<number>} */
        const currentDoneIds = new Set();

        for (const q of active) {
            const questId = Number(q.id);
            const meta = QUEST_META?.[questId] || QUEST_META?.[String(questId)];
            if (!meta?.id) continue;

            const id = Number(meta.id);
            const short = (meta.short || '').trim();
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
                slot: meta.slot || null,
                veksel: meta.veksel,
                locations: meta.locations,
                events: meta.events,
                animateCompletion: isNewlyDone,
            });

            listEl.appendChild(card);
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
                pointer-events: none;
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
                display: flex;
                justify-content: space-between;
            }
            .tm-item-tooltip-price--none {
                display: block;
                color: #d02e2e;
            }
            .tm-item-tooltip-price-value {
                color: #cfd6e0;
            }

            .orange_text {
                color: #ff9c27;
            }

            .light_blue_text {
                color: #74b0ca;
            }

            .blue_text {
                color: #27b1c6;
            }

            .red_text {
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
            margin-left: auto;
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

        .guild_tab.cart_items .gh_1 {
            width: 0%;
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
            white-space: nowrap;
            width: 0%;
        }

        .guild_tab.cart_items .gс_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .gс_4 {
            white-space: nowrap;
            text-align: right;
            border-right: none;
        }

        .cart_items .item {
            cursor: pointer;
        }

        .cart_items .item:hover {
            background: #edf4fa;
        }

        .cart_items .item.disabled {
            cursor: default;
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
                white-space: nowrap;
                user-select: none;
                line-height: 1.4;
                text-decoration: none;
                display: block;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
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
        serverClockEl.innerHTML = `мск: ${mskTime}<br>игровое: ${gameTime}`;
    };

    const initServerClock = async () => {
        await syncServerTime();
        injectServerClockStyles();
        serverClockEl = document.createElement('a');
        serverClockEl.className = 'tm-server-clock';
        serverClockEl.href = '/a/';
        document.body.appendChild(serverClockEl);
        updateServerClockContent();
        setInterval(updateServerClockContent, 1000);
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
        const el = document.querySelector('.game__right');
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
        const page = document.querySelector('.page');
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
        const el = document.querySelector('.lootbox');
        return el?.__vue__ ?? null;
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
        if (boxesAvailable <= 0) return;

        console.log(`[ArcheAgeExtraUI] Автооткрытие сундука (осталось: ${boxesAvailable})`);
        lootbox.openBox();
    };

    const startAutoOpenBoxesInterval = () => {
        if (autoOpenBoxesIntervalId != null) return;
        autoOpenBoxesIntervalId = setInterval(tryOpenNextBox, 500);
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

        try {
            await getApiInfoCached();
        } catch (e) {
            console.warn(e);
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
                const typeInfo = mapped.itemBase.type ? ITEM_TYPES[mapped.itemBase.type] : null;
                const icon = makeItemIconLink({
                    item: mapped.itemBase,
                    overlay: typeInfo?.icon,
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
            title.textContent = mapped.name || '';
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
     * Находит предмет в ITEMS по названию (name).
     * @param {string} itemName
     * @returns {ItemBase|null}
     */
    const findItemByName = (itemName) => {
        const normalized = itemName.trim().replace(/\*$/, '').trim().toLowerCase().replace(/\bc\b/g, 'с');
        for (const item of Object.values(ITEMS)) {
            const name = (item.name || '').toLowerCase();
            if (name === normalized) return item;
        }
        return null;
    };

    /**
     * @typedef {Object} CartItem
     * @property {string} title - Название предмета.
     * @property {number} count - Количество.
     * @property {string} date - Дата получения (строка из HTML).
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
            const date = dateCell?.textContent?.trim() || '';

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
        tdDate.textContent = cartItem.date;
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

        const itemData = findItemByName(cartItem.title);
        if (itemData) {
            const typeInfo = itemData.type ? ITEM_TYPES[itemData.type] : null;
            const iconEl = makeItemIconLink({
                item: itemData,
                overlay: typeInfo?.icon,
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
                    const itemData = findItemByName(cartItem.title);
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
                                    showCartPopup({
                                        title: 'Результат передачи',
                                        body: `<p>${messages.join('<br/>')}</p>`,
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
        const toItemBase = (item) => ({
            id: String(item.type || ''),
            icon: item.iconurl || '',
            grade: mapGrade(item.grade),
            name: item.gi_name || '',
            description: item.gi_description || '',
        });

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
                nameText.textContent = item.gi_name || '';
                if (item.color) nameText.style.color = `#${item.color}`;
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
                const btnFirst = document.createElement('div');
                btnFirst.className = 'itemrestore__pagintation-btn first' + (activePage > 1 ? ' active' : '');
                btnFirst.addEventListener('click', () => { if (activePage > 1) { activePage = 1; renderTable(); } });
                pagination.appendChild(btnFirst);

                const btnPrev = document.createElement('div');
                btnPrev.className = 'itemrestore__pagintation-btn prev' + (activePage > 1 ? ' active' : '');
                btnPrev.addEventListener('click', () => { if (activePage > 1) { activePage--; renderTable(); } });
                pagination.appendChild(btnPrev);

                const pagesDiv = document.createElement('div');
                pagesDiv.className = 'itemrestore__pagintation-pages';

                let start = 1, end = Math.min(10, pagesCount);
                if (activePage > 5) {
                    start = activePage - 5;
                    if (pagesCount - start < 10) start = Math.max(1, pagesCount - 10);
                }
                if (pagesCount - activePage > 5) {
                    end = activePage + 5;
                    end = Math.min(pagesCount, Math.max(end, 10));
                } else {
                    end = pagesCount;
                }

                for (let i = start; i <= end; i++) {
                    const page = document.createElement('div');
                    page.className = 'itemrestore__pagintation-page' + (i === activePage ? ' active' : '');
                    page.textContent = i;
                    const pageNum = i;
                    page.addEventListener('click', () => { activePage = pageNum; renderTable(); });
                    pagesDiv.appendChild(page);
                }
                pagination.appendChild(pagesDiv);

                const btnNext = document.createElement('div');
                btnNext.className = 'itemrestore__pagintation-btn next' + (activePage < pagesCount ? ' active' : '');
                btnNext.addEventListener('click', () => { if (activePage < pagesCount) { activePage++; renderTable(); } });
                pagination.appendChild(btnNext);

                const btnLast = document.createElement('div');
                btnLast.className = 'itemrestore__pagintation-btn last' + (activePage < pagesCount ? ' active' : '');
                btnLast.addEventListener('click', () => { if (activePage < pagesCount) { activePage = pagesCount; renderTable(); } });
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

        const origFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
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
    // ====================== EVENTS PAGE =========================
    // ============================================================

    const CODEX_QUEST_BASE = 'https://archeagecodex.com/ru/quest/';

    const injectEventsPageStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .tm-events-page {
                max-width: 860px;
                margin: 20px auto;
                font: 14px/1.5 Cambria, Georgia, "Times New Roman", Times, serif;
            }
            .tm-events-page h2 {
                text-align: center;
                margin-bottom: 16px;
                font-size: 20px;
            }
            .tm-events-table {
                width: 100%;
                border-collapse: collapse;
            }
            .tm-events-table th {
                background: #3a5a7c;
                color: #fff;
                padding: 8px 12px;
                text-align: left;
                font-weight: normal;
            }
            .tm-events-table td {
                padding: 6px 12px;
                border-bottom: 1px solid #ddd;
                vertical-align: middle;
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
        `;
        document.head.appendChild(style);
    };

    const initEventsPage = () => {
        const content = document.getElementById('content');
        if (!content || !content.textContent.includes('Запрашиваемая страница не найдена')) return;

        document.title = 'Расписание | ArcheAge';
        content.innerHTML = '';
        injectEventsPageStyles();

        const wrap = document.createElement('div');
        wrap.className = 'tm-events-page';

        const heading = document.createElement('h2');
        heading.textContent = 'Расписание событий';
        wrap.appendChild(heading);

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
        wrap.appendChild(table);
        content.appendChild(wrap);

        const DAY_SEC = 86400;

        /**
         * Собирает все ближайшие вхождения событий.
         * В пределах 24ч — каждое вхождение отдельной строкой.
         * Если у события нет вхождений в 24ч — одна строка с ближайшим.
         * @returns {{ ev: EventEntry, label: string, secondsUntil: number, isActive: boolean, isBeyond: boolean }[]}
         */
        const collectOccurrences = () => {
            const serverNow = getServerNowMs();
            const nowWd = getMSKWeekday(serverNow);
            const nowSec = getMSKTimeOfDaySeconds(serverNow);

            /** @type {{ ev: EventEntry, label: string, secondsUntil: number, isActive: boolean, isBeyond: boolean }[]} */
            const within = [];
            /** @type {{ ev: EventEntry, label: string, secondsUntil: number, isActive: boolean, isBeyond: boolean }[]} */
            const beyond = [];

            for (const ev of EVENTS) {
                let hasWithin = false;
                /** @type {{ ev: EventEntry, label: string, secondsUntil: number, isActive: boolean, isBeyond: boolean }|null} */
                let nearest = null;

                for (const entry of ev.schedule) {
                    const { hours, minutes } = parseTime(entry.timeStart);
                    const startSec = hours * 3600 + minutes * 60;
                    const timeStr = entry.timeEnd ? `${entry.timeStart}–${entry.timeEnd}` : entry.timeStart;

                    // Проверка: событие идёт прямо сейчас
                    if (entry.timeEnd) {
                        const end = parseTime(entry.timeEnd);
                        const endSec = end.hours * 3600 + end.minutes * 60;
                        const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
                        if (isToday && nowSec >= startSec && nowSec < endSec) {
                            within.push({ ev, label: timeStr, secondsUntil: -(endSec - nowSec), isActive: true, isBeyond: false });
                            hasWithin = true;
                            continue;
                        }
                    }

                    if (!entry.weekdays?.length) {
                        // Ежедневное — всегда в пределах 24ч
                        let diff = startSec - nowSec;
                        if (diff <= 0) diff += DAY_SEC;
                        within.push({ ev, label: timeStr, secondsUntil: diff, isActive: false, isBeyond: false });
                        hasWithin = true;
                    } else {
                        // По дням недели — ищем ближайшее вхождение
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
                            within.push({ ev, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: false });
                            hasWithin = true;
                        } else if (!nearest || minDiff < nearest.secondsUntil) {
                            nearest = { ev, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: true };
                        }
                    }
                }

                if (!hasWithin && nearest) {
                    beyond.push(nearest);
                }
            }

            // Активные первыми, затем по возрастанию countdown
            within.sort((a, b) => {
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                return a.secondsUntil - b.secondsUntil;
            });
            beyond.sort((a, b) => a.secondsUntil - b.secondsUntil);

            return [...within, ...beyond];
        };

        /** Ключи раскрытых <details> — сохраняются между перерисовками */
        const openDetails = new Set();

        /** Формирует строки расписания для раскрывающегося списка */
        const buildScheduleLines = (schedule) => {
            const lines = [];
            for (const entry of schedule) {
                const time = entry.timeEnd ? `${entry.timeStart}–${entry.timeEnd}` : entry.timeStart;
                if (entry.weekdays?.length) {
                    const days = entry.weekdays.map(d => WEEKDAY_NAMES[d]).join(', ');
                    lines.push(`${days} ${time}`);
                } else {
                    lines.push(time);
                }
            }
            return lines;
        };

        const renderTable = () => {
            const occs = collectOccurrences();
            const frag = document.createDocumentFragment();

            for (const occ of occs) {
                const key = `${EVENTS.indexOf(occ.ev)}:${occ.label}`;
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
                if (occ.isActive) {
                    summary.textContent = `${occ.label} — идёт, ещё ${formatCountdown(-occ.secondsUntil)}`;
                } else {
                    summary.textContent = `${occ.label} — через ${formatCountdown(occ.secondsUntil)}`;
                }
                details.appendChild(summary);

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
                nameTd.textContent = occ.ev.title || '—';
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

        renderTable();
        setInterval(renderTable, 1000);
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
    } else if (isEventsPage) {
        initEventsPage();
    } else if (location.pathname.startsWith('/promo/marathon')) {
        // Marathon page
        const observer = new MutationObserver(() => {
            if (document.querySelector('.section.tasks')) {
                observer.disconnect();
                init();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

})();
