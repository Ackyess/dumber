#!/usr/bin/env python3
"""Headless Chromium smoke test for DUMBER's content runtime.

The test uses in-memory pages so it can run in locked-down environments that block
localhost and file:// navigation. The actual extension scripts are injected from disk.
"""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = [
    ROOT / "src" / "shared.js",
    ROOT / "src" / "adapters" / "index.js",
    ROOT / "src" / "adapters" / "x.js",
    ROOT / "src" / "adapters" / "bilibili.js",
    ROOT / "src" / "renderer.js",
    ROOT / "src" / "content.js",
]


def boxes_overlap(left: dict[str, float], right: dict[str, float]) -> bool:
    return not (
        left["x"] + left["width"] <= right["x"]
        or right["x"] + right["width"] <= left["x"]
        or left["y"] + left["height"] <= right["y"]
        or right["y"] + right["height"] <= left["y"]
    )


def fixture_markup(platform: str) -> str:
    if platform == "x":
        return """
          <article data-testid="tweet">
            <div data-testid="User-Name"><a href="/curator">Curator @curator</a></div>
            <div data-testid="tweetText">所有人都在讨论的惊人结论：你绝对想不到最后发生了什么。</div>
            <a href="/curator/status/100"><time>刚刚</time></a>
            <button data-testid="like">999</button>
          </article>
        """
    return '<div id="bewly-host"></div>'


def create_fixture_page(browser: Browser, platform: str, configured: bool = True) -> Page:
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.set_content(
        f"""
        <!doctype html>
        <html lang="zh-CN" data-dumber-platform="{platform}">
        <head>
          <meta charset="utf-8">
          <style>
            :root {{ color-scheme: light; font-family: system-ui, sans-serif; }}
            body {{ margin: 0; min-height: 1800px; background: #f2f3f6; color: #111; }}
            main {{ width: 620px; margin: 42px auto; }}
            article, .bili-video-card {{
              position: relative; display: block; margin: 0 0 28px; padding: 20px;
              background: #fff; border: 1px solid #ddd; border-radius: 16px;
            }}
            article {{ animation: fixture-host-pulse 60s linear infinite; }}
            @keyframes fixture-host-pulse {{ from {{ opacity: .999; }} to {{ opacity: 1; }} }}
            [data-testid="tweetText"], .bili-video-card__info--tit {{ font-size: 16px; line-height: 1.35; }}
            .bili-video-card__info--tit {{
              display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 1;
            }}
            .bili-video-card__stats {{ margin-top: 10px; color: #777; }}
          </style>
        </head>
        <body><main id="fixture">{fixture_markup(platform)}</main></body>
        </html>
        """
    )

    page.evaluate(
        """
        ({ platform, configured }) => {
          let settings = {
            schemaVersion: 2,
            enabled: true,
            apiBaseUrl: "https://api.example.test/v1",
            apiKey: configured ? "fixture-key" : "",
            model: configured ? "fixture-model" : "",
            promotionThreshold: .72,
            xEnabled: true,
            bilibiliEnabled: true,
            personalizationEnabled: true,
            requestTimeoutMs: 12000
          };
          let profile = { schemaVersion: 1, drivers: {}, accounts: {}, topics: {}, totalActions: 0, updatedAt: 0 };
          const storageListeners = [];
          const buildResponse = (message, overrides = {}) => ({
            ok: true,
            curations: message.items.map((item) => ({
              id: item.id,
              promote: true,
              dopamineScore: .93,
              durableValue: .18,
              primaryDriver: platform === "x" ? "identity_resonance" : "curiosity_gap",
              promotionLabel: platform === "x" ? "高共鸣" : "强好奇驱动",
              cacheHit: false,
              ...overrides
            }))
          });
          window.__dumberTest = {
            curateCalls: 0,
            preferences: [],
            events: [],
            deferCurate: false,
            deferred: [],
            updateSettings(patch) {
              const oldValue = settings;
              settings = { ...settings, ...patch };
              for (const listener of storageListeners) {
                listener({ dumberSettings: { oldValue, newValue: settings } }, "local");
              }
            },
            resolveDeferred(overrides = {}) {
              const entry = this.deferred.shift();
              if (!entry) throw new Error("No deferred curation request.");
              entry.resolve(buildResponse(entry.message, overrides));
            }
          };
          window.chrome = {
            runtime: {
              sendMessage: async (message) => {
                if (message.type === "curate") {
                  window.__dumberTest.curateCalls += 1;
                  if (window.__dumberTest.deferCurate) {
                    return new Promise((resolve) => {
                      window.__dumberTest.deferred.push({ message, resolve });
                    });
                  }
                  return buildResponse(message);
                }
                if (message.type === "preferenceAction") {
                  window.__dumberTest.preferences.push(message.action);
                  profile = { ...profile, totalActions: profile.totalActions + 1, updatedAt: Date.now() };
                  return { ok: true, profile };
                }
                if (message.type === "runtimeEvents") {
                  window.__dumberTest.events.push(...message.events);
                  return { ok: true };
                }
                return { ok: true };
              },
              getURL: (path) => path
            },
            storage: {
              local: {
                get: async (keys) => {
                  const values = { dumberSettings: settings, dumberPreferenceProfile: profile };
                  if (typeof keys === "string") return { [keys]: values[keys] };
                  return values;
                },
                set: async () => undefined
              },
              onChanged: { addListener: (listener) => storageListeners.push(listener) }
            }
          };

          if (platform === "bilibili") {
            const host = document.querySelector("#bewly-host");
            const shadow = host.attachShadow({ mode: "open" });
            shadow.innerHTML = `
              <article class="feed-card">
                <section class="bili-video-card">
                  <a href="https://www.bilibili.com/video/BV1DUMBER123">
                    <h3 class="bili-video-card__info--tit" title="这个标题完整展开以后会展示一个非常强烈的好奇缺口">这个标题完整展开以后会展示一个非常强烈的好奇缺口</h3>
                  </a>
                  <span class="bili-video-card__info--author">测试 UP 主</span>
                  <div class="bili-video-card__stats">999万播放 · 88万弹幕</div>
                </section>
              </article>
              <article id="unrelated-article"><h2>普通页面说明，不是信息流内容卡片</h2></article>
            `;
          }
        }
        """,
        {"platform": platform, "configured": configured},
    )

    for script in SCRIPTS:
        page.add_script_tag(path=str(script))
    return page


def run() -> None:
    configured = os.environ.get("CHROMIUM_PATH")
    system_chromium = Path("/usr/bin/chromium")
    with sync_playwright() as playwright:
        launch_options = {"headless": True}
        if configured:
            launch_options["executable_path"] = configured
        elif system_chromium.exists():
            launch_options["executable_path"] = str(system_chromium)
        browser = playwright.chromium.launch(**launch_options)

        page = create_fixture_page(browser, "x", configured=False)
        page.wait_for_timeout(120)
        assert page.evaluate("window.__dumberTest.curateCalls") == 0
        assert page.locator("[data-dumber-state]").count() == 0
        page.evaluate(
            "window.__dumberTest.updateSettings({ apiKey: 'fixture-key', model: 'fixture-model' })"
        )
        page.locator("article.dumber-vip").wait_for(state="visible")
        assert page.evaluate("window.__dumberTest.curateCalls") == 1
        page.close()

        page = create_fixture_page(browser, "x")
        page.locator("article.dumber-vip").wait_for(state="visible")
        assert "fixture-host-pulse" in page.locator("article").evaluate(
            "element => getComputedStyle(element).animationName"
        )
        assert page.locator(".dumber-sidecar").count() == 1
        assert page.locator(".dumber-marker").count() == 0
        page.locator("article.dumber-vip").hover()
        page.locator(".dumber-sidecar-visible").wait_for(state="visible")
        card_box = page.locator("article.dumber-vip").bounding_box()
        sidecar_box = page.locator(".dumber-sidecar-visible").bounding_box()
        assert card_box and sidecar_box and not boxes_overlap(card_box, sidecar_box)
        page.locator('.dumber-sidecar button[data-action="more"]').click()
        assert page.evaluate("window.__dumberTest.preferences") == ["more"]

        page.mouse.move(4, 4)
        page.locator('[data-testid="like"]').focus()
        page.locator(".dumber-sidecar-visible").wait_for(state="visible")

        calls_before_repair = page.evaluate("window.__dumberTest.curateCalls")
        page.locator('[data-testid="tweetText"]').evaluate(
            """element => {
              const replacement = document.createElement("div");
              replacement.dataset.testid = "tweetText";
              replacement.textContent = element.textContent;
              element.replaceWith(replacement);
            }"""
        )
        page.wait_for_function(
            "document.querySelector('[data-testid=tweetText]').classList.contains('dumber-primary')"
        )
        assert page.evaluate("window.__dumberTest.curateCalls") == calls_before_repair

        page.evaluate("window.__dumberTest.deferCurate = true")
        page.locator('[data-testid="tweetText"]').evaluate(
            "element => { element.textContent = '暂停过程中返回的旧请求绝不能重新标记这张卡片。'; }"
        )
        page.wait_for_function("document.querySelector('article').dataset.dumberState === 'requesting'")
        page.evaluate("window.__dumberTest.updateSettings({ enabled: false })")
        page.wait_for_function("!document.querySelector('article').classList.contains('dumber-vip')")
        page.evaluate("window.__dumberTest.resolveDeferred({ promotionLabel: '旧暂停结果' })")
        page.wait_for_timeout(80)
        assert page.locator("article.dumber-vip").count() == 0
        page.evaluate(
            "window.__dumberTest.deferCurate = false; window.__dumberTest.updateSettings({ enabled: true })"
        )
        page.locator("article.dumber-vip").wait_for(state="visible")

        page.evaluate("window.__dumberTest.deferCurate = true")
        page.locator('[data-testid="tweetText"]').evaluate(
            "element => { element.textContent = '模型切换时旧模型的响应必须被运行代际隔离。'; }"
        )
        page.wait_for_function("document.querySelector('article').dataset.dumberState === 'requesting'")
        page.evaluate("window.__dumberTest.updateSettings({ model: 'fixture-model-v2' })")
        page.wait_for_function("window.__dumberTest.deferred.length >= 2")
        page.evaluate("window.__dumberTest.resolveDeferred({ promotionLabel: '旧模型结果' })")
        page.wait_for_timeout(80)
        assert page.locator("article.dumber-vip").count() == 0
        page.evaluate("window.__dumberTest.resolveDeferred({ promotionLabel: '新模型精选' })")
        page.locator("article.dumber-vip").wait_for(state="visible")
        assert page.locator("article").get_attribute("data-dumber-promotion-label") == "新模型精选"
        page.evaluate("window.__dumberTest.deferCurate = false")

        old_fingerprint = page.locator("article").get_attribute("data-dumber-fingerprint")
        page.locator('[data-testid="tweetText"]').evaluate(
            "element => { element.textContent = '新的虚拟列表内容拥有完全不同的强烈情绪与好奇驱动。'; }"
        )
        page.wait_for_function(
            "oldValue => document.querySelector('article').dataset.dumberFingerprint !== oldValue",
            arg=old_fingerprint,
        )
        page.locator("article.dumber-vip").wait_for(state="visible")
        page.close()

        page = create_fixture_page(browser, "bilibili")
        page.locator(".bili-video-card.dumber-vip").wait_for(state="visible")
        assert page.locator(".bili-video-card .dumber-expanded").count() >= 1
        assert page.locator(".feed-card.dumber-vip").count() == 0
        assert page.locator("#unrelated-article.dumber-vip").count() == 0
        assert page.locator(".dumber-sidecar").count() == 1
        page.close()

        browser.close()


if __name__ == "__main__":
    run()
    print("browser smoke test passed")
