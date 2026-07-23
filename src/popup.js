(() => {
  "use strict";

  const Shared = DumberShared;
  const enabled = document.querySelector("#enabled");
  const state = document.querySelector("#state");
  const promotions = document.querySelector("#promotions");
  const streak = document.querySelector("#streak");
  const cacheRate = document.querySelector("#cache-rate");
  let loadGeneration = 0;

  void load();

  enabled.addEventListener("change", async () => {
    const requested = enabled.checked;
    enabled.disabled = true;
    try {
      const stored = await chrome.storage.local.get(Shared.SETTINGS_KEY);
      const settings = Shared.sanitizeSettings(stored[Shared.SETTINGS_KEY]);
      settings.enabled = requested;
      await chrome.storage.local.set({ [Shared.SETTINGS_KEY]: settings });
      await load();
    } catch (error) {
      enabled.checked = !requested;
      state.textContent = error?.message || "无法更新策展开关";
    } finally {
      enabled.disabled = false;
    }
  });

  document.querySelector("#settings").addEventListener("click", () => {
    void chrome.runtime.openOptionsPage().catch((error) => {
      state.textContent = error?.message || "无法打开策展设置";
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes[Shared.SETTINGS_KEY] || changes[Shared.METRICS_KEY])) {
      void load();
    }
  });

  async function load() {
    const generation = ++loadGeneration;
    try {
      const response = await chrome.runtime.sendMessage({ type: "getDashboard" });
      if (generation !== loadGeneration) return;
      if (!response?.ok) throw new Error(response?.error || "无法读取状态");
      const settings = response.settings;
      enabled.checked = settings.enabled;
      state.textContent = !response.credentialsConfigured
        ? "等待配置模型"
        : !response.endpointPermission
          ? "等待 API 访问权限"
        : settings.enabled
          ? "正在策展信息流"
          : "策展已暂停";
      promotions.textContent = String(response.metrics?.promotions ?? 0);
      streak.textContent = String(response.metrics?.currentStreak ?? 0);
      cacheRate.textContent = `${Math.round(Number(response.metrics?.cacheHitRate || 0) * 100)}%`;
    } catch (error) {
      if (generation !== loadGeneration) return;
      state.textContent = error?.message || "无法读取策展状态";
      promotions.textContent = "—";
      streak.textContent = "—";
      cacheRate.textContent = "—";
    }
  }
})();
