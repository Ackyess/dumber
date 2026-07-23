(function registerXAdapter(root) {
  "use strict";

  const Shared = root.DumberShared;
  const Adapters = root.DumberAdapters;
  if (!Shared || !Adapters) throw new Error("DUMBER adapter dependencies are missing.");

  const CARD_SELECTOR = 'article[data-testid="tweet"]';

  function matches(locationLike, documentLike) {
    const hostname = String(locationLike?.hostname || "").toLowerCase();
    const pathname = String(locationLike?.pathname || "");
    const preview = documentLike?.documentElement?.dataset?.dumberPlatform;
    if (preview === "x") return true;
    if (hostname !== "x.com" && hostname !== "twitter.com") return false;
    return !/^\/messages(?:\/|$)/.test(pathname);
  }

  function statusIdentity(card) {
    const timedLink = card.querySelector?.('a[href*="/status/"] time')?.closest?.("a");
    const anchor = timedLink || card.querySelector?.('a[href*="/status/"]');
    const href = anchor?.getAttribute?.("href") || anchor?.href || "";
    const match = href.match(/\/status\/(\d+)/);
    return {
      id: match?.[1] || "",
      url: href ? Adapters.absoluteUrl(href, "https://x.com/") : ""
    };
  }

  function authorContext(card) {
    const userBlock = card.querySelector?.('[data-testid="User-Name"]');
    const anchors = userBlock ? Array.from(userBlock.querySelectorAll?.('a[href^="/"]') || []) : [];
    const handleAnchor = anchors.find((anchor) => /^\/@[^/]+$/.test(anchor.getAttribute("href") || ""))
      || anchors.find((anchor) => /^\/[^/]+$/.test(anchor.getAttribute("href") || ""));
    const href = handleAnchor?.getAttribute?.("href") || "";
    const author = href.replace(/^\//, "").replace(/^@/, "").split("/")[0];
    const visible = Adapters.elementText(userBlock, 180);
    const authorName = visible
      .split(/\s+@/)[0]
      .replace(/\s*[·•]\s*$/, "")
      .trim();
    return { author, authorName };
  }

  function linkTitle(card) {
    const selectors = [
      '[data-testid="card.layoutLarge.media"] [dir="auto"]',
      '[data-testid="card.layoutSmall.detail"] [dir="auto"]',
      '[data-testid="card.wrapper"] [dir="auto"]'
    ];
    const values = selectors
      .map((selector) => Adapters.firstText?.(card, selector, 220))
      .filter(Boolean);
    if (values.length) return values[0];
    const titledLink = Array.from(card.querySelectorAll?.('a[title]') || [])
      .find((anchor) => !String(anchor.getAttribute("href") || "").includes("/status/"));
    return Adapters.elementText(titledLink, 220);
  }

  function extract(card) {
    const textElements = Array.from(card.querySelectorAll?.('[data-testid="tweetText"]') || []);
    const mainText = Adapters.elementText(textElements[0], 1600);
    if (!mainText) return null;

    const quoteText = textElements
      .slice(1)
      .map((element) => Adapters.elementText(element, 600))
      .filter(Boolean)
      .join("\n")
      .slice(0, 900);
    const status = statusIdentity(card);
    const author = authorContext(card);
    const title = linkTitle(card);
    const topics = Adapters.extractTopics([mainText, quoteText].filter(Boolean).join(" "));
    const stableId = status.id || `fallback-${Shared.hashText(`${author.author}:${mainText}:${quoteText}`)}`;

    const secondary = Adapters.uniqueElements([
      ...Array.from(card.querySelectorAll?.("time") || []),
      ...Array.from(card.querySelectorAll?.('[data-testid="socialContext"]') || []),
      ...Array.from(card.querySelectorAll?.('[data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="bookmark"]') || [])
    ]);

    return {
      card,
      stableId,
      context: {
        contentType: "post",
        text: mainText,
        author: author.author,
        authorName: author.authorName,
        quoteText,
        linkTitle: title,
        canonicalUrl: status.url,
        topics
      },
      primaryElements: Adapters.uniqueElements([
        ...textElements,
        ...Array.from(card.querySelectorAll?.('[data-testid="card.wrapper"] [dir="auto"]') || [])
      ]),
      secondaryElements: secondary,
      expandableElements: Adapters.uniqueElements(textElements),
      preferenceContext: {
        platform: "x",
        author: author.author,
        topics
      }
    };
  }

  function scan(rootNode) {
    return Adapters.queryAll(rootNode, CARD_SELECTOR)
      .filter((card) => Adapters.isUsableCard(card, 180, 80))
      .map(extract)
      .filter(Boolean);
  }

  Adapters.register("x", { matches, scan, extract, cardSelector: CARD_SELECTOR });
})(globalThis);
