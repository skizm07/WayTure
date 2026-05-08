import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where, orderBy, doc, getDoc,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const moneyFormatter = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const TRIP_STATUSES = ["Por planear", "En organización", "Reservado", "En curso", "Reprogramado", "Finalizado"];

const privateGate = document.getElementById("privateGate");
const adminDashboard = document.getElementById("adminDashboard");
const sessionInfo = document.getElementById("sessionInfo");
const tripForm = document.getElementById("tripForm");
const tripFormTitle = document.getElementById("tripFormTitle");
const tripSubmitBtn = document.getElementById("tripSubmitBtn");
const cancelTripEditBtn = document.getElementById("cancelTripEditBtn");
const tripFormMessage = document.getElementById("tripFormMessage");
const tripFilters = document.getElementById("tripFilters");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
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
const statusComment = document.getElementById("statusComment");
const statusMessage = document.getElementById("statusMessage");
const adminMap = document.getElementById("adminMap");
const mapCaption = document.getElementById("mapCaption");
const statusHistoryList = document.getElementById("statusHistoryList");
const selectedClosedSummary = document.getElementById("selectedClosedSummary");
const activityList = document.getElementById("activityList");
const activitySubmitBtn = document.getElementById("activitySubmitBtn");
const cancelActivityEditBtn = document.getElementById("cancelActivityEditBtn");
const activityMessage = document.getElementById("activityMessage");
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
const destinationSubmitBtn = document.getElementById("destinationSubmitBtn");
const cancelDestinationEditBtn = document.getElementById("cancelDestinationEditBtn");
const destinationMessage = document.getElementById("destinationMessage");
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
let editingTripId = null;
let editingActivityId = null;
let editingDestinationId = null;

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function clean(text) {
  return String(text || "").trim();
}

function normalizeForSearch(text) {
  return clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeStatus(status) {
  const raw = normalizeForSearch(status);
  if (raw.includes("organ")) return "En organización";
  if (raw.includes("reserv")) return "Reservado";
  if (raw.includes("curso")) return "En curso";
  if (raw.includes("final")) return "Finalizado";
  if (raw.includes("reprogram") || raw.includes("incid") || raw.includes("cambio")) return "Reprogramado";
  return "Por planear";
}

function statusClass(status) {
  const s = normalizeStatus(status);
  if (s === "En organización") return "organizacion";
  if (s === "Reservado") return "reservado";
  if (s === "En curso") return "curso";
  if (s === "Reprogramado") return "reprogramado";
  if (s === "Finalizado") return "finalizado";
  return "planear";
}

function mapUrl(q) {
  return "https://www.google.com/maps?q=" + encodeURIComponent(q || "Europa turismo") + "&output=embed";
}

function mapsLink(q) {
  return "https://maps.google.com/?q=" + encodeURIComponent(q || "");
}

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function budget(t) {
  return Number(t.transport || 0) + Number(t.hotel || 0) + Number(t.food || 0) + Number(t.activitiesCost || 0);
}

function fmtDate(d) {
  if (!d) return "Sin fecha";
  const date = new Date(d + "T00:00:00");
  return isNaN(date) ? d : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(value) {
  if (!value) return "Sin fecha";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return isNaN(date) ? "Sin fecha" : date.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function makeCode(destination) {
  const slug = clean(destination)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14)
    .toUpperCase() || "VIAJE";
  return `WT-${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function codeExists(code) {
  const snap = await getDocs(query(collection(db, "viajes"), where("code", "==", code)));
  return !snap.empty;
}

async function makeUniqueCode(destination) {
  for (let i = 0; i < 30; i += 1) {
    const code = makeCode(destination);
    if (!(await codeExists(code))) return code;
  }
  return `WT-${Date.now()}`;
}

function selectedTrip() {
  return viajes.find(v => v.id === selectedId) || null;
}

function setMessage(el, text, type = "success") {
  if (!el) return;
  el.textContent = text || "";
  el.className = type === "error" ? "warning" : "success";
}

function statusOptions(selected) {
  const normalized = normalizeStatus(selected);
  return TRIP_STATUSES.map(status => `<option value="${esc(status)}" ${status === normalized ? "selected" : ""}>${esc(status)}</option>`).join("");
}

function makeHistoryEntry(previousStatus, newStatus, location, comment = "") {
  return {
    id: id(),
    previousStatus: previousStatus ? normalizeStatus(previousStatus) : "Sin estado previo",
    newStatus: normalizeStatus(newStatus),
    changedAt: new Date().toISOString(),
    location: clean(location),
    comment: clean(comment)
  };
}

function historyItems(t) {
  return [...(t?.statusHistory || [])].sort((a, b) => String(b.changedAt || "").localeCompare(String(a.changedAt || "")));
}

function validateDates(startDate, endDate) {
  if (!startDate || !endDate) throw new Error("Completa fecha de salida y fecha de regreso.");
  if (endDate < startDate) throw new Error("La fecha de regreso no puede ser anterior a la fecha de salida.");
}

function buildTripData(formData, assigned) {
  const destination = clean(formData.get("destination"));
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const travelers = Number(formData.get("travelers")) || 0;
  const email = clean(formData.get("assignedEmail")).toLowerCase();

  if (!destination) throw new Error("El destino principal es obligatorio.");
  validateDates(startDate, endDate);
  if (travelers < 1) throw new Error("El número de viajeros debe ser mayor a cero.");

  return {
    destination,
    startDate,
    endDate,
    travelers,
    experience: formData.get("experience") || "Cultural",
    status: normalizeStatus(formData.get("tripStatus")),
    mapQuery: clean(formData.get("mapQuery")) || destination,
    lastLocation: clean(formData.get("lastLocation")) || destination,
    userEmail: email,
    userId: assigned?.uid || assigned?.id || "",
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
}

function showBlocked(message) {
  if (privateGate) {
    privateGate.classList.remove("is-hidden");
    privateGate.innerHTML = `<article class="access-card"><span class="eyebrow">Acceso restringido</span><h2>${message}</h2><p class="muted">Inicia sesión con una cuenta de administrador para gestionar viajes.</p><div class="compact-actions blocked-actions"><a class="btn btn-primary" href="login.html">Ir a login</a><a class="btn btn-secondary" href="index.html">Volver al inicio</a></div></article>`;
  }
  if (adminDashboard) adminDashboard.classList.remove("is-visible");
}

function showDashboard() {
  if (privateGate) privateGate.classList.add("is-hidden");
  if (adminDashboard) adminDashboard.classList.add("is-visible");
}

async function getUserByEmail(email) {
  const e = clean(email).toLowerCase();
  if (!e) return null;
  const snap = await getDocs(query(collection(db, "usuarios"), where("email", "==", e)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function loadViajes() {
  const snap = await getDocs(query(collection(db, "viajes"), orderBy("createdAt", "desc")));
  viajes = snap.docs.map(d => ({ id: d.id, ...d.data(), status: normalizeStatus(d.data().status) }));
  if (!selectedId && viajes[0]) selectedId = viajes[0].id;
}

async function loadDestinos() {
  const snap = await getDocs(query(collection(db, "destinosRecomendados"), orderBy("createdAt", "desc")));
  destinos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadRequests() {
  const [contactsSnap, subscriptionsSnap] = await Promise.all([
    getDocs(query(collection(db, "contactos"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "suscripciones"), orderBy("createdAt", "desc")))
  ]);
  contactos = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  suscripciones = subscriptionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function refresh() {
  await loadViajes();
  await loadDestinos();
  await loadRequests();
  renderMetrics();
  renderTrips();
  renderSelected();
  renderRecommended();
  renderRequests();
}

async function refreshRequests() {
  await loadRequests();
  renderMetrics();
  renderRequests();
}

function filteredTrips() {
  if (!tripFilters) return viajes;
  const d = new FormData(tripFilters);
  const code = normalizeForSearch(d.get("code"));
  const destination = normalizeForSearch(d.get("destination"));
  const status = clean(d.get("status"));
  const assigned = normalizeForSearch(d.get("assigned"));
  const startDate = clean(d.get("startDate"));

  return viajes.filter(t => {
    const matchesCode = !code || normalizeForSearch(t.code).includes(code);
    const matchesDestination = !destination || normalizeForSearch(t.destination).includes(destination);
    const matchesStatus = !status || normalizeStatus(t.status) === normalizeStatus(status);
    const matchesAssigned = !assigned || normalizeForSearch(`${t.userEmail || ""} ${t.userId || ""}`).includes(assigned);
    const matchesStart = !startDate || t.startDate === startDate;
    return matchesCode && matchesDestination && matchesStatus && matchesAssigned && matchesStart;
  });
}

function renderMetrics() {
  metricTrips.textContent = viajes.length;
  metricActive.textContent = viajes.filter(t => ["En organización", "Reservado", "En curso", "Reprogramado"].includes(normalizeStatus(t.status))).length;
  metricActivities.textContent = viajes.reduce((s, t) => s + (t.itinerary || []).length, 0);
  metricBudget.textContent = moneyFormatter.format(viajes.reduce((s, t) => s + budget(t), 0));
  if (metricContacts) metricContacts.textContent = contactos.filter(c => c.status !== "gestionado" && c.status !== "archivado").length;
}

function renderTrips() {
  if (!viajes.length) {
    tripList.innerHTML = '<div class="empty-state">Todavía no hay viajes registrados. Crea el primero desde el formulario.</div>';
    return;
  }

  const items = filteredTrips();
  if (!items.length) {
    tripList.innerHTML = '<div class="empty-state">No encontramos viajes con esos filtros. Ajusta la búsqueda o limpia los filtros.</div>';
    return;
  }

  tripList.innerHTML = items.map(t => {
    const status = normalizeStatus(t.status);
    return `<article class="trip-card ${t.id === selectedId ? "selected" : ""} ${status === "Finalizado" ? "is-finalized" : ""}">
      <div class="inline-row">
        <div>
          <strong>${esc(t.destination)}</strong>
          <p class="muted">${fmtDate(t.startDate)} - ${fmtDate(t.endDate)} · ${esc(t.travelers)} viajero(s) · ${esc(t.experience)}</p>
          <p class="muted">Asignado a: ${esc(t.userEmail || "público / sin usuario")}</p>
        </div>
        <span class="status-pill ${statusClass(status)}">${esc(status)}</span>
      </div>
      <div class="inline-row">
        <span class="code-pill">${esc(t.code)}</span>
        <span class="muted">${status === "Finalizado" ? "Cerrado: " + fmtDateTime(t.finishedAt) : "Total privado: " + moneyFormatter.format(budget(t))}</span>
      </div>
      <div class="compact-actions">
        <button class="small-btn" data-action="select" data-id="${t.id}">Seleccionar</button>
        <button class="small-btn" data-action="edit" data-id="${t.id}">Editar viaje</button>
        <button class="small-btn" data-action="copy" data-code="${esc(t.code)}">Copiar código</button>
        <button class="small-btn" data-action="track" data-code="${esc(t.code)}">Abrir rastreo</button>
        <button class="small-btn danger" data-action="delete" data-id="${t.id}">Eliminar</button>
      </div>
    </article>`;
  }).join("");
}

function renderSelected() {
  const t = selectedTrip();
  if (!t) {
    selectedTripTitle.textContent = "Selecciona un viaje";
    selectedTripCode.textContent = "Sin código";
    selectedTripMeta.textContent = "Elige un viaje para editarlo.";
    adminMap.src = mapUrl("Europa turismo");
    mapCaption.textContent = "Selecciona un viaje para ver su mapa.";
    activityList.innerHTML = '<div class="empty-state">Sin viaje seleccionado.</div>';
    statusHistoryList.innerHTML = '<div class="empty-state">Sin historial disponible.</div>';
    selectedClosedSummary.className = "closed-summary is-hidden";
    return;
  }

  const status = normalizeStatus(t.status);
  selectedTripTitle.textContent = t.destination;
  selectedTripCode.textContent = t.code;
  selectedTripMeta.textContent = `${fmtDate(t.startDate)} - ${fmtDate(t.endDate)} - ${t.travelers} viajero(s) - ${t.experience}`;
  editStatus.innerHTML = statusOptions(status);
  editLastLocation.value = t.lastLocation || "";
  editMapQuery.value = t.mapQuery || t.destination || "";
  transportBudget.value = t.transport || "";
  hotelBudget.value = t.hotel || "";
  foodBudget.value = t.food || "";
  activitiesBudget.value = t.activitiesCost || "";
  personalNotes.value = t.notes || "";
  adminMap.src = mapUrl(t.mapQuery || t.lastLocation || t.destination);
  mapCaption.textContent = "Mapa de " + (t.lastLocation || t.destination);
  renderActivities(t);
  renderBudget(t);
  renderStatusHistory(t);
  renderClosedSummary(t);
}

function renderStatusHistory(t) {
  const items = historyItems(t);
  if (!items.length) {
    statusHistoryList.innerHTML = '<div class="empty-state">Aún no hay cambios de estado registrados para este viaje.</div>';
    return;
  }

  statusHistoryList.innerHTML = items.map(h => `
    <article class="history-entry">
      <strong>${esc(h.previousStatus || "Sin estado previo")} → ${esc(h.newStatus || "Sin estado")}</strong>
      <p class="muted">${fmtDateTime(h.changedAt)}${h.location ? " · " + esc(h.location) : ""}</p>
      <p class="muted">${esc(h.comment || "Cambio registrado desde el panel administrativo.")}</p>
    </article>
  `).join("");
}

function renderClosedSummary(t) {
  if (normalizeStatus(t.status) !== "Finalizado") {
    selectedClosedSummary.className = "closed-summary is-hidden";
    selectedClosedSummary.innerHTML = "";
    return;
  }

  selectedClosedSummary.className = "closed-summary is-visible";
  selectedClosedSummary.innerHTML = `
    <h3>Viaje finalizado</h3>
    <p class="muted">Cierre registrado: ${fmtDateTime(t.finishedAt)}. Duración planificada: ${fmtDate(t.startDate)} - ${fmtDate(t.endDate)}. Actividades: ${(t.itinerary || []).length}. Presupuesto privado: ${moneyFormatter.format(budget(t))}.</p>
  `;
}

function renderActivities(t) {
  const items = [...(t.itinerary || [])].sort((a, b) => String((a.date || "") + (a.time || "")).localeCompare(String((b.date || "") + (b.time || ""))));
  if (!items.length) {
    activityList.innerHTML = '<div class="empty-state">Este viaje aún no tiene actividades en el itinerario.</div>';
    return;
  }

  activityList.innerHTML = items.map(a => `
    <article class="activity-item">
      <div class="activity-time">${esc(a.time || "--:--")}</div>
      <div>
        <strong>${esc(a.place)}</strong>
        <p class="muted">${fmtDate(a.date)} · <span class="category-pill">${esc(a.category)}</span></p>
        <p class="muted">${esc(a.description || "Sin descripción.")}</p>
        ${a.place ? `<a class="small-btn" href="${esc(mapsLink(a.place))}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>` : ""}
      </div>
      <div class="activity-actions">
        <button class="small-btn" data-action="edit-activity" data-id="${esc(a.id)}">Editar</button>
        <button class="small-btn danger" data-action="delete-activity" data-id="${esc(a.id)}">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function renderBudget(t) {
  outTransport.textContent = moneyFormatter.format(Number(t.transport || 0));
  outHotel.textContent = moneyFormatter.format(Number(t.hotel || 0));
  outFoodActivities.textContent = moneyFormatter.format(Number(t.food || 0) + Number(t.activitiesCost || 0));
  outBudgetTotal.textContent = moneyFormatter.format(budget(t));
}

function renderRecommended() {
  if (!destinos.length) {
    recommendationGrid.innerHTML = '<div class="empty-state">No hay destinos recomendados todavía.</div>';
    return;
  }

  recommendationGrid.innerHTML = destinos.map(i => `
    <article class="destination-card">
      <img src="${esc(i.image || "assets/fondo.jpg")}" alt="${esc(i.name)}" onerror="this.src='assets/fondo.jpg'">
      <div class="inner">
        <div class="inline-row"><strong>${esc(i.name)}</strong><span>⭐ ${esc(i.rating || "4.8")}</span></div>
        <p class="muted">${esc(i.description || "Sin descripción.")}</p>
        <div class="compact-actions compact-actions-spaced">
          <a class="small-btn" href="${esc(i.mapLink || mapsLink(i.name || ""))}" target="_blank" rel="noopener noreferrer">Ver mapa</a>
          <button class="small-btn" data-action="edit-rec" data-id="${esc(i.id)}">Editar</button>
          <button class="small-btn danger" data-action="delete-rec" data-id="${esc(i.id)}">Eliminar</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderRequests() {
  if (contactRequestsList) {
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

  if (subscriptionRequestsList) {
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

function resetTripEdit() {
  editingTripId = null;
  tripForm.reset();
  tripForm.tripStatus.innerHTML = statusOptions("Por planear");
  tripFormTitle.textContent = "Crear nuevo viaje";
  tripSubmitBtn.textContent = "Registrar viaje";
  cancelTripEditBtn.classList.add("is-hidden");
  setMessage(tripFormMessage, "");
}

function fillTripForm(t) {
  editingTripId = t.id;
  tripForm.destination.value = t.destination || "";
  tripForm.assignedEmail.value = t.userEmail || "";
  tripForm.startDate.value = t.startDate || "";
  tripForm.endDate.value = t.endDate || "";
  tripForm.travelers.value = t.travelers || 1;
  tripForm.experience.value = t.experience || "Cultural";
  tripForm.tripStatus.innerHTML = statusOptions(t.status);
  tripForm.lastLocation.value = t.lastLocation || "";
  tripForm.mapQuery.value = t.mapQuery || "";
  tripFormTitle.textContent = "Editar viaje";
  tripSubmitBtn.textContent = "Guardar cambios";
  cancelTripEditBtn.classList.remove("is-hidden");
  setMessage(tripFormMessage, "Editando " + (t.code || "viaje seleccionado") + ".");
  tripForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetActivityEdit() {
  editingActivityId = null;
  activityForm.reset();
  activitySubmitBtn.textContent = "Agregar actividad";
  cancelActivityEditBtn.classList.add("is-hidden");
  setMessage(activityMessage, "");
}

function fillActivityForm(activity) {
  editingActivityId = activity.id;
  activityForm.activityDate.value = activity.date || "";
  activityForm.activityTime.value = activity.time || "";
  activityForm.activityCategory.value = activity.category || "Cultura";
  activityForm.activityPlace.value = activity.place || "";
  activityForm.activityDescription.value = activity.description || "";
  activitySubmitBtn.textContent = "Guardar actividad";
  cancelActivityEditBtn.classList.remove("is-hidden");
  setMessage(activityMessage, "Editando actividad del itinerario.");
}

function resetDestinationEdit() {
  editingDestinationId = null;
  destinationForm.reset();
  destinationSubmitBtn.textContent = "Agregar destino recomendado";
  cancelDestinationEditBtn.classList.add("is-hidden");
  setMessage(destinationMessage, "");
}

function fillDestinationForm(destination) {
  editingDestinationId = destination.id;
  destinationForm.recName.value = destination.name || "";
  destinationForm.recRating.value = destination.rating || "";
  destinationForm.recImage.value = destination.image || "";
  destinationForm.recMapLink.value = destination.mapLink || "";
  destinationForm.recDescription.value = destination.description || "";
  destinationSubmitBtn.textContent = "Guardar destino recomendado";
  cancelDestinationEditBtn.classList.remove("is-hidden");
  setMessage(destinationMessage, "Editando destino recomendado.");
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    showBlocked("No has iniciado sesión.");
    setTimeout(() => location.href = "login.html", 800);
    return;
  }

  currentUser = user;
  const profileSnap = await getDoc(doc(db, "usuarios", user.uid));
  currentProfile = profileSnap.exists() ? profileSnap.data() : { rol: "usuario", nombre: user.displayName || "usuario", email: user.email };

  if (currentProfile.rol !== "admin") {
    showBlocked("No tienes permisos de administrador.");
    setTimeout(() => location.href = "panel-usuario.html#mis-viajes", 1200);
    return;
  }

  showDashboard();
  sessionInfo.textContent = `Administrador: ${currentProfile.nombre || user.displayName || user.email} - ${user.email}`;
  tripForm.tripStatus.innerHTML = statusOptions("Por planear");
  editStatus.innerHTML = statusOptions("Por planear");
  await refresh();
});

tripForm.addEventListener("submit", async e => {
  e.preventDefault();
  const d = new FormData(tripForm);
  const email = clean(d.get("assignedEmail")).toLowerCase();

  try {
    setMessage(tripFormMessage, editingTripId ? "Guardando cambios..." : "Creando viaje...");
    const assigned = email ? await getUserByEmail(email) : null;
    const tripData = buildTripData(d, assigned);

    if (editingTripId) {
      const existing = viajes.find(t => t.id === editingTripId);
      if (!existing) throw new Error("No se encontró el viaje que intentas editar.");
      const previousStatus = normalizeStatus(existing.status);
      const nextStatus = normalizeStatus(tripData.status);
      const statusHistory = [...(existing.statusHistory || [])];
      if (previousStatus !== nextStatus) {
        statusHistory.push(makeHistoryEntry(previousStatus, nextStatus, tripData.lastLocation, "Cambio guardado desde edición completa del viaje."));
      }

      const updateData = { ...tripData, statusHistory };
      if (nextStatus === "Finalizado" && previousStatus !== "Finalizado") updateData.finishedAt = new Date().toISOString();
      await updateDoc(doc(db, "viajes", editingTripId), updateData);
      selectedId = editingTripId;
      resetTripEdit();
      setMessage(tripFormMessage, "Viaje actualizado correctamente.");
    } else {
      const code = await makeUniqueCode(tripData.destination);
      const statusHistory = [makeHistoryEntry("", tripData.status, tripData.lastLocation, "Viaje creado desde el panel administrativo.")];
      const createData = {
        ...tripData,
        code,
        statusHistory,
        finishedAt: normalizeStatus(tripData.status) === "Finalizado" ? new Date().toISOString() : "",
        transport: 0,
        hotel: 0,
        food: 0,
        activitiesCost: 0,
        notes: "",
        itinerary: [],
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, "viajes"), createData);
      selectedId = ref.id;
      tripForm.reset();
      tripForm.tripStatus.innerHTML = statusOptions("Por planear");
      setMessage(tripFormMessage, "Viaje guardado en Firebase. Código público: " + code + (email && !assigned ? " (correo no registrado; queda solo como referencia)" : ""));
    }

    await refresh();
  } catch (error) {
    console.error("Error guardando viaje:", error);
    setMessage(tripFormMessage, "No se pudo guardar el viaje: " + error.message, "error");
  }
});

tripList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;

  try {
    if (b.dataset.action === "select") selectedId = b.dataset.id;
    if (b.dataset.action === "edit") {
      selectedId = b.dataset.id;
      const t = selectedTrip();
      if (t) fillTripForm(t);
    }
    if (b.dataset.action === "copy") {
      navigator.clipboard && navigator.clipboard.writeText(b.dataset.code);
      b.textContent = "Copiado";
    }
    if (b.dataset.action === "track") location.href = "rastreo-viaje.html?codigo=" + encodeURIComponent(b.dataset.code);
    if (b.dataset.action === "delete") {
      if (confirm("¿Eliminar este viaje de Firebase?")) {
        await deleteDoc(doc(db, "viajes", b.dataset.id));
        if (selectedId === b.dataset.id) selectedId = null;
        if (editingTripId === b.dataset.id) resetTripEdit();
      }
    }
    await refresh();
  } catch (error) {
    console.error("Error en lista de viajes:", error);
    alert("No se pudo completar la acción: " + error.message);
  }
});

clearTripsBtn.addEventListener("click", async () => {
  if (!confirm("¿Borrar TODOS los viajes de Firebase?")) return;
  for (const t of viajes) await deleteDoc(doc(db, "viajes", t.id));
  selectedId = null;
  resetTripEdit();
  await refresh();
});

exportTripsBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ viajes, destinos, contactos, suscripciones }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wayture-firebase-datos.json";
  a.click();
  URL.revokeObjectURL(url);
});

statusForm.addEventListener("submit", async e => {
  e.preventDefault();
  const t = selectedTrip();
  if (!t) return alert("Selecciona un viaje primero.");

  const d = new FormData(statusForm);
  const previousStatus = normalizeStatus(t.status);
  const nextStatus = normalizeStatus(d.get("editStatus"));
  const lastLocation = clean(d.get("editLastLocation")) || t.lastLocation || t.destination;
  const mapQuery = clean(d.get("editMapQuery")) || lastLocation;
  const comment = clean(d.get("statusComment"));
  const statusHistory = [...(t.statusHistory || [])];

  if (previousStatus !== nextStatus) {
    statusHistory.push(makeHistoryEntry(previousStatus, nextStatus, lastLocation, comment));
  }

  const updateData = {
    status: nextStatus,
    lastLocation,
    mapQuery,
    statusHistory,
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
  if (nextStatus === "Finalizado" && previousStatus !== "Finalizado") updateData.finishedAt = new Date().toISOString();

  try {
    await updateDoc(doc(db, "viajes", selectedId), updateData);
    statusComment.value = "";
    setMessage(statusMessage, previousStatus === nextStatus ? "Ubicación y mapa actualizados." : "Estado actualizado e historial registrado.");
    await refresh();
  } catch (error) {
    console.error("Error actualizando estado:", error);
    setMessage(statusMessage, "No se pudo actualizar el estado: " + error.message, "error");
  }
});

activityForm.addEventListener("submit", async e => {
  e.preventDefault();
  const t = selectedTrip();
  if (!t) return alert("Selecciona un viaje primero.");

  const d = new FormData(activityForm);
  const activity = {
    id: editingActivityId || id(),
    date: d.get("activityDate") || t.startDate || "",
    time: d.get("activityTime"),
    place: clean(d.get("activityPlace")),
    category: d.get("activityCategory"),
    description: clean(d.get("activityDescription"))
  };

  if (!activity.time || !activity.place) {
    setMessage(activityMessage, "La hora y el lugar de la actividad son obligatorios.", "error");
    return;
  }

  const itinerary = editingActivityId
    ? (t.itinerary || []).map(a => a.id === editingActivityId ? activity : a)
    : [...(t.itinerary || []), activity];

  try {
    await updateDoc(doc(db, "viajes", selectedId), { itinerary, lastUpdate: new Date().toISOString(), updatedAt: serverTimestamp() });
    const savedMessage = editingActivityId ? "Actividad actualizada." : "Actividad agregada al itinerario.";
    resetActivityEdit();
    setMessage(activityMessage, savedMessage);
    await refresh();
  } catch (error) {
    console.error("Error guardando actividad:", error);
    setMessage(activityMessage, "No se pudo guardar la actividad: " + error.message, "error");
  }
});

activityList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  const t = selectedTrip();
  if (!b || !t) return;

  if (b.dataset.action === "edit-activity") {
    const activity = (t.itinerary || []).find(a => a.id === b.dataset.id);
    if (activity) fillActivityForm(activity);
    return;
  }

  if (b.dataset.action === "delete-activity") {
    const itinerary = (t.itinerary || []).filter(a => a.id !== b.dataset.id);
    await updateDoc(doc(db, "viajes", selectedId), { itinerary, updatedAt: serverTimestamp() });
    if (editingActivityId === b.dataset.id) resetActivityEdit();
    await refresh();
  }
});

budgetForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!selectedId) return alert("Selecciona un viaje primero.");
  const d = new FormData(budgetForm);
  await updateDoc(doc(db, "viajes", selectedId), {
    transport: Number(d.get("transportBudget")) || 0,
    hotel: Number(d.get("hotelBudget")) || 0,
    food: Number(d.get("foodBudget")) || 0,
    activitiesCost: Number(d.get("activitiesBudget")) || 0,
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  });
  await refresh();
});

notesForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!selectedId) return alert("Selecciona un viaje primero.");
  await updateDoc(doc(db, "viajes", selectedId), {
    notes: clean(new FormData(notesForm).get("personalNotes")),
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  });
  await refresh();
});

destinationForm.addEventListener("submit", async e => {
  e.preventDefault();
  const d = new FormData(destinationForm);
  const name = clean(d.get("recName"));
  const rating = Number(d.get("recRating"));

  if (!name) {
    setMessage(destinationMessage, "El nombre del destino es obligatorio.", "error");
    return;
  }
  if (Number.isNaN(rating) || rating < 0 || rating > 5) {
    setMessage(destinationMessage, "La valoración debe ser un número entre 0 y 5.", "error");
    return;
  }

  const data = {
    name,
    image: clean(d.get("recImage")) || "assets/fondo.jpg",
    rating,
    description: clean(d.get("recDescription")),
    mapLink: clean(d.get("recMapLink")) || mapsLink(name),
    updatedAt: serverTimestamp()
  };

  try {
    if (editingDestinationId) {
      await updateDoc(doc(db, "destinosRecomendados", editingDestinationId), data);
      resetDestinationEdit();
      setMessage(destinationMessage, "Destino recomendado actualizado.");
    } else {
      await addDoc(collection(db, "destinosRecomendados"), { ...data, createdAt: serverTimestamp(), createdBy: currentUser.uid });
      resetDestinationEdit();
      setMessage(destinationMessage, "Destino recomendado agregado.");
    }
    await refresh();
  } catch (error) {
    console.error("Error guardando destino recomendado:", error);
    setMessage(destinationMessage, "No se pudo guardar el destino: " + error.message, "error");
  }
});

recommendationGrid.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;

  if (b.dataset.action === "edit-rec") {
    const destination = destinos.find(i => i.id === b.dataset.id);
    if (destination) fillDestinationForm(destination);
    return;
  }

  if (b.dataset.action === "delete-rec") {
    await deleteDoc(doc(db, "destinosRecomendados", b.dataset.id));
    if (editingDestinationId === b.dataset.id) resetDestinationEdit();
    await refresh();
  }
});

if (tripFilters) {
  tripFilters.addEventListener("input", renderTrips);
  tripFilters.addEventListener("change", renderTrips);
}
if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", () => {
  tripFilters.reset();
  renderTrips();
});
if (cancelTripEditBtn) cancelTripEditBtn.addEventListener("click", resetTripEdit);
if (cancelActivityEditBtn) cancelActivityEditBtn.addEventListener("click", resetActivityEdit);
if (cancelDestinationEditBtn) cancelDestinationEditBtn.addEventListener("click", resetDestinationEdit);
if (refreshRequestsBtn) refreshRequestsBtn.addEventListener("click", refreshRequests);

if (contactRequestsList) contactRequestsList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "contact-status") {
    await updateDoc(doc(db, "contactos", b.dataset.id), { status: b.dataset.status, updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "save-contact-note") {
    const note = document.querySelector(`[data-note-contact="${b.dataset.id}"]`);
    await updateDoc(doc(db, "contactos", b.dataset.id), { adminNote: clean(note?.value), updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "delete-contact") {
    if (confirm("¿Eliminar esta solicitud de contacto?")) await deleteDoc(doc(db, "contactos", b.dataset.id));
  }
  await refreshRequests();
});

if (subscriptionRequestsList) subscriptionRequestsList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "subscription-status") {
    await updateDoc(doc(db, "suscripciones", b.dataset.id), { status: b.dataset.status, updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "delete-subscription") {
    if (confirm("¿Eliminar esta suscripción?")) await deleteDoc(doc(db, "suscripciones", b.dataset.id));
  }
  await refreshRequests();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
}));

document.querySelectorAll(".request-tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".request-tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".request-panel").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("request-" + btn.dataset.requestTab).classList.add("active");
}));

if (menuToggle && mainNav) menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

const obs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) e.target.classList.add("visible");
}), { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
