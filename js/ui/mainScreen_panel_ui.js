/**
 * mainScreen_panel_ui.js — 面板 UI 渲染层
 * 对应架构文档 §15.1 面板分层、§15.2 渲染策略
 *
 * 提供 PsyMainScreenPanelUi 命名空间，实现所有 render* 函数和弹窗绑定。
 */
(function (global) {
  "use strict";

  // ===== DOM 查询 =====
  function qs(id) { return document.getElementById(id); }

  // ===== 工具函数 =====
  function clearContainer(el) {
    if (el) el.innerHTML = "";
  }

  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function cls(name) { return name; }

  // ===== 渲染左栏 =====
  function renderLeftPanel(fc, G) {
    if (!G) return;

    // 世界时间
    var wt = qs("psy-world-time");
    if (wt) wt.textContent = G.worldTimeString || "—";

    // 角色名
    var pn = qs("psy-player-name");
    if (pn) pn.textContent = (fc && fc.playerName) || (G.fateChoice && G.fateChoice.playerName) || "—";

    // 等级
    var ll = qs("psy-level-line");
    if (ll) {
      var major = G.doctorLevel ? G.doctorLevel.major : "";
      var minor = G.doctorLevel ? G.doctorLevel.minor : "";
      ll.textContent = major + "·" + minor;
    }

    // 临床时数
    var ct = qs("psy-clinical-hours-text");
    if (ct) ct.textContent = (G.clinicalHours || 0) + "h";
    var cbf = qs("psy-clinical-bar-fill");
    if (cbf) {
      var pct = 0;
      if (G.levelIndex !== undefined) {
        var DoctorLevelState = global.DoctorLevelState;
        var currentReq = DoctorLevelState ? DoctorLevelState.getClinicalHoursRequired(G.levelIndex) : 0;
        var nextReq = DoctorLevelState ? DoctorLevelState.getClinicalHoursRequired(G.levelIndex + 1) : 0;
        if (nextReq > currentReq) {
          pct = ((G.clinicalHours || 0) - currentReq) / (nextReq - currentReq) * 100;
          if (pct > 100) pct = 100;
          if (pct < 0) pct = 0;
        }
      }
      cbf.style.width = pct + "%";
    }

    // 督导时数
    var sh = qs("psy-supervision-hours");
    if (sh) sh.textContent = (G.supervisionHours || 0) + "h";
    var ph = qs("psy-personal-therapy-hours");
    if (ph) ph.textContent = (G.personalTherapyHours || 0) + "h";

    // 理论取向
    var at = qs("psy-active-theory");
    if (at) at.textContent = G.activeTheoryOrientation || "—";

    // 8+2 属性
    var attrMap = {
      "psy-stat-empathy": "empathy",
      "psy-stat-insight": "insight",
      "psy-stat-knowledge": "knowledge",
      "psy-stat-technique": "technique",
      "psy-stat-judgment": "judgment",
      "psy-stat-awareness": "awareness",
      "psy-stat-communication": "communication",
      "psy-stat-resilience": "resilience",
      "psy-stat-humanity": "humanity",
      "psy-stat-philosophy": "philosophy",
    };
    var base = G.psychologistBase || {};
    var aKeys = Object.keys(attrMap);
    aKeys.forEach(function (elId) {
      var el = qs(elId);
      if (el) {
        var attrKey = attrMap[elId];
        el.textContent = base[attrKey] !== undefined ? String(base[attrKey]) : "—";
      }
    });

    // 哲学深度
    if (G.philosophyDepth) {
      var philMap = {
        "psy-phil-phenomenology": "phenomenology",
        "psy-phil-hermeneutics": "hermeneutics",
        "psy-phil-existential": "existential",
        "psy-phil-eastern": "eastern",
        "psy-phil-postmodern": "postmodern",
      };
      var pKeys = Object.keys(philMap);
      pKeys.forEach(function (elId) {
        var el = qs(elId);
        if (el) {
          var dimKey = philMap[elId];
          el.textContent = G.philosophyDepth[dimKey] !== undefined ? String(G.philosophyDepth[dimKey]) : "0";
        }
      });
    }

    // 反移情指示器
    var ctInd = qs("psy-ct-indicator");
    if (ctInd && G.countertransference) {
      var risk = G.countertransference.overallRiskLevel || "low";
      ctInd.className = "psy-ct-indicator psy-ct-indicator--" + risk;
      var riskLabels = { low: "● 正常", medium: "● 注意", high: "● 警告", critical: "● 危机" };
      ctInd.textContent = riskLabels[risk] || "● 正常";
      ctInd.title = "反移情风险：" + risk;
    }

    // 疲劳度
    var sf = qs("psy-stat-fatigue");
    if (sf) sf.textContent = (G.currentFatigue || 0) + "%";
    var fbf = qs("psy-fatigue-bar-fill");
    if (fbf) fbf.style.width = Math.min((G.currentFatigue || 0), 100) + "%";

    // 藏书网格
    renderBookShelfGrid(G);
    // 工具网格
    renderTherapyToolGrid(G);
  }

  // ===== 渲染藏书网格 =====
  function renderBookShelfGrid(G) {
    var grid = qs("psy-bookshelf-grid");
    if (!grid) return;
    var books = G.bookShelf || [];
    var html = "";
    if (books.length === 0) {
      html += '<div class="psy-bookshelf-slot psy-bookshelf-slot--empty">—</div>';
      html += '<div class="psy-bookshelf-slot psy-bookshelf-slot--empty">—</div>';
      html += '<div class="psy-bookshelf-slot psy-bookshelf-slot--empty">—</div>';
    } else {
      books.forEach(function (book) {
        html += '<div class="psy-bookshelf-slot" title="' + escHtml(book.name || "") + '">'
          + '<span class="psy-bookshelf-icon">📚</span>'
          + '<span class="psy-bookshelf-name">' + escHtml((book.name || "").substring(0, 12)) + '</span>'
          + '</div>';
      });
    }
    grid.innerHTML = html;
  }

  // ===== 渲染工具网格 =====
  function renderTherapyToolGrid(G) {
    var grid = qs("psy-tool-grid");
    if (!grid) return;
    var tools = G.therapyTools || [];
    var html = "";
    if (tools.length === 0) {
      html += '<div class="psy-tool-slot psy-tool-slot--empty">—</div>';
      html += '<div class="psy-tool-slot psy-tool-slot--empty">—</div>';
      html += '<div class="psy-tool-slot psy-tool-slot--empty">—</div>';
    } else {
      tools.forEach(function (tool) {
        html += '<div class="psy-tool-slot" title="' + escHtml(tool.effect || tool.usage || "") + '">'
          + '<span class="psy-tool-icon">🔧</span>'
          + '<span class="psy-tool-name">' + escHtml((tool.name || "").substring(0, 10)) + '</span>'
          + '</div>';
      });
    }
    grid.innerHTML = html;
  }

  // ===== 渲染右栏 =====
  function renderRightPanel(G) {
    if (!G) return;

    // 来访者列表
    var clientList = qs("psy-client-list");
    if (clientList) {
      var clients = G.currentClients || [];
      if (clients.length === 0) {
        clientList.innerHTML = '<p style="font-size:0.78rem;color:#556677;">暂无来访者</p>';
      } else {
        var html = "";
        clients.forEach(function (c) {
          html += renderClientCard(c);
        });
        clientList.innerHTML = html;
      }
    }

    // 同事/督导师
    var colList = qs("psy-colleague-list");
    if (colList) {
      var people = G.nearbyPeople || [];
      var supervisors = people.filter(function (p) { return p.role === "supervisor" || p.role === "colleague" || p.role === "mentor"; });
      if (supervisors.length === 0) {
        colList.innerHTML = '<p style="font-size:0.78rem;color:#556677;">暂无</p>';
      } else {
        var html2 = "";
        supervisors.forEach(function (p) {
          html2 += '<div class="psy-npc-card">'
            + '<div class="psy-npc-name">' + escHtml(p.displayName || "未知") + '</div>'
            + '<div class="psy-npc-role">' + escHtml(p.role || "") + '</div>'
            + (p.theoryOrientation ? '<div class="psy-npc-theory">' + escHtml(p.theoryOrientation) + '</div>' : "")
            + '</div>';
        });
        colList.innerHTML = html2;
      }
    }

    // 职业事件
    var evList = qs("psy-career-events-list");
    if (evList) {
      var events = G.activeCareerEvents || [];
      if (events.length === 0) {
        evList.innerHTML = '<p style="font-size:0.78rem;color:#556677;">暂无活跃事件</p>';
      } else {
        var html3 = "";
        events.forEach(function (e) {
          html3 += '<div class="psy-event-item">'
            + '<div class="psy-event-type">' + escHtml(e.eventType || "") + '</div>'
            + (e.description ? '<div class="psy-event-desc">' + escHtml(e.description.substring(0, 50)) + '</div>' : "")
            + (e.deadline ? '<div class="psy-event-deadline">截止：' + escHtml(e.deadline) + '</div>' : "")
            + '</div>';
        });
        evList.innerHTML = html3;
      }
    }
  }

  // ===== 渲染单个来访者卡片 =====
  function renderClientCard(client) {
    if (!client) return "";
    var phaseLabels = { initial: "初始", middle: "中期", termination: "结案", followup: "追踪" };
    var phase = phaseLabels[client.treatmentPhase] || client.treatmentPhase || "初始";
    var symptom = client.symptomLevel !== undefined ? client.symptomLevel : "?";
    return '<div class="psy-client-card">'
      + '<div class="psy-client-name">' + escHtml(client.displayName || "来访者") + '</div>'
      + '<div class="psy-client-meta">' + escHtml(client.chiefComplaint || "").substring(0, 20) + '</div>'
      + '<div class="psy-client-status">'
      + '<span>症状：' + symptom + '</span>'
      + '<span>阶段：' + phase + '</span>'
      + '</div>'
      + '</div>';
  }

  // ===== 渲染聊天历史 =====
  function renderChatHistory(G) {
    var log = qs("psy-chat-log");
    if (!log) return;
    var history = G.chatHistory || [];
    log.innerHTML = "";
    history.forEach(function (msg) {
      if (msg.role === "system") {
        var div = document.createElement("div");
        div.className = "psy-chat-msg psy-chat-msg--system";
        div.textContent = msg.content || "";
        log.appendChild(div);
      } else if (msg.role === "user") {
        var div2 = document.createElement("div");
        div2.className = "psy-chat-msg psy-chat-msg--user";
        div2.textContent = msg.content || "";
        log.appendChild(div2);
      } else if (msg.role === "assistant") {
        var div3 = document.createElement("div");
        div3.className = "psy-chat-msg psy-chat-msg--assistant";
        // 尝试提取 story body
        var body = "";
        var re = /<psy_story_body>([\s\S]*?)<\/psy_story_body>/i;
        var m = re.exec(msg.content || "");
        body = m ? m[1].trim() : msg.content;
        div3.textContent = body;
        log.appendChild(div3);
      }
    });
    log.scrollTop = log.scrollHeight;
  }

  // ===== 显示等级晋升通知 =====
  function showLevelUpNotification(G) {
    var title = qs("psy-modal-title");
    var body = qs("psy-modal-body");
    var root = qs("psy-modal-root");
    if (!root || !title || !body) return;
    var major = G.doctorLevel ? G.doctorLevel.major : "";
    var minor = G.doctorLevel ? G.doctorLevel.minor : "";
    title.textContent = "🎉 等级晋升！";
    body.innerHTML = '<p style="font-size:1.1rem;">恭喜你晋升为 <strong>' + escHtml(major + "·" + minor) + '</strong>！</p>'
      + '<p>你的努力和积累正在转化为专业的成长。</p>';
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // ===== 弹窗通用关闭 =====
  function closeModal(rootId) {
    var root = qs(rootId || "psy-modal-root");
    if (root) {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  // ===== 绑定弹窗 =====
  function bindTheoryDetailModalUi() {
    var root = qs("psy-modal-root");
    if (!root) return;
    root.querySelectorAll("[data-psy-modal-close]").forEach(function (el) {
      el.addEventListener("click", function () { closeModal("psy-modal-root"); });
    });
    // 关闭按钮
    var closeBtn = root.querySelector(".psy-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { closeModal("psy-modal-root"); });
  }

  function bindClientDetailModalUi() {
    // 复用通用弹窗
    bindTheoryDetailModalUi();
  }

  function bindEthicalDilemmaModalUi() {
    // 伦理困境使用专用 UI（由 chat 触发）
  }

  function bindCaseSessionUi() {
    // 个案会话 UI 由 chat 触发
  }

  function bindCountertransferenceUi() {
    // 反移情详情由 chat 触发
  }

  function bindSupervisionModalUi() {
    // 督导记录由 chat 触发
  }

  function bindMajorLevelUpUi() {
    // 大阶段晋升由 chat 触发
  }

  // ===== 初始化所有弹窗绑定 =====
  function initAllModals() {
    bindTheoryDetailModalUi();
    bindClientDetailModalUi();
  }

  // ===== 暴露 API =====
  global.PsyMainScreenPanelUi = {
    renderLeftPanel: renderLeftPanel,
    renderBookShelfGrid: renderBookShelfGrid,
    renderTherapyToolGrid: renderTherapyToolGrid,
    renderRightPanel: renderRightPanel,
    renderClientCard: renderClientCard,
    renderChatHistory: renderChatHistory,
    showLevelUpNotification: showLevelUpNotification,
    closeModal: closeModal,
    initAllModals: initAllModals,
    updateTheoryDisplay: renderLeftPanel,
  };
})(typeof window !== "undefined" ? window : globalThis);
