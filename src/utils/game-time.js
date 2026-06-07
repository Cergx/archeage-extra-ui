import { pad2, TZ } from './time.js';

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
