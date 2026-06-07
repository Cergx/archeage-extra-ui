import {
    TZ,
    getServerNowMs,
    getMSKWeekday,
    getMSKTimeOfDaySeconds,
    WEEKDAY_NAMES,
    parseTime,
} from '../../utils/time.js';
import { appendStyleElement } from '../../utils/dom.js';
import { formatCountdown } from '../../utils/events-time.js';
import { EVENTS } from '../../data/events.js';
import { SERVERS } from '../../data/servers.js';
import { ICON_SEX_VALUES, loadIconSex, saveIconSex, loadIconScalePercent, saveIconScalePercent, loadIconScaleBrowserZoom, saveIconScaleBrowserZoom } from '../../data/items.js';
import { createPopup } from '../../components/popup/popup.js';
import eventsStyles from './events.scss';

interface EventQuest {
    id: number;
    title: string;
}

interface EventSchedule {
    timeStart: string;
    timeEnd?: string;
    weekdays?: number[];
    duration?: number;
}

interface EventEntry {
    code: string;
    title: string;
    defaultVisible?: boolean;
    defaultNotifications?: boolean;
    schedule: EventSchedule[];
    locations?: string[];
    quests?: EventQuest[];
}

type EventVisibilityOverrides = Record<string, boolean>;

export interface NotificationState {
    enabled: boolean;
    events: Record<string, boolean>;
    notified: Record<string, boolean>;
}

interface NotificationDeps {
    loadNotificationState: () => NotificationState;
    saveNotificationState: (state: NotificationState) => void;
}

interface EventsPopupDeps extends NotificationDeps {
    loadVekselServerIdOverride: () => string;
    saveVekselServerIdOverride: (serverId: string) => void;
    resolveVekselUrl: () => unknown;
    getVekselAutoOptionText: () => string;
    updateRenderedItemIcons?: () => void;
}

interface EventOccurrence {
    ev: EventEntry;
    evCode: string;
    label: string;
    secondsUntil: number;
    isActive: boolean;
    isBeyond: boolean;
}

type TimerId = ReturnType<typeof setInterval>;

const LS_KEYS = {
    EVENT_VISIBILITY: 'tm_aa_ev_vis',
    NOTIFICATIONS: 'tm_aa_notifications',
};

export const CODEX_QUEST_BASE = 'https://archeagecodex.com/ru/quest/';

export const loadNotificationState = (): NotificationState => {
    try {
        const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                enabled: !!parsed.enabled,
                events: parsed.events || {},
                notified: parsed.notified || {},
            };
        }
    } catch { /* ignore */ }
    return { enabled: false, events: {}, notified: {} };
};

export const saveNotificationState = (state: NotificationState): void => {
    try {
        localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(state));
    } catch { /* ignore */ }
};

// --- Event visibility (localStorage) ---

export const loadEventVisibility = (): EventVisibilityOverrides => {
    try {
        return JSON.parse(localStorage.getItem(LS_KEYS.EVENT_VISIBILITY)) || {};
    } catch {
        return {};
    }
};

export const saveEventVisibility = (overrides: EventVisibilityOverrides): void => {
    try {
        localStorage.setItem(LS_KEYS.EVENT_VISIBILITY, JSON.stringify(overrides));
    } catch { /* ignore */ }
};

export const isEventVisible = (ev: EventEntry, overrides: EventVisibilityOverrides): boolean => {
    if (ev.code in overrides) return overrides[ev.code];
    return !!ev.defaultVisible;
};

const getMSKDateString = (utcMs: number): string => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(new Date(utcMs));
};

const cleanOldNotifiedKeys = (state: NotificationState): void => {
    const today = getMSKDateString(getServerNowMs());
    const keys = Object.keys(state.notified);
    let changed = false;
    for (const key of keys) {
        if (!key.startsWith(today)) {
            delete state.notified[key];
            changed = true;
        }
    }
    if (changed) saveNotificationState(state);
};

const showEventNotification = (ev: EventEntry, entry: EventSchedule): void => {
    const timeLabel = entry.timeEnd ? `${entry.timeStart}–${entry.timeEnd}` : entry.timeStart;
    const location = ev.locations?.length ? ev.locations.join(', ') : '';
    const body = location ? `${timeLabel} — ${location}` : timeLabel;
    try {
        new Notification(ev.title, { body, icon: 'https://aa.cdn.gmru.net/ms/data/old/9d56835cb7de079738b7e95471186c09.png', tag: `aa-ev-${ev.title}-${entry.timeStart}` });
    } catch { /* ignore */ }
};

export const checkEventNotifications = ({
    loadNotificationState,
    saveNotificationState,
}: Partial<NotificationDeps> = {}): void => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const state = loadNotificationState!();
    if (!state.enabled) return;

    cleanOldNotifiedKeys(state);

    const visOverrides = loadEventVisibility();
    const serverNow = getServerNowMs();
    const nowWd = getMSKWeekday(serverNow);
    const nowSec = getMSKTimeOfDaySeconds(serverNow);
    const todayStr = getMSKDateString(serverNow);

    let changed = false;

    for (const ev of EVENTS) {
        const evNotif = ev.code in state.events ? state.events[ev.code] : !!ev.defaultNotifications;
        if (!evNotif) continue;
        if (!isEventVisible(ev, visOverrides)) continue; // скрытые — без уведомлений

        for (const entry of ev.schedule) {
            const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
            if (!isToday) continue;

            const { hours, minutes } = parseTime(entry.timeStart);
            const startSec = hours * 3600 + minutes * 60;
            const diff = startSec - nowSec;

            // 5 минут = 300 секунд, допуск ±30с для интервала проверки
            if (diff >= 270 && diff <= 330) {
                const key = `${todayStr}_${ev.code}_${entry.timeStart}`;
                if (!state.notified[key]) {
                    showEventNotification(ev, entry);
                    state.notified[key] = true;
                    changed = true;
                }
            }
        }
    }

    if (changed) saveNotificationState!(state);
};

// --- Styles ---

export let eventsPopupStylesInjected: boolean = false;

export const injectEventsPopupStyles = (): void => {
    if (eventsPopupStylesInjected) return;
    eventsPopupStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = eventsStyles;
    appendStyleElement(style);
};

// --- Popup logic ---

let eventsOverlay: HTMLDivElement | null = null;
let eventsInterval: TimerId | null = null;
let settingsOverlay: HTMLDivElement | null = null;
let evVisOverrides: EventVisibilityOverrides = {};

let settingsClose: (() => void) | null = null;
let eventsClose: (() => void) | null = null;

export const closeSettingsPopup = (): void => {
    if (settingsClose) { settingsClose(); settingsClose = null; settingsOverlay = null; }
    else if (settingsOverlay) { settingsOverlay.remove(); settingsOverlay = null; }
};

export const closeEventsPopup = (): void => {
    closeSettingsPopup();
    if (eventsInterval) { clearInterval(eventsInterval); eventsInterval = null; }
    if (eventsClose) { eventsClose(); eventsClose = null; eventsOverlay = null; }
    else if (eventsOverlay) { eventsOverlay.remove(); eventsOverlay = null; }
};

export const openSettingsPopup = (onChanged: () => void, {
    loadVekselServerIdOverride,
    saveVekselServerIdOverride,
    resolveVekselUrl,
    getVekselAutoOptionText,
    loadNotificationState,
    saveNotificationState,
    updateRenderedItemIcons = () => {},
}: Partial<EventsPopupDeps> = {}): void => {
    if (settingsOverlay) { closeSettingsPopup(); return; }

    const popup = createPopup({
        panelClass: 'tm-popup-panel--settings',
        title: 'Настройки',
        onClose: () => {
            settingsOverlay = null;
            settingsClose = null;
        },
    });
    settingsOverlay = popup.overlay;
    settingsClose = popup.close;

    // Body
    popup.body.className = 'tm-popup-body tm-popup-body--settings';

    const leftCol = document.createElement('div');
    leftCol.className = 'tm-settings-left';

    const rightCol = document.createElement('div');
    rightCol.className = 'tm-settings-right';

    const serverSection = document.createElement('div');
    serverSection.className = 'tm-settings-section';

    const serverTitle = document.createElement('div');
    serverTitle.className = 'tm-settings-section-title';
    serverTitle.textContent = 'Основной сервер';
    serverSection.appendChild(serverTitle);

    const serverSelect = document.createElement('select');
    serverSelect.className = 'tm-settings-server-select';

    const autoOption = document.createElement('option');
    autoOption.value = '';
    autoOption.dataset.vekselServerAutoOption = '1';
    autoOption.textContent = getVekselAutoOptionText!();
    serverSelect.appendChild(autoOption);

    Object.entries(SERVERS)
        .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
        .forEach(([id, name]: [string, string]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            serverSelect.appendChild(option);
        });

    serverSelect.value = loadVekselServerIdOverride!();
    serverSelect.addEventListener('change', () => {
        saveVekselServerIdOverride!(serverSelect.value);
        resolveVekselUrl!();
    });
    serverSection.appendChild(serverSelect);
    leftCol.appendChild(serverSection);

    const sexSection = document.createElement('div');
    sexSection.className = 'tm-settings-section';

    const sexTitle = document.createElement('div');
    sexTitle.className = 'tm-settings-section-title';
    sexTitle.textContent = 'Пол';
    sexSection.appendChild(sexTitle);

    const sexSelect = document.createElement('select');
    sexSelect.className = 'tm-settings-server-select';

    Object.entries(ICON_SEX_VALUES).forEach(([value, info]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = info.title;
        sexSelect.appendChild(option);
    });

    sexSelect.value = loadIconSex();
    sexSelect.addEventListener('change', () => {
        saveIconSex(sexSelect.value);
        updateRenderedItemIcons();
        onChanged();
    });
    sexSection.appendChild(sexSelect);
    leftCol.appendChild(sexSection);

    const scaleSection = document.createElement('div');
    scaleSection.className = 'tm-settings-section';

    const scaleTitle = document.createElement('div');
    scaleTitle.className = 'tm-settings-section-title';
    scaleTitle.textContent = 'Масштаб всплывашки';
    scaleSection.appendChild(scaleTitle);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'tm-scale-row';

    const scaleInput = document.createElement('input');
    scaleInput.type = 'number';
    scaleInput.className = 'tm-scale-input';
    scaleInput.step = '5';
    scaleInput.min = '10';
    scaleInput.max = '5000';
    scaleInput.value = loadIconScalePercent();

    const scaleSuffix = document.createElement('span');
    scaleSuffix.className = 'tm-scale-suffix';
    scaleSuffix.textContent = '%';

    scaleInput.addEventListener('change', () => {
        const val = parseInt(scaleInput.value, 10);
        if (Number.isFinite(val) && val >= 10 && val <= 5000) {
            saveIconScalePercent(val);
            scaleInput.value = val;
        } else {
            scaleInput.value = loadIconScalePercent();
        }
    });

    scaleRow.appendChild(scaleInput);
    scaleRow.appendChild(scaleSuffix);
    scaleSection.appendChild(scaleRow);

    const zoomCb = document.createElement('input');
    zoomCb.type = 'checkbox';
    zoomCb.className = 'tm-zoom-cb';
    zoomCb.id = 'tm-scale-browser-zoom';
    zoomCb.checked = loadIconScaleBrowserZoom();
    zoomCb.disabled = window.devicePixelRatio === 1;
    zoomCb.addEventListener('change', () => saveIconScaleBrowserZoom(zoomCb.checked));
    const zoomLabel = document.createElement('label');
    zoomLabel.className = 'tm-zoom-label';
    zoomLabel.htmlFor = 'tm-scale-browser-zoom';
    zoomLabel.textContent = 'Масштаб браузера';
    const zoomRow = document.createElement('div');
    zoomRow.className = 'tm-zoom-row';
    zoomRow.appendChild(zoomCb);
    zoomRow.appendChild(zoomLabel);
    scaleSection.appendChild(zoomRow);

    leftCol.appendChild(scaleSection);

    const eventsSection = document.createElement('div');
    eventsSection.className = 'tm-settings-section';

    const eventsTitle = document.createElement('div');
    eventsTitle.className = 'tm-settings-section-title';
    eventsTitle.textContent = 'Отображаемые события';
    eventsSection.appendChild(eventsTitle);

    const ul = document.createElement('ul');
    ul.className = 'tm-ev-settings-list';

    const notifState = loadNotificationState!();

    for (const ev of EVENTS) {
        const li = document.createElement('li');
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isEventVisible(ev, evVisOverrides);
        cb.addEventListener('change', () => {
            if (cb.checked === !!ev.defaultVisible) {
                delete evVisOverrides[ev.code];
            } else {
                evVisOverrides[ev.code] = cb.checked;
            }
            saveEventVisibility(evVisOverrides);
            onChanged();
        });
        const span = document.createElement('span');
        span.textContent = ev.title;
        label.appendChild(cb);
        label.appendChild(span);

        // Колокольчик уведомления
        const bell = document.createElement('button');
        const bellOn = ev.code in notifState.events ? notifState.events[ev.code] : !!ev.defaultNotifications;
        bell.className = 'tm-ev-bell' + (bellOn ? '' : ' tm-ev-bell--off');
        bell.textContent = '🔔';
        bell.title = 'Уведомление за 5 мин';
        bell.addEventListener('click', () => {
            if (typeof Notification === 'undefined') {
                alert('Ваш браузер не поддерживает уведомления.');
                return;
            }
            const toggle = (): void => {
                const s = loadNotificationState!();
                const wasOn = ev.code in s.events ? s.events[ev.code] : !!ev.defaultNotifications;
                const nowOn = !wasOn;
                if (nowOn === !!ev.defaultNotifications) {
                    delete s.events[ev.code];
                } else {
                    s.events[ev.code] = nowOn;
                }
                if (nowOn) s.enabled = true;
                saveNotificationState!(s);
                bell.classList.toggle('tm-ev-bell--off', !nowOn);
                const globalBell = document.querySelector('.tm-popup-btn--bell');
                if (globalBell) globalBell.classList.toggle('tm-popup-btn--bell-off', !s.enabled);
            };
            if (Notification.permission === 'default') {
                Notification.requestPermission().then((perm: NotificationPermission) => {
                    if (perm === 'granted') toggle();
                    else alert('Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.');
                });
                return;
            }
            if (Notification.permission === 'denied') {
                alert('Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.');
                return;
            }
            toggle();
        });

        li.appendChild(bell);
        li.appendChild(label);

        ul.appendChild(li);
    }

    eventsSection.appendChild(ul);
    rightCol.appendChild(eventsSection);
    popup.body.appendChild(leftCol);
    popup.body.appendChild(rightCol);
};

export const openEventsPopup = ({
    loadVekselServerIdOverride,
    saveVekselServerIdOverride,
    resolveVekselUrl,
    getVekselAutoOptionText,
    loadNotificationState,
    saveNotificationState,
    updateRenderedItemIcons = () => {},
}: Partial<EventsPopupDeps> = {}): void => {
    if (eventsOverlay) { closeEventsPopup(); return; }

    injectEventsPopupStyles();
    evVisOverrides = loadEventVisibility();

    const gearBtn = document.createElement('button');
    gearBtn.className = 'tm-popup-btn';
    gearBtn.textContent = '⚙';
    gearBtn.title = 'Настройки отображения';
    gearBtn.addEventListener('click', () => openSettingsPopup(renderTable, {
        loadVekselServerIdOverride: loadVekselServerIdOverride!,
        saveVekselServerIdOverride: saveVekselServerIdOverride!,
        resolveVekselUrl: resolveVekselUrl!,
        getVekselAutoOptionText: getVekselAutoOptionText!,
        loadNotificationState: loadNotificationState!,
        saveNotificationState: saveNotificationState!,
        updateRenderedItemIcons,
    }));

    const bellBtn = document.createElement('button');
    bellBtn.className = 'tm-popup-btn tm-popup-btn--bell';
    bellBtn.textContent = '🔔';
    bellBtn.title = 'Уведомления за 5 минут до событий';
    const updateBellStyle = (): void => {
        const s = loadNotificationState!();
        bellBtn.classList.toggle('tm-popup-btn--bell-off', !s.enabled);
    };
    updateBellStyle();
    bellBtn.addEventListener('click', async () => {
        if (typeof Notification === 'undefined') {
            alert('Ваш браузер не поддерживает уведомления.');
            return;
        }
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
        if (Notification.permission === 'denied') {
            alert('Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.');
            return;
        }
        const state = loadNotificationState!();
        state.enabled = !state.enabled;
        saveNotificationState!(state);
        updateBellStyle();
    });

    const popup = createPopup({
        panelClass: 'tm-popup-panel--events',
        title: 'Расписание событий',
        extraButtons: [gearBtn, bellBtn],
        onClose: () => {
            if (eventsInterval) {
                clearInterval(eventsInterval);
                eventsInterval = null;
            }
            eventsOverlay = null;
            eventsClose = null;
        },
    });
    eventsOverlay = popup.overlay;
    eventsClose = popup.close;

    // Body
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
    popup.body.appendChild(table);

    const DAY_SEC = 86400;

    /** Ключи раскрытых <details> — сохраняются между перерисовками */
    const openDetails = new Set<string>();

    /**
     * Собирает все ближайшие вхождения видимых событий.
     * @returns {{ ev: EventEntry, evCode: string, label: string, secondsUntil: number, isActive: boolean, isBeyond: boolean }[]}
     */
    const collectOccurrences = (): EventOccurrence[] => {
        const serverNow = getServerNowMs();
        const nowWd = getMSKWeekday(serverNow);
        const nowSec = getMSKTimeOfDaySeconds(serverNow);

        const within: EventOccurrence[] = [];
        const beyond: EventOccurrence[] = [];

        for (const ev of EVENTS) {
            if (!isEventVisible(ev, evVisOverrides)) continue;
            let hasWithin = false;
            let nearest: EventOccurrence | null = null;

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
                        within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: -(endSec - nowSec), isActive: true, isBeyond: false });
                        hasWithin = true;
                        continue;
                    }
                } else {
                    // Без timeEnd — подсвечиваем duration минут после старта (по умолчанию 5)
                    const activeDur = (entry.duration ?? 5) * 60;
                    const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
                    if (isToday && nowSec >= startSec && nowSec < startSec + activeDur) {
                        within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: 0, isActive: true, isBeyond: false });
                        hasWithin = true;
                        continue;
                    }
                }

                if (!entry.weekdays?.length) {
                    let diff = startSec - nowSec;
                    if (diff <= 0) diff += DAY_SEC;
                    within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: diff, isActive: false, isBeyond: false });
                    hasWithin = true;
                } else {
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
                        within.push({ ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: false });
                        hasWithin = true;
                    } else if (!nearest || minDiff < nearest.secondsUntil) {
                        nearest = { ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: true };
                    }
                }
            }

            if (!hasWithin && nearest) {
                beyond.push(nearest);
            }
        }

        within.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            if (a.isActive && b.isActive) return b.secondsUntil - a.secondsUntil;
            return a.secondsUntil - b.secondsUntil;
        });
        beyond.sort((a, b) => a.secondsUntil - b.secondsUntil);

        return [...within, ...beyond];
    };

    /** Формирует строки расписания для раскрывающегося списка */
    const buildScheduleLines = (schedule: EventSchedule[]): string[] => {
        const lines: string[] = [];
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

    const summaryText = (occ: EventOccurrence): string => {
        if (occ.isActive && occ.secondsUntil < 0) {
            return `${occ.label} — ещё ${formatCountdown(-occ.secondsUntil)}`;
        } else if (occ.isActive) {
            return occ.label;
        } else {
            return `${occ.label} — через ${formatCountdown(occ.secondsUntil)}`;
        }
    };

    const structureKey = (occs: EventOccurrence[]): string => occs.map(o =>
        `${o.evCode}:${o.label}:${o.isActive}:${o.isBeyond}`
    ).join('|');

    let lastKey = '';
    let summaryEls: HTMLElement[] = [];

    const renderTable = (): void => {
        const occs = collectOccurrences();
        lastKey = structureKey(occs);
        summaryEls = [];
        const frag = document.createDocumentFragment();

        for (const occ of occs) {
            const key = `${occ.evCode}:${occ.label}`;
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
            summary.textContent = summaryText(occ);
            details.appendChild(summary);
            summaryEls.push(summary);

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

    const tickTable = (): void => {
        const occs = collectOccurrences();
        const key = structureKey(occs);

        if (key !== lastKey) {
            renderTable();
            return;
        }

        for (let i = 0; i < occs.length; i++) {
            summaryEls[i].textContent = summaryText(occs[i]);
        }
    };

    renderTable();
    eventsInterval = setInterval(tickTable, 1000);
};
