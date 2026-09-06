const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-43-03-045Z.html';
const html = fs.readFileSync(file, 'utf8');

const idx = html.indexOf('data-test-id="select__modal-menu__container"');
const containerHtml = html.substring(idx);

// Print all elements that have text or attributes that are not the 50 industries
const tags = containerHtml.match(/<[^>]+>/g) || [];
for (let i = 0; i < 40; i++) {
  console.log(tags[i]);
}
console.log('--- Last 20 tags ---');
for (let i = tags.length - 20; i < tags.length; i++) {
  console.log(tags[i]);
}
