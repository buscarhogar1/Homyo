window.INCIDENCIAS=[
{id:'INC-2041',title:'Posible anuncio duplicado',type:'Duplicado',prio:'Alta',status:'Abierta',origin:'Reporte de usuario',opened:'hace 2 h',assignee:'Sin asignar',
report:{text:'He visto este mismo piso de Sagasta 20 publicado por dos agencias distintas, con precios diferentes. No sé cuál es el real ni a quién tengo que llamar.',by:'Marta G. · usuaria registrada · 29 sep, 09:14',initials:'MG'},
evidence:{title:'Comparativa de anuncios',kind:'compare',cols:[
{head:'Anuncio A · Áurea Inmobiliaria',rows:{'Dirección':'C/ Sagasta 20, 3.º','Superficie':'<span class="match">96 m²</span>','Precio':'545.000 €','Ref. catastral':'<span class="match">0847…AZ</span>','Fotos':'<span class="match">14 · 11 coinciden</span>','Publicado':'12 sep 2026'}},
{head:'Anuncio B · Domus Capital',rows:{'Dirección':'C/ Sagasta 20','Superficie':'<span class="match">96 m²</span>','Precio':'529.000 €','Ref. catastral':'<span class="match">0847…AZ</span>','Fotos':'<span class="match">12 · 11 coinciden</span>','Publicado':'24 sep 2026'}}],
note:'Misma referencia catastral y 11 fotos idénticas. Puede ser una vivienda en exclusiva compartida o un anuncio sin mandato de venta.'},
listing:{'Vivienda':'Piso en Calle Sagasta 20','Zona':'Chamberí · Madrid','Estado':'<span class="pill ok">Publicado (x2)</span>','Visitas 7 d':'312 entre ambos'},
agency:{name:'Áurea Inmobiliaria y Domus Capital',href:'admin-profesional-detalle.html',rows:{'Anuncio A':'Áurea Inmobiliaria · verificada','Anuncio B':'Domus Capital · verificada','Incidencias previas':'Ninguna en 90 días'}},
history:[{t:'Detección cruzada confirmada',d:'Sistema · ref. catastral coincide · hace 2 h'},{t:'Reporte recibido',d:'Marta G. · 29 sep, 09:14'}],
outcomes:[
{id:'mandato',label:'Pedir nota de encargo a ambas',desc:'Se solicita el mandato de venta; el anuncio sin él se retira en 48 h.',status:'En curso',result:'Se ha pedido la nota de encargo a ambas agencias. Plazo: 48 h.'},
{id:'fusionar',label:'Unificar en un solo anuncio',desc:'Exclusiva compartida: se muestra una ficha con las dos agencias.',status:'Resuelta',result:'Anuncios unificados en una sola ficha con ambas agencias.'},
{id:'retirar',label:'Retirar el anuncio B',desc:'El más reciente no acredita mandato.',status:'Resuelta',result:'Anuncio de Domus Capital retirado por duplicado.'},
{id:'descartar',label:'Descartar reporte',desc:'No hay duplicado real.',status:'Descartada',result:'Reporte descartado tras la revisión.'}]},

{id:'INC-2038',title:'Fotos no corresponden a la vivienda',type:'Contenido',prio:'Media',status:'Abierta',origin:'Reporte de usuario',opened:'ayer',assignee:'Sin asignar',
report:{text:'Fui a la visita y el loft no se parece a las fotos: la cocina es otra y no tiene la terraza que aparece. Creo que las imágenes son de otro piso.',by:'Javier R. · visitó la vivienda · 28 sep, 18:40',initials:'JR'},
evidence:{title:'Búsqueda inversa de imágenes',kind:'photos',note:'3 de 9 fotos aparecen en un banco de imágenes y en un anuncio de otra ciudad desde 2024.'},
listing:{'Vivienda':'Loft junto al puerto','Zona':'Puerto · Málaga','Estado':'<span class="pill ok">Publicado</span>','Fotos':'9 · 3 sospechosas'},
agency:{name:'Ribera Homes',rows:{'Agencia':'Ribera Homes','Estado':'Verificada','Incidencias previas':'1 · fotos (mar 2026)'}},
history:[{t:'Búsqueda inversa completada',d:'Sistema · 3 coincidencias externas · ayer'},{t:'Reporte recibido',d:'Javier R. · 28 sep, 18:40'}],
outcomes:[
{id:'corregir',label:'Pedir fotos reales en 72 h',desc:'Se ocultan las 3 fotos y se avisa a la agencia.',status:'En curso',result:'Fotos ocultas; la agencia tiene 72 h para subir fotos reales.'},
{id:'retirar',label:'Retirar el anuncio',desc:'Reincidencia: segunda vez en 6 meses.',status:'Resuelta',result:'Anuncio retirado por fotos que no corresponden. Aviso formal a Ribera Homes.'},
{id:'descartar',label:'Descartar reporte',desc:'Las fotos sí son de la vivienda.',status:'Descartada',result:'Reporte descartado tras la revisión.'}]},

{id:'INC-2036',title:'Precio sospechosamente bajo',type:'Fraude',prio:'Alta',status:'Abierta',origin:'Detección automática',opened:'hace 5 h',assignee:'Sin asignar',
report:{text:'El precio publicado está un 60 % por debajo de la mediana de la zona para viviendas comparables. La cuenta se creó hace 4 días y pide una señal por transferencia antes de la visita.',by:'Motor de detección Homyo · 29 sep, 06:02',initials:'H'},
evidence:{title:'Precio frente a la zona',kind:'price',bars:[
{l:'Mediana zona Centro (€/m²)',v:'6.150 €',w:100},{l:'Rango habitual comparables',v:'5.400 – 7.100 €',w:88,c:'gold'},{l:'Este anuncio',v:'2.460 €',w:40,c:'bad'}],
note:'Señales adicionales: cuenta nueva, sin CIF validado, texto copiado de otro anuncio, petición de pago previo.'},
listing:{'Vivienda':'Ático Centro','Zona':'Centro · Madrid','Estado':'<span class="pill ok">Publicado</span>','Precio':'189.000 € · 77 m²'},
agency:{name:'el anunciante',rows:{'Cuenta':'Particular · creada hace 4 días','CIF / DNI':'<span class="pill warnp">Sin validar</span>','Otros anuncios':'2 · mismo patrón'}},
history:[{t:'Señales de fraude detectadas',d:'Sistema · 4 señales · hace 5 h'}],
outcomes:[
{id:'suspender',label:'Retirar y suspender la cuenta',desc:'Se retiran los 3 anuncios y se bloquea el acceso.',status:'Resuelta',result:'Cuenta suspendida y 3 anuncios retirados por fraude.'},
{id:'verificar',label:'Pedir verificación de identidad',desc:'Anuncios ocultos hasta validar DNI y nota simple.',status:'En curso',result:'Anuncios ocultos a la espera de verificación.'},
{id:'descartar',label:'Falso positivo',desc:'El precio está justificado (p. ej. nuda propiedad).',status:'Descartada',result:'Marcado como falso positivo.'}]},

{id:'INC-2029',title:'Error al subir plano (formato)',type:'Técnico',prio:'Media',status:'En curso',origin:'Soporte',opened:'hace 2 días',assignee:'Equipo técnico',
report:{text:'Intentamos subir el plano en PDF desde el panel y da error. Con JPG funciona pero pierde calidad. Nos pasa en todos los anuncios desde el lunes.',by:'Hogar y Terrazas · vía soporte · 27 sep, 11:20',initials:'HT'},
evidence:{title:'Registro del error',kind:'log',text:'2026-09-27 11:18:42  POST /api/listings/8812/plans\n  file: plano_planta.pdf (4,8 MB)\n  status: 415 Unsupported Media Type\n  detail: mime "application/pdf" not in allowed list\n\n2026-09-27 11:19:10  retry → 415\n2026-09-28 09:02:55  3 agencias más con el mismo error',note:'Tras el despliegue del 26 sep el PDF quedó fuera de los formatos permitidos. Corrección en revisión.'},
listing:{'Afecta a':'Subida de planos','Agencias':'4 afectadas','Anuncios':'11 sin plano'},
agency:{name:'Hogar y Terrazas',rows:{'Agencia':'Hogar y Terrazas','Contacto':'soporte@hogaryterrazas.es','Canal':'Soporte'}},
history:[{t:'Corrección en revisión',d:'Equipo técnico · hace 3 h'},{t:'Causa identificada',d:'Diego Ortega · ayer'},{t:'Asignada a equipo técnico',d:'27 sep, 12:05'},{t:'Ticket de soporte recibido',d:'27 sep, 11:20'}],
outcomes:[
{id:'fix',label:'Marcar como solucionado',desc:'La corrección está desplegada y verificada.',status:'Resuelta',result:'Corrección desplegada. Las agencias afectadas ya pueden subir PDF.'},
{id:'workaround',label:'Enviar solución temporal',desc:'Indicar a las agencias que usen PNG a 300 ppp.',status:'En curso',result:'Solución temporal enviada a las 4 agencias.'}]},

{id:'INC-2024',title:'Datos de contacto en la descripción',type:'Norma',prio:'Baja',status:'En curso',origin:'Detección automática',opened:'hace 3 días',assignee:'Diego Ortega',
report:{text:'La descripción del anuncio incluye un teléfono y un correo externos, lo que desvía los contactos fuera de Homyo.',by:'Motor de detección Homyo · 26 sep, 16:45',initials:'H'},
evidence:{title:'Fragmento de la descripción',kind:'text',html:'…chalet independiente con jardín de 800 m², piscina y garaje para tres coches. Para más información o visitas llame directamente al <span class="hl">612 34 56 78</span> o escriba a <span class="hl">ventas.aravaca@gmail.com</span>. Disponible para entrar a vivir…',note:'Las normas de publicación no permiten datos de contacto en la descripción; el contacto se gestiona desde el botón del anuncio.'},
listing:{'Vivienda':'Chalet en Aravaca','Zona':'Aravaca · Madrid','Estado':'<span class="pill ok">Publicado</span>','Precio':'1.290.000 €'},
agency:{name:'Domus Capital',rows:{'Agencia':'Domus Capital','Estado':'Verificada','Incidencias previas':'Ninguna'}},
history:[{t:'Aviso enviado a la agencia',d:'Diego Ortega · hace 2 días'},{t:'Detección automática',d:'Sistema · 26 sep, 16:45'}],
outcomes:[
{id:'editar',label:'Eliminar los datos de contacto',desc:'Homyo edita la descripción y avisa a la agencia.',status:'Resuelta',result:'Datos de contacto eliminados de la descripción.'},
{id:'esperar',label:'Esperar corrección de la agencia',desc:'Recordatorio con plazo de 24 h.',status:'En curso',result:'Recordatorio enviado; plazo de 24 h.'}]},

{id:'INC-2011',title:'Anuncio ya vendido sigue activo',type:'Disponibilidad',prio:'Baja',status:'Resuelta',origin:'Reporte de usuario',opened:'hace 6 días',assignee:'Lucía Martín',
report:{text:'Llamé por el piso de Alcalá 211 y me dijeron que se vendió hace un mes, pero sigue apareciendo como disponible.',by:'Pablo S. · usuario registrado · 23 sep, 10:05',initials:'PS'},
evidence:{title:'Comprobación',kind:'text',html:'La agencia confirma la venta el 25 ago 2026. Último cambio en el anuncio: 14 jul 2026 (más de 60 días sin actualizar).',note:'El anuncio se retiró y la agencia recibió un recordatorio sobre la actualización de disponibilidad.'},
listing:{'Vivienda':'Piso en Calle Alcalá 211','Zona':'Salamanca · Madrid','Estado':'<span class="pill neutral">Retirado</span>','Precio':'398.000 €'},
agency:{name:'Áurea Inmobiliaria',href:'admin-profesional-detalle.html',rows:{'Agencia':'Áurea Inmobiliaria','Estado':'Verificada · fundadora','Actualizados &lt; 60 d':'83 %'}},
resolvedNote:'Anuncio retirado el 24 sep. Usuario y agencia notificados.',
history:[{t:'Anuncio retirado',d:'Lucía Martín · 24 sep, 09:30'},{t:'Venta confirmada por la agencia',d:'Áurea Inmobiliaria · 23 sep, 17:12'},{t:'Reporte recibido',d:'Pablo S. · 23 sep, 10:05'}],
outcomes:[{id:'retirar',label:'Retirar el anuncio',desc:'Vivienda vendida.',status:'Resuelta',result:'Anuncio retirado el 24 sep. Usuario y agencia notificados.'}]}
];
window.incState=function(id){
const inc=window.INCIDENCIAS.find(x=>x.id===id);
let s={};try{s=JSON.parse(localStorage.getItem('homyo_inc_'+id))||{};}catch(e){}
return Object.assign({status:inc.status,assignee:inc.assignee,log:[],outcome:inc.status==='Resuelta'?inc.outcomes[0].id:null,resolution:''},s);
};
window.saveIncState=function(id,s){try{localStorage.setItem('homyo_inc_'+id,JSON.stringify(s));}catch(e){}};
