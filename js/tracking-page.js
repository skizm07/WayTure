import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const TRIP_STATUSES = ["Por planear", "En organización", "Reservado", "En curso", "Reprogramado", "Finalizado"];

const trackingForm = document.getElementById("trackingForm");
const trackingCode = document.getElementById("trackingCode");
const trackingMessage = document.getElementById("trackingMessage");
const trackingResult = document.getElementById("trackingResult");
const resultDestination = document.getElementById("resultDestination");
const resultCode = document.getElementById("resultCode");
const resultCodeRepeat = document.getElementById("resultCodeRepeat");
const resultStatus = document.getElementById("resultStatus");
const resultLocation = document.getElementById("resultLocation");
const resultFinished = document.getElementById("resultFinished");
const resultStart = document.getElementById("resultStart");
const resultEnd = document.getElementById("resultEnd");
const resultMapCaption = document.getElementById("resultMapCaption");
const trackingMap = document.getElementById("trackingMap");
const progressTrack = document.getElementById("progressTrack");
const publicItinerary = document.getElementById("publicItinerary");
const publicStatusHistory = document.getElementById("publicStatusHistory");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
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

function fmtDate(d) {
  if (!d) return "Sin fecha";
  const date = new Date(d + "T00:00:00");
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(value) {
  if (!value) return "Sin fecha";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderProgress(status) {
  const normalized = normalizeStatus(status);
  const i = Math.max(0, TRIP_STATUSES.indexOf(normalized));
  progressTrack.innerHTML = TRIP_STATUSES
    .map((step, index) => `<div class="step-item ${index <= i ? "done" : ""}">${esc(step)}</div>`)
    .join("");
}

function renderItinerary(t) {
  const items = [...(t.itinerary || [])].sort((a, b) => String((a.date || "") + (a.time || "")).localeCompare(String((b.date || "") + (b.time || ""))));
  if (!items.length) {
    publicItinerary.innerHTML = '<div class="empty-state">Este viaje aún no tiene actividades públicas registradas.</div>';
    return;
  }
  publicItinerary.innerHTML = items.map(a => `
    <article class="history-card">
      <strong>${esc(a.time || "--:--")} - ${esc(a.place)}</strong>
      <p class="muted">${fmtDate(a.date)} · <span class="category-pill">${esc(a.category)}</span><br>${esc(a.description || "Sin descripción.")}</p>
      ${a.place ? `<a class="small-btn" href="${esc(mapsLink(a.place))}" target="_blank" rel="noopener noreferrer">Abrir ubicación</a>` : ""}
    </article>
  `).join("");
}

function renderPublicHistory(t) {
  const items = [...(t.statusHistory || [])]
    .sort((a, b) => String(b.changedAt || "").localeCompare(String(a.changedAt || "")))
    .slice(0, 5);

  if (!items.length) {
    publicStatusHistory.innerHTML = '<div class="empty-state">Aún no hay cambios de estado para mostrar.</div>';
    return;
  }

  publicStatusHistory.innerHTML = items.map(h => `
    <article class="history-entry">
      <strong>${esc(h.newStatus || "Estado actualizado")}</strong>
      <p class="muted">${fmtDateTime(h.changedAt)}${h.location ? " · " + esc(h.location) : ""}</p>
      <p class="muted">Actualización registrada por WayTure.</p>
    </article>
  `).join("");
}

function renderTrip(t) {
  const status = normalizeStatus(t.status);
  trackingResult.classList.add("is-visible");
  resultDestination.textContent = t.destination || "Destino";
  resultCode.textContent = t.code || "Sin código";
  resultCodeRepeat.textContent = t.code || "Sin código";
  resultStatus.innerHTML = `<span class="status-pill ${statusClass(status)}">${esc(status)}</span>`;
  resultLocation.textContent = t.lastLocation || t.destination || "Sin ubicación";
  resultFinished.textContent = status === "Finalizado" ? fmtDateTime(t.finishedAt) : "Sin finalizar";
  resultStart.textContent = fmtDate(t.startDate);
  resultEnd.textContent = fmtDate(t.endDate);
  resultMapCaption.textContent = "Última ubicación: " + (t.lastLocation || t.destination || "Sin ubicación");
  trackingMap.src = mapUrl(t.mapQuery || t.lastLocation || t.destination);
  renderProgress(status);
  renderItinerary(t);
  renderPublicHistory(t);
}

async function findTripByCode(code) {
  const c = clean(code).toUpperCase();
  if (!c) return null;
  const snap = await getDocs(query(collection(db, "viajes"), where("code", "==", c)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), status: normalizeStatus(d.data().status) };
}

async function searchTracking(code) {
  try {
    trackingMessage.textContent = "Consultando el viaje en WayTure...";
    const t = await findTripByCode(code);
    if (!t) {
      trackingResult.classList.remove("is-visible");
      trackingMessage.textContent = "No encontramos ningún viaje con ese código.";
      return;
    }
    trackingMessage.textContent = "";
    renderTrip(t);
  } catch (error) {
    console.error("Error consultando rastreo:", error);
    trackingResult.classList.remove("is-visible");
    trackingMessage.textContent = "No pudimos cargar el rastreo. Intenta de nuevo en un momento.";
  }
}

trackingForm.addEventListener("submit", e => {
  e.preventDefault();
  searchTracking(trackingCode.value);
});

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
}

const obs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) e.target.classList.add("visible");
}), { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => obs.observe(el));

const params = new URLSearchParams(location.search);
const initial = params.get("codigo");
if (initial) {
  trackingCode.value = initial;
  searchTracking(initial);
}
