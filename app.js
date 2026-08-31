/* =========================================================
   Lúmina Privé · app.js v3 — versión PROFESIONAL
   - Galerías de creadora por categoría (baño/íntimo/personalizado/lifestyle)
   - Lado consumidor: paywall por galería (gratis/miembros/PPV)
   - Contacto con pago previo: abrir chat = pago
   - Webcam con permiso previo de la chica + pago
   - Multiusuario real (registro/login, SHA-256, sesión)
   ========================================================= */
'use strict';

/* ================= utilidades ================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => '$' + (Math.round(n*100)/100).toFixed(2);
const r2  = n => Math.round(n*100)/100;
const uid = p => p + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
const todayStr = () => new Date().toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'});
const plusDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'}); };
const ini = name => String(name||'?').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
async function sha256(txt){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''); }

function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._h); toast._h = setTimeout(()=>t.classList.remove('show'), 3000); }
let MODCTX = {};
function openModal(html){ $('#modalRoot').innerHTML = '<div class="ovl"><div class="mbox"><button class="mclose" data-action="modal-close">✕</button>' + html + '</div></div>'; }
function closeModal(){ $('#modalRoot').innerHTML = ''; MODCTX = {}; }

const IC = {
  ver: '<svg class="vbadge" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#d9b45c"/><path d="M8 12.5l2.6 2.6L16.5 9" stroke="#241a05" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
  send:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l19-8L3 4v5l13 3-13 3z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8.5v7L16 12z"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4m0 1h13l-2.5 4L18 13H5"/></svg>',
  video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="M16 10l6-2.5v9L16 14z"/></svg>'
};

/* ================= capa de datos ================= */
const DB_KEY='lumina_db_v3'; const SES_KEY='lumina_session_v3';
let S=null;
function saveDB(){ localStorage.setItem(DB_KEY, JSON.stringify(S)); }
function loadDB(){
  try{ S = JSON.parse(localStorage.getItem(DB_KEY)); }catch(e){ S=null; }
  if(!S || !Array.isArray(S.users)){ S = LP.defaultDB(); }
  if(!Array.isArray(S.notifications)) S.notifications=[];
  saveDB();
}
function audit(who, act){ S.audit.unshift({ who:who, act:act, t: todayStr()+' · '+new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) }); }
function notify(to, text){ S.notifications.unshift({ id:uid('NT'), to:to, text:text, t:'Hoy · '+new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}), read:false }); }

async function ensureSeed(){
  if(!S.users.some(u=>u.role==='admin')){
    S.users.push({ id:'u-admin', role:'admin', name:'Administración', email:'admin@lumina.pe', passHash:await sha256('admin123'), dob:'1990-01-01', status:'activo', createdAt:todayStr(), twoFA:false, bag:newBag(), creator:null });
    audit('SISTEMA','Base inicializada · cuenta admin');
    saveDB();
  }
}
function newBag(){
  return { wallet:0, ledger:[], receipts:[], subs:[], unlockedPosts:[], unlockedGalleries:[], convs:[], vcalls:[], blocked:[], chatsPaid:[] };
}
function cur(){ const s=JSON.parse(localStorage.getItem(SES_KEY)||'null'); return s?(S.users.find(u=>u.id===s)||null):null; }
function loginAs(id){ localStorage.setItem(SES_KEY, JSON.stringify(id)); paintChrome(); route(); }
function logout(){ localStorage.removeItem(SES_KEY); paintChrome(); route(); toast('Sesión cerrada.'); }
function P(){ const u=cur(); if(!u) return null; if(!u.bag) u.bag=newBag(); return u.bag; }

/* ---- catálogo de creadoras (semillas + cuentas verificadas) ---- */
function normSeed(c){
  return { ref:'seed:'+c.id, name:c.name, handle:c.handle, initials:c.initials, a:c.a, b:c.b, bio:c.bio, langs:c.langs, cat:c.cat, resp:c.resp,
    online:c.online, rating:c.rating, fans:c.fans, media:c.media, monthly:c.monthly, yearly:c.yearly, tags:c.tags||[], galleries:c.galleries||[] };
}
function normUserCr(u){
  const c=u.creator;
  return { ref:'user:'+u.id, name:c.stageName, handle:'@'+c.slug, initials:ini(c.stageName), a:c.a, b:c.b, bio:c.bio, langs:c.langs, cat:c.cat, resp:c.resp,
    online:c.online, rating:c.rating, fans:c.fans, media:(c.uploads||[]).filter(x=>x.status==='aprobado').length, monthly:c.monthly, yearly:c.yearly,
    tags:c.tags||[], galleries:(c.uploads||[]).filter(x=>x.status==='aprobado').map(p=>({ cat:p.cat, label:p.catLabel, access:p.access, photos:[p] })) ,
    ownerId:u.id };
}
function CR(ref){
  if(!ref) return null;
  if(ref.startsWith('seed:')){ const c=LP.CREATORS.find(x=>x.id===ref.slice(5)); return c?normSeed(c):null; }
  if(ref.startsWith('user:')){ const u=S.users.find(x=>x.id===ref.slice(5)); return (u&&u.creator&&u.creator.status==='verificada')?normUserCr(u):null; }
  return null;
}
function allCreators(){ return LP.CREATORS.map(normSeed).concat(S.users.filter(u=>u.creator&&u.creator.status==='verificada').map(normUserCr)); }
function galleryAccess(gal){ return gal.access||'free'; }
function galleryTotalPhotos(gal){ return (gal.photos||[]).length; }
function galleryPrice(gal){ const p=[];(gal.photos||[]).forEach(x=>{ if(x.p>0) p.push(x.p); }); return p.length?Math.min.apply(null,p):0; }
function isSubbed(ref){ return !!(P()&&P().subs.some(s=>s.cref===ref)); }
function isGalleryUnlocked(ref, cat){ return !!(P()&&P().unlockedGalleries.some(g=>g.cref===ref&&g.cat===cat)); }
function hasAccess(ref, gal){
  const ac = galleryAccess(gal);
  if(ac==='free') return true;
  if(ac==='sub')  return isSubbed(ref);
  if(ac==='ppv')  return isGalleryUnlocked(ref, gal.cat);
  return false;
}
function earnCredit(cref, gross){
  if(!cref||!cref.startsWith('user:')) return;
  const u=S.users.find(x=>x.id===cref.slice(5));
  if(u&&u.creator){ u.creator.earnings.available=r2((u.creator.earnings.available||0)+gross*0.8); u.creator.earnings.total=r2((u.creator.earnings.total||0)+gross*0.8); }
}
function uid2(){ return 'M-'+Math.random().toString(36).slice(2,8); }

/* ---------- pagos ---------- */
function credit(amount, desc){ const b=P(); b.wallet=r2(b.wallet+amount); b.ledger.unshift({d:desc,amt:+amount,bal:b.wallet,t:todayStr()}); b.receipts.unshift({id:uid('RC'),date:'Hoy',desc:desc,amount:amount}); }
function debit(amount, desc){
  const b=P();
  if(b.wallet<amount){ openModal('<h3>Saldo insuficiente</h3><p class="mdesc">Necesitas <b>'+fmt(amount-b.wallet)+'</b> más. Tu saldo es '+fmt(b.wallet)+'.</p><div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cerrar</button><button class="btn btn-gold" data-action="topup-open">Recargar saldo</button></div>'); return false; }
  b.wallet=r2(b.wallet-amount); b.ledger.unshift({d:desc,amt:-amount,bal:b.wallet,t:todayStr()}); b.receipts.unshift({id:uid('RC'),date:'Hoy',desc:desc,amount:-amount}); return true;
}

/* ---------- media simulado ---------- */
function mediaHTML(cr, h){ return '<div class="'+(h?'pthumb':'mini-media')+'" style="--a:'+cr.a+';--b:'+cr.b+'"><span class="ini">'+cr.initials+'</span><span class="demo-tag">CONTENIDO SIMULADO</span></div>'; }

/* ================= router ================= */
window.addEventListener('hashchange', route);
function route(){
  const parts = location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  const root = parts[0]||'';
  $$('#mainNav a[data-nav]').forEach(a=>a.classList.toggle('active', a.dataset.nav===root));
  let html='';
  switch(root){
    case '':              html=renderLanding(); break;
    case 'explorar':      html=renderExplorar(); break;
    case 'galerias':      html=renderGalerias(); break;
    case 'perfil':        html=renderPerfil(decodeURIComponent(parts[1]||''), decodeURIComponent(parts[2]||'')); break;
    case 'mensajes':      html=renderMensajes(parts[1], decodeURIComponent(parts[2]||'')); break;
    case 'suscripciones': html=renderSuscripciones(); break;
    case 'creadora':      html=renderPanel(parts[1]||'resumen'); break;
    case 'seguridad':     html=renderSeguridad(); break;
    case 'admin':         html=renderAdmin(parts[1]||'kyc'); break;
    case 'legal':         html=renderLegal(parts[1]||'terminos'); break;
    default:              html=renderLanding();
  }
  $('#app').innerHTML = html;
  window.scrollTo(0,0);
}
function gateHTML(msg){ return '<div class="container empty"><h3 style="margin-bottom:8px">Zona privada</h3><p>'+msg+'</p><div style="display:flex;gap:10px;justify-content:center;margin-top:10px"><button class="btn btn-gold" data-action="auth-open">Iniciar sesión o crear cuenta</button><a class="btn btn-ghost" href="#/">Volver al inicio</a></div></div>'; }

/* ================= chrome ================= */
function paintChrome(){
  const u=cur();
  const chip=$('#roleChip'), wallet=$('#walletChip'), auth=$('#btnAuth');
  if(u){
    chip.textContent = u.creator ? 'Creadora · '+u.name : u.role.charAt(0).toUpperCase()+u.role.slice(1)+' · '+u.name.split(' ')[0];
    chip.classList.remove('hidden');
    wallet.classList.toggle('hidden', !!u.creator||u.role==='admin');
    wallet.textContent = fmt(P()?P().wallet:0); wallet.title='Saldo · recargar o ver historial';
    auth.textContent='Cerrar sesión ('+u.name.split(' ')[0]+')'; auth.classList.remove('btn-gold'); auth.classList.add('btn-ghost');
  } else {
    chip.classList.add('hidden'); wallet.classList.add('hidden');
    auth.textContent='Iniciar sesión'; auth.classList.add('btn-gold'); auth.classList.remove('btn-ghost');
  }
  $('#bellBtn').classList.toggle('hidden', !u); paintBell();
}
function myNotifs(){ const u=cur(); return u?S.notifications.filter(n=>n.to===u.id):[]; }
function paintBell(){ const c=$('#bellCount'); const un=myNotifs().filter(n=>!n.read).length; c.textContent=un>9?'9+':un; c.classList.toggle('hidden',un===0); }
function openNotifs(){
  const list=myNotifs();
  const rows=list.map(n=>'<div class="notif-row'+(n.read?'':' unread')+'"><p>'+esc(n.text)+'</p><span>'+n.t+'</span></div>').join('');
  openModal('<h3>Notificaciones</h3><p class="mdesc">Actividad de tu cuenta</p>'+(rows||'<p class="mdesc" style="text-align:center;padding:14px 0">Sin notificaciones todavía.</p>')+(list.length?'<button class="btn btn-ghost btn-block btn-sm" data-action="notifs-read" style="margin-top:12px">Marcar todas como leídas</button>':''));
  list.forEach(n=>n.read=true); saveDB(); setTimeout(paintBell,500);
}
function perfilHref(c){ return '#/perfil/'+encodeURIComponent(c.ref); }

/* ================= LANDING (página pública profesional) ================= */
function ccardHTML(c){
  const galleryCount = (c.galleries||[]).length;
  const totalPhotos = (c.galleries||[]).reduce((a,g)=>a+galleryTotalPhotos(g),0);
  const subbed=isSubbed(c.ref);
  return '<a class="ccard" href="'+perfilHref(c)+'">' +
    '<div class="cc-cover" style="--a:'+c.a+';--b:'+c.b+'">' +
      '<span class="online-pill '+(c.online?'on':'')+'">'+(c.online?'En línea':'Ausente')+'</span>' +
      '<span class="cc-cover-count">📷 '+totalPhotos+'</span></div>' +
    '<div class="cc-body">'+
      '<div class="avatar xl" style="--a:'+c.a+';--b:'+c.b+'">'+c.initials+'</div>' +
      '<div class="cc-name">'+esc(c.name)+IC.ver+'</div><div class="cc-handle">'+esc(c.handle)+'</div>' +
      '<div class="meta-chips"><span class="mchip">'+esc(c.cat)+'</span>'+(c.tags||[]).slice(0,2).map(t=>'<span class="mchip">'+esc(t)+'</span>').join('')+'</div>' +
      '<div class="gallery-dots">'+(c.galleries||[]).map(g=>'<span class="gdot '+(galleryAccess(g)!=='free'?'locked':'')+'" title="'+esc(LP.GALLERY_CATS.find(x=>x.id===g.cat).label)+'">'+esc(LP.GALLERY_CATS.find(x=>x.id===g.cat).icon)+'</span>').join('')+'</div>' +
      '<div class="cc-foot"><span class="cc-price">'+fmt(c.monthly)+'<small>/mes'+(subbed?' · eres miembro':'')+'</small></span><span class="btn btn-gold btn-sm">Ver perfil</span></div>' +
    '</div></a>';
}
function renderLanding(){
  const list=allCreators();
  const featured=list.slice().sort((x,y)=>(y.online-x.online)||(y.fans-x.fans)).slice(0,6);
  return '' +
  '<section class="hero container"><div class="hero-glow"></div><div class="hero-content">' +
    '<span class="kicker">Verificado · Privado · Exclusivo +18</span>' +
    '<h1>Galerías privadas de <em>chicas verificadas</em>. Contacta con pago previo y total discreción.</h1>' +
    '<p class="hero-sub">Mira mini-previews públicas, entra a galerías exclusivas de ropa de baño, íntima o a tu gusto, y conéctate por mensaje o webcam con su permiso. Transparente y seguro.</p>' +
    '<div class="hero-ctas"><a class="btn btn-gold btn-lg" href="#/galerias">Ver galerías</a>' +
    '<a class="btn btn-ghost btn-lg" href="#/explorar">Explorar creadoras</a>' +
    '<button class="btn btn-violet btn-lg" data-action="apply-open">Quiero ser creadora</button></div>' +
    '<div class="stats-strip">' +
      '<div class="stat"><b>'+list.length+'</b><span>Creadoras verificadas</span></div>' +
      '<div class="stat"><b>100%</b><span>Contacto con pago previo</span></div>' +
      '<div class="stat"><b>80%</b><span>Gana la creadora</span></div>' +
      '<div class="stat"><b>24h</b><span>Moderación y soporte</span></div></div></div></section>' +

  '<section class="sec alt" id="como-funciona"><div class="container">' +
    '<div class="sec-title"><span class="kicker">Cómo funciona</span><h2>Todo claro, nada que adivinar.</h2></div>' +
    '<div class="steps-grid"><div class="step-col"><h3><span class="dot"></span>Si eres fan</h3>' +
      '<div class="step-card"><span class="step-num">1</span><div><b>Regístrate gratis</b><p>Cuenta real, mayoría de edad validada.</p></div></div>' +
      '<div class="step-card"><span class="step-num">2</span><div><b>Explora galerías</b><p>Mini-previews públicas; cada galería (baño, íntima, personalizada) con su precio.</p></div></div>' +
      '<div class="step-card"><span class="step-num">3</span><div><b>Desbloquea y contacta</b><p>Paga por ver PPV o suscríbete, y abre el chat con pago previo.</p></div></div>' +
      '<div class="step-card"><span class="step-num">4</span><div><b>Webcam con permiso</b><p>La chica acepta tu llamada antes de iniciar; pago anticipado.</p></div></div></div>' +
    '<div class="step-col"><h3><span class="dot"></span>Si eres creadora</h3>' +
      '<div class="step-card"><span class="step-num">1</span><div><b>Crea tu cuenta</b><p>Una cuenta, luego activas modo creadora.</p></div></div>' +
      '<div class="step-card"><span class="step-num">2</span><div><b>Verificación (KYC)</b><p>Documento + prueba de vida vía proveedor; aprobado por admin.</p></div></div>' +
      '<div class="step-card"><span class="step-num">3</span><div><b>Sube tu galería</b><p>Ropa de baño, íntima, personalizado o lifestyle; tú pones el precio (gratis/miembros/pago por ver).</p></div></div>' +
      '<div class="step-card"><span class="step-num">4</span><div><b>Conecta y gana</b><p>Mensajes pagos, webcam con tu permiso, propinas y 80% para ti.</p></div></div></div></div></div></section>' +

  '<section class="sec"><div class="container">' +
    '<div class="sec-title"><span class="kicker">Galerías ahora</span><h2>Chicas verificadas, contenido que se paga con transparencia</h2></div>' +
    '<div class="creator-grid">'+featured.map(ccardHTML).join('')+'</div>' +
    '<div style="text-align:center;margin-top:26px"><a class="btn btn-ghost" href="#/galerias">Ver todas las galerías →</a></div></div></section>' +

  '<section class="sec alt"><div class="container">' +
    '<div class="sec-title"><span class="kicker">Transparencia</span><h2>Pagos siempre visibles antes de confirmar</h2></div>' +
    '<div class="guarantees">' +
      '<div class="guarantee"><span class="chk">✓</span>Cada galería muestra su precio y tipo de acceso antes de pagar.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>CChat se abre con pago previo; nada oculto.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Webcam solo inicia con el permiso explícito de la chica.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Cancelación en un clic y recibos de cada transacción.</div>' +
      '<div class="guarantee"><span class="chk">✓</span>Cupones y propinas 100% transparentes.</div></div></div></section>' +

  '<section class="sec container"><div class="cta-banner">' +
    '<span class="kicker">Únete hoy</span><h2>Tu espacio privado te espera.</h2>' +
    '<p>Regístrate gratis o aplica como creadora verificada.</p>' +
    '<div class="hero-ctas"><button class="btn btn-gold btn-lg" data-action="auth-open">Crear cuenta</button><button class="btn btn-violet btn-lg" data-action="apply-open">Quiero ser creadora</button></div></div></section>';
}

/* ================= EXPLORAR ================= */
const F={q:'',lang:'all',cat:'all',sort:'pop',online:false};
function filteredCreators(){
  let list=allCreators();
  if(F.q){ const q=F.q.toLowerCase(); list=list.filter(c=>(c.name+' '+c.handle+' '+c.cat+(c.tags||[]).join(' ')).toLowerCase().includes(q)); }
  if(F.lang!=='all') list=list.filter(c=>c.langs.includes(F.lang));
  if(F.cat!=='all') list=list.filter(c=>c.cat===F.cat);
  if(F.online) list=list.filter(c=>c.online);
  if(F.sort==='precio-a') list.sort((a,b)=>a.monthly-b.monthly);
  else if(F.sort==='precio-d') list.sort((a,b)=>b.monthly-a.monthly);
  else if(F.sort==='rating') list.sort((a,b)=>b.rating-a.rating);
  else list.sort((a,b)=>b.fans-a.fans);
  return list;
}
function renderExplorar(){
  const cats=Array.from(new Set(allCreators().map(c=>c.cat)));
  return '<div class="container"><div class="view-head"><span class="kicker">Explorar</span><h1>Creadoras verificadas</h1><p>Identidad comprobada · Precios transparentes</p></div>' +
    '<div class="filter-bar">' +
      '<div class="fld"><label>Buscar</label><input id="f-q" value="'+esc(F.q)+'" placeholder="Nombre, @usuario o tag…"></div>' +
      '<div class="fld"><label>Idioma</label><select id="f-lang"><option value="all">Todos</option><option>ES</option><option>EN</option><option>PT</option></select></div>' +
      '<div class="fld"><label>Categoría</label><select id="f-cat"><option value="all">Todas</option>'+cats.map(c=>'<option'+(F.cat===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></div>' +
      '<div class="fld"><label>Ordenar por</label><select id="f-sort"><option value="pop">Popularidad</option><option value="precio-a">Precio ↑</option><option value="precio-d">Precio ↓</option><option value="rating">Calificación</option></select></div>' +
      '<div class="fld switch-wrap"><label class="switch"><input type="checkbox" id="f-online"'+(F.online?' checked':'')+'><span class="slider-t"></span></label><span style="font-size:12px;color:var(--muted)">Solo en línea</span></div></div>' +
    '<p class="results-line" id="results-line"></p><div class="creator-grid" id="creator-results"></div></div>';
}
function resetFilters(){ F.q='';F.lang='all';F.cat='all';F.sort='pop';F.online=false; route(); }
function applyFilters(){
  F.q=($('#f-q')||{}).value??F.q; F.lang=($('#f-lang')||{}).value??F.lang; F.cat=($('#f-cat')||{}).value??F.cat; F.sort=($('#f-sort')||{}).value??F.sort; F.online=!!($('#f-online')||{}).checked;
  const list=filteredCreators();
  $('#creator-results').innerHTML=list.length?list.map(ccardHTML).join(''):'<div class="empty">Sin resultados.<br><a class="btn btn-ghost btn-sm" href="#/explorar" onclick="setTimeout(resetFilters,50)">Limpiar filtros</a></div>';
  $('#results-line').textContent=list.length+' creadora'+(list.length===1?'':'s')+' encontrada'+(list.length===1?'':'s');
}

/* ================= GALERÍAS (página pública de contenido) ================= */
function renderGalerias(){
  const all=[];
  allCreators().forEach(c=>{ (c.galleries||[]).forEach(g=>{ all.push({c, g}); }); });
  const grouped={}; LP.GALLERY_CATS.forEach(cc=>grouped[cc.id]=[]);
  all.forEach(x=>{ if(grouped[x.g.cat]) grouped[x.g.cat].push(x); });
  let html='<div class="container"><div class="view-head"><span class="kicker">Contenido</span><h1>Galerías privadas</h1><p>Cada galería indica su tipo de acceso y precio. Mini-previews públicas, lo demás tras el pago.</p></div>';
  LP.GALLERY_CATS.forEach(cc=>{
    const items=grouped[cc.id]||[];
    if(!items.length) return;
    html+='<h2 class="subhead">'+cc.icon+' '+esc(cc.label)+'</h2><div class="gal-grid">'+items.map(x=>galCardHTML(x.c,x.g)).join('')+'</div>';
  });
  html+='</div>';
  return html;
}
function galCardHTML(c,g){
  const ac=galleryAccess(g);
  const price=galleryPrice(g);
  const acc=hasAccess(c.ref,g);
  const cnt=galleryTotalPhotos(g);
  const lockCls=acc?'':'locked';
  return '<div class="gal-card '+(acc?'':'gal-card-locked')+'" onclick="location.hash=\''+perfilHref(c)+'/'+g.cat+'\'">' +
    '<div class="gal-cover '+lockCls+'" style="--a:'+c.a+';--b:'+c.b+'">' +
      '<span class="ptype '+(LP.ACCESS[ac]||{cls:'free'}).cls+'">'+(LP.ACCESS[ac]||{}).label+'</span>' +
      (acc?'':'<div class="lock-overlay"><div class="lock-box">'+IC.lock+(price?'<span style="color:#fff;font-size:11px;margin-top:4px">Desde '+fmt(price)+'</span>':'')+'</div></div>') +
      '<span class="gal-count">📷 '+cnt+'</span></div>' +
    '<div class="gal-body"><b>'+esc(g.label)+'</b><div class="gal-meta">'+(price?'Desde '+fmt(price)+' · ':'')+cnt+' foto'+(cnt===1?'':'s')+'</div>' +
      (acc?'<span class="btn btn-ok btn-sm btn-block" style="cursor:pointer">Ver galería →</span>':'<span class="btn btn-gold btn-sm btn-block" style="cursor:pointer">'+(ac==='sub'?'Ser miembro':'Desbloquear')+' →</span>') +
    '</div></div>';
}

/* ================= PERFIL DE CREADORA (con galerías) ================= */
function renderPerfil(param, catParam){
  const cr=CR(param);
  if(!cr) return '<div class="container empty">Perfil no encontrado.<br><a class="btn btn-gold btn-sm" href="#/galerias">Ver galerías</a></div>';
  const b=P();
  const subbed=isSubbed(cr.ref);
  const blocked=b&&b.blocked.some(x=>x.ref===cr.ref);
  const mine=cur()&&cur().creator&&('user:'+cur().id===cr.ref);
  const chatPaid=b&&b.chatsPaid.includes(cr.ref);
  const hasChat=b&&b.convs.some(c=>c.cref===cr.ref);

  let galleryHTML='';
  (cr.galleries||[]).forEach(g=>{
    const active=g.cat===catParam;
    galleryHTML+=galleryBlockHTML(cr,g,active);
  });

  return '<div class="container">' +
    '<div class="cover" style="--a:'+cr.a+';--b:'+cr.b+'"><span class="cover-tag">PERFIL VERIFICADO · IDENTIDAD COMPROBADA</span>' +
      '<div class="cover-inner"><div class="avatar hero-av" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</div></div></div>' +
    '<div class="profile-head"><div class="row1"><h1>'+esc(cr.name)+' '+IC.ver+'</h1><span class="st '+(cr.online?'ok':'dim')+'">'+(cr.online?'● En línea':'○ Ausente')+'</span>'+(mine?'<span class="st info">ES TU PERFIL</span>':'')+'</div>' +
      '<div class="handle-line">'+esc(cr.handle)+' '+(cr.rating?'· ★ '+cr.rating.toFixed(1):'')+' · '+Number(cr.fans).toLocaleString('es-PE')+' fans</div>' +
      '<p class="bio-text">'+esc(cr.bio)+'</p>' +
      '<div class="chips-row"><span class="mchip">🗣 '+cr.langs.map(esc).join(' · ')+'</span><span class="mchip">'+esc(cr.cat)+'</span>'+(cr.tags||[]).map(t=>'<span class="mchip">'+esc(t)+'</span>').join('')+'</div>' +
      '<div class="action-row">' +
        (mine ? '<button class="btn btn-violet" onclick="location.hash=\'#/creadora/panel\'">Ir a mi panel de creadora</button>'
         : blocked ? '<button class="btn btn-danger" data-action="block-toggle" data-ref="'+cr.ref+'" data-name="'+esc(cr.name)+'">Desbloquear</button>'
         : '<a class="btn btn-gold" href="#/mensajes/chat/'+encodeURIComponent(cr.ref)+'">💬 Abrir chat ('+(chatPaid||hasChat?'':fmt(LP.CHAT_OPEN_FEE))+')</a>'+
           '<button class="btn btn-violet" data-action="vcall-open" data-ref="'+cr.ref+'">'+IC.cam+' Webcam</button>'+
           '<button class="btn btn-ghost" data-action="tip-open" data-ref="'+cr.ref+'">Propina</button>'+
           '<button class="btn btn-danger" data-action="report-open" data-target="'+esc(cr.handle)+'">Denunciar</button>') +
      '</div>' +
      (subbed?'<div class="sub-strip">✦ Membresía activa · Renueva el '+b.subs.find(s=>s.cref===cr.ref).renews+' · <a href="#" data-action="cancel-sub" data-ref="'+cr.ref+'" style="color:var(--red)">Cancelar</a></div>':'') +
    '</div>' +

    '<h2 class="subhead">Planes de membresía</h2>' +
    '<div class="plans">' +
      '<div class="plan-card"><span class="plan-name">Mensual</span><div class="plan-price">'+fmt(cr.monthly)+'<small>/mes</small></div>' +
        '<ul class="plan-feats"><li>Desbloquea galerías "miembros"</li><li>Mensajería directa privada</li><li>Renovación visible y cancelación en 1 clic</li></ul>' +
        (subbed?'<button class="btn btn-ghost btn-block" disabled>Ya eres miembro ✓</button>':'<button class="btn btn-gold btn-block" data-action="sub-open" data-ref="'+cr.ref+'" data-plan="monthly">Suscribirme</button>')+'</div>' +
      '<div class="plan-card best"><span class="plan-save">AHORRA '+Math.round((1-cr.yearly/(cr.monthly*12))*100)+'%</span><span class="plan-name">Anual</span><div class="plan-price">'+fmt(cr.yearly)+'<small>/año</small></div>' +
        '<ul class="plan-feats"><li>Todo lo del plan mensual</li><li>Badge de miembro anual</li><li>Prioridad en respuestas</li></ul>' +
        (subbed?'<button class="btn btn-ghost btn-block" disabled>Ya eres miembro ✓</button>':'<button class="btn btn-violet btn-block" data-action="sub-open" data-ref="'+cr.ref+'" data-plan="yearly">Suscribirme</button>')+'</div></div>' +

    '<h2 class="subhead">Galerías exclusivas</h2>' +
    '<div class="gal-sections">'+galleryHTML+'</div>' +
    '<p style="font-size:11.5px;color:var(--dim);margin-top:14px">Contenido simulado. En producción: URLs temporales firmadas, marca de agua por comprador y moderación activa.</p></div>';
}
function galleryBlockHTML(cr,g,active){
  const ac=galleryAccess(g);
  const acc=hasAccess(cr.ref,g);
  const price=galleryPrice(g);
  const catLabel=(LP.GALLERY_CATS.find(x=>x.id===g.cat)||{}).label||g.label;
  const photos=(g.photos||[]);
  const lockLabel=ac==='sub'?'Solo miembros':(price?'Desde '+fmt(price):'');
  return '<div class="gal-sec '+(active?'gal-sec-active':'')+'" id="gal-'+g.cat+'">' +
    '<div class="gal-sec-head"><div><b>'+esc(catLabel)+' · '+esc(g.label)+'</b>' +
      '<div class="gal-meta">'+fmt(price||cr.monthly)+' · '+(LP.ACCESS[ac]||{}).label+' · '+photos.length+' foto'+(photos.length===1?'':'s')+'</div></div>' +
      (acc?'':'<button class="btn '+(ac==='sub'?'btn-violet':'btn-gold')+' btn-sm" data-action="unlock-gal" data-ref="'+cr.ref+'" data-cat="'+g.cat+'" data-ac="'+ac+'" data-price="'+price+'">'+ (ac==='sub'?'Ser miembro':'Desbloquear '+fmt(price)) +'</button>') +
    '</div>' +
    '<div class="gal-photos">' +
      photos.map(p=>{
        const lockedPPV=p.p>0&&!acc;
        return '<div class="gphoto '+(lockedPPV?'gphoto-locked':'')+'" style="--a:'+cr.a+';--b:'+cr.b+'" data-action="view-photo" data-title="'+esc(p.t)+'" data-cref="'+cr.ref+'" data-price="'+p.p+'" data-acc="'+acc+'">' +
          '<span class="ini">'+cr.initials+'</span>' +
          (lockedPPV?'<div class="lock-overlay"><div class="lock-box small">'+IC.lock+'<span style="color:#fff;font-size:10px">'+fmt(p.p)+'</span></div></div>':'') +
          '<span class="ph-label">'+esc(p.t)+'</span></div>';
      }).join('') +
    '</div></div>';
}

/* ---------- desbloquear galería ---------- */
function unlockGallery(ref, cat, ac, price){
  const cr=CR(ref); if(!cr) return;
  if(ac==='sub'){
    if(isSubbed(ref)){ P().unlockedGalleries.push({cref:ref,cat}); saveDB(); route(); toast('Galería desbloqueada.'); return; }
    subOpen(ref,'monthly'); return;
  }
  const cost=price>0?price:galleryPrice((cr.galleries||[]).find(g=>g.cat===cat));
  if(!debit(cost,'Galería '+cat+' · '+cr.name)) return;
  P().unlockedGalleries.push({cref:ref,cat});
  earnCredit(ref,cost);
  if(ref.startsWith('user:')) notify(ref.slice(5),'🔓 Desbloquearon tu galería "'+((LP.GALLERY_CATS.find(x=>x.id===cat)||{}).label||cat)+'" · ingreso bruto '+fmt(cost));
  audit('CLIENTE','Desbloqueó galería '+cat+' de '+cr.handle);
  saveDB(); route(); toast('Galería desbloqueada ✓ · ahora puedes verla.');
}
function viewPhoto(el){
  const cr=CR(el.dataset.cref);
  if(el.dataset.acc!=='true'){
    openModal('<h3>Foto bloqueada</h3><p class="mdesc">"' + esc(el.dataset.title)+ '" está tras el paywall. Desbloquea la galería para verla.</p><div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cerrar</button></div>');
    return;
  }
  openModal('<h3>'+esc(el.dataset.title)+'</h3><p class="mdesc">Galería de '+esc(cr.name)+' · '+ (el.dataset.price>0?'Precio pagado ('+fmt(el.dataset.price)+')':'Gratis para ti') +'</p>'+
    '<div class="mini-media" style="--a:'+cr.a+';--b:'+cr.b+';height:300px"><span class="ini" style="font-size:52px">'+cr.initials+'</span><span class="demo-tag">CONTENIDO SIMULADO</span></div>'+
    '<div class="callout" style="margin-top:14px">En producción llevaría marca de agua con tu ID de compra.</div>');
}

/* ================= mensajes (pago previo al abrir chat) ================= */
function renderMensajes(tab, param){
  tab=tab||'conversaciones';
  if(!cur()) return gateHTML('Inicia sesión para ver tus mensajes privados.');
  const u=cur();
  let inner='';
  if(tab==='videollamadas') inner=vcallsHTML();
  else if(tab==='bandeja'&&u.creator&&u.creator.status==='verificada') inner=inboxListHTML();
  else if(tab==='chat'&&u.creator&&param) inner=ownerChatHTML(param);
  else if(tab==='chat'&&param) inner=chatHTML(param);
  else inner=convListHTML();
  const isCreator=u.creator&&u.creator.status==='verificada';
  return '<div class="container"><div class="view-head"><span class="kicker">Privado</span><h1>Mensajes</h1><p>'+(isCreator?'Pago previo al abrir el chat con una creadora.':'Contacto con pago previo · 100% transparente.')+'</p></div>' +
    '<div class="tabs">'+(isCreator?'<button class="tab'+(tab==='bandeja'?' active':'')+'" onclick="location.hash=\'#/mensajes/bandeja\'">Bandeja (fans)</button>':'')+'<button class="tab'+(tab!=='videollamadas'&&tab!=='bandeja'&&tab!=='chat'?' active':'')+'" onclick="location.hash=\'#/mensajes/conversaciones\'">Conversaciones</button><button class="tab'+(tab==='videollamadas'?' active':'')+'" onclick="location.hash=\'#/mensajes/videollamadas\'">Webcam</button></div>'+inner+'</div>';
}
function convListHTML(){
  const items=P().convs.map(cv=>{ const cr=CR(cv.cref); if(!cr) return ''; const last=cv.msgs[cv.msgs.length-1]; const un=cv.unreadClient||0;
    return '<button class="conv-item" onclick="location.hash=\'#/mensajes/chat/'+encodeURIComponent(cr.ref)+'\'"><span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
    '<span class="conv-preview"><h5>'+esc(cr.name)+(un?' <span class="unread-mini">'+un+'</span>':'')+'</h5><p>'+esc((last.from==='me'?'Tú: ':'')+last.body)+'</p></span><span class="conv-time">'+last.t+'</span></button>'; }).join('');
  return items||'<div class="empty">Aún no tienes conversaciones.<br><a class="btn btn-gold btn-sm" href="#/galerias">Ver galerías y crear contacto</a></div>';
}
function openChatPaywall(ref){
  const cr=CR(ref); if(!cr) return;
  openModal('<h3>Contactar a '+esc(cr.name)+'</h3><p class="mdesc">El chat se abre con un <b>pago previo de '+fmt(LP.CHAT_OPEN_FEE)+'</b>. Incluye el primer mensaje; luego podrás seguir escribiendo libremente dentro de la conversación.</p>' +
    '<div class="pay-summary"><span>Pago previo para abrir chat</span><b>'+fmt(LP.CHAT_OPEN_FEE)+'</b></div>' +
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-gold" data-action="chat-pay" data-ref="'+ref+'">Pagar '+fmt(LP.CHAT_OPEN_FEE)+' y abrir chat</button></div>');
}
function chatPay(ref){
  const cr=CR(ref);
  if(!debit(LP.CHAT_OPEN_FEE,'Abrir chat · '+cr.name)) return;
  P().chatsPaid.push(ref);
  if(!P().convs.some(c=>c.cref===ref)) P().convs.unshift({ cref:ref, msgs:[{ id:uid2(), from:'them', body:(cr.online?'¡Hola! Soy '+cr.name.split(' ')[0]+', aquí estoy. Cuéntame qué te trae :)':'Estaré contigo pronto. Escríbeme con confianza.'), price:null, paid:false, t:'Hoy' }] });
  earnCredit(ref, LP.CHAT_OPEN_FEE);
  if(ref.startsWith('user:')) notify(ref.slice(5),'💬 Un fan pagó '+fmt(LP.CHAT_OPEN_FEE)+' para abrir chat contigo.');
  audit('CLIENTE','Abrió chat (pago previo) con '+cr.handle);
  saveDB(); closeModal(); route(); toast('Chat abierto ✓ · el pago se acredita a '+cr.name.split(' ')[0]+'.');
}
function chatHTML(ref){
  const cr=CR(ref); if(!cr) return '<div class="empty">Cuenta no disponible.</div>';
  const b=P();
  const paid=b.chatsPaid.includes(ref);
  if(!paid){
    openChatPaywall(ref);
    return '<div class="empty"><h3 style="margin-bottom:8px">Contacto con pago previo</h3><p>Debes pagar <b>'+fmt(LP.CHAT_OPEN_FEE)+'</b> para abrir el chat con '+esc(cr.name)+'.</p><button class="btn btn-gold" style="margin-top:12px" data-action="chat-pay-now" data-ref="'+ref+'">Pagar y abrir chat</button></div>';
  }
  let cv=b.convs.find(c=>c.cref===ref);
  if(!cv){ cv={cref:ref, msgs:[{id:uid2(),from:'them',body:'Hola, con gusto conversamos aquí.',price:null,paid:false,t:'Hoy'}]}; b.convs.unshift(cv); saveDB(); }
  if(cv.unreadClient){ cv.unreadClient=0; saveDB(); }
  const blocked=b.blocked.some(x=>x.ref===ref);
  const bubbles=cv.msgs.map(m=>{
    if(m.price&&!m.paid&&!b.unlockedMsgs.includes(m.id)){
      return '<div class="bubble ppv-b them"><b style="display:block;margin-bottom:7px">'+esc(m.body)+'</b><div class="mini-media blur" style="--a:'+cr.a+';--b:'+cr.b+'"><span class="ini" style="font-size:22px">'+cr.initials+'</span><span class="demo-tag">CONTENIDO SIMULADO</span></div>' +
        '<div class="unlock-row">'+IC.lock+'<span style="font-size:12px;color:var(--gold2)">Foto exclusiva</span><button class="btn btn-gold btn-sm" data-action="unlock-msg" data-mid="'+m.id+'" data-price="'+m.price+'" data-cref="'+ref+'">Desbloquear '+fmt(m.price)+'</button></div><span class="bt">'+m.t+'</span></div>';
    }
    return '<div class="bubble '+(m.from==='me'?'me':'them')+'">'+esc(m.body)+(m.price&&m.paid?'<span style="display:block;font-size:10px;opacity:.75;margin-top:5px">📷 Foto desbloqueada</span>':'')+'<span class="bt">'+m.t+'</span></div>';
  }).join('');
  return '<div class="chat-shell"><div class="chat-top"><button class="back-btn" onclick="location.hash=\'#/mensajes/conversaciones\'">←</button>' +
    '<span class="avatar sm" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
    '<div style="flex:1"><b style="font-size:14px">'+esc(cr.name)+'</b><div style="font-size:11px;color:'+(cr.online?'var(--green)':'var(--dim)')+'">'+(cr.online?'En línea':'Responde '+cr.resp)+'</div></div>' +
    '<button class="btn btn-violet btn-sm" data-action="vcall-open" data-ref="'+ref+'">'+IC.cam+' Webcam</button>' +
    '<button class="btn btn-danger btn-sm" data-action="report-open" data-target="'+esc(cr.handle)+'">'+IC.flag+'</button></div>' +
    '<div class="chat-area" id="chat-area">'+bubbles+'</div>' +
    (blocked?'<div class="chat-input" style="justify-content:center;color:var(--red);font-size:12.5px">Has bloqueado a esta cuenta.</div>':'<form class="chat-input" id="msg-form" data-cref="'+ref+'"><input id="msg-input" autocomplete="off" placeholder="Escribe…" maxlength="500"><button class="send-btn" type="submit">'+IC.send+'</button></form>')+'</div>';
}
function unlockMsg(mid,price,ref){
  if(!debit(price,'Mensaje premium · '+CR(ref).name)) return;
  P().unlockedMsgs.push(mid); earnCredit(ref,price);
  if(ref.startsWith('user:')) notify(ref.slice(5),'📩 Mensaje premium vendido · '+fmt(price));
  saveDB(); route(); toast('Foto desbloqueada.');
}
function sendMsg(form){
  const cref=form.dataset.cref;
  const cv=P().convs.find(c=>c.cref===cref);
  const inp=$('#msg-input'); const txt=(inp.value||'').trim();
  if(!cv||!txt) return;
  cv.msgs.push({id:uid2(),from:'me',body:txt,price:null,paid:false,t:'Hoy · '+new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})});
  cv.unreadCreator=(cv.unreadCreator||0)+1;
  saveDB(); inp.value=''; route();
  const area=$('#chat-area'); if(area) area.scrollTop=area.scrollHeight;
  if(cref.startsWith('user:')){
    const owner=S.users.find(u=>u.id===cref.slice(5));
    if(owner) notify(owner.id,'💬 Nuevo mensaje de '+cur().name+': "'+txt.slice(0,60)+'"');
  } else {
    setTimeout(()=>{ cv.msgs.push({id:uid2(),from:'them',body:'¡Gracias! Me alegra mucho que estés aquí 💛',price:null,paid:false,t:'Hoy'}); cv.unreadClient=(cv.unreadClient||0)+1; saveDB(); if(location.hash.indexOf('/mensajes/chat/'+encodeURIComponent(cref))>-1) route(); },1300);
  }
}

/* ---------- bandeja de creadora ---------- */
function inboxListHTML(){
  const myRef='user:'+cur().id; const items=[];
  S.users.forEach(o=>{ if(o.id===cur().id||!o.bag)return; const cv=o.bag.convs.find(c=>c.cref===myRef); if(!cv)return;
    const last=cv.msgs[cv.msgs.length-1]; const paid=o.bag.chatsPaid.includes(myRef);
    const un=cv.unreadCreator||0;
    items.push('<button class="conv-item" onclick="location.hash=\'#/mensajes/chat/'+encodeURIComponent(myRef)+'\'"><span class="avatar md" style="--a:#c084fc;--b:#f9a8d4">'+ini(o.name)+'</span>' +
      '<span class="conv-preview"><h5>'+esc(o.name)+(un?' <span class="unread-mini">'+un+'</span>':'')+'</h5><p>'+(paid?'💰 pagó '+fmt(LP.CHAT_OPEN_FEE):'sin pago previo')+' · '+esc(last.body)+'</p></span><span class="conv-time">'+last.t+'</span></button>');
  });
  return items.join('')||'<div class="empty">Aún ningún fan. Alguien debe pagar el chat previo para aparecer aquí.</div>';
}
function ownerChatHTML(clientId){
  const client=S.users.find(u=>u.id===clientId);
  if(!client||!client.bag) return '<div class="empty">Esta cuenta no existe.</div>';
  const myRef='user:'+cur().id;
  let cv=client.bag.convs.find(c=>c.cref===myRef);
  if(!cv) return '<div class="empty">Esta persona aún no te ha escrito.</div>';
  cv.unreadCreator=0; saveDB();
  const blocked=P().blocked.some(x=>x.ref==='user:'+clientId);
  const bubbles=cv.msgs.map(m=>{
    const isOwner=m.from==='them'; const cls=isOwner?'me':'them';
    if(m.price&&!m.paid){
      return '<div class="bubble ppv-b '+cls+'"><b style="display:block;margin-bottom:7px">'+esc(m.body)+'</b>' +
        '<div class="unlock-row">'+IC.lock+'<span style="font-size:12px;color:var(--gold2)">Foto premium · '+fmt(m.price)+'</span>' +
        (isOwner?'<span style="font-size:11px;color:var(--muted)">Pendiente de desbloqueo</span>':'<button class="btn btn-gold btn-sm" data-action="unlock-msg" data-mid="'+m.id+'" data-price="'+m.price+'" data-cref="'+myRef+'">Desbloquear '+fmt(m.price)+'</button>')+'</div><span class="bt">'+m.t+'</span></div>';
    }
    return '<div class="bubble '+cls+'">'+esc(m.body)+(m.price&&m.paid?'<span style="display:block;font-size:10px;opacity:.75;margin-top:5px">📷 Foto desbloqueada</span>':'')+'<span class="bt">'+m.t+'</span></div>';
  }).join('');
  return '<div class="chat-shell"><div class="chat-top"><button class="back-btn" onclick="location.hash=\'#/mensajes/bandeja\'">←</button>' +
    '<span class="avatar sm" style="--a:#c084fc;--b:#f9a8d4">'+ini(client.name)+'</span><div style="flex:1"><b style="font-size:14px">'+esc(client.name)+'</b>' +
    '<div style="font-size:11px;color:var(--dim)">Pidió contacto con pago previo ✓</div></div></div>' +
    '<div class="chat-area" id="chat-area">'+bubbles+'</div>' +
    (blocked?'<div class="chat-input" style="justify-content:center;color:var(--red);font-size:12.5px">Has bloqueado a esta cuenta.</div>'
      :'<form class="chat-input" id="msg-form-owner" data-clientid="'+clientId+'"><input id="msg-input" placeholder="Escribe…" maxlength="500"><button class="send-btn" type="submit">'+IC.send+'</button></form>'+
      '<div class="composer-tools"><label class="switch"><input type="checkbox" id="ppv-attach"><span class="slider-t"></span></label><span>Adjuntar foto premium ($)</span><input id="ppv-attach-price" type="number" min="1" max="50" step="0.5" value="3.99"></div>')+'</div>';
}
function sendOwnerMsg(form){
  const client=S.users.find(u=>u.id===form.dataset.clientid);
  const myRef='user:'+cur().id;
  const cv=client.bag.convs.find(c=>c.cref===myRef);
  const inp=$('#msg-input'); const txt=(inp.value||'').trim();
  if(!cv||!txt) return;
  const attach=$('#ppv-attach').checked; const price=attach?r2(Number($('#ppv-attach-price').value)||3.99):null;
  cv.msgs.push({id:uid2(),from:'them',body:txt,price:price,paid:false,t:'Hoy · '+new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})});
  cv.unreadClient=(cv.unreadClient||0)+1;
  notify(client.id,'💬 '+cur().creator.stageName+' te respondió'+(price?' · con foto premium ('+fmt(price)+')':'')+'.');
  saveDB(); inp.value=''; route();
  const area=$('#chat-area'); if(area) area.scrollTop=area.scrollHeight;
}

/* ---------- WEBCAM con permiso previo ---------- */
function vcallOpen(ref){
  const cr=CR(ref);
  openModal('<h3>Webcam con '+esc(cr.name)+'</h3><p class="mdesc">Pago <b>anticipado</b>. La chica debe <b>aceptar explícitamente</b> antes de iniciar. Si no acepta o no responde, reembolso automático del 100%.</p>' +
    '<div class="role-pick">'+LP.CAM_PLANS.map(pl=>'<div class="role-opt" data-action="vcall-pick" data-ref="'+ref+'" data-plan="'+pl.id+'"><span class="ri">📹</span><div><b>'+pl.label+' · '+fmt(pl.price)+'</b><small>Pago anticipado · con permiso previo de la chica</small></div></div>').join('')+'</div>');
}
function vcallPick(ref, planId){
  const pl=LP.CAM_PLANS.find(p=>p.id===planId); const cr=CR(ref);
  if(!debit(pl.price,'Webcam '+pl.minutes+' min · '+cr.name)) return;
  P().vcalls.unshift({id:uid('VC'),cref:ref,minutes:pl.minutes,price:pl.price,status:'pagada',date:'Hoy'});
  if(ref.startsWith('user:')) notify(ref.slice(5),'📹 Solicitud de webcam ('+pl.minutes+' min · '+fmt(pl.price)+') pagada. Acepta o rechaza.');
  audit('CLIENTE','Pagó webcam de '+pl.minutes+' min con '+cr.handle);
  saveDB(); closeModal(); paintChrome(); route(); toast('Solicitud enviada. Esperando que la chica la acepte.');
}
function vcallsHTML(){
  const b=P();
  if(!b.vcalls.length) return '<div class="empty">Sin solicitudes de webcam.</div>';
  return b.vcalls.map(v=>{ const cr=CR(v.cref); const stMap={pendiente:['pendiente','warn'],pagada:['pagada · esperando permiso de la chica','info'],aceptada:['aceptada','ok'],completada:['completada','dim'],rechazada:['rechazada · reembolsada','bad']}; const st=stMap[v.status]||['—','dim'];
    return '<div class="req-row"><span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span><div class="req-main"><h5>'+esc(cr.name)+'</h5><p>'+v.minutes+' min · '+fmt(v.price)+' · '+v.date+'</p></div><span class="st '+st[1]+'">'+st[0]+'</span>' +
      (v.status==='aceptada'?'<div class="req-actions"><button class="btn btn-violet btn-sm" data-action="cam-room">'+(v.room?'Reabrir sala':'Entrar a sala')+'</button></div>':'')+'</div>';
  }).join('');
}
function camRoom(){
  openModal('<h3>🖥 Sala de webcam</h3><p class="mdesc">Sala WebRTC simulada (pago anticipado y con permiso de la chica). En producción: WebRTC cifrado extremo a extremo.</p>' +
    '<div class="cam-stage"><div class="cam-tile them" style="--a:#c084fc;--b:#f9a8d4"><span class="ini">CH</span><span class="demo-tag">VIDEO DE LA CHICA</span></div>' +
    '<div class="cam-tile me" style="--a:#8b5cf6;--b:#d9b45c"><span class="ini">TU</span><span class="demo-tag">TU CÁMARA</span></div></div>' +
    '<div class="cam-controls"><button class="btn btn-ghost btn-sm" disabled>🎤 Mic</button><button class="btn btn-ghost btn-sm" disabled>📷 Cámara</button><button class="btn btn-danger btn-sm" data-action="modal-close">Terminar llamada</button></div>' +
    '<p style="font-size:11.5px;color:var(--dim);text-align:center;margin-top:10px">La llamada solo procede si la chica lo aceptó. Pago ya acreditado a la creadora.</p>');
}
function vcApprove(id, ok, ownerMode){
  /* creadora: aceptar/rechazar solicitudes entrantes */
  S.users.forEach(o=>{ if(o.bag) o.bag.vcalls.forEach(v=>{ if(v.id===id){
    v.status=ok?'aceptada':'rechazada';
    if(ok) notify(o.id,'📹 '+cur().creator.stageName+' ACEPTÓ tu webcam. Entra a la sala.');
    else { o.bag.wallet=r2(o.bag.wallet+v.price); o.bag.receipts.unshift({id:uid('RC'),date:'Hoy',desc:'Reembolso webcam',amount:v.price}); notify(o.id,'Tu solicitud de webcam fue rechazada · reembolsado '+fmt(v.price)); }
  } }); });
  audit('CREADORA',(ok?'Aceptó':'Rechazó')+' webcam '+id);
  saveDB(); route(); toast(ok?'Webcam aceptada. El fan puede entrar a la sala.':'Rechazada · cliente reembolsado.');
}

/* ================= suscripciones ================= */
function renderSuscripciones(){
  if(!cur()) return gateHTML('Inicia sesión para gestionar tus membresías y recibos.');
  const b=P();
  const cards=b.subs.map(s=>{ const cr=CR(s.cref); if(!cr)return '';
    return '<div class="sub-card"><span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span><div class="sub-info"><h4>'+esc(cr.name)+' '+IC.ver+'</h4><p>Plan '+(s.plan==='yearly'?'anual':'mensual')+' · '+fmt(s.price)+' · Inició '+s.started+'</p><p>Próxima renovación: <b style="color:var(--gold2)">'+s.renews+'</b> · Cancelas cuando quieras</p></div><a class="btn btn-ghost btn-sm" href="'+perfilHref(cr)+'">Perfil</a><button class="btn btn-danger btn-sm" data-action="cancel-sub" data-ref="'+cr.ref+'">Cancelar</button></div>'; }).join('');
  const rec='<h2 class="subhead">Recibos e historial</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Monto</th></tr></thead><tbody>'+b.receipts.map(r=>'<tr><td style="font-family:var(--mono);font-size:12px">'+r.id+'</td><td>'+r.date+'</td><td>'+esc(r.desc)+'</td><td class="'+(r.amount>=0?'money-in':'money-out')+'">'+fmt(r.amount)+'</td></tr>').join('')+'</tbody></table></div>';
  return '<div class="container"><div class="view-head"><span class="kicker">Mi cuenta</span><h1>Suscripciones</h1><p>Renovación visible · Cancelación inmediata</p></div>'+(cards||'<div class="empty">No tienes membresías activas.<br><a class="btn btn-gold btn-sm" href="#/galerias">Ver galerías</a></div>')+rec+'</div>';
}
function subOpen(ref, plan){
  const cr=CR(ref); const base=plan==='yearly'?cr.yearly:cr.monthly;
  MODCTX={type:'sub',ref:ref,plan:plan,base:base,coupon:null,total:null};
  openModal('<h3>Suscribirse a '+esc(cr.name)+'</h3><p class="mdesc">Desbloquea las galerías de "miembros" y mejora tu contacto. Plan '+(plan==='yearly'?'anual':'mensual')+'.</p>'+
    '<div class="pay-summary"><span>'+(plan==='yearly'?'Plan anual':'Plan mensual')+'</span><b>'+fmt(base)+'</b></div>'+
    '<div class="coupon-row"><input id="coupon-in" placeholder="Cupón (LUMINA10)"><button class="btn btn-ghost btn-sm" data-action="coupon-check">Aplicar</button></div><div id="coupon-out"></div>'+
    '<div class="pay-summary"><span>Total a pagar hoy</span><b id="pay-total">'+fmt(base)+'</b></div>'+
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-gold" data-action="sub-pay">Pagar ('+fmt(P().wallet)+')</button></div>');
}
function couponCheck(){
  const code=($('#coupon-in').value||'').trim().toUpperCase();
  if(LP.COUPONS[code]){ MODCTX.coupon=code; MODCTX.total=r2(MODCTX.base*(1-LP.COUPONS[code].pct/100)); $('#coupon-out').innerHTML='<div class="coupon-ok">✓ '+esc(LP.COUPONS[code].note)+' · '+fmt(MODCTX.total)+'</div>'; $('#pay-total').textContent=fmt(MODCTX.total); }
  else { MODCTX.coupon=null;MODCTX.total=null; $('#coupon-out').innerHTML='<div style="color:var(--red);font-size:11.5px;margin-top:6px">✕ Cupón no válido.</div>'; $('#pay-total').textContent=fmt(MODCTX.base); }
}
function subPay(){
  const cr=CR(MODCTX.ref); const total=MODCTX.total!=null?MODCTX.total:MODCTX.base;
  if(!debit(total,'Suscripción '+(MODCTX.plan==='yearly'?'anual':'mensual')+' · '+cr.name)) return;
  P().subs.push({cref:cr.ref,plan:MODCTX.plan,price:total,started:todayStr(),renews:plusDays(MODCTX.plan==='yearly'?365:30)});
  earnCredit(cr.ref,total);
  if(cr.ref.startsWith('user:')) notify(cr.ref.slice(5),'💰 Nueva suscripción de '+cur().name+' ('+MODCTX.plan+') · bruto '+fmt(total));
  audit('CLIENTE','Se suscribió a '+cr.handle);
  saveDB(); closeModal(); paintChrome(); route(); toast('¡Bienvenida/o al círculo privado de '+cr.name.split(' ')[0]+'!');
}
function cancelSub(ref){ const cr=CR(ref); MODCTX={type:'cancel',ref:ref}; openModal('<h3>Cancelar suscripción</h3><p class="mdesc">¿Cancelar tu membresía con <b>'+esc(cr.name)+'</b>? Sin penalidades.</p><div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Mantener</button><button class="btn btn-danger" data-action="cancel-confirm">Sí, cancelar</button></div>'); }
function cancelConfirm(){ P().subs=P().subs.filter(s=>s.cref!==MODCTX.ref); audit('CLIENTE','Canceló suscripción'); saveDB(); closeModal(); route(); toast('Suscripción cancelada.'); }

/* ================= tips / topup ================= */
function tipOpen(ref){ MODCTX={type:'tip',ref:ref}; const cr=CR(ref); openModal('<h3>Propina a '+esc(cr.name)+'</h3><p class="mdesc">El 80% va directo a la creadora.</p>'+(cr.online?'<div class="pay-summary"><span>Respondió en ~'+esc(cr.resp)+'</span></div>':'')+'<div class="role-pick">'+[5,10,25].map(v=>'<div class="role-opt" data-action="tip-send" data-amt="'+v+'"><span class="ri">💛</span><div><b>'+fmt(v)+'</b></div></div>').join('')+'</div><div class="coupon-row" style="margin-top:14px"><input id="tip-custom" type="number" min="1" placeholder="Monto"><button class="btn btn-ghost btn-sm" data-action="tip-send-custom">Enviar</button></div>'); }
function tipSend(amt){ amt=r2(Number(amt)); if(!(amt>0)){toast('Monto inválido.');return;} const cr=CR(MODCTX.ref); if(!debit(amt,'Propina · '+cr.name)) return; earnCredit(cr.ref,amt); if(cr.ref.startsWith('user:')) notify(cr.ref.slice(5),'💛 Propina de '+fmt(amt)+' de '+cur().name); audit('CLIENTE','Propina '+fmt(amt)); saveDB(); closeModal(); paintChrome(); route(); toast('Propina enviada 💛'); }
function topupOpen(){ openModal('<h3>Recargar saldo</h3><p class="mdesc">Demo: recarga instantánea. Producción: proveedor adult-friendly + 3-D Secure.</p><div class="role-pick">'+[10,25,50,100].map(v=>'<div class="role-opt" data-action="topup-amt" data-amt="'+v+'"><span class="ri">💳</span><div><b>'+fmt(v)+'</b></div></div>').join('')+'</div>'); }
function topupAmt(v){ credit(r2(Number(v)),'Recarga de saldo'); saveDB(); closeModal(); paintChrome(); route(); toast('Recargado +'+fmt(Number(v))); }

/* ================= autenticación ================= */
function authOpen(mode){ mode=mode||'login';
  const loginForm='<form id="login-form"><div class="fld" style="margin-bottom:10px"><label>Correo</label><input id="lg-email" type="email" required></div><div class="fld" style="margin-bottom:10px"><label>Contraseña</label><input id="lg-pass" type="password" required></div><div id="lg-error"></div><button class="btn btn-gold btn-block" type="submit">Entrar</button></form>'+
    '<div class="hint-box">Admin de prueba<br><code>admin@lumina.pe</code> · <code>admin123</code></div>';
  const regForm='<form id="reg-form"><div class="fld" style="margin-bottom:10px"><label>Nombre</label><input id="rg-name" required maxlength="40"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Correo</label><input id="rg-email" type="email" required></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Fecha de nacimiento (debes ser +18)</label><input id="rg-dob" type="date" required max="2010-12-31"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Contraseña (mín 8)</label><input id="rg-pass" type="password" required minlength="8"></div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Confirmar</label><input id="rg-pass2" type="password" required></div><div id="rg-error"></div>'+
    '<button class="btn btn-gold btn-block" type="submit">Crear cuenta</button>'+
    '<p class="demo-note" style="text-align:left;margin-top:10px">Confirmas ser +18 y aceptas los <a href="#/legal/terminos">Términos</a> y <a href="#/legal/privacidad">Privacidad</a>.</p></form>';
  const forms=mode==='login'?loginForm:regForm;
  openModal('<div class="auth-tabs"><button class="atab'+(mode==='login'?' active':'')+'" data-action="auth-tab" data-mode="login">Iniciar sesión</button><button class="atab'+(mode==='register'?' active':'')+'" data-action="auth-tab" data-mode="register">Crear cuenta</button></div><div id="auth-body">'+forms+'</div>');
}
function authTab(mode){ authOpen(mode); }
function formError(sel,msg){ $(sel).innerHTML='<div style="color:var(--red);font-size:12px;margin-bottom:8px">⚠ '+esc(msg)+'</div>'; }
async function doLogin(){
  const email=($('#lg-email').value||'').trim().toLowerCase(); const pass=$('#lg-pass').value||'';
  const u=S.users.find(x=>(x.email||'').toLowerCase()===email);
  if(!u){formError('#lg-error','No existe esa cuenta.');return;}
  if((await sha256(pass))!==u.passHash){formError('#lg-error','Contraseña incorrecta.');return;}
  if(u.status!=='activo'){formError('#lg-error','Cuenta suspendida.');return;}
  if(u.twoFA){ const code=String(Math.floor(100000+Math.random()*900000)); MODCTX={pendingUid:u.id,otp:code}; openModal('<h3>2FA · código</h3><p class="mdesc">Demo: tu código es <b style="color:var(--gold2);font-size:18px">'+code+'</b></p><form id="otp-form"><input id="otp-in" maxlength="6" placeholder="••••••" required><div id="otp-error"></div><button class="btn btn-gold btn-block" type="submit">Verificar</button></form>'); return; }
  loginAs(u.id); closeModal(); toast('Bienvenida/o, '+u.name.split(' ')[0]+'.');
}
async function doRegister(){
  const name=($('#rg-name').value||'').trim(); const email=($('#rg-email').value||'').trim().toLowerCase(); const dob=$('#rg-dob').value;
  const p1=$('#rg-pass').value||'',p2=$('#rg-pass2').value||'';
  if(!name){formError('#rg-error','Escribe tu nombre.');return;}
  if(S.users.some(u=>(u.email||'').toLowerCase()===email)){formError('#rg-error','Correo ya registrado.');return;}
  if(!dob){formError('#rg-error','Fecha de nacimiento.');return;}
  const yrs=(Date.now()-new Date(dob).getTime())/31557600000;
  if(!(yrs>=18)){formError('#rg-error','Debes tener +18.');return;}
  if(p1.length<8){formError('#rg-error','Mín 8 caracteres.');return;}
  if(p1!==p2){formError('#rg-error','No coinciden.');return;}
  const u={id:uid('U'),role:'cliente',name:name,email:email,passHash:await sha256(p1),dob:dob,status:'activo',createdAt:todayStr(),twoFA:false,bag:newBag(),creator:null};
  S.users.push(u); audit('SISTEMA','Registro: '+email); saveDB(); loginAs(u.id); closeModal(); toast('Cuenta creada ✓');
}

/* ================= aplicar como creadora ================= */
function applyOpen(){
  const u=cur();
  if(!u){ authOpen('register'); toast('Primero crea tu cuenta (1 min).'); return; }
  if(u.creator){ toast('Ya tienes perfil de creadora: '+u.creator.stageName); location.hash='#/creadora/panel'; return; }
  openModal('<h3>Solicitar perfil de creadora</h3><p class="mdesc">Tras la verificación (KYC) podrás subir tu galería (baño, íntima, personalizada) y cobrar por contacto.</p>'+
    '<form id="apply-form"><div class="fld" style="margin-bottom:10px"><label>Nombre artístico</label><input id="ap-name" required maxlength="30" placeholder="Tu nombre artístico"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Categoría</label><select id="ap-cat"><option>Lifestyle & Glamour</option><option>Fitness y bienestar</option><option>Arte y fotografía</option><option>Moda y pasarela</option><option>Viajes y aventura</option><option>Música y performance</option><option>Danza y movimiento</option><option>Otro</option></select></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Idiomas (Ctrl+clic)</label><select id="ap-langs" multiple size="3"><option selected>ES</option><option>EN</option><option>PT</option></select></div>'+
    '<div style="display:flex;gap:10px;margin-bottom:10px"><div class="fld"><label>Mensual USD</label><input id="ap-m" type="number" min="1" max="99" step="1" value="9.99"></div><div class="fld"><label>Anual USD</label><input id="ap-y" type="number" min="5" max="999" step="1" value="99.90"></div></div>'+
    '<div class="fld" style="margin-bottom:4px"><label>Tags (separadas por coma)</label><input id="ap-tags" placeholder="latina, glamour, editorial"></div>'+
    '<div class="form-row"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-gold">Enviar solicitud</button></div></form>');
}
function applySubmit(){
  const u=cur(); const name=($('#ap-name').value||'').trim();
  if(!name){toast('Elige tu nombre artístico.');return;}
  let slug=slugify(name);
  const taken=x=>x.slug===slug;
  while(LP.CREATORS.some(taken)||S.users.some(taken)) slug=slug+'-'+Math.floor(Math.random()*90+10);
  const langs=Array.from($('#ap-langs').selectedOptions).map(o=>o.value);
  u.creator={ slug:slug, stageName:name, cat:$('#ap-cat').value, langs:langs.length?langs:['ES'], monthly:r2(Number($('#ap-m').value)||9.99), yearly:r2(Number($('#ap-y').value)||99.90),
    bio:'Nuevo perfil verificado en Lúmina Privé.', tags:($('#ap-tags').value||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,4),
    a:'#8b5cf6', b:'#d9b45c', initials:ini(name), status:'pendiente', appliedAt:todayStr(), rating:0, fans:0, resp:'~1 h', online:false,
    earnings:{available:0,pending:0,total:0}, payouts:[], uploads:[] };
  audit('CREADORA','Solicitud: '+name+' (@'+slug+')'); saveDB(); closeModal(); route(); toast('Solicitud enviada. Un admin debe aprobar tu KYC.');
}

/* ================= panel creadora ================= */
function renderPanel(tab){
  const u=cur();
  if(!u) return gateHTML('Inicia sesión con tu cuenta.');
  if(!u.creator) return '<div class="container empty">'+(u.creator?'':'<h3>Aún no eres creadora</h3>')+'<p>Envía tu solicitud de verificación para abrir tu perfil, subir tu galería y cobrar por contacto.</p><div style="margin-top:10px"><button class="btn btn-gold" data-action="apply-open">Solicitar perfil de creadora</button></div></div>';
  tab=tab||'resumen';
  const c=u.creator;
  const stMap={pendiente:['KYC EN REVISIÓN','warn'],verificada:['CUENTA VERIFICADA','ok'],rechazada:['RECHAZADA','bad']};
  const st=stMap[c.status]||['—','dim'];
  let inner='';
  if(c.status!=='verificada') inner='<div class="callout">Tu perfil está <b>'+(c.status==='pendiente'?'en revisión administrativa':'rechazado')+'</b>.</div>'+(c.status!=='pendiente'?'<button class="btn btn-gold" data-action="apply-reopen">Volver a enviar</button>':'');
  else if(tab==='galeria') inner=panelGallery(u);
  else if(tab==='perfil') inner=panelProfile(u);
  else if(tab==='publicaciones') inner=panelPosts(u);
  else if(tab==='ingresos') inner=panelMoney(u);
  else if(tab==='solicitudes') inner=panelReq(u);
  else inner=panelHome(u);
  return '<div class="container"><div class="dash-hero"><div class="avatar xl" style="--a:'+c.a+';--b:'+c.b+';margin:0">'+c.initials+'</div>'+
    '<div style="flex:1"><h1>'+esc(c.stageName)+'</h1><div class="sub">@'+c.slug+' · '+esc(c.cat)+' · '+c.langs.join('/')+'</div></div><span class="st '+st[1]+'">'+st[0]+'</span></div>'+
    '<div class="icards"><div class="icard"><div class="lbl">Disponible</div><div class="val gold">'+fmt(c.earnings.available)+'</div></div><div class="icard"><div class="lbl">En retención</div><div class="val">'+fmt(c.earnings.pending)+'</div></div><div class="icard"><div class="lbl">Total</div><div class="val green">'+fmt(c.earnings.total)+'</div></div><div class="icard"><div class="lbl">Comisión</div><div class="val">20%</div></div></div>'+
    (c.status==='verificada'?'<div class="tabs">'+[['resumen','Resumen'],['galeria','Mi galería'],['perfil','Mi perfil'],['publicaciones','Publicaciones'],['ingresos','Ingresos'],['solicitudes','Solicitudes']].map(t=>'<button class="tab'+(tab===t[0]?' active':'')+'" onclick="location.hash=\'#/creadora/panel/'+t[0]+'\'">'+t[1]+'</button>').join('')+'</div>':'')+
    '<div class="panel-body">'+inner+'</div></div>';
}
function panelHome(u){
  const c=u.creator; const galCount=(c.uploads||[]).filter(x=>x.status==='aprobado').length;
  return '<div class="split-block"><h3>Distribución</h3><p style="font-size:12.5px;color:var(--muted);margin-top:4px">80% para ti · 20% plataforma.</p><div class="split-bar"><div class="seg-creator" style="width:80%"></div><div class="seg-platform" style="width:20%"></div></div></div>'+
  '<div class="safe-grid">'+
    '<div class="safe-card"><h3>👙 Tu galería</h3><p>Sube fotos por categoría (baño, íntima, personalizada) y ponles precio.</p><a class="btn btn-gold btn-sm" href="#/creadora/panel/galeria">Gestionar galería</a></div>'+
    '<div class="safe-card"><h3>💬 Cobra por contacto</h3><p>El chat se abre solo tras el pago previo de '+fmt(LP.CHAT_OPEN_FEE)+' y tú ganas el 80%.</p></div>'+
    '<div class="safe-card"><h3>📹 Webcam con tu permiso</h3><p>Tú decides aceptar o rechazar cada llamada.</p></div>'+
    (galCount?'<div class="safe-card"><h3>🔗 Tu perfil público</h3><a class="btn btn-ghost btn-sm" href="#/perfil/user:'+u.id+'">Ver mi perfil</a></div>':'')+
  '</div>';
}
/* subir foto a galería */
function panelGallery(u){
  const c=u.creator;
  const uploads=c.uploads||[];
  const rows=uploads.map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+esc((LP.GALLERY_CATS.find(x=>x.id===p.cat)||{}).label)+'</td><td>'+(LP.ACCESS[p.access]||{}).label+(p.price>0?' · '+fmt(p.price):'')+'</td><td><span class="st '+(p.status==='aprobado'?'ok':p.status==='retirado'?'bad':'warn')+'">'+p.status.toUpperCase()+'</span></td></tr>').join('');
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">'+
    '<p style="font-size:12.5px;color:var(--muted)">Cada foto pasa por moderación antes de publicarse.</p>'+
    '<button class="btn btn-gold" data-action="upload-open">+ Subir foto</button></div>'+
    (uploads.length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Foto</th><th>Galería</th><th>Acceso</th><th>Moderación</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Sube tu primera foto a tu galería.</div>');
}
function uploadOpen(){
  openModal('<h3>Subir foto a mi galería</h3><p class="mdesc">Elige la categoría y el acceso. Declaras que es material propio, todos +18 y con consentimiento.'+
    '</p><form id="upload-form">'+
    '<div class="fld" style="margin-bottom:10px"><label>Nombre de la foto</label><input id="up-title" required maxlength="60" placeholder="Ej. Bikini dorado"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Categoría de galería</label><select id="up-cat">'+LP.GALLERY_CATS.map(c=>'<option value="'+c.id+'">'+c.icon+' '+esc(c.label)+'</option>').join('')+'</select></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Tipo de acceso</label><select id="up-access"><option value="free">Gratis (preview público)</option><option value="sub" selected>Miembros (suscripción)</option><option value="ppv">Pago por ver (PPV)</option></select></div>'+
    '<div class="fld" style="margin-bottom:10px;display:none" id="up-price-wrap"><label>Precio USD (PPV)</label><input id="up-price" type="number" min="1" max="99" step="1" value="6.99"></div>'+
    '<div class="fld" style="margin-bottom:4px"><label>Archivo (simulado)</label><input disabled value="foto_'+Math.floor(Math.random()*900+100)+'.jpg · listo"></div>'+
    '<div class="form-row"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-gold">Enviar a revisión</button></div></form>');
}
function uploadSubmit(){
  const u=cur(); const title=$('#up-title').value.trim();
  if(!title){toast('Ponle nombre.');return;}
  const cat=$('#up-cat').value; const access=$('#up-access').value;
  const price=access==='ppv'?r2(Number($('#up-price').value)||6.99):0;
  const entry={id:uid('UP'),title:title,cat:cat,catLabel:(LP.GALLERY_CATS.find(x=>x.id===cat)||{}).label,access:access,price:price,status:'en revisión',date:'Hoy'};
  u.creator.uploads.unshift(entry);
  S.modQueue.unshift({id:entry.id,title:title,stageName:u.creator.stageName,cat:cat,date:'Hoy'});
  audit('CREADORA','Subió foto "'+title+'" a '+cat); saveDB(); closeModal(); route(); toast('Foto enviada a revisión.');
}
function panelProfile(u){
  const c=u.creator;
  const presets=[['#7c3aed','#d9b45c'],['#ec4899','#8b5cf6'],['#22d3ee','#a78bfa'],['#f59e0b','#fb7185'],['#34d399','#0ea5e9'],['#ef4444','#f59e0b']];
  const presetHTML=presets.map((p,i)=>'<label class="preset" style="--pg:linear-gradient(135deg,'+p[0]+','+p[1]+')"><input type="radio" name="cp" value="'+i+'"'+(c.a===p[0]?' checked':'')+'><span></span></label>').join('');
  const cats=['Lifestyle & Glamour','Fitness y bienestar','Arte y fotografía','Moda y pasarela','Viajes y aventura','Música y performance','Danza y movimiento','Otro'];
  return '<form id="profile-form"><div class="safe-card"><h3>Mi perfil artístico</h3><p style="font-size:12.5px;color:var(--muted);margin-bottom:18px">Slug <code>@'+c.slug+'</code> no cambiable.</p>'+
    '<div class="fld" style="margin-bottom:10px"><label>Nombre artístico</label><input id="pf-name" required maxlength="30" value="'+esc(c.stageName)+'"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Categoría</label><select id="pf-cat">'+cats.map(x=>'<option'+(c.cat===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Idiomas</label><select id="pf-langs" multiple size="3"><option value="ES"'+(c.langs.includes('ES')?' selected':'')+'>ES</option><option value="EN"'+(c.langs.includes('EN')?' selected':'')+'>EN</option><option value="PT"'+(c.langs.includes('PT')?' selected':'')+'>PT</option></select></div>'+
    '<div style="display:flex;gap:10px;margin-bottom:10px"><div class="fld"><label>Mensual USD</label><input id="pf-m" type="number" min="1" max="99" step="1" value="'+c.monthly+'"></div><div class="fld"><label>Anual USD</label><input id="pf-y" type="number" min="5" max="999" step="1" value="'+c.yearly+'"></div></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Biografía</label><textarea id="pf-bio" maxlength="240">'+esc(c.bio)+'</textarea></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Tags (coma)</label><input id="pf-tags" value="'+esc((c.tags||[]).join(', '))+'"></div>'+
    '<div class="fld" style="margin-bottom:10px"><label>Responder en</label><select id="pf-resp"><option'+(c.resp==='~10 min'?' selected':'')+'>~10 min</option><option'+(c.resp==='~30 min'?' selected':'')+'>~30 min</option><option'+(c.resp==='~1 h'?' selected':'')+'>~1 h</option><option'+(c.resp==='~2 h'?' selected':'')+'>~2 h</option></select></div>'+
    '<div class="fld" style="margin-bottom:12px"><label>Gradiente</label><div class="preset-grid">'+presetHTML+'</div></div>'+
    '<div class="fld" style="margin-bottom:14px"><label>Estado</label><div class="switch-wrap"><label class="switch"><input type="checkbox" id="pf-online"'+(c.online?' checked':'')+'><span class="slider-t"></span></label><span style="font-size:12px;color:var(--muted)">'+(c.online?'En línea':'Ausente')+'</span></div></div>'+
    '<button class="btn btn-gold btn-block" type="submit">Guardar cambios</button></div></form>';
}
function profileSave(){
  const u=cur(); const c=u.creator;
  const presets=[['#7c3aed','#d9b45c'],['#ec4899','#8b5cf6'],['#22d3ee','#a78bfa'],['#f59e0b','#fb7185'],['#34d399','#0ea5e9'],['#ef4444','#f59e0b']];
  const pi=Number(($('input[name="cp"]:checked')||{}).value);
  c.stageName=($('#pf-name').value||'').trim()||c.stageName; c.initials=ini(c.stageName); c.cat=$('#pf-cat').value;
  c.langs=Array.from($('#pf-langs').selectedOptions).map(o=>o.value); c.monthly=r2(Number($('#pf-m').value)||c.monthly); c.yearly=r2(Number($('#pf-y').value)||c.yearly);
  c.bio=($('#pf-bio').value||'').trim()||c.bio; c.tags=($('#pf-tags').value||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,4); c.resp=$('#pf-resp').value; c.online=$('#pf-online').checked;
  if(pi>=0&&presets[pi]){c.a=presets[pi][0];c.b=presets[pi][1];}
  audit('CREADORA','Actualizó perfil'); saveDB(); route(); toast('Perfil actualizado ✓');
}
function panelPosts(u){
  const c=u.creator; const rows=(c.uploads||[]).map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+esc((LP.GALLERY_CATS.find(x=>x.id===p.cat)||{}).label)+'</td><td>'+(LP.ACCESS[p.access]||{}).label+(p.price>0?' · '+fmt(p.price):'')+'</td><td><span class="st '+(p.status==='aprobado'?'ok':p.status==='retirado'?'bad':'warn')+'">'+p.status.toUpperCase()+'</span></td></tr>').join('');
  return (c.uploads||[]).length?'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Foto</th><th>Galería</th><th>Acceso</th><th>Estado</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Aún no subiste fotos.</div>';
}
function panelMoney(u){
  const c=u.creator;
  const rows=(c.payouts||[]).map(p=>'<tr><td style="font-family:var(--mono);font-size:12px">'+p.id+'</td><td>'+p.date+'</td><td class="money-in">'+fmt(p.amount)+'</td><td><span class="st '+(p.status==='pagado'?'ok':'warn')+'">'+p.status.toUpperCase()+'</span></td></tr>').join('');
  return '<div class="split-block" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h3>Retiro</h3><p style="font-size:12.5px;color:var(--muted)">Disponible: <b style="color:var(--gold2)">'+fmt(c.earnings.available)+'</b> · Mínimo $20 · 48–72h.</p></div><button class="btn btn-gold" data-action="payout-open">Solicitar retiro</button></div>'+(c.payouts||[]).length?'<h2 class="subhead">Historial</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'';
}
function payoutRequest(){ const c=cur().creator; if(c.earnings.available<20){toast('Mínimo $20.');return;} MODCTX={type:'payout',amt:c.earnings.available}; openModal('<h3>Solicitar retiro</h3><p class="mdesc">Transferimos <b>'+fmt(c.earnings.available)+'</b> a tu cuenta registrada.</p><div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-gold" data-action="payout-confirm">Confirmar retiro</button></div>'); }
function payoutConfirm(){ const c=cur().creator; const amt=MODCTX.amt; c.earnings.available=0; c.earnings.pending=r2(c.earnings.pending+amt); c.payouts.unshift({id:uid('PG'),date:'Hoy',amount:amt,status:'en proceso'}); audit('CREADORA','Retiro '+fmt(amt)); saveDB(); closeModal(); route(); toast('Retiro solicitado (48–72h).'); }
function panelReq(u){
  const incoming=[]; S.users.forEach(o=>{ if(o.bag) o.bag.vcalls.forEach(v=>{ if(v.cref==='user:'+u.id) incoming.push({...v,from:o.name,clientId:o.id}); }); });
  if(!incoming.length) return '<div class="empty">Sin solicitudes de webcam todavía.</div>';
  return incoming.map(v=>{ const st={pendiente:['sin pagar','dim'],pagada:['PAGADA · POR ACEPTAR/RECH','warn'],aceptada:['aceptada','ok'],completada:['completada','dim'],rechazada:['rechazada','bad']}[v.status]||['—','dim'];
    return '<div class="req-row"><span class="ri" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(217,180,92,.1);border:1px solid rgba(217,180,92,.3)">📹</span>'+
      '<div class="req-main"><h5>'+esc(v.from)+'</h5><p>'+v.minutes+' min · '+fmt(v.price)+' · '+v.date+'</p></div><span class="st '+st[1]+'">'+st[0]+'</span>'+
      (v.status==='pagada'?'<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="vc-accept" data-id="'+v.id+'">Aceptar</button><button class="btn btn-danger btn-sm" data-action="vc-decline" data-id="'+v.id+'">Rechazar</button></div>':'')+'</div>';
  }).join('');
}

/* ================= seguridad ================= */
function notifsMarkRead(){ const u=cur(); if(u) S.notifications.forEach(n=>{ if(n.to===u.id) n.read=true; }); saveDB(); closeModal(); paintBell(); }
function renderSeguridad(){
  const u=cur(); if(!u) return gateHTML('Inicia sesión para gestionar tu seguridad.');
  const b=P();
  const blockedRows=b.blocked.map(x=>'<div class="blocked-row"><span style="flex:1">'+esc(x.name)+'</span><button class="btn btn-ghost btn-sm" data-action="block-toggle" data-ref="'+x.ref+'" data-name="'+esc(x.name)+'">Desbloquear</button></div>').join('')||'<p style="font-size:12.5px;color:var(--dim)">No has bloqueado a nadie.</p>';
  const repRows=S.reports.filter(r=>r.byEmail===(u.email||'')).slice(0,6).map(r=>'<div class="audit-row"><span class="audit-time">'+r.date+'</span><span style="flex:1">'+esc(r.target)+' · '+esc(r.reason)+'</span><span class="st '+(r.status==='resuelta'?'ok':'warn')+'">'+r.status.toUpperCase()+'</span></div>').join('')||'<div class="audit-row"><span>No has enviado denuncias.</span></div>';
  const mine=u.creator?'<div class="safe-card danger-zone"><h3>🗑 Retirar consentimiento</h3><p>Retira TODO tu material publicado de la plataforma.</p><button class="btn btn-danger btn-block" data-action="withdraw-consent">Retirar todo mi contenido</button></div>':'';
  const tfa='<div class="safe-card"><h3>🔐 Autenticación en dos pasos (2FA)</h3><p class="mdesc">Protege tu cuenta con un código adicional al iniciar sesión.</p><div class="switch-wrap"><label class="switch"><input type="checkbox" id="tfa-toggle"'+(u.twoFA?' checked':'')+'><span class="slider-t"></span></label><span style="font-size:12px;color:var(--muted)">'+(u.twoFA?'2FA activado':'2FA desactivado')+'</span></div></div>';
  return '<div class="container"><div class="view-head"><span class="kicker">Seguridad</span><h1>Centro de seguridad</h1><p>Controla tu privacidad, bloqueos y consentimiento.</p></div>' +
    '<h2 class="subhead">Autenticación y privacidad</h2><div class="safe-grid">'+tfa+
    '<div class="safe-card"><h3>🛡 Sesión y dispositivo</h3><p class="mdesc">Un solo dispositivo por sesión. La contraseña se guarda con hash SHA-256 (demo).</p><button class="btn btn-ghost btn-sm" data-action="logout">Cerrar sesión en este dispositivo</button></div>'+
    '<div class="safe-card"><h3>🔒 Bloqueo de cuentas</h3><p class="mdesc">Las cuentas bloqueadas no pueden enviarte mensajes ni solicitarte webcam.</p></div>'+
    (u.creator?'<div class="safe-card"><h3>🧾 Retiro de ingreso</h3><p class="mdesc">Gestiona tus retiros desde tu panel de creadora.</p><a class="btn btn-ghost btn-sm" href="#/creadora/panel/ingresos">Ir a ingresos</a></div>':'')+
    '</div>' +
    '<h2 class="subhead">Usuarios bloqueados</h2><div class="card">'+blockedRows+'</div>' +
    '<h2 class="subhead">Mis denuncias</h2><div class="card">'+repRows+'</div>' +
    (mine?'<h2 class="subhead">Consentimiento</h2><div class="safe-grid">'+mine+'</div>':'') +
    '</div>';
}
function blockToggle(ref,name){
  const b=P();
  const i=b.blocked.findIndex(x=>x.ref===ref);
  if(i>-1){ b.blocked.splice(i,1); audit('CLIENTE','Desbloqueó a '+esc(name)); toast('Cuenta desbloqueada.'); }
  else { b.blocked.push({ref:ref,name:name}); audit('CLIENTE','Bloqueó a '+esc(name)); toast('Cuenta bloqueada.'); }
  saveDB(); route();
}
function withdrawConsent(){
  const u=cur();
  if(!u||!u.creator) return;
  openModal('<h3>Retirar consentimiento</h3><p class="mdesc">Esto retira <b>TODO</b> tu material publicado y cancela contactos abiertos. Esta acción es seria y queda registrada.</p>' +
    '<div class="pay-summary"><span>Contenido a retirar</span><b>'+(u.creator.uploads||[]).filter(x=>x.status==='aprobado').length+' foto(s)</b></div>' +
    '<div class="form-row"><button class="btn btn-ghost" data-action="modal-close">Cancelar</button><button class="btn btn-danger" data-action="withdraw-confirm">Sí, retirar todo mi contenido</button></div>');
}
function withdrawConfirm(){
  const u=cur();
  (u.creator.uploads||[]).forEach(p=>{ p.status='retirado'; });
  u.creator.online=false;
  audit('CREADORA','Retiró todo su contenido (consentimiento revocado)');
  saveDB(); closeModal(); route(); toast('Tu contenido fue retirado. Se notificó a moderación.');
}

/* ================= denuncias ================= */
function reportOpen(target){
  if(!cur()){ authOpen('login'); return; }
  openModal('<h3>Denunciar · '+esc(target)+'</h3><p class="mdesc">Informa una infracción. El equipo de moderación revisará en las próximas 24h.</p>' +
    '<form id="report-form"><div class="fld" style="margin-bottom:10px"><label>Motivo</label><select id="rep-reason" required>' +
      '<option value="">Elige un motivo…</option><option>Material no consentido (sin mi permiso)</option><option>Menor de edad / sospecha</option><option>Suplantación o identidad falsa</option><option>Contenido prohibido por las reglas</option><option>Spam o acoso</option><option>Otro</option></select></div>' +
    '<div class="fld" style="margin-bottom:4px"><label>Detalle (opcional)</label><textarea id="rep-detail" maxlength="500" placeholder="Cuéntanos qué pasó…"></textarea></div>' +
    '<div class="form-row"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button><button type="submit" class="btn btn-danger">Enviar denuncia</button></div></form>');
}
function submitReport(){
  const u=cur(); if(!u) return;
  const reason=($('#rep-reason').value||'').trim();
  if(!reason){ toast('Elige un motivo.'); return; }
  const detail=($('#rep-detail').value||'').trim();
  const target=(MODCTX.target||'');
  S.reports.unshift({ id:uid('RP'), target:target, reason:reason, detail:detail, byEmail:u.email||'', byName:u.name, date:'Hoy', status:'abierta' });
  audit('CLIENTE','Denunció a '+esc(target)+' ('+reason+')');
  saveDB(); closeModal(); route(); toast('Denuncia enviada ✓ Se revisará en 24h.');
}

/* ================= administración ================= */
function renderAdmin(tab){
  const u=cur();
  tab=tab||'kyc';
  if(!u||u.role!=='admin') return gateHTML('Solo el administrador puede acceder a esta zona.');
  const tabs=[['kyc','Verificaciones'],['mod','Moderación'],['pagos','Pagos'],['denuncias','Denuncias'],['audit','Auditoría']];
  let inner='';
  if(tab==='kyc') inner=adminKYC();
  else if(tab==='mod') inner=adminMod();
  else if(tab==='pagos') inner=adminPagos();
  else if(tab==='denuncias') inner=adminDenuncias();
  else if(tab==='audit') inner=adminAudit();
  return '<div class="container"><div class="view-head"><span class="kicker">Administración</span><h1>Panel de moderación</h1><p>Verificación, contenido y pagos.</p></div>' +
    '<div class="tabs">'+tabs.map(t=>'<a class="tab'+(tab===t[0]?' active':'')+'" href="#/admin/'+t[0]+'">'+t[1]+'</a>').join('')+'</div>' +
    '<div class="panel-body">'+inner+'</div></div>';
}
function pendingCreators(){ return S.users.filter(u=>u.creator&&u.creator.status==='pendiente'); }
function adminKYC(){
  const pend=pendingCreators();
  const rows=pend.map(u=>{ const c=u.creator;
    return '<div class="kyc-row"><span class="avatar md" style="--a:'+c.a+';--b:'+c.b+'">'+c.initials+'</span>' +
      '<div class="req-main"><h5>'+esc(c.stageName)+' <span class="st info">@'+esc(c.slug)+'</span></h5>' +
      '<p>'+esc(u.email)+' · '+esc(c.cat)+' · sol. '+esc(c.appliedAt)+'</p></div>' +
      '<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="kyc-approve" data-uid="'+u.id+'">Aprobar</button>' +
      '<button class="btn btn-danger btn-sm" data-action="kyc-reject" data-uid="'+u.id+'">Rechazar</button></div></div>';
  }).join('');
  return (pend.length? '<h2 class="subhead">Solicitudes pendientes ('+pend.length+')</h2><div class="card">'+rows+'</div>' : '<div class="empty">Sin solicitudes pendientes.</div>') +
    '<h2 class="subhead">Creadoras verificadas</h2><div class="card">'+S.users.filter(u=>u.creator&&u.creator.status==='verificada').map(u=>{ const c=u.creator; return '<div class="kyc-row"><span class="avatar md" style="--a:'+c.a+';--b:'+c.b+'">'+c.initials+'</span><div class="req-main"><h5>'+esc(c.stageName)+'</h5><p>@'+esc(c.slug)+' · '+fmt(c.earnings.total)+' ganado</p></div><span class="st ok">VERIFICADA</span></div>'; }).join('')||'<div class="empty">Aún no hay creadoras verificadas.</div>'+'</div>';
}
function kycAction(uid, ok){
  const u=S.users.find(x=>x.id===uid); if(!u||!u.creator) return;
  u.creator.status=ok?'verificada':'rechazada';
  notify(uid, ok?'✅ Tu perfil de creadora fue VERIFICADO. Ya puedes subir tu galería y cobrar por contacto.':'Tu solicitud de creadora fue rechazada. Puedes volver a enviarla con más información.');
  audit('ADMIN',(ok?'Aprobó KYC de @':'Rechazó KYC a @')+u.creator.slug);
  saveDB(); route(); toast(ok?'Creadora verificada ✓':'Solicitud rechazada.');
}
function adminMod(){
  const q=S.modQueue||[];
  const rows=q.map(m=>'<div class="kyc-row"><span class="ri" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(217,180,92,.1);border:1px solid rgba(217,180,92,.3)">🖼</span>' +
    '<div class="req-main"><h5>'+esc(m.title)+'</h5><p>'+esc(m.stageName)+' · '+esc((LP.GALLERY_CATS.find(x=>x.id===m.cat)||{}).label||m.cat)+' · '+m.date+'</p></div>' +
    '<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="mod-approve" data-id="'+m.id+'">Aprobar</button><button class="btn btn-danger btn-sm" data-action="mod-deny" data-id="'+m.id+'">Rechazar</button></div></div>').join('');
  return q.length? '<h2 class="subhead">Cola de moderación ('+q.length+')</h2><div class="card">'+rows+'</div>' : '<div class="empty">Cola de moderación vacía.</div>';
}
function modAction(id, ok){
  const i=(S.modQueue||[]).findIndex(m=>m.id===id);
  if(i>-1){ const m=S.modQueue[i]; S.modQueue.splice(i,1);
    S.users.forEach(u=>{ if(u.creator){ const p=u.creator.uploads.find(x=>x.id===id); if(p){ p.status=ok?'aprobado':'rechazado'; notify(u.id, ok?'🖼 Tu foto "'+esc(p.title)+'" fue aprobada y publicada.':'Tu foto "'+esc(p.title)+'" fue rechazada por no cumplir las reglas.'); } } });
    audit('ADMIN',(ok?'Aprobó foto ':'Rechazó foto ')+id);
  }
  saveDB(); route(); toast(ok?'Foto aprobada ✓':'Foto rechazada.');
}
function adminPagos(){
  const pend=[]; const total={done:0,open:0};
  S.users.forEach(u=>{ if(u.creator) (u.creator.payouts||[]).forEach(p=>{ pend.push({user:u,pay:p}); }); });
  const rows=pend.map(x=>{ const p=x.pay; const cr=x.user.creator;
    return '<div class="kyc-row"><span class="avatar md" style="--a:'+cr.a+';--b:'+cr.b+'">'+cr.initials+'</span>' +
      '<div class="req-main"><h5>'+esc(cr.stageName)+'</h5><p>'+p.id+' · '+p.date+' · '+p.status+'</p></div><b style="color:var(--gold2)">'+fmt(p.amount)+'</b>' +
      (p.status==='en proceso'?'<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="payout-mark" data-id="'+p.id+'" data-uid="'+x.user.id+'">Marcar pagado</button></div>':'')+'</div>';
  }).join('');
  return (pend.length? rows : '<div class="empty">Sin retiros que procesar.</div>');
}
function payoutMark(id, uid){
  const u=S.users.find(x=>x.id===uid); if(!u||!u.creator) return;
  const p=(u.creator.payouts||[]).find(x=>x.id===id); if(p) p.status='pagado';
  notify(uid,'💰 Tu retiro '+id+' fue enviado. Revisa tu cuenta.');
  audit('ADMIN','Marcó retiro '+id+' como pagado a @'+u.creator.slug);
  saveDB(); route(); toast('Retiro marcado como pagado.');
}
function adminDenuncias(){
  const rows=S.reports.map(r=>'<div class="kyc-row">' +
    '<div class="req-main"><h5>'+esc(r.target)+' · '+esc(r.reason)+'</h5><p>'+esc(r.byName)+' · '+r.date+' · '+esc(r.detail||'')+'</p></div>' +
    '<span class="st '+(r.status==='resuelta'?'ok':'warn')+'">'+r.status.toUpperCase()+'</span>' +
    (r.status==='abierta'?'<div class="req-actions"><button class="btn btn-ok btn-sm" data-action="report-resolve" data-id="'+r.id+'">Resolver</button></div>':'')+'</div>').join('');
  return (S.reports.length? rows : '<div class="empty">Sin denuncias registradas.</div>');
}
function reportResolve(id){
  const r=S.reports.find(x=>x.id===id); if(r) r.status='resuelta';
  audit('ADMIN','Resolvió denuncia '+id);
  saveDB(); route(); toast('Denuncia resuelta.');
}
function adminAudit(){
  const rows=S.audit.slice(0,40).map(a=>'<div class="audit-row"><span class="audit-time">'+a.t+'</span><span class="au-who">'+a.who+'</span><span style="flex:1">'+esc(a.act)+'</span></div>').join('');
  return '<h2 class="subhead">Registro de auditoría</h2><div class="tbl-wrap"><div class="card">'+(rows||'<div class="empty">Sin actividad aún.</div>')+'</div></div>';
}

/* ================= legal ================= */
function renderLegal(tab){
  tab=tab||'terminos';
  const nav=[['terminos','Términos'],['privacidad','Privacidad'],['consentimiento','Consentimiento'],['reglas','Reglas de contenido']];
  const content={
    terminos:'<h2>Términos del servicio</h2><p class="mdesc">Acceso exclusivo para personas mayores de 18 años (o la mayoría de edad legal en su jurisdicción).</p>'+
      '<p>Lúmina Privé es una plataforma de suscripción de contenido. Todo el contenido mostrado es ficticio y simulado para fines de demostración. Los pagos son anticipados y transparentes. Las suscripciones se renuevan automáticamente y se cancelan en un clic.</p>'+
      '<ul class="legal-list"><li>Prohibido el uso por menores de edad.</li><li>No se permite capturar ni redistribuir contenido.</li><li>La plataforma puede retirar cuentas que incumplan estas reglas.</li><li>Los precios están en USD y pueden incluir impuestos aplicables.</li></ul>',
    privacidad:'<h2>Política de privacidad · Ley 29733 (Perú)</h2><p class="mdesc">Protección de datos personales según la normativa peruana (DS 016-2024-JUS).</p>'+
      '<p>Recopilamos únicamente la información necesaria para la operación: correo, contraseña cifrada, edad y datos de pago mínimos. No vendemos datos a terceros. Tienes derecho de acceso, rectificación, cancelación y oposición (ARCO).</p>'+
      '<ul class="legal-list"><li>Los datos se cifran en tránsito y en reposo.</li><li>La edad se verifica al registrar; se aplican mínimos legales.</li><li>Puedes solicitar la eliminación de tu cuenta en cualquier momento.</li></ul>',
    consentimiento:'<h2>Política de consentimiento</h2><p class="mdesc">Todo el contenido publicado cuenta con consentimiento explícito del titular.</p>'+
      '<p>Las creadoras deben ser mayores de edad, verificar su identidad y declarar que el contenido es propio y con pleno conocimiento. Se rechaza cualquier material no consentido, deepfake o que muestre a menores de edad.</p>'+
      '<ul class="legal-list"><li>Vía "retirar consentimiento" la creadora puede borrar su contenido en cualquier momento.</li><li>Se notifica y resuelve cualquier denuncia en 24h.</li><li>Colaboramos con las autoridades ante cualquier infracción.</li></ul>',
    reglas:'<h2>Reglas de contenido</h2><p class="mdesc">Estándares de la comunidad para contenido seguro y legal.</p>'+
      '<ul class="legal-list"><li>Prohibido material que involucre menores (tolerancia cero, reportado a autoridades).</li><li>Prohibido contenido no consentido o deepfakes.</li><li>Prohibido actos ilegales, violencia o explotación.</li><li>Toda foto pasa por moderación manual antes de publicarse.</li></ul>'
  };
  return '<div class="container legal"><div class="view-head"><span class="kicker">Legal</span><h1>Documentos legales</h1></div>' +
    '<div class="tabs">'+nav.map(n=>'<a class="tab'+(tab===n[0]?' active':'')+'" href="#/legal/'+n[0]+'">'+n[1]+'</a>').join('')+'</div>' +
    '<div class="legal-body">'+(content[tab]||content.terminos)+'<p class="demo-note" style="margin-top:24px">Borradores para la demo. En producción debe revisarse con asesoría legal según la jurisdicción de operación.</p></div></div>';
}

/* ================= manejadores ================= */
function bindTopbar(){
  const bell=document.getElementById('bellBtn'), wallet=document.getElementById('walletChip'), auth=document.getElementById('btnAuth');
  if(bell) bell.addEventListener('click',()=>{ if(cur()) openNotifs(); });
  if(wallet) wallet.addEventListener('click',()=>{ if(cur()) topupOpen(); });
  if(auth) auth.addEventListener('click',()=>{ cur()?logout():authOpen('login'); });
}
function init(){
  loadDB();
  ensureSeed().then(()=>{
    bindTopbar();
    const gate=document.getElementById('ageGate');
    const appEl=document.getElementById('app');
    const topbar=document.getElementById('topbar');
    const footer=document.getElementById('footer');
    const chk=document.getElementById('ageChk');
    const btn=document.getElementById('btnEnter18');
    if(localStorage.getItem('lumina_age18')==='1'){ showApp(); }
    else{ gate.classList.remove('hidden'); topbar.classList.add('hidden'); appEl.classList.add('hidden'); footer.classList.add('hidden'); }
    btn.disabled=!chk.checked;
    chk.addEventListener('change',()=>{ btn.disabled=!chk.checked; });
    btn.addEventListener('click',()=>{ if(chk.checked){ localStorage.setItem('lumina_age18','1'); showApp(); } });
    paintChrome();
  });
}
function showApp(){
  $('#ageGate').classList.add('hidden');
  $('#topbar').classList.remove('hidden');
  $('#app').classList.remove('hidden');
  $('#footer').classList.remove('hidden');
  route();
}
document.addEventListener('DOMContentLoaded', init);
document.addEventListener('click', function(e){
  const el=e.target.closest('[data-action]');
  if(!el) return;
  const a=el.dataset.action;
  switch(a){
    case 'modal-close': closeModal(); break;
    case 'auth-open': authOpen('login'); break;
    case 'auth-tab': authTab(el.dataset.mode); break;
    case 'logout': logout(); break;
    case 'notifs-read': notifsMarkRead(); break;
    case 'topup-open': topupOpen(); break;
    case 'apply-open': applyOpen(); break;
    case 'apply-reopen': MODCTX={}; applyOpen(); break;
    case 'block-toggle': blockToggle(el.dataset.ref, el.dataset.name||''); break;
    case 'withdraw-consent': withdrawConsent(); break;
    case 'withdraw-confirm': withdrawConfirm(); break;
    case 'report-open': MODCTX.target=el.dataset.target||''; reportOpen(el.dataset.target||''); break;
    case 'report-resolve': reportResolve(el.dataset.id); break;
    case 'submit-report': submitReport(); break;
    case 'vcall-open': vcallOpen(el.dataset.ref); break;
    case 'tip-open': tipOpen(el.dataset.ref); break;
    case 'tip-send': tipSend(el.dataset.amt); break;
    case 'tip-send-custom': tipSend(($('#tip-custom')||{}).value||0); break;
    case 'topup-amt': topupAmt(el.dataset.amt); break;
    case 'sub-open': subOpen(el.dataset.ref, el.dataset.plan); break;
    case 'sub-pay': subPay(); break;
    case 'coupon-check': couponCheck(); break;
    case 'cancel-sub': cancelSub(el.dataset.ref); break;
    case 'cancel-confirm': cancelConfirm(); break;
    case 'unlock-gal': unlockGallery(el.dataset.ref, el.dataset.cat, el.dataset.ac, Number(el.dataset.price)||0); break;
    case 'view-photo': viewPhoto(el); break;
    case 'chat-pay': MODCTX={type:'chat',ref:el.dataset.ref}; chatPay(el.dataset.ref); break;
    case 'chat-pay-now': MODCTX={type:'chat',ref:el.dataset.ref}; chatPay(el.dataset.ref); break;
    case 'unlock-msg': unlockMsg(el.dataset.mid, Number(el.dataset.price)||0, el.dataset.cref); break;
    case 'vcall-pick': vcallPick(el.dataset.ref, el.dataset.plan); break;
    case 'cam-room': camRoom(); break;
    case 'vc-accept': vcApprove(el.dataset.id, true, true); break;
    case 'vc-decline': vcApprove(el.dataset.id, false, true); break;
    case 'upload-open': uploadOpen(); break;
    case 'payout-open': payoutRequest(); break;
    case 'payout-confirm': payoutConfirm(); break;
    case 'payout-mark': payoutMark(el.dataset.id, el.dataset.uid); break;
    case 'kyc-approve': kycAction(el.dataset.uid, true); break;
    case 'kyc-reject': kycAction(el.dataset.uid, false); break;
    case 'mod-approve': modAction(el.dataset.id, true); break;
    case 'mod-deny': modAction(el.dataset.id, false); break;
    default: break;
  }
});
document.addEventListener('submit', function(e){
  const f=e.target;
  if(f.id==='login-form'){ e.preventDefault(); doLogin(); return; }
  if(f.id==='reg-form'){ e.preventDefault(); doRegister(); return; }
  if(f.id==='otp-form'){ e.preventDefault(); const cod=$('#otp-in').value||''; if(cod===String(MODCTX.otp)){ loginAs(MODCTX.pendingUid); closeModal(); toast('Sesión iniciada ✓'); } else { formError('#otp-error','Código incorrecto.'); } return; }
  if(f.id==='apply-form'){ e.preventDefault(); applySubmit(); return; }
  if(f.id==='upload-form'){ e.preventDefault(); uploadSubmit(); return; }
  if(f.id==='profile-form'){ e.preventDefault(); profileSave(); return; }
  if(f.id==='report-form'){ e.preventDefault(); submitReport(); return; }
  if(f.id==='msg-form'){ e.preventDefault(); sendMsg(f); return; }
  if(f.id==='msg-form-owner'){ e.preventDefault(); sendOwnerMsg(f); return; }
});
document.addEventListener('input', function(e){
  const t=e.target;
  if(t.id==='up-access'){ const ppv=(t.value==='ppv'); $('#up-price-wrap').style.display=ppv?'':'none'; }
  if(t.id==='tfa-toggle'){ const u=cur(); if(u){ u.twoFA=t.checked; audit('CLIENTE',t.checked?'Activó 2FA':'Desactivó 2FA'); saveDB(); } }
  if(t.id==='f-q'||t.id==='f-lang'||t.id==='f-cat'||t.id==='f-sort'||t.id==='f-online'){ applyFilters(); }
});
document.addEventListener('change', function(e){
  if(e.target.id==='f-lang') applyFilters();
});
