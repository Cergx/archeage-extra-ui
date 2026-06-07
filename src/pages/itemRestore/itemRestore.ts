import { pageWindow } from '../../utils/env.js';
import itemRestoreStyles from './itemRestore.scss';
import { ITEMS, GRADES } from '../../data/items.js';
import type { ItemBase } from '../../data/items.js';
import { inferGradeFromCartItemName } from '../cart/cart.js';
import { SERVERS } from '../../data/servers.js';
import { makeSelect, renderSelectedItems } from '../../components/select/select.js';
import { appendReloadBtn } from '../../components/reloadBtn/reloadBtn.js';

// ============================================================
// =================== ITEMRESTORE PAGE ======================
// ============================================================

export interface IRItem {
    world_id: string;
    char_id: string;
    name: string;
    itemid: string;
    type: string;
    grade: string;
    stack: string;
    expire: string;
    reason: string;
    slave_id: string | null;
    npc_id: string | null;
    deleted: string;
    nn: string;
    gi_name: string;
    gi_description: string;
    gi_filename: string;
    gi_refund: string | null;
    gg_id: string;
    color: string;
    bind: string;
    iconurl: string;
    shard_id: number;
    selected?: boolean;
}

interface IRGrade {
    id: number | string;
    name: string;
}

interface IRInfo {
    lastRestored_at?: number;
    restoreIsAvailable?: number;
    restoredByeLastMonth?: number;
}

interface PopupButton {
    label: string;
    icon: string;
    action: (() => void | Promise<void>) | null;
}

interface PopupParams {
    title: string;
    body: string;
    buttons: PopupButton[];
}

type MakeItemIconLinkFn = (params: { item: ItemBase; linked?: boolean; size?: string }) => HTMLElement;

interface ItemRestoreUIDeps {
    makeItemIconLink: MakeItemIconLinkFn;
}

interface InitItemRestoreDeps extends ItemRestoreUIDeps {
    injectItemIconStyles: () => void;
    injectSelectedItemsStyles: () => void;
}

interface RestoreResult {
    status: string;
}

interface RestoreResponse {
    success?: boolean;
    data?: Record<string, RestoreResult>;
    error?: string;
}

interface InterceptedResponses {
    grades: { data?: IRGrade[] } | null;
    info: { data?: IRInfo } | null;
    items: { data?: Record<string, Record<string, IRItem>> } | null;
}

export const IR_URL = {
    grades: '/dynamic/itemrestore/index.php?a=get_item_grades',
    info: '/dynamic/itemrestore/index.php?a=get_restore_info',
    items: '/dynamic/itemrestore/index.php?a=get_user_items',
    restore: '/dynamic/itemrestore/index.php?a=post_restore_items',
};

/**
 * Показывает модальное окно для страницы восстановления.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.body
 * @param {{ label: string, icon: string, action: function|null }[]} params.buttons
 */
export const showItemRestorePopup = ({ title, body, buttons }: PopupParams): void => {
    let src = document.getElementById('tm_ir_popup_src');
    if (!src) {
        src = document.createElement('div');
        src.id = 'tm_ir_popup_src';
        src.style.display = 'none';
        document.body.appendChild(src);
    }

    src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map((btn, i) =>
        `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
    ).join('')}
                </div>
            </div>`;

    pageWindow.popup_open(false, 'tm_ir_popup_src');

    const popupBlock = document.getElementById('popup_block');
    if (popupBlock) {
        popupBlock.querySelectorAll<HTMLAnchorElement>('a[data-tm-btn]').forEach((a: HTMLAnchorElement) => {
            const btn = buttons[parseInt(a.dataset.tmBtn || '', 10)];
            a.addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                pageWindow.popup_close();
                btn.action?.();
            });
        });
    }
};

/**
 * Строит UI страницы восстановления предметов.
 * @param {HTMLElement} container
 * @param {Array<{id: number, name: string}>} grades
 * @param {{lastRestored_at: number, restoreIsAvailable: number, restoredByeLastMonth: number}} info
 * @param {Array<Object>} items
 */
export const buildItemRestoreUI = (container: HTMLElement, grades: IRGrade[], info: IRInfo, items: IRItem[], { makeItemIconLink }: ItemRestoreUIDeps): void => {
    // --- State ---
    const allItems: IRItem[] = items.map(item => ({ ...item, selected: false }));
    const selectedItems: IRItem[] = [];
    let restoredItems = info.restoredByeLastMonth || 0;
    const recoveryLimit = 10;
    const savedPerPage = parseInt(localStorage.getItem('tm_aa_ir_per_page') || '', 10);
    let itemsPerPage = [10, 20, 30].includes(savedPerPage) ? savedPerPage : savedPerPage === 0 ? 0 : 10;
    let filterGrade = -1;
    let findString = '';
    let activePage = 1;
    let sortAsc = false;

    // --- Helpers ---

    /**
     * Маппинг grade из API (строка) → индекс в GRADES.
     * API grade → название из grades API → ищем совпадение title в GRADES.
     * Если не нашли — используем числовое значение grade напрямую.
     * @param {string} apiGrade
     * @returns {number}
     */
    const mapGrade = (apiGrade: string): number => {
        const gradeName = getGradeName(apiGrade);
        if (gradeName !== '-') {
            const idx = GRADES.findIndex(g => g.title === gradeName);
            if (idx !== -1) return idx;
        }
        return parseInt(apiGrade) || 0;
    };

    /**
     * Создаёт объект ItemBase для makeItemIconLink из IRItem.
     * @param {IRItem} item
     * @returns {ItemBase}
     */
    const toItemBase = (item: IRItem): ItemBase => {
        const known = ITEMS[item.type];
        const apiGrade = item.grade != null ? mapGrade(item.grade) : null;
        const inferredGrade = inferGradeFromCartItemName(item.gi_name || known?.name || '');
        const grade = known?.grade ?? apiGrade ?? inferredGrade ?? 1;
        const isGradeInferred = known?.grade == null && apiGrade == null && inferredGrade != null;
        return {
            id: String(item.type || ''),
            icon: item.iconurl || '',
            name: item.gi_name || '',
            description: item.gi_description || '',
            ...known,
            ...(item.iconurl ? { icon: item.iconurl } : {}),
            ...(item.gi_name ? { name: item.gi_name } : {}),
            ...(item.gi_description ? { description: item.gi_description } : {}),
            grade,
            ...(isGradeInferred ? { isGradeInferred: true } : {}),
        };
    };

    const addZero = (n: number): string => n < 10 ? '0' + n : '' + n;

    const formatDate = (ts: number): string => {
        const dt = new Date(ts);
        return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    };

    const formatDateTime = (ts: number): string => {
        const dt = new Date(ts);
        return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()} ${addZero(dt.getHours())}:${addZero(dt.getMinutes())}`;
    };

    const formatDateTimeFull = (ts: number): string => {
        const dt = new Date(ts);
        return `${addZero(dt.getHours())}:${addZero(dt.getMinutes())}:${addZero(dt.getSeconds())} ${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    };

    const getExpireTime = (dateStr: string): string => {
        const expire = Date.parse(dateStr);
        const now = Date.now();
        const hoursAll = (expire - now) / (1000 * 60 * 60);
        const days = Math.floor(hoursAll / 24);
        const hours = Math.round(hoursAll - days * 24);
        return `${days} д. ${hours} ч.`;
    };

    const getGradeName = (id: string): string => {
        const g = grades.find(v => String(v.id) === String(id));
        return g ? g.name : '-';
    };

    const getFilteredItems = (): IRItem[] => {
        const filtered = allItems.filter(v => {
            const gradeOk = filterGrade === -1 || String(v.grade) === String(filterGrade);
            const nameOk = !findString || (v.gi_name && v.gi_name.toLowerCase().includes(findString.toLowerCase()));
            return gradeOk && nameOk;
        });
        const dir = sortAsc ? 1 : -1;
        filtered.sort((a, b) => dir * ((a.deleted || '') > (b.deleted || '') ? 1 : (a.deleted || '') < (b.deleted || '') ? -1 : 0));
        return filtered;
    };

    const getPageItems = (): IRItem[] => {
        const filtered = getFilteredItems();
        if (!itemsPerPage) return filtered;
        const start = (activePage - 1) * itemsPerPage;
        const end = Math.min(start + itemsPerPage, filtered.length);
        return filtered.slice(start, end);
    };

    const getPagesCount = (): number => itemsPerPage ? Math.ceil(getFilteredItems().length / itemsPerPage) : 1;

    // --- Build DOM ---
    const section = document.createElement('section');

    // == Filter ==
    const filterDiv = document.createElement('div');
    filterDiv.className = 'itemrestore__filter';

    const gradeTitle = document.createElement('div');
    gradeTitle.className = 'itemrestore__filter-title';
    gradeTitle.textContent = 'Качество';
    filterDiv.appendChild(gradeTitle);

    const gradeOptions = [{ value: -1, label: 'Не выбрано' }, ...grades.map(g => ({ value: g.id, label: g.name }))];
    const gradeSelectWrapper = makeSelect({
        options: gradeOptions,
        selected: filterGrade,
        onChange: (val: string) => { filterGrade = parseInt(val, 10); activePage = 1; renderTable(); },
    });
    filterDiv.appendChild(gradeSelectWrapper);

    const gradeReset = document.createElement('div');
    gradeReset.className = 'itemrestore__grades-reset';
    filterDiv.appendChild(gradeReset);

    const nameTitle = document.createElement('div');
    nameTitle.className = 'itemrestore__filter-title';
    nameTitle.textContent = 'Название';
    filterDiv.appendChild(nameTitle);

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'itemrestore__input-wrapper';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'itemrestore__filter-name';
    inputWrapper.appendChild(nameInput);
    filterDiv.appendChild(inputWrapper);

    const searchBtn = document.createElement('div');
    searchBtn.className = 'itemrestore__search-btn';
    const searchSpan = document.createElement('span');
    searchSpan.textContent = ' Искать';
    searchBtn.appendChild(searchSpan);
    filterDiv.appendChild(searchBtn);

    section.appendChild(filterDiv);

    // == Panels ==
    const panelWrapper = document.createElement('div');
    panelWrapper.className = 'itemrestore__panel-wrapper';
    const panel = document.createElement('div');
    panel.className = 'itemrestore__panel';

    // -- Left panel --
    const panelLeft = document.createElement('div');
    panelLeft.className = 'itemrestore__panel-left';

    const leftTitle = document.createElement('div');
    leftTitle.className = 'guild_header2 green';
    leftTitle.textContent = 'Удалённые предметы';
    appendReloadBtn(leftTitle);
    panelLeft.appendChild(leftTitle);

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'itemrestore__table-wrapper';
    const table = document.createElement('table');
    table.className = 'itemrestore__table';
    table.cellSpacing = '0';
    table.cellPadding = '0';

    const headerRow = document.createElement('tr');
    headerRow.className = 'itemrestore__table-header';
    const headers = [
        { cls: 'n4', text: '' },
        { cls: 'n1', text: 'Наименование' },
        { cls: 'n5', text: 'До\u00a0удаления' },
        { cls: 'n6', text: 'Персонаж' },
    ];

    const thDate = document.createElement('th');
    thDate.className = 'n2 tm-sortable';
    const thDateText = document.createElement('span');
    thDateText.textContent = 'Удалён';
    const thDateArrow = document.createElement('span');
    thDateArrow.className = 'tm-sort-arrow';
    thDateArrow.textContent = sortAsc ? ' \u25B2' : ' \u25BC';
    thDate.appendChild(thDateText);
    thDate.appendChild(thDateArrow);
    thDate.addEventListener('click', () => {
        sortAsc = !sortAsc;
        thDateArrow.textContent = sortAsc ? ' \u25B2' : ' \u25BC';
        activePage = 1;
        renderTable();
    });
    headerRow.appendChild(thDate);

    for (const h of headers) {
        const th = document.createElement('th');
        if (h.cls) th.className = h.cls;
        th.textContent = h.text;
        headerRow.appendChild(th);
    }

    const tbody = document.createElement('tbody');
    tbody.appendChild(headerRow);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    panelLeft.appendChild(tableWrapper);

    // Footer (pagination + per-page selector)
    const tableFooter = document.createElement('div');
    tableFooter.className = 'tm-table-footer';
    const pagination = document.createElement('div');
    pagination.className = 'itemrestore__pagintation';
    tableFooter.appendChild(pagination);
    const perPageWrap = makeSelect({
        options: [{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 30, label: '30' }, { value: 0, label: 'Все' }],
        selected: itemsPerPage,
        onChange: (val: string) => {
            itemsPerPage = parseInt(val, 10);
            localStorage.setItem('tm_aa_ir_per_page', String(itemsPerPage));
            activePage = 1;
            renderTable();
        },
    });
    tableFooter.appendChild(perPageWrap);
    panelLeft.appendChild(tableFooter);

    panel.appendChild(panelLeft);

    // -- Right panel --
    const panelRight = document.createElement('div');
    panelRight.className = 'itemrestore__panel-right';

    const rightTitle = document.createElement('div');
    rightTitle.className = 'guild_header2 green';
    rightTitle.textContent = 'Список выбранных предметов';
    panelRight.appendChild(rightTitle);

    const selectedContainer = document.createElement('div');
    selectedContainer.className = 'tm-selected-container';
    const selectedList = document.createElement('div');
    selectedList.className = 'tm-selected-list';
    selectedContainer.appendChild(selectedList);
    panelRight.appendChild(selectedContainer);

    const restoreBtn = document.createElement('div');
    restoreBtn.className = 'itemrestore-recovery_btn';
    const restoreBtnSpan = document.createElement('span');
    restoreBtnSpan.textContent = 'Восстановить';
    restoreBtn.appendChild(restoreBtnSpan);
    panelRight.appendChild(restoreBtn);

    panel.appendChild(panelRight);
    panelWrapper.appendChild(panel);
    section.appendChild(panelWrapper);

    // == Info text ==
    const infoRestoredP = document.createElement('p');
    const infoDateP = document.createElement('p');
    section.appendChild(infoRestoredP);
    section.appendChild(infoDateP);

    const updateInfoText = (): void => {
        infoRestoredP.textContent = `За последний календарный месяц восстановлено предметов: ${restoredItems} из ${recoveryLimit} возможных.`;
        infoDateP.textContent = info.lastRestored_at
            ? `Последнее восстановление: ${formatDateTime(info.lastRestored_at * 1000)}`
            : '';
    };
    updateInfoText();

    container.appendChild(section);

    // --- Rendering ---
    const renderTable = (): void => {
        const pageItems = getPageItems();
        while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);

        for (const item of pageItems) {
            const tr = document.createElement('tr');
            if (item.selected) tr.className = 'selected';

            const tdDate = document.createElement('td');
            tdDate.className = 'n2';
            tdDate.textContent = item.deleted ? formatDateTimeFull(Date.parse(item.deleted)) : '';
            tr.appendChild(tdDate);

            const tdCount = document.createElement('td');
            tdCount.className = 'n4';
            tdCount.textContent = parseInt(item.stack) > 1 ? `${item.stack}×` : '';
            tr.appendChild(tdCount);

            const tdName = document.createElement('td');
            tdName.className = 'n1';
            const nameWrap = document.createElement('div');
            nameWrap.className = 'tm-cart-item-name';
            const itemBase = toItemBase(item);
            nameWrap.appendChild(makeItemIconLink({
                item: itemBase,
                linked: true,
                size: 'small',
            }));
            const nameText = document.createElement('span');
            nameText.textContent = item.gi_name || itemBase.name || '';
            if (item.color) {
                nameText.style.color = `#${item.color}`;
            }
            else if (itemBase.grade) {
                nameText.style.color = GRADES[itemBase.grade].color;
            }
            nameWrap.appendChild(nameText);
            tdName.appendChild(nameWrap);
            tr.appendChild(tdName);

            const tdExpire = document.createElement('td');
            tdExpire.className = 'n5';
            tdExpire.textContent = item.expire ? getExpireTime(item.expire) : '';
            tr.appendChild(tdExpire);

            const tdChar = document.createElement('td');
            tdChar.className = 'n6';
            const serverName = SERVERS[item.shard_id] || '';
            tdChar.appendChild(document.createTextNode(item.name || ''));
            if (serverName) {
                const serverSpan = document.createElement('span');
                serverSpan.className = 'tm-server-name';
                serverSpan.textContent = ` (${serverName})`;
                tdChar.appendChild(serverSpan);
            }
            tr.appendChild(tdChar);

            tr.addEventListener('click', () => {
                if (!item.selected) {
                    selectItem(item);
                }
            });

            tbody.appendChild(tr);
        }

        renderPagination();
    };

    const renderPagination = (): void => {
        pagination.innerHTML = '';
        const pagesCount = getPagesCount();

        if (pagesCount > 1) {
            const makeNavButton = (className: string, label: string, title: string, isActive: boolean, onClick: () => void): HTMLDivElement => {
                const btn = document.createElement('div');
                btn.className = 'itemrestore__pagintation-btn ' + className + (isActive ? ' active' : '');
                btn.textContent = label;
                btn.title = title;
                btn.addEventListener('click', onClick);
                return btn;
            };

            const makeEllipsis = (): HTMLDivElement => {
                const ellipsis = document.createElement('div');
                ellipsis.className = 'itemrestore__pagintation-ellipsis';
                ellipsis.textContent = '...';
                return ellipsis;
            };

            const btnFirst = document.createElement('div');
            btnFirst.className = 'itemrestore__pagintation-btn first' + (activePage > 1 ? ' active' : '');
            btnFirst.textContent = '«';
            btnFirst.title = 'Первая страница';
            btnFirst.addEventListener('click', () => { if (activePage > 1) { activePage = 1; renderTable(); } });
            pagination.appendChild(btnFirst);

            const btnPrev = document.createElement('div');
            btnPrev.className = 'itemrestore__pagintation-btn prev' + (activePage > 1 ? ' active' : '');
            btnPrev.textContent = '‹';
            btnPrev.title = 'Предыдущая страница';
            btnPrev.addEventListener('click', () => { if (activePage > 1) { activePage--; renderTable(); } });
            pagination.appendChild(btnPrev);

            const pagesDiv = document.createElement('div');
            pagesDiv.className = 'itemrestore__pagintation-pages';

            const maxVisiblePages = 9;
            let start = Math.max(1, activePage - 4);
            let end = Math.min(pagesCount, activePage + 4);

            if (end - start + 1 < maxVisiblePages) {
                if (start === 1) {
                    end = Math.min(pagesCount, start + maxVisiblePages - 1);
                } else if (end === pagesCount) {
                    start = Math.max(1, end - maxVisiblePages + 1);
                }
            }

            if (start > 1) pagesDiv.appendChild(makeEllipsis());

            for (let i = start; i <= end; i++) {
                const page = document.createElement('div');
                page.className = 'itemrestore__pagintation-page' + (i === activePage ? ' active' : '');
                page.textContent = i;
                const pageNum = i;
                page.addEventListener('click', () => { activePage = pageNum; renderTable(); });
                pagesDiv.appendChild(page);
            }

            if (end < pagesCount) pagesDiv.appendChild(makeEllipsis());
            pagination.appendChild(pagesDiv);

            const btnNext = makeNavButton(
                'next',
                '›',
                'Следующая страница',
                activePage < pagesCount,
                () => { if (activePage < pagesCount) { activePage++; renderTable(); } }
            );
            pagination.appendChild(btnNext);

            const btnLast = makeNavButton(
                'last',
                '»',
                'Последняя страница',
                activePage < pagesCount,
                () => { if (activePage < pagesCount) { activePage = pagesCount; renderTable(); } }
            );
            pagination.appendChild(btnLast);
        }
    };


    const renderSelected = (): void => {
        renderSelectedItems(selectedList, selectedItems, {
            emptyText: 'Выберите предметы для восстановления из списка слева',
            onRemove: (item) => deselectItem(item),
            mapItem: (item) => ({
                iconUrl: item.iconurl || '',
                name: item.gi_name || '',
                itemBase: toItemBase(item),
            }),
        });
        restoreBtn.classList.toggle('active', selectedItems.length > 0);
    };

    // --- Selection ---
    const selectItem = (item: IRItem): void => {
        if (item.selected) return;

        if (restoredItems >= recoveryLimit) {
            showItemRestorePopup({
                title: 'Внимание',
                body: '<p>Достигнут лимит восстановления предметов за текущий месяц.</p>',
                buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
            });
            return;
        }

        if (selectedItems.length + restoredItems >= recoveryLimit) {
            showItemRestorePopup({
                title: 'Внимание',
                body: '<p>Выбранное количество предметов превышает лимит восстановления.</p>',
                buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
            });
            return;
        }

        item.selected = true;
        selectedItems.push(item);
        renderTable();
        renderSelected();
    };

    const deselectItem = (item: IRItem): void => {
        if (!item.selected) return;
        item.selected = false;
        const idx = selectedItems.indexOf(item);
        if (idx !== -1) selectedItems.splice(idx, 1);
        renderTable();
        renderSelected();
    };

    // --- Restore ---
    const restoreItems = (): void => {
        if (selectedItems.length === 0) return;

        showItemRestorePopup({
            title: 'Восстановление предметов',
            body: `<p>Восстановить выбранные предметы (${selectedItems.length} шт.)?</p>`,
            buttons: [
                {
                    label: 'Восстановить', icon: 'ico_done', action: async () => {
                        const ids = selectedItems.map(v => v.itemid);
                        try {
                            const res = await fetch(IR_URL.restore, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(ids),
                            });
                            const json: RestoreResponse = await res.json();

                            if (json && json.success) {
                                let successCount = 0;
                                const results = json.data || {};
                                for (const [id, result] of Object.entries(results)) {
                                    if (result.status === 'ok') {
                                        const allIdx = allItems.findIndex(v => v.itemid == id);
                                        if (allIdx !== -1) allItems.splice(allIdx, 1);
                                        const selIdx = selectedItems.findIndex(v => v.itemid == id);
                                        if (selIdx !== -1) selectedItems.splice(selIdx, 1);
                                        if (allIdx !== -1 && selIdx !== -1) successCount++;
                                    }
                                }
                                restoredItems += successCount;
                                activePage = 1;
                                updateInfoText();
                                renderTable();
                                renderSelected();

                                const resultLines = Object.entries(results).map(([id, r]) => {
                                    const item = items.find(v => v.itemid == id);
                                    const name = item ? item.gi_name : id;
                                    return `${name}: ${r.status === 'ok' ? 'восстановлен' : 'ошибка'}`;
                                });
                                showItemRestorePopup({
                                    title: 'Результат',
                                    body: `<p>${resultLines.join('<br>')}</p>`,
                                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                });
                            } else if (json.error) {
                                showItemRestorePopup({
                                    title: 'Ошибка',
                                    body: `<p>${json.error}</p>`,
                                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                });
                            }
                        } catch (e: unknown) {
                            showItemRestorePopup({
                                title: 'Ошибка',
                                body: `<p>Ошибка сети: ${e instanceof Error ? e.message : String(e)}</p>`,
                                buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                            });
                        }
                    }
                },
                { label: 'Отмена', icon: '', action: null },
            ],
        });
    };

    // --- Events ---
    gradeReset.addEventListener('click', () => {
        if (filterGrade !== -1) activePage = 1;
        filterGrade = -1;
        gradeSelectWrapper.querySelector('select').value = '-1';
        renderTable();
    });

    searchBtn.addEventListener('click', () => {
        findString = nameInput.value.trim();
        activePage = 1;
        renderTable();
    });

    nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            findString = nameInput.value.trim();
            activePage = 1;
            renderTable();
        }
    });

    restoreBtn.addEventListener('click', restoreItems);

    // --- Initial render ---
    renderTable();
    renderSelected();
};

/** Инициализация страницы восстановления предметов. */
/** Инжектит стили для страницы восстановления предметов. */
export const injectItemRestoreStyles = (): void => {
    const style = document.createElement('style');
    style.textContent = itemRestoreStyles;
    document.head.appendChild(style);
};

export const initItemRestore = ({ injectItemIconStyles, injectSelectedItemsStyles, makeItemIconLink }: InitItemRestoreDeps): void => {
    injectItemIconStyles();
    injectSelectedItemsStyles();
    injectItemRestoreStyles();

    // Перехватываем fetch-ответы Vue-приложения
    const intercepted: InterceptedResponses = { grades: null, info: null, items: null };
    let interceptedCount = 0;

    const origFetch = pageWindow.fetch.bind(pageWindow);
    pageWindow.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const res = await origFetch(...args);
        const urlStr = typeof args[0] === 'string' ? args[0] : String(args[0]?.url || args[0]);
        const path = urlStr.split('?')[0] + '?' + (urlStr.split('?')[1] || '');

        if (urlStr.includes('a=get_item_grades')) {
            intercepted.grades = await res.clone().json();
            interceptedCount++;
        } else if (urlStr.includes('a=get_restore_info')) {
            intercepted.info = await res.clone().json();
            interceptedCount++;
        } else if (urlStr.includes('a=get_user_items')) {
            intercepted.items = await res.clone().json();
            interceptedCount++;
        }

        if (interceptedCount === 3) {
            interceptedCount = -1; // prevent re-entry
            tryBuild();
        }

        return res;
    };

    const tryBuild = (): void => {
        const app = document.getElementById('app_itemrestore');
        if (!app) return;

        const grades = intercepted.grades?.data || [];
        const info = intercepted.info?.data || {};
        const items: IRItem[] = [];
        if (intercepted.items?.data) {
            Object.values(intercepted.items.data).forEach(server =>
                Object.values(server).forEach(item => items.push(item))
            );
        }

        app.className = '';
        app.innerHTML = '';
        buildItemRestoreUI(app, grades, info, items, { makeItemIconLink });
    };
};
