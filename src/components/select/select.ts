interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectOpts {
    options: SelectOption[];
    selected: string | number;
    onChange: (value: string) => void;
}

export const makeSelect: (opts: SelectOpts) => HTMLDivElement = ({ options, selected, onChange }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'itemrestore__select_wrapper';
    const select = document.createElement('select');
    select.className = 'itemrestore__filter-grades';
    for (const { value, label } of options) {
        const opt = document.createElement('option');
        opt.value = String(value);
        opt.textContent = label;
        if (String(value) === String(selected)) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () => onChange(select.value));
    wrapper.appendChild(select);
    return wrapper;
};

interface MappedItem {
    iconUrl?: string;
    name?: string;
    itemBase?: { id?: number; name?: string };
    count?: number;
}

interface SelectedItemsOpts {
    emptyText: string;
    onRemove: (item: unknown) => void;
    mapItem: (item: unknown) => MappedItem;
}

type MakeItemIconLinkFn = (params: {
    item: MappedItem['itemBase'];
    linked?: boolean;
    size?: 'small' | 'medium';
    count?: number;
}) => HTMLElement;

export const renderSelectedItems: (
    container: HTMLElement,
    items: unknown[],
    opts: SelectedItemsOpts,
    makeItemIconLink: MakeItemIconLinkFn,
) => void = (container, items, { emptyText, onRemove, mapItem }, makeItemIconLink) => {
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
        title.textContent = mapped.name || mapped.itemBase?.name || '';
        nameWrap.appendChild(title);
        entry.appendChild(nameWrap);

        const delBtn = document.createElement('div');
        delBtn.className = 'del_btn';
        delBtn.addEventListener('click', () => onRemove(item));
        entry.appendChild(delBtn);

        container.appendChild(entry);
    }
};
