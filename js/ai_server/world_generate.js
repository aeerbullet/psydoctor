/**
 * world_generate.js — 开局人生剧情 AI 生成
 * 对应架构文档 §5.4 Phase 1: openingStory
 *
 * 提供 PsyDoctorWorldGenerate 命名空间。
 */
(function (global) {
  "use strict";

  // ===== 构建开局用户提示 =====
  function buildOpeningUserPrompt(fc, G, postInit) {
    if (!fc) return "";

    var lines = [];
    lines.push("请根据以下命运抉择，生成一段心理医生成长人生的开局叙事。");
    lines.push("");

    // 命运抉择信息
    lines.push("【命运抉择】");
    lines.push("教育背景：" + (fc.education || "未知"));
    lines.push("入行契机：" + (fc.motivation || "未知"));
    lines.push("初始理论取向：" + (fc.initialTheory || "未知"));
    if (fc.traits && fc.traits.length > 0) {
      var traitLabels = fc.traits.map(function (t) { return t.label || t.key || ""; }).join("、");
      lines.push("个人特质：" + traitLabels);
    }
    lines.push("角色名：" + (fc.playerName || "未知"));
    lines.push("年龄：" + (fc.age || "未知"));
    lines.push("");

    // 叙事约束
    lines.push("【叙事约束】");
    lines.push("1. 禁止在开局叙事中引入来访者（主角尚未完成培训）");
    lines.push("2. 禁止在开局叙事中让主角做出重大职业决策");
    lines.push("3. 叙事应聚焦于「起点感」和「未来可能性」");
    lines.push("4. 允许引入同学、老师、家人作为背景人物");
    lines.push("5. 叙事人称：第一人称");
    lines.push("6. 请从主角人生中最具「起点感」的时刻开始——入学第一天/实习第一天/初次接触心理学场景");
    lines.push("");

    if (postInit) {
      lines.push("【注意】这是读档后重新生成开局叙事，请确保叙事内容与已有面板数据一致。");
    }

    lines.push("请输出包含 <psy_story_body> 标签的叙事正文，以及 <psy_action_suggestions> 四级行动建议。");

    return lines.join("\n");
  }

  // ===== 执行开局剧情生成 =====
  function runOpeningStoryStrictPromise(fc, G, options) {
    options = options || {};

    var userPrompt = buildOpeningUserPrompt(fc, G, options.postInit || false);

    // 构建 system prompt
    var PsyDoctorAiPreset = global.PsyDoctorAiPreset;
    var systemPrompt = "";
    if (PsyDoctorAiPreset) {
      systemPrompt = PsyDoctorAiPreset.assembleSystemPrompt(G, fc, {});
    }
    if (!systemPrompt) {
      systemPrompt = "你是一个心理医生成长叙事的AI。请根据命运抉择生成开局叙事。";
    }

    var messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

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
      (log.log || console.log)("[psy:ai] 开局剧情生成完成 (" + elapsed + "s)");

      var text = result.text || "";

      // 提取叙事正文
      var storyBody = "";
      var PsyDoctorStoryGenerate = global.PsyDoctorStoryGenerate;
      if (PsyDoctorStoryGenerate && PsyDoctorStoryGenerate.extractTag) {
        storyBody = PsyDoctorStoryGenerate.extractTag(text, "psy_story_body");
      } else {
        var re = /<psy_story_body>([\s\S]*?)<\/psy_story_body>/i;
        var m = re.exec(text);
        storyBody = m ? m[1].trim() : text;
      }

      // 写入 chatHistory
      if (G && G.chatHistory) {
        G.chatHistory.push({ role: "user", content: "「新的人生开始了…」" });
        G.chatHistory.push({ role: "assistant", content: text });
      }

      return { text: text, storyBody: storyBody };
    });
  }

  // ===== 暴露 API =====
  global.PsyDoctorWorldGenerate = {
    buildOpeningUserPrompt: buildOpeningUserPrompt,
    runOpeningStoryStrictPromise: runOpeningStoryStrictPromise,
  };
})(typeof window !== "undefined" ? window : globalThis);
