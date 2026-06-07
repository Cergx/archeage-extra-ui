import { formatQuestTitle } from '../../pages/marathon/core.js';
import type { Slot, GisaaInfo, MakeLinksRowParams, MakeTaskCardParams, MakeVekselIconLinkParams, VekselType } from '../../pages/marathon/core.js';
import {
    DONE_CLASS,
    JUST_DONE_CLASS,
    formatTimeMSK,
} from '../../pages/marathon/core.js';
import { formatAvailableWeekdaysStatus } from '../../utils/time.js';
import { formatEventsToString, getSecondsUntilNextEvent, updateCountdownEl } from '../../utils/events-time.js';
import {
    CODEX_BASE,
    ICON_QUEST,
    ICON_VEKSEL,
    ICON_VEKSEL_NORTH,
} from '../../data/quests.js';
import { getItemCodexUrl } from '../../data/items.js';
import type {
    buildVekselUrl as BuildVekselUrlFn,
    getGisaaVekselInfoForQuest as GetGisaaVekselInfoForQuestFn,
    makeVekselIconLink as MakeVekselIconLinkFn,
} from '../../pages/marathon/core.js';

// ==================== Вспомогательные компоненты ====================

export const makeRewardBlock = (amount: number, isDone: boolean): HTMLDivElement => {
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

export const makeTaskText = (desc: string): HTMLDivElement => {
    const t = document.createElement('div');
    t.className = 'tasks__item-text';
    t.textContent = desc || '';
    return t;
};

export const makeGisaaStatusLine = (info: GisaaInfo | null): HTMLDivElement | null => {
    if (!info) return null;
    const line = document.createElement('div');
    line.className = `tm-gisaa-status tm-gisaa-status--${info.status}`;
    if (info.status === 'available') {
        const places = (info.locations || []).filter(location => !/^copy$/i.test(String(location).trim())).join(' / ');
        line.textContent = places ? `Сегодня можно выполнить: ${places}` : 'Сегодня можно выполнить';
    } else if (info.status === 'unavailable') line.textContent = 'Сегодня нельзя выполнить';
    else return null;
    return line;
};

// ==================== Строка ссылок ====================

export interface MakeLinksRowDeps {
    buildVekselUrl: typeof BuildVekselUrlFn;
    getGisaaVekselInfoForQuest: typeof GetGisaaVekselInfoForQuestFn;
    makeVekselIconLink: typeof MakeVekselIconLinkFn;
}

export const makeLinksRow = (
    params: MakeLinksRowParams & MakeLinksRowDeps,
): HTMLDivElement => {
    const { id, short, questTitle, slot, veksel, locations, availableWeekdays, schedule, makeItemIconLink, makeIconLink, buildVekselUrl, getGisaaVekselInfoForQuest, makeVekselIconLink } = params;
    const row = document.createElement('div');
    row.className = 'tm-links-row';
    const leftPart = document.createElement('div');
    leftPart.className = 'tm-links-left';
    const item = slot?.item;
    if (item?.id) {
        const hasIcon = item.icon && item.grade;
        if (hasIcon) leftPart.appendChild(makeItemIconLink({ item, linked: true, size: 'small', count: slot!.count }));
        else if (item.name) {
            const nameLink = document.createElement('a');
            nameLink.className = 'tm-item-name-link';
            nameLink.href = getItemCodexUrl(item);
            nameLink.target = '_blank';
            nameLink.rel = 'noopener noreferrer';
            nameLink.textContent = item.name;
            leftPart.appendChild(nameLink);
        }
    }
    const hasLocations = locations && locations.length > 0;
    const hasShort = !!short;
    const availableWeekdaysStatus = formatAvailableWeekdaysStatus(availableWeekdays);
    const hasAvailableWeekdays = !!availableWeekdaysStatus;
    const hasSchedule = schedule && schedule.length > 0;
    const gisaaInfo = getGisaaVekselInfoForQuest(veksel, slot, locations);
    if (hasLocations || hasShort || hasAvailableWeekdays || hasSchedule || gisaaInfo) {
        const infoWrapper = document.createElement('div');
        infoWrapper.className = 'tm-info-wrapper';
        if (hasLocations || hasShort) {
            const infoLine = document.createElement('div');
            infoLine.className = 'tm-info-line';
            if (hasLocations) {
                const locEl = document.createElement('span');
                locEl.className = 'tm-locations';
                locEl.textContent = locations!.join(' / ');
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
        if (hasAvailableWeekdays) {
            const daysEl = document.createElement('div');
            daysEl.className = 'tm-available-days';
            daysEl.textContent = availableWeekdaysStatus;
            infoWrapper.appendChild(daysEl);
        }
        if (hasSchedule) {
            const eventsEl = document.createElement('div');
            eventsEl.className = 'tm-events';
            eventsEl.textContent = formatEventsToString(schedule);
            const countdown = document.createElement('span');
            countdown.className = 'tm-countdown';
            countdown.dataset.schedule = JSON.stringify(schedule);
            const seconds = getSecondsUntilNextEvent(schedule);
            updateCountdownEl(countdown, seconds);
            eventsEl.appendChild(countdown);
            infoWrapper.appendChild(eventsEl);
        }
        const gisaaStatusLine = makeGisaaStatusLine(gisaaInfo);
        if (gisaaStatusLine) infoWrapper.appendChild(gisaaStatusLine);
        leftPart.appendChild(infoWrapper);
    }
    row.appendChild(leftPart);
    const icons = document.createElement('div');
    icons.className = 'tm-icons';
    row.appendChild(icons);
    const codexTitle = questTitle ? `${formatQuestTitle(questTitle)} - ArcheageCodex` : 'Открыть задание в ArcheageCodex';
    if (id) icons.appendChild(makeIconLink({ href: `${CODEX_BASE}${id}/`, iconSrc: ICON_QUEST, title: codexTitle, className: 'tm-codex-link' }));
    if (veksel === 'blue_salt' || veksel === 'north') {
        const link = makeVekselIconLink({ href: buildVekselUrl(veksel, slot, locations), title: 'Открыть таблицу векселей', vekselIcon: veksel === 'blue_salt' ? ICON_VEKSEL : ICON_VEKSEL_NORTH });
        link.classList.add('tm-veksel-link');
        link.dataset.veksel = veksel;
        if (slot) link.dataset.slot = JSON.stringify(slot);
        if (locations) link.dataset.locations = JSON.stringify(locations);
        icons.appendChild(link);
    }
    return row;
};

// ==================== Карточка задания ====================

export interface MakeTaskCardDeps extends MakeLinksRowDeps {
    buildVekselUrl: typeof BuildVekselUrlFn;
    getGisaaVekselInfoForQuest: typeof GetGisaaVekselInfoForQuestFn;
    makeVekselIconLink: typeof MakeVekselIconLinkFn;
}

export const makeTaskCard = (params: MakeTaskCardParams & MakeTaskCardDeps): HTMLDivElement => {
    const { q, amount, id, short, isDone, showLastDone, completionTime, isToday, slot, veksel, locations, availableWeekdays, schedule, animateCompletion = false, makeItemIconLink, makeIconLink, buildVekselUrl, getGisaaVekselInfoForQuest, makeVekselIconLink } = params;
    const card = document.createElement('div');
    card.className = `tasks__item tasks__item--${amount || 1}`;
    if (isDone) {
        card.classList.add(DONE_CLASS);
        if (animateCompletion) {
            card.classList.add(JUST_DONE_CLASS);
            card.addEventListener('animationend', () => { card.classList.remove(JUST_DONE_CLASS); }, { once: true });
        }
        const done = document.createElement('div');
        done.className = 'tasks__item-done';
        const row = document.createElement('div');
        row.className = 'tm-done-row';
        const maxStep = Number(q?.max_completed_step || 0);
        const progress = Number(q?.progress || 0);
        const progressEl = document.createElement('span');
        progressEl.className = 'tm-done-progress';
        if (maxStep === 0 && isToday) progressEl.textContent = 'Можно выполнить повторно';
        else if (maxStep === 0) progressEl.textContent = '';
        else progressEl.textContent = `${progress}/${maxStep}`;
        row.appendChild(progressEl);
        const checkEl = document.createElement('span');
        checkEl.className = 'tm-done-check';
        checkEl.textContent = '✔';
        row.appendChild(checkEl);
        done.appendChild(row);
        if (showLastDone) {
            const time = formatTimeMSK(completionTime || 0);
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
    card.appendChild(makeLinksRow({ id, short, questTitle: q.title, slot, veksel, locations, availableWeekdays, schedule, makeItemIconLink, makeIconLink, buildVekselUrl, getGisaaVekselInfoForQuest, makeVekselIconLink }));
    return card;
};
