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
      systemPrompt = PsyDoctorAiPreset.buildSystemPrompt(G, fc, null, {
        knowledgeBaseText: worldBookText,
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
      should_stream: !!onChunk,
      onDelta: onChunk,
      signal: signal,
    };

    var startTime = Date.now();

    return TavernHelper.generateFromMessages(options).then(function (result) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      var log = global.GameLog || global.console;
      (log.log || console.log)("[psy:ai] 叙事AI生成完成 (" + elapsed + "s)");

      // 用完整管线解析回复（meta-leak 剥离 + story body 提取）
      var pipeline = resolveStoryReplyForPipeline(result || "");
      var response = {
        text: result || "",
        storyBody: pipeline.sansLeak,
        actionSuggestions: extractJSONTag(result, "psy_action_suggestions"),
        theoryInsight: extractJSONTag(result, "psy_theory_insight"),
        philosophyReflection: extractJSONTag(result, "psy_philosophy_reflection"),
        caseSessionTrigger: extractJSONTag(result, "psy_case_session_trigger"),
        ethicalDilemma: extractJSONTag(result, "psy_ethical_dilemma"),
        rawText: result,
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

  // ===== Meta-Leak 剥离：去除模型输出的推理/思考过程 =====
  var META_LEAK_MARKERS = [
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Analyzing\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Reflection\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Planning\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Thought\\s*process\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Final\\s+answer\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Note\\s+to\\s*self\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*My\\s+Current\\s+Circumstances\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Course\\s+of\\s+Action\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Scene\\s*analysis\\b",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Setting\\s*:",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*The\\s+Incident\\s*:",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*My\\s+Skills\\s*:",
    "(?:^|\\n+)\\s*\\*{0,2}\\s*Interaction\\s*:",
    "(?:^|\\n+)\\s*Okay,?\\s+so\\s+here'?s\\b",
    "(?:^|\\n+)\\s*Thinking\\s+about\\s+my\\b",
    "(?:^|\\n+)\\s*This\\s+gives\\s+me\\s+the\\s+following\\b",
    "(?:^|\\n+)\\s*Given\\s+my\\s+circumstances\\b",
    "(?:^|\\n+)\\s*I\\s+now\\s+need\\s+to\\b",
    "(?:^|\\n+)\\s*I\\s+decide\\s+I\\s+need\\s+to\\b",
    "(?:^|\\n+)\\s*As\\s+I\\s+make\\s+my\\s+way\\b",
    "(?:^|\\n+)\\s*I've\\s+just\\s+finished\\b",
    "(?:^|\\n+)\\s*I've\\s+been\\s+",
    "(?:^|\\n+)\\s*I\\s+need\\s+to\\b",
    "(?:^|\\n+)\\s*My\\s+focus\\s+",
    "(?:^|\\n+)\\s*My\\s+goal\\??\\b",
    "(?:^|\\n+)\\s*The\\s+user\\s+wants\\b",
    "(?:^|\\n+)\\s*Let\\s+me\\s+(?:analyze|think|start|begin)\\b",
    "(?:^|\\n+)\\s*Now\\s+I\\s+will\\b",
    "(?:^|\\n+)\\s*Initially,?\\s+I\\s+",
    // 中文推理标记
    "(?:^|\\n+)\\s*好的[，,].*?(?:用户|角色|我\\s*需要)",
    "(?:^|\\n+)\\s*我\\s*(?:需要|得|要)\\s*(?:考虑|生成|输出|构建|写|确保|注意)",
    "(?:^|\\n+)\\s*看来最合适",
    "(?:^|\\n+)\\s*在叙事上我要",
    "(?:^|\\n+)\\s*最后回复要",
    "(?:^|\\n+)\\s*我还得考虑后续",
    "(?:^|\\n+)\\s*我得考虑",
    "(?:^|\\n+)\\s*首先[，,].*?让我",
    "(?:^|\\n+)\\s*思考[：:]",
    "(?:^|\\n+)\\s*我来(?:分析|思考|考虑|设计|规划)",
    "(?:^|\\n+)\\s*用户(?:提供|要求|希望|想要|给(?:了|出))",
  ];

  /** 剥离模型元叙述/推理文本 */
  function stripStoryAiMetaLeakFromNarrative(text) {
    var s = String(text || "");
    var cut = -1;
    for (var mi = 0; mi < META_LEAK_MARKERS.length; mi++) {
      var re = new RegExp(META_LEAK_MARKERS[mi], "im");
      var m = re.exec(s);
      if (m && typeof m.index === "number") {
        if (cut < 0 || m.index < cut) cut = m.index;
      }
    }
    if (cut < 0) return s;
    var tagPos = s.indexOf("<psy_", cut);
    var head = s.slice(0, cut).replace(/\s+$/, "");
    if (tagPos >= 0) {
      var tail = s.slice(tagPos).replace(/^\s+/, "");
      if (tail) return head ? head + "\n\n" + tail : tail;
    }
    return head;
  }

  /** 流式输出预览：已出现 <psy_story_body> 则只展示标签内片段，避免把前置推理显示到聊天区 */
  function visibleNarrativeForStreamingChunk(full) {
    var s = String(full || "");
    var i0 = s.indexOf("<psy_story_body>");
    if (i0 < 0) return "";
    var start = i0 + "<psy_story_body>".length;
    var i1 = s.indexOf("</psy_story_body>", start);
    var chunk = i1 >= 0 ? s.slice(start, i1) : s.slice(start);
    var body = stripStoryAiMetaLeakFromNarrative(chunk);
    if (i1 >= 0 && !String(body || "").trim() && i0 > 0) {
      return stripStoryAiMetaLeakFromNarrative(s.slice(0, i0));
    }
    return body;
  }

  /** 完整回复管线：提取 <psy_story_body> + 剥离 meta-leak + 保留机器标签 */
  function resolveStoryReplyForPipeline(text) {
    var raw = String(text || "");
    var i0 = raw.indexOf("<psy_story_body>");
    var i1 = i0 >= 0 ? raw.indexOf("</psy_story_body>", i0 + "<psy_story_body>".length) : -1;
    if (i0 >= 0 && i1 > i0 + "<psy_story_body>".length) {
      var inner = raw.slice(i0 + "<psy_story_body>".length, i1).trim();
      inner = stripStoryAiMetaLeakFromNarrative(inner);
      if (!String(inner || "").trim() && i0 > 0) {
        var headBefore = raw.slice(0, i0).trim();
        if (headBefore) inner = stripStoryAiMetaLeakFromNarrative(headBefore);
      }
      var afterClose = raw.slice(i1 + "</psy_story_body>".length).replace(/^\s+/, "");
      var sansLeak = afterClose ? inner + "\n\n" + afterClose : inner;
      return { sansLeak: sansLeak, usedBodyEnvelope: true };
    }
    return { sansLeak: stripStoryAiMetaLeakFromNarrative(raw), usedBodyEnvelope: false };
  }

  // ===== 暴露 API =====
  global.PsyDoctorStoryGenerate = {
    buildMessages: buildMessages,
    sendTurn: sendTurn,
    extractTag: extractTag,
    extractJSONTag: extractJSONTag,
    stripStoryAiMetaLeakFromNarrative: stripStoryAiMetaLeakFromNarrative,
    visibleNarrativeForStreamingChunk: visibleNarrativeForStreamingChunk,
    resolveStoryReplyForPipeline: resolveStoryReplyForPipeline,
  };
})(typeof window !== "undefined" ? window : globalThis);
