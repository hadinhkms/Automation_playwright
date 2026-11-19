/**
 * dashboard/services/mobileAppProfiles.js
 * Team-shared app profiles (core/native/app-profiles.json, PLAN-25 S-05): one profile names an app
 * and holds its Android package/activity and/or iOS bundle id / app location.
 * Invalid entries are skipped so a hand-edited file never breaks the catalog.
 */
const fs = require('fs');
const path = require('path');

const PROFILE_FILE = 'core/native/app-profiles.json';
const ID_PATTERN = /^[\w.-]{1,50}$/;
const PACKAGE_PATTERN = /^[A-Za-z][\w]*(\.[A-Za-z_][\w-]*)+$/;
const ACTIVITY_PATTERN = /^\.?[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)*$/;
const MAC_PATH_PATTERN = /^\/(?!.*\.\.)[\w ./+-]{1,250}\.(app|ipa|zip)$/i;
const URL_PATTERN = /^https?:\/\/[^\s"'`<>]{3,500}$/i;

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function androidFields(src) {
  if (!src || !PACKAGE_PATTERN.test(String(src.appPackage || ''))) return null;
  const appActivity = String(src.appActivity || '');
  return { appPackage: src.appPackage, appActivity: ACTIVITY_PATTERN.test(appActivity) ? appActivity : '' };
}

function iosFields(src) {
  if (!src) return null;
  const bundleId = PACKAGE_PATTERN.test(String(src.bundleId || '')) ? src.bundleId : '';
  const app = MAC_PATH_PATTERN.test(String(src.app || '')) || URL_PATTERN.test(String(src.app || '')) ? src.app : '';
  return bundleId || app ? { bundleId, app } : null;
}

/** Profiles usable on `platform`, flattened to { id, name, ...platform fields }. */
function listProfiles(root, platform) {
  const file = path.join(root, PROFILE_FILE);
  if (!fs.existsSync(file)) return [];
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return []; }
  const list = Array.isArray(data?.profiles) ? data.profiles : [];
  const pick = platform === 'ios' ? iosFields : androidFields;
  const seen = new Set();
  return list.flatMap((p) => {
    const id = String(p?.id || '');
    const fields = ID_PATTERN.test(id) && !seen.has(id) ? pick(p[platform]) : null;
    if (!fields) return [];
    seen.add(id);
    return [{ id, name: cleanText(p.name, 80) || id, ...fields }];
  }).slice(0, 50);
}

module.exports = { listProfiles, PROFILE_FILE, MAC_PATH_PATTERN, URL_PATTERN, PACKAGE_PATTERN };
