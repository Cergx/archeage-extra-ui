// ==UserScript==
// @name         ArcheAge Marathon – today completed tasks UI fix (MSK)
// @namespace    https://archeage.ru/
// @version      1.9
// @description  Подсветка выполненных задач по last_complete_time + иконки + done-блок + нормальная навигация (МСК)
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
        const GISAA_HIGHLIGHT_CLASS = 'tm-gisaa-highlight';

        const injectGisaaStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                .${GISAA_HIGHLIGHT_CLASS} {
                    background-color: rgba(60, 180, 90, 0.25) !important;
                    box-shadow: inset 0 0 0 2px rgba(60, 180, 90, 0.5);
                }
                tr.${GISAA_HIGHLIGHT_CLASS},
                td.${GISAA_HIGHLIGHT_CLASS} {
                    background-color: rgba(60, 180, 90, 0.25) !important;
                }
                button.${GISAA_HIGHLIGHT_CLASS} {
                    background-color: rgba(60, 180, 90, 0.4) !important;
                    border-color: rgba(60, 180, 90, 0.8) !important;
                }
            `;
            document.head.appendChild(style);
        };

        // Выделяет строку в таблицах Запад/Восток по названию ресурса и значению max
        const highlightWestEastRow = (resourceName, amount) => {
            const blocks = ['#table-block-west', '#table-block-east'];
            for (const blockId of blocks) {
                const block = document.querySelector(blockId);
                if (!block) continue;
                const tables = block.querySelectorAll('table');
                for (const table of tables) {
                    const header = table.querySelector('th.table__name');
                    if (!header) continue;
                    if (header.textContent.trim() !== resourceName) continue;
                    const rows = table.querySelectorAll('.row-table');
                    for (const row of rows) {
                        const maxCell = row.querySelector('.row__cell-max');
                        if (!maxCell) continue;
                        const maxVal = parseInt(maxCell.textContent.trim(), 10);
                        if (maxVal === amount) {
                            row.classList.add(GISAA_HIGHLIGHT_CLASS);
                            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_HIGHLIGHT_CLASS));
                        }
                    }
                }
            }
        };

        // Выделяет строку/кнопку в таблице Север
        const highlightNorthRow = (locations, amount, iconType) => {
            const block = document.querySelector('#table-block-north');
            if (!block) return;
            const rows = block.querySelectorAll('.row-table');
            for (const row of rows) {
                const nameEl = row.querySelector('.name.fix_size');
                if (!nameEl) continue;
                // Извлекаем текст локации (убираем иконки)
                const rowLocation = nameEl.textContent.trim();

                // Если указаны локации, проверяем совпадение
                if (locations && locations.length > 0) {
                    const locationMatch = locations.some(loc =>
                        rowLocation.toLowerCase().includes(loc.toLowerCase()) ||
                        loc.toLowerCase().includes(rowLocation.toLowerCase())
                    );
                    if (!locationMatch) continue;
                }

                // Проверяем ячейку .row__cell-max - там указан максимум и его тип
                const maxCell = row.querySelector('.row__cell-max');
                if (!maxCell) continue;

                const maxHasIcon = iconType === 'archive'
                    ? maxCell.querySelector('.fa-archive')
                    : maxCell.querySelector('.fa-sack');
                if (!maxHasIcon) continue;

                const maxText = maxCell.textContent.trim();
                const maxMatch = maxText.match(/^(\d+)/);
                if (!maxMatch) continue;
                const maxAmount = parseInt(maxMatch[1], 10);
                if (maxAmount !== amount) continue;

                // Нашли нужную строку - подсвечиваем
                row.classList.add(GISAA_HIGHLIGHT_CLASS);
                row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_HIGHLIGHT_CLASS));

                // Также подсвечиваем соответствующую кнопку
                const buttons = row.querySelectorAll('.btn_vote');
                for (const btn of buttons) {
                    const btnHasIcon = iconType === 'archive'
                        ? btn.querySelector('.fa-archive')
                        : btn.querySelector('.fa-sack');
                    if (!btnHasIcon) continue;
                    const btnText = btn.textContent.trim();
                    const btnMatch = btnText.match(/^(\d+)/);
                    if (!btnMatch) continue;
                    const btnAmount = parseInt(btnMatch[1], 10);
                    if (btnAmount === amount) {
                        btn.classList.add(GISAA_HIGHLIGHT_CLASS);
                    }
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

    // Маппинг русских названий дней недели на номер (0 = воскресенье, 1 = понедельник, ...)
    const WEEKDAY_MAP = {
        'воскресенье': 0, 'понедельник': 1, 'вторник': 2, 'среда': 3,
        'среду': 3, 'четверг': 4, 'пятница': 5, 'пятницу': 5,
        'суббота': 6, 'субботу': 6,
    };

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

    // Парсит события из строки short
    // Возвращает массив { weekdays: number[] | null, hours, minutes }
    const parseEventsFromShort = (short) => {
        if (!short) return [];

        const events = [];
        const weekdayPattern = /(?:^|\/)\s*((?:(?:понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье)(?:\s*(?:и|,)\s*)?)+)\s*в\s*(\d{1,2}:\d{2})/gi;

        let hasWeekdayEvents = false;
        let match;

        // Ищем форматы с днями недели: "Пятница в 22:00", "Суббота и Воскресенье в 18:00"
        while ((match = weekdayPattern.exec(short)) !== null) {
            hasWeekdayEvents = true;
            const daysStr = match[1].toLowerCase();
            const timeStr = match[2];
            const [h, m] = timeStr.split(':').map(Number);

            // Извлекаем все дни недели из строки
            const weekdays = [];
            for (const [name, num] of Object.entries(WEEKDAY_MAP)) {
                if (daysStr.includes(name)) {
                    if (!weekdays.includes(num)) weekdays.push(num);
                }
            }

            if (weekdays.length > 0) {
                events.push({ weekdays, hours: h, minutes: m });
            }
        }

        // Если нет событий с днями недели, ищем простые времена (ежедневные)
        if (!hasWeekdayEvents) {
            const timePattern = /\b(\d{1,2}:\d{2})\b/g;
            while ((match = timePattern.exec(short)) !== null) {
                const [h, m] = match[1].split(':').map(Number);
                events.push({ weekdays: null, hours: h, minutes: m }); // null = каждый день
            }
        }

        return events;
    };

    // Вычисляет секунды до ближайшего события
    const getSecondsUntilNextEvent = (events) => {
        if (!events.length) return null;

        const serverNow = getServerNowMs();
        const nowWeekday = getMSKWeekday(serverNow);
        const nowSeconds = getMSKTimeOfDaySeconds(serverNow);

        let minDiff = Infinity;

        for (const event of events) {
            const targetTimeSeconds = event.hours * 3600 + event.minutes * 60;

            if (event.weekdays === null) {
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
    const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
    const ICON_VEKSEL = 'https://archeagecodex.com/items/icon_item_3493.png';
    const ICON_VEKSEL_EAST = 'https://archeagecodex.com/items/icon_item_5054.png';
    const VEKSEL_OFFICIAL_IDS = new Set([8426, 8388, 8352, 8320, 8284, 8248]);
    const EAST_VEKSEL_OFFICIAL_IDS = new Set([8252, 8254, 8288, 8290, 8324, 8326, 8356, 8358, 8392, 8394, 8434, 8436]);
    const VEKSEL_BASE = 'https://gisaa.ru/veksel/';

    const SERVER_TO_VEKSEL_ID = {
        'Ифнир': 49, 'Корвус': 42, 'Ксанатос': 61, 'Луций': 1,
        'Мираж': 65, 'Нагашар': 64, 'Рейвен': 63, 'Тарон': 62,
        'Фанем': 45, 'Фесаникс': 66, 'Шаеда': 46,
    };

    let VEkselUrlResolved = VEKSEL_BASE;

    // Парсит short и возвращает URL-параметры для gisaa
    const parseShortToVekselParams = (short, isWestVeksel) => {
        if (!short) return null;

        if (isWestVeksel) {
            // Формат: "60 <a href='...'>Слиток железа</a>"
            const match = short.match(/^(\d+)\s*<a[^>]*>([^<]+)<\/a>/i);
            if (!match) return null;
            const amount = match[1];
            const resourceName = match[2].trim();
            return `res=${encodeURIComponent(resourceName)}&amount=${amount}`;
        } else {
            // Северные локации
            // Формат: "Бездна / Солнечные поля - 25 <a>кошельков</a>" или "20 <a>котомок</a>"
            const itemMatch = short.match(/<a[^>]*>([^<]+)<\/a>/i);
            if (!itemMatch) return null;
            const itemName = itemMatch[1].trim().toLowerCase();
            const iconType = itemName.includes('сундуч') ? 'archive' : 'sack';

            // С локацией
            const locMatch = short.match(/^([^<]+?)\s*-\s*(\d+)\s*<a/i);
            if (locMatch) {
                const locationsStr = locMatch[1].trim();
                const amount = locMatch[2];
                // Разбиваем по " / " или " или "
                const locations = locationsStr.split(/\s*(?:\/|или)\s*/i).map(s => s.trim()).filter(Boolean);
                return `loc=${encodeURIComponent(locations.join(','))}&amount=${amount}&icon=${iconType}`;
            }

            // Без локации
            const simpleMatch = short.match(/^(\d+)\s*<a/i);
            if (simpleMatch) {
                const amount = simpleMatch[1];
                return `amount=${amount}&icon=${iconType}`;
            }

            return null;
        }
    };

    // Формирует URL для gisaa с параметрами
    const buildVekselUrl = (baseUrl, officialId, short) => {
        const isWest = VEKSEL_OFFICIAL_IDS.has(officialId);
        const isEast = EAST_VEKSEL_OFFICIAL_IDS.has(officialId);
        if (!isWest && !isEast) return baseUrl;

        const params = parseShortToVekselParams(short, isWest);
        if (!params) return baseUrl;

        const separator = baseUrl.includes('?') ? '&' : '?';
        return baseUrl + separator + params;
    };

    const QUEST_META = {
        "8246": { codexId: 10559, short: "" },
        "8248": { codexId: 9142, short: "" },
        "8250": { codexId: 9318, short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
        "8252": { codexId: 10512, short: "Бухта Китобоев или Эфен'Хал - 20 <a href='https://archeagecodex.com/ru/item/43176/' target='_blank'>котомок эфенского странника</a>" },
        "8254": { codexId: 10513, short: "Бухта Китобоев или Эфен'Хал - 60 <a href='https://archeagecodex.com/ru/item/43176/' target='_blank'>котомок эфенского странника</a>" },
        "8256": { codexId: 9100, short: "" },
        "8258": { codexId: 7658, short: "" },
        "8260": { codexId: 6797, short: "" },
        "8262": { codexId: 8998, short: "" },
        "8268": { codexId: 5972, short: "" },
        "8274": { codexId: 10480, short: "" },
        "8282": { codexId: 7154, short: "" },
        "8284": { codexId: 9137, short: "60 <a href='https://archeagecodex.com/ru/item/8318/' target='_blank'>Слиток железа</a>" },
        "8286": { codexId: 8000131, short: "Квест Нуи на 500 очков работы" },
        "8288": { codexId: 10508, short: "Бездна / Солнечные поля - 25 <a href='https://archeagecodex.com/ru/item/40928/' target='_blank'>расшитых жемчугом кошельков</a>" },
        "8290": { codexId: 10509, short: "Бездна / Солнечные поля - 75 <a href='https://archeagecodex.com/ru/item/40928/' target='_blank'>расшитых жемчугом кошельков</a>" },
        "8292": { codexId: 5092, short: "" },
        "8294": { codexId: 7659, short: "" },
        "8296": { codexId: 7817, short: "" },
        "8298": { codexId: 8000058, short: "Лицуха в Нагашар (только обычка)" },
        "8300": { codexId: 5971, short: "03:20 / 07:20 / 11:20 / 15:20 / 19:20 / 23:20" },
        "8314": { codexId: 10564, short: "Ифнир - змея<br/>Пятница в 22:00 / Суббота в 16:00" },
        "8316": { codexId: 8000061, short: "" },
        "8318": { codexId: 9317, short: 'Квест на Космача (портал "Зимний Очаг")' },
        "8320": { codexId: 9152, short: "60 <a href='https://archeagecodex.com/ru/item/16327/' target='_blank'>Сыромятная кожа</a>" },
        "8322": { codexId: 8435, short: 'Портал "Лягушачьи пруды"' },
        "8324": { codexId: 10510, short: "Бездна / Солнечные поля - 8 <a href='https://archeagecodex.com/ru/item/42077/' target='_blank'>фермерских сундучков</a>" },
        "8326": { codexId: 10511, short: "Бездна / Солнечные поля - 25 <a href='https://archeagecodex.com/ru/item/42077/' target='_blank'>фермерских сундучков</a>" },
        "8328": { codexId: 7657, short: "" },
        "8330": { codexId: 7813, short: "" },
        "8336": { codexId: 5144, short: "" },
        "8338": { codexId: 5885, short: "Анталлон на Солнечных полях<br/>01:20 / 05:20 / 09:20 / 13:20 / 17:20 / 21:20" },
        "8340": { codexId: 8000060, short: 'Изи Сады наслаждений с лицухой' },
        "8346": { codexId: 10056, short: "" },
        "8348": { codexId: 11154, short: "Лиловый (армия фантомов)<br/>01:50 / 05:50 / 09:50 / 13:50 / 17:50 / 21:50" },
        "8350": { codexId: 11227, short: "Превратиться в руру и получить билет (в данж идти необязательно)" },
        "8352": { codexId: 9147, short: "60 <a href='https://archeagecodex.com/ru/item/8256/' target='_blank'>Ткань</a>" },
        "8354": { codexId: 8000136, short: "Квест Нуи на 2500 ремесленки" },
        "8356": { codexId: 10506, short: "" },
        "8358": { codexId: 10507, short: "Замок Ош - 10 <a href='https://archeagecodex.com/ru/item/42076/' target='_blank'>резных сундучков</a>" },
        "8360": { codexId: 5091, short: "Замок Ош - 30 <a href='https://archeagecodex.com/ru/item/42076/' target='_blank'>резных сундучков</a>" },
        "8362": { codexId: 9101, short: "Библа, 3-ий босс" },
        "8364": { codexId: 7656, short: "" },
        "8366": { codexId: 9320, short: "" },
        "8372": { codexId: 9297, short: "" },
        "8380": { codexId: 7815, short: "Изи/нормал Сады наслаждений" },
        "8382": { codexId: 10735, short: "Эншака на Солнечных полях<br/>01:20 / 05:20 / 09:20 / 13:20 / 17:20 / 21:20" },
        "8388": { codexId: 9153, short: "100 <a href='https://archeagecodex.com/ru/item/16327/' target='_blank'>Сыромятная кожа</a>" },
        "8390": { codexId: 5062, short: "" },
        "8392": { codexId: 10514, short: "Бухта китобоев / Эфен'Хал - 7 <a href='https://archeagecodex.com/ru/item/43177/' target='_blank'>эфенских сундучков</a>" },
        "8394": { codexId: 10515, short: "Бухта китобоев / Эфен'Хал - 20 <a href='https://archeagecodex.com/ru/item/43177/' target='_blank'>эфенских сундучков</a>" },
        "8396": { codexId: 7155, short: "Нагашар обычка" },
        "8398": { codexId: 9398, short: "100 мобов на Пустоши Корвуса" },
        "8400": { codexId: 7152, short: "" },
        "8402": { codexId: 9102, short: "Библа, последний босс" },
        "8404": { codexId: 9205, short: "" },
        "8414": { codexId: 10952, short: "" },
        "8422": { codexId: 10304, short: "" },
        "8424": { codexId: 9099, short: "Библа, первый босс" },
        "8426": { codexId: 9143, short: "100 <a href='https://archeagecodex.com/ru/item/8337/' target='_blank'>Строительная древесина</a>" },
        "8434": { codexId: 10504, short: "Замок Ош - 30 <a href='https://archeagecodex.com/ru/item/35461/' target='_blank'>полновесных мешочков с серебром</a>" },
        "8436": { codexId: 10505, short: "Замок Ош - 90 <a href='https://archeagecodex.com/ru/item/35461/' target='_blank'>полновесных мешочков с серебром</a>" },
        "8438": { codexId: 8000062, short: "Аль-Харба / Ферма Хадира / Колыбель разрушений / Воющая Бездна / Копи пронизывающего ветра / Арсенал Сожженной крепости" },
        "8448": { codexId: 2943, short: "Кровавый (дневной) разлом - 3-я волна<br/>00:20 / 04:20 / 08:20 / 12:20 / 16:20 / 20:20" },
        "8450": { codexId: 7935, short: "" },
        "8452": { codexId: 7660, short: "" },
        "8470": { codexId: 10739, short: "Призрачный (ночной) разлом - Эншака<br/>02:20 / 06:20 / 10:20 / 14:20 / 18:20 / 22:20" },
        "8478": { codexId: 10423, short: "" },
        "8494": { codexId: 8635, short: "" },
        "8496": { codexId: 9295, short: "" },
        "8498": { codexId: 9294, short: "" },
        "8500": { codexId: 8637, short: "Бухта - Жакар" },
        "8502": { codexId: 7327, short: "50 мобов (100 очков) на Сверкающем побережье" },
        "8504": { codexId: 9296, short: "" },
        "8506": { codexId: 5969, short: "03:20 / 07:20 / 11:20 / 15:20 / 19:20 / 23:20" },
        "8508": { codexId: 8641, short: "Эфен - жаба" },
        "8510": { codexId: 5077, short: "" },
        "8512": { codexId: 8605, short: "" },
        "8514": { codexId: 11096, short: "Луг - Битва хранителей<br/>Суббота и Воскресенье в 18:00" },
        "8516": { codexId: 8000129, short: "" },
        "8518": { codexId: 1415, short: "" },
        "8520": { codexId: 5970, short: "03:20 / 07:20 / 11:20 / 15:20 / 19:20 / 23:20" },
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
                const officialId = parseInt(link.dataset.officialId, 10);
                const short = link.dataset.short || '';
                link.href = buildVekselUrl(VEkselUrlResolved, officialId, short);
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

    const makeLinksRow = ({ codexId, officialId, short, questTitle }) => {
        const row = document.createElement('div');
        row.className = 'tm-links-row';

        if (short) {
            const d = document.createElement('div');
            d.className = 'tm-short';
            d.innerHTML = short;

            // Если в short есть время, добавляем countdown
            const events = parseEventsFromShort(short);
            if (events.length > 0) {
                const countdown = document.createElement('span');
                countdown.className = 'tm-countdown';
                countdown.dataset.events = JSON.stringify(events);
                const seconds = getSecondsUntilNextEvent(events);
                countdown.textContent = seconds != null ? ` (через ${formatCountdown(seconds)})` : '';
                d.appendChild(countdown);
            }

            row.appendChild(d);
        }

        const icons = document.createElement('div');
        icons.className = 'tm-icons';
        row.appendChild(icons);

        const codexTitle = questTitle
            ? `${formatQuestTitle(questTitle)} - ArcheageCodex`
            : 'Открыть задание в ArcheageCodex';

        icons.appendChild(makeIconLink({
            href: `${CODEX_BASE}${codexId}/`,
            iconSrc: ICON_QUEST,
            title: codexTitle,
            className: 'tm-codex-link',
        }));

        if (typeof officialId === 'number' && VEKSEL_OFFICIAL_IDS.has(officialId)) {
            const link = makeIconLink({
                href: buildVekselUrl(VEkselUrlResolved, officialId, short),
                iconSrc: ICON_VEKSEL,
                title: 'Открыть таблицу векселей',
                className: 'tm-veksel-link',
            });
            link.dataset.officialId = officialId;
            link.dataset.short = short || '';
            icons.appendChild(link);
        }

        if (typeof officialId === 'number' && EAST_VEKSEL_OFFICIAL_IDS.has(officialId)) {
            const link = makeIconLink({
                href: buildVekselUrl(VEkselUrlResolved, officialId, short),
                iconSrc: ICON_VEKSEL_EAST,
                title: 'Открыть таблицу векселей',
                className: 'tm-veksel-link',
            });
            link.dataset.officialId = officialId;
            link.dataset.short = short || '';
            icons.appendChild(link);
        }

        return row;
    };

    const makeTaskCard = ({ q, amount, codexId, officialId, short, isDone, showLastDone }) => {
        const item = document.createElement('div');
        item.className = `tasks__item tasks__item--${amount || 1}`;

        if (isDone) {
            item.classList.add(DONE_CLASS);

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

            item.appendChild(done);
        }

        item.appendChild(makeRewardBlock(amount, isDone));
        item.appendChild(makeTaskText(q.description));
        item.appendChild(makeLinksRow({ codexId, officialId, short, questTitle: q.title }));

        return item;
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

        wrapper.appendChild(todayBtn);
        wrapper.appendChild(nav);
        wrapper.appendChild(hideDoneLabel);

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
            const officialId = Number(q.id);
            const meta = QUEST_META?.[officialId] || QUEST_META?.[String(officialId)];
            if (!meta?.codexId) continue;

            const codexId = Number(meta.codexId);
            const short = (meta.short || '').trim();
            const amount = getRewardAmount(q);
            const doneInSlot = isDoneInSelectedSlot(q, selectedDayUtcMs, selectedSegment);

            const card = makeTaskCard({
                q, amount, codexId, officialId, short,
                isDone: doneInSlot,
                showLastDone: doneInSlot,
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

            .tm-short {
                font-size: 12px;
                line-height: 1.25;
                opacity: 0.85;
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
    };

    const observer = new MutationObserver(() => {
        if (document.querySelector('.section.tasks')) {
            observer.disconnect();
            init();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
