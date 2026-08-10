/**
 * fateChoiceController.js — 启动页命运抉择控制器
 * 对应架构文档 §4.2 启动页核心流程, logic-flow §2.2 人生选择详细流程
 *
 * 提供 PsyFateChoiceController 命名空间，实现5步人生选择流程。
 */
(function (global) {
  "use strict";

  // ===== 存储键常量 =====
  var BOOTSTRAP_KEY = "psydoctor_bootstrap_v1";
  var SAVE_PREFIX = "PSY_SAVE_V1:";
  var SAVE_INDEX_KEY = "PSY_SAVES_INDEX_V1";
  var ACTIVE_SAVE_ID_KEY = "PSY_ACTIVE_SAVE_ID_V1";

  // ===== 内部控制状态 =====
  var _state = {
    step: 0,
    maxStep: 5,
    education: null,
    motivation: null,
    traits: [],
    initialTheory: null,
    playerName: "",
    gender: "女",
    age: 20,
  };

  // ===== DOM 缓存 =====
  var _dom = {};

  function cacheDom() {
    _dom = {
      stepIndicator: document.getElementById("creation-step-indicator"),
      content: document.getElementById("creation-content"),
      nav: document.getElementById("creation-nav"),
      traitDetailRoot: document.getElementById("psy-trait-detail-root"),
      dialogRoot: document.getElementById("psy-dialog-root"),
    };
  }

  function qs(id) { return document.getElementById(id) || _dom[id]; }

  // ===== 初始化 =====
  function init() {
    cacheDom();
    _state.step = 0;
    _state.education = null;
    _state.motivation = null;
    _state.traits = [];
    _state.initialTheory = null;
    _state.playerName = "";
    _state.gender = "女";
    _state.age = 20;
    renderStepIndicator();
    renderStep(1);
  }

  // ===== 步骤指示器 =====
  var STEP_LABELS = ["", "教育背景", "入行契机", "个人特质", "初始理论", "角色信息"];

  function renderStepIndicator() {
    var el = _dom.stepIndicator;
    if (!el) return;
    var html = "";
    for (var i = 1; i <= 5; i++) {
      var cls = "creation-step-dot";
      if (i < _state.step) cls += " creation-step-dot--done";
      else if (i === _state.step) cls += " creation-step-dot--active";
      html += '<div class="' + cls + '" data-step="' + i + '">'
        + '<span class="creation-step-num">' + i + '</span>'
        + '<span class="creation-step-label">' + STEP_LABELS[i] + '</span>'
        + '</div>';
    }
    el.innerHTML = html;
  }

  // ===== Step 1: 教育背景 =====
  function renderStep1() {
    var PsyDoctorCreationConfig = global.PsyDoctorCreationConfig;
    var options = PsyDoctorCreationConfig ? PsyDoctorCreationConfig.EDUCATION_OPTIONS : [];

    var html = '<h2 class="creation-section-title">选择你的教育背景</h2>';
    html += '<p class="creation-section-desc">你的教育背景将决定初始等级、理论取向和属性加成。</p>';
    html += '<div class="creation-card-grid">';

    options.forEach(function (opt) {
      var selected = _state.education && _state.education.key === opt.key ? " creation-card--selected" : "";
      var bonusDesc = "";
      if (opt.bonus) {
        var bkeys = Object.keys(opt.bonus);
        bonusDesc = bkeys.map(function (k) {
          return (global.CharacterAttribute ? global.CharacterAttribute.getAttributeLabel(k) : k) + "+" + opt.bonus[k];
        }).join(" ");
      }
      html += '<div class="creation-card' + selected + '" data-edu-key="' + opt.key + '">'
        + '<div class="creation-card-title">' + opt.label + '</div>'
        + '<div class="creation-card-desc">' + (opt.desc || "") + '</div>'
        + '<div class="creation-card-meta">'
        + '初始等级：' + (opt.initialLevel ? (opt.initialLevel.major + "·" + opt.initialLevel.minor) : "心理学徒·初窥")
        + ' | 理论：' + (opt.initialTheory || "来访者中心")
        + '</div>'
        + '<div class="creation-card-bonus">属性加成：' + bonusDesc + '</div>'
        + '</div>';
    });

    html += '</div>';
    _dom.content.innerHTML = html;

    // 绑定事件
    _dom.content.querySelectorAll(".creation-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var key = this.getAttribute("data-edu-key");
        var PsyDoctorCreationConfig = global.PsyDoctorCreationConfig;
        var edu = PsyDoctorCreationConfig ? PsyDoctorCreationConfig.getEducationByKey(key) : null;
        if (edu) {
          _state.education = edu;
          // 自动设置初始理论
          _state.initialTheory = edu.initialTheory;
          // 自动设置年龄
          _state.age = edu.age || 20;
          // 重新渲染高亮
          renderStep1();
          renderNavButtons();
        }
      });
    });
  }

  // ===== Step 2: 入行契机 =====
  function renderStep2() {
    var PsyDoctorCreationConfig = global.PsyDoctorCreationConfig;
    var options = PsyDoctorCreationConfig ? PsyDoctorCreationConfig.MOTIVATION_OPTIONS : [];

    var html = '<h2 class="creation-section-title">选择你的入行契机</h2>';
    html += '<p class="creation-section-desc">是什么让你走上了心理咨询的道路？这将影响你的初始属性。</p>';
    html += '<div class="creation-card-grid">';

    options.forEach(function (opt) {
      var selected = _state.motivation && _state.motivation.key === opt.key ? " creation-card--selected" : "";
      var bonusDesc = "";
      if (opt.bonus) {
        var bkeys = Object.keys(opt.bonus);
        bonusDesc = bkeys.map(function (k) {
          return (global.CharacterAttribute ? global.CharacterAttribute.getAttributeLabel(k) : k) + "+" + opt.bonus[k];
        }).join(" ");
      }
      html += '<div class="creation-card' + selected + '" data-mot-key="' + opt.key + '">'
        + '<div class="creation-card-title">' + opt.label + '</div>'
        + '<div class="creation-card-desc">' + (opt.desc || "") + '</div>'
        + '<div class="creation-card-bonus">属性加成：' + bonusDesc + '</div>'
        + '</div>';
    });

    html += '</div>';
    _dom.content.innerHTML = html;

    _dom.content.querySelectorAll(".creation-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var key = this.getAttribute("data-mot-key");
        var PsyDoctorCreationConfig = global.PsyDoctorCreationConfig;
        var mot = PsyDoctorCreationConfig ? PsyDoctorCreationConfig.getMotivationByKey(key) : null;
        if (mot) {
          _state.motivation = mot;
          renderStep2();
          renderNavButtons();
        }
      });
    });
  }

  // ===== Step 3: 个人特质 =====
  function renderStep3() {
    var PsyTraitSamples = global.PsyTraitSamples;
    var categories = PsyTraitSamples ? PsyTraitSamples.TRAIT_CATEGORIES : {};
    var catKeys = PsyTraitSamples ? PsyTraitSamples.getCategoryKeys() : [];

    var html = '<h2 class="creation-section-title">选择你的个人特质</h2>';
    html += '<p class="creation-section-desc">选择2个最能描述你的特质（可跨类别）。特质影响你的可成长属性。</p>';
    html += '<div class="creation-trait-count">已选：' + _state.traits.length + '/2</div>';

    // 分类标签
    html += '<div class="creation-trait-tabs">';
    catKeys.forEach(function (cat, idx) {
      var active = idx === 0 ? " creation-trait-tab--active" : "";
      html += '<button class="creation-trait-tab' + active + '" data-cat="' + cat + '">' + (categories[cat] ? categories[cat].label : cat) + '</button>';
    });
    html += '</div>';

    // 特质内容
    html += '<div class="creation-trait-contents">';
    catKeys.forEach(function (cat, idx) {
      var show = idx === 0 ? "" : " hidden";
      html += '<div class="creation-trait-content' + show + '" data-cat="' + cat + '">';
      html += '<div class="creation-card-grid">';
      var traits = PsyTraitSamples ? PsyTraitSamples.getTraitsByCategory(cat) : [];
      traits.forEach(function (t) {
        var selected = _state.traits.some(function (st) { return st.key === t.key; }) ? " creation-card--selected" : "";
        var disabled = _state.traits.length >= 2 && !selected ? " creation-card--disabled" : "";
        var bonusDesc = "";
        if (t.bonus) {
          var bkeys = Object.keys(t.bonus);
          bonusDesc = bkeys.map(function (k) {
            return (global.CharacterAttribute ? global.CharacterAttribute.getAttributeLabel(k) : k) + "+" + t.bonus[k];
          }).join(" ");
        }
        html += '<div class="creation-card' + selected + disabled + '" data-trait-key="' + t.key + '" data-cat="' + cat + '">'
          + '<div class="creation-card-title">' + t.label + '</div>'
          + '<div class="creation-card-desc">' + t.desc + '</div>'
          + '<div class="creation-card-bonus">' + bonusDesc + '</div>'
          + '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    _dom.content.innerHTML = html;

    // 绑定事件
    // 标签页切换
    _dom.content.querySelectorAll(".creation-trait-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        _dom.content.querySelectorAll(".creation-trait-tab").forEach(function (t) { t.classList.remove("creation-trait-tab--active"); });
        this.classList.add("creation-trait-tab--active");
        var cat = this.getAttribute("data-cat");
        _dom.content.querySelectorAll(".creation-trait-content").forEach(function (c) {
          c.classList.add("hidden");
          if (c.getAttribute("data-cat") === cat) c.classList.remove("hidden");
        });
      });
    });

    // 特质选择
    _dom.content.querySelectorAll(".creation-card[data-trait-key]").forEach(function (card) {
      card.addEventListener("click", function () {
        if (this.classList.contains("creation-card--disabled")) return;
        var key = this.getAttribute("data-trait-key");
        var cat = this.getAttribute("data-cat");
        var idx = _state.traits.findIndex(function (st) { return st.key === key; });
        if (idx >= 0) {
          _state.traits.splice(idx, 1);
        } else {
          if (_state.traits.length >= 2) return;
          var PsyTraitSamples = global.PsyTraitSamples;
          var trait = PsyTraitSamples ? PsyTraitSamples.getTraitByKey(key) : null;
          if (trait) {
            _state.traits.push({ key: trait.key, label: trait.label, category: cat, desc: trait.desc, bonus: trait.bonus });
          }
        }
        renderStep3();
        renderNavButtons();
      });
    });
  }

  // ===== Step 4: 初始理论微调 =====
  function renderStep4() {
    var current = _state.initialTheory || (_state.education ? _state.education.initialTheory : "来访者中心治疗");
    var theoryOptions = [
      "来访者中心治疗", "认知治疗", "经典精神分析", "存在主义治疗", "家庭治疗",
      "正念减压", "辩证行为治疗", "叙事治疗", "情绪聚焦治疗", "接纳承诺治疗",
      "心理动力治疗", "人际心理治疗", "图式治疗", "正念认知治疗",
      "格式塔治疗", "依恋理论", "客体关系理论", "动机式访谈",
    ];

    var html = '<h2 class="creation-section-title">微调初始理论取向</h2>';
    html += '<p class="creation-section-desc">理论取向影响你的咨询风格和叙事视角。可根据你的教育背景进行微调。</p>';
    html += '<div class="creation-info-field">';
    html += '<label class="creation-info-label">当前理论取向</label>';
    html += '<select id="theory-select" class="creation-info-select">';
    theoryOptions.forEach(function (t) {
      var sel = t === current ? " selected" : "";
      html += '<option value="' + t + '"' + sel + '>' + t + '</option>';
    });
    html += '</select>';
    html += '<div class="creation-card-desc" style="margin-top:0.5rem;">你的教育背景默认取向：' + (_state.education ? _state.education.initialTheory : "来访者中心治疗") + '</div>';
    html += '</div>';

    _dom.content.innerHTML = html;

    var select = document.getElementById("theory-select");
    if (select) {
      select.addEventListener("change", function () {
        _state.initialTheory = this.value;
        renderNavButtons();
      });
    }
  }

  // ===== Step 5: 角色信息 =====
  function renderStep5() {
    var html = '<h2 class="creation-section-title">角色信息</h2>';
    html += '<p class="creation-section-desc">完善你的角色基本信息。</p>';
    html += '<div class="creation-info-field">';
    html += '<label class="creation-info-label">角色名</label>';
    html += '<input id="player-name-input" class="creation-info-input" type="text" value="' + escHtml(_state.playerName) + '" placeholder="输入你的角色名" />';
    html += '</div>';
    html += '<div class="creation-info-field">';
    html += '<label class="creation-info-label">性别</label>';
    html += '<div class="creation-gender-group">';
    ["女", "男", "其他"].forEach(function (g) {
      var checked = _state.gender === g ? " checked" : "";
      html += '<label class="creation-gender-option"><input type="radio" name="gender" value="' + g + '"' + checked + ' /> ' + g + '</label>';
    });
    html += '</div>';
    html += '</div>';
    html += '<div class="creation-info-field">';
    html += '<label class="creation-info-label">年龄</label>';
    html += '<div class="creation-age-display">' + _state.age + '岁</div>';
    html += '<div class="creation-age-hint">根据教育背景自动设定，可微调 ±3 岁</div>';
    html += '<input id="player-age-input" class="creation-info-input" type="range" min="' + Math.max(18, _state.age - 3) + '" max="' + (_state.age + 3) + '" value="' + _state.age + '" />';
    html += '</div>';

    _dom.content.innerHTML = html;

    var nameInput = document.getElementById("player-name-input");
    if (nameInput) {
      nameInput.addEventListener("input", function () { _state.playerName = this.value; });
    }
    document.querySelectorAll("input[name='gender']").forEach(function (r) {
      r.addEventListener("change", function () { if (this.checked) _state.gender = this.value; });
    });
    var ageInput = document.getElementById("player-age-input");
    if (ageInput) {
      ageInput.addEventListener("input", function () { _state.age = parseInt(this.value) || _state.age; });
    }
  }

  // ===== 导航按钮 =====
  function renderNavButtons() {
    var el = _dom.nav;
    if (!el) return;

    var html = "";

    if (_state.step > 1) {
      html += '<button class="splash-btn splash-btn--secondary" id="creation-prev-btn">上一步</button>';
    }

    if (_state.step < 5) {
      html += '<button class="splash-btn" id="creation-next-btn">下一步</button>';
    } else {
      html += '<button class="splash-btn" id="creation-finish-btn">开始人生</button>';
    }

    el.innerHTML = html;

    var prevBtn = document.getElementById("creation-prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", function () { _state.step--; renderStepIndicator(); renderStep(_state.step); renderNavButtons(); });

    var nextBtn = document.getElementById("creation-next-btn");
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (validateStep(_state.step)) {
        _state.step++;
        renderStepIndicator();
        renderStep(_state.step);
        renderNavButtons();
      }
    });

    var finishBtn = document.getElementById("creation-finish-btn");
    if (finishBtn) finishBtn.addEventListener("click", finishCreation);
  }

  // ===== 步骤校验 =====
  function validateStep(step) {
    if (step === 1 && !_state.education) { alert("请选择一个教育背景"); return false; }
    if (step === 2 && !_state.motivation) { alert("请选择一个入行契机"); return false; }
    if (step === 3 && _state.traits.length === 0) { alert("请选择至少1个个人特质"); return false; }
    if (step === 5) {
      var nameInput = document.getElementById("player-name-input");
      if (nameInput && !nameInput.value.trim()) { alert("请输入角色名"); nameInput.focus(); return false; }
      _state.playerName = nameInput ? nameInput.value.trim() : _state.playerName;
    }
    return true;
  }

  // ===== 渲染步骤 =====
  function renderStep(step) {
    switch (step) {
      case 1: renderStep1(); break;
      case 2: renderStep2(); break;
      case 3: renderStep3(); break;
      case 4: renderStep4(); break;
      case 5: renderStep5(); break;
    }
  }

  // ===== 完成创建 =====
  function finishCreation() {
    if (!validateStep(5)) return;

    // 构建 fateChoice
    var fateChoice = {
      education: _state.education ? _state.education.label : "",
      motivation: _state.motivation ? _state.motivation.label : "",
      initialTheory: _state.initialTheory || (_state.education ? _state.education.initialTheory : ""),
      traits: _state.traits.map(function (t) {
        return { key: t.key, label: t.label, category: t.category, desc: t.desc, bonus: t.bonus };
      }),
      playerName: _state.playerName,
      gender: _state.gender,
      age: _state.age,
    };

    // 创建存档 ID
    var saveId = "PSY_save_" + Date.now().toString(36);

    // 构建 PsyDoctorGame 初始对象
    var game = buildInitialGame(fateChoice);

    // 写入存档
    try {
      localStorage.setItem(SAVE_PREFIX + saveId, JSON.stringify(game));
      // 更新索引
      var idxRaw = localStorage.getItem(SAVE_INDEX_KEY);
      var ids = idxRaw ? JSON.parse(idxRaw) : [];
      if (!Array.isArray(ids)) ids = [];
      if (ids.indexOf(saveId) === -1) ids.push(saveId);
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(ids));
      localStorage.setItem(ACTIVE_SAVE_ID_KEY, saveId);

      // 写入 bootstrap
      var bootstrap = { fateChoice: fateChoice, game: game };
      sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(bootstrap));

      // 跳转
      window.location.href = "./main.html";
    } catch (e) {
      alert("创建存档失败：" + (e.message || e));
    }
  }

  // ===== 构建初始游戏状态 =====
  function buildInitialGame(fateChoice) {
    var edu = _state.education;
    var mot = _state.motivation;

    var initialLevel = edu ? { major: edu.initialLevel.major, minor: edu.initialLevel.minor } : { major: "心理学徒", minor: "初窥" };

    // 计算 levelIndex
    var levelIndex = 0;
    var DoctorLevelState = global.DoctorLevelState;
    if (DoctorLevelState) {
      for (var i = 0; i <= 20; i++) {
        var major = DoctorLevelState.getMajorStage(i);
        var minor = DoctorLevelState.getMinorStage(i);
        if (major === initialLevel.major && minor === initialLevel.minor) {
          levelIndex = i;
          break;
        }
      }
    }

    // 计算初始属性
    var baseStats = DoctorLevelState ? DoctorLevelState.getBaseStats(levelIndex) : null;
    var base = baseStats ? {
      empathy: baseStats.empathy, insight: baseStats.insight, knowledge: baseStats.knowledge,
      technique: baseStats.technique, judgment: baseStats.judgment, awareness: baseStats.awareness,
      communication: baseStats.communication, resilience: baseStats.resilience,
      humanity: baseStats.humanity, philosophy: baseStats.philosophy,
    } : { empathy:10, insight:5, knowledge:10, technique:3, judgment:3, awareness:5, communication:8, resilience:5, humanity:10, philosophy:5 };

    // 应用 bonus
    if (edu && edu.bonus) {
      var ek = Object.keys(edu.bonus);
      ek.forEach(function (k) { if (base[k] !== undefined) base[k] += edu.bonus[k]; });
    }
    if (mot && mot.bonus) {
      var mk = Object.keys(mot.bonus);
      mk.forEach(function (k) { if (base[k] !== undefined) base[k] += mot.bonus[k]; });
    }
    if (_state.traits) {
      _state.traits.forEach(function (t) {
        if (t.bonus) {
          var bk = Object.keys(t.bonus);
          bk.forEach(function (k) { if (base[k] !== undefined) base[k] += t.bonus[k]; });
        }
      });
    }

    var game = {
      fateChoice: fateChoice,
      doctorLevel: initialLevel,
      levelIndex: levelIndex,
      psychologistBase: base,
      currentFatigue: 0,
      burnoutLevel: 0,
      clinicalHours: 0,
      supervisionHours: 0,
      personalTherapyHours: 0,
      researchPoints: 0,
      theoryMastery: {},
      activeTheoryOrientation: fateChoice.initialTheory,
      philosophyDepth: { phenomenology: 0, hermeneutics: 0, existential: 0, eastern: 0, postmodern: 0 },
      currentWorkplace: edu ? (edu.defaultWorkplace || "大学校园/图书馆") : "大学校园/图书馆",
      currentLocation: edu ? (edu.defaultLocation || "北京") : "北京",
      worldTimeString: (2024 + "年 09月 01日 08:00"),
      worldTimeStack: [],
      age: fateChoice.age || 20,
      currentClients: [],
      completedCases: [],
      nearbyPeople: [],
      countertransference: { overIdentification: 0, defensiveDistancing: 0, saviorComplex: 0, professionalArrogance: 0, burnoutNumbness: 0, ethicalBlurring: 0, overallRiskLevel: "low" },
      careerHistory: [],
      publications: [],
      reputation: 0,
      activeCareerEvents: [],
      bookShelf: [],
      assessmentTools: [],
      therapyTools: [],
      consultationRoomItems: [],
      chatHistory: [],
      pendingCaseSession: null,
      activeCaseSession: null,
      caseSessionHistory: [],
      activeEthicalDilemma: null,
      psyInitStateAiApplied: false,
    };

    // 初始化理论掌握
    if (fateChoice.initialTheory) {
      game.theoryMastery[fateChoice.initialTheory] = { stage: 1, hours: 5 };
    }

    return game;
  }

  // ===== 工具函数 =====
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ===== 暴露 API =====
  global.PsyFateChoiceController = {
    init: init,
    getState: function () { return _state; },
  };
})(typeof window !== "undefined" ? window : globalThis);
