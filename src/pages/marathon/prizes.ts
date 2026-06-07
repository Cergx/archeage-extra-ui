import { API_INFO_CACHE } from './core.js';
import { pageDocument } from '../../utils/env.js';

type RewardType = 'trial' | 'premium';
type TimerId = ReturnType<typeof setInterval>;

interface VueStore {
    state?: {
        maininfo?: {
            user_info?: { status?: string };
            userInfo?: { status?: string };
            info?: { user_info?: { status?: string } };
        };
    };
    dispatch: (type: string, payload?: unknown) => Promise<unknown> | unknown;
    commit: (type: string, payload?: unknown) => void;
}

interface PrizeVm {
    per_on_page?: number;
    current_page: number;
    $nextTick: (callback: () => void) => void;
}

interface LootboxVm {
    openBox?: () => void;
    is_show_popup?: boolean;
    is_button_pushed?: boolean;
    getChestNum: number;
}

interface VueElement extends Element {
    __vue__?: unknown;
}

interface LevelPrizeResponse {
    data?: {
        farmed_rewards?: Record<string, string[]>;
    };
}

export const LS_KEY_AUTO_CLAIM = 'tm_aa_prizes_auto_claim';
export const LS_KEY_AUTO_OPEN_BOXES = 'tm_aa_auto_open_boxes';
export const CLAIM_DELAY_MS = 400;

// Загрузить состояние автозабора из localStorage
export const loadAutoClaimState = (): boolean => {
    try {
        return localStorage.getItem(LS_KEY_AUTO_CLAIM) === 'true';
    } catch {
        return false;
    }
};

/** Сохранить состояние автозабора в localStorage. @param {boolean} enabled */
export const saveAutoClaimState = (enabled: boolean): void => {
    try {
        localStorage.setItem(LS_KEY_AUTO_CLAIM, enabled ? 'true' : 'false');
    } catch {
        // ignore
    }
};

// Определить целевой уровень из данных API
export const getTargetPrizeLevelFromApi = (): number => {
    const userInfo = API_INFO_CACHE?.data?.user_info;
    if (!userInfo) return 1;

    const currentLevel = userInfo.level || 1;
    const status = userInfo.status || 'trial';
    const farmedKey = status === 'premium' ? 'premium' : 'trial';
    const farmedRewards = userInfo.farmed_rewards?.[farmedKey] || [];

    // Преобразуем в Set чисел для быстрого поиска
    const farmedSet = new Set<number>(farmedRewards.map((x: string) => parseInt(x, 10)));

    // Ищем первый незабранный подарок (от 1 до currentLevel)
    for (let level = 1; level <= currentLevel; level++) {
        if (!farmedSet.has(level)) {
            return level; // Первый активный (незабранный)
        }
    }

    // Все забраны - показываем следующий уровень (первый disabled)
    return currentLevel + 1;
};

/**
 * Найти Vue-инстанс компонента Prizes (хранит current_page / per_on_page).
 * Корневой элемент Prizes — div.game__right.
 * @returns {Vue|null}
 */
export const getPrizesVm = (): PrizeVm | null => {
    const el = pageDocument.querySelector<VueElement>('.game__right');
    return (el?.__vue__ as PrizeVm | undefined) ?? null;
};

// Пролистать к первому нужному подарку, выставив current_page напрямую
export const scrollToFirstRelevantPrize = (): void => {
    const targetLevel = getTargetPrizeLevelFromApi();
    const vm = getPrizesVm();
    if (!vm) return;

    const perPage = vm.per_on_page || 10;
    vm.current_page = Math.floor((targetLevel - 1) / perPage);
};

// Забрать все доступные подарки через родной Vuex store (без кликов по DOM)
export const claimAllActivePrizes = async (): Promise<void> => {
    await claimAllLevelRewards();
};

/** Получить Vuex store родного приложения. */
export const getVueStore = (): VueStore | null => {
    const page = pageDocument.querySelector('.page');
    const parent = page?.parentElement as (HTMLElement & { __vue__?: { $store?: VueStore } }) | undefined;
    return parent?.__vue__?.$store ?? null;
};

/**
 * Забирает подарок за уровень через родной Vuex store dispatch.
 * Это обновляет farmed_rewards в Vue-стейте и перерисовывает UI подарков.
 * @param {number} level
 * @param {boolean} isPremium
 * @returns {Promise<void>}
 */
export const farmLevelReward = (level: number, isPremium: boolean): Promise<unknown> => {
    const store = getVueStore();
    if (!store) return Promise.reject(new Error('Vue store not found'));

    return new Promise((resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => {
        store.dispatch('maininfo/getLevelPrize', {
            level,
            is_premium: isPremium ? 1 : 0,
            callback_success: (data: LevelPrizeResponse) => {
                // Синхронизируем собственный кэш с обновлёнными данными
                const userInfo = API_INFO_CACHE?.data?.user_info;
                if (userInfo && data?.data?.farmed_rewards) {
                    userInfo.farmed_rewards = data.data.farmed_rewards;
                }
                resolve(data);
            },
            callback_error: () => {
                reject(new Error(`getLevelPrize failed for level=${level}`));
            },
        });
    });
};

/**
 * Точечно обновляет farmed_rewards и баланс магазина в Vuex store.
 * Не трогает quests/action_info, чтобы не перерисовать блок заданий.
 * Принудительно пересоздаёт компоненты PrizesItem через смену ключа слайдера.
 */
export const syncNativeRewardsState = (): void => {
    const store = getVueStore();
    if (!store) return;
    const farmedRewards = API_INFO_CACHE?.data?.user_info?.farmed_rewards;
    if (farmedRewards) {
        // Deep copy — гарантируем новую ссылку для Vue 2 reactivity
        store.commit('maininfo/setUserRewards', JSON.parse(JSON.stringify(farmedRewards)));
    }
    // Обновляем баланс монет в магазине (подарки могут содержать валюту)
    store.dispatch('shop/getShopInfo');

    // Принудительно пересоздаём PrizesItem:
    // <transition :key="current_page"> уничтожает/создаёт компоненты при смене ключа
    const vm = getPrizesVm();
    if (vm) {
        const page = vm.current_page;
        vm.current_page = -1;
        vm.$nextTick(() => { vm.current_page = page; });
    }
};

/**
 * Забирает все доступные подарки за уровни через родной Vuex store.
 * После забора точечно обновляет farmed_rewards в нативном store,
 * чтобы UI подарков перерисовался без затрагивания блока заданий.
 */
export const claimAllLevelRewards = async (): Promise<void> => {
    const userInfo = API_INFO_CACHE?.data?.user_info;
    if (!userInfo) return;
    if (!getVueStore()) return;

    const currentLevel = userInfo.level || 1;
    const status = userInfo.status || 'trial';
    const isPremium = status === 'premium';

    // Какие типы наград забирать
    const rewardTypes: RewardType[] = isPremium ? ['trial', 'premium'] : ['trial'];

    let claimed = false;

    for (const type of rewardTypes) {
        const farmed = new Set((userInfo.farmed_rewards?.[type] || []).map(Number));

        for (let level = 1; level <= currentLevel; level++) {
            if (farmed.has(level)) continue;

            try {
                await farmLevelReward(level, type === 'premium');
                claimed = true;
                await new Promise<void>(r => setTimeout(r, CLAIM_DELAY_MS));
            } catch (e) {
                console.warn(`[ArcheAgeExtraUI] claimLevelReward(${level}, ${type}) failed:`, e);
            }
        }
    }

    // Точечно обновляем farmed_rewards в нативном store
    if (claimed) {
        syncNativeRewardsState();
    }
};

// ==================== Автооткрытие сундуков ====================

export const loadAutoOpenBoxesState = (): boolean => {
    try {
        return localStorage.getItem(LS_KEY_AUTO_OPEN_BOXES) === 'true';
    } catch {
        return false;
    }
};

export const saveAutoOpenBoxesState = (enabled: boolean): void => {
    try {
        localStorage.setItem(LS_KEY_AUTO_OPEN_BOXES, String(enabled));
    } catch {
        // ignore
    }
};

/**
 * Получить Vue-инстанс компонента Lootbox.
 * @returns {Vue|null}
 */
export const getLootboxVm = (): LootboxVm | null => {
    const el = pageDocument.querySelector<VueElement>('.lootbox');
    return (el?.__vue__ as LootboxVm | undefined) ?? null;
};

export const hasPremiumMarathonAccess = (): boolean => {
    if (API_INFO_CACHE?.data?.user_info?.status === 'premium') return true;

    const store = getVueStore();
    return store?.state?.maininfo?.user_info?.status === 'premium'
        || store?.state?.maininfo?.userInfo?.status === 'premium'
        || store?.state?.maininfo?.info?.user_info?.status === 'premium';
};

let autoOpenBoxesIntervalId: TimerId | null = null;

/**
 * Проверяет условия и открывает один сундук, если возможно.
 * Вызывается по интервалу.
 */
export const tryOpenNextBox = (): void => {
    if (!loadAutoOpenBoxesState()) return;

    const lootbox = getLootboxVm();
    if (!lootbox || typeof lootbox.openBox !== 'function') return;

    // Проверяем, что popup закрыт и не идёт открытие
    if (lootbox.is_show_popup || lootbox.is_button_pushed) return;

    // Проверяем, есть ли сундуки
    const boxesAvailable = lootbox.getChestNum;
    if (boxesAvailable <= 0 || !hasPremiumMarathonAccess()) return;

    console.log(`[ArcheAgeExtraUI] Автооткрытие сундука (осталось: ${boxesAvailable})`);
    lootbox.openBox();
};

export const startAutoOpenBoxesInterval = (): void => {
    if (autoOpenBoxesIntervalId != null) return;
    autoOpenBoxesIntervalId = setInterval(tryOpenNextBox, 1000);
};

export const stopAutoOpenBoxesInterval = (): void => {
    if (autoOpenBoxesIntervalId != null) {
        clearInterval(autoOpenBoxesIntervalId);
        autoOpenBoxesIntervalId = null;
    }
};

/**
 * Инициализация галочки "Открывать при получении" в блоке lootbox.
 */
export const initAutoOpenBoxesCheckbox = (): void => {
    const lootboxTitle = document.querySelector('.lootbox__title');
    if (!lootboxTitle) return;

    // Проверяем, что галочка ещё не добавлена
    if (lootboxTitle.querySelector('.tm-auto-open-label')) return;

    const label = document.createElement('label');
    label.className = 'tm-auto-open-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tm-auto-open-checkbox';
    checkbox.checked = loadAutoOpenBoxesState();

    const text = document.createTextNode('Открывать при получении');
    label.appendChild(checkbox);
    label.appendChild(text);

    lootboxTitle.appendChild(label);

    checkbox.addEventListener('change', () => {
        saveAutoOpenBoxesState(checkbox.checked);
        if (checkbox.checked) {
            startAutoOpenBoxesInterval();
        } else {
            stopAutoOpenBoxesInterval();
        }
    });

    // Запускаем интервал, если галочка уже включена
    if (checkbox.checked) {
        startAutoOpenBoxesInterval();
    }
};

// Инициализация галочки автозабора
export const initAutoClaimCheckbox = (): void => {
    const prizesTitle = document.querySelector('.prizes__title');
    if (!prizesTitle) return;

    // Проверяем, что галочка ещё не добавлена
    if (prizesTitle.querySelector('.tm-auto-claim-label')) return;

    const label = document.createElement('label');
    label.className = 'tm-auto-claim-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tm-auto-claim-checkbox';
    checkbox.checked = loadAutoClaimState();

    const text = document.createTextNode(' Забирать автоматически');
    label.appendChild(checkbox);
    label.appendChild(text);

    prizesTitle.appendChild(label);

    // Обработчик изменения
    checkbox.addEventListener('change', async () => {
        saveAutoClaimState(checkbox.checked);
        if (checkbox.checked) {
            await claimAllActivePrizes();
        }
    });

};

// Инициализация блока подарков
export const initPrizes = async (): Promise<void> => {
    // Ждём появления блока подарков
    const prizesWrap = document.querySelector('.prizes__wrap');
    if (!prizesWrap) return;

    // Добавляем галочку автозабора
    initAutoClaimCheckbox();

    // Пролистываем к первому нужному подарку
    scrollToFirstRelevantPrize();

    // Автозабор при загрузке (кликаем по DOM, т.к. блок подарков уже отрендерен)
    if (loadAutoClaimState()) {
        await claimAllActivePrizes();
    }
};
