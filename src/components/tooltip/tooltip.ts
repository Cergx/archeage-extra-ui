import { pageDocument, pageWindow, isArcheageSite } from '../../utils/env.js';
import { appendStyleElement } from '../../utils/dom.js';
import { makeEmptyCell } from '../emptyCell/emptyCell.js';
import { makeLoader } from '../loader/loader.js';
import { injectItemIconStyles } from '../itemIcon/itemIcon.js';
import { findItemByName } from '../../pages/cart/cart.js';
import tooltipStyles from './tooltip.scss';
import {
    GRADES,
    ITEMS,
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
    cleanApiTooltipMarkup,
    hasVisibleTooltipText,
    parseGameMarkup,
    resolveItemPlaceholders,
    loadIconScalePercent,
    loadIconScaleBrowserZoom,
} from '../../data/items.js';
import type { ApiTooltipData, ApiTooltipFieldValue, ItemBase } from '../../data/items.js';

const LS_KEY_API_TOOLTIPS: string = 'tm_aa_dynamic_tooltips';
const LS_KEY_ITEM_RESTORE_ITEMS: string = 'tm_aa_itemrestore_items';
const API_TOOLTIP_TTL_MS: number = 7 * 24 * 60 * 60 * 1000;
const DEBUG_PREFIX: string = '[ArcheAgeExtraUI]';
const debugWarn = (...args: unknown[]): void => console.warn(DEBUG_PREFIX, ...args);

let globalTooltip: HTMLElement | null = null;

const apiTooltipCache: Map<string, ApiTooltipData> = new Map();
const apiTooltipPromises: Map<string, Promise<ApiTooltipData | null>> = new Map();
let activeTooltipToken: symbol | null = null;
let tooltipDomInitialized: boolean = false;

const TOOLTIP_VISIBLE_CLASS: string = 'tm-item-tooltip--visible';
const TOOLTIP_RIGHT_CLASS: string = 'tm-item-tooltip--right';
const TOOLTIP_BOTTOM_CLASS: string = 'tm-item-tooltip--bottom';
const TOOLTIP_WIDTH: number = 248;

// tooltip.js сайта меняет местами первые два грейда относительно нашего GRADES:
// 0 = обычный, 1 = бесполезный. Начиная с 2 индексы совпадают.
const convertSiteGrade = (grade: number): number => grade === 0 ? 1 : grade === 1 ? 0 : grade;

const getSiteTooltipGrade = (item: Partial<ItemBase>): number => {
    const siteGrade = Number(item.siteTooltipGrade);
    if (Number.isFinite(siteGrade)) return siteGrade;

    const grade = Number(item.grade);
    return Number.isFinite(grade) ? convertSiteGrade(grade) : 0;
};

const getPreferredSiteTooltipGrade = (item: Partial<ItemBase>): number | undefined => {
    const siteGrade = Number(item.siteTooltipGrade);
    if (Number.isFinite(siteGrade)) return siteGrade;
    const grade = Number(item.grade);
    return Number.isFinite(grade) ? convertSiteGrade(grade) : undefined;
};

const getSystemScale = (): number => {
    if (loadIconScaleBrowserZoom()) return 1;
    return pageWindow.devicePixelRatio;
};

const getTooltipContainer = (): HTMLElement => {
    if (globalTooltip) return globalTooltip;

    globalTooltip = pageDocument.createElement('div');
    globalTooltip.className = 'tm-item-tooltip';
    pageDocument.body.appendChild(globalTooltip);
    return globalTooltip;
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

const getApiTooltipKey = (itemId: number | string, grade: number | string): string => `${itemId}|${grade}`;

interface ApiTooltipSnapshot {
    id: string;
    grade: string;
    updatedAt: number;
    data: ApiTooltipData;
}

const loadApiTooltipSnapshot = (itemId: number | string, grade: number): ApiTooltipSnapshot | null => {
    try {
        const raw = localStorage.getItem(LS_KEY_API_TOOLTIPS);
        if (!raw) return null;

        const all = JSON.parse(raw) as Record<string, ApiTooltipSnapshot | undefined>;
        const snapshot = all[getApiTooltipKey(itemId, grade)] || all[String(itemId)];

        return snapshot?.data && String(snapshot.id) === String(itemId) && String(snapshot.grade) === String(grade)
            ? snapshot
            : null;
    } catch (e) {
        debugWarn('Failed to load API tooltip snapshot:', e);
        return null;
    }
};

const isApiTooltipSnapshotFresh = (snapshot: ApiTooltipSnapshot | null): boolean => (
    snapshot !== null
    && Number.isFinite(snapshot.updatedAt)
    && Date.now() - snapshot.updatedAt < API_TOOLTIP_TTL_MS
);

const saveApiTooltipSnapshot = (itemId: number | string, grade: number | string, data: ApiTooltipData): void => {
    if (itemId == null || !data) return;

    try {
        const raw = localStorage.getItem(LS_KEY_API_TOOLTIPS);
        const all = raw ? JSON.parse(raw) : {};
        all[`${itemId}|${grade ?? 0}`] = {
            id: String(itemId),
            grade: String(grade ?? 0),
            updatedAt: Date.now(),
            data,
        };
        localStorage.setItem(LS_KEY_API_TOOLTIPS, JSON.stringify(all));
    } catch (e) {
        debugWarn('Failed to save API tooltip snapshot:', e);
    }
};

const apiTooltipFieldValue = (value: ApiTooltipFieldValue | undefined): string | null => {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str : null;
};

const apiTooltipNumberValue = (value: ApiTooltipFieldValue | undefined): number | null => {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const apiTooltipStatValue = (value: ApiTooltipFieldValue | undefined): number | string | null => {
    if (value == null || value === '') return null;
    const str = String(value).trim();
    if (!str) return null;

    const num = Number(str);
    return Number.isFinite(num) ? num : str;
};

const API_EQUIP_TOOLTIP_PATTERNS: RegExp[] = [
    /Здоровье/,
    /Защита/,
    /Сопротивление/,
    /Скорость\s+(?:передвижения|плавания|занятия|сбора)/,
    /Опыт\s+при\s+занятии/,
    /Время\s+применения\s+умений/,
];

const isApiEquipTooltipPart = (value: unknown): boolean => {
    const text = stripHtmlForMatch(value);
    return API_EQUIP_TOOLTIP_PATTERNS.some(pattern => pattern.test(text));
};

const mapApiEquipTooltip = (value: ApiTooltipFieldValue | undefined): Partial<ItemBase> => {
    const raw = apiTooltipFieldValue(value);
    if (!raw) return {};

    const parts = raw
        .split(/<br\s*\/?>/i)
        .map(part => cleanApiTooltipMarkup(part))
        .filter(Boolean);

    const equipIndex = parts.findIndex(isApiEquipTooltipPart);
    if (equipIndex === -1) {
        const useDescription = cleanApiTooltipMarkup(raw);
        return useDescription ? { useDescription } : {};
    }

    const equipParts: string[] = [];
    let nextIndex: number = equipIndex;
    while (nextIndex < parts.length && isApiEquipTooltipPart(parts[nextIndex])) {
        equipParts.push(parts[nextIndex]);
        nextIndex++;
    }

    const result: Partial<ItemBase> = {
        equipDescription: equipParts.join('<br/>'),
    };

    if (equipIndex > 0 && /^Действует\b/i.test(stripHtmlForMatch(parts[equipIndex - 1]))) {
        result.isEquipDescriptionTemporary = true;
    }

    const useDescription = cleanApiTooltipMarkup(parts.slice(nextIndex).join('<br/>'));
    if (useDescription) result.useDescription = useDescription;

    return result;
};

const mapApiTooltipToItem = (data: ApiTooltipData | null): Partial<ItemBase> => {
    if (!data || typeof data !== 'object') return {};

    const rawFixedGrade = apiTooltipNumberValue(data.fixed_grade);
    const rawApiGrade = apiTooltipNumberValue(data.grade);
    const fixedGrade = rawFixedGrade != null && rawFixedGrade >= 0 ? convertSiteGrade(rawFixedGrade) : rawFixedGrade;
    const apiGrade = rawApiGrade != null && rawApiGrade >= 0 ? convertSiteGrade(rawApiGrade) : rawApiGrade;
    const grade = apiGrade ?? (fixedGrade != null && fixedGrade >= 0 ? fixedGrade : null);
    const reqLevel = apiTooltipNumberValue(data.level_requirement);
    const maxLevel = apiTooltipNumberValue(data.level_limit);
    const hasRefund = Object.prototype.hasOwnProperty.call(data, 'refund');
    const price = data.refund === null ? null : apiTooltipNumberValue(data.refund);
    const equipTooltipFields = mapApiEquipTooltip(data.equip_tooltip);
    const setDescription = cleanApiTooltipMarkup(data.set_description);
    const rawDescription = cleanApiTooltipMarkup(data.description);
    const description = rawDescription && setDescription && rawDescription.includes(setDescription)
        ? cleanApiTooltipMarkup(rawDescription.replace(setDescription, ''))
        : rawDescription;

    return {
        ...(apiTooltipFieldValue(data.filename) ? { icon: apiTooltipFieldValue(data.filename) } : {}),
        ...(apiTooltipFieldValue(data.name) ? { name: apiTooltipFieldValue(data.name) } : {}),
        ...(grade != null && grade >= 0 ? { grade } : {}),
        ...(fixedGrade != null ? { fixedGrade } : {}),
        ...(description ? { description } : {}),
        ...equipTooltipFields,
        ...(setDescription ? { setDescription } : {}),
        ...(apiTooltipFieldValue(data.cat_name) ? { apiCategoryTitle: apiTooltipFieldValue(data.cat_name) } : {}),
        ...(reqLevel != null && reqLevel > 0 ? { reqLevel } : {}),
        ...(maxLevel != null && maxLevel >= 0 ? { maxLevel } : {}),
        ...(hasRefund && (price !== null || data.refund === null) ? { price } : {}),
        ...(apiTooltipStatValue(data.c_speed) != null ? { speed: apiTooltipStatValue(data.c_speed) } : {}),
        ...(apiTooltipStatValue(data.c_durability) != null ? { durability: apiTooltipStatValue(data.c_durability) } : {}),
        ...(apiTooltipStatValue(data.c_dps) != null ? { dps: apiTooltipStatValue(data.c_dps) } : {}),
        ...(apiTooltipStatValue(data.c_armor) != null ? { armor: apiTooltipStatValue(data.c_armor) } : {}),
        ...(apiTooltipStatValue(data.c_magic_resistance) != null ? { magicResistance: apiTooltipStatValue(data.c_magic_resistance) } : {}),
        ...(apiTooltipStatValue(data.c_mdps) != null ? { mdps: apiTooltipStatValue(data.c_mdps) } : {}),
        ...(apiTooltipStatValue(data.c_hdps) != null ? { hdps: apiTooltipStatValue(data.c_hdps) } : {}),
        ...(apiTooltipStatValue(data.c_str) != null ? { str: apiTooltipStatValue(data.c_str) } : {}),
        ...(apiTooltipStatValue(data.c_dex) != null ? { dex: apiTooltipStatValue(data.c_dex) } : {}),
        ...(apiTooltipStatValue(data.c_sta) != null ? { sta: apiTooltipStatValue(data.c_sta) } : {}),
        ...(apiTooltipStatValue(data.c_int) != null ? { int: apiTooltipStatValue(data.c_int) } : {}),
        ...(apiTooltipStatValue(data.c_spi) != null ? { spi: apiTooltipStatValue(data.c_spi) } : {}),
        ...(apiTooltipNumberValue(data.num_sockets) != null ? { numSockets: apiTooltipNumberValue(data.num_sockets) } : {}),
        ...(apiTooltipFieldValue(data.gradable) ? { isGradable: apiTooltipFieldValue(data.gradable) === 't' } : {}),
        ...(apiTooltipFieldValue(data.grade_enchantable) ? { isGradeEnchantable: apiTooltipFieldValue(data.grade_enchantable) === 't' } : {}),
        ...(apiTooltipNumberValue(data.dyeing) != null ? { isDyeable: apiTooltipNumberValue(data.dyeing) === 1 } : {}),
        ...(data.buff && typeof data.buff === 'object' ? { buff: data.buff } : {}),
    };
};

const mergeItemSources = (...sources: Array<Partial<ItemBase> | null | undefined>): Partial<ItemBase> => {
    const merged: Partial<ItemBase> = {};
    for (const source of sources) {
        if (!source) continue;
        for (const [field, value] of Object.entries(source)) {
            if (value === undefined || value === '') continue;
            if (field === 'buff') {
                merged.buff = { ...(merged.buff || {}), ...((value || {}) as Record<string, string | number | boolean | null>) };
                continue;
            }
            (merged as Record<string, unknown>)[field] = value;
        }
    }
    return merged;
};

interface ItemRestoreCatalogSnapshot {
    id: string;
    grade: string;
    updatedAt: number;
    data: Record<string, unknown>;
}

const mapItemRestoreCacheToItem = (data: Record<string, unknown> | null | undefined): Partial<ItemBase> => {
    if (!data) return {};
    // Новый формат уже хранит нормализованный Partial<ItemBase>.
    if (!('gi_name' in data) && !('iconurl' in data) && !('type' in data)) {
        const item = { ...data } as Partial<ItemBase> & { dynamicTooltipGrade?: number };
        if (item.siteTooltipGrade == null && item.dynamicTooltipGrade != null) {
            item.siteTooltipGrade = item.dynamicTooltipGrade;
        }
        delete item.dynamicTooltipGrade;
        return item;
    }

    const rawGrade = Number(data.grade);
    const refund = data.gi_refund;
    return {
        ...(data.type != null && Number.isFinite(Number(data.type)) ? { id: Number(data.type) } : {}),
        ...(data.iconurl ? { icon: String(data.iconurl) } : data.gi_filename ? { icon: String(data.gi_filename) } : {}),
        ...(data.gi_name ? { name: String(data.gi_name) } : {}),
        ...(data.gi_description ? { description: String(data.gi_description) } : {}),
        ...(data.bind !== '' && data.bind != null ? { bind: data.bind as number | string } : {}),
        ...(refund !== '' && refund !== undefined ? { price: refund === null ? null : Number(refund) } : {}),
        ...(Number.isFinite(rawGrade) ? { grade: convertSiteGrade(rawGrade), siteTooltipGrade: rawGrade } : {}),
    };
};

const loadItemRestoreSnapshot = (itemId: number | string, preferredGrade?: number): Partial<ItemBase> | null => {
    try {
        const raw = localStorage.getItem(LS_KEY_ITEM_RESTORE_ITEMS);
        if (!raw) return null;
        const catalog = JSON.parse(raw) as Record<string, ItemRestoreCatalogSnapshot | undefined>;
        const snapshots = Object.values(catalog)
            .filter((snapshot): snapshot is ItemRestoreCatalogSnapshot => Boolean(snapshot?.data) && String(snapshot?.id) === String(itemId))
            .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        if (!snapshots.length) return null;

        const snapshot = preferredGrade == null
            ? snapshots[0]
            : snapshots.find(entry => String(entry.grade) === String(preferredGrade));
        if (!snapshot) return null;
        return mapItemRestoreCacheToItem(snapshot.data);
    } catch (e) {
        debugWarn('Failed to load item restore snapshot:', e);
        return null;
    }
};

export interface ItemTooltipSlot {
    item?: Partial<ItemBase>;
    count?: number | string;
}

interface ResolvedTooltipItem {
    item: ItemBase;
    grade: number;
    apiTooltipSnapshot: ApiTooltipSnapshot | null;
}

export const resolveTooltipItem = (itemId: number, slot?: ItemTooltipSlot): ResolvedTooltipItem => {
    const knownItem = ITEMS[itemId];
    const knownGrade = getPreferredSiteTooltipGrade(knownItem || {});
    const restoreItem = loadItemRestoreSnapshot(itemId, knownGrade);
    const restoreGrade = getPreferredSiteTooltipGrade(restoreItem || {});
    const slotGrade = getPreferredSiteTooltipGrade(slot?.item || {});
    const grade = knownGrade ?? restoreGrade ?? slotGrade ?? 0;
    const apiTooltipSnapshot = loadApiTooltipSnapshot(itemId, grade);
    const apiTooltipData = apiTooltipCache.get(getApiTooltipKey(itemId, grade)) || apiTooltipSnapshot?.data || null;
    const apiTooltipItem = mapApiTooltipToItem(apiTooltipData);
    const slotItem = { ...(slot?.item || {}) };
    delete slotItem.grade;
    delete slotItem.siteTooltipGrade;
    delete slotItem.isGradeInferred;

    const item = mergeItemSources(
        { id: itemId, icon: '', name: '' },
        apiTooltipItem,
        restoreItem,
        knownItem,
        slotItem,
    ) as ItemBase;

    const gradeSources = [slot?.item, apiTooltipItem, restoreItem, knownItem];
    const winningGradeSource = gradeSources.reduce<Partial<ItemBase> | null>((winner, source) => (
        source?.grade != null && Number.isFinite(Number(source.grade)) ? source : winner
    ), null);
    if (winningGradeSource?.grade != null) {
        item.grade = Number(winningGradeSource.grade);
        delete item.isGradeInferred;
        if (winningGradeSource.isGradeInferred) item.isGradeInferred = true;
    }
    item.siteTooltipGrade = grade;

    return { item, grade, apiTooltipSnapshot };
};

const fetchApiTooltipData = async (itemId: number | string, grade: number): Promise<ApiTooltipData | null> => {
    if (!isArcheageSite) return null;

    const key = getApiTooltipKey(itemId, grade);
    const cached = apiTooltipCache.get(key);
    if (cached) return cached;
    const pending = apiTooltipPromises.get(key);
    if (pending) return pending;

    const snapshot = loadApiTooltipSnapshot(itemId, grade);
    if (isApiTooltipSnapshotFresh(snapshot)) {
        apiTooltipCache.set(key, snapshot.data);
        return snapshot.data;
    }

    const promise: Promise<ApiTooltipData | null> = fetch(`/dynamic/tooltip/?a=item&id=${encodeURIComponent(itemId)}&g=${encodeURIComponent(grade)}`, {
        credentials: 'include',
        cache: 'no-store',
    })
        .then(res => res.ok ? res.json() : null)
        .then((data: unknown) => {
            if (data && typeof data === 'object') saveApiTooltipSnapshot(itemId, grade, data as ApiTooltipData);
            return data && typeof data === 'object' ? data as ApiTooltipData : null;
        })
        .catch(e => {
            debugWarn(`Failed to fetch API tooltip for item ${itemId}:`, e);
            return null;
        });

    apiTooltipPromises.set(key, promise);
    const data = await promise;
    apiTooltipPromises.delete(key);
    if (data) apiTooltipCache.set(key, data);
    return data;
};

export interface MakeItemIconLinkParams {
    itemId: number;
    slot?: ItemTooltipSlot;
    linked?: boolean;
    size?: string;
    noTooltip?: boolean;
}

interface SetDescriptionParts {
    nameHtml: string;
    itemNames: string[];
    effects: string;
}

const parseSetDescription = (value: string): SetDescriptionParts | null => {
    const lines = value
        .split(/<br\s*\/?>/i)
        .map(line => line.trim())
        .filter(line => stripHtmlForMatch(line));
    if (lines.length < 2) return null;

    const firstLine = stripHtmlForMatch(lines[0]);
    const firstLineMatch = firstLine.match(/^(.+?)\s*\(\s*\d+\s*\/\s*(\d+)\s*\)$/);
    if (!firstLineMatch) return null;

    const effectsIndex = lines.findIndex((line, index) => (
        index > 0 && /эффекты\s+комплекта/i.test(stripHtmlForMatch(line))
    ));
    if (effectsIndex === -1) return null;

    return {
        nameHtml: lines[0].replace(/\(\s*\d+\s*\/\s*(\d+)\s*\)/, '(0/$1)'),
        itemNames: lines.slice(1, effectsIndex).map(stripHtmlForMatch).filter(Boolean),
        effects: lines.slice(effectsIndex + 1).join('<br/>'),
    };
};

type ItemIconElement = HTMLAnchorElement | HTMLDivElement;

export const makeItemIconLink = ({ itemId, slot, linked = false, size = 'medium', noTooltip = false }: MakeItemIconLinkParams): ItemIconElement => {
    injectItemIconStyles();
    const item = resolveTooltipItem(itemId, slot).item;

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

    if (slot?.count && Number(slot.count) > 1) {
        const countEl = pageDocument.createElement('div');
        countEl.className = 'tm-item-icon-count';
        countEl.textContent = Number(slot.count).toLocaleString('en-US');
        icon.appendChild(countEl);
    }

    if (!noTooltip) {
        icon.addEventListener('mouseenter', () => showTooltip(itemId, icon, slot));
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
    const bind = item.bind != null && item.bind !== '' ? Number(item.bind) : null;
    const bindText = bind === 2
        ? 'Персональный предмет'
        : bind === 3
            ? 'Становится персональным при использовании.'
            : null;

    const headerSection = pageDocument.createElement('div');
    headerSection.className = 'tm-item-tooltip-header';

    const iconEl = makeItemIconLink({ itemId: item.id, slot: { item }, noTooltip: true });
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

    if (item.isDyeable) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const dyeingSection = pageDocument.createElement('div');
        dyeingSection.className = 'tm-item-tooltip-dyeing';
        dyeingSection.textContent = 'Можно перекрасить';
        tooltip.appendChild(dyeingSection);
    }

    if (bindText || item.reqLevel != null || item.maxLevel != null) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const reqSection = pageDocument.createElement('div');
        reqSection.className = 'tm-item-tooltip-req';
        if (item.reqLevel != null || item.maxLevel != null) {
            reqSection.appendChild(makeRequiredLevelLine(item.reqLevel, item.maxLevel));
        }
        if (bindText) {
            const p = pageDocument.createElement('div');
            p.textContent = bindText;
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
    const hasSetDescription = item.setDescription && hasVisibleTooltipText(item.setDescription);
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

    if (hasSetDescription) {
        const sep = pageDocument.createElement('div');
        sep.className = 'tm-item-tooltip-sep';
        tooltip.appendChild(sep);

        const setSection = pageDocument.createElement('div');
        setSection.className = 'tm-item-tooltip-set';

        const setParts = parseSetDescription(item.setDescription);
        if (!setParts) {
            const setText = pageDocument.createElement('div');
            setText.className = 'tm-item-tooltip-use-text';
            setText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.setDescription, item));
            setSection.appendChild(setText);
        } else {
            const setName = pageDocument.createElement('div');
            setName.innerHTML = parseGameMarkup(setParts.nameHtml);
            setSection.appendChild(setName);

            const itemGrid = pageDocument.createElement('div');
            itemGrid.className = 'tm-item-tooltip-set-grid';
            for (const itemName of setParts.itemNames) {
                const setItem = findItemByName(itemName);
                if (setItem) {
                    itemGrid.appendChild(makeItemIconLink({ itemId: setItem.id, size: 'tiny', noTooltip: true }));
                } else {
                    const emptyCell = makeEmptyCell();
                    emptyCell.classList.add('tm-item-tooltip-set-slot');
                    emptyCell.title = itemName;
                    itemGrid.appendChild(emptyCell);
                }
            }
            setSection.appendChild(itemGrid);

            if (setParts.effects) {
                const effectsTitle = pageDocument.createElement('div');
                effectsTitle.className = 'inv-ng';
                effectsTitle.textContent = 'Эффекты комплекта';
                setSection.appendChild(effectsTitle);

                const effects = pageDocument.createElement('div');
                effects.className = 'tm-item-tooltip-set-effects';
                effects.innerHTML = parseGameMarkup(setParts.effects);
                setSection.appendChild(effects);
            }
        }

        tooltip.appendChild(setSection);
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
export const showTooltip = (itemId: number, anchorEl: HTMLElement, slot?: ItemTooltipSlot): void => {
    initTooltipDom();
    const resolved = resolveTooltipItem(itemId, slot);
    const key = getApiTooltipKey(itemId, resolved.grade);
    const isApiDataLoading = isArcheageSite
        && !apiTooltipCache.has(key)
        && !isApiTooltipSnapshotFresh(resolved.apiTooltipSnapshot);
    const tooltipToken = Symbol(key);
    activeTooltipToken = tooltipToken;
    populateTooltip(resolved.item);
    if (isApiDataLoading) {
        getTooltipContainer().appendChild(makeLoader({
            label: 'Загрузка дополнительной информации',
            className: 'tm-item-tooltip-loader',
        }));
    }
    positionTooltip(anchorEl);

    fetchApiTooltipData(itemId, resolved.grade).then(data => {
        if (activeTooltipToken !== tooltipToken) return;

        if (data) populateTooltip(resolveTooltipItem(itemId, slot).item);
        else getTooltipContainer().querySelector('.tm-item-tooltip-loader')?.remove();
        positionTooltip(anchorEl);
    });
};

/** Скрывает тултип. */
export const hideTooltip = (): void => {
    activeTooltipToken = null;
    if (globalTooltip) {
        globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS, TOOLTIP_BOTTOM_CLASS);
    }
};

interface SiteTooltipItem {
    icon: HTMLElement;
    itemId: number;
    slot?: ItemTooltipSlot;
}

const getSiteTooltipItem = (target: EventTarget | null): SiteTooltipItem | null => {
    const icon = target instanceof Element
        ? target.closest<HTMLElement>('.aa_item_tooltip[data-id]')
        : null;
    const itemId = icon?.dataset?.id;
    if (!itemId) return null;

    const numericItemId = Number(itemId);
    if (!Number.isFinite(numericItemId)) return null;

    const grade = Number(icon.dataset.grade);
    const slot: ItemTooltipSlot = {
        item: {
            icon: icon.querySelector<HTMLImageElement>('img')?.src || '',
            ...(Number.isFinite(grade) && grade !== 0 ? {
                siteTooltipGrade: grade,
                grade: convertSiteGrade(grade),
            } : {}),
        },
    };
    return { icon, itemId: numericItemId, slot };
};

const prepareSiteTooltipWikiLink = (event: MouseEvent): void => {
    const link = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a.aa_item_tooltip')
        : null;
    if (!link || link.getAttribute('href') !== '#') return;

    const itemId = Number(link.dataset.id);
    if (!Number.isFinite(itemId)) return;

    const item = resolveTooltipItem(itemId).item;
    link.href = getItemCodexUrl(item);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
};

export const initTooltips = (): void => {
    initTooltipDom();
    if (tooltipDomInitialized) return;
    tooltipDomInitialized = true;

    // Capture позволяет заменить заглушку href до обработки клика самой страницей.
    pageDocument.addEventListener('click', prepareSiteTooltipWikiLink, true);

    pageDocument.addEventListener('mouseover', (event) => {
        const found = getSiteTooltipItem(event.target);
        if (!found || found.icon.contains(event.relatedTarget as Node | null)) return;
        showTooltip(found.itemId, found.icon, found.slot);
    });
    pageDocument.addEventListener('mouseout', (event) => {
        const found = getSiteTooltipItem(event.target);
        if (!found || found.icon.contains(event.relatedTarget as Node | null)) return;
        hideTooltip();
    });
};

export const initTooltip = initTooltips;
