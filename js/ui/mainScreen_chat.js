/**
 * mainScreen_chat.js — 聊天 UI + AI 回合编排 + 个案触发
 * 对应架构文档 §4.1 完整回合序列, logic-flow §4.1
 *
 * 提供 PsyMainScreenChat 命名空间。
 */
(function (global) {
  "use strict";

  var AI_GENERATING_FLAG = "PSY_AI_GENERATING";

  // ===== DOM 缓存 =====
  var _dom = {};

  function cacheDom() {
    _dom = {
      chatLog: document.getElementById("psy-chat-log"),
      chatInput: document.getElementById("psy-chat-input"),
      sendBtn: document.getElementById("psy-chat-send-btn"),
      suggestionArea: document.getElementById("psy-chat-suggestions"),
      status: document.getElementById("psy-chat-status"),
      processLogStory: document.getElementById("psy-ai-process-log-story"),
      processLogState: document.getElementById("psy-ai-process-log-state"),
    };
  }

  function qs(id) { return document.getElementById(id); }

  // ===== 获取 G =====
  function getGame() {
    return global.PsyDoctorGame || null;
  }

  // ===== 初始化 =====
  function init() {
    cacheDom();
    bindSendButton();
    bindSuggestionButtons();
  }

  // ===== 绑定发送按钮 =====
  function bindSendButton() {
    var btn = _dom.sendBtn;
    var input = _dom.chatInput;
    if (!btn || !input) return;

    // 移除已绑定的（避免重复）
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    _dom.sendBtn = newBtn;

    newBtn.addEventListener("click", function () {
      var text = input.value.trim();
      if (!text) return;
      handleChatSend(text);
      input.value = "";
      input.style.height = "auto";
    });
  }

  // ===== 绑定建议按钮 =====
  function bindSuggestionButtons() {
    var area = _dom.suggestionArea;
    if (!area) return;
    area.querySelectorAll(".psy-suggestion-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = this.textContent || this.getAttribute("data-text") || "";
        if (text) handleChatSend(text);
      });
    });
  }

  // ===== 完整回合序列 =====
  function handleChatSend(userText) {
    var G = getGame();
    if (!G) {
      appendChatMessage("游戏尚未加载，请先完成人生选择。", "system");
      return;
    }

    // 1.1 校验
    if (!userText || !userText.trim()) return;
    if (global[AI_GENERATING_FLAG]) {
      appendChatMessage("AI 正在生成中，请稍候…", "system");
      return;
    }
    if (G.activeCaseSession) {
      appendChatMessage("正在进行个案会话，请先完成当前会话。", "system");
      return;
    }
    if (G.activeEthicalDilemma) {
      appendChatMessage("请先处理当前的伦理困境。", "system");
      return;
    }

    // 1.2 预处理
    var trimmed = userText.trim();
    G.chatHistory.push({ role: "user", content: trimmed });
    appendChatMessage(trimmed, "user");
    setGenerating(true);

    var fc = G.fateChoice;

    // Step 2: 叙事 AI
    runStoryAiTurn(trimmed, G, fc).then(function (storyResult) {
      // Step 3: 显示行动建议
      if (storyResult && storyResult.actionSuggestions) {
        renderActionSuggestions(storyResult.actionSuggestions);
      }

      // Step 4: 状态 AI
      return runStateAiTurn(storyResult ? storyResult.storyBody : trimmed, G, fc);
    }).then(function () {
      // Step 5: 后处理与触发器检查
      postProcessChecks(G);
      // Step 6: 刷新 UI
      refreshUI(G);
      setGenerating(false);
    }).catch(function (err) {
      var log = global.GameLog || global.console;
      (log.warn || console.warn)("[psy:ai] 回合失败:", err);
      appendChatMessage("AI 响应出错：" + (err.message || err), "system");
      setGenerating(false);
    });
  }

  // ===== 叙事 AI 回合 =====
  function runStoryAiTurn(userText, G, fc) {
    showStatus("思考中...");

    var PsyDoctorStoryGenerate = global.PsyDoctorStoryGenerate;
    if (!PsyDoctorStoryGenerate || !PsyDoctorStoryGenerate.sendTurn) {
      appendChatMessage("叙事 AI 模块尚未加载", "system");
      return Promise.resolve(null);
    }

    var startTime = Date.now();
    showProcessLog("story", "叙事 AI 生成中…");

    return PsyDoctorStoryGenerate.sendTurn(userText, G, fc, {
      onChunk: function (chunk, full) {
        // 流式输出：用前置过滤器只显示 <psy_story_body> 内的内容，隐藏推理文本
        var visible = PsyDoctorStoryGenerate.visibleNarrativeForStreamingChunk(full);
        if (visible) {
          appendChatMessage(visible, "assistant", true);
        } else if (full && full.indexOf("<psy_story_body>") < 0) {
          // 还没出现正文标签时完全隐藏（模型仍在输出推理）
        }
      },
      onError: function (err) {
        showProcessLog("story", "叙事 AI 失败", true);
      },
    }).then(function (response) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      showProcessLog("story", "叙事 AI 完成 (" + elapsed + "s)", true);

      // 写入 chatHistory（完整含标签）
      if (response && response.text) {
        G.chatHistory.push({ role: "assistant", content: response.text });
      }

      // 完整管线解析，用 resolveStoryReplyForPipeline 而非简单提取
      var storyToShow = response && response.storyBody ? response.storyBody : stripPsyTags(response ? response.text : "");
      if (storyToShow) {
        var log = _dom.chatLog;
        if (log) {
          var lastAssistant = log.querySelector(".psy-chat-msg--assistant:last-child");
          if (lastAssistant) {
            // 替换流式渲染的原始文本为干净正文
            var cleaned = PsyDoctorStoryGenerate.stripStoryAiMetaLeakFromNarrative(storyToShow);
            lastAssistant.textContent = cleaned || storyToShow;
          } else {
            // 非流式模式，直接追加（已经过 pipeline 剥离）
            appendChatMessage(storyToShow, "assistant");
          }
        }
      }

      // 检查个案触发
      if (response && response.caseSessionTrigger) {
        G.pendingCaseSession = response.caseSessionTrigger;
      }

      // 检查伦理困境
      if (response && response.ethicalDilemma) {
        var EthicsDilemmaEngine = global.EthicsDilemmaEngine;
        if (EthicsDilemmaEngine) {
          var dilemma = EthicsDilemmaEngine.createDilemma(
            response.ethicalDilemma.dilemmaType || response.ethicalDilemma.type,
            response.ethicalDilemma.sceneId
          );
          if (dilemma) G.activeEthicalDilemma = dilemma;
        }
      }

      showStatus("状态同步中...");
      return response;
    });
  }

  // ===== 状态 AI 回合 =====
  function runStateAiTurn(priorStoryText, G, fc) {
    var PsyDoctorStateGenerate = global.PsyDoctorStateGenerate;
    if (!PsyDoctorStateGenerate || !PsyDoctorStateGenerate.sendTurn) {
      return Promise.resolve(null);
    }

    var startTime = Date.now();
    showProcessLog("state", "状态 AI 同步中…");

    return PsyDoctorStateGenerate.sendTurn(G, fc, priorStoryText, {
      signal: null,
    }).then(function (result) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      showProcessLog("state", "状态 AI 完成 (" + elapsed + "s)", true);

      if (result && result.appResult) {
        var log = global.GameLog || global.console;
        (log.log || console.log)("[psy:state] 已应用标签: " + (result.appResult.appliedTags || []).join(", "));
        if (result.appResult.failedTags && result.appResult.failedTags.length > 0) {
          (log.warn || console.warn)("[psy:state] 失败标签: " + result.appResult.failedTags.join(", "));
        }
      }
      return result;
    });
  }

  // ===== 后处理检查 =====
  function postProcessChecks(G) {
    if (!G) return;

    // 5.1 个案触发检查
    if (G.pendingCaseSession) {
      var CaseSessionEngine = global.CaseSessionEngine;
      if (CaseSessionEngine) {
        CaseSessionEngine.startCaseSession(G.pendingCaseSession, G);
        G.pendingCaseSession = null;
        appendChatMessage("📋 个案会话已启动！", "system");
      }
    }

    // 5.2 伦理困境检查
    if (G.activeEthicalDilemma) {
      showEthicalDilemmaModal(G.activeEthicalDilemma);
    }

    // 5.3 理论里程碑检查
    var PsyMainScreenPanel = global.PsyMainScreenPanel;
    if (PsyMainScreenPanel) {
      var advancements = PsyMainScreenPanel.checkTheoryProgress(G);
      advancements.forEach(function (a) {
        appendChatMessage("🎓 你对「" + a.theoryName + "」的理解已达阶段 " + a.newStage, "system");
      });
    }

    // 5.4 反移情风险检查
    var CountertransferenceTracker = global.CountertransferenceTracker;
    if (CountertransferenceTracker) {
      var riskResult = CountertransferenceTracker.checkRisk(G);
      if (riskResult && riskResult.escalated) {
        var warning = "⚠️ 反移情风险上升：" + riskResult.oldLevel + " → " + riskResult.newLevel;
        appendChatMessage(warning, "system");
      }
    }

    // 5.5 等级晋升检查
    if (PsyMainScreenPanel) {
      PsyMainScreenPanel.checkLevelUp(G);
    }
  }

  // ===== 刷新 UI =====
  function refreshUI(G) {
    var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
    var PsyMainScreenPanel = global.PsyMainScreenPanel;
    if (PsyMainScreenPanelUi) {
      PsyMainScreenPanelUi.renderLeftPanel(global._psyFc, G);
      PsyMainScreenPanelUi.renderRightPanel(G);
    }
    if (PsyMainScreenPanel) {
      PsyMainScreenPanel.autoSave();
    }
  }

  // ===== 渲染行动建议按钮 =====
  function renderActionSuggestions(suggestions) {
    var area = _dom.suggestionArea;
    if (!area || !suggestions) return;

    var levels = ["aggressive", "neutral", "cautious", "veryCautious"];
    var labels = { aggressive: "积极行动", neutral: "日常行动", cautious: "谨慎选择", veryCautious: "深度反思" };

    area.querySelectorAll(".psy-suggestion-btn").forEach(function (btn) {
      var level = btn.getAttribute("data-suggestion");
      var text = suggestions[level];
      if (text) {
        btn.textContent = (labels[level] || level) + "：" + text;
        btn.setAttribute("data-text", text);
        btn.classList.remove("hidden");
      } else {
        btn.classList.add("hidden");
      }
    });
  }

  // ===== 显示伦理困境弹窗 =====
  function showEthicalDilemmaModal(dilemma) {
    var root = qs("psy-modal-root");
    var title = qs("psy-modal-title");
    var body = qs("psy-modal-body");
    if (!root || !title || !body) return;

    title.textContent = "⚠️ 伦理困境：" + (dilemma.typeLabel || dilemma.dilemmaType || "");
    var html = '<div class="psy-ethics-scene">' + escHtml(dilemma.scene || "") + '</div>';
    if (dilemma.context) {
      html += '<div class="psy-ethics-context">' + escHtml(dilemma.context) + '</div>';
    }
    html += '<div class="psy-ethics-options">';
    if (dilemma.options) {
      dilemma.options.forEach(function (opt, idx) {
        html += '<button class="psy-ethics-btn" data-choice="' + idx + '">'
          + '<span class="psy-ethics-btn-label">' + escHtml(opt.label) + '</span>'
          + (opt.description ? '<span class="psy-ethics-btn-desc">' + escHtml(opt.description) + '</span>' : "")
          + '</button>';
      });
    }
    html += '</div>';

    body.innerHTML = html;

    // 绑定事件
    body.querySelectorAll(".psy-ethics-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choiceIdx = parseInt(this.getAttribute("data-choice"));
        var PsyMainScreenPanel = global.PsyMainScreenPanel;
        if (PsyMainScreenPanel) {
          PsyMainScreenPanel.resolveEthicalDilemma(choiceIdx);
        }
        closeModal("psy-modal-root");
        appendChatMessage("你已经做出了伦理决策。", "system");
      });
    });

    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // ===== 状态显示 =====
  function showStatus(text) {
    var el = _dom.status;
    if (el) {
      el.textContent = text || "";
      el.className = "psy-chat-status" + (text ? " psy-chat-status--busy" : " psy-chat-status--idle");
    }
  }

  function showProcessLog(type, text, done) {
    var el = type === "state" ? _dom.processLogState : _dom.processLogStory;
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    if (done) {
      setTimeout(function () { if (el) el.hidden = true; }, 3000);
    }
  }

  // ===== AI 生成标志 =====
  function setGenerating(val) {
    global[AI_GENERATING_FLAG] = val;
    var btn = _dom.sendBtn;
    if (btn) btn.disabled = val;
  }

  // ===== 追加聊天消息 =====
  function appendChatMessage(text, role, isStream) {
    var log = _dom.chatLog;
    if (!log || !text) return;

    // 非流式 assistant 消息剥离标签，防止泄漏
    if (role === "assistant" && !isStream) {
      text = stripPsyTags(text);
      if (!text) return;
    }

    if (isStream) {
      // 流式消息已由 visibleNarrativeForStreamingChunk 过滤，无需再剥离
      var last = log.lastElementChild;
      if (last && last.classList.contains("psy-chat-msg--assistant")) {
        last.textContent = text; // 替换而不是追加，因为 streaming filter 的每次调用都基于 full 文本
      } else {
        var div = document.createElement("div");
        div.className = "psy-chat-msg psy-chat-msg--assistant";
        div.textContent = text;
        log.appendChild(div);
      }
    } else {
      var div = document.createElement("div");
      div.className = "psy-chat-msg psy-chat-msg--" + (role || "user");
      div.textContent = text;
      // 移除占位
      var placeholder = log.querySelector(".psy-chat-placeholder");
      if (placeholder) placeholder.remove();
      log.appendChild(div);
    }

    log.scrollTop = log.scrollHeight;
  }

  // ===== 工具函数 =====
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** 剥离 AI 回复中的 <psy_*> 标签，仅保留可见文本 */
  function stripPsyTags(text) {
    if (!text) return "";
    // 优先提取 <psy_story_body> 叙事正文
    var m = /<psy_story_body>([\s\S]*?)<\/psy_story_body>/i.exec(text);
    if (m) return m[1].trim();
    // 回退：去掉所有 <psy_*>...</psy_*> 块
    return text.replace(/<psy_[a-z_]+>[\s\S]*?<\/psy_[a-z_]+>/gi, '').trim();
  }

  function closeModal(rootId) {
    var root = qs(rootId || "psy-modal-root");
    if (root) {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  // ===== 暴露 API =====
  global.PsyMainScreenChat = {
    init: init,
    handleChatSend: handleChatSend,
    runStoryAiTurn: runStoryAiTurn,
    runStateAiTurn: runStateAiTurn,
    appendChatMessage: appendChatMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
