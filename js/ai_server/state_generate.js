/**
 * state_generate.js — 状态 AI（职业生涯状态同步）
 * 对应架构文档 §5.3 状态 AI, §4.2 状态应用详细流程
 *
 * 提供 PsyDoctorStateGenerate 命名空间，实现状态同步请求与标签解析。
 */
(function (global) {
  "use strict";

  // ===== 所有已知的状态标签名 =====
  var STATE_TAG_NAMES = [
    "psy_world_state",
    "psy_therapist_state",
    "psy_client_state",
    "psy_clinical_gain",
    "psy_supervision_notes",
    "psy_career_event",
    "psy_countertransference",
    "psy_nearby_people",
    "psy_inventory_ops",
    "psy_theory_milestone",
  ];

  // ===== 发送状态 AI 回合 =====
  function sendTurn(G, fc, priorStoryText, options) {
    options = options || {};

    // 构建 messages
    var messages = buildStateMessages(G, fc, priorStoryText, options);

    var TavernHelper = global.TavernHelper;
    if (!TavernHelper || !TavernHelper.generateFromMessages) {
      return Promise.reject(new Error("TavernHelper 不可用"));
    }

    var startTime = Date.now();

    return TavernHelper.generateFromMessages({
      messages: messages,
      signal: options.signal || null,
    }).then(function (result) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      var log = global.GameLog || global.console;
      (log.log || console.log)("[psy:ai] 状态AI完成 (" + elapsed + "s)");

      // 应用状态
      var appResult = applyStateTurnFromAssistantText(G, result || "");

      return {
        text: result,
        appResult: appResult,
      };
    });
  }

  // ===== 构建状态 AI 消息 =====
  function buildStateMessages(G, fc, priorStoryText, options) {
    options = options || {};
    var messages = [];

    // system prompt = 状态规则模板
    var PsyDoctorStateRules = global.PsyDoctorStateRules;
    var systemPrompt = "";
    if (PsyDoctorStateRules && PsyDoctorStateRules.templates) {
      systemPrompt = PsyDoctorStateRules.templates.systemPrompt;
    }
    if (!systemPrompt) {
      systemPrompt = "你是一个状态管理AI，根据叙事内容输出结构化标签更新游戏状态。";
    }
    messages.push({ role: "system", content: systemPrompt });

    // user 消息
    var userContentParts = [];

    // 叙事正文引用
    if (priorStoryText) {
      userContentParts.push("【叙事正文】\n" + priorStoryText.substring(0, 3000));
    }

    // 当前游戏快照
    if (G) {
      var snapLines = [];
      snapLines.push("【当前游戏状态】");
      snapLines.push("等级: " + ((G.doctorLevel && G.doctorLevel.major) || "") + "·" + ((G.doctorLevel && G.doctorLevel.minor) || ""));
      if (G.psychologistBase) {
        var b = G.psychologistBase;
        snapLines.push("属性: 共情" + (b.empathy||0) + " 洞察" + (b.insight||0) + " 知识" + (b.knowledge||0) + " 技术" + (b.technique||0) + " 论断" + (b.judgment||0) + " 自觉" + (b.awareness||0) + " 沟通" + (b.communication||0) + " 韧" + (b.resilience||0) + " 人文" + (b.humanity||0) + " 哲学" + (b.philosophy||0));
      }
      snapLines.push("时数: 临床" + (G.clinicalHours||0) + " 督导" + (G.supervisionHours||0) + " 个人体验" + (G.personalTherapyHours||0));
      snapLines.push("理论取向: " + (G.activeTheoryOrientation || "无"));
      snapLines.push("疲劳度: " + (G.currentFatigue||0) + " 倦怠: " + (G.burnoutLevel||0));
      snapLines.push("时间: " + (G.worldTimeString||"") + " 地点: " + (G.currentLocation||"") + " " + (G.currentWorkplace||""));

      // 理论掌握
      if (G.theoryMastery) {
        var tmKeys = Object.keys(G.theoryMastery);
        if (tmKeys.length > 0) {
          snapLines.push("理论掌握: " + tmKeys.map(function (k) {
            return k + "(阶段" + (G.theoryMastery[k].stage||0) + " " + (G.theoryMastery[k].hours||0) + "h)";
          }).join(" "));
        }
      }

      // 来访者
      if (G.currentClients && G.currentClients.length > 0) {
        snapLines.push("来访者: " + G.currentClients.map(function (c) {
          return c.displayName + "(" + (c.caseType||"") + " 症状" + (c.symptomLevel||0) + " 联盟" + (c.therapeuticAlliance||0) + " 阶段" + (c.treatmentPhase||"") + ")";
        }).join(" | "));
      }

      // 藏书/工具
      if (G.bookShelf && G.bookShelf.length > 0) {
        snapLines.push("藏书: " + G.bookShelf.length + "本");
      }

      // 反移情
      if (G.countertransference) {
        var ct = G.countertransference;
        if (ct.overallRiskLevel !== "low") {
          snapLines.push("反移情风险: " + (ct.overallRiskLevel||"low"));
        }
      }

      userContentParts.push(snapLines.join("\n"));
    }

    // 门闩标记
    if (options.isGatePhase) {
      userContentParts.push("【注意：本回合为初始化同步阶段】请以周围人物为主，给出完整的 nearbyPeople 列表和初始行动建议。");
    }

    messages.push({ role: "user", content: userContentParts.join("\n\n") });

    return messages;
  }

  // ===== 核心：应用状态 AI 响应到游戏 =====
  function applyStateTurnFromAssistantText(G, text) {
    if (!G || !text) return { success: false, appliedTags: [], failedTags: [] };

    var appliedTags = [];
    var failedTags = [];

    // Step 1: 正则提取所有标签
    var extractedTags = {};
    STATE_TAG_NAMES.forEach(function (tagName) {
      var re = new RegExp("<" + tagName + ">([\\s\\S]*?)<\\/" + tagName + ">", "gi");
      var match;
      while ((match = re.exec(text)) !== null) {
        extractedTags[tagName] = match[1].trim();
      }
    });

    // Step 2: 逐标签解析
    // 2.1 psy_world_state
    if (extractedTags["psy_world_state"]) {
      try {
        var ws = parseJSONSafe(extractedTags["psy_world_state"]);
        if (ws) {
          if (ws.worldTimeString) G.worldTimeString = ws.worldTimeString;
          if (ws.currentLocation) G.currentLocation = ws.currentLocation;
          if (ws.currentWorkplace) G.currentWorkplace = ws.currentWorkplace;
          if (ws.age !== undefined) G.age = clamp(ws.age, 18, 100);
          if (!G.worldTimeStack) G.worldTimeStack = [];
          G.worldTimeStack.push(ws.worldTimeString || "");
          appliedTags.push("psy_world_state");
        }
      } catch (e) { failedTags.push("psy_world_state"); }
    }

    // 2.2 psy_therapist_state
    if (extractedTags["psy_therapist_state"]) {
      try {
        var ts = parseJSONSafe(extractedTags["psy_therapist_state"]);
        if (ts) {
          if (ts.currentFatigue !== undefined) G.currentFatigue = clamp(ts.currentFatigue, 0, 100);
          if (ts.burnoutLevel !== undefined) G.burnoutLevel = clamp(ts.burnoutLevel, 0, 10);
          if (ts.selfAwarenessChange !== undefined && G.psychologistBase) {
            G.psychologistBase.awareness = Math.max(1, Math.min(999, (G.psychologistBase.awareness || 50) + ts.selfAwarenessChange));
          }
          appliedTags.push("psy_therapist_state");
        }
      } catch (e) { failedTags.push("psy_therapist_state"); }
    }

    // 2.3 psy_client_state
    if (extractedTags["psy_client_state"]) {
      try {
        var cs = parseJSONSafe(extractedTags["psy_client_state"]);
        if (cs && cs.clientId && G.currentClients) {
          for (var ci = 0; ci < G.currentClients.length; ci++) {
            if (G.currentClients[ci].id === cs.clientId) {
              var client = G.currentClients[ci];
              if (cs.symptomChange !== undefined) client.symptomLevel = clamp((client.symptomLevel || 50) + cs.symptomChange, 0, 100);
              if (cs.allianceChange !== undefined) client.therapeuticAlliance = clamp((client.therapeuticAlliance || 50) + cs.allianceChange, 0, 100);
              if (cs.phaseProgress) client.treatmentPhase = cs.phaseProgress;
              if (cs.defenseStatus) client.defenseStatus = cs.defenseStatus;
              appliedTags.push("psy_client_state");
              break;
            }
          }
        }
      } catch (e) { failedTags.push("psy_client_state"); }
    }

    // 2.4 psy_clinical_gain
    if (extractedTags["psy_clinical_gain"]) {
      try {
        var cg = parseJSONSafe(extractedTags["psy_clinical_gain"]);
        if (cg) {
          if (cg.clinicalHours) G.clinicalHours = (G.clinicalHours || 0) + cg.clinicalHours;
          if (cg.supervisionHours) G.supervisionHours = (G.supervisionHours || 0) + cg.supervisionHours;
          if (cg.personalTherapyHours) G.personalTherapyHours = (G.personalTherapyHours || 0) + cg.personalTherapyHours;
          if (cg.theoryProgress) {
            var tpKeys = Object.keys(cg.theoryProgress);
            tpKeys.forEach(function (tn) {
              if (!G.theoryMastery) G.theoryMastery = {};
              if (!G.theoryMastery[tn]) G.theoryMastery[tn] = { stage: 0, hours: 0 };
              G.theoryMastery[tn].hours = (G.theoryMastery[tn].hours || 0) + (cg.theoryProgress[tn] || 0);
              // 计算 stage
              if (global.PsyDoctorStateRules) {
                G.theoryMastery[tn].stage = global.PsyDoctorStateRules.getTheoryStageByHours(G.theoryMastery[tn].hours);
              }
            });
          }
          appliedTags.push("psy_clinical_gain");
        }
      } catch (e) { failedTags.push("psy_clinical_gain"); }
    }

    // 2.5 psy_supervision_notes
    if (extractedTags["psy_supervision_notes"]) {
      try {
        var sn = parseJSONSafe(extractedTags["psy_supervision_notes"]);
        if (sn) {
          if (!G.careerHistory) G.careerHistory = [];
          G.careerHistory.push({
            time: G.worldTimeString || "",
            event: "督导记录",
            type: "supervision",
            supervisorFeedback: sn.supervisorFeedback || "",
            blindSpotIdentified: sn.blindSpotIdentified || "",
            growthArea: sn.growthArea || "",
          });
          appliedTags.push("psy_supervision_notes");
        }
      } catch (e) { failedTags.push("psy_supervision_notes"); }
    }

    // 2.6 psy_career_event
    if (extractedTags["psy_career_event"]) {
      try {
        var ce = parseJSONSafe(extractedTags["psy_career_event"]);
        if (ce) {
          if (!G.activeCareerEvents) G.activeCareerEvents = [];
          // 去重
          var exists = false;
          for (var ei = 0; ei < G.activeCareerEvents.length; ei++) {
            if (G.activeCareerEvents[ei].eventType === ce.eventType) { exists = true; break; }
          }
          if (!exists) {
            G.activeCareerEvents.push(ce);
            appliedTags.push("psy_career_event");
          }
        }
      } catch (e) { failedTags.push("psy_career_event"); }
    }

    // 2.7 psy_countertransference
    if (extractedTags["psy_countertransference"]) {
      try {
        var ct = parseJSONSafe(extractedTags["psy_countertransference"]);
        if (ct && ct.type) {
          if (!G.countertransference) {
            G.countertransference = { overIdentification:0, defensiveDistancing:0, saviorComplex:0, professionalArrogance:0, burnoutNumbness:0, ethicalBlurring:0, overallRiskLevel:"low" };
          }
          if (G.countertransference[ct.type] !== undefined) {
            G.countertransference[ct.type] = Math.max(0, (G.countertransference[ct.type] || 0) + (ct.change || 0));
            if (G.countertransference[ct.type] > 100) G.countertransference[ct.type] = 100;
            // 重新计算风险等级
            var PsychologistBaseRuntime = global.PsychologistBaseRuntime;
            if (PsychologistBaseRuntime && PsychologistBaseRuntime.computeRiskLevel) {
              G.countertransference.overallRiskLevel = PsychologistBaseRuntime.computeRiskLevel(G);
            }
            appliedTags.push("psy_countertransference");
          }
        }
      } catch (e) { failedTags.push("psy_countertransference"); }
    }

    // 2.8 psy_nearby_people
    if (extractedTags["psy_nearby_people"]) {
      try {
        var np = parseJSONSafe(extractedTags["psy_nearby_people"]);
        if (np && Array.isArray(np)) {
          var ClientCharacterSheet = global.ClientCharacterSheet;
          var merged = [];
          np.forEach(function (p) {
            if (ClientCharacterSheet) {
              merged.push(ClientCharacterSheet.normalizeCharacter(p));
            } else {
              merged.push(p);
            }
          });
          G.nearbyPeople = merged;
          appliedTags.push("psy_nearby_people");
        }
      } catch (e) { failedTags.push("psy_nearby_people"); }
    }

    // 2.9 psy_inventory_ops
    if (extractedTags["psy_inventory_ops"]) {
      try {
        var ops = parseJSONSafe(extractedTags["psy_inventory_ops"]);
        if (ops && Array.isArray(ops)) {
          ops.forEach(function (op) {
            applyInventoryOp(G, op);
          });
          appliedTags.push("psy_inventory_ops");
        }
      } catch (e) { failedTags.push("psy_inventory_ops"); }
    }

    // 2.10 psy_theory_milestone
    if (extractedTags["psy_theory_milestone"]) {
      try {
        var tm = parseJSONSafe(extractedTags["psy_theory_milestone"]);
        if (tm && tm.theoryName) {
          // 仅作标记，stage 由面板逻辑根据时数计算
          appliedTags.push("psy_theory_milestone");
        }
      } catch (e) { failedTags.push("psy_theory_milestone"); }
    }

    return { success: true, appliedTags: appliedTags, failedTags: failedTags };
  }

  // ===== 物品操作 =====
  function applyInventoryOp(G, op) {
    if (!op || !op.op || !op.type) return;
    var name = op.name || "";
    if (!name) return;

    if (op.op === "add") {
      if (op.type === "book") {
        if (!G.bookShelf) G.bookShelf = [];
        if (G.bookShelf.length >= 30) return;
        G.bookShelf.push({ name: name, author: op.author || "", theory: op.theory || "", effectDesc: op.effectDesc || "", effectData: op.effectData || {} });
      } else if (op.type === "tool") {
        if (!G.therapyTools) G.therapyTools = [];
        if (G.therapyTools.length >= 10) return;
        G.therapyTools.push({ name: name, type: op.subType || "expressive", effect: op.effectDesc || "" });
      } else if (op.type === "assessment") {
        if (!G.assessmentTools) G.assessmentTools = [];
        G.assessmentTools.push({ name: name, type: op.subType || "symptom", acquired: true });
      }
    } else if (op.op === "remove") {
      var count = op.count || 1;
      if (op.type === "book" && G.bookShelf) {
        var idx = -1;
        for (var i = 0; i < G.bookShelf.length; i++) {
          if (G.bookShelf[i].name === name) { idx = i; break; }
        }
        if (idx >= 0) G.bookShelf.splice(idx, 1);
      } else if (op.type === "tool" && G.therapyTools) {
        var idx2 = -1;
        for (var j = 0; j < G.therapyTools.length; j++) {
          if (G.therapyTools[j].name === name) { idx2 = j; break; }
        }
        if (idx2 >= 0) G.therapyTools.splice(idx2, 1);
      } else if (op.type === "assessment" && G.assessmentTools) {
        var idx3 = -1;
        for (var k = 0; k < G.assessmentTools.length; k++) {
          if (G.assessmentTools[k].name === name) { idx3 = k; break; }
        }
        if (idx3 >= 0) G.assessmentTools.splice(idx3, 1);
      }
    }
  }

  // ===== 工具函数 =====
  function parseJSONSafe(str) {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch (e) {
      // 尝试修复
      try {
        var fixed = str.replace(/[\r\n\t]/g, " ").replace(/'/g, '"').replace(/([{,]\s*)(\w+)(\s*:)/g, "$1\"$2\"$3");
        return JSON.parse(fixed);
      } catch (e2) {
        return null;
      }
    }
  }

  function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  // ===== 暴露 API =====
  global.PsyDoctorStateGenerate = {
    STATE_TAG_NAMES: STATE_TAG_NAMES,
    sendTurn: sendTurn,
    buildStateMessages: buildStateMessages,
    applyStateTurnFromAssistantText: applyStateTurnFromAssistantText,
    parseJSONSafe: parseJSONSafe,
  };
})(typeof window !== "undefined" ? window : globalThis);
