import { pageDocument } from '../../utils/env.js';
import { appendStyleElement } from '../../utils/dom.js';
import loaderStyles from './loader.scss';

const LOADER_STYLES_ID = 'tm-loader-styles';

interface LoaderOptions {
    label?: string;
    className?: string;
}

export const injectLoaderStyles = (): void => {
    if (pageDocument.getElementById(LOADER_STYLES_ID)) return;

    const style = pageDocument.createElement('style');
    style.id = LOADER_STYLES_ID;
    style.textContent = loaderStyles;
    appendStyleElement(style);
};

export const makeLoader = ({ label = 'Загрузка', className = '' }: LoaderOptions = {}): HTMLDivElement => {
    injectLoaderStyles();

    const loader = pageDocument.createElement('div');
    loader.className = ['tm-loader', className].filter(Boolean).join(' ');
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-label', label);

    const spinner = pageDocument.createElement('span');
    spinner.className = 'tm-loader__spinner';
    spinner.setAttribute('aria-hidden', 'true');
    loader.appendChild(spinner);

    return loader;
};
