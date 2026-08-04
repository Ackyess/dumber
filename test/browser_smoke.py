#!/usr/bin/env python3
"""Headless Chromium smoke test for DUMBER's X content runtime.

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


def create_fixture_page(
    browser: Browser,
    platform: str,
    configured: bool = True,
    top_offset: int = 42,
    curate_delay_ms: int = 0,
    emphasis_delay_ms: int = 0,
) -> Page:
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
            main {{ width: 620px; margin: {top_offset}px auto 42px; }}
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
        ({ platform, configured, curateDelayMs, emphasisDelayMs }) => {
          let settings = {
            schemaVersion: 2,
            enabled: true,
            apiBaseUrl: "https://api.example.test/v1",
            apiKey: configured ? "fixture-key" : "",
            model: configured ? "fixture-model" : "",
            promotionThreshold: .72,
            xEnabled: true,
            bilibiliEnabled: false,
            personalizationEnabled: true,
            requestTimeoutMs: 12000
          };
          let profile = { schemaVersion: 2, drivers: {}, accounts: {}, topics: {}, items: {}, totalActions: 0, updatedAt: 0 };
          const storageListeners = [];
          const buildResponse = (message, overrides = {}) => ({
            ok: true,
            curations: message.items.map((item) => ({
              id: item.id,
              promote: true,
              dopamineScore: .93,
              durableValue: .18,
              primaryDriver: "identity_resonance",
              promotionLabel: "高共鸣",
              cacheHit: false,
              ...overrides
            }))
          });
          const buildEmphasisResponse = () => ({
            ok: true,
            emphasis: {
              phrases: ["惊人", "想不到"],
              cacheHit: false
            }
          });
          window.__dumberTest = {
            curateCalls: 0,
            emphasisCalls: 0,
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
                  if (curateDelayMs) {
                    await new Promise((resolve) => setTimeout(resolve, curateDelayMs));
                  }
                  if (window.__dumberTest.deferCurate) {
                    return new Promise((resolve) => {
                      window.__dumberTest.deferred.push({ message, resolve });
                    });
                  }
                  return buildResponse(message);
                }
                if (message.type === "emphasize") {
                  window.__dumberTest.emphasisCalls += 1;
                  if (emphasisDelayMs) {
                    await new Promise((resolve) => setTimeout(resolve, emphasisDelayMs));
                  }
                  return buildEmphasisResponse();
                }
                if (message.type === "preferenceAction") {
                  window.__dumberTest.preferences.push(message.action);
                  profile = window.DumberShared.applyPreferenceAction(profile, message.action, message.context);
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
        {
            "platform": platform,
            "configured": configured,
            "curateDelayMs": curate_delay_ms,
            "emphasisDelayMs": emphasis_delay_ms,
        },
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

        page = create_fixture_page(browser, "x", configured=False, emphasis_delay_ms=450)
        page.wait_for_timeout(120)
        assert page.evaluate("window.__dumberTest.curateCalls") == 0
        assert page.locator("[data-dumber-state]").count() == 0
        assert page.locator(".dumber-activity[hidden]").count() == 1
        page.locator("article").evaluate("element => { element.style.position = 'static'; }")
        layout_probe = """
          element => {
            const text = element.querySelector('[data-testid="tweetText"]');
            const cardRect = element.getBoundingClientRect();
            const textRect = text.getBoundingClientRect();
            const style = getComputedStyle(text);
            return {
              cardWidth: cardRect.width,
              cardHeight: cardRect.height,
              textWidth: textRect.width,
              textHeight: textRect.height,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
              position: getComputedStyle(element).position
            };
          }
        """
        layout_before = page.locator("article").evaluate(layout_probe)
        page.evaluate("window.__dumberTest.deferCurate = true")
        page.evaluate(
            "window.__dumberTest.updateSettings({ apiKey: 'fixture-key', model: 'fixture-model' })"
        )
        page.locator('.dumber-activity[data-phase="requesting"]').wait_for(state="visible")
        assert "Thinking…." in page.locator(".dumber-activity").inner_text()
        assert "已分析 0" in page.locator(".dumber-activity").inner_text()
        assert "已精选 0" in page.locator(".dumber-activity").inner_text()
        assert page.locator(".dumber-activity").get_attribute("role") == "status"
        assert page.locator(".dumber-activity").evaluate(
            "element => ({ width: element.offsetWidth, height: element.offsetHeight })"
        ) == {"width": 270, "height": 74}
        assert page.locator(".dumber-activity-signal").evaluate(
            "element => ({ cssWidth: element.offsetWidth, cssHeight: element.offsetHeight, width: element.width, height: element.height, running: element.dataset.running })"
        ) == {"cssWidth": 56, "cssHeight": 56, "width": 64, "height": 64, "running": "true"}
        assert page.locator(".dumber-activity-signal").evaluate(
            """canvas => {
              const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
              let chromatic = 0;
              const leaders = new Set();
              for (let i = 0; i < pixels.length; i += 4) {
                const [r, g, b, a] = pixels.slice(i, i + 4);
                if (a < 20 || Math.max(r, g, b) - Math.min(r, g, b) < 12) continue;
                chromatic += 1;
                leaders.add(r >= g && r >= b ? 'r' : g >= b ? 'g' : 'b');
              }
              return chromatic > 80 && leaders.size >= 2;
            }"""
        )
        activity_detail_layout = page.locator(".dumber-activity-detail").evaluate(
            "element => ({ visible: element.getClientRects().length > 0, top: element.getBoundingClientRect().top, labelBottom: document.querySelector('.dumber-activity-label').getBoundingClientRect().bottom })"
        )
        assert activity_detail_layout["visible"]
        assert activity_detail_layout["top"] >= activity_detail_layout["labelBottom"]
        page.emulate_media(reduced_motion="reduce")
        page.wait_for_function("document.querySelector('.dumber-activity-signal').dataset.running === 'false'")
        frozen_orb = page.locator(".dumber-activity-signal").evaluate("canvas => canvas.toDataURL()")
        page.wait_for_timeout(80)
        assert page.locator(".dumber-activity-signal").evaluate("canvas => canvas.toDataURL()") == frozen_orb
        page.evaluate("window.__dumberTest.resolveDeferred(); window.__dumberTest.deferCurate = false")
        page.locator("article.dumber-vip").wait_for(state="visible")
        page.locator('.dumber-activity[data-phase="enhancing"]').wait_for(state="visible")
        assert "Composing…." in page.locator(".dumber-activity").inner_text()
        assert page.locator(".dumber-emphasis").count() == 0
        assert page.evaluate("window.__dumberTest.emphasisCalls") == 1
        layout_phase_one = page.locator("article").evaluate(layout_probe)
        assert layout_phase_one == layout_before
        page.locator(".dumber-emphasis").first.wait_for(state="visible")
        page.wait_for_function(
            "document.querySelector('.dumber-activity').dataset.phase === 'idle'"
        )
        assert "Ready…." in page.locator(".dumber-activity").inner_text()
        assert "已分析 1" in page.locator(".dumber-activity").inner_text()
        assert "已精选 1" in page.locator(".dumber-activity").inner_text()
        layout_after = page.locator("article").evaluate(layout_probe)
        assert layout_after == layout_before
        assert page.locator(".dumber-emphasis").count() == 2
        assert page.locator(".dumber-emphasis").all_inner_texts() == ["惊人", "想不到"]
        neon_colors = page.locator(".dumber-emphasis").evaluate_all(
            "elements => elements.map((element) => element.style.getPropertyValue('--dumber-neon-a'))"
        )
        assert len(set(neon_colors)) == 2
        assert page.locator(".dumber-emphasis").evaluate_all(
            "elements => elements.every((element) => getComputedStyle(element).backgroundImage.includes('linear-gradient'))"
        )
        assert page.locator(".dumber-emphasis").first.evaluate(
            "element => getComputedStyle(element).animationName"
        ) == "none"
        assert page.locator('[data-testid="tweetText"]').inner_text() == "所有人都在讨论的惊人结论：你绝对想不到最后发生了什么。"
        assert page.locator("article.dumber-ring-outline").count() == 1
        assert page.locator("article").evaluate(
            "element => getComputedStyle(element).outlineColor"
        ) == "rgb(185, 140, 255)"
        assert page.locator(".dumber-expanded").count() == 0
        assert page.evaluate("window.__dumberTest.curateCalls") == 1
        page.close()

        page = create_fixture_page(
            browser,
            "x",
            top_offset=1800,
            curate_delay_ms=700,
        )
        page.locator("article.dumber-vip").wait_for(state="attached")
        assert page.locator("article").bounding_box()["y"] > 800
        page.wait_for_function(
            "window.__dumberTest.events.some((event) => event.type === 'decision')"
        )
        assert page.evaluate(
            "window.__dumberTest.events.find((event) => event.type === 'decision').latencyMs"
        ) == 0
        started_at = page.evaluate("performance.now()")
        page.evaluate("window.scrollTo(0, 1650)")
        page.locator("article.dumber-vip").wait_for(state="visible")
        assert page.evaluate("performance.now()") - started_at < 1000
        assert page.evaluate("window.__dumberTest.curateCalls") == 1
        page.close()

        page = create_fixture_page(browser, "x")
        page.locator("article.dumber-vip").wait_for(state="visible")
        page.locator(".dumber-emphasis").first.wait_for(state="visible")
        assert page.locator(".dumber-emphasis").first.evaluate(
            "element => getComputedStyle(element).animationName"
        ) == "dumber-emphasis-live"
        assert page.locator("article.dumber-ring-contained").count() == 1
        assert page.locator("article").evaluate(
            "element => getComputedStyle(element, '::before').content"
        ) != "none"
        ring_background = page.locator("article").evaluate(
            "element => getComputedStyle(element, '::after').backgroundImage"
        )
        assert "rgb(255, 50, 100)" in ring_background
        assert "rgb(100, 70, 255)" in ring_background
        assert "conic-gradient" in ring_background
        ring_mask = page.locator("article").evaluate(
            "element => getComputedStyle(element, '::after').webkitMaskImage"
        )
        assert "rgba(0, 0, 0, 0) 30%" in ring_mask
        assert "rgba(255, 255, 255, 0.1) 36%" in ring_mask
        assert page.locator("article").evaluate(
            "element => element.style.getPropertyValue('--dumber-beam-inner')"
        ) == ".42"
        assert page.locator("article > .dumber-beam-bloom").count() == 1
        beam_animations = page.locator("article").evaluate(
            """element => element.getAnimations({ subtree: true }).map((animation) => ({
              duration: animation.effect.getTiming().duration,
              pseudo: animation.effect.pseudoElement || null,
              name: animation.animationName || ''
            }))"""
        )
        assert any(animation["duration"] == 1960 for animation in beam_animations)
        assert any(
            animation["duration"] == 12000
            and animation["pseudo"] in {"::before", "::after"}
            and animation["name"] == "dumber-beam-hue"
            for animation in beam_animations
        )
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
        page.locator(".dumber-emphasis").first.wait_for(state="visible")
        assert page.evaluate("window.__dumberTest.curateCalls") == calls_before_repair

        page.evaluate("window.__dumberTest.deferCurate = true")
        page.locator('[data-testid="tweetText"]').evaluate(
            "element => { element.textContent = '暂停过程中返回的旧请求绝不能重新标记这张卡片。'; }"
        )
        page.wait_for_function("document.querySelector('article').dataset.dumberState === 'requesting'")
        assert page.locator("article.dumber-vip").count() == 1
        page.evaluate("window.__dumberTest.updateSettings({ enabled: false })")
        page.wait_for_function("!document.querySelector('article').classList.contains('dumber-vip')")
        page.evaluate("window.__dumberTest.resolveDeferred({ promotionLabel: '旧暂停结果' })")
        page.wait_for_timeout(80)
        assert page.locator("article.dumber-vip").count() == 0
        page.evaluate(
            "window.__dumberTest.deferCurate = false; window.__dumberTest.updateSettings({ enabled: true })"
        )
        page.locator("article.dumber-vip").wait_for(state="visible")
        page.wait_for_function(
            "document.querySelector('[data-dumber-activity-analyzed]').textContent === '2' && document.querySelector('[data-dumber-activity-selected]').textContent === '2'"
        )

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
        page.wait_for_function(
            "document.querySelector('[data-dumber-activity-analyzed]').textContent === '3' && document.querySelector('[data-dumber-activity-selected]').textContent === '3'"
        )
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

        page = create_fixture_page(browser, "x")
        page.locator("article.dumber-vip").wait_for(state="visible")
        page.locator(".dumber-emphasis").first.wait_for(state="visible")
        page.locator("article.dumber-vip").hover()
        page.locator(".dumber-sidecar-visible").wait_for(state="visible")
        page.locator('.dumber-sidecar button[data-action="less"]').click()
        page.wait_for_function("!document.querySelector('article').classList.contains('dumber-vip')")
        assert page.locator(".dumber-emphasis").count() == 0
        assert page.evaluate("window.__dumberTest.preferences") == ["less"]
        page.close()

        browser.close()


if __name__ == "__main__":
    run()
    print("browser smoke test passed")
