/**
 * mainScreen_panel.js — 主界面面板数据逻辑（时数/藏书/来访者/存档/NPC）
 * 对应架构文档 §7.2 状态变更流, §15.1 面板分层, §17 持久化
 *
 * 提供 PsyMainScreenPanel 命名空间。
 */
(function (global) {
  "use strict";

  // ===== 存储键常量 =====
  var BOOTSTRAP_KEY = "psydoctor_bootstrap_v1";
  var SAVE_PREFIX = "PSY_SAVE_V1:";
  var SAVE_INDEX_KEY = "PSY_SAVES_INDEX_V1";
  var ACTIVE_SAVE_ID_KEY = "PSY_ACTIVE_SAVE_ID_V1";
  var LAST_SESSION_KEY = "psydoctor_last_session_v1";

  // ===== 物品上限 =====
  var BOOKSHELF_SLOT_MAX = 30;
  var TOOL_SLOT_MAX = 10;

  // ===== 获取当前 G =====
  function getGame() {
    return global.PsyDoctorGame || null;
  }

  // ===== 保存游戏 =====
  function saveGame(saveId) {
    var G = getGame();
    if (!G) return null;

    // AI 生成中跳过
    if (global.PSY_AI_GENERATING) return null;
    // 个案会话中跳过
    if (G.activeCaseSession) return null;

    if (!saveId) {
      saveId = "PSY_save_" + Date.now().toString(36);
    }

    // 构建存档摘要
    var summary = {
      playerName: G.fateChoice ? G.fateChoice.playerName : "未知",
      doctorLevel: (G.doctorLevel ? G.doctorLevel.major + "·" + G.doctorLevel.minor : "未知"),
      clinicalHours: G.clinicalHours || 0,
      worldTimeString: G.worldTimeString || "",
    };

    // 写入 localStorage
    var saveData = JSON.stringify({ summary: summary, game: G });
    try {
      localStorage.setItem(SAVE_PREFIX + saveId, saveData);

      // 更新索引
      var idxRaw = localStorage.getItem(SAVE_INDEX_KEY);
      var ids = idxRaw ? JSON.parse(idxRaw) : [];
      if (!Array.isArray(ids)) ids = [];
      if (ids.indexOf(saveId) === -1) ids.push(saveId);
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(ids));
      localStorage.setItem(ACTIVE_SAVE_ID_KEY, saveId);
    } catch (e) {
      var log = global.GameLog || global.console;
      (log.warn || console.warn)("[psy:save] 存档保存失败：" + (e.message || e));
    }

    return saveId;
  }

  // ===== 自动保存 =====
  function autoSave() {
    var G = getGame();
    if (!G) return;
    if (global.PSY_AI_GENERATING) return;
    if (G.activeCaseSession) return;

    try {
      var activeId = localStorage.getItem(ACTIVE_SAVE_ID_KEY);
      if (activeId) {
        saveGame(activeId);
      } else {
        saveGame();
      }

      // 写入 sessionStorage + localStorage 镜像
      var bootstrap = {
        fateChoice: G.fateChoice || null,
        game: G,
      };
      sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(bootstrap));
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(G));
    } catch (e) {
      // 静默失败
    }
  }

  // ===== 读档 =====
  function loadGame(saveId) {
    try {
      var raw = localStorage.getItem(SAVE_PREFIX + saveId);
      if (!raw) return null;

      var parsed = JSON.parse(raw);
      var gameData = parsed.game || parsed;

      // 基本校验
      if (!gameData.fateChoice || !gameData.doctorLevel) return null;

      // 设置全局
      global.PsyDoctorGame = gameData;

      // 补全
      ensureGameRuntimeDefaults(gameData);

      // 重算属性
      var PsychologistBaseRuntime = global.PsychologistBaseRuntime;
      if (PsychologistBaseRuntime) {
        PsychologistBaseRuntime.computePsychologistBase(gameData, gameData.fateChoice);
      }

      // 反移情检查
      var CountertransferenceTracker = global.CountertransferenceTracker;
      if (CountertransferenceTracker) {
        CountertransferenceTracker.checkRisk(gameData);
      }

      localStorage.setItem(ACTIVE_SAVE_ID_KEY, saveId);

      return gameData;
    } catch (e) {
      var log = global.GameLog || global.console;
      (log.warn || console.warn)("[psy:save] 读档失败：" + (e.message || e));
      return null;
    }
  }

  // ===== 删除存档 =====
  function deleteSave(saveId) {
    try {
      localStorage.removeItem(SAVE_PREFIX + saveId);
      var idxRaw = localStorage.getItem(SAVE_INDEX_KEY);
      var ids = idxRaw ? JSON.parse(idxRaw) : [];
      ids = ids.filter(function (x) { return x !== saveId; });
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(ids));
      if (localStorage.getItem(ACTIVE_SAVE_ID_KEY) === saveId) {
        localStorage.removeItem(ACTIVE_SAVE_ID_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  // ===== 列出存档 =====
  function listSaves() {
    try {
      var idxRaw = localStorage.getItem(SAVE_INDEX_KEY);
      var ids = idxRaw ? JSON.parse(idxRaw) : [];
      if (!Array.isArray(ids)) ids = [];
      return ids.map(function (id) {
        try {
          var raw = localStorage.getItem(SAVE_PREFIX + id);
          if (!raw) return null;
          var parsed = JSON.parse(raw);
          return { id: id, summary: parsed.summary || { playerName: "?", doctorLevel: "?", clinicalHours: 0 } };
        } catch (e) { return null; }
      }).filter(Boolean);
    } catch (e) { return []; }
  }

  // ===== 补全运行时默认值 =====
  function ensureGameRuntimeDefaults(G) {
    if (!G) return;

    if (!G.psychologistBase) {
      G.psychologistBase = { empathy:10, insight:5, knowledge:10, technique:3, judgment:3, awareness:5, communication:8, resilience:5, humanity:10, philosophy:5 };
    }
    if (!G.doctorLevel) G.doctorLevel = { major: "心理学徒", minor: "初窥" };
    if (G.levelIndex === undefined || G.levelIndex === null) G.levelIndex = 0;
    if (G.clinicalHours === undefined) G.clinicalHours = 0;
    if (G.supervisionHours === undefined) G.supervisionHours = 0;
    if (G.personalTherapyHours === undefined) G.personalTherapyHours = 0;
    if (G.researchPoints === undefined) G.researchPoints = 0;
    if (!G.currentFatigue) G.currentFatigue = 0;
    if (!G.burnoutLevel) G.burnoutLevel = 0;
    if (!G.theoryMastery) G.theoryMastery = {};
    if (!G.philosophyDepth) G.philosophyDepth = { phenomenology: 0, hermeneutics: 0, existential: 0, eastern: 0, postmodern: 0 };
    if (!G.currentClients) G.currentClients = [];
    if (!G.completedCases) G.completedCases = [];
    if (!G.nearbyPeople) G.nearbyPeople = [];
    if (!G.countertransference) {
      G.countertransference = { overIdentification: 0, defensiveDistancing: 0, saviorComplex: 0, professionalArrogance: 0, burnoutNumbness: 0, ethicalBlurring: 0, overallRiskLevel: "low" };
    }
    if (!G.careerHistory) G.careerHistory = [];
    if (!G.activeCareerEvents) G.activeCareerEvents = [];
    if (!G.bookShelf) G.bookShelf = [];
    if (!G.assessmentTools) G.assessmentTools = [];
    if (!G.therapyTools) G.therapyTools = [];
    if (!G.consultationRoomItems) G.consultationRoomItems = [];
    if (!G.chatHistory) G.chatHistory = [];
    // 读档清洗：剥离历史中已泄漏的裸四级行动建议 JSON（防止回传污染 AI）
    cleanChatHistory(G);
    if (!G.caseSessionHistory) G.caseSessionHistory = [];
    if (!G.worldTimeStack) G.worldTimeStack = [];
    if (!G.age) G.age = 20;
    if (!G.reputation) G.reputation = 0;
    if (!G.currentLocation) G.currentLocation = "北京";
    if (!G.currentWorkplace) G.currentWorkplace = "大学校园/图书馆";
  }

  // ===== 确保周围人物数组 =====
  function ensureNearbyPeopleArray(G) {
    if (!G) return;
    if (!Array.isArray(G.nearbyPeople)) G.nearbyPeople = [];
    if (!Array.isArray(G.currentClients)) G.currentClients = [];
  }

  // ===== 清洗聊天历史中的裸四级行动建议 JSON =====
  // 删除功能前或 AI 未按标签输出时，历史中可能残留 {aggressive/...} JSON，
  // 会被回传给 AI 导致格式延续。读档时统一清洗。
  function cleanChatHistory(G) {
    if (!G || !Array.isArray(G.chatHistory)) return;
    var PsyDoctorStoryGenerate = global.PsyDoctorStoryGenerate;
    if (!PsyDoctorStoryGenerate || typeof PsyDoctorStoryGenerate.stripActionSuggestionsJson !== "function") return;
    var cleaned = false;
    for (var i = 0; i < G.chatHistory.length; i++) {
      var msg = G.chatHistory[i];
      if (msg && typeof msg.content === "string" && msg.content.indexOf('"aggressive"') >= 0) {
        var c = PsyDoctorStoryGenerate.stripActionSuggestionsJson(msg.content);
        if (c !== msg.content) {
          msg.content = c;
          cleaned = true;
        }
      }
    }
    return cleaned;
  }

  // ===== 设置临床时数 =====
  function setClinicalHours(n) {
    var G = getGame();
    if (!G) return;
    G.clinicalHours = n;
    checkLevelUp(G);
  }

  // ===== 设置理论进度 =====
  function setTheoryProgress(theoryName, newStage, hours) {
    var G = getGame();
    if (!G) return;
    if (!G.theoryMastery) G.theoryMastery = {};
    if (!G.theoryMastery[theoryName]) G.theoryMastery[theoryName] = { stage: 0, hours: 0 };
    if (newStage !== undefined) G.theoryMastery[theoryName].stage = newStage;
    if (hours !== undefined) G.theoryMastery[theoryName].hours = hours;

    // 通知 UI
    var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
    if (PsyMainScreenPanelUi) PsyMainScreenPanelUi.updateTheoryDisplay(G);
  }

  // ===== 检查理论阶段晋升 =====
  function checkTheoryProgress(G) {
    if (!G || !G.theoryMastery) return [];
    var advancements = [];
    var tmKeys = Object.keys(G.theoryMastery);
    tmKeys.forEach(function (tn) {
      var m = G.theoryMastery[tn];
      if (!m || m.hours === undefined) return;
      var PsyDoctorStateRules = global.PsyDoctorStateRules;
      if (PsyDoctorStateRules) {
        var newStage = PsyDoctorStateRules.getTheoryStageByHours(m.hours);
        if (newStage > m.stage) {
          advancements.push({ theoryName: tn, oldStage: m.stage, newStage: newStage });
          m.stage = newStage;
        }
      }
    });
    return advancements;
  }

  // ===== 检查等级晋升 =====
  function checkLevelUp(G) {
    if (!G) return;
    var DoctorLevelState = global.DoctorLevelState;
    if (!DoctorLevelState) return;

    var currentIndex = G.levelIndex || 0;
    var maxIndex = DoctorLevelState.getMaxLevelIndex();
    if (currentIndex >= maxIndex) return;

    var nextIndex = currentIndex + 1;
    var nextReq = DoctorLevelState.getClinicalHoursRequired(nextIndex);
    if ((G.clinicalHours || 0) >= nextReq) {
      G.levelIndex = nextIndex;
      var stats = DoctorLevelState.getBaseStats(nextIndex);
      if (stats) {
        G.doctorLevel = { major: DoctorLevelState.getMajorStage(nextIndex), minor: DoctorLevelState.getMinorStage(nextIndex) };
      }
      // 重算属性
      var PsychologistBaseRuntime = global.PsychologistBaseRuntime;
      if (PsychologistBaseRuntime) {
        PsychologistBaseRuntime.computePsychologistBase(G, G.fateChoice);
      }
      // UI 通知
      var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
      if (PsyMainScreenPanelUi) {
        PsyMainScreenPanelUi.showLevelUpNotification(G);
      }
    }
  }

  // ===== 藏书操作 =====
  function addBookToShelf(book) {
    var G = getGame();
    if (!G) return false;
    if (!G.bookShelf) G.bookShelf = [];
    if (G.bookShelf.length >= BOOKSHELF_SLOT_MAX) return false;
    // 去重（同书名+作者）
    for (var i = 0; i < G.bookShelf.length; i++) {
      if (G.bookShelf[i].name === book.name && G.bookShelf[i].author === book.author) return false;
    }
    G.bookShelf.push(book);
    return true;
  }

  function removeBookFromShelf(index) {
    var G = getGame();
    if (!G || !G.bookShelf) return;
    if (index >= 0 && index < G.bookShelf.length) G.bookShelf.splice(index, 1);
  }

  // ===== 来访者操作 =====
  function setClientState(clientId, updates) {
    var G = getGame();
    if (!G || !G.currentClients || !updates) return;
    for (var i = 0; i < G.currentClients.length; i++) {
      if (G.currentClients[i].id === clientId) {
        var upKeys = Object.keys(updates);
        upKeys.forEach(function (k) {
          G.currentClients[i][k] = updates[k];
        });
        break;
      }
    }
  }

  function setNearbyPeople(list) {
    var G = getGame();
    if (!G) return;
    G.nearbyPeople = list || [];
  }

  function setCountertransference(type, change) {
    var G = getGame();
    if (!G || !G.countertransference) return;
    if (G.countertransference[type] !== undefined) {
      G.countertransference[type] = Math.max(0, G.countertransference[type] + change);
      if (G.countertransference[type] > 100) G.countertransference[type] = 100;
      var CountertransferenceTracker = global.CountertransferenceTracker;
      if (CountertransferenceTracker) CountertransferenceTracker.checkRisk(G);
    }
  }

  function setCurrentLocation(label, workplace) {
    var G = getGame();
    if (!G) return;
    if (label) G.currentLocation = label;
    if (workplace) G.currentWorkplace = workplace;
  }

  function resolveEthicalDilemma(choiceIndex) {
    var G = getGame();
    if (!G || !G.activeEthicalDilemma) return null;
    var EthicsDilemmaEngine = global.EthicsDilemmaEngine;
    if (!EthicsDilemmaEngine) return null;
    var result = EthicsDilemmaEngine.resolveDilemma(G, choiceIndex);
    autoSave();
    return result;
  }

  // ===== 暴露 API =====
  global.PsyMainScreenPanel = {
    STORAGE_KEY: BOOTSTRAP_KEY,
    SAVE_INDEX_KEY: SAVE_INDEX_KEY,
    SAVE_PREFIX: SAVE_PREFIX,
    BOOKSHELF_SLOT_MAX: BOOKSHELF_SLOT_MAX,
    TOOL_SLOT_MAX: TOOL_SLOT_MAX,
    getGame: getGame,
    saveGame: saveGame,
    loadGame: loadGame,
    deleteSave: deleteSave,
    listSaves: listSaves,
    autoSave: autoSave,
    ensureGameRuntimeDefaults: ensureGameRuntimeDefaults,
    ensureNearbyPeopleArray: ensureNearbyPeopleArray,
    cleanChatHistory: cleanChatHistory,
    setClinicalHours: setClinicalHours,
    setTheoryProgress: setTheoryProgress,
    checkTheoryProgress: checkTheoryProgress,
    checkLevelUp: checkLevelUp,
    addBookToShelf: addBookToShelf,
    removeBookFromShelf: removeBookFromShelf,
    setClientState: setClientState,
    setNearbyPeople: setNearbyPeople,
    setCountertransference: setCountertransference,
    setCurrentLocation: setCurrentLocation,
    resolveEthicalDilemma: resolveEthicalDilemma,
  };
})(typeof window !== "undefined" ? window : globalThis);
