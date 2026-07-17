export interface PopupOptions {
    /** CSS class for the panel (e.g. 'tm-popup-panel--settings'). */
    panelClass?: string;
    /** Popup title text. */
    title: string;
    /** Extra buttons to insert after the title (before close button). */
    extraButtons?: HTMLElement[];
    /** z-index for the overlay (default: 10002). */
    zIndex?: string;
    /** Called when popup is closed. */
    onClose?: () => void;
}

export interface PopupHandle {
    overlay: HTMLDivElement;
    panel: HTMLDivElement;
    header: HTMLDivElement;
    body: HTMLDivElement;
    close: () => void;
}

const POPUP_PANEL_CLASS = 'tm-popup-panel';

/**
 * Creates a popup overlay with panel, header (title + close btn), and body.
 * Each popup is independent — multiple popups can be open simultaneously
 * (e.g. settings on top of events).
 */
export const createPopup = (opts: PopupOptions): PopupHandle => {
    const { panelClass, title, extraButtons, zIndex = '10002', onClose } = opts;

    const overlay = document.createElement('div');
    overlay.className = 'tm-popup-overlay';
    overlay.style.zIndex = zIndex;
    overlay.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === overlay) close();
    });

    const panel = document.createElement('div');
    panel.className = `${POPUP_PANEL_CLASS} ${panelClass || ''}`.trim();
    panel.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation());

    const header = document.createElement('div');
    header.className = 'tm-popup-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'tm-popup-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (extraButtons) {
        for (const btn of extraButtons) header.appendChild(btn);
    }

    const close = (): void => {
        overlay.remove();
        onClose?.();
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tm-popup-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'tm-popup-body';
    panel.appendChild(body);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    return { overlay, panel, header, body, close };
};
