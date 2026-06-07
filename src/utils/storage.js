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
