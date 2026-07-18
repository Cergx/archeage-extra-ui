import { pageDocument, pageWindow, isArcheageSite } from '../../utils/env.js';
import { appendStyleElement } from '../../utils/dom.js';
import { makeEmptyCell } from '../emptyCell/emptyCell.js';
import { makeLoader } from '../loader/loader.js';
import tooltipStyles from './tooltip.scss';
import {
    GRADES,
    ITEM_TYPES,
    ITEM_SUB_TYPES,
    EQUIPMENT_SUB_TYPES,
    ICON_OVERLAY,
    MAX_LEVEL,
    HERO_LEVEL_ICON,
    CURRENCY_ICONS,
    getItemCodexUrl,
    getItemIconUrl,
    stripHtmlForMatch,
    cleanDynamicTooltipMarkup,
    hasVisibleTooltipText,
    parseGameMarkup,
    resolveItemPlaceholders,
    loadIconScalePercent,
    loadIconScaleBrowserZoom,
    loadTooltipTheme,
    loadInterfaceTheme,
} from '../../data/items.js';
import type { DynamicTooltipData, DynamicTooltipFieldValue, ItemBase } from '../../data/items.js';

const LS_KEY_DYNAMIC_TOOLTIPS: string = 'tm_aa_dynamic_tooltips';
const DYNAMIC_TOOLTIP_TTL_MS: number = 7 * 24 * 60 * 60 * 1000;
const DEBUG_PREFIX: string = '[ArcheAgeExtraUI]';
const debugWarn = (...args: unknown[]): void => console.warn(DEBUG_PREFIX, ...args);

export const ITEM_STORE: Map<string | number, ItemBase> = new Map();
export const POPULATING_PROMISES: Map<string | number, Promise<ItemBase | null>> = new Map();

let globalTooltip: HTMLElement | null = null;

const dynamicTooltipCache: Map<string, DynamicTooltipData | null | Promise<DynamicTooltipData | null>> = new Map();
let activeTooltipKey: string | null = null;
let tooltipDomInitialized: boolean = false;

const TOOLTIP_VISIBLE_CLASS: string = 'tm-item-tooltip--visible';
const TOOLTIP_RIGHT_CLASS: string = 'tm-item-tooltip--right';
const TOOLTIP_BOTTOM_CLASS: string = 'tm-item-tooltip--bottom';
const TOOLTIP_THEME_CLASS_PREFIX: string = 'tm-item-tooltip--theme-';
const TOOLTIP_WIDTH: number = 248;

const getSystemScale = (): number => {
    if (loadIconScaleBrowserZoom()) return 1;
    return pageWindow.devicePixelRatio;
};

const getTooltipContainer = (): HTMLElement => {
    if (globalTooltip) return globalTooltip;

    globalTooltip = pageDocument.createElement('div');
    globalTooltip.className = `tm-item-tooltip ${TOOLTIP_THEME_CLASS_PREFIX}${loadTooltipTheme()}`;
    pageDocument.body.appendChild(globalTooltip);
    return globalTooltip;
};

export const updateTooltipTheme = (): void => {
    pageDocument.documentElement.classList.remove('tm-tooltip-theme-new', 'tm-tooltip-theme-old');
    pageDocument.documentElement.classList.add(`tm-tooltip-theme-${loadTooltipTheme()}`);
    if (!globalTooltip) return;
    globalTooltip.classList.remove(`${TOOLTIP_THEME_CLASS_PREFIX}new`, `${TOOLTIP_THEME_CLASS_PREFIX}old`);
    globalTooltip.classList.add(`${TOOLTIP_THEME_CLASS_PREFIX}${loadTooltipTheme()}`);
};

export const updateInterfaceTheme = (): void => {
    pageDocument.documentElement.classList.remove('tm-ui-theme-new', 'tm-ui-theme-old', 'tm-ui-theme-white');
    pageDocument.documentElement.classList.add(`tm-ui-theme-${loadInterfaceTheme()}`);
};

const injectTooltipStyles = (): void => {
    if (pageDocument.getElementById('tm-item-tooltip-styles')) return;

    const style = pageDocument.createElement('style');
    style.id = 'tm-item-tooltip-styles';
    style.textContent = tooltipStyles;
    appendStyleElement(style);
};

const initTooltipDom = (): void => {
    injectTooltipStyles();
    getTooltipContainer();
};

const resolveItemLevelValue = (levelValue: number | string | undefined, isMaxLevel: boolean = false): number => {
    if (isMaxLevel && Number(levelValue) === 0) return MAX_LEVEL;
    return Number(levelValue);
};

const appendItemLevelValue = (container: HTMLElement, levelValue: number | string | undefined, isMaxLevel: boolean = false): void => {
    const level = resolveItemLevelValue(levelValue, isMaxLevel);
    if (Number.isFinite(level) && level > 55) {
        const icon = pageDocument.createElement('img');
        icon.className = 'tm-item-tooltip-hero-level-icon';
        icon.src = HERO_LEVEL_ICON;
        icon.alt = 'героический уровень';
        container.appendChild(icon);

        const value = pageDocument.createElement('span');
        value.className = 'inv-nc';
        value.textContent = String(level - 55);
        container.appendChild(value);
    } else {
        container.appendChild(pageDocument.createTextNode(String(levelValue)));
    }
};

const makeRequiredLevelLine = (reqLevel: number | string | undefined, maxLevel: number | string | undefined): HTMLDivElement => {
    const line = pageDocument.createElement('div');
    line.className = 'tm-item-tooltip-level';
    line.appendChild(pageDocument.createTextNode('Требуемый уровень: '));

    if (reqLevel != null) appendItemLevelValue(line, reqLevel);

    if (maxLevel != null) {
        line.appendChild(pageDocument.createTextNode('~'));
        appendItemLevelValue(line, maxLevel, true);
    }

    return line;
};

type ItemStatValue = number | string;

interface ItemStatEntryConfig {
    field: keyof Pick<ItemBase, 'speed' | 'durability' | 'dps' | 'armor' | 'magicResistance' | 'mdps' | 'hdps' | 'str' | 'dex' | 'sta' | 'int' | 'spi'>;
    label: string;
    colon?: boolean;
    format?: (value: ItemStatValue) => string;
}

interface ItemStatEntry extends ItemStatEntryConfig {
    value: ItemStatValue;
}

const formatSpeedStat = (value: ItemStatValue): string => {
    const str = String(value).trim();
    if (!str.includes('.')) return `${str}.0`;

    const [whole, fraction = ''] = str.split('.');
    return `${whole}.${fraction || '0'}`;
};

const ITEM_UTILITY_STATS: ItemStatEntryConfig[] = [
    { field: 'speed', label: 'Сноровка', format: formatSpeedStat },
    { field: 'durability', label: 'Прочность', format: (value: ItemStatValue): string => `${value}/${value}` },
];

const ITEM_COMBAT_STATS: ItemStatEntryConfig[] = [
    { field: 'dps', label: 'Урон', colon: true },
    { field: 'armor', label: 'Защита', colon: true },
    { field: 'magicResistance', label: 'Сопротивление', colon: true },
    { field: 'mdps', label: 'Сила заклинаний' },
    { field: 'hdps', label: 'Эффективность исцеления' },
    { field: 'str', label: 'Сила' },
    { field: 'dex', label: 'Ловкость' },
    { field: 'sta', label: 'Выносливость' },
    { field: 'int', label: 'Интеллект' },
    { field: 'spi', label: 'Мудрость' },
];

const isDisplayableItemStatValue = (value: unknown): boolean => {
    if (value == null || value === '') return false;
    const num = Number(value);
    return !Number.isFinite(num) || num !== 0;
};

const getItemStatEntries = (item: ItemBase, stats: ItemStatEntryConfig[]): ItemStatEntry[] => (
    stats
        .map(stat => ({ ...stat, value: item[stat.field] }))
        .filter((stat): stat is ItemStatEntry => stat.value != null)
        .filter(stat => isDisplayableItemStatValue(stat.value))
);

const makeItemStatsSection = (entries: ItemStatEntry[]): HTMLDivElement => {
    const section = pageDocument.createElement('div');
    section.className = 'tm-item-tooltip-stats';

    for (const entry of entries) {
        const row = pageDocument.createElement('div');
        row.className = 'tm-item-tooltip-stat-row';

        const label = pageDocument.createElement('span');
        label.className = 'tm-item-tooltip-stat-label';
        label.textContent = entry.colon ? `${entry.label}:` : entry.label;

        const value = pageDocument.createElement('span');
        value.className = 'tm-item-tooltip-stat-value';
        value.textContent = entry.format ? entry.format(entry.value) : String(entry.value);

        row.appendChild(label);
        row.appendChild(value);
        section.appendChild(row);
    }

    return section;
};

const appendPricePart = (container: HTMLElement, amount: number, iconSrc: string, title: string): void => {
    const part = pageDocument.createElement('span');
    part.className = 'tm-item-tooltip-price-part';

    const value = pageDocument.createElement('span');
    value.textContent = String(amount);
    part.appendChild(value);

    const icon = pageDocument.createElement('img');
    icon.className = 'tm-item-tooltip-price-icon';
    icon.src = iconSrc;
    icon.alt = title;
    icon.title = title;
    part.appendChild(icon);

    container.appendChild(part);
};

const makeItemPriceValue = (price: number | string | null): HTMLSpanElement => {
    const value = pageDocument.createElement('span');
    value.className = 'tm-item-tooltip-price-value';

    const totalBronze = Math.max(0, Math.floor(Number(price) || 0));
    const gold = Math.floor(totalBronze / 10000);
    const silver = Math.floor((totalBronze % 10000) / 100);
    const bronze = totalBronze % 100;

    if (gold > 0) appendPricePart(value, gold, CURRENCY_ICONS.gold, 'золото');
    if (silver > 0) appendPricePart(value, silver, CURRENCY_ICONS.silver, 'серебро');
    if (bronze > 0 || totalBronze === 0) appendPricePart(value, bronze, CURRENCY_ICONS.bronze, 'бронза');

    return value;
};

const getItemDynamicTooltipKey = (item: ItemBase): string | null => {
    if (item?.id == null || item.id === '') return null;
    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    return `${item.id}|${grade}`;
};

interface DynamicTooltipSnapshot {
    id: string;
    grade: string;
    updatedAt: number;
    data: DynamicTooltipData;
}

const loadDynamicTooltipSnapshot = (item: ItemBase): DynamicTooltipSnapshot | null => {
    const key = getItemDynamicTooltipKey(item);
    if (!key) return null;

    try {
        const raw = localStorage.getItem(LS_KEY_DYNAMIC_TOOLTIPS);
        if (!raw) return null;

        const all = JSON.parse(raw) as Record<string, DynamicTooltipSnapshot | undefined>;
        const snapshot = all[key] || all[String(item.id)];
        const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;

        return snapshot?.data && String(snapshot.id) === String(item.id) && String(snapshot.grade) === String(grade)
            ? snapshot
            : null;
    } catch (e) {
        debugWarn('Failed to load dynamic tooltip snapshot:', e);
        return null;
    }
};

const isDynamicTooltipSnapshotFresh = (snapshot: DynamicTooltipSnapshot | null): boolean => (
    snapshot !== null
    && Number.isFinite(snapshot.updatedAt)
    && Date.now() - snapshot.updatedAt < DYNAMIC_TOOLTIP_TTL_MS
);

const saveDynamicTooltipSnapshot = (itemId: number | string, grade: number | string, data: DynamicTooltipData): void => {
    if (itemId == null || !data) return;

    try {
        const raw = localStorage.getItem(LS_KEY_DYNAMIC_TOOLTIPS);
        const all = raw ? JSON.parse(raw) : {};
        all[`${itemId}|${grade ?? 0}`] = {
            id: String(itemId),
            grade: String(grade ?? 0),
            updatedAt: Date.now(),
            data,
        };
        localStorage.setItem(LS_KEY_DYNAMIC_TOOLTIPS, JSON.stringify(all));
    } catch (e) {
        debugWarn('Failed to save dynamic tooltip snapshot:', e);
    }
};

const dynamicTooltipFieldValue = (value: DynamicTooltipFieldValue | undefined): string | null => {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str : null;
};

const dynamicTooltipNumberValue = (value: DynamicTooltipFieldValue | undefined): number | null => {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const dynamicTooltipStatValue = (value: DynamicTooltipFieldValue | undefined): number | string | null => {
    if (value == null || value === '') return null;
    const str = String(value).trim();
    if (!str) return null;

    const num = Number(str);
    return Number.isFinite(num) ? num : str;
};

const DYNAMIC_EQUIP_TOOLTIP_PATTERNS: RegExp[] = [
    /Здоровье/,
    /Защита/,
    /Сопротивление/,
    /Скорость\s+(?:передвижения|плавания|занятия|сбора)/,
    /Опыт\s+при\s+занятии/,
    /Время\s+применения\s+умений/,
];

const isDynamicEquipTooltipPart = (value: unknown): boolean => {
    const text = stripHtmlForMatch(value);
    return DYNAMIC_EQUIP_TOOLTIP_PATTERNS.some(pattern => pattern.test(text));
};

const mapDynamicEquipTooltip = (value: DynamicTooltipFieldValue | undefined): Partial<ItemBase> => {
    const raw = dynamicTooltipFieldValue(value);
    if (!raw) return {};

    const parts = raw
        .split(/<br\s*\/?>/i)
        .map(part => cleanDynamicTooltipMarkup(part))
        .filter(Boolean);

    const equipIndex = parts.findIndex(isDynamicEquipTooltipPart);
    if (equipIndex === -1) {
        const useDescription = cleanDynamicTooltipMarkup(raw);
        return useDescription ? { useDescription } : {};
    }

    const equipParts: string[] = [];
    let nextIndex: number = equipIndex;
    while (nextIndex < parts.length && isDynamicEquipTooltipPart(parts[nextIndex])) {
        equipParts.push(parts[nextIndex]);
        nextIndex++;
    }

    const result: Partial<ItemBase> = {
        equipDescription: equipParts.join('<br/>'),
    };

    if (equipIndex > 0 && /^Действует\b/i.test(stripHtmlForMatch(parts[equipIndex - 1]))) {
        result.isEquipDescriptionTemporary = true;
    }

    const useDescription = cleanDynamicTooltipMarkup(parts.slice(nextIndex).join('<br/>'));
    if (useDescription) result.useDescription = useDescription;

    return result;
};

const mapDynamicTooltipToItem = (data: DynamicTooltipData | null): Partial<ItemBase> => {
    if (!data || typeof data !== 'object') return {};

    const fixedGrade = dynamicTooltipNumberValue(data.fixed_grade);
    const apiGrade = dynamicTooltipNumberValue(data.grade);
    const grade = apiGrade ?? (fixedGrade != null && fixedGrade >= 0 ? fixedGrade : null);
    const reqLevel = dynamicTooltipNumberValue(data.level_requirement);
    const maxLevel = dynamicTooltipNumberValue(data.level_limit);
    const hasRefund = Object.prototype.hasOwnProperty.call(data, 'refund');
    const price = data.refund === null ? null : dynamicTooltipNumberValue(data.refund);
    const description = cleanDynamicTooltipMarkup(data.description);
    const equipTooltipFields = mapDynamicEquipTooltip(data.equip_tooltip);
    const setDescription = cleanDynamicTooltipMarkup(data.set_description);

    return {
        ...(dynamicTooltipFieldValue(data.filename) ? { icon: dynamicTooltipFieldValue(data.filename) } : {}),
        ...(dynamicTooltipFieldValue(data.name) ? { name: dynamicTooltipFieldValue(data.name) } : {}),
        ...(grade != null && grade >= 0 ? { grade } : {}),
        ...(fixedGrade != null ? { fixedGrade } : {}),
        ...(description ? { description } : {}),
        ...equipTooltipFields,
        ...(setDescription ? { equipDescription: setDescription } : {}),
        ...(dynamicTooltipFieldValue(data.cat_name) ? { apiCategoryTitle: dynamicTooltipFieldValue(data.cat_name) } : {}),
        ...(reqLevel != null && reqLevel > 0 ? { reqLevel } : {}),
        ...(maxLevel != null && maxLevel >= 0 ? { maxLevel } : {}),
        ...(hasRefund && (price !== null || data.refund === null) ? { price } : {}),
        ...(dynamicTooltipStatValue(data.c_speed) != null ? { speed: dynamicTooltipStatValue(data.c_speed) } : {}),
        ...(dynamicTooltipStatValue(data.c_durability) != null ? { durability: dynamicTooltipStatValue(data.c_durability) } : {}),
        ...(dynamicTooltipStatValue(data.c_dps) != null ? { dps: dynamicTooltipStatValue(data.c_dps) } : {}),
        ...(dynamicTooltipStatValue(data.c_armor) != null ? { armor: dynamicTooltipStatValue(data.c_armor) } : {}),
        ...(dynamicTooltipStatValue(data.c_magic_resistance) != null ? { magicResistance: dynamicTooltipStatValue(data.c_magic_resistance) } : {}),
        ...(dynamicTooltipStatValue(data.c_mdps) != null ? { mdps: dynamicTooltipStatValue(data.c_mdps) } : {}),
        ...(dynamicTooltipStatValue(data.c_hdps) != null ? { hdps: dynamicTooltipStatValue(data.c_hdps) } : {}),
        ...(dynamicTooltipStatValue(data.c_str) != null ? { str: dynamicTooltipStatValue(data.c_str) } : {}),
        ...(dynamicTooltipStatValue(data.c_dex) != null ? { dex: dynamicTooltipStatValue(data.c_dex) } : {}),
        ...(dynamicTooltipStatValue(data.c_sta) != null ? { sta: dynamicTooltipStatValue(data.c_sta) } : {}),
        ...(dynamicTooltipStatValue(data.c_int) != null ? { int: dynamicTooltipStatValue(data.c_int) } : {}),
        ...(dynamicTooltipStatValue(data.c_spi) != null ? { spi: dynamicTooltipStatValue(data.c_spi) } : {}),
        ...(dynamicTooltipNumberValue(data.num_sockets) != null ? { numSockets: dynamicTooltipNumberValue(data.num_sockets) } : {}),
        ...(dynamicTooltipFieldValue(data.gradable) ? { isGradable: dynamicTooltipFieldValue(data.gradable) === 't' } : {}),
        ...(dynamicTooltipFieldValue(data.grade_enchantable) ? { isGradeEnchantable: dynamicTooltipFieldValue(data.grade_enchantable) === 't' } : {}),
    };
};

const itemHasTooltipField = (item: ItemBase, field: string): boolean => (
    field === 'price'
        ? Object.prototype.hasOwnProperty.call(item, field)
        : (item as Record<string, unknown>)[field] != null && (item as Record<string, unknown>)[field] !== ''
);

const mergeDynamicTooltipItem = (item: ItemBase, data: DynamicTooltipData | null): ItemBase => {
    const apiItem = mapDynamicTooltipToItem(data);
    const merged = { ...item };

    for (const [field, value] of Object.entries(apiItem)) {
        if (field === 'buff') {
            merged.buff = { ...((value || {}) as Record<string, string | number | boolean | null>), ...(merged.buff || {}) };
            continue;
        }
        if (!itemHasTooltipField(merged, field)) (merged as Record<string, unknown>)[field] = value;
    }

    return merged;
};

const fetchDynamicTooltipData = async (item: ItemBase): Promise<DynamicTooltipData | null> => {
    if (!isArcheageSite) return null;

    const key = getItemDynamicTooltipKey(item);
    if (!key) return null;
    if (dynamicTooltipCache.has(key)) return dynamicTooltipCache.get(key);

    const snapshot = loadDynamicTooltipSnapshot(item);
    if (isDynamicTooltipSnapshotFresh(snapshot)) {
        dynamicTooltipCache.set(key, snapshot.data);
        return snapshot.data;
    }

    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    const promise: Promise<DynamicTooltipData | null> = fetch(`/dynamic/tooltip/?a=item&id=${encodeURIComponent(item.id)}&g=${encodeURIComponent(grade)}`, {
        credentials: 'include',
        cache: 'no-store',
    })
        .then(res => res.ok ? res.json() : null)
        .then((data: unknown) => {
            if (data && typeof data === 'object') saveDynamicTooltipSnapshot(item.id, grade, data as DynamicTooltipData);
            return data && typeof data === 'object' ? data as DynamicTooltipData : null;
        })
        .catch(e => {
            debugWarn(`Failed to fetch dynamic tooltip for item ${item.id}:`, e);
            return null;
        });

    dynamicTooltipCache.set(key, promise);
    const data = await promise;
    dynamicTooltipCache.set(key, data);
    return data;
};

interface MakeItemIconLinkParams {
    item: ItemBase;
    linked?: boolean;
    size?: string;
    count?: number | string;
    noTooltip?: boolean;
}

type ItemIconElement = HTMLAnchorElement | HTMLDivElement;

export const makeItemIconLink = ({ item, linked = false, size = 'medium', count, noTooltip = false }: MakeItemIconLinkParams): ItemIconElement => {
    const icon = pageDocument.createElement(linked ? 'a' : 'div');
    icon.className = `tm-item-icon tm-item-icon--${size}`;

    if (linked) {
        icon.href = getItemCodexUrl(item);
        icon.target = '_blank';
        icon.rel = 'noopener noreferrer';
        icon.addEventListener('click', (e) => e.stopPropagation());
    }

    const itemImg = pageDocument.createElement('img');
    itemImg.className = 'tm-item-icon-img';
    itemImg.src = getItemIconUrl(item);
    itemImg.dataset.itemId = String(item.id);
    itemImg.dataset.iconTemplate = item.icon || '';
    itemImg.dataset.iconM = item.iconM || '';
    itemImg.dataset.iconF = item.iconF || '';
    icon.appendChild(itemImg);

    const overlay = ICON_OVERLAY[item.overlay]?.icon;
    if (overlay) {
        const overlayImg = pageDocument.createElement('img');
        overlayImg.className = 'tm-item-icon-overlay';
        overlayImg.src = overlay;
        icon.appendChild(overlayImg);
    }

    const gradeInfo = GRADES[item.grade];
    if (gradeInfo) {
        const gradeImg = pageDocument.createElement('img');
        gradeImg.className = 'tm-item-icon-grade';
        gradeImg.src = gradeInfo.overlay;
        gradeImg.alt = gradeInfo.title || '';
        icon.appendChild(gradeImg);
    }

    if (count && count > 1) {
        const countEl = pageDocument.createElement('div');
        countEl.className = 'tm-item-icon-count';
        countEl.textContent = String(count);
        icon.appendChild(countEl);
    }

    if (!noTooltip) {
        icon.addEventListener('mouseenter', () => showTooltip(icon, item));
        icon.addEventListener('mouseleave', hideTooltip);
    }

    return icon;
};

/**
 * Заполняет тултип данными предмета.
 */
const populateTooltip = (item: ItemBase): void => {
    const tooltip = getTooltipContainer();
    tooltip.innerHTML = '';

    const gradeInfo = GRADES[item.grade];

    const headerSection = pageDocument.createElement('div');
    headerSection.className = 'tm-item-tooltip-header';

    const iconEl = makeItemIconLink({ item, noTooltip: true });
    headerSection.appendChild(iconEl);

    const tipMeta = pageDocument.createElement('div');
    tipMeta.className = 'tm-item-tooltip-meta';

    const subTypeInfo = ITEM_SUB_TYPES[item.subType];
    const typeInfo = subTypeInfo || ITEM_TYPES[item.type];
    const typeTitle = typeInfo?.title || item.apiCategoryTitle;
    if (typeTitle) {
        const typeLine = pageDocument.createElement('div');
        typeLine.className = 'tm-item-tooltip-type';
        typeLine.textContent = typeTitle;
        tipMeta.appendChild(typeLine);
    }

    if (gradeInfo?.title /* && !(item.grade === 1 && item.type !== 'equipment') */) {
        const gradeLine = pageDocument.createElement('div');
        gradeLine.className = 'tm-item-tooltip-grade';
        if (gradeInfo.color) gradeLine.style.color = gradeInfo.color;
        gradeLine.textContent = gradeInfo.title;
        tipMeta.appendChild(gradeLine);
    }

    const nameLine = pageDocument.createElement('div');
    nameLine.className = 'tm-item-tooltip-name';
    if (gradeInfo?.color) nameLine.style.color = gradeInfo.color;
    nameLine.textContent = item.name || '';
    tipMeta.appendChild(nameLine);

    headerSection.appendChild(tipMeta);
    tooltip.appendChild(headerSection);

    if (item.isPersonal || item.reqLevel != null || item.maxLevel != null) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const reqSection = pageDocument.createElement('div');
        reqSection.className = 'tm-item-tooltip-req';
        if (item.reqLevel != null || item.maxLevel != null) {
            reqSection.appendChild(makeRequiredLevelLine(item.reqLevel, item.maxLevel));
        }
        if (item.isPersonal) {
            const p = pageDocument.createElement('div');
            p.textContent = 'Персональный предмет';
            reqSection.appendChild(p);
        }
        tooltip.appendChild(reqSection);
    }

    const utilityStatEntries = getItemStatEntries(item, ITEM_UTILITY_STATS);
    if (utilityStatEntries.length) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);
        tooltip.appendChild(makeItemStatsSection(utilityStatEntries));
    }

    const combatStatEntries = getItemStatEntries(item, ITEM_COMBAT_STATS);
    if (combatStatEntries.length) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);
        tooltip.appendChild(makeItemStatsSection(combatStatEntries));
    }

    const socketCount = Math.max(0, Math.floor(Number(item.numSockets) || 0));
    if (socketCount > 0) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const sockets = pageDocument.createElement('div');
        sockets.className = 'tm-item-tooltip-sockets';
        for (let index = 0; index < socketCount; index++) sockets.appendChild(makeEmptyCell());
        tooltip.appendChild(sockets);
    }

    if (item.isGradable && item.grade != null && item.fixedGrade != null) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const enhancements = pageDocument.createElement('div');
        enhancements.className = 'tm-item-tooltip-enhancements';

        const maxGrade = item.fixedGrade === -1 ? GRADES.length - 1 : item.fixedGrade;
        const rankLine = pageDocument.createElement('div');
        rankLine.className = 'inv-nc';
        rankLine.innerHTML = item.grade === maxGrade
            ? 'Максимальный ранг'
            : `Максимальный ранг:<br/>(${GRADES[maxGrade]?.title || maxGrade})`;
        enhancements.appendChild(rankLine);
        tooltip.appendChild(enhancements);
    }

    const equipmentSubTypeInfo = EQUIPMENT_SUB_TYPES[item.equipmentSubType];
    if (equipmentSubTypeInfo?.title) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const equipmentSubTypeSection = pageDocument.createElement('div');
        equipmentSubTypeSection.className = 'tm-item-tooltip-equipment-subtype';
        equipmentSubTypeSection.textContent = equipmentSubTypeInfo.title;
        tooltip.appendChild(equipmentSubTypeSection);
    }

    const hasUseDescription = item.useDescription && hasVisibleTooltipText(item.useDescription);
    if (item.description || hasUseDescription || item.equipDescription) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const descriptionSection = pageDocument.createElement('div');
        descriptionSection.className = 'tm-item-tooltip-desc';
        if (item.description) {
            const descText = pageDocument.createElement('div');
            descText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.description, item));
            descriptionSection.appendChild(descText);
        }
        if (hasUseDescription) {
            const useBlock = pageDocument.createElement('div');
            useBlock.className = 'tm-item-tooltip-use';
            const useLabel = pageDocument.createElement('div');
            useLabel.className = 'tm-item-tooltip-use-label';
            useLabel.textContent = 'Использование';
            const useText = pageDocument.createElement('div');
            useText.className = 'tm-item-tooltip-use-text';
            useText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.useDescription, item));
            useBlock.appendChild(useLabel);
            useBlock.appendChild(useText);
            descriptionSection.appendChild(useBlock);
        }
        if (item.equipDescription) {
            const equipBlock = pageDocument.createElement('div');
            equipBlock.className = 'tm-item-tooltip-use';
            const equipLabel = pageDocument.createElement('div');
            equipLabel.className = 'tm-item-tooltip-use-label';
            equipLabel.textContent = item.isEquipDescriptionTemporary ? 'Экипировка (временно)' : 'Экипировка';
            const equipText = pageDocument.createElement('div');
            equipText.className = 'tm-item-tooltip-use-text';
            equipText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.equipDescription, item));
            equipBlock.appendChild(equipLabel);
            equipBlock.appendChild(equipText);
            descriptionSection.appendChild(equipBlock);
        }
        tooltip.appendChild(descriptionSection);
    }

    if (item.price !== undefined) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const priceSection = pageDocument.createElement('div');
        priceSection.className = 'tm-item-tooltip-price';
        if (item.price === null || Number(item.price) === 0) {
            priceSection.className = 'tm-item-tooltip-price tm-item-tooltip-price--none';
            priceSection.textContent = 'Этот предмет не нужен торговцам.';
        } else {
            const label = pageDocument.createElement('span');
            label.textContent = 'Цена\nпродажи:';
            priceSection.appendChild(label);
            priceSection.appendChild(makeItemPriceValue(item.price));
        }
        tooltip.appendChild(priceSection);
    }
};

const positionTooltip = (anchorEl: HTMLElement): void => {
    const tooltip = getTooltipContainer();
    const rect = anchorEl.getBoundingClientRect();
    const screenScale = getSystemScale();
    const scale = (1 / screenScale) * (loadIconScalePercent() / 100);

    const tooltipLeftEdge = rect.left + 8 - TOOLTIP_WIDTH * scale;
    const showOnRight = tooltipLeftEdge < 0;

    tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
    tooltip.style.setProperty('--tm-tooltip-scale', `${scale}`);
    const tooltipHeight = tooltip.offsetHeight * scale;
    const showFromBottom = (rect.bottom - 8 + tooltipHeight) > pageWindow.innerHeight;

    if (showFromBottom) {
        const topEdge = rect.top + 8 - tooltipHeight;
        if (topEdge < 0) {
            tooltip.style.setProperty('--tm-tooltip-top', '0px');
            tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
        } else {
            tooltip.style.setProperty('--tm-tooltip-top', `${rect.top + 8}px`);
            tooltip.classList.add(TOOLTIP_BOTTOM_CLASS);
        }
    } else {
        tooltip.style.setProperty('--tm-tooltip-top', `${rect.bottom - 8}px`);
        tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
    }

    if (showOnRight) {
        tooltip.style.setProperty('--tm-tooltip-left', `${rect.right - 8}px`);
        tooltip.classList.add(TOOLTIP_RIGHT_CLASS);
    } else {
        tooltip.style.setProperty('--tm-tooltip-left', `${rect.left + 8}px`);
        tooltip.classList.remove(TOOLTIP_RIGHT_CLASS);
    }
};

/**
 * Показывает тултип рядом с элементом.
 */
export const showTooltip = (anchorEl: HTMLElement, item: ItemBase): void => {
    initTooltipDom();
    const dynamicTooltipKey = getItemDynamicTooltipKey(item);
    const tooltipKey = dynamicTooltipKey || `${Date.now()}:${Math.random()}`;
    const snapshot = loadDynamicTooltipSnapshot(item);
    if (dynamicTooltipKey && isDynamicTooltipSnapshotFresh(snapshot) && !dynamicTooltipCache.has(tooltipKey)) {
        dynamicTooltipCache.set(tooltipKey, snapshot.data);
    }
    const cachedData = dynamicTooltipCache.get(tooltipKey);
    const sessionData = cachedData && !(cachedData instanceof Promise) ? cachedData : null;
    const displayedData = sessionData || snapshot?.data;
    const isDynamicDataLoading = isArcheageSite && dynamicTooltipKey !== null
        && (!dynamicTooltipCache.has(tooltipKey) || cachedData instanceof Promise);
    activeTooltipKey = tooltipKey;
    populateTooltip(displayedData ? mergeDynamicTooltipItem(item, displayedData) : item);
    if (isDynamicDataLoading) {
        getTooltipContainer().appendChild(makeLoader({
            label: 'Загрузка дополнительной информации',
            className: 'tm-item-tooltip-loader',
        }));
    }
    positionTooltip(anchorEl);

    fetchDynamicTooltipData(item).then(data => {
        if (activeTooltipKey !== tooltipKey) return;

        if (data) populateTooltip(mergeDynamicTooltipItem(item, data));
        else getTooltipContainer().querySelector('.tm-item-tooltip-loader')?.remove();
        positionTooltip(anchorEl);
    });
};

/** Скрывает тултип. */
export const hideTooltip = (): void => {
    activeTooltipKey = null;
    if (globalTooltip) {
        globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS, TOOLTIP_BOTTOM_CLASS);
    }
};

interface DelegatedTooltipItem {
    icon: HTMLElement;
    item: ItemBase;
}

const getDelegatedTooltipItem = (target: EventTarget | null): DelegatedTooltipItem | null => {
    const icon = target instanceof Element
        ? target.closest<HTMLElement>('.tm-item-icon[data-item-id], [data-tm-tooltip-item-id], [data-item-id]')
        : null;
    const itemId = icon?.dataset?.tmTooltipItemId || icon?.dataset?.itemId;
    if (!itemId) return null;

    const item = ITEM_STORE.get(String(itemId)) || ITEM_STORE.get(Number(itemId));
    return item ? { icon, item } : null;
};

export const handleItemIconMouseEnter = (event: MouseEvent): void => {
    const found = getDelegatedTooltipItem(event.target);
    if (found) showTooltip(found.icon, found.item);
};

export const initTooltips = (): void => {
    initTooltipDom();
    if (tooltipDomInitialized) return;
    tooltipDomInitialized = true;

    pageDocument.addEventListener('mouseover', (event) => {
        const found = getDelegatedTooltipItem(event.target);
        if (!found || found.icon.contains(event.relatedTarget as Node | null)) return;
        showTooltip(found.icon, found.item);
    });
    pageDocument.addEventListener('mouseout', (event) => {
        const found = getDelegatedTooltipItem(event.target);
        if (!found || found.icon.contains(event.relatedTarget as Node | null)) return;
        hideTooltip();
    });
};

export const initTooltip = initTooltips;
