/**
 * role_ai.js — 角色 AI（独立角色发言 + 串行调用编排）
 * 对应架构文档 §5.3 角色 AI
 *
 * 提供 PsyDoctorRoleAI 命名空间，实现独立角色发言生成和串行调用编排。
 * 每个角色有独立的 system prompt（固定 → 命中专属 prefix cache），
 * 后一个角色收到前一个角色的发言原文，产生真实对话感。
 *
 * 前缀缓存约束（详见 architecture.md §5.6）：
 * - 每个角色 system prompt 完全固定（由 speechProfile 确定）
 * - 相同 speechProfile → 相同 system prompt → 共享缓存
 */
(function (global) {
  "use strict";

  // ================================================================
  // 根据 ID 查找角色（从 currentClients 或 nearbyPeople）
  // ================================================================
  function findRoleById(id, G) {
    if (!id || !G) return null;

    // 先从 currentClients 找（来访者）
    if (G.currentClients) {
      for (var i = 0; i < G.currentClients.length; i++) {
        if (G.currentClients[i].id === id) {
          return G.currentClients[i];
        }
      }
    }

    // 再从 nearbyPeople 找（督导师/同行）
    if (G.nearbyPeople) {
      for (var j = 0; j < G.nearbyPeople.length; j++) {
        if (G.nearbyPeople[j].id === id) {
          return G.nearbyPeople[j];
        }
      }
    }

    return null;
  }

  // ================================================================
  // 根据角色对象确定 roleType
  // ================================================================
  function determineRoleType(roleData) {
    if (roleData.speechProfile && roleData.speechProfile.roleType) {
      return roleData.speechProfile.roleType;
    }
    if (roleData.role) return roleData.role;
    if (roleData.caseType || roleData.clientSheet) return "client";
    return "colleague";
  }

  // ================================================================
  // 构建角色 AI 的 system prompt（固定 → 命中 prefix cache）
  // 委托给 RoleSpeechProfile.buildRoleSystemPrompt()
  // ================================================================
  function buildRoleSystemPrompt(roleData) {
    var RoleSpeechProfile = global.RoleSpeechProfile;
    if (RoleSpeechProfile && typeof RoleSpeechProfile.buildRoleSystemPrompt === "function") {
      // 确保 speechProfile 存在
      var sp = roleData.speechProfile;
      if (!sp) {
        // 自动创建
        var roleType = determineRoleType(roleData);
        sp = {
          roleType: roleType,
          personalityParams: {},
          speechHabits: "",
          attitudeToPlayer: "中立",
        };
        if (RoleSpeechProfile.createInitialSpeechProfile) {
          sp = RoleSpeechProfile.createInitialSpeechProfile(roleData) || sp;
        }
        roleData.speechProfile = sp;
      }
      return RoleSpeechProfile.buildRoleSystemPrompt(roleData, sp);
    }
    // 兜底
    return "请根据场景自然地发言。";
  }

  // ================================================================
  // 构建角色 AI 的 messages 数组（缓存友好）
  // system = 固定 prompt（命中 cache）
  // user = 场景上下文 + 前一发言者输出（变化，不缓存）
  // ================================================================
  function buildRoleMessages(roleData, sceneNarrative, previousSpeech, recentHistorySummary) {
    var messages = [];

    // system（固定 → cache hit）
    var systemPrompt = buildRoleSystemPrompt(roleData);
    messages.push({ role: "system", content: systemPrompt });

    // user（变化 → cache miss）
    var userParts = [];
    userParts.push("【场景】\n" + sceneNarrative);

    if (recentHistorySummary) {
      userParts.push("【前文】\n" + recentHistorySummary);
    }

    if (previousSpeech) {
      userParts.push("【前一个说话者】\n" + previousSpeech);
    }

    userParts.push("【你的回合】请生成你的发言。");

    messages.push({ role: "user", content: userParts.join("\n\n") });

    return messages;
  }

  // ================================================================
  // 调用单个角色 AI（流式）
  // ================================================================
  function callSingleRoleAI(roleData, context, options) {
    options = options || {};
    var sceneNarrative = context.sceneNarrative || "";
    var previousSpeech = context.previousSpeech || null;
    var recentHistorySummary = context.recentHistorySummary || null;
    var onChunk = options.onChunk || null;
    var signal = options.signal || null;

    var messages = buildRoleMessages(roleData, sceneNarrative, previousSpeech, recentHistorySummary);

    var TavernHelper = global.TavernHelper;
    if (!TavernHelper || !TavernHelper.generateFromMessages) {
      return Promise.reject(new Error("TavernHelper 不可用"));
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
      var roleName = roleData.displayName || "未知角色";
      (log.log || console.log)("[psy:role] " + roleName + " AI完成 (" + elapsed + "s)");

      return {
        text: result || "",
        roleId: roleData.id,
        roleName: roleData.displayName,
      };
    });
  }

  // ================================================================
  // 串行运行角色发言阶段
  // 按 speechSchedule 顺序逐个调角色 AI，后一个收到前一个的输出
  // ================================================================
  function runRoleAiPhase(speechSchedule, worldAiNarrative, G, options) {
    options = options || {};
    var onChunk = options.onChunk || null;
    var signal = options.signal || null;

    if (!speechSchedule || !speechSchedule.length) {
      // 纯环境叙事回合，无角色发言
      return Promise.resolve({ speeches: [], combinedText: "" });
    }

    var speeches = [];
    var previousSpeakerOutput = null;
    var chain = Promise.resolve();

    speechSchedule.forEach(function (slot, idx) {
      chain = chain.then(function () {
        // 查找角色
        var roleData = findRoleById(slot.id, G);
        if (!roleData) {
          var log = global.GameLog || global.console;
          (log.warn || console.warn)("[psy:role] 未找到角色: " + slot.id + "，跳过");
          return null;
        }

        // 设置角色 roleType（speechSchedule 中的 role 优先）
        if (slot.role && roleData.speechProfile) {
          roleData.speechProfile.roleType = slot.role;
        } else if (slot.role && !roleData.speechProfile) {
          roleData.speechProfile = {
            roleType: slot.role,
            personalityParams: {},
          };
        }

        // 构建上下文
        var context = {
          sceneNarrative: worldAiNarrative,
          previousSpeech: previousSpeakerOutput,
          recentHistorySummary: options.recentHistorySummary || null,
        };

        // 串行调用
        return callSingleRoleAI(roleData, context, {
          onChunk: onChunk,
          signal: signal,
        }).then(function (result) {
          if (result) {
            speeches.push(result);
            // 关键：前一个角色的发言成为下一个角色的上下文
            previousSpeakerOutput = result.text;
          }
          return result;
        });
      });
    });

    return chain.then(function () {
      // 合并所有发言
      var combinedParts = [];
      speeches.forEach(function (s) {
        if (s && s.text) {
          combinedParts.push(s.text);
        }
      });

      return {
        speeches: speeches,
        combinedText: combinedParts.join("\n\n"),
      };
    });
  }

  // ================================================================
  // 暴露 API
  // ================================================================
  global.PsyDoctorRoleAI = {
    findRoleById: findRoleById,
    buildRoleSystemPrompt: buildRoleSystemPrompt,
    buildRoleMessages: buildRoleMessages,
    callSingleRoleAI: callSingleRoleAI,
    runRoleAiPhase: runRoleAiPhase,
  };
})(typeof window !== "undefined" ? window : globalThis);
