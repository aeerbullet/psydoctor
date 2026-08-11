/**
 * mainScreen_map.js — 地图系统 + 页面解耦
 * 对应设计文档 spec/psydoctor/map-system-design.md
 *
 * 提供 PsyMainScreenMap 命名空间：
 * - 地图枢纽（默认落点）：4 个地点节点 + 待办角标
 * - 地点切换：切背景图 + 按地点分发左右栏面板
 * - 角色档案弹层（8+2 属性）
 */
(function (global) {
  "use strict";

  // ===== 地点配置（id → 标签/背景图/场景类型） =====
  var LOCATIONS = {
    consultation: { id: "consultation", label: "咨询室", icon: "🛋", sceneType: "therapy_session", bg: "image/咨询室.png" },
    study: { id: "study", label: "书房", icon: "📚", sceneType: "academic", bg: "image/书房.png" },
    supervision: { id: "supervision", label: "督导室", icon: "👥", sceneType: "supervision", bg: "image/督导室.png" },
    city: { id: "city", label: "城市", icon: "🌆", sceneType: "daily_life", bg: "image/城市街道.png" },
  };
  var MAP_BG = "image/地图.png";

  // ===== 存储键：当前地点 =====
  var LOCATION_STORAGE_KEY = "psydoctor_current_location_v1";

  // ===== 内部状态：当前激活地点 =====
  var _currentLoc = null;

  // ===== DOM 缓存 =====
  var _dom = {};

  function qs(id) { return document.getElementById(id); }

  function cacheDom() {
    _dom = {
      mapOverlay: qs("psy-map-overlay"),
      mapNodes: qs("psy-map-nodes"),
      mapOverview: qs("psy-map-overview"),
      mapCloseBtn: qs("psy-map-close-btn"),
      mapToggleBtn: qs("psy-map-toggle-btn"),
      profileRoot: qs("psy-profile-root"),
      profileToggleBtn: qs("psy-profile-toggle-btn"),
      headerLocation: qs("psy-header-location"),
      locTitle: qs("psy-loc-title"),
      chatPane: document.querySelector(".psy-pane--chat"),
    };
  }

  // ===== 初始化 =====
  function init() {
    cacheDom();
    bindEvents();

    // 恢复上次地点（默认城市？默认地图）
    var savedLoc = readSavedLocation();
    if (savedLoc && LOCATIONS[savedLoc]) {
      enterLocation(savedLoc, true);
    } else {
      showMap(true);
    }
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    var dom = _dom;

    if (dom.mapToggleBtn) {
      dom.mapToggleBtn.addEventListener("click", function () { showMap(true); });
    }
    if (dom.mapCloseBtn) {
      dom.mapCloseBtn.addEventListener("click", function () {
        // 关闭地图：若尚未进入任何地点，默认进入咨询室
        if (!_currentLoc) {
          if (isLocationSwitchBlocked()) {
            showMap(false);
            return;
          }
          enterLocation("consultation", true);
        } else {
          showMap(false);
        }
      });
    }
    if (dom.profileToggleBtn) {
      dom.profileToggleBtn.addEventListener("click", function () { toggleProfileModal(); });
    }

    // 角色档案弹层关闭
    if (dom.profileRoot) {
      dom.profileRoot.querySelectorAll("[data-psy-profile-close]").forEach(function (el) {
        el.addEventListener("click", function () { closeProfileModal(); });
      });
    }

    // 地图节点点击（事件委托，因为节点动态渲染）
    if (dom.mapNodes) {
      dom.mapNodes.addEventListener("click", function (e) {
        var node = e.target.closest ? e.target.closest("[data-loc]") : null;
        if (node && node.getAttribute("data-loc")) {
          var locId = node.getAttribute("data-loc");
          if (isLocationSwitchBlocked()) {
            showMap(false);
            return;
          }
          enterLocation(locId, false);
        }
      });
    }
  }

  // ===== 判断地点切换是否被阻止（个案会话 / AI 生成中） =====
  function isLocationSwitchBlocked() {
    var G = getGame();
    if (G && G.activeCaseSession) {
      var PsyMainScreenChat = global.PsyMainScreenChat;
      if (PsyMainScreenChat && PsyMainScreenChat.appendChatMessage) {
        PsyMainScreenChat.appendChatMessage("个案会话进行中，请先完成当前干预。", "system");
      }
      return true;
    }
    if (global.PSY_AI_GENERATING) {
      var chat = global.PsyMainScreenChat;
      if (chat && chat.appendChatMessage) {
        chat.appendChatMessage("AI 正在回应，请稍候再切换地点。", "system");
      }
      return true;
    }
    return false;
  }

  // ===== 地图显示/隐藏 =====
  function showMap(visible) {
    var dom = _dom;
    if (!dom.mapOverlay) return;
    if (visible) {
      renderMap();
      // 地图视图下隐藏所有地点面板（保证页面纯净）
      document.querySelectorAll(".psy-loc-panel[data-loc]").forEach(function (panel) {
        panel.classList.add("hidden");
      });
      dom.mapOverlay.classList.remove("hidden");
      dom.mapOverlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      setHeaderLocation("map");
    } else {
      dom.mapOverlay.classList.add("hidden");
      dom.mapOverlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  // ===== 渲染地图（节点 + 待办角标 + 概览） =====
  function renderMap() {
    var dom = _dom;
    var G = getGame();

    // 概览
    if (dom.mapOverview) {
      var parts = [];
      if (G) {
        parts.push("时间：" + (G.worldTimeString || "—"));
        parts.push("地点：" + (G.currentLocation || "—"));
        parts.push("疲劳：" + (G.currentFatigue || 0) + "%");
      }
      dom.mapOverview.textContent = parts.join("  ·  ");
    }

    // 节点
    if (dom.mapNodes) {
      var html = "";
      var ids = Object.keys(LOCATIONS);
      ids.forEach(function (id) {
        var loc = LOCATIONS[id];
        var badge = computeTodoBadge(id);
        html += '<button type="button" class="psy-map-node" data-loc="' + id + '">'
          + '<span class="psy-map-node-icon">' + loc.icon + '</span>'
          + '<span class="psy-map-node-label">' + loc.label + '</span>'
          + (badge > 0 ? '<span class="psy-map-node-badge">' + badge + '</span>' : "")
          + '</button>';
      });
      dom.mapNodes.innerHTML = html;
    }
  }

  // ===== 计算地点待办角标数 =====
  function computeTodoBadge(locId) {
    var G = getGame();
    if (!G) return 0;
    switch (locId) {
      case "consultation":
        return (G.currentClients || []).length;
      case "supervision":
        return (G.activeCareerEvents || []).length;
      case "city":
        return (G.nearbyPeople || []).length;
      case "study":
        return 0;
      default:
        return 0;
    }
  }

  // ===== 进入地点 =====
  function enterLocation(locId, silent) {
    var loc = LOCATIONS[locId];
    if (!loc) return;

    // 记录当前激活地点
    _currentLoc = locId;

    // 关闭地图
    showMap(false);

    // 切换背景图（聊天区背景）
    setLocationBg(locId);

    // 切换左右栏面板可见性
    switchLocationPanels(locId);

    // 更新顶栏地点名 + 左栏标题
    setHeaderLocation(locId);
    if (_dom.locTitle) _dom.locTitle.textContent = loc.icon + " " + loc.label;

    // 记录当前地点（存档）
    saveCurrentLocation(locId);

    // 刷新面板
    refreshPanels();

    // 非静默切换：写入叙事提示 + 触发场景叙事（可选）
    if (!silent) {
      appendLocationMessage(loc);
    }
  }

  // ===== 切换背景图 =====
  function setLocationBg(locId) {
    var dom = _dom;
    var root = document.body;
    if (!root) return;

    // body 上挂 data-loc 供 CSS 选择器使用
    root.setAttribute("data-psy-loc", locId);

    // 聊天区背景直接内联背景图（保证跨设备一致）
    var bg = LOCATIONS[locId] ? LOCATIONS[locId].bg : MAP_BG;
    if (dom.chatPane) {
      dom.chatPane.style.backgroundImage = "url('" + bg + "')";
    }
  }

  // ===== 按地点切换左右栏面板 =====
  function switchLocationPanels(locId) {
    document.querySelectorAll(".psy-loc-panel[data-loc]").forEach(function (panel) {
      var show = panel.getAttribute("data-loc") === locId;
      panel.classList.toggle("hidden", !show);
    });
  }

  // ===== 顶栏地点名 =====
  function setHeaderLocation(locId) {
    if (!_dom.headerLocation) return;
    if (locId === "map") {
      _dom.headerLocation.textContent = "🗺 地图";
    } else {
      var loc = LOCATIONS[locId];
      if (loc) _dom.headerLocation.textContent = loc.icon + " " + loc.label;
    }
  }

  // ===== 刷新面板（数据 → UI） =====
  function refreshPanels() {
    var G = getGame();
    if (!G) return;
    var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
    var fc = global._psyFc || G.fateChoice || null;
    if (PsyMainScreenPanelUi) {
      PsyMainScreenPanelUi.renderLeftPanel(fc, G);
      PsyMainScreenPanelUi.renderRightPanel(G);
    }
  }

  // ===== 地点切换叙事提示 =====
  function appendLocationMessage(loc) {
    var PsyMainScreenChat = global.PsyMainScreenChat;
    if (!PsyMainScreenChat || !PsyMainScreenChat.appendChatMessage) return;
    var sceneHints = {
      consultation: "你走进了咨询室，整理好座位，等待今天的来访者。",
      study: "你回到书房，台灯亮着，书页在风中轻轻翻动。",
      supervision: "你敲响了督导室的门，准备汇报近期的个案工作。",
      city: "你走上城市的街道，各色身影与故事在此交汇。",
    };
    var text = loc.icon + " 你来到了「" + loc.label + "」。"
      + (sceneHints[loc.id] || "");
    PsyMainScreenChat.appendChatMessage(text, "system");
  }

  // ===== 角色档案弹层 =====
  function toggleProfileModal() {
    var root = _dom.profileRoot;
    if (!root) return;
    if (root.classList.contains("hidden")) {
      openProfileModal();
    } else {
      closeProfileModal();
    }
  }

  function openProfileModal() {
    var root = _dom.profileRoot;
    if (!root) return;
    var G = getGame();
    if (!G) return;
    var PsyMainScreenPanelUi = global.PsyMainScreenPanelUi;
    if (PsyMainScreenPanelUi && PsyMainScreenPanelUi.renderProfileBody) {
      PsyMainScreenPanelUi.renderProfileBody(G);
    }
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeProfileModal() {
    var root = _dom.profileRoot;
    if (!root) return;
    root.classList.add("hidden");
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ===== 存档/读档当前地点 =====
  function saveCurrentLocation(locId) {
    try {
      sessionStorage.setItem(LOCATION_STORAGE_KEY, locId);
    } catch (e) { /* ignore */ }
  }

  function readSavedLocation() {
    try {
      return sessionStorage.getItem(LOCATION_STORAGE_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  // ===== 工具函数 =====
  function getGame() {
    return global.PsyDoctorGame || null;
  }

  // ===== 暴露 API =====
  global.PsyMainScreenMap = {
    LOCATIONS: LOCATIONS,
    MAP_BG: MAP_BG,
    init: init,
    showMap: showMap,
    renderMap: renderMap,
    enterLocation: enterLocation,
    getCurrentLocation: function () {
      if (_currentLoc) return _currentLoc;
      return readSavedLocation();
    },
    getSceneType: function (locId) {
      var loc = LOCATIONS[locId] || null;
      return loc ? loc.sceneType : null;
    },
    computeTodoBadge: computeTodoBadge,
    toggleProfileModal: toggleProfileModal,
    openProfileModal: openProfileModal,
    closeProfileModal: closeProfileModal,
  };
})(typeof window !== "undefined" ? window : globalThis);
