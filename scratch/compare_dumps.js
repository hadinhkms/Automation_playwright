const fs = require('fs');

function check(name) {
  const html = fs.readFileSync(name, 'utf8');
  console.log('--- ' + name + ' ---');
  console.log('Includes select__modal-menu__container:', html.includes('select__modal-menu__container'));
  const idx = html.indexOf('data-test-id="select__modal-menu__container"');
  if (idx !== -1) {
    console.log('Class:', html.substring(idx - 150, idx));
  }
}

check('evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-43-03-045Z.html');
check('evidence/mobile_html_dumps/Ki_m_tra_lu_ng_Onboarding_c_a_ng__i_d_ng_mobile______ng_nh_p_attempt0_on_failure_2026-09-05T04-45-51-655Z.html');
