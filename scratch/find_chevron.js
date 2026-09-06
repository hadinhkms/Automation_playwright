const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-45-51-655Z.html';
const html = fs.readFileSync(file, 'utf8');

const modalIdx = html.indexOf('data-test-id="select__modal-menu__container"');
const chevronIdx = html.indexOf('svicon-chevron-down', modalIdx);
console.log(html.substring(chevronIdx - 300, chevronIdx + 300));
