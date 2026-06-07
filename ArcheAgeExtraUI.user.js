// ==UserScript==
// @name         ArcheAgeExtraUI
// @namespace    https://archeage.ru/
// @version      4.11.1
// @description  Доработка страниц марафона, корзины и восстановления предметов
// @author       Cergx
// @match        *://archeage.ru/*
// @match        *://gisaa.ru/veksel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
(() => {
  let __defProp = Object.defineProperty;
  let __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/adapter/env.ts
  let pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  let pageDocument = pageWindow.document;
  let readSharedValue = /* @__PURE__ */ __name((key) => {
    if (typeof GM_getValue === "function") {
      const value = GM_getValue(key);
      if (value !== void 0 && value !== null) return String(value);
    }
    return void 0;
  }, "readSharedValue");
  let writeSharedValue = /* @__PURE__ */ __name((key, value) => {
    if (typeof GM_setValue === "function") {
      GM_setValue(key, value);
    }
  }, "writeSharedValue");
  let onIrData = null;

  // src/utils/env.ts
  let isGisaaSite = location.hostname.includes("gisaa.ru");
  let isArcheageSite = location.hostname.includes("archeage.ru");
  let isCartPage = isArcheageSite && (location.pathname === "/cart" || location.pathname === "/cart/");
  let isItemRestorePage = isArcheageSite && (location.pathname === "/itemrestore" || location.pathname === "/itemrestore/");

  // src/utils/time.ts
  let TZ = "Europe/Moscow";
  let MSK_OFFSET_HOURS = 3;
  let NOW_MS = null;
  let SERVER_TIME_OFFSET = null;
  let setNowMs = /* @__PURE__ */ __name((value) => {
    NOW_MS = value;
  }, "setNowMs");
  let setServerTimeOffset = /* @__PURE__ */ __name((value) => {
    SERVER_TIME_OFFSET = value;
  }, "setServerTimeOffset");
  let pad2 = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad2");
  let nowMs = /* @__PURE__ */ __name(() => {
    if (NOW_MS == null) {
      throw new Error("[ArcheAgeExtraUI] NOW_MS is not initialized");
    }
    return NOW_MS;
  }, "nowMs");
  let getNowUnix = /* @__PURE__ */ __name(() => Math.floor(nowMs() / 1e3), "getNowUnix");
  let getMSKDatePartsFromUtcMs = /* @__PURE__ */ __name((utcMs) => {
    const d = new Date(utcMs);
    const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(d);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    return { y, m, d: day };
  }, "getMSKDatePartsFromUtcMs");
  let formatDMY = /* @__PURE__ */ __name(({ y, m, d }) => `${pad2(d)}.${pad2(m)}.${y}`, "formatDMY");
  let formatTimeMSK = /* @__PURE__ */ __name((unixSec) => {
    if (!unixSec) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(unixSec * 1e3));
  }, "formatTimeMSK");
  let dayUtcMsFromUnixByTZ = /* @__PURE__ */ __name((unixSec) => {
    const ms = Number(unixSec || 0) * 1e3;
    const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
    return Date.UTC(y, m - 1, d, 0, 0, 0);
  }, "dayUtcMsFromUnixByTZ");
  let getTodayUtcMsByTZ = /* @__PURE__ */ __name(() => {
    const { y, m, d } = getMSKDatePartsFromUtcMs(nowMs());
    return Date.UTC(y, m - 1, d, 0, 0, 0);
  }, "getTodayUtcMsByTZ");
  let addDaysUtcMs = /* @__PURE__ */ __name((dayUtcMs, deltaDays) => dayUtcMs + deltaDays * 864e5, "addDaysUtcMs");
  let getDayBoundsUnix = /* @__PURE__ */ __name((dayUtcMs) => {
    const { y, m, d } = getMSKDatePartsFromUtcMs(dayUtcMs);
    const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MSK_OFFSET_HOURS * 3600 * 1e3;
    const endMs = startMs + 864e5;
    return { start: Math.floor(startMs / 1e3), end: Math.floor(endMs / 1e3) };
  }, "getDayBoundsUnix");
  let getUnixForDayAtHour = /* @__PURE__ */ __name((dayUtcMs, hourMsk) => {
    const { start } = getDayBoundsUnix(dayUtcMs);
    return start + hourMsk * 3600;
  }, "getUnixForDayAtHour");
  let isSameDayByTZ = /* @__PURE__ */ __name((aUtcMs, bUtcMs) => {
    const a = getMSKDatePartsFromUtcMs(aUtcMs);
    const b = getMSKDatePartsFromUtcMs(bUtcMs);
    return a.y === b.y && a.m === b.m && a.d === b.d;
  }, "isSameDayByTZ");
  let isThursdayByTZ = /* @__PURE__ */ __name((dayUtcMs) => {
    const w = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(dayUtcMs));
    return w === "Thu";
  }, "isThursdayByTZ");
  let getServerNowMs = /* @__PURE__ */ __name(() => {
    if (SERVER_TIME_OFFSET == null) return Date.now();
    return Date.now() + SERVER_TIME_OFFSET;
  }, "getServerNowMs");
  let initServerTimeOffset = /* @__PURE__ */ __name(() => {
    if (NOW_MS != null && SERVER_TIME_OFFSET == null) {
      SERVER_TIME_OFFSET = NOW_MS - Date.now();
    }
  }, "initServerTimeOffset");
  let syncServerTime = /* @__PURE__ */ __name(async () => {
    if (SERVER_TIME_OFFSET != null) return;
    try {
      const t0 = Date.now();
      const res = await fetch(location.href, { method: "HEAD", credentials: "include", cache: "no-store" });
      const t1 = Date.now();
      const dateHeader = res.headers.get("Date");
      const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
      if (Number.isFinite(parsed)) {
        NOW_MS = parsed + (t1 - t0) / 2;
        SERVER_TIME_OFFSET = NOW_MS - Date.now();
      }
    } catch {
    }
  }, "syncServerTime");
  let getMSKWeekday = /* @__PURE__ */ __name((utcMs) => {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
    const dayStr = fmt.format(new Date(utcMs));
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[dayStr] ?? 1;
  }, "getMSKWeekday");
  let getMSKTimeOfDaySeconds = /* @__PURE__ */ __name((utcMs) => {
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const str = fmt.format(new Date(utcMs));
    const [h, m, s] = str.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }, "getMSKTimeOfDaySeconds");
  let WEEKDAY_NAMES = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
  let parseTime = /* @__PURE__ */ __name((timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return { hours: h, minutes: m };
  }, "parseTime");
  let getTodayWeekdayMonFirst = /* @__PURE__ */ __name(() => {
    return (getMSKWeekday(getServerNowMs()) + 6) % 7;
  }, "getTodayWeekdayMonFirst");
  let formatAvailableWeekdaysStatus = /* @__PURE__ */ __name((weekdays) => {
    if (!weekdays?.length) return "";
    return weekdays.includes(getTodayWeekdayMonFirst()) ? "Можно сегодня взять" : "Сегодня нельзя взять";
  }, "formatAvailableWeekdaysStatus");

  // src/utils/events-time.ts
  let getSecondsUntilNextEvent = /* @__PURE__ */ __name((events) => {
    if (!events || !events.length) return null;
    const serverNow = getServerNowMs();
    const nowWeekday = getMSKWeekday(serverNow);
    const nowSeconds = getMSKTimeOfDaySeconds(serverNow);
    let minDiff = Infinity;
    for (const event of events) {
      const start = parseTime(event.timeStart);
      const startSeconds = start.hours * 3600 + start.minutes * 60;
      if (event.timeEnd) {
        const end = parseTime(event.timeEnd);
        const endSeconds = end.hours * 3600 + end.minutes * 60;
        const isToday = !event.weekdays || event.weekdays.length === 0 || event.weekdays.includes(nowWeekday);
        if (isToday && nowSeconds >= startSeconds && nowSeconds < endSeconds) {
          return -(endSeconds - nowSeconds);
        }
      }
      if (!event.weekdays || event.weekdays.length === 0) {
        let diff = startSeconds - nowSeconds;
        if (diff <= 0) diff += 24 * 3600;
        if (diff < minDiff) minDiff = diff;
      } else {
        for (const targetWeekday of event.weekdays) {
          let daysUntil = targetWeekday - nowWeekday;
          if (daysUntil < 0) daysUntil += 7;
          let diff = daysUntil * 24 * 3600 + (startSeconds - nowSeconds);
          if (diff <= 0) diff += 7 * 24 * 3600;
          if (diff < minDiff) minDiff = diff;
        }
      }
    }
    return minDiff === Infinity ? null : minDiff;
  }, "getSecondsUntilNextEvent");
  let formatEventTime = /* @__PURE__ */ __name((event) => event.timeEnd ? `${event.timeStart}–${event.timeEnd}` : event.timeStart, "formatEventTime");
  let formatEventsToString = /* @__PURE__ */ __name((events) => {
    if (!events || !events.length) return "";
    const daily = [];
    const withWeekdays = [];
    for (const event of events) {
      if (!event.weekdays || event.weekdays.length === 0) {
        daily.push(formatEventTime(event));
      } else {
        withWeekdays.push(event);
      }
    }
    const parts = [];
    if (daily.length > 0) {
      parts.push(daily.join(" / "));
    }
    for (const event of withWeekdays) {
      const days = event.weekdays.map((d) => WEEKDAY_NAMES[d]).join(", ");
      parts.push(`${days} ${formatEventTime(event)}`);
    }
    return parts.join(" / ");
  }, "formatEventsToString");
  let formatCountdown = /* @__PURE__ */ __name((seconds) => {
    if (seconds == null || seconds < 0) return "";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor(seconds % 86400 / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = seconds % 60;
    if (d > 0) {
      return `${d}д ${h}ч`;
    } else if (h > 0) {
      return `${h}ч ${m}м`;
    } else if (m > 0) {
      return `${m}м ${s}с`;
    } else {
      return `${s}с`;
    }
  }, "formatCountdown");
  let updateCountdownEl = /* @__PURE__ */ __name((el, seconds) => {
    el.classList.remove("tm-countdown--active", "tm-countdown--waiting");
    if (seconds == null) {
      el.textContent = "";
    } else if (seconds <= 0) {
      el.textContent = ` (идёт, ещё ${formatCountdown(-seconds)})`;
      el.classList.add("tm-countdown--active");
    } else {
      el.textContent = ` (через ${formatCountdown(seconds)})`;
      el.classList.add("tm-countdown--waiting");
    }
  }, "updateCountdownEl");

  // src/utils/storage.ts
  let getMskDateKey = /* @__PURE__ */ __name(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(/* @__PURE__ */ new Date());
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }, "getMskDateKey");
  let readSharedJson = /* @__PURE__ */ __name((key, fallback) => {
    try {
      const value = readSharedValue(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }, "readSharedJson");
  let writeSharedJson = /* @__PURE__ */ __name((key, value) => {
    try {
      writeSharedValue(key, JSON.stringify(value));
    } catch {
    }
  }, "writeSharedJson");

  // src/utils/gisaa.ts
  let GISAA_VEKSEL_INFO_KEY = "tm_aa_gisaa_veksel_info_v1";
  let GISAA_VEKSEL_TABLE_KEY = "tm_aa_gisaa_veksel_table_v1";
  let normalizeGisaaPart = /* @__PURE__ */ __name((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " "), "normalizeGisaaPart");
  let makeGisaaVekselKey = /* @__PURE__ */ __name(({ type, resourceName, amount, iconType, locations }) => {
    if (type === "blue_salt") {
      return `blue_salt|${normalizeGisaaPart(resourceName)}|${Number(amount || 0)}`;
    }
    const locKey = (locations || []).map(normalizeGisaaPart).filter(Boolean).sort().join(",");
    return `north|${Number(amount || 0)}|${normalizeGisaaPart(iconType)}|${locKey}`;
  }, "makeGisaaVekselKey");
  let saveGisaaVekselInfo = /* @__PURE__ */ __name((key, info) => {
    if (!key || !info) return;
    const all = readSharedJson(GISAA_VEKSEL_INFO_KEY, {});
    all[key] = {
      ...info,
      date: getMskDateKey(),
      updatedAt: Date.now()
    };
    writeSharedJson(GISAA_VEKSEL_INFO_KEY, all);
  }, "saveGisaaVekselInfo");
  let getSavedGisaaVekselInfo = /* @__PURE__ */ __name((key) => {
    if (!key) return null;
    const info = readSharedJson(GISAA_VEKSEL_INFO_KEY, {})?.[key];
    if (!info || info.date !== getMskDateKey()) return null;
    if (info.status !== "available" && info.status !== "unavailable") return null;
    return info;
  }, "getSavedGisaaVekselInfo");
  let getSavedGisaaTablesSnapshot = /* @__PURE__ */ __name(() => {
    const snapshot = readSharedJson(GISAA_VEKSEL_TABLE_KEY, null);
    if (!snapshot || snapshot.date !== getMskDateKey()) return null;
    return snapshot;
  }, "getSavedGisaaTablesSnapshot");
  let cleanGisaaText = /* @__PURE__ */ __name((value) => String(value || "").trim().replace(/\s+/g, " "), "cleanGisaaText");
  let parseGisaaMaxCell = /* @__PURE__ */ __name((maxCell) => {
    const text = cleanGisaaText(maxCell?.textContent);
    const amount = parseInt(text, 10);
    const iconType = maxCell?.querySelector(".fa-archive") ? "archive" : maxCell?.querySelector(".fa-sack") ? "sack" : null;
    return {
      text,
      unknown: !text || text.includes("?") || !Number.isFinite(amount),
      amount: Number.isFinite(amount) ? amount : null,
      iconType
    };
  }, "parseGisaaMaxCell");
  let parseGisaaRow = /* @__PURE__ */ __name((row) => {
    const location2 = cleanGisaaText(row.querySelector(".row__cell-name .name.fix_size, .name.fix_size")?.textContent);
    const max = parseGisaaMaxCell(row.querySelector(".row__cell-max"));
    return { location: location2, ...max };
  }, "parseGisaaRow");
  let readGisaaTableRows = /* @__PURE__ */ __name((table) => Array.from(table.querySelectorAll(".row-table")).map(parseGisaaRow).filter((row) => row.location), "readGisaaTableRows");
  let readGisaaTablesSnapshot = /* @__PURE__ */ __name(() => {
    const resources = {};
    for (const blockId of ["#table-block-west", "#table-block-east"]) {
      const block = document.querySelector(blockId);
      if (!block) continue;
      for (const table of block.querySelectorAll("table")) {
        const resourceName = cleanGisaaText(table.querySelector("th.table__name")?.textContent);
        if (!resourceName) continue;
        resources[resourceName] = [
          ...resources[resourceName] || [],
          ...readGisaaTableRows(table)
        ];
      }
    }
    const northBlock = document.querySelector("#table-block-north");
    const north = northBlock ? Array.from(northBlock.querySelectorAll(".row-table")).map(parseGisaaRow).filter((row) => row.location) : [];
    return { resources, north };
  }, "readGisaaTablesSnapshot");
  let saveGisaaTablesSnapshot = /* @__PURE__ */ __name((snapshot) => {
    writeSharedJson(GISAA_VEKSEL_TABLE_KEY, {
      date: getMskDateKey(),
      updatedAt: Date.now(),
      ...snapshot
    });
  }, "saveGisaaTablesSnapshot");

  // src/utils/dom.ts
  let appendStyleElement = /* @__PURE__ */ __name((style) => {
    const tryAppend = /* @__PURE__ */ __name(() => {
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          document.head.appendChild(style);
        }, { once: true });
      }
    }, "tryAppend");
    tryAppend();
  }, "appendStyleElement");

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/pages/gisaa/gisaa.scss
  let gisaa_default = "td.tm-gisaa-match {\n  --bs-table-accent-bg: #005f1940;\n  background-color: rgba(0, 95, 25, 0.2509803922) !important;\n}\n\ntd.tm-gisaa-exclude {\n  --bs-table-accent-bg: #5f000040;\n  background-color: rgba(95, 0, 0, 0.2509803922) !important;\n}\n\ntd.tm-gisaa-unknown {\n  --bs-table-accent-bg: #5f5f0040;\n  background-color: rgba(95, 95, 0, 0.2509803922) !important;\n}\n\n.btn_vote.tm-gisaa-exclude {\n  opacity: 0.4;\n}";

  // src/pages/gisaa/gisaa.ts
  let GISAA_MATCH_CLASS = "tm-gisaa-match";
  let GISAA_EXCLUDE_CLASS = "tm-gisaa-exclude";
  let GISAA_UNKNOWN_CLASS = "tm-gisaa-unknown";
  let injectGisaaStyles = /* @__PURE__ */ __name(() => {
    const style = document.createElement("style");
    style.textContent = gisaa_default;
    appendStyleElement(style);
  }, "injectGisaaStyles");
  let highlightWestEastRow = /* @__PURE__ */ __name((resourceName, amount) => {
    const blocks = ["#table-block-west", "#table-block-east"];
    const result = { match: [], exclude: [], unknown: [] };
    for (const blockId of blocks) {
      const block = document.querySelector(blockId);
      if (!block) continue;
      const tables = block.querySelectorAll("table");
      for (const table of tables) {
        const header = table.querySelector("th.table__name");
        if (!header) continue;
        if (header.textContent.trim() !== resourceName) continue;
        const rows = table.querySelectorAll(".row-table");
        for (const row of rows) {
          const maxCell = row.querySelector(".row__cell-max");
          if (!maxCell) continue;
          const parsedRow = parseGisaaRow(row);
          if (!parsedRow.location) continue;
          if (parsedRow.unknown) {
            row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_UNKNOWN_CLASS));
            result.unknown.push(parsedRow.location);
          } else if (parsedRow.amount === amount) {
            row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_MATCH_CLASS));
            result.match.push(parsedRow.location);
          } else {
            row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_EXCLUDE_CLASS));
            result.exclude.push(parsedRow.location);
          }
        }
      }
    }
    return result;
  }, "highlightWestEastRow");
  let highlightNorthRow = /* @__PURE__ */ __name((locations, amount, iconType) => {
    const block = document.querySelector("#table-block-north");
    const result = { match: [], exclude: [], unknown: [] };
    if (!block) return result;
    if (!locations || locations.length === 0) return result;
    const rows = block.querySelectorAll(".row-table");
    for (const row of rows) {
      const nameEl = row.querySelector(".name.fix_size");
      if (!nameEl) continue;
      const rowLocation = nameEl.textContent.trim();
      const locationMatch = locations.some(
        (loc) => rowLocation.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(rowLocation.toLowerCase())
      );
      if (!locationMatch) continue;
      const maxCell = row.querySelector(".row__cell-max");
      if (!maxCell) continue;
      const parsedRow = parseGisaaRow(row);
      const rowLabel = parsedRow.location || rowLocation;
      if (parsedRow.unknown) {
        row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_UNKNOWN_CLASS));
        if (rowLabel) result.unknown.push(rowLabel);
        continue;
      }
      let isFullMatch = false;
      if (parsedRow.iconType === iconType && parsedRow.amount === amount) {
        isFullMatch = true;
      }
      if (isFullMatch) {
        row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_MATCH_CLASS));
        if (rowLabel) result.match.push(rowLabel);
      } else {
        row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_EXCLUDE_CLASS));
        row.querySelectorAll(".btn_vote").forEach((btn) => btn.classList.add(GISAA_EXCLUDE_CLASS));
        if (rowLabel) result.exclude.push(rowLabel);
      }
    }
    return result;
  }, "highlightNorthRow");
  let saveHighlightResult = /* @__PURE__ */ __name((key, result) => {
    if (!key || !result) return;
    const unique = /* @__PURE__ */ __name((values) => [...new Set((values || []).filter(Boolean))], "unique");
    const matches = unique(result.match);
    const unknown = unique(result.unknown);
    const excludes = unique(result.exclude);
    let status = "unknown";
    if (matches.length) {
      status = "available";
    } else if (!unknown.length && excludes.length) {
      status = "unavailable";
    }
    saveGisaaVekselInfo(key, {
      status,
      locations: matches,
      unknownLocations: unknown,
      excludedLocations: excludes
    });
  }, "saveHighlightResult");
  let applyHighlightsFromUrl = /* @__PURE__ */ __name(({ scrollNorth = true } = {}) => {
    const snapshot = readGisaaTablesSnapshot();
    saveGisaaTablesSnapshot(snapshot);
    const params = new URLSearchParams(location.search);
    const res = params.get("res");
    const amount = parseInt(params.get("amount"), 10);
    if (res && amount) {
      const result = highlightWestEastRow(res, amount);
      saveHighlightResult(
        makeGisaaVekselKey({ type: "blue_salt", resourceName: res, amount }),
        result
      );
    }
    const locParam = params.get("loc");
    const icon = params.get("icon");
    if (locParam && amount && icon) {
      const locations = locParam.split(",").map((s) => s.trim()).filter(Boolean);
      const result = highlightNorthRow(locations, amount, icon);
      saveHighlightResult(
        makeGisaaVekselKey({ type: "north", amount, iconType: icon, locations }),
        result
      );
      const northBlock = document.querySelector("#table-block-north");
      if (scrollNorth && northBlock) {
        northBlock.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, "applyHighlightsFromUrl");
  let startGisaaResultSync = /* @__PURE__ */ __name(() => {
    setInterval(() => applyHighlightsFromUrl({ scrollNorth: false }), 5e3);
  }, "startGisaaResultSync");
  function initGisaa() {
    injectGisaaStyles();
    setTimeout(applyHighlightsFromUrl, 500);
    setTimeout(startGisaaResultSync, 1500);
  }
  __name(initGisaa, "initGisaa");

  // src/utils/game-time.ts
  let GAME_MIDNIGHT_MSK_SECONDS = 2 * 3600 + 20 * 60;
  let GAME_DAY_REAL_SECONDS = 14400;
  let REAL_TO_GAME_FACTOR = 6;
  let getGameTime = /* @__PURE__ */ __name((serverNowMs) => {
    const d = new Date(serverNowMs);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    }).formatToParts(d);
    const h = +parts.find((p) => p.type === "hour").value;
    const m = +parts.find((p) => p.type === "minute").value;
    const s = +parts.find((p) => p.type === "second").value;
    const mskSeconds = h * 3600 + m * 60 + s;
    const realSinceGameMidnight = ((mskSeconds - GAME_MIDNIGHT_MSK_SECONDS) % GAME_DAY_REAL_SECONDS + GAME_DAY_REAL_SECONDS) % GAME_DAY_REAL_SECONDS;
    const gameSeconds = realSinceGameMidnight * REAL_TO_GAME_FACTOR;
    const gh = Math.floor(gameSeconds / 3600) % 24;
    const gm = Math.floor(gameSeconds % 3600 / 60);
    return `${pad2(gh)}:${pad2(gm)}`;
  }, "getGameTime");

  // src/data/events.ts
  let EVENTS = [
    { code: "ifnir", title: "Оборона Ифнира", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }], locations: ["Ифнир"], quests: [{ id: 10569, title: "Оборона Ифнира" }, { id: 10564, title: "Освобожденные узницы Нагашара" }] },
    { code: "lug_guardians", title: "Луг - Битва хранителей", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "18:00", weekdays: [6, 7] }], locations: ["Великий луг"], quests: [{ id: 11132, title: "Битва хранителей" }, { id: 11096, title: "Турнир в честь Отца-Солнца" }] },
    { code: "storm_eye", title: "Око бури", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [2, 4, 6] }], locations: ["Архипелаг погибших кораблей"], quests: [{ id: 6791, title: "Битва на Оке бури" }] },
    { code: "storm_eye_sea", title: "Гроза над морем", schedule: [{ timeStart: "14:00", timeEnd: "15:00" }, { timeStart: "22:00", timeEnd: "23:00" }], locations: ["Архипелаг погибших кораблей"], quests: [{ id: 5765, title: "Гроза над морем" }] },
    { code: "carrion", title: "Падаль", defaultVisible: true, schedule: [{ timeStart: "10:00" }, { timeStart: "22:00" }] },
    { code: "siege", title: "Осада", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [3] }] },
    { code: "rift_blood_antallon", title: "Кровавый (дневной) разлом - Анталлон/Эншака", defaultVisible: true, schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }], locations: ["Солнечные поля"], quests: [{ id: 5885, title: "Советник Кириоса" }] },
    { code: "rift_blood_garron", title: "Кровавый (дневной) разлом - Гигантский гаррон", defaultVisible: true, schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }], locations: ["Инистра", "Полуостров Падающих Звезд"], quests: [{ id: 2943, title: "Элитные войска Кровавой армии" }] },
    { code: "rift_ghost", title: "Призрачный (ночной) разлом - Призрак Эншаки", defaultVisible: true, schedule: [{ timeStart: "02:20", duration: 15 }, { timeStart: "06:20", duration: 15 }, { timeStart: "10:20", duration: 15 }, { timeStart: "14:20", duration: 15 }, { timeStart: "18:20", duration: 15 }, { timeStart: "22:20", duration: 15 }], locations: ["Инистра", "Полуостров Падающих Звезд"], quests: [{ id: 5144, title: "Разгром призрачного легиона" }] },
    { code: "rift_phantom", title: "Фантомы (лиловый разлом)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }], locations: ["Сокрытая долина", "Ирамийский хребет"], quests: [{ id: 11154, title: "Бой с тенью" }] },
    /* Инстансы - Рейды */
    { code: "dragon_lair", title: "Логово дракона", defaultVisible: true, schedule: [{ timeStart: "13:20", timeEnd: "14:00" }, { timeStart: "18:20", timeEnd: "19:00" }, { timeStart: "21:20", timeEnd: "22:00" }], locations: ["Инстансы - Рейды"] },
    { code: "gardum", title: "Гардум (Ущелье кровавой росы)", defaultVisible: true, schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }], locations: ["Инстансы - Рейды"], quests: [{ id: 7935, title: "Хранитель Звенящего ущелья" }] },
    { code: "iramkand", title: "Последний день Ирамканда", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }], locations: ["Инстансы - Рейды"], quests: [{ id: 9205, title: "Последний день Ирамканда" }] },
    /* Инстансы - Фракции */
    { code: "daskshir", title: "Битва за Даскшир", defaultVisible: true, schedule: [{ timeStart: "16:00", timeEnd: "17:00", weekdays: [2, 4, 6] }, { timeStart: "22:30", timeEnd: "23:59", weekdays: [2, 4, 6] }, { timeStart: "19:00", timeEnd: "20:00", weekdays: [1, 3, 5, 7] }], locations: ["Инстансы - Фракции"] },
    { code: "gorge_battle", title: "Битва в Ущелье кровавой росы", schedule: [{ timeStart: "15:15", timeEnd: "16:00" }, { timeStart: "18:00", timeEnd: "19:00" }, { timeStart: "21:45", timeEnd: "22:30" }], locations: ["Инстансы - Фракции"] },
    { code: "enchanted_ponds", title: "Битва за Зачарованные пруды", defaultVisible: true, schedule: [{ timeStart: "14:30", timeEnd: "15:15" }, { timeStart: "17:00", timeEnd: "18:00" }, { timeStart: "21:00", timeEnd: "21:45" }], locations: ["Инстансы - Фракции"] },
    /* Мировые боссы */
    { code: "kraken", title: "Кракен", schedule: [{ timeStart: "19:30", weekdays: [1, 4, 6] }], locations: ["Безмятежное море"] },
    { code: "kalidis", title: "Калидис", schedule: [{ timeStart: "20:30", weekdays: [1, 5, 6] }], locations: ["Туманный пролив"] },
    { code: "leviathan", title: "Левиафан", schedule: [{ timeStart: "20:30", weekdays: [2, 4, 7] }], locations: ["Безмятежное море"] },
    { code: "dolphin", title: "Летучий дельфиец", schedule: [{ timeStart: "21:00", weekdays: [1, 3, 5, 7] }], locations: ["Золотое море"] },
    { code: "ashyara_glenn_loreya", title: "Ашьяра/Гленн/Лорея", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }], locations: ["Бездна", "Солнечные поля"], quests: [{ id: 5971, title: "Чешуя Ашьяры" }, { id: 5970, title: "Кольцо капитана Гленна" }, { id: 5969, title: "Кольцо Лореи" }] },
    { code: "xanatos", title: "Ксанатос", schedule: [{ timeStart: "19:30", weekdays: [2, 5, 7] }], locations: ["Кладбище драконов"] },
    { code: "gardens_bosses", title: "Эншака/Лернея/Таврос/М'гер", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }], locations: ["Сады матери"], quests: [{ id: 10056, title: "Садовые работы" }] },
    { code: "gardens_antallon", title: "Анталлон в садах", schedule: [{ timeStart: "21:30", weekdays: [1, 5, 7] }], locations: ["Сады матери"] },
    { code: "altars", title: "Битва за алтари", schedule: [{ timeStart: "16:00", timeEnd: "16:30", weekdays: [1, 3, 4, 5, 6] }, { timeStart: "20:00", timeEnd: "20:30", weekdays: [0, 2, 3, 4, 5] }], locations: ["Пепельные равнины"] },
    { code: "fesanix", title: "Фесаникс", schedule: [{ timeStart: "22:30", timeEnd: "23:30", weekdays: [2] }], locations: ["Пепельные равнины"] }
  ];

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/components/serverClock/serverClock.scss
  let serverClock_default = ".tm-server-clock {\n  position: fixed;\n  top: 50%;\n  right: 12px;\n  transform: translateY(-50%);\n  z-index: 9999;\n  padding: 6px 12px;\n  border-radius: 6px;\n  background: rgba(0, 0, 0, 0.7);\n  backdrop-filter: blur(4px);\n  font-size: 13px;\n  font-family: monospace;\n  color: rgba(255, 255, 255, 0.85);\n  max-width: 150px;\n  white-space: nowrap;\n  user-select: none;\n  line-height: 1.4;\n  text-decoration: none;\n  display: block;\n  cursor: pointer;\n}\n\n.tm-server-clock-event {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  margin-top: 5px;\n}";

  // src/components/serverClock/serverClock.ts
  let serverClockEl = null;
  let serverClockStylesInjected = false;
  let loadEventVisibility = /* @__PURE__ */ __name(() => JSON.parse(localStorage.getItem("tm_aa_ev_vis") || "{}"), "loadEventVisibility");
  let isEventVisible = /* @__PURE__ */ __name((ev, vis) => ev.code in vis ? vis[ev.code] : !!ev.defaultVisible, "isEventVisible");
  let injectServerClockStyles = /* @__PURE__ */ __name(() => {
    if (serverClockStylesInjected) return;
    serverClockStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = serverClock_default;
    appendStyleElement(style);
  }, "injectServerClockStyles");
  let getNextVisibleEventInfo = /* @__PURE__ */ __name(() => {
    const visOverrides = loadEventVisibility();
    let bestActive = null;
    let bestUpcoming = null;
    for (const ev of EVENTS) {
      if (!isEventVisible(ev, visOverrides)) continue;
      const sec = getSecondsUntilNextEvent(ev.schedule);
      if (sec == null) continue;
      if (sec < 0) {
        if (!bestActive || sec > bestActive.secondsUntil) {
          bestActive = { title: ev.title, secondsUntil: sec };
        }
      } else {
        if (!bestUpcoming || sec < bestUpcoming.secondsUntil) {
          bestUpcoming = { title: ev.title, secondsUntil: sec };
        }
      }
    }
    return bestActive || bestUpcoming;
  }, "getNextVisibleEventInfo");
  let updateServerClockContent = /* @__PURE__ */ __name(() => {
    if (!serverClockEl) return;
    const serverNow = getServerNowMs();
    const d = new Date(serverNow);
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const mskTime = fmt.format(d);
    const gameTime = getGameTime(serverNow);
    let eventLine = "";
    const nextEv = getNextVisibleEventInfo();
    if (nextEv) {
      if (nextEv.secondsUntil < 0) {
        eventLine = `<div class="tm-server-clock-event">${nextEv.title}</div><span style="color:#4f8">ещё ${formatCountdown(-nextEv.secondsUntil)}</span>`;
      } else {
        eventLine = `<div class="tm-server-clock-event">${nextEv.title}</div>через ${formatCountdown(nextEv.secondsUntil)}`;
      }
    }
    serverClockEl.innerHTML = `мск: ${mskTime}<br>игровое: ${gameTime}${eventLine}`;
  }, "updateServerClockContent");
  let initServerClock = /* @__PURE__ */ __name(async (openEventsPopup2, checkEventNotifications2) => {
    await syncServerTime();
    injectServerClockStyles();
    serverClockEl = document.createElement("div");
    serverClockEl.className = "tm-server-clock";
    serverClockEl.addEventListener("click", openEventsPopup2);
    document.body.appendChild(serverClockEl);
    updateServerClockContent();
    setInterval(updateServerClockContent, 1e3);
    if (checkEventNotifications2) setInterval(checkEventNotifications2, 3e4);
    if (checkEventNotifications2) checkEventNotifications2();
  }, "initServerClock");

  // src/data/servers.ts
  let SERVERS = {
    1: "Луций",
    2: "Кипроза",
    3: "Мелисара",
    24: "Невер",
    31: "Гартарейн",
    32: "Левиафан",
    33: "Ария",
    34: "Иштар",
    35: "Хазе",
    42: "Корвус",
    43: "Каиль",
    44: "Нуи",
    45: "Фанем",
    46: "Шаеда",
    47: "Ренессанс",
    48: "Кракен",
    49: "Ифнир",
    51: "Эрнард",
    52: "Морфеос",
    53: "Марли",
    54: "Ашьяра",
    55: "Гленн",
    56: "Лорея",
    61: "Ксанатос",
    62: "Тарон",
    63: "Рейвен",
    64: "Нагашар",
    65: "Мираж",
    66: "Фесаникс"
  };

  // src/data/items.ts
  let CODEX_IMAGES_BASE = "https://archeagecodex.com/images/";
  let LS_KEY_ICON_SEX = "tm_aa_icon_sex";
  let LS_KEY_ICON_SCALE = "tm_aa_icon_scale";
  let LS_KEY_ICON_SCALE_BROWSER_ZOOM = "tm_aa_icon_scale_browser_zoom";
  let GRADES = [
    /* 0  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade0.png`, title: "Бесполезный предмет", color: "#949293" },
    /* 1  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade1.png`, title: "Обычный предмет", color: "#ba976d", cartNamePatterns: [/^обычн(?:ый|ая|ое|ые)\s+/] },
    /* 2  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade2.png`, title: "Необычный предмет", color: "#77b064", cartNamePatterns: [/^необычн(?:ый|ая|ое|ые)\s+/] },
    /* 3  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade3.png`, title: "Редкий предмет", color: "#558fd7", cartNamePatterns: [/^редк(?:ий|ая|ое|ие)\s+/] },
    /* 4  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade4.png`, title: "Уникальный предмет", color: "#cb72d8", cartNamePatterns: [/^уникальн(?:ый|ая|ое|ые)\s+/] },
    /* 5  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade5.png`, title: "Эпический предмет", color: "#d78b06", cartNamePatterns: [/^эпическ(?:ий|ая|ое|ие)\s+/] },
    /* 6  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade6.png`, title: "Легендарный предмет", color: "#e17853", cartNamePatterns: [/^легендарн(?:ый|ая|ое|ые)\s+/] },
    /* 7  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade7.png`, title: "Реликвия", color: "#f95252", cartNamePatterns: [/^реликвийн(?:ый|ая|ое|ые)\s+/] },
    /* 8  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade8.png`, title: "Предмет эпохи чудес", color: "#cf7d5d", cartNamePatterns: [/\s+эпохи чудес$/] },
    /* 9  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade9.png`, title: "Предмет эпохи сказаний", color: "#8fa5ca", cartNamePatterns: [/\s+эпохи сказаний$/] },
    /* 10 */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade10.png`, title: "Предмет эпохи легенд", color: "#bf7900", cartNamePatterns: [/\s+эпохи легенд$/] },
    /* 11 */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade11.png`, title: "Предмет эпохи мифов", color: "#c90b0b", cartNamePatterns: [/\s+эпохи мифов$/] },
    /* 12 */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade12.png`, title: "Предмет эпохи Двенадцати", color: "#ae98fe", cartNamePatterns: [/\s+эпохи двенадцати$/] }
  ];
  let ITEM_TYPES = {
    "unidentified": { title: "Неопознанный предмет" },
    "quest": { title: "Задание" },
    "magical": { title: "Магический предмет" },
    "box": { title: "Ящик" },
    "equipment": { title: "Снаряжение" },
    "material": { title: "Материал" },
    "potion": { title: "Микстура" },
    "other": { title: "Прочее" },
    "rareMaterial": { title: "Редкий материал" },
    "mount": { title: "Ездовой питомец" },
    "battlePet": { title: "Боевой питомец" },
    "lightArmor": { title: "Легкий доспех" },
    "furniture": { title: "Предмет интерьера" },
    "craftItem": { title: "Ремесленный предмет" }
  };
  let ITEM_SUB_TYPES = {
    "ingot": { title: "Слиток металла" },
    "leather": { title: "Кожа" },
    "cloth": { title: "Ткань" },
    "lumber": { title: "Древесина" },
    "costume": { title: "Костюм" },
    "cloak": { title: "Плащ" },
    "windInstrument": { title: "Духовой инструмент" }
  };
  let EQUIPMENT_SUB_TYPES = {
    "helmet": { title: "Шлем" },
    "armor": { title: "Нагрудник" },
    "belt": { title: "Пояс" },
    "bracer": { title: "Наручи" },
    "gloves": { title: "Перчатки" },
    "cloak": { title: "Плащ" },
    "pants": { title: "Поножи" },
    "boots": { title: "Обувь" },
    "underwear": { title: "Нижнее бельё" },
    "necklace": { title: "Ожерелье" },
    "earrings": { title: "Серьга" },
    "ring": { title: "Кольцо" },
    "two_handed_weapon": { title: "Двуручное оружие" },
    "ranged weapon": { title: "Оружие дальнего боя" },
    "instrument": { title: "Инструмент" },
    "weight": { title: "Груз" },
    "costume": { title: "Костюм" }
  };
  let ICON_OVERLAY = {
    "unconfirmed": { icon: "https://archeagecodex.com/items/top_unconfirmed.png" },
    "seal": { icon: "https://archeagecodex.com/items/top_seal_08.png" },
    "quest_y": { icon: "https://archeagecodex.com/items/top_quest_y.png" },
    "quest_cash": { icon: "https://archeagecodex.com/items/top_quest_cash.png" }
  };
  let HERO_LEVEL_ICON = "https://archeagecodex.com/images/icon_hlv.png";
  let MAX_HERO_LEVEL = 70;
  let MAX_LEVEL = 55 + MAX_HERO_LEVEL;
  let CURRENCY_ICONS = {
    gold: "https://archeagecodex.com/items/gold.png",
    silver: "https://archeagecodex.com/items/silver.png",
    bronze: "https://archeagecodex.com/items/bronze.png"
  };
  let snakeToCamel = /* @__PURE__ */ __name((value) => String(value || "").replace(/_([a-z])/g, (_, char) => char.toUpperCase()), "snakeToCamel");
  let formatDurationValue = /* @__PURE__ */ __name((value) => {
    const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours) parts.push(`${hours} ч.`);
    if (minutes) parts.push(`${minutes} м.`);
    if (seconds) parts.push(`${seconds} с.`);
    return parts.join(" ") || "0 с.";
  }, "formatDurationValue");
  let ITEM_PLACEHOLDER_FORMATTERS = {
    buffDuration: /* @__PURE__ */ __name((value) => formatDurationValue(value), "buffDuration")
  };
  let decapitalize = /* @__PURE__ */ __name((value) => String(value || "").replace(/^./, (char) => char.toLowerCase()), "decapitalize");
  let getItemPlaceholderValue = /* @__PURE__ */ __name((item, field) => {
    const directValue = item?.[field];
    if (directValue != null) return directValue;
    if (!field.startsWith("buff") || !item?.buff || typeof item.buff !== "object") return null;
    const buffField = decapitalize(field.slice("buff".length));
    return item.buff[buffField] ?? null;
  }, "getItemPlaceholderValue");
  let resolveItemPlaceholders = /* @__PURE__ */ __name((text, item) => String(text || "").replace(/#\{([a-zA-Z0-9_]+)\}/g, (match, rawField) => {
    const field = snakeToCamel(rawField);
    const value = getItemPlaceholderValue(item, field);
    if (value == null) return `<span>(${rawField})</span>`;
    const formatter = ITEM_PLACEHOLDER_FORMATTERS[field];
    return formatter ? formatter(value, item) : String(value);
  }), "resolveItemPlaceholders");
  let parseGameMarkup = /* @__PURE__ */ __name((text, { preserveNewlines = false } = {}) => {
    if (!text) return "";
    const html = text.replace(
      /\|c([\da-fA-F]{2})([\da-fA-F]{6})(.*?)\|r/g,
      (_, alpha, color, inner) => `<span style="color:#${color}${alpha}">${inner}</span>`
    ).replace(
      /\|nc;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nc">${inner}</span>`
    ).replace(
      /\|buffvar;(.*?)\|r/g,
      (_, inner) => `<span class="inv-buffvar">${inner}</span>`
    ).replace(
      /\|nn;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nn">${inner}</span>`
    ).replace(
      /\|nd;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nd">${inner}</span>`
    ).replace(
      /\|ni;(.*?)\|r/g,
      (_, inner) => `<span class="inv-ni">${inner}</span>`
    ).replace(
      /\|nr;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nr">${inner}</span>`
    );
    return preserveNewlines ? html : html.replace(/\n/g, "<br/>");
  }, "parseGameMarkup");
  let hasVisibleTooltipText = /* @__PURE__ */ __name((value) => String(value || "").replace(/\n|<br\s*\/?>/gi, "").trim().length > 0, "hasVisibleTooltipText");
  let cleanDynamicTooltipMarkup = /* @__PURE__ */ __name((value) => {
    if (value == null) return null;
    let result = String(value).replace(/\\+"/g, '"').replace(/\\+'/g, "'").replace(/<br\s*\/?>\s*\n/gi, "<br/>").replace(/^(?:\s|\n|<br\s*\/?>)+/gi, "").replace(/(?:\s|\n|<br\s*\/?>)+$/gi, "");
    return result ? result : null;
  }, "cleanDynamicTooltipMarkup");
  let stripHtmlForMatch = /* @__PURE__ */ __name((value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), "stripHtmlForMatch");
  let CODEX_ITEM_URL = "https://archeagecodex.com/ru/item/";
  let GMRU_CDN_ICONS = "https://aa.cdn.gmru.net/ms/data/game-icons/";
  let ICON_SEX_VALUES = {
    m: { title: "Мужской", field: "iconM" },
    f: { title: "Женский", field: "iconF" }
  };
  let loadIconSex = /* @__PURE__ */ __name(() => {
    try {
      const sex = localStorage.getItem(LS_KEY_ICON_SEX);
      return sex && ICON_SEX_VALUES[sex] ? sex : "m";
    } catch {
      return "m";
    }
  }, "loadIconSex");
  let saveIconSex = /* @__PURE__ */ __name((sex) => {
    try {
      if (ICON_SEX_VALUES[sex]) {
        localStorage.setItem(LS_KEY_ICON_SEX, sex);
      } else {
        localStorage.removeItem(LS_KEY_ICON_SEX);
      }
    } catch {
    }
  }, "saveIconSex");
  let loadIconScalePercent = /* @__PURE__ */ __name(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_ICON_SCALE);
      if (raw != null) {
        const val = parseInt(raw, 10);
        if (Number.isFinite(val) && val >= 10 && val <= 5e3) return val;
      }
    } catch {
    }
    return 100;
  }, "loadIconScalePercent");
  let saveIconScalePercent = /* @__PURE__ */ __name((val) => {
    try {
      const intVal = Math.round(val);
      if (Number.isFinite(intVal) && intVal >= 10 && intVal <= 5e3) {
        localStorage.setItem(LS_KEY_ICON_SCALE, String(intVal));
      } else {
        localStorage.removeItem(LS_KEY_ICON_SCALE);
      }
    } catch {
    }
  }, "saveIconScalePercent");
  let loadIconScaleBrowserZoom = /* @__PURE__ */ __name(() => {
    try {
      return localStorage.getItem(LS_KEY_ICON_SCALE_BROWSER_ZOOM) !== "false";
    } catch {
      return true;
    }
  }, "loadIconScaleBrowserZoom");
  let saveIconScaleBrowserZoom = /* @__PURE__ */ __name((enabled) => {
    try {
      if (enabled) localStorage.removeItem(LS_KEY_ICON_SCALE_BROWSER_ZOOM);
      else localStorage.setItem(LS_KEY_ICON_SCALE_BROWSER_ZOOM, "false");
    } catch {
    }
  }, "saveIconScaleBrowserZoom");
  let getItemIconUrlFromParts = /* @__PURE__ */ __name((icon, iconM, iconF) => {
    const sex = loadIconSex();
    const sexIcon = sex === "m" ? iconM || iconF || "m" : iconF || iconM || "f";
    return sexIcon ? icon.replace(/\{sex\}/g, sexIcon) : icon;
  }, "getItemIconUrlFromParts");
  let getItemIconUrl = /* @__PURE__ */ __name((item) => getItemIconUrlFromParts(item?.icon || "", item?.iconM || "", item?.iconF || ""), "getItemIconUrl");
  let ITEMS = Object.fromEntries([
    { id: 8256, type: "material", subType: "cloth", icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "Ткань" },
    // icon_item_0356.png
    { id: 8318, type: "material", subType: "ingot", icon: `${GMRU_CDN_ICONS}9d60cae3016a14b2cfc17a90de8e5f5b.png`, grade: 1, name: "Слиток железа" },
    // icon_item_quest053.png
    { id: 8337, type: "material", subType: "lumber", icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, name: "Упаковка строительной древесины", vekselName: "Строительная древесина" },
    // icon_item_0041.png
    { id: 16327, type: "material", subType: "leather", icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, name: "Сыромятная кожа" },
    // icon_item_0352.png
    { id: 35461, type: "unidentified", overlay: "unconfirmed", vekselType: "sack", icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "Полновесный мешочек с серебром" },
    // icon_item_1839.png
    { id: 40928, type: "unidentified", overlay: "unconfirmed", vekselType: "sack", icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, name: "Расшитый жемчугом кошелёк" },
    // icon_item_3101.png
    { id: 42076, type: "unidentified", overlay: "unconfirmed", vekselType: "archive", icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, name: "Резной сундучок со всякой всячиной" },
    // icon_item_3619.png
    { id: 42077, type: "unidentified", overlay: "unconfirmed", vekselType: "archive", icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, name: "Фермерский сундучок со всякой всячиной" },
    // icon_item_3620.png
    { id: 43176, type: "unidentified", overlay: "unconfirmed", vekselType: "sack", icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, name: "Котомка эфенского странника" },
    // icon_item_3906.png
    { id: 43177, type: "unidentified", overlay: "unconfirmed", vekselType: "archive", icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, name: "Эфенский сундучок со всякой всячиной" },
    // icon_item_3907.png
    { id: 8000749, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, name: "Лицензия на убийство: Баррага Безумный", description: "Позволяет получить задание." },
    // icon_item_2762.png
    { id: 8000751, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, name: "Лицензия на убийство: иферийцы", description: "Позволяет получить задание." },
    { id: 8000752, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, name: "Лицензия на убийство: Иштар" },
    { id: 8000753, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, name: "Лицензия на убийство: повелитель подземелья" },
    { id: 48894, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4820.png", grade: 10, name: "Драгоценная эфенская сфера бронника", description: "Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет. Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r." },
    { id: 54915, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1695.png", grade: 1, name: "Свиток чар ифнирского героя" },
    { id: 45508, icon: "https://archeagecodex.com/items/icon_item_4212.png", grade: 2, name: "Сфера анимага" },
    { id: 8001565, icon: "https://archeagecodex.com/items/icon_item_3628.png", grade: 1, name: "Новенькая кирка" },
    { id: 8002452, overlay: "unconfirmed", icon: "https://archeagecodex.com/items/icon_item_3349.png", grade: 1, name: "Универсальный алхимический кристалл" },
    { id: 8002449, icon: "https://archeagecodex.com/items/charge_wider.png", grade: 1, name: "Дополнительная сумка" },
    { id: 47943, type: "potion", icon: "https://archeagecodex.com/items/icon_item_4710.png", grade: 1, name: "Настойка усердного ремесленника" },
    { id: 39424, type: "magical", icon: "https://archeagecodex.com/items/icon_item_3017.png", grade: 1, name: "Ирамийская гадальная руна", description: "Позволяет заменить один из |nc;эффектов синтеза костюма, эфенского снаряжения, рамианского снаряжения или трофейного снаряжения мифических противников|r другим, выбранным случайным образом.", useDescription: "Распаковать.\nУдерживая Shift, щелкните левой кнопкой мыши, чтобы распаковать все предметы этого типа, находящиеся в рюкзаке." },
    { id: 46180, icon: "https://archeagecodex.com/items/icon_item_1395.png", grade: 3, name: "Солнечный настой" },
    { id: 47130, type: "unidentified", overlay: "unconfirmed", icon: "https://archeagecodex.com/items/icon_item_2679.png", grade: 6, name: "Хрустальная руна", description: "|nd;Можно получить одну из хрустальных рун на выбор:|r\n- хрустальная руна багровой луны,\n- хрустальная руна осенней луны,\n- хрустальная руна молодой луны,\n- хрустальная руна безмолвной луны,\n- хрустальная руна колдовской луны." },
    { id: 47104, icon: "https://archeagecodex.com/items/icon_item_4570.png", grade: 2, name: "Парниковый купол" },
    { id: 48903, type: "box", icon: "https://archeagecodex.com/items/icon_item_3282.png", grade: 1, name: "Набор сверкающих эфенских сфер" },
    { id: 48474, type: "box", icon: "https://archeagecodex.com/items/icon_item_3275.png", grade: 11, name: "Большой набор мифических эссенций" },
    { id: 8002297, type: "unidentified", overlay: "seal", icon: "https://archeagecodex.com/items/icon_item_2267.png", grade: 3, name: "Королевский лунный изумруд" },
    { id: 35727, icon: "https://archeagecodex.com/items/icon_item_1982.png", grade: 2, name: "Буровая установка" },
    { id: 47082, icon: "https://archeagecodex.com/items/icon_item_3369.png", grade: 1, name: "Патент на транспортное средство" },
    { id: 31892, icon: "https://archeagecodex.com/items/icon_item_1733.png", grade: 1, name: "Земельный вексель" },
    { id: 55722, icon: "https://archeagecodex.com/items/icon_item_5864.png", grade: 4, name: "Искусная цитриновая гравировка" },
    { id: 48886, icon: "https://archeagecodex.com/items/icon_item_4818.png", grade: 8, name: "Сверкающая эфенская сфера бронника", description: "Предотвращает понижение уровня эффекта эфенских кубов, действующего на предмет.\n\nМожно использовать только при уровне усиления |nc;18 и выше|r." },
    { id: 55723, icon: "https://archeagecodex.com/items/icon_item_5865.png", grade: 4, name: "Искусная аквамариновая гравировка" },
    { id: 45747, type: "potion", icon: "https://archeagecodex.com/items/icon_item_4385.png", grade: 5, name: "Драгоценный флакон с зельем охотника" },
    { id: 49270, type: "box", icon: "https://archeagecodex.com/items/icon_item_2273.png", grade: 5, name: "Набор больших эфенских кубов" },
    { id: 45160, type: "potion", icon: "https://archeagecodex.com/items/icon_item_2376.png", grade: 4, name: "Настойка спорыньи" },
    { id: 46623, type: "potion", icon: "https://archeagecodex.com/items/icon_item_0986.png", grade: 4, name: "Настойка остролиста", buff: { duration: 1800 } },
    { id: 8001268, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1986.png", grade: 1, name: "Свиток дельфийской библиотеки", buff: { duration: 3600 } },
    { id: 8001169, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1986.png", grade: 1, name: "Свиток опыта V", buff: { duration: 3600 }, isPersonal: true },
    { id: 8001172, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1986.png", grade: 1, name: "Свиток опыта VIII", buff: { duration: 3600 }, isPersonal: true },
    { id: 46181, icon: "https://archeagecodex.com/items/icon_item_1396.png", grade: 3, name: "Лунный настой" },
    { id: 48546, icon: "https://archeagecodex.com/items/icon_item_3595.png", grade: 1, name: "Письмена войны" },
    { id: 47655, icon: "https://archeagecodex.com/items/icon_item_4709.png", grade: 4, name: "Фиона Розовый Лепесток" },
    { id: 47581, icon: "https://archeagecodex.com/items/icon_item_4211.png", grade: 3, name: "Лиловое эмалевое стекло" },
    { id: 47479, icon: "https://archeagecodex.com/items/icon_item_3519.png", grade: 1, name: "Инкрустированный флакон с целебным эликсиром" },
    { id: 47480, icon: "https://archeagecodex.com/items/icon_item_3520.png", grade: 1, name: "Инкрустированный флакон с эликсиром маны" },
    { id: 8002996, icon: "https://archeagecodex.com/items/icon_item_6002.png", grade: 1, name: "Осколок предела", description: "Этот осколок – фрагмент отражения божественных сил в материальном мире. На |ni;станке для акхиума|r из таких частиц можно создать нумены.", price: 100 },
    { id: 8003072, icon: "https://archeagecodex.com/items/icon_item_6002.png", grade: 1, name: "Осколок предела" },
    { id: 8001288, icon: "https://archeagecodex.com/items/icon_item_0966.png", grade: 1, name: "Цитрусовая карамелька", buff: { duration: 3600 } },
    { id: 8002649, type: "box", icon: "https://archeagecodex.com/items/icon_item_3259.png", grade: 4, name: "Набор неверинских фейерверков" },
    { id: 8000540, icon: "https://archeagecodex.com/items/icon_item_3207.png", grade: 1, name: "Пушистая неверинская елочка" },
    { id: 49769, icon: "https://archeagecodex.com/items/icon_item_4950.png", grade: 6, name: "Зачарованный свиток пробуждения хранителя знаний" },
    { id: 54653, type: "box", icon: "https://archeagecodex.com/items/icon_item_5043.png", grade: 12, name: "Сундук с обновленным рамианским снаряжением" },
    { id: 53515, type: "magical", icon: "https://archeagecodex.com/items/icon_item_5266.png", grade: 2, isPersonal: true, price: 0, reqLevel: 1, name: "Заговоренная рамианская руна", description: "Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для проклятого, изначального, обновленного и совершенного рамианского снаряжения.|r", useDescription: "Приступить к замене эффекта.\nРасход очков работы: |nc;50|r." },
    { id: 52207, icon: "https://archeagecodex.com/items/icon_item_3022.png", grade: 1, name: "Мешочек с микстурами", description: "Содержимое:\n- инкрустированный флакон с эликсиром маны (300 шт.),\n- инкрустированный флакон с целебным эликсиром (300 шт.),\n- солнечный настой (30 шт.),\n- лунный настой (30 шт.)" },
    { id: 51239, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 11, name: "Сундук с изначальным рамианским оружием эпохи мифов" },
    { id: 51240, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 12, name: "Сундук с изначальным рамианским оружием эпохи Двенадцати" },
    { id: 54654, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 12, name: "Сундук с обновленным рамианским оружием эпохи Двенадцати" },
    { id: 54655, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 11, name: "Сундук с обновленными рамианскими доспехами эпохи мифов" },
    { id: 47941, type: "box", icon: "https://archeagecodex.com/items/x_mas_gift.png", grade: 10, name: "Сундук с оружием Библиотеки Эрнарда эпохи легенд" },
    { id: 51243, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 12, name: "Сундук с магистерским эрнардским оружием эпохи Двенадцати" },
    { id: 55501, type: "box", icon: "https://archeagecodex.com/items/icon_item_5850.png", grade: 6, name: "Сундучок с легендарным украшением ифнирского героя", description: "Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- легендарная серьга ифнирского героя,\n- легендарное кольцо ифнирского героя." },
    { id: 51940, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 8, name: "Сундучок с ценным украшением эпохи чудес" },
    { id: 51236, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 11, name: "Сундучок с драгоценным украшением эпохи мифов", description: "Открыв этот сундучок, вы сможете выбрать один из следующих предметов качества эпохи мифов:\n- перстень чемпиона Дома Норьетт,\n- серьга чемпиона Дома Норьетт,\n- ожерелье последнего рубежа,\n- ожерелье доблести воина XIII ранга,\n- ожерелье доблести целителя XIII ранга." },
    { id: 55783, type: "box", icon: "https://archeagecodex.com/items/icon_item_2992.png", grade: 5, name: "Сундучок с зачарованной гравировкой для украшений" },
    { id: 50924, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png", grade: 2, name: "Дизайн широкополой шляпы стрелка" },
    { id: 50925, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth519.png", grade: 2, name: "Дизайн соломенной шляпы" },
    { id: 8002486, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_set/nu_{sex}_sk_korean006.png", grade: 1, name: "Дизайн костюма хоури эпохи Фарвати" },
    { id: 51092, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_set/nu_{sex}_sk_uniform004.png", grade: 2, name: "Дизайн одеяния правителя северного Мейра" },
    { id: 129, type: "magical", icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 1, name: "Дельфийская руна", description: "Неказистая руна из светлого песчаника.", useDescription: "Позволяет мгновенно получить 200.000 очков опыта.", reqLevel: 50 },
    { id: 8003128, type: "magical", icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 10, name: "Дельфийская руна эпохи легенд", description: "Древняя руна, наполненная невероятной магической силой.", useDescription: "Позволяет мгновенно получить 125,000,000 очков опыта.", reqLevel: 91 },
    { id: 55280, type: "box", icon: "https://archeagecodex.com/items/icon_item_2812.png", grade: 6, name: "Легендарная руна ифнирского героя" },
    { id: 55683, type: "box", icon: "https://archeagecodex.com/items/icon_item_4527.png", grade: 1, name: "Мешочек с магистериями для украшений" },
    { id: 50536, type: "box", icon: "https://archeagecodex.com/items/icon_item_4527.png", grade: 1, name: "Мешочек с магистериями", description: "Открыв мешочек, вы сможете выбрать один из следующих предметов:\n- мешочек с рубиновыми магистериями,\n- мешочек с кварцевыми магистериями,\n- мешочек с сапфировыми магистериями,\n- мешочек с изумрудными магистериями,\n- мешочек с янтарными магистериями." },
    { id: 8001148, icon: "https://archeagecodex.com/items/icon_item_3807.png", grade: 2, name: "Статуя «Орхидна на троне»" },
    { id: 8001203, icon: "https://archeagecodex.com/items/icon_item_3277.png", grade: 1, name: "Сундучок с фамильными ценностями" },
    { id: 54933, icon: "https://archeagecodex.com/items/icon_item_5809.png", grade: 2, name: "Замерзший пруд" },
    { id: 48860, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4002.png", grade: 6, name: "Большая эфенская сфера оружейника", description: "Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза." },
    { id: 48861, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4816.png", grade: 6, name: "Большая эфенская сфера бронника", description: "Повышает вероятность успеха при попытке улучшить снаряжение с помощью эфенских кубов в |nc;2|r раза." },
    { id: 44359, type: "potion", icon: "https://archeagecodex.com/items/icon_item_3559.png", grade: 1, name: "Походный фиал славы" },
    { id: 55800, type: "box", icon: "https://archeagecodex.com/items/icon_item_5486.png", grade: 4, name: "Сундучок с фрагментами судьбы", description: "Открыв этот сундучок, вы сможете выбрать один из следующих предметов:\n- пыль судьбы (25 шт.),\n- слиток судьбы (5 шт.),\n- призма судьбы." },
    { id: 8002772, type: "box", icon: "https://archeagecodex.com/items/icon_item_5043.png", grade: 5, name: "Окованный сталью ящик с боевым питомцем", description: "Сняв печать, вы получите Квадрума, Мистериона или Мистериона, Ужаса Ночи (на выбор)." },
    { id: 50635, type: "magical", icon: "https://archeagecodex.com/items/icon_item_5058.png", grade: 2, isPersonal: true, name: "Заговоренная гадальная руна", description: "Позволяет заменить один из эффектов синтеза предмета другим, выбрав нужный эффект.\n\n|ni;Подходит для эфенского и рамианского снаряжения; трофеев, полученных за победу над мифическими противниками; ожерелий, полученных на Последнем рубеже; перстней говорящего с духами; а также для костюмов, плащей и украшений чемпионов Порт-Аргенто.|r", useDescription: 'Приступить к замене эффекта.<br>Расход очков работы: <span class="orange_text">50</span>.' },
    { id: 8002769, icon: "https://archeagecodex.com/items/quest/icon_item_quest217.png", grade: 3, isPersonal: true, name: "Знак «Ключевая фигура»", description: "Позволяет получить титул «Ключевая фигура».", useDescription: "Получить титул." },
    { id: 30604, icon: "https://archeagecodex.com/items/icon_item_1643.png", grade: 5, name: "Монеты дару x100" },
    { id: 28814, icon: "https://archeagecodex.com/items/icon_item_1643.png", grade: 5, name: "Монеты дару x180" },
    { id: 55450, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 7, name: "Реликвийное кольцо ифнирского героя" },
    { id: 8002410, type: "equipment", subType: "cloak", icon: "https://archeagecodex.com/items/icon_item_0936.png", grade: 5, name: "Алый шарф", description: "Неизвестно, в чем причина, но к человеку в таком шарфе окружающие почему-то относятся с особенным уважением (и даже с некоторой опаской).\n\n|nc;Усиливающие эффекты костюма действуют 30 дней. Чтобы активировать их заново, костюм нужно постирать.|r", equipDescription: "Скорость передвижения +|nc;3|r%\nСкорость плавания +|nc;3|r%\nСкорость занятия ремеслом |nc;+10%|r\nСкорость занятия животноводством |nc;+10%|r\nОпыт при занятии ремеслом |nc;+10|r%", isEquipDescriptionTemporary: true },
    { id: 34684, type: "equipment", subType: "windInstrument", icon: "https://archeagecodex.com/items/icon_item_ins_s_0051.png", name: "Укрепленная аргенитовая лютня" },
    { id: 34685, type: "equipment", subType: "windInstrument", icon: "https://archeagecodex.com/items/icon_item_ins_w_0025.png", name: "Укрепленный аргенитовый кларнет" },
    { id: 417, icon: "https://archeagecodex.com/items/icon_item_0418.png", grade: 1, name: "Редкий камень странствий", isPersonal: true, description: "Необходим для перемещения с помощью книги порталов.", price: 0, reqLevel: 1 },
    { id: 52701, icon: "https://archeagecodex.com/items/icon_item_5282.png", grade: 1, name: "Кристалл изначального анадия", description: "Эти лиловые кристаллы – достойное подношение духам-хранителям.\nОдновременно в рюкзаке может быть не более пяти кристаллов. Кристаллы исчезнут через один час.", useDescription: "Поднести кристалл духам-хранителям у древнего тотема или усилить призванного духа-хранителя.", price: 0 },
    { id: 40491, icon: "https://archeagecodex.com/items/icon_item_3090.png", grade: 2, name: "Знак отваги" },
    { id: 46695, icon: "https://archeagecodex.com/items/icon_item_4557.png", grade: 3, name: "Белоснежный олененок" },
    { id: 48521, type: "magical", icon: "https://archeagecodex.com/items/icon_item_2070.png", grade: 5, name: "Большой эфенский куб оружейника" },
    { id: 48522, type: "magical", icon: "https://archeagecodex.com/items/icon_item_2069.png", grade: 5, name: "Большой эфенский куб бронника" },
    { id: 8002273, type: "box", icon: "https://archeagecodex.com/items/icon_item_1668.png", grade: 1, name: "Набор анимага" },
    { id: 8002483, type: "box", icon: "https://archeagecodex.com/items/icon_item_3261.png", grade: 1, name: "Коробка с бельем «Ночи Аль-Харбы»" },
    { id: 45409, type: "unidentified", overlay: "unconfirmed", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth292.png", grade: 2, name: "Рамианское матерчатое снаряжение" },
    { id: 53586, type: "unidentified", icon: "https://archeagecodex.com/items/icon_item_5144.png", grade: 4, name: "Золотой сундучок со знаками культистов" },
    { id: 46151, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4467.png", grade: 3, name: "Заготовка огранщика", isPersonal: true },
    { id: 49252, type: "quest", icon: "https://archeagecodex.com/items/icon_item_4878.png", grade: 2, name: "Образцы флоры Сада", isPersonal: true, price: 0, description: "Пакетик с образцами флоры Сада Матери." },
    { id: 31151, type: "other", icon: "https://archeagecodex.com/items/x_mas_gift.png", grade: 1, name: "Перевязанный ленточкой подарок", description: "Похоже, один из снеговиков вместе с украшениями прихватил подарок из тех, что должен был раздавать на улицах города.", useDescription: "Открыть подарок.\nУдерживая Shift, щелкните правой кнопкой мыши, чтобы открыть все подарки этого вида один за другим.", isPersonal: true, price: 0 },
    { id: 28188, type: "rareMaterial", icon: `${GMRU_CDN_ICONS}d2f377e3c3118826089a2caf9e794a50.png`, grade: 3, name: "Сплав стихий", description: "Можно изготовить с помощью |ni;тигля стихий|r.\nИспользуется в ремесле.", isPersonal: true, price: 360 },
    { id: 55516, type: "box", icon: "https://archeagecodex.com/items/icon_item_2812.png", grade: 5, name: "Эпическая руна ифнирского героя", isPersonal: true },
    { id: 55490, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 8, name: "Серьга ифнирского героя эпохи чудес", isPersonal: true },
    { id: 55255, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 7, name: "Реликвийная серьга ифнирского героя", isPersonal: true },
    { id: 52808, type: "unidentified", overlay: "unconfirmed", icon: "https://archeagecodex.com/items/icon_item_teleport.png", grade: 1, name: "Книга порталов (7 д.)", isPersonal: true },
    { id: 34702, type: "equipment", subType: "windInstrument", icon: "https://archeagecodex.com/items/icon_item_ins_w_0049.png", name: "Зеркальный аргенитовый кларнет", buff: { avgRestoreMana: 16 } },
    { id: 51723, type: "mount", icon: "https://archeagecodex.com/items/icon_item_5149.png", grade: 4, name: "Ящик с Мару, покорителем просторов", isPersonal: true },
    { id: 8002771, type: "box", icon: "https://archeagecodex.com/items/icon_item_5043.png", grade: 5, name: "Окованный сталью ящик с глайдером", isPersonal: true },
    { id: 39363, type: "battlePet", icon: "https://archeagecodex.com/items/icon_item_2275.png", grade: 1, name: "Осенний Лоскутик" },
    { id: 34972, icon: "https://archeagecodex.com/items/doll_pet_hm_001.png", grade: 1, name: "Красные очки-сердечки" },
    { id: 34975, icon: "https://archeagecodex.com/items/doll_pet_bo_001.png", grade: 1, name: "Кулинарные перчатки в красный горошек" },
    { id: 36183, icon: "https://archeagecodex.com/items/doll_pet_ar_007.png", grade: 1, name: "Красный заводной ключик" },
    { id: 34981, type: "battlePet", icon: "https://archeagecodex.com/items/icon_item_2720.png", grade: 1, name: "Детеныш Гартарейн" },
    { id: 37018, type: "lightArmor", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth560.png", grade: 3, name: "Вязаная шапочка" },
    { id: 49630, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_4862.png", grade: 5, name: "Статуэтка «Аранзеб»" },
    { id: 31787, type: "lightArmor", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth550.png", grade: 3, name: "Ободок со снеговичками" },
    { id: 28242, type: "craftItem", icon: "https://archeagecodex.com/items/icon_item_1243.png", grade: 1, name: "Мыло" },
    { id: 43298, type: "craftItem", icon: "https://archeagecodex.com/items/icon_item_3952.png", grade: 1, name: "Теневой делец" },
    { id: 8002004, type: "mount", icon: "https://archeagecodex.com/items/icon_item_2774.png", grade: 1, name: "Призрачный конь (30 д.)" },
    { id: 8000315, type: "lightArmor", icon: "https://archeagecodex.com/items/costume_cp/nu_f_cp_leather002.png", grade: 1, name: "Накидка из грифоньих перьев" },
    { id: 8000127, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_set/nu_f_sk_party001.png", grade: 2, name: "Бальный наряд Двух Корон" },
    { id: 55495, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 9, name: "Кольцо ифнирского героя эпохи сказаний" },
    { id: 33156, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth554.png", name: "Вишневая шляпа-торт" },
    { id: 45373, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_4353.png", grade: 2, name: "Фонтан «Лесная гармония»" },
    { id: 8000346, icon: "https://archeagecodex.com/items/icon_item_1360.png", grade: 2, name: "Белая субмарина (30 д.)" },
    { id: 8000309, type: "mount", icon: "https://archeagecodex.com/items/icon_item_1502.png", grade: 3, name: "Цирковой медведь (на 30 дней)" },
    { id: 31878, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_1670.png", grade: 2, name: "Неверинский патефон" },
    { id: 8002069, icon: "https://archeagecodex.com/items/icon_item_moonstone05.png", grade: 1, name: "Дар жрицы Нуи" },
    { id: 39551, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_2847.png", grade: 2, name: "Песчаная скульптура Победы" },
    { id: 8000310, icon: "https://archeagecodex.com/items/icon_item_2979.png", grade: 1, name: "Жетон на покупку оружия" },
    { id: 8000311, icon: "https://archeagecodex.com/items/icon_item_2980.png", grade: 1, name: "Жетон на покупку доспехов" },
    { id: 8000441, icon: "https://archeagecodex.com/items/icon_item_2993.png", grade: 1, name: "Иферийская монетка" },
    { id: 8000442, icon: "https://archeagecodex.com/items/icon_item_2982.png", grade: 1, name: "Заколдованная монетка" },
    { id: 45880, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png", name: "Диадема эрнардского мнемоника", isPersonal: true },
    { id: 45881, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png", name: "Матерчатый камзол эрнардского мнемоника", isPersonal: true },
    { id: 45882, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png", name: "Матерчатые поножи эрнардского мнемоника", isPersonal: true },
    { id: 45883, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png", name: "Матерчатые перчатки эрнардского мнемоника", isPersonal: true },
    { id: 45884, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png", name: "Матерчатые сапоги эрнардского мнемоника", isPersonal: true },
    { id: 45885, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_cloth_0020.png", name: "Матерчатые наручи эрнардского мнемоника", isPersonal: true },
    { id: 45886, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_cloth_0021.png", name: "Матерчатый пояс эрнардского мнемоника", isPersonal: true },
    { id: 45991, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png", name: "Диадема смотрителя тайных архивов", isPersonal: true },
    { id: 45990, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png", name: "Матерчатый камзол смотрителя тайных архивов", isPersonal: true },
    { id: 45989, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png", name: "Матерчатые поножи смотрителя тайных архивов", isPersonal: true },
    { id: 45988, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png", name: "Матерчатые перчатки смотрителя тайных архивов", isPersonal: true },
    { id: 45987, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png", name: "Матерчатые сапоги смотрителя тайных архивов", isPersonal: true },
    { id: 45986, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_cloth_0020.png", name: "Матерчатые наручи смотрителя тайных архивов", isPersonal: true },
    { id: 45985, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_cloth_0021.png", name: "Матерчатый пояс смотрителя тайных архивов", isPersonal: true },
    { id: 45887, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png", name: "Фибула заклинателя гримуаров", isPersonal: true },
    { id: 45888, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png", name: "Кожаная куртка заклинателя гримуаров", isPersonal: true },
    { id: 45889, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png", name: "Кожаные поножи заклинателя гримуаров", isPersonal: true },
    { id: 45890, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png", name: "Кожаные перчатки заклинателя гримуаров", isPersonal: true },
    { id: 47047, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png", name: "Кожаные сапоги заклинателя гримуаров", isPersonal: true },
    { id: 47048, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_leather_0020.png", name: "Кожаные наручи заклинателя гримуаров", isPersonal: true },
    { id: 47049, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_leather_0021.png", name: "Кожаный пояс заклинателя гримуаров", isPersonal: true },
    { id: 47043, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png", name: "Фибула укротителя гримуаров", isPersonal: true },
    { id: 47044, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png", name: "Кожаная куртка укротителя гримуаров", isPersonal: true },
    { id: 47045, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png", name: "Кожаные поножи укротителя гримуаров", isPersonal: true },
    { id: 47046, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png", name: "Кожаные перчатки укротителя гримуаров", isPersonal: true },
    { id: 45891, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png", name: "Кожаные сапоги укротителя гримуаров", isPersonal: true },
    { id: 45892, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_leather_0020.png", name: "Кожаные наручи укротителя гримуаров", isPersonal: true },
    { id: 45893, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_leather_0021.png", name: "Кожаный пояс укротителя гримуаров", isPersonal: true },
    { id: 45894, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_metal295.png", name: "Латный шлем эрнардского архивариуса", isPersonal: true },
    { id: 45895, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_metal295.png", name: "Латный нагрудник эрнардского архивариуса", isPersonal: true },
    { id: 45896, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_metal295.png", name: "Латные поножи эрнардского архивариуса", isPersonal: true },
    { id: 45897, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_metal295.png", name: "Латные перчатки эрнардского архивариуса", isPersonal: true },
    { id: 45898, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_metal295.png", name: "Латные сапоги эрнардского архивариуса", isPersonal: true },
    { id: 45899, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_metal_0020.png", name: "Латные наручи эрнардского архивариуса", isPersonal: true },
    { id: 45900, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_metal_0021.png", name: "Латный пояс эрнардского архивариуса", isPersonal: true },
    { id: 53522, type: "other", icon: "https://archeagecodex.com/items/quest/icon_item_quest169.png", grade: 2, name: "Большой сундук Кириоса", description: "Сундук с медными драконами.\nВнутри:\n\n- 60-100 медных драконов.", isPersonal: true },
    { id: 55367, type: "box", icon: "https://archeagecodex.com/items/icon_item_1482.png", grade: 9, name: "Ларец со свитками пробуждения 3 ранга" },
    { id: 8000926, type: "other", icon: "https://archeagecodex.com/items/icon_item_3368.png", grade: 1, name: "[1 день] Покровительство Сиоль" },
    { id: 51922, type: "box", icon: "https://archeagecodex.com/items/icon_item_4413.png", grade: 2, name: "Корзинка с жетоном" },
    { id: 33382, type: "potion", icon: "https://archeagecodex.com/items/icon_item_0843.png", grade: 1, name: "Бутыль с имбирным напитком" },
    { id: 8003057, type: "magical", icon: "https://archeagecodex.com/items/icon_item_6009.png", grade: 2, name: "Мимолетное благословение предела" },
    { id: 56010, name: "Бенедикт", icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OTdFODYzN0UzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OTdFODYzN0YzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5N0U4NjM3QzNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5N0U4NjM3RDNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PjAKMw0AABTfSURBVHjaNFlpjBzHdX7d1XfPPTszO7Mnd8ldXhJJUeJK1mVJlm34iJ04dpxECIIgMWLYjg3byJ8gQQzEgRMYQWDHBvwrAezAiYPEcKIocnT5EGVJFEmRIiVyuUvufczdM9N3VVde9Sozy93Z2emqV+9973vf15SeerJeyivFvFwuQDEn5W1im1xXgRDgHOJYCkLwfWnogetKrpf4PkSRFIVSzHjC8DMSBw4AEojPE5ANWSkRvaKYZWJokhIltEujrXDUCsM+Df2EJQlQyhnnlHGWcMqBUU4T8RUnXGGJHDPcmIchhKEU4JIgJTSRiYQbUIrbQxhzGkt4WZJIwMXWsswVLjGMAwPikoTvAU9AkjlIEg+BOTyMWaKAHCXJiFEPGJMSWZZUTqicgAKAF6fnwMtAFtcSAHypYJhpNFIQgIeb4JVMDlSJyLiyRBOMNU1JBBgTHgejlBIJg8anLMIT8aVry4p4JZ6xRIcJ+BLD+GLOgyQJAI/IZS4pGHwiDiBWZzyNIeEEr8WFMTCuJBTiCAKFu4r4GB4kjLiuSLLYU2zPqJTGhHGLY0qJuFDGg2G+4pjhaTgeXSEqkWSViHOIw+Mx5TR5eAQqccyspOCHZCkBTBAuImPlMF78OMUfuChT8CyypMQUkwtKCEp6VMa4HskaAYIB4QM/m+CbaVhMLCzqGHgsZopmZcrlTLYgS3IYeGHgRn4Q+V4UekQzVMOmkpIkaZFxJdwJd8Oo8HKEGqKHYd0x1ZguhrlKBAQTkULcBo8eyCKCBHenMsUKEklBMAmAYASYSFxY/Bb7URj4ucpUY2YuVypZ2ZKWLSiKljAaRyENXG84GnY6nZ2N3fVlzKGeK8qymnBRZMyWjNnhMsGYFDwk7sYgwpzLIMomaoaAV1LMA5UhFOUX6MJ8qJghCRTyLloFXhAN3lCW9akT904cOWbny9gVcRy6XgAa1QjRTFvL5bLjauOYgsH1ttZXrry+ffOaYth6roypZUAUWWYHkaX9hbiSEGNSLLAs8IpYSsj8eBZT+W59cOsEI5UTJtCDsXIsk+htEg4HZm5s/t6Ha4cWsOH7w2EYMgQVIbhTEkYxjUI/jIf+MECSINLYzKHp42ezlfqwtT/qtPRMlmi6jBAjGLwqKRibwHfaE4gEZIHk4EnmMCBEQdoy+DdMBk+bBnMLBy0NMkZjFSrz9z1mFvLuwPH8CAvMVUi7WFRXVCQIcQWmyAR0WSah08Eeqi+emDp6GoHV2ryjm7aqWwTTRDSZICGIXQWNcdH4AhQc05YGRERLQZojEC8Q+zxtaEmAMXI9M1uav+9hyTB6Tg+vyeeKmYxtmAZmHAFJFFVVlEQ3JU2rGVpGYaJ9ZVUFZjDPGqvN3rOk60Z7fUW8aWbSPIk2FvuIQLAUiCjkPmQcpK6UY0ULpvlgKccg9EmapNjzdd2cu+dhZqjOwNGw/1RyfWUliGljZmq8WjGIauhGgswbeBktenFD3uiNiuCNSSHYtT2qHIUb8ydPzS49TiX9zhvnEaSSZghISESgiGK2GAYoC+JDDpAOyExKkfvut4NH+h5jEa2cOiOVbHfgYr8ouhrSZOgNaRRfPv9avVH/4HuXnO7erXduZMvVHyXTP1zDJNfAwk53YU+DKDv+9st3f/9H8+eWlh5+7ND9j62+9gtV1UBRCGcYgagbEXUQtJfChsxVM5hCBTsS/0QEk+KHxHccHYFfaExUj94VUirQqGm5jJm3lB+sGz/ujT00rpQb9Wd3tVdut9vUfFE+9KxXg3xGzlvcNiHbAJ/B5vqourj/5hubr72x39qZWjw+Xm/0dzYlgkzERYmQWGNGGcUH/ohxo8ON/EEE+CWyhrlLX+BsRVSXjp008wUpYhQgitni9Pi/XOo987/b4EivB/IL6/7Vl/eXA/ta+ciWMWZZcsOUKrpUIaRuGk0agzuA6clo8fTh9ttua3N9Y6u2eGyiXG5v3pGJehAHjcVTfEujIqcWplLuw8GIE16UUU4D4jS0SpXCofkojATYgmEpo76yR77zT2+CjEzahPUWdAMwKPieGEm10rRtUMw7F2MUSaMTeGAY4DhQmdSL+drmZVC0tbW1xdNn8xmzub2JbZWGgZwhIqI0wRDJEw8tgchdhBmU/x9a+B1nqdGYyo03cpqq5yv/+mb36Wu9p59fB2QfmYpJWq/A1CTkSqBz2G/DcNjLZ/OGgSutReAgKUch3Fq/L6PfM559PciV3P2xqIMQ3Pfc6akZZ/sOcqOIAylMxHVQOCbPHT1ZqtY13RQEdUBBKZqxF9RC0fdGRw81LrbIy/+2fPv8jiD7rA6VcbjvHsgWYXUDrt+Am5vAY1hZgZsrmJktq3q0WLCJDp4BcfClpcIP31//3IOLl8fPRMDMnFXWyc61N1KxFWF6GBOZwc4XvIi1qtWnM7mCgsgX3c9TGsL1I9nKZgrl8ULh/PWt7/3Hq5ABKIBIhmmgkIPdDrDgS5++/1t/+vFPfPQc9Prgj2B3d73Nf2fwxn8b335j7tmHqw4cuftb3/32E5/47fv2Lp4+98BFtW4q/Mh0I+w1kdxFQDH+EJAQqGBpQPzdx7vdju+lokNSsoXyWA0J9e9/eh12+5AlOAgFVrCau23otL750eOf/fVH7prPL5W7Z2YtkPFIJqxffPLS11rPvXh49NwvHnnzcHHw9oC9vtr966/9+UMkavOJnEGc5g7KyDgOaBweYAd7TWRIpAiU7a01p9+JolBQuJihAlESwmZyZvfOyoWXntvvzUB9CvotwDGNc9AykPUfmbQnS9m//Oa3X3zp5f1m58ThMhx5LwyND/qXZhW4OQR2aeM98U+/ONp6+gOPh2z13rNnw2EPJk/ldSe4fTnWxgTFYa2oyAtGhDx9UDVl9e2rTrcZBb5QxGJioPShVr4Mqn7n4vkgiKBYxQEBqUgU+o6YYFsZud/rjTrNDYwG83rXnHWdZGHH+90zy7MUfvor+P5FqAZ7D4/tVX7j9OiTX9Q18s11Bx58yB1o6kvfoJDBkYDIOShUIkZriiDGld3NtYSh9GCqfFAySGJqFYsQ+7al5uoTsIvRcEDdj7qEEtjcBdCe6YYny7fuPnbMpL1s2Gf1c3CJ/cHki+9N2l95Wv5ROzkAAN2Aj01lvld94usXL0DBnLOT89XH7r35qrX+S5qZZCJBPEm/BE+KU0vKaDRQ8YcqyIilHgI5SjdMS1d8XVOtjFB4GZS8KozakAOYn4Uji7DZ+dtrqx+asjNzj6547FV3avEDY+93fvbMy7Dd5r9P9EfmJhvFyoX1S9Vq5hunCm/mjl1w5cuj6M0Y4MiHljYv8sjFThYTnr0LYiJ0sKrgr2KM8IPpKiXCOpAQqxpECSGhmgNcAuFM+bFjpYWZ6k9yE1CpT0zObG/UntlqQtmGKeuJMf2rDxwfdr7Z3v6tL1f4/fVMY3IeErsxZS1TKg3cpRyZ0qDIld7uflRoZBYebr/1LLdrqQ5KrQMqSVUz7CyZrmTld4WGUEWIE6IowdBBVZzJ5a/uDLcHOCPZxGzhC48stEbsrStbMPCGOj/SqHQnGwsTlaem85+ayuQTatTn1PJd71x6pkf9Hlm9uXujnQ/0pc+jHoyoXzaUxYIadNo3e6P3TeTay5eiROh9xJDod5BVrEuuqBx0uVCuspBBmCqcxIE76q68Uzs8SVGfiBjDxyYM3S4M/Q6M+rDNIRzeqnUKU4279ey5fGHcUvsRhfb67L2Pru/+xc9+8PXDXSwIxI2PHE6MOvVc1OI0yRjKUlnWIsmyS8TIxq4nEZ0JaZpqVTHXZTIxlklNgRDRqV8SCFY0TRruh43T1/Mne8s7YEd3FxQzP5bRUW0PN5wh9EPo9iY4++RC5Wg1NxTySniGwO23RrSpN/bN2Z3yPZmps3biuoHnjfxw5HbaXQukcwszqOSvvPazIPAkWWNCW2PhUoEhK0L+C/yIoYBGRXg5RJXl9/aqZ/+5+jG4cgGkWMhsRRu6oZ2x37Mwx5P189jDknp/jhYh7HluDBL1ggDNKostKTw0M9X3xy1TL2c03w99nFZIyq6P+9Zq1WmsjaaiNY7Rhio8le+C/AKRREehRJeFs0MLFyexwlS0Q2gL2fO1U9DcgeXroKhZg+Ss3MhzB747li08eHyhXmkVTXNhotp03Baq+pTUVEXDhk0kpVzK52KK8EBcCqeAAaFlS6dnSCMPIxTeR/VdT9bs1P2AaPswDsKhMiLY4OSCNj2VdE72LoeqjtLY4wSwg2hPDIocOWnL/TCwFBL7QYcluWz2zMwUyMTlBAsS9QKCTkLTLBNkQ8dJKOYTWl0OqoImgPCUYxAe+HF0mL7niYxbdhCyZDC0cjnhJ9GNoRMWSlCW1yMtLk31xudo45is2qaz6ZjjG6wGowBseSGL60QJizKGqSmYauEEojgJ0JXhxIl8dBxE0VDWYUwYDRUHRTsZgCARHAtxarDQxFEEqkqUjK2P/IjK5A8/90ebG5vL7yybdoaK4ZHiZraUadZOQ30eDh9ZNcqroXuWfvxix4XuENbeMiQ6iMiAhjlVuHrVMNGl4aU+D8RNCc5N25YSgqJGQ+PBWBgESiILxSCUMmr4SBLOkItpTgXdBDEg2LieX+vEyIMf/vRTr/z8Ag6Q7c0mGohypUb+8R/+7PEPPvmTfhYM9cvjw3P1/I/DEmQs8Bxo71DgowjcJJnOqONjY+hAgijEpVHC4bZE9AWa0URFhkX3cPAQHYMFkuHA4+CxcYJyRjlCnpmmmc9k8Ejfve23blz5yAP3bew2r129/sSHfy2XL22srcrl6amTpPv8o9nvTHSLN/7z8xPDP84HcH0ZDwI9GVxxIwMtC2IdtQAVLknWDSyejoWIAKU2E7c0WOL7vut7uHXMGcoCTdhfMdEQxUHghyG1dNMyDFwrjGjO4J99/PR/TT26GqjHFmdbbvLZr/7N733mT/b6gex0HIR+kTdr8e7Vd3aeP//KV84ZR6wQLl564gPH4dgibHsQIgJQwAQxj2zLwmhw3mHtkD/wPRmJ2It39tsYEfY3VhZDd6PIj+KRH4wcvzdwCYQ5HQ/XQ4+hKKoX9k85rz5VUZZLR4tj2Yyq7m/vs8hDs62MnKFerW45g07AC/n85Zu3z9zb/s5v3vWLSe++Q9pfzT/0lGWv/vsL1zR5ujJSYytIfCnle8xU3gDdYNMTuWKp0O97rabTHfpoUHAUTk6MVQq60xs6Q+y4Ecijra0Wetxao6YRLwqHr7x9++SUlPRn8ofuPnH3iThu7Te3fLTSR+cbV6+/vddqjQbDoetiTNlcUeb+4XrxuRdeTbz+333hk9187vwLrxZVli8UEUI45sbHC9WqUcgm6BwdZzeJvBNHpo+fnJuojdm6MTNbNSWHeZ0gcBTCpuul3Z19ZxQ+dO7s/OE6C1wWR6plZTXu7yznswVO6eHjE7du3vz5L18nh2bH3DBwHQzH1xRN9HIcjTfG17f2V9fWIokbEvvUk/fMzkzcWF6vVUszk8WxAjEMT6J96ruh5yK9DEYB9o6qEnfQzhVUTaGXL15s9/rt7hAPvt9s4Zw6cfTI9GTd1M293d3dvc2JWjWIYsLD1v4eVvbc0tn/eea56++sKlbGwpGrII0C2nlUcezO2m0cL6OBb+lG1jIvXb9xe2Nn6eyZ8c98pN9qJZHfHzhOz5OYpCuqnE7ErKXkMtqVy1fbzfZYtRSGvmnZ+WymO/RYlo0GTqVgVAsWjvXhYNgbdnFudlt7XsTy+fJ4XjeszM7GJnISrkWWTi2gbkWDRwQWIxxrBKS9dgcVeNa0EMpI+FFEO519FTx8hbyPoKAoorCL0DRg2xFm4r8oHkMxZpv453KlkS9XEAB2xtQsQ05ZQFXNbMbsd/Y63S5ulQShuBVFw1qlfGRx3mntv/DShWZ3gHM3kDg6P+EMxR0SnGoM9SrSCkkVb8CxxZRQjoNhB38X9zpQ7NogBZQjJ4G4Rai4HEauly+U8oV8a3dNpYMRBk092zZURmwibhqog3gnbrtI4GGkYIgJchnXgQ17HU3jTqe533LEbayYxYq4RyqEfBIiyVHQcfyglMTokGdj2usRzeyhJZUV7C5sWjFDFXG7QuZCROmyinNgNOpe/fnTWtBxnb18QZ2rFjaGbBQIqeOFoW1k97lLs3OV+ftV5EhGQ46n0sQdjYETatKNlfVW38lYpqKGSSTFOkbLlDgKMIeJZKV31FCCo25LZMNErYLzP4rEECV0lMSBhJfqZr5YZEG8fXOZDtbAbcsh5LKSmqlrhZqsK2YSOWbJT5DUqS+kF9FVI/I6SGZCXuA8QekjZ9FfZCR4Z2UH/ZnjMwVNKsEhKP6jACkOtZnMI19BqS3rLsXJkSgqEbfbma+wdHzRUAHIqCbOiM0b1/bWbrW3aE6HiRm5MDnJsxOSlbtNo7UerWp6Vgo001bMiozzRMUqJOGoj6JMwgpiqtHjBP1aY5IG8bjUf+Jo7oGjFaxCqMoYVSL+l0DCvRFAhGH3j9oZU0IM+Lw48iJVjSWiyHGsqHrM4c76+vrKHadJi1k4NJ8t1CftYhnNSxgjdY64F3GFuIodu11N9yxQcOKboCa4M2okPCx35eGwF/a6rc6wOb+62++t337fXdVlBDUPXcePsjjwYhgOHMM0B3HY3FrLm7w0WU7Q0CY7JimNPAX1GyonULzba9tvrnqNLNxzjNSrufnZQzhju73uII6rhrpyZ7tSzi/MzNy+fU0CZX0rvNi/eWZh7FbXnaw36uNVNH6x1+x0m5RkavX5t966cXN1WGvIkmGrGiNPzlNOceR0qjnj9MnDe/s7V95awy6wsjbH9KkWATlnxM32/sZGjzAUh92JHDs1n6uWCQoxx0FK7EZua9Tfl2lsCDPnH1uY5l7v2pWN66vD5XXPi2hWHuDk7/S7JGjqENq2juLDwEGRRIVq+cEHFhZn6rhUw2Zk2oycQdTvx1rSn5+yTy1MzzeKURI4I7/ZDZp9pEF/MAhqlfzsoVoQJK1etDvgt3ajyyvRnsPHy2o2Z++03V9d5VSmqm3dWR9duNbc3O62R+TtDkoXfmKKFHNKRrOmy1lThb7rA9H90NvY3N5pjQK/o/MIZWW7s/Psy63/E2AAOTY7Y/TCa8QAAAAASUVORK5CYII=" },
    { id: 1, type: "", icon: "", grade: 1, name: "" }
  ].map((i) => [i.id, i]));
  let getItemCodexUrl = /* @__PURE__ */ __name((item) => `${CODEX_ITEM_URL}${item.id}/${item.isGradeInferred ? `?grade=${item.grade}` : ""}`, "getItemCodexUrl");

  // src/components/popup/popup.ts
  let POPUP_PANEL_CLASS = "tm-popup-panel";
  let createPopup = /* @__PURE__ */ __name((opts) => {
    const { panelClass, title, extraButtons, zIndex = "10002", onClose } = opts;
    const overlay = document.createElement("div");
    overlay.className = "tm-popup-overlay";
    overlay.style.zIndex = zIndex;
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    const panel = document.createElement("div");
    panel.className = `${POPUP_PANEL_CLASS} ${panelClass || ""}`.trim();
    panel.addEventListener("mousedown", (e) => e.stopPropagation());
    const header = document.createElement("div");
    header.className = "tm-popup-header";
    const titleEl = document.createElement("div");
    titleEl.className = "tm-popup-title";
    titleEl.textContent = title;
    header.appendChild(titleEl);
    if (extraButtons) {
      for (const btn of extraButtons) header.appendChild(btn);
    }
    const close = /* @__PURE__ */ __name(() => {
      overlay.remove();
      onClose?.();
    }, "close");
    const closeBtn = document.createElement("button");
    closeBtn.className = "tm-popup-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = document.createElement("div");
    body.className = "tm-popup-body";
    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return { overlay, panel, header, body, close };
  }, "createPopup");

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/pages/events/events.scss
  let events_default = '.tm-popup-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 10001;\n  background: rgba(0, 0, 0, 0.45);\n  color: #2D364E;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.tm-popup-panel {\n  background: #fff;\n  border-radius: 8px;\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);\n  max-height: 85vh;\n  display: flex;\n  flex-direction: column;\n  font: 14px/1.5 Cambria, Georgia, "Times New Roman", Times, serif;\n}\n\n.tm-popup-panel--events {\n  width: 1000px;\n  max-width: 95vw;\n}\n\n.tm-popup-panel--settings {\n  width: 680px;\n  max-width: 95vw;\n  max-height: 80vh;\n}\n\n.tm-popup-header {\n  display: flex;\n  align-items: center;\n  padding: 12px 16px;\n  border-bottom: 1px solid #ddd;\n  gap: 8px;\n  flex-shrink: 0;\n}\n\n.tm-popup-title {\n  flex: 1;\n  font-size: 18px;\n  font-weight: bold;\n  margin: 0;\n}\n\n.tm-popup-btn {\n  background: none;\n  border: none;\n  cursor: pointer;\n  font-size: 20px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  color: #555;\n  line-height: 1;\n}\n\n.tm-popup-btn:hover {\n  background: #eee;\n  color: #000;\n}\n\n.tm-popup-body {\n  overflow-y: auto;\n  padding: 0;\n  flex: 1;\n}\n\n.tm-popup-body--settings {\n  display: flex;\n  gap: 24px;\n  padding: 12px 16px;\n  overflow: hidden;\n}\n\n.tm-settings-left {\n  flex: 0 0 280px;\n  min-width: 0;\n}\n\n.tm-settings-right {\n  flex: 1;\n  min-width: 0;\n  overflow-y: auto;\n}\n\n.tm-settings-section {\n  margin-bottom: 14px;\n}\n\n.tm-settings-section:last-child {\n  margin-bottom: 0;\n}\n\n.tm-settings-section-title {\n  font-weight: bold;\n  margin-bottom: 8px;\n}\n\n.tm-settings-server-select {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 5px 6px;\n  border: 1px solid #bbb;\n  border-radius: 4px;\n  background: #fff;\n  color: #2D364E;\n  font: inherit;\n}\n\n/* Events table */\n.tm-events-table {\n  width: 100%;\n  border-collapse: collapse;\n}\n\n.tm-events-table th {\n  background: #3d2a5a;\n  color: #fff;\n  padding: 8px 12px;\n  text-align: left;\n  font-weight: normal;\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  border-bottom: none;\n}\n\n.tm-events-table td {\n  padding: 6px 12px;\n  border-bottom: 1px solid #ddd;\n  vertical-align: top;\n}\n\n.tm-events-table tr:nth-child(even) td {\n  background: #f5f5f5;\n}\n\n.tm-events-table tr.tm-event-active td {\n  background: #d4edda;\n}\n\n.tm-events-table tr.tm-event-beyond td {\n  opacity: 0.6;\n}\n\n.tm-events-table .tm-event-time {\n  white-space: nowrap;\n  font-family: monospace;\n  font-size: 13px;\n}\n\n.tm-event-time details {\n  cursor: pointer;\n}\n\n.tm-event-time summary {\n  display: list-item;\n}\n\n.tm-event-time summary::marker {\n  font-size: 10px;\n}\n\n.tm-event-time .tm-schedule-detail {\n  margin-top: 4px;\n  padding-left: 18px;\n  font-size: 12px;\n  color: #555;\n  white-space: normal;\n}\n\n.tm-event-time--active summary {\n  color: #155724;\n  font-weight: bold;\n}\n\n.tm-event-time--waiting summary {\n  color: #856404;\n}\n\n.tm-events-table a {\n  color: #2a6496;\n  text-decoration: none;\n}\n\n.tm-events-table a:hover {\n  text-decoration: underline;\n}\n\n/* Settings checkboxes */\n.tm-ev-settings-list {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n.tm-ev-settings-list li {\n  padding: 4px 0;\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.tm-ev-settings-list label {\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex: 1;\n}\n\n.tm-ev-settings-list input[type=checkbox] {\n  width: 16px;\n  height: 16px;\n  flex-shrink: 0;\n}\n\n.tm-popup-btn--bell {\n  font-size: 16px;\n}\n\n.tm-popup-btn--bell-off {\n  opacity: 0.4;\n}\n\n.tm-ev-bell {\n  cursor: pointer;\n  font-size: 14px;\n  padding: 0 4px;\n  user-select: none;\n  border: none;\n  background: none;\n  vertical-align: middle;\n}\n\n.tm-ev-bell--off {\n  opacity: 0.25;\n}\n\n.tm-scale-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.tm-scale-input {\n  width: 75px;\n  padding: 4px 6px;\n  border: 1px solid #bbb;\n  border-radius: 4px;\n  font: inherit;\n}\n\n.tm-scale-suffix {\n  color: #555;\n}\n\n.tm-zoom-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin-top: 4px;\n}\n\n.tm-zoom-cb:disabled + .tm-zoom-label {\n  opacity: 0.5;\n}\n\n.tm-zoom-label {\n  cursor: pointer;\n  user-select: none;\n  font-size: 13px;\n}';

  // src/pages/events/events.ts
  let LS_KEYS = {
    EVENT_VISIBILITY: "tm_aa_ev_vis",
    NOTIFICATIONS: "tm_aa_notifications"
  };
  let CODEX_QUEST_BASE = "https://archeagecodex.com/ru/quest/";
  let loadNotificationState = /* @__PURE__ */ __name(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          enabled: !!parsed.enabled,
          events: parsed.events || {},
          notified: parsed.notified || {}
        };
      }
    } catch {
    }
    return { enabled: false, events: {}, notified: {} };
  }, "loadNotificationState");
  let saveNotificationState = /* @__PURE__ */ __name((state) => {
    try {
      localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(state));
    } catch {
    }
  }, "saveNotificationState");
  let loadEventVisibility2 = /* @__PURE__ */ __name(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.EVENT_VISIBILITY)) || {};
    } catch {
      return {};
    }
  }, "loadEventVisibility");
  let saveEventVisibility = /* @__PURE__ */ __name((overrides) => {
    try {
      localStorage.setItem(LS_KEYS.EVENT_VISIBILITY, JSON.stringify(overrides));
    } catch {
    }
  }, "saveEventVisibility");
  let isEventVisible2 = /* @__PURE__ */ __name((ev, overrides) => {
    if (ev.code in overrides) return overrides[ev.code];
    return !!ev.defaultVisible;
  }, "isEventVisible");
  let getMSKDateString = /* @__PURE__ */ __name((utcMs) => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(new Date(utcMs));
  }, "getMSKDateString");
  let cleanOldNotifiedKeys = /* @__PURE__ */ __name((state) => {
    const today = getMSKDateString(getServerNowMs());
    const keys = Object.keys(state.notified);
    let changed = false;
    for (const key of keys) {
      if (!key.startsWith(today)) {
        delete state.notified[key];
        changed = true;
      }
    }
    if (changed) saveNotificationState(state);
  }, "cleanOldNotifiedKeys");
  let showEventNotification = /* @__PURE__ */ __name((ev, entry) => {
    const timeLabel = entry.timeEnd ? `${entry.timeStart}–${entry.timeEnd}` : entry.timeStart;
    const location2 = ev.locations?.length ? ev.locations.join(", ") : "";
    const body = location2 ? `${timeLabel} — ${location2}` : timeLabel;
    try {
      new Notification(ev.title, { body, icon: "https://aa.cdn.gmru.net/ms/data/old/9d56835cb7de079738b7e95471186c09.png", tag: `aa-ev-${ev.title}-${entry.timeStart}` });
    } catch {
    }
  }, "showEventNotification");
  let checkEventNotifications = /* @__PURE__ */ __name(({
    loadNotificationState: loadNotificationState2,
    saveNotificationState: saveNotificationState2
  } = {}) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const state = loadNotificationState2();
    if (!state.enabled) return;
    cleanOldNotifiedKeys(state);
    const visOverrides = loadEventVisibility2();
    const serverNow = getServerNowMs();
    const nowWd = getMSKWeekday(serverNow);
    const nowSec = getMSKTimeOfDaySeconds(serverNow);
    const todayStr = getMSKDateString(serverNow);
    let changed = false;
    for (const ev of EVENTS) {
      const evNotif = ev.code in state.events ? state.events[ev.code] : !!ev.defaultNotifications;
      if (!evNotif) continue;
      if (!isEventVisible2(ev, visOverrides)) continue;
      for (const entry of ev.schedule) {
        const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
        if (!isToday) continue;
        const { hours, minutes } = parseTime(entry.timeStart);
        const startSec = hours * 3600 + minutes * 60;
        const diff = startSec - nowSec;
        if (diff >= 270 && diff <= 330) {
          const key = `${todayStr}_${ev.code}_${entry.timeStart}`;
          if (!state.notified[key]) {
            showEventNotification(ev, entry);
            state.notified[key] = true;
            changed = true;
          }
        }
      }
    }
    if (changed) saveNotificationState2(state);
  }, "checkEventNotifications");
  let eventsPopupStylesInjected = false;
  let injectEventsPopupStyles = /* @__PURE__ */ __name(() => {
    if (eventsPopupStylesInjected) return;
    eventsPopupStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = events_default;
    appendStyleElement(style);
  }, "injectEventsPopupStyles");
  let eventsOverlay = null;
  let eventsInterval = null;
  let settingsOverlay = null;
  let evVisOverrides = {};
  let settingsClose = null;
  let eventsClose = null;
  let closeSettingsPopup = /* @__PURE__ */ __name(() => {
    if (settingsClose) {
      settingsClose();
      settingsClose = null;
      settingsOverlay = null;
    } else if (settingsOverlay) {
      settingsOverlay.remove();
      settingsOverlay = null;
    }
  }, "closeSettingsPopup");
  let closeEventsPopup = /* @__PURE__ */ __name(() => {
    closeSettingsPopup();
    if (eventsInterval) {
      clearInterval(eventsInterval);
      eventsInterval = null;
    }
    if (eventsClose) {
      eventsClose();
      eventsClose = null;
      eventsOverlay = null;
    } else if (eventsOverlay) {
      eventsOverlay.remove();
      eventsOverlay = null;
    }
  }, "closeEventsPopup");
  let openSettingsPopup = /* @__PURE__ */ __name((onChanged, {
    loadVekselServerIdOverride: loadVekselServerIdOverride2,
    saveVekselServerIdOverride: saveVekselServerIdOverride2,
    resolveVekselUrl: resolveVekselUrl2,
    getVekselAutoOptionText: getVekselAutoOptionText2,
    loadNotificationState: loadNotificationState2,
    saveNotificationState: saveNotificationState2,
    updateRenderedItemIcons: updateRenderedItemIcons2 = /* @__PURE__ */ __name(() => {
    }, "updateRenderedItemIcons")
  } = {}) => {
    if (settingsOverlay) {
      closeSettingsPopup();
      return;
    }
    const popup = createPopup({
      panelClass: "tm-popup-panel--settings",
      title: "Настройки",
      onClose: /* @__PURE__ */ __name(() => {
        settingsOverlay = null;
        settingsClose = null;
      }, "onClose")
    });
    settingsOverlay = popup.overlay;
    settingsClose = popup.close;
    popup.body.className = "tm-popup-body tm-popup-body--settings";
    const leftCol = document.createElement("div");
    leftCol.className = "tm-settings-left";
    const rightCol = document.createElement("div");
    rightCol.className = "tm-settings-right";
    const serverSection = document.createElement("div");
    serverSection.className = "tm-settings-section";
    const serverTitle = document.createElement("div");
    serverTitle.className = "tm-settings-section-title";
    serverTitle.textContent = "Основной сервер";
    serverSection.appendChild(serverTitle);
    const serverSelect = document.createElement("select");
    serverSelect.className = "tm-settings-server-select";
    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.dataset.vekselServerAutoOption = "1";
    autoOption.textContent = getVekselAutoOptionText2();
    serverSelect.appendChild(autoOption);
    Object.entries(SERVERS).sort((a, b) => a[1].localeCompare(b[1], "ru")).forEach(([id, name]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      serverSelect.appendChild(option);
    });
    serverSelect.value = loadVekselServerIdOverride2();
    serverSelect.addEventListener("change", () => {
      saveVekselServerIdOverride2(serverSelect.value);
      resolveVekselUrl2();
    });
    serverSection.appendChild(serverSelect);
    leftCol.appendChild(serverSection);
    const sexSection = document.createElement("div");
    sexSection.className = "tm-settings-section";
    const sexTitle = document.createElement("div");
    sexTitle.className = "tm-settings-section-title";
    sexTitle.textContent = "Пол";
    sexSection.appendChild(sexTitle);
    const sexSelect = document.createElement("select");
    sexSelect.className = "tm-settings-server-select";
    Object.entries(ICON_SEX_VALUES).forEach(([value, info]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = info.title;
      sexSelect.appendChild(option);
    });
    sexSelect.value = loadIconSex();
    sexSelect.addEventListener("change", () => {
      saveIconSex(sexSelect.value);
      updateRenderedItemIcons2();
      onChanged();
    });
    sexSection.appendChild(sexSelect);
    leftCol.appendChild(sexSection);
    const scaleSection = document.createElement("div");
    scaleSection.className = "tm-settings-section";
    const scaleTitle = document.createElement("div");
    scaleTitle.className = "tm-settings-section-title";
    scaleTitle.textContent = "Масштаб всплывашки";
    scaleSection.appendChild(scaleTitle);
    const scaleRow = document.createElement("div");
    scaleRow.className = "tm-scale-row";
    const scaleInput = document.createElement("input");
    scaleInput.type = "number";
    scaleInput.className = "tm-scale-input";
    scaleInput.step = "5";
    scaleInput.min = "10";
    scaleInput.max = "5000";
    scaleInput.value = loadIconScalePercent();
    const scaleSuffix = document.createElement("span");
    scaleSuffix.className = "tm-scale-suffix";
    scaleSuffix.textContent = "%";
    scaleInput.addEventListener("change", () => {
      const val = parseInt(scaleInput.value, 10);
      if (Number.isFinite(val) && val >= 10 && val <= 5e3) {
        saveIconScalePercent(val);
        scaleInput.value = val;
      } else {
        scaleInput.value = loadIconScalePercent();
      }
    });
    scaleRow.appendChild(scaleInput);
    scaleRow.appendChild(scaleSuffix);
    scaleSection.appendChild(scaleRow);
    const zoomCb = document.createElement("input");
    zoomCb.type = "checkbox";
    zoomCb.className = "tm-zoom-cb";
    zoomCb.id = "tm-scale-browser-zoom";
    zoomCb.checked = loadIconScaleBrowserZoom();
    zoomCb.disabled = window.devicePixelRatio === 1;
    zoomCb.addEventListener("change", () => saveIconScaleBrowserZoom(zoomCb.checked));
    const zoomLabel = document.createElement("label");
    zoomLabel.className = "tm-zoom-label";
    zoomLabel.htmlFor = "tm-scale-browser-zoom";
    zoomLabel.textContent = "Масштаб браузера";
    const zoomRow = document.createElement("div");
    zoomRow.className = "tm-zoom-row";
    zoomRow.appendChild(zoomCb);
    zoomRow.appendChild(zoomLabel);
    scaleSection.appendChild(zoomRow);
    leftCol.appendChild(scaleSection);
    const eventsSection = document.createElement("div");
    eventsSection.className = "tm-settings-section";
    const eventsTitle = document.createElement("div");
    eventsTitle.className = "tm-settings-section-title";
    eventsTitle.textContent = "Отображаемые события";
    eventsSection.appendChild(eventsTitle);
    const ul = document.createElement("ul");
    ul.className = "tm-ev-settings-list";
    const notifState = loadNotificationState2();
    for (const ev of EVENTS) {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isEventVisible2(ev, evVisOverrides);
      cb.addEventListener("change", () => {
        if (cb.checked === !!ev.defaultVisible) {
          delete evVisOverrides[ev.code];
        } else {
          evVisOverrides[ev.code] = cb.checked;
        }
        saveEventVisibility(evVisOverrides);
        onChanged();
      });
      const span = document.createElement("span");
      span.textContent = ev.title;
      label.appendChild(cb);
      label.appendChild(span);
      const bell = document.createElement("button");
      const bellOn = ev.code in notifState.events ? notifState.events[ev.code] : !!ev.defaultNotifications;
      bell.className = "tm-ev-bell" + (bellOn ? "" : " tm-ev-bell--off");
      bell.textContent = "🔔";
      bell.title = "Уведомление за 5 мин";
      bell.addEventListener("click", () => {
        if (typeof Notification === "undefined") {
          alert("Ваш браузер не поддерживает уведомления.");
          return;
        }
        const toggle = /* @__PURE__ */ __name(() => {
          const s = loadNotificationState2();
          const wasOn = ev.code in s.events ? s.events[ev.code] : !!ev.defaultNotifications;
          const nowOn = !wasOn;
          if (nowOn === !!ev.defaultNotifications) {
            delete s.events[ev.code];
          } else {
            s.events[ev.code] = nowOn;
          }
          if (nowOn) s.enabled = true;
          saveNotificationState2(s);
          bell.classList.toggle("tm-ev-bell--off", !nowOn);
          const globalBell = document.querySelector(".tm-popup-btn--bell");
          if (globalBell) globalBell.classList.toggle("tm-popup-btn--bell-off", !s.enabled);
        }, "toggle");
        if (Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") toggle();
            else alert("Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.");
          });
          return;
        }
        if (Notification.permission === "denied") {
          alert("Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.");
          return;
        }
        toggle();
      });
      li.appendChild(bell);
      li.appendChild(label);
      ul.appendChild(li);
    }
    eventsSection.appendChild(ul);
    rightCol.appendChild(eventsSection);
    popup.body.appendChild(leftCol);
    popup.body.appendChild(rightCol);
  }, "openSettingsPopup");
  let openEventsPopup = /* @__PURE__ */ __name(({
    loadVekselServerIdOverride: loadVekselServerIdOverride2,
    saveVekselServerIdOverride: saveVekselServerIdOverride2,
    resolveVekselUrl: resolveVekselUrl2,
    getVekselAutoOptionText: getVekselAutoOptionText2,
    loadNotificationState: loadNotificationState2,
    saveNotificationState: saveNotificationState2,
    updateRenderedItemIcons: updateRenderedItemIcons2 = /* @__PURE__ */ __name(() => {
    }, "updateRenderedItemIcons")
  } = {}) => {
    if (eventsOverlay) {
      closeEventsPopup();
      return;
    }
    injectEventsPopupStyles();
    evVisOverrides = loadEventVisibility2();
    const gearBtn = document.createElement("button");
    gearBtn.className = "tm-popup-btn";
    gearBtn.textContent = "⚙";
    gearBtn.title = "Настройки отображения";
    gearBtn.addEventListener("click", () => openSettingsPopup(renderTable, {
      loadVekselServerIdOverride: loadVekselServerIdOverride2,
      saveVekselServerIdOverride: saveVekselServerIdOverride2,
      resolveVekselUrl: resolveVekselUrl2,
      getVekselAutoOptionText: getVekselAutoOptionText2,
      loadNotificationState: loadNotificationState2,
      saveNotificationState: saveNotificationState2,
      updateRenderedItemIcons: updateRenderedItemIcons2
    }));
    const bellBtn = document.createElement("button");
    bellBtn.className = "tm-popup-btn tm-popup-btn--bell";
    bellBtn.textContent = "🔔";
    bellBtn.title = "Уведомления за 5 минут до событий";
    const updateBellStyle = /* @__PURE__ */ __name(() => {
      const s = loadNotificationState2();
      bellBtn.classList.toggle("tm-popup-btn--bell-off", !s.enabled);
    }, "updateBellStyle");
    updateBellStyle();
    bellBtn.addEventListener("click", async () => {
      if (typeof Notification === "undefined") {
        alert("Ваш браузер не поддерживает уведомления.");
        return;
      }
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "denied") {
        alert("Уведомления заблокированы в настройках браузера.\nРазрешите уведомления для этого сайта и попробуйте снова.");
        return;
      }
      const state = loadNotificationState2();
      state.enabled = !state.enabled;
      saveNotificationState2(state);
      updateBellStyle();
    });
    const popup = createPopup({
      panelClass: "tm-popup-panel--events",
      title: "Расписание событий",
      extraButtons: [gearBtn, bellBtn],
      onClose: /* @__PURE__ */ __name(() => {
        if (eventsInterval) {
          clearInterval(eventsInterval);
          eventsInterval = null;
        }
        eventsOverlay = null;
        eventsClose = null;
      }, "onClose")
    });
    eventsOverlay = popup.overlay;
    eventsClose = popup.close;
    const table = document.createElement("table");
    table.className = "tm-events-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const col of ["Время", "Название", "Локации"]) {
      const th = document.createElement("th");
      th.textContent = col;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    popup.body.appendChild(table);
    const DAY_SEC = 86400;
    const openDetails = /* @__PURE__ */ new Set();
    const collectOccurrences = /* @__PURE__ */ __name(() => {
      const serverNow = getServerNowMs();
      const nowWd = getMSKWeekday(serverNow);
      const nowSec = getMSKTimeOfDaySeconds(serverNow);
      const within = [];
      const beyond = [];
      for (const ev of EVENTS) {
        if (!isEventVisible2(ev, evVisOverrides)) continue;
        let hasWithin = false;
        let nearest = null;
        for (const entry of ev.schedule) {
          const { hours, minutes } = parseTime(entry.timeStart);
          const startSec = hours * 3600 + minutes * 60;
          const timeStr = entry.timeEnd ? `${entry.timeStart}–${entry.timeEnd}` : entry.timeStart;
          if (entry.timeEnd) {
            const end = parseTime(entry.timeEnd);
            const endSec = end.hours * 3600 + end.minutes * 60;
            const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
            if (isToday && nowSec >= startSec && nowSec < endSec) {
              within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: -(endSec - nowSec), isActive: true, isBeyond: false });
              hasWithin = true;
              continue;
            }
          } else {
            const activeDur = (entry.duration ?? 5) * 60;
            const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
            if (isToday && nowSec >= startSec && nowSec < startSec + activeDur) {
              within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: 0, isActive: true, isBeyond: false });
              hasWithin = true;
              continue;
            }
          }
          if (!entry.weekdays?.length) {
            let diff = startSec - nowSec;
            if (diff <= 0) diff += DAY_SEC;
            within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: diff, isActive: false, isBeyond: false });
            hasWithin = true;
          } else {
            let minDiff = Infinity;
            for (const wd of entry.weekdays) {
              let d = wd - nowWd;
              if (d < 0) d += 7;
              let diff = d * DAY_SEC + (startSec - nowSec);
              if (diff <= 0) diff += 7 * DAY_SEC;
              if (diff < minDiff) minDiff = diff;
            }
            const dayName = WEEKDAY_NAMES[getMSKWeekday(serverNow + minDiff * 1e3)];
            const fullLabel = `${dayName} ${timeStr}`;
            if (minDiff <= DAY_SEC) {
              within.push({ ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: false });
              hasWithin = true;
            } else if (!nearest || minDiff < nearest.secondsUntil) {
              nearest = { ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: true };
            }
          }
        }
        if (!hasWithin && nearest) {
          beyond.push(nearest);
        }
      }
      within.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        if (a.isActive && b.isActive) return b.secondsUntil - a.secondsUntil;
        return a.secondsUntil - b.secondsUntil;
      });
      beyond.sort((a, b) => a.secondsUntil - b.secondsUntil);
      return [...within, ...beyond];
    }, "collectOccurrences");
    const buildScheduleLines = /* @__PURE__ */ __name((schedule) => {
      const lines = [];
      for (const entry of schedule) {
        const time = entry.timeEnd ? `${entry.timeStart}–${entry.timeEnd}` : entry.timeStart;
        if (entry.weekdays?.length) {
          const days = entry.weekdays.map((d) => WEEKDAY_NAMES[d]).join(", ");
          lines.push(`${days} ${time}`);
        } else {
          lines.push(time);
        }
      }
      return lines;
    }, "buildScheduleLines");
    const summaryText = /* @__PURE__ */ __name((occ) => {
      if (occ.isActive && occ.secondsUntil < 0) {
        return `${occ.label} — ещё ${formatCountdown(-occ.secondsUntil)}`;
      } else if (occ.isActive) {
        return occ.label;
      } else {
        return `${occ.label} — через ${formatCountdown(occ.secondsUntil)}`;
      }
    }, "summaryText");
    const structureKey = /* @__PURE__ */ __name((occs) => occs.map(
      (o) => `${o.evCode}:${o.label}:${o.isActive}:${o.isBeyond}`
    ).join("|"), "structureKey");
    let lastKey = "";
    let summaryEls = [];
    const renderTable = /* @__PURE__ */ __name(() => {
      const occs = collectOccurrences();
      lastKey = structureKey(occs);
      summaryEls = [];
      const frag = document.createDocumentFragment();
      for (const occ of occs) {
        const key = `${occ.evCode}:${occ.label}`;
        const tr = document.createElement("tr");
        if (occ.isActive) tr.classList.add("tm-event-active");
        if (occ.isBeyond) tr.classList.add("tm-event-beyond");
        const timeTd = document.createElement("td");
        timeTd.className = "tm-event-time";
        if (occ.isActive) timeTd.classList.add("tm-event-time--active");
        else timeTd.classList.add("tm-event-time--waiting");
        const details = document.createElement("details");
        if (openDetails.has(key)) details.open = true;
        details.addEventListener("toggle", () => {
          if (details.open) openDetails.add(key);
          else openDetails.delete(key);
        });
        const summary = document.createElement("summary");
        summary.textContent = summaryText(occ);
        details.appendChild(summary);
        summaryEls.push(summary);
        const schedDiv = document.createElement("div");
        schedDiv.className = "tm-schedule-detail";
        for (const line of buildScheduleLines(occ.ev.schedule)) {
          const div = document.createElement("div");
          div.textContent = line;
          schedDiv.appendChild(div);
        }
        details.appendChild(schedDiv);
        timeTd.appendChild(details);
        tr.appendChild(timeTd);
        const nameTd = document.createElement("td");
        nameTd.textContent = occ.ev.title || "—";
        if (occ.ev.quests?.length) {
          for (const q of occ.ev.quests) {
            const a = document.createElement("a");
            a.href = CODEX_QUEST_BASE + q.id + "/";
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = ` (#${q.id})`;
            nameTd.appendChild(a);
          }
        }
        tr.appendChild(nameTd);
        const locTd = document.createElement("td");
        locTd.textContent = (occ.ev.locations || []).join(", ");
        tr.appendChild(locTd);
        frag.appendChild(tr);
      }
      tbody.textContent = "";
      tbody.appendChild(frag);
    }, "renderTable");
    const tickTable = /* @__PURE__ */ __name(() => {
      const occs = collectOccurrences();
      const key = structureKey(occs);
      if (key !== lastKey) {
        renderTable();
        return;
      }
      for (let i = 0; i < occs.length; i++) {
        summaryEls[i].textContent = summaryText(occs[i]);
      }
    }, "tickTable");
    renderTable();
    eventsInterval = setInterval(tickTable, 1e3);
  }, "openEventsPopup");

  // src/components/select/select.ts
  let makeSelect = /* @__PURE__ */ __name(({ options, selected, onChange }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "itemrestore__select_wrapper";
    const select = document.createElement("select");
    select.className = "itemrestore__filter-grades";
    for (const { value, label } of options) {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = label;
      if (String(value) === String(selected)) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => onChange(select.value));
    wrapper.appendChild(select);
    return wrapper;
  }, "makeSelect");
  let renderSelectedItems = /* @__PURE__ */ __name((container, items, { emptyText, onRemove, mapItem }, makeItemIconLink2) => {
    container.innerHTML = "";
    if (items.length === 0) {
      const p = document.createElement("div");
      p.className = "tm-selected-items-help";
      p.textContent = emptyText;
      container.appendChild(p);
      return;
    }
    for (const item of items) {
      const mapped = mapItem(item);
      const entry = document.createElement("div");
      entry.className = "tm-selected-item";
      const nameWrap = document.createElement("div");
      nameWrap.className = "tm-cart-item-name";
      if (mapped.itemBase) {
        const icon = makeItemIconLink2({
          item: mapped.itemBase,
          linked: true,
          size: "small",
          count: mapped.count
        });
        nameWrap.appendChild(icon);
      } else if (mapped.iconUrl) {
        const img = document.createElement("img");
        img.width = 24;
        img.height = 24;
        img.src = mapped.iconUrl;
        nameWrap.appendChild(img);
      }
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = mapped.name || mapped.itemBase?.name || "";
      nameWrap.appendChild(title);
      entry.appendChild(nameWrap);
      const delBtn = document.createElement("div");
      delBtn.className = "del_btn";
      delBtn.addEventListener("click", () => onRemove(item));
      entry.appendChild(delBtn);
      container.appendChild(entry);
    }
  }, "renderSelectedItems");

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/components/reloadBtn/reloadBtn.scss
  let reloadBtn_default = ".guild_header2.tm-has-reload {\n  display: flex;\n  align-items: center;\n}\n\n.tm-reload-btn {\n  width: 22px;\n  height: 22px;\n  margin-left: 8px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, 0.15);\n  color: rgba(255, 255, 255, 0.75);\n  font-size: 15px;\n  line-height: 1;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition: background 150ms ease, color 150ms ease;\n  flex-shrink: 0;\n}\n\n.tm-reload-btn:hover {\n  background: rgba(255, 255, 255, 0.25);\n  color: #fff;\n}\n\n.tm-reload-btn:active {\n  transform: scale(0.92);\n}";

  // src/components/reloadBtn/reloadBtn.ts
  let reloadBtnStylesInjected = false;
  let injectReloadBtnStyles = /* @__PURE__ */ __name(() => {
    if (reloadBtnStylesInjected) return;
    reloadBtnStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = reloadBtn_default;
    appendStyleElement(style);
  }, "injectReloadBtnStyles");
  let appendReloadBtn = /* @__PURE__ */ __name((header) => {
    injectReloadBtnStyles();
    header.classList.add("tm-has-reload");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tm-reload-btn";
    btn.title = "Обновить страницу";
    btn.innerHTML = "&#x21bb;";
    btn.addEventListener("click", () => location.reload());
    header.appendChild(btn);
  }, "appendReloadBtn");

  // src/pages/cart/cart.ts
  let normalizeCartItemName = /* @__PURE__ */ __name((itemName) => (itemName || "").trim().replace(/\*$/, "").trim().toLowerCase().replace(/\bc\b/g, "с").replace(/\s+/g, " "), "normalizeCartItemName");
  let inferGradeFromCartItemName = /* @__PURE__ */ __name((itemName) => {
    const normalized = normalizeCartItemName(itemName);
    if (!normalized) return null;
    for (let grade = GRADES.length - 1; grade >= 0; grade--) {
      const patterns = GRADES[grade].cartNamePatterns || [];
      if (patterns.some((pattern) => pattern.test(normalized))) return grade;
    }
    return null;
  }, "inferGradeFromCartItemName");
  let CART_GRADE_BY_CAMPAIGN = [
    {
      itemId: [
        45880,
        45881,
        45882,
        45883,
        45884,
        45885,
        45886,
        // эрнардский мнемоник
        45985,
        45986,
        45987,
        45988,
        45989,
        45990,
        45991,
        // смотритель тайных архивов
        45887,
        45888,
        45889,
        45890,
        47047,
        47048,
        47049,
        // заклинатель гримуаров
        47043,
        47044,
        47045,
        47046,
        45891,
        45892,
        45893,
        // укротитель гримуаров
        45894,
        45895,
        45896,
        45897,
        45898,
        45899,
        45900
        // эрнардский архивариус
      ],
      campaign: "Марафон героев, руру",
      grade: 12
    },
    {
      itemId: [34684, 34685],
      // укрепленный аргенитовый кларнет/лютня
      campaign: "Неверинский марафон героев",
      grade: 8
    }
  ];
  let inferGradeFromCartCampaign = /* @__PURE__ */ __name((item, campaign) => {
    const normalizedCampaign = normalizeCartItemName(campaign);
    if (!normalizedCampaign) return null;
    const rule = CART_GRADE_BY_CAMPAIGN.find((entry) => {
      if (!entry.itemId.includes(item.id)) return false;
      const normalizedRuleCampaign = normalizeCartItemName(entry.campaign);
      return normalizedRuleCampaign && normalizedCampaign.includes(normalizedRuleCampaign);
    });
    return rule?.grade ?? null;
  }, "inferGradeFromCartCampaign");
  let stripGradeFromCartItemName = /* @__PURE__ */ __name((itemName) => {
    let normalized = normalizeCartItemName(itemName);
    if (!normalized) return "";
    for (const grade of GRADES) {
      for (const pattern of grade.cartNamePatterns || []) {
        normalized = normalized.replace(pattern, "");
      }
    }
    return normalized.trim();
  }, "stripGradeFromCartItemName");
  let withInferredCartGrade = /* @__PURE__ */ __name((item, itemName, campaign = "") => {
    if (item.grade != null) return item;
    const inferredGrade = inferGradeFromCartItemName(itemName) ?? inferGradeFromCartCampaign(item, campaign);
    return {
      ...item,
      grade: inferredGrade ?? 1,
      ...inferredGrade == null ? {} : { isGradeInferred: true }
    };
  }, "withInferredCartGrade");
  let findItemByName = /* @__PURE__ */ __name((itemName, campaign = "") => {
    const normalized = normalizeCartItemName(itemName);
    const normalizedWithoutGrade = stripGradeFromCartItemName(itemName);
    for (const item of Object.values(ITEMS)) {
      const name = normalizeCartItemName(item.name || "");
      if (name === normalized) return withInferredCartGrade(item, itemName, campaign);
    }
    for (const item of Object.values(ITEMS)) {
      const name = normalizeCartItemName(item.name || "");
      if (name === normalizedWithoutGrade) return withInferredCartGrade(item, itemName, campaign);
    }
    return null;
  }, "findItemByName");
  let parseCartItems = /* @__PURE__ */ __name((layout) => {
    const rows = layout.querySelectorAll(".js-cart-item");
    const items = [];
    for (const row of rows) {
      const checkbox = row.querySelector("input[data-item]");
      if (!checkbox) continue;
      const nameCell = row.querySelector(".js-cart-item-name");
      const title = nameCell?.textContent?.trim() || "";
      const countCell = row.querySelector("td:last-child");
      const countText = (countCell?.textContent?.trim() || "1").replace(/[^\d]/g, "");
      const count = parseInt(countText, 10) || 1;
      const dateCell = row.querySelector("td:first-child");
      const dateStr = dateCell?.textContent?.trim() || "";
      const dp = dateStr.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})$/);
      const date = dp ? new Date(+dp[6], +dp[5] - 1, +dp[4], +dp[1], +dp[2], +dp[3]) : new Date(dateStr);
      const itemId = checkbox.getAttribute("data-item") || "";
      const campaignCell = row.querySelector("td:nth-child(3)");
      let campaign = "";
      let timerText = "";
      if (campaignCell) {
        for (const node of campaignCell.childNodes) {
          if (node === checkbox) continue;
          const t = (node.textContent || "").trim();
          if (!t) continue;
          if (t.startsWith("(") && t.includes("мин.")) {
            timerText = t;
          } else {
            campaign = t;
          }
        }
      }
      const disabled = row.classList.contains("js-disabled");
      items.push({ title, count, date, itemId, campaign, disabled, timerText });
    }
    return items;
  }, "parseCartItems");
  let parseCartCharacters = /* @__PURE__ */ __name((layout) => {
    const labels = layout.querySelectorAll(".char_select label");
    const chars = [];
    for (const label of labels) {
      const radio = label.querySelector('input[name="shard_char"]');
      if (!radio) continue;
      const name = label.querySelector(".name")?.textContent?.trim() || "";
      const server = label.querySelector(".info")?.textContent?.trim() || "";
      const value = radio.value || "";
      const enabled = !radio.disabled;
      if (!enabled) continue;
      chars.push({ name, server, value, enabled });
    }
    return chars;
  }, "parseCartCharacters");
  let makeCartRow = /* @__PURE__ */ __name((cartItem, makeItemIconLink2) => {
    const tr = pageDocument.createElement("tr");
    tr.className = "item";
    if (cartItem.disabled) tr.classList.add("disabled");
    const tdDate = pageDocument.createElement("td");
    tdDate.className = "gс_1";
    const d = cartItem.date;
    const pad = /* @__PURE__ */ __name((n) => n < 10 ? "0" + n : "" + n, "pad");
    tdDate.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    tr.appendChild(tdDate);
    const tdCount = pageDocument.createElement("td");
    tdCount.className = "gс_4";
    tdCount.textContent = cartItem.count > 1 ? `${cartItem.count}×` : "";
    tr.appendChild(tdCount);
    const tdName = pageDocument.createElement("td");
    tdName.className = "gс_2";
    const nameContainer = pageDocument.createElement("div");
    nameContainer.className = "tm-cart-item-name";
    const itemData = findItemByName(cartItem.title, cartItem.campaign);
    if (itemData) {
      const iconEl = makeItemIconLink2({
        item: itemData,
        linked: true,
        size: "small"
      });
      nameContainer.appendChild(iconEl);
    }
    nameContainer.appendChild(pageDocument.createTextNode(cartItem.title));
    tdName.appendChild(nameContainer);
    tr.appendChild(tdName);
    const tdCampaign = pageDocument.createElement("td");
    tdCampaign.className = "gс_3";
    tdCampaign.textContent = cartItem.campaign;
    if (cartItem.disabled && cartItem.timerText) {
      const timer = pageDocument.createElement("span");
      timer.className = "tm-cart-timer";
      timer.textContent = cartItem.timerText;
      tdCampaign.appendChild(timer);
    }
    tr.appendChild(tdCampaign);
    return tr;
  }, "makeCartRow");
  let showCartPopup = /* @__PURE__ */ __name(({ title, body, buttons }) => {
    let src = pageDocument.getElementById("tm_cart_popup_src");
    if (!src) {
      src = pageDocument.createElement("div");
      src.id = "tm_cart_popup_src";
      src.style.display = "none";
      pageDocument.body.appendChild(src);
    }
    src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map(
      (btn, i) => `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
    ).join("")}
                </div>
            </div>`;
    pageWindow.popup_open(false, "tm_cart_popup_src");
    const popupBlock = pageDocument.getElementById("popup_block");
    if (popupBlock) {
      popupBlock.querySelectorAll("a[data-tm-btn]").forEach((a) => {
        const btn = buttons[parseInt(a.dataset.tmBtn || "", 10)];
        a.addEventListener("click", (e) => {
          e.preventDefault();
          pageWindow.popup_close();
          btn.action?.();
        });
      });
    }
  }, "showCartPopup");
  let buildCartUI = /* @__PURE__ */ __name((cartItems, characters, container, origLayout, deps3) => {
    void characters;
    const {
      makeItemIconLink: makeItemIconLink2,
      renderSelectedItems: renderSelectedItemsFn = renderSelectedItems,
      appendReloadBtn: appendReloadBtnFn = appendReloadBtn,
      fetchText: fetchText2,
      getUidFromCheckUser: getUidFromCheckUser2
    } = deps3;
    container.innerHTML = "";
    const layout = pageDocument.createElement("div");
    layout.className = "cart_layout";
    const form = pageDocument.createElement("form");
    form.id = "cart_items_form";
    form.onsubmit = () => false;
    const selectedIds = /* @__PURE__ */ new Set();
    let selectedChar = "";
    const rowMap = /* @__PURE__ */ new Map();
    const left = pageDocument.createElement("div");
    left.className = "cart_left";
    const leftHeader = pageDocument.createElement("div");
    leftHeader.className = "guild_header2 blue";
    leftHeader.textContent = "Список доступных предметов";
    appendReloadBtnFn(leftHeader);
    left.appendChild(leftHeader);
    const tableWrapper = pageDocument.createElement("div");
    tableWrapper.className = "guild_tab_wrapper";
    const table = pageDocument.createElement("table");
    table.className = "guild_tab no_lines cart_items";
    table.cellSpacing = "0";
    table.cellPadding = "0";
    const thead = pageDocument.createElement("thead");
    const headerRow = pageDocument.createElement("tr");
    for (const [cls, text] of [["gh_1", "Дата получения"], ["gh_4", ""], ["gh_2", "Предмет"], ["gh_3", "Акция"]]) {
      const th = pageDocument.createElement("th");
      th.className = cls;
      th.textContent = text;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = pageDocument.createElement("tbody");
    for (const cartItem of cartItems) {
      const tr = makeCartRow(cartItem, makeItemIconLink2);
      rowMap.set(cartItem.itemId, tr);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    left.appendChild(tableWrapper);
    const right = pageDocument.createElement("div");
    right.className = "cart_right";
    const selectedHeader = pageDocument.createElement("div");
    selectedHeader.className = "guild_header2 blue";
    selectedHeader.textContent = "Список выбранных предметов";
    right.appendChild(selectedHeader);
    const selectedOuter = pageDocument.createElement("div");
    selectedOuter.className = "tm-selected-container";
    const selectedWrap = pageDocument.createElement("div");
    selectedWrap.className = "tm-selected-list";
    selectedOuter.appendChild(selectedWrap);
    right.appendChild(selectedOuter);
    const charsHeader = pageDocument.createElement("div");
    charsHeader.className = "guild_header2 blue";
    charsHeader.textContent = "Выберите персонажа";
    right.appendChild(charsHeader);
    const origCharSelect = origLayout.querySelector(".char_select");
    if (origCharSelect) {
      right.appendChild(origCharSelect);
      origCharSelect.querySelectorAll(".js-char").forEach((label) => {
        const radio = label.querySelector('input[name="shard_char"]');
        if (!radio || radio.disabled) return;
        label.addEventListener("click", () => {
          selectedChar = radio.value;
          radio.checked = true;
          updateTransferBtn();
        });
      });
      (async () => {
        try {
          const uid = await getUidFromCheckUser2();
          const html = await fetchText2(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
          const doc = new DOMParser().parseFromString(html, "text/html");
          const faceMap = /* @__PURE__ */ new Map();
          for (const li of doc.querySelectorAll("li[data-face]")) {
            const name = li.querySelector("strong")?.textContent?.trim();
            const face = li.getAttribute("data-face");
            if (name && face) faceMap.set(name, face);
          }
          origCharSelect.querySelectorAll("label.js-char").forEach((label) => {
            const name = label.querySelector(".name")?.textContent?.trim();
            const face = faceMap.get(name);
            if (!face) return;
            const iconDiv = label.querySelector("div");
            if (!iconDiv) return;
            const img = pageDocument.createElement("img");
            img.className = "tm-char-face";
            img.addEventListener("load", () => {
              img.classList.add("tm-char-face--loaded");
              label.classList.add("tm-char-face-ready");
            }, { once: true });
            img.addEventListener("error", () => {
              img.classList.add("tm-char-face--error");
            });
            img.src = face;
            iconDiv.appendChild(img);
          });
        } catch {
        }
      })();
    }
    const transferBtn = pageDocument.createElement("span");
    transferBtn.className = "guild_button1 ico_done";
    transferBtn.innerHTML = "<em></em>Передать";
    transferBtn.style.opacity = "0.5";
    transferBtn.style.pointerEvents = "none";
    right.appendChild(pageDocument.createElement("br"));
    right.appendChild(transferBtn);
    form.appendChild(left);
    form.appendChild(right);
    const clear = pageDocument.createElement("div");
    clear.className = "clear";
    form.appendChild(clear);
    layout.appendChild(form);
    container.appendChild(layout);
    const updateTransferBtn = /* @__PURE__ */ __name(() => {
      const enabled = selectedIds.size > 0 && !!selectedChar;
      transferBtn.style.opacity = enabled ? "" : "0.5";
      transferBtn.style.pointerEvents = enabled ? "" : "none";
    }, "updateTransferBtn");
    const renderSelectedList = /* @__PURE__ */ __name(() => {
      const selectedArray = [...selectedIds].map((id) => cartItems.find((i) => i.itemId === id)).filter((item) => Boolean(item));
      renderSelectedItemsFn(selectedWrap, selectedArray, {
        emptyText: "Выберите предметы для передачи из списка слева",
        onRemove: /* @__PURE__ */ __name((cartItem) => deselectItem(cartItem.itemId), "onRemove"),
        mapItem: /* @__PURE__ */ __name((cartItem) => {
          const itemData = findItemByName(cartItem.title, cartItem.campaign);
          return {
            iconUrl: "",
            name: !itemData && cartItem.count > 1 ? `${cartItem.title} ${cartItem.count}×` : cartItem.title,
            itemBase: itemData || void 0,
            count: cartItem.count
          };
        }, "mapItem")
      }, makeItemIconLink2);
    }, "renderSelectedList");
    const selectItem = /* @__PURE__ */ __name((id) => {
      selectedIds.add(id);
      const row = rowMap.get(id);
      if (row) row.classList.add("tm-selected");
      renderSelectedList();
      updateTransferBtn();
    }, "selectItem");
    const deselectItem = /* @__PURE__ */ __name((id) => {
      selectedIds.delete(id);
      const row = rowMap.get(id);
      if (row) row.classList.remove("tm-selected");
      renderSelectedList();
      updateTransferBtn();
    }, "deselectItem");
    for (const cartItem of cartItems) {
      if (cartItem.disabled) continue;
      const row = rowMap.get(cartItem.itemId);
      if (!row) continue;
      row.addEventListener("click", (e) => {
        if (e.target instanceof Element && e.target.closest("a")) return;
        if (selectedIds.has(cartItem.itemId)) return;
        selectItem(cartItem.itemId);
      });
    }
    transferBtn.addEventListener("click", () => {
      showCartPopup({
        title: "Вы уверены?",
        body: "<p>Предметы будут переданы выбранному персонажу</p>",
        buttons: [
          {
            label: "Передать",
            icon: "ico_done",
            action: /* @__PURE__ */ __name(async () => {
              const allIds = [...selectedIds];
              const chunks = [];
              for (let i = 0; i < allIds.length; i += 5) {
                chunks.push(allIds.slice(i, i + 5));
              }
              const messages = [];
              const transferred = [];
              try {
                for (const chunk of chunks) {
                  const fd = new FormData();
                  for (const id of chunk) {
                    fd.append(`items[${id}]`, "on");
                  }
                  fd.append("shard_char", selectedChar);
                  const res = await fetch("/dynamic/cart/?a=item_process", {
                    method: "POST",
                    body: fd
                  });
                  const json = await res.json();
                  if (json.result === 1) {
                    transferred.push(...chunk);
                    if (json.msg) messages.push(json.msg);
                  } else {
                    showCartPopup({
                      title: "Ошибка",
                      body: `<p>${json.msg || "Неизвестная ошибка"}</p>`,
                      buttons: [{ label: "Ок", icon: "ico_done", action: null }]
                    });
                    break;
                  }
                }
                for (const id of transferred) {
                  const row = rowMap.get(id);
                  if (row) row.remove();
                  rowMap.delete(id);
                  selectedIds.delete(id);
                  const idx = cartItems.findIndex((i) => i.itemId === id);
                  if (idx !== -1) cartItems.splice(idx, 1);
                }
                renderSelectedList();
                updateTransferBtn();
                if (messages.length > 0) {
                  const body = messages.flatMap((m) => m.split("&nbsp;")).filter(Boolean).join("<br/>");
                  showCartPopup({
                    title: "Результат передачи",
                    body: `<p>${body}</p>`,
                    buttons: [{ label: "Ок", icon: "ico_done", action: null }]
                  });
                }
              } catch (e) {
                showCartPopup({
                  title: "Ошибка",
                  body: `<p>Не удалось выполнить запрос: ${e instanceof Error ? e.message : String(e)}</p>`,
                  buttons: [{ label: "Ок", icon: "ico_done", action: null }]
                });
              }
            }, "action")
          },
          { label: "Отмена", icon: "ico_cancel", action: null }
        ]
      });
    });
    renderSelectedList();
  }, "buildCartUI");
  let initCart = /* @__PURE__ */ __name(({
    injectItemIconStyles: injectItemIconStyles2,
    injectSelectedItemsStyles: injectSelectedItemsStyles2,
    injectCartStyles: injectCartStyles2,
    makeItemIconLink: makeItemIconLink2,
    fetchText: fetchText2,
    getUidFromCheckUser: getUidFromCheckUser2
  }) => {
    injectItemIconStyles2();
    injectSelectedItemsStyles2();
    injectCartStyles2();
    injectReloadBtnStyles();
    const cartObserver = new MutationObserver((mutations, obs) => {
      void mutations;
      const layout = pageDocument.querySelector(".cart_layout");
      if (!layout) return;
      obs.disconnect();
      const cartItems = parseCartItems(layout);
      cartItems.sort((a, b) => b.date.getTime() - a.date.getTime());
      const characters = parseCartCharacters(layout);
      const container = pageDocument.getElementById("mr_block_cart");
      if (!container) return;
      buildCartUI(cartItems, characters, container, layout, {
        makeItemIconLink: makeItemIconLink2,
        renderSelectedItems,
        appendReloadBtn,
        fetchText: fetchText2,
        getUidFromCheckUser: getUidFromCheckUser2
      });
    });
    const startCartObserver = /* @__PURE__ */ __name(() => {
      cartObserver.observe(pageDocument.body, { childList: true, subtree: true });
    }, "startCartObserver");
    if (pageDocument.body) startCartObserver();
    else pageDocument.addEventListener("DOMContentLoaded", startCartObserver);
  }, "initCart");

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/pages/itemRestore/itemRestore.scss
  let itemRestore_default = "#block_content {\n  overflow: unset;\n}\n\n.itemrestore__panel-left {\n  min-height: 615px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.itemrestore__table-wrapper {\n  min-height: unset;\n  margin-bottom: auto;\n}\n\n.itemrestore__panel-right {\n  position: sticky;\n  top: 0;\n  align-self: flex-start;\n}\n\n.itemrestore__table tr:last-child td {\n  border-bottom: 0;\n}\n\n.itemrestore__table .n2 {\n  width: 0%;\n}\n\n.itemrestore__table .n4 {\n  white-space: nowrap;\n  width: 0%;\n  text-align: right;\n  min-width: 24px;\n}\n\n.itemrestore__table .n5,\n.itemrestore__table .n6 {\n  width: 0%;\n}\n\n.tm-server-name {\n  color: #999;\n  font-size: 0.85em;\n}\n\n.tm-sortable {\n  cursor: pointer;\n  user-select: none;\n  white-space: nowrap;\n}\n\n.tm-table-footer {\n  position: sticky;\n  bottom: 0;\n  background: #fff;\n  padding: 10px;\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 12px;\n  border: 1px solid #e1e1e1;\n  border-radius: 8px;\n}\n\n.itemrestore__pagintation {\n  margin: 0;\n}\n\n.itemrestore__pagintation,\n.itemrestore__pagintation-pages {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.itemrestore__pagintation-btn,\n.itemrestore__pagintation-page,\n.itemrestore__pagintation-ellipsis {\n  min-width: 22px;\n  height: 22px;\n  line-height: 22px;\n  text-align: center;\n  user-select: none;\n}\n\n.itemrestore__pagintation-ellipsis {\n  color: #777;\n}";

  // src/pages/itemRestore/itemRestore.ts
  let IR_URL = {
    grades: "/dynamic/itemrestore/index.php?a=get_item_grades",
    info: "/dynamic/itemrestore/index.php?a=get_restore_info",
    items: "/dynamic/itemrestore/index.php?a=get_user_items",
    restore: "/dynamic/itemrestore/index.php?a=post_restore_items"
  };
  let showItemRestorePopup = /* @__PURE__ */ __name(({ title, body, buttons }) => {
    let src = document.getElementById("tm_ir_popup_src");
    if (!src) {
      src = document.createElement("div");
      src.id = "tm_ir_popup_src";
      src.style.display = "none";
      document.body.appendChild(src);
    }
    src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map(
      (btn, i) => `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
    ).join("")}
                </div>
            </div>`;
    pageWindow.popup_open(false, "tm_ir_popup_src");
    const popupBlock = document.getElementById("popup_block");
    if (popupBlock) {
      popupBlock.querySelectorAll("a[data-tm-btn]").forEach((a) => {
        const btn = buttons[parseInt(a.dataset.tmBtn || "", 10)];
        a.addEventListener("click", (e) => {
          e.preventDefault();
          pageWindow.popup_close();
          btn.action?.();
        });
      });
    }
  }, "showItemRestorePopup");
  let buildItemRestoreUI = /* @__PURE__ */ __name((container, grades, info, items, { makeItemIconLink: makeItemIconLink2 }) => {
    const allItems = items.map((item) => ({ ...item, selected: false }));
    const selectedItems = [];
    let restoredItems = info.restoredByeLastMonth || 0;
    const recoveryLimit = 10;
    const savedPerPage = parseInt(localStorage.getItem("tm_aa_ir_per_page") || "", 10);
    let itemsPerPage = [10, 20, 30].includes(savedPerPage) ? savedPerPage : savedPerPage === 0 ? 0 : 10;
    let filterGrade = -1;
    let findString = "";
    let activePage = 1;
    let sortAsc = false;
    const mapGrade = /* @__PURE__ */ __name((apiGrade) => {
      const gradeName = getGradeName(apiGrade);
      if (gradeName !== "-") {
        const idx = GRADES.findIndex((g) => g.title === gradeName);
        if (idx !== -1) return idx;
      }
      return parseInt(apiGrade) || 0;
    }, "mapGrade");
    const toItemBase = /* @__PURE__ */ __name((item) => {
      const known = ITEMS[item.type];
      const apiGrade = item.grade != null ? mapGrade(item.grade) : null;
      const inferredGrade = inferGradeFromCartItemName(item.gi_name || known?.name || "");
      const grade = known?.grade ?? apiGrade ?? inferredGrade ?? 1;
      const isGradeInferred = known?.grade == null && apiGrade == null && inferredGrade != null;
      return {
        id: String(item.type || ""),
        icon: item.iconurl || "",
        name: item.gi_name || "",
        description: item.gi_description || "",
        ...known,
        ...item.iconurl ? { icon: item.iconurl } : {},
        ...item.gi_name ? { name: item.gi_name } : {},
        ...item.gi_description ? { description: item.gi_description } : {},
        grade,
        ...isGradeInferred ? { isGradeInferred: true } : {}
      };
    }, "toItemBase");
    const addZero = /* @__PURE__ */ __name((n) => n < 10 ? "0" + n : "" + n, "addZero");
    const formatDate = /* @__PURE__ */ __name((ts) => {
      const dt = new Date(ts);
      return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    }, "formatDate");
    const formatDateTime = /* @__PURE__ */ __name((ts) => {
      const dt = new Date(ts);
      return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()} ${addZero(dt.getHours())}:${addZero(dt.getMinutes())}`;
    }, "formatDateTime");
    const formatDateTimeFull = /* @__PURE__ */ __name((ts) => {
      const dt = new Date(ts);
      return `${addZero(dt.getHours())}:${addZero(dt.getMinutes())}:${addZero(dt.getSeconds())} ${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    }, "formatDateTimeFull");
    const getExpireTime = /* @__PURE__ */ __name((dateStr) => {
      const expire = Date.parse(dateStr);
      const now = Date.now();
      const hoursAll = (expire - now) / (1e3 * 60 * 60);
      const days = Math.floor(hoursAll / 24);
      const hours = Math.round(hoursAll - days * 24);
      return `${days} д. ${hours} ч.`;
    }, "getExpireTime");
    const getGradeName = /* @__PURE__ */ __name((id) => {
      const g = grades.find((v) => String(v.id) === String(id));
      return g ? g.name : "-";
    }, "getGradeName");
    const getFilteredItems = /* @__PURE__ */ __name(() => {
      const filtered = allItems.filter((v) => {
        const gradeOk = filterGrade === -1 || String(v.grade) === String(filterGrade);
        const nameOk = !findString || v.gi_name && v.gi_name.toLowerCase().includes(findString.toLowerCase());
        return gradeOk && nameOk;
      });
      const dir = sortAsc ? 1 : -1;
      filtered.sort((a, b) => dir * ((a.deleted || "") > (b.deleted || "") ? 1 : (a.deleted || "") < (b.deleted || "") ? -1 : 0));
      return filtered;
    }, "getFilteredItems");
    const getPageItems = /* @__PURE__ */ __name(() => {
      const filtered = getFilteredItems();
      if (!itemsPerPage) return filtered;
      const start = (activePage - 1) * itemsPerPage;
      const end = Math.min(start + itemsPerPage, filtered.length);
      return filtered.slice(start, end);
    }, "getPageItems");
    const getPagesCount = /* @__PURE__ */ __name(() => itemsPerPage ? Math.ceil(getFilteredItems().length / itemsPerPage) : 1, "getPagesCount");
    const section = document.createElement("section");
    const filterDiv = document.createElement("div");
    filterDiv.className = "itemrestore__filter";
    const gradeTitle = document.createElement("div");
    gradeTitle.className = "itemrestore__filter-title";
    gradeTitle.textContent = "Качество";
    filterDiv.appendChild(gradeTitle);
    const gradeOptions = [{ value: -1, label: "Не выбрано" }, ...grades.map((g) => ({ value: g.id, label: g.name }))];
    const gradeSelectWrapper = makeSelect({
      options: gradeOptions,
      selected: filterGrade,
      onChange: /* @__PURE__ */ __name((val) => {
        filterGrade = parseInt(val, 10);
        activePage = 1;
        renderTable();
      }, "onChange")
    });
    filterDiv.appendChild(gradeSelectWrapper);
    const gradeReset = document.createElement("div");
    gradeReset.className = "itemrestore__grades-reset";
    filterDiv.appendChild(gradeReset);
    const nameTitle = document.createElement("div");
    nameTitle.className = "itemrestore__filter-title";
    nameTitle.textContent = "Название";
    filterDiv.appendChild(nameTitle);
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "itemrestore__input-wrapper";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "itemrestore__filter-name";
    inputWrapper.appendChild(nameInput);
    filterDiv.appendChild(inputWrapper);
    const searchBtn = document.createElement("div");
    searchBtn.className = "itemrestore__search-btn";
    const searchSpan = document.createElement("span");
    searchSpan.textContent = " Искать";
    searchBtn.appendChild(searchSpan);
    filterDiv.appendChild(searchBtn);
    section.appendChild(filterDiv);
    const panelWrapper = document.createElement("div");
    panelWrapper.className = "itemrestore__panel-wrapper";
    const panel = document.createElement("div");
    panel.className = "itemrestore__panel";
    const panelLeft = document.createElement("div");
    panelLeft.className = "itemrestore__panel-left";
    const leftTitle = document.createElement("div");
    leftTitle.className = "guild_header2 green";
    leftTitle.textContent = "Удалённые предметы";
    appendReloadBtn(leftTitle);
    panelLeft.appendChild(leftTitle);
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "itemrestore__table-wrapper";
    const table = document.createElement("table");
    table.className = "itemrestore__table";
    table.cellSpacing = "0";
    table.cellPadding = "0";
    const headerRow = document.createElement("tr");
    headerRow.className = "itemrestore__table-header";
    const headers = [
      { cls: "n4", text: "" },
      { cls: "n1", text: "Наименование" },
      { cls: "n5", text: "До удаления" },
      { cls: "n6", text: "Персонаж" }
    ];
    const thDate = document.createElement("th");
    thDate.className = "n2 tm-sortable";
    const thDateText = document.createElement("span");
    thDateText.textContent = "Удалён";
    const thDateArrow = document.createElement("span");
    thDateArrow.className = "tm-sort-arrow";
    thDateArrow.textContent = sortAsc ? " ▲" : " ▼";
    thDate.appendChild(thDateText);
    thDate.appendChild(thDateArrow);
    thDate.addEventListener("click", () => {
      sortAsc = !sortAsc;
      thDateArrow.textContent = sortAsc ? " ▲" : " ▼";
      activePage = 1;
      renderTable();
    });
    headerRow.appendChild(thDate);
    for (const h of headers) {
      const th = document.createElement("th");
      if (h.cls) th.className = h.cls;
      th.textContent = h.text;
      headerRow.appendChild(th);
    }
    const tbody = document.createElement("tbody");
    tbody.appendChild(headerRow);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    panelLeft.appendChild(tableWrapper);
    const tableFooter = document.createElement("div");
    tableFooter.className = "tm-table-footer";
    const pagination = document.createElement("div");
    pagination.className = "itemrestore__pagintation";
    tableFooter.appendChild(pagination);
    const perPageWrap = makeSelect({
      options: [{ value: 10, label: "10" }, { value: 20, label: "20" }, { value: 30, label: "30" }, { value: 0, label: "Все" }],
      selected: itemsPerPage,
      onChange: /* @__PURE__ */ __name((val) => {
        itemsPerPage = parseInt(val, 10);
        localStorage.setItem("tm_aa_ir_per_page", String(itemsPerPage));
        activePage = 1;
        renderTable();
      }, "onChange")
    });
    tableFooter.appendChild(perPageWrap);
    panelLeft.appendChild(tableFooter);
    panel.appendChild(panelLeft);
    const panelRight = document.createElement("div");
    panelRight.className = "itemrestore__panel-right";
    const rightTitle = document.createElement("div");
    rightTitle.className = "guild_header2 green";
    rightTitle.textContent = "Список выбранных предметов";
    panelRight.appendChild(rightTitle);
    const selectedContainer = document.createElement("div");
    selectedContainer.className = "tm-selected-container";
    const selectedList = document.createElement("div");
    selectedList.className = "tm-selected-list";
    selectedContainer.appendChild(selectedList);
    panelRight.appendChild(selectedContainer);
    const restoreBtn = document.createElement("div");
    restoreBtn.className = "itemrestore-recovery_btn";
    const restoreBtnSpan = document.createElement("span");
    restoreBtnSpan.textContent = "Восстановить";
    restoreBtn.appendChild(restoreBtnSpan);
    panelRight.appendChild(restoreBtn);
    panel.appendChild(panelRight);
    panelWrapper.appendChild(panel);
    section.appendChild(panelWrapper);
    const infoRestoredP = document.createElement("p");
    const infoDateP = document.createElement("p");
    section.appendChild(infoRestoredP);
    section.appendChild(infoDateP);
    const updateInfoText = /* @__PURE__ */ __name(() => {
      infoRestoredP.textContent = `За последний календарный месяц восстановлено предметов: ${restoredItems} из ${recoveryLimit} возможных.`;
      infoDateP.textContent = info.lastRestored_at ? `Последнее восстановление: ${formatDateTime(info.lastRestored_at * 1e3)}` : "";
    }, "updateInfoText");
    updateInfoText();
    container.appendChild(section);
    const renderTable = /* @__PURE__ */ __name(() => {
      const pageItems = getPageItems();
      while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);
      for (const item of pageItems) {
        const tr = document.createElement("tr");
        if (item.selected) tr.className = "selected";
        const tdDate = document.createElement("td");
        tdDate.className = "n2";
        tdDate.textContent = item.deleted ? formatDateTimeFull(Date.parse(item.deleted)) : "";
        tr.appendChild(tdDate);
        const tdCount = document.createElement("td");
        tdCount.className = "n4";
        tdCount.textContent = parseInt(item.stack) > 1 ? `${item.stack}×` : "";
        tr.appendChild(tdCount);
        const tdName = document.createElement("td");
        tdName.className = "n1";
        const nameWrap = document.createElement("div");
        nameWrap.className = "tm-cart-item-name";
        const itemBase = toItemBase(item);
        nameWrap.appendChild(makeItemIconLink2({
          item: itemBase,
          linked: true,
          size: "small"
        }));
        const nameText = document.createElement("span");
        nameText.textContent = item.gi_name || itemBase.name || "";
        if (item.color) {
          nameText.style.color = `#${item.color}`;
        } else if (itemBase.grade) {
          nameText.style.color = GRADES[itemBase.grade].color;
        }
        nameWrap.appendChild(nameText);
        tdName.appendChild(nameWrap);
        tr.appendChild(tdName);
        const tdExpire = document.createElement("td");
        tdExpire.className = "n5";
        tdExpire.textContent = item.expire ? getExpireTime(item.expire) : "";
        tr.appendChild(tdExpire);
        const tdChar = document.createElement("td");
        tdChar.className = "n6";
        const serverName = SERVERS[item.shard_id] || "";
        tdChar.appendChild(document.createTextNode(item.name || ""));
        if (serverName) {
          const serverSpan = document.createElement("span");
          serverSpan.className = "tm-server-name";
          serverSpan.textContent = ` (${serverName})`;
          tdChar.appendChild(serverSpan);
        }
        tr.appendChild(tdChar);
        tr.addEventListener("click", () => {
          if (!item.selected) {
            selectItem(item);
          }
        });
        tbody.appendChild(tr);
      }
      renderPagination();
    }, "renderTable");
    const renderPagination = /* @__PURE__ */ __name(() => {
      pagination.innerHTML = "";
      const pagesCount = getPagesCount();
      if (pagesCount > 1) {
        const makeNavButton = /* @__PURE__ */ __name((className, label, title, isActive, onClick) => {
          const btn = document.createElement("div");
          btn.className = "itemrestore__pagintation-btn " + className + (isActive ? " active" : "");
          btn.textContent = label;
          btn.title = title;
          btn.addEventListener("click", onClick);
          return btn;
        }, "makeNavButton");
        const makeEllipsis = /* @__PURE__ */ __name(() => {
          const ellipsis = document.createElement("div");
          ellipsis.className = "itemrestore__pagintation-ellipsis";
          ellipsis.textContent = "...";
          return ellipsis;
        }, "makeEllipsis");
        const btnFirst = document.createElement("div");
        btnFirst.className = "itemrestore__pagintation-btn first" + (activePage > 1 ? " active" : "");
        btnFirst.textContent = "«";
        btnFirst.title = "Первая страница";
        btnFirst.addEventListener("click", () => {
          if (activePage > 1) {
            activePage = 1;
            renderTable();
          }
        });
        pagination.appendChild(btnFirst);
        const btnPrev = document.createElement("div");
        btnPrev.className = "itemrestore__pagintation-btn prev" + (activePage > 1 ? " active" : "");
        btnPrev.textContent = "‹";
        btnPrev.title = "Предыдущая страница";
        btnPrev.addEventListener("click", () => {
          if (activePage > 1) {
            activePage--;
            renderTable();
          }
        });
        pagination.appendChild(btnPrev);
        const pagesDiv = document.createElement("div");
        pagesDiv.className = "itemrestore__pagintation-pages";
        const maxVisiblePages = 9;
        let start = Math.max(1, activePage - 4);
        let end = Math.min(pagesCount, activePage + 4);
        if (end - start + 1 < maxVisiblePages) {
          if (start === 1) {
            end = Math.min(pagesCount, start + maxVisiblePages - 1);
          } else if (end === pagesCount) {
            start = Math.max(1, end - maxVisiblePages + 1);
          }
        }
        if (start > 1) pagesDiv.appendChild(makeEllipsis());
        for (let i = start; i <= end; i++) {
          const page = document.createElement("div");
          page.className = "itemrestore__pagintation-page" + (i === activePage ? " active" : "");
          page.textContent = i;
          const pageNum = i;
          page.addEventListener("click", () => {
            activePage = pageNum;
            renderTable();
          });
          pagesDiv.appendChild(page);
        }
        if (end < pagesCount) pagesDiv.appendChild(makeEllipsis());
        pagination.appendChild(pagesDiv);
        const btnNext = makeNavButton(
          "next",
          "›",
          "Следующая страница",
          activePage < pagesCount,
          () => {
            if (activePage < pagesCount) {
              activePage++;
              renderTable();
            }
          }
        );
        pagination.appendChild(btnNext);
        const btnLast = makeNavButton(
          "last",
          "»",
          "Последняя страница",
          activePage < pagesCount,
          () => {
            if (activePage < pagesCount) {
              activePage = pagesCount;
              renderTable();
            }
          }
        );
        pagination.appendChild(btnLast);
      }
    }, "renderPagination");
    const renderSelected = /* @__PURE__ */ __name(() => {
      renderSelectedItems(selectedList, selectedItems, {
        emptyText: "Выберите предметы для восстановления из списка слева",
        onRemove: /* @__PURE__ */ __name((item) => deselectItem(item), "onRemove"),
        mapItem: /* @__PURE__ */ __name((item) => ({
          iconUrl: item.iconurl || "",
          name: item.gi_name || "",
          itemBase: toItemBase(item)
        }), "mapItem")
      });
      restoreBtn.classList.toggle("active", selectedItems.length > 0);
    }, "renderSelected");
    const selectItem = /* @__PURE__ */ __name((item) => {
      if (item.selected) return;
      if (restoredItems >= recoveryLimit) {
        showItemRestorePopup({
          title: "Внимание",
          body: "<p>Достигнут лимит восстановления предметов за текущий месяц.</p>",
          buttons: [{ label: "Ок", icon: "ico_done", action: null }]
        });
        return;
      }
      if (selectedItems.length + restoredItems >= recoveryLimit) {
        showItemRestorePopup({
          title: "Внимание",
          body: "<p>Выбранное количество предметов превышает лимит восстановления.</p>",
          buttons: [{ label: "Ок", icon: "ico_done", action: null }]
        });
        return;
      }
      item.selected = true;
      selectedItems.push(item);
      renderTable();
      renderSelected();
    }, "selectItem");
    const deselectItem = /* @__PURE__ */ __name((item) => {
      if (!item.selected) return;
      item.selected = false;
      const idx = selectedItems.indexOf(item);
      if (idx !== -1) selectedItems.splice(idx, 1);
      renderTable();
      renderSelected();
    }, "deselectItem");
    const restoreItems = /* @__PURE__ */ __name(() => {
      if (selectedItems.length === 0) return;
      showItemRestorePopup({
        title: "Восстановление предметов",
        body: `<p>Восстановить выбранные предметы (${selectedItems.length} шт.)?</p>`,
        buttons: [
          {
            label: "Восстановить",
            icon: "ico_done",
            action: /* @__PURE__ */ __name(async () => {
              const ids = selectedItems.map((v) => v.itemid);
              try {
                const res = await fetch(IR_URL.restore, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(ids)
                });
                const json = await res.json();
                if (json && json.success) {
                  let successCount = 0;
                  const results = json.data || {};
                  for (const [id, result] of Object.entries(results)) {
                    if (result.status === "ok") {
                      const allIdx = allItems.findIndex((v) => v.itemid == id);
                      if (allIdx !== -1) allItems.splice(allIdx, 1);
                      const selIdx = selectedItems.findIndex((v) => v.itemid == id);
                      if (selIdx !== -1) selectedItems.splice(selIdx, 1);
                      if (allIdx !== -1 && selIdx !== -1) successCount++;
                    }
                  }
                  restoredItems += successCount;
                  activePage = 1;
                  updateInfoText();
                  renderTable();
                  renderSelected();
                  const resultLines = Object.entries(results).map(([id, r]) => {
                    const item = items.find((v) => v.itemid == id);
                    const name = item ? item.gi_name : id;
                    return `${name}: ${r.status === "ok" ? "восстановлен" : "ошибка"}`;
                  });
                  showItemRestorePopup({
                    title: "Результат",
                    body: `<p>${resultLines.join("<br>")}</p>`,
                    buttons: [{ label: "Ок", icon: "ico_done", action: null }]
                  });
                } else if (json.error) {
                  showItemRestorePopup({
                    title: "Ошибка",
                    body: `<p>${json.error}</p>`,
                    buttons: [{ label: "Ок", icon: "ico_done", action: null }]
                  });
                }
              } catch (e) {
                showItemRestorePopup({
                  title: "Ошибка",
                  body: `<p>Ошибка сети: ${e instanceof Error ? e.message : String(e)}</p>`,
                  buttons: [{ label: "Ок", icon: "ico_done", action: null }]
                });
              }
            }, "action")
          },
          { label: "Отмена", icon: "", action: null }
        ]
      });
    }, "restoreItems");
    gradeReset.addEventListener("click", () => {
      if (filterGrade !== -1) activePage = 1;
      filterGrade = -1;
      gradeSelectWrapper.querySelector("select").value = "-1";
      renderTable();
    });
    searchBtn.addEventListener("click", () => {
      findString = nameInput.value.trim();
      activePage = 1;
      renderTable();
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        findString = nameInput.value.trim();
        activePage = 1;
        renderTable();
      }
    });
    restoreBtn.addEventListener("click", restoreItems);
    renderTable();
    renderSelected();
  }, "buildItemRestoreUI");
  let injectItemRestoreStyles = /* @__PURE__ */ __name(() => {
    const style = document.createElement("style");
    style.textContent = itemRestore_default;
    appendStyleElement(style);
  }, "injectItemRestoreStyles");
  let initItemRestore = /* @__PURE__ */ __name(({ injectItemIconStyles: injectItemIconStyles2, injectSelectedItemsStyles: injectSelectedItemsStyles2, makeItemIconLink: makeItemIconLink2 }) => {
    injectItemIconStyles2();
    injectSelectedItemsStyles2();
    injectItemRestoreStyles();
    const intercepted = { grades: null, info: null, items: null };
    let interceptedCount = 0;
    const tryBuild = /* @__PURE__ */ __name(() => {
      const app = document.getElementById("app_itemrestore");
      if (!app) return;
      const grades = intercepted.grades?.data || [];
      const info = intercepted.info?.data || {};
      const items = [];
      if (intercepted.items?.data) {
        Object.values(intercepted.items.data).forEach(
          (server) => Object.values(server).forEach((item) => items.push(item))
        );
      }
      app.className = "";
      app.innerHTML = "";
      buildItemRestoreUI(app, grades, info, items, { makeItemIconLink: makeItemIconLink2 });
    }, "tryBuild");
    if (onIrData) {
      onIrData((data) => {
        intercepted.grades = data.grades;
        intercepted.info = data.info;
        intercepted.items = data.items;
        tryBuild();
      });
      return;
    }
    const origFetch = pageWindow.fetch.bind(pageWindow);
    pageWindow.fetch = async (...args) => {
      const res = await origFetch(...args);
      const urlStr = typeof args[0] === "string" ? args[0] : String(args[0]?.url || args[0]);
      if (urlStr.includes("a=get_item_grades")) {
        intercepted.grades = await res.clone().json();
        interceptedCount++;
      } else if (urlStr.includes("a=get_restore_info")) {
        intercepted.info = await res.clone().json();
        interceptedCount++;
      } else if (urlStr.includes("a=get_user_items")) {
        intercepted.items = await res.clone().json();
        interceptedCount++;
      }
      if (interceptedCount >= 3) {
        interceptedCount = -1;
        tryBuild();
      }
      return res;
    };
  }, "initItemRestore");

  // src/data/quests.ts
  let CODEX_BASE = "https://archeagecodex.com/ru/quest/";
  let ICON_QUEST = "https://archeagecodex.com/images/icon_quest_common.png";
  let ICON_VEKSEL = "https://aa.cdn.gmru.net/ms/data/game-icons/e046763d68cd5d1b2dbd5513fc845e07.png";
  let ICON_VEKSEL_NORTH = "https://aa.cdn.gmru.net/ms/data/game-icons/6a0ac94699b0c4d678470feb07f3fa85.png";
  let ICON_GISAA_OVERLAY = "https://gisaa.ru/img/gisaa.svg?v=1";
  let VEKSEL_BASE = "https://gisaa.ru/veksel/";
  let QUESTS = [
    { marathonId: [8246], id: 10559, title: "Чужие коконы", short: "Ифнир (Каменные крылья) - 10 коконов" },
    { marathonId: [8248, 8804], id: 9142, title: "Плотницкая нужда", short: "", veksel: "blue_salt", slot: { item: ITEMS[8337], count: 60 } },
    { marathonId: [8250, 8806], id: 9318, title: "Дети Ольха", short: 'Квест на Взрослого ольхона (портал "Укромный утес")' },
    { marathonId: [8252, 8808], id: 10512, title: "Котомки эфенского странника I", short: "", veksel: "north", locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43176], count: 20 } },
    { marathonId: [8254, 8810], id: 10513, title: "Котомки эфенского странника II", short: "", veksel: "north", locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43176], count: 60 } },
    { marathonId: [8256, 8812], id: 9100, title: "Старый враг", short: "Библа, 2-ой босс" },
    { marathonId: [8258, 8814], id: 7658, title: "Требуется экзорцист (героич.)", short: "" },
    { marathonId: [8260, 8816], id: 6797, title: "Опасность для моряков", short: "15 жуков/медуз в море (не забыть сдать)" },
    { marathonId: [8262, 8818], id: 8998, title: "Бесконечный бой", short: "" },
    { marathonId: [8268, 8824], id: 5972, title: "И на дару бывает прору...", short: "Чешуя Ашьяры, Кольцо Лореи, Кольцо Гленна" },
    { marathonId: [8274, 8830], id: 10480, title: "Состязание союзов в Академии", short: "" },
    { marathonId: [8282, 8838], id: 7154, title: "Темница Дауты", short: "" },
    { marathonId: [8284, 8840], id: 9137, title: "Железо для корабелов", short: "", veksel: "blue_salt", slot: { item: ITEMS[8318], count: 60 } },
    { marathonId: [8286, 8842], id: 8000131, title: "Вдали от обезумевшего мира", short: "Квест Нуи на 500 очков работы" },
    { marathonId: [8288, 8844], id: 10508, title: "Расшитые жемчугом кошельки I", short: "", veksel: "north", locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[40928], count: 25 } },
    { marathonId: [8290, 8846], id: 10509, title: "Расшитые жемчугом кошельки II", short: "", veksel: "north", locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[40928], count: 75 } },
    { marathonId: [8292, 8848], id: 5092, title: "Отличные фитили", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#porychenie" target="_blank">Парфюмер на востоке</a>` },
    { marathonId: [8294, 8850], id: 7659, title: "Требуются работники (героич.)", short: "" },
    { marathonId: [8296, 8852], id: 7817, title: "Опасности окольных дорог", short: "" },
    { marathonId: [8298, 8854], id: 8000058, title: "Лицензия на убийство: Баррага Безумный", short: "Нагашар (только обычка)", slot: { item: ITEMS[8000749] } },
    { marathonId: [8300, 8856], id: 5971, title: "Чешуя Ашьяры", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8314, 8870], id: 10564, title: "Освобожденные узницы Нагашара", short: "Ифнир - змея", schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }] },
    { marathonId: [8316, 8872], id: 8000061, title: "Лицензия на убийство: Иштар", short: "Сады наслаждений (только хард)", slot: { item: ITEMS[8000752] } },
    { marathonId: [8318, 8874], id: 9317, title: "Охота на крупную дичь", short: 'Квест на Космача (портал "Зимний Очаг")' },
    { marathonId: [8320, 8876], id: 9152, title: "Книжные обложки", short: "", veksel: "blue_salt", slot: { item: ITEMS[16327], count: 60 } },
    { marathonId: [8322, 8878], id: 8435, title: "Чистота и порядок", short: 'Портал "Лягушачьи пруды"' },
    { marathonId: [8324, 8880], id: 10510, title: "Фермерские сундучки со всякой всячиной I", short: "", veksel: "north", locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[42077], count: 8 } },
    { marathonId: [8326, 8882], id: 10511, title: "Фермерские сундучки со всякой всячиной II", short: "", veksel: "north", locations: ["Бездна", "Солнечные поля"], slot: { item: ITEMS[42077], count: 25 } },
    { marathonId: [8328, 8884], id: 7657, title: "Разыскивается: О'Карф (героич.)", short: "" },
    { marathonId: [8330, 8886], id: 7813, title: "Преграда на пути", short: "" },
    { marathonId: [8336, 8892], id: 5144, title: "Разгром призрачного легиона", short: "Призрачный (ночной) разлом", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
    { marathonId: [8338, 8894], id: 5885, title: "Советник Кириоса", short: "Анталлон на Солнечных полях", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
    { marathonId: [8340, 8896], id: 8000060, title: "Лицензия на убийство: иферийцы (низк., обычн.)", short: "Сады наслаждений (изи или нормал)", slot: { item: ITEMS[8000751] } },
    { marathonId: [8346, 8902], id: 10056, title: "Садовые работы**", short: "Квест можно взять в любое время, боссы:", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }] },
    { marathonId: [8348, 8904], id: 11154, title: "Бой с тенью", short: "Лиловый (армия фантомов)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }] },
    { marathonId: [8350, 8906], id: 11227, title: "Билет в один конец", short: 'Превратиться в <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="Перевоплощение в дару" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>дару, получить и использовать <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="Разрешение на работу: билет в один конец" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, потратить 500 ОР (идти в данж не надо)' },
    { marathonId: [8352, 8908], id: 9147, title: "С миру по нитке", short: "", veksel: "blue_salt", slot: { item: ITEMS[8256], count: 60 } },
    { marathonId: [8354, 8910], id: 8000136, title: "В гармонии с собой", short: "Квест Нуи на 2500 ремесленки" },
    { marathonId: [8356, 8912], id: 10506, title: "Резные сундучки со всякой всячиной I", short: "", veksel: "north", locations: ["Замок Ош"], slot: { item: ITEMS[42076], count: 10 } },
    { marathonId: [8358, 8914], id: 10507, title: "Резные сундучки со всякой всячиной II", short: "", veksel: "north", locations: ["Замок Ош"], slot: { item: ITEMS[42076], count: 30 } },
    { marathonId: [8360, 8916], id: 5091, title: "Взрывоопасное поручение", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#porychenie" target="_blank">Парфюмер на западе</a>` },
    { marathonId: [8362, 8918], id: 9101, title: "Неприступная башня", short: "Библа, 3-ий босс" },
    { marathonId: [8364, 8920], id: 7656, title: "Разыскивается: Акмит (героич.)", short: "" },
    { marathonId: [8366, 8922], id: 9320, title: "Война во имя славы союза", short: "" },
    { marathonId: [8372, 8928], id: 9297, title: "Орды Земель покоя", short: "", availableWeekdays: [6] },
    { marathonId: [8380, 8936], id: 7815, title: "Три новости, и все плохие", short: "Изи/нормал Сады наслаждений" },
    { marathonId: [8382, 8938], id: 10735, title: "Предводитель демонов", short: "Эншака на Солнечных полях", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
    { marathonId: [8388, 8944], id: 9153, title: "Ремесленная одежда", short: "", veksel: "blue_salt", slot: { item: ITEMS[16327], count: 100 } },
    { marathonId: [8390, 8946], id: 5062, title: "Бей мандрагору!", short: "" },
    { marathonId: [8392, 8948], id: 10514, title: "Эфенские сундучки со всякой всячиной I", short: "", veksel: "north", locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43177], count: 7 } },
    { marathonId: [8394, 8950], id: 10515, title: "Эфенские сундучки со всякой всячиной II", short: "", veksel: "north", locations: ["Бухта Китобоев", "Эфен'Хал"], slot: { item: ITEMS[43177], count: 20 } },
    { marathonId: [8396, 8952], id: 7155, title: "Откровение Бездны", short: "Нагашар обычка" },
    { marathonId: [8398, 8954], id: 9398, title: "Состязание союзов", short: "100 мобов на Пустоши Корвуса" },
    { marathonId: [8400, 8956], id: 7152, title: "Мемориальная доска (гер.)", short: "" },
    { marathonId: [8402, 8958], id: 9102, title: "Стокнижное чудище", short: "Библа, голем" },
    { marathonId: [8404], id: 9205, title: "Последний день Ирамканда", short: "", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }] },
    { marathonId: [8414, 8972], id: 10952, title: "Бой с «Летучим харнийцем»", short: "" },
    { marathonId: [8422, 8980], id: 10304, title: "Тайны святилища", short: "" },
    { marathonId: [8424, 8982], id: 9099, title: "Обитель архивариуса", short: "Библа, первый босс" },
    { marathonId: [8426, 8984], id: 9143, title: "Раз трактир, два трактир", short: "", veksel: "blue_salt", slot: { item: ITEMS[8337], count: 100 } },
    { marathonId: [8434, 8992], id: 10504, title: "Полновесные мешочки с серебром I", short: "", veksel: "north", locations: ["Замок Ош"], slot: { item: ITEMS[35461], count: 30 } },
    { marathonId: [8436, 8994], id: 10505, title: "Полновесные мешочки с серебром II", short: "", veksel: "north", locations: ["Замок Ош"], slot: { item: ITEMS[35461], count: 90 } },
    { marathonId: [8438, 8996], id: 8000062, title: "Лицензия на убийство: повелитель подземелья (героич.)", short: "Аль-Харба / Ферма / Колыбель / Воющая Бездна / Копи / Арсенал", slot: { item: ITEMS[8000753] } },
    { marathonId: [8448, 9006], id: 2943, title: "Элитные войска Кровавой армии", short: "Кровавый (дневной) разлом - 3-я волна", schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }] },
    { marathonId: [8450, 9008], id: 7935, title: "Хранитель Звенящего ущелья**", short: "Гардум", schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }] },
    { marathonId: [8452, 9010], id: 7660, title: "Герой с крепким рассудком (героич.)", short: "" },
    { marathonId: [8470, 9028], id: 10739, title: "Призрачный предводитель", short: "Призрачный (ночной) разлом - Эншака", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
    { marathonId: [8478, 9030], id: 10423, title: "Голиаф, механический скарабей", short: "" },
    { marathonId: [8494, 9032], id: 8635, title: "Срочная доставка", short: "" },
    { marathonId: [8496, 9034], id: 9295, title: "Орды Сальфимара", short: "", availableWeekdays: [1, 4] },
    { marathonId: [8498, 9036], id: 9294, title: "Орды Нуимара", short: "", availableWeekdays: [0, 3] },
    { marathonId: [8500, 9050], id: 8637, title: "Старый друг – новый враг", short: "Бухта - Жакар" },
    { marathonId: [8502, 9040], id: 7327, title: "Взгляд слепца", short: "50 мобов (100 очков) на Сверкающем побережье" },
    { marathonId: [8504, 9042], id: 9296, title: "Орды Сангемара", short: "", availableWeekdays: [2, 5] },
    { marathonId: [8506, 9044], id: 5969, title: "Кольцо Лореи", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8508, 9062], id: 8641, title: "Наступление кир'феров", short: "Эфен - жаба (через 5 минут после начала войны)" },
    { marathonId: [8510, 9048], id: 5077, title: "Аромат для важной особы", short: `Парфюмер (<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#aroma" target="_blank">запад</a>/<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#aroma" target="_blank">восток</a>)` },
    { marathonId: [8512, 9038], id: 8605, title: "Битва в Бухте китобоев", short: "" },
    { marathonId: [8514, 9052], id: 11096, title: "Турнир в честь Отца-Солнца", short: "Луг - Битва хранителей", schedule: [{ timeStart: "18:00", weekdays: [6, 0] }] },
    { marathonId: [8516, 9054], id: 8000129, title: "Во славу Орхидны", short: "" },
    { marathonId: [8518, 9056], id: 1415, title: "Сирота", short: "" },
    { marathonId: [8520, 9058], id: 5970, title: "Кольцо капитана Гленна", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8522, 9060], id: 10188, title: "Образцы флоры Сада", short: "", slot: { item: ITEMS[49252], count: 20 } },
    { marathonId: [8524, 9046], id: 8618, title: "Битва за Эфен'Хал", short: "Эфен - мобы" },
    { marathonId: [9064], id: 8000311, title: "Охота на призраков", short: "Предпоследнее испытание для осколков предела" }
  ];
  let normalizeQuestTitleForMatch = /* @__PURE__ */ __name((value) => {
    const roman = /* @__PURE__ */ __name((num) => {
      const map = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"];
      return map[num] || String(num);
    }, "roman");
    return String(value || "").toLowerCase().replace(/ё/g, "е").replace(/(\D)(\d+)$/u, (_, prefix, num) => `${prefix} ${roman(Number(num))}`).replace(/\*+/g, "").replace(/героич/g, "гер").replace(/[«»"'`´’‘“”()[\]{}.,:;!?\-–—_/\\]+/g, " ").replace(/\s+/g, " ").trim();
  }, "normalizeQuestTitleForMatch");
  let getQuestTitleMatchWords = /* @__PURE__ */ __name((value) => normalizeQuestTitleForMatch(value).split(" ").filter((word) => word.length >= 3 || /^[ivx]+$/.test(word)), "getQuestTitleMatchWords");
  let scoreQuestTitleMatch = /* @__PURE__ */ __name((apiTitle, localTitle) => {
    const apiNorm = normalizeQuestTitleForMatch(apiTitle);
    const localNorm = normalizeQuestTitleForMatch(localTitle);
    if (!apiNorm || !localNorm) return 0;
    if (apiNorm === localNorm) return 1e3;
    if (apiNorm.includes(localNorm) || localNorm.includes(apiNorm)) {
      return Math.min(apiNorm.length, localNorm.length);
    }
    const apiWords = new Set(getQuestTitleMatchWords(apiTitle));
    const commonWords = getQuestTitleMatchWords(localTitle).filter((word) => apiWords.has(word));
    return commonWords.join("").length + commonWords.length * 2;
  }, "scoreQuestTitleMatch");
  let findQuestMetaForMarathonQuest = /* @__PURE__ */ __name((marathonQuest) => {
    const marathonQuestId = Number(marathonQuest?.id || 0);
    if (marathonQuestId) {
      const byId = QUESTS.find((q) => q.marathonId.includes(marathonQuestId));
      if (byId) return byId;
    }
    let bestQuest = null;
    let bestScore = 0;
    for (const quest of QUESTS) {
      const score = scoreQuestTitleMatch(marathonQuest?.title, quest.title);
      if (score > bestScore) {
        bestQuest = quest;
        bestScore = score;
      }
    }
    return bestScore >= 12 ? bestQuest : null;
  }, "findQuestMetaForMarathonQuest");

  // src/components/taskCard/taskCard.ts
  let makeRewardBlock = /* @__PURE__ */ __name((amount, isDone) => {
    const reward = document.createElement("div");
    reward.className = "tasks__item-reward";
    const name = document.createElement("span");
    name.className = "tasks__item-reward-name";
    name.textContent = "Награда:";
    reward.appendChild(name);
    const n = Math.max(0, Math.min(20, amount));
    const cls = isDone ? "icon-point--received" : "icon-point--not-received";
    for (let i = 0; i < n; i++) {
      const icon = document.createElement("div");
      icon.className = `icon-point ${cls}`;
      reward.appendChild(icon);
    }
    return reward;
  }, "makeRewardBlock");
  let makeTaskText = /* @__PURE__ */ __name((desc) => {
    const t = document.createElement("div");
    t.className = "tasks__item-text";
    t.textContent = desc || "";
    return t;
  }, "makeTaskText");
  let makeGisaaStatusLine = /* @__PURE__ */ __name((info) => {
    if (!info) return null;
    const line = document.createElement("div");
    line.className = `tm-gisaa-status tm-gisaa-status--${info.status}`;
    if (info.status === "available") {
      const places = (info.locations || []).filter((location2) => !/^copy$/i.test(String(location2).trim())).join(" / ");
      line.textContent = places ? `Сегодня можно выполнить: ${places}` : "Сегодня можно выполнить";
    } else if (info.status === "unavailable") line.textContent = "Сегодня нельзя выполнить";
    else return null;
    return line;
  }, "makeGisaaStatusLine");
  let makeLinksRow = /* @__PURE__ */ __name((params) => {
    const { id, short, questTitle, slot, veksel, locations, availableWeekdays, schedule, makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2, buildVekselUrl: buildVekselUrl2, getGisaaVekselInfoForQuest: getGisaaVekselInfoForQuest2, makeVekselIconLink: makeVekselIconLink2 } = params;
    const row = document.createElement("div");
    row.className = "tm-links-row";
    const leftPart = document.createElement("div");
    leftPart.className = "tm-links-left";
    const item = slot?.item;
    if (item?.id) {
      const hasIcon = item.icon && item.grade;
      if (hasIcon) leftPart.appendChild(makeItemIconLink2({ item, linked: true, size: "small", count: slot.count }));
      else if (item.name) {
        const nameLink = document.createElement("a");
        nameLink.className = "tm-item-name-link";
        nameLink.href = getItemCodexUrl(item);
        nameLink.target = "_blank";
        nameLink.rel = "noopener noreferrer";
        nameLink.textContent = item.name;
        leftPart.appendChild(nameLink);
      }
    }
    const hasLocations = locations && locations.length > 0;
    const hasShort = !!short;
    const availableWeekdaysStatus = formatAvailableWeekdaysStatus(availableWeekdays);
    const hasAvailableWeekdays = !!availableWeekdaysStatus;
    const hasSchedule = schedule && schedule.length > 0;
    const gisaaInfo = getGisaaVekselInfoForQuest2(veksel, slot, locations);
    if (hasLocations || hasShort || hasAvailableWeekdays || hasSchedule || gisaaInfo) {
      const infoWrapper = document.createElement("div");
      infoWrapper.className = "tm-info-wrapper";
      if (hasLocations || hasShort) {
        const infoLine = document.createElement("div");
        infoLine.className = "tm-info-line";
        if (hasLocations) {
          const locEl = document.createElement("span");
          locEl.className = "tm-locations";
          locEl.textContent = locations.join(" / ");
          infoLine.appendChild(locEl);
        }
        if (hasShort) {
          const d = document.createElement("span");
          d.className = "tm-short";
          d.innerHTML = short;
          infoLine.appendChild(d);
        }
        infoWrapper.appendChild(infoLine);
      }
      if (hasAvailableWeekdays) {
        const daysEl = document.createElement("div");
        daysEl.className = "tm-available-days";
        daysEl.textContent = availableWeekdaysStatus;
        infoWrapper.appendChild(daysEl);
      }
      if (hasSchedule) {
        const eventsEl = document.createElement("div");
        eventsEl.className = "tm-events";
        eventsEl.textContent = formatEventsToString(schedule);
        const countdown = document.createElement("span");
        countdown.className = "tm-countdown";
        countdown.dataset.schedule = JSON.stringify(schedule);
        const seconds = getSecondsUntilNextEvent(schedule);
        updateCountdownEl(countdown, seconds);
        eventsEl.appendChild(countdown);
        infoWrapper.appendChild(eventsEl);
      }
      const gisaaStatusLine = makeGisaaStatusLine(gisaaInfo);
      if (gisaaStatusLine) infoWrapper.appendChild(gisaaStatusLine);
      leftPart.appendChild(infoWrapper);
    }
    row.appendChild(leftPart);
    const icons = document.createElement("div");
    icons.className = "tm-icons";
    row.appendChild(icons);
    const codexTitle = questTitle ? `${formatQuestTitle(questTitle)} - ArcheageCodex` : "Открыть задание в ArcheageCodex";
    if (id) icons.appendChild(makeIconLink2({ href: `${CODEX_BASE}${id}/`, iconSrc: ICON_QUEST, title: codexTitle, className: "tm-codex-link" }));
    if (veksel === "blue_salt" || veksel === "north") {
      const link = makeVekselIconLink2({ href: buildVekselUrl2(veksel, slot, locations), title: "Открыть таблицу векселей", vekselIcon: veksel === "blue_salt" ? ICON_VEKSEL : ICON_VEKSEL_NORTH });
      link.classList.add("tm-veksel-link");
      link.dataset.veksel = veksel;
      if (slot) link.dataset.slot = JSON.stringify(slot);
      if (locations) link.dataset.locations = JSON.stringify(locations);
      icons.appendChild(link);
    }
    return row;
  }, "makeLinksRow");
  let makeTaskCard = /* @__PURE__ */ __name((params) => {
    const { q, amount, id, short, isDone, showLastDone, completionTime, isToday, slot, veksel, locations, availableWeekdays, schedule, animateCompletion = false, makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2, buildVekselUrl: buildVekselUrl2, getGisaaVekselInfoForQuest: getGisaaVekselInfoForQuest2, makeVekselIconLink: makeVekselIconLink2 } = params;
    const card = document.createElement("div");
    card.className = `tasks__item tasks__item--${amount || 1}`;
    if (isDone) {
      card.classList.add(DONE_CLASS);
      if (animateCompletion) {
        card.classList.add(JUST_DONE_CLASS);
        card.addEventListener("animationend", () => {
          card.classList.remove(JUST_DONE_CLASS);
        }, { once: true });
      }
      const done = document.createElement("div");
      done.className = "tasks__item-done";
      const row = document.createElement("div");
      row.className = "tm-done-row";
      const maxStep = Number(q?.max_completed_step || 0);
      const progress = Number(q?.progress || 0);
      const progressEl = document.createElement("span");
      progressEl.className = "tm-done-progress";
      if (maxStep === 0 && isToday) progressEl.textContent = "Можно выполнить повторно";
      else if (maxStep === 0) progressEl.textContent = "";
      else progressEl.textContent = `${progress}/${maxStep}`;
      row.appendChild(progressEl);
      const checkEl = document.createElement("span");
      checkEl.className = "tm-done-check";
      checkEl.textContent = "✔";
      row.appendChild(checkEl);
      done.appendChild(row);
      if (showLastDone) {
        const time = formatTimeMSK(completionTime || 0);
        if (time) {
          const timeEl = document.createElement("span");
          timeEl.className = "tm-done-time";
          timeEl.textContent = time;
          done.appendChild(timeEl);
        }
      }
      card.appendChild(done);
    }
    card.appendChild(makeRewardBlock(amount, isDone));
    card.appendChild(makeTaskText(q.description));
    card.appendChild(makeLinksRow({ id, short, questTitle: q.title, slot, veksel, locations, availableWeekdays, schedule, makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2, buildVekselUrl: buildVekselUrl2, getGisaaVekselInfoForQuest: getGisaaVekselInfoForQuest2, makeVekselIconLink: makeVekselIconLink2 }));
    return card;
  }, "makeTaskCard");

  // src/components/levelBlock/levelBlock.ts
  let updateLevelBlock = /* @__PURE__ */ __name((json) => {
    const userInfo = json?.data?.user_info;
    if (!userInfo) return;
    const level = Number(userInfo.level || 1);
    const expTotal = Number(userInfo.exp_total || 0);
    const expForLevel = Number(json?.data?.action_info?.exp_for_level || 10);
    const progress = expTotal - (level - 1) * expForLevel;
    const clampedProgress = Math.max(0, Math.min(expForLevel, progress));
    const levelBlock = document.querySelector(".level");
    if (!levelBlock) return;
    levelBlock.innerHTML = "";
    const levelCurrent = document.createElement("div");
    levelCurrent.className = "level__current";
    const levelCurrentTitle = document.createElement("div");
    levelCurrentTitle.className = "level__current-title";
    levelCurrentTitle.textContent = "Ваш уровень:";
    levelCurrent.appendChild(levelCurrentTitle);
    const iconLevel = document.createElement("div");
    iconLevel.className = "icon_level";
    const iconLevelText = document.createElement("div");
    iconLevelText.className = "icon_level-text";
    iconLevelText.textContent = String(level);
    iconLevel.appendChild(iconLevelText);
    const iconsStar = document.createElement("div");
    iconsStar.className = "icons-star";
    iconLevel.appendChild(iconsStar);
    levelCurrent.appendChild(iconLevel);
    const iconInfo = document.createElement("div");
    iconInfo.className = "icon-info tooltip-on";
    const tooltipWrap = document.createElement("div");
    tooltipWrap.className = "tooltip-wrap";
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    const tooltipText = document.createElement("div");
    tooltipText.className = "tooltip__text";
    tooltipText.textContent = "Выполняйте внутриигровые задания — и получайте за это уровни в событии «Марафон героев»!";
    tooltip.appendChild(tooltipText);
    tooltipWrap.appendChild(tooltip);
    iconInfo.appendChild(tooltipWrap);
    levelCurrent.appendChild(iconInfo);
    levelBlock.appendChild(levelCurrent);
    const levelNext = document.createElement("div");
    levelNext.className = "level__next";
    const levelNextTitle = document.createElement("div");
    levelNextTitle.className = "level__next-title";
    levelNextTitle.textContent = "Прогресс до следующего уровня:";
    levelNext.appendChild(levelNextTitle);
    const levelNextList = document.createElement("div");
    levelNextList.className = "level__next-list";
    for (let i = 0; i < expForLevel; i++) {
      const iconPoint = document.createElement("div");
      iconPoint.className = i < clampedProgress ? "icon-point icon-point--received" : "icon-point icon-point--not-received";
      levelNextList.appendChild(iconPoint);
    }
    levelNext.appendChild(levelNextList);
    levelBlock.appendChild(levelNext);
  }, "updateLevelBlock");

  // src/components/dateNav/dateNav.ts
  let deps = null;
  let initDateNavDeps = /* @__PURE__ */ __name((d) => {
    deps = d;
  }, "initDateNavDeps");
  let ensureDateNavInHeader = /* @__PURE__ */ __name(() => {
    if (!deps) return null;
    const { DOM: DOM2, loadHideDoneState: loadHideDoneState2, saveHideDoneState: saveHideDoneState2, ensureTasksListEl: ensureTasksListEl2, getPrevSlot: getPrevSlot2, getNextSlot: getNextSlot2, applySlot: applySlot2, onSelectedDateChanged: onSelectedDateChanged2, refreshApiInfo: refreshApiInfo2, restartAutoRefresh: restartAutoRefresh2, getSelectedDay, getSelectedSegment } = deps;
    if (DOM2.nav && DOM2.nav.isConnected) return DOM2.nav;
    if (!DOM2.tasksHeader || !DOM2.tasksHeader.isConnected) DOM2.tasksHeader = document.querySelector(".section.tasks .tasks__header");
    if (!DOM2.tasksHeader) return null;
    let nav = DOM2.tasksHeader.querySelector(".tm-date-nav");
    if (nav) {
      DOM2.nav = nav;
      DOM2.label = nav.querySelector(".tm-date-label");
      DOM2.prevBtn = nav.querySelector(".tm-date-prev");
      DOM2.nextBtn = nav.querySelector(".tm-date-next");
      DOM2.todayBtn = nav.querySelector(".tm-date-today");
      return nav;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "tm-nav-wrapper";
    const todayBtn = document.createElement("button");
    todayBtn.className = "tm-date-btn tm-date-today";
    todayBtn.type = "button";
    todayBtn.textContent = "Сегодня";
    nav = document.createElement("div");
    nav.className = "tm-date-nav";
    const left = document.createElement("button");
    left.className = "tm-date-btn tm-date-prev";
    left.type = "button";
    left.textContent = "←";
    const right = document.createElement("button");
    right.className = "tm-date-btn tm-date-next";
    right.type = "button";
    right.textContent = "→";
    const label = document.createElement("div");
    label.className = "tm-date-label";
    label.textContent = "...";
    nav.appendChild(left);
    nav.appendChild(label);
    nav.appendChild(right);
    const hideDoneLabel = document.createElement("label");
    hideDoneLabel.className = "tm-hide-done-label";
    const hideDoneCheckbox = document.createElement("input");
    hideDoneCheckbox.type = "checkbox";
    hideDoneCheckbox.className = "tm-hide-done-checkbox";
    const hideDoneText = document.createTextNode(" Скрыть выполненные");
    hideDoneLabel.appendChild(hideDoneCheckbox);
    hideDoneLabel.appendChild(hideDoneText);
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "tm-refresh-btn";
    refreshBtn.title = "Обновить данные";
    refreshBtn.innerHTML = "&#x21bb;";
    DOM2.refreshLoader = refreshBtn;
    refreshBtn.addEventListener("click", () => {
      refreshApiInfo2();
      restartAutoRefresh2();
    });
    wrapper.appendChild(todayBtn);
    wrapper.appendChild(nav);
    wrapper.appendChild(hideDoneLabel);
    wrapper.appendChild(refreshBtn);
    DOM2.tasksHeader.insertAdjacentElement("afterbegin", wrapper);
    DOM2.nav = nav;
    DOM2.label = label;
    DOM2.prevBtn = left;
    DOM2.nextBtn = right;
    DOM2.todayBtn = todayBtn;
    DOM2.hideDoneCheckbox = hideDoneCheckbox;
    const savedState = loadHideDoneState2();
    hideDoneCheckbox.checked = savedState;
    if (savedState) {
      const listEl = ensureTasksListEl2();
      if (listEl) listEl.classList.add("tm-hide-done");
    }
    hideDoneCheckbox.addEventListener("change", () => {
      const listEl = ensureTasksListEl2();
      if (listEl) listEl.classList.toggle("tm-hide-done", hideDoneCheckbox.checked);
      saveHideDoneState2(hideDoneCheckbox.checked);
    });
    left.addEventListener("click", async () => {
      const prev = getPrevSlot2(getSelectedDay(), getSelectedSegment());
      applySlot2(prev.dayUtcMs, prev.segment);
      await onSelectedDateChanged2();
    });
    right.addEventListener("click", async () => {
      const next = getNextSlot2(getSelectedDay(), getSelectedSegment());
      applySlot2(next.dayUtcMs, next.segment);
      await onSelectedDateChanged2();
    });
    todayBtn.addEventListener("click", async () => {
      applySlot2(getTodayUtcMsByTZ(), "auto");
      await onSelectedDateChanged2();
    });
    return nav;
  }, "ensureDateNavInHeader");
  let updateDateNavLabel = /* @__PURE__ */ __name(() => {
    if (!deps) return;
    const { DOM: DOM2, getSelectedDay, getSelectedSegment } = deps;
    const selectedDayUtcMs2 = getSelectedDay();
    const selectedSegment2 = getSelectedSegment();
    if (selectedDayUtcMs2 == null) return;
    if (!DOM2.label) return;
    const parts = getMSKDatePartsFromUtcMs(selectedDayUtcMs2);
    const dateStr = formatDMY(parts);
    const isThuDay = isThursdayByTZ(selectedDayUtcMs2);
    let suffix = "";
    if (isThuDay && selectedSegment2 === "pre") suffix = "до 09:00";
    else if (isThuDay && selectedSegment2 === "post") suffix = "после 09:00";
    DOM2.label.innerHTML = "";
    const dateEl = document.createElement("span");
    dateEl.className = "tm-date-label-date";
    dateEl.textContent = dateStr;
    DOM2.label.appendChild(dateEl);
    if (suffix) {
      const suffixEl = document.createElement("span");
      suffixEl.className = "tm-date-label-suffix";
      suffixEl.textContent = suffix;
      DOM2.label.appendChild(suffixEl);
    }
    updateDateNavButtons();
  }, "updateDateNavLabel");
  let updateDateNavButtons = /* @__PURE__ */ __name(() => {
    if (!deps) return;
    const { DOM: DOM2, getSelectedDay, getSelectedSegment, slotKey: slotKey2, getMinDay, getMaxDay, getMinSegment, getMaxSegment } = deps;
    const selectedDayUtcMs2 = getSelectedDay();
    const selectedSegment2 = getSelectedSegment();
    const MIN_DAY_UTC_MS2 = getMinDay();
    const MAX_DAY_UTC_MS2 = getMaxDay();
    const MIN_SEG2 = getMinSegment();
    const MAX_SEG2 = getMaxSegment();
    if (selectedDayUtcMs2 == null) return;
    if (!DOM2.prevBtn && !DOM2.nextBtn) return;
    const curKey = slotKey2(selectedDayUtcMs2, selectedSegment2);
    const minKey = MIN_DAY_UTC_MS2 != null ? slotKey2(MIN_DAY_UTC_MS2, MIN_SEG2) : null;
    const maxKey = MAX_DAY_UTC_MS2 != null ? slotKey2(MAX_DAY_UTC_MS2, MAX_SEG2) : null;
    if (DOM2.prevBtn) DOM2.prevBtn.disabled = minKey != null && curKey <= minKey;
    if (DOM2.nextBtn) DOM2.nextBtn.disabled = maxKey != null && curKey >= maxKey;
    if (DOM2.todayBtn) DOM2.todayBtn.disabled = isSameDayByTZ(selectedDayUtcMs2, getTodayUtcMsByTZ());
  }, "updateDateNavButtons");

  // src/pages/marathon/api.ts
  let deps2 = null;
  let initApiDeps = /* @__PURE__ */ __name((d) => {
    deps2 = d;
  }, "initApiDeps");
  let API_INFO_CACHE = null;
  let API_INFO_PROMISE = null;
  let API_INFO_DATA_JSON = null;
  let isRefreshing = false;
  let setApiInfoDataJson = /* @__PURE__ */ __name((value) => {
    API_INFO_DATA_JSON = value;
  }, "setApiInfoDataJson");
  let fetchJson = /* @__PURE__ */ __name(async (url) => {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }, "fetchJson");
  let fetchText = /* @__PURE__ */ __name(async (url) => {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }, "fetchText");
  let fetchApiInfo = /* @__PURE__ */ __name(async () => {
    if (!deps2) throw new Error("ApiDeps not initialized");
    const t0 = Date.now();
    const res = await fetch(deps2.API_INFO_PATH, { credentials: "include", cache: "no-store" });
    const t1 = Date.now();
    if (!res.ok) throw new Error(`api/info failed: ${res.status}`);
    const dateHeader = res.headers.get("Date");
    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
    if (Number.isFinite(parsed)) {
      const halfRtt = (t1 - t0) / 2;
      setNowMs(parsed + halfRtt);
    } else if (NOW_MS == null) {
      throw new Error("[ArcheAgeExtraUI] Cannot read server Date header");
    }
    const json = await res.json();
    deps2.debugLog("api/info loaded", {
      state: json?.state,
      hasData: !!json?.data,
      questContainerType: json?.data?.quests == null ? String(json?.data?.quests) : Array.isArray(json?.data?.quests) ? "array" : typeof json?.data?.quests,
      questCount: json?.data?.quests && typeof json?.data?.quests === "object" ? Object.keys(json?.data?.quests).length : 0,
      weekNumber: json?.data?.week_number,
      nextWeekAt: json?.data?.next_week_at,
      serverNowIso: NOW_MS ? new Date(NOW_MS).toISOString() : null
    });
    return json;
  }, "fetchApiInfo");
  let getApiInfoCached = /* @__PURE__ */ __name(async () => {
    if (API_INFO_CACHE) return API_INFO_CACHE;
    if (API_INFO_PROMISE) {
      try {
        API_INFO_CACHE = await API_INFO_PROMISE;
        return API_INFO_CACHE;
      } catch {
      }
    }
    API_INFO_CACHE = await fetchApiInfo();
    return API_INFO_CACHE;
  }, "getApiInfoCached");
  let getUidFromCheckUser = /* @__PURE__ */ __name(async () => {
    const json = await fetchJson("/dynamic/auth/?a=checkuser");
    const uid = json?.user?.uid;
    if (!uid) throw new Error("uid not found");
    return String(uid);
  }, "getUidFromCheckUser");
  let showRefreshLoader = /* @__PURE__ */ __name(() => {
    if (deps2?.DOM.refreshLoader) deps2.DOM.refreshLoader.classList.add("tm-refresh-loader--active");
  }, "showRefreshLoader");
  let hideRefreshLoader = /* @__PURE__ */ __name(() => {
    if (deps2?.DOM.refreshLoader) deps2.DOM.refreshLoader.classList.remove("tm-refresh-loader--active");
  }, "hideRefreshLoader");
  let refreshApiInfo = /* @__PURE__ */ __name(async ({ loadAutoClaimState: loadAutoClaimState2 = /* @__PURE__ */ __name(() => false, "loadAutoClaimState"), claimAllLevelRewards: claimAllLevelRewards2 = /* @__PURE__ */ __name(async () => {
  }, "claimAllLevelRewards") } = {}) => {
    if (!deps2) return;
    if (isRefreshing) return;
    isRefreshing = true;
    showRefreshLoader();
    try {
      const prevDataJson = API_INFO_DATA_JSON;
      API_INFO_CACHE = null;
      API_INFO_PROMISE = null;
      API_INFO_CACHE = await fetchApiInfo();
      if (NOW_MS !== null) {
        setServerTimeOffset(NOW_MS - Date.now());
      }
      const oldSelectedKey = deps2.getSlotKey(deps2.getSelectedDayUtcMs(), deps2.getSelectedSegment());
      const newTodayUtc = deps2.getTodayUtcMsByTZ();
      const newTodaySegment = deps2.getEffectiveSegment(newTodayUtc, "auto");
      const newTodayKey = deps2.getSlotKey(newTodayUtc, newTodaySegment);
      const dayChanged = oldSelectedKey !== newTodayKey && oldSelectedKey < newTodayKey;
      if (dayChanged) deps2.applySlot(newTodayUtc, "auto");
      const newDataJson = JSON.stringify(API_INFO_CACHE?.data);
      API_INFO_DATA_JSON = newDataJson;
      if (newDataJson === prevDataJson && !dayChanged) return;
      deps2.updateQuestHistory();
      if (dayChanged) await deps2.onSelectedDateChanged();
      else await deps2.renderTasksForSelectedDay({ animateNewlyDone: true });
      if (loadAutoClaimState2()) await claimAllLevelRewards2();
    } catch (e) {
      deps2.debugWarn("refreshApiInfo failed:", e);
    } finally {
      isRefreshing = false;
      hideRefreshLoader();
    }
  }, "refreshApiInfo");
  let stopAutoRefresh = /* @__PURE__ */ __name(() => {
    if (!deps2) return;
    if (deps2.autoRefreshIntervalId.current != null) {
      clearInterval(deps2.autoRefreshIntervalId.current);
      deps2.autoRefreshIntervalId.current = null;
    }
  }, "stopAutoRefresh");
  let startAutoRefresh = /* @__PURE__ */ __name((intervalMs) => {
    if (!deps2) return;
    stopAutoRefresh();
    deps2.autoRefreshIntervalId.current = setInterval(refreshApiInfo, intervalMs);
  }, "startAutoRefresh");
  let restartAutoRefresh = /* @__PURE__ */ __name(() => {
    if (!deps2) return;
    const interval = document.hidden ? deps2.AUTO_REFRESH_INTERVAL_HIDDEN_MS : deps2.AUTO_REFRESH_INTERVAL_FOCUSED_MS;
    startAutoRefresh(interval);
  }, "restartAutoRefresh");

  // src/pages/marathon/core.ts
  let DONE_CLASS = "tm-task-completed";
  let JUST_DONE_CLASS = "tm-task-just-completed";
  let THU_PRE_HOUR = 3;
  let DEFAULT_HOUR = 16;
  let LS_KEYS2 = {
    HIDE_DONE: "tm_aa_hide_done",
    AUTO_CLAIM: "tm_aa_auto_claim",
    QUEST_HISTORY: "tm_aa_qh",
    AUTO_OPEN_BOXES: "tm_aa_auto_open_boxes",
    IR_PER_PAGE: "tm_aa_ir_per_page",
    EVENT_VISIBILITY: "tm_aa_ev_vis",
    VEKSEL_SERVER_ID: "tm_aa_veksel_server_id",
    ICON_SEX: "tm_aa_icon_sex",
    NOTIFICATIONS: "tm_aa_notifications",
    DYNAMIC_TOOLTIPS: "tm_aa_dynamic_tooltips"
  };
  let HISTORY_MAX_ENTRIES = 500;
  let HISTORY_PER_PAGE = 10;
  let DEBUG_PREFIX = "[ArcheAgeExtraUI]";
  let DEBUG_ENABLED = true;
  let debugLog = /* @__PURE__ */ __name((...args) => {
    if (DEBUG_ENABLED) console.log(DEBUG_PREFIX, ...args);
  }, "debugLog");
  let debugWarn = /* @__PURE__ */ __name((...args) => {
    console.warn(DEBUG_PREFIX, ...args);
  }, "debugWarn");
  let DAY_RESET_HOUR = 0;
  let selectedDayUtcMs = null;
  let selectedSegment = "auto";
  let autoRefreshIntervalRef = { current: null };
  let previouslyDoneQuestIds = /* @__PURE__ */ new Set();
  let MIN_DAY_UTC_MS = null;
  let MAX_DAY_UTC_MS = null;
  let MIN_SEG = null;
  let MAX_SEG = null;
  let DOM = {
    nav: null,
    label: null,
    prevBtn: null,
    nextBtn: null,
    todayBtn: null,
    hideDoneCheckbox: null,
    refreshLoader: null,
    tasksHeader: null,
    tasksList: null
  };
  let toRoman = /* @__PURE__ */ __name((num) => {
    const numerals = [
      ["M", 1e3],
      ["CM", 900],
      ["D", 500],
      ["CD", 400],
      ["C", 100],
      ["XC", 90],
      ["L", 50],
      ["XL", 40],
      ["X", 10],
      ["IX", 9],
      ["V", 5],
      ["IV", 4],
      ["I", 1]
    ];
    let result = "";
    for (const [roman, value] of numerals) {
      while (num >= value) {
        result += roman;
        num -= value;
      }
    }
    return result;
  }, "toRoman");
  let formatQuestTitle = /* @__PURE__ */ __name((title) => {
    if (!title) return "";
    let result = title.replace(/\*+$/, "");
    const match = result.match(/(\s*)(\d+)$/);
    if (match) {
      const num = parseInt(match[2], 10);
      if (num > 0 && num < 100) {
        const roman = toRoman(num);
        result = result.slice(0, -match[0].length) + " " + roman;
      }
    }
    return result.trim();
  }, "formatQuestTitle");
  let getHideDoneDayKey = /* @__PURE__ */ __name(() => {
    const ms = nowMs();
    const shiftedMs = ms - DAY_RESET_HOUR * 3600 * 1e3;
    const { y, m, d } = getMSKDatePartsFromUtcMs(shiftedMs);
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }, "getHideDoneDayKey");
  let loadHideDoneState = /* @__PURE__ */ __name(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS2.HIDE_DONE);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.dayKey !== getHideDoneDayKey()) return false;
      return !!data.checked;
    } catch {
      return false;
    }
  }, "loadHideDoneState");
  let saveHideDoneState = /* @__PURE__ */ __name((checked) => {
    try {
      localStorage.setItem(LS_KEYS2.HIDE_DONE, JSON.stringify({
        checked,
        dayKey: getHideDoneDayKey()
      }));
    } catch {
    }
  }, "saveHideDoneState");
  let loadAllQuestHistory = /* @__PURE__ */ __name(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS2.QUEST_HISTORY) || "null") || {};
    } catch {
      return {};
    }
  }, "loadAllQuestHistory");
  let cachedUid = null;
  let historyCurrentPage = 1;
  let historyEntries = [];
  let mergeQuestHistory = /* @__PURE__ */ __name((quests) => {
    if (!cachedUid) return [];
    const all = loadAllQuestHistory();
    const history = all[cachedUid] || [];
    const existing = new Set(history.map((e) => `${e.code}:${e.completedAt}`));
    for (const q of quests) {
      const t = Number(q.last_complete_time || 0);
      if (!t) continue;
      const key = `${q.code}:${t}`;
      if (existing.has(key)) continue;
      history.push({ code: q.code, completedAt: t });
      existing.add(key);
    }
    history.sort((a, b) => b.completedAt - a.completedAt);
    if (history.length > HISTORY_MAX_ENTRIES) history.length = HISTORY_MAX_ENTRIES;
    try {
      all[cachedUid] = history;
      localStorage.setItem(LS_KEYS2.QUEST_HISTORY, JSON.stringify(all));
    } catch {
    }
    return history;
  }, "mergeQuestHistory");
  let formatDateTimeMSK = /* @__PURE__ */ __name((unixSec) => {
    if (!unixSec) return "";
    const ms = unixSec * 1e3;
    const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
    const time = formatTimeMSK(unixSec);
    return `${pad2(d)}.${pad2(m)}.${y} ${time}`;
  }, "formatDateTimeMSK");
  let renderHistoryTable = /* @__PURE__ */ __name(() => {
    const section = document.querySelector("section.history-events");
    if (!section) return;
    const layout = section.querySelector(".layout");
    if (!layout) return;
    const oldWrap = layout.querySelector(".table__wrap");
    if (oldWrap) oldWrap.remove();
    if (!historyEntries.length) return;
    const totalPages = Math.ceil(historyEntries.length / HISTORY_PER_PAGE);
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    const start = (historyCurrentPage - 1) * HISTORY_PER_PAGE;
    const pageItems = historyEntries.slice(start, start + HISTORY_PER_PAGE);
    const questsMap = API_INFO_CACHE?.data?.quests || {};
    const table = document.createElement("table");
    table.className = "table table--history_events";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Дата</th><th>Задание</th><th>Опыт</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const entry of pageItems) {
      const tr = document.createElement("tr");
      const tdDate = document.createElement("td");
      tdDate.textContent = formatDateTimeMSK(entry.completedAt);
      tr.appendChild(tdDate);
      const tdTitle = document.createElement("td");
      tdTitle.textContent = questsMap[entry.code]?.description || entry.code;
      tr.appendChild(tdTitle);
      const tdReward = document.createElement("td");
      const quest = questsMap[entry.code];
      if (quest) {
        const span = document.createElement("span");
        span.className = "table__status";
        const dots = Math.max(1, getRewardAmount(quest));
        for (let i = 0; i < dots; i++) {
          const dot = document.createElement("div");
          dot.className = "icon-point icon-point--received";
          span.appendChild(dot);
        }
        tdReward.appendChild(span);
      }
      tr.appendChild(tdReward);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const wrap = document.createElement("div");
    wrap.className = "table__wrap";
    wrap.appendChild(table);
    if (totalPages > 1) {
      const ul = document.createElement("ul");
      ul.className = "pagination";
      const makePageItem = /* @__PURE__ */ __name((page, text, className, disabled, onClick) => {
        const li = document.createElement("li");
        li.className = "pagination__item" + (className ? " " + className : "") + (disabled ? " disabled" : "");
        li.textContent = text;
        li.addEventListener("click", () => {
          if (!disabled) onClick(page);
        });
        return li;
      }, "makePageItem");
      const makeEllipsisItem = /* @__PURE__ */ __name(() => {
        const li = document.createElement("li");
        li.className = "pagination__item pagination__item--ellipsis disabled";
        li.textContent = "...";
        return li;
      }, "makeEllipsisItem");
      const maxVisiblePages = 9;
      let firstPage = Math.max(1, historyCurrentPage - 4);
      let lastPage = Math.min(totalPages, historyCurrentPage + 4);
      if (lastPage - firstPage + 1 < maxVisiblePages) {
        if (firstPage === 1) lastPage = Math.min(totalPages, firstPage + maxVisiblePages - 1);
        else if (lastPage === totalPages) firstPage = Math.max(1, lastPage - maxVisiblePages + 1);
      }
      const firstLi = makePageItem(1, "«", "pagination__item--first", historyCurrentPage <= 1, () => {
        historyCurrentPage = 1;
        renderHistoryTable();
      });
      firstLi.title = "Первая страница";
      ul.appendChild(firstLi);
      const prevLi = document.createElement("li");
      prevLi.className = "pagination__item pagination__item--prev" + (historyCurrentPage <= 1 ? " disabled" : "");
      prevLi.title = "Предыдущая страница";
      prevLi.innerHTML = '<i class="icons-arrow"></i>';
      prevLi.addEventListener("click", () => {
        if (historyCurrentPage > 1) {
          historyCurrentPage--;
          renderHistoryTable();
        }
      });
      ul.appendChild(prevLi);
      if (firstPage > 1) ul.appendChild(makeEllipsisItem());
      for (let p = firstPage; p <= lastPage; p++) {
        const li = document.createElement("li");
        li.className = "pagination__item" + (p === historyCurrentPage ? " active" : "");
        li.textContent = String(p);
        li.addEventListener("click", () => {
          historyCurrentPage = p;
          renderHistoryTable();
        });
        ul.appendChild(li);
      }
      if (lastPage < totalPages) ul.appendChild(makeEllipsisItem());
      const nextLi = document.createElement("li");
      nextLi.className = "pagination__item pagination__item--next" + (historyCurrentPage >= totalPages ? " disabled" : "");
      nextLi.title = "Следующая страница";
      nextLi.innerHTML = '<i class="icons-arrow"></i>';
      nextLi.addEventListener("click", () => {
        if (historyCurrentPage < totalPages) {
          historyCurrentPage++;
          renderHistoryTable();
        }
      });
      ul.appendChild(nextLi);
      const lastLi = makePageItem(totalPages, "»", "pagination__item--last", historyCurrentPage >= totalPages, () => {
        historyCurrentPage = totalPages;
        renderHistoryTable();
      });
      lastLi.title = "Последняя страница";
      ul.appendChild(lastLi);
      wrap.appendChild(ul);
    }
    layout.appendChild(wrap);
  }, "renderHistoryTable");
  let updateQuestHistory = /* @__PURE__ */ __name(() => {
    if (!API_INFO_CACHE) return;
    try {
      const quests = getQuestsArrayFromInfo(API_INFO_CACHE);
      historyEntries = mergeQuestHistory(quests);
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] updateQuestHistory failed:", e);
    }
    renderHistoryTable();
  }, "updateQuestHistory");
  let slotKey = /* @__PURE__ */ __name((dayUtcMs, segment) => {
    if (dayUtcMs == null) return 0;
    const seg = segment === "pre" ? 0 : segment === "post" ? 2 : 1;
    return dayUtcMs * 10 + seg;
  }, "slotKey");
  let normalizeSegmentForDay = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    if (!isThursdayByTZ(dayUtcMs)) return null;
    if (seg === "pre" || seg === "post" || seg === "auto") return seg;
    return "post";
  }, "normalizeSegmentForDay");
  let effectiveSegment = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    if (!isThursdayByTZ(dayUtcMs)) return null;
    if (seg === "pre" || seg === "post") return seg;
    const todayUtc = getTodayUtcMsByTZ();
    const isToday = isSameDayByTZ(dayUtcMs, todayUtc);
    if (!isToday) return "post";
    const { start } = getDayBoundsUnix(dayUtcMs);
    const cut = start + 9 * 3600;
    return getNowUnix() < cut ? "pre" : "post";
  }, "effectiveSegment");
  let getSlotBoundsUnix = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    const { start, end } = getDayBoundsUnix(dayUtcMs);
    if (!isThursdayByTZ(dayUtcMs)) return { start, end };
    const cut = start + 9 * 3600;
    const s = effectiveSegment(dayUtcMs, seg);
    if (s === "pre") return { start, end: cut };
    return { start: cut, end };
  }, "getSlotBoundsUnix");
  let getPrevSlot = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    const isThu = isThursdayByTZ(dayUtcMs);
    if (isThu) {
      if (seg === "post") return { dayUtcMs, segment: "pre" };
      if (seg === "pre") {
        const prevDay2 = addDaysUtcMs(dayUtcMs, -1);
        return { dayUtcMs: prevDay2, segment: normalizeSegmentForDay(prevDay2, null) };
      }
      return { dayUtcMs, segment: "pre" };
    }
    const prevDay = addDaysUtcMs(dayUtcMs, -1);
    if (isThursdayByTZ(prevDay)) return { dayUtcMs: prevDay, segment: "post" };
    return { dayUtcMs: prevDay, segment: null };
  }, "getPrevSlot");
  let getNextSlot = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    const isThu = isThursdayByTZ(dayUtcMs);
    if (isThu) {
      if (seg === "pre") return { dayUtcMs, segment: "post" };
      if (seg === "post") {
        const nextDay2 = addDaysUtcMs(dayUtcMs, 1);
        return { dayUtcMs: nextDay2, segment: normalizeSegmentForDay(nextDay2, null) };
      }
      return { dayUtcMs, segment: "post" };
    }
    const nextDay = addDaysUtcMs(dayUtcMs, 1);
    if (isThursdayByTZ(nextDay)) return { dayUtcMs: nextDay, segment: "pre" };
    return { dayUtcMs: nextDay, segment: null };
  }, "getNextSlot");
  let clampSelectedDay = /* @__PURE__ */ __name((dayUtcMs, segment) => {
    if (dayUtcMs == null) return { dayUtcMs, segment };
    segment = normalizeSegmentForDay(dayUtcMs, segment);
    const curKey = slotKey(dayUtcMs, segment);
    const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
    const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;
    if (minKey != null && curKey < minKey) return { dayUtcMs: MIN_DAY_UTC_MS, segment: MIN_SEG };
    if (maxKey != null && curKey > maxKey) return { dayUtcMs: MAX_DAY_UTC_MS, segment: MAX_SEG };
    segment = normalizeSegmentForDay(dayUtcMs, segment);
    return { dayUtcMs, segment };
  }, "clampSelectedDay");
  let applySlot = /* @__PURE__ */ __name((dayUtcMs, segment) => {
    segment = effectiveSegment(dayUtcMs, segment) ?? segment;
    const c = clampSelectedDay(dayUtcMs, segment);
    selectedDayUtcMs = c.dayUtcMs;
    selectedSegment = c.segment;
  }, "applySlot");
  let isQuestActiveAtUnix = /* @__PURE__ */ __name((q, unix) => {
    const qs = Number(q?.start_time || 0);
    const qe = Number(q?.end_time || 0);
    if (!qs || !qe) return false;
    return qs <= unix && unix < qe;
  }, "isQuestActiveAtUnix");
  let getCompletionTimeInSlot = /* @__PURE__ */ __name((code, dayUtcMs, seg) => {
    const b = getSlotBoundsUnix(dayUtcMs, seg);
    const entry = historyEntries.find((e) => e.code === code && b.start <= e.completedAt && e.completedAt < b.end);
    return entry ? entry.completedAt : 0;
  }, "getCompletionTimeInSlot");
  let getRewardAmount = /* @__PURE__ */ __name((q) => {
    const steps = q?.steps;
    const step1 = steps?.["1"] || steps?.[1];
    const amount = step1?.rewards?.[0]?.value?.amount;
    return Number(amount || 0);
  }, "getRewardAmount");
  let getQuestsArrayFromInfo = /* @__PURE__ */ __name((json) => {
    const quests = json?.data?.quests;
    if (!quests || typeof quests !== "object") throw new Error("api/info: quests not found");
    return Object.values(quests);
  }, "getQuestsArrayFromInfo");
  let debugTime = /* @__PURE__ */ __name((unix) => {
    if (!unix) return null;
    return new Date(unix * 1e3).toISOString();
  }, "debugTime");
  let summarizeQuestForDebug = /* @__PURE__ */ __name((q) => ({
    id: q?.id,
    code: q?.code,
    title: q?.title,
    group: q?.group,
    type: q?.type,
    time_status: q?.time_status,
    start_time: q?.start_time,
    start_iso: debugTime(Number(q?.start_time || 0)),
    end_time: q?.end_time,
    end_iso: debugTime(Number(q?.end_time || 0)),
    progress: q?.progress,
    max_completed_step: q?.max_completed_step,
    reward: getRewardAmount(q),
    known_meta: !!findQuestMetaForMarathonQuest(q)
  }), "summarizeQuestForDebug");
  let renderEmptyTasksDiagnostic = /* @__PURE__ */ __name((listEl, message) => {
    const empty = document.createElement("div");
    empty.className = "tasks__item tm-tasks-empty";
    empty.textContent = message;
    listEl.appendChild(empty);
  }, "renderEmptyTasksDiagnostic");
  let vekselUrlResolved = VEKSEL_BASE;
  let vekselAutoDetectedServerId = "";
  let loadVekselServerIdOverride = /* @__PURE__ */ __name(() => {
    try {
      const id = localStorage.getItem(LS_KEYS2.VEKSEL_SERVER_ID);
      return id && SERVERS[id] ? id : "";
    } catch {
      return "";
    }
  }, "loadVekselServerIdOverride");
  let saveVekselServerIdOverride = /* @__PURE__ */ __name((serverId) => {
    try {
      if (serverId && SERVERS[serverId]) localStorage.setItem(LS_KEYS2.VEKSEL_SERVER_ID, serverId);
      else localStorage.removeItem(LS_KEYS2.VEKSEL_SERVER_ID);
    } catch {
    }
  }, "saveVekselServerIdOverride");
  let getVekselAutoOptionText = /* @__PURE__ */ __name(() => {
    const serverName = SERVERS[vekselAutoDetectedServerId];
    return `Автоопределение${serverName ? ` (${serverName})` : ""}`;
  }, "getVekselAutoOptionText");
  let updateVekselServerAutoOptionText = /* @__PURE__ */ __name(() => {
    document.querySelectorAll('[data-veksel-server-auto-option="1"]').forEach((option) => {
      option.textContent = getVekselAutoOptionText();
    });
  }, "updateVekselServerAutoOptionText");
  let updateRenderedVekselLinks = /* @__PURE__ */ __name(() => {
    document.querySelectorAll(".tm-veksel-link").forEach((link) => {
      const veksel = link.dataset.veksel;
      let slot = null;
      let locations;
      try {
        slot = link.dataset.slot ? JSON.parse(link.dataset.slot) : null;
      } catch {
      }
      try {
        locations = link.dataset.locations ? JSON.parse(link.dataset.locations) : void 0;
      } catch {
      }
      link.href = buildVekselUrl(veksel, slot, locations);
    });
  }, "updateRenderedVekselLinks");
  let buildVekselUrl = /* @__PURE__ */ __name((veksel, slot, locations) => {
    const isBlueSalt = veksel === "blue_salt";
    const isNorth = veksel === "north";
    if (!isBlueSalt && !isNorth) return vekselUrlResolved;
    let params = null;
    const item = slot?.item;
    if (slot?.count && (item?.vekselName || item?.name)) {
      if (isBlueSalt) params = `res=${encodeURIComponent(item.vekselName || item.name)}&amount=${slot.count}`;
      else if (isNorth) {
        const iconType = item.vekselType || "sack";
        if (locations && locations.length > 0) params = `loc=${encodeURIComponent(locations.join(","))}&amount=${slot.count}&icon=${iconType}`;
        else params = `amount=${slot.count}&icon=${iconType}`;
      }
    }
    if (!params) return vekselUrlResolved;
    const separator = vekselUrlResolved.includes("?") ? "&" : "?";
    return `${vekselUrlResolved}${separator}${params}`;
  }, "buildVekselUrl");
  let getGisaaVekselKeyForQuest = /* @__PURE__ */ __name((veksel, slot, locations) => {
    const item = slot?.item;
    const amount = Number(slot?.count || 0);
    if (!amount || !item) return null;
    if (veksel === "blue_salt" && (item.vekselName || item.name)) {
      return makeGisaaVekselKey({ type: "blue_salt", resourceName: item.vekselName || item.name, amount });
    }
    if (veksel === "north") {
      return makeGisaaVekselKey({ type: "north", amount, iconType: item.vekselType || "sack", locations });
    }
    return null;
  }, "getGisaaVekselKeyForQuest");
  let makeGisaaInfoFromRows = /* @__PURE__ */ __name((rows) => {
    const unique = /* @__PURE__ */ __name((values) => [...new Set((values || []).filter(Boolean))], "unique");
    const matches = unique(rows.filter((row) => row.status === "match").map((row) => row.location));
    const unknown = unique(rows.filter((row) => row.status === "unknown").map((row) => row.location));
    const excludes = unique(rows.filter((row) => row.status === "exclude").map((row) => row.location));
    if (matches.length) return { status: "available", locations: matches, unknownLocations: unknown, excludedLocations: excludes };
    if (!unknown.length && excludes.length) return { status: "unavailable", locations: [], unknownLocations: unknown, excludedLocations: excludes };
    return null;
  }, "makeGisaaInfoFromRows");
  let getGisaaVekselInfoFromSavedTable = /* @__PURE__ */ __name((veksel, slot, locations) => {
    const snapshot = getSavedGisaaTablesSnapshot();
    if (!snapshot) return null;
    const item = slot?.item;
    const amount = Number(slot?.count || 0);
    if (!item || !amount) return null;
    if (veksel === "blue_salt") {
      const resourceName = item.vekselName || item.name;
      const rows = snapshot.resources?.[resourceName];
      if (!rows?.length) return null;
      return makeGisaaInfoFromRows(rows.map((row) => ({
        location: row.location,
        status: row.unknown ? "unknown" : row.amount === amount ? "match" : "exclude"
      })));
    }
    if (veksel === "north") {
      const iconType = item.vekselType || "sack";
      const wantedLocations = locations || [];
      const rows = (snapshot.north || []).filter((row) => wantedLocations.some(
        (loc) => row.location.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(row.location.toLowerCase())
      ));
      if (!rows.length) return null;
      return makeGisaaInfoFromRows(rows.map((row) => ({
        location: row.location,
        status: row.unknown ? "unknown" : row.amount === amount && row.iconType === iconType ? "match" : "exclude"
      })));
    }
    return null;
  }, "getGisaaVekselInfoFromSavedTable");
  let getGisaaVekselInfoForQuest = /* @__PURE__ */ __name((veksel, slot, locations) => getGisaaVekselInfoFromSavedTable(veksel, slot, locations) || getSavedGisaaVekselInfo(getGisaaVekselKeyForQuest(veksel, slot, locations)), "getGisaaVekselInfoForQuest");
  let handleVisibilityChange = /* @__PURE__ */ __name(() => {
    if (document.hidden) restartAutoRefresh();
    else {
      refreshApiInfo();
      restartAutoRefresh();
    }
  }, "handleVisibilityChange");
  let parseServersFromCharListHtml = /* @__PURE__ */ __name((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("li")].map((li) => {
      const spans = li.querySelectorAll("span");
      const last = spans?.[spans.length - 1];
      return last ? last.textContent?.trim() || null : null;
    }).filter((server) => Boolean(server));
  }, "parseServersFromCharListHtml");
  let pickMainServer = /* @__PURE__ */ __name((servers) => {
    if (!servers.length) return null;
    const counts = /* @__PURE__ */ new Map();
    const order = [];
    for (const s of servers) {
      if (!counts.has(s)) order.push(s);
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    let best = null;
    let bestCount = -1;
    for (const s of order) {
      const c = counts.get(s);
      if (c > bestCount) {
        best = s;
        bestCount = c;
      }
    }
    return best;
  }, "pickMainServer");
  let resolveVekselUrl = /* @__PURE__ */ __name(async () => {
    try {
      const serverIdOverride = loadVekselServerIdOverride();
      if (serverIdOverride) {
        vekselUrlResolved = `${VEKSEL_BASE}${serverIdOverride}`;
        updateRenderedVekselLinks();
        updateVekselServerAutoOptionText();
        return;
      }
      const uid = await getUidFromCheckUser();
      const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
      const servers = parseServersFromCharListHtml(html);
      const mainServer = pickMainServer(servers);
      if (!mainServer) {
        vekselAutoDetectedServerId = "";
        vekselUrlResolved = VEKSEL_BASE;
        updateVekselServerAutoOptionText();
        return;
      }
      const vekselId = Object.keys(SERVERS).find((id) => SERVERS[id] === mainServer);
      vekselAutoDetectedServerId = vekselId || "";
      vekselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;
      updateRenderedVekselLinks();
      updateVekselServerAutoOptionText();
    } catch {
      vekselAutoDetectedServerId = "";
      vekselUrlResolved = VEKSEL_BASE;
      updateVekselServerAutoOptionText();
    }
  }, "resolveVekselUrl");
  let makeVekselIconLink = /* @__PURE__ */ __name(({ href, title, vekselIcon }) => {
    const a = document.createElement("a");
    a.className = "tm-veksel-icon-link";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (title) a.title = title;
    const mainImg = document.createElement("img");
    mainImg.className = "tm-veksel-icon-main";
    mainImg.src = ICON_GISAA_OVERLAY;
    mainImg.alt = "gisaa";
    const badgeImg = document.createElement("img");
    badgeImg.className = "tm-veksel-icon-badge";
    badgeImg.src = vekselIcon;
    badgeImg.alt = "veksel";
    a.appendChild(mainImg);
    a.appendChild(badgeImg);
    return a;
  }, "makeVekselIconLink");
  let updateTasksHeader = /* @__PURE__ */ __name((json) => {
    const userInfo = json?.data?.user_info;
    if (!userInfo) return;
    const weekExp = Number(userInfo.week_exp || 0);
    const maxWeekExp = Number(json?.data?.action_info?.increase_max_exp_per_week || 100);
    if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) DOM.tasksHeader = document.querySelector(".section.tasks .tasks__header");
    if (!DOM.tasksHeader) return;
    let balanceEl = DOM.tasksHeader.querySelector(".tasks__balance");
    if (!balanceEl) {
      balanceEl = document.createElement("div");
      balanceEl.className = "tasks__balance";
      DOM.tasksHeader.appendChild(balanceEl);
    }
    balanceEl.innerHTML = "";
    const label = document.createTextNode(`Заработано за эту неделю: ${weekExp} / ${maxWeekExp}`);
    balanceEl.appendChild(label);
    const iconPoint = document.createElement("div");
    iconPoint.className = "icon-point icon-point--received";
    balanceEl.appendChild(iconPoint);
  }, "updateTasksHeader");
  let ensureTasksListEl = /* @__PURE__ */ __name(() => {
    if (!DOM.tasksList || !DOM.tasksList.isConnected) DOM.tasksList = document.querySelector(".section.tasks .tasks__list");
    if (!DOM.tasksList) {
      debugWarn("tasks list element not found", {
        path: location.pathname,
        hasTasksSection: !!document.querySelector(".section.tasks"),
        taskSectionHtml: document.querySelector(".section.tasks")?.outerHTML?.slice(0, 1e3) || null
      });
    }
    return DOM.tasksList;
  }, "ensureTasksListEl");
  let onSelectedDateChanged = /* @__PURE__ */ __name(async () => {
    updateDateNavLabel();
    updateDateNavButtons();
    try {
      await renderTasksForSelectedDay();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] renderTasksForSelectedDay failed:", e);
    }
  }, "onSelectedDateChanged");
  let computeThuSegmentsAvailability = /* @__PURE__ */ __name((dayUtcMs, questsArr) => {
    const preUnix = getUnixForDayAtHour(dayUtcMs, THU_PRE_HOUR);
    const postUnix = getUnixForDayAtHour(dayUtcMs, DEFAULT_HOUR);
    const hasPre = questsArr.some((q) => isQuestActiveAtUnix(q, preUnix));
    const hasPost = questsArr.some((q) => isQuestActiveAtUnix(q, postUnix));
    return { hasPre, hasPost };
  }, "computeThuSegmentsAvailability");
  let computeDateBoundsFromApiInfo = /* @__PURE__ */ __name(async () => {
    if (MIN_DAY_UTC_MS != null && MAX_DAY_UTC_MS != null) return;
    const json = await getApiInfoCached();
    const questsArr = getQuestsArrayFromInfo(json);
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const q of questsArr) {
      const s = Number(q?.start_time || 0);
      const e = Number(q?.end_time || 0);
      if (!s || !e) continue;
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    }
    if (!isFinite(minStart) || !isFinite(maxEnd)) {
      MIN_DAY_UTC_MS = null;
      MAX_DAY_UTC_MS = null;
      MIN_SEG = null;
      MAX_SEG = null;
      return;
    }
    MIN_DAY_UTC_MS = dayUtcMsFromUnixByTZ(minStart);
    MAX_DAY_UTC_MS = dayUtcMsFromUnixByTZ(maxEnd - 1);
    MIN_SEG = null;
    MAX_SEG = null;
    if (MIN_DAY_UTC_MS != null && isThursdayByTZ(MIN_DAY_UTC_MS)) {
      const { hasPre, hasPost } = computeThuSegmentsAvailability(MIN_DAY_UTC_MS, questsArr);
      if (hasPre) MIN_SEG = "pre";
      else if (hasPost) MIN_SEG = "post";
      else MIN_SEG = "post";
    }
    if (MAX_DAY_UTC_MS != null && isThursdayByTZ(MAX_DAY_UTC_MS)) {
      const { hasPre, hasPost } = computeThuSegmentsAvailability(MAX_DAY_UTC_MS, questsArr);
      if (hasPost) MAX_SEG = "post";
      else if (hasPre) MAX_SEG = "pre";
      else MAX_SEG = "pre";
    }
  }, "computeDateBoundsFromApiInfo");
  let taskCardFactories = { makeItemIconLink: null, makeIconLink: null };
  let setTaskCardFactories = /* @__PURE__ */ __name((factories) => {
    taskCardFactories = { ...taskCardFactories, ...factories };
  }, "setTaskCardFactories");
  let renderTasksForSelectedDay = /* @__PURE__ */ __name(async ({ animateNewlyDone = false, makeItemIconLink: makeItemIconLink2 = taskCardFactories.makeItemIconLink, makeIconLink: makeIconLink2 = taskCardFactories.makeIconLink } = {}) => {
    const listEl = ensureTasksListEl();
    if (!listEl) return;
    if (!makeItemIconLink2 || !makeIconLink2) throw new Error("[ArcheAgeExtraUI] makeItemIconLink/makeIconLink are required");
    const json = await getApiInfoCached();
    setApiInfoDataJson(JSON.stringify(json?.data));
    const all = getQuestsArrayFromInfo(json);
    updateLevelBlock(json);
    updateTasksHeader(json);
    const todayUtc = getTodayUtcMsByTZ();
    const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
    const isThu = isThursdayByTZ(selectedDayUtcMs);
    if (selectedDayUtcMs == null) return;
    let unixPoint;
    if (isThu && selectedSegment === "pre") unixPoint = getUnixForDayAtHour(selectedDayUtcMs, THU_PRE_HOUR);
    else unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR);
    const active = all.filter((q) => isQuestActiveAtUnix(q, unixPoint));
    const questMetaByApiQuest = new Map(active.map((q) => [q, findQuestMetaForMarathonQuest(q)]));
    const knownActive = active.filter((q) => questMetaByApiQuest.get(q));
    const unknownActive = active.filter((q) => !questMetaByApiQuest.get(q));
    debugLog("renderTasksForSelectedDay", {
      selectedDayUtcMs,
      selectedSegment,
      unixPoint,
      unixPointIso: debugTime(unixPoint),
      totalQuests: all.length,
      activeQuests: active.length,
      knownActiveQuests: knownActive.length,
      unknownActiveQuests: unknownActive.length,
      minDayIso: MIN_DAY_UTC_MS ? new Date(MIN_DAY_UTC_MS).toISOString() : null,
      maxDayIso: MAX_DAY_UTC_MS ? new Date(MAX_DAY_UTC_MS).toISOString() : null
    });
    if (!active.length) debugWarn("No active quests for selected slot. First API quests:", all.slice(0, 10).map(summarizeQuestForDebug));
    else if (unknownActive.length) debugWarn("Active quests without local QUESTS metadata:", unknownActive.map(summarizeQuestForDebug));
    active.sort((a, b) => {
      const da = getRewardAmount(a);
      const db = getRewardAmount(b);
      if (da !== db) return da - db;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    listEl.innerHTML = "";
    const currentDoneIds = /* @__PURE__ */ new Set();
    let renderedCount = 0;
    for (const q of active) {
      const questId = Number(q.id);
      const meta = questMetaByApiQuest.get(q);
      const id = meta?.id ? Number(meta.id) : null;
      const short = (meta?.short || "").trim();
      const amount = getRewardAmount(q);
      const completionTime = getCompletionTimeInSlot(q.code, selectedDayUtcMs, selectedSegment);
      const doneInSlot = completionTime > 0;
      if (doneInSlot) currentDoneIds.add(questId);
      const isNewlyDone = animateNewlyDone && doneInSlot && !previouslyDoneQuestIds.has(questId);
      const card = makeTaskCard({
        q,
        amount,
        id,
        short,
        isDone: doneInSlot,
        showLastDone: doneInSlot,
        completionTime,
        isToday,
        slot: meta?.slot || null,
        veksel: meta?.veksel,
        locations: meta?.locations,
        availableWeekdays: meta?.availableWeekdays,
        schedule: meta?.schedule,
        animateCompletion: isNewlyDone,
        makeItemIconLink: makeItemIconLink2,
        makeIconLink: makeIconLink2,
        buildVekselUrl,
        getGisaaVekselInfoForQuest,
        makeVekselIconLink
      });
      listEl.appendChild(card);
      renderedCount++;
    }
    if (active.length && !renderedCount) renderEmptyTasksDiagnostic(listEl, "ArcheAgeExtraUI: активные задания есть в API, но карточки не были отрисованы. Проверьте консоль.");
    else if (!active.length) renderEmptyTasksDiagnostic(listEl, "ArcheAgeExtraUI: для выбранного дня активные задания не найдены. Проверьте консоль.");
    previouslyDoneQuestIds = currentDoneIds;
  }, "renderTasksForSelectedDay");
  let init = /* @__PURE__ */ __name(async ({
    injectStyles = /* @__PURE__ */ __name(() => {
    }, "injectStyles"),
    startCountdownInterval = /* @__PURE__ */ __name(() => {
    }, "startCountdownInterval"),
    initPrizes: initPrizes2 = /* @__PURE__ */ __name(async () => {
    }, "initPrizes"),
    initAutoOpenBoxesCheckbox: initAutoOpenBoxesCheckbox2 = /* @__PURE__ */ __name(() => {
    }, "initAutoOpenBoxesCheckbox"),
    makeItemIconLink: makeItemIconLink2,
    makeIconLink: makeIconLink2
  } = {}) => {
    if (makeItemIconLink2 || makeIconLink2) setTaskCardFactories({ makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2 });
    initApiDeps({
      debugLog,
      debugWarn,
      DOM,
      autoRefreshIntervalId: autoRefreshIntervalRef,
      AUTO_REFRESH_INTERVAL_FOCUSED_MS: 3e4,
      AUTO_REFRESH_INTERVAL_HIDDEN_MS: 18e5,
      API_INFO_PATH: "/minigames/marathon_of_heroes/api/info",
      getSelectedDayUtcMs: /* @__PURE__ */ __name(() => selectedDayUtcMs, "getSelectedDayUtcMs"),
      getSelectedSegment: /* @__PURE__ */ __name(() => selectedSegment, "getSelectedSegment"),
      getSlotKey: /* @__PURE__ */ __name((day, seg) => slotKey(day, seg), "getSlotKey"),
      getTodayUtcMsByTZ,
      getEffectiveSegment: effectiveSegment,
      applySlot,
      updateQuestHistory,
      onSelectedDateChanged,
      renderTasksForSelectedDay
    });
    fetchApiInfo().catch(() => {
    });
    injectStyles();
    debugLog("init marathon page", {
      path: location.pathname,
      hasTasksSection: !!document.querySelector(".section.tasks"),
      hasTasksHeader: !!document.querySelector(".section.tasks .tasks__header"),
      hasTasksList: !!document.querySelector(".section.tasks .tasks__list")
    });
    try {
      await getApiInfoCached();
    } catch (e) {
      debugWarn("getApiInfoCached failed during init", e);
      return;
    }
    try {
      cachedUid = await getUidFromCheckUser();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] getUidFromCheckUser failed:", e);
    }
    initServerTimeOffset();
    startCountdownInterval();
    initDateNavDeps({
      DOM,
      getSelectedDay: /* @__PURE__ */ __name(() => selectedDayUtcMs, "getSelectedDay"),
      getSelectedSegment: /* @__PURE__ */ __name(() => selectedSegment, "getSelectedSegment"),
      loadHideDoneState,
      saveHideDoneState,
      ensureTasksListEl,
      getPrevSlot,
      getNextSlot,
      applySlot,
      onSelectedDateChanged,
      refreshApiInfo,
      restartAutoRefresh,
      slotKey,
      getMinDay: /* @__PURE__ */ __name(() => MIN_DAY_UTC_MS, "getMinDay"),
      getMaxDay: /* @__PURE__ */ __name(() => MAX_DAY_UTC_MS, "getMaxDay"),
      getMinSegment: /* @__PURE__ */ __name(() => MIN_SEG, "getMinSegment"),
      getMaxSegment: /* @__PURE__ */ __name(() => MAX_SEG, "getMaxSegment")
    });
    ensureDateNavInHeader();
    try {
      await computeDateBoundsFromApiInfo();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] computeDateBoundsFromApiInfo failed:", e);
    }
    applySlot(selectedDayUtcMs || getTodayUtcMsByTZ(), "auto");
    updateQuestHistory();
    try {
      await onSelectedDateChanged();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] renderTasksForSelectedDay failed:", e);
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(".section.tasks .tasks__header");
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 85;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
    resolveVekselUrl();
    try {
      await initPrizes2();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] initPrizes failed:", e);
    }
    try {
      initAutoOpenBoxesCheckbox2();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] initAutoOpenBoxesCheckbox failed:", e);
    }
    restartAutoRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }, "init");

  // src/pages/marathon/prizes.ts
  let waitForElement = /* @__PURE__ */ __name((selector, timeoutMs = 5e3) => {
    const existing = document.querySelector(selector);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          clearTimeout(timer);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }, timeoutMs);
    });
  }, "waitForElement");
  let LS_KEY_AUTO_CLAIM = "tm_aa_prizes_auto_claim";
  let LS_KEY_AUTO_OPEN_BOXES = "tm_aa_auto_open_boxes";
  let CLAIM_DELAY_MS = 400;
  let loadAutoClaimState = /* @__PURE__ */ __name(() => {
    try {
      return localStorage.getItem(LS_KEY_AUTO_CLAIM) === "true";
    } catch {
      return false;
    }
  }, "loadAutoClaimState");
  let saveAutoClaimState = /* @__PURE__ */ __name((enabled) => {
    try {
      localStorage.setItem(LS_KEY_AUTO_CLAIM, enabled ? "true" : "false");
    } catch {
    }
  }, "saveAutoClaimState");
  let getTargetPrizeLevelFromApi = /* @__PURE__ */ __name(() => {
    const userInfo = API_INFO_CACHE?.data?.user_info;
    if (!userInfo) return 1;
    const currentLevel = userInfo.level || 1;
    const status = userInfo.status || "trial";
    const farmedKey = status === "premium" ? "premium" : "trial";
    const farmedRewards = userInfo.farmed_rewards?.[farmedKey] || [];
    const farmedSet = new Set(farmedRewards.map((x) => parseInt(x, 10)));
    for (let level = 1; level <= currentLevel; level++) {
      if (!farmedSet.has(level)) {
        return level;
      }
    }
    return currentLevel + 1;
  }, "getTargetPrizeLevelFromApi");
  let getPrizesVm = /* @__PURE__ */ __name(() => {
    const el = pageDocument.querySelector(".game__right");
    return el?.__vue__ ?? null;
  }, "getPrizesVm");
  let scrollToFirstRelevantPrize = /* @__PURE__ */ __name(() => {
    const targetLevel = getTargetPrizeLevelFromApi();
    const vm = getPrizesVm();
    if (vm) {
      const perPage = vm.per_on_page || 10;
      vm.current_page = Math.floor((targetLevel - 1) / perPage);
    }
    window.postMessage({ source: "tmAA-cs", type: "SCROLL_PRIZES", level: targetLevel }, "*");
  }, "scrollToFirstRelevantPrize");
  let claimAllActivePrizes = /* @__PURE__ */ __name(async () => {
    await claimAllLevelRewards();
  }, "claimAllActivePrizes");
  let getVueStore = /* @__PURE__ */ __name(() => {
    const page = pageDocument.querySelector(".page");
    const parent = page?.parentElement;
    return parent?.__vue__?.$store ?? null;
  }, "getVueStore");
  let farmLevelReward = /* @__PURE__ */ __name((level, isPremium) => {
    const store = getVueStore();
    if (!store) return Promise.reject(new Error("Vue store not found"));
    return new Promise((resolve, reject) => {
      store.dispatch("maininfo/getLevelPrize", {
        level,
        is_premium: isPremium ? 1 : 0,
        callback_success: /* @__PURE__ */ __name((data) => {
          const userInfo = API_INFO_CACHE?.data?.user_info;
          if (userInfo && data?.data?.farmed_rewards) {
            userInfo.farmed_rewards = data.data.farmed_rewards;
          }
          resolve(data);
        }, "callback_success"),
        callback_error: /* @__PURE__ */ __name(() => {
          reject(new Error(`getLevelPrize failed for level=${level}`));
        }, "callback_error")
      });
    });
  }, "farmLevelReward");
  let syncNativeRewardsState = /* @__PURE__ */ __name(() => {
    const store = getVueStore();
    if (!store) return;
    const farmedRewards = API_INFO_CACHE?.data?.user_info?.farmed_rewards;
    if (farmedRewards) {
      store.commit("maininfo/setUserRewards", JSON.parse(JSON.stringify(farmedRewards)));
    }
    store.dispatch("shop/getShopInfo");
    const vm = getPrizesVm();
    if (vm) {
      const page = vm.current_page;
      vm.current_page = -1;
      vm.$nextTick(() => {
        vm.current_page = page;
      });
    }
  }, "syncNativeRewardsState");
  let claimAllLevelRewards = /* @__PURE__ */ __name(async () => {
    const userInfo = API_INFO_CACHE?.data?.user_info;
    if (!userInfo) return;
    if (!getVueStore()) return;
    const currentLevel = userInfo.level || 1;
    const status = userInfo.status || "trial";
    const isPremium = status === "premium";
    const rewardTypes = isPremium ? ["trial", "premium"] : ["trial"];
    let claimed = false;
    for (const type of rewardTypes) {
      const farmed = new Set((userInfo.farmed_rewards?.[type] || []).map(Number));
      for (let level = 1; level <= currentLevel; level++) {
        if (farmed.has(level)) continue;
        try {
          await farmLevelReward(level, type === "premium");
          claimed = true;
          await new Promise((r) => setTimeout(r, CLAIM_DELAY_MS));
        } catch (e) {
          console.warn(`[ArcheAgeExtraUI] claimLevelReward(${level}, ${type}) failed:`, e);
        }
      }
    }
    if (claimed) {
      syncNativeRewardsState();
    }
  }, "claimAllLevelRewards");
  let loadAutoOpenBoxesState = /* @__PURE__ */ __name(() => {
    try {
      return localStorage.getItem(LS_KEY_AUTO_OPEN_BOXES) === "true";
    } catch {
      return false;
    }
  }, "loadAutoOpenBoxesState");
  let saveAutoOpenBoxesState = /* @__PURE__ */ __name((enabled) => {
    try {
      localStorage.setItem(LS_KEY_AUTO_OPEN_BOXES, String(enabled));
    } catch {
    }
  }, "saveAutoOpenBoxesState");
  let getLootboxVm = /* @__PURE__ */ __name(() => {
    const el = pageDocument.querySelector(".lootbox");
    return el?.__vue__ ?? null;
  }, "getLootboxVm");
  let hasPremiumMarathonAccess = /* @__PURE__ */ __name(() => {
    if (API_INFO_CACHE?.data?.user_info?.status === "premium") return true;
    const store = getVueStore();
    return store?.state?.maininfo?.user_info?.status === "premium" || store?.state?.maininfo?.userInfo?.status === "premium" || store?.state?.maininfo?.info?.user_info?.status === "premium";
  }, "hasPremiumMarathonAccess");
  let autoOpenBoxesIntervalId = null;
  let tryOpenNextBox = /* @__PURE__ */ __name(() => {
    if (!loadAutoOpenBoxesState()) return;
    const lootbox = getLootboxVm();
    if (!lootbox || typeof lootbox.openBox !== "function") return;
    if (lootbox.is_show_popup || lootbox.is_button_pushed) return;
    const boxesAvailable = lootbox.getChestNum;
    if (boxesAvailable <= 0 || !hasPremiumMarathonAccess()) return;
    console.log(`[ArcheAgeExtraUI] Автооткрытие сундука (осталось: ${boxesAvailable})`);
    lootbox.openBox();
  }, "tryOpenNextBox");
  let startAutoOpenBoxesInterval = /* @__PURE__ */ __name(() => {
    if (autoOpenBoxesIntervalId != null) return;
    autoOpenBoxesIntervalId = setInterval(tryOpenNextBox, 1e3);
  }, "startAutoOpenBoxesInterval");
  let stopAutoOpenBoxesInterval = /* @__PURE__ */ __name(() => {
    if (autoOpenBoxesIntervalId != null) {
      clearInterval(autoOpenBoxesIntervalId);
      autoOpenBoxesIntervalId = null;
    }
  }, "stopAutoOpenBoxesInterval");
  let initAutoOpenBoxesCheckbox = /* @__PURE__ */ __name(() => {
    const lootboxTitle = document.querySelector(".lootbox__title");
    if (!lootboxTitle) return;
    if (lootboxTitle.querySelector(".tm-auto-open-label")) return;
    const label = document.createElement("label");
    label.className = "tm-auto-open-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "tm-auto-open-checkbox";
    checkbox.checked = loadAutoOpenBoxesState();
    const text = document.createTextNode("Открывать при получении");
    label.appendChild(checkbox);
    label.appendChild(text);
    lootboxTitle.appendChild(label);
    checkbox.addEventListener("change", () => {
      saveAutoOpenBoxesState(checkbox.checked);
      if (checkbox.checked) {
        startAutoOpenBoxesInterval();
      } else {
        stopAutoOpenBoxesInterval();
      }
    });
    if (checkbox.checked) {
      startAutoOpenBoxesInterval();
    }
  }, "initAutoOpenBoxesCheckbox");
  let initAutoClaimCheckbox = /* @__PURE__ */ __name(() => {
    const prizesTitle = document.querySelector(".prizes__title");
    if (!prizesTitle) return;
    if (prizesTitle.querySelector(".tm-auto-claim-label")) return;
    const label = document.createElement("label");
    label.className = "tm-auto-claim-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "tm-auto-claim-checkbox";
    checkbox.checked = loadAutoClaimState();
    const text = document.createTextNode(" Забирать автоматически");
    label.appendChild(checkbox);
    label.appendChild(text);
    prizesTitle.appendChild(label);
    checkbox.addEventListener("change", async () => {
      saveAutoClaimState(checkbox.checked);
      if (checkbox.checked) {
        await claimAllActivePrizes();
      }
    });
  }, "initAutoClaimCheckbox");
  let initPrizes = /* @__PURE__ */ __name(async () => {
    const prizesWrap = await waitForElement(".prizes__wrap");
    if (!prizesWrap) return;
    initAutoClaimCheckbox();
    scrollToFirstRelevantPrize();
    if (loadAutoClaimState()) {
      await claimAllActivePrizes();
    }
  }, "initPrizes");

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/components/itemIcon/itemIcon.scss
  let itemIcon_default = '@charset "UTF-8";\n.tm-item-icon {\n  position: relative;\n  display: inline-block;\n  flex-shrink: 0;\n}\n\n.tm-item-icon--small {\n  width: 30px;\n  height: 30px;\n  font-size: 11.5px;\n}\n\n.tm-item-icon--medium {\n  width: 42px;\n  height: 42px;\n  font-size: 11.5px;\n}\n\n.tm-item-icon::after {\n  content: "";\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  opacity: 0;\n  box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.35), inset 0 0 4px rgba(255, 255, 255, 0.6);\n}\n\n.tm-item-icon:hover::after {\n  opacity: 1;\n}\n\n.tm-item-icon-img {\n  position: relative;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  display: block;\n}\n\n.tm-item-icon-overlay {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: auto;\n}\n\n.tm-item-icon-grade {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.tm-item-icon-count {\n  position: absolute;\n  right: 9%;\n  bottom: 12.5%;\n  line-height: 0.5;\n  letter-spacing: 0.02em;\n  color: #fff;\n  text-shadow: -1px -2px 2px #000, 1px 1px 2px #000;\n  pointer-events: none;\n  z-index: 3;\n}\n\n.tm-icon-link {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.06);\n  transition: box-shadow 150ms ease, opacity 150ms ease;\n}\n\n.tm-icon-link:hover {\n  transform: translateY(-1px);\n}\n\n.tm-icon-link img {\n  width: 30px;\n  display: block;\n}\n\n/* Всплывашка предмета (глобальная, в body) */\n.tm-item-tooltip {\n  display: none;\n  position: fixed;\n  top: var(--tm-tooltip-top, 0);\n  left: var(--tm-tooltip-left, 0);\n  z-index: 10000;\n  box-sizing: border-box;\n  width: 248px;\n  padding: 15px 15px 14px;\n  background: rgba(0, 8, 24, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.25);\n  pointer-events: none;\n  white-space: normal;\n  font-family: Calibri, Arial, Verdana, Tahoma;\n  font-size: 14px;\n  line-height: 18px;\n  color: #cfd6e0;\n  transform: translateX(-100%) scale(var(--tm-tooltip-scale, 1));\n  transform-origin: top right;\n}\n\n.tm-item-tooltip--visible {\n  display: block;\n}\n\n.tm-item-tooltip--right {\n  transform: scale(var(--tm-tooltip-scale, 1));\n  transform-origin: top left;\n}\n\n.tm-item-tooltip--bottom {\n  transform: translateX(-100%) translateY(-100%) scale(var(--tm-tooltip-scale, 1));\n  transform-origin: bottom right;\n}\n\n.tm-item-tooltip--bottom.tm-item-tooltip--right {\n  transform: translateY(-100%) scale(var(--tm-tooltip-scale, 1));\n  transform-origin: bottom left;\n}\n\n.tm-item-tooltip-header {\n  display: flex;\n  gap: 6px;\n  align-items: flex-start;\n  padding: 0;\n}\n\n.tm-item-tooltip-header > .tm-item-icon {\n  flex-shrink: 0;\n}\n\n.tm-item-tooltip-meta {\n  display: flex;\n  flex-direction: column;\n  padding: 6px 0 2px;\n}\n\n.tm-item-tooltip-type {\n  opacity: 0.7;\n}\n\n.tm-item-tooltip-name {\n  font-size: 16px;\n  line-height: 20px;\n}\n\n.tm-item-tooltip-sep {\n  height: 2px;\n  margin: 4px 0;\n  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));\n  -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);\n  mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);\n  padding: 0;\n}\n\n.tm-item-tooltip-req {\n  padding: 0 3px;\n  letter-spacing: 0.03em;\n}\n\n.tm-item-tooltip-level {\n  display: flex;\n  align-items: center;\n}\n\n.tm-item-tooltip-hero-level-icon {\n  width: 16px;\n  height: 16px;\n  margin: 0 2px;\n  flex: 0 0 auto;\n}\n\n.tm-item-tooltip-stats {\n  padding: 0 3px;\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  letter-spacing: 0.03em;\n}\n\n.tm-item-tooltip-stat-row {\n  display: flex;\n  gap: 4px;\n}\n\n.tm-item-tooltip-stat-value {\n  color: #cfd6e0;\n  text-align: right;\n}\n\n.tm-item-tooltip-equipment-subtype {\n  padding: 0 3px;\n  letter-spacing: 0.03em;\n}\n\n.tm-item-tooltip-desc {\n  padding: 4px 3px 2px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.tm-item-tooltip-use-label {\n  color: #888;\n}\n\n.tm-item-tooltip-use-text {\n  color: #4caf50;\n}\n\n.tm-item-tooltip-price {\n  padding: 0 3px;\n  display: grid;\n  grid-template-columns: min-content 1fr;\n  gap: 8px;\n}\n\n.tm-item-tooltip-price--none {\n  display: block;\n  color: #d02e2e;\n}\n\n.tm-item-tooltip-price-value {\n  color: #cfd6e0;\n  display: inline-flex;\n  align-items: center;\n  justify-content: flex-end;\n  flex-wrap: wrap;\n  gap: 4px;\n  text-align: right;\n}\n\n.tm-item-tooltip-price-part {\n  display: inline-flex;\n  align-items: center;\n  gap: 2px;\n  white-space: nowrap;\n}\n\n.tm-item-tooltip-price-icon {\n  width: 16px;\n  height: 16px;\n  flex: 0 0 auto;\n}\n\n.orange_text,\n.inv-nc,\n.inv-nn,\n.inv-buffvar {\n  color: #ff9c27;\n}\n\n.light_blue_text,\n.inv-nd {\n  color: #74b0ca;\n}\n\n.blue_text,\n.inv-ni {\n  color: #27b1c6;\n}\n\n.red_text,\n.inv-nr {\n  color: #de482f;\n}';

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/pages/marathon/selected-items.scss
  let selected_items_default = '.tm-selected-container {\n  position: relative;\n  min-height: 100px;\n  padding: 18px 14px 18px 11px;\n}\n\n.tm-selected-container::before {\n  content: "";\n  position: absolute;\n  left: -1px;\n  top: 0;\n  bottom: 0;\n  width: 100%;\n  pointer-events: none;\n  background: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_top.png) left top no-repeat, url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bottom.png) left bottom no-repeat;\n}\n\n.tm-selected-list {\n  display: flex;\n  flex-direction: column;\n  min-height: 181px;\n  padding: 13px 15px;\n  background: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bg.jpg) left bottom no-repeat;\n  max-height: 181px;\n  overflow: auto;\n  position: relative;\n}\n\n.tm-selected-items-help {\n  margin: auto;\n  color: #495a6d;\n  font: 14px/16px Cambria, Georgia, "Times New Roman", Times, serif;\n  text-align: center;\n  cursor: default;\n}\n\n.tm-selected-item {\n  position: relative;\n  display: flex;\n  align-items: center;\n  padding: 2px 36px 2px 0;\n  font: 14px/16px Cambria, Georgia, "Times New Roman", Times, serif;\n  border-bottom: 1px solid #d6dde5;\n  border-top: 1px solid #d6dde5;\n  cursor: default;\n  z-index: 1;\n}\n\n.tm-cart-item-name {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.tm-selected-item .del_btn {\n  position: absolute;\n  display: block;\n  top: 50%;\n  margin-top: -12px;\n  right: 0;\n  width: 25px;\n  height: 25px;\n  background-image: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/icons.png);\n  background-repeat: no-repeat;\n  background-position: left 0px;\n  cursor: pointer;\n}';

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/pages/marathon/marathon.scss
  let marathon_default = '@charset "UTF-8";\n.tm-task-completed {\n  background-color: rgba(255, 240, 226, 0.7490196078);\n}\n\n/* Анимация "только что выполнено" */\n@keyframes tm-just-completed-glow {\n  0% {\n    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7), inset 0 0 20px rgba(76, 175, 80, 0.3);\n    transform: scale(1);\n  }\n  15% {\n    box-shadow: 0 0 25px 8px rgba(76, 175, 80, 0.6), inset 0 0 30px rgba(76, 175, 80, 0.4);\n    transform: scale(1.02);\n  }\n  30% {\n    box-shadow: 0 0 35px 12px rgba(255, 215, 0, 0.5), inset 0 0 40px rgba(255, 215, 0, 0.3);\n    transform: scale(1.03);\n  }\n  50% {\n    box-shadow: 0 0 20px 6px rgba(76, 175, 80, 0.4), inset 0 0 25px rgba(76, 175, 80, 0.2);\n    transform: scale(1.01);\n  }\n  100% {\n    box-shadow: 0 0 0 0 transparent, inset 0 0 0 transparent;\n    transform: scale(1);\n  }\n}\n@keyframes tm-just-completed-bg {\n  0% {\n    background-color: rgba(255, 240, 226, 0.7490196078);\n  }\n  20% {\n    background-color: rgba(76, 175, 80, 0.35);\n  }\n  40% {\n    background-color: rgba(255, 215, 0, 0.3);\n  }\n  60% {\n    background-color: rgba(76, 175, 80, 0.25);\n  }\n  100% {\n    background-color: rgba(255, 240, 226, 0.7490196078);\n  }\n}\n@keyframes tm-checkmark-pop {\n  0% {\n    transform: scale(0) rotate(-45deg);\n    opacity: 0;\n  }\n  50% {\n    transform: scale(1.4) rotate(10deg);\n    opacity: 1;\n  }\n  70% {\n    transform: scale(0.9) rotate(-5deg);\n  }\n  100% {\n    transform: scale(1) rotate(0deg);\n    opacity: 1;\n  }\n}\n.tm-task-just-completed {\n  animation: tm-just-completed-glow 2s ease-out forwards, tm-just-completed-bg 2s ease-out forwards;\n  position: relative;\n  z-index: 9;\n}\n\n.tm-task-just-completed .tm-done-check {\n  animation: tm-checkmark-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;\n  animation-delay: 0.2s;\n  transform: scale(0);\n}\n\n.tasks__item {\n  overflow: visible;\n}\n\n.tasks__item-done {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-end;\n  gap: 2px;\n  pointer-events: none;\n  opacity: 0.8;\n}\n\n.tm-done-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.tm-done-time {\n  font-size: 12px;\n}\n\n.tm-done-progress {\n  font-size: 12px;\n}\n\n.tm-done-check {\n  font-size: 14px;\n  font-weight: 700;\n  line-height: 1;\n  color: #3cb45a;\n}\n\n.tm-links-row {\n  margin-top: 6px;\n  display: flex;\n  gap: 4px;\n  justify-content: space-between;\n  align-items: center;\n  z-index: 1;\n}\n\n.tm-links-left {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n\n.tm-item-name-link {\n  font-size: 12px;\n  color: inherit;\n  opacity: 0.85;\n  text-decoration: none;\n}\n\n.tm-item-name-link:hover {\n  opacity: 1;\n  text-decoration: underline;\n}\n\n.tm-info-wrapper {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.tm-info-line {\n  display: flex;\n  align-items: baseline;\n  gap: 6px;\n}\n\n.tm-locations {\n  font-size: 12px;\n  line-height: 1.25;\n  opacity: 0.85;\n}\n\n.tm-short {\n  font-size: 12px;\n  line-height: 1.25;\n  opacity: 0.85;\n}\n\n.tm-available-days {\n  font-size: 12px;\n  line-height: 1.25;\n  color: #8a6230;\n  font-weight: 600;\n}\n\n.tm-gisaa-status {\n  font-size: 12px;\n  line-height: 1.25;\n  font-weight: 600;\n}\n\n.tm-gisaa-status--available {\n  color: #3f8f3a;\n}\n\n.tm-gisaa-status--unavailable {\n  color: #b04a44;\n}\n\n.tm-short a {\n  color: inherit;\n}\n\n.tm-events {\n  font-size: 12px;\n  line-height: 1.25;\n  opacity: 0.85;\n}\n\n.tm-inline-icon {\n  display: inline-block;\n  position: relative;\n  width: 18px;\n  height: 18px;\n  vertical-align: middle;\n  margin: 0 2px;\n}\n\n.tm-inline-icon img:first-child {\n  width: 100%;\n  height: 100%;\n  display: block;\n}\n\n.tm-inline-icon-grade {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.tm-countdown {\n  font-weight: 500;\n  white-space: nowrap;\n}\n\n.tm-countdown.tm-countdown--active {\n  color: #4caf50;\n}\n\n.tm-countdown.tm-countdown--waiting {\n  color: #d02e2e;\n}\n\n.tm-icons {\n  display: flex;\n  flex-direction: row-reverse;\n  gap: 8px;\n  align-items: center;\n  flex: 0 0 auto;\n}\n\n.tm-icon-link {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.06);\n  transition: box-shadow 150ms ease, opacity 150ms ease;\n}\n\n.tm-icon-link:hover {\n  transform: translateY(-1px);\n}\n\n.tm-icon-link img {\n  width: 30px;\n  display: block;\n}\n\n.tm-veksel-icon-link {\n  position: relative;\n  display: inline-block;\n  width: 30px;\n  height: 30px;\n  flex-shrink: 0;\n  transition: transform 120ms ease, opacity 120ms ease;\n}\n\n.tm-veksel-icon-link:hover {\n  transform: translateY(-1px);\n  opacity: 1;\n}\n\n.tm-veksel-icon-main {\n  width: 100%;\n  height: 100%;\n  display: block;\n}\n\n.tm-veksel-icon-badge {\n  position: absolute;\n  bottom: -2px;\n  right: -2px;\n  width: 18px;\n  height: 18px;\n  border-radius: 2px;\n  background: rgba(0, 0, 0, 0.6);\n}\n\n.tm-nav-wrapper {\n  display: flex;\n  align-items: center;\n  gap: 16px;\n}\n\n.tm-date-nav {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n@media (max-width: 1300px) {\n  .tm-nav-wrapper {\n    padding: 0 20px;\n  }\n}\n.tm-date-btn {\n  cursor: pointer;\n  padding: 4px 8px;\n  border-radius: 6px;\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  background: rgba(255, 255, 255, 0.06);\n  color: inherit;\n  font: inherit;\n  font-size: 14px;\n  text-transform: uppercase;\n}\n\n.tm-date-btn:hover {\n  background: rgba(255, 255, 255, 0.1);\n}\n\n.tm-date-label {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  min-width: 150px;\n  text-align: center;\n}\n\n.tm-date-label-date {\n  font-size: 16px;\n}\n\n.tm-date-label-suffix {\n  font-size: 12px;\n  opacity: 0.75;\n  line-height: 1;\n}\n\n.tasks__header {\n  flex-wrap: wrap;\n  justify-content: space-between;\n  gap: 16px;\n}\n\n.tm-date-btn:disabled {\n  opacity: 0.35;\n  cursor: default;\n}\n\n.tm-hide-done-label {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  cursor: pointer;\n  font-size: 16px;\n}\n\n.tm-hide-done-label:hover {\n  opacity: 1;\n}\n\n.tm-hide-done-checkbox {\n  cursor: pointer;\n}\n\n.tm-hide-done .tm-task-completed {\n  display: none;\n}\n\n.tm-refresh-btn {\n  width: 26px;\n  height: 26px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, 0.06);\n  color: rgba(255, 255, 255, 0.7);\n  font-size: 18px;\n  line-height: 1;\n  cursor: pointer;\n  transition: background 150ms ease, color 150ms ease, transform 150ms ease;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.tm-refresh-btn:hover {\n  background: rgba(255, 255, 255, 0.12);\n  color: rgba(255, 255, 255, 0.95);\n}\n\n.tm-refresh-btn:active {\n  transform: scale(0.92);\n}\n\n.tm-refresh-loader--active {\n  pointer-events: none;\n  animation: tm-spin 0.7s linear infinite;\n}\n\n@keyframes tm-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n/* Автозабор подарков */\n.prizes__title {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n}\n\n.tm-auto-claim-label {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 14px;\n  font-weight: normal;\n  cursor: pointer;\n  user-select: none;\n  white-space: nowrap;\n}\n\n.tm-auto-claim-checkbox {\n  width: 16px;\n  height: 16px;\n  cursor: pointer;\n}\n\n/* Автооткрытие сундуков */\n.lootbox__title {\n  gap: 30px;\n  flex-wrap: wrap;\n}\n\n.lootbox__title .icon-info {\n  margin-left: 0;\n}\n\n.tm-auto-open-label {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 14px;\n  font-weight: normal;\n  cursor: pointer;\n  user-select: none;\n  white-space: nowrap;\n  text-transform: none;\n}\n\n.tm-auto-open-checkbox {\n  width: 16px;\n  height: 16px;\n  cursor: pointer;\n}\n\n.pagination__item--ellipsis {\n  cursor: default;\n  color: #777;\n}';

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/pages/cart/cart.scss
  let cart_default = '@charset "UTF-8";\n#block_content {\n  overflow: unset;\n}\n\n.cart_right {\n  position: sticky;\n  top: 0;\n}\n\n.guild_tab.cart_items .gh_1,\n.guild_tab.cart_items .gс_1 {\n  width: 1%;\n}\n\n.guild_tab.cart_items .gh_2 {\n  border-left: none;\n  padding-left: 0;\n}\n\n.guild_tab.cart_items .gh_3 {\n  width: 1px;\n  min-width: 170px;\n  border-right: none;\n}\n\n.guild_tab.cart_items .gh_4 {\n  width: 1%;\n}\n\n.guild_tab.cart_items .gс_2 {\n  border-left: none;\n  padding-left: 0;\n}\n\n.guild_tab.cart_items .gс_4 {\n  white-space: nowrap;\n  text-align: right;\n  border-right: none;\n  width: 1%;\n}\n\n.cart_items .item:hover {\n  background: #edf4fa;\n}\n\n.cart_items .item.disabled:hover {\n  background: transparent;\n}\n\n.cart_items .item.tm-selected {\n  display: none;\n}\n\n.tm-cart-timer {\n  display: block;\n}\n\n.tm-char-face {\n  width: 100%;\n  height: 100%;\n  /*border-radius: 50%;*/\n  opacity: 0;\n  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent), linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);\n  -webkit-mask-composite: destination-in;\n  mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent), linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);\n  mask-composite: intersect;\n  filter: brightness(1.1);\n  mix-blend-mode: multiply;\n}\n\n.tm-char-face--loaded {\n  opacity: 1;\n}\n\n.tm-char-face--error {\n  opacity: 0;\n}\n\n.tm-char-face-ready div {\n  background: none !important;\n}';

  // src/pages/marathon/styles.ts
  let itemIconStylesInjected = false;
  let selectedItemsStylesInjected = false;
  let marathonStylesInjected = false;
  let cartStylesInjected = false;
  let injectItemIconStyles = /* @__PURE__ */ __name(() => {
    if (itemIconStylesInjected) return;
    itemIconStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = itemIcon_default;
    appendStyleElement(style);
  }, "injectItemIconStyles");
  let injectMarathonStyles = /* @__PURE__ */ __name(() => {
    if (marathonStylesInjected) return;
    marathonStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = marathon_default;
    appendStyleElement(style);
  }, "injectMarathonStyles");
  let injectCartStyles = /* @__PURE__ */ __name(() => {
    if (cartStylesInjected) return;
    cartStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = cart_default;
    appendStyleElement(style);
  }, "injectCartStyles");
  let injectSelectedItemsStyles = /* @__PURE__ */ __name(() => {
    if (selectedItemsStylesInjected) return;
    selectedItemsStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = selected_items_default;
    appendStyleElement(style);
  }, "injectSelectedItemsStyles");

  // scss:/Users/cergx/wsProjects/archeage-extra-ui/src/components/tooltip/tooltip.scss
  let tooltip_default = ".tm-item-tooltip {\n  display: none;\n  position: fixed;\n  top: var(--tm-tooltip-top, 0);\n  left: var(--tm-tooltip-left, 0);\n  z-index: 10000;\n  box-sizing: border-box;\n  width: 248px;\n  padding: 15px 15px 14px;\n  background: rgba(0, 8, 24, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.25);\n  pointer-events: none;\n  white-space: normal;\n  font-family: Calibri, Arial, Verdana, Tahoma;\n  font-size: 14px;\n  line-height: 18px;\n  color: #cfd6e0;\n  transform: translateX(-100%) scale(var(--tm-tooltip-scale, 1));\n  transform-origin: top right;\n}\n\n.tm-item-tooltip--visible {\n  display: block;\n}\n\n.tm-item-tooltip--right {\n  transform: scale(var(--tm-tooltip-scale, 1));\n  transform-origin: top left;\n}\n\n.tm-item-tooltip--bottom {\n  transform: translateX(-100%) translateY(-100%) scale(var(--tm-tooltip-scale, 1));\n  transform-origin: bottom right;\n}\n\n.tm-item-tooltip--bottom.tm-item-tooltip--right {\n  transform: translateY(-100%) scale(var(--tm-tooltip-scale, 1));\n  transform-origin: bottom left;\n}\n\n.tm-item-tooltip-header {\n  display: flex;\n  gap: 6px;\n  align-items: flex-start;\n  padding: 0;\n}\n\n.tm-item-tooltip-header > .tm-item-icon {\n  flex-shrink: 0;\n}\n\n.tm-item-tooltip-meta {\n  display: flex;\n  flex-direction: column;\n  padding: 6px 0 2px;\n}\n\n.tm-item-tooltip-type {\n  opacity: 0.7;\n}\n\n.tm-item-tooltip-name {\n  font-size: 16px;\n  line-height: 20px;\n}\n\n.tm-item-tooltip-sep {\n  height: 2px;\n  margin: 4px 0;\n  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));\n  -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);\n  mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);\n  padding: 0;\n}\n\n.tm-item-tooltip-req {\n  padding: 0 3px;\n  letter-spacing: 0.03em;\n}\n\n.tm-item-tooltip-level {\n  display: flex;\n  align-items: center;\n}\n\n.tm-item-tooltip-hero-level-icon {\n  width: 16px;\n  height: 16px;\n  margin: 0 2px;\n  flex: 0 0 auto;\n}\n\n.tm-item-tooltip-stats {\n  padding: 0 3px;\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  letter-spacing: 0.03em;\n}\n\n.tm-item-tooltip-stat-row {\n  display: flex;\n  gap: 4px;\n}\n\n.tm-item-tooltip-stat-value {\n  color: #cfd6e0;\n  text-align: right;\n}\n\n.tm-item-tooltip-equipment-subtype {\n  padding: 0 3px;\n  letter-spacing: 0.03em;\n}\n\n.tm-item-tooltip-desc {\n  padding: 4px 3px 2px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.tm-item-tooltip-use-label {\n  color: #888;\n}\n\n.tm-item-tooltip-use-text {\n  color: #4caf50;\n}\n\n.tm-item-tooltip-price {\n  padding: 0 3px;\n  display: grid;\n  grid-template-columns: min-content 1fr;\n  gap: 8px;\n}\n\n.tm-item-tooltip-price--none {\n  display: block;\n  color: #d02e2e;\n}\n\n.tm-item-tooltip-price-value {\n  color: #cfd6e0;\n  display: inline-flex;\n  align-items: center;\n  justify-content: flex-end;\n  flex-wrap: wrap;\n  gap: 4px;\n  text-align: right;\n}\n\n.tm-item-tooltip-price-part {\n  display: inline-flex;\n  align-items: center;\n  gap: 2px;\n  white-space: nowrap;\n}\n\n.tm-item-tooltip-price-icon {\n  width: 16px;\n  height: 16px;\n  flex: 0 0 auto;\n}\n\n.orange_text,\n.inv-nc,\n.inv-nn,\n.inv-buffvar {\n  color: #ff9c27;\n}\n\n.inv-nd {\n  color: #d02e2e;\n}\n\n.inv-ni {\n  color: #4caf50;\n}\n\n.inv-nr {\n  color: #b19cff;\n}";

  // src/components/tooltip/tooltip.ts
  let LS_KEY_DYNAMIC_TOOLTIPS = "tm_aa_dynamic_tooltips";
  let DEBUG_PREFIX2 = "[ArcheAgeExtraUI]";
  let debugWarn2 = /* @__PURE__ */ __name((...args) => console.warn(DEBUG_PREFIX2, ...args), "debugWarn");
  let ITEM_STORE = /* @__PURE__ */ new Map();
  let globalTooltip = null;
  let dynamicTooltipCache = /* @__PURE__ */ new Map();
  let activeTooltipKey = null;
  let tooltipDomInitialized = false;
  let TOOLTIP_VISIBLE_CLASS = "tm-item-tooltip--visible";
  let TOOLTIP_RIGHT_CLASS = "tm-item-tooltip--right";
  let TOOLTIP_BOTTOM_CLASS = "tm-item-tooltip--bottom";
  let TOOLTIP_WIDTH = 248;
  let getSystemScale = /* @__PURE__ */ __name(() => {
    if (loadIconScaleBrowserZoom()) return 1;
    return pageWindow.devicePixelRatio;
  }, "getSystemScale");
  let getTooltipContainer = /* @__PURE__ */ __name(() => {
    if (globalTooltip) return globalTooltip;
    globalTooltip = pageDocument.createElement("div");
    globalTooltip.className = "tm-item-tooltip";
    pageDocument.body.appendChild(globalTooltip);
    return globalTooltip;
  }, "getTooltipContainer");
  let injectTooltipStyles = /* @__PURE__ */ __name(() => {
    if (pageDocument.getElementById("tm-item-tooltip-styles")) return;
    const style = pageDocument.createElement("style");
    style.id = "tm-item-tooltip-styles";
    style.textContent = tooltip_default;
    appendStyleElement(style);
  }, "injectTooltipStyles");
  let initTooltipDom = /* @__PURE__ */ __name(() => {
    injectTooltipStyles();
    getTooltipContainer();
  }, "initTooltipDom");
  let resolveItemLevelValue = /* @__PURE__ */ __name((levelValue, isMaxLevel = false) => {
    if (isMaxLevel && Number(levelValue) === 0) return MAX_LEVEL;
    return Number(levelValue);
  }, "resolveItemLevelValue");
  let appendItemLevelValue = /* @__PURE__ */ __name((container, levelValue, isMaxLevel = false) => {
    const level = resolveItemLevelValue(levelValue, isMaxLevel);
    if (Number.isFinite(level) && level > 55) {
      const icon = pageDocument.createElement("img");
      icon.className = "tm-item-tooltip-hero-level-icon";
      icon.src = HERO_LEVEL_ICON;
      icon.alt = "героический уровень";
      container.appendChild(icon);
      const value = pageDocument.createElement("span");
      value.className = "inv-nc";
      value.textContent = String(level - 55);
      container.appendChild(value);
    } else {
      container.appendChild(pageDocument.createTextNode(String(levelValue)));
    }
  }, "appendItemLevelValue");
  let makeRequiredLevelLine = /* @__PURE__ */ __name((reqLevel, maxLevel) => {
    const line = pageDocument.createElement("div");
    line.className = "tm-item-tooltip-level";
    line.appendChild(pageDocument.createTextNode("Требуемый уровень: "));
    if (reqLevel != null) appendItemLevelValue(line, reqLevel);
    if (maxLevel != null) {
      line.appendChild(pageDocument.createTextNode("~"));
      appendItemLevelValue(line, maxLevel, true);
    }
    return line;
  }, "makeRequiredLevelLine");
  let formatSpeedStat = /* @__PURE__ */ __name((value) => {
    const str = String(value).trim();
    if (!str.includes(".")) return `${str}.0`;
    const [whole, fraction = ""] = str.split(".");
    return `${whole}.${fraction || "0"}`;
  }, "formatSpeedStat");
  let ITEM_UTILITY_STATS = [
    { field: "speed", label: "Сноровка", format: formatSpeedStat },
    { field: "durability", label: "Прочность", format: /* @__PURE__ */ __name((value) => `${value}/${value}`, "format") }
  ];
  let ITEM_COMBAT_STATS = [
    { field: "dps", label: "Урон", colon: true },
    { field: "armor", label: "Защита", colon: true },
    { field: "magicResistance", label: "Сопротивление", colon: true },
    { field: "mdps", label: "Сила заклинаний" },
    { field: "hdps", label: "Эффективность исцеления" },
    { field: "str", label: "Сила" },
    { field: "dex", label: "Ловкость" },
    { field: "sta", label: "Выносливость" },
    { field: "int", label: "Интеллект" },
    { field: "spi", label: "Мудрость" }
  ];
  let isDisplayableItemStatValue = /* @__PURE__ */ __name((value) => {
    if (value == null || value === "") return false;
    const num = Number(value);
    return !Number.isFinite(num) || num !== 0;
  }, "isDisplayableItemStatValue");
  let getItemStatEntries = /* @__PURE__ */ __name((item, stats) => stats.map((stat) => ({ ...stat, value: item[stat.field] })).filter((stat) => stat.value != null).filter((stat) => isDisplayableItemStatValue(stat.value)), "getItemStatEntries");
  let makeItemStatsSection = /* @__PURE__ */ __name((entries) => {
    const section = pageDocument.createElement("div");
    section.className = "tm-item-tooltip-stats";
    for (const entry of entries) {
      const row = pageDocument.createElement("div");
      row.className = "tm-item-tooltip-stat-row";
      const label = pageDocument.createElement("span");
      label.className = "tm-item-tooltip-stat-label";
      label.textContent = entry.colon ? `${entry.label}:` : entry.label;
      const value = pageDocument.createElement("span");
      value.className = "tm-item-tooltip-stat-value";
      value.textContent = entry.format ? entry.format(entry.value) : String(entry.value);
      row.appendChild(label);
      row.appendChild(value);
      section.appendChild(row);
    }
    return section;
  }, "makeItemStatsSection");
  let appendPricePart = /* @__PURE__ */ __name((container, amount, iconSrc, title) => {
    const part = pageDocument.createElement("span");
    part.className = "tm-item-tooltip-price-part";
    const value = pageDocument.createElement("span");
    value.textContent = String(amount);
    part.appendChild(value);
    const icon = pageDocument.createElement("img");
    icon.className = "tm-item-tooltip-price-icon";
    icon.src = iconSrc;
    icon.alt = title;
    icon.title = title;
    part.appendChild(icon);
    container.appendChild(part);
  }, "appendPricePart");
  let makeItemPriceValue = /* @__PURE__ */ __name((price) => {
    const value = pageDocument.createElement("span");
    value.className = "tm-item-tooltip-price-value";
    const totalBronze = Math.max(0, Math.floor(Number(price) || 0));
    const gold = Math.floor(totalBronze / 1e4);
    const silver = Math.floor(totalBronze % 1e4 / 100);
    const bronze = totalBronze % 100;
    if (gold > 0) appendPricePart(value, gold, CURRENCY_ICONS.gold, "золото");
    if (silver > 0) appendPricePart(value, silver, CURRENCY_ICONS.silver, "серебро");
    if (bronze > 0 || totalBronze === 0) appendPricePart(value, bronze, CURRENCY_ICONS.bronze, "бронза");
    return value;
  }, "makeItemPriceValue");
  let getItemDynamicTooltipKey = /* @__PURE__ */ __name((item) => {
    if (item?.id == null || item.id === "") return null;
    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    return `${item.id}|${grade}`;
  }, "getItemDynamicTooltipKey");
  let saveDynamicTooltipSnapshot = /* @__PURE__ */ __name((itemId, grade, data) => {
    if (itemId == null || !data) return;
    try {
      const raw = localStorage.getItem(LS_KEY_DYNAMIC_TOOLTIPS);
      const all = raw ? JSON.parse(raw) : {};
      all[String(itemId)] = {
        id: String(itemId),
        grade: String(grade ?? 0),
        updatedAt: Date.now(),
        data
      };
      localStorage.setItem(LS_KEY_DYNAMIC_TOOLTIPS, JSON.stringify(all));
    } catch (e) {
      debugWarn2("Failed to save dynamic tooltip snapshot:", e);
    }
  }, "saveDynamicTooltipSnapshot");
  let dynamicTooltipFieldValue = /* @__PURE__ */ __name((value) => {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str : null;
  }, "dynamicTooltipFieldValue");
  let dynamicTooltipNumberValue = /* @__PURE__ */ __name((value) => {
    if (value == null || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }, "dynamicTooltipNumberValue");
  let dynamicTooltipStatValue = /* @__PURE__ */ __name((value) => {
    if (value == null || value === "") return null;
    const str = String(value).trim();
    if (!str) return null;
    const num = Number(str);
    return Number.isFinite(num) ? num : str;
  }, "dynamicTooltipStatValue");
  let DYNAMIC_EQUIP_TOOLTIP_PATTERNS = [
    /Здоровье/,
    /Защита/,
    /Сопротивление/,
    /Скорость\s+(?:передвижения|плавания|занятия|сбора)/,
    /Опыт\s+при\s+занятии/,
    /Время\s+применения\s+умений/
  ];
  let isDynamicEquipTooltipPart = /* @__PURE__ */ __name((value) => {
    const text = stripHtmlForMatch(value);
    return DYNAMIC_EQUIP_TOOLTIP_PATTERNS.some((pattern) => pattern.test(text));
  }, "isDynamicEquipTooltipPart");
  let mapDynamicEquipTooltip = /* @__PURE__ */ __name((value) => {
    const raw = dynamicTooltipFieldValue(value);
    if (!raw) return {};
    const parts = raw.split(/<br\s*\/?>/i).map((part) => cleanDynamicTooltipMarkup(part)).filter(Boolean);
    const equipIndex = parts.findIndex(isDynamicEquipTooltipPart);
    if (equipIndex === -1) {
      const useDescription2 = cleanDynamicTooltipMarkup(raw);
      return useDescription2 ? { useDescription: useDescription2 } : {};
    }
    const equipParts = [];
    let nextIndex = equipIndex;
    while (nextIndex < parts.length && isDynamicEquipTooltipPart(parts[nextIndex])) {
      equipParts.push(parts[nextIndex]);
      nextIndex++;
    }
    const result = {
      equipDescription: equipParts.join("<br/>")
    };
    if (equipIndex > 0 && /^Действует\b/i.test(stripHtmlForMatch(parts[equipIndex - 1]))) {
      result.isEquipDescriptionTemporary = true;
    }
    const useDescription = cleanDynamicTooltipMarkup(parts.slice(nextIndex).join("<br/>"));
    if (useDescription) result.useDescription = useDescription;
    return result;
  }, "mapDynamicEquipTooltip");
  let mapDynamicTooltipToItem = /* @__PURE__ */ __name((data) => {
    if (!data || typeof data !== "object") return {};
    const fixedGrade = dynamicTooltipNumberValue(data.fixed_grade);
    const apiGrade = dynamicTooltipNumberValue(data.grade);
    const grade = fixedGrade != null && fixedGrade >= 0 ? fixedGrade : apiGrade;
    const reqLevel = dynamicTooltipNumberValue(data.level_requirement);
    const maxLevel = dynamicTooltipNumberValue(data.level_limit);
    const hasRefund = Object.prototype.hasOwnProperty.call(data, "refund");
    const price = data.refund === null ? null : dynamicTooltipNumberValue(data.refund);
    const description = cleanDynamicTooltipMarkup(data.description);
    const equipTooltipFields = mapDynamicEquipTooltip(data.equip_tooltip);
    const setDescription = cleanDynamicTooltipMarkup(data.set_description);
    return {
      ...dynamicTooltipFieldValue(data.filename) ? { icon: dynamicTooltipFieldValue(data.filename) } : {},
      ...dynamicTooltipFieldValue(data.name) ? { name: dynamicTooltipFieldValue(data.name) } : {},
      ...grade != null && grade >= 0 ? { grade } : {},
      ...description ? { description } : {},
      ...equipTooltipFields,
      ...setDescription ? { equipDescription: setDescription } : {},
      ...dynamicTooltipFieldValue(data.cat_name) ? { apiCategoryTitle: dynamicTooltipFieldValue(data.cat_name) } : {},
      ...reqLevel != null && reqLevel > 0 ? { reqLevel } : {},
      ...maxLevel != null && maxLevel >= 0 ? { maxLevel } : {},
      ...hasRefund && (price !== null || data.refund === null) ? { price } : {},
      ...dynamicTooltipStatValue(data.c_speed) != null ? { speed: dynamicTooltipStatValue(data.c_speed) } : {},
      ...dynamicTooltipStatValue(data.c_durability) != null ? { durability: dynamicTooltipStatValue(data.c_durability) } : {},
      ...dynamicTooltipStatValue(data.c_dps) != null ? { dps: dynamicTooltipStatValue(data.c_dps) } : {},
      ...dynamicTooltipStatValue(data.c_armor) != null ? { armor: dynamicTooltipStatValue(data.c_armor) } : {},
      ...dynamicTooltipStatValue(data.c_magic_resistance) != null ? { magicResistance: dynamicTooltipStatValue(data.c_magic_resistance) } : {},
      ...dynamicTooltipStatValue(data.c_mdps) != null ? { mdps: dynamicTooltipStatValue(data.c_mdps) } : {},
      ...dynamicTooltipStatValue(data.c_hdps) != null ? { hdps: dynamicTooltipStatValue(data.c_hdps) } : {},
      ...dynamicTooltipStatValue(data.c_str) != null ? { str: dynamicTooltipStatValue(data.c_str) } : {},
      ...dynamicTooltipStatValue(data.c_dex) != null ? { dex: dynamicTooltipStatValue(data.c_dex) } : {},
      ...dynamicTooltipStatValue(data.c_sta) != null ? { sta: dynamicTooltipStatValue(data.c_sta) } : {},
      ...dynamicTooltipStatValue(data.c_int) != null ? { int: dynamicTooltipStatValue(data.c_int) } : {},
      ...dynamicTooltipStatValue(data.c_spi) != null ? { spi: dynamicTooltipStatValue(data.c_spi) } : {}
    };
  }, "mapDynamicTooltipToItem");
  let itemHasTooltipField = /* @__PURE__ */ __name((item, field) => field === "price" ? Object.prototype.hasOwnProperty.call(item, field) : item[field] != null && item[field] !== "", "itemHasTooltipField");
  let mergeDynamicTooltipItem = /* @__PURE__ */ __name((item, data) => {
    const apiItem = mapDynamicTooltipToItem(data);
    const merged = { ...item };
    for (const [field, value] of Object.entries(apiItem)) {
      if (field === "buff") {
        merged.buff = { ...value || {}, ...merged.buff || {} };
        continue;
      }
      if (!itemHasTooltipField(merged, field)) merged[field] = value;
    }
    return merged;
  }, "mergeDynamicTooltipItem");
  let fetchDynamicTooltipData = /* @__PURE__ */ __name(async (item) => {
    if (!isArcheageSite) return null;
    const key = getItemDynamicTooltipKey(item);
    if (!key) return null;
    if (dynamicTooltipCache.has(key)) return dynamicTooltipCache.get(key);
    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    const promise = fetch(`/dynamic/tooltip/?a=item&id=${encodeURIComponent(item.id)}&g=${encodeURIComponent(grade)}`, {
      credentials: "include",
      cache: "no-store"
    }).then((res) => res.ok ? res.json() : null).then((data2) => {
      if (data2 && typeof data2 === "object") saveDynamicTooltipSnapshot(item.id, grade, data2);
      return data2 && typeof data2 === "object" ? data2 : null;
    }).catch((e) => {
      debugWarn2(`Failed to fetch dynamic tooltip for item ${item.id}:`, e);
      return null;
    });
    dynamicTooltipCache.set(key, promise);
    const data = await promise;
    dynamicTooltipCache.set(key, data);
    return data;
  }, "fetchDynamicTooltipData");
  let makeItemIconLink = /* @__PURE__ */ __name(({ item, linked = false, size = "medium", count, noTooltip = false }) => {
    const icon = pageDocument.createElement(linked ? "a" : "div");
    icon.className = `tm-item-icon tm-item-icon--${size}`;
    if (linked) {
      icon.href = getItemCodexUrl(item);
      icon.target = "_blank";
      icon.rel = "noopener noreferrer";
      icon.addEventListener("click", (e) => e.stopPropagation());
    }
    const itemImg = pageDocument.createElement("img");
    itemImg.className = "tm-item-icon-img";
    itemImg.src = getItemIconUrl(item);
    itemImg.dataset.itemId = String(item.id);
    itemImg.dataset.iconTemplate = item.icon || "";
    itemImg.dataset.iconM = item.iconM || "";
    itemImg.dataset.iconF = item.iconF || "";
    icon.appendChild(itemImg);
    const overlay = ICON_OVERLAY[item.overlay]?.icon;
    if (overlay) {
      const overlayImg = pageDocument.createElement("img");
      overlayImg.className = "tm-item-icon-overlay";
      overlayImg.src = overlay;
      icon.appendChild(overlayImg);
    }
    const gradeInfo = GRADES[item.grade];
    if (gradeInfo) {
      const gradeImg = pageDocument.createElement("img");
      gradeImg.className = "tm-item-icon-grade";
      gradeImg.src = gradeInfo.overlay;
      gradeImg.alt = gradeInfo.title || "";
      icon.appendChild(gradeImg);
    }
    if (count && count > 1) {
      const countEl = pageDocument.createElement("div");
      countEl.className = "tm-item-icon-count";
      countEl.textContent = String(count);
      icon.appendChild(countEl);
    }
    if (!noTooltip) {
      icon.addEventListener("mouseenter", () => showTooltip(icon, item));
      icon.addEventListener("mouseleave", hideTooltip);
    }
    return icon;
  }, "makeItemIconLink");
  let populateTooltip = /* @__PURE__ */ __name((item) => {
    const tooltip = getTooltipContainer();
    tooltip.innerHTML = "";
    const gradeInfo = GRADES[item.grade];
    const headerSection = pageDocument.createElement("div");
    headerSection.className = "tm-item-tooltip-header";
    const iconEl = makeItemIconLink({ item, noTooltip: true });
    headerSection.appendChild(iconEl);
    const tipMeta = pageDocument.createElement("div");
    tipMeta.className = "tm-item-tooltip-meta";
    const subTypeInfo = ITEM_SUB_TYPES[item.subType];
    const typeInfo = subTypeInfo || ITEM_TYPES[item.type];
    const typeTitle = typeInfo?.title || item.apiCategoryTitle;
    if (typeTitle) {
      const typeLine = pageDocument.createElement("div");
      typeLine.className = "tm-item-tooltip-type";
      typeLine.textContent = typeTitle;
      tipMeta.appendChild(typeLine);
    }
    if (gradeInfo?.title && !(item.grade === 1 && item.type !== "equipment")) {
      const gradeLine = pageDocument.createElement("div");
      gradeLine.className = "tm-item-tooltip-grade";
      if (gradeInfo.color) gradeLine.style.color = gradeInfo.color;
      gradeLine.textContent = gradeInfo.title;
      tipMeta.appendChild(gradeLine);
    }
    const nameLine = pageDocument.createElement("div");
    nameLine.className = "tm-item-tooltip-name";
    if (gradeInfo?.color) nameLine.style.color = gradeInfo.color;
    nameLine.textContent = item.name || "";
    tipMeta.appendChild(nameLine);
    headerSection.appendChild(tipMeta);
    tooltip.appendChild(headerSection);
    if (item.isPersonal || item.reqLevel != null || item.maxLevel != null) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const reqSection = pageDocument.createElement("div");
      reqSection.className = "tm-item-tooltip-req";
      if (item.reqLevel != null || item.maxLevel != null) {
        reqSection.appendChild(makeRequiredLevelLine(item.reqLevel, item.maxLevel));
      }
      if (item.isPersonal) {
        const p = pageDocument.createElement("div");
        p.textContent = "Персональный предмет";
        reqSection.appendChild(p);
      }
      tooltip.appendChild(reqSection);
    }
    const utilityStatEntries = getItemStatEntries(item, ITEM_UTILITY_STATS);
    if (utilityStatEntries.length) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      tooltip.appendChild(makeItemStatsSection(utilityStatEntries));
    }
    const combatStatEntries = getItemStatEntries(item, ITEM_COMBAT_STATS);
    if (combatStatEntries.length) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      tooltip.appendChild(makeItemStatsSection(combatStatEntries));
    }
    const equipmentSubTypeInfo = EQUIPMENT_SUB_TYPES[item.equipmentSubType];
    if (equipmentSubTypeInfo?.title) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const equipmentSubTypeSection = pageDocument.createElement("div");
      equipmentSubTypeSection.className = "tm-item-tooltip-equipment-subtype";
      equipmentSubTypeSection.textContent = equipmentSubTypeInfo.title;
      tooltip.appendChild(equipmentSubTypeSection);
    }
    const hasUseDescription = item.useDescription && hasVisibleTooltipText(item.useDescription);
    if (item.description || hasUseDescription || item.equipDescription) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const descriptionSection = pageDocument.createElement("div");
      descriptionSection.className = "tm-item-tooltip-desc";
      if (item.description) {
        const descText = pageDocument.createElement("div");
        descText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.description, item));
        descriptionSection.appendChild(descText);
      }
      if (hasUseDescription) {
        const useBlock = pageDocument.createElement("div");
        useBlock.className = "tm-item-tooltip-use";
        const useLabel = pageDocument.createElement("div");
        useLabel.className = "tm-item-tooltip-use-label";
        useLabel.textContent = "Использование";
        const useText = pageDocument.createElement("div");
        useText.className = "tm-item-tooltip-use-text";
        useText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.useDescription, item));
        useBlock.appendChild(useLabel);
        useBlock.appendChild(useText);
        descriptionSection.appendChild(useBlock);
      }
      if (item.equipDescription) {
        const equipBlock = pageDocument.createElement("div");
        equipBlock.className = "tm-item-tooltip-use";
        const equipLabel = pageDocument.createElement("div");
        equipLabel.className = "tm-item-tooltip-use-label";
        equipLabel.textContent = item.isEquipDescriptionTemporary ? "Экипировка (временно)" : "Экипировка";
        const equipText = pageDocument.createElement("div");
        equipText.className = "tm-item-tooltip-use-text";
        equipText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.equipDescription, item));
        equipBlock.appendChild(equipLabel);
        equipBlock.appendChild(equipText);
        descriptionSection.appendChild(equipBlock);
      }
      tooltip.appendChild(descriptionSection);
    }
    if (item.price !== void 0) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const priceSection = pageDocument.createElement("div");
      priceSection.className = "tm-item-tooltip-price";
      if (item.price === null || Number(item.price) === 0) {
        priceSection.className = "tm-item-tooltip-price tm-item-tooltip-price--none";
        priceSection.textContent = "Этот предмет не нужен торговцам.";
      } else {
        const label = pageDocument.createElement("span");
        label.textContent = "Цена\nпродажи:";
        priceSection.appendChild(label);
        priceSection.appendChild(makeItemPriceValue(item.price));
      }
      tooltip.appendChild(priceSection);
    }
  }, "populateTooltip");
  let positionTooltip = /* @__PURE__ */ __name((anchorEl) => {
    const tooltip = getTooltipContainer();
    const rect = anchorEl.getBoundingClientRect();
    const screenScale = getSystemScale();
    const scale = 1 / screenScale * (loadIconScalePercent() / 100);
    const tooltipLeftEdge = rect.left + 8 - TOOLTIP_WIDTH * scale;
    const showOnRight = tooltipLeftEdge < 0;
    tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
    tooltip.style.setProperty("--tm-tooltip-scale", `${scale}`);
    const tooltipHeight = tooltip.offsetHeight * scale;
    const showFromBottom = rect.bottom - 8 + tooltipHeight > pageWindow.innerHeight;
    if (showFromBottom) {
      const topEdge = rect.top + 8 - tooltipHeight;
      if (topEdge < 0) {
        tooltip.style.setProperty("--tm-tooltip-top", "0px");
        tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
      } else {
        tooltip.style.setProperty("--tm-tooltip-top", `${rect.top + 8}px`);
        tooltip.classList.add(TOOLTIP_BOTTOM_CLASS);
      }
    } else {
      tooltip.style.setProperty("--tm-tooltip-top", `${rect.bottom - 8}px`);
      tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
    }
    if (showOnRight) {
      tooltip.style.setProperty("--tm-tooltip-left", `${rect.right - 8}px`);
      tooltip.classList.add(TOOLTIP_RIGHT_CLASS);
    } else {
      tooltip.style.setProperty("--tm-tooltip-left", `${rect.left + 8}px`);
      tooltip.classList.remove(TOOLTIP_RIGHT_CLASS);
    }
  }, "positionTooltip");
  let showTooltip = /* @__PURE__ */ __name((anchorEl, item) => {
    initTooltipDom();
    const tooltipKey = getItemDynamicTooltipKey(item) || `${Date.now()}:${Math.random()}`;
    activeTooltipKey = tooltipKey;
    populateTooltip(item);
    positionTooltip(anchorEl);
    fetchDynamicTooltipData(item).then((data) => {
      if (!data || activeTooltipKey !== tooltipKey) return;
      populateTooltip(mergeDynamicTooltipItem(item, data));
      positionTooltip(anchorEl);
    });
  }, "showTooltip");
  let hideTooltip = /* @__PURE__ */ __name(() => {
    activeTooltipKey = null;
    if (globalTooltip) {
      globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS, TOOLTIP_BOTTOM_CLASS);
    }
  }, "hideTooltip");
  let getDelegatedTooltipItem = /* @__PURE__ */ __name((target) => {
    const icon = target instanceof Element ? target.closest(".tm-item-icon[data-item-id], [data-tm-tooltip-item-id], [data-item-id]") : null;
    const itemId = icon?.dataset?.tmTooltipItemId || icon?.dataset?.itemId;
    if (!itemId) return null;
    const item = ITEM_STORE.get(String(itemId)) || ITEM_STORE.get(Number(itemId));
    return item ? { icon, item } : null;
  }, "getDelegatedTooltipItem");
  let initTooltips = /* @__PURE__ */ __name(() => {
    initTooltipDom();
    if (tooltipDomInitialized) return;
    tooltipDomInitialized = true;
    pageDocument.addEventListener("mouseover", (event) => {
      const found = getDelegatedTooltipItem(event.target);
      if (!found || found.icon.contains(event.relatedTarget)) return;
      showTooltip(found.icon, found.item);
    });
    pageDocument.addEventListener("mouseout", (event) => {
      const found = getDelegatedTooltipItem(event.target);
      if (!found || found.icon.contains(event.relatedTarget)) return;
      hideTooltip();
    });
  }, "initTooltips");

  // src/components/itemIcon/itemIcon.ts
  let makeIconLink = /* @__PURE__ */ __name(({ href, iconSrc, title, className }) => {
    const a = document.createElement("a");
    a.className = `tm-icon-link ${className || ""}`.trim();
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = title;
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = title;
    a.appendChild(img);
    return a;
  }, "makeIconLink");
  let updateRenderedItemIcons = /* @__PURE__ */ __name(() => {
    document.querySelectorAll(".tm-item-icon-img[data-icon-template]").forEach((img) => {
      img.src = getItemIconUrlFromParts(
        img.dataset.iconTemplate || "",
        img.dataset.iconM || "",
        img.dataset.iconF || ""
      );
    });
  }, "updateRenderedItemIcons");

  // src/main.ts
  if (isGisaaSite) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initGisaa);
    } else {
      initGisaa();
    }
  }
  if (!isArcheageSite) {
  } else {
    const injectStyles = /* @__PURE__ */ __name(() => {
      injectItemIconStyles();
      injectMarathonStyles();
    }, "injectStyles");
    let countdownIntervalId = null;
    const startCountdownInterval = /* @__PURE__ */ __name(() => {
      if (countdownIntervalId != null) return;
      countdownIntervalId = setInterval(() => {
        document.querySelectorAll(".tm-countdown").forEach((el) => {
          const scheduleJson = el.dataset.schedule;
          if (!scheduleJson) return;
          try {
            const schedule = JSON.parse(scheduleJson);
            const seconds = getSecondsUntilNextEvent(schedule);
            updateCountdownEl(el, seconds);
          } catch {
          }
        });
      }, 1e3);
    }, "startCountdownInterval");
    const openEventsPopupWithDeps = /* @__PURE__ */ __name(() => openEventsPopup({
      loadVekselServerIdOverride,
      saveVekselServerIdOverride,
      resolveVekselUrl,
      getVekselAutoOptionText,
      loadNotificationState,
      saveNotificationState,
      updateRenderedItemIcons
    }), "openEventsPopupWithDeps");
    const checkEventNotificationsWithDeps = /* @__PURE__ */ __name(() => checkEventNotifications({
      loadNotificationState,
      saveNotificationState
    }), "checkEventNotificationsWithDeps");
    const startServerClock = /* @__PURE__ */ __name(() => initServerClock(openEventsPopupWithDeps, checkEventNotificationsWithDeps), "startServerClock");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => startServerClock());
    } else {
      startServerClock();
    }
    if (isCartPage) {
      const startCart = /* @__PURE__ */ __name(() => initCart({
        injectItemIconStyles,
        injectSelectedItemsStyles,
        injectCartStyles,
        makeItemIconLink,
        fetchText,
        getUidFromCheckUser
      }), "startCart");
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startCart);
      } else {
        startCart();
      }
    } else if (isItemRestorePage) {
      const startIR = /* @__PURE__ */ __name(() => initItemRestore({
        injectItemIconStyles,
        injectSelectedItemsStyles,
        makeItemIconLink
      }), "startIR");
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startIR);
      } else {
        startIR();
      }
    } else if (location.pathname.startsWith("/promo/marathon")) {
      const observer = new MutationObserver(() => {
        if (document.querySelector(".section.tasks")) {
          observer.disconnect();
          init({
            injectStyles,
            startCountdownInterval,
            initPrizes,
            initAutoOpenBoxesCheckbox,
            makeItemIconLink,
            makeIconLink
          });
          initTooltips();
        }
      });
      const startObserver = /* @__PURE__ */ __name(() => {
        observer.observe(document.body, { childList: true, subtree: true });
      }, "startObserver");
      if (document.body) startObserver();
      else document.addEventListener("DOMContentLoaded", startObserver);
      setTimeout(() => {
        if (!document.querySelector(".section.tasks")) {
          debugWarn("marathon tasks section did not appear after 10s", {
            path: location.pathname,
            sections: [...document.querySelectorAll("section, .section")].slice(0, 20).map((el) => ({
              tag: el.tagName,
              className: el.className,
              id: el.id,
              text: el.textContent?.trim().slice(0, 120)
            }))
          });
        }
      }, 1e4);
    }
  }
})();
