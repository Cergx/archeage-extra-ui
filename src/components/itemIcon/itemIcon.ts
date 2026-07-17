import { getItemIconUrlFromParts } from '../../data/items.ts';

interface IconLinkParams {
    href: string;
    iconSrc: string;
    title: string;
    className?: string;
}

export const makeIconLink: (params: IconLinkParams) => HTMLAnchorElement = ({ href, iconSrc, title, className }) => {
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

export const updateRenderedItemIcons: () => void = () => {
    document.querySelectorAll<HTMLImageElement>('.tm-item-icon-img[data-icon-template]').forEach(img => {
        img.src = getItemIconUrlFromParts(
            img.dataset.iconTemplate || '',
            img.dataset.iconM || '',
            img.dataset.iconF || ''
        );
    });
};
