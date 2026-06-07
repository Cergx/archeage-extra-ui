import {
    ITEMS,
    GRADES,
    ITEM_TYPES,
    ITEM_SUB_TYPES,
    EQUIPMENT_SUB_TYPES,
    ICON_OVERLAY,
    HERO_LEVEL_ICON,
    MAX_HERO_LEVEL,
    MAX_LEVEL,
    CODEX_ITEM_URL,
    CODEX_ITEM_ICONS,
    CODEX_IMAGES_BASE,
    GMRU_CDN_ICONS,
    ICON_SEX_VALUES,
    CURRENCY_ICONS,
    loadIconSex,
    saveIconSex,
    getItemIconUrlFromParts,
    getItemIconUrl,
    getItemCodexUrl,
} from '../data/items.js';

export {
    ITEMS,
    GRADES,
    ITEM_TYPES,
    ITEM_SUB_TYPES,
    EQUIPMENT_SUB_TYPES,
    ICON_OVERLAY,
    HERO_LEVEL_ICON,
    MAX_HERO_LEVEL,
    MAX_LEVEL,
    CODEX_ITEM_URL,
    CODEX_ITEM_ICONS,
    CODEX_IMAGES_BASE,
    GMRU_CDN_ICONS,
    ICON_SEX_VALUES,
    CURRENCY_ICONS,
    loadIconSex,
    saveIconSex,
    getItemIconUrlFromParts,
    getItemIconUrl,
    getItemCodexUrl,
};

/** @param {{ href: string, iconSrc: string, title: string, className?: string }} params */
export const makeIconLink = ({ href, iconSrc, title, className }) => {
    const a = document.createElement('a');
    a.className = `tm-icon-link ${className || ''}`.trim();
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = title;

    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = title;
    a.appendChild(img);
    return a;
};

/**
 * Создаёт иконку предмета с рамкой редкости, overlay типа и всплывашкой.
 * Иконка состоит из слоёв: изображение предмета → overlay типа → рамка грейда.
 *
 * @param {Object} params
 * @param {import('../data/items.js').ItemBase} params.item - Предмет.
 * @param {boolean} [params.linked=false] - Создать как `<a>` со ссылкой на ArcheageCodex.
 * @param {'small'|'medium'} [params.size='medium'] - Размер иконки: `'small'` (30px) или `'medium'` (42px).
 * @param {number} [params.count] - Количество предмета (бейдж снизу-справа, показывается при > 1).
 * @param {boolean} [params.noTooltip=false] - Не добавлять всплывашку (для иконки внутри тултипа).
 * @returns {HTMLElement} `.tm-item-icon`
 */
export const makeItemIconLink = ({ item, linked = false, size = 'medium', count, noTooltip = false }) => {
    const icon = document.createElement(linked ? 'a' : 'div');
    icon.className = `tm-item-icon tm-item-icon--${size}`;

    if (linked) {
        icon.href = getItemCodexUrl(item);
        icon.target = '_blank';
        icon.rel = 'noopener noreferrer';
        icon.addEventListener('click', (e) => e.stopPropagation());
    }

    const itemImg = document.createElement('img');
    itemImg.className = 'tm-item-icon-img';
    itemImg.src = getItemIconUrl(item);
    itemImg.dataset.itemId = item.id;
    itemImg.dataset.iconTemplate = item.icon || '';
    itemImg.dataset.iconM = item.iconM || '';
    itemImg.dataset.iconF = item.iconF || '';

    icon.appendChild(itemImg);

    const overlay = ICON_OVERLAY[item.overlay]?.icon;
    // Overlay слой (между иконкой и рамкой редкости)
    if (overlay) {
        const overlayImg = document.createElement('img');
        overlayImg.className = 'tm-item-icon-overlay';
        overlayImg.src = overlay;
        icon.appendChild(overlayImg);
    }

    const gradeInfo = GRADES[item.grade];
    if (gradeInfo) {
        const gradeImg = document.createElement('img');
        gradeImg.className = 'tm-item-icon-grade';
        gradeImg.src = gradeInfo.overlay;
        gradeImg.alt = gradeInfo.title || '';
        icon.appendChild(gradeImg);
    }

    if (count && count > 1) {
        const countEl = document.createElement('div');
        countEl.className = 'tm-item-icon-count';
        countEl.textContent = count;
        icon.appendChild(countEl);
    }

    // Tooltip events are handled by initTooltips() via document-level delegation
    if (!noTooltip) {
        icon.addEventListener('mouseenter', (e) => e.stopPropagation());
        icon.addEventListener('mouseleave', (e) => e.stopPropagation());
    }

    return icon;
};

export const updateRenderedItemIcons = () => {
    document.querySelectorAll('.tm-item-icon-img[data-icon-template]').forEach(img => {
        img.src = getItemIconUrlFromParts(
            img.dataset.iconTemplate || '',
            img.dataset.iconM || '',
            img.dataset.iconF || ''
        );
    });
};
