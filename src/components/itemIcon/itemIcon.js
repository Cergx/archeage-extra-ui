import { getItemIconUrlFromParts } from '../../data/items.js';

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
 * Обновляет src у всех иконок предметов согласно текущему выбору пола.
 */
export const updateRenderedItemIcons = () => {
    document.querySelectorAll('.tm-item-icon-img[data-icon-template]').forEach(img => {
        img.src = getItemIconUrlFromParts(
            img.dataset.iconTemplate || '',
            img.dataset.iconM || '',
            img.dataset.iconF || ''
        );
    });
};
