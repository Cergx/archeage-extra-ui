/**
 * Создаёт стилизованный select в обёртке itemrestore__select_wrapper.
 * @param {{ options: Array<{value: string|number, label: string}>, selected: string|number, onChange: (value: string) => void }} opts
 * @returns {HTMLDivElement} обёртка с select внутри
 */
export const makeSelect = ({ options, selected, onChange }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'itemrestore__select_wrapper';
    const select = document.createElement('select');
    select.className = 'itemrestore__filter-grades';
    for (const { value, label } of options) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if (String(value) === String(selected)) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () => onChange(select.value));
    wrapper.appendChild(select);
    return wrapper;
};

// ============================================================
// ============= Общий блок выбранных предметов ==============
// ============================================================

/**
 * Рендерит список выбранных предметов в контейнер.
 * @param {HTMLElement} container - Контейнер для вставки элементов.
 * @param {Array<Object>} items - Массив выбранных предметов.
 * @param {Object} opts
 * @param {string} opts.emptyText - Текст-плейсхолдер, когда список пуст.
 * @param {(item: Object) => void} opts.onRemove - Обработчик удаления предмета.
 * @param {(item: Object) => { iconUrl: string, name: string, itemBase?: ItemBase, count?: number }} opts.mapItem - Маппер предмета в данные для отображения.
 */
export const renderSelectedItems = (container, items, { emptyText, onRemove, mapItem }, makeItemIconLink) => {
    container.innerHTML = '';

    if (items.length === 0) {
        const p = document.createElement('div');
        p.className = 'tm-selected-items-help';
        p.textContent = emptyText;
        container.appendChild(p);
        return;
    }

    for (const item of items) {
        const mapped = mapItem(item);
        const entry = document.createElement('div');
        entry.className = 'tm-selected-item';

        const nameWrap = document.createElement('div');
        nameWrap.className = 'tm-cart-item-name';

        if (mapped.itemBase) {
            const icon = makeItemIconLink({
                item: mapped.itemBase,
                linked: true,
                size: 'small',
                count: mapped.count,
            });
            nameWrap.appendChild(icon);
        } else if (mapped.iconUrl) {
            const img = document.createElement('img');
            img.width = 24;
            img.height = 24;
            img.src = mapped.iconUrl;
            nameWrap.appendChild(img);
        }

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = mapped.name || mapped.itemBase.name || '';
        nameWrap.appendChild(title);
        entry.appendChild(nameWrap);

        const delBtn = document.createElement('div');
        delBtn.className = 'del_btn';
        delBtn.addEventListener('click', () => onRemove(item));
        entry.appendChild(delBtn);

        container.appendChild(entry);
    }
};
