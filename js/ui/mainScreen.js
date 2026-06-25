/**
 * mainScreen.js — 主界面入口 + 门闩管线 + 对外 API
 * 对应架构文档 §4.3 主游戏入口流程, logic-flow §3 门闩4阶段
 *
 * 提供 PsyMainScreen 命名空间，实现 init() 12 步管线。
 */
(function (global) {
  "use strict";

  var BOOTSTRAP_KEY = "psydoctor_bootstrap_v1";

  // ===== DOM 缓存 =====
  var _dom = {};

  function cacheMainDom() {
    _dom = {
      headerInfo: document.getElementById("psy-header-info"),
      gate: document.getElementById("psy-bootstrap-gate"),
      gatePhases: document.getElementById("psy-gate-phases"),
      gateError: document.getElementById("psy-gate-error"),
      gateRetryBtn: document.getElementById("psy-gate-retry-btn"),
      modalRoot: document.getElementById("psy-modal-root"),
    };
  }

  function qs(id) { return document.getElementById(id); }

  // ===== 主入口 =====
  function init() {
    cacheMainDom();

    // Step 1: 绑定 UI 事件（弹窗关闭等）
    bindModalEvents();

    // Step 2: 恢复 bootstrap
    var bootstrap = restoreBootstrap();
    if (!bootstrap) {
      showFallback("未检测到角色数据，请从启动页开始。");
      return;
    }

    var fc = bootstrap.fateChoice;
    var G = bootstrap.game;

    // 保存引用
    global.PsyDoctorGame = G;
    global._psyFc = fc;

    // 更新 header
    if (_dom.headerInfo && fc) {
      _dom.headerInfo.textContent = fc.playerName + " | " + (G.doctorLevel ? G.doctorLevel.major + "·" + G.doctorLevel.minor : "");
    }

    // Step 3: 补全运行时默认值
    var PsyMainScreenPanel = global.PsyMainScreenPanel;
    if (PsyMainScreenPanel) {
      PsyMainScreenPanel.ensureGameRuntimeDefaults(G);
    }

    // Step 4: 确保周围人物数组
    if (PsyMainScreenPanel) {
      PsyMainScreenPanel.ensureNearbyPeopleArray(G);
    }

    // Step 5: 首次属性计算
    var PsychologistBaseRuntime = global.PsychologistBaseRuntime;
    if (PsychologistBaseRuntime) {
      PsychologistBaseRuntime.computePsychologistBase(G, fc);
    }

    // Step 6: 反移情检查
    var CountertransferenceTracker = global.CountertransferenceTracker;
    if (CountertransferenceTracker) {
      CountertransferenceTracker.checkRisk(G);
    }

    // Step 7: 门闩判断
    if (shouldRunBootstrapAiGate(G)) {
      runBootstrapAiGate(G, fc);
    } else {
      runNormalFirstEnterPipeline(G, fc);
    }

    // Step 8: 绑定聊天发送按钮
    var PsyMainScreenChat = global.PsyMainScreenChat;
    if (PsyMainScreenChat) {
      PsyMainScreenChat.init();
    }

    // Step 9: 绑定行动建议按钮（已由 chat 模块处理）

    // Step 10: 绑定手机端面板切换（已在 main.html 中处理）

    // Step 11: 启动自动保存
    startAutoSave(G);

    // Step 12: 注册 beforeunload
    registerBeforeUnload(G);
  }

  // ===== 恢复 Bootstrap =====
  function restoreBootstrap() {
    try {
      var raw = sessionStorage.getItem(BOOTSTRAP_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.game) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  // ===== 门闩判断 =====
  function shouldRunBootstrapAiGate(G) {
    if (!G) return false;
    // chatHistory 已有 user/assistant → 读档
    if (G.chatHistory && G.chatHistory.length > 0) {
      var hasUserAssistant = false;
      for (var i = 0; i < G.chatHistory.length; i++) {
        if (G.chatHistory[i].role === "user" || G.chatHistory[i].role === "assistant") {
          hasUserAssistant = true;
          break;
        }
      }
      if (hasUserAssistant) return false;
    }
    // 已初始化
    if (G.psyInitStateAiApplied === true) return false;
    return true;
  }

  // ===== 门闩管线 =====
  function runBootstrapAiGate(G, fc) {
    showGate(true);

    // Phase 1: 开局剧情
    gatePhase1(G, fc).then(function () {
      // Phase 2: 初始配置
      return gatePhase2(G, fc);
    }).then(function () {
      // Phase 3: 状态同步
      return gatePhase3(G, fc);
    }).then(function () {
      // Phase 4: 完成
      gatePhase4(G, fc);
    }).catch(function (err) {
      showGateError(err);
    });
  }

  // ===== Phase 1: 开局剧情 =====
  function gatePhase1(G, fc) {
    return new Promise(function (resolve, reject) {
      updateGatePhase(1, "executing");
      var startTime = Date.now();

      var PsyDoctorWorldGenerate = global.PsyDoctorWorldGenerate;
      if (!PsyDoctorWorldGenerate || !PsyDoctorWorldGenerate.runOpeningStoryStrictPromise) {
        updateGatePhase(1, "failed");
        reject(new Error("PsyDoctorWorldGenerate 不可用"));
        return;
      }

      PsyDoctorWorldGenerate.runOpeningStoryStrictPromise(fc, G, {})
        .then(function (result) {
          // 从开局叙事 AI 响应中提取行动建议并存储
          var PsyDoctorStoryGenerate = global.PsyDoctorStoryGenerate;
          if (PsyDoctorStoryGenerate && result && result.text) {
            G.chatActionSuggestions = PsyDoctorStoryGenerate.extractJSONTag(result.text, "psy_action_suggestions");
          }
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          updateGatePhase(1, "success", elapsed);
          resolve();
        })
        .catch(function (err) {
          updateGatePhase(1, "failed");
          reject(err);
        });
    });
  }

  // ===== Phase 2: 初始配置 =====
  function gatePhase2(G, fc) {
    return new Promise(function (resolve, reject) {
      updateGatePhase(2, "executing");
      var startTime = Date.now();

      var PsyDoctorInitStateGenerate = global.PsyDoctorInitStateGenerate;
      if (!PsyDoctorInitStateGenerate || !PsyDoctorInitStateGenerate.runInitStateAiIfNeeded) {
        updateGatePhase(2, "success", "0s");
        resolve();
        return;
      }

      // 获取叙事正文
      var storyBody = "";
      if (G.chatHistory && G.chatHistory.length > 0) {
        for (var i = G.chatHistory.length - 1; i >= 0; i--) {
          if (G.chatHistory[i].role === "assistant") {
            var re = /<psy_story_body>([\s\S]*?)<\/psy_story_body>/i;
            var m = re.exec(G.chatHistory[i].content || "");
            storyBody = m ? m[1].trim() : G.chatHistory[i].content;
            break;
          }
        }
      }

      PsyDoctorInitStateGenerate.runInitStateAiIfNeeded(fc, G, storyBody, {})
        .then(function (result) {
          if (result && result.skipped) {
            // 如果跳过了（可能已有配置），仍然标记为完成
            if (G && !G.psyInitStateAiApplied) G.psyInitStateAiApplied = true;
          }
          // 重算属性
          var PsychologistBaseRuntime = global.PsychologistBaseRuntime;
          if (PsychologistBaseRuntime) {
            PsychologistBaseRuntime.computePsychologistBase(G, fc);
          }
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          updateGatePhase(2, "success", elapsed);
          resolve();
        })
        .catch(function (err) {
          updateGatePhase(2, "failed");
          reject(err);
        });
    });
  }

  // ===== Phase 3: 状态同步 =====
  function gatePhase3(G, fc) {
    return new Promise(function (resolve, reject) {
      updateGatePhase(3, "executing");
      var startTime = Date.now();

      var PsyMainScreenChat = global.PsyMainScreenChat;
      if (!PsyMainScreenChat) {
        updateGatePhase(3, "success", "0s");
        resolve();
        return;
      }

      // 用状态 AI 同步初始状态
      var PsyDoctorStateGenerate = global.PsyDoctorStateGenerate;
      if (!PsyDoctorStateGenerate) {
        updateGatePhase(3, "success", "0s");
        resolve();
        return;
      }

      // 构建门闩专用提示
      var gatePrompt = "开局配置 AI 已写回初始藏书、工具与 8+2 属性。本回合请以周围人物为主：剧情中出现的同学、老师、同行须在 <psy_nearby_people> 给出完整列表；根据当前叙事生成合适的初始行动建议。";

      // 将 gatePrompt 作为"用户消息"处理（但不添加到 chatHistory）
      PsyDoctorStateGenerate.sendTurn(G, fc, gatePrompt, {
        isGatePhase: true,
      }).then(function () {
        var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        updateGatePhase(3, "success", elapsed);
        resolve();
      }).catch(function (err) {
        updateGatePhase(3, "failed");
        reject(err);
      });
    });
  }

  // ===== Phase 4: 完成 =====
  function gatePhase4(G, fc) {
    var startTime = Date.now();
    updateGatePhase(4, "executing");

    // 刷新所有面板
    var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
    if (PsyMainScreenPanelUi) {
      PsyMainScreenPanelUi.renderLeftPanel(fc, G);
      PsyMainScreenPanelUi.renderRightPanel(G);
      PsyMainScreenPanelUi.renderChatHistory(G);
    }

    // 渲染开局行动建议按钮
    if (G.chatActionSuggestions) {
      var PsyMainScreenChat = global.PsyMainScreenChat;
      if (PsyMainScreenChat && PsyMainScreenChat.renderActionSuggestions) {
        PsyMainScreenChat.renderActionSuggestions(G.chatActionSuggestions);
      }
    }

    // 持久化
    var PsyMainScreenPanel = global.PsyMainScreenPanel;
    if (PsyMainScreenPanel) {
      PsyMainScreenPanel.autoSave();
    }

    // 同步知识基底
    var PsyDoctorWorldBook = global.PsyDoctorWorldBook;
    if (PsyDoctorWorldBook) {
      PsyDoctorWorldBook.syncToBridgeStorage();
    }

    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    updateGatePhase(4, "success", elapsed);

    // 隐藏门闩
    setTimeout(function () {
      showGate(false);
    }, 500);
  }

  // ===== 正常首次进入管线 =====
  function runNormalFirstEnterPipeline(G, fc) {
    // 渲染面板
    var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
    if (PsyMainScreenPanelUi) {
      PsyMainScreenPanelUi.renderLeftPanel(fc, G);
      PsyMainScreenPanelUi.renderRightPanel(G);
      PsyMainScreenPanelUi.renderChatHistory(G);
    }

    // 自动保存
    var PsyMainScreenPanel = global.PsyMainScreenPanel;
    if (PsyMainScreenPanel) {
      PsyMainScreenPanel.autoSave();
    }
  }

  // ===== 门闩 UI 控制 =====
  function showGate(visible) {
    var gate = _dom.gate;
    if (!gate) return;
    if (visible) {
      gate.classList.remove("hidden");
      gate.setAttribute("aria-hidden", "false");
    } else {
      gate.classList.add("hidden");
      gate.setAttribute("aria-hidden", "true");
    }
  }

  function updateGatePhase(phase, status, time) {
    var phaseEl = qs("psy-gate-phase-" + phase);
    if (!phaseEl) return;

    // 移除所有状态类
    phaseEl.classList.remove("psy-gate-phase--waiting", "psy-gate-phase--executing", "psy-gate-phase--success", "psy-gate-phase--failed");

    var iconMap = { waiting: "○", executing: "◌", success: "✓", failed: "✗" };
    var icon = phaseEl.querySelector(".psy-gate-phase-icon");
    if (icon) icon.textContent = iconMap[status] || "○";

    phaseEl.classList.add("psy-gate-phase--" + status);

    var timeEl = qs("psy-gate-time-" + phase);
    if (timeEl && time) {
      timeEl.textContent = "(" + time + ")";
    }

    // 隐藏错误
    if (status !== "failed") {
      var errorEl = _dom.gateError;
      if (errorEl) errorEl.classList.add("hidden");
    }
  }

  function showGateError(err) {
    var errorEl = _dom.gateError;
    var retryBtn = _dom.gateRetryBtn;
    if (errorEl) {
      errorEl.textContent = "错误: " + (err.message || err);
      errorEl.classList.remove("hidden");
    }
    if (retryBtn) retryBtn.classList.remove("hidden");
  }

  // ===== 弹窗事件 =====
  function bindModalEvents() {
    var root = _dom.modalRoot;
    if (!root) return;
    // 关闭按钮
    root.querySelectorAll("[data-psy-modal-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        root.classList.add("hidden");
        root.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      });
    });
    // 关闭按钮 x
    var closeBtn = root.querySelector(".psy-modal-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        root.classList.add("hidden");
        root.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      });
    }
    // Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        root.classList.add("hidden");
        document.body.style.overflow = "";
      }
    });
  }

  // ===== 自动保存 =====
  function startAutoSave(G) {
    setInterval(function () {
      var PsyMainScreenPanel = global.PsyMainScreenPanel;
      if (PsyMainScreenPanel) {
        PsyMainScreenPanel.autoSave();
      }
    }, 4000);
  }

  function registerBeforeUnload(G) {
    window.addEventListener("beforeunload", function () {
      var PsyMainScreenPanel = global.PsyMainScreenPanel;
      if (PsyMainScreenPanel) {
        PsyMainScreenPanel.autoSave();
      }
    });
  }

  // ===== 兜底 =====
  function showFallback(msg) {
    if (_dom.headerInfo) _dom.headerInfo.textContent = msg || "数据加载失败";
  }

  // ===== 暴露 API =====
  global.PsyMainScreen = {
    init: init,
    shouldRunBootstrapAiGate: shouldRunBootstrapAiGate,
    gatePhase1: gatePhase1,
    gatePhase2: gatePhase2,
    gatePhase3: gatePhase3,
    gatePhase4: gatePhase4,
  };
})(typeof window !== "undefined" ? window : globalThis);
