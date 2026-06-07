import { readSharedValue, writeSharedValue } from '../adapter/env.js';

/** @returns Current Moscow date key in YYYY-MM-DD format. */
export const getMskDateKey: () => string = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
};

export const readSharedJson: <T>(key: string, fallback: T) => T = (key, fallback) => {
    try {
        const value = readSharedValue(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

export const writeSharedJson: (key: string, value: unknown) => void = (key, value) => {
    try {
        writeSharedValue(key, JSON.stringify(value));
    } catch {
        // ignore
    }
};
