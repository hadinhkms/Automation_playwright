const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-45-51-655Z.html';
const html = fs.readFileSync(file, 'utf8');

const modalIdx = html.indexOf('data-test-id="select__modal-menu__container"');
const sub = html.substring(modalIdx);
// Find all <i or <button or <svg or text inside
const regex = /<(i|button|svg|div)[^>]*class="([^"]*)"[^>]*>/g;
let m;
const icons = [];
while ((m = regex.exec(sub)) !== null) {
  if (m[2].includes('icon') || m[2].includes('close') || m[2].includes('back') || m[2].includes('arrow') || m[2].includes('btn')) {
    icons.push(m[0]);
  }
}
console.log('Icons/buttons found in container:', icons);
