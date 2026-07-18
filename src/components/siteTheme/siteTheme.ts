import { appendStyleElement } from '../../utils/dom.js';
import siteThemeStyles from './siteTheme.scss';

export type SiteTheme = 'auto' | 'west' | 'east';

const LS_KEY_SITE_THEME = 'tm_aa_site_theme';
const appliedThemeClasses = new WeakMap<HTMLElement, 'type_b' | 'type_y'>();
let siteThemeStylesInjected = false;

const injectSiteThemeStyles = (): void => {
    if (siteThemeStylesInjected) return;
    siteThemeStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = siteThemeStyles;
    appendStyleElement(style);
};

export const loadSiteTheme = (): SiteTheme => {
    try {
        const value = localStorage.getItem(LS_KEY_SITE_THEME);
        return value === 'west' || value === 'east' ? value : 'auto';
    } catch {
        return 'auto';
    }
};

export const saveSiteTheme = (theme: SiteTheme): void => {
    try {
        localStorage.setItem(LS_KEY_SITE_THEME, theme);
    } catch { /* ignore */ }
};

export const applySiteTheme = (): void => {
    const theme = loadSiteTheme();
    document.querySelectorAll<HTMLElement>('.body_layout').forEach(layout => {
        const previouslyApplied = appliedThemeClasses.get(layout);
        if (previouslyApplied) layout.classList.remove(previouslyApplied);
        appliedThemeClasses.delete(layout);

        const className = theme === 'west' ? 'type_b' : theme === 'east' ? 'type_y' : null;
        if (!className) return;
        layout.classList.add(className);
        appliedThemeClasses.set(layout, className);
    });
};

export const initSiteTheme = (): void => {
    injectSiteThemeStyles();
    applySiteTheme();
};
