(function attachDumberAdapters(root, factory) {
  const api = factory(root.DumberShared);
  root.DumberAdapters = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis, function createDumberAdapters(Shared) {
  "use strict";

  if (!Shared && typeof require === "function") Shared = require("../shared.js");
  if (!Shared) throw new Error("DumberShared is required.");

  const registry = new Map();

  function register(nameValue, adapter) {
    const name = Shared.normalizeText(nameValue).toLowerCase();
    if (!name || !adapter || typeof adapter.scan !== "function") {
      throw new TypeError("Invalid adapter registration.");
    }
    registry.set(name, Object.freeze({ ...adapter, name }));
    return registry.get(name);
  }

  function get(nameValue) {
    return registry.get(Shared.normalizeText(nameValue).toLowerCase()) || null;
  }

  function detect(locationLike, documentLike) {
    for (const adapter of registry.values()) {
      if (adapter.matches?.(locationLike, documentLike)) return adapter;
    }
    return null;
  }

  function queryAll(rootNode, selectors) {
    if (!rootNode?.querySelectorAll) return [];
    const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
    try {
      return Array.from(rootNode.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  function queryFirst(rootNode, selectors) {
    if (!rootNode?.querySelector) return null;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      try {
        const match = rootNode.querySelector(selector);
        if (match) return match;
      } catch {
        // Ignore host-page selector incompatibilities.
      }
    }
    return null;
  }

  function elementText(element, maxLength = 1600) {
    if (!element) return "";
    const text = element.getAttribute?.("title")
      || element.getAttribute?.("aria-label")
      || element.innerText
      || element.textContent
      || "";
    return Shared.normalizeMultilineText(text).slice(0, maxLength);
  }

  function firstText(rootNode, selectors, maxLength = 1600) {
    return elementText(queryFirst(rootNode, selectors), maxLength);
  }

  function uniqueElements(elements) {
    const seen = new Set();
    return (elements || []).filter((element) => {
      if (!element || seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function absoluteUrl(value, baseUrl) {
    try {
      return new URL(String(value || ""), baseUrl || "https://example.invalid/").toString();
    } catch {
      return "";
    }
  }

  function extractTopics(textValue) {
    const text = Shared.normalizeText(textValue);
    const tags = [];
    for (const match of text.matchAll(/[#＃]([^#＃\s]{1,36})/g)) {
      tags.push(match[1].toLowerCase());
      if (tags.length >= 5) break;
    }
    return [...new Set(tags)];
  }

  function isUsableCard(element, minimumWidth = 120, minimumHeight = 56) {
    if (!element?.isConnected && typeof element?.isConnected === "boolean") return false;
    if (typeof element?.getBoundingClientRect !== "function") return true;
    const rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height) return true;
    return rect.width >= minimumWidth && rect.height >= minimumHeight;
  }

  return {
    absoluteUrl,
    detect,
    elementText,
    extractTopics,
    firstText,
    get,
    isUsableCard,
    queryAll,
    queryFirst,
    register,
    uniqueElements
  };
});
