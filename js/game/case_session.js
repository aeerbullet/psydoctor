/**
 * case_session.js — 咨询个案回合引擎
 * 对应架构文档 §9.2-§9.5 个案会话流程
 *
 * 提供 CaseSessionEngine 命名空间，实现个案的启动、主循环、结算与应用。
 */
(function (global) {
  "use strict";

  // ===== 干预技术定义 =====
  var INTERVENTION_TYPES = {
    empathicResponse: {
      label: "共情回应",
      formula: function (base) {
        return base.empathy * 0.8 + base.communication * 0.2;
      },
      effects: {
        allianceChange: function (raw) { return clamp(raw * 0.06, -8, 8); },
        defenseChange: function (raw) { return clamp(-raw * 0.05, -8, 0); },
        symptomChange: function (raw) { return clamp(-raw * 0.02, -3, 0); },
        insightGain: 0,
      },
    },
    interpretation: {
      label: "诠释干预",
      formula: function (base) {
        return base.insight * 0.7 + base.knowledge * 0.3;
      },
      effects: {
        insightGain: function (raw) { return raw * 0.10; },
        allianceChange: function (raw) { return clamp(raw * 0.02, -5, 5); },
        defenseChange: function (raw) { return clamp(raw * 0.03, 0, 8); },
        symptomChange: 0,
      },
    },
    behavioralTech: {
      label: "行为技术",
      formula: function (base) {
        return base.technique * 0.7 + base.judgment * 0.3;
      },
      effects: {
        symptomChange: function (raw) { return clamp(-raw * 0.06, -10, 0); },
        allianceChange: function (raw) { return clamp(raw * 0.02, 0, 5); },
        defenseChange: function (raw) { return clamp(-raw * 0.03, -5, 0); },
        insightGain: 0,
      },
    },
    experientialTech: {
      label: "体验技术",
      formula: function (base) {
        return base.awareness * 0.6 + base.empathy * 0.4;
      },
      effects: {
        allianceChange: function (raw) { return clamp(raw * 0.04, 0, 6); },
        insightGain: function (raw) { return raw * 0.06; },
        defenseChange: function (raw) { return clamp(-raw * 0.02, -3, 0); },
        symptomChange: 0,
      },
    },
    systemicIntervention: {
      label: "系统干预",
      formula: function (base) {
        return base.communication * 0.6 + base.insight * 0.4;
      },
      effects: {
        symptomChange: function (raw) { return clamp(-raw * 0.04, -6, 0); },
        defenseChange: function (raw) { return clamp(-raw * 0.04, -6, 0); },
        allianceChange: function (raw) { return clamp(raw * 0.03, 0, 5); },
        insightGain: 0,
      },
    },
    silentPresence: {
      label: "沉默在场",
      formula: function (base) {
        return base.humanity * 0.5 + base.awareness * 0.5;
      },
      effects: {
        allianceChange: function (raw) { return clamp(raw * 0.03, 0, 5); },
        insightGain: function (raw) { return raw * 0.04; },
        defenseChange: 0,
        symptomChange: 0,
      },
    },
  };

  // ===== 工具函数 =====
  function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  function randFactor() {
    return (Math.random() - 0.5) * 0.2; // ±0.1
  }

  // ===== 计算咨询师各干预技术能力值 =====
  function computeTherapistAbilities(G) {
    var base = G.psychologistBase;
    if (!base) return null;

    var abilities = {};
    var types = Object.keys(INTERVENTION_TYPES);
    types.forEach(function (t) {
      abilities[t] = INTERVENTION_TYPES[t].formula(base);
    });
    return abilities;
  }

  // ===== 计算干预效果 =====
  function computeInterventionEffect(techniqueType, clientSheet, sessionState, G) {
    var base = G.psychologistBase;
    if (!base) return null;

    var tech = INTERVENTION_TYPES[techniqueType];
    if (!tech) return null;

    // 技术能力值
    var ability = tech.formula(base);

    // 联盟系数
    var allianceCoeff = sessionState.currentAlliance / 100;

    // 时机恰当度（默认 1.0，可由外部传入）
    var timing = 1.0;

    // 防御阻碍
    var defStr = clientSheet.defenseProfile.defenseStrength || 50;
    var defenseObstacle = defStr / 100;

    // 阻抗阻碍
    var resist = clientSheet.therapeuticResistance || 50;
    var resistanceObstacle = resist / 100;

    // 随机因素
    var random = randFactor();

    // rawEffect
    var rawEffect = ability * allianceCoeff * timing - defenseObstacle * resistanceObstacle * 50 + random * 20;
    if (rawEffect < 0) rawEffect = 0;

    // 分配效果
    var effect = {};
    var effDefs = tech.effects;
    if (typeof effDefs.allianceChange === "function") effect.allianceChange = effDefs.allianceChange(rawEffect);
    if (typeof effDefs.allianceChange === "number") effect.allianceChange = effDefs.allianceChange;
    if (typeof effDefs.defenseChange === "function") effect.defenseChange = effDefs.defenseChange(rawEffect);
    if (typeof effDefs.defenseChange === "number") effect.defenseChange = effDefs.defenseChange;
    if (typeof effDefs.symptomChange === "function") effect.symptomChange = effDefs.symptomChange(rawEffect);
    if (typeof effDefs.symptomChange === "number") effect.symptomChange = effDefs.symptomChange;
    if (typeof effDefs.insightGain === "function") effect.insightGain = effDefs.insightGain(rawEffect);
    if (typeof effDefs.insightGain === "number") effect.insightGain = effDefs.insightGain;

    effect.rawEffect = Math.round(rawEffect);
    return effect;
  }

  // ===== 启动个案会话 =====
  function startCaseSession(payload, G) {
    if (!payload || !G) return null;

    // 查找或创建来访者
    var client = null;
    if (payload.clientId && payload.clientId !== "new") {
      if (G.currentClients) {
        for (var i = 0; i < G.currentClients.length; i++) {
          if (G.currentClients[i].id === payload.clientId) {
            client = G.currentClients[i];
            break;
          }
        }
      }
    }

    if (!client && payload.newClient) {
      var ClientCharacterSheet = global.ClientCharacterSheet;
      if (ClientCharacterSheet) {
        client = ClientCharacterSheet.createNewClient(payload.newClient);
        if (client && G.currentClients) {
          G.currentClients.push(client);
        }
      }
    }

    if (!client) return null;

    // 计算治疗师能力
    var abilities = computeTherapistAbilities(G);

    // 初始化会话状态
    var sessionState = {
      round: 0,
      maxRounds: 20,
      clientId: client.id,
      initialSymptom: client.symptomLevel,
      initialAlliance: client.therapeuticAlliance,
      currentSymptom: client.symptomLevel,
      currentAlliance: client.therapeuticAlliance,
      insightGained: 0,
      allianceHistory: [],
      interventionLog: [],
      criticalMoments: [],
      terminated: false,
      outcome: null,
      abilities: abilities,
    };

    G.activeCaseSession = sessionState;
    G.pendingCaseSession = null;

    return sessionState;
  }

  // ===== 执行一个回合 =====
  function runCaseSessionRound(techniqueType, G) {
    var session = G.activeCaseSession;
    if (!session || session.terminated) return null;

    // 查找来访者
    var client = null;
    if (G.currentClients) {
      for (var i = 0; i < G.currentClients.length; i++) {
        if (G.currentClients[i].id === session.clientId) {
          client = G.currentClients[i];
          break;
        }
      }
    }
    if (!client) return null;

    // 计算干预效果
    var effect = computeInterventionEffect(techniqueType, client.clientSheet || client, session, G);
    if (!effect) return null;

    // 更新会话状态
    var allianceChange = effect.allianceChange || 0;
    var defenseChange = effect.defenseChange || 0;
    var symptomChange = effect.symptomChange || 0;
    var insightGain = effect.insightGain || 0;

    session.currentAlliance = clamp(session.currentAlliance + allianceChange, 0, 100);
    session.currentSymptom = clamp(session.currentSymptom + symptomChange, 0, 100);
    session.insightGained += insightGain;

    // 更新防御
    if (client.clientSheet && client.clientSheet.defenseProfile) {
      client.clientSheet.defenseProfile.defenseStrength = clamp(
        (client.clientSheet.defenseProfile.defenseStrength || 50) + defenseChange,
        10, 95
      );
    }

    session.allianceHistory.push({
      round: session.round,
      alliance: session.currentAlliance,
      change: allianceChange,
    });
    session.interventionLog.push({
      round: session.round,
      technique: techniqueType,
      effect: effect,
    });

    // 检查关键转折点
    if (allianceChange <= -15) {
      session.criticalMoments.push({ round: session.round, type: "treatment_crisis", desc: "治疗危机：联盟大幅下降" });
    }
    if (symptomChange <= -10) {
      session.criticalMoments.push({ round: session.round, type: "treatment_breakthrough", desc: "治疗突破：症状显著改善" });
    }
    if (insightGain >= 20) {
      session.criticalMoments.push({ round: session.round, type: "insight_moment", desc: "洞察时刻：来访者获得重要领悟" });
    }
    if (session.currentAlliance <= 10) {
      session.criticalMoments.push({ round: session.round, type: "dropout_risk", desc: "来访者脱落风险" });
    }

    session.round++;

    // 检查终止条件
    if (session.currentSymptom <= 5 || session.currentAlliance <= 0 || session.round >= session.maxRounds) {
      session.outcome = computeSessionOutcome(session, client);
      session.terminated = true;
    }

    return {
      round: session.round - 1,
      effect: effect,
      session: {
        currentAlliance: session.currentAlliance,
        currentSymptom: session.currentSymptom,
        insightGained: session.insightGained,
        terminated: session.terminated,
      },
    };
  }

  // ===== 会话结算 =====
  function computeSessionOutcome(sessionState, client) {
    if (!sessionState) return null;

    var initialSymptom = sessionState.initialSymptom || 1;
    var currentSymptom = sessionState.currentSymptom || 0;
    var initialAlliance = sessionState.initialAlliance || 1;

    var symptomImprove = (initialSymptom - currentSymptom) / initialSymptom * 100;
    var allianceMaintain = sessionState.currentAlliance / initialAlliance * 100;

    var composite = symptomImprove * 0.5 + allianceMaintain * 0.3 + (sessionState.insightGained / 100) * 0.2;

    var rating = "D";
    if (composite > 90) rating = "S";
    else if (composite > 70) rating = "A";
    else if (composite > 50) rating = "B";
    else if (composite > 30) rating = "C";

    return {
      symptomImprove: Math.round(symptomImprove),
      allianceMaintain: Math.round(allianceMaintain),
      composite: Math.round(composite),
      rating: rating,
      totalRounds: sessionState.round,
    };
  }

  // ===== 应用会话结果到游戏 =====
  function applySessionResultToGame(G) {
    var session = G.activeCaseSession;
    if (!session || !session.outcome) return null;

    var outcome = session.outcome;

    // 查找来访者
    var client = null;
    var clientIdx = -1;
    if (G.currentClients) {
      for (var i = 0; i < G.currentClients.length; i++) {
        if (G.currentClients[i].id === session.clientId) {
          client = G.currentClients[i];
          clientIdx = i;
          break;
        }
      }
    }

    // 1. 临床时数
    var hoursGain = (outcome.rating === "S" || outcome.rating === "A") ? 2 : 1;
    G.clinicalHours = (G.clinicalHours || 0) + hoursGain;

    // 2. 理论时数
    if (G.activeTheoryOrientation && G.theoryMastery) {
      if (!G.theoryMastery[G.activeTheoryOrientation]) {
        G.theoryMastery[G.activeTheoryOrientation] = { stage: 0, hours: 0 };
      }
      G.theoryMastery[G.activeTheoryOrientation].hours += 1;
    }

    // 3. 更新来访者档案
    if (client) {
      client.sessionCount = (client.sessionCount || 0) + session.round;
      client.symptomLevel = session.currentSymptom;
      client.therapeuticAlliance = session.currentAlliance;

      if (session.currentSymptom <= 5) {
        client.treatmentPhase = "termination";
      } else if (session.round >= 15) {
        client.treatmentPhase = "middle";
      } else {
        client.treatmentPhase = "initial";
      }

      // 结案检查
      if (client.treatmentPhase === "termination" && client.symptomLevel <= 5) {
        if (!G.completedCases) G.completedCases = [];
        G.completedCases.push({
          clientId: client.id,
          displayName: client.displayName,
          sessionsCount: client.sessionCount,
          initialSymptom: session.initialSymptom,
          finalSymptom: session.currentSymptom,
          outcomeRating: outcome.rating,
          timestamp: G.worldTimeString || "",
        });
        // 从来访者列表移除
        if (clientIdx >= 0) {
          G.currentClients.splice(clientIdx, 1);
        }
      }
    }

    // 4. 反移情检查
    checkAndApplyCountertransference(G, client, outcome);

    // 5. 生成督导记录
    if (outcome.rating === "C" || outcome.rating === "D") {
      if (!G.careerHistory) G.careerHistory = [];
      G.careerHistory.push({
        time: G.worldTimeString || "",
        event: "个案评级 " + outcome.rating + "，建议寻求督导",
        type: "supervision_required",
      });
    }

    // 6. 清理会话状态
    if (!G.caseSessionHistory) G.caseSessionHistory = [];
    G.caseSessionHistory.push({
      clientId: session.clientId,
      outcome: outcome,
      timestamp: G.worldTimeString || "",
    });
    G.activeCaseSession = null;
    G.pendingCaseSession = null;

    return outcome;
  }

  // ===== 反移情检查 =====
  function checkAndApplyCountertransference(G, client, outcome) {
    if (!client || !G.countertransference) return;

    var ct = G.countertransference;
    // 检查相似度（简化版）
    if (client.caseType === "trauma" || client.caseType === "existential_crisis") {
      ct.overIdentification = (ct.overIdentification || 0) + 1;
    }
    if (outcome.rating === "C" || outcome.rating === "D") {
      ct.burnoutNumbness = (ct.burnoutNumbness || 0) + 1;
    }

    // 更新风险等级
    var PsychologistBaseRuntime = global.PsychologistBaseRuntime;
    if (PsychologistBaseRuntime && PsychologistBaseRuntime.computeRiskLevel) {
      ct.overallRiskLevel = PsychologistBaseRuntime.computeRiskLevel(G);
    }
  }

  // ===== 获取当前会话的来访者对象 =====
  function getSessionClient(G) {
    var session = G.activeCaseSession;
    if (!session || !G.currentClients) return null;
    for (var i = 0; i < G.currentClients.length; i++) {
      if (G.currentClients[i].id === session.clientId) {
        return G.currentClients[i];
      }
    }
    return null;
  }

  // ===== 暴露 API =====
  global.CaseSessionEngine = {
    INTERVENTION_TYPES: INTERVENTION_TYPES,
    computeTherapistAbilities: computeTherapistAbilities,
    computeInterventionEffect: computeInterventionEffect,
    startCaseSession: startCaseSession,
    runCaseSessionRound: runCaseSessionRound,
    computeSessionOutcome: computeSessionOutcome,
    applySessionResultToGame: applySessionResultToGame,
    getSessionClient: getSessionClient,
  };
})(typeof window !== "undefined" ? window : globalThis);
