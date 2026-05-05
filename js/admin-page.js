import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where, orderBy, doc, getDoc,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const moneyFormatter = new Intl.NumberFormat("es-CO", { style:"currency", currency:"USD", maximumFractionDigits:0 });
const privateGate = document.getElementById("privateGate");
const adminDashboard = document.getElementById("adminDashboard");
const sessionInfo = document.getElementById("sessionInfo");
const tripForm = document.getElementById("tripForm");
const tripFormMessage = document.getElementById("tripFormMessage");
const tripList = document.getElementById("tripList");
const clearTripsBtn = document.getElementById("clearTripsBtn");
const exportTripsBtn = document.getElementById("exportTripsBtn");
const logoutBtn = document.getElementById("logoutBtn");
const metricTrips = document.getElementById("metricTrips");
const metricActive = document.getElementById("metricActive");
const metricActivities = document.getElementById("metricActivities");
const metricBudget = document.getElementById("metricBudget");
const selectedTripTitle = document.getElementById("selectedTripTitle");
const selectedTripCode = document.getElementById("selectedTripCode");
const selectedTripMeta = document.getElementById("selectedTripMeta");
const editStatus = document.getElementById("editStatus");
const editLastLocation = document.getElementById("editLastLocation");
const editMapQuery = document.getElementById("editMapQuery");
const adminMap = document.getElementById("adminMap");
const mapCaption = document.getElementById("mapCaption");
const activityList = document.getElementById("activityList");
const transportBudget = document.getElementById("transportBudget");
const hotelBudget = document.getElementById("hotelBudget");
const foodBudget = document.getElementById("foodBudget");
const activitiesBudget = document.getElementById("activitiesBudget");
const outTransport = document.getElementById("outTransport");
const outHotel = document.getElementById("outHotel");
const outFoodActivities = document.getElementById("outFoodActivities");
const outBudgetTotal = document.getElementById("outBudgetTotal");
const personalNotes = document.getElementById("personalNotes");
const statusForm = document.getElementById("statusForm");
const activityForm = document.getElementById("activityForm");
const budgetForm = document.getElementById("budgetForm");
const notesForm = document.getElementById("notesForm");
const destinationForm = document.getElementById("destinationForm");
const recommendationGrid = document.getElementById("recommendationGrid");
const metricContacts = document.getElementById("metricContacts");
const refreshRequestsBtn = document.getElementById("refreshRequestsBtn");
const contactRequestsList = document.getElementById("contactRequestsList");
const subscriptionRequestsList = document.getElementById("subscriptionRequestsList");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let currentProfile = null;
let viajes = [];
let destinos = [];
let contactos = [];
let suscripciones = [];
let selectedId = null;

function esc(text){ return String(text ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function clean(text){ return String(text || "").trim(); }
function mapUrl(q){ return "https://www.google.com/maps?q=" + encodeURIComponent(q || "Europa turismo") + "&output=embed"; }
function id(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function budget(t){ return Number(t.transport||0)+Number(t.hotel||0)+Number(t.food||0)+Number(t.activitiesCost||0); }
function fmtDate(d){ if(!d) return "Sin fecha"; const date = new Date(d+"T00:00:00"); return isNaN(date) ? d : date.toLocaleDateString("es-CO", {year:"numeric", month:"short", day:"numeric"}); }
function fmtDateTime(value){
  if(!value) return "Sin fecha";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return isNaN(date) ? "Sin fecha" : date.toLocaleString("es-CO", {year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
}
function statusClass(s){ s=String(s||"").toLowerCase(); if(s.includes("organ"))return "organizacion"; if(s.includes("reserv"))return "reservado"; if(s.includes("curso"))return "curso"; if(s.includes("final"))return "finalizado"; return "planear"; }
function makeCode(dest){ const slug = clean(dest).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,14).toUpperCase() || "VIAJE"; return `WT-${slug}-${Math.floor(1000+Math.random()*9000)}`; }
function selectedTrip(){ return viajes.find(v => v.id === selectedId) || null; }

function showBlocked(message){
  if(privateGate){ privateGate.classList.remove("is-hidden"); privateGate.innerHTML = `<article class="access-card"><span class="eyebrow">Acceso restringido</span><h2>${message}</h2><p class="muted">Inicia sesión con una cuenta de administrador para gestionar viajes.</p><div class="compact-actions blocked-actions"><a class="btn btn-primary" href="login.html">Ir a login</a><a class="btn btn-secondary" href="index.html">Volver al inicio</a></div></article>`; }
  if(adminDashboard) adminDashboard.classList.remove("is-visible");
}
function showDashboard(){ if(privateGate) privateGate.classList.add("is-hidden"); if(adminDashboard) adminDashboard.classList.add("is-visible"); }
async function getUserByEmail(email){
  const e = clean(email).toLowerCase(); if(!e) return null;
  const q = query(collection(db,"usuarios"), where("email","==",e));
  const snap = await getDocs(q);
  if(snap.empty) return null;
  const d = snap.docs[0]; return {id:d.id, ...d.data()};
}
async function loadViajes(){
  const snap = await getDocs(query(collection(db,"viajes"), orderBy("createdAt","desc")));
  viajes = snap.docs.map(d => ({id:d.id, ...d.data()}));
  if(!selectedId && viajes[0]) selectedId = viajes[0].id;
}
async function loadDestinos(){
  const snap = await getDocs(query(collection(db,"destinosRecomendados"), orderBy("createdAt","desc")));
  destinos = snap.docs.map(d => ({id:d.id, ...d.data()}));
}
async function loadRequests(){
  const [contactsSnap, subscriptionsSnap] = await Promise.all([
    getDocs(query(collection(db,"contactos"), orderBy("createdAt","desc"))),
    getDocs(query(collection(db,"suscripciones"), orderBy("createdAt","desc")))
  ]);
  contactos = contactsSnap.docs.map(d => ({id:d.id, ...d.data()}));
  suscripciones = subscriptionsSnap.docs.map(d => ({id:d.id, ...d.data()}));
}
async function refresh(){ await loadViajes(); await loadDestinos(); await loadRequests(); renderMetrics(); renderTrips(); renderSelected(); renderRecommended(); renderRequests(); }
async function refreshRequests(){ await loadRequests(); renderMetrics(); renderRequests(); }
function renderMetrics(){ metricTrips.textContent=viajes.length; metricActive.textContent=viajes.filter(t=>["En organizacion","Reservado","En curso"].includes(t.status)).length; metricActivities.textContent=viajes.reduce((s,t)=>s+(t.itinerary||[]).length,0); metricBudget.textContent=moneyFormatter.format(viajes.reduce((s,t)=>s+budget(t),0)); if(metricContacts) metricContacts.textContent=contactos.filter(c=>c.status!=="gestionado"&&c.status!=="archivado").length; }
function renderTrips(){
  if(!viajes.length){ tripList.innerHTML='<div class="empty-state">No hay viajes en Firebase. Crea el primero desde el formulario.</div>'; return; }
  tripList.innerHTML = viajes.map(t => `<article class="trip-card ${t.id===selectedId?'selected':''}"><div class="inline-row"><div><strong>${esc(t.destination)}</strong><p class="muted">${fmtDate(t.startDate)} - ${fmtDate(t.endDate)} · ${esc(t.travelers)} viajero(s) · ${esc(t.experience)}</p><p class="muted">Asignado a: ${esc(t.userEmail || 'público / sin usuario')}</p></div><span class="status-pill ${statusClass(t.status)}">${esc(t.status)}</span></div><div class="inline-row"><span class="code-pill">${esc(t.code)}</span><span class="muted">Total: ${moneyFormatter.format(budget(t))}</span></div><div class="compact-actions"><button class="small-btn" data-action="select" data-id="${t.id}">Seleccionar</button><button class="small-btn" data-action="copy" data-code="${esc(t.code)}">Copiar código</button><button class="small-btn" data-action="track" data-code="${esc(t.code)}">Abrir rastreo</button><button class="small-btn danger" data-action="delete" data-id="${t.id}">Eliminar</button></div></article>`).join("");
}
function renderSelected(){
  const t = selectedTrip();
  if(!t){ selectedTripTitle.textContent='Selecciona un viaje'; selectedTripCode.textContent='Sin código'; selectedTripMeta.textContent='Elige un viaje para editarlo.'; adminMap.src=mapUrl('Europa turismo'); mapCaption.textContent='Selecciona un viaje para ver su mapa.'; activityList.innerHTML='<div class="empty-state">Sin viaje seleccionado.</div>'; return; }
  selectedTripTitle.textContent=t.destination; selectedTripCode.textContent=t.code; selectedTripMeta.textContent=`${fmtDate(t.startDate)} - ${fmtDate(t.endDate)} - ${t.travelers} viajero(s) - ${t.experience}`;
  editStatus.value=t.status||'Por planear'; editLastLocation.value=t.lastLocation||''; editMapQuery.value=t.mapQuery||t.destination||''; transportBudget.value=t.transport||''; hotelBudget.value=t.hotel||''; foodBudget.value=t.food||''; activitiesBudget.value=t.activitiesCost||''; personalNotes.value=t.notes||''; adminMap.src=mapUrl(t.mapQuery||t.lastLocation||t.destination); mapCaption.textContent='Mapa de '+(t.lastLocation||t.destination); renderActivities(t); renderBudget(t);
}
function renderActivities(t){ const items=[...(t.itinerary||[])].sort((a,b)=>String((a.date||'')+(a.time||'')).localeCompare(String((b.date||'')+(b.time||'')))); if(!items.length){ activityList.innerHTML='<div class="empty-state">Este viaje aún no tiene actividades.</div>'; return; } activityList.innerHTML=items.map(a=>`<article class="activity-item"><div class="activity-time">${esc(a.time||'--:--')}</div><div><strong>${esc(a.place)}</strong><p class="muted">${fmtDate(a.date)} · <span class="category-pill">${esc(a.category)}</span></p><p class="muted">${esc(a.description||'Sin descripción.')}</p></div><button class="small-btn danger" data-action="delete-activity" data-id="${esc(a.id)}">Eliminar</button></article>`).join(''); }
function renderBudget(t){ outTransport.textContent=moneyFormatter.format(Number(t.transport||0)); outHotel.textContent=moneyFormatter.format(Number(t.hotel||0)); outFoodActivities.textContent=moneyFormatter.format(Number(t.food||0)+Number(t.activitiesCost||0)); outBudgetTotal.textContent=moneyFormatter.format(budget(t)); }
function renderRecommended(){ if(!destinos.length){ recommendationGrid.innerHTML='<div class="empty-state">No hay destinos recomendados en Firebase.</div>'; return; } recommendationGrid.innerHTML=destinos.map(i=>`<article class="destination-card"><img src="${esc(i.image||'assets/fondo.jpg')}" alt="${esc(i.name)}" onerror="this.src='assets/fondo.jpg'"><div class="inner"><div class="inline-row"><strong>${esc(i.name)}</strong><span>⭐ ${esc(i.rating||'4.8')}</span></div><p class="muted">${esc(i.description||'Sin descripción.')}</p><div class="compact-actions compact-actions-spaced"><a class="small-btn" href="${esc(i.mapLink||('https://maps.google.com/?q='+encodeURIComponent(i.name||'')))}" target="_blank" rel="noopener noreferrer">Ver mapa</a><button class="small-btn danger" data-action="delete-rec" data-id="${i.id}">Eliminar</button></div></div></article>`).join(''); }
function renderRequests(){
  if(contactRequestsList){
    contactRequestsList.innerHTML = contactos.length ? contactos.map(c => `
      <article class="request-card">
        <div class="inline-row"><div><strong>${esc(c.name || "Sin nombre")}</strong><p class="muted">${esc(c.email || "Sin correo")}</p></div><span class="status-pill ${c.status === "gestionado" ? "finalizado" : c.status === "en gestion" ? "curso" : "planear"}">${esc(c.status || "pendiente")}</span></div>
        <div class="request-meta"><span>Destino: ${esc(c.destination || "Sin destino")}</span><span>Recibido: ${fmtDateTime(c.createdAt)}</span></div>
        <p class="muted">${esc(c.message || "Sin mensaje.")}</p>
        <label for="note-contact-${esc(c.id)}">Nota administrativa</label>
        <textarea class="admin-note-input" id="note-contact-${esc(c.id)}" data-note-contact="${esc(c.id)}" placeholder="Seguimiento, respuesta pendiente, próxima acción...">${esc(c.adminNote || "")}</textarea>
        <div class="compact-actions">
          <a class="small-btn" href="mailto:${esc(c.email || "")}">Responder por correo</a>
          <button class="small-btn" data-action="contact-status" data-status="en gestion" data-id="${esc(c.id)}" type="button">En gestión</button>
          <button class="small-btn" data-action="contact-status" data-status="gestionado" data-id="${esc(c.id)}" type="button">Gestionado</button>
          <button class="small-btn" data-action="save-contact-note" data-id="${esc(c.id)}" type="button">Guardar nota</button>
          <button class="small-btn danger" data-action="delete-contact" data-id="${esc(c.id)}" type="button">Eliminar</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">No hay solicitudes de contacto guardadas.</div>';
  }

  if(subscriptionRequestsList){
    subscriptionRequestsList.innerHTML = suscripciones.length ? suscripciones.map(s => `
      <article class="request-card">
        <div class="inline-row"><div><strong>${esc(s.email || "Sin correo")}</strong><p class="muted">Origen: ${esc(s.source || "Formulario comunidad")}</p></div><span class="status-pill ${s.status === "archivada" ? "finalizado" : "curso"}">${esc(s.status || "activa")}</span></div>
        <div class="request-meta"><span>Recibido: ${fmtDateTime(s.createdAt)}</span></div>
        <div class="compact-actions">
          <a class="small-btn" href="mailto:${esc(s.email || "")}">Escribir</a>
          <button class="small-btn" data-action="subscription-status" data-status="activa" data-id="${esc(s.id)}" type="button">Activa</button>
          <button class="small-btn" data-action="subscription-status" data-status="archivada" data-id="${esc(s.id)}" type="button">Archivar</button>
          <button class="small-btn danger" data-action="delete-subscription" data-id="${esc(s.id)}" type="button">Eliminar</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">No hay suscripciones guardadas.</div>';
  }
}

onAuthStateChanged(auth, async user => {
  if(!user){ showBlocked('No has iniciado sesión.'); setTimeout(()=>location.href='login.html',800); return; }
  currentUser = user;
  const profileSnap = await getDoc(doc(db,"usuarios",user.uid));
  currentProfile = profileSnap.exists() ? profileSnap.data() : {rol:'usuario', nombre:user.displayName||'usuario', email:user.email};
  if(currentProfile.rol !== 'admin'){ showBlocked('No tienes permisos de administrador.'); setTimeout(()=>location.href='rastreo-viaje.html?mis=1',1200); return; }
  showDashboard(); sessionInfo.textContent=`Administrador: ${currentProfile.nombre || user.displayName || user.email} - ${user.email}`; await refresh();
});

tripForm.addEventListener('submit', async e => { e.preventDefault(); const d=new FormData(tripForm); const dest=clean(d.get('destination')); const email=clean(d.get('assignedEmail')).toLowerCase(); let assigned=null; if(email) assigned=await getUserByEmail(email); const t={ code:makeCode(dest), destination:dest, startDate:d.get('startDate'), endDate:d.get('endDate'), travelers:Number(d.get('travelers'))||1, experience:d.get('experience'), status:d.get('tripStatus'), mapQuery:clean(d.get('mapQuery'))||dest, lastLocation:clean(d.get('lastLocation'))||dest, userEmail:email, userId:assigned?.uid || assigned?.id || '', lastUpdate:new Date().toISOString(), transport:0, hotel:0, food:0, activitiesCost:0, notes:'', itinerary:[], createdBy:currentUser.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp()}; const ref=await addDoc(collection(db,'viajes'),t); selectedId=ref.id; tripForm.reset(); tripFormMessage.textContent='Viaje guardado en Firebase. Código público: '+t.code+(email&&!assigned?' (correo no registrado; queda solo como referencia)':''); await refresh(); });
tripList.addEventListener('click', async e => { const b=e.target.closest('button[data-action]'); if(!b)return; if(b.dataset.action==='select') selectedId=b.dataset.id; if(b.dataset.action==='copy'){ navigator.clipboard&&navigator.clipboard.writeText(b.dataset.code); b.textContent='Copiado'; } if(b.dataset.action==='track') location.href='rastreo-viaje.html?codigo='+encodeURIComponent(b.dataset.code); if(b.dataset.action==='delete'){ if(confirm('¿Eliminar este viaje de Firebase?')){ await deleteDoc(doc(db,'viajes',b.dataset.id)); if(selectedId===b.dataset.id) selectedId=null; } } await refresh(); });
clearTripsBtn.addEventListener('click', async () => { if(!confirm('¿Borrar TODOS los viajes de Firebase?')) return; for(const t of viajes) await deleteDoc(doc(db,'viajes',t.id)); selectedId=null; await refresh(); });
exportTripsBtn.addEventListener('click', () => { const blob=new Blob([JSON.stringify({viajes,destinos,contactos,suscripciones},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='wayture-firebase-datos.json'; a.click(); URL.revokeObjectURL(url); });
statusForm.addEventListener('submit', async e => { e.preventDefault(); if(!selectedId)return alert('Selecciona un viaje primero.'); const d=new FormData(statusForm); await updateDoc(doc(db,'viajes',selectedId), {status:d.get('editStatus'), lastLocation:clean(d.get('editLastLocation')), mapQuery:clean(d.get('editMapQuery')), lastUpdate:new Date().toISOString(), updatedAt:serverTimestamp()}); await refresh(); });
activityForm.addEventListener('submit', async e => { e.preventDefault(); const t=selectedTrip(); if(!t)return alert('Selecciona un viaje primero.'); const d=new FormData(activityForm); const itinerary=t.itinerary||[]; itinerary.push({id:id(), date:d.get('activityDate')||t.startDate, time:d.get('activityTime'), place:clean(d.get('activityPlace')), category:d.get('activityCategory'), description:clean(d.get('activityDescription'))}); await updateDoc(doc(db,'viajes',selectedId), {itinerary, lastUpdate:new Date().toISOString(), updatedAt:serverTimestamp()}); activityForm.reset(); await refresh(); });
activityList.addEventListener('click', async e => { const b=e.target.closest('button[data-action="delete-activity"]'); const t=selectedTrip(); if(!b||!t)return; const itinerary=(t.itinerary||[]).filter(a=>a.id!==b.dataset.id); await updateDoc(doc(db,'viajes',selectedId), {itinerary, updatedAt:serverTimestamp()}); await refresh(); });
budgetForm.addEventListener('submit', async e => { e.preventDefault(); if(!selectedId)return alert('Selecciona un viaje primero.'); const d=new FormData(budgetForm); await updateDoc(doc(db,'viajes',selectedId), {transport:Number(d.get('transportBudget'))||0, hotel:Number(d.get('hotelBudget'))||0, food:Number(d.get('foodBudget'))||0, activitiesCost:Number(d.get('activitiesBudget'))||0, lastUpdate:new Date().toISOString(), updatedAt:serverTimestamp()}); await refresh(); });
notesForm.addEventListener('submit', async e => { e.preventDefault(); if(!selectedId)return alert('Selecciona un viaje primero.'); await updateDoc(doc(db,'viajes',selectedId), {notes:clean(new FormData(notesForm).get('personalNotes')), lastUpdate:new Date().toISOString(), updatedAt:serverTimestamp()}); await refresh(); });
destinationForm.addEventListener('submit', async e => { e.preventDefault(); const d=new FormData(destinationForm); const name=clean(d.get('recName')); await addDoc(collection(db,'destinosRecomendados'), {name, image:clean(d.get('recImage'))||'assets/fondo.jpg', rating:d.get('recRating')||'4.8', description:clean(d.get('recDescription')), mapLink:clean(d.get('recMapLink'))||('https://maps.google.com/?q='+encodeURIComponent(name)), createdAt:serverTimestamp(), createdBy:currentUser.uid}); destinationForm.reset(); await refresh(); });
recommendationGrid.addEventListener('click', async e => { const b=e.target.closest('button[data-action="delete-rec"]'); if(!b)return; await deleteDoc(doc(db,'destinosRecomendados',b.dataset.id)); await refresh(); });
if(refreshRequestsBtn) refreshRequestsBtn.addEventListener('click', refreshRequests);
if(contactRequestsList) contactRequestsList.addEventListener('click', async e => {
  const b=e.target.closest('button[data-action]');
  if(!b)return;
  if(b.dataset.action==='contact-status'){
    await updateDoc(doc(db,'contactos',b.dataset.id), {status:b.dataset.status, updatedAt:serverTimestamp(), managedBy:currentUser.uid});
  }
  if(b.dataset.action==='save-contact-note'){
    const note = document.querySelector(`[data-note-contact="${b.dataset.id}"]`);
    await updateDoc(doc(db,'contactos',b.dataset.id), {adminNote:clean(note?.value), updatedAt:serverTimestamp(), managedBy:currentUser.uid});
  }
  if(b.dataset.action==='delete-contact'){
    if(confirm('¿Eliminar esta solicitud de contacto?')) await deleteDoc(doc(db,'contactos',b.dataset.id));
  }
  await refreshRequests();
});
if(subscriptionRequestsList) subscriptionRequestsList.addEventListener('click', async e => {
  const b=e.target.closest('button[data-action]');
  if(!b)return;
  if(b.dataset.action==='subscription-status'){
    await updateDoc(doc(db,'suscripciones',b.dataset.id), {status:b.dataset.status, updatedAt:serverTimestamp(), managedBy:currentUser.uid});
  }
  if(b.dataset.action==='delete-subscription'){
    if(confirm('¿Eliminar esta suscripción?')) await deleteDoc(doc(db,'suscripciones',b.dataset.id));
  }
  await refreshRequests();
});
logoutBtn.addEventListener('click', async () => { await signOut(auth); location.href='index.html'; });
document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); document.getElementById('tab-'+btn.dataset.tab).classList.add('active'); }));
document.querySelectorAll('.request-tab').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.request-tab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.request-panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); document.getElementById('request-'+btn.dataset.requestTab).classList.add('active'); }));
if(menuToggle&&mainNav) menuToggle.addEventListener('click',()=>{ const open=mainNav.classList.toggle('is-open'); menuToggle.setAttribute('aria-expanded',String(open)); });
const obs=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting)e.target.classList.add('visible'); }),{threshold:0.15}); document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
