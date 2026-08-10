/**
 * world_ai.js — 世界 AI（环境叙事 + 发言顺序表编排）
 * 对应架构文档 §5.2 世界 AI
 *
 * 提供 PsyDoctorWorldAI 命名空间，实现世界 AI 的消息构建、调用和场景解析。
 * 与旧 story_generate.js 独立，可并行验证。
 *
 * 前缀缓存约束（详见 architecture.md §5.6）：
 * - system prompt 完全固定（不含时间戳、随机数、动态变量）
 * - 变化内容全部放在 user message 中
 * - 对话历史只追加不改写
 */
(function (global) {
  "use strict";

  // ================================================================
  // 世界 AI System Prompt（完全固定 → 命中 prefix cache）
  // 注意：禁止在此字符串中插入 {{worldTimeString}} 等动态变量
  // ================================================================
  var WORLD_AI_SYSTEM_PROMPT = [
    "你是心理医生成长记的世界叙事 AI（World AI）。你的职责是构建场景、推进环境叙事、编排角色发言顺序。",

    "=== 核心定位 ===",
    "你只负责两件事：",
    "1. 环境叙事：描写场景、氛围、时间流逝、地点变化的叙事正文",
    "2. 发言顺序表：判断当前场景中哪些角色在场，输出 speechSchedule 供后续角色 AI 调用",
    "",
    "来访者、督导师、同行的话语**不由你生成**——这些由独立的角色 AI 负责。",
    "你的叙事正文中不应包含任何角色的直接话语。",

    "=== 叙事写作原则 ===",
    "1. 采用第二人称「你」指代主角（咨询师），第三人称指代其他角色",
    "2. 文学性但不过度修辞，专业但不生硬。融合心理学氛围与人文温度",
    "3. 每次回复只推进一个叙事节拍。不要替玩家做决定，不要自动生成数小时或数天的内容",
    "4. 职业生涯的变化是渐进的，心理成长是螺旋上升的，尊重这种节律",
    "5. 不要让来访者的症状在单一叙事节拍中戏剧性改善。心理治疗是渐进的过程",
    "6. 叙事中要自然地融入心理学专业元素和当前场景的细节",

    "=== 发言顺序表（speechSchedule）编排规则 ===",
    "你必须在 <psy_scene_info> 标签中输出 speechSchedule 数组。每个条目包含：",
    "- id: 角色唯一标识符（与 G.currentClients 或 G.nearbyPeople 中的 id 匹配）",
    "- role: 角色类型（client / supervisor / colleague）",
    "- turn: 发言序号（从 1 开始递增）",
    "",
    "编排参考：",
    "- 咨询场景（therapy_session）：来访者优先发言，通常 1-3 轮",
    "- 督导场景（supervision）：来访者先叙述督导材料 → 督导师点评 → 可能回应",
    "- 日常场景（daily_life）：根据叙事上下文自然决定，可无人发言（空数组）",
    "- 学术场景（academic）：同行/同事可能在场，各有发言机会",
    "- 危机场景（crisis）：来访者优先，督导师可能介入",
    "",
    "同一角色可在 speechSchedule 中出现多次（如：来访者说话 → 督导师回应 → 来访者再回应）。",
    "speechSchedule 为空数组 [] 表示本回合为纯环境叙事回合（不调角色 AI）。",
    "speechSchedule 长度一般不超过 6 个条目。",

    "=== 输出格式 ===",
    "你必须输出以下标签：",
    "",
    "1. <psy_story_body>...</psy_story_body>",
    "   - 纯环境叙事正文（玩家在聊天区看到的内容）",
    "   - 只包含环境、氛围、时间推进的描写",
    "   - 不含角色话语（角色 AI 负责）",
    "",
    "2. <psy_scene_info>...</psy_scene_info>",
    "   - 结构化场景信息（程序消费，不可见）",
    "   - JSON 格式：",
    "   {",
    "     \"sceneType\": \"therapy_session\" | \"supervision\" | \"daily_life\" | \"academic\" | \"conference\" | \"crisis\",",
    "     \"location\": \"当前地点描述\",",
    "     \"timeContext\": \"时间背景描述\",",
    "     \"atmosphere\": \"氛围描述（安静/紧张/轻松/压抑等）\",",
    "     \"speechSchedule\": [",
    "       { \"id\": \"client_001\", \"role\": \"client\", \"turn\": 1 },",
    "       { \"id\": \"supv_001\", \"role\": \"supervisor\", \"turn\": 2 }",
    "     ]",
    "   }",
    "",
    "3. 可选标签：<psy_theory_insight>, <psy_philosophy_reflection>（与旧架构一致）",

    "=== 绝对禁止 ===",
    "- 严禁输出英文/中文推理过程、元叙述、任务拆解",
    "- 严禁在叙事正文中替角色说话（角色 AI 负责发言）",
    "- 严禁在单一回合中跨越数小时或数天",
    "- 回复必须直接进入叙事正文，不得在开头或结尾附加分析说明",
  ].join("\n");

  // ================================================================
  // 构建 messages 数组（缓存友好：固定 system → 历史 → 变化 user）
  // ================================================================
  function buildWorldAiMessages(G, fc, userText, priorContext) {
    var messages = [];

    // ─── system（固定 → 参与 prefix cache）───
    messages.push({ role: "system", content: WORLD_AI_SYSTEM_PROMPT });

    // ─── 对话历史（只追加，不改写）───
    if (G && G.chatHistory && G.chatHistory.length > 0) {
      var history = G.chatHistory;
      // 取最近 6 轮（12 条消息）
      var startIdx = Math.max(0, history.length - 12);
      for (var i = startIdx; i < history.length; i++) {
        var msg = history[i];
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content || "" });
        }
      }
    }

    // ─── user（变化 → 不参与缓存）───
    var userContentLines = [];
    userContentLines.push(userText || "");

    // 游戏状态摘要
    if (G) {
      var s = [];
      s.push("【游戏状态】");
      if (G.doctorLevel) {
        s.push("等级: " + (G.doctorLevel.major || "") + "·" + (G.doctorLevel.minor || ""));
      }
      if (G.psychologistBase) {
        var b = G.psychologistBase;
        s.push("属性: 共情" + (b.empathy||0) + " 洞察" + (b.insight||0) + " 知识" + (b.knowledge||0) + " 技术" + (b.technique||0) + " 论断" + (b.judgment||0) + " 自觉" + (b.awareness||0) + " 沟通" + (b.communication||0) + " 韧" + (b.resilience||0) + " 人文" + (b.humanity||0) + " 哲学" + (b.philosophy||0));
      }
      s.push("时数: 临床" + (G.clinicalHours||0) + " 督导" + (G.supervisionHours||0) + " 个人体验" + (G.personalTherapyHours||0));
      s.push("取向: " + (G.activeTheoryOrientation || "无"));
      s.push("时间: " + (G.worldTimeString || "") + " 地点: " + (G.currentLocation || "") + " " + (G.currentWorkplace || ""));

      // 反移情
      if (G.countertransference && G.countertransference.overallRiskLevel !== "low") {
        s.push("反移情风险: " + G.countertransference.overallRiskLevel);
      }

      // 来访者摘要
      if (G.currentClients && G.currentClients.length > 0) {
        var clientParts = [];
        for (var ci = 0; ci < G.currentClients.length; ci++) {
          var c = G.currentClients[ci];
          clientParts.push(c.displayName + "(" + (c.caseType||"") + " 症状" + (c.symptomLevel||0) + " 联盟" + (c.therapeuticAlliance||0) + ")");
        }
        s.push("来访者: " + clientParts.join(" | "));
      }

      userContentLines.push(s.join("\n"));
    }

    // 前文上下文
    if (priorContext) {
      userContentLines.push("【前文】\n" + (typeof priorContext === "string" ? priorContext : priorContext.join("\n")));
    }

    messages.push({ role: "user", content: userContentLines.join("\n\n") });

    return messages;
  }

  // ================================================================
  // 解析 <psy_scene_info> 标签
  // ================================================================
  function parseSceneInfo(text) {
    if (!text) return null;
    var re = /<psy_scene_info>([\s\S]*?)<\/psy_scene_info>/i;
    var match = re.exec(text);
    if (!match) return null;

    try {
      var parsed = JSON.parse(match[1].trim());
      // 校验/补全字段
      if (!parsed.speechSchedule || !Array.isArray(parsed.speechSchedule)) {
        parsed.speechSchedule = [];
      }
      return parsed;
    } catch (e) {
      // 容错修复：单引号 → 双引号，key 补引号
      try {
        var fixed = match[1].trim()
          .replace(/'/g, '"')
          .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        var parsed2 = JSON.parse(fixed);
        if (!parsed2.speechSchedule || !Array.isArray(parsed2.speechSchedule)) {
          parsed2.speechSchedule = [];
        }
        return parsed2;
      } catch (e2) {
        var log = global.GameLog || global.console;
        (log.warn || console.warn)("[psy:world] scene_info 解析失败:", e2.message);
        return null;
      }
    }
  }

  // ================================================================
  // 发送世界 AI 回合
  // ================================================================
  function sendWorldAiTurn(userText, G, fc, callbacks) {
    callbacks = callbacks || {};
    var onChunk = callbacks.onChunk || null;
    var signal = callbacks.signal || null;

    var messages = buildWorldAiMessages(G, fc, userText, callbacks.priorContext);

    var TavernHelper = global.TavernHelper;
    if (!TavernHelper || !TavernHelper.generateFromMessages) {
      var err = "TavernHelper 不可用";
      if (callbacks.onError) callbacks.onError(err);
      return Promise.reject(new Error(err));
    }

    var startTime = Date.now();

    return TavernHelper.generateFromMessages({
      messages: messages,
      should_stream: !!onChunk,
      onDelta: onChunk,
      signal: signal,
    }).then(function (result) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      var log = global.GameLog || global.console;
      (log.log || console.log)("[psy:world] 世界AI完成 (" + elapsed + "s)");

      var text = result || "";

      // 解析场景信息
      var sceneInfo = parseSceneInfo(text);
      var speechSchedule = sceneInfo ? sceneInfo.speechSchedule : [];

      var response = {
        text: text,
        narrativeText: text,
        speechSchedule: speechSchedule,
        sceneInfo: sceneInfo,
      };

      if (callbacks.onComplete) callbacks.onComplete(response);
      return response;
    }).catch(function (err) {
      if (callbacks.onError) callbacks.onError(err);
      throw err;
    });
  }

  // ================================================================
  // 世界 AI 预设获取（供 preset.js 调用）
  // ================================================================
  function getWorldAiSystemPrompt() {
    return WORLD_AI_SYSTEM_PROMPT;
  }

  // ================================================================
  // 暴露 API
  // ================================================================
  global.PsyDoctorWorldAI = {
    /** 构建消息（缓存友好） */
    buildWorldAiMessages: buildWorldAiMessages,
    /** 发送世界 AI 回合（流式） */
    sendWorldAiTurn: sendWorldAiTurn,
    /** 解析 <psy_scene_info> 标签 */
    parseSceneInfo: parseSceneInfo,
    /** 获取固定 system prompt（供外部引用） */
    getWorldAiSystemPrompt: getWorldAiSystemPrompt,
  };
})(typeof window !== "undefined" ? window : globalThis);
