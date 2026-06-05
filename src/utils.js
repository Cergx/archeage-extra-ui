/** Page window object from the userscript page context. */
export const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

/** Page document object from the userscript page context. */
export const pageDocument = pageWindow.document || document;

/** Shared storage key for saved Gisaa veksel availability. */
export const GISAA_VEKSEL_INFO_KEY = 'tm_aa_gisaa_veksel_info_v1';

/** Shared storage key for saved Gisaa table snapshots. */
export const GISAA_VEKSEL_TABLE_KEY = 'tm_aa_gisaa_veksel_table_v1';

/** Moscow timezone identifier. */
export const TZ = 'Europe/Moscow';

/** Moscow fixed UTC offset in hours. */
export const MSK_OFFSET_HOURS = 3;

/** Server-synchronized current timestamp in milliseconds. */
export let NOW_MS = null;

/** Server time offset from local Date.now() in milliseconds. */
export let SERVER_TIME_OFFSET = null;

/** @returns {number|null} Server-synchronized current timestamp in milliseconds. */
export const getNowMs = () => NOW_MS;

/** @param {number|null} value Server-synchronized current timestamp in milliseconds. */
export const setNowMs = (value) => {
    NOW_MS = value;
};

/** @returns {number|null} Server time offset from local Date.now() in milliseconds. */
export const getServerTimeOffset = () => SERVER_TIME_OFFSET;

/** @param {number|null} value Server time offset from local Date.now() in milliseconds. */
export const setServerTimeOffset = (value) => {
    SERVER_TIME_OFFSET = value;
};

/** @returns {string} Current Moscow date key in YYYY-MM-DD format. */
export const getMskDateKey = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
};

/**
 * @param {string} key Storage key.
 * @param {*} fallback Fallback value when no valid value exists.
 * @returns {*} Parsed shared JSON value or fallback.
 */
export const readSharedJson = (key, fallback) => {
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

/**
 * @param {string} key Storage key.
 * @param {*} value Value to serialize into shared storage.
 */
export const writeSharedJson = (key, value) => {
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

/** @param {*} value Gisaa key part value. */
export const normalizeGisaaPart = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * @param {{ type?: string, resourceName?: string, amount?: number|string, iconType?: string, locations?: *[] }} params Veksel attributes.
 * @returns {string} Stable Gisaa veksel key.
 */
export const makeGisaaVekselKey = ({ type, resourceName, amount, iconType, locations }) => {
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

/**
 * @param {string} key Gisaa veksel key.
 * @param {object} info Veksel availability info.
 */
export const saveGisaaVekselInfo = (key, info) => {
    if (!key || !info) return;
    const all = readSharedJson(GISAA_VEKSEL_INFO_KEY, {});
    all[key] = {
        ...info,
        date: getMskDateKey(),
        updatedAt: Date.now(),
    };
    writeSharedJson(GISAA_VEKSEL_INFO_KEY, all);
};

/**
 * @param {string} key Gisaa veksel key.
 * @returns {object|null} Saved veksel info for today.
 */
export const getSavedGisaaVekselInfo = (key) => {
    if (!key) return null;
    const info = readSharedJson(GISAA_VEKSEL_INFO_KEY, {})?.[key];
    if (!info || info.date !== getMskDateKey()) return null;
    if (info.status !== 'available' && info.status !== 'unavailable') return null;
    return info;
};

/** @returns {object|null} Saved Gisaa tables snapshot for today. */
export const getSavedGisaaTablesSnapshot = () => {
    const snapshot = readSharedJson(GISAA_VEKSEL_TABLE_KEY, null);
    if (!snapshot || snapshot.date !== getMskDateKey()) return null;
    return snapshot;
};

/** @param {*} value Text value to normalize. */
export const cleanGisaaText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

/**
 * @param {Element|null} maxCell Gisaa max cell element.
 * @returns {{ text: string, unknown: boolean, amount: number|null, iconType: string|null }} Parsed max cell data.
 */
export const parseGisaaMaxCell = (maxCell) => {
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

/**
 * @param {Element} row Gisaa table row element.
 * @returns {{ location: string, text: string, unknown: boolean, amount: number|null, iconType: string|null }} Parsed row data.
 */
export const parseGisaaRow = (row) => {
    const location = cleanGisaaText(row.querySelector('.row__cell-name .name.fix_size, .name.fix_size')?.textContent);
    const max = parseGisaaMaxCell(row.querySelector('.row__cell-max'));
    return { location, ...max };
};

/**
 * @param {Element} table Gisaa table element.
 * @returns {object[]} Parsed table rows with locations.
 */
export const readGisaaTableRows = (table) => (
    Array.from(table.querySelectorAll('.row-table'))
        .map(parseGisaaRow)
        .filter(row => row.location)
);

/** @returns {{ resources: Record<string, object[]>, north: object[] }} Current Gisaa table snapshot. */
export const readGisaaTablesSnapshot = () => {
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

/** @param {object} snapshot Gisaa tables snapshot to save. */
export const saveGisaaTablesSnapshot = (snapshot) => {
    writeSharedJson(GISAA_VEKSEL_TABLE_KEY, {
        date: getMskDateKey(),
        updatedAt: Date.now(),
        ...snapshot,
    });
};

/** Whether current page is on gisaa.ru. */
export const isGisaaSite = location.hostname.includes('gisaa.ru');

/** Whether current page is on archeage.ru. */
export const isArcheageSite = location.hostname.includes('archeage.ru');

/** Whether current page is the ArcheAge cart page. */
export const isCartPage = isArcheageSite && (location.pathname === '/cart' || location.pathname === '/cart/');

/** Whether current page is the ArcheAge item restore page. */
export const isItemRestorePage = isArcheageSite && (location.pathname === '/itemrestore' || location.pathname === '/itemrestore/');

/** @param {number} n Number to format with two digits. */
export const pad2 = (n) => String(n).padStart(2, '0');

/** @returns {number} Initialized current timestamp in milliseconds. */
export const nowMs = () => {
    if (NOW_MS == null) {
        throw new Error('[ArcheAgeExtraUI] NOW_MS is not initialized');
    }
    return NOW_MS;
};

/** @returns {number} Initialized current Unix timestamp in seconds. */
export const getNowUnix = () => Math.floor(nowMs() / 1000);

/**
 * @param {number} utcMs
 * @returns {{ y: number, m: number, d: number }}
 * */
export const getMSKDatePartsFromUtcMs = (utcMs) => {
    const d = new Date(utcMs);
    const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = fmt.formatToParts(d);
    const y = Number(parts.find(p => p.type === 'year')?.value);
    const m = Number(parts.find(p => p.type === 'month')?.value);
    const day = Number(parts.find(p => p.type === 'day')?.value);
    return { y, m, d: day };
};

/** @param {{ y: number, m: number, d: number }} params */
export const formatDMY = ({ y, m, d }) => `${pad2(d)}.${pad2(m)}.${y}`;

/** @param {number} unixSec */
export const formatTimeMSK = (unixSec) => {
    if (!unixSec) return '';
    return new Intl.DateTimeFormat('ru-RU', {
        timeZone: TZ,
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(unixSec * 1000));
};

/** @param {number} unixSec — Unix-секунды. */
export const dayUtcMsFromUnixByTZ = (unixSec) => {
    const ms = Number(unixSec || 0) * 1000;
    const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
    return Date.UTC(y, m - 1, d, 0, 0, 0);
};

/** @returns {number} Today midnight UTC milliseconds for Moscow date. */
export const getTodayUtcMsByTZ = () => {
    const { y, m, d } = getMSKDatePartsFromUtcMs(nowMs());
    return Date.UTC(y, m - 1, d, 0, 0, 0);
};

/**
 * @param {number} dayUtcMs Day UTC milliseconds.
 * @param {number} deltaDays Day delta.
 */
export const addDaysUtcMs = (dayUtcMs, deltaDays) => dayUtcMs + deltaDays * 86400000;

/**
 * @param {number} dayUtcMs
 * @returns {{ start: number, end: number }} Unix-границы дня в МСК.
 * */
export const getDayBoundsUnix = (dayUtcMs) => {
    const { y, m, d } = getMSKDatePartsFromUtcMs(dayUtcMs);
    const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MSK_OFFSET_HOURS * 3600 * 1000;
    const endMs = startMs + 86400000;
    return { start: Math.floor(startMs / 1000), end: Math.floor(endMs / 1000) };
};

/**
 * @param {number} dayUtcMs
 * @param {number} hourMsk — час МСК (0–23).
 */
export const getUnixForDayAtHour = (dayUtcMs, hourMsk) => {
    const { start } = getDayBoundsUnix(dayUtcMs);
    return start + hourMsk * 3600;
};

/**
 * @param {number} aUtcMs First UTC milliseconds.
 * @param {number} bUtcMs Second UTC milliseconds.
 */
export const isSameDayByTZ = (aUtcMs, bUtcMs) => {
    const a = getMSKDatePartsFromUtcMs(aUtcMs);
    const b = getMSKDatePartsFromUtcMs(bUtcMs);
    return a.y === b.y && a.m === b.m && a.d === b.d;
};

/** @param {number} dayUtcMs Day UTC milliseconds. */
export const isThursdayByTZ = (dayUtcMs) => {
    const w = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
        .format(new Date(dayUtcMs));
    return w === 'Thu';
};

/** @returns {number} Current server timestamp in milliseconds. */
export const getServerNowMs = () => {
    if (SERVER_TIME_OFFSET == null) return Date.now();
    return Date.now() + SERVER_TIME_OFFSET;
};

/** Initializes the server time offset from NOW_MS. */
export const initServerTimeOffset = () => {
    if (NOW_MS != null && SERVER_TIME_OFFSET == null) {
        SERVER_TIME_OFFSET = NOW_MS - Date.now();
    }
};

/** Synchronizes server time from the current page response Date header. */
export const syncServerTime = async () => {
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

/**
 * @param {number} utcMs UTC milliseconds.
 * @returns {number} Moscow weekday, where 1=Пн, ..., 7=Вс.
 */
export const getMSKWeekday = (utcMs) => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
    const dayStr = fmt.format(new Date(utcMs));
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[dayStr] ?? 1;
};

/**
 * @param {number} utcMs UTC milliseconds.
 * @returns {number} Current Moscow time of day in seconds.
 */
export const getMSKTimeOfDaySeconds = (utcMs) => {
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

/** Weekday names for display, where 1=Пн, ..., 7=Вс. */
export const WEEKDAY_NAMES = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс' };

/**
 * @param {string} timeStr Time string in HH:MM format.
 * @returns {{ hours: number, minutes: number }} Parsed time.
 */
export const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h, minutes: m };
};

/**
 * Вычисляет секунды до ближайшего события.
 * Возвращает 0, если событие идёт прямо сейчас; положительное число — секунды до начала; null — нет событий.
 * @param {EventSchedule[]} events
 */
export const getSecondsUntilNextEvent = (events) => {
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
export const formatEventTime = (event) =>
    event.timeEnd ? `${event.timeStart}–${event.timeEnd}` : event.timeStart;

/** @param {EventSchedule[]} events */
export const formatEventsToString = (events) => {
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
export const formatCountdown = (seconds) => {
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
export const updateCountdownEl = (el, seconds) => {
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

/** Game midnight in Moscow time seconds from day start. */
export const GAME_MIDNIGHT_MSK_SECONDS = 2 * 3600 + 20 * 60; // 02:20:00 = 8400с

/** Real seconds in one ArcheAge game day. */
export const GAME_DAY_REAL_SECONDS = 14400; // 4 часа

/** Game seconds advanced per real second. */
export const REAL_TO_GAME_FACTOR = 6; // 1 реальная секунда = 6 игровых

/**
 * @param {number} serverNowMs Server timestamp in milliseconds.
 * @returns {string} Game time in HH:MM format.
 */
export const getGameTime = (serverNowMs) => {
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

/** @returns {number} Today's weekday as zero-based Monday-first value. */
export const getTodayWeekdayMonFirst = () => {
    return (getMSKWeekday(getServerNowMs()) + 6) % 7;
};

/** @param {number[]|undefined} weekdays */
export const formatAvailableWeekdaysStatus = (weekdays) => {
    if (!weekdays?.length) return '';
    return weekdays.includes(getTodayWeekdayMonFirst())
        ? 'Можно сегодня взять'
        : 'Сегодня нельзя взять';
};
