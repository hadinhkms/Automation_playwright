'use strict';

/**
 * Upstream QA Skills Synchronizer (D:\_QA_Test_Automation -> Hub D:\_Automation-Project)
 *
 * Tự động đồng bộ bộ Skills chuyên sâu (.agents/skills/*) từ QA Spec & Skills Hub
 * (D:\_QA_Test_Automation) vào Automation Framework Hub (D:\_Automation-Project),
 * để từ đó sync-satellites.js và update-framework.js phân phối tự động tới toàn bộ
 * các nhánh vệ tinh (_SV_Automation, Automation_Carthings, ...).
 */

const fs = require('fs');
const path = require('path');

/**
 * Tự động phân giải đường dẫn cục bộ của QA Skills Hub (_QA_Test_Automation).
 * @param {string} [hubRoot] Thư mục gốc của Automation Hub
 * @returns {string|null}
 */
function resolveQaSkillsHub(hubRoot) {
  if (process.env.QA_SKILLS_HUB_PATH) {
    const envPath = path.resolve(process.env.QA_SKILLS_HUB_PATH);
    if (fs.existsSync(path.join(envPath, '.agents', 'skills'))) {
      return envPath;
    }
  }

  const candidates = [];
  if (hubRoot) {
    candidates.push(path.join(path.dirname(path.resolve(hubRoot)), '_QA_Test_Automation'));
  }
  candidates.push('D:\\_QA_Test_Automation');

  for (const cand of candidates) {
    if (cand && fs.existsSync(path.join(cand, '.agents', 'skills'))) {
      return path.resolve(cand);
    }
  }
  return null;
}

function copyTreeIfChanged(srcDir, destDir, logs = [], rootForLog = destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let updated = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      updated += copyTreeIfChanged(srcPath, destPath, logs, rootForLog);
    } else if (entry.isFile()) {
      let changed = true;
      if (fs.existsSync(destPath)) {
        changed = !fs.readFileSync(srcPath).equals(fs.readFileSync(destPath));
      }
      if (changed) {
        fs.copyFileSync(srcPath, destPath);
        updated += 1;
        if (logs.length < 50) {
          logs.push(`Upstream QA Skill: ${path.relative(rootForLog, destPath).replace(/\\/g, '/')}`);
        }
      }
    }
  }
  return updated;
}

/**
 * Hút tự động các skill từ _QA_Test_Automation/.agents/skills sang Automation Hub.
 * Không xoá các skill nội bộ của Automation Hub (như playwright_test, dashboard-maintainer).
 *
 * @param {Object} [options]
 * @param {string} [options.hubRoot] Thư mục Automation Hub đích
 * @param {string} [options.qaHubRoot] Ghi đè đường dẫn _QA_Test_Automation (dùng cho test)
 * @returns {{ available: boolean, qaHubPath: string|null, updatedCount: number, syncedSkills: string[], logs: string[] }}
 */
function pullUpstreamQaSkills(options = {}) {
  const hubRoot = path.resolve(options.hubRoot || path.join(__dirname, '..', '..'));
  const qaHubPath = options.qaHubRoot !== undefined
    ? (options.qaHubRoot ? path.resolve(options.qaHubRoot) : null)
    : resolveQaSkillsHub(hubRoot);

  const logs = [];
  if (!qaHubPath || !fs.existsSync(path.join(qaHubPath, '.agents', 'skills'))) {
    return {
      available: false,
      qaHubPath: null,
      updatedCount: 0,
      syncedSkills: [],
      logs,
    };
  }

  const srcSkillsRoot = path.join(qaHubPath, '.agents', 'skills');
  const destSkillsRoot = path.join(hubRoot, '.agents', 'skills');
  if (!fs.existsSync(destSkillsRoot)) {
    fs.mkdirSync(destSkillsRoot, { recursive: true });
  }

  let updatedCount = 0;
  const syncedSkills = [];
  const entries = fs.readdirSync(srcSkillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillSrc = path.join(srcSkillsRoot, entry.name);
    if (!fs.existsSync(path.join(skillSrc, 'SKILL.md'))) continue;
    const skillDest = path.join(destSkillsRoot, entry.name);
    syncedSkills.push(entry.name);
    updatedCount += copyTreeIfChanged(skillSrc, skillDest, logs, hubRoot);
  }

  return {
    available: true,
    qaHubPath,
    updatedCount,
    syncedSkills,
    logs,
  };
}

module.exports = {
  resolveQaSkillsHub,
  pullUpstreamQaSkills,
};

