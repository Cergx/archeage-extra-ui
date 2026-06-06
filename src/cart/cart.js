import { ITEMS, GRADES, getItemIconUrl } from '../data/items.js';
import { renderSelectedItems } from '../select/select.js';
import { appendReloadBtn, injectReloadBtnStyles } from '../reloadBtn/reloadBtn.js';
import { pageDocument, pageWindow } from '../utils.js';

export { getItemIconUrl };

/**
 * Нормализует название предмета из таблицы корзины.
 * @param {string} itemName
 * @returns {string}
 */
export const normalizeCartItemName = (itemName) => (
    (itemName || '').trim().replace(/\*$/, '').trim().toLowerCase().replace(/\bc\b/g, 'с').replace(/\s+/g, ' ')
);

/**
 * Пытается определить грейд предмета по названию из таблицы корзины.
 * @param {string} itemName
 * @returns {number|null}
 */
export const inferGradeFromCartItemName = (itemName) => {
    const normalized = normalizeCartItemName(itemName);
    if (!normalized) return null;

    for (let grade = GRADES.length - 1; grade >= 0; grade--) {
        const patterns = GRADES[grade].cartNamePatterns || [];
        if (patterns.some(pattern => pattern.test(normalized))) return grade;
    }

    return null;
};

export const CART_GRADE_BY_CAMPAIGN = [
    {
        itemId: [
            45880, 45881, 45882, 45883, 45884, 45885, 45886, // эрнардский мнемоник
            45985, 45986, 45987, 45988, 45989, 45990, 45991, // смотритель тайных архивов
            45887, 45888, 45889, 45890, 47047, 47048, 47049, // заклинатель гримуаров
            47043, 47044, 47045, 47046, 45891, 45892, 45893, // укротитель гримуаров
            45894, 45895, 45896, 45897, 45898, 45899, 45900, // эрнардский архивариус
        ],
        campaign: 'Марафон героев, руру',
        grade: 12,
    },
    {
        itemId: [34684, 34685], // укрепленный аргенитовый кларнет/лютня
        campaign: 'Неверинский марафон героев',
        grade: 8,
    },
];

/**
 * Пытается определить грейд предмета по названию акции в корзине.
 * @param {ItemBase} item
 * @param {string} campaign
 * @returns {number|null}
 */
export const inferGradeFromCartCampaign = (item, campaign) => {
    const normalizedCampaign = normalizeCartItemName(campaign);
    if (!normalizedCampaign) return null;

    const rule = CART_GRADE_BY_CAMPAIGN.find(entry => {
        if (!entry.itemId.includes(item.id)) return false;

        const normalizedRuleCampaign = normalizeCartItemName(entry.campaign);
        return normalizedRuleCampaign && normalizedCampaign.includes(normalizedRuleCampaign);
    });

    return rule?.grade ?? null;
};

/**
 * Убирает грейдовую часть из названия предмета корзины для поиска базового имени в ITEMS.
 * @param {string} itemName
 * @returns {string}
 */
export const stripGradeFromCartItemName = (itemName) => {
    let normalized = normalizeCartItemName(itemName);
    if (!normalized) return '';

    for (const grade of GRADES) {
        for (const pattern of grade.cartNamePatterns || []) {
            normalized = normalized.replace(pattern, '');
        }
    }

    return normalized.trim();
};

/**
 * Возвращает предмет с грейдом, выведенным из названия корзины, если в ITEMS грейд не задан.
 * @param {ItemBase} item
 * @param {string} itemName
 * @param {string} [campaign]
 * @returns {ItemBase}
 */
export const withInferredCartGrade = (item, itemName, campaign = '') => {
    if (item.grade != null) return item;

    const inferredGrade = inferGradeFromCartItemName(itemName) ?? inferGradeFromCartCampaign(item, campaign);
    return {
        ...item,
        grade: inferredGrade ?? 1,
        ...(inferredGrade == null ? {} : { isGradeInferred: true }),
    };
};

/**
 * Находит предмет в ITEMS по названию (name).
 * @param {string} itemName
 * @param {string} [campaign]
 * @returns {ItemBase|null}
 */
export const findItemByName = (itemName, campaign = '') => {
    const normalized = normalizeCartItemName(itemName);
    const normalizedWithoutGrade = stripGradeFromCartItemName(itemName);

    for (const item of Object.values(ITEMS)) {
        const name = normalizeCartItemName(item.name || '');
        if (name === normalized) return withInferredCartGrade(item, itemName, campaign);
    }

    for (const item of Object.values(ITEMS)) {
        const name = normalizeCartItemName(item.name || '');
        if (name === normalizedWithoutGrade) return withInferredCartGrade(item, itemName, campaign);
    }

    return null;
};

/**
 * @typedef {Object} CartItem
 * @property {string} title - Название предмета.
 * @property {number} count - Количество.
 * @property {Date} date - Дата получения.
 * @property {string} itemId - ID предмета (из data-item чекбокса).
 * @property {string} campaign - Название акции.
 * @property {boolean} disabled - Заблокирован (таймер передачи).
 * @property {string} timerText - Текст таймера ("Можно передать через: XXX мин.").
 */

/**
 * @typedef {Object} CartCharacter
 * @property {string} name - Имя персонажа.
 * @property {string} server - Название сервера.
 * @property {string} value - Значение radio (для отправки формы).
 * @property {boolean} enabled - Доступен для выбора.
 */

/**
 * Парсит строки таблицы корзины из DOM.
 * @param {Element} layout - Корневой элемент .cart_layout
 * @returns {CartItem[]}
 */
export const parseCartItems = (layout) => {
    const rows = layout.querySelectorAll('.js-cart-item');
    /** @type {CartItem[]} */
    const items = [];

    for (const row of rows) {
        const checkbox = row.querySelector('input[data-item]');
        if (!checkbox) continue;

        const nameCell = row.querySelector('.js-cart-item-name');
        const title = nameCell?.textContent?.trim() || '';

        const countCell = row.querySelector('td:last-child');
        const countText = (countCell?.textContent?.trim() || '1').replace(/[^\d]/g, '');
        const count = parseInt(countText, 10) || 1;

        const dateCell = row.querySelector('td:first-child');
        const dateStr = dateCell?.textContent?.trim() || '';
        const dp = dateStr.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})$/);
        const date = dp ? new Date(+dp[6], +dp[5] - 1, +dp[4], +dp[1], +dp[2], +dp[3]) : new Date(dateStr);

        const itemId = checkbox.getAttribute('data-item') || '';

        const campaignCell = row.querySelector('td:nth-child(3)');
        // Текст акции — всё до input; текст таймера — после input
        let campaign = '';
        let timerText = '';
        if (campaignCell) {
            for (const node of campaignCell.childNodes) {
                if (node === checkbox) continue;
                const t = (node.textContent || '').trim();
                if (!t) continue;
                if (t.startsWith('(') && t.includes('мин.')) {
                    timerText = t;
                } else {
                    campaign = t;
                }
            }
        }

        const disabled = row.classList.contains('js-disabled');

        items.push({ title, count, date, itemId, campaign, disabled, timerText });
    }

    return items;
};

/**
 * Парсит персонажей из DOM.
 * @param {Element} layout - Корневой элемент .cart_layout
 */
export const parseCartCharacters = (layout) => {
    const labels = layout.querySelectorAll('.char_select label');
    /** @type {CartCharacter[]} */
    const chars = [];

    for (const label of labels) {
        const radio = label.querySelector('input[name="shard_char"]');
        if (!radio) continue;

        const name = label.querySelector('.name')?.textContent?.trim() || '';
        const server = label.querySelector('.info')?.textContent?.trim() || '';
        const value = radio.value || '';
        const enabled = !radio.disabled;

        if (!enabled) continue; // Пропускаем "Нет персонажа"

        chars.push({ name, server, value, enabled });
    }

    return chars;
};

/**
 * Создаёт строку таблицы для предмета корзины.
 * @param {CartItem} cartItem
 * @param {Function} makeItemIconLink
 */
export const makeCartRow = (cartItem, makeItemIconLink) => {
    const tr = pageDocument.createElement('tr');
    tr.className = 'item';
    if (cartItem.disabled) tr.classList.add('disabled');

    // Ячейка: дата
    const tdDate = pageDocument.createElement('td');
    tdDate.className = 'gс_1';
    const d = cartItem.date;
    const pad = (n) => n < 10 ? '0' + n : '' + n;
    tdDate.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    tr.appendChild(tdDate);

    // Ячейка: количество
    const tdCount = pageDocument.createElement('td');
    tdCount.className = 'gс_4';
    tdCount.textContent = cartItem.count > 1 ? `${cartItem.count}×` : '';
    tr.appendChild(tdCount);

    // Ячейка: иконка + название
    const tdName = pageDocument.createElement('td');
    tdName.className = 'gс_2';
    const nameContainer = pageDocument.createElement('div');
    nameContainer.className = 'tm-cart-item-name';

    const itemData = findItemByName(cartItem.title, cartItem.campaign);
    if (itemData) {
        const iconEl = makeItemIconLink({
            item: itemData,
            linked: true,
            size: 'small',
        });
        nameContainer.appendChild(iconEl);
    }

    nameContainer.appendChild(pageDocument.createTextNode(cartItem.title));
    tdName.appendChild(nameContainer);

    tr.appendChild(tdName);

    // Ячейка: акция
    const tdCampaign = pageDocument.createElement('td');
    tdCampaign.className = 'gс_3';
    tdCampaign.textContent = cartItem.campaign;
    if (cartItem.disabled && cartItem.timerText) {
        const timer = pageDocument.createElement('span');
        timer.className = 'tm-cart-timer';
        timer.textContent = cartItem.timerText;
        tdCampaign.appendChild(timer);
    }
    tr.appendChild(tdCampaign);

    return tr;
};

/**
 * Показывает модальное окно в стиле сайта.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.body - HTML-содержимое.
 * @param {{ label: string, icon: string, action: function|null }[]} params.buttons
 */
export const showCartPopup = ({ title, body, buttons }) => {
    // Подготавливаем скрытый div-источник для popup_open
    let src = pageDocument.getElementById('tm_cart_popup_src');
    if (!src) {
        src = pageDocument.createElement('div');
        src.id = 'tm_cart_popup_src';
        src.style.display = 'none';
        pageDocument.body.appendChild(src);
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

    // Используем нативную функцию сайта
    pageWindow.popup_open(false, 'tm_cart_popup_src');

    // Навешиваем обработчики на кнопки внутри попапа
    const popupBlock = pageDocument.getElementById('popup_block');
    if (popupBlock) {
        popupBlock.querySelectorAll('a[data-tm-btn]').forEach(a => {
            const btn = buttons[parseInt(a.dataset.tmBtn)];
            a.addEventListener('click', (e) => {
                e.preventDefault();
                pageWindow.popup_close();
                btn.action?.();
            });
        });
    }
};

/**
 * Строит и инжектит полный UI корзины, используя родные классы сайта.
 * @param {CartItem[]} cartItems
 * @param {CartCharacter[]} characters
 * @param {Element} container - #mr_block_cart
 * @param {Element} origLayout - оригинальный .cart_layout для извлечения разметки персонажей
 * @param {Object} deps
 */
export const buildCartUI = (cartItems, characters, container, origLayout, deps = {}) => {
    void characters;
    const {
        makeItemIconLink,
        renderSelectedItems: renderSelectedItemsFn = renderSelectedItems,
        appendReloadBtn: appendReloadBtnFn = appendReloadBtn,
        fetchText,
        getUidFromCheckUser,
    } = deps;

    container.innerHTML = '';

    const layout = pageDocument.createElement('div');
    layout.className = 'cart_layout';

    const form = pageDocument.createElement('form');
    form.id = 'cart_items_form';
    form.onsubmit = () => false;

    // === Состояние ===
    /** @type {Set<string>} */
    const selectedIds = new Set();
    let selectedChar = '';

    /** @type {Map<string, HTMLTableRowElement>} */
    const rowMap = new Map();

    // === Левая панель ===
    const left = pageDocument.createElement('div');
    left.className = 'cart_left';

    const leftHeader = pageDocument.createElement('div');
    leftHeader.className = 'guild_header2 blue';
    leftHeader.textContent = 'Список доступных предметов';
    appendReloadBtnFn(leftHeader);
    left.appendChild(leftHeader);

    const tableWrapper = pageDocument.createElement('div');
    tableWrapper.className = 'guild_tab_wrapper';

    const table = pageDocument.createElement('table');
    table.className = 'guild_tab no_lines cart_items';
    table.cellSpacing = '0';
    table.cellPadding = '0';

    const thead = pageDocument.createElement('thead');
    const headerRow = pageDocument.createElement('tr');
    for (const [cls, text] of [['gh_1', 'Дата получения'], ['gh_4', ''], ['gh_2', 'Предмет'], ['gh_3', 'Акция']]) {
        const th = pageDocument.createElement('th');
        th.className = cls;
        th.textContent = text;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = pageDocument.createElement('tbody');

    for (const cartItem of cartItems) {
        const tr = makeCartRow(cartItem, makeItemIconLink);
        rowMap.set(cartItem.itemId, tr);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    left.appendChild(tableWrapper);

    // === Правая панель ===
    const right = pageDocument.createElement('div');
    right.className = 'cart_right';

    // Выбранные предметы
    const selectedHeader = pageDocument.createElement('div');
    selectedHeader.className = 'guild_header2 blue';
    selectedHeader.textContent = 'Список выбранных предметов';
    right.appendChild(selectedHeader);

    const selectedOuter = pageDocument.createElement('div');
    selectedOuter.className = 'tm-selected-container';
    const selectedWrap = pageDocument.createElement('div');
    selectedWrap.className = 'tm-selected-list';
    selectedOuter.appendChild(selectedWrap);
    right.appendChild(selectedOuter);

    // Персонажи — берём оригинальный блок .char_select из ответа
    const charsHeader = pageDocument.createElement('div');
    charsHeader.className = 'guild_header2 blue';
    charsHeader.textContent = 'Выберите персонажа';
    right.appendChild(charsHeader);

    const origCharSelect = origLayout.querySelector('.char_select');
    if (origCharSelect) {
        right.appendChild(origCharSelect);

        // Навешиваем свой обработчик выбора
        origCharSelect.querySelectorAll('.js-char').forEach(label => {
            const radio = label.querySelector('input[name="shard_char"]');
            if (!radio || radio.disabled) return;

            label.addEventListener('click', () => {
                selectedChar = radio.value;
                radio.checked = true;
                updateTransferBtn();
            });
        });

        // Подгружаем аватары персонажей из char_list
        (async () => {
            try {
                const uid = await getUidFromCheckUser();
                const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
                const doc = new DOMParser().parseFromString(html, 'text/html');

                /** @type {Map<string, string>} имя → URL лица */
                const faceMap = new Map();
                for (const li of doc.querySelectorAll('li[data-face]')) {
                    const name = li.querySelector('strong')?.textContent?.trim();
                    const face = li.getAttribute('data-face');
                    if (name && face) faceMap.set(name, face);
                }

                origCharSelect.querySelectorAll('label.js-char').forEach(label => {
                    const name = label.querySelector('.name')?.textContent?.trim();
                    const face = faceMap.get(name);
                    if (!face) return;

                    const iconDiv = label.querySelector('div');
                    if (!iconDiv) return;

                    const img = pageDocument.createElement('img');
                    img.className = 'tm-char-face';
                    img.addEventListener('load', () => {
                        img.classList.add('tm-char-face--loaded');
                        label.classList.add('tm-char-face-ready');
                    }, { once: true });
                    img.addEventListener('error', () => { img.classList.add('tm-char-face--error'); });
                    img.src = face;
                    iconDiv.appendChild(img);
                });
            } catch {
                // не критично — аватары просто не появятся
            }
        })();
    }

    // Кнопка "Передать"
    const transferBtn = pageDocument.createElement('span');
    transferBtn.className = 'guild_button1 ico_done';
    transferBtn.innerHTML = '<em></em>Передать';
    transferBtn.style.opacity = '0.5';
    transferBtn.style.pointerEvents = 'none';
    right.appendChild(pageDocument.createElement('br'));
    right.appendChild(transferBtn);

    form.appendChild(left);
    form.appendChild(right);

    const clear = pageDocument.createElement('div');
    clear.className = 'clear';
    form.appendChild(clear);

    layout.appendChild(form);
    container.appendChild(layout);

    // === Логика ===

    const updateTransferBtn = () => {
        const enabled = selectedIds.size > 0 && !!selectedChar;
        transferBtn.style.opacity = enabled ? '' : '0.5';
        transferBtn.style.pointerEvents = enabled ? '' : 'none';
    };

    const renderSelectedList = () => {
        const selectedArray = [...selectedIds].map(id => cartItems.find(i => i.itemId === id)).filter(Boolean);
        renderSelectedItemsFn(selectedWrap, selectedArray, {
            emptyText: 'Выберите предметы для передачи из списка слева',
            onRemove: (cartItem) => deselectItem(cartItem.itemId),
            mapItem: (cartItem) => {
                const itemData = findItemByName(cartItem.title, cartItem.campaign);
                return {
                    iconUrl: '',
                    name: !itemData && cartItem.count > 1 ? `${cartItem.title} ${cartItem.count}×` : cartItem.title,
                    itemBase: itemData || undefined,
                    count: cartItem.count,
                };
            },
        }, makeItemIconLink);
    };

    const selectItem = (id) => {
        selectedIds.add(id);
        const row = rowMap.get(id);
        if (row) row.classList.add('tm-selected');
        renderSelectedList();
        updateTransferBtn();
    };

    const deselectItem = (id) => {
        selectedIds.delete(id);
        const row = rowMap.get(id);
        if (row) row.classList.remove('tm-selected');
        renderSelectedList();
        updateTransferBtn();
    };

    // Клик по строке — выбрать предмет
    for (const cartItem of cartItems) {
        if (cartItem.disabled) continue;
        const row = rowMap.get(cartItem.itemId);
        if (!row) continue;

        row.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            if (selectedIds.has(cartItem.itemId)) return;
            selectItem(cartItem.itemId);
        });
    }

    // Кнопка "Передать" — подтверждение + отправка
    transferBtn.addEventListener('click', () => {
        showCartPopup({
            title: 'Вы уверены?',
            body: '<p>Предметы будут переданы выбранному персонажу</p>',
            buttons: [
                {
                    label: 'Передать',
                    icon: 'ico_done',
                    action: async () => {
                        const allIds = [...selectedIds];
                        const chunks = [];
                        for (let i = 0; i < allIds.length; i += 5) {
                            chunks.push(allIds.slice(i, i + 5));
                        }

                        const messages = [];
                        const transferred = [];

                        try {
                            for (const chunk of chunks) {
                                const fd = new FormData();
                                for (const id of chunk) {
                                    fd.append(`items[${id}]`, 'on');
                                }
                                fd.append('shard_char', selectedChar);

                                const res = await fetch('/dynamic/cart/?a=item_process', {
                                    method: 'POST',
                                    body: fd,
                                });
                                const json = await res.json();

                                if (json.result === 1) {
                                    transferred.push(...chunk);
                                    if (json.msg) messages.push(json.msg);
                                } else {
                                    showCartPopup({
                                        title: 'Ошибка',
                                        body: `<p>${json.msg || 'Неизвестная ошибка'}</p>`,
                                        buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                    });
                                    break;
                                }
                            }

                            for (const id of transferred) {
                                const row = rowMap.get(id);
                                if (row) row.remove();
                                rowMap.delete(id);
                                selectedIds.delete(id);
                                const idx = cartItems.findIndex(i => i.itemId === id);
                                if (idx !== -1) cartItems.splice(idx, 1);
                            }
                            renderSelectedList();
                            updateTransferBtn();

                            if (messages.length > 0) {
                                const body = messages
                                    .flatMap(m => m.split('&nbsp;'))
                                    .filter(Boolean)
                                    .join('<br/>');
                                showCartPopup({
                                    title: 'Результат передачи',
                                    body: `<p>${body}</p>`,
                                    buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                                });
                            }
                        } catch (e) {
                            showCartPopup({
                                title: 'Ошибка',
                                body: `<p>Не удалось выполнить запрос: ${e.message}</p>`,
                                buttons: [{ label: 'Ок', icon: 'ico_done', action: null }],
                            });
                        }
                    },
                },
                { label: 'Отмена', icon: 'ico_cancel', action: null },
            ],
        });
    });

    renderSelectedList();
};

export const initCart = ({
    injectItemIconStyles,
    injectSelectedItemsStyles,
    injectCartStyles,
    makeItemIconLink,
    fetchText,
    getUidFromCheckUser,
}) => {
    injectItemIconStyles();
    injectSelectedItemsStyles();
    injectCartStyles();
    injectReloadBtnStyles();

    const cartObserver = new MutationObserver((mutations, obs) => {
        void mutations;
        const layout = pageDocument.querySelector('.cart_layout');
        if (!layout) return;

        obs.disconnect();

        const cartItems = parseCartItems(layout);
        cartItems.sort((a, b) => b.date - a.date);
        const characters = parseCartCharacters(layout);
        const container = pageDocument.getElementById('mr_block_cart');
        if (!container) return;

        buildCartUI(cartItems, characters, container, layout, {
            makeItemIconLink,
            renderSelectedItems,
            appendReloadBtn,
            fetchText,
            getUidFromCheckUser,
        });
    });

    cartObserver.observe(pageDocument.body, { childList: true, subtree: true });
};
