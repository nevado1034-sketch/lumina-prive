/* =========================================================
   Lúmina Privé · data.js
   Datos ficticios (demo) que espejan las entidades de BD.
   Modelo: galerías por categoría + acceso (free/sub/ppv).
   En producción esto vive en PostgreSQL (ver schema.sql).
   ========================================================= */
window.LP = {};

/* Categorías de galería disponibles */
LP.GALLERY_CATS = [
  { id:'trajeBano',  label:'Ropa de baño',  icon:'👙' },
  { id:'intimo',     label:'Ropa interior', icon:'🩲' },
  { id:'personalizado', label:'Personalizado / a tu gusto', icon:'✨' },
  { id:'lifestyle',  label:'Lifestyle & diario', icon:'☀️' }
];

/* Tipos de acceso por galería/foto */
LP.ACCESS = {
  free:  { label:'Gratis',   cls:'free' },
  sub:   { label:'Miembros', cls:'sub' },
  ppv:   { label:'Pago por ver', cls:'ppv' }
};

/* ---------- CREADORAS VERIFICADAS (catálogo público) ---------- */
LP.CREATORS = [
  { id:'c1', slug:'sofia-luna', name:'Sofia Luna', handle:'@sofialuna', initials:'SL', a:'#7c3aed', b:'#d9b45c',
    langs:['ES','EN'], cat:'Lifestyle & Glamour', resp:'~10 min', online:true, rating:4.9, fans:1240, media:86,
    monthly:9.99, yearly:99.90,
    bio:'Giras doradas, sesiones editoriales y un círculo privado muy especial. Bienvenida/o a mi rincón.',
    tags:['Glamour','Editorial','Latina'],
    galleries:[
      { cat:'lifestyle', label:'Mi día a día',  access:'free', photos:[ {t:'Detrás de cámaras', p:0}, {t:'Bienvenida', p:0} ] },
      { cat:'trajeBano', label:'Costa dorada',  access:'sub',  photos:[ {t:'Amanecer en la playa', p:0}, {t:'Bikini blanco', p:6.99}, {t:'Marea baja', p:0} ] },
      { cat:'intimo',    label:'La suite',      access:'ppv',  photos:[ {t:'Editorial íntima 01', p:9.99}, {t:'Editorial íntima 02', p:9.99} ] },
      { cat:'personalizado', label:'Tu petición', access:'ppv', photos:[ {t:'Personalizado #1', p:15.99} ] }
    ] },
  { id:'c2', slug:'valeria-cruz', name:'Valeria Cruz', handle:'@valeriacruz', initials:'VC', a:'#0ea5e9', b:'#34d399',
    langs:['ES'], cat:'Fitness y bienestar', resp:'~25 min', online:false, rating:4.8, fans:860, media:54,
    monthly:14.99, yearly:149.90,
    bio:'Entrenadora certificada. Rutinas, movilidad y un cuerpo trabajado con dedicación. Siempre profesional.',
    tags:['Fitness','Deportiva','Consejos'],
    galleries:[
      { cat:'lifestyle', label:'Mi entrenamiento', access:'free', photos:[ {t:'Calentamiento', p:0}, {t:'Rutina semanal', p:0} ] },
      { cat:'trajeBano', label:'Playa & piscina',  access:'sub',  photos:[ {t:'Entrenamiento en arena', p:0}, {t:'Recuperación', p:5.99} ] },
      { cat:'intimo',    label:'Post-workout',     access:'ppv',  photos:[ {t:'Después del gym', p:12.99} ] }
    ] },
  { id:'c3', slug:'mia-torres', name:'Mia Torres', handle:'@miatorres', initials:'MT', a:'#ec4899', b:'#8b5cf6',
    langs:['ES','EN','PT'], cat:'Arte y fotografía', resp:'~15 min', online:true, rating:5.0, fans:2100, media:120,
    monthly:7.99, yearly:79.90,
    bio:'Fotógrafa y modelo. Luz, color y mucha actitud. Series editoriales que cuentan historias.',
    tags:['Artista','Editorial','Altamente creativa'],
    galleries:[
      { cat:'lifestyle', label:'Mi proceso', access:'free', photos:[ {t:'Detrás de la cámara', p:0} ] },
      { cat:'trajeBano', label:'Luz y sal',  access:'sub',  photos:[ {t:'Serie playa', p:0}, {t:'Blanco y negro', p:4.99} ] },
      { cat:'intimo',    label:'La galería', access:'ppv',  photos:[ {t:'Estudio 01', p:11.99}, {t:'Estudio 02', p:11.99}, {t:'Estudio 03', p:11.99} ] },
      { cat:'personalizado', label:'A medida', access:'ppv', photos:[ {t:'Personal', p:18.99} ] }
    ] },
  { id:'c4', slug:'camila-rios', name:'Camila Ríos', handle:'@camilarios', initials:'CR', a:'#f59e0b', b:'#fb7185',
    langs:['ES'], cat:'Moda y pasarela', resp:'~40 min', online:false, rating:4.7, fans:640, media:38,
    monthly:19.99, yearly:199.90,
    bio:'Del casting a la pasarela. Backstage real y una figura esculpida para la moda.',
    tags:['Modelo','Pasarela','Alta moda'],
    galleries:[
      { cat:'lifestyle', label:'Casting', access:'free', photos:[ {t:'Probadores', p:0} ] },
      { cat:'trajeBano', label:'Shoot playa', access:'sub', photos:[ {t:'Pasarela playa', p:0}, {t:'Editorial moda', p:7.99} ] },
      { cat:'intimo',    label:'Backstage', access:'ppv', photos:[ {t:'Closet privado', p:13.99} ] }
    ] },
  { id:'c5', slug:'nicole-vega', name:'Nicole Vega', handle:'@nicolevega', initials:'NV', a:'#22d3ee', b:'#a78bfa',
    langs:['ES','EN'], cat:'Viajes y aventura', resp:'~20 min', online:true, rating:4.9, fans:1780, media:97,
    monthly:4.99, yearly:49.90,
    bio:'De gira constante. Postales, hoteles con vista y piscinas infinitas. Promo de lanzamiento activa.',
    tags:['Viajera','Piscina','Global'],
    galleries:[
      { cat:'lifestyle', label:'Diario de ruta', access:'free', photos:[ {t:'Lima', p:0}, {t:'El hotel', p:0} ] },
      { cat:'trajeBano', label:'Piscinas infinitas', access:'sub', photos:[ {t:'Pool 01', p:0}, {t:'Pool 02', p:5.49} ] },
      { cat:'intimo',    label:'La suite sky', access:'ppv', photos:[ {t:'Suitepanorámica', p:10.99} ] }
    ] },
  { id:'c6', slug:'daniela-fox', name:'Daniela Fox', handle:'@danielafox', initials:'DF', a:'#ef4444', b:'#f59e0b',
    langs:['EN'], cat:'Música y performance', resp:'~30 min', online:false, rating:4.8, fans:930, media:71,
    monthly:24.99, yearly:249.90,
    bio:'Cantante y performer. Ensayos, making-of y una presencia escénica inolvidable.',
    tags:['Artista','Show','Energía'],
    galleries:[
      { cat:'lifestyle', label:'Ensayos', access:'free', photos:[ {t:'Ensayo 01', p:0} ] },
      { cat:'trajeBano', label:'Videoclip playa', access:'sub', photos:[ {t:'Rodaje', p:0}, {t:'Bloopers', p:8.99} ] },
      { cat:'intimo',    label:'Backstage del show', access:'ppv', photos:[ {t:'Camino al escenario', p:14.99} ] }
    ] },
  { id:'c7', slug:'aria-mendoza', name:'Aria Mendoza', handle:'@ariamendoza', initials:'AM', a:'#8b5cf6', b:'#22d3ee',
    langs:['ES'], cat:'Danza y movimiento', resp:'~12 min', online:true, rating:4.9, fans:1520, media:64,
    monthly:12.99, yearly:129.90,
    bio:'Bailarina profesional. Flexibilidad, técnica y la vida entre bastidores del escenario.',
    tags:['Bailarina','Flexibilidad','Show'],
    galleries:[
      { cat:'lifestyle', label:'Clase', access:'free', photos:[ {t:'Warm-up', p:0} ] },
      { cat:'trajeBano', label:'Coreografía playa', access:'sub', photos:[ {t:'Ensayo traje de baño', p:0} ] },
      { cat:'intimo',    label:'Backstage', access:'ppv', photos:[ {t:'Antes del show', p:12.99}, {t:'Detalle', p:12.99} ] },
      { cat:'personalizado', label:'Petición especial', access:'ppv', photos:[ {t:'A tu gusto', p:16.99} ] }
    ] }
];

/* ---------- CUPONES ---------- */
LP.COUPONS = {
  'LUMINA10': { pct:10, note:'10% de descuento · campaña de lanzamiento' }
};

/* ---------- PLANES DE WEBCAM ---------- */
LP.CAM_PLANS = [
  { id:'cam15', minutes:15, price:24.99, label:'Webcam 15 min' },
  { id:'cam30', minutes:30, price:39.99, label:'Webcam 30 min' }
];

/* ---------- PRECIO DE CONTACTO POR MENSAJE ---------- */
LP.CHAT_OPEN_FEE = 3.99;  /* coste previo para abrir el chat con una creadora */
LP.MSG_FEE = 0;           /* 0 = los mensajes dentro del chat ya abierto son libres */

/* ---------- ESTADO INICIAL DE LA BASE (localStorage: lumina_db_v2) ---------- */
LP.defaultDB = function(){
  return {
    users: [], reports: [], modQueue: [], audit: [], notifications: []
  };
};
