/**
 * dev_api_config.js — 开发环境 API 配置默认值
 *
 * 在开发期间自动设置测试 API key 到 localStorage，使 bridge.js 能自动加载。
 * - 仅当 localStorage 中尚无 API 配置时写入（不覆盖用户设置）
 * - 暴露 PsyDevApiConfig.setupTestConfig() 供单元测试/验证脚本使用
 * - 生产环境下不会影响已有用户配置
 *
 * 对应架构文档 §14.1 API 桥接层三级优先级：
 *   1. localStorage IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1（用户设置）→ 优先
 *   2. FIXED_PRESET（代码默认）→ 由本脚本注入
 *   3. DEFAULT_CFG.defaultPresetTemplate（兜底）
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "IMMORTAL_ST_BRIDGE_API_OVERRIDE_V1";

  // 测试 API 配置（从 spec/test_api_key.md 读取）
  var TEST_API_CONFIG = {
    apiUrl: "https://api.xiaomimimo.com/v1",
    apiKey: "sk-ctse83m34bn0iyxjac52k08uo8cwab39c0m0evx67hf4u5n7",
    model: "mimo-v2-flash",
  };

  /**
   * 检查 localStorage 中是否已有有效的 API 配置
   */
  function hasExistingConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return false;
      var apiUrl = o.apiUrl != null ? String(o.apiUrl).trim() : "";
      var model  = o.model  != null ? String(o.model).trim()  : "";
      if (!apiUrl || !model) return false;
      // 如果有有效 URL 和 model 就算已配置
      return true;
    } catch (_e) {
      return false;
    }
  }

  /**
   * 写入测试 API 配置到 localStorage（仅当不存在已有配置时）
   * @param {boolean} force  强制覆写（供测试使用）
   * @returns {boolean} 是否写入成功
   */
  function ensureTestConfig(force) {
    if (!force && hasExistingConfig()) {
      return false; // 已有用户配置，不覆写
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_API_CONFIG));
      return true;
    } catch (e) {
      console.warn("[dev_api_config] 写入失败:", e);
      return false;
    }
  }

  /**
   * 强制设置测试配置（供单元测试/验证脚本使用）
   */
  function setupTestConfig() {
    return ensureTestConfig(true);
  }

  /**
   * 获取当前生效的 API 配置摘要
   */
  function getActiveConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { source: "none" };
      var o = JSON.parse(raw);
      return {
        source: "localStorage",
        apiUrl: o.apiUrl ? o.apiUrl.replace(/\/v1.*/, "/...") : "?",
        model: o.model || "?",
        hasKey: !!(o.apiKey),
      };
    } catch (e) {
      return { source: "error", error: e.message };
    }
  }

  // ===== 自动执行：在页面加载时确保测试配置 =====
  // 使用 try-catch 确保不干扰页面其他逻辑
  try {
    if (typeof localStorage !== "undefined") {
      ensureTestConfig(false);
    }
  } catch (_e) {
    // 静默失败（非浏览器环境或 localStorage 不可用）
  }

  // ===== 暴露 API =====
  global.PsyDevApiConfig = {
    TEST_API_CONFIG: TEST_API_CONFIG,
    STORAGE_KEY: STORAGE_KEY,
    hasExistingConfig: hasExistingConfig,
    ensureTestConfig: ensureTestConfig,
    setupTestConfig: setupTestConfig,
    getActiveConfig: getActiveConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
