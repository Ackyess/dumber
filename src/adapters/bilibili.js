(function registerBilibiliAdapter(root) {
  "use strict";

  const Shared = root.DumberShared;
  const Adapters = root.DumberAdapters;
  if (!Shared || !Adapters) throw new Error("DUMBER adapter dependencies are missing.");

  const CARD_SELECTORS = Object.freeze([
    ".bili-video-card",
    ".feed-card",
    ".video-page-card-small",
    ".bili-dyn-item",
    ".video-card",
    ".floor-single-card",
    ".bili-dyn-list__item",
    "article"
  ]);
  const SPECIFIC_CARD_SELECTORS = Object.freeze(CARD_SELECTORS.filter((selector) => selector !== "article"));

  const TITLE_SELECTORS = Object.freeze([
    ".bili-video-card__info--tit",
    ".bili-video-card__info--title",
    ".video-name",
    ".title",
    ".bili-dyn-content__orig__desc",
    ".dyn-card-opus__title",
    "h1",
    "h2",
    "h3",
    "a[title]"
  ]);

  const DESCRIPTION_SELECTORS = Object.freeze([
    ".bili-dyn-item__desc",
    ".dyn-card-opus__summary",
    ".description",
    ".desc",
    "[class*='description']"
  ]);

  const AUTHOR_SELECTORS = Object.freeze([
    ".bili-video-card__info--author",
    ".up-name",
    ".author",
    ".bili-dyn-title__text",
    "[class*='up-name']",
    "[class*='author']"
  ]);

  function matches(locationLike, documentLike) {
    const hostname = String(locationLike?.hostname || "").toLowerCase();
    const preview = documentLike?.documentElement?.dataset?.dumberPlatform;
    return hostname === "bilibili.com" || hostname.endsWith(".bilibili.com") || preview === "bilibili";
  }

  function identity(card) {
    const videoAnchor = card.matches?.('a[href*="/video/BV"]')
      ? card
      : card.querySelector?.('a[href*="/video/BV"], a[href*="bilibili.com/video/BV"]');
    const href = videoAnchor?.getAttribute?.("href") || videoAnchor?.href || "";
    const bv = href.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1];
    if (bv) return { id: bv, url: Adapters.absoluteUrl(href, "https://www.bilibili.com/") };

    const dynamicAnchor = card.matches?.('a[href*="/opus/"], a[href*="/dynamic/"]')
      ? card
      : card.querySelector?.('a[href*="/opus/"], a[href*="/dynamic/"]');
    const dynamicHref = dynamicAnchor?.getAttribute?.("href") || dynamicAnchor?.href || "";
    const dynamicId = dynamicHref.match(/\/(?:opus|dynamic)\/(\d+)/)?.[1]
      || card.getAttribute?.("data-did")
      || card.getAttribute?.("data-dynamic-id")
      || "";
    return {
      id: dynamicId ? `dynamic-${dynamicId}` : "",
      url: dynamicHref ? Adapters.absoluteUrl(dynamicHref, "https://www.bilibili.com/") : ""
    };
  }

  function firstMatchingElement(card, selectors) {
    if (card.matches) {
      for (const selector of selectors) {
        try {
          if (card.matches(selector)) return card;
        } catch {
          // Ignore unsupported host selectors.
        }
      }
    }
    return Adapters.queryFirst(card, selectors);
  }

  function collectTagText(card) {
    const tagElements = Adapters.queryAll(card, [
      ".tag",
      ".bili-video-card__info--tag",
      "[class*='topic']",
      "[class*='tag']"
    ]).slice(0, 8);
    const explicit = tagElements
      .map((element) => Adapters.elementText(element, 48))
      .filter((text) => text && text.length <= 48);
    return [...new Set([...explicit, ...Adapters.extractTopics(card.innerText || "")])].slice(0, 8);
  }

  function extract(card) {
    const itemIdentity = identity(card);
    const genericArticle = card.matches?.("article")
      && !SPECIFIC_CARD_SELECTORS.some((selector) => {
        try {
          return card.matches(selector);
        } catch {
          return false;
        }
      });
    if (genericArticle && !itemIdentity.id && !itemIdentity.url) return null;

    const titleElement = firstMatchingElement(card, TITLE_SELECTORS);
    const descriptionElement = firstMatchingElement(card, DESCRIPTION_SELECTORS);
    const authorElement = firstMatchingElement(card, AUTHOR_SELECTORS);
    let title = Adapters.elementText(titleElement, 700);
    const description = Adapters.elementText(descriptionElement, 900);
    const author = Adapters.elementText(authorElement, 160)
      .replace(/^UP主[:：]?\s*/i, "")
      .trim();

    if (!title) {
      title = Shared.normalizeMultilineText(card.innerText || card.textContent || "").slice(0, 700);
    }
    if (!title || title.length < 4) return null;

    const topics = collectTagText(card);
    const stableId = itemIdentity.id
      || `fallback-${Shared.hashText(`${title}:${author}:${description}`)}`;

    const primaryElements = Adapters.uniqueElements([titleElement, descriptionElement].filter(Boolean));
    const secondaryElements = Adapters.uniqueElements(Adapters.queryAll(card, [
      ".bili-video-card__stats",
      ".bili-video-card__info--bottom",
      ".video-page-card-small__info--time",
      ".stats",
      ".meta",
      "[class*='stat']",
      "[class*='play']",
      "[class*='danmaku']"
    ]).slice(0, 12));

    return {
      card,
      stableId,
      context: {
        contentType: itemIdentity.id?.startsWith("dynamic-") ? "dynamic" : "video",
        title,
        author,
        description,
        tags: topics,
        canonicalUrl: itemIdentity.url
      },
      primaryElements,
      secondaryElements,
      expandableElements: primaryElements,
      preferenceContext: {
        platform: "bilibili",
        author,
        topics
      }
    };
  }

  function scan(rootNode) {
    const acceptedCards = [];
    const cards = Adapters.queryAll(rootNode, CARD_SELECTORS)
      .sort((left, right) => nodeDepth(right) - nodeDepth(left));
    const results = [];

    for (const card of cards) {
      if (acceptedCards.some((accepted) => card === accepted || card.contains?.(accepted))) continue;
      if (!Adapters.isUsableCard(card, 140, 64)) continue;
      const result = extract(card);
      if (!result) continue;
      acceptedCards.push(card);
      results.push(result);
    }

    for (const anchor of Adapters.queryAll(rootNode, 'a[href*="/video/BV"], a[href*="bilibili.com/video/BV"]')) {
      const card = anchor.closest?.(CARD_SELECTORS.join(",")) || anchor;
      if (acceptedCards.some((accepted) => card === accepted || card.contains?.(accepted))) continue;
      if (!Adapters.isUsableCard(card, 140, 64)) continue;
      const result = extract(card);
      if (!result) continue;
      acceptedCards.push(card);
      results.push(result);
    }
    return results;
  }

  function nodeDepth(node) {
    let depth = 0;
    for (let current = node; current?.parentNode; current = current.parentNode) depth += 1;
    return depth;
  }

  Adapters.register("bilibili", {
    matches,
    scan,
    extract,
    cardSelectors: CARD_SELECTORS
  });
})(globalThis);
