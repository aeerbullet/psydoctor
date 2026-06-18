/**
 * story_generate.js — 人生叙事 AI 生成
 * 对应架构文档 §5.2 叙事 AI
 *
 * 提供 PsyDoctorStoryGenerate 命名空间，实现叙事 AI 的消息构建和调用。
 */
(function (global) {
  "use strict";

  // ===== 历史对话最大轮次 =====
  var MAX_HISTORY_ROUNDS = 10;

  // ===== 构建完整 messages 数组 =====
  function buildMessages(fc, G, userText, priorStoryRaw) {
    var messages = [];

    // 1. system 消息
    var PsyDoctorAiPreset = global.PsyDoctorAiPreset;
    var PsyDoctorWorldBook = global.PsyDoctorWorldBook;

    // 构建扫描文本用于世界书选择
    var scanText = userText || "";
    scanText += " " + (fc ? fc.education || "" : "");
    scanText += " " + (G ? G.activeTheoryOrientation || "" : "");

    // 知识基底摘录
    var worldBookText = "";
    if (PsyDoctorWorldBook) {
      var entries = PsyDoctorWorldBook.selectEntries(scanText, { maxEntries: 8 });
      worldBookText = PsyDoctorWorldBook.formatForSystem(entries);
    }

    var systemPrompt = "";
    if (PsyDoctorAiPreset) {
      systemPrompt = PsyDoctorAiPreset.assembleSystemPrompt(G, fc, {
        worldBookText: worldBookText,
      });
    }
    if (!systemPrompt) {
      systemPrompt = "你是一个心理医生成长叙事的 AI。请根据游戏上下文生成人生叙事。";
    }
    messages.push({ role: "system", content: systemPrompt });

    // 2. 历史对话
    if (G && G.chatHistory && G.chatHistory.length > 0) {
      var history = G.chatHistory;
      var startIdx = Math.max(0, history.length - MAX_HISTORY_ROUNDS * 2);
      for (var i = startIdx; i < history.length; i++) {
        var msg = history[i];
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content || "" });
        }
      }
    }

    // 3. 当前 user 消息
    var userContentLines = [];
    userContentLines.push(userText || "");

    // 运行时状态摘要
    if (G) {
      var statsSummary = "【运行时状态】\n";
      if (G.doctorLevel) statsSummary += "等级：" + (G.doctorLevel.major || "") + "·" + (G.doctorLevel.minor || "") + "\n";
      if (G.psychologistBase) {
        var b = G.psychologistBase;
        statsSummary += "属性：共情" + (b.empathy||0) + "/洞察" + (b.insight||0) + "/知识" + (b.knowledge||0) + "/技术" + (b.technique||0) + "/论断" + (b.judgment||0) + "/自觉" + (b.awareness||0) + "/沟通" + (b.communication||0) + "/韧" + (b.resilience||0) + "/人文" + (b.humanity||0) + "/哲学" + (b.philosophy||0) + "\n";
      }
      statsSummary += "临床时数：" + (G.clinicalHours || 0) + " 督导时数：" + (G.supervisionHours || 0) + "\n";
      statsSummary += "理论取向：" + (G.activeTheoryOrientation || "未确定") + "\n";
      statsSummary += "当前场景：" + (G.currentLocation || "未知") + " " + (G.currentWorkplace || "未知") + "\n";
      statsSummary += "世界时间：" + (G.worldTimeString || "未知") + "\n";

      // 来访者摘要
      if (G.currentClients && G.currentClients.length > 0) {
        statsSummary += "当前来访者：" + G.currentClients.map(function (c) {
          return c.displayName + "(" + (c.caseType || "") + " 症状:" + (c.symptomLevel || 0) + " 联盟:" + (c.therapeuticAlliance || 0) + ")";
        }).join("、") + "\n";
      }

      // 哲学深度
      if (G.philosophyDepth) {
        var philParts = [];
        var philKeys = Object.keys(G.philosophyDepth);
        philKeys.forEach(function (k) {
          if (G.philosophyDepth[k] > 0) philParts.push(k + ":" + G.philosophyDepth[k]);
        });
        if (philParts.length > 0) statsSummary += "哲学深度：" + philParts.join(" ") + "\n";
      }

      // 反移情
      if (G.countertransference && G.countertransference.overallRiskLevel !== "low") {
        statsSummary += "反移情状态：" + (G.countertransference.overallRiskLevel || "low") + "\n";
      }

      userContentLines.push(statsSummary);
    }

    messages.push({ role: "user", content: userContentLines.join("\n") });

    return messages;
  }

  // ===== 发送叙事 AI 回合 =====
  function sendTurn(userText, G, fc, callbacks) {
    callbacks = callbacks || {};
    var onChunk = callbacks.onChunk || null;
    var signal = callbacks.signal || null;

    var messages = buildMessages(fc, G, userText);

    // 调用 bridge
    var TavernHelper = global.TavernHelper;
    if (!TavernHelper || !TavernHelper.generateFromMessages) {
      var err = "TavernHelper 不可用";
      if (callbacks.onError) callbacks.onError(err);
      return Promise.reject(new Error(err));
    }

    var options = {
      messages: messages,
      onChunk: onChunk,
      signal: signal,
    };

    var startTime = Date.now();

    return TavernHelper.generateFromMessages(options).then(function (result) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      var log = global.GameLog || global.console;
      (log.log || console.log)("[psy:ai] 叙事AI生成完成 (" + elapsed + "s) token:" + (result.usage ? JSON.stringify(result.usage) : "?"));

      // 解析标签
      var response = {
        text: result.text || "",
        storyBody: extractTag(result.text, "psy_story_body"),
        actionSuggestions: extractJSONTag(result.text, "psy_action_suggestions"),
        theoryInsight: extractJSONTag(result.text, "psy_theory_insight"),
        philosophyReflection: extractJSONTag(result.text, "psy_philosophy_reflection"),
        caseSessionTrigger: extractJSONTag(result.text, "psy_case_session_trigger"),
        ethicalDilemma: extractJSONTag(result.text, "psy_ethical_dilemma"),
        rawText: result.text,
      };

      if (callbacks.onComplete) callbacks.onComplete(response);
      return response;
    }).catch(function (err) {
      if (callbacks.onError) callbacks.onError(err);
      throw err;
    });
  }

  // ===== 标签提取工具 =====
  function extractTag(text, tagName) {
    if (!text) return "";
    var re = new RegExp("<" + tagName + ">([\\s\\S]*?)<\\/" + tagName + ">", "i");
    var match = re.exec(text);
    return match ? match[1].trim() : "";
  }

  function extractJSONTag(text, tagName) {
    var content = extractTag(text, tagName);
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch (e) {
      // 尝试修复常见问题
      try {
        var fixed = content.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
        return JSON.parse(fixed);
      } catch (e2) {
        return null;
      }
    }
  }

  // ===== 暴露 API =====
  global.PsyDoctorStoryGenerate = {
    buildMessages: buildMessages,
    sendTurn: sendTurn,
    extractTag: extractTag,
    extractJSONTag: extractJSONTag,
  };
})(typeof window !== "undefined" ? window : globalThis);
