import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const requestsGate = document.getElementById("requestsGate");
const requestsDashboard = document.getElementById("requestsDashboard");
const requestsSessionInfo = document.getElementById("requestsSessionInfo");
const contactRequestsList = document.getElementById("contactRequestsList");
const subscriptionRequestsList = document.getElementById("subscriptionRequestsList");
const metricPendingContacts = document.getElementById("metricPendingContacts");
const metricManagedContacts = document.getElementById("metricManagedContacts");
const metricSubscriptions = document.getElementById("metricSubscriptions");
const metricArchivedSubscriptions = document.getElementById("metricArchivedSubscriptions");
const refreshRequestsBtn = document.getElementById("refreshRequestsBtn");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let contactos = [];
let suscripciones = [];
let unsubscribeContactos = null;
let unsubscribeSuscripciones = null;

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function clean(text) {
  return String(text || "").trim();
}

function fmtDateTime(value) {
  if (!value) return "Sin fecha";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function showBlocked(message) {
  requestsGate.innerHTML = `<span class="eyebrow">Acceso restringido</span><h2>${esc(message)}</h2><p class="muted">Inicia sesion con una cuenta administradora.</p><div class="compact-actions"><a class="btn btn-primary" href="login.html">Ir a login</a><a class="btn btn-secondary" href="index.html">Volver al inicio</a></div>`;
  requestsGate.classList.remove("is-hidden");
  requestsDashboard.classList.remove("is-visible");
}

function showDashboard() {
  requestsGate.classList.add("is-hidden");
  requestsDashboard.classList.add("is-visible");
}

function renderMetrics() {
  metricPendingContacts.textContent = contactos.filter(c => c.status !== "gestionado" && c.status !== "archivado").length;
  metricManagedContacts.textContent = contactos.filter(c => c.status === "gestionado").length;
  metricSubscriptions.textContent = suscripciones.length;
  metricArchivedSubscriptions.textContent = suscripciones.filter(s => s.status === "archivada").length;
}

function renderRequests() {
  contactRequestsList.innerHTML = contactos.length ? contactos.map(c => `
    <article class="request-card">
      <div class="inline-row"><div><strong>${esc(c.name || "Sin nombre")}</strong><p class="muted">${esc(c.email || "Sin correo")}</p></div><span class="status-pill ${c.status === "gestionado" ? "finalizado" : c.status === "en gestion" ? "curso" : "planear"}">${esc(c.status || "pendiente")}</span></div>
      <div class="request-meta"><span>Destino: ${esc(c.destination || "Sin destino")}</span><span>Recibido: ${fmtDateTime(c.createdAt)}</span></div>
      <p class="muted">${esc(c.message || "Sin mensaje.")}</p>
      <label for="note-contact-${esc(c.id)}">Nota administrativa</label>
      <textarea class="admin-note-input" id="note-contact-${esc(c.id)}" data-note-contact="${esc(c.id)}" placeholder="Seguimiento, respuesta pendiente, proxima accion...">${esc(c.adminNote || "")}</textarea>
      <div class="compact-actions">
        <a class="small-btn" href="mailto:${esc(c.email || "")}">Responder por correo</a>
        <button class="small-btn" data-action="contact-status" data-status="en gestion" data-id="${esc(c.id)}" type="button">En gestion</button>
        <button class="small-btn" data-action="contact-status" data-status="gestionado" data-id="${esc(c.id)}" type="button">Gestionado</button>
        <button class="small-btn" data-action="save-contact-note" data-id="${esc(c.id)}" type="button">Guardar nota</button>
        <button class="small-btn danger" data-action="delete-contact" data-id="${esc(c.id)}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No hay solicitudes de contacto guardadas.</div>';

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

function renderAll() {
  renderMetrics();
  renderRequests();
}

function startRealtime() {
  unsubscribeContactos?.();
  unsubscribeSuscripciones?.();
  unsubscribeContactos = onSnapshot(query(collection(db, "contactos"), orderBy("createdAt", "desc")), snap => {
    contactos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
  unsubscribeSuscripciones = onSnapshot(query(collection(db, "suscripciones"), orderBy("createdAt", "desc")), snap => {
    suscripciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

contactRequestsList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "contact-status") {
    await updateDoc(doc(db, "contactos", b.dataset.id), { status: b.dataset.status, updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "save-contact-note") {
    const note = document.querySelector(`[data-note-contact="${b.dataset.id}"]`);
    await updateDoc(doc(db, "contactos", b.dataset.id), { adminNote: clean(note?.value), updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "delete-contact" && confirm("Eliminar esta solicitud de contacto?")) {
    await deleteDoc(doc(db, "contactos", b.dataset.id));
  }
});

subscriptionRequestsList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "subscription-status") {
    await updateDoc(doc(db, "suscripciones", b.dataset.id), { status: b.dataset.status, updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "delete-subscription" && confirm("Eliminar esta suscripcion?")) {
    await deleteDoc(doc(db, "suscripciones", b.dataset.id));
  }
});

document.querySelectorAll(".request-tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".request-tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".request-panel").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("request-" + btn.dataset.requestTab).classList.add("active");
}));

if (refreshRequestsBtn) refreshRequestsBtn.addEventListener("click", renderAll);
if (menuToggle && mainNav) menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

const obs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) e.target.classList.add("visible");
}), { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => obs.observe(el));

onAuthStateChanged(auth, async user => {
  if (!user) {
    showBlocked("No has iniciado sesion.");
    setTimeout(() => location.href = "login.html", 900);
    return;
  }
  currentUser = user;
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  const profile = snap.exists() ? snap.data() : { rol: "usuario", nombre: user.displayName || "usuario", email: user.email };
  if (profile.rol !== "admin") {
    showBlocked("No tienes permisos de administrador.");
    setTimeout(() => location.href = "panel-usuario.html#mis-viajes", 1200);
    return;
  }
  showDashboard();
  requestsSessionInfo.textContent = `Administrador: ${profile.nombre || user.displayName || user.email} - ${user.email}`;
  startRealtime();
});
