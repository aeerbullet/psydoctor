/**
 * client_character_sheet.js — 来访者档案规范化（来访者/NPC/督导师共用）
 * 对应架构文档 §9.2
 *
 * 提供 ClientCharacterSheet 命名空间，从 ClientTemplates 读取模板后构建完整 characterSheet。
 */
(function (global) {
  "use strict";

  // ===== 从模板构建完整来访者档案 =====
  function buildFromTemplate(caseType, overrides) {
    var ClientTemplates = global.ClientTemplates;
    var template = ClientTemplates ? ClientTemplates.getCaseType(caseType) : null;
    if (!template) {
      // 兜底
      template = {
        caseType: caseType || "existential_crisis",
        initialSymptomLevel: 70,
        defenseProfile: { primaryDefense: "理智化", defenseStrength: 50, flexibility: 35 },
        therapeuticResistance: 40,
        insightCapacity: 50,
        attachmentStyle: "secure",
      };
    }

    var sheet = {
      caseType: template.caseType,
      symptomLevel: overrides && overrides.symptomLevel !== undefined ? overrides.symptomLevel : template.initialSymptomLevel,
      therapeuticAlliance: 50, // 初始联盟 50
      treatmentPhase: "initial",
      defenseProfile: {
        primaryDefense: template.defenseProfile.primaryDefense,
        defenseStrength: template.defenseProfile.defenseStrength,
        flexibility: template.defenseProfile.flexibility,
      },
      therapeuticResistance: template.therapeuticResistance,
      insightCapacity: template.insightCapacity,
      attachmentStyle: template.attachmentStyle,
    };

    // 应用 overrides
    if (overrides) {
      var overrideKeys = Object.keys(overrides);
      overrideKeys.forEach(function (k) {
        if (k === "defenseProfile" && overrides[k]) {
          var dpKeys = Object.keys(overrides[k]);
          dpKeys.forEach(function (dpk) {
            sheet.defenseProfile[dpk] = overrides[k][dpk];
          });
        } else {
          sheet[k] = overrides[k];
        }
      });
    }

    return sheet;
  }

  // ===== 规范化人物数据 =====
  function normalizeCharacter(personData) {
    if (!personData) return null;

    var RoleSpeechProfile = global.RoleSpeechProfile;

    var person = {
      id: personData.id || ("person_" + Date.now().toString(36)),
      displayName: personData.displayName || "未知人物",
      role: personData.role || "colleague", // supervisor / colleague / client / mentor
      theoryOrientation: personData.theoryOrientation || "",
      characterSheet: null,
      // v2.0: 角色发言人格档案
      speechProfile: personData.speechProfile || null,
    };

    // 构建 characterSheet
    if (personData.role === "client" || personData.caseType) {
      // 来访者
      person.characterSheet = buildFromTemplate(
        personData.caseType || "personal_growth",
        personData
      );
      person.characterSheet.id = person.id;
      person.characterSheet.displayName = person.displayName;
    } else {
      // 督导师/同行
      person.characterSheet = {
        id: person.id,
        displayName: person.displayName,
        role: person.role,
        theoryOrientation: person.theoryOrientation,
        expertise: personData.expertity || "",
        relationship: personData.relationship || "professional",
      };
    }

    // 自动生成 speechProfile（如果外部未提供）
    if (!person.speechProfile && RoleSpeechProfile) {
      person.speechProfile = RoleSpeechProfile.createInitialSpeechProfile(person);
    }

    // 复制额外字段
    if (personData.age !== undefined) person.characterSheet.age = personData.age;
    if (personData.gender !== undefined) person.characterSheet.gender = personData.gender;
    if (personData.chiefComplaint) person.characterSheet.chiefComplaint = personData.chiefComplaint;

    return person;
  }

  // ===== 创建新来访者档案 =====
  function createNewClient(clientData) {
    if (!clientData) return null;

    var RoleSpeechProfile = global.RoleSpeechProfile;

    var now = Date.now().toString(36);
    var client = {
      id: clientData.id || ("client_" + now),
      displayName: clientData.displayName || "未知来访者",
      age: clientData.age || 30,
      gender: clientData.gender || "其他",
      chiefComplaint: clientData.chiefComplaint || "",
      caseType: clientData.caseType || "personal_growth",
      sessionCount: 0,
      symptomLevel: 70,
      therapeuticAlliance: 50,
      treatmentPhase: "initial",
      defenseStatus: "理智化",
      clientSheet: null,
      // v2.0: 角色发言人格档案
      speechProfile: clientData.speechProfile || null,
    };

    // 构建 clientSheet
    var sheet = buildFromTemplate(client.caseType, clientData);
    client.clientSheet = sheet;

    // 初始化 symptomLevel
    if (clientData.symptomLevel !== undefined) client.symptomLevel = clientData.symptomLevel;
    if (clientData.defenseStatus) client.defenseStatus = clientData.defenseStatus;

    // 自动生成 speechProfile（如果外部未提供）
    if (!client.speechProfile && RoleSpeechProfile) {
      client.speechProfile = RoleSpeechProfile.createInitialSpeechProfile(client);
    }

    return client;
  }

  // ===== 合并人物数据（更新已有，或创建新） =====
  function mergeCharacter(existing, updates) {
    if (!existing) return normalizeCharacter(updates);
    if (!updates) return existing;

    var result = JSON.parse(JSON.stringify(existing));

    if (updates.displayName) result.displayName = updates.displayName;
    if (updates.theoryOrientation) result.theoryOrientation = updates.theoryOrientation;
    if (updates.role) result.role = updates.role;

    // 更新 characterSheet 中的浮动字段
    if (result.characterSheet && updates.characterSheet) {
      var floatFields = ["symptomLevel", "therapeuticAlliance", "treatmentPhase", "defenseStatus"];
      floatFields.forEach(function (f) {
        if (updates.characterSheet[f] !== undefined) {
          result.characterSheet[f] = updates.characterSheet[f];
        }
      });
    }

    return result;
  }

  // ===== 暴露 API =====
  global.ClientCharacterSheet = {
    buildFromTemplate: buildFromTemplate,
    normalizeCharacter: normalizeCharacter,
    createNewClient: createNewClient,
    mergeCharacter: mergeCharacter,
  };
})(typeof window !== "undefined" ? window : globalThis);
