const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-45-51-655Z.html';
const html = fs.readFileSync(file, 'utf8');

const modalIdx = html.indexOf('data-test-id="select__modal-menu__container"');
if (modalIdx !== -1) {
  console.log('Modal menu container:');
  console.log(html.substring(modalIdx - 100, modalIdx + 1500));
}
