/**
 * mainScreen_chat.js — 聊天 UI + AI 回合编排 + 个案触发
 * 对应架构文档 §4.1 完整回合序列, logic-flow §4.1
 *
 * 提供 PsyMainScreenChat 命名空间。
 */
(function (global) {
  "use strict";

  var AI_GENERATING_FLAG = "PSY_AI_GENERATING";

  // ===== v2.0: 新管线标志（true=世界AI+角色AI, false=旧叙事AI）=====
  var USE_NEW_PIPELINE = true;

  // ===== Checkpoint 4: 个案会话 UI 状态 =====
  var INTERVENTION_BUTTONS_SHOWN = false;

  // ===== 干预技术中文名映射 =====
  var INTERVENTION_LABELS = {
    empathicResponse: "共情回应",
    interpretation: "诠释干预",
    behavioralTech: "行为技术",
    experientialTech: "体验技术",
    systemicIntervention: "系统干预",
    silentPresence: "沉默在场",
  };

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

  // ===== 完整回合序列（v2.0 多角色 AI 管线） =====
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
      // Checkpoint 4: 正在个案会话中 — 尝试启动 UI（如尚未激活）
      if (!INTERVENTION_BUTTONS_SHOWN) {
        renderCaseSessionUI(G);
      }
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

    if (USE_NEW_PIPELINE) {
      runNewPipeline(trimmed, G, fc);
    } else {
      runOldPipeline(trimmed, G, fc);
    }
  }

  // ===== v2.0 新管线：世界 AI → 角色 AI(s) → 状态 AI =====
  function runNewPipeline(userText, G, fc) {
    var narrativeText = userText;

    runWorldAiTurn(userText, G, fc)
      .then(function (worldResult) {
        // Step 3: 行动建议
        if (worldResult && worldResult.actionSuggestions) {
          renderActionSuggestions(worldResult.actionSuggestions);
        }

        narrativeText = worldResult ? worldResult.text || userText : userText;

        // 写入 chatHistory
        if (worldResult && worldResult.text) {
          G.chatHistory.push({ role: "assistant", content: worldResult.text });
          // 替换流式中间文本为干净版
          var logEl = _dom.chatLog;
          if (logEl) {
            var lastAsst = logEl.querySelector(".psy-chat-msg--assistant:last-child");
            if (lastAsst) {
              lastAsst.textContent = stripPsyTags(worldResult.text);
            }
          }
        }

        showStatus("角色发言中...");

        // 角色 AI 阶段
        var schedule = worldResult ? worldResult.speechSchedule || [] : [];
        return runRoleAiPhase(schedule, narrativeText, G);
      })
      .then(function (roleResult) {
        var combined = narrativeText;
        if (roleResult && roleResult.speeches && roleResult.speeches.length > 0) {
          roleResult.speeches.forEach(function (s) {
            if (s && s.text) {
              G.chatHistory.push({
                role: "assistant",
                content: "【" + (s.roleName || "角色") + "】\n" + s.text,
              });
            }
          });
          combined += "\n\n" + (roleResult.combinedText || "");
        }

        // Step 4: 状态 AI
        showStatus("状态同步中...");
        return runStateAiTurn(combined, G, fc);
      })
      .then(function () {
        // Step 5-6: 后处理 + 刷新
        postProcessChecks(G);
        refreshUI(G);
        setGenerating(false);
      })
      .catch(function (err) {
        handlePipelineError(err, userText, G, fc);
      });
  }

  // ===== 新管线错误处理（含回退逻辑） =====
  function handlePipelineError(err, userText, G, fc) {
    var log = global.GameLog || global.console;

    if (err && err.roleAiFailed) {
      // 角色 AI 失败但世界 AI 成功 → 跳过角色，继续状态同步
      (log.warn || console.warn)("[psy:role] 角色发言失败，跳过");
      runStateAiTurn(userText, G, fc)
        .then(function () {
          postProcessChecks(G);
          refreshUI(G);
          setGenerating(false);
        })
        .catch(function (stateErr) {
          appendChatMessage("状态同步出错：" + (stateErr.message || stateErr), "system");
          setGenerating(false);
        });
      return;
    }

    if (err && err.fallbackToOld) {
      // 世界 AI 失败 → 永久回退旧管线
      (log.log || console.log)("[psy:ai] 世界AI不可用，切换旧管线");
      USE_NEW_PIPELINE = false;
      runOldPipeline(userText, G, fc);
      return;
    }

    // 其他错误
    (log.warn || console.warn)("[psy:ai] 回合失败:", err);
    appendChatMessage("AI 响应出错：" + (err.message || err), "system");
    setGenerating(false);
  }

  // ===== 世界 AI 回合（v2.0 新建） =====
  function runWorldAiTurn(userText, G, fc) {
    showStatus("构建世界中...");

    var PsyDoctorWorldAI = global.PsyDoctorWorldAI;
    if (!PsyDoctorWorldAI || !PsyDoctorWorldAI.sendWorldAiTurn) {
      var err = new Error("世界 AI 不可用");
      err.fallbackToOld = true;
      return Promise.reject(err);
    }

    var startTime = Date.now();
    showProcessLog("story", "世界 AI 叙事中…");

    return PsyDoctorWorldAI.sendWorldAiTurn(userText, G, fc, {
      onChunk: function (chunk, full) {
        if (!full) return;
        var i0 = full.indexOf("<psy_story_body>");
        if (i0 < 0) return;
        var start = i0 + "<psy_story_body>".length;
        var i1 = full.indexOf("</psy_story_body>", start);
        var visible = i1 >= 0 ? full.slice(start, i1) : full.slice(start);
        if (visible) appendChatMessage(visible, "assistant", true);
      },
      onError: function () {
        showProcessLog("story", "世界 AI 失败", true);
      },
    }).then(function (response) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      showProcessLog("story", "世界 AI 完成 (" + elapsed + "s)", true);
      return response;
    }).catch(function (err) {
      showProcessLog("story", "世界 AI 失败", true);
      err.fallbackToOld = true;
      throw err;
    });
  }

  // ===== 角色 AI 发言阶段（v2.0 新建） =====
  function runRoleAiPhase(speechSchedule, narrativeText, G) {
    if (!speechSchedule || !speechSchedule.length) {
      return Promise.resolve({ speeches: [], combinedText: "" });
    }

    var PsyDoctorRoleAI = global.PsyDoctorRoleAI;
    if (!PsyDoctorRoleAI || !PsyDoctorRoleAI.runRoleAiPhase) {
      return Promise.resolve({ speeches: [], combinedText: "" });
    }

    showProcessLog("state", "角色发言中…");

    return PsyDoctorRoleAI.runRoleAiPhase(speechSchedule, narrativeText, G, {})
      .then(function (result) {
        showProcessLog("state", "角色发言完成", true);

        // 追加角色发言到聊天区
        if (result && result.speeches) {
          result.speeches.forEach(function (s) {
            if (s && s.text) {
              var cleanText = stripPsyTags(s.text);
              if (cleanText) {
                appendChatMessage("【" + (s.roleName || "角色") + "】\n" + cleanText, "assistant");
              }
            }
          });
        }
        return result;
      })
      .catch(function (err) {
        (global.GameLog || console).warn("[psy:role] 角色AI出错:", err);
        err.roleAiFailed = true;
        throw err;
      });
  }

  // ===== 旧管线兜底 =====
  function runOldPipeline(userText, G, fc) {
    runStoryAiTurn(userText, G, fc).then(function (storyResult) {
      if (storyResult && storyResult.actionSuggestions) {
        renderActionSuggestions(storyResult.actionSuggestions);
      }
      return runStateAiTurn(storyResult ? storyResult.storyBody : userText, G, fc);
    }).then(function () {
      postProcessChecks(G);
      refreshUI(G);
      setGenerating(false);
    }).catch(function (err) {
      (global.GameLog || console).warn("[psy:ai] 旧管线失败:", err);
      appendChatMessage("AI 响应出错：" + (err.message || err), "system");
      setGenerating(false);
    });
  }

  // ===== 叙事 AI 回合（旧，保留兜底） =====
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
        var visible = PsyDoctorStoryGenerate.visibleNarrativeForStreamingChunk(full);
        if (visible) {
          appendChatMessage(visible, "assistant", true);
        }
      },
      onError: function () {
        showProcessLog("story", "叙事 AI 失败", true);
      },
    }).then(function (response) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      showProcessLog("story", "叙事 AI 完成 (" + elapsed + "s)", true);

      if (response && response.text) {
        G.chatHistory.push({ role: "assistant", content: response.text });
      }

      var storyToShow = response && response.storyBody ? response.storyBody : stripPsyTags(response ? response.text : "");
      if (storyToShow) {
        var logEl = _dom.chatLog;
        if (logEl) {
          var lastAsst = logEl.querySelector(".psy-chat-msg--assistant:last-child");
          if (lastAsst) {
            var cleaned = PsyDoctorStoryGenerate.stripStoryAiMetaLeakFromNarrative(stripPsyTags(storyToShow));
            lastAsst.textContent = cleaned || storyToShow;
          } else {
            appendChatMessage(storyToShow, "assistant");
          }
        }
      }

      if (response && response.caseSessionTrigger) {
        G.pendingCaseSession = response.caseSessionTrigger;
      }
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
        // Checkpoint 4: 立即渲染个案会话 UI（干预按钮 + 禁用输入）
        renderCaseSessionUI(G);
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
        btn.removeAttribute("hidden");
      } else {
        btn.classList.add("hidden");
        btn.setAttribute("hidden", "");
      }
    });
  }

  // ===== Checkpoint 4: 个案会话 UI =====================================
  // 在建议按钮区域渲染 6 种干预技术按钮
  // =====================================================================

  function renderCaseSessionUI(G) {
    var session = G.activeCaseSession;
    if (!session) return;
    if (INTERVENTION_BUTTONS_SHOWN) return; // 已渲染

    INTERVENTION_BUTTONS_SHOWN = true;

    // 禁用文本输入
    disableChatInput(true);

    // 显示会话状态
    var client = getCaseSessionClient(G);
    var clientName = (client && client.displayName) || "来访者";
    var roundNum = session.round + 1;
    var maxRounds = session.maxRounds || 20;

    appendChatMessage("━━━ 📋 个案会话 · 第 " + roundNum + "/" + maxRounds + " 回合 ━━━", "system");
    appendChatMessage(clientName
      + " | 症状：" + session.currentSymptom + "/100"
      + " | 联盟：" + session.currentAlliance + "/100"
      + " | 洞察：" + (session.insightGained || 0).toFixed(1), "system");
    appendChatMessage("请选择你的干预技术：", "system");

    // 渲染干预技术按钮
    renderInterventionButtons(G);
  }

  function renderInterventionButtons(G) {
    var area = _dom.suggestionArea;
    if (!area) return;

    // 清空建议按钮区域
    area.innerHTML = "";

    var types = Object.keys(INTERVENTION_LABELS);
    types.forEach(function (type) {
      var btn = document.createElement("button");
      btn.className = "psy-suggestion-btn psy-intervention-btn";
      btn.textContent = INTERVENTION_LABELS[type];
      btn.setAttribute("data-technique", type);
      btn.addEventListener("click", function () {
        handleCaseSessionIntervention(type, G);
      });
      area.appendChild(btn);
    });

    // 添加"结束会话"按钮
    var endBtn = document.createElement("button");
    endBtn.className = "psy-suggestion-btn psy-intervention-btn psy-intervention-btn--end";
    endBtn.textContent = "⏹ 提前结束";
    endBtn.addEventListener("click", function () {
      finishCaseSession(G, G.activeCaseSession);
    });
    area.appendChild(endBtn);
  }

  function handleCaseSessionIntervention(techniqueType, G) {
    var session = G.activeCaseSession;
    if (!session || session.terminated) return;
    if (global[AI_GENERATING_FLAG]) return;

    var CaseSessionEngine = global.CaseSessionEngine;
    var PsyDoctorRoleAI = global.PsyDoctorRoleAI;
    if (!CaseSessionEngine) return;

    setGenerating(true);

    // 隐藏按钮 → 清空建议区
    var area = _dom.suggestionArea;
    if (area) area.innerHTML = "";
    showStatus("来访者回应中...");

    // 1. 显示玩家选择的干预技术
    var techLabel = INTERVENTION_LABELS[techniqueType] || techniqueType;
    appendChatMessage("你使用了「" + techLabel + "」", "user");

    // 2. 计算干预效果（纯数据）
    var result = CaseSessionEngine.runCaseSessionRound(techniqueType, G);
    if (!result) {
      appendChatMessage("⚠ 回合计算异常", "system");
      setGenerating(false);
      return;
    }

    // 3. 获取来访者对象，生成角色 AI 回应
    var client = CaseSessionEngine.getSessionClient(G);

    if (client && PsyDoctorRoleAI && PsyDoctorRoleAI.callSingleRoleAI) {
      // 构建 AI 场景上下文
      var narrativeContext = "这是一次心理咨询会话。";
      narrativeContext += "来访者" + (client.displayName || "") + "，主要问题：" + (client.chiefComplaint || "心理困扰") + "。";
      narrativeContext += "当前症状水平：" + session.currentSymptom + "/100。";
      narrativeContext += "当前治疗联盟：" + session.currentAlliance + "/100。";
      narrativeContext += "治疗师刚刚使用了「" + techLabel + "」技术。";

      PsyDoctorRoleAI.callSingleRoleAI(client, {
        sceneNarrative: narrativeContext,
        previousSpeech: null,
        recentHistorySummary: null,
      }, {
        onChunk: function (chunk) {
          // 流式渲染来访者回应
          appendChatMessage(chunk, "client", true);
        },
        signal: null,
      }).then(function (aiResult) {
        // 4. 显示效果摘要
        showCaseSessionEffectSummary(result.effect, techniqueType);

        // 5. 写入聊天历史
        if (aiResult && aiResult.text) {
          G.chatHistory.push({
            role: "assistant",
            content: "【" + (client.displayName || "来访者") + "】\n" + aiResult.text,
          });
        }

        // 6. 检查会话是否结束
        if (result.session.terminated) {
          finishCaseSession(G, session);
        } else {
          // 重新显示干预按钮
          renderInterventionButtons(G);
        }

        setGenerating(false);
        refreshUI(G);
      }).catch(function (err) {
        (global.GameLog || console).warn("[psy:session] 角色AI出错:", err);
        // 角色 AI 失败时跳过，仅显示效果
        appendChatMessage("（来访者回应生成失败，跳过）", "system");
        showCaseSessionEffectSummary(result.effect, techniqueType);

        if (result.session.terminated) {
          finishCaseSession(G, session);
        } else {
          renderInterventionButtons(G);
        }
        setGenerating(false);
        refreshUI(G);
      });
    } else {
      // 无角色 AI 模块时跳过
      showCaseSessionEffectSummary(result.effect, techniqueType);

      if (result.session.terminated) {
        finishCaseSession(G, session);
      } else {
        renderInterventionButtons(G);
      }
      setGenerating(false);
      refreshUI(G);
    }
  }

  function showCaseSessionEffectSummary(effect, techniqueType) {
    if (!effect) return;
    var parts = [];
    if (effect.allianceChange) parts.push("联盟 " + (effect.allianceChange > 0 ? "+" : "") + effect.allianceChange);
    if (effect.symptomChange) parts.push("症状 " + (effect.symptomChange > 0 ? "+" : "") + effect.symptomChange);
    if (effect.defenseChange) parts.push("防御 " + (effect.defenseChange > 0 ? "+" : "") + effect.defenseChange);
    if (effect.insightGain) parts.push("洞察 +" + effect.insightGain.toFixed(1));
    var text = "📊 效果：" + (parts.length > 0 ? parts.join(" | ") : "无明显变化");
    appendChatMessage(text, "system");
  }

  function finishCaseSession(G, session) {
    if (!session) return;

    var CaseSessionEngine = global.CaseSessionEngine;
    if (!CaseSessionEngine) return;

    // 获取来访者
    var client = CaseSessionEngine.getSessionClient(G);

    // 若尚未结算（如点击"提前结束"），手动结算
    if (!session.outcome && client) {
      session.outcome = CaseSessionEngine.computeSessionOutcome(session, client);
    }

    // 应用结果到游戏（内部清理 G.activeCaseSession）
    var appResult = CaseSessionEngine.applySessionResultToGame(G);

    // 显示结算
    if (appResult || session.outcome) {
      var o = appResult || session.outcome;
      var ratingMap = { S: "卓越", A: "优秀", B: "良好", C: "及格", D: "不及格" };
      appendChatMessage("━━━ 📊 个案结算 ━━━", "system");
      appendChatMessage("评级：" + (ratingMap[o.rating] || o.rating)
        + " | 症状改善：" + (o.symptomImprove || 0) + "%"
        + " | 联盟维持：" + (o.allianceMaintain || 0) + "%"
        + " | 总回合：" + (o.totalRounds || session.round), "system");
    }

    // 恢复常规 UI
    restoreNormalUI(G);

    // 个案后自动叙事（architecture §9.5）
    var clientName = (client && client.displayName) || "来访者";
    var roundCount = session.round || 0;
    setTimeout(function () {
      var autoMsg = "本节与" + clientName + "的咨询会话已结束（共" + roundCount + "回合）。请写下衔接叙事：咨询师在咨询后的内心活动、" + clientName + "离开后的氛围、下次咨询的安排。";
      handleChatSend(autoMsg);
    }, 500);
  }

  function restoreNormalUI(G) {
    INTERVENTION_BUTTONS_SHOWN = false;

    // 启用输入
    disableChatInput(false);

    // 清空并恢复建议区域
    var area = _dom.suggestionArea;
    if (area) {
      area.innerHTML = "";
      // 重新创建默认的建议按钮
      var levels = ["aggressive", "neutral", "cautious", "veryCautious"];
      var defaultLabels = { aggressive: "积极行动", neutral: "日常行动", cautious: "谨慎选择", veryCautious: "深度反思" };
      levels.forEach(function (level) {
        var btn = document.createElement("button");
        btn.className = "psy-suggestion-btn psy-suggestion-btn--" + level + " hidden";
        btn.setAttribute("data-suggestion", level);
        btn.setAttribute("hidden", "");
        area.appendChild(btn);
      });
    }

    showStatus("");
    refreshUI(G);
  }

  // ===== 禁/启用聊天输入 =====
  function disableChatInput(disabled) {
    var input = _dom.chatInput;
    if (input) input.disabled = disabled;
    var sendBtn = _dom.sendBtn;
    if (sendBtn) sendBtn.disabled = disabled;
  }

  // ===== 获取当前会话的来访者（简便方法） =====
  function getCaseSessionClient(G) {
    var CaseSessionEngine = global.CaseSessionEngine;
    if (CaseSessionEngine && CaseSessionEngine.getSessionClient) {
      return CaseSessionEngine.getSessionClient(G);
    }
    // 兜底
    var session = G.activeCaseSession;
    if (!session || !G.currentClients) return null;
    for (var i = 0; i < G.currentClients.length; i++) {
      if (G.currentClients[i].id === session.clientId) {
        return G.currentClients[i];
      }
    }
    return null;
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
      // 流式消息：根据 role 匹配对应的消息类型（assistant / client / etc.）
      var streamClass = "psy-chat-msg--" + (role || "assistant");
      var last = log.lastElementChild;
      if (last && last.classList.contains(streamClass)) {
        last.textContent = text; // 替换而不是追加
      } else {
        var div = document.createElement("div");
        div.className = "psy-chat-msg " + streamClass;
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

  /**
   * 获取共享的机器标签剥离函数（优先使用 PsyDoctorStoryGenerate.stripAllPsyMachineTags）
   */
  function getMachineTagStripper() {
    var PsyDoctorStoryGenerate = global.PsyDoctorStoryGenerate;
    if (PsyDoctorStoryGenerate && typeof PsyDoctorStoryGenerate.stripAllPsyMachineTags === "function") {
      return PsyDoctorStoryGenerate.stripAllPsyMachineTags;
    }
    // 兜底：4 道查杀
    return function (t) {
      if (!t) return "";
      var s = String(t);
      s = s.replace(/<psy_[a-z_]+>[\s\S]*?<\/psy_[a-z_]+>/gi, '');
      s = s.replace(/<psy_[a-z_]+[^>]*>[\s\S]*?<\/psy_[a-z_]+>/gi, '');
      s = s.replace(/<psy_[a-z_]+[^>]*>/gi, '');
      s = s.replace(/<\/psy_[a-z_]+[^>]*>/gi, '');
      return s.trim();
    };
  }

  /** 剥离 AI 回复中的 <psy_*> 标签，仅保留可见文本 */
  function stripPsyTags(text) {
    if (!text) return "";
    var stripTags = getMachineTagStripper();
    // 优先提取 <psy_story_body> 叙事正文
    var m = /<psy_story_body>([\s\S]*?)<\/psy_story_body>/i.exec(text);
    if (m) return stripTags(m[1]);
    // 回退：去掉所有 <psy_*> 标签（含完整标签对和裸开标签）
    return stripTags(text);
  }

  function closeModal(rootId) {
    var root = qs(rootId || "psy-modal-root");
    if (root) {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  // ===== 暴露 API（v2.0: 新增新管线函数） =====
  global.PsyMainScreenChat = {
    init: init,
    handleChatSend: handleChatSend,
    /** v2.0 新管线函数 */
    runNewPipeline: runNewPipeline,
    runWorldAiTurn: runWorldAiTurn,
    runRoleAiPhase: runRoleAiPhase,
    /** 旧管线（保留兜底） */
    runOldPipeline: runOldPipeline,
    runStoryAiTurn: runStoryAiTurn,
    runStateAiTurn: runStateAiTurn,
    appendChatMessage: appendChatMessage,
    renderActionSuggestions: renderActionSuggestions,
    /** Checkpoint 4: 个案会话 UI */
    renderCaseSessionUI: renderCaseSessionUI,
    handleCaseSessionIntervention: handleCaseSessionIntervention,
    finishCaseSession: finishCaseSession,
    renderInterventionButtons: renderInterventionButtons,
  };
})(typeof window !== "undefined" ? window : globalThis);
