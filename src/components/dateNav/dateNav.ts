import {
    getMSKDatePartsFromUtcMs,
    formatDMY,
    isSameDayByTZ,
    isThursdayByTZ,
    getTodayUtcMsByTZ,
} from '../../utils/time.js';
import type { DayUtcMs, Segment, DOMCache, SlotPosition } from '../../pages/marathon/core.js';
import { createCheckbox } from '../checkbox/checkbox.js';

export interface DateNavDeps {
    DOM: DOMCache;
    getSelectedDay: () => DayUtcMs | null;
    getSelectedSegment: () => Segment;
    loadHideDoneState: () => boolean;
    saveHideDoneState: (checked: boolean) => void;
    ensureTasksListEl: () => Element | null;
    getPrevSlot: (day: DayUtcMs | null, seg: Segment) => SlotPosition;
    getNextSlot: (day: DayUtcMs | null, seg: Segment) => SlotPosition;
    applySlot: (day: DayUtcMs, seg: Segment) => void;
    onSelectedDateChanged: () => Promise<void>;
    refreshApiInfo: () => Promise<void>;
    restartAutoRefresh: () => void;
    slotKey: (day: DayUtcMs | null, seg: Segment | null) => string;
    getMinDay: () => DayUtcMs | null;
    getMaxDay: () => DayUtcMs | null;
    getMinSegment: () => Segment;
    getMaxSegment: () => Segment;
}

let deps: DateNavDeps | null = null;

export const initDateNavDeps = (d: DateNavDeps): void => { deps = d; };

export const ensureDateNavInHeader = (): HTMLDivElement | null => {
    if (!deps) return null;
    const { DOM, loadHideDoneState, saveHideDoneState, ensureTasksListEl, getPrevSlot, getNextSlot, applySlot, onSelectedDateChanged, refreshApiInfo, restartAutoRefresh, getSelectedDay, getSelectedSegment } = deps;
    if (DOM.nav && DOM.nav.isConnected) return DOM.nav;
    if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) DOM.tasksHeader = document.querySelector('.section.tasks .tasks__header');
    if (!DOM.tasksHeader) return null;
    let nav = DOM.tasksHeader.querySelector<HTMLDivElement>('.tm-date-nav');
    if (nav) {
        DOM.nav = nav; DOM.label = nav.querySelector('.tm-date-label'); DOM.prevBtn = nav.querySelector('.tm-date-prev'); DOM.nextBtn = nav.querySelector('.tm-date-next'); DOM.todayBtn = nav.querySelector('.tm-date-today');
        return nav;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'tm-nav-wrapper';
    const todayBtn = document.createElement('button');
    todayBtn.className = 'tm-date-btn tm-date-today'; todayBtn.type = 'button'; todayBtn.textContent = 'Сегодня';
    nav = document.createElement('div'); nav.className = 'tm-date-nav';
    const left = document.createElement('button'); left.className = 'tm-date-btn tm-date-prev'; left.type = 'button'; left.textContent = '←';
    const right = document.createElement('button'); right.className = 'tm-date-btn tm-date-next'; right.type = 'button'; right.textContent = '→';
    const label = document.createElement('div'); label.className = 'tm-date-label'; label.textContent = '...';
    nav.appendChild(left); nav.appendChild(label); nav.appendChild(right);
    const hideDone = createCheckbox({
        className: 'tm-hide-done-label',
        label: 'Скрыть выполненные',
        checked: loadHideDoneState(),
        onChange: checked => {
            const listEl = ensureTasksListEl();
            if (listEl) listEl.classList.toggle('tm-hide-done', checked);
            saveHideDoneState(checked);
        },
    });
    const hideDoneLabel = hideDone.root;
    const hideDoneCheckbox = hideDone.input;
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button'; refreshBtn.className = 'tm-refresh-btn'; refreshBtn.title = 'Обновить данные'; refreshBtn.innerHTML = '&#x21bb;';
    DOM.refreshLoader = refreshBtn;
    refreshBtn.addEventListener('click', () => { refreshApiInfo(); restartAutoRefresh(); });
    wrapper.appendChild(todayBtn); wrapper.appendChild(nav); wrapper.appendChild(hideDoneLabel); wrapper.appendChild(refreshBtn);
    DOM.tasksHeader.insertAdjacentElement('afterbegin', wrapper);
    DOM.nav = nav; DOM.label = label; DOM.prevBtn = left; DOM.nextBtn = right; DOM.todayBtn = todayBtn; DOM.hideDoneCheckbox = hideDoneCheckbox;
    const savedState = hideDoneCheckbox.checked;
    hideDoneCheckbox.checked = savedState;
    if (savedState) {
        const listEl = ensureTasksListEl();
        if (listEl) listEl.classList.add('tm-hide-done');
    }
    left.addEventListener('click', async () => { const prev = getPrevSlot(getSelectedDay(), getSelectedSegment()); applySlot(prev.dayUtcMs, prev.segment); await onSelectedDateChanged(); });
    right.addEventListener('click', async () => { const next = getNextSlot(getSelectedDay(), getSelectedSegment()); applySlot(next.dayUtcMs, next.segment); await onSelectedDateChanged(); });
    todayBtn.addEventListener('click', async () => { applySlot(getTodayUtcMsByTZ(), 'auto'); await onSelectedDateChanged(); });
    return nav;
};

export const updateDateNavLabel = (): void => {
    if (!deps) return;
    const { DOM, getSelectedDay, getSelectedSegment } = deps;
    const selectedDayUtcMs = getSelectedDay();
    const selectedSegment = getSelectedSegment();
    if (selectedDayUtcMs == null) return;
    if (!DOM.label) return;
    const parts = getMSKDatePartsFromUtcMs(selectedDayUtcMs);
    const dateStr = formatDMY(parts);
    const isThuDay = isThursdayByTZ(selectedDayUtcMs);
    let suffix = '';
    if (isThuDay && selectedSegment === 'pre') suffix = 'до 09:00';
    else if (isThuDay && selectedSegment === 'post') suffix = 'после 09:00';
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

export const updateDateNavButtons = (): void => {
    if (!deps) return;
    const { DOM, getSelectedDay, getSelectedSegment, slotKey, getMinDay, getMaxDay, getMinSegment, getMaxSegment } = deps;
    const selectedDayUtcMs = getSelectedDay();
    const selectedSegment = getSelectedSegment();
    const MIN_DAY_UTC_MS = getMinDay();
    const MAX_DAY_UTC_MS = getMaxDay();
    const MIN_SEG = getMinSegment();
    const MAX_SEG = getMaxSegment();
    if (selectedDayUtcMs == null) return;
    if (!DOM.prevBtn && !DOM.nextBtn) return;
    const curKey = slotKey(selectedDayUtcMs, selectedSegment);
    const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
    const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;
    if (DOM.prevBtn) DOM.prevBtn.disabled = (minKey != null && curKey <= minKey);
    if (DOM.nextBtn) DOM.nextBtn.disabled = (maxKey != null) && (curKey >= maxKey);
    if (DOM.todayBtn) DOM.todayBtn.disabled = isSameDayByTZ(selectedDayUtcMs, getTodayUtcMsByTZ());
};
