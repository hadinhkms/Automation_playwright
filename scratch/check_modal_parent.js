const fs = require('fs');
const files = fs.readdirSync('evidence/mobile_html_dumps').filter(f => f.includes('Ng__i_d_ng_mobile_c_p_nh_t_th_ng_tin_c__nh_n__ti_u_ch__t_m_v_')).sort().reverse();
const html = fs.readFileSync('evidence/mobile_html_dumps/' + files[0], 'utf8');

const pos = 412230;
console.log('Context before 412230:');
console.log(html.substring(pos - 1500, pos));
