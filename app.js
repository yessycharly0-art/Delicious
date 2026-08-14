(function(){
  const root = document.getElementById('app');

  // ============================================================
  // CONEXIÓN A APPWRITE — pega aquí tus 5 datos desde la consola
  // (Settings del proyecto, Databases y Storage). Mientras estén
  // vacíos, la página sigue funcionando con los sabores de ejemplo.
  // ============================================================
  const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
  const APPWRITE_PROJECT_ID = '6a72de2a00382d8aa50b';
  const DATABASE_ID = '6a738d5b0005ae72bac5';
  const FLAVORS_TABLE_ID = 'flavors';
  const ORDERS_TABLE_ID = 'orders';
  const REPORTS_TABLE_ID = 'reports'; // NUEVO: crea esta tabla en Appwrite con columnas:
  // subject (string), description (string), category (string), severity (string),
  // status (string), userEmail (string), aiResponse (string)
  const IMAGES_BUCKET_ID = '6a73d7950004768d13dd';

  const projectReady = !APPWRITE_PROJECT_ID.startsWith('<') && !!window.Appwrite;
  const appwriteReady = projectReady && !FLAVORS_TABLE_ID.startsWith('<');
  let client, account, tablesDB, storage;
  if(projectReady){
    client = new Appwrite.Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
    account = new Appwrite.Account(client);
    tablesDB = new Appwrite.TablesDB(client);
    storage = new Appwrite.Storage(client);
  }

  async function loadFlavorsFromAppwrite(){
    if(!appwriteReady) return;
    try{
      const res = await tablesDB.listRows(DATABASE_ID, FLAVORS_TABLE_ID);
      if(res.rows.length){
        FLAVORS.length = 0;
        res.rows.forEach(row => {
          FLAVORS.push({
            id: row.$id,
            name: row.name,
            desc: row.desc,
            price: row.price,
            cat: row.cat,
            sw: row.sw || 'sw-vanilla',
            stock: typeof row.stock === 'number' ? row.stock : 0,
            imageUrl: row.imageId ? storage.getFileView(IMAGES_BUCKET_ID, row.imageId) : null,
          });
        });
        S.selectedFlavorId = FLAVORS[0].id;
      }
    }catch(e){
      console.warn('No se pudieron cargar los sabores desde Appwrite, usando datos de ejemplo:', e.message);
    }
  }

  async function createFlavorRow(data){
    if(!appwriteReady) return null;
    try{ return await tablesDB.createRow(DATABASE_ID, FLAVORS_TABLE_ID, Appwrite.ID.unique(), data); }
    catch(e){ toast('No se pudo guardar en Appwrite: ' + e.message); return null; }
  }
  async function updateFlavorRow(id, data){
    if(!appwriteReady) return null;
    try{ return await tablesDB.updateRow(DATABASE_ID, FLAVORS_TABLE_ID, id, data); }
    catch(e){ toast('No se pudo actualizar en Appwrite: ' + e.message); return null; }
  }
  async function deleteFlavorRow(id){
    if(!appwriteReady) return;
    try{ await tablesDB.deleteRow(DATABASE_ID, FLAVORS_TABLE_ID, id); }
    catch(e){ toast('No se pudo eliminar en Appwrite: ' + e.message); }
  }

  // ---- Pedidos: persistencia en Appwrite (tabla "orders") ----
  async function loadOrdersFromAppwrite(){
    if(!appwriteReady) return;
    try{
      const res = await tablesDB.listRows(DATABASE_ID, ORDERS_TABLE_ID, [
        Appwrite.Query.orderDesc('$createdAt'),
        Appwrite.Query.limit(200),
      ]);
      S.orders = res.rows.map(row => ({
        id: row.$id,
        date: new Date(row.$createdAt).toLocaleDateString('es-MX'),
        createdAt: row.$createdAt,
        itemsText: row.itemsText,
        qty: row.qty,
        total: row.total,
        statusLabel: row.statusLabel,
        paymentMethod: row.paymentMethod,
        userEmail: row.userEmail || '',
      }));
    }catch(e){
      console.warn('No se pudieron cargar los pedidos desde Appwrite:', e.message);
    }
  }
  async function createOrderRow(data){
    if(!appwriteReady) return null;
    try{ return await tablesDB.createRow(DATABASE_ID, ORDERS_TABLE_ID, Appwrite.ID.unique(), data); }
    catch(e){ toast('No se pudo guardar el pedido en Appwrite: ' + e.message); return null; }
  }
  async function updateOrderRow(id, data){
    if(!appwriteReady) return null;
    try{ return await tablesDB.updateRow(DATABASE_ID, ORDERS_TABLE_ID, id, data); }
    catch(e){ toast('No se pudo actualizar el pedido en Appwrite: ' + e.message); return null; }
  }

  // ---- Reportes de fallas: persistencia en Appwrite (tabla "reports") ----
  async function loadReportsFromAppwrite(){
    if(!appwriteReady) return;
    try{
      const res = await tablesDB.listRows(DATABASE_ID, REPORTS_TABLE_ID, [
        Appwrite.Query.orderDesc('$createdAt'),
        Appwrite.Query.limit(200),
      ]);
      S.reports = res.rows.map(row => ({
        id: row.$id,
        createdAt: row.$createdAt,
        subject: row.subject,
        description: row.description,
        category: row.category,
        severity: row.severity,
        status: row.status,
        userEmail: row.userEmail || '',
        aiResponse: row.aiResponse || '',
      }));
    }catch(e){
      // Lo más probable si esto falla es que la tabla "reports" todavía no existe en Appwrite.
      console.warn('No se pudieron cargar los reportes desde Appwrite (¿ya creaste la tabla "reports"?):', e.message);
    }
  }
  async function createReportRow(data){
    if(!appwriteReady) return null;
    try{ return await tablesDB.createRow(DATABASE_ID, REPORTS_TABLE_ID, Appwrite.ID.unique(), data); }
    catch(e){ console.warn('No se pudo guardar el reporte en Appwrite (¿ya creaste la tabla "reports"?):', e.message); return null; }
  }
  async function updateReportRow(id, data){
    if(!appwriteReady) return null;
    try{ return await tablesDB.updateRow(DATABASE_ID, REPORTS_TABLE_ID, id, data); }
    catch(e){ toast('No se pudo actualizar el reporte en Appwrite: ' + e.message); return null; }
  }

  // Sube el archivo elegido en el formulario de admin al bucket de imágenes.
  // Devuelve { imageId, imageUrl } o null si no se pudo / no aplica.
  async function uploadFlavorImage(file){
    if(!file) return null;
    if(appwriteReady){
      try{
        const uploaded = await storage.createFile(IMAGES_BUCKET_ID, Appwrite.ID.unique(), file);
        return { imageId: uploaded.$id, imageUrl: storage.getFileView(IMAGES_BUCKET_ID, uploaded.$id) };
      }catch(e){
        toast('No se pudo subir la imagen: ' + e.message);
        return null;
      }
    }
    // Sin Appwrite configurado: mostramos la imagen solo mientras la página esté abierta.
    return { imageId: null, imageUrl: URL.createObjectURL(file) };
  }

  async function restoreSession(){
    if(!projectReady) return;
    try{
      const me = await account.get();
      S.user = { name: me.name, email: me.email };
      S.view = 'home';
    }catch(e){ /* nadie ha iniciado sesión todavía */ }
  }

  // ---------------- ICONS ----------------
  const I = {
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v0M18 15v0"/></svg>',
    cardpay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M2.5 10h19"/><path d="M6 15h4"/></svg>',
    transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.3 11.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.2-4 4.1-6 7.5-6s6.3 2 7.5 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.4-3.4"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M2.5 10h19"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4.7a7.7 7.7 0 0 0-1.7-1L15 3h-4l-.3 2.4a7.7 7.7 0 0 0-1.7 1l-2.4-.7-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-.7a7.7 7.7 0 0 0 1.7 1L11 21h4l.3-2.4a7.7 7.7 0 0 0 1.7-1l2.4.7 2-3.4z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r="0.2" fill="currentColor"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 11v6M12 7.5v.2"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 9V6.5A2.5 2.5 0 0 1 5.5 4H8"/><path d="M21 9V6.5A2.5 2.5 0 0 0 18.5 4H16"/><path d="M12 4c-1.6 0-3 1-3 2.5S10.4 9 12 9s3-1 3-2.5S13.6 4 12 4z"/><path d="M12 9v12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    google: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.3-1.7 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3c-5.4 0-9.8 4.4-9.8 9.7s4.4 9.7 9.8 9.7c5.6 0 9.4-4 9.4-9.6 0-.6-.06-1.1-.15-1.6H12z"/></svg>',
    apple: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.9-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.4 1.3 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2-.05 1.7-.8 3.2-.8s1.9.8 3.3.8c1.4 0 2.2-1.2 3-2.4.95-1.4 1.35-2.7 1.35-2.8-.03-.02-2.6-1-2.6-3.9zM13.9 5.2c.7-.8 1.1-2 1-3.1-1 .04-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V5.8c-.5-.07-1.6-.17-2.9-.17-2.9 0-4.8 1.77-4.8 5v2.5H6.6V16h2.7v8h3.4v-8h2.8l.4-3.7h-3.2V11c0-1.08.3-1.9 1.3-1.9z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.3c-.7.3-1.4.5-2.2.6.8-.5 1.4-1.2 1.6-2.1-.7.4-1.5.8-2.4.9A3.7 3.7 0 0 0 11.9 9c0 .3 0 .6.1.8-3.1-.2-5.8-1.6-7.6-3.9-.3.6-.5 1.2-.5 2 0 1.3.7 2.4 1.7 3.1-.6 0-1.2-.2-1.7-.5v.1c0 1.8 1.3 3.4 3 3.7-.3.1-.6.1-1 .1-.2 0-.5 0-.7-.1.5 1.5 1.9 2.6 3.6 2.6a7.4 7.4 0 0 1-4.6 1.6H3c1.6 1.1 3.6 1.7 5.7 1.7 6.8 0 10.6-5.8 10.6-10.8v-.5c.7-.5 1.3-1.2 1.8-1.9z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"/></svg>',
  };

  // ---------------- DATA ----------------
  const FLAVORS = [
    { id:'f1', name:'Frambuesa Ripple', desc:'Helado cremoso de vainilla con salsa de frambuesa arremolinada y trocitos de fruta.', price:22, cat:'Frutales', sw:'sw-raspberry', stock:14 },
    { id:'f2', name:'Caramelo Salado', desc:'Base de caramelo tostado con un toque de sal de mar y swirl de dulce de leche.', price:20.5, cat:'Cremosos', sw:'sw-caramel', stock:9 },
    { id:'f3', name:'Menta Chocolate', desc:'Helado de menta fresca con chips de chocolate semi-amargo.', price:19, cat:'Chocolate', sw:'sw-mint', stock:3 },
    { id:'f4', name:'Vainilla Clásica', desc:'Vainilla de Madagascar, receta original de la casa desde 1998.', price:16, cat:'Cremosos', sw:'sw-vanilla', stock:20 },
    { id:'f5', name:'Chocolate Belga', desc:'Chocolate belga 70% con streusel de cacao crocante.', price:21, cat:'Chocolate', sw:'sw-choco', stock:0 },
    { id:'f6', name:'Arándano Silvestre', desc:'Helado de arándanos silvestres con un toque de limón.', price:20, cat:'Frutales', sw:'sw-blueberry', stock:11 },
    { id:'f7', name:'Mango Tropical', desc:'Mango maduro, sorbete ligero y refrescante, ideal para el calor.', price:19.5, cat:'Frutales', sw:'sw-mango', stock:17 },
    { id:'f8', name:'Fresa Natural', desc:'Fresas frescas de temporada con trozos naturales de fruta.', price:18.5, cat:'Frutales', sw:'sw-strawberry', stock:8 },
  ];
  const CATEGORIES = ['Todos','Frutales','Cremosos','Chocolate'];
  const SIZES = [ {label:'Chico', mult:0.85}, {label:'Mediano', mult:1}, {label:'Grande', mult:1.3} ];
  const PAYMENT_METHODS = ['Efectivo','Tarjeta','Transferencia'];
  const DELIVERY_FEE = 3.00;
  const LOW_STOCK_THRESHOLD = 5; // mismo umbral que ya usa el badge "¡Últimas N!"
  const ADMIN_EMAILS = [
    'estefaniayesenia02@gmail.com',
    '223112129@upmh.edu.mx',
    '233110029@upmh.edu.mx',
  ];
  function isAdmin(){
    return !!S.user && ADMIN_EMAILS.includes(String(S.user.email||'').trim().toLowerCase());
  }

  // ---------------- STATE ----------------
  let S = {
    view: 'landing',
    prevView: 'home',
    user: null,
    cart: [],
    orders: [],
    reports: [],
    activeCategory: 'Todos',
    orderTab: 'Todos',
    selectedFlavorId: FLAVORS[0].id,
    selectedSize: 'Mediano',
    selectedQty: 1,
    selectedPayment: 'Efectivo',
    loginError: '',
    signupError: '',
    landingMenuOpen: false,
    adminTab: 'sabores',
    adminOrderTab: 'Todos',
    showFlavorForm: false,
    editingFlavor: null,
    flavorFormError: '',
    notifOpen: false,
    lastLowStockKey: null,
    showReportForm: false,
    reportFormError: '',
    lastReportReply: null,
    adminSupportTab: 'Todos',
  };

  // ---------------- AGENTE DE REPORTES (IA de triage) ----------------
  // Nota: este es un agente basado en reglas (palabras clave) que corre 100% en el
  // navegador — no hay una llamada a un modelo de lenguaje real, porque este proyecto
  // no tiene backend propio donde guardar una API key de forma segura. Categoriza el
  // reporte, le asigna severidad, y da una primera respuesta automática al usuario,
  // igual que haría un agente de soporte de primer nivel. Los reportes que no puede
  // resolver solo, los deja "Escalado" para que el equipo humano los revise.
  const REPORT_CATEGORIES = {
    Pago: /pago|tarjeta|cobr|transferen|efectivo|no.{0,15}proces(o|ó|a)|rechaz/i,
    Pedido: /pedido|orden|entrega|env[ií]o|no lleg|tard[óo]|domicilio|repartidor/i,
    Cuenta: /contraseñ|cuenta|inicio de sesi[oó]n|iniciar sesi[oó]n|login|registrar|correo/i,
    Técnico: /error|bug|falla|se cierra|crash|no carga|no abre|pantalla en blanco|congela|lento|no funciona|se traba/i,
  };
  const REPORT_URGENT = /urgente|perd[ií].{0,10}dinero|me cobraron.{0,15}(dos veces|doble)|no puedo (comprar|pagar|entrar)|se cerr[oó] todo|nada funciona/i;

  function classifyReportCategory(text){
    for(const cat in REPORT_CATEGORIES){
      if(REPORT_CATEGORIES[cat].test(text)) return cat;
    }
    return 'General';
  }

  function analyzeReport(subject, description){
    const text = `${subject} ${description}`.toLowerCase();
    const category = classifyReportCategory(text);
    const severity = REPORT_URGENT.test(text) ? 'Alta' : (category === 'General' ? 'Baja' : 'Media');

    const tips = {
      Pago: 'Revisa que los datos de tu tarjeta o transferencia estén correctos e intenta de nuevo. Si ya te cobraron pero el pedido no se registró, no te preocupes: lo marcamos como urgente para que el equipo lo revise y te contacte.',
      Pedido: 'Puedes ver el estado actualizado de tu pedido en "Mis pedidos", dentro de tu perfil. Si el tiempo de entrega ya se pasó por mucho, nuestro equipo va a revisar tu caso directamente.',
      Cuenta: 'Intenta cerrar sesión y volver a entrar, y verifica que tu correo esté bien escrito. Si sigues sin poder entrar, nuestro equipo puede ayudarte a recuperar el acceso.',
      Técnico: 'Intenta recargar la página o revisa tu conexión a internet; muchas veces eso lo resuelve. Si el problema sigue apareciendo, ya quedó registrado para que el equipo lo revise a fondo.',
      General: 'Gracias por avisarnos. Tu reporte ya quedó registrado y nuestro equipo lo va a revisar pronto.',
    };

    const status = severity === 'Alta' ? 'Escalado' : 'Resuelto por IA';
    const response = `He clasificado tu reporte como "${category}" con prioridad ${severity.toLowerCase()}. ${tips[category]}`;

    return { category, severity, status, response };
  }

  function money(n){ return '$' + n.toFixed(2); }

  // ---------------- REPORTES: semana actual (lunes a domingo) ----------------
  const WEEKDAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  function startOfWeek(d = new Date()){
    const date = new Date(d);
    const day = date.getDay(); // 0=domingo ... 6=sábado
    const diffToMonday = day === 0 ? 6 : day - 1;
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() - diffToMonday);
    return date;
  }
  function orderDate(o){
    // createdAt es el timestamp real (ISO). Si un pedido viejo no lo tiene, cae fuera del reporte.
    return o.createdAt ? new Date(o.createdAt) : null;
  }
  function ordersThisWeek(){
    const start = startOfWeek();
    return S.orders.filter(o => {
      const d = orderDate(o);
      return d && d >= start;
    });
  }
  function weeklyStats(){
    const weekOrders = ordersThisWeek();
    const validOrders = weekOrders.filter(o => o.statusLabel !== 'Cancelado');
    const earnings = validOrders.reduce((sum,o) => sum + o.total, 0);
    const itemsSold = validOrders.reduce((sum,o) => sum + o.qty, 0);
    const byDay = WEEKDAY_LABELS.map(() => 0);
    validOrders.forEach(o => {
      const d = orderDate(o);
      if(!d) return;
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1; // lunes=0 ... domingo=6
      byDay[idx] += o.total;
    });
    return {
      weekOrders,
      validOrders,
      earnings,
      itemsSold,
      orderCount: weekOrders.length,
      cancelledCount: weekOrders.length - validOrders.length,
      byDay,
    };
  }
  function initials(name){
    const p = String(name||'?').trim().split(/\s+/);
    return ((p[0]?.[0]||'') + (p[1]?.[0]||'')).toUpperCase() || '?';
  }
  function flavorById(id){ return FLAVORS.find(f => f.id === id); }
  // Productos agotados o con pocas unidades (stock <= LOW_STOCK_THRESHOLD)
  function lowStockFlavors(){
    return FLAVORS.filter(f => f.stock <= LOW_STOCK_THRESHOLD).sort((a,b) => a.stock - b.stock);
  }
  // Avisa al admin (dentro de la app) cuando cambia el conjunto de productos con poco inventario.
  // No hay backend de correo/push configurado en este proyecto, así que la notificación
  // vive en la campanita de la barra de navegación y aparece como toast cuando el admin
  // está usando la app.
  function maybeNotifyAdminLowStock(){
    if(!isAdmin()) return;
    const items = lowStockFlavors();
    const key = items.map(f => f.id + ':' + f.stock).join('|');
    if(key === S.lastLowStockKey) return;
    S.lastLowStockKey = key;
    if(items.length === 0) return;
    const names = items.slice(0,3).map(f => f.stock<=0 ? `${f.name} (agotado)` : `${f.name} (${f.stock})`).join(', ');
    const extra = items.length > 3 ? ` y ${items.length - 3} más` : '';
    toast(`⚠️ Inventario bajo: ${names}${extra}`);
  }
  function paymentIcon(method){
    if(method === 'Efectivo') return I.cash;
    if(method === 'Tarjeta') return I.cardpay;
    return I.transfer;
  }
  function stockBadge(stock){
    if(stock <= 0) return `<span class="stock-badge out">Agotado</span>`;
    if(stock <= 5) return `<span class="stock-badge low">¡Últimas ${stock}!</span>`;
    return `<span class="stock-badge ok">${stock} disponibles</span>`;
  }
  function scoopHtml(f, styleAttr){
    if(f.imageUrl){
      return `<div class="scoop" style="${styleAttr||''} padding:0; overflow:hidden;"><img src="${f.imageUrl}" style="width:100%; height:100%; object-fit:cover; display:block;"></div>`;
    }
    return `<div class="scoop ${f.sw}" style="${styleAttr||''}"></div>`;
  }
  function cartTotalQty(){ return S.cart.reduce((a,c) => a + c.qty, 0); }
  // Cuánto de un sabor ya está en el carrito (para no dejar agregar más de lo que hay en stock)
  function cartQtyForFlavor(flavorId){
    return S.cart.reduce((sum,c) => c.flavorId === flavorId ? sum + c.qty : sum, 0);
  }
  function cartSubtotal(){
    return S.cart.reduce((sum,c) => {
      const f = flavorById(c.flavorId);
      const mult = SIZES.find(s => s.label === c.size)?.mult || 1;
      return sum + f.price * mult * c.qty;
    }, 0);
  }

  function goTo(view){ S.prevView = S.view; S.view = view; render(); window.scrollTo({top:0, behavior:'instant'}); }
  function toast(msg){
    let t = document.querySelector('.toast-el');
    if(!t){
      t = document.createElement('div'); t.className='toast-el';
      t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#33202A;color:#fff;padding:12px 22px;border-radius:999px;font-size:13px;font-family:Poppins,sans-serif;z-index:999;opacity:0;transition:opacity .25s ease;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,0.25);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(()=>{ t.style.opacity = '1'; });
    clearTimeout(t._tm);
    t._tm = setTimeout(()=>{ t.style.opacity = '0'; }, 1800);
  }

  // ---------------- TOP NAVBAR ----------------
  function navbar(active){
    const items = [
      {v:'home', icon:I.home, label:'Inicio'},
      {v:'menu', icon:I.menu, label:'Menú'},
      ...(isAdmin() ? [{v:'admin', icon:I.settings, label:'Admin'}] : []),
      {v:'profile', icon:I.user, label:'Perfil'},
    ];
    const lowStock = isAdmin() ? lowStockFlavors() : [];
    return `
    <div class="navbar">
      <div class="logo display" data-goto="home">Delicious</div>
      <div class="nav-links">
        ${items.map(it => `<div class="nav-link ${active===it.v?'active':''}" data-goto="${it.v}">${it.icon}<span>${it.label}</span></div>`).join('')}
      </div>
      <div class="nav-right">
        ${isAdmin() ? `
        <div style="position:relative;">
          <div class="icon-btn" id="notif-bell-btn" style="position:relative;">
            ${I.bell}
            ${lowStock.length ? `<span class="nav-badge">${lowStock.length}</span>` : ''}
          </div>
          ${S.notifOpen ? `
          <div class="notif-dropdown">
            <div class="notif-dropdown-head">Inventario bajo</div>
            ${lowStock.length === 0 ? `<div class="notif-empty">Todo el inventario está en buen nivel 🎉</div>` : lowStock.map(f => `
              <div class="notif-row" data-notif-flavor="${f.id}">
                <span class="notif-name">${f.name}</span>
                <span class="stock-badge ${f.stock<=0?'out':'low'}">${f.stock<=0 ? 'Agotado' : `Quedan ${f.stock}`}</span>
              </div>`).join('')}
          </div>` : ''}
        </div>` : ''}
        <div class="icon-btn" style="position:relative;" data-goto="cart">
          ${I.cart}
          ${cartTotalQty() ? `<span class="nav-badge">${cartTotalQty()}</span>` : ''}
        </div>
        <div class="icon-btn" data-goto="profile" style="background:linear-gradient(155deg,#F5A9C0,#C2185B); color:#fff; border:none; font-weight:700; font-size:13px;">${initials(S.user?.name)}</div>
      </div>
    </div>`;
  }

  // ---------------- SCREENS ----------------
  function viewLanding(){
    const cats = [
      { label:'Frutales', sw:'sw-strawberry', cat:'Frutales' },
      { label:'Cremosos', sw:'sw-caramel', cat:'Cremosos' },
      { label:'Chocolate', sw:'sw-choco', cat:'Chocolate' },
    ];
    return `
    <div class="hero-page">
      <div class="hero-blob b1"></div>
      <div class="hero-blob b2"></div>
      <div class="hero-blob b3"></div>

      <div class="hero-nav">
        <div class="logo display">Delicious</div>
        <div class="hero-nav-links">
          <span data-goto="landing">Inicio</span>
          <span data-goto="menu">Menú</span>
          <span data-catgoto="Cremosos">Categorías</span>
          <span data-toast="Muy pronto podrás conocer más sobre nosotros.">Nosotros</span>
          <span data-toast="Escríbenos a hola@delicious.com">Contacto</span>
        </div>
        <div class="hero-nav-icons">
          <div class="icon-btn" data-goto="login">${I.cart}</div>
          <div class="sep"></div>
          <div class="icon-btn" id="hero-menu-toggle">${I.menu}</div>
        </div>
        ${S.landingMenuOpen ? `
        <div class="hero-dropdown">
          <div data-goto="login">Iniciar sesión</div>
          <div data-goto="signup">Registrarte</div>
        </div>` : ''}
      </div>

      <div class="hero-split">
        <div class="hero-text">
          <div class="eyebrow">Disfruta nuestros</div>
          <h1>Postres<br>Deliciosos</h1>
          <p class="desc">Descubre la magia de nuestra heladería artesanal, donde la pasión, la tradición y el sabor se juntan para crear recuerdos.</p>
          <div class="hero-cta-row">
            <button class="btn btn-primary" data-goto="login">Ordenar ahora</button>
            <span class="hero-explore" data-goto="menu">Explorar más ${I.arrowRight}</span>
          </div>
          <div class="category-strip">
            <div class="cs-label">Nuestras categorías</div>
            <div class="cs-items">
              ${cats.map(c => `
                <div class="cs-item" data-catgoto="${c.cat}">
                  <div class="scoop ${c.sw}"></div>
                  <div class="cs-name">${c.label} ${I.arrowRight}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div class="hero-visual-inner">
            <div class="bowl"></div>
            <div class="cone"></div>
            <div class="scoop hv-scoop sw-choco" style="width:170px; height:170px; left:50%; bottom:150px; transform:translateX(-50%);"></div>
            <div class="scoop hv-scoop sw-caramel" style="width:150px; height:150px; left:50%; bottom:230px; transform:translateX(-50%);"></div>
            <div class="scoop hv-scoop sw-vanilla" style="width:120px; height:120px; left:50%; bottom:300px; transform:translateX(-50%);"></div>
            <div class="scoop hv-scoop sw-raspberry" style="width:80px; height:80px; left:16px; bottom:150px;"></div>
            <div class="scoop hv-scoop sw-mint" style="width:76px; height:76px; right:14px; bottom:170px;"></div>
            <div class="cherry" style="left:50%; bottom:398px; transform:translateX(-50%);"></div>
          </div>
        </div>
      </div>

      <div class="social-rail">
        <div class="icon-btn" data-toast="¡Muy pronto en redes sociales!">${I.facebook}</div>
        <div class="icon-btn" data-toast="¡Muy pronto en redes sociales!">${I.twitter}</div>
        <div class="icon-btn" data-toast="¡Muy pronto en redes sociales!">${I.instagram}</div>
      </div>
    </div>`;
  }

  function viewLogin(){
    return `
    <div class="auth-wrap">
      <div class="auth-side">
        <div class="display">Delicious</div>
        <p>Ingresa para pedir tu postre favorito y ver tus pedidos anteriores.</p>
      </div>
      <div class="auth-form-side">
        <div class="auth-card">
          <span class="back-link" data-goto="landing">${I.back} Volver</span>
          <h2>Bienvenido</h2>
          <p class="muted" style="margin-bottom:22px;">Ingresa tus datos para continuar.</p>
          <div class="field"><label>Email</label><input type="text" id="login-email" placeholder="tú@ejemplo.com"></div>
          <div class="field"><label>Contraseña</label><input type="password" id="login-pass" placeholder="••••••••"></div>
          ${S.loginError ? `<div class="error-text">${S.loginError}</div>` : ''}
          <div style="text-align:right; margin:-8px 0 18px 0;"><span class="link" style="font-size:12.5px;">¿Olvidaste tu contraseña?</span></div>
          <button class="btn btn-primary btn-block" id="do-login">Iniciar sesión</button>
          <div class="divider-text">o continúa con</div>
          <div class="social-row">
            <div class="social-btn">${I.google}<span>Google</span></div>
            <div class="social-btn">${I.apple}<span>Apple</span></div>
          </div>
          <p class="muted" style="text-align:center; margin-top:26px;">¿No tienes cuenta? <span class="link" data-goto="signup">Regístrate</span></p>
        </div>
      </div>
    </div>`;
  }

  function viewSignup(){
    return `
    <div class="auth-wrap">
      <div class="auth-side">
        <div class="display">Delicious</div>
        <p>Únete y descubre sabores nuevos cada semana, directo a tu puerta.</p>
      </div>
      <div class="auth-form-side">
        <div class="auth-card">
          <span class="back-link" data-goto="landing">${I.back} Volver</span>
          <h2>Crear cuenta</h2>
          <p class="muted" style="margin-bottom:22px;">Completa tus datos para registrarte.</p>
          <div class="field"><label>Nombre</label><input type="text" id="su-name" placeholder="Tu nombre"></div>
          <div class="field"><label>Email</label><input type="text" id="su-email" placeholder="tú@ejemplo.com"></div>
          <div class="field"><label>Contraseña</label><input type="password" id="su-pass" placeholder="••••••••"></div>
          ${S.signupError ? `<div class="error-text">${S.signupError}</div>` : ''}
          <button class="btn btn-primary btn-block" id="do-signup">Registrarme</button>
          <p class="muted" style="text-align:center; margin-top:22px;">¿Ya tienes cuenta? <span class="link" data-goto="login">Inicia sesión</span></p>
        </div>
      </div>
    </div>`;
  }

  function viewCongrats(){
    return `
    <div class="congrats-wrap">
      <div class="congrats-card">
        <div class="gift-scoop">${I.gift}</div>
        <div>
          <h2 class="display" style="font-size:30px; color:var(--berry-dark);">¡Felicidades!</h2>
          <p class="muted" style="margin-top:10px;">Tu cuenta se ha creado con éxito. Ya puedes explorar todos nuestros sabores, ${S.user ? S.user.name.split(' ')[0] : ''}.</p>
        </div>
        <button class="btn btn-primary" style="padding:14px 38px;" data-goto="home">Continuar</button>
      </div>
    </div>`;
  }

  function viewHome(){
    const list = FLAVORS.filter(f => S.activeCategory==='Todos' || f.cat===S.activeCategory);
    return `
    ${navbar('home')}
    <div class="page-content">
      <div class="container">
        <div class="promo-banner">
          <div>
            <h2>Hecho especialmente para ti</h2>
            <p>Hola ${S.user ? S.user.name.split(' ')[0] : ''}, tenemos nuevos sabores esta semana.</p>
          </div>
          <div class="scoop sw-strawberry"></div>
        </div>
        <div class="filter-row">
          <div class="search-box">${I.search}<input placeholder="Buscar un sabor..." id="home-search"></div>
          <div class="chip-row">${CATEGORIES.map(c => `<div class="chip ${S.activeCategory===c?'active':''}" data-cat="${c}">${c}</div>`).join('')}</div>
        </div>
        <h3 class="section-title">Especial para ti</h3>
        <div class="flavor-grid">
          ${list.map(f => `
            <div class="flavor-card ${f.stock<=0?'is-out':''}" data-detail="${f.id}">
              ${scoopHtml(f)}
              <div class="name">${f.name}</div>
              <div class="desc">${f.desc.slice(0,60)}${f.desc.length>60?'…':''}</div>
              <div class="flex-between" style="margin-top:6px;">
                <div class="price">${money(f.price)}</div>
                ${stockBadge(f.stock)}
              </div>
            </div>`).join('') || '<p class="muted">No hay sabores en esta categoría.</p>'}
        </div>
      </div>
    </div>`;
  }

  function viewMenu(){
    const list = FLAVORS.filter(f => S.activeCategory==='Todos' || f.cat===S.activeCategory);
    return `
    ${navbar('menu')}
    <div class="page-content">
      <div class="container">
        <h2 style="font-size:26px; margin-bottom:24px;">Menú completo</h2>
        <div class="filter-row">
          <div class="search-box">${I.search}<input placeholder="Buscar un sabor..." id="menu-search"></div>
          <div class="chip-row">${CATEGORIES.map(c => `<div class="chip ${S.activeCategory===c?'active':''}" data-cat="${c}">${c}</div>`).join('')}</div>
        </div>
        <div class="flavor-grid">
          ${list.map(f => `
            <div class="flavor-card ${f.stock<=0?'is-out':''}" data-detail="${f.id}">
              ${scoopHtml(f)}
              <div class="name">${f.name}</div>
              <div class="desc">${f.desc.slice(0,60)}${f.desc.length>60?'…':''}</div>
              <div class="flex-between" style="margin-top:6px;">
                <div class="price">${money(f.price)}</div>
                ${stockBadge(f.stock)}
              </div>
            </div>`).join('') || '<p class="muted">No hay sabores en esta categoría.</p>'}
        </div>
      </div>
    </div>`;
  }

  function viewDetail(){
    const f = flavorById(S.selectedFlavorId) || FLAVORS[0];
    const mult = SIZES.find(s => s.label === S.selectedSize)?.mult || 1;
    const alreadyInCart = cartQtyForFlavor(f.id);
    const available = Math.max(0, f.stock - alreadyInCart);
    const linePrice = f.price * mult * S.selectedQty;
    const outOfStock = available <= 0;
    if(S.selectedQty > available && available > 0) S.selectedQty = available;
    if(available <= 0) S.selectedQty = 1;
    return `
    ${navbar('menu')}
    <div class="page-content">
      <div class="container">
        <span class="back-link" data-goto="${S.prevView==='home'?'home':'menu'}">${I.back} Volver</span>
        <div class="detail-grid">
          ${scoopHtml(f)}
          <div class="detail-info">
            <div class="flex-between" style="align-items:flex-start;">
              <div class="name">${f.name}</div>
              ${stockBadge(f.stock)}
            </div>
            <div class="price">${money(f.price)}</div>
            <p class="desc">${f.desc}</p>
            <div style="margin-top:26px;">
              <label style="font-size:11.5px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.04em;">Tamaño</label>
              <div class="size-row">${SIZES.map(s => `<div class="size-opt ${S.selectedSize===s.label?'active':''}" data-size="${s.label}">${s.label}</div>`).join('')}</div>
            </div>
            <div style="display:flex; align-items:center; gap:28px; margin-top:28px;">
              <span style="font-weight:600; font-size:14px;">Cantidad</span>
              <div class="stepper">
                <button data-qty="-1" ${outOfStock?'disabled':''}>${I.minus}</button>
                <span class="qty">${S.selectedQty}</span>
                <button data-qty="1" ${(outOfStock || S.selectedQty>=available)?'disabled':''}>${I.plus}</button>
              </div>
            </div>
            ${alreadyInCart > 0 ? `<p class="muted" style="font-size:12px; margin-top:6px;">Ya tienes ${alreadyInCart} en tu carrito${available>0 ? ` · quedan ${available} disponibles` : ' · ¡es todo el inventario disponible!'}</p>` : ''}
            <button class="btn btn-primary" style="margin-top:34px; padding:15px 32px;" id="add-to-cart" ${outOfStock?'disabled':''}>${outOfStock ? 'Sin inventario disponible' : `Agregar al carrito · ${money(linePrice)}`}</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function viewCart(){
    const sub = cartSubtotal();
    const total = S.cart.length ? sub + DELIVERY_FEE : 0;
    return `
    ${navbar('cart')}
    <div class="page-content">
      <div class="container">
        <h2 style="font-size:26px; margin-bottom:30px;">Mi carrito</h2>
        ${S.cart.length === 0 ? `
          <div class="empty-state">
            <div class="scoop sw-vanilla"></div>
            <p class="muted" style="text-align:center;">Tu carrito está vacío.<br>Explora el menú y agrega tu sabor favorito.</p>
            <button class="btn btn-ghost" data-goto="menu">Ver menú</button>
          </div>` : `
          <div class="cart-grid">
            <div class="cart-items">
              ${S.cart.map((c,idx) => {
                const f = flavorById(c.flavorId);
                const mult = SIZES.find(s=>s.label===c.size)?.mult || 1;
                return `
                <div class="cart-row">
                  ${scoopHtml(f)}
                  <div class="info">
                    <div class="name">${f.name}</div>
                    <div class="meta">${c.size} · x${c.qty}</div>
                    <div class="remove-x" data-remove="${idx}">Quitar</div>
                  </div>
                  <div class="price">${money(f.price*mult*c.qty)}</div>
                </div>`;
              }).join('')}
            </div>
            <div class="cart-summary card">
              <div class="field" style="margin-bottom:16px;">
                <label>Forma de pago</label>
                <div class="payment-row">
                  ${PAYMENT_METHODS.map(p => `<div class="payment-opt ${S.selectedPayment===p?'active':''}" data-payment="${p}">${paymentIcon(p)}<span>${p}</span></div>`).join('')}
                </div>
              </div>
              <div class="summary-row"><span>Subtotal</span><span>${money(sub)}</span></div>
              <div class="summary-row"><span>Envío</span><span>${money(DELIVERY_FEE)}</span></div>
              <div class="summary-row total"><span>Total</span><span>${money(total)}</span></div>
              <button class="btn btn-primary btn-block" style="margin-top:20px;" id="checkout-btn">Proceder al pago</button>
            </div>
          </div>`}
      </div>
    </div>`;
  }

  function viewProfile(){
    const rows = [
      {icon:I.receipt, label:'Mis pedidos', action:'orders'},
      {icon:I.card, label:'Métodos de pago'},
      {icon:I.settings, label:'Ajustes'},
      {icon:I.help, label:'Centro de ayuda', action:'help'},
      {icon:I.info, label:'Acerca de'},
    ];
    const myOrders = S.orders.filter(o => !S.user?.email || o.userEmail === S.user.email);
    return `
    ${navbar('profile')}
    <div class="page-content">
      <div class="container">
        <h2 style="font-size:26px; margin-bottom:30px;">Mi perfil</h2>
        <div class="profile-grid">
          <div class="profile-sidebar card" style="text-align:center;">
            <div class="avatar-lg display">${initials(S.user?.name)}</div>
            <div style="font-weight:700; font-size:16px;">${S.user ? S.user.name : 'Invitado'}</div>
            <div class="muted" style="font-size:12.5px; margin-top:4px;">${S.user ? S.user.email : ''}</div>
            <div style="text-align:left; margin-top:22px;">
              ${rows.map(r => `
                <div class="profile-row" ${r.action ? `data-goto="${r.action}"` : ''}>
                  <div class="label">${r.icon}<span>${r.label}</span></div>
                  <span class="chev">${I.chev}</span>
                </div>`).join('')}
              <div class="profile-row" id="do-logout">
                <div class="label" style="color:var(--berry-dark);">${I.logout}<span>Cerrar sesión</span></div>
              </div>
            </div>
          </div>
          <div class="profile-main card">
            <h3 style="font-size:16px; margin-bottom:20px;">Resumen de tu cuenta</h3>
            <div class="stat-grid">
              <div class="stat-card"><div class="num">${myOrders.length}</div><div class="lbl">Pedidos realizados</div></div>
              <div class="stat-card"><div class="num">${myOrders.reduce((a,o)=>a+o.qty,0)}</div><div class="lbl">Postres disfrutados</div></div>
              <div class="stat-card"><div class="num">${money(myOrders.reduce((a,o)=>a+o.total,0))}</div><div class="lbl">Total invertido</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function viewOrders(){
    const tabs = ['Todos','Procesando','Entregado','Cancelado'];
    const statusMap = {Procesando:'processing', Entregado:'delivered', Cancelado:'cancelled'};
    const myOrders = S.orders.filter(o => !S.user?.email || o.userEmail === S.user.email);
    const filtered = myOrders.filter(o => S.orderTab==='Todos' || o.statusLabel===S.orderTab);
    return `
    ${navbar('profile')}
    <div class="page-content">
      <div class="container" style="max-width:820px;">
        <span class="back-link" data-goto="profile">${I.back} Volver a mi perfil</span>
        <h2 style="font-size:26px; margin-bottom:24px;">Mis pedidos</h2>
        <div class="tabs">${tabs.map(t => `<div class="tab ${S.orderTab===t?'active':''}" data-ordertab="${t}">${t}</div>`).join('')}</div>
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <p class="muted" style="text-align:center;">Todavía no tienes pedidos ${S.orderTab!=='Todos' ? 'en este estado' : ''}.</p>
            <button class="btn btn-ghost" data-goto="menu">Ir al menú</button>
          </div>` :
          filtered.map(o => `
          <div class="card order-card">
            <div>
              <div class="oid">Pedido #${o.id}</div>
              <div class="odate">${o.date}</div>
            </div>
            <div class="oitems">${o.itemsText}</div>
            <span class="muted pay-mini" style="font-size:12.5px; display:flex; align-items:center; gap:5px;">${paymentIcon(o.paymentMethod||'Efectivo')} ${o.paymentMethod||'Efectivo'}</span>
            <span class="muted" style="font-size:12.5px;">${o.qty} artículo${o.qty===1?'':'s'}</span>
            <span style="font-weight:700; color:var(--gold); min-width:70px; text-align:right;">${money(o.total)}</span>
            <span class="order-status ${statusMap[o.statusLabel]}">${o.statusLabel}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function viewHelp(){
    const faqs = [
      { q:'¿Cuáles son sus horarios?', a:'Abrimos todos los días de 10:00 a.m. a 9:00 p.m., ¡incluso festivos!' },
      { q:'¿Hacen envíos a domicilio?', a:'Sí, en un radio de 5 km. El envío cuesta $3.00 y llega en 25-40 minutos aprox.' },
      { q:'¿Qué formas de pago aceptan?', a:'Tarjeta de crédito/débito en línea, efectivo y transferencia.' },
      { q:'¿Cómo hago un pedido?', a:'Inicia sesión, elige tus sabores en el Menú, agrégalos al carrito y confirma el pago.' },
    ];
    const statusClass = { 'Escalado':'cancelled', 'Resuelto por IA':'delivered', 'En revisión':'processing' };
    const myReports = S.reports.filter(r => !S.user?.email || r.userEmail === S.user.email);
    return `
    ${navbar('profile')}
    <div class="page-content">
      <div class="container" style="max-width:820px;">
        <span class="back-link" data-goto="profile">${I.back} Volver a mi perfil</span>
        <h2 style="font-size:26px; margin-bottom:6px;">Centro de ayuda</h2>
        <p class="muted" style="margin-bottom:24px;">Encuentra respuestas rápidas o repórtanos un problema — nuestro agente lo revisa al instante.</p>

        <div class="faq-grid">
          ${faqs.map(f => `<div class="card faq-card"><div class="q">${f.q}</div><div class="a">${f.a}</div></div>`).join('')}
        </div>

        <div class="card" style="margin-top:24px;">
          <div class="toolbar">
            <h3 style="font-size:15.5px;">¿Algo no está funcionando bien?</h3>
            ${!S.showReportForm ? `<button class="btn btn-primary" id="open-report-form">Reportar un problema</button>` : ''}
          </div>
          ${S.showReportForm ? `
          <div style="margin-top:14px;">
            <div class="field"><label>Asunto</label><input type="text" id="rp-subject" placeholder="Ej. No puedo pagar mi pedido"></div>
            <div class="field"><label>Cuéntanos qué pasó</label><textarea id="rp-desc" placeholder="Describe el problema con el mayor detalle posible..."></textarea></div>
            ${S.reportFormError ? `<div class="error-text">${S.reportFormError}</div>` : ''}
            <div class="row">
              <button class="btn btn-primary" id="submit-report">Enviar reporte</button>
              <button class="btn btn-outline" id="cancel-report">Cancelar</button>
            </div>
            <p class="muted" style="font-size:11.5px; margin-top:10px;">Un agente automático revisa tu reporte al momento; si necesita atención humana, lo marcamos como prioritario para el equipo.</p>
          </div>` : ''}

          ${S.lastReportReply ? `
          <div class="agent-reply">
            <div class="badge-ico">🤖</div>
            <div class="body">
              <div class="title">Respuesta del agente</div>
              <div class="text">${S.lastReportReply}</div>
            </div>
          </div>` : ''}
        </div>

        <h3 style="font-size:15.5px; margin:28px 0 14px;">Tus reportes anteriores</h3>
        ${myReports.length === 0 ? `<p class="muted">Todavía no has reportado nada. ¡Qué bien! 🍨</p>` : myReports.map(r => `
          <div class="card report-card">
            <div class="top-row">
              <div>
                <div class="subject">${r.subject}</div>
                <div class="desc">${r.description}</div>
              </div>
              <div class="tags">
                <span class="stock-badge ${r.severity==='Alta'?'out':r.severity==='Media'?'low':'ok'}">${r.severity}</span>
                <span class="order-status ${statusClass[r.status]||'processing'}">${r.status}</span>
              </div>
            </div>
            ${r.aiResponse ? `<div class="agent-reply" style="margin-top:12px;"><div class="badge-ico">🤖</div><div class="body"><div class="title">${r.category}</div><div class="text">${r.aiResponse}</div></div></div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }

  function viewAdmin(){
    const f = S.editingFlavor;
    const rows = FLAVORS.map(fl => `
      <tr>
        <td style="width:52px;">${scoopHtml(fl, 'width:40px;height:40px;border-radius:10px;')}</td>
        <td><b>${fl.name}</b></td>
        <td class="muted">${fl.cat}</td>
        <td>${money(fl.price)}</td>
        <td>${stockBadge(fl.stock)}</td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm" data-admin-edit="${fl.id}">Editar</button>
          <button class="btn btn-outline btn-sm" style="border-color:var(--berry-dark); color:var(--berry-dark);" data-admin-delete="${fl.id}">Eliminar</button>
        </td>
      </tr>`).join('');

    const ADMIN_ORDER_TABS = ['Todos','Procesando','Entregado','Cancelado'];
    const filteredOrders = S.orders.filter(o => S.adminOrderTab==='Todos' || o.statusLabel===S.adminOrderTab);
    const ordersRows = filteredOrders.length ? filteredOrders.map(o => `
      <tr>
        <td><b>#${o.id}</b></td>
        <td class="muted">${o.date}</td>
        <td>${o.itemsText}</td>
        <td>${o.qty}</td>
        <td>${money(o.total)}</td>
        <td class="muted pay-mini" style="display:flex; align-items:center; gap:5px;">${paymentIcon(o.paymentMethod||'Efectivo')} ${o.paymentMethod||'Efectivo'}</td>
        <td>
          <select class="status-select status-${(o.statusLabel||'Procesando').toLowerCase()}" data-order-status="${o.id}">
            ${['Procesando','Entregado','Cancelado'].map(s => `<option value="${s}" ${o.statusLabel===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('') : `<tr><td colspan="7" class="muted" style="text-align:center; padding:24px;">${S.orders.length ? 'No hay pedidos con este estado.' : 'Todavía no hay pedidos registrados en esta sesión.'}</td></tr>`;

    // ---- Reporte semanal ----
    const stats = weeklyStats();
    const weekStart = startOfWeek();
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
    const fmtShort = (d) => d.toLocaleDateString('es-MX', {day:'numeric', month:'short'});
    const maxDay = Math.max(1, ...stats.byDay);
    const weekOrdersSorted = [...stats.weekOrders].sort((a,b) => (orderDate(b)||0) - (orderDate(a)||0));
    const weekRows = weekOrdersSorted.length ? weekOrdersSorted.map(o => `
      <tr>
        <td><b>#${o.id}</b></td>
        <td class="muted">${orderDate(o) ? orderDate(o).toLocaleDateString('es-MX',{weekday:'short', day:'numeric', month:'short'}) : o.date}</td>
        <td>${o.itemsText}</td>
        <td>${o.qty}</td>
        <td>${money(o.total)}</td>
        <td><span class="order-status ${o.statusLabel==='Entregado'?'delivered':o.statusLabel==='Cancelado'?'cancelled':'processing'}">${o.statusLabel}</span></td>
      </tr>`).join('') : `<tr><td colspan="6" class="muted" style="text-align:center; padding:24px;">Todavía no hay pedidos esta semana.</td></tr>`;

    // ---- Bandeja de soporte (reportes de usuarios) ----
    const SUPPORT_TABS = ['Todos','Escalado','Resuelto por IA'];
    const filteredReports = S.reports.filter(r => S.adminSupportTab==='Todos' || r.status===S.adminSupportTab);
    const supportRows = filteredReports.length ? filteredReports.map(r => `
      <tr>
        <td><b>${r.subject}</b><div class="muted" style="font-size:11.5px; margin-top:2px;">${r.description}</div></td>
        <td class="muted">${r.category}</td>
        <td><span class="stock-badge ${r.severity==='Alta'?'out':r.severity==='Media'?'low':'ok'}">${r.severity}</span></td>
        <td class="muted" style="font-size:12px;">${r.userEmail || '—'}</td>
        <td style="font-size:12px; max-width:260px;">${r.aiResponse}</td>
        <td>
          <select class="status-select status-${(r.status||'Escalado').toLowerCase().replace(/\s+/g,'-')}" data-report-status="${r.id}">
            ${['Escalado','En revisión','Resuelto por IA'].map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('') : `<tr><td colspan="6" class="muted" style="text-align:center; padding:24px;">${S.reports.length ? 'No hay reportes con este estado.' : 'Todavía no hay reportes de usuarios.'}</td></tr>`;

    return `
    ${navbar('admin')}
    <div class="page-content">
      <div class="container">
        <h2 style="font-size:26px; margin-bottom:6px;">Panel de administrador</h2>
        <p class="muted" style="margin-bottom:24px;">Gestiona los sabores, su stock, y consulta los pedidos realizados.</p>
        <div class="tabs">
          <div class="tab ${S.adminTab==='sabores'?'active':''}" data-admintab="sabores">Sabores</div>
          <div class="tab ${S.adminTab==='pedidos'?'active':''}" data-admintab="pedidos">Pedidos</div>
          <div class="tab ${S.adminTab==='reportes'?'active':''}" data-admintab="reportes">Reportes</div>
          <div class="tab ${S.adminTab==='soporte'?'active':''}" data-admintab="soporte">Soporte${S.reports.filter(r=>r.status==='Escalado').length ? ` (${S.reports.filter(r=>r.status==='Escalado').length})` : ''}</div>
        </div>

        ${S.adminTab === 'sabores' ? `
          ${S.showFlavorForm ? `
          <div class="card" style="margin-top:20px;">
            <h3 style="font-size:15.5px; margin-bottom:16px;">${f ? 'Editar sabor' : 'Nuevo sabor'}</h3>
            <div class="row" style="gap:14px; flex-wrap:wrap;">
              <div class="field" style="flex:1; min-width:180px;"><label>Nombre</label><input type="text" id="af-name" value="${f?f.name:''}" placeholder="Ej. Pistache Cremoso"></div>
              <div class="field" style="flex:2; min-width:220px;"><label>Descripción</label><input type="text" id="af-desc" value="${f?f.desc:''}" placeholder="Descripción breve"></div>
            </div>
            <div class="row" style="gap:14px; flex-wrap:wrap; margin-top:4px;">
              <div class="field"><label>Precio</label><input type="text" id="af-price" value="${f?f.price:''}" placeholder="Ej. 19.50"></div>
              <div class="field">
                <label>Categoría</label>
                <select id="af-cat">${CATEGORIES.filter(c=>c!=='Todos').map(c => `<option value="${c}" ${f&&f.cat===c?'selected':''}>${c}</option>`).join('')}</select>
              </div>
              <div class="field"><label>Stock</label><input type="text" id="af-stock" value="${f?f.stock:0}" placeholder="Ej. 10"></div>
              <div class="field" style="flex:1; min-width:160px;"><label>Color (si no hay foto)</label>
                <select id="af-sw">${['sw-raspberry','sw-mint','sw-vanilla','sw-choco','sw-caramel','sw-blueberry','sw-mango','sw-strawberry'].map(sw => `<option value="${sw}" ${f&&f.sw===sw?'selected':''}>${sw.replace('sw-','')}</option>`).join('')}</select>
              </div>
            </div>
            <div class="row" style="margin-top:4px; align-items:center;">
              <div class="field" style="flex:1; min-width:220px;">
                <label>Foto del sabor</label>
                <input type="file" id="af-image" accept="image/*">
                ${!appwriteReady ? '<p class="muted" style="font-size:11.5px; margin-top:4px;">Sin Appwrite configurado, la foto solo se ve mientras la página esté abierta.</p>' : ''}
              </div>
              <div id="af-preview-wrap" style="width:64px; height:64px; flex-shrink:0;">
                ${f ? scoopHtml(f, 'width:64px;height:64px;border-radius:12px;') : ''}
              </div>
            </div>
            ${S.flavorFormError ? `<div class="error-text">${S.flavorFormError}</div>` : ''}
            <div class="row" style="margin-top:8px;">
              <button class="btn btn-primary" id="admin-save-flavor">${f ? 'Guardar cambios' : 'Crear sabor'}</button>
              <button class="btn btn-outline" id="admin-cancel-flavor">Cancelar</button>
            </div>
            ${!appwriteReady ? '<p class="muted" style="font-size:12px; margin-top:10px;">Nota: Appwrite no está configurado todavía, así que este cambio solo se guarda mientras la página esté abierta.</p>' : ''}
          </div>` : ''}

          <div class="card" style="margin-top:20px;">
            <div class="toolbar">
              <h3 style="font-size:15.5px;">Sabores (${FLAVORS.length})</h3>
              <button class="btn btn-primary" id="admin-new-flavor">+ Nuevo sabor</button>
            </div>
            <table>
              <thead><tr><th></th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        ` : S.adminTab === 'pedidos' ? `
          <div class="card" style="margin-top:20px;">
            <h3 style="font-size:15.5px; margin-bottom:16px;">Pedidos de esta sesión (${S.orders.length})</h3>
            <div class="tabs" style="margin-bottom:6px;">
              ${ADMIN_ORDER_TABS.map(t => `<div class="tab ${S.adminOrderTab===t?'active':''}" data-adminordertab="${t}">${t}</div>`).join('')}
            </div>
            <table>
              <thead><tr><th>Pedido</th><th>Fecha</th><th>Artículos</th><th>Cant.</th><th>Total</th><th>Pago</th><th>Estado</th></tr></thead>
              <tbody>${ordersRows}</tbody>
            </table>
          </div>
        ` : S.adminTab === 'reportes' ? `
          <div class="report-head" style="margin-top:20px;">
            <div>
              <h3 style="font-size:15.5px;">Reporte de la semana</h3>
              <p class="muted" style="font-size:12.5px;">${fmtShort(weekStart)} — ${fmtShort(weekEnd)}</p>
            </div>
          </div>
          <div class="stat-grid" style="margin-top:14px;">
            <div class="stat-card"><div class="num" style="color:var(--berry-dark);">${money(stats.earnings)}</div><div class="lbl">Ganancia de la semana</div></div>
            <div class="stat-card"><div class="num">${stats.orderCount}</div><div class="lbl">Pedidos recibidos</div></div>
            <div class="stat-card"><div class="num">${stats.itemsSold}</div><div class="lbl">Postres vendidos</div></div>
            <div class="stat-card"><div class="num">${stats.cancelledCount}</div><div class="lbl">Pedidos cancelados</div></div>
          </div>

          <div class="card" style="margin-top:20px;">
            <h3 style="font-size:15.5px; margin-bottom:18px;">Ganancia por día</h3>
            <div class="week-chart">
              ${stats.byDay.map((val, i) => `
                <div class="week-bar-col">
                  <div class="week-bar-track">
                    <div class="week-bar" style="height:${Math.max(4, (val/maxDay)*100)}%;" title="${money(val)}"></div>
                  </div>
                  <div class="week-bar-val">${val > 0 ? money(val) : '—'}</div>
                  <div class="week-bar-label">${WEEKDAY_LABELS[i]}</div>
                </div>`).join('')}
            </div>
          </div>

          <div class="card" style="margin-top:20px;">
            <h3 style="font-size:15.5px; margin-bottom:16px;">Pedidos de esta semana (${stats.weekOrders.length})</h3>
            <table>
              <thead><tr><th>Pedido</th><th>Fecha</th><th>Artículos</th><th>Cant.</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>${weekRows}</tbody>
            </table>
          </div>
        ` : `
          <div class="card" style="margin-top:20px;">
            <h3 style="font-size:15.5px; margin-bottom:16px;">Reportes de usuarios (${S.reports.length})</h3>
            <p class="muted" style="font-size:12.5px; margin-bottom:14px;">El agente automático ya clasificó y respondió cada uno. Los marcados "Escalado" necesitan que el equipo los revise.</p>
            <div class="tabs" style="margin-bottom:6px;">
              ${SUPPORT_TABS.map(t => `<div class="tab ${S.adminSupportTab===t?'active':''}" data-supporttab="${t}">${t}</div>`).join('')}
            </div>
            <table>
              <thead><tr><th>Asunto</th><th>Categoría</th><th>Severidad</th><th>Usuario</th><th>Respuesta del agente</th><th>Estado</th></tr></thead>
              <tbody>${supportRows}</tbody>
            </table>
          </div>
        `}
      </div>
    </div>`;
  }

  // ---------------- MASTER RENDER ----------------
  function render(){
    let html = '';
    switch(S.view){
      case 'landing': html = viewLanding(); break;
      case 'login': html = viewLogin(); break;
      case 'signup': html = viewSignup(); break;
      case 'congrats': html = viewCongrats(); break;
      case 'home': html = viewHome(); break;
      case 'menu': html = viewMenu(); break;
      case 'detail': html = viewDetail(); break;
      case 'cart': html = viewCart(); break;
      case 'profile': html = viewProfile(); break;
      case 'orders': html = viewOrders(); break;
      case 'help': html = viewHelp(); break;
      case 'admin':
        if(isAdmin()){ html = viewAdmin(); }
        else { S.view = 'home'; toast('No tienes permisos para ver el panel de administrador.'); html = viewHome(); }
        break;
      default: html = viewLanding();
    }
    root.innerHTML = html;
    attach();
    maybeNotifyAdminLowStock();
  }

  // ---------------- EVENT WIRING ----------------
  function attach(){
    root.querySelectorAll('[data-goto]').forEach(el => {
      el.addEventListener('click', () => goTo(el.dataset.goto));
    });

    root.querySelectorAll('[data-cat]').forEach(el => {
      el.addEventListener('click', () => { S.activeCategory = el.dataset.cat; render(); });
    });

    root.querySelectorAll('[data-catgoto]').forEach(el => {
      el.addEventListener('click', () => { S.activeCategory = el.dataset.catgoto; goTo('menu'); });
    });

    root.querySelectorAll('[data-toast]').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); toast(el.dataset.toast); });
    });

    const heroMenuToggle = document.getElementById('hero-menu-toggle');
    if(heroMenuToggle) heroMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      S.landingMenuOpen = !S.landingMenuOpen;
      render();
    });

    const notifBell = document.getElementById('notif-bell-btn');
    if(notifBell) notifBell.addEventListener('click', (e) => {
      e.stopPropagation();
      S.notifOpen = !S.notifOpen;
      render();
    });

    root.querySelectorAll('[data-notif-flavor]').forEach(el => {
      el.addEventListener('click', () => {
        S.notifOpen = false;
        S.adminTab = 'sabores';
        S.editingFlavor = flavorById(el.dataset.notifFlavor);
        S.flavorFormError = '';
        S.showFlavorForm = true;
        goTo('admin');
      });
    });

    root.querySelectorAll('[data-detail]').forEach(el => {
      el.addEventListener('click', () => {
        S.selectedFlavorId = el.dataset.detail;
        S.selectedSize = 'Mediano';
        S.selectedQty = 1;
        S.prevView = S.view;
        S.view = 'detail';
        render();
      });
    });

    root.querySelectorAll('[data-size]').forEach(el => {
      el.addEventListener('click', () => { S.selectedSize = el.dataset.size; render(); });
    });

    root.querySelectorAll('[data-qty]').forEach(el => {
      el.addEventListener('click', () => {
        const d = parseInt(el.dataset.qty, 10);
        const f = flavorById(S.selectedFlavorId);
        const available = f ? Math.max(0, f.stock - cartQtyForFlavor(f.id)) : 9;
        const max = Math.min(9, available);
        if(max <= 0) return; // no hay más inventario disponible para este sabor
        S.selectedQty = Math.max(1, Math.min(max, S.selectedQty + d));
        render();
      });
    });

    const addBtn = document.getElementById('add-to-cart');
    if(addBtn) addBtn.addEventListener('click', () => {
      const f = flavorById(S.selectedFlavorId);
      const available = f ? Math.max(0, f.stock - cartQtyForFlavor(f.id)) : 0;
      if(!f || available <= 0){
        toast('Ya no hay inventario disponible de este sabor.');
        render();
        return;
      }
      const qtyToAdd = Math.min(S.selectedQty, available);
      S.cart.push({ flavorId:S.selectedFlavorId, size:S.selectedSize, qty:qtyToAdd });
      toast(qtyToAdd < S.selectedQty ? `Solo agregamos ${qtyToAdd}, es el inventario disponible` : 'Agregado al carrito');
      goTo(S.prevView === 'home' ? 'home' : 'menu');
    });

    root.querySelectorAll('[data-remove]').forEach(el => {
      el.addEventListener('click', () => {
        S.cart.splice(parseInt(el.dataset.remove,10), 1);
        render();
      });
    });

    root.querySelectorAll('[data-payment]').forEach(el => {
      el.addEventListener('click', () => { S.selectedPayment = el.dataset.payment; render(); });
    });

    const checkoutBtn = document.getElementById('checkout-btn');
    if(checkoutBtn) checkoutBtn.addEventListener('click', async () => {
      if(S.cart.length === 0) return;
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Verificando inventario...';

      // Traemos el stock más reciente antes de confirmar, por si alguien más compró
      // el mismo sabor mientras el carrito estaba abierto.
      if(appwriteReady){
        try{ await loadFlavorsFromAppwrite(); }catch(e){ /* seguimos con los datos locales */ }
      }

      // Sumamos lo pedido por sabor y lo comparamos contra el stock real disponible.
      const neededByFlavor = {};
      S.cart.forEach(c => { neededByFlavor[c.flavorId] = (neededByFlavor[c.flavorId]||0) + c.qty; });

      const shortages = [];
      for(const flavorId in neededByFlavor){
        const f = flavorById(flavorId);
        const stock = f ? f.stock : 0;
        if(stock < neededByFlavor[flavorId]){
          shortages.push({ flavorId, name: f ? f.name : 'este sabor', stock });
        }
      }

      if(shortages.length){
        // Ajustamos el carrito a lo que realmente hay disponible en vez de dejar pasar el pedido.
        shortages.forEach(({flavorId, stock}) => {
          let remaining = stock;
          S.cart = S.cart.map(c => {
            if(c.flavorId !== flavorId) return c;
            const take = Math.min(c.qty, remaining);
            remaining -= take;
            return { ...c, qty: take };
          }).filter(c => c.qty > 0);
        });
        const names = shortages.map(s => s.stock > 0 ? `${s.name} (quedan ${s.stock})` : `${s.name} (agotado)`).join(', ');
        toast('No había suficiente inventario de: ' + names + '. Ajustamos tu carrito.');
        render();
        return;
      }

      const total = cartSubtotal() + DELIVERY_FEE;
      const qty = cartTotalQty();
      const itemsText = S.cart.map(c => flavorById(c.flavorId).name).join(', ');

      // Restar stock de cada sabor comprado
      for(const c of S.cart){
        const f = flavorById(c.flavorId);
        if(!f) continue;
        f.stock = Math.max(0, f.stock - c.qty);
        await updateFlavorRow(f.id, { stock: f.stock });
      }

      const orderData = {
        itemsText,
        qty,
        total,
        statusLabel: 'Procesando',
        paymentMethod: S.selectedPayment,
        userEmail: S.user?.email || '',
      };
      const savedRow = await createOrderRow(orderData);
      S.orders.unshift({
        id: savedRow ? savedRow.$id : String(1000 + S.orders.length + 1),
        date: 'Hoy',
        createdAt: savedRow ? savedRow.$createdAt : new Date().toISOString(),
        ...orderData,
      });
      S.cart = [];
      toast('¡Pedido realizado con éxito! Pago: ' + S.selectedPayment);
      goTo('orders');
    });

    root.querySelectorAll('[data-ordertab]').forEach(el => {
      el.addEventListener('click', () => { S.orderTab = el.dataset.ordertab; render(); });
    });

    // ---------- Centro de ayuda: reportes ----------
    const openReportBtn = document.getElementById('open-report-form');
    if(openReportBtn) openReportBtn.addEventListener('click', () => {
      S.showReportForm = true; S.reportFormError = ''; render();
    });

    const cancelReportBtn = document.getElementById('cancel-report');
    if(cancelReportBtn) cancelReportBtn.addEventListener('click', () => {
      S.showReportForm = false; S.reportFormError = ''; render();
    });

    const submitReportBtn = document.getElementById('submit-report');
    if(submitReportBtn) submitReportBtn.addEventListener('click', async () => {
      const subject = document.getElementById('rp-subject').value.trim();
      const description = document.getElementById('rp-desc').value.trim();
      if(!subject || !description){
        S.reportFormError = 'Cuéntanos el asunto y describe qué pasó para poder ayudarte.';
        render();
        return;
      }
      S.reportFormError = '';

      // El agente clasifica el reporte y genera una primera respuesta al instante.
      const analysis = analyzeReport(subject, description);
      const reportData = {
        subject, description,
        category: analysis.category,
        severity: analysis.severity,
        status: analysis.status,
        userEmail: S.user?.email || '',
        aiResponse: analysis.response,
      };
      const savedRow = await createReportRow(reportData);
      S.reports.unshift({
        id: savedRow ? savedRow.$id : String(9000 + S.reports.length + 1),
        createdAt: savedRow ? savedRow.$createdAt : new Date().toISOString(),
        ...reportData,
      });
      S.lastReportReply = analysis.response;
      S.showReportForm = false;
      toast('¡Reporte enviado! El agente ya lo revisó.');
      render();
    });

    const doLogin = document.getElementById('do-login');
    if(doLogin) doLogin.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      const pass = document.getElementById('login-pass').value.trim();
      if(!email || !pass){ S.loginError = 'Ingresa tu email y contraseña.'; render(); return; }
      S.loginError = '';
      if(projectReady){
        try{
          await account.createEmailPasswordSession(email, pass);
          const me = await account.get();
          S.user = { name: me.name, email: me.email };
          await loadOrdersFromAppwrite();
          await loadReportsFromAppwrite();
          goTo('home');
        }catch(e){
          S.loginError = 'Correo o contraseña incorrectos.';
          render();
        }
      } else {
        if(!S.user) S.user = { name:'Estefanía', email };
        goTo('home');
      }
    });

    const doSignup = document.getElementById('do-signup');
    if(doSignup) doSignup.addEventListener('click', async () => {
      const name = document.getElementById('su-name').value.trim();
      const email = document.getElementById('su-email').value.trim();
      const pass = document.getElementById('su-pass').value.trim();
      if(!name || !email || !pass){ S.signupError = 'Completa todos los campos para continuar.'; render(); return; }
      S.signupError = '';
      if(projectReady){
        try{
          await account.create(Appwrite.ID.unique(), email, pass, name);
          await account.createEmailPasswordSession(email, pass);
          S.user = { name, email };
          await loadOrdersFromAppwrite();
          goTo('congrats');
        }catch(e){
          S.signupError = e.message || 'No se pudo crear la cuenta.';
          render();
        }
      } else {
        S.user = { name, email };
        goTo('congrats');
      }
    });

    const doLogout = document.getElementById('do-logout');
    if(doLogout) doLogout.addEventListener('click', async () => {
      if(projectReady){ try{ await account.deleteSession('current'); }catch(e){} }
      S.user = null; S.cart = []; S.orders = []; S.landingMenuOpen = false;
      goTo('landing');
    });

    // ---------- Admin ----------
    root.querySelectorAll('[data-admintab]').forEach(el => {
      el.addEventListener('click', () => { S.adminTab = el.dataset.admintab; S.showFlavorForm = false; S.editingFlavor = null; render(); });
    });

    root.querySelectorAll('[data-adminordertab]').forEach(el => {
      el.addEventListener('click', () => { S.adminOrderTab = el.dataset.adminordertab; render(); });
    });

    root.querySelectorAll('[data-order-status]').forEach(el => {
      el.addEventListener('change', async () => {
        const order = S.orders.find(o => o.id === el.dataset.orderStatus);
        if(order){
          order.statusLabel = el.value;
          await updateOrderRow(order.id, { statusLabel: el.value });
          toast(`Pedido #${order.id} marcado como ${el.value}.`);
        }
        render();
      });
    });

    root.querySelectorAll('[data-supporttab]').forEach(el => {
      el.addEventListener('click', () => { S.adminSupportTab = el.dataset.supporttab; render(); });
    });

    root.querySelectorAll('[data-report-status]').forEach(el => {
      el.addEventListener('change', async () => {
        const rep = S.reports.find(r => r.id === el.dataset.reportStatus);
        if(rep){
          rep.status = el.value;
          await updateReportRow(rep.id, { status: el.value });
          toast(`Reporte "${rep.subject}" marcado como ${el.value}.`);
        }
        render();
      });
    });

    const newFlavorBtn = document.getElementById('admin-new-flavor');
    if(newFlavorBtn) newFlavorBtn.addEventListener('click', () => {
      S.editingFlavor = null; S.flavorFormError = ''; S.showFlavorForm = true; render();
    });

    root.querySelectorAll('[data-admin-edit]').forEach(el => {
      el.addEventListener('click', () => {
        S.editingFlavor = flavorById(el.dataset.adminEdit);
        S.flavorFormError = '';
        S.showFlavorForm = true;
        render();
      });
    });

    root.querySelectorAll('[data-admin-delete]').forEach(el => {
      el.addEventListener('click', async () => {
        if(!confirm('¿Eliminar este sabor? Esta acción no se puede deshacer.')) return;
        const id = el.dataset.adminDelete;
        await deleteFlavorRow(id);
        const idx = FLAVORS.findIndex(fl => fl.id === id);
        if(idx > -1) FLAVORS.splice(idx, 1);
        toast('Sabor eliminado.');
        render();
      });
    });

    const cancelFlavorBtn = document.getElementById('admin-cancel-flavor');
    if(cancelFlavorBtn) cancelFlavorBtn.addEventListener('click', () => {
      S.showFlavorForm = false; S.editingFlavor = null; render();
    });

    const imageInput = document.getElementById('af-image');
    if(imageInput) imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];
      const wrap = document.getElementById('af-preview-wrap');
      if(!file || !wrap) return;
      wrap.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;display:block;">`;
    });

    const saveFlavorBtn = document.getElementById('admin-save-flavor');
    if(saveFlavorBtn) saveFlavorBtn.addEventListener('click', async () => {
      const name = document.getElementById('af-name').value.trim();
      const desc = document.getElementById('af-desc').value.trim();
      const price = parseFloat(document.getElementById('af-price').value);
      const cat = document.getElementById('af-cat').value;
      const stock = parseInt(document.getElementById('af-stock').value, 10);
      const sw = document.getElementById('af-sw').value;
      const imageFile = document.getElementById('af-image').files[0];

      if(!name || !desc || isNaN(price) || price < 0 || isNaN(stock) || stock < 0){
        S.flavorFormError = 'Revisa los campos: nombre, descripción, precio y stock son obligatorios y deben ser válidos.';
        render();
        return;
      }
      S.flavorFormError = '';
      saveFlavorBtn.disabled = true;
      saveFlavorBtn.textContent = 'Guardando...';

      const data = { name, desc, price, cat, stock, sw };
      const uploaded = await uploadFlavorImage(imageFile);
      if(uploaded && uploaded.imageId) data.imageId = uploaded.imageId;

      if(S.editingFlavor){
        await updateFlavorRow(S.editingFlavor.id, data);
        Object.assign(S.editingFlavor, data);
        if(uploaded) S.editingFlavor.imageUrl = uploaded.imageUrl;
        toast('Sabor actualizado.');
      } else {
        const created = await createFlavorRow(data);
        FLAVORS.push({ id: created ? created.$id : ('local-' + Date.now()), imageUrl: uploaded ? uploaded.imageUrl : null, ...data });
        toast('Sabor creado.');
      }
      S.showFlavorForm = false; S.editingFlavor = null;
      render();
    });
  }

  // ============================================================
  // CHAT WIDGET — asistente flotante estilo ventana emergente
  // (vive fuera de #app para no perderse al cambiar de pantalla)
  // ============================================================
  const chatIcons = {
    bubble: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.5 8.5 0 0 1-3.9-.9L3 20l1-5.6a8.3 8.3 0 0 1-1-4A8.4 8.4 0 0 1 11.4 2h.2A8.4 8.4 0 0 1 21 11.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
    cone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M8.5 12 12 21l3.5-9"/></svg>',
  };

  const QUICK_OPTIONS = ['Horarios', 'Envíos', 'Sabores', 'Formas de pago', 'Cómo pedir'];

  let chat = {
    open: false,
    showTeaser: false,
    messages: [
      { from:'bot', text:'¡Hola! Soy Dulce 🍨, tu asistente de Delicious. ¿En qué te puedo ayudar hoy?', quick:QUICK_OPTIONS },
    ],
  };
  let chatRoot;

  function botReply(rawText){
    const t = rawText.toLowerCase();
    if(/horario|hora|abren|cierran/.test(t)){
      return { text:'Abrimos todos los días de 10:00 a.m. a 9:00 p.m., ¡incluso festivos! 🍦' };
    }
    if(/env[ií]o|domicilio|entrega|delivery/.test(t)){
      return { text:'Sí, hacemos entregas a domicilio en un radio de 5 km. El envío cuesta $3.00 y llega en 25-40 minutos aproximadamente.' };
    }
    if(/sabor|menu|menú|helado|precio/.test(t)){
      return { text:'Tenemos sabores Frutales, Cremosos y de Chocolate 🍓🍫 ¿Quieres ver el menú completo?', quick:['Ver menú'] };
    }
    if(/pago|tarjeta|efectivo/.test(t)){
      return { text:'Aceptamos tarjeta de crédito/débito en línea y efectivo contra entrega.' };
    }
    if(/pedid|pedir|orden|comprar|c[oó]mo pido/.test(t)){
      return { text:'Para pedir: inicia sesión o crea una cuenta, elige tus sabores favoritos en el Menú, agrégalos al carrito ¡y listo! 🛒', quick:['Ver menú'] };
    }
    if(/asesor|humano|persona|ayuda real/.test(t)){
      return { text:'Claro, escríbenos a hola@delicious.com y un asesor te contactará con gusto.' };
    }
    if(/gracias/.test(t)){
      return { text:'¡Con mucho gusto! Aquí estoy si necesitas algo más 🍨' };
    }
    if(/hola|buenas|hey/.test(t)){
      return { text:'¡Hola de nuevo! ¿Sobre qué te gustaría saber más?', quick:QUICK_OPTIONS };
    }
    return { text:'No estoy segura de haber entendido 😅 Puedo ayudarte con horarios, envíos, sabores, formas de pago o cómo hacer un pedido.', quick:QUICK_OPTIONS };
  }

  function sendChatMessage(text){
    const clean = text.trim();
    if(!clean) return;
    chat.messages.push({ from:'user', text:clean });
    if(clean === 'Ver menú'){
      chat.messages.push({ from:'bot', text:'¡Perfecto! Te llevo al menú 🍧' });
      renderChat();
      setTimeout(() => { chat.open = false; renderChat(); goTo('menu'); }, 500);
      return;
    }
    renderChat();
    setTimeout(() => {
      const reply = botReply(clean);
      chat.messages.push({ from:'bot', text:reply.text, quick:reply.quick });
      renderChat();
    }, 450);
  }

  function renderChat(){
    if(!chatRoot) return;
    const bubbles = chat.messages.map(m => {
      const quick = m.quick ? `<div class="chat-quick">${m.quick.map(q => `<button data-chatquick="${q}">${q}</button>`).join('')}</div>` : '';
      return `<div class="chat-row ${m.from}"><div class="chat-bubble">${m.text}</div>${quick}</div>`;
    }).join('');

    chatRoot.innerHTML = `
      ${(!chat.open && chat.showTeaser) ? `
      <div class="chat-teaser" id="chat-teaser">
        <span class="teaser-close" id="chat-teaser-close">×</span>
        ¡Hola! ¿En qué te puedo ayudar? 👋
      </div>` : ''}
      ${chat.open ? `
      <div class="chat-window">
        <div class="chat-header">
          <div class="bot-avatar">${chatIcons.cone}</div>
          <div class="bot-info">
            <div class="bot-name">Dulce · Asistente Delicious</div>
            <div class="bot-status"><span class="dot"></span>En línea</div>
          </div>
          <div class="chat-close" id="chat-close-btn">${chatIcons.close}</div>
        </div>
        <div class="chat-body" id="chat-body">${bubbles}</div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="Escribe tu pregunta...">
          <button class="chat-send-btn" id="chat-send-btn">${chatIcons.send}</button>
        </div>
      </div>` : ''}
      <button class="chat-fab" id="chat-fab-btn">
        ${chat.open ? chatIcons.close : chatIcons.bubble}
        ${(!chat.open && chat.messages.length <= 1) ? '<span class="fab-dot"></span>' : ''}
      </button>
    `;

    const fab = document.getElementById('chat-fab-btn');
    if(fab) fab.onclick = () => {
      chat.open = !chat.open;
      chat.showTeaser = false;
      renderChat();
      if(chat.open){
        const body = document.getElementById('chat-body');
        if(body) body.scrollTop = body.scrollHeight;
        const input = document.getElementById('chat-input');
        if(input) input.focus();
      }
    };
    const closeBtn = document.getElementById('chat-close-btn');
    if(closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); chat.open = false; renderChat(); };
    const teaserClose = document.getElementById('chat-teaser-close');
    if(teaserClose) teaserClose.onclick = (e) => { e.stopPropagation(); chat.showTeaser = false; renderChat(); };

    root_chat_attachSend();

    chatRoot.querySelectorAll('[data-chatquick]').forEach(btn => {
      btn.onclick = () => sendChatMessage(btn.dataset.chatquick);
    });

    const body = document.getElementById('chat-body');
    if(body) body.scrollTop = body.scrollHeight;
  }

  function root_chat_attachSend(){
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if(!input || !sendBtn) return;
    const doSend = () => { sendChatMessage(input.value); input.value = ''; };
    sendBtn.onclick = doSend;
    input.onkeydown = (e) => { if(e.key === 'Enter') doSend(); };
  }

  function initChatWidget(){
    chatRoot = document.createElement('div');
    chatRoot.id = 'chat-widget-root';
    document.body.appendChild(chatRoot);
    renderChat();
    setTimeout(() => { if(!chat.open){ chat.showTeaser = true; renderChat(); } }, 1800);
    setTimeout(() => { if(!chat.open){ chat.showTeaser = false; renderChat(); } }, 9000);
  }

  // ---------------- STARTUP ----------------
  async function init(){
    initChatWidget();
    document.addEventListener('click', (e) => {
      if(S.notifOpen && !e.target.closest('#notif-bell-btn') && !e.target.closest('.notif-dropdown')){
        S.notifOpen = false;
        render();
      }
    });
    await Promise.all([ restoreSession(), loadFlavorsFromAppwrite(), loadOrdersFromAppwrite(), loadReportsFromAppwrite() ]);
    render();
  }
  init();
})();