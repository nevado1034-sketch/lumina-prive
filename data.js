/* =========================================================
   Lúmina Privé · data.js
   Datos ficticios (demo) que espejan las entidades de BD.
   En producción esto vive en PostgreSQL (ver schema.sql).
   ========================================================= */
window.LP = {};

/* ---------- CREADORAS (tabla: creator_profiles + users) ---------- */
LP.CREATORS = [
  { id:'c1', slug:'sofia-luna',    name:'Sofia Luna',    handle:'@sofialuna',    initials:'SL', a:'#7c3aed', b:'#d9b45c', langs:['ES','EN'],       cat:'Lifestyle & Glamour',     resp:'~10 min', online:true,  rating:4.9, fans:1240, media:86,  monthly:9.99,  yearly:99.90,
    bio:'Bienvenida/o a mi rincón dorado. Sesiones editoriales semanales, detrás de cámaras y chats privados. Identidad verificada por Lúmina.' },
  { id:'c2', slug:'valeria-cruz',  name:'Valeria Cruz',  handle:'@valeriacruz',  initials:'VC', a:'#0ea5e9', b:'#34d399', langs:['ES'],            cat:'Fitness y bienestar',     resp:'~25 min', online:false, rating:4.8, fans:860,  media:54,  monthly:14.99, yearly:149.90,
    bio:'Entrenadora certificada. Rutinas, movilidad y hábitos reales. Contenido fitness para mayores de 18, siempre profesional.' },
  { id:'c3', slug:'mia-torres',    name:'Mia Torres',    handle:'@miatorres',    initials:'MT', a:'#ec4899', b:'#8b5cf6', langs:['ES','EN','PT'],  cat:'Arte y fotografía',       resp:'~15 min', online:true,  rating:5.0, fans:2100, media:120, monthly:7.99,  yearly:79.90,
    bio:'Fotógrafa y modelo frente a la cámara. Series editoriales, analógico y procesos creativos completos para mis miembros.' },
  { id:'c4', slug:'camila-rios',   name:'Camila Ríos',   handle:'@camilarios',   initials:'CR', a:'#f59e0b', b:'#fb7185', langs:['ES'],            cat:'Moda y pasarela',         resp:'~40 min', online:false, rating:4.7, fans:640,  media:38,  monthly:19.99, yearly:199.90,
    bio:'Del casting a la pasarela: backstage real de la industria de la moda. Acceso íntimo a mi día a día profesional.' },
  { id:'c5', slug:'nicole-vega',   name:'Nicole Vega',   handle:'@nicolevega',   initials:'NV', a:'#22d3ee', b:'#a78bfa', langs:['ES','EN'],       cat:'Viajes y aventura',       resp:'~20 min', online:true,  rating:4.9, fans:1780, media:97,  monthly:4.99,  yearly:49.90,
    bio:'De gira constante. Postales, diarios de ruta y guías secretas de cada ciudad. Promo de lanzamiento activa.' },
  { id:'c6', slug:'daniela-fox',   name:'Daniela Fox',   handle:'@danielafox',   initials:'DF', a:'#ef4444', b:'#f59e0b', langs:['EN'],            cat:'Música y performance',    resp:'~30 min', online:false, rating:4.8, fans:930,  media:71,  monthly:24.99, yearly:249.90,
    bio:'Cantante y performer. Ensayos, making-of de videoclips y sesiones acústicas exclusivas para miembros.' },
  { id:'c7', slug:'aria-mendoza',  name:'Aria Mendoza',  handle:'@ariamendoza',  initials:'AM', a:'#8b5cf6', b:'#22d3ee', langs:['ES'],            cat:'Danza y movimiento',      resp:'~12 min', online:true,  rating:4.9, fans:1520, media:64,  monthly:12.99, yearly:129.90,
    bio:'Bailarina profesional. Coreografías paso a paso, entrenamiento en barra y la vida entre bastidores del escenario.' },
  /* Pendiente de verificación: SOLO visible para admin hasta aprobar KYC */
  { id:'c8', slug:'bella-herrera', name:'Bella Herrera', handle:'@bellaherrera', initials:'BH', a:'#94a3b8', b:'#cbd5e1', langs:['ES'],            cat:'Cocina y lifestyle',      resp:'—',       online:false, rating:0,   fans:0,    media:0,   monthly:6.99,  yearly:69.90,
    bio:'Perfil en verificación de identidad (KYC). No visible públicamente hasta su aprobación.', pending:true }
];

/* ---------- PUBLICACIONES (tabla: posts) ---------- */
LP.POSTS = [
  { id:'p1',  cr:'c1', title:'Bienvenida a mi Lúmina · Set dorado',        type:'free', price:null,  date:'2026-08-18' },
  { id:'p2',  cr:'c1', title:'Sesión exclusiva semanal #12',               type:'sub',  price:null,  date:'2026-08-20' },
  { id:'p3',  cr:'c1', title:'Editorial completo · 18 fotos',              type:'ppv',  price:6.99,  date:'2026-08-22' },
  { id:'p4',  cr:'c1', title:'Detrás de cámaras del último rodaje',        type:'sub',  price:null,  date:'2026-08-23' },
  { id:'p5',  cr:'c2', title:'Mi rutina de activación matutina',           type:'free', price:null,  date:'2026-08-16' },
  { id:'p6',  cr:'c2', title:'Rutina completa de movilidad (25 min)',      type:'sub',  price:null,  date:'2026-08-19' },
  { id:'p7',  cr:'c2', title:'Plan de entrenamiento mensual descargable',  type:'ppv',  price:9.99,  date:'2026-08-21' },
  { id:'p8',  cr:'c3', title:'Nueva serie: luz y sombra',                  type:'free', price:null,  date:'2026-08-15' },
  { id:'p9',  cr:'c3', title:'Galería analógica · Rollo 07',               type:'sub',  price:null,  date:'2026-08-20' },
  { id:'p10', cr:'c3', title:'Colección editorial premium (24 fotos)',     type:'ppv',  price:12.99, date:'2026-08-23' },
  { id:'p11', cr:'c4', title:'Casting y probadores · Día 1',               type:'free', price:null,  date:'2026-08-14' },
  { id:'p12', cr:'c4', title:'Backstage de pasarela (acceso miembros)',    type:'sub',  price:null,  date:'2026-08-21' },
  { id:'p13', cr:'c5', title:'Postales del viaje · Lima al amanecer',      type:'free', price:null,  date:'2026-08-17' },
  { id:'p14', cr:'c5', title:'Diario de ruta · Capítulo 3',                type:'sub',  price:null,  date:'2026-08-20' },
  { id:'p15', cr:'c5', title:'Guía secreta de la ciudad (PDF)',            type:'ppv',  price:4.99,  date:'2026-08-22' },
  { id:'p16', cr:'c6', title:'Ensayo acústico · Sesión privada',           type:'free', price:null,  date:'2026-08-13' },
  { id:'p17', cr:'c6', title:'Making-of del videoclip',                    type:'sub',  price:null,  date:'2026-08-19' },
  { id:'p18', cr:'c7', title:'Calentamiento antes de clase',               type:'free', price:null,  date:'2026-08-16' },
  { id:'p19', cr:'c7', title:'Coreografía paso a paso · Nivel intermedio', type:'sub',  price:null,  date:'2026-08-21' }
];

/* ---------- PLANES DE VIDEOLLAMADA ---------- */
LP.VCALL_PLANS = [
  { id:'v15', mins:15, price:29.99 },
  { id:'v30', mins:30, price:49.99 }
];

/* ---------- CUPONES ---------- */
LP.COUPONS = {
  'LUMINA10': { pct:10, note:'10% de descuento · campaña de lanzamiento' }
};

/* ---------- CONVERSACIONES SEMILLA (tablas: conversations + messages) ---------- */
LP.SEED_CONVS = [
  {
    id:'cv1', creatorId:'c1',
    msgs:[
      { id:'m1', from:'them', body:'¡Hola! Bienvenida/o a mi espacio privado de Lúmina. Gracias por apoyar mi trabajo desde el primer día.', price:null, paid:false, t:'Ayer · 10:12' },
      { id:'m2', from:'me',   body:'¡Hola Sofia! Me encanta lo que publicas, el set dorado fue espectacular.', price:null, paid:false, t:'Ayer · 10:31' },
      { id:'m3', from:'them', body:'Te dejé algo especial: el set exclusivo del estudio que solo comparto por mensaje directo.', price:4.99, paid:false, t:'Hoy · 09:05' }
    ]
  },
  {
    id:'cv2', creatorId:'c3',
    msgs:[
      { id:'m4', from:'them', body:'Gracias por suscribirte a mi galería. Cada viernes subo un rollo nuevo del analógico.', price:null, paid:false, t:'Lun · 18:40' },
      { id:'m5', from:'me',   body:'La serie de luz y sombra es una obra de arte, en serio.', price:null, paid:false, t:'Lun · 19:02' },
      { id:'m6', from:'them', body:'Se agradece tanto. El próximo rollo es a color, te va a encantar.', price:null, paid:false, t:'Mar · 11:15' }
    ]
  }
];

/* ---------- ESTADO INICIAL (localStorage: lumina_state_v1) ----------
   Espeja: subscriptions, posts desbloqueados, messages pagados,
   transacciones/recibos, videollamadas, reports, moderación y auditoría. */
LP.defaultState = function () {
  return {
    wallet: 50.00,
    ledger: [
      { d:'Recarga inicial (demo)', amt:+50.00, bal:50.00, t:'Hoy · 09:00' }
    ],
    receipts: [
      { id:'RC-1001', date:'Hoy · 09:00', desc:'Recarga de saldo', amount:50.00 }
    ],
    subs: [],
    unlockedPosts: [],
    unlockedMsgs: [],
    convs: JSON.parse(JSON.stringify(LP.SEED_CONVS)),
    vcalls: [
      { id:'vc1', creatorId:'c1', plan:'v15', mins:15, price:29.99, status:'pendiente', date:'Hoy · 08:55' }
    ],
    blocked: [],
    reports: [
      { id:'rp1', target:'@cuenta_sospechosa', reason:'Suplantación de identidad', status:'revisando', by:'Cliente demo', date:'2026-08-22' }
    ],
    /* lado creadora (Sofia Luna, sesión demo) */
    earnings: { available:486.20, pending:96.40, total:2140.75 },
    myUploads: [],
    payouts: [
      { id:'PG-9012', date:'2026-08-23', amount:486.20, status:'en proceso', ref:'PROVIDER-77214' },
      { id:'PG-8841', date:'2026-08-01', amount:1240.50, status:'pagado', ref:'PROVIDER-75001' }
    ],
    /* lado admin */
    kycQueue: [
      { id:'k1', creatorId:'c8', name:'Bella Herrera', handle:'@bellaherrera', docs:'INE + selfie (simulado)', date:'2026-08-21 · 14:32' }
    ],
    modQueue: [],
    audit: [
      { who:'SISTEMA', act:'Estado demo inicializado · datos ficticios cargados', t:'Hoy · 09:00' },
      { who:'ADMIN',   act:'Payout PG-8841 marcado como pagado ($1,240.50)', t:'2026-08-01 · 12:00' }
    ]
  };
};
