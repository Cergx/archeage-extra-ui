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
