(() => {
  "use strict";

  const Shared = DumberShared;
  const form = document.querySelector("#settings-form");
  const apiBaseUrl = document.querySelector("#api-base-url");
  const apiKey = document.querySelector("#api-key");
  const model = document.querySelector("#model");
  const threshold = document.querySelector("#promotion-threshold");
  const thresholdOutput = document.querySelector("#threshold-output");
  const xEnabled = document.querySelector("#x-enabled");
  const personalizationEnabled = document.querySelector("#personalization-enabled");
  const testButton = document.querySelector("#test-button");
  const toggleKeyButton = document.querySelector("#toggle-key");
  const exportButton = document.querySelector("#export-button");
  const clearButton = document.querySelector("#clear-button");
  const status = document.querySelector("#status");
  const saveButton = form.querySelector('button[type="submit"]');
  const cacheCount = document.querySelector("#cache-count");
  const profileActions = document.querySelector("#profile-actions");
  const visualP95 = document.querySelector("#visual-p95");
  let globalEnabled = true;
  let requestTimeoutMs = Shared.DEFAULT_SETTINGS.requestTimeoutMs;
  let savedOrigin = "";

  void load().catch((error) => showStatus(error?.message || "设置加载失败。", "error"));

  threshold.addEventListener("input", updateThreshold);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save().catch(() => undefined);
  });
  testButton.addEventListener("click", () => void testConnection());
  toggleKeyButton.addEventListener("click", toggleKeyVisibility);
  exportButton.addEventListener("click", () => void exportData());
  clearButton.addEventListener("click", () => void clearData());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[Shared.SETTINGS_KEY]) return;
    const next = Shared.sanitizeSettings(changes[Shared.SETTINGS_KEY].newValue);
    globalEnabled = next.enabled;
    requestTimeoutMs = next.requestTimeoutMs;
    savedOrigin = Shared.toOriginPattern(next.apiBaseUrl);
  });

  async function load() {
    const stored = await chrome.storage.local.get(Shared.SETTINGS_KEY);
    const settings = Shared.sanitizeSettings(stored[Shared.SETTINGS_KEY]);
    globalEnabled = settings.enabled;
    requestTimeoutMs = settings.requestTimeoutMs;
    savedOrigin = Shared.toOriginPattern(settings.apiBaseUrl);
    apiBaseUrl.value = settings.apiBaseUrl;
    apiKey.value = settings.apiKey;
    model.value = settings.model;
    threshold.value = settings.promotionThreshold;
    xEnabled.checked = settings.xEnabled;
    personalizationEnabled.checked = settings.personalizationEnabled;
    updateThreshold();
    await refreshDashboard();
  }

  function readForm() {
    return {
      schemaVersion: Shared.SETTINGS_SCHEMA_VERSION,
      enabled: globalEnabled,
      apiBaseUrl: apiBaseUrl.value,
      apiKey: apiKey.value,
      model: model.value,
      promotionThreshold: threshold.value,
      xEnabled: xEnabled.checked,
      bilibiliEnabled: false,
      personalizationEnabled: personalizationEnabled.checked,
      requestTimeoutMs
    };
  }

  async function save(showSuccess = true) {
    setBusy(saveButton, true);
    try {
      const validation = Shared.validateSettings(readForm());
      if (!validation.ok) throw new Error(validation.problems[0]);
      const nextOrigin = Shared.toOriginPattern(validation.settings.apiBaseUrl);
      const previousOrigin = savedOrigin;
      await ensureEndpointPermission(validation.settings.apiBaseUrl);
      await chrome.storage.local.set({ [Shared.SETTINGS_KEY]: validation.settings });
      savedOrigin = nextOrigin;
      if (previousOrigin && previousOrigin !== nextOrigin) {
        await chrome.permissions.remove({ origins: [previousOrigin] }).catch(() => false);
      }
      if (showSuccess) showStatus("设置已保存，新的策展配置会立即生效。", "success");
      await refreshDashboard();
      return validation.settings;
    } catch (error) {
      showStatus(error?.message || "设置保存失败。", "error");
      throw error;
    } finally {
      setBusy(saveButton, false);
    }
  }

  async function ensureEndpointPermission(value) {
    const origin = Shared.toOriginPattern(value);
    // This call is deliberately the first awaited operation in the submit/click path,
    // so Chrome still associates it with the user's gesture.
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error("需要允许扩展访问该 API 地址。");
  }

  async function testConnection() {
    setBusy(testButton, true);
    showStatus("正在验证接口、模型和结构化策展结果…");
    try {
      await save(false);
      const response = await chrome.runtime.sendMessage({ type: "testConnection" });
      if (!response?.ok) throw new Error(response?.error || "连接测试失败");
      const latencyMs = Math.max(0, Math.round(Number(response.latencyMs) || 0));
      if (latencyMs >= Shared.VISUAL_SLA_MS) {
        throw new Error(`连接可用，但冷请求耗时 ${latencyMs}ms，未达到 1 秒 SLA。请检查网络或改用更快的 API 服务。`);
      }
      showStatus(`连接正常，冷请求 ${latencyMs}ms。`, "success");
      await refreshDashboard();
    } catch (error) {
      showStatus(error?.message || "连接测试失败。", "error");
    } finally {
      setBusy(testButton, false);
    }
  }

  async function refreshDashboard() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "getDashboard" });
      if (!response?.ok) throw new Error(response?.error || "无法读取本地状态");
      cacheCount.textContent = String(response.cache?.entries ?? 0);
      profileActions.textContent = String(response.profile?.totalActions ?? 0);
      const p95 = Number(response.metrics?.visualP95 || 0);
      visualP95.textContent = p95 ? formatDuration(p95) : "—";
    } catch {
      cacheCount.textContent = "—";
      profileActions.textContent = "—";
      visualP95.textContent = "—";
    }
  }

  async function exportData() {
    setBusy(exportButton, true);
    try {
      const response = await chrome.runtime.sendMessage({ type: "exportLocalData" });
      if (!response?.ok) throw new Error(response?.error || "导出失败");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dumber-local-data-${Shared.localDateKey()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus("本地数据已导出；API Key 未包含在导出文件中。", "success");
    } catch (error) {
      showStatus(error?.message || "导出失败。", "error");
    } finally {
      setBusy(exportButton, false);
    }
  }

  async function clearData() {
    const confirmed = window.confirm("清除模型缓存、偏好画像和工程指标？API 配置与总开关会保留。");
    if (!confirmed) return;
    setBusy(clearButton, true);
    try {
      const response = await chrome.runtime.sendMessage({ type: "clearLocalData" });
      if (!response?.ok) throw new Error(response?.error || "清除失败");
      showStatus("本地缓存、偏好与指标已清除。", "success");
      await refreshDashboard();
    } catch (error) {
      showStatus(error?.message || "清除失败。", "error");
    } finally {
      setBusy(clearButton, false);
    }
  }

  function updateThreshold() {
    const value = Number(threshold.value);
    const label = value <= 0.35 ? "最强检测" : value <= 0.6 ? "更多" : value >= 0.82 ? "更严格" : "均衡";
    thresholdOutput.value = `${label} · ${Math.round(value * 100)}%`;
  }

  function toggleKeyVisibility() {
    const visible = apiKey.type === "text";
    apiKey.type = visible ? "password" : "text";
    toggleKeyButton.textContent = visible ? "显示" : "隐藏";
    toggleKeyButton.setAttribute("aria-label", visible ? "显示 API Key" : "隐藏 API Key");
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  }

  function formatDuration(milliseconds) {
    return milliseconds < 1000
      ? `${Math.round(milliseconds)} ms`
      : `${(milliseconds / 1000).toFixed(1)} s`;
  }

  function showStatus(message, kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }
})();
