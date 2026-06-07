import {
    getMSKTimeOfDaySeconds,
    getMSKWeekday,
    getServerNowMs,
    parseTime,
    WEEKDAY_NAMES,
} from './time.js';

interface EventSchedule {
    timeStart: string;
    timeEnd?: string;
    weekdays?: number[];
}

/**
 * Вычисляет секунды до ближайшего события.
 * Возвращает 0, если событие идёт прямо сейчас; положительное число — секунды до начала; null — нет событий.
 * @param {EventSchedule[]} events
 */
export const getSecondsUntilNextEvent: (events: EventSchedule[]) => number | null = (events) => {
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
export const formatEventTime: (event: EventSchedule) => string = (event) =>
    event.timeEnd ? `${event.timeStart}–${event.timeEnd}` : event.timeStart;

/** @param {EventSchedule[]} events */
export const formatEventsToString: (events: EventSchedule[]) => string = (events) => {
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
export const formatCountdown: (seconds: number | null) => string = (seconds) => {
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
export const updateCountdownEl: (el: HTMLElement, seconds: number | null) => void = (el, seconds) => {
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
