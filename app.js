/* =========================================================
   Lúmina Privé · app.js v2 — edición real y limpia
   Cuentas reales (registro/login, SHA-256), multiusuario local,
   flujos completos de creadora y administración.
   Listo para migrar a backend: la capa de datos está aislada.
   ========================================================= */
'use strict';

/* ================= utilidades ================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
const r2  = n => Math.round(n * 100) / 100;
const uid = p => p + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
const todayStr = () => new Date().toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' });
const plusDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' }); };
const ini = name => String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

async function sha256(txt){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._h); toast._h = setTimeout(()=>t.classList.remove('show'), 2800); }
let MODCTX = {};
function openModal(html){ $('#modalRoot').innerHTML = '<div class="ovl"><div class="mbox"><button class="mclose" data-action="modal-close">✕</button>' + html + '</div></div>'; }
function closeModal(){ $('#modalRoot').innerHTML = ''; MODCTX = {}; }

const IC = {
  ver: '<svg class="vbadge" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#d9b45c"/><path d="M8 12.5l2.6 2.6L16.5 9" stroke="#241a05" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
  send:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l19-8L3 4v5l13 3-13 3z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8.5v7L16 12z"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4m0 1h13l-2.5 4L18 13H5"/></svg>'
};

/* ================= capa de datos (aislada p/ migrar a backend) ================= */
const DB_KEY  = 'lumina_db_v2';
const SES_KEY = 'lumina_session_v2';
let S = null;

function saveDB(){ localStorage.setItem(DB_KEY, JSON.stringify(S)); }
function loadDB(){
  try { S = JSON.parse(localStorage.getItem(DB_KEY)); } catch(e){ S = null; }
  if (!S || !Array.isArray(S.users)) S = { users:[], reports:[], modQueue:[], audit:[], notifications:[] };
  if (!Array.isArray(S.notifications)) S.notifications = [];
  saveDB();
}
function audit(who, act){
  S.audit.unshift({ who:who, act:act, t: todayStr() + ' · ' + new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) });
}
function notify(toUserId, text){
  S.notifications.unshift({ id:uid('NT'), to:toUserId, text:text,
    t:'Hoy · ' + new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}), read:false });
}

async function ensureSeed(){
  if (!S.users.some(u => u.role === 'admin')) {
    S.users.push({
      id:'u-admin', role:'admin', name:'Administración', email:'admin@lumina.pe',
      passHash: await sha256('admin123'), dob:'1990-01-01', status:'activo', createdAt:todayStr(),
      bag: newBag()
    });
    audit('SISTEMA', 'Base inicializada · cuenta de administración creada');
    saveDB();
  }
}
function newBag(){
  return { wallet:0, ledger:[], receipts:[], subs:[], unlockedPosts:[], unlockedMsgs:[], convs:[], vcalls:[], blocked:[] };
}

/* ---- sesión ---- */
function cur(){ const sid = JSON.parse(localStorage.getItem(SES_KEY) || 'null'); return sid ? (S.users.find(u => u.id === sid) || null) : null; }
function loginAs(id){ localStorage.setItem(SES_KEY, JSON.stringify(id)); paintChrome(); route(); }
function logout(){ localStorage.removeItem(SES_KEY); paintChrome(); route(); toast('Sesión cerrada.'); }
function P(){ const u = cur(); if (!u) return null; if (!u.bag) u.bag = newBag(); return u.bag; }

/* ---- creadoras: catálogo de plataforma + cuentas verificadas ---- */
function normSeed(c){ return { ref:'seed:'+c.id, name:c.name, handle:c.handle, initials:c.initials, a:c.a, b:c.b, bio:c.bio, langs:c.langs, cat:c.cat, resp:c.resp, online:c.online, rating:c.rating, fans:c.fans, media:c.media, monthly:c.monthly, yearly:c.yearly }; }
function normUserCr(u){ const c = u.creator;
  return { ref:'user:'+u.id, name:c.stageName, handle:'@'+c.slug, initials:ini(c.stageName), a:c.a, b:c.b, bio:c.bio, langs:c.langs, cat:c.cat, resp:'~1 h', online:false, rating:c.rating, fans:c.fans,
           media:(c.uploads||[]).filter(x=>x.status==='aprobado').length, monthly:c.monthly, yearly:c.yearly, ownerId:u.id }; }
function CR(ref){
  if (!ref) return null;
  if (ref.startsWith('seed:')) { const c = LP.CREATORS.find(x => x.id === ref.slice(5)); return (c && !c.pending) ? normSeed(c) : null; }
  if (ref.startsWith('user:')) { const u = S.users.find(x => x.id === ref.slice(5)); return (u && u.creator && u.creator.status === 'verificada') ? normUserCr(u) : null; }
  return null;
}
function allCreators(){
  return LP.CREATORS.filter(c => !c.pending).map(normSeed)
    .concat(S.users.filter(u => u.creator && u.creator.status === 'verificada').map(normUserCr));
}
function postsOfCr(cr){
  if (cr.ref.startsWith('seed:')) return LP.POSTS.filter(p => p.cr === cr.ref.slice(5));
  const u = S.users.find(x => x.id === cr.ownerId);
  return (u.creator.uploads || []).filter(p => p.status === 'aprobado').map(p => ({ id:p.id, title:p.title, type:p.type, price:p.price, date:p.date }));
}
function earnCredit(cref, gross){
  if (!cref || !cref.startsWith('user:')) return;
  const u = S.users.find(x => x.id === cref.slice(5));
  if (u && u.creator) { u.creator.earnings.available = r2((u.creator.earnings.available||0) + gross*0.8); u.creator.earnings.total = r2((u.creator.earnings.total||0) + gross*0.8); }
}

/* ================= pagos de la sesión actual ================= */
function credit(amount, desc){
  const b = P();
  b.wallet = r2(b.wallet + amount);
  b.ledger.unshift({ d:desc, amt:+amount, bal:b.wallet, t: todayStr() });
  b.receipts.unshift({ id:uid('RC'), date:'Hoy', desc:desc, amount:amount });
}
function debit(amount, desc){
  const b = P();
  if (b.wallet < amount) {
    openModal('<h3>Saldo insuficiente</h3><p class="mdesc">Necesitas <b>' + fmt(amount - b.wallet) + '</b> más. Tu saldo actual es ' + fmt(b.wallet) + '.</p>' +
      '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-gold" data-action="topup-open">Recargar saldo</button></div>');
    return false;
  }
  b.wallet = r2(b.wallet - amount);
  b.ledger.unshift({ d:desc, amt:-amount, bal:b.wallet, t: todayStr() });
  b.receipts.unshift({ id:uid('RC'), date:'Hoy', desc:desc, amount:-amount });
  return true;
}

/* ================= media simulado ================= */
function mediaHTML(cr, tall){
  return '<div class="' + (tall ? 'pthumb' : 'mini-media') + '" style="--a:' + cr.a + ';--b:' + cr.b + '">' +
    '<span class="ini">' + cr.initials + '</span><span class="demo-tag">CONTENIDO SIMULADO</span></div>';
}

/* ================= router ================= */
window.addEventListener('hashchange', route);
function route(){
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const root = parts[0] || '';
  $$('#mainNav a[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === root));
  let html = '';
  switch (root) {
    case '':              html = renderLanding(); break;
    case 'explorar':      html = renderExplorar(); break;
    case 'perfil':        html = renderPerfil(parts[1]); break;
    case 'mensajes':      html = renderMensajes(parts[1], parts[2]); break;
    case 'suscripciones': html = renderSuscripciones(); break;
    case 'creadora':      html = renderPanel(parts[1] || 'resumen'); break;
    case 'seguridad':     html = renderSeguridad(); break;
    case 'admin':         html = renderAdmin(parts[1] || 'kyc'); break;
    case 'legal':         html = renderLegal(parts[1] || 'terminos'); break;
    default:              html = renderLanding();
  }
  $('#app').innerHTML = html;
  window.scrollTo(0, 0);
}
function gateHTML(msg){
  return '<div class="container empty"><h3 style="margin-bottom:8px">Zona privada</h3><p>' + msg + '</p>' +
    '<div style="display:flex;gap:10px;justify-content:center;margin-top:10px">' +
    '<button class="btn btn-gold" data-action="auth-open">Iniciar sesión o crear cuenta</button>' +
    '<a class="btn btn-ghost" href="#/">Volver al inicio</a></div></div>';
}

/* ================= chrome ================= */
function paintChrome(){
  const u = cur();
  const chip = $('#roleChip'), wallet = $('#walletChip'), auth = $('#btnAuth');
  if (u) {
    chip.textContent = u.creator ? 'Creadora · ' + u.name : u.role.charAt(0).toUpperCase() + u.role.slice(1) + ' · ' + u.name.split(' ')[0];
    chip.classList.remove('hidden');
    wallet.classList.toggle('hidden', !!u.creator || u.role === 'admin');
    wallet.textContent = fmt(P() ? P().wallet : 0);
    wallet.title = 'Saldo · clic para recargar o ver historial';
    auth.textContent = 'Cerrar sesión (' + u.name.split(' ')[0] + ')';
    auth.classList.remove('btn-gold'); auth.classList.add('btn-ghost');
  } else {
    chip.classList.add('hidden'); wallet.classList.add('hidden');
    auth.textContent = 'Iniciar sesión';
    auth.classList.add('btn-gold'); auth.classList.remove('btn-ghost');
  }
  $('#bellBtn').classList.toggle('hidden', !u);
  paintBell();
}

/* ---- notificaciones ---- */
function myNotifs(){ const u = cur(); return u ? S.notifications.filter(n => n.to === u.id) : []; }
function paintBell(){
  const c = $('#bellCount');
  const un = myNotifs().filter(n => !n.read).length;
  c.textContent = un > 9 ? '9+' : un;
  c.classList.toggle('hidden', un === 0);
}
function openNotifs(){
  const list = myNotifs();
  const rows = list.map(n => '<div class="notif-row' + (n.read ? '' : ' unread') + '"><p>' + esc(n.text) + '</p><span>' + n.t + '</span></div>').join('');
  $('#modalRoot').innerHTML = '<div class="ovl"><div class="mbox"><button class="mclose" data-action="modal-close">✕</button>' +
    '<h3>Notificaciones</h3><p class="mdesc">Actividad de tu cuenta</p>' +
    (rows || '<p class="mdesc" style="text-align:center;padding:14px 0">Sin notificaciones todavía.</p>') +
    (list.length ? '<button class="btn btn-ghost btn-block btn-sm" data-action="notifs-read" style="margin-top:12px">Marcar todas como leídas</button>' : '') +
    '</div></div>';
  list.forEach(n => n.read = true); saveDB(); setTimeout(paintBell, 500);
}

/* ================= landing ================= */
function ccardHTML(c){
  const subbed = P() && P().subs.some(s => s.cref === c.ref);
  return '<a class="ccard" href="' + perfilHref(c) + '">' +
    '<div class="cc-cover" style="--a:' + c.a + ';--b:' + c.b + '">' +
      '<span class="online-pill ' + (c.online ? 'on' : '') + '">' + (c.online ? 'En línea' : 'Ausente') + '</span></div>' +
    '<div class="cc-body"><div class="avatar xl" style="--a:' + c.a + ';--b:' + c.b + '">' + esc(c.initials) + '</div>' +
      '<div class="cc-name">' + esc(c.name) + IC.ver + '</div><div class="cc-handle">' + esc(c.handle) + '</div>' +
      '<div class="meta-chips"><span class="mchip">' + esc(c.cat) + '</span>' + c.langs.map(l => '<span class="mchip">' + esc(l) + '</span>').join('') + '</div>' +
      '<div class="cc-stats"><span><b>' + Number(c.fans).toLocaleString('es-PE') + '</b> fans</span><span><b>' + c.media + '</b> fotos/videos</span>' + (c.rating ? '<span>★ <b>' + c.rating.toFixed(1) + '</b></span>' : '') + '</div>' +
      '<div class="cc-foot"><span class="cc-price">' + fmt(c.monthly) + '<small>/mes' + (subbed ? ' · eres miembro' : '') + '</small></span><span class="btn btn-gold btn-sm">Ver perfil</span></div>' +
    '</div></a>';
}
/* slug URL estable: usamos índice en allCreators vía ref en query */
function perfilHref(c){ return '#/perfil/' + encodeURIComponent(c.ref); }

function renderLanding(){
  const list = allCreators();
  const featured = list.slice().sort((x,y)=>(y.online-x.online)||(y.fans-x.fans)).slice(0,4);
  const totalFans = list.reduce((a,c)=>a+c.fans,0);
  return '' +
  '<section class="hero container"><div class="hero-glow"></div><div class="hero-content">' +
    '<span class="kicker">Exclusivo · Verificado · Privado</span>' +
    '<h1>Descubre creadoras verificadas y conecta de forma <em>privada, segura y transparente</em>.</h1>' +
    '<p class="hero-sub">Membresías claras, pagos visibles antes de confirmar, identidad verificada y moderación activa. Solo para adultos (+18).</p>' +
    '<div class="hero-ctas"><a class="btn btn-gold btn-lg" href="#/explorar">Explorar creadoras</a>' +
    '<button class="btn btn-ghost btn-lg" data-action="apply-open">Crear perfil de creadora</button></div>' +
    '<div class="stats-strip">' +
      '<div class="stat"><b>' + list.length + '</b><span>Creadoras verificadas</span></div>' +
      '<div class="stat"><b>' + (totalFans/1000).toFixed(1) + 'k</b><span>Fans activos</span></div>' +
      '<div class="stat"><b>80%</b><span>Ingreso directo a la creadora</span></div>' +
      '<div class="stat"><b>24h</b><span>Moderación y soporte</span></div></div></div></section>' +

  '<section class="sec alt" id="como-funciona"><div class="container">' +
    '<div class="sec-title"><span class="kicker">Cómo funciona</span><h2>Dos caminos, un mismo estándar de confianza.</h2></div>' +
    '<div class="steps-grid"><div class="step-col"><h3><span class="dot"></span>Si eres clienta o cliente</h3>' +
      '<div class="step-card"><span class="step-num">1</span><div><b>Crea tu cuenta</b><p>Correo verificado, contraseña cifrada y validación de mayoría de edad.</p></div></div>' +
      '<div class="step-card"><span class="step-num">2</span><div><b>Confirma tu edad (+18)</b><p>Registro con fecha de nacimiento; KYC documental al pagar.</p></div></div>' +
      '<div class="step-card"><span class="step-num">3</span><div><b>Explora y suscríbete</b><p>Precios visibles, cupones y renovación siempre clara.</p></div></div>' +
      '<div class="step-card"><span class="step-num">4</span><div><b>Conecta en privado</b><p>Mensajes, contenido premium y videollamadas con pago anticipado.</p></div></div></div>' +
    '<div class="step-col"><h3><span class="dot"></span>Si eres creadora</h3>' +
      '<div class="step-card"><span class="step-num">1</span><div><b>Crea tu cuenta</b><p>Una sola cuenta para todo: luego activas modo creadora.</p></div></div>' +
      '<div class="step-card"><span class="step-num">2</span><div><b>Solicita verificación</b><p>Nombre artístico, categoría y precios; KYC documental.</p></div></div>' +
      '<div class="step-card"><span class="step-num">3</span><div><b>Pública con revisión</b><p>Cada envío pasa por moderación antes de verse.</p></div></div>' +
      '<div class="step-card"><span class="step-num">4</span><div><b>Gana el 80%</b><p>Retiros desde $20 con historial completo.</p></div></div></div></div></div></section>' +

  '<section class="sec"><div class="container">' +
    '<div class="sec-title"><span class="kicker">Destacadas ahora</span><h2>Creadoras con identidad verificada</h2><p>Todas superaron la verificación de edad e identidad antes de monetizar.</p></div>' +
    '<div class="creator-grid">' + featured.map(ccardHTML).join('') + '</div>' +
    '<div style="text-align:center;margin-top:26px"><a class="btn btn-ghost" href="#/explorar">Ver todas las creadoras →</a></div></div></section>' +

  '<section class="sec alt"><div class="container">' +
    '<div class="sec-title"><span class="kicker">Transparencia de pagos</span><h2>Sabes exactamente qué pagas. Siempre.</h2></div>' +
    '<div class="guarantees">' +
      '<div class="guarantee"><span class="chk">✓</span>Sin cargos ocultos: cada cobro muestra su detalle antes de confirmar.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Renovación visible: fecha y monto del siguiente cargo en tus suscripciones.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Cancelación en un clic, sin letra pequeña.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Historial y recibos de cada transacción.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Cupones aplicados antes del pago, nunca después.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Videollamadas solo con pago anticipado y duración pactada.</div></div></div></section>' +

  '<section class="sec container"><div class="cta-banner">' +
    '<span class="kicker">Únete hoy</span><h2>Tu espacio privado te espera.</h2>' +
    '<p>Crea tu cuenta gratis como cliente o aplica como creadora verificada.</p>' +
    '<div class="hero-ctas"><button class="btn btn-gold btn-lg" data-action="auth-open">Crear cuenta</button>' +
    '<button class="btn btn-violet btn-lg" data-action="apply-open">Quiero ser creadora</button></div></div></section>';
}

/* ================= explorar ================= */
const F = { q:'', lang:'all', cat:'all', sort:'pop', online:false };
function filteredCreators(){
  let list = allCreators();
  if (F.q) { const q = F.q.toLowerCase(); list = list.filter(c => (c.name+' '+c.handle+' '+c.cat).toLowerCase().includes(q)); }
  if (F.lang !== 'all') list = list.filter(c => c.langs.includes(F.lang));
  if (F.cat !== 'all') list = list.filter(c => c.cat === F.cat);
  if (F.online) list = list.filter(c => c.online);
  if (F.sort==='precio-a') list.sort((a,b)=>a.monthly-b.monthly);
  else if (F.sort==='precio-d') list.sort((a,b)=>b.monthly-a.monthly);
  else if (F.sort==='rating') list.sort((a,b)=>b.rating-a.rating);
  else list.sort((a,b)=>b.fans-a.fans);
  return list;
}
function renderExplorar(){
  const cats = Array.from(new Set(allCreators().map(c=>c.cat)));
  return '<div class="container">' +
    '<div class="view-head"><span class="kicker">Explorar</span><h1>Creadoras verificadas</h1><p>Identidad comprobada · Precios transparentes</p></div>' +
    '<div class="filter-bar">' +
      '<div class="fld"><label>Buscar</label><input id="f-q" value="' + esc(F.q) + '" placeholder="Nombre, @usuario o categoría…"></div>' +
      '<div class="fld"><label>Idioma</label><select id="f-lang"><option value="all">Todos</option><option>ES</option><option>EN</option><option>PT</option></select></div>' +
      '<div class="fld"><label>Categoría</label><select id="f-cat"><option value="all">Todas</option>' + cats.map(c=>'<option'+(F.cat===c?' selected':'')+'>'+esc(c)+'</option>').join('') + '</select></div>' +
      '<div class="fld"><label>Ordenar por</label><select id="f-sort"><option value="pop">Popularidad</option><option value="precio-a">Precio ↑</option><option value="precio-d">Precio ↓</option><option value="rating">Calificación</option></select></div>' +
      '<div class="fld switch-wrap"><label class="switch"><input type="checkbox" id="f-online"'+(F.online?' checked':'')+'><span class="slider-t"></span></label><span style="font-size:12px;color:var(--muted)">Solo en línea</span></div></div>' +
    '<p class="results-line" id="results-line"></p><div class="creator-grid" id="creator-results"></div></div>';
}
function resetFilters(){ F.q=''; F.lang='all'; F.cat='all'; F.sort='pop'; F.online=false; route(); }
function applyFilters(){
  F.q = ($('#f-q')||{}).value ?? F.q; F.lang = ($('#f-lang')||{}).value ?? F.lang;
  F.cat = ($('#f-cat')||{}).value ?? F.cat; F.sort = ($('#f-sort')||{}).value ?? F.sort;
  F.online = !!($('#f-online')||{}).checked;
  const list = filteredCreators();
  $('#creator-results').innerHTML = list.length ? list.map(ccardHTML).join('') : '<div class="empty">Sin resultados.<br><a class="btn btn-ghost btn-sm" href="#/explorar" onclick="setTimeout(resetFilters,50)">Limpiar filtros</a></div>';
  $('#results-line').textContent = list.length + ' creadora' + (list.length===1?'':'s') + ' encontrada' + (list.length===1?'':'s');
}

/* ================= perfil ================= */
function postTileHTML(p, cr){
  const lockedPPV = p.type==='ppv' && !(P()&&P().unlockedPosts.includes(p.id));
  const lockedSub = p.type==='sub' && !(P()&&P().subs.some(s=>s.cref===cr.ref));
  const locked = lockedPPV || lockedSub;
  const tagCls = p.type==='free'?'free':(p.type==='sub'?'sub':'ppv');
  const tagName = p.type==='free'?'GRATIS':(p.type==='sub'?'MIEMBROS':'PREMIUM · '+fmt(p.price));
  return '<article class="ptile"><div class="pthumb" style="--a:'+cr.a+';--b:'+cr.b+'">' +
    '<span class="ptype '+tagCls+'">'+tagName+'</span>' +
    (locked
      ? '<div class="lock-overlay"><div class="lock-box">'+IC.lock+
        (lockedPPV ? '<br><button class="btn btn-gold btn-sm" data-action="unlock-post" data-id="'+p.id+'" data-price="'+p.price+'" data-cref="'+cr.ref+'">Desbloquear '+fmt(p.price)+'</button>'
                   : '<br><a class="btn btn-violet btn-sm" href="'+perfilHref(cr)+'">Hazte miembro</a>')+'</div></div>'
      : '<span class="ini">'+cr.initials+'</span><span class="demo-tag">CONTENIDO SIMULADO</span>') +
    '</div><div class="pbody"><b>'+esc(p.title)+'</b>' +
    (locked ? '' : '<span style="font-size:11.5px;color:var(--gold2);cursor:pointer" data-action="view-post" data-id="'+p.id+'" data-title="'+esc(p.title)+'" data-a="'+cr.a+'" data-b="'+cr.b+'" data-init="'+cr.initials+'">Ver publicación →</span>') +
    '</div></article>';
}

function resolveCreatorByParam(param){
  /* param puede ser ref codificado o slug de semilla */
  if (param.includes(':')) return CR(decodeURIComponent(param));
  const c = LP.CREATORS.find(x => x.slug === param && !x.pending);
  return c ? normSeed(c) : null;
}

function renderPerfil(param){
  const cr = resolveCreatorByParam(param);
  if (!cr) return '<div class="container empty">Perfil no encontrado.<br><a class="btn btn-gold btn-sm" href="#/explorar">Ir a explorar</a></div>';
  const b = P();
  const subbed = b && b.subs.some(s=>s.cref===cr.ref);
  const sub = b && b.subs.find(s=>s.cref===cr.ref);
  const blocked = b && b.blocked.some(x=>x.ref===cr.ref);
  const posts = postsOfCr(cr);
  const mine = cur() && cur().creator && ('user:'+cur().id === cr.ref);
  return '<div class="container">' +
    '<div class="cover" style="--a:'+cr.a+';--b:'+cr.b+'"><span class="cover-tag">PERFIL VERIFICADO · IDENTIDAD COMPROBADA</span>' +
      '<div class="cover-inner"><div class="avatar hero-av" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</div></div></div>' +
    '<div class="profile-head"><div class="row1"><h1>'+esc(cr.name)+' '+IC.ver+'</h1><span class="st '+(cr.online?'ok':'dim')+'">'+(cr.online?'● En línea':'○ Ausente')+'</span>'+(mine?'<span class="st info">ES TU PERFIL</span>':'')+'</div>' +
      '<div class="handle-line">'+esc(cr.handle)+' '+(cr.rating?'· ★ '+cr.rating.toFixed(1):'')+' · '+Number(cr.fans).toLocaleString('es-PE')+' fans</div>' +
      '<p class="bio-text">'+esc(cr.bio)+'</p>' +
      '<div class="chips-row"><span class="mchip">🗣 '+cr.langs.map(esc).join(' · ')+'</span><span class="mchip">'+esc(cr.cat)+'</span><span class="mchip">⏱ Responde '+esc(cr.resp)+'</span><span class="mchip">📁 '+posts.length+' publicaciones</span></div>' +
      '<div class="action-row">' +
        (mine ? '<button class="btn btn-violet" onclick="location.hash=\'#/creadora/panel\'">Ir a mi panel de creadora</button>'
         : blocked ? '<button class="btn btn-danger" data-action="block-toggle" data-ref="'+cr.ref+'" data-name="'+esc(cr.name)+'">Desbloquear</button>'
         : '<a class="btn btn-gold" href="#/mensajes/conversaciones/'+encodeURIComponent(cr.ref)+'">Escribir mensaje</a>'+
           '<button class="btn btn-violet" data-action="vcall-open" data-ref="'+cr.ref+'">'+IC.cam+' Videollamada</button>'+
           '<button class="btn btn-ghost" data-action="tip-open" data-ref="'+cr.ref+'">Enviar propina</button>'+
           '<button class="btn btn-danger" data-action="report-open" data-target="'+esc(cr.handle)+'">Denunciar</button>'+
           '<button class="btn btn-ghost" data-action="block-toggle" data-ref="'+cr.ref+'" data-name="'+esc(cr.name)+'">Bloquear</button>') +
      '</div>' +
      (subbed ? '<div class="sub-strip">✦ Membresía activa ('+(sub.plan==='yearly'?'anual':'mensual')+') · Renueva el '+sub.renews+' · <a href="#" data-action="cancel-sub" data-ref="'+cr.ref+'" style="color:var(--red)">Cancelar suscripción</a></div>' : '') +
    '</div>' +
    '<h2 class="subhead">Planes de membresía</h2>' +
    '<div class="plans">' +
      '<div class="plan-card"><span class="plan-name">Mensual</span><div class="plan-price">'+fmt(cr.monthly)+'<small>/mes</small></div>' +
        '<ul class="plan-feats"><li>Acceso a todo el contenido para miembros</li><li>Mensajería directa privada</li><li>Renovación visible y cancelación en 1 clic</li></ul>' +
        (subbed ? '<button class="btn btn-ghost btn-block" disabled>Ya eres miembro ✓</button>' : '<button class="btn btn-gold btn-block" data-action="sub-open" data-ref="'+cr.ref+'" data-plan="monthly">Suscribirme</button>')+'</div>' +
      '<div class="plan-card best"><span class="plan-save">AHORRA '+Math.round((1-cr.yearly/(cr.monthly*12))*100)+'%</span><span class="plan-name">Anual</span><div class="plan-price">'+fmt(cr.yearly)+'<small>/año</small></div>' +
        '<ul class="plan-feats"><li>Todo lo del plan mensual</li><li>Badge de miembro anual</li><li>Prioridad en respuestas</li></ul>' +
        (subbed ? '<button class="btn btn-ghost btn-block" disabled>Ya eres miembro ✓</button>' : '<button class="btn btn-violet btn-block" data-action="sub-open" data-ref="'+cr.ref+'" data-plan="yearly">Suscribirme</button>')+'</div></div>' +
    '<h2 class="subhead">Publicaciones</h2>' +
    '<div class="posts-grid">'+(posts.length?posts.map(p=>postTileHTML(p,cr)).join(''):'<div class="empty">Aún no hay publicaciones.</div>')+'</div>' +
    '<p style="font-size:11.5px;color:var(--dim);margin-top:14px">Material simulado para esta versión de prueba. En producción: URLs temporales firmadas y marca de agua dinámica por comprador.</p></div>';
}

/* ================= pagos ================= */
function subOpen(ref, plan){
  const cr = CR(ref); const base = plan==='yearly'?cr.yearly:cr.monthly;
  MODCTX = { type:'sub', ref:ref, plan:plan, base:base, coupon:null, total:null };
  openModal('<h3>Suscribirse a '+esc(cr.name)+'</h3><p class="mdesc">Plan '+(plan==='yearly'?'anual':'mensual')+' · La renovación quedará visible y podrás cancelarla cuando quieras.</p>' +
    '<div class="pay-summary"><span>'+(plan==='yearly'?'Plan anual':'Plan mensual')+'</span><b>'+fmt(base)+'</b></div>' +
    '<div class="coupon-row"><input id="coupon-in" placeholder="Cupón (ej. LUMINA10)"><button class="btn btn-ghost btn-sm" data-action="coupon-check">Aplicar</button></div><div id="coupon-out"></div>' +
    '<div class="pay-summary"><span>Total a pagar hoy</span><b id="pay-total">'+fmt(base)+'</b></div>' +
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-gold" data-action="sub-pay">Pagar con saldo ('+fmt(P().wallet)+')</button></div>');
}
function couponCheck(){
  const code = ($('#coupon-in').value||'').trim().toUpperCase();
  if (LP.COUPONS[code]) {
    MODCTX.coupon = code; MODCTX.total = r2(MODCTX.base*(1-LP.COUPONS[code].pct/100));
    $('#coupon-out').innerHTML = '<div class="coupon-ok">✓ '+esc(LP.COUPONS[code].note)+' · Total: '+fmt(MODCTX.total)+'</div>';
    $('#pay-total').textContent = fmt(MODCTX.total);
  } else { MODCTX.coupon=null; MODCTX.total=null; $('#coupon-out').innerHTML='<div style="color:var(--red);font-size:11.5px;margin-top:6px">✕ Cupón no válido.</div>'; $('#pay-total').textContent=fmt(MODCTX.base); }
}
function subPay(){
  const cr = CR(MODCTX.ref);
  const total = MODCTX.total!=null?MODCTX.total:MODCTX.base;
  if (!debit(total,'Suscripción '+(MODCTX.plan==='yearly'?'anual':'mensual')+' · '+cr.name)) return;
  P().subs.push({ cref:cr.ref, plan:MODCTX.plan, price:total, started:todayStr(), renews:plusDays(MODCTX.plan==='yearly'?365:30) });
  earnCredit(cr.ref, total);
  if (cr.ref.startsWith('user:')) notify(cr.ref.slice(5), '💰 Nueva suscripción ' + (MODCTX.plan==='yearly'?'anual':'mensual') + ' de ' + cur().name + ' · ingreso bruto ' + fmt(total));
  audit(cur().role.toUpperCase(), 'Nueva suscripción a '+cr.handle+' ('+MODCTX.plan+') por '+fmt(total)+(MODCTX.coupon?' · cupón '+MODCTX.coupon:''));
  saveDB(); closeModal(); paintChrome(); route(); toast('¡Bienvenida/o al círculo privado de '+cr.name.split(' ')[0]+'!');
}
function unlockPost(id, price, cref){
  const b = P();
  if (b.unlockedPosts.includes(id)) { toast('Ya tenías este contenido desbloqueado.'); return; }
  if (!debit(price,'Contenido premium · '+CR(cref).name)) return;
  b.unlockedPosts.push(id); earnCredit(cref, price);
  if (cref.startsWith('user:')) notify(cref.slice(5), '📷 Vendiste contenido premium · ingreso bruto ' + fmt(price));
  audit('CLIENTE','Desbloqueó contenido premium ('+id+') por '+fmt(price));
  saveDB(); route(); toast('Contenido desbloqueado.');
}
function viewPost(el){
  openModal('<h3>'+esc(el.dataset.title)+'</h3><p class="mdesc">Publicado en Lúmina Privé</p>' +
    '<div class="mini-media" style="--a:'+el.dataset.a+';--b:'+el.dataset.b+';height:220px"><span class="ini" style="font-size:40px">'+el.dataset.init+'</span><span class="demo-tag">CONTENIDO SIMULADO</span></div>' +
    '<div class="callout" style="margin-top:14px">En producción cada vista lleva marca de agua con tu ID de compra para disuadir fugas.</div>');
}
function tipOpen(ref){
  MODCTX = { type:'tip', ref:ref };
  const cr = CR(ref);
  openModal('<h3>Enviar propina a '+esc(cr.name)+'</h3><p class="mdesc">El 80% se acredita directo a su saldo de creadora.</p>' +
    '<div class="role-pick">'+[5,10,20].map(v=>'<div class="role-opt" data-action="tip-send" data-amt="'+v+'"><span class="ri">💛</span><div><b>'+fmt(v)+'</b></div></div>').join('')+'</div>' +
    '<div class="coupon-row" style="margin-top:14px"><input id="tip-custom" type="number" min="1" step="1" placeholder="Monto personalizado"><button class="btn btn-ghost btn-sm" data-action="tip-send-custom">Enviar</button></div>');
}
function tipSend(amt){
  amt = r2(Number(amt));
  if (!(amt>0)) { toast('Monto inválido.'); return; }
  const cr = CR(MODCTX.ref);
  if (!debit(amt,'Propina · '+cr.name)) return;
  earnCredit(cr.ref, amt);
  if (cr.ref.startsWith('user:')) notify(cr.ref.slice(5), '💛 Recibiste una propina de ' + fmt(amt) + ' (bruto) de ' + cur().name);
  audit('CLIENTE','Propina de '+fmt(amt)+' a '+cr.handle);
  saveDB(); closeModal(); paintChrome(); route(); toast('Propina enviada 💛');
}
function vcallOpen(ref){
  MODCTX = { type:'vcall', ref:ref };
  openModal('<h3>Videollamada privada</h3><p class="mdesc">Pago anticipado por duración pactada. Si la creadora no acepta, reembolso automático del 100%.</p>' +
    '<div class="role-pick">'+LP.VCALL_PLANS.map(pl=>'<div class="role-opt" data-action="vcall-pick" data-plan="'+pl.id+'"><span class="ri">📹</span><div><b>'+pl.mins+' minutos · '+fmt(pl.price)+'</b><small>Pago anticipado · WebRTC cifrado</small></div></div>').join('')+'</div>');
}
function vcallPick(planId){
  const pl = LP.VCALL_PLANS.find(p=>p.id===planId);
  const cr = CR(MODCTX.ref);
  if (!debit(pl.price,'Videollamada '+pl.mins+' min · '+cr.name)) return;
  P().vcalls.unshift({ id:uid('VC'), cref:cr.ref, mins:pl.mins, price:pl.price, status:'pagada', date:'Hoy' });
  if (cr.ref.startsWith('user:')) notify(cr.ref.slice(5), '📹 Videollamada de ' + pl.mins + ' min pagada (' + fmt(pl.price) + ') · pendiente de tu aceptación');
  audit('CLIENTE','Pagó videollamada de '+pl.mins+' min con '+cr.handle);
  saveDB(); closeModal(); paintChrome(); route(); toast('Solicitud enviada. Esperando aceptación.');
}
function topupOpen(){
  openModal('<h3>Recargar saldo</h3><p class="mdesc">Versión de prueba: la recarga es instantánea y sin cobro real. En producción se procesa con proveedor adult-friendly y 3-D Secure.</p>' +
    '<div class="role-pick">'+[10,25,50,100].map(v=>'<div class="role-opt" data-action="topup-amt" data-amt="'+v+'"><span class="ri">💳</span><div><b>'+fmt(v)+'</b></div></div>').join('')+'</div>');
}
function topupAmt(v){ credit(r2(Number(v)),'Recarga de saldo'); saveDB(); closeModal(); paintChrome(); route(); toast('Saldo recargado: +'+fmt(Number(v))); }

/* ================= mensajes ================= */
const REPLIES = ['¡Hola! Gracias por escribir, te respondo en un momentito 💛','Me alegra mucho que te guste lo que comparto ✨','Si quieres ver algo especial, mira el set exclusivo que dejé en mi perfil.','¡Bienvenida/o! Cuéntame qué tipo de contenido te gusta más.'];
function renderMensajes(tab, param1, param2){
  tab = tab || 'conversaciones';
  if (!cur()) return gateHTML('Inicia sesión para ver tus mensajes privados.');
  const u = cur();
  let inner = '';
  if (tab === 'videollamadas') inner = vcallsHTML();
  else if (tab === 'bandeja' && u.creator && u.creator.status === 'verificada') inner = inboxListHTML();
  else if (tab === 'chat' && u.creator && param1) inner = ownerChatHTML(decodeURIComponent(param1));
  else if (tab === 'conversaciones' && param1) inner = chatHTML(decodeURIComponent(param1));
  else inner = convListHTML();
  const isCreator = u.creator && u.creator.status === 'verificada';
  return '<div class="container"><div class="view-head"><span class="kicker">Privado</span><h1>Mensajes</h1><p>Conversaciones privadas entre cuentas</p></div>' +
    '<div class="tabs">' +
    (isCreator ? '<button class="tab'+(tab==='bandeja'?' active':'')+'" onclick="location.hash=\'#/mensajes/bandeja\'">Bandeja (fans)</button>' : '') +
    '<button class="tab'+(tab!=='videollamadas'&&tab!=='bandeja'&&tab!=='chat'?' active':'')+'" onclick="location.hash=\'#/mensajes/conversaciones\'">Conversaciones</button>' +
    '<button class="tab'+(tab==='videollamadas'?' active':'')+'" onclick="location.hash=\'#/mensajes/videollamadas\'">Videollamadas</button></div>' + inner + '</div>';
}
function convListHTML(){
  const items = P().convs.map(cv=>{
    const cr = CR(cv.cref); if (!cr) return '';
    const last = cv.msgs[cv.msgs.length-1];
    const unread = cv.unreadClient || 0;
    return '<button class="conv-item" onclick="location.hash=\'#/mensajes/conversaciones/'+encodeURIComponent(cv.cref)+'\'">' +
      '<span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
      '<span class="conv-preview"><h5>'+esc(cr.name)+
        (unread ? ' <span class="unread-mini">'+unread+'</span>' : '') +
        '</h5><p>'+esc((last.from==='me'?'Tú: ':'')+last.body)+'</p></span>' +
      '<span class="conv-time">'+last.t+'</span></button>';
  }).join('');
  return items || '<div class="empty">Aún no tienes conversaciones.<br><a class="btn btn-gold btn-sm" href="#/explorar">Descubrir creadoras</a></div>';
}
function chatHTML(cref){
  const cr = CR(cref);
  if (!cr) return '<div class="empty">Esta cuenta ya no está disponible.</div>';
  const b = P();
  let cv = b.convs.find(c=>c.cref===cref);
  if (!cv) { cv = { cref:cref, msgs:[{ id:uid('M'), from:'them', body:'¡Hola! Bienvenida/o a mi espacio privado. Escríbeme con confianza.', price:null, paid:false, t:'Hoy' }] }; b.convs.unshift(cv); saveDB(); }
  if (cv.unreadClient) { cv.unreadClient = 0; saveDB(); }
  const blocked = b.blocked.some(x=>x.ref===cref);
  const bubbles = cv.msgs.map(m=>{
    if (m.price && !m.paid && !b.unlockedMsgs.includes(m.id)) {
      return '<div class="bubble ppv-b them"><b style="display:block;margin-bottom:7px">'+esc(m.body)+'</b>' +
        '<div class="mini-media blur" style="--a:'+cr.a+';--b:'+cr.b+'"><span class="ini" style="font-size:22px">'+cr.initials+'</span><span class="demo-tag">CONTENIDO SIMULADO</span></div>' +
        '<div class="unlock-row">'+IC.lock+'<span style="font-size:12px;color:var(--gold2)">Mensaje con foto exclusiva</span>' +
        '<button class="btn btn-gold btn-sm" data-action="unlock-msg" data-mid="'+m.id+'" data-price="'+m.price+'" data-cref="'+cref+'">Desbloquear '+fmt(m.price)+'</button></div><span class="bt">'+m.t+'</span></div>';
    }
    return '<div class="bubble '+(m.from==='me'?'me':'them')+'">'+esc(m.body)+
      (m.price&&m.paid?'<span style="display:block;font-size:10px;opacity:.75;margin-top:5px">📷 Foto adjunta desbloqueada ('+fmt(m.price)+')</span>':'')+
      '<span class="bt">'+m.t+'</span></div>';
  }).join('');
  return '<div class="chat-shell">' +
    '<div class="chat-top"><button class="back-btn" onclick="location.hash=\'#/mensajes/conversaciones\'">←</button>' +
      '<span class="avatar sm" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
      '<div style="flex:1"><b style="font-size:14px">'+esc(cr.name)+'</b><div style="font-size:11px;color:'+(cr.online?'var(--green)':'var(--dim)')+'">'+(cr.online?'En línea':'Responde '+cr.resp)+'</div></div>' +
      '<button class="btn btn-danger btn-sm" data-action="report-open" data-target="'+esc(cr.handle)+'">'+IC.flag+' Denunciar</button></div>' +
    '<div class="chat-area" id="chat-area">'+bubbles+'</div>' +
    (blocked ? '<div class="chat-input" style="justify-content:center;color:var(--red);font-size:12.5px">Has bloqueado a esta cuenta.</div>'
             : '<form class="chat-input" id="msg-form" data-cref="'+cref+'"><input id="msg-input" autocomplete="off" placeholder="Escribe un mensaje…" maxlength="500"><button class="send-btn" type="submit">'+IC.send+'</button></form>') +
    '</div>';
}
function unlockMsg(mid, price, cref){
  if (!debit(price,'Mensaje premium · '+CR(cref).name)) return;
  P().unlockedMsgs.push(mid); earnCredit(cref, price);
  if (cref.startsWith('user:')) notify(cref.slice(5), '📩 Mensaje premium vendido · ingreso bruto ' + fmt(price));
  audit('CLIENTE','Desbloqueó mensaje premium por '+fmt(price));
  saveDB(); route(); toast('Foto desbloqueada.');
}
/* ================= mensajes — bandeja de creadora ================= */
function inboxListHTML(){
  const myRef = 'user:' + cur().id;
  const items = [];
  S.users.forEach(o => {
    if (o.id === cur().id || !o.bag) return;
    const cv = o.bag.convs.find(c => c.cref === myRef);
    if (!cv) return;
    const last = cv.msgs[cv.msgs.length - 1];
    const isClient = last && last.from === 'me';
    const unread = cv.unreadCreator || 0;
    items.push('<button class="conv-item" onclick="location.hash=\'#/mensajes/chat/' + o.id + '\'">' +
      '<span class="avatar md" style="--a:#c084fc;--b:#f9a8d4">' + ini(o.name) + '</span>' +
      '<span class="conv-preview"><h5>' + esc(o.name) +
        (unread ? ' <span class="unread-mini">' + unread + '</span>' : '') +
        '</h5><p>' + esc((isClient ? 'Tú: ' : o.name.split(' ')[0] + ': ') + last.body) + '</p></span>' +
      '<span class="conv-time">' + last.t + '</span></button>');
  });
  items.sort((a, b) => { /* not perfect but good enough for demo */ return 0; });
  return items.join('') || '<div class="empty">Aún ningún fan te ha escrito. Comparte tu perfil para empezar a conectar.</div>';
}

function ownerChatHTML(clientId){
  const client = S.users.find(u => u.id === clientId);
  const myRef = 'user:' + cur().id;
  if (!client || !client.bag) return '<div class="empty">Esta cuenta ya no está disponible.</div>';
  let cv = client.bag.convs.find(c => c.cref === myRef);
  if (!cv) return '<div class="empty">Esta persona aún no te ha escrito.</div>';
  const blocked = P().blocked.some(x => x.ref === 'user:' + clientId);
  cv.unreadCreator = 0;
  saveDB();
  const bubbles = cv.msgs.map(m => {
    const isOwner = m.from === 'them';
    const cls = isOwner ? 'me' : 'them';
    if (m.price && !m.paid) {
      return '<div class="bubble ppv-b ' + cls + '"><b style="display:block;margin-bottom:7px">' + esc(m.body) + '</b>' +
        '<div class="unlock-row">' + IC.lock + '<span style="font-size:12px;color:var(--gold2)">Foto premium · ' + fmt(m.price) + '</span>' +
        (isOwner ? '<span style="font-size:11px;color:var(--muted)">Pendiente de desbloqueo por el cliente</span>' :
        '<button class="btn btn-gold btn-sm" data-action="unlock-msg" data-mid="' + m.id + '" data-price="' + m.price + '" data-cref="' + myRef + '">Desbloquear ' + fmt(m.price) + '</button>') +
        '</div><span class="bt">' + m.t + '</span></div>';
    }
    return '<div class="bubble ' + cls + '">' + esc(m.body) +
      (m.price && m.paid ? '<span style="display:block;font-size:10px;opacity:.75;margin-top:5px">📷 Foto adjunta desbloqueada</span>' : '') +
      '<span class="bt">' + m.t + '</span></div>';
  }).join('');
  return '<div class="chat-shell">' +
    '<div class="chat-top"><button class="back-btn" onclick="location.hash=\'#/mensajes/bandeja\'">←</button>' +
      '<span class="avatar sm" style="--a:#c084fc;--b:#f9a8d4">' + ini(client.name) + '</span>' +
      '<div style="flex:1"><b style="font-size:14px">' + esc(client.name) + '</b></div></div>' +
    '<div class="chat-area" id="chat-area">' + bubbles + '</div>' +
    (blocked ? '<div class="chat-input" style="justify-content:center;color:var(--red);font-size:12.5px">Has bloqueado a esta cuenta.</div>'
    : '<form class="chat-input" id="msg-form-owner" data-clientid="' + clientId + '"><input id="msg-input" autocomplete="off" placeholder="Escribe un mensaje…" maxlength="500"><button class="send-btn" type="submit" title="Enviar">' + IC.send + '</button></form>' +
      '<div class="composer-tools"><label class="switch"><input type="checkbox" id="ppv-attach"><span class="slider-t"></span></label><span>Adjuntar foto premium ($)</span><input id="ppv-attach-price" type="number" min="1" max="50" step="0.5" value="3.99"></div>') +
    '</div>';
}

function sendMsg(form){
  const cid = form.dataset.clientid;
  if (cid) {
    /* ---- CREADORA respondiendo ---- */
    const client = S.users.find(u => u.id === cid);
    const myRef = 'user:' + cur().id;
    const cv = client.bag.convs.find(c => c.cref === myRef);
    const inp = $('#msg-input');
    const txt = (inp.value || '').trim();
    if (!cv || !txt) return;
    const attach = $('#ppv-attach').checked;
    const price = attach ? r2(Number($('#ppv-attach-price').value) || 3.99) : null;
    cv.msgs.push({ id:uid('M'), from:'them', body:txt, price:price, paid:false,
      t:'Hoy · ' + new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) });
    cv.unreadClient = (cv.unreadClient || 0) + 1;
    notify(client.id, '💬 ' + cur().creator.stageName + ' te respondió' + (price ? ' · incluye una foto premium (' + fmt(price) + ')' : '') + '.');
    saveDB(); inp.value = ''; route();
    const area = $('#chat-area'); if (area) area.scrollTop = area.scrollHeight;
    return;
  }
  /* ---- CLIENTE enviando mensaje ---- */
  const cref = form.dataset.cref;
  const cv = P().convs.find(c => c.cref === cref);
  const inp = $('#msg-input'); const txt = (inp.value || '').trim();
  if (!cv || !txt) return;
  cv.msgs.push({ id:uid('M'), from:'me', body:txt, price:null, paid:false,
    t:'Hoy · ' + new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) });
  cv.unreadCreator = (cv.unreadCreator || 0) + 1;
  saveDB(); inp.value = ''; route();
  const area = $('#chat-area'); if (area) area.scrollTop = area.scrollHeight;
  /* Auto-reply solo para creadoras del catálogo */
  if (cref.startsWith('seed:')) {
    setTimeout(()=>{
      cv.msgs.push({ id:uid('M'), from:'them', body:REPLIES[Math.floor(Math.random()*REPLIES.length)], price:null, paid:false, t:'Hoy' });
      cv.unreadC = (cv.unreadC || 0) + 1;
      saveDB();
      if (location.hash.indexOf('/mensajes/conversaciones/'+encodeURIComponent(cref))>-1) route();
    }, 1300);
  }
}
function vcallsHTML(){
  const b = P();
  if (!b.vcalls.length) return '<div class="empty">Sin solicitudes de videollamada.</div>';
  return b.vcalls.map(v=>{
    const cr = CR(v.cref);
    const stMap = { pendiente:['pendiente','warn'], pagada:['pagada · esperando','info'], aceptada:['aceptada','ok'], completada:['completada','dim'], rechazada:['rechazada · reembolsada','bad'] };
    const st = stMap[v.status]||['—','dim'];
    return '<div class="req-row"><span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
      '<div class="req-main"><h5>'+esc(cr.name)+'</h5><p>'+v.mins+' min · '+fmt(v.price)+' · '+v.date+'</p></div>' +
      '<span class="st '+st[1]+'">'+st[0]+'</span></div>';
  }).join('');
}

/* ================= suscripciones ================= */
function renderSuscripciones(){
  if (!cur()) return gateHTML('Inicia sesión para gestionar tus membresías y recibos.');
  const b = P();
  const cards = b.subs.map(s=>{
    const cr = CR(s.cref); if (!cr) return '';
    return '<div class="sub-card"><span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
      '<div class="sub-info"><h4>'+esc(cr.name)+' '+IC.ver+'</h4><p>Plan '+(s.plan==='yearly'?'anual':'mensual')+' · '+fmt(s.price)+' · Inició '+s.started+'</p>' +
      '<p>Próxima renovación: <b style="color:var(--gold2)">'+s.renews+'</b> · Cancelas cuando quieras</p></div>' +
      '<a class="btn btn-ghost btn-sm" href="'+perfilHref(cr)+'">Ver perfil</a>' +
      '<button class="btn btn-danger btn-sm" data-action="cancel-sub" data-ref="'+cr.ref+'">Cancelar</button></div>';
  }).join('');
  const rec = '<h2 class="subhead">Recibos e historial</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Monto</th></tr></thead><tbody>' +
    b.receipts.map(r=>'<tr><td style="font-family:var(--mono);font-size:12px">'+r.id+'</td><td>'+r.date+'</td><td>'+esc(r.desc)+'</td><td class="'+(r.amount>=0?'money-in':'money-out')+'">'+fmt(r.amount)+'</td></tr>').join('') +
    '</tbody></table></div>';
  return '<div class="container"><div class="view-head"><span class="kicker">Mi cuenta</span><h1>Suscripciones</h1><p>Renovación visible · Cancelación inmediata</p></div>' +
    (cards || '<div class="empty">No tienes membresías activas.<br><a class="btn btn-gold btn-sm" href="#/explorar">Explorar creadoras</a></div>') + rec + '</div>';
}
function cancelSub(ref){
  const cr = CR(ref);
  MODCTX = { type:'cancel', ref:ref };
  openModal('<h3>Cancelar suscripción</h3><p class="mdesc">¿Confirmas cancelar tu membresía con <b>'+esc(cr.name)+'</b>? Sin penalidades ni letra pequeña.</p>' +
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Mantener membresía</button><button class="btn btn-danger" data-action="cancel-confirm">Sí, cancelar</button></div>');
}
function cancelConfirm(){
  P().subs = P().subs.filter(s=>s.cref!==MODCTX.ref);
  audit('CLIENTE','Canceló suscripción de '+(CR(MODCTX.ref)||{handle:MODCTX.ref}).handle);
  saveDB(); closeModal(); route(); toast('Suscripción cancelada.');
}

/* ================= autenticación real ================= */
function authOpen(mode){
  mode = mode || 'login';
  const loginForm =
    '<form id="login-form"><div class="fld" style="margin-bottom:10px"><label>Correo electrónico</label><input id="lg-email" type="email" required autocomplete="email" placeholder="tu@correo.com"></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>Contraseña</label><input id="lg-pass" type="password" required autocomplete="current-password" placeholder="••••••••"></div>' +
    '<div id="lg-error"></div><button class="btn btn-gold btn-block" type="submit">Entrar</button></form>' +
    '<div class="hint-box">Cuenta de administración de prueba<br><code>admin@lumina.pe</code> · <code>admin123</code></div>';
  const regForm =
    '<form id="reg-form"><div class="fld" style="margin-bottom:10px"><label>Nombre o nombre artístico</label><input id="rg-name" required maxlength="40" placeholder="¿Cómo te llamas?"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Correo electrónico</label><input id="rg-email" type="email" required autocomplete="email" placeholder="tu@correo.com"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Fecha de nacimiento (debes ser +18)</label><input id="rg-dob" type="date" required max="2010-12-31"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Contraseña (mín. 8 caracteres)</label><input id="rg-pass" type="password" required minlength="8" autocomplete="new-password"></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>Confirmar contraseña</label><input id="rg-pass2" type="password" required autocomplete="new-password"></div>' +
    '<div id="rg-error"></div><button class="btn btn-gold btn-block" type="submit">Crear mi cuenta</button>' +
    '<p class="demo-note" style="text-align:left;margin-top:10px">Al crear la cuenta confirmas que eres mayor de 18 años y aceptas los <a href="#/legal/terminos">Términos</a> y la <a href="#/legal/privacidad">Política de Privacidad</a>.</p></form>';
  openModal('<div class="auth-tabs"><button class="atab'+(mode==='login'?' active':'')+'" data-action="auth-tab" data-mode="login">Iniciar sesión</button>' +
    '<button class="atab'+(mode==='register'?' active':'')+'" data-action="auth-tab" data-mode="register">Crear cuenta</button></div>' +
    '<div id="auth-body">'+(mode==='login'?loginForm:regForm)+'</div>');
}
function authTab(mode){ authOpen(mode); }

function formError(sel,msg){ const e=$(sel); e.innerHTML='<div style="color:var(--red);font-size:12px;margin-bottom:8px">⚠ '+esc(msg)+'</div>'; }

async function doLogin(){
  const email = ($('#lg-email').value||'').trim().toLowerCase();
  const pass = $('#lg-pass').value || '';
  const u = S.users.find(x=>(x.email||'').toLowerCase()===email);
  if (!u) { formError('#lg-error','No existe una cuenta con ese correo.'); return; }
  const h = await sha256(pass);
  if (h !== u.passHash) { formError('#lg-error','Contraseña incorrecta.'); return; }
  if (u.status !== 'activo') { formError('#lg-error','Cuenta suspendida. Contacta a soporte.'); return; }
  if (u.twoFA) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    MODCTX = { pendingUid:u.id, otp:code, pendingName:u.name.split(' ')[0] };
    openModal('<h3>Código de verificación</h3><p class="mdesc">Demo sin SMS real: tu código es <b style="color:var(--gold2);font-size:18px">' + code + '</b>. En producción llega por app autenticadora (TOTP) o SMS.</p>' +
      '<form id="otp-form"><div class="fld" style="margin-bottom:12px"><label>Código de 6 dígitos</label><input id="otp-in" required maxlength="6" inputmode="numeric" pattern="\\d{6}" placeholder="••••••"></div><div id="otp-error"></div><button class="btn btn-gold btn-block" type="submit">Verificar y entrar</button></form>');
    return;
  }
  loginAs(u.id); closeModal(); toast('Bienvenida/o, '+u.name.split(' ')[0]+'.');
}
async function doRegister(){
  const name = ($('#rg-name').value||'').trim();
  const email = ($('#rg-email').value||'').trim().toLowerCase();
  const dob = $('#rg-dob').value;
  const p1 = $('#rg-pass').value||'', p2 = $('#rg-pass2').value||'';
  if (!name) { formError('#rg-error','Escribe tu nombre.'); return; }
  if (S.users.some(u=>(u.email||'').toLowerCase()===email)) { formError('#rg-error','Ese correo ya tiene una cuenta.'); return; }
  if (!dob) { formError('#rg-error','Ingresa tu fecha de nacimiento.'); return; }
  const bd = new Date(dob); const yrs = (Date.now()-bd.getTime())/31557600000;
  if (!(yrs>=18)) { formError('#rg-error','Debes tener al menos 18 años para registrarte.'); return; }
  if (p1.length<8) { formError('#rg-error','La contraseña debe tener al menos 8 caracteres.'); return; }
  if (p1!==p2) { formError('#rg-error','Las contraseñas no coinciden.'); return; }
  const u = { id:uid('U'), role:'cliente', name:name, email:email, passHash:await sha256(p1), dob:dob, status:'activo', createdAt:todayStr(), bag:newBag(), creator:null };
  S.users.push(u); audit('SISTEMA','Nuevo registro: '+email+' (mayor de edad validado)');
  saveDB(); loginAs(u.id); closeModal(); toast('Cuenta creada. ¡Bienvenida/o a Lúmina Privé!');
}

/* ================= aplicar como creadora ================= */
function applyOpen(){
  const u = cur();
  if (!u) { authOpen('register'); toast('Primero crea tu cuenta (toma 1 minuto).'); return; }
  if (u.creator) { toast('Ya tienes un perfil de creadora: '+u.creator.stageName); location.hash='#/creadora/panel'; return; }
  openModal('<h3>Solicitar perfil de creadora</h3><p class="mdesc">Tu solicitud pasará a verificación administrativa (KYC simulado). Al aprobarse, tu perfil será público y podrás monetizar.</p>' +
    '<form id="apply-form">' +
    '<div class="fld" style="margin-bottom:10px"><label>Nombre artístico</label><input id="ap-name" required maxlength="30" placeholder="Ej. Sofia Luna"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Categoría</label><select id="ap-cat"><option>Lifestyle & Glamour</option><option>Fitness y bienestar</option><option>Arte y fotografía</option><option>Moda y pasarela</option><option>Viajes y aventura</option><option>Música y performance</option><option>Danza y movimiento</option><option>Otro</option></select></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Idiomas (Ctrl+clic para varios)</label><select id="ap-langs" multiple size="3"><option selected>ES</option><option>EN</option><option>PT</option></select></div>' +
    '<div style="display:flex;gap:10px;margin-bottom:10px">' +
    '<div class="fld"><label>Mensual USD</label><input id="ap-m" type="number" min="1" max="99" step="1" value="9.99"></div>' +
    '<div class="fld"><label>Anual USD</label><input id="ap-y" type="number" min="5" max="999" step="1" value="99.90"></div></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>Biografía corta</label><textarea id="ap-bio" maxlength="240" placeholder="Cuéntale a tus futuros fans qué encontrarán…"></textarea></div>' +
    '<div class="form-row"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-gold">Enviar solicitud</button></div></form>');
}
function applySubmit(){
  const u = cur();
  const name = ($('#ap-name').value||'').trim();
  if (!name) { toast('Elige tu nombre artístico.'); return; }
  let slug = slugify(name);
  const taken = x => x.slug === slug;
  while (LP.CREATORS.some(taken) || S.users.some(taken)) slug = slug + '-' + Math.floor(Math.random()*90+10);
  const langs = Array.from($('#ap-langs').selectedOptions).map(o=>o.value);
  u.creator = {
    slug:slug, stageName:name, cat:$('#ap-cat').value, langs:langs.length?langs:['ES'],
    monthly:r2(Number($('#ap-m').value)||9.99), yearly:r2(Number($('#ap-y').value)||99.90),
    bio:$('#ap-bio').value.trim() || 'Nuevo perfil en Lúmina Privé.',
    a:'#8b5cf6', b:'#d9b45c', initials:ini(name),
    status:'pendiente', appliedAt:todayStr(), rating:0, fans:0, resp:'~1 h',
    earnings:{ available:0, pending:0, total:0 }, payouts:[], uploads:[]
  };
  audit('CREADORA','Solicitud de verificación enviada: '+name+' (@'+slug+')');
  saveDB(); closeModal(); route(); toast('Solicitud enviada. Un administrador debe aprobar tu KYC.');
}

/* ================= panel de creadora (propio) ================= */
function renderPanel(tab){
  const u = cur();
  if (!u) return gateHTML('Inicia sesión con tu cuenta de creadora.');
  if (!u.creator) return '<div class="container empty"><h3 style="margin-bottom:8px">Aún no eres creadora</h3><p>Envía tu solicitud de verificación para abrir tu perfil y monetizar.</p>' +
    '<div style="margin-top:10px"><button class="btn btn-gold" data-action="apply-open">Solicitar perfil de creadora</button></div></div>';
  tab = tab || 'resumen';
  const c = u.creator;
  const stMap = { pendiente:['KYC EN REVISIÓN','warn'], verificada:['CUENTA VERIFICADA','ok'], rechazada:['RECHAZADA','bad'] };
  const st = stMap[c.status]||['—','dim'];
  let inner='';
  if (c.status!=='verificada')
    inner = '<div class="callout">Tu perfil está <b>'+(c.status==='pendiente'?'en revisión administrativa':'rechazado')+'</b>. '+(c.status==='pendiente'?'Cuando un administrador apruebe tu KYC, tu perfil se vuelve público y el panel se habilita por completo.':'Puedes editar y volver a enviar tu solicitud.')+'</div>' + (c.status==='pendiente'?'':'<button class="btn btn-gold" data-action="apply-reopen">Volver a enviar solicitud</button>');
  else if (tab==='publicaciones') inner = panelPosts(u);
  else if (tab==='perfil') inner = panelProfile(u);
  else if (tab==='ingresos') inner = panelMoney(u);
  else if (tab==='solicitudes') inner = panelReq(u);
  else if (tab==='estadisticas') inner = panelStats(u);
  else inner = panelHome(u);

  return '<div class="container">' +
    '<div class="dash-hero"><div class="avatar xl" style="--a:'+c.a+';--b:'+c.b+';margin:0">'+c.initials+'</div>' +
      '<div style="flex:1"><h1>'+esc(c.stageName)+'</h1><div class="sub">@'+c.slug+' · '+esc(c.cat)+' · '+c.langs.join('/')+'</div></div>' +
      '<span class="st '+st[1]+'">'+st[0]+'</span></div>' +
    '<div class="icards">' +
      '<div class="icard"><div class="lbl">Disponible para retiro</div><div class="val gold">'+fmt(c.earnings.available)+'</div></div>' +
      '<div class="icard"><div class="lbl">En retención (7 días)</div><div class="val">'+fmt(c.earnings.pending)+'</div></div>' +
      '<div class="icard"><div class="lbl">Total histórico</div><div class="val green">'+fmt(c.earnings.total)+'</div></div>' +
      '<div class="icard"><div class="lbl">Comisión plataforma</div><div class="val">20%</div></div></div>' +
    (c.status==='verificada'
      ? '<div class="tabs">'+[['resumen','Resumen'],['perfil','Mi perfil'],['publicaciones','Publicaciones'],['ingresos','Ingresos'],['solicitudes','Solicitudes'],['estadisticas','Estadísticas']].map(t=>'<button class="tab'+(tab===t[0]?' active':'')+'" onclick="location.hash=\'#/creadora/panel/'+t[0]+'\'">'+t[1]+'</button>').join('')+'</div>'
      : '') +
    inner + '</div>';
}
function panelHome(u){
  const c=u.creator;
  return '<div class="split-block"><h3 style="margin-bottom:4px">Distribución de ingresos</h3>' +
    '<p style="font-size:12.5px;color:var(--muted)">De cada pago, el <b style="color:var(--gold2)">80% es tuyo</b>. La plataforma retiene 20%.</p>' +
    '<div class="split-bar"><div class="seg-creator" style="width:80%"></div><div class="seg-platform" style="width:20%"></div></div>' +
    '<div class="split-legend"><span><i style="background:linear-gradient(90deg,var(--gold),var(--gold2))"></i>Tu parte: 80%</span><span><i style="background:#7c3aed"></i>Plataforma: 20%</span></div></div>' +
    '<div class="safe-grid">' +
    '<div class="safe-card"><h3>🔗 Tu perfil público</h3><p>Compártelo con tus seguidores. Se activó al aprobarse tu verificación.</p><a class="btn btn-gold btn-sm" href="#/perfil/user:'+u.id+'">Ver mi perfil</a></div>' +
    '<div class="safe-card"><h3>🛡 Protección anti-fuga</h3><p>Marca de agua por comprador y URLs temporales (en producción).</p><a class="btn btn-ghost btn-sm" href="#/seguridad">Centro de seguridad</a></div>' +
    '<div class="safe-card"><h3>📄 Tus derechos</h3><p>Consentimiento registrable y retiro inmediato de tu material.</p><a class="btn btn-ghost btn-sm" href="#/legal/consentimiento">Política de consentimiento</a></div></div>';
}
function panelPosts(u){
  const rows = (u.creator.uploads||[]).map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+(p.type==='ppv'?'Premium · '+fmt(p.price):p.type==='sub'?'Miembros':'Gratis')+'</td><td>'+p.date+'</td>' +
    '<td><span class="st '+(p.status==='aprobado'?'ok':p.status==='retirado'?'bad':'warn')+'">'+p.status.toUpperCase()+'</span></td></tr>').join('');
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">' +
    '<p style="font-size:12.5px;color:var(--muted)">Cada envío pasa por cola de moderación antes de publicarse.</p>' +
    '<button class="btn btn-gold" data-action="upload-open">+ Nueva publicación</button></div>' +
    ((u.creator.uploads||[]).length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Título</th><th>Visibilidad</th><th>Fecha</th><th>Moderación</th></tr></thead><tbody>'+rows+'</tbody></table></div>' : '<div class="empty">Aún no has publicado nada.</div>');
}
function uploadOpen(){
  openModal('<h3>Nueva publicación</h3><p class="mdesc">Al enviar declaras que el material es tuyo, que todas las personas presentes son mayores de 18 y que cuentas con su consentimiento registrado.</p>' +
    '<form id="upload-form"><div class="fld" style="margin-bottom:10px"><label>Título</label><input id="up-title" required maxlength="90" placeholder="Ej. Sesión editorial de agosto"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Visibilidad</label><select id="up-type"><option value="free">Gratis (promoción)</option><option value="sub" selected>Solo miembros</option><option value="ppv">Premium (pago por vista)</option></select></div>' +
    '<div class="fld" id="up-price-wrap" style="margin-bottom:10px;display:none"><label>Precio USD</label><input id="up-price" type="number" min="1" max="99" step="0.5" value="6.99"></div>' +
    '<div class="fld" style="margin-bottom:4px"><label>Archivo (simulado)</label><input disabled value="set_nuevo.zip · escaneado OK"></div>' +
    '<div class="form-row"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-gold">Enviar a revisión</button></div></form>');
}
function uploadSubmit(){
  const u=cur(); const title=$('#up-title').value.trim();
  if(!title){toast('Ponle un título.');return;}
  const type=$('#up-type').value;
  const price=type==='ppv'?r2(Number($('#up-price').value)||0):null;
  const entry={ id:uid('UP'), title:title, type:type, price:price, status:'en revisión', date:'Hoy' };
  u.creator.uploads.unshift(entry);
  S.modQueue.unshift({ id:entry.id, title:title, stageName:u.creator.stageName, date:'Hoy' });
  audit('CREADORA','Envió "'+title+'" a moderación');
  saveDB(); closeModal(); route(); toast('Enviada a revisión.');
}
function panelProfile(u){
  const c = u.creator;
  const presets = [
    ['#7c3aed','#d9b45c'], ['#ec4899','#8b5cf6'], ['#22d3ee','#a78bfa'],
    ['#f59e0b','#fb7185'], ['#34d399','#0ea5e9'], ['#ef4444','#f59e0b']
  ];
  const presetHTML = presets.map((p,i) =>
    '<label class="preset" style="--pg:linear-gradient(135deg,'+p[0]+','+p[1]+')"><input type="radio" name="cp" value="'+i+'"'+(c.a===p[0]?' checked':'')+'><span></span></label>'
  ).join('');
  const cats = ['Lifestyle & Glamour','Fitness y bienestar','Arte y fotografía','Moda y pasarela','Viajes y aventura','Música y performance','Danza y movimiento','Otro'];
  return '<form id="profile-form">' +
    '<div class="safe-card"><h3>Mi perfil artístico</h3><p style="font-size:12.5px;color:var(--muted);margin-bottom:18px">Edita tu información pública. El slug <code>@'+c.slug+'</code> no se puede cambiar.</p>' +
    '<div class="fld" style="margin-bottom:10px"><label>Nombre artístico</label><input id="pf-name" required maxlength="30" value="'+esc(c.stageName)+'"></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Categoría</label><select id="pf-cat">'+cats.map(x=>'<option'+(c.cat===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Idiomas</label><select id="pf-langs" multiple size="3"><option value="ES"'+(c.langs.includes('ES')?' selected':'')+'>ES</option><option value="EN"'+(c.langs.includes('EN')?' selected':'')+'>EN</option><option value="PT"'+(c.langs.includes('PT')?' selected':'')+'>PT</option></select></div>' +
    '<div style="display:flex;gap:10px;margin-bottom:10px"><div class="fld"><label>Mensual USD</label><input id="pf-m" type="number" min="1" max="99" step="1" value="'+c.monthly+'"></div><div class="fld"><label>Anual USD</label><input id="pf-y" type="number" min="5" max="999" step="1" value="'+c.yearly+'"></div></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Biografía corta</label><textarea id="pf-bio" maxlength="240">'+esc(c.bio)+'</textarea></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>Tiempo de respuesta</label><select id="pf-resp"><option'+(c.resp==='~10 min'?' selected':'')+'>~10 min</option><option'+(c.resp==='~30 min'?' selected':'')+'>~30 min</option><option'+(c.resp==='~1 h'?' selected':'')+'>~1 h</option><option'+(c.resp==='~2 h'?' selected':'')+'>~2 h</option></select></div>' +
    '<div class="fld" style="margin-bottom:10px"><label>Gradiente de avatar</label><div class="preset-grid">'+presetHTML+'</div></div>' +
    '<div class="fld" style="margin-bottom:14px"><label>Estado</label><div class="switch-wrap"><label class="switch"><input type="checkbox" id="pf-online"'+(c.online?' checked':'')+'><span class="slider-t"></span></label><span style="font-size:12px;color:var(--muted)">'+(c.online?'En línea · visible para fans':'Ausente · apareces como offline')+'</span></div></div>' +
    '<button class="btn btn-gold btn-block" type="submit">Guardar cambios</button></div></form>';
}
function profileSave(){
  const u = cur(); const c = u.creator;
  const presets = [['#7c3aed','#d9b45c'],['#ec4899','#8b5cf6'],['#22d3ee','#a78bfa'],['#f59e0b','#fb7185'],['#34d399','#0ea5e9'],['#ef4444','#f59e0b']];
  const pi = Number(($('input[name="cp"]:checked')||{}).value);
  c.stageName = ($('#pf-name').value||'').trim() || c.stageName;
  c.initials = ini(c.stageName);
  c.cat = $('#pf-cat').value;
  c.langs = Array.from($('#pf-langs').selectedOptions).map(o=>o.value);
  c.monthly = r2(Number($('#pf-m').value)||c.monthly);
  c.yearly = r2(Number($('#pf-y').value)||c.yearly);
  c.bio = ($('#pf-bio').value||'').trim() || c.bio;
  c.resp = $('#pf-resp').value;
  c.online = $('#pf-online').checked;
  if (pi >= 0 && presets[pi]) { c.a = presets[pi][0]; c.b = presets[pi][1]; }
  audit('CREADORA','Actualizó su perfil: '+c.stageName);
  saveDB(); route(); toast('Perfil actualizado ✓');
}
function panelMoney(u){
  const c=u.creator;
  const rows=(c.payouts||[]).map(p=>'<tr><td style="font-family:var(--mono);font-size:12px">'+p.id+'</td><td>'+p.date+'</td><td class="money-in">'+fmt(p.amount)+'</td><td><span class="st '+(p.status==='pagado'?'ok':'warn')+'">'+p.status.toUpperCase()+'</span></td></tr>').join('');
  return '<div class="split-block" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
    '<div><h3>Retiro de fondos</h3><p style="font-size:12.5px;color:var(--muted)">Disponible: <b style="color:var(--gold2)">'+fmt(c.earnings.available)+'</b> · Mínimo $20 · 48–72h hábiles.</p></div>' +
    '<button class="btn btn-gold" data-action="payout-open">Solicitar retiro</button></div>' +
    ((c.payouts||[]).length?'<h2 class="subhead">Historial de retiros</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'');
}
function payoutRequest(){
  const c=cur().creator;
  if(c.earnings.available<20){toast('El mínimo de retiro es $20.00.');return;}
  MODCTX={type:'payout',amt:c.earnings.available};
  openModal('<h3>Solicitar retiro</h3><p class="mdesc">Se transferirán <b>'+fmt(c.earnings.available)+'</b> a tu cuenta bancaria registrada.</p>' +
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-gold" data-action="payout-confirm">Confirmar retiro</button></div>');
}
function payoutConfirm(){
  const c=cur().creator; const amt=MODCTX.amt;
  c.earnings.available=0; c.earnings.pending=r2(c.earnings.pending+amt);
  c.payouts.unshift({id:uid('PG'),date:'Hoy',amount:amt,status:'en proceso'});
  audit('CREADORA','Solicitó retiro de '+fmt(amt));
  saveDB(); closeModal(); route(); toast('Retiro solicitado (48–72h).');
}
function panelReq(u){
  /* solicitudes dirigidas a esta creadora */
  const incoming=[];
  S.users.forEach(o=>{ if(o.bag) o.bag.vcalls.forEach(v=>{ if(v.cref==='user:'+u.id) incoming.push({...v, from:o.name}); }); });
  if(!incoming.length) return '<div class="empty">Sin solicitudes de videollamada todavía.</div>';
  return incoming.map(v=>{
    const st={pendiente:['sin pagar aún','dim'],pagada:['PAGADA · POR ACEPTAR','warn'],aceptada:['aceptada','ok'],completada:['completada','dim'],rechazada:['rechazada','bad']}[v.status]||['—','dim'];
    return '<div class="req-row"><span class="ri" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(217,180,92,.1);border:1px solid rgba(217,180,92,.3)">📹</span>' +
      '<div class="req-main"><h5>'+esc(v.from)+'</h5><p>'+v.mins+' min · '+fmt(v.price)+' · '+v.date+'</p></div>' +
      '<span class="st '+st[1]+'">'+st[0]+'</span>' +
      (v.status==='pagada'?'<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="vc-accept" data-id="'+v.id+'" data-owner="1">Aceptar</button><button class="btn btn-danger btn-sm" data-action="vc-decline" data-id="'+v.id+'" data-owner="1">Rechazar</button></div>':'')+'</div>';
  }).join('');
}
function vcAccept(id, ok){
  let done=false;
  S.users.forEach(o=>{ if(o.bag) o.bag.vcalls.forEach(v=>{ if(v.id===id){ v.status=ok?'aceptada':'rechazada';
    if(!ok){ o.bag.wallet=r2(o.bag.wallet+v.price); o.bag.receipts.unshift({id:uid('RC'),date:'Hoy',desc:'Reembolso videollamada',amount:v.price}); }
    done=true; } }); });
    if(done){ audit('CREADORA',(ok?'Aceptó':'Rechazó')+' videollamada '+id);
      if(ok) notify(id.split('-')[0], '✅ Tu videollamada fue aceptada por la creadora.');
      saveDB(); route(); toast(ok?'Videollamada aceptada.':'Rechazada · cliente reembolsado.'); }
}
function panelStats(u){
  const c=u.creator;
  const months=[['Abr',0],['May',0],['Jun',0],['Jul',0],['Ago',Math.round(c.earnings.total)||0]];
  const max=Math.max(1,...months.map(m=>m[1]));
  return '<div class="icards">' +
    '<div class="icard"><div class="lbl">Fans totales</div><div class="val gold">'+c.fans+'</div></div>' +
    '<div class="icard"><div class="lbl">Publicaciones vivas</div><div class="val">'+(c.uploads||[]).filter(x=>x.status==='aprobado').length+'</div></div>' +
    '<div class="icard"><div class="lbl">En revisión</div><div class="val">'+(c.uploads||[]).filter(x=>x.status==='en revisión').length+'</div></div>' +
    '<div class="icard"><div class="lbl">Retiros</div><div class="val green">'+(c.payouts||[]).length+'</div></div></div>' +
    '<div class="split-block"><h3 style="margin-bottom:14px">Ingresos brutos por mes (USD)</h3><div class="bars">' +
    months.map(m=>'<div class="bar-col"><span class="bar-val">$'+m[1]+'</span><div class="bar" style="height:'+Math.round(m[1]/max*100)+'%"></div><span class="bar-lbl">'+m[0]+'</span></div>').join('')+'</div></div>';
}

/* ================= seguridad ================= */
function renderSeguridad(){
  const u=cur();
  if(!u) return gateHTML('Inicia sesión para gestionar tu seguridad.');
  const b=P();
  const blockedRows=b.blocked.map(x=>'<div class="blocked-row"><span style="flex:1">'+esc(x.name)+'</span><button class="btn btn-ghost btn-sm" data-action="block-toggle" data-ref="'+x.ref+'" data-name="'+esc(x.name)+'">Desbloquear</button></div>').join('')
    ||'<p style="font-size:12.5px;color:var(--dim)">No has bloqueado a ninguna cuenta.</p>';
  const repRows=S.reports.filter(r=>r.byEmail===(u.email||'')).slice(0,6).map(r=>'<div class="audit-row"><span class="audit-time">'+r.date+'</span><span style="flex:1">'+esc(r.target)+' · '+esc(r.reason)+'</span><span class="st '+(r.status==='resuelta'?'ok':'warn')+'">'+r.status.toUpperCase()+'</span></div>').join('')
    ||'<div class="audit-row"><span>No has enviado denuncias.</span></div>';
  const mine = u.creator ? '<div class="safe-card danger-zone"><h3>🗑 Retirar consentimiento</h3><p>Ordena el retiro inmediato de TODO tu material publicado.</p><button class="btn btn-danger btn-block" data-action="withdraw-consent">Solicitar retiro total</button></div>' : '';
  const tfaCard = '<div class="safe-card"><h3>🔐 Autenticación de dos factores</h3><p>Añade una segunda capa de seguridad al iniciar sesión. En producción usa app autenticadora o SMS.</p>' +
    '<button class="btn '+(u.twoFA?'btn-danger':'btn-ok')+' btn-block" data-action="twofa-toggle">'+(u.twoFA?'Desactivar 2FA':'Activar 2FA (demo)')+'</button>' +
    '<p style="font-size:11px;color:'+(u.twoFA?'var(--green)':'var(--dim)')+';margin-top:8px">Estado: '+(u.twoFA?'ACTIVADA ✓':'desactivada')+'</p></div>';
  return '<div class="container"><div class="view-head"><span class="kicker">Confianza</span><h1>Centro de seguridad</h1><p>Bloqueo, denuncia, consentimiento, 2FA y control total.</p></div>' +
    '<div class="safe-grid">' +
    '<div class="safe-card"><h3>⛔ Cuentas bloqueadas</h3><p>No podrán contactarte ni interactuar contigo.</p>'+blockedRows+'</div>' +
    tfaCard +
    '<div class="safe-card"><h3>🚩 Denunciar una cuenta</h3><p>Los reportes de posible menor de edad o deepfake suspenden preventivamente.</p>' +
      '<form id="report-form"><div class="fld" style="margin-bottom:10px"><label>Cuenta o enlace</label><input id="rep-target" required placeholder="@usuario o URL"></div>' +
      '<div class="fld" style="margin-bottom:10px"><label>Motivo</label><select id="rep-reason"><option>Suplantación de identidad</option><option selected>Contenido robado o sin autorización</option><option>Posible menor de edad ⚠️</option><option>Acoso o chantaje</option><option>Deepfake sexual no consentido ⚠️</option><option>Otro</option></select></div>' +
      '<div class="fld" style="margin-bottom:12px"><label>Detalles (opcional)</label><textarea id="rep-detail" maxlength="400"></textarea></div>' +
      '<button class="btn btn-danger btn-block" type="submit">Enviar denuncia</button></form></div>' +
    mine +
    '<div class="safe-card"><h3>🧭 Recursos</h3><div class="help-links">' +
      '<a href="#/legal/reglas">Reglas de contenido prohibido</a>' +
      '<a href="#/legal/consentimiento">Política de consentimiento</a>' +
      '<a href="#/legal/privacidad">Privacidad · Ley N.º 29733</a>' +
      '<a href="#" onclick="return false">confianza@lumina.example · respuesta &lt; 24h</a></div></div></div>' +
    '<h2 class="subhead">Mis denuncias</h2><div class="panel">'+repRows+'</div>' +
    '<p style="font-size:11.5px;color:var(--dim);margin-top:14px">Prohibidos: menores de edad, falta de consentimiento, coerción, deepfakes sexuales, datos privados, material robado, servicios ilegales y grabaciones encubiertas.</p></div>';
}
function withdrawConsent(){
  openModal('<h3>⚠️ Retirar consentimiento total</h3><p class="mdesc">Esto retirará <b>todo tu material publicado</b> (elimina tus publicaciones de circulación).</p>' +
    '<div class="fld" style="margin-bottom:12px"><label>Escribe RETIRAR para confirmar</label><input id="wd-confirm" placeholder="RETIRAR"></div>' +
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-danger" data-action="withdraw-confirm">Confirmar retiro</button></div>');
}
function withdrawConfirm(){
  if(($('#wd-confirm').value||'').trim().toUpperCase()!=='RETIRAR'){toast('Escribe RETIRAR para confirmar.');return;}
  const u=cur(); const n=(u.creator.uploads||[]).length;
  u.creator.uploads=[]; S.modQueue=S.modQueue.filter(q=>q.stageName!==u.creator.stageName);
  audit('CREADORA','Retiró consentimiento total · '+n+' materiales fuera de circulación');
  saveDB(); route(); toast('Consentimiento retirado. Material fuera de circulación.');
}

/* ================= admin ================= */
function renderAdmin(tab){
  const u=cur();
  if(!u||u.role!=='admin') return '<div class="container empty"><h3 style="margin-bottom:8px">Administración</h3><p>Área restringida.</p>' +
    '<div style="margin-top:10px"><button class="btn btn-gold" data-action="auth-open">Iniciar sesión como administrador</button></div>' +
    '<div class="hint-box" style="max-width:340px;margin:14px auto 0;text-align:center">Prueba: <code>admin@lumina.pe</code> · <code>admin123</code></div></div>';
  tab=tab||'kyc';
  const pendKyc=S.users.filter(x=>x.creator&&x.creator.status==='pendiente').length;
  const openRep=S.reports.filter(r=>r.status!=='resuelta').length;
  const payPending=S.users.reduce((a,x)=>a+((x.creator&&x.creator.payouts||[]).filter(p=>p.status!=='pagado').length),0);
  return '<div class="container"><div class="view-head"><span class="kicker">Operaciones</span><h1>Administración</h1><p>KYC · Moderación · Pagos · Denuncias · Auditoría</p></div>' +
    '<div class="icards">' +
    '<div class="icard"><div class="lbl">KYC pendientes</div><div class="val gold">'+pendKyc+'</div></div>' +
    '<div class="icard"><div class="lbl">Cola de moderación</div><div class="val">'+S.modQueue.length+'</div></div>' +
    '<div class="icard"><div class="lbl">Denuncias abiertas</div><div class="val '+(openRep?'green':'')+'">'+openRep+'</div></div>' +
    '<div class="icard"><div class="lbl">Retiros por pagar</div><div class="val">'+payPending+'</div></div></div>' +
    '<div class="tabs">'+[['kyc','Cola KYC'],['mod','Moderación'],['pagos','Pagos'],['denuncias','Denuncias'],['audit','Auditoría']].map(t=>'<button class="tab'+(tab===t[0]?' active':'')+'" onclick="location.hash=\'#/admin/'+t[0]+'\'">'+t[1]+'</button>').join('')+'</div>' +
    adminTab(tab)+'</div>';
}
function adminTab(tab){
  if(tab==='kyc'){
    const q=S.users.filter(x=>x.creator&&x.creator.status==='pendiente');
    if(!q.length) return '<div class="empty">No hay verificaciones pendientes. ✓</div>';
    return q.map(u=>{ const c=u.creator;
      return '<div class="req-row"><span class="avatar md" style="--a:'+c.a+';--b:'+c.b+'">'+c.initials+'</span>' +
        '<div class="req-main"><h5>'+esc(c.stageName)+' <span class="cc-handle">@'+c.slug+'</span></h5><p>'+esc(c.cat)+' · '+c.langs.join('/')+' · '+fmt(c.monthly)+'/mes · Solicitado: '+c.appliedAt+' · Cuenta: '+esc(u.email)+'</p></div>' +
        '<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="kyc-approve" data-id="'+u.id+'">Aprobar KYC</button><button class="btn btn-danger btn-sm" data-action="kyc-reject" data-id="'+u.id+'">Rechazar</button></div></div>'; }).join('');
  }
  if(tab==='mod'){
    if(!S.modQueue.length) return '<div class="empty">Cola de moderación vacía. ✓</div>';
    return S.modQueue.map(q=>'<div class="req-row"><span class="ri" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3)">🔍</span>' +
      '<div class="req-main"><h5>'+esc(q.title)+'</h5><p>'+esc(q.stageName)+' · Enviado: '+q.date+'</p></div>' +
      '<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="mod-approve" data-id="'+q.id+'">Aprobar</button><button class="btn btn-danger btn-sm" data-action="mod-remove" data-id="'+q.id+'">Retirar</button></div></div>').join('');
  }
  if(tab==='pagos'){
    const rows=[]; S.users.forEach(u=>{ if(u.creator)(u.creator.payouts||[]).forEach(p=>rows.push({...p,who:u.creator.stageName})); });
    if(!rows.length) return '<div class="empty">Sin retiros registrados.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Creadora</th><th>Fecha</th><th>Monto</th><th>Estado</th><th></th></tr></thead><tbody>' +
      rows.map(p=>'<tr><td style="font-family:var(--mono);font-size:12px">'+p.id+'</td><td>'+esc(p.who)+'</td><td>'+p.date+'</td><td class="money-in">'+fmt(p.amount)+'</td>' +
        '<td><span class="st '+(p.status==='pagado'?'ok':'warn')+'">'+p.status.toUpperCase()+'</span></td>' +
        '<td>'+(p.status!=='pagado'?'<button class="btn btn-ok btn-sm" data-action="payout-mark" data-pid="'+p.id+'">Marcar pagado</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  if(tab==='denuncias'){
    if(!S.reports.length) return '<div class="empty">Sin denuncias. ✓</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Objetivo</th><th>Motivo</th><th>Reportó</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>' +
      S.reports.map(r=>'<tr><td>'+esc(r.target)+'</td><td>'+esc(r.reason)+'</td><td>'+esc(r.by)+'</td><td>'+r.date+'</td>' +
        '<td><span class="st '+(r.status==='resuelta'?'ok':r.reason.includes('⚠️')?'bad':'warn')+'">'+r.status.toUpperCase()+'</span></td>' +
        '<td>'+(r.status!=='resuelta'?'<button class="btn btn-ok btn-sm" data-action="report-resolve" data-id="'+r.id+'">Resolver</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  if(tab==='audit') return '<div class="panel">'+S.audit.map(a=>'<div class="audit-row"><span class="audit-time">'+a.t+'</span><span class="audit-who">'+esc(a.who)+'</span><span>'+esc(a.act)+'</span></div>').join('')+'</div>';
}
function kycApprove(id,ok){
  const u=S.users.find(x=>x.id===id); if(!u||!u.creator)return;
  if(ok){ u.creator.status='verificada'; notify(u.id,'🎉 ¡Verificación aprobada! Tu perfil @'+u.creator.slug+' ya es público y puedes publicar y monetizar.'); audit('ADMIN','KYC aprobado · '+u.creator.stageName+' (@'+u.creator.slug+') habilitada'); saveDB(); route(); toast(u.creator.stageName+' aprobada. Su perfil ya es público.'); }
  else { u.creator.status='rechazada'; notify(u.id,'Tu solicitud de verificación fue rechazada. Puedes corregir tus datos y volver a enviarla.'); audit('ADMIN','KYC rechazado · @'+u.creator.slug); saveDB(); route(); toast('Solicitud rechazada.'); }
}
function modAction(id,ok){
  const q=S.modQueue.find(x=>x.id===id); if(!q)return;
  S.modQueue=S.modQueue.filter(x=>x.id!==id);
  S.users.forEach(u=>{ if(u.creator){ const up=(u.creator.uploads||[]).find(x=>x.id===id); if(up){ up.status=ok?'aprobado':'retirado'; if(ok){ u.creator.fans+=Math.floor(Math.random()*15)+3; }
    notify(u.id, ok ? '✓ Tu publicación "'+q.title+'" fue aprobada y ya es visible.' : '✕ Tu publicación "'+q.title+'" fue retirada por violar las reglas de contenido.'); } } });
  audit('ADMIN','Moderación: '+(ok?'aprobó':'retiró')+' "'+q.title+'"');
  saveDB(); route(); toast(ok?'Publicación aprobada y visible.':'Publicación retirada.');
}
function payoutMark(pid){
  S.users.forEach(u=>{ if(u.creator){ const p=(u.creator.payouts||[]).find(x=>x.id===pid);       if(p&&p.status!=='pagado'){ p.status='pagado'; u.creator.earnings.pending=r2(Math.max(0,u.creator.earnings.pending-p.amount));
        notify(u.id,'🏦 Retiro '+pid+' marcado como pagado · '+fmt(p.amount)+' transferidos.'); audit('ADMIN','Payout '+pid+' pagado ('+fmt(p.amount)+')'); } } });
  saveDB(); route(); toast('Retiro marcado como pagado.');
}
function reportResolve(id){
  const r=S.reports.find(x=>x.id===id); if(!r)return;
  r.status='resuelta'; audit('ADMIN','Denuncia '+r.id+' resuelta ('+r.target+')');
  saveDB(); route(); toast('Denuncia resuelta.');
}

/* ================= denuncias / bloqueo ================= */
function reportOpen(target){
  MODCTX={type:'report'};
  openModal('<h3>Denunciar cuenta</h3><p class="mdesc">Tu reporte llega al equipo de confianza. Denuncias prioritarias suspenden la cuenta de inmediato.</p>' +
    '<form id="quick-report"><div class="fld" style="margin-bottom:10px"><label>Cuenta</label><input id="qr-target" value="'+esc(target||'')+'" readonly></div>' +
    '<div class="fld" style="margin-bottom:12px"><label>Motivo</label><select id="qr-reason"><option>Suplantación de identidad</option><option>Contenido robado o sin autorización</option><option>Posible menor de edad ⚠️</option><option>Acoso o chantaje</option><option>Deepfake sexual no consentido ⚠️</option><option>Otro</option></select></div>' +
    '<div class="form-row"><button type="button" class="btn btn-ghost" data-action="modal-close">Cerrar</button><button type="submit" class="btn btn-danger">Enviar denuncia</button></div></form>');
}
function submitReport(target, reason){
  const u=cur();
  S.reports.unshift({ id:uid('RP'), target:target, reason:reason, status:'recibida', by:u?u.name:'Anónimo', byEmail:u?(u.email||''):'', date:'Hoy' });
  audit(u?u.role.toUpperCase():'ANÓNIMO','Denunció a '+target+' ('+reason+')');
  if(reason.includes('⚠️')) audit('ADMIN','Suspensión preventiva automática: '+target+' (denuncia prioritaria)');
  saveDB();
  toast(reason.includes('⚠️')?'Denuncia prioritaria registrada. Cuenta suspendida preventivamente.':'Denuncia registrada. Gracias por cuidar la comunidad.');
}
function blockToggle(ref,name){
  const b=P(); const i=b.blocked.findIndex(x=>x.ref===ref);
  if(i>=0){ b.blocked.splice(i,1); toast('Desbloqueaste a '+name+'.'); }
  else { b.blocked.push({ref:ref,name:name}); toast('Bloqueaste a '+name+'.'); }
  saveDB(); route();
}

/* ================= legal ================= */
const LEGAL={
 terminos:{t:'Términos del servicio',u:'Actualizado: agosto 2026',b:
  '<h3>1. Naturaleza del servicio</h3><p>Lúmina Privé es una plataforma de contenido por suscripción reservada exclusivamente a personas adultas. El acceso requiere al menos 18 años y superar la verificación de edad.</p>'+
  '<h3>2. Cuentas</h3><ul><li>Eres responsable de tus credenciales; recomendamos activar 2FA.</li><li>Prohibidas las cuentas falsas, la suplantación y el uso compartido.</li><li>Las cuentas suspendidas por infracciones graves pierden acceso a fondos hasta resolver la investigación.</li></ul>'+
  '<h3>3. Pagos, renovación y cancelación</h3><ul><li>Todos los precios se muestran antes de confirmar cualquier cargo.</li><li>Las membresías renuevan automáticamente en la fecha visible en Suscripciones.</li><li>Cancelación en un clic, sin letra pequeña.</li><li>Videollamadas pagadas por adelantado; si la creadora no acepta, reembolso automático del 100%.</li></ul>'+
  '<h3>4. Contenido y licencia</h3><p>El material pertenece a sus creadoras. Licencia personal, revocable y no transferible. Prohibido descargar, grabar o redistribuir; cada vista incorpora marcas de agua identificativas.</p>'},
 privacidad:{t:'Privacidad · Ley N.º 29733',u:'Cumplimiento Perú · D.S. N.º 016-2024-JUS',b:
  '<h3>1. Responsable y base legal</h3><p>Tratamos datos personales conforme a la <b>Ley N.º 29733</b> y su reglamento actualizado por el <b>D.S. N.º 016-2024-JUS</b>. Base legal: consentimiento informado y ejecución del contrato.</p>'+
  '<h3>2. Datos tratados</h3><ul><li><b>Cuentas:</b> correo, hash de contraseña (nunca texto plano), estado 2FA.</li><li><b>Creadoras:</b> nombre artístico, biografía, idiomas y resultado de verificación de identidad.</li><li><b>Transacciones:</b> montos, conceptos y referencias del procesador.</li></ul>'+
  '<h3>3. Verificación de edad (KYC)</h3><p>Los documentos se procesan con proveedor externo certificado. La aplicación nunca almacena copias de documentos: solo el resultado y la referencia.</p>'+
  '<h3>4. Derechos ARCO</h3><p>Acceso, rectificación, cancelación, oposición y portabilidad desde el Centro de Seguridad o escribiendo a confianza@lumina.example. El cierre de cuenta incluye eliminación de datos y retiro de contenido con acuse de recibo.</p>'+
  '<h3>5. Seguridad</h3><ul><li>Cifrado en tránsito (TLS 1.3) y en reposo; contraseñas con hash SHA-256 + salt en producción (Argon2id).</li><li>URLs temporales firmadas y marca de agua dinámica.</li><li>Auditoría inmutable de acciones administrativas.</li></ul>'},
 consentimiento:{t:'Política de consentimiento',u:'Compromiso anti-explotación',b:
  '<h3>1. Consentimiento previo, informado y documentado</h3><p>Toda creadora declara bajo responsabilidad que su material es propio o cuenta con autorización escrita de todos los participantes, todos mayores de 18 años. Se conservan registros vinculados a cada publicación.</p>'+
  '<h3>2. Retiro del consentimiento</h3><p>Cualquier persona presente puede ordenar el retiro: eliminación del almacenamiento primario, CDN y desindexación de espejos, con acuse de recibo.</p>'+
  '<h3>3. Material sin permiso</h3><p>Publicar material íntimo sin consentimiento, incluidos deepfakes sexuales, es la infracción más grave: eliminación inmediata, cierre definitivo, conservación de evidencias para las autoridades y asistencia activa a la víctima.</p>'+
  '<div class="callout"><b>Canal prioritario:</b> reportes de material no consentido tienen precedencia sobre cualquier otra cola, primera acción &lt; 1 hora.</div>'},
 reglas:{t:'Reglas de contenido prohibido',u:'Cero tolerancia',b:
  '<h3>Prohibiciones absolutas</h3><ul>'+
  '<li><b>Menores de edad:</b> cualquier contenido con menores o cuya edad no pueda demostrarse. Suspensión preventiva inmediata y reporte a autoridades.</li>'+
  '<li><b>Falta de consentimiento:</b> material grabado o distribuido sin autorización expresa.</li>'+
  '<li><b>Coerción o chantaje:</b> extorsión o presión para producir o compartir material.</li>'+
  '<li><b>Deepfakes sexuales:</b> rostros o cuerpos sintéticos sin consentimiento real.</li>'+
  '<li><b>Información privada:</b> filtración de datos de terceros.</li>'+
  '<li><b>Material robado:</b> reutilización de contenido ajeno.</li>'+
  '<li><b>Servicios ilegales</b> y <b>grabaciones encubiertas</b>.</li></ul>'+
  '<h3>Herramientas de la comunidad</h3><p>Cada perfil y conversación incluye Bloquear, Denunciar y Eliminar. Las denuncias prioritarias suspenden preventivamente mientras se investiga.</p>'}
};
function renderLegal(tab){
  if(!LEGAL[tab]) tab='terminos';
  const d=LEGAL[tab];
  return '<div class="container"><div class="legal-wrap"><aside class="legal-nav">' +
    Object.keys(LEGAL).map(k=>'<a href="#/legal/'+k+'" class="'+(k===tab?'active':'')+'">'+LEGAL[k].t+'</a>').join('') +
    '<a href="#/seguridad" style="color:var(--red)">→ Centro de seguridad</a></aside>' +
    '<article class="legal-body"><h2>'+d.t+'</h2><div class="upd">'+d.u+'</div>'+d.b+'</article></div></div>';
}

/* ================= eventos ================= */
document.addEventListener('click', function(e){
  const sc=e.target.closest('[data-scroll]');
  if(sc){ e.preventDefault(); const sec=document.getElementById(sc.dataset.scroll); if(sec)sec.scrollIntoView({behavior:'smooth'}); return; }
  if(e.target.closest('#bellBtn')){ openNotifs(); return; }
  if(e.target.classList.contains('ovl')){ closeModal(); return; }
  const t=e.target.closest('[data-action]'); if(!t) return;
  const a=t.dataset.action;
  switch(a){
    case 'modal-close': closeModal(); paintBell(); break;
    case 'bell-open': openNotifs(); break;
    case 'notifs-read': saveDB(); closeModal(); paintBell(); break;
    case 'auth-open': authOpen('login'); break;
    case 'auth-tab': authTab(t.dataset.mode); break;
    case 'logout': logout(); break;
    case 'topup-open': topupOpen(); break;
    case 'topup-amt': topupAmt(t.dataset.amt); break;
    case 'sub-open': subOpen(t.dataset.ref,t.dataset.plan); break;
    case 'coupon-check': couponCheck(); break;
    case 'sub-pay': subPay(); break;
    case 'cancel-sub': e.preventDefault(); cancelSub(t.dataset.ref); break;
    case 'cancel-confirm': cancelConfirm(); break;
    case 'unlock-post': unlockPost(t.dataset.id,Number(t.dataset.price),t.dataset.cref); break;
    case 'view-post': viewPost(t); break;
    case 'tip-open': tipOpen(t.dataset.ref); break;
    case 'tip-send': tipSend(t.dataset.amt); break;
    case 'tip-send-custom': tipSend($('#tip-custom').value); break;
    case 'vcall-open': vcallOpen(t.dataset.ref); break;
    case 'vcall-pick': vcallPick(t.dataset.plan); break;
    case 'unlock-msg': unlockMsg(t.dataset.mid,Number(t.dataset.price),t.dataset.cref); break;
    case 'report-open': reportOpen(t.dataset.target); break;
    case 'block-toggle': blockToggle(t.dataset.ref,t.dataset.name); break;
    case 'withdraw-consent': withdrawConsent(); break;
    case 'withdraw-confirm': withdrawConfirm(); break;
    case 'apply-open': applyOpen(); break;
    case 'apply-reopen': applyOpen(); break;
    case 'upload-open': uploadOpen(); break;
    case 'payout-open': payoutRequest(); break;
    case 'payout-confirm': payoutConfirm(); break;
    case 'kyc-approve': kycApprove(t.dataset.id,true); break;
    case 'kyc-reject': kycApprove(t.dataset.id,false); break;
    case 'mod-approve': modAction(t.dataset.id,true); break;
    case 'mod-remove': modAction(t.dataset.id,false); break;
    case 'payout-mark': payoutMark(t.dataset.pid); break;
    case 'report-resolve': reportResolve(t.dataset.id); break;
    case 'vc-accept': vcAccept(t.dataset.id,true); break;
    case 'vc-decline': vcAccept(t.dataset.id,false); break;
    case 'twofa-toggle': { const u=cur(); if(u){ u.twoFA=!u.twoFA; audit(u.role.toUpperCase(),'2FA '+(u.twoFA?'activada':'desactivada')); saveDB(); route(); toast(u.twoFA?'2FA activada ✓':'2FA desactivada.'); } break; }
  }
});
document.addEventListener('submit', function(e){
  if(e.target.id==='msg-form'||e.target.id==='msg-form-owner'){ e.preventDefault(); sendMsg(e.target); }
  else if(e.target.id==='login-form'){ e.preventDefault(); doLogin(); }
  else if(e.target.id==='reg-form'){ e.preventDefault(); doRegister(); }
  else if(e.target.id==='apply-form'){ e.preventDefault(); applySubmit(); }
  else if(e.target.id==='upload-form'){ e.preventDefault(); uploadSubmit(); }
  else if(e.target.id==='profile-form'){ e.preventDefault(); profileSave(); }
  else if(e.target.id==='report-form'){ e.preventDefault(); submitReport($('#rep-target').value.trim(),$('#rep-reason').value); }
  else if(e.target.id==='otp-form'){ e.preventDefault(); if(($('#otp-in').value||'').trim()===MODCTX.otp){ loginAs(MODCTX.pendingUid); closeModal(); toast('Bienvenida/o, '+MODCTX.pendingName+'.'); } else { formError('#otp-error','Código incorrecto.'); } }
  else if(e.target.id==='quick-report'){ e.preventDefault(); submitReport($('#qr-target').value.trim(),$('#qr-reason').value); }
});
document.addEventListener('input', function(e){
  if(['f-q','f-lang','f-cat','f-sort'].includes(e.target.id)||e.target.id==='f-online') applyFilters();
});
document.addEventListener('change', function(e){
  if(e.target.id==='up-type') $('#up-price-wrap').style.display = e.target.value==='ppv'?'flex':'none';
});

/* ================= inicio ================= */
(function init(){
  loadDB();
  $('#ageChk').addEventListener('change', function(){ $('#btnEnter18').disabled = !this.checked; });
  $('#btnEnter18').addEventListener('click', ()=>{ localStorage.setItem('lumina_age','si'); enterApp(); });
  if(localStorage.getItem('lumina_age')==='si') enterApp();
  else { $('#ageGate').classList.remove('hidden'); }
  ensureSeed().then(()=>{ if(cur()) paintChrome(); });
})();
function enterApp(){
  $('#ageGate').classList.add('hidden');
  ['#topbar','#app','#footer'].forEach(s=>$(s).classList.remove('hidden'));
  route();
}
