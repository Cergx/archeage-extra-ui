// ==UserScript==
// @name         ArcheAgeExtraUI
// @namespace    https://archeage.ru/
// @version      4.0.0
// @description  Подсветка выполненных задач по last_complete_time + иконки + done-блок + нормальная навигация (МСК) + автообновление
// @author       Cergx
// @match        *://archeage.ru/promo/marathon/
// @match        *://archeage.ru/cart
// @match        *://gisaa.ru/veksel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const isGisaaSite = location.hostname.includes('gisaa.ru');
    const isArcheageSite = location.hostname.includes('archeage.ru');
    const isCartPage = isArcheageSite && location.pathname === '/cart';

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
         * Подсвечивает строки в таблицах Запад/Восток: зелёным подходящие, красным неподходящие, жёлтым если в таблице ?.
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
        QUEST_HISTORY: 'tm_aa_quest_history',
        AUTO_OPEN_BOXES: 'tm_aa_auto_open_boxes',
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
        serverClock: null,
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
            throw new Error('[AA Marathon] NOW_MS is not initialized');
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
     * @param {QuestEvent[]} events
     */
    const getSecondsUntilNextEvent = (events) => {
        if (!events || !events.length) return null;

        const serverNow = getServerNowMs();
        const nowWeekday = getMSKWeekday(serverNow);
        const nowSeconds = getMSKTimeOfDaySeconds(serverNow);

        let minDiff = Infinity;

        for (const event of events) {
            const { hours, minutes } = parseTime(event.time);
            const targetTimeSeconds = hours * 3600 + minutes * 60;

            if (!event.weekdays || event.weekdays.length === 0) {
                // Ежедневное событие
                let diff = targetTimeSeconds - nowSeconds;
                if (diff <= 0) diff += 24 * 3600;
                if (diff < minDiff) minDiff = diff;
            } else {
                // Событие в определённые дни недели
                for (const targetWeekday of event.weekdays) {
                    let daysUntil = targetWeekday - nowWeekday;
                    if (daysUntil < 0) daysUntil += 7;

                    let diff = daysUntil * 24 * 3600 + (targetTimeSeconds - nowSeconds);
                    if (diff <= 0) diff += 7 * 24 * 3600; // Следующая неделя

                    if (diff < minDiff) minDiff = diff;
                }
            }
        }

        return minDiff === Infinity ? null : minDiff;
    };

    /** @param {QuestEvent[]} events */
    const formatEventsToString = (events) => {
        if (!events || !events.length) return '';

        // Группируем события: с днями недели отдельно, ежедневные отдельно
        const daily = [];
        const withWeekdays = [];

        for (const event of events) {
            if (!event.weekdays || event.weekdays.length === 0) {
                daily.push(event.time);
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
            parts.push(`${days} ${event.time}`);
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

    // Обновляет серверные и игровые часы на странице
    const updateServerClock = () => {
        if (!DOM.serverClock) return;
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
        DOM.serverClock.innerHTML = `${mskTime} (мск)<br>${gameTime} (игр.)`;
    };

    // Обновляет все countdown элементы на странице
    const updateAllCountdowns = () => {
        updateServerClock();
        document.querySelectorAll('.tm-countdown').forEach(el => {
            const eventsJson = el.dataset.events;
            if (!eventsJson) return;
            try {
                const events = JSON.parse(eventsJson);
                const seconds = getSecondsUntilNextEvent(events);
                el.textContent = seconds != null ? ` (через ${formatCountdown(seconds)})` : '';
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

    /** @returns {HistoryEntry[]} */
    const loadQuestHistory = () => {
        try {
            return JSON.parse(localStorage.getItem(LS_KEYS.QUEST_HISTORY)) || [];
        } catch {
            return [];
        }
    };

    /** @param {HistoryEntry[]} entries */
    const saveQuestHistory = (entries) => {
        try {
            localStorage.setItem(LS_KEYS.QUEST_HISTORY, JSON.stringify(entries));
        } catch {
            // ignore
        }
    };

    /**
     * Сравнивает квесты из API с сохранённой историей, добавляет новые записи.
     * @param {ApiQuest[]} quests
     * @returns {HistoryEntry[]}
     */
    const mergeQuestHistory = (quests) => {
        const history = loadQuestHistory();
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

        saveQuestHistory(history);
        return history;
    };

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
            renderHistoryTable();
        } catch (e) {
            console.warn('[AA Marathon] updateQuestHistory failed:', e);
        }
    };

    // ==================== Слоты и сегменты (четверг pre/post) ====================

    /** @typedef {'pre'|'post'|'auto'|null} Segment */

    /** @typedef {{ dayUtcMs: number, segment: Segment }} SlotPosition */

    /**
     * @param {number} dayUtcMs
     * @param {Segment} segment
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
    const isDoneInSelectedSlot = (q, dayUtcMs, seg) => {
        const t = Number(q?.last_complete_time || 0);
        if (!t) return false;
        const b = getSlotBoundsUnix(dayUtcMs, seg);
        return b.start <= t && t < b.end;
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

    /** @type {Record<string, number>} */
    const SERVER_TO_VEKSEL_ID = {
        'Ифнир': 49, 'Корвус': 42, 'Ксанатос': 61, 'Луций': 1,
        'Мираж': 65, 'Нагашар': 64, 'Рейвен': 63, 'Тарон': 62,
        'Фанем': 45, 'Фесаникс': 66, 'Шаеда': 46,
    };

    let VEkselUrlResolved = VEKSEL_BASE;

    /**
     * Формирует URL для gisaa с параметрами.
     * @param {'blue_salt'|'north'|undefined} veksel
     * @param {Slot|null} slot
     * @param {string[]|undefined} locations — локации для северных квестов.
     */
    const buildVekselUrl = (veksel, slot, locations) => {
        const isBlueSalt = veksel === 'blue_salt';
        const isNorth = veksel === 'north';
        if (!isBlueSalt && !isNorth) return VEkselUrlResolved;

        let params = null;
        const item = slot?.item;

        if (slot?.count && item?.name) {
            if (isBlueSalt) {
                params = `res=${encodeURIComponent(item.name)}&amount=${slot.count}`;
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

        if (!params) return VEkselUrlResolved;

        const separator = VEkselUrlResolved.includes('?') ? '&' : '?';
        return `${VEkselUrlResolved}${separator}${params}`;
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
     * @property {string} icon - URL overlay-изображения типа.
     * @property {string} title - Название типа предмета.
     */

    /** @type {Record<string, ItemType>} */
    const ITEM_TYPES = {
        'unconfirmed': { icon: 'https://wiki.archerage.to/static/images/icons/top_unconfirmed.dds.png', title: 'Неопознанный предмет' },
        'quest':       { icon: 'https://wiki.archerage.to/static/images/icons/top_quest_y.dds.png', title: 'Задание' },
        'magical':     { title: 'Магический предмет' },
        'costume':     { title: 'Костюм' },
        'box':         { title: 'Ящик' },
    };

    /**
     * @typedef {Object} ItemBase
     * @property {string} icon - Полный URL иконки.
     * @property {number} grade - Грейд (индекс в массиве GRADES, 0–12).
     * @property {string} url - Ссылка на предмет в ArcheageCodex.
     * @property {string} name - Название предмета.
     * @property {string} [type] - Ключ в ITEM_TYPES (например, 'quest', 'unconfirmed').
     * @property {string} [vekselType] - Тип для таблицы векселей ('sack' | 'archive' | 'license').
     * @property {string} [description] - Описание предмета (отображается во второй секции всплывашки).
     */

    const CODEX_ITEM_ICONS = 'https://archeagecodex.com/items/';
    const GMRU_CDN_ICONS = 'https://aa.cdn.gmru.net/ms/data/game-icons/';

    /** @type {Record<string, ItemBase>} */
    const ITEMS = {
        "8256":    { icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, url: "https://archeagecodex.com/ru/item/8256/", name: "Ткань" }, // icon_item_0356.png
        "8318":    { icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, url: "https://archeagecodex.com/ru/item/8318/", name: "Слиток железа" }, // icon_item_quest053.png
        "8337":    { icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, url: "https://archeagecodex.com/ru/item/8337/", name: "Строительная древесина" }, // icon_item_0041.png
        "16327":   { icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, url: "https://archeagecodex.com/ru/item/16327/", name: "Сыромятная кожа" }, // icon_item_0352.png
        "35461":   { type: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, url: "https://archeagecodex.com/ru/item/35461/", name: "Полновесный мешочек с серебром" }, // icon_item_1839.png
        "40928":   { type: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, url: "https://archeagecodex.com/ru/item/40928/", name: "Расшитый жемчугом кошелёк" }, // icon_item_3101.png
        "42076":   { type: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, url: "https://archeagecodex.com/ru/item/42076/", name: "Резной сундучок со всякой всячиной" }, // icon_item_3619.png
        "42077":   { type: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, url: "https://archeagecodex.com/ru/item/42077/", name: "Фермерский сундучок со всякой всячиной" }, // icon_item_3620.png
        "43176":   { type: 'unconfirmed', vekselType: 'sack', icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, url: "https://archeagecodex.com/ru/item/43176/", name: "Котомка эфенского странника" }, // icon_item_3906.png
        "43177":   { type: 'unconfirmed', vekselType: 'archive', icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, url: "https://archeagecodex.com/ru/item/43177/", name: "Эфенский сундучок со всякой всячиной" }, // icon_item_3907.png
        "8000749": { type: 'quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, url: "https://archeagecodex.com/ru/item/8000749/", name: "Лицензия на убийство: Баррага Безумный", description: 'Позволяет получить задание.' }, // icon_item_2762.png
        "8000751": { type: 'quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, url: "https://archeagecodex.com/ru/item/8000751/", name: "Лицензия на убийство: иферийцы", description: 'Позволяет получить задание.' },
        "8000752": { type: 'quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, url: "https://archeagecodex.com/ru/item/8000752/", name: "Лицензия на убийство: Иштар" },
        "8000753": { type: 'quest', icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, url: "https://archeagecodex.com/ru/item/8000753/", name: "Лицензия на убийство: повелитель подземелья" },

        "48894":   { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4820.png', grade: 10, url: 'https://archeagecodex.com/ru/item/48894/', name: 'Драгоценная эфенская сфера бронника' },
        "54915":   { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1695.png', grade: 1, url: 'https://archeagecodex.com/ru/item/54915/', name: 'Свиток чар ифнирского героя' },
        "45508":   { icon: 'https://archeagecodex.com/items/icon_item_4212.png', grade: 2, url: 'https://archeagecodex.com/ru/item/45508/', name: 'Сфера анимага' },
        "8001565": { icon: 'https://archeagecodex.com/items/icon_item_3628.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8001565/', name: 'Новенькая кирка' },
        "8002452": { icon: 'https://archeagecodex.com/items/icon_item_3349.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8002452/', name: 'Универсальный алхимический кристалл' },
        "8002449": { icon: 'https://archeagecodex.com/items/charge_wider.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8002449/', name: 'Дополнительная сумка' },
        "47943":   { icon: 'https://archeagecodex.com/items/icon_item_4710.png', grade: 1, url: 'https://archeagecodex.com/ru/item/47943/', name: 'Настойка усердного ремесленника' },
        "39424":   { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_3017.png', grade: 1, url: 'https://archeagecodex.com/ru/item/39424/', name: 'Ирамийская гадальная руна' },
        "46180":   { icon: 'https://archeagecodex.com/items/icon_item_1395.png', grade: 3, url: 'https://archeagecodex.com/ru/item/46180/', name: 'Солнечный настой' },
        "47130":   { type: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2679.png', grade: 6, url: 'https://archeagecodex.com/ru/item/47130/', name: 'Хрустальная руна' },
        "47104":   { icon: 'https://archeagecodex.com/items/icon_item_4570.png', grade: 2, url: 'https://archeagecodex.com/ru/item/47104/', name: 'Парниковый купол' },
        "48903":   { icon: 'https://archeagecodex.com/items/icon_item_3282.png', grade: 1, url: 'https://archeagecodex.com/ru/item/48903/', name: 'Набор сверкающих эфенских сфер' },
        "48474":   { icon: 'https://archeagecodex.com/items/icon_item_3275.png', grade: 11, url: 'https://archeagecodex.com/ru/item/48474/', name: 'Большой набор мифических эссенций' },
        "8002297": { type: 'unconfirmed', icon: 'https://archeagecodex.com/items/icon_item_2267.png', grade: 3, url: 'https://archeagecodex.com/ru/item/8002297/', name: 'Королевский лунный изумруд' },
        "35727":   { icon: 'https://archeagecodex.com/items/icon_item_1982.png', grade: 2, url: 'https://archeagecodex.com/ru/item/35727/', name: 'Буровая установка' },
        "47082":   { icon: 'https://archeagecodex.com/items/icon_item_3369.png', grade: 1, url: 'https://archeagecodex.com/ru/item/47082/', name: 'Патент на транспортное средство' },
        "55783":   { icon: 'https://archeagecodex.com/items/icon_item_2992.png', grade: 5, url: 'https://archeagecodex.com/ru/item/55783/', name: 'Сундучок с зачарованной гравировкой для украшений' },
        "31892":   { icon: 'https://archeagecodex.com/items/icon_item_1733.png', grade: 1, url: 'https://archeagecodex.com/ru/item/31892/', name: 'Земельный вексель' },
        "55722":   { icon: 'https://archeagecodex.com/items/icon_item_5864.png', grade: 4, url: 'https://archeagecodex.com/ru/item/55722/', name: 'Искусная цитриновая гравировка' },
        "48886":   { icon: 'https://archeagecodex.com/items/icon_item_4818.png', grade: 8, url: 'https://archeagecodex.com/ru/item/48886/', name: 'Сверкающая эфенская сфера бронника' },
        "55723":   { icon: 'https://archeagecodex.com/items/icon_item_5865.png', grade: 4, url: 'https://archeagecodex.com/ru/item/55723/', name: 'Искусная аквамариновая гравировка' },
        "45747":   { icon: 'https://archeagecodex.com/items/icon_item_4385.png', grade: 5, url: 'https://archeagecodex.com/ru/item/45747/', name: 'Драгоценный флакон с зельем охотника' },
        "49270":   { icon: 'https://archeagecodex.com/items/icon_item_2273.png', grade: 5, url: 'https://archeagecodex.com/ru/item/49270/', name: 'Набор больших эфенских кубов' },
        "45160":   { icon: 'https://archeagecodex.com/items/icon_item_2376.png', grade: 4, url: 'https://archeagecodex.com/ru/item/45160/', name: 'Настойка спорыньи' },
        "46623":   { icon: 'https://archeagecodex.com/items/icon_item_0986.png', grade: 4, url: 'https://archeagecodex.com/ru/item/46623/', name: 'Настойка остролиста' },
        "8001268": { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_1986.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8001268/', name: 'Свиток дельфийской библиотеки' },
        "46181":   { icon: 'https://archeagecodex.com/items/icon_item_1396.png', grade: 3, url: 'https://archeagecodex.com/ru/item/46181/', name: 'Лунный настой' },
        "48546":   { icon: 'https://archeagecodex.com/items/icon_item_3595.png', grade: 1, url: 'https://archeagecodex.com/ru/item/48546/', name: 'Письмена войны' },
        "8002486": { icon: 'https://archeagecodex.com/items/costume_set/nu_f_sk_korean006.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8002486/', name: 'Дизайн костюма хоури эпохи Фарвати' },
        "47655":   { icon: 'https://archeagecodex.com/items/icon_item_4709.png', grade: 4, url: 'https://archeagecodex.com/ru/item/47655/', name: 'Фиона Розовый Лепесток' },
        "47581":   { icon: 'https://archeagecodex.com/items/icon_item_4211.png', grade: 3, url: 'https://archeagecodex.com/ru/item/47581/', name: 'Лиловое эмалевое стекло' },
        "47479":   { icon: 'https://archeagecodex.com/items/icon_item_3519.png', grade: 1, url: 'https://archeagecodex.com/ru/item/47479/', name: 'Инкрустированный флакон с целебным эликсиром' },
        "47480":   { icon: 'https://archeagecodex.com/items/icon_item_3520.png', grade: 1, url: 'https://archeagecodex.com/ru/item/47480/', name: 'Инкрустированный флакон с эликсиром маны' },
        "8003072": { icon: 'https://archeagecodex.com/items/icon_item_6002.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8003072/', name: 'Осколок предела' },
        "8001288": { icon: 'https://archeagecodex.com/items/icon_item_0966.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8001288/', name: 'Цитрусовая карамелька' },
        "8002649": { icon: 'https://archeagecodex.com/items/icon_item_3259.png', grade: 4, url: 'https://archeagecodex.com/ru/item/8002649/', name: 'Набор неверинских фейерверков' },
        "8000540": { icon: 'https://archeagecodex.com/items/icon_item_3207.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8000540/', name: 'Пушистая неверинская елочка' },
        "49769":   { icon: 'https://archeagecodex.com/items/icon_item_4950.png', grade: 6, url: 'https://archeagecodex.com/ru/item/49769/', name: 'Зачарованный свиток пробуждения хранителя знаний' },
        "54653":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_5043.png', grade: 12, url: 'https://archeagecodex.com/ru/item/54653/', name: 'Сундук с обновленным рамианским снаряжением' },
        "51236":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, url: 'https://archeagecodex.com/ru/item/51236/', name: 'Сундучок с драгоценным украшением эпохи мифов' },
        "53515":   { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_5266.png', grade: 2, url: 'https://archeagecodex.com/ru/item/53515/', name: 'Заговоренная рамианская руна' },
        "52207":   { icon: 'https://archeagecodex.com/items/icon_item_3022.png', grade: 1, url: 'https://archeagecodex.com/ru/item/52207/', name: 'Мешочек с микстурами', description: 'Содержимое:<br/>- инкрустированный флакон с эликсиром маны (300 шт.),<br/>- инкрустированный флакон с целебным эликсиром (300 шт.),<br/>- солнечный настой (30 шт.),<br/>- лунный настой (30 шт.)' },
        "54655":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, url: 'https://archeagecodex.com/ru/item/54655/', name: 'Сундук с обновленными рамианскими доспехами эпохи мифов' },
        "54654":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 12, url: 'https://archeagecodex.com/ru/item/54654/', name: 'Сундук с обновленным рамианским оружием эпохи Двенадцати' },
        "51239":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 11, url: 'https://archeagecodex.com/ru/item/51239/', name: 'Сундук с изначальным рамианским оружием эпохи мифов' },
        "50924":   { type: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png', grade: 2, url: 'https://archeagecodex.com/ru/item/50924/', name: 'Дизайн широкополой шляпы стрелка' },
        "51940":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2375.png', grade: 8, url: 'https://archeagecodex.com/ru/item/51940/', name: 'Сундучок с ценным украшением эпохи чудес' },
        "129":     { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_accessory_0001.png', grade: 1, url: 'https://archeagecodex.com/ru/item/129/', name: 'Дельфийская руна' },
        "50925":   { type: 'costume', icon: 'https://archeagecodex.com/items/costume_hm/nu_f_hm_cloth519.png', grade: 2, url: 'https://archeagecodex.com/ru/item/50925/', name: 'Дизайн соломенной шляпы' },
        "55280":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_2812.png', grade: 6, url: 'https://archeagecodex.com/ru/item/55280/', name: 'Легендарная руна ифнирского героя' },
        "55683":   { type: 'box', icon: 'https://archeagecodex.com/items/icon_item_4527.png', grade: 1, url: 'https://archeagecodex.com/ru/item/55683/', name: 'Мешочек с магистериями для украшений' },
        "8001148": { icon: 'https://archeagecodex.com/items/icon_item_3807.png', grade: 2, url: 'https://archeagecodex.com/ru/item/8001148/', name: 'Статуя «Орхидна на троне»' },
        "8001203": { icon: 'https://archeagecodex.com/items/icon_item_3277.png', grade: 1, url: 'https://archeagecodex.com/ru/item/8001203/', name: 'Сундучок с фамильными ценностями' },
        "54933":   { icon: 'https://archeagecodex.com/items/icon_item_5809.png', grade: 2, url: 'https://archeagecodex.com/ru/item/54933/', name: 'Замерзший пруд' },
        "48860":   { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4002.png', grade: 6, url: 'https://archeagecodex.com/ru/item/48860/', name: 'Большая эфенская сфера оружейника' },
        "48861":   { type: 'magical', icon: 'https://archeagecodex.com/items/icon_item_4816.png', grade: 6, url: 'https://archeagecodex.com/ru/item/48861/', name: 'Большая эфенская сфера бронника' },
        "44359":   { icon: 'https://archeagecodex.com/items/icon_item_3559.png', grade: 1, url: 'https://archeagecodex.com/ru/item/44359/', name: 'Походный фиал славы' },
        "47941":   { type: '', icon: 'https://archeagecodex.com/items/x_mas_gift.png', grade: 10, url: 'https://archeagecodex.com/ru/item/47941/', name: 'Сундук с оружием Библиотеки Эрнарда эпохи легенд' },
        "":   { type: '', icon: '', grade: 1, url: '', name: '' },
    };

    /**
     * @typedef {Object} Slot
     * @property {ItemBase} item - Предмет.
     * @property {number} [count] - Количество предмета.
     */

    /**
     * @typedef {Object} QuestEvent
     * @property {string} time - Время события (HH:MM).
     * @property {number[]} [weekdays] - Дни недели (1–7), если не каждый день.
     */

    /**
     * @typedef {Object} QuestMeta
     * @property {number} codexId - ID квеста в ArcheageCodex.
     * @property {string} short - Краткое описание / пояснение.
     * @property {'blue_salt'|'north'} [veksel] - Тип векселя.
     * @property {string[]} [locations] - Локации выполнения.
     * @property {Slot} [slot] - Предмет с количеством.
     * @property {QuestEvent[]} [events] - Расписание событий.
     */

    /** @type {Record<string, QuestMeta>} */
    const QUEST_META = {
        "8246": { codexId: 10559, short: "" },
        "8248": { codexId: 9142, short: "", veksel: 'blue_salt' },
        "8250": { codexId: 9318, short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
        "8252": { codexId: 10512, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43176"], count: 20 } },
        "8254": { codexId: 10513, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43176"], count: 60 } },
        "8256": { codexId: 9100, short: "" },
        "8258": { codexId: 7658, short: "" },
        "8260": { codexId: 6797, short: "" },
        "8262": { codexId: 8998, short: "" },
        "8268": { codexId: 5972, short: "" },
        "8274": { codexId: 10480, short: "" },
        "8282": { codexId: 7154, short: "" },
        "8284": { codexId: 9137, short: "", veksel: 'blue_salt', slot: { item: ITEMS["8318"], count: 60 } },
        "8286": { codexId: 8000131, short: "Квест Нуи на 500 очков работы" },
        "8288": { codexId: 10508, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["40928"], count: 25 } },
        "8290": { codexId: 10509, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["40928"], count: 75 } },
        "8292": { codexId: 5092, short: "" },
        "8294": { codexId: 7659, short: "" },
        "8296": { codexId: 7817, short: "" },
        "8298": { codexId: 8000058, short: "Нагашар (только обычка)", slot: { item: ITEMS["8000749"] } },
        "8300": { codexId: 5971, short: "", events: [{ time: "03:20" }, { time: "07:20" }, { time: "11:20" }, { time: "15:20" }, { time: "19:20" }, { time: "23:20" }] },
        "8314": { codexId: 10564, short: "Ифнир - змея", events: [{ time: "22:00", weekdays: [5] }, { time: "16:00", weekdays: [6] }] },
        "8316": { codexId: 8000061, short: "Сады наслаждений (только хард)", slot: { item: ITEMS["8000752"] } },
        "8318": { codexId: 9317, short: 'Квест на Космача (портал "Зимний Очаг")' },
        "8320": { codexId: 9152, short: "", veksel: 'blue_salt', slot: { item: ITEMS["16327"], count: 60 } },
        "8322": { codexId: 8435, short: 'Портал "Лягушачьи пруды"' },
        "8324": { codexId: 10510, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["42077"], count: 8 } },
        "8326": { codexId: 10511, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS["42077"], count: 25 } },
        "8328": { codexId: 7657, short: "" },
        "8330": { codexId: 7813, short: "" },
        "8336": { codexId: 5144, short: "Призрачный (ночной) разлом", events: [{ time: "02:20" }, { time: "06:20" }, { time: "10:20" }, { time: "14:20" }, { time: "18:20" }, { time: "22:20" }] },
        "8338": { codexId: 5885, short: "Анталлон на Солнечных полях", events: [{ time: "01:20" }, { time: "05:20" }, { time: "09:20" }, { time: "13:20" }, { time: "17:20" }, { time: "21:20" }] },
        "8340": { codexId: 8000060, short: "Сады наслаждений (изи или нормал)", slot: { item: ITEMS["8000751"] } },
        "8346": { codexId: 10056, short: "Квест можно взять в любое время, боссы:", events: [{ time: "03:00" }, { time: "07:00" }, { time: "11:00" }, { time: "15:00" }, { time: "19:00" }, { time: "23:00" }] },
        "8348": { codexId: 11154, short: "Лиловый (армия фантомов)", events: [{ time: "01:50" }, { time: "05:50" }, { time: "09:50" }, { time: "13:50" }, { time: "17:50" }, { time: "21:50" }] },
        "8350": { codexId: 11227, short: 'Превратиться в <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="Перевоплощение в дару" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>дару, получить и использовать <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="Разрешение на работу: билет в один конец" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, потратить 500 ОР (идти в данж не надо)' },
        "8352": { codexId: 9147, short: "", veksel: 'blue_salt', slot: { item: ITEMS["8256"], count: 60 } },
        "8354": { codexId: 8000136, short: "Квест Нуи на 2500 ремесленки" },
        "8356": { codexId: 10506, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["42076"], count: 10 } },
        "8358": { codexId: 10507, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["42076"], count: 30 } },
        "8360": { codexId: 5091, short: "" },
        "8362": { codexId: 9101, short: "Библа, 3-ий босс" },
        "8364": { codexId: 7656, short: "" },
        "8366": { codexId: 9320, short: "" },
        "8372": { codexId: 9297, short: "" },
        "8380": { codexId: 7815, short: "Изи/нормал Сады наслаждений" },
        "8382": { codexId: 10735, short: "Эншака на Солнечных полях", events: [{ time: "01:20" }, { time: "05:20" }, { time: "09:20" }, { time: "13:20" }, { time: "17:20" }, { time: "21:20" }] },
        "8388": { codexId: 9153, short: "", veksel: 'blue_salt', slot: { item: ITEMS["16327"], count: 100 } },
        "8390": { codexId: 5062, short: "" },
        "8392": { codexId: 10514, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43177"], count: 7 } },
        "8394": { codexId: 10515, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS["43177"], count: 20 } },
        "8396": { codexId: 7155, short: "Нагашар обычка" },
        "8398": { codexId: 9398, short: "100 мобов на Пустоши Корвуса" },
        "8400": { codexId: 7152, short: "" },
        "8402": { codexId: 9102, short: "Библа, последний босс" },
        "8404": { codexId: 9205, short: "" },
        "8414": { codexId: 10952, short: "" },
        "8422": { codexId: 10304, short: "" },
        "8424": { codexId: 9099, short: "Библа, первый босс" },
        "8426": { codexId: 9143, short: "", veksel: 'blue_salt', slot: { item: ITEMS["8337"], count: 100 } },
        "8434": { codexId: 10504, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["35461"], count: 30 } },
        "8436": { codexId: 10505, short: "", veksel: 'north', locations: ["Замок Ош"], slot: { item: ITEMS["35461"], count: 90 } },
        "8438": { codexId: 8000062, short: "Аль-Харба / Ферма / Колыбель / Воющая Бездна / Копи / Арсенал", slot: { item: ITEMS["8000753"] } },
        "8448": { codexId: 2943, short: "Кровавый (дневной) разлом - 3-я волна", events: [{ time: "00:20" }, { time: "04:20" }, { time: "08:20" }, { time: "12:20" }, { time: "16:20" }, { time: "20:20" }] },
        "8450": { codexId: 7935, short: "" },
        "8452": { codexId: 7660, short: "" },
        "8470": { codexId: 10739, short: "Призрачный (ночной) разлом - Эншака", events: [{ time: "02:20" }, { time: "06:20" }, { time: "10:20" }, { time: "14:20" }, { time: "18:20" }, { time: "22:20" }] },
        "8478": { codexId: 10423, short: "" },
        "8494": { codexId: 8635, short: "" },
        "8496": { codexId: 9295, short: "" },
        "8498": { codexId: 9294, short: "" },
        "8500": { codexId: 8637, short: "Бухта - Жакар" },
        "8502": { codexId: 7327, short: "50 мобов (100 очков) на Сверкающем побережье" },
        "8504": { codexId: 9296, short: "" },
        "8506": { codexId: 5969, short: "", events: [{ time: "03:20" }, { time: "07:20" }, { time: "11:20" }, { time: "15:20" }, { time: "19:20" }, { time: "23:20" }] },
        "8508": { codexId: 8641, short: "Эфен - жаба (через 5 минут после начала войны)" },
        "8510": { codexId: 5077, short: "" },
        "8512": { codexId: 8605, short: "" },
        "8514": { codexId: 11096, short: "Луг - Битва хранителей", events: [{ time: "18:00", weekdays: [6, 0] }] },
        "8516": { codexId: 8000129, short: "" },
        "8518": { codexId: 1415, short: "" },
        "8520": { codexId: 5970, short: "", events: [{ time: "03:20" }, { time: "07:20" }, { time: "11:20" }, { time: "15:20" }, { time: "19:20" }, { time: "23:20" }] },
        "8522": { codexId: 10188, short: "" },
        "8524": { codexId: 8618, short: "" },
    };

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
            throw new Error('[AA Marathon] Cannot read server Date header');
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

            // Перерисовываем список задач (и обновляем лейбл/кнопки навигации при смене дня)
            if (dayChanged) {
                await onSelectedDateChanged();
            } else {
                await renderTasksForSelectedDay({ animateNewlyDone: true });
            }

            // Обновляем историю выполнений
            updateQuestHistory();

            // Автозабор подарков (если включён и данные изменились)
            if (loadAutoClaimState()) {
                await claimAllLevelRewards();
            }
        } catch (e) {
            console.warn('[AA Marathon] refreshApiInfo failed:', e);
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
                VEkselUrlResolved = VEKSEL_BASE;
                return;
            }

            const vekselId = SERVER_TO_VEKSEL_ID[mainServer];
            VEkselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;

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
            VEkselUrlResolved = VEKSEL_BASE;
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

        const typeInfo = ITEM_TYPES[item.type];
        if (typeInfo?.title) {
            const typeLine = document.createElement('div');
            typeLine.className = 'tm-item-tooltip-type';
            typeLine.textContent = typeInfo.title;
            tipMeta.appendChild(typeLine);
        }

        if (gradeInfo?.title) {
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

        // Секция 2: описание (если есть)
        if (item.description) {
            const sep = document.createElement('div');
            sep.className = 'tm-item-tooltip-sep';
            tooltip.appendChild(sep);

            const descriptionSection = document.createElement('div');
            descriptionSection.className = 'tm-item-tooltip-desc';
            descriptionSection.innerHTML = item.description;
            tooltip.appendChild(descriptionSection);
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

        tooltip.style.setProperty('--tm-tooltip-top', `${rect.bottom - 8}px`);
        tooltip.style.setProperty('--tm-tooltip-scale', `${scale}`);

        if (showOnRight) {
            // Справа от иконки: левый край тултипа = правый край иконки - 8px
            tooltip.style.setProperty('--tm-tooltip-left', `${rect.right - 8}px`);
            tooltip.classList.add(TOOLTIP_RIGHT_CLASS);
        } else {
            // Слева от иконки: правый край тултипа = левый край иконки + 8px
            tooltip.style.setProperty('--tm-tooltip-left', `${rect.left + 8}px`);
            tooltip.classList.remove(TOOLTIP_RIGHT_CLASS);
        }

        tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
    };

    /** Скрывает тултип. */
    const hideTooltip = () => {
        if (globalTooltip) {
            globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS);
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
     * @param {boolean} [params.linked=false] - Создать как `<a>` со ссылкой item.url.
     * @param {'small'|'medium'} [params.size='medium'] - Размер иконки: `'small'` (30px) или `'medium'` (42px).
     * @param {number} [params.count] - Количество предмета (бейдж снизу-справа, показывается при > 1).
     * @param {boolean} [params.noTooltip=false] - Не добавлять всплывашку (для иконки внутри тултипа).
     * @returns {HTMLElement} `.tm-item-icon`
     */
    const makeItemIconLink = ({ item, overlay, linked = false, size = 'medium', count, noTooltip = false }) => {
        const icon = document.createElement(linked ? 'a' : 'div');
        icon.className = `tm-item-icon tm-item-icon--${size}`;

        if (linked) {
            icon.href = item.url;
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
            const countEl = document.createElement('span');
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
     * @param {number} params.codexId
     * @param {string} params.short
     * @param {string} params.questTitle
     * @param {Slot|null} [params.slot]
     * @param {'blue_salt'|'north'} [params.veksel]
     * @param {string[]} [params.locations]
     * @param {QuestEvent[]} [params.events]
     */
    const makeLinksRow = ({ codexId, short, questTitle, slot, veksel, locations, events }) => {
        const row = document.createElement('div');
        row.className = 'tm-links-row';

        // Левая часть: иконка предмета + локации + short-описание
        const leftPart = document.createElement('div');
        leftPart.className = 'tm-links-left';

        // Предмет с количеством и иконкой (если есть данные)
        const item = slot?.item;
        if (item?.url) {
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
                nameLink.href = item.url;
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
                countdown.textContent = seconds != null ? ` (через ${formatCountdown(seconds)})` : '';
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
            href: `${CODEX_BASE}${codexId}/`,
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
     * @param {number} params.codexId
     * @param {string} params.short
     * @param {boolean} params.isDone
     * @param {boolean} params.showLastDone
     * @param {Slot|null} [params.slot]
     * @param {'blue_salt'|'north'} [params.veksel]
     * @param {string[]} [params.locations]
     * @param {QuestEvent[]} [params.events]
     * @param {boolean} [params.animateCompletion=false] - Добавить анимацию "только что выполнено"
     */
    const makeTaskCard = ({ q, amount, codexId, short, isDone, showLastDone, slot, veksel, locations, events, animateCompletion = false }) => {
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
            if (maxStep === 0) {
                progressEl.textContent = 'Можно выполнить повторно';
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
                const t = Number(q?.last_complete_time || 0);
                const time = formatTimeMSK(t);
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
        card.appendChild(makeLinksRow({ codexId, short, questTitle: q.title, slot, veksel, locations, events }));

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

        const serverClock = document.createElement('div');
        serverClock.className = 'tm-server-clock';
        DOM.serverClock = serverClock;
        document.body.appendChild(serverClock);

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
            const todayUtc = getTodayUtcMsByTZ();
            const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);

            if (isToday && isThursdayByTZ(selectedDayUtcMs) && selectedSegment === 'post') {
                applySlot(selectedDayUtcMs, 'pre');
                await onSelectedDateChanged();
                return;
            }

            const prev = getPrevSlot(selectedDayUtcMs, selectedSegment);
            const np = clampNotPast(prev.dayUtcMs, prev.segment);
            applySlot(np.dayUtcMs, np.segment);
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
            const todayUtc = getTodayUtcMsByTZ();
            const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
            const allowBackWithinTodayThu = isToday && isThursdayByTZ(selectedDayUtcMs) && selectedSegment === 'post';
            const notPastBlock = isToday && !allowBackWithinTodayThu;

            DOM.prevBtn.disabled = (minKey != null && curKey <= minKey) || notPastBlock;
        }

        if (DOM.nextBtn) {
            DOM.nextBtn.disabled = (maxKey != null) && (curKey >= maxKey);
        }
    };

    const onSelectedDateChanged = async () => {
        updateDateNavLabel();
        updateDateNavButtons();
        try {
            await renderTasksForSelectedDay();
        } catch (e) {
            console.warn('[AA Marathon] renderTasksForSelectedDay failed:', e);
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
            if (!meta?.codexId) continue;

            const codexId = Number(meta.codexId);
            const short = (meta.short || '').trim();
            const amount = getRewardAmount(q);
            const doneInSlot = isDoneInSelectedSlot(q, selectedDayUtcMs, selectedSegment);

            if (doneInSlot) currentDoneIds.add(questId);

            // Анимируем только если: включён флаг + задание выполнено + его не было в прошлом списке
            const isNewlyDone = animateNewlyDone && doneInSlot && !previouslyDoneQuestIds.has(questId);

            const card = makeTaskCard({
                q, amount, codexId, short,
                isDone: doneInSlot,
                showLastDone: doneInSlot,
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
                width: 248px;
                padding: 15px 16px;
                background: rgba(0, 8, 24, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.25);
                pointer-events: none;
                white-space: normal;
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
                gap: 1px;
                padding: 8px 0 0;
            }

            .tm-item-tooltip-type {
                opacity: 0.7;
                font-size: 13px;
                line-height: 16px;
            }

            .tm-item-tooltip-grade {
                font-size: 13px;
                line-height: 17px;
            }

            .tm-item-tooltip-name {
                font-size: 15px;
                line-height: 20px;
            }

            .tm-item-tooltip-sep {
                height: 1px;
                margin: 5px 0;
                background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.25) 20%, rgba(255, 255, 255, 0.25) 80%, transparent);
                padding: 0;
            }

            .tm-item-tooltip-desc {
                padding: 0 3px;
                font-size: 13px;
                line-height: 16px;
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
            color: #5e8734;
            font-weight: 500;
            white-space: nowrap;
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
            pointer-events: none;
            line-height: 1.4;
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
     * @returns {string}
     */
    const getCartStyles = () => `
        .guild_tab.cart_items .gh_1 {
            width: 0%;
        }

        .guild_tab.cart_items .gh_3 {
            width: 1px;
            min-width: 170px;
        }

        .guild_tab.cart_items .gh_4 {
            white-space: nowrap;
            width: 0%;
        }

        .guild_tab.cart_items .gс_4 {
            white-space: nowrap;
        }

        .cart_items .js-cart-item.disabled {
            opacity: 1;
            color: rgba(34, 34, 34, 0.5);
        }

        .tm-cart-item-name {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
    `;

    /** Инжектит стили для страницы корзины. */
    const injectCartStyles = () => {
        const style = document.createElement('style');
        style.textContent = getCartStyles();
        document.head.appendChild(style);
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
                    console.warn(`[AA Marathon] claimLevelReward(${level}, ${type}) failed:`, e);
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

        console.log(`[AA Marathon] Автооткрытие сундука (осталось: ${boxesAvailable})`);
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

        // Инициализируем смещение серверного времени и запускаем countdown
        initServerTimeOffset();
        startCountdownInterval();

        ensureDateNavInHeader();

        try {
            await computeDateBoundsFromApiInfo();
        } catch (e) {
            console.warn('[AA Marathon] computeDateBoundsFromApiInfo failed:', e);
        }

        // Применяем сегодняшний слот (резолвим 'auto' после вычисления границ)
        applySlot(selectedDayUtcMs || getTodayUtcMsByTZ(), 'auto');

        try {
            await onSelectedDateChanged();
        } catch (e) {
            console.warn('[AA Marathon] renderTasksForSelectedDay failed:', e);
        }

        // Обновляем историю выполнений заданий
        updateQuestHistory();

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
            console.warn('[AA Marathon] initPrizes failed:', e);
        }

        // Инициализация автооткрытия сундуков
        try {
            initAutoOpenBoxesCheckbox();
        } catch (e) {
            console.warn('[AA Marathon] initAutoOpenBoxesCheckbox failed:', e);
        }

        // Запускаем автообновление с нужным интервалом
        const initialInterval = document.hidden
            ? AUTO_REFRESH_INTERVAL_HIDDEN_MS
            : AUTO_REFRESH_INTERVAL_FOCUSED_MS;
        startAutoRefresh(initialInterval);
        document.addEventListener('visibilitychange', handleVisibilityChange);
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
     * Добавляет иконки предметов в таблицу корзины.
     */
    const enhanceCartTable = () => {
        const rows = document.querySelectorAll('.cart_items .js-cart-item');
        if (rows.length === 0) return;

        for (const row of rows) {
            const nameCell = row.querySelector('.js-cart-item-name');
            if (!nameCell) continue;

            // Пропускаем если уже обработано
            if (nameCell.querySelector('.tm-cart-item-name')) continue;

            const itemName = nameCell.textContent.trim();
            const item = findItemByName(itemName);
            if (!item) continue;

            const typeInfo = item.type ? ITEM_TYPES[item.type] : null;
            const iconEl = makeItemIconLink({
                item,
                overlay: typeInfo?.icon,
                linked: true,
                size: 'small',
            });

            // Очищаем ячейку и вставляем flex-контейнер с иконкой и текстом
            nameCell.textContent = '';
            const container = document.createElement('div');
            container.className = 'tm-cart-item-name';
            container.appendChild(iconEl);
            container.appendChild(document.createTextNode(itemName));
            nameCell.appendChild(container);
        }
    };

    const initCart = () => {
        injectItemIconStyles();
        injectCartStyles();

        // Таблица загружается динамически через AJAX после загрузки страницы
        const cartObserver = new MutationObserver((mutations, obs) => {
            const rows = document.querySelectorAll('.cart_items .js-cart-item');
            if (rows.length > 0) {
                enhanceCartTable();
            }
        });

        // Наблюдаем за всем body, т.к. cart_layout ещё может не существовать
        cartObserver.observe(document.body, { childList: true, subtree: true });
    };

    // ============================================================
    // ===================== INITIALIZATION =======================
    // ============================================================

    if (isCartPage) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCart);
        } else {
            initCart();
        }
    } else {
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
