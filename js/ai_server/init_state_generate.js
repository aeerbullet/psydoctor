/**
 * init_state_generate.js — 开局配置 AI
 * 对应架构文档 §5.4 Phase 2, §5.5 开局配置 AI
 *
 * 提供 PsyDoctorInitStateGenerate 命名空间。
 */
(function (global) {
  "use strict";

  // ===== 检查是否需要执行开局配置 AI =====
  function shouldRunInitStateAi(G) {
    if (!G) return false;
    if (G.psyInitStateAiApplied === true) return false;

    var TavernHelper = global.TavernHelper;
    if (!TavernHelper) return false;

    return true;
  }

  // ===== 构建请求 =====
  function buildInitStateRequest(fc, G, openingStoryBody) {
    var PsyDoctorInitStateRules = global.PsyDoctorInitStateRules;
    var systemPrompt = "";
    if (PsyDoctorInitStateRules && PsyDoctorInitStateRules.templates) {
      systemPrompt = PsyDoctorInitStateRules.templates.systemPrompt;
    }
    if (!systemPrompt) {
      systemPrompt = "你是一个开局配置AI，根据命运抉择和开局叙事生成初始配置。";
    }

    var userContent = [];

    // 命运抉择 JSON
    userContent.push("【命运抉择】\n" + JSON.stringify(fc, null, 2));

    // 开局叙事正文
    if (openingStoryBody) {
      userContent.push("【开局叙事正文】\n" + openingStoryBody);
    }

    // 物品参考表
    var referenceItems = [
      "【经典心理学著作参考】《梦的解析》《超越自由与尊严》《行为主义的图景》《认知治疗：基础与应用》《存在主义心理治疗》《当尼采哭泣》《成为一个人》《普通心理学》《津巴多普通心理学》《改变心理学的40项研究》《DSM-5》《精神病学》",
      "【基础测评工具】SCL-90、SDS抑郁自评量表、SAS焦虑自评量表、MMPI-2、EPQ、16PF",
      "【治疗工具参考】沙盘与沙具、空椅、放松训练音频、情绪卡片、社交故事卡片",
    ];
    referenceItems.forEach(function (item) { userContent.push(item); });

    return {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent.join("\n\n") },
      ],
    };
  }

  // ===== 执行开局配置 AI =====
  function runInitStateAiIfNeeded(fc, G, openingStoryBody, options) {
    options = options || {};

    if (!shouldRunInitStateAi(G)) {
      if (G) G.psyInitStateAiApplied = true;
      return Promise.resolve({ skipped: true, reason: "not needed" });
    }

    var TavernHelper = global.TavernHelper;
    if (!TavernHelper) {
      return Promise.resolve({ skipped: true, reason: "no TavernHelper" });
    }

    var request = buildInitStateRequest(fc, G, openingStoryBody);

    var startTime = Date.now();

    return TavernHelper.generateFromMessages({
      messages: request.messages,
      signal: options.signal || null,
    }).then(function (result) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      var log = global.GameLog || global.console;
      (log.log || console.log)("[psy:ai] 开局配置完成 (" + elapsed + "s)");

      var text = result || "";
      var PsyDoctorStoryGenerate = global.PsyDoctorStoryGenerate;
      var extractTag = PsyDoctorStoryGenerate ? PsyDoctorStoryGenerate.extractTag : function(t, n) { var r = new RegExp("<" + n + ">([\\s\\S]*?)<\\/" + n + ">","i"); var m = r.exec(t); return m ? m[1].trim() : ""; };
      var extractJSON = PsyDoctorStoryGenerate ? PsyDoctorStoryGenerate.extractJSONTag : function(t, n) { try { var c = extractTag(t, n); return c ? JSON.parse(c) : null; } catch(e) { return null; } };

      // 解析三对标签
      var loadout = extractJSON(text, "psy_init_loadout");
      var worldState = extractJSON(text, "psy_world_state");
      var therapistState = extractJSON(text, "psy_therapist_state");

      // 应用
      if (loadout) applyInitLoadout(G, loadout);
      if (worldState) {
        if (worldState.worldTimeString) G.worldTimeString = worldState.worldTimeString;
        if (worldState.currentLocation) G.currentLocation = worldState.currentLocation;
        if (worldState.currentWorkplace) G.currentWorkplace = worldState.currentWorkplace;
        if (worldState.age !== undefined) G.age = Math.max(18, Math.min(100, worldState.age));
      }
      if (therapistState && G.psychologistBase) {
        var keys = ["empathy","insight","knowledge","technique","judgment","awareness","communication","resilience","humanity","philosophy"];
        keys.forEach(function (k) {
          if (therapistState[k] !== undefined) {
            var diff = therapistState[k] - (G.psychologistBase[k] || 0);
            if (Math.abs(diff) <= 5) {
              G.psychologistBase[k] = therapistState[k];
            }
          }
        });
      }

      G.psyInitStateAiApplied = true;

      // chatHistory push
      if (loadout && G.chatHistory) {
        var booksAdded = (loadout.books && loadout.books.length) || 0;
        var toolsAdded = (loadout.tools && loadout.tools.length) || 0;
        G.chatHistory.push({
          role: "system",
          content: "[系统] 初始配置已生成：" + booksAdded + "本藏书，" + toolsAdded + "件工具" + (loadout.initialClient ? "，初始来访者已就绪" : ""),
        });
      }

      return {
        loadout: loadout,
        worldState: worldState,
        therapistState: therapistState,
      };
    });
  }

  // ===== 应用初始物品 =====
  function applyInitLoadout(G, loadout) {
    if (!G || !loadout) return;

    // 书籍
    if (loadout.books && Array.isArray(loadout.books)) {
      if (!G.bookShelf) G.bookShelf = [];
      loadout.books.forEach(function (book) {
        if (G.bookShelf.length >= 30) return;
        // 去重
        var exists = false;
        for (var i = 0; i < G.bookShelf.length; i++) {
          if (G.bookShelf[i].name === book.name) { exists = true; break; }
        }
        if (!exists) {
          G.bookShelf.push({
            name: book.name,
            author: book.author || "",
            theory: book.theory || "",
            effectDesc: book.effectDesc || "",
            effectData: book.effectData || {},
          });
        }
      });
    }

    // 治疗工具
    if (loadout.tools && Array.isArray(loadout.tools)) {
      if (!G.therapyTools) G.therapyTools = [];
      loadout.tools.forEach(function (tool) {
        if (G.therapyTools.length >= 10) return;
        G.therapyTools.push({
          name: tool.name,
          type: tool.type || "expressive",
          usage: tool.usage || "",
        });
      });
    }

    // 测评工具
    if (loadout.assessmentTools && Array.isArray(loadout.assessmentTools)) {
      if (!G.assessmentTools) G.assessmentTools = [];
      loadout.assessmentTools.forEach(function (at) {
        G.assessmentTools.push({
          name: at.name,
          type: at.type || "symptom",
          acquired: at.acquired !== false,
        });
      });
    }

    // 初始来访者
    if (loadout.initialClient) {
      var ClientCharacterSheet = global.ClientCharacterSheet;
      if (ClientCharacterSheet) {
        var client = ClientCharacterSheet.createNewClient(loadout.initialClient);
        if (client) {
          if (!G.currentClients) G.currentClients = [];
          G.currentClients.push(client);
        }
      }
    }
  }

  // ===== 暴露 API =====
  global.PsyDoctorInitStateGenerate = {
    shouldRunInitStateAi: shouldRunInitStateAi,
    buildInitStateRequest: buildInitStateRequest,
    runInitStateAiIfNeeded: runInitStateAiIfNeeded,
    applyInitLoadout: applyInitLoadout,
  };
})(typeof window !== "undefined" ? window : globalThis);
