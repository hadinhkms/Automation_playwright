const fs = require('fs');
const file = 'evidence/mobile_html_dumps/Ng__i_d_ng_mobile_vi_t_l_i_gi_i_thi_u_v__t_o_m__t__kinh_nghi_attempt0_on_failure_2026-09-05T04-54-14-117Z.html';
const html = fs.readFileSync(file, 'utf8');

const introIdx = html.indexOf('data-test-id="user-profile__introduce"');
console.log(html.substring(introIdx + 3000, introIdx + 5500));
