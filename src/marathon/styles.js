const DONE_CLASS = 'tm-task-completed';
const JUST_DONE_CLASS = 'tm-task-just-completed';

export let itemIconStylesInjected = false;
export let selectedItemsStylesInjected = false;
export let marathonStylesInjected = false;
export let cartStylesInjected = false;

const getSystemScale = () => window.devicePixelRatio / (window.visualViewport?.scale || 1);

/**
 * Стили для иконок и всплывашек предметов (используются на странице марафона и корзины).
 */
const getItemIconStyles = () => {
    const screenScale = getSystemScale();
    return `
            :root { --tm-screen-scale: ${1 / screenScale}; }
            .tm-item-icon {
                position: relative;
                display: inline-block;
                flex-shrink: 0;
            }

            .tm-item-icon--small {
                width: 30px;
                height: 30px;
                font-size: 11.5px;
            }

            .tm-item-icon--medium {
                width: 42px;
                height: 42px;
                font-size: 11.5px;
            }

            .tm-item-icon::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                opacity: 0;
                box-shadow:
                    inset 0 0 12px rgba(255, 255, 255, 0.35),
                    inset 0 0 4px rgba(255, 255, 255, 0.6);
            }

            .tm-item-icon:hover::after {
                opacity: 1;
            }

            .tm-item-icon-img {
                position: relative;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
            }

            .tm-item-icon-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: auto;
            }

            .tm-item-icon-grade {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .tm-item-icon-count {
                position: absolute;
                right: 9%;
                bottom: 12.5%;
                line-height: 0.5;
                letter-spacing: 0.02em;
                color: #fff;
                text-shadow: -1px -2px 2px #000, 1px 1px 2px #000;
                pointer-events: none;
                z-index: 3;
            }

            /* Всплывашка предмета (глобальная, в body) */
            .tm-item-tooltip {
                display: none;
                position: fixed;
                top: var(--tm-tooltip-top, 0);
                left: var(--tm-tooltip-left, 0);
                z-index: 10000;
                box-sizing: border-box;
                width: 248px;
                padding: 15px 15px 14px;
                background: rgba(0, 8, 24, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.25);
                pointer-events: none;
                white-space: normal;
                font-family: Calibri, Arial, Verdana, Tahoma;
                font-size: 14px;
                line-height: 18px;
                color: #cfd6e0;
                transform: translateX(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: top right;
            }

            .tm-item-tooltip--visible {
                display: block;
            }

            .tm-item-tooltip--right {
                transform: scale(var(--tm-tooltip-scale, 1));
                transform-origin: top left;
            }

            .tm-item-tooltip--bottom {
                transform: translateX(-100%) translateY(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: bottom right;
            }

            .tm-item-tooltip--bottom.tm-item-tooltip--right {
                transform: translateY(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: bottom left;
            }

            .tm-item-tooltip-header {
                display: flex;
                gap: 6px;
                align-items: flex-start;
                padding: 0;
            }

            .tm-item-tooltip-header > .tm-item-icon {
                flex-shrink: 0;
            }

            .tm-item-tooltip-meta {
                display: flex;
                flex-direction: column;
                padding: 6px 0 2px;
            }

            .tm-item-tooltip-type {
                opacity: 0.7;
            }

            .tm-item-tooltip-grade {
            }

            .tm-item-tooltip-name {
                font-size: 16px;
                line-height: 20px;
            }

            .tm-item-tooltip-sep {
                height: 2px;
                margin: 4px 0;
                background: linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.10));
                -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                padding: 0;
            }

            .tm-item-tooltip-req {
                padding: 0 3px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-level {
                display: flex;
                align-items: center;
            }

            .tm-item-tooltip-hero-level-icon {
                width: 16px;
                height: 16px;
                margin: 0 2px;
                flex: 0 0 auto;
            }

            .tm-item-tooltip-stats {
                padding: 0 3px;
                display: flex;
                flex-direction: column;
                gap: 1px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-stat-row {
                display: flex;
                gap: 4px;
            }

            .tm-item-tooltip-stat-value {
                color: #cfd6e0;
                text-align: right;
            }

            .tm-item-tooltip-equipment-subtype {
                padding: 0 3px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-desc {
                padding: 4px 3px 2px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .tm-item-tooltip-use-label {
                color: #888;
            }

            .tm-item-tooltip-use-text {
                color: #4caf50;
            }

            .tm-item-tooltip-price {
                padding: 0 3px;
                display: grid;
                grid-template-columns: min-content 1fr;
                gap: 8px;
            }
            .tm-item-tooltip-price--none {
                display: block;
                color: #d02e2e;
            }
            .tm-item-tooltip-price-value {
                color: #cfd6e0;
                display: inline-flex;
                align-items: center;
                justify-content: flex-end;
                flex-wrap: wrap;
                gap: 4px;
                text-align: right;
            }
            .tm-item-tooltip-price-part {
                display: inline-flex;
                align-items: center;
                gap: 2px;
                white-space: nowrap;
            }
            .tm-item-tooltip-price-icon {
                width: 16px;
                height: 16px;
                flex: 0 0 auto;
            }

            .orange_text,
            .inv-nc,
            .inv-nn,
            .inv-buffvar {
                color: #ff9c27;
            }

            .light_blue_text,
            .inv-nd {
                color: #74b0ca;
            }

            .blue_text,
            .inv-ni {
                color: #27b1c6;
            }

            .red_text,
            .inv-nr {
                color: #de482f;
            }
        `;
};

/**
 * Стили для страницы марафона.
 */
const getMarathonStyles = () => `
        .${DONE_CLASS} {
            background-color: #fff0e2bf;
        }

        /* Анимация "только что выполнено" */
        @keyframes tm-just-completed-glow {
            0% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7), inset 0 0 20px rgba(76, 175, 80, 0.3);
                transform: scale(1);
            }
            15% {
                box-shadow: 0 0 25px 8px rgba(76, 175, 80, 0.6), inset 0 0 30px rgba(76, 175, 80, 0.4);
                transform: scale(1.02);
            }
            30% {
                box-shadow: 0 0 35px 12px rgba(255, 215, 0, 0.5), inset 0 0 40px rgba(255, 215, 0, 0.3);
                transform: scale(1.03);
            }
            50% {
                box-shadow: 0 0 20px 6px rgba(76, 175, 80, 0.4), inset 0 0 25px rgba(76, 175, 80, 0.2);
                transform: scale(1.01);
            }
            100% {
                box-shadow: 0 0 0 0 transparent, inset 0 0 0 transparent;
                transform: scale(1);
            }
        }

        @keyframes tm-just-completed-bg {
            0% { background-color: #fff0e2bf; }
            20% { background-color: rgba(76, 175, 80, 0.35); }
            40% { background-color: rgba(255, 215, 0, 0.3); }
            60% { background-color: rgba(76, 175, 80, 0.25); }
            100% { background-color: #fff0e2bf; }
        }

        @keyframes tm-checkmark-pop {
            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
            50% { transform: scale(1.4) rotate(10deg); opacity: 1; }
            70% { transform: scale(0.9) rotate(-5deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        .${JUST_DONE_CLASS} {
            animation:
                tm-just-completed-glow 2s ease-out forwards,
                tm-just-completed-bg 2s ease-out forwards;
            position: relative;
            z-index: 9;
        }

        .${JUST_DONE_CLASS} .tm-done-check {
            animation: tm-checkmark-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            animation-delay: 0.2s;
            transform: scale(0);
        }

        .tasks__item {
            overflow: visible;
        }

        .tasks__item-done {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            pointer-events: none;
            opacity: 0.8;
        }

        .tm-done-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .tm-done-time {
            font-size: 12px;
        }

        .tm-done-progress {
            font-size: 12px;
        }

        .tm-done-check {
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
            color: #3cb45a;
        }

        .tm-links-row {
            margin-top: 6px;
            display: flex;
            gap: 4px;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
        }

        .tm-links-left {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }

        .tm-item-name-link {
            font-size: 12px;
            color: inherit;
            opacity: 0.85;
            text-decoration: none;
        }

        .tm-item-name-link:hover {
            opacity: 1;
            text-decoration: underline;
        }

        .tm-info-wrapper {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .tm-info-line {
            display: flex;
            align-items: baseline;
            gap: 6px;
        }

        .tm-locations {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-short {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-available-days {
            font-size: 12px;
            line-height: 1.25;
            color: #8a6230;
            font-weight: 600;
        }

        .tm-gisaa-status {
            font-size: 12px;
            line-height: 1.25;
            font-weight: 600;
        }

        .tm-gisaa-status--available {
            color: #3f8f3a;
        }

        .tm-gisaa-status--unavailable {
            color: #b04a44;
        }

        .tm-short a {
            color: inherit;
        }

        .tm-events {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-inline-icon {
            display: inline-block;
            position: relative;
            width: 18px;
            height: 18px;
            vertical-align: middle;
            margin: 0 2px;
        }

        .tm-inline-icon img:first-child {
            width: 100%;
            height: 100%;
            display: block;
        }

        .tm-inline-icon-grade {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .tm-countdown {
            font-weight: 500;
            white-space: nowrap;
        }
        .tm-countdown.tm-countdown--active {
            color: #4caf50;
        }
        .tm-countdown.tm-countdown--waiting {
            color: #d02e2e;
        }

        .tm-icons {
            display: flex;
            flex-direction: row-reverse;
            gap: 8px;
            align-items: center;
            flex: 0 0 auto;
        }

        .tm-icon-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: rgba(255,255,255,0.06);
            transition: box-shadow 150ms ease, opacity 150ms ease;
        }

        .tm-icon-link:hover {
            transform: translateY(-1px);
        }

        .tm-icon-link img {
            width: 30px;
            display: block;
        }

        .tm-veksel-icon-link {
            position: relative;
            display: inline-block;
            width: 30px;
            height: 30px;
            flex-shrink: 0;
            transition: transform 120ms ease, opacity 120ms ease;
        }

        .tm-veksel-icon-link:hover {
            transform: translateY(-1px);
            opacity: 1;
        }

        .tm-veksel-icon-main {
            width: 100%;
            height: 100%;
            display: block;
        }

        .tm-veksel-icon-badge {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 18px;
            height: 18px;
            border-radius: 2px;
            background: rgba(0, 0, 0, 0.6);
        }

        .tm-nav-wrapper {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .tm-date-nav {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        @media (max-width: 1300px) {
            .tm-nav-wrapper {
                padding: 0 20px;
            }
        }

        .tm-date-btn {
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255,0.18);
            background: rgba(255, 255, 255, 0.06);
            color: inherit;
            font: inherit;
            font-size: 14px;
            text-transform: uppercase;
        }

        .tm-date-btn:hover {
            background: rgba(255, 255, 255, 0.10);
        }

        .tm-date-label {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 150px;
            text-align: center;
        }

        .tm-date-label-date {
            font-size: 16px;
        }

        .tm-date-label-suffix {
            font-size: 12px;
            opacity: 0.75;
            line-height: 1;
        }

        .tasks__header {
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 16px;
        }

        .tm-date-btn:disabled {
            opacity: 0.35;
            cursor: default;
        }

        .tm-hide-done-label {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        .tm-hide-done-label:hover {
            opacity: 1;
        }

        .tm-hide-done-checkbox {
            cursor: pointer;
        }

        .tm-hide-done .${DONE_CLASS} {
            display: none;
        }

        .tm-refresh-btn {
            width: 26px;
            height: 26px;
            padding: 0;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.7);
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            transition: background 150ms ease, color 150ms ease, transform 150ms ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .tm-refresh-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.95);
        }

        .tm-refresh-btn:active {
            transform: scale(0.92);
        }

        .tm-refresh-loader--active {
            pointer-events: none;
            animation: tm-spin 0.7s linear infinite;
        }

        @keyframes tm-spin {
            to {
                transform: rotate(360deg);
            }
        }

        /* Автозабор подарков */
        .prizes__title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .tm-auto-claim-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }

        .tm-auto-claim-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        /* Автооткрытие сундуков */
        .lootbox__title {
            gap: 30px;
            flex-wrap: wrap;
        }

        .lootbox__title .icon-info {
            margin-left: 0;
        }

        .tm-auto-open-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            text-transform: none;
        }

        .tm-auto-open-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .pagination__item--ellipsis {
            cursor: default;
            color: #777;
        }
    `;

/**
 * Стили для страницы корзины.
 */
const getCartStyles = () => `
        #block_content {
            overflow: unset;
        }

        .cart_right {
            position: sticky;
            top: 0;
        }

        .guild_tab.cart_items .gh_1,
        .guild_tab.cart_items .gс_1 {
            width: 1%;
        }

        .guild_tab.cart_items .gh_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .gh_3 {
            width: 1px;
            min-width: 170px;
            border-right: none;
        }

        .guild_tab.cart_items .gh_4 {
            width: 1%;
        }

        .guild_tab.cart_items .gс_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .gс_4 {
            white-space: nowrap;
            text-align: right;
            border-right: none;
            width: 1%;
        }

        .cart_items .item:hover {
            background: #edf4fa;
        }

        .cart_items .item.disabled:hover {
            background: transparent;
        }

        .cart_items .item.tm-selected {
            display: none;
        }


        .tm-cart-timer {
            display: block;
        }

        .tm-char-face {
            width: 100%;
            height: 100%;
            /*border-radius: 50%;*/
            opacity: 0;
            -webkit-mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent),
                                linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);
            -webkit-mask-composite: destination-in;
            mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent),
                        linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);
            mask-composite: intersect;
            filter: brightness(1.1);
            mix-blend-mode: multiply;
        }

        .tm-char-face--loaded {
            opacity: 1;
        }

        .tm-char-face--error {
            opacity: 0;
        }

        .tm-char-face-ready div {
            background: none !important;
        }
    `;

/** Инжектит стили для иконок предметов (используется на cart и marathon). */
export const injectItemIconStyles = () => {
    if (itemIconStylesInjected) return;
    itemIconStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = getItemIconStyles();
    document.head.appendChild(style);
};

/** Инжектит стили для страницы марафона. */
export const injectMarathonStyles = () => {
    if (marathonStylesInjected) return;
    marathonStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = getMarathonStyles();
    document.head.appendChild(style);
};

/** Инжектит стили для страницы корзины. */
export const injectCartStyles = () => {
    if (cartStylesInjected) return;
    cartStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = getCartStyles();
    document.head.appendChild(style);
};

/** Инжектит стили для блока списка выбранных предметов. */
export const injectSelectedItemsStyles = () => {
    if (selectedItemsStylesInjected) return;
    selectedItemsStylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
            .tm-selected-container {
                position: relative;
                min-height: 100px;
                padding: 18px 14px 18px 11px;
            }

            .tm-selected-container::before {
                content: '';
                position: absolute;
                left: -1px;
                top: 0;
                bottom: 0;
                width: 100%;
                pointer-events: none;
                background:
                    url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_top.png) left top no-repeat,
                    url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bottom.png) left bottom no-repeat;
            }

            .tm-selected-list {
                display: flex;
                flex-direction: column;
                min-height: 181px;
                padding: 13px 15px;
                background: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bg.jpg) left bottom no-repeat;
                max-height: 181px;
                overflow: auto;
                position: relative;
            }

            .tm-selected-items-help {
                margin: auto;
                color: #495a6d;
                font: 14px / 16px Cambria, Georgia, "Times New Roman", Times, serif;
                text-align: center;
                cursor: default;
            }

            .tm-selected-item {
                position: relative;
                display: flex;
                align-items: center;
                padding: 2px 36px 2px 0;
                font: 14px / 16px Cambria, Georgia, "Times New Roman", Times, serif;
                border-bottom: 1px solid #d6dde5;
                border-top: 1px solid #d6dde5;
                cursor: default;
                z-index: 1;
            }

            .tm-cart-item-name {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .tm-selected-item .del_btn {
                position: absolute;
                display: block;
                top: 50%;
                margin-top: -12px;
                right: 0;
                width: 25px;
                height: 25px;
                background-image: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/icons.png);
                background-repeat: no-repeat;
                background-position: left 0px;
                cursor: pointer;
            }

        `;
    document.head.appendChild(style);
};
