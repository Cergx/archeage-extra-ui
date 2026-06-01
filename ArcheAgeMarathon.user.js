// ==UserScript==
// @name         ArcheAge Marathon – today completed tasks UI fix (MSK)
// @namespace    https://archeage.ru/
// @version      2.6
// @description  Подсветка выполненных задач по last_complete_time + иконки + done-блок + нормальная навигация (МСК) + автообновление
// @author       Cergx
// @match        *://archeage.ru/promo/marathon/
// @match        *://gisaa.ru/veksel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const isGisaaSite = location.hostname.includes('gisaa.ru');
    const isArcheageSite = location.hostname.includes('archeage.ru');

    // ============================================================
    // ====================== GISAA.RU ============================
    // ============================================================

    if (isGisaaSite) {
        const GISAA_MATCH_CLASS = 'tm-gisaa-match';
        const GISAA_EXCLUDE_CLASS = 'tm-gisaa-exclude';

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
                .btn_vote.${GISAA_EXCLUDE_CLASS} {
                    opacity: 0.4;
                }
            `;
            document.head.appendChild(style);
        };

        // Подсвечивает строки в таблицах Запад/Восток: зелёным подходящие, красным неподходящие
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
                        const maxVal = parseInt(maxCell.textContent.trim(), 10);
                        if (maxVal === amount) {
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

        // Подсвечивает только запрошенные локации в таблице Север: зелёным подходящую, красным неподходящие
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

                // Проверяем, подходит ли по amount и iconType
                let isFullMatch = false;
                const maxCell = row.querySelector('.row__cell-max');
                if (maxCell) {
                    const maxHasIcon = iconType === 'archive'
                        ? maxCell.querySelector('.fa-archive')
                        : maxCell.querySelector('.fa-sack');
                    if (maxHasIcon) {
                        const maxText = maxCell.textContent.trim();
                        const maxMatch = maxText.match(/^(\d+)/);
                        if (maxMatch) {
                            const maxAmount = parseInt(maxMatch[1], 10);
                            if (maxAmount === amount) {
                                isFullMatch = true;
                            }
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
    const TZ = 'Europe/Moscow';
    const MSK_OFFSET_HOURS = 3;
    const THU_PRE_HOUR = 3;   // 03:00 МСК — до профработ
    const DEFAULT_HOUR = 16;  // 16:00 МСК — после профработ
    const API_INFO_PATH = '/minigames/marathon_of_heroes/api/info';
    const LS_HIDE_DONE_KEY = 'tm_aa_hide_done';
    const DAY_RESET_HOUR = 0; // 00:00 МСК — начало нового дня для сброса галочки

    // ==================== Состояние ====================

    let selectedDayUtcMs = null;
    let selectedSegment = 'auto'; // 'auto' | 'pre' | 'post' | null

    let API_INFO_CACHE = null;
    let API_INFO_PROMISE = null;
    let NOW_MS = null;

    // Автообновление API
    const AUTO_REFRESH_INTERVAL_FOCUSED_MS = 30000; // 30 секунд в фокусе
    const AUTO_REFRESH_INTERVAL_HIDDEN_MS = 1800000; // 30 минут без фокуса
    let autoRefreshIntervalId = null;
    let isRefreshing = false;

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
            const res = await origFetch(...args);

            if (path === API_INFO_PATH) {
                if (NOW_MS == null) {
                    const dateHeader = res.headers.get('Date');
                    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
                    if (Number.isFinite(parsed)) NOW_MS = parsed;
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

    const getMSKDatePartsFromUtcMs = (utcMs) => {
        const d = new Date(utcMs);
        const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = fmt.formatToParts(d);
        const y = Number(parts.find(p => p.type === 'year')?.value);
        const m = Number(parts.find(p => p.type === 'month')?.value);
        const day = Number(parts.find(p => p.type === 'day')?.value);
        return { y, m, d: day };
    };

    const formatDMY = ({ y, m, d }) => `${pad2(d)}.${pad2(m)}.${y}`;

    const formatTimeMSK = (unixSec) => {
        if (!unixSec) return '';
        return new Intl.DateTimeFormat('ru-RU', {
            timeZone: TZ,
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(unixSec * 1000));
    };

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

    const getDayBoundsUnix = (dayUtcMs) => {
        const { y, m, d } = getMSKDatePartsFromUtcMs(dayUtcMs);
        const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MSK_OFFSET_HOURS * 3600 * 1000;
        const endMs = startMs + 86400000;
        return { start: Math.floor(startMs / 1000), end: Math.floor(endMs / 1000) };
    };

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

    // Вычисляет секунды до ближайшего события
    // events: Array<{ time: "HH:MM", weekdays?: number[] }>
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

    // Форматирует events в строку для отображения
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

    // Форматирует секунды: 2 самых крупных показателя
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

    // Обновляет все countdown элементы на странице
    const updateAllCountdowns = () => {
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
            const raw = localStorage.getItem(LS_HIDE_DONE_KEY);
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
            localStorage.setItem(LS_HIDE_DONE_KEY, JSON.stringify({
                checked,
                dayKey: getHideDoneDayKey(),
            }));
        } catch {
            // ignore
        }
    };

    // ==================== Слоты и сегменты (четверг pre/post) ====================

    const slotKey = (dayUtcMs, segment) => {
        const seg = segment === 'pre' ? 0 : segment === 'post' ? 2 : 1;
        return dayUtcMs * 10 + seg;
    };

    const normalizeSegmentForDay = (dayUtcMs, seg) => {
        if (!isThursdayByTZ(dayUtcMs)) return null;
        if (seg === 'pre' || seg === 'post' || seg === 'auto') return seg;
        return 'post';
    };

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

    const getSlotBoundsUnix = (dayUtcMs, seg) => {
        const { start, end } = getDayBoundsUnix(dayUtcMs);
        if (!isThursdayByTZ(dayUtcMs)) return { start, end };

        const cut = start + 9 * 3600;
        const s = effectiveSegment(dayUtcMs, seg);
        if (s === 'pre') return { start, end: cut };
        return { start: cut, end };
    };

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

    // ==================== Квесты ====================

    const isQuestActiveAtUnix = (q, unix) => {
        const qs = Number(q?.start_time || 0);
        const qe = Number(q?.end_time || 0);
        if (!qs || !qe) return false;
        return qs <= unix && unix < qe;
    };

    const isDoneInSelectedSlot = (q, dayUtcMs, seg) => {
        const t = Number(q?.last_complete_time || 0);
        if (!t) return false;
        const b = getSlotBoundsUnix(dayUtcMs, seg);
        return b.start <= t && t < b.end;
    };

    const getRewardAmount = (q) => {
        const steps = q?.steps;
        const step1 = steps?.['1'] || steps?.[1];
        const amount = step1?.rewards?.[0]?.value?.amount;
        return Number(amount || 0);
    };

    const getQuestsArrayFromInfo = (json) => {
        const quests = json?.data?.quests;
        if (!quests || typeof quests !== 'object') throw new Error('api/info: quests not found');
        return Object.values(quests);
    };

    // ==================== Внешние ссылки (Codex, Veksel) ====================

    const CODEX_BASE = 'https://archeagecodex.com/ru/quest/';
    const CODEX_ITEMS_BASE = 'https://archeagecodex.com/items/';
    const CODEX_IMAGES_BASE = 'https://archeagecodex.com/images/';
    const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
    const ICON_VEKSEL = 'icon_item_3493.png';
    const ICON_VEKSEL_NORTH = 'icon_item_5054.png';
    const ICON_GISAA_OVERLAY = 'https://gisaa.ru/img/gisaa.svg?v=1';
    const ICON_CHEST_OVERLAY = 'https://wiki.archerage.to/static/images/icons/top_unconfirmed.dds.png';
    const ICON_LICENSE_OVERLAY = 'https://wiki.archerage.to/static/images/icons/top_quest_y.dds.png';
    const VEKSEL_BASE = 'https://gisaa.ru/veksel/';

    const SERVER_TO_VEKSEL_ID = {
        'Ифнир': 49, 'Корвус': 42, 'Ксанатос': 61, 'Луций': 1,
        'Мираж': 65, 'Нагашар': 64, 'Рейвен': 63, 'Тарон': 62,
        'Фанем': 45, 'Фесаникс': 66, 'Шаеда': 46,
    };

    let VEkselUrlResolved = VEKSEL_BASE;

    // Формирует URL для gisaa с параметрами
    // veksel: 'blue_salt' | 'north' | undefined
    // locations: string[] | undefined — массив локаций для северных квестов
    const buildVekselUrl = (baseUrl, veksel, item, locations) => {
        const isBlueSalt = veksel === 'blue_salt';
        const isNorth = veksel === 'north';
        if (!isBlueSalt && !isNorth) return baseUrl;

        let params = null;

        if (item?.count && item?.name) {
            if (isBlueSalt) {
                params = `res=${encodeURIComponent(item.name)}&amount=${item.count}`;
            } else if (isNorth) {
                // Для северных - тип иконки берём из item.type, локации из locations
                const iconType = item.type || 'sack';
                if (locations && locations.length > 0) {
                    params = `loc=${encodeURIComponent(locations.join(','))}&amount=${item.count}&icon=${iconType}`;
                } else {
                    params = `amount=${item.count}&icon=${iconType}`;
                }
            }
        }

        if (!params) return baseUrl;

        const separator = baseUrl.includes('?') ? '&' : '?';
        return baseUrl + separator + params;
    };

    const QUEST_META = {
        "8246": { codexId: 10559, short: "" },
        "8248": { codexId: 9142, short: "", veksel: 'blue_salt' },
        "8250": { codexId: 9318, short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
        "8252": { codexId: 10512, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], item: { type: 'sack', icon: "icon_item_3906.png", grade: 1, url: "https://archeagecodex.com/ru/item/43176/", name: "Котомка эфенского странника", count: 20 } },
        "8254": { codexId: 10513, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], item: { type: 'sack', icon: "icon_item_3906.png", grade: 1, url: "https://archeagecodex.com/ru/item/43176/", name: "Котомка эфенского странника", count: 60 } },
        "8256": { codexId: 9100, short: "" },
        "8258": { codexId: 7658, short: "" },
        "8260": { codexId: 6797, short: "" },
        "8262": { codexId: 8998, short: "" },
        "8268": { codexId: 5972, short: "" },
        "8274": { codexId: 10480, short: "" },
        "8282": { codexId: 7154, short: "" },
        "8284": { codexId: 9137, short: "", veksel: 'blue_salt', item: { icon: "quest/icon_item_quest053.png", grade: 1, url: "https://archeagecodex.com/ru/item/8318/", name: "Слиток железа", count: 60 } },
        "8286": { codexId: 8000131, short: "Квест Нуи на 500 очков работы" },
        "8288": { codexId: 10508, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], item: { type: 'sack', icon: "icon_item_3101.png", grade: 1, url: "https://archeagecodex.com/ru/item/40928/", name: "Расшитый жемчугом кошелёк", count: 25 } },
        "8290": { codexId: 10509, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], item: { type: 'sack', icon: "icon_item_3101.png", grade: 1, url: "https://archeagecodex.com/ru/item/40928/", name: "Расшитый жемчугом кошелёк", count: 75 } },
        "8292": { codexId: 5092, short: "" },
        "8294": { codexId: 7659, short: "" },
        "8296": { codexId: 7817, short: "" },
        "8298": { codexId: 8000058, short: "Нагашар (только обычка)", item: { type: 'license', icon: "icon_item_2762.png", grade: 3, url: "https://archeagecodex.com/ru/item/8000749/", name: "Лицензия на убийство: Баррага Безумный" } },
        "8300": { codexId: 5971, short: "", events: [{ time: "03:20" }, { time: "07:20" }, { time: "11:20" }, { time: "15:20" }, { time: "19:20" }, { time: "23:20" }] },
        "8314": { codexId: 10564, short: "Ифнир - змея", events: [{ time: "22:00", weekdays: [5] }, { time: "16:00", weekdays: [6] }] },
        "8316": { codexId: 8000061, short: "Сады наслаждений (только хард)", item: { type: 'license', icon: "icon_item_2762.png", grade: 6, url: "https://archeagecodex.com/ru/item/8000752/", name: "Лицензия на убийство: Иштар" } },
        "8318": { codexId: 9317, short: 'Квест на Космача (портал "Зимний Очаг")' },
        "8320": { codexId: 9152, short: "", veksel: 'blue_salt', item: { icon: "icon_item_0352.png", grade: 1, url: "https://archeagecodex.com/ru/item/16327/", name: "Сыромятная кожа", count: 60 } },
        "8322": { codexId: 8435, short: 'Портал "Лягушачьи пруды"' },
        "8324": { codexId: 10510, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], item: { type: 'archive', icon: "icon_item_3620.png", grade: 1, url: "https://archeagecodex.com/ru/item/42077/", name: "Фермерский сундучок со всякой всячиной", count: 8 } },
        "8326": { codexId: 10511, short: "", veksel: 'north', locations: ["Бездна", "Солнечные поля"], item: { type: 'archive', icon: "icon_item_3620.png", grade: 1, url: "https://archeagecodex.com/ru/item/42077/", name: "Фермерский сундучок со всякой всячиной", count: 25 } },
        "8328": { codexId: 7657, short: "" },
        "8330": { codexId: 7813, short: "" },
        "8336": { codexId: 5144, short: "" },
        "8338": { codexId: 5885, short: "Анталлон на Солнечных полях", events: [{ time: "01:20" }, { time: "05:20" }, { time: "09:20" }, { time: "13:20" }, { time: "17:20" }, { time: "21:20" }] },
        "8340": { codexId: 8000060, short: "Сады наслаждений (изи или нормал)", item: { type: 'license', icon: "icon_item_2762.png", grade: 5, url: "https://archeagecodex.com/ru/item/8000751/", name: "Лицензия на убийство: иферийцы" } },
        "8346": { codexId: 10056, short: "" },
        "8348": { codexId: 11154, short: "Лиловый (армия фантомов)", events: [{ time: "01:50" }, { time: "05:50" }, { time: "09:50" }, { time: "13:50" }, { time: "17:50" }, { time: "21:50" }] },
        "8350": { codexId: 11227, short: 'Превратиться в <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="Перевоплощение в дару" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>дару, получить и использовать <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="Разрешение на работу: билет в один конец" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, потратить 500 ОР (идти в данж не надо)' },
        "8352": { codexId: 9147, short: "", veksel: 'blue_salt', item: { icon: "icon_item_0356.png", grade: 1, url: "https://archeagecodex.com/ru/item/8256/", name: "Ткань", count: 60 } },
        "8354": { codexId: 8000136, short: "Квест Нуи на 2500 ремесленки" },
        "8356": { codexId: 10506, short: "", veksel: 'north', locations: ["Замок Ош"], item: { type: 'archive', icon: "icon_item_3619.png", grade: 1, url: "https://archeagecodex.com/ru/item/42076/", name: "Резной сундучок со всякой всячиной", count: 10 } },
        "8358": { codexId: 10507, short: "", veksel: 'north', locations: ["Замок Ош"], item: { type: 'archive', icon: "icon_item_3619.png", grade: 1, url: "https://archeagecodex.com/ru/item/42076/", name: "Резной сундучок со всякой всячиной", count: 30 } },
        "8360": { codexId: 5091, short: "" },
        "8362": { codexId: 9101, short: "Библа, 3-ий босс" },
        "8364": { codexId: 7656, short: "" },
        "8366": { codexId: 9320, short: "" },
        "8372": { codexId: 9297, short: "" },
        "8380": { codexId: 7815, short: "Изи/нормал Сады наслаждений" },
        "8382": { codexId: 10735, short: "Эншака на Солнечных полях", events: [{ time: "01:20" }, { time: "05:20" }, { time: "09:20" }, { time: "13:20" }, { time: "17:20" }, { time: "21:20" }] },
        "8388": { codexId: 9153, short: "", veksel: 'blue_salt', item: { icon: "icon_item_0352.png", grade: 1, url: "https://archeagecodex.com/ru/item/16327/", name: "Сыромятная кожа", count: 100 } },
        "8390": { codexId: 5062, short: "" },
        "8392": { codexId: 10514, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], item: { type: 'archive', icon: "icon_item_3907.png", grade: 1, url: "https://archeagecodex.com/ru/item/43177/", name: "Эфенский сундучок со всякой всячиной", count: 7 } },
        "8394": { codexId: 10515, short: "", veksel: 'north', locations: ["Бухта Китобоев", "Эфен'Хал"], item: { type: 'archive', icon: "icon_item_3907.png", grade: 1, url: "https://archeagecodex.com/ru/item/43177/", name: "Эфенский сундучок со всякой всячиной", count: 20 } },
        "8396": { codexId: 7155, short: "Нагашар обычка" },
        "8398": { codexId: 9398, short: "100 мобов на Пустоши Корвуса" },
        "8400": { codexId: 7152, short: "" },
        "8402": { codexId: 9102, short: "Библа, последний босс" },
        "8404": { codexId: 9205, short: "" },
        "8414": { codexId: 10952, short: "" },
        "8422": { codexId: 10304, short: "" },
        "8424": { codexId: 9099, short: "Библа, первый босс" },
        "8426": { codexId: 9143, short: "", veksel: 'blue_salt', item: { icon: "icon_item_0041.png", grade: 1, url: "https://archeagecodex.com/ru/item/8337/", name: "Строительная древесина", count: 100 } },
        "8434": { codexId: 10504, short: "", veksel: 'north', locations: ["Замок Ош"], item: { type: 'sack', icon: "icon_item_1839.png", grade: 1, url: "https://archeagecodex.com/ru/item/35461/", name: "Полновесный мешочек с серебром", count: 30 } },
        "8436": { codexId: 10505, short: "", veksel: 'north', locations: ["Замок Ош"], item: { type: 'sack', icon: "icon_item_1839.png", grade: 1, url: "https://archeagecodex.com/ru/item/35461/", name: "Полновесный мешочек с серебром", count: 90 } },
        "8438": { codexId: 8000062, short: "Аль-Харба / Ферма / Колыбель / Воющая Бездна / Копи / Арсенал", item: { type: 'license', icon: "icon_item_2762.png", grade: 2, url: "https://archeagecodex.com/ru/item/8000753/", name: "Лицензия на убийство: повелитель подземелья" } },
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
        "8508": { codexId: 8641, short: "Эфен - жаба" },
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

    const fetchJson = async (url) => {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.json();
    };

    const fetchText = async (url) => {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text();
    };

    const fetchApiInfo = async () => {
        const res = await fetch('/minigames/marathon_of_heroes/api/info', {
            credentials: 'include',
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`api/info failed: ${res.status}`);

        if (NOW_MS == null) {
            const dateHeader = res.headers.get('Date');
            const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
            if (!Number.isFinite(parsed)) {
                throw new Error('[AA Marathon] Cannot read server Date header');
            }
            NOW_MS = parsed;
        }

        return res.json();
    };

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

    const refreshApiInfo = async () => {
        if (isRefreshing) return;
        isRefreshing = true;
        showRefreshLoader();

        try {
            // Сбрасываем кэш, промис и время для получения свежих данных
            API_INFO_CACHE = null;
            API_INFO_PROMISE = null;
            NOW_MS = null;

            // Загружаем свежие данные (fetchApiInfo обновит NOW_MS из Date header)
            API_INFO_CACHE = await fetchApiInfo();

            // Обновляем смещение серверного времени
            if (NOW_MS != null) {
                SERVER_TIME_OFFSET = NOW_MS - Date.now();
            }

            // Перерисовываем список задач
            await renderTasksForSelectedDay();
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
                let item = null;
                let locations = null;
                try { item = link.dataset.item ? JSON.parse(link.dataset.item) : null; } catch {}
                try { locations = link.dataset.locations ? JSON.parse(link.dataset.locations) : null; } catch {}
                link.href = buildVekselUrl(VEkselUrlResolved, veksel, item, locations);
            });
        } catch {
            VEkselUrlResolved = VEKSEL_BASE;
        }
    };

    // ==================== UI: создание карточек ====================

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

    // Создаёт иконку для ссылки на таблицу векселей (gisaa + маленькая иконка векселя)
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
        badgeImg.src = `${CODEX_ITEMS_BASE}${vekselIcon}`;
        badgeImg.alt = 'veksel';

        a.appendChild(mainImg);
        a.appendChild(badgeImg);
        return a;
    };

    // Создаёт иконку предмета с рамкой редкости (и опциональным overlay для сундучков)
    const makeItemIconLink = ({ itemIcon, grade, itemUrl, title, overlay }) => {
        const a = document.createElement('a');
        a.className = 'tm-item-icon-link';
        a.href = itemUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (title) a.title = title;

        const itemImg = document.createElement('img');
        itemImg.className = 'tm-item-icon-img';
        itemImg.src = itemIcon.startsWith('http') ? itemIcon : `${CODEX_ITEMS_BASE}${itemIcon}`;
        itemImg.alt = 'item';

        a.appendChild(itemImg);

        // Overlay слой (между иконкой и рамкой редкости)
        if (overlay) {
            const overlayImg = document.createElement('img');
            overlayImg.className = 'tm-item-icon-overlay';
            overlayImg.src = overlay;
            overlayImg.alt = '';
            a.appendChild(overlayImg);
        }

        const gradeImg = document.createElement('img');
        gradeImg.className = 'tm-item-icon-grade';
        gradeImg.src = `${CODEX_IMAGES_BASE}icon_grade${grade}.png`;
        gradeImg.alt = 'grade';

        a.appendChild(gradeImg);
        return a;
    };

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

    const makeTaskText = (desc) => {
        const t = document.createElement('div');
        t.className = 'tasks__item-text';
        t.textContent = desc || '';
        return t;
    };

    const makeLinksRow = ({ codexId, short, questTitle, item, veksel, locations, events }) => {
        const row = document.createElement('div');
        row.className = 'tm-links-row';

        // Левая часть: иконка предмета + локации + short-описание
        const leftPart = document.createElement('div');
        leftPart.className = 'tm-links-left';

        // Предмет с количеством и иконкой (если есть данные)
        if (item?.url) {
            const hasIcon = item.icon && item.grade;
            const hasCount = item.count && item.count > 1;

            if (hasCount) {
                const countEl = document.createElement('span');
                countEl.className = 'tm-item-count';
                countEl.textContent = `${item.count} ×`;
                leftPart.appendChild(countEl);
            }

            if (hasIcon) {
                leftPart.appendChild(makeItemIconLink({
                    itemIcon: item.icon,
                    grade: item.grade,
                    itemUrl: item.url,
                    title: item.name || 'Открыть предмет в ArcheageCodex',
                    overlay: item.type === 'license' ? ICON_LICENSE_OVERLAY
                        : (item.type === 'archive' || item.type === 'sack') ? ICON_CHEST_OVERLAY
                            : null,
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
                href: buildVekselUrl(VEkselUrlResolved, veksel, item, locations),
                title: 'Открыть таблицу векселей',
                vekselIcon: veksel === 'blue_salt' ? ICON_VEKSEL : ICON_VEKSEL_NORTH,
            });
            link.classList.add('tm-veksel-link');
            link.dataset.veksel = veksel;
            if (item) link.dataset.item = JSON.stringify(item);
            if (locations) link.dataset.locations = JSON.stringify(locations);
            icons.appendChild(link);
        }

        return row;
    };

    const makeTaskCard = ({ q, amount, codexId, short, isDone, showLastDone, item, veksel, locations, events }) => {
        const card = document.createElement('div');
        card.className = `tasks__item tasks__item--${amount || 1}`;

        if (isDone) {
            card.classList.add(DONE_CLASS);

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
        card.appendChild(makeLinksRow({ codexId, short, questTitle: q.title, item, veksel, locations, events }));

        return card;
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
            const todayUtc = getTodayUtcMsByTZ();
            const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);

            if (isToday && isThursdayByTZ(selectedDayUtcMs) && selectedSegment === 'post') {
                selectedSegment = 'pre';
                const c0 = clampSelectedDay(selectedDayUtcMs, selectedSegment);
                selectedDayUtcMs = c0.dayUtcMs;
                selectedSegment = c0.segment;
                await onSelectedDateChanged();
                return;
            }

            const prev = getPrevSlot(selectedDayUtcMs, selectedSegment);
            const np = clampNotPast(prev.dayUtcMs, prev.segment);
            const c = clampSelectedDay(np.dayUtcMs, np.segment);
            selectedDayUtcMs = c.dayUtcMs;
            selectedSegment = c.segment;
            await onSelectedDateChanged();
        });

        right.addEventListener('click', async () => {
            const next = getNextSlot(selectedDayUtcMs, selectedSegment);
            const c = clampSelectedDay(next.dayUtcMs, next.segment);
            selectedDayUtcMs = c.dayUtcMs;
            selectedSegment = c.segment;
            await onSelectedDateChanged();
        });

        todayBtn.addEventListener('click', async () => {
            selectedDayUtcMs = getTodayUtcMsByTZ();
            selectedSegment = 'auto';
            const c = clampSelectedDay(selectedDayUtcMs, selectedSegment);
            selectedDayUtcMs = c.dayUtcMs;
            selectedSegment = c.segment;
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

        const c = clampSelectedDay(selectedDayUtcMs, selectedSegment);
        selectedDayUtcMs = c.dayUtcMs;
        selectedSegment = c.segment;
    };

    const renderTasksForSelectedDay = async () => {
        const listEl = ensureTasksListEl();
        if (!listEl) return;

        const json = await getApiInfoCached();
        const all = getQuestsArrayFromInfo(json);

        const todayUtc = getTodayUtcMsByTZ();
        const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
        const isThu = isThursdayByTZ(selectedDayUtcMs);

        let unixPoint;
        if (isToday && selectedSegment === 'auto') {
            unixPoint = getNowUnix();
        } else if (isThu && selectedSegment === 'pre') {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, THU_PRE_HOUR);
        } else if (isThu && selectedSegment === 'post') {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR);
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

        for (const q of active) {
            const questId = Number(q.id);
            const meta = QUEST_META?.[questId] || QUEST_META?.[String(questId)];
            if (!meta?.codexId) continue;

            const codexId = Number(meta.codexId);
            const short = (meta.short || '').trim();
            const amount = getRewardAmount(q);
            const doneInSlot = isDoneInSelectedSlot(q, selectedDayUtcMs, selectedSegment);

            const card = makeTaskCard({
                q, amount, codexId, short,
                isDone: doneInSlot,
                showLastDone: doneInSlot,
                item: meta.item,
                veksel: meta.veksel,
                locations: meta.locations,
                events: meta.events,
            });

            listEl.appendChild(card);
        }
    };

    // ==================== Стили ====================

    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .${DONE_CLASS} {
                opacity: 0.6;
            }

            .tasks__item-done {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;
                pointer-events: none;
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
                opacity: 0.95;
                justify-content: space-between;
                align-items: center;
            }

            .tm-links-left {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .tm-item-count {
                font-size: 12px;
                font-weight: 500;
                opacity: 0.9;
                white-space: nowrap;
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
                color: #7cb342;
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
                transition: transform 120ms ease, opacity 120ms ease;
            }

            .tm-icon-link:hover {
                transform: translateY(-1px);
                opacity: 1;
            }

            .tm-icon-link img {
                width: 30px;
                display: block;
            }

            .tm-item-icon-link {
                position: relative;
                display: inline-block;
                width: 30px;
                height: 30px;
                flex-shrink: 0;
                transition: transform 120ms ease, opacity 120ms ease;
            }

            .tm-item-icon-link:hover {
                transform: translateY(-1px);
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
        `;
        document.head.appendChild(style);
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

        if (!selectedDayUtcMs) selectedDayUtcMs = getTodayUtcMsByTZ();

        ensureDateNavInHeader();
        updateDateNavLabel();
        updateDateNavButtons();

        try {
            await computeDateBoundsFromApiInfo();
        } catch (e) {
            console.warn('[AA Marathon] computeDateBoundsFromApiInfo failed:', e);
        }

        try {
            await renderTasksForSelectedDay();
        } catch (e) {
            console.warn('[AA Marathon] renderTasksForSelectedDay failed:', e);
        }

        requestAnimationFrame(() => {
            const el = document.querySelector('.section.tasks .tasks__header');
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 85;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        });

        resolveVekselUrl();

        // Запускаем автообновление с нужным интервалом
        const initialInterval = document.hidden
            ? AUTO_REFRESH_INTERVAL_HIDDEN_MS
            : AUTO_REFRESH_INTERVAL_FOCUSED_MS;
        startAutoRefresh(initialInterval);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    };

    const observer = new MutationObserver(() => {
        if (document.querySelector('.section.tasks')) {
            observer.disconnect();
            init();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
