import { appendStyleElement } from '../../utils/dom.js';
import selectStyles from './select.scss';
import { injectScrollbarStyles } from '../scrollbar/scrollbar.js';

export interface SelectOption {
    value: string | number;
    label: string;
    dataset?: Record<string, string>;
}

export interface SelectOptions {
    options: SelectOption[];
    value?: string | number;
    theme?: 'default' | 'white';
    onChange?: (value: string) => void;
}

let selectStylesInjected = false;
const selectValueSetters = new WeakMap<HTMLDivElement, (value: string | number) => void>();

export const setSelectValue = (select: HTMLDivElement, value: string | number): void => {
    selectValueSetters.get(select)?.(value);
};

const injectSelectStyles = (): void => {
    if (selectStylesInjected) return;
    selectStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = selectStyles;
    appendStyleElement(style);
};

export const createSelect = ({ options, value = '', theme = 'default', onChange }: SelectOptions): HTMLDivElement => {
    injectSelectStyles();
    injectScrollbarStyles();

    const select = document.createElement('div');
    select.className = 'tm-select';
    if (theme === 'white') select.classList.add('tm-select--theme-white');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tm-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'tm-select-menu';
    menu.setAttribute('role', 'listbox');

    const sizer = document.createElement('span');
    sizer.className = 'tm-select-sizer';
    for (const item of options) {
        const label = document.createElement('span');
        label.textContent = item.label;
        sizer.appendChild(label);
    }

    let selectedValue = String(value);
    let activeIndex = Math.max(0, options.findIndex(option => String(option.value) === selectedValue));
    const optionElements: HTMLDivElement[] = [];

    const close = (): void => {
        select.classList.remove('tm-select--open', 'tm-select--opens-up');
        button.setAttribute('aria-expanded', 'false');
    };

    const positionMenu = (): void => {
        select.classList.remove('tm-select--opens-up');
        const selectRect = select.getBoundingClientRect();
        const menuHeight = menu.getBoundingClientRect().height;
        const spaceBelow = window.innerHeight - selectRect.bottom;
        const spaceAbove = selectRect.top;
        select.classList.toggle('tm-select--opens-up', menuHeight + 3 > spaceBelow && spaceAbove > spaceBelow);
    };

    const open = (): void => {
        select.classList.add('tm-select--open');
        button.setAttribute('aria-expanded', 'true');
        positionMenu();
        optionElements[activeIndex]?.scrollIntoView({ block: 'nearest' });
    };

    const update = (): void => {
        optionElements.forEach((element, index) => {
            const selected = String(options[index].value) === selectedValue;
            element.classList.toggle('tm-select-option--selected', selected);
            element.classList.toggle('tm-select-option--active', index === activeIndex);
            element.setAttribute('aria-selected', String(selected));
        });
        button.textContent = options.find(option => String(option.value) === selectedValue)?.label || '';
    };

    const choose = (index: number): void => {
        const option = options[index];
        if (!option) return;
        const changed = selectedValue !== String(option.value);
        selectedValue = String(option.value);
        activeIndex = index;
        update();
        close();
        button.focus();
        if (changed) onChange?.(selectedValue);
    };

    selectValueSetters.set(select, nextValue => {
        const nextIndex = options.findIndex(option => String(option.value) === String(nextValue));
        if (nextIndex === -1) return;
        selectedValue = String(options[nextIndex].value);
        activeIndex = nextIndex;
        update();
    });

    options.forEach((item, index) => {
        const option = document.createElement('div');
        option.className = 'tm-select-option';
        option.textContent = item.label;
        option.setAttribute('role', 'option');
        if (item.dataset) Object.assign(option.dataset, item.dataset);
        option.addEventListener('mouseenter', () => { activeIndex = index; update(); });
        option.addEventListener('click', () => choose(index));
        optionElements.push(option);
        menu.appendChild(option);
    });

    button.addEventListener('click', () => {
        if (select.classList.contains('tm-select--open')) close();
        else open();
    });
    button.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Escape') { close(); return; }
        if (!select.classList.contains('tm-select--open')) {
            open();
        }
        if (event.key === 'ArrowDown') activeIndex = Math.min(options.length - 1, activeIndex + 1);
        if (event.key === 'ArrowUp') activeIndex = Math.max(0, activeIndex - 1);
        if (event.key === 'Enter' || event.key === ' ') { choose(activeIndex); return; }
        update();
        optionElements[activeIndex]?.scrollIntoView({ block: 'nearest' });
    });
    const handleOutsideClick = (event: MouseEvent): void => {
        if (!select.isConnected) {
            document.removeEventListener('mousedown', handleOutsideClick);
            return;
        }
        if (!select.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', handleOutsideClick);

    select.append(sizer, button, menu);
    update();
    return select;
};

interface LegacySelectOptions {
    options: SelectOption[];
    selected: string | number;
    onChange: (value: string) => void;
}

export const makeSelect = ({ options, selected, onChange }: LegacySelectOptions): HTMLDivElement => {
    return createSelect({ options, value: selected, theme: 'white', onChange });
};

interface MappedItem {
    iconUrl?: string;
    name?: string;
    itemBase?: { id?: number; name?: string };
    count?: number;
}

interface SelectedItemsOptions {
    emptyText: string;
    onRemove: (item: unknown) => void;
    mapItem: (item: unknown) => MappedItem;
}

type MakeItemIconLink = (params: {
    item: MappedItem['itemBase'];
    linked?: boolean;
    size?: 'small' | 'medium';
    count?: number;
}) => HTMLElement;

export const renderSelectedItems = (
    container: HTMLElement,
    items: unknown[],
    { emptyText, onRemove, mapItem }: SelectedItemsOptions,
    makeItemIconLink: MakeItemIconLink,
): void => {
    container.innerHTML = '';

    if (items.length === 0) {
        const help = document.createElement('div');
        help.className = 'tm-selected-items-help';
        help.textContent = emptyText;
        container.appendChild(help);
        return;
    }

    for (const item of items) {
        const mapped = mapItem(item);
        const entry = document.createElement('div');
        entry.className = 'tm-selected-item';

        const nameWrap = document.createElement('div');
        nameWrap.className = 'tm-cart-item-name';

        if (mapped.itemBase) {
            nameWrap.appendChild(makeItemIconLink({
                item: mapped.itemBase,
                linked: true,
                size: 'small',
                count: mapped.count,
            }));
        } else if (mapped.iconUrl) {
            const image = document.createElement('img');
            image.width = 24;
            image.height = 24;
            image.src = mapped.iconUrl;
            nameWrap.appendChild(image);
        }

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = mapped.name || mapped.itemBase?.name || '';
        nameWrap.appendChild(title);
        entry.appendChild(nameWrap);

        const deleteButton = document.createElement('div');
        deleteButton.className = 'del_btn';
        deleteButton.addEventListener('click', () => onRemove(item));
        entry.appendChild(deleteButton);
        container.appendChild(entry);
    }
};
