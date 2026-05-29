import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agregarHistorialSiCambio,
  buildSimulationFirestorePatch,
  ensureTripSimulationFields,
  generarRutaSimulada,
  getTripCode,
  getTripDestination,
  normalizeTripStatus
} from "./js/trip-simulation.js";
import {
  deleteFirebaseDoc,
  listFirebaseCollection,
  setFirebaseDoc
} from "./firebase-rest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "wayture-api.json");
const USE_FIREBASE_REST = process.env.USE_FIREBASE_REST !== "false";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".bmp": "image/bmp"
};

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function notFound(res, message = "Ruta no encontrada") {
  json(res, 404, { ok: false, error: message });
}

function clean(text) {
  return String(text || "").trim();
}

function normalizeCode(value) {
  return clean(value).toUpperCase();
}

function makeCode(destination = "WAYTURE") {
  const base = clean(destination)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 4)
    .toUpperCase() || "WT";
  return `WT-${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function idFromCode(code) {
  return normalizeCode(code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function ensureDataFile() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    await writeFile(DATA_FILE, JSON.stringify({ viajes: [] }, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, "utf8");
  const db = JSON.parse(raw || "{}");
  return {
    usuarios: Array.isArray(db.usuarios) ? db.usuarios : [],
    viajes: Array.isArray(db.viajes) ? db.viajes : []
  };
}

async function writeDb(db) {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

async function readApiDb() {
  const localDb = await readDb();
  if (!USE_FIREBASE_REST) return { ...localDb, source: "local" };
  try {
    const [usuarios, viajes] = await Promise.all([
      listFirebaseCollection("usuarios"),
      listFirebaseCollection("viajes")
    ]);
    return { usuarios, viajes, source: "firebase" };
  } catch (error) {
    console.warn("Firebase REST no disponible, usando JSON local:", error.message);
    return { ...localDb, source: "local-fallback", firebaseError: error.message };
  }
}

async function persistApiDoc(collectionName, id, data, db, localUpdater) {
  const updatedDb = localUpdater ? localUpdater(db) : db;
  await writeDb(updatedDb);
  if (!USE_FIREBASE_REST) return data;
  try {
    return await setFirebaseDoc(collectionName, id, data);
  } catch (error) {
    console.warn(`No se pudo guardar en Firebase ${collectionName}/${id}:`, error.message);
    return data;
  }
}

async function deleteApiDoc(collectionName, id, db, localUpdater) {
  const updatedDb = localUpdater ? localUpdater(db) : db;
  await writeDb(updatedDb);
  if (!USE_FIREBASE_REST) return true;
  try {
    await deleteFirebaseDoc(collectionName, id);
  } catch (error) {
    console.warn(`No se pudo eliminar en Firebase ${collectionName}/${id}:`, error.message);
  }
  return true;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("El cuerpo debe ser JSON valido.");
    error.status = 400;
    throw error;
  }
}

function toApiTrip(input = {}, existing = {}) {
  const destination = clean(input.destino || input.destination || existing.destino || existing.destination || "Destino");
  const origin = clean(input.origen || input.origin || existing.origen || existing.origin || "Aeropuerto Internacional El Dorado, Bogota");
  const code = normalizeCode(input.codigoViaje || input.code || existing.codigoViaje || existing.code || makeCode(destination));
  const route = Array.isArray(input.route) && input.route.length >= 2
    ? input.route
    : generarRutaSimulada(origin, destination, input.puntoIntermedio1 || existing.puntoIntermedio1, input.puntoIntermedio2 || existing.puntoIntermedio2);
  const base = {
    ...existing,
    ...input,
    id: existing.id || input.id || idFromCode(code),
    codigoViaje: code,
    code,
    origen: origin,
    destino: destination,
    destination,
    nombreViaje: clean(input.nombreViaje || input.name || input.tripName || existing.nombreViaje) || `Viaje a ${destination}`,
    route,
    estado: normalizeTripStatus(input.estado || input.status || existing.estado || existing.status || "Planificado"),
    status: normalizeTripStatus(input.estado || input.status || existing.estado || existing.status || "Planificado"),
    progreso: Number(input.progreso ?? input.progress ?? existing.progreso ?? 0) || 0,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return ensureTripSimulationFields(base);
}

function publicTrip(trip) {
  const normalized = ensureTripSimulationFields(trip);
  return {
    id: normalized.id,
    codigoViaje: getTripCode(normalized),
    nombreViaje: normalized.nombreViaje,
    origen: normalized.origen,
    destino: getTripDestination(normalized),
    estado: normalized.estado,
    progreso: normalized.progreso,
    currentLocation: normalized.currentLocation,
    route: normalized.route,
    statusHistory: normalized.statusHistory,
    startDate: normalized.startDate || "",
    endDate: normalized.endDate || "",
    userEmail: normalized.userEmail || ""
  };
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });

  const db = await readApiDb();
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      app: "WayTure API",
      status: "online",
      database: db.source,
      endpoints: ["/api/usuarios", "/api/viajes", "/api/rastreo/:codigo", "/api/viajeros/ubicaciones"]
    });
  }

  if (req.method === "GET" && url.pathname === "/api/viajes") {
    const q = clean(url.searchParams.get("q")).toLowerCase();
    const status = clean(url.searchParams.get("estado") || url.searchParams.get("status")).toLowerCase();
    const trips = db.viajes
      .map(ensureTripSimulationFields)
      .filter(trip => !q || `${trip.codigoViaje} ${trip.nombreViaje} ${trip.destino} ${trip.userEmail || ""}`.toLowerCase().includes(q))
      .filter(trip => !status || trip.estado.toLowerCase().includes(status));
    return json(res, 200, { ok: true, data: trips });
  }

  if (req.method === "GET" && url.pathname === "/api/usuarios") {
    return json(res, 200, { ok: true, data: db.usuarios });
  }

  if (req.method === "POST" && url.pathname === "/api/usuarios") {
    const body = await readBody(req);
    const uid = clean(body.uid || body.id);
    const email = clean(body.email).toLowerCase();
    if (!uid || !email) {
      return json(res, 400, { ok: false, error: "Debes enviar uid y email." });
    }
    const user = {
      id: uid,
      uid,
      nombre: clean(body.nombre || body.name || "Viajero"),
      alias: clean(body.alias || ""),
      email,
      rol: "usuario",
      creadoEn: body.creadoEn || new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    const index = db.usuarios.findIndex(item => item.uid === uid || String(item.email).toLowerCase() === email);
    await persistApiDoc("usuarios", uid, user, db, current => {
      const next = { usuarios: [...current.usuarios], viajes: current.viajes };
      if (index >= 0) next.usuarios[index] = { ...next.usuarios[index], ...user };
      else next.usuarios.push(user);
      return next;
    });
    return json(res, index >= 0 ? 200 : 201, { ok: true, data: user });
  }

  if (req.method === "POST" && url.pathname === "/api/viajes") {
    const body = await readBody(req);
    const trip = toApiTrip(body);
    if (db.viajes.some(item => normalizeCode(item.codigoViaje || item.code) === trip.codigoViaje)) {
      return json(res, 409, { ok: false, error: "Ya existe un viaje con ese codigo." });
    }
    await persistApiDoc("viajes", trip.id, trip, db, current => ({
      usuarios: current.usuarios,
      viajes: [...current.viajes, trip]
    }));
    return json(res, 201, { ok: true, data: trip });
  }

  if (parts[0] === "api" && parts[1] === "rastreo" && parts[2] && req.method === "GET") {
    const code = normalizeCode(decodeURIComponent(parts[2]));
    const trip = db.viajes.find(item => normalizeCode(item.codigoViaje || item.code) === code);
    if (!trip) return notFound(res, "No existe un viaje con ese codigo.");
    return json(res, 200, { ok: true, data: publicTrip(trip) });
  }

  if (parts[0] === "api" && ["viajeros", "repartidores"].includes(parts[1]) && parts[2] === "ubicaciones" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      data: db.viajes.map(ensureTripSimulationFields).map(trip => ({
        id: trip.id,
        codigoViaje: trip.codigoViaje,
        viajero: trip.userEmail || "Sin asignar",
        destino: trip.destino,
        estado: trip.estado,
        ubicacion: trip.currentLocation
      }))
    });
  }

  if (parts[0] === "api" && parts[1] === "viajes" && parts[2]) {
    const id = decodeURIComponent(parts[2]);
    const index = db.viajes.findIndex(item => item.id === id || normalizeCode(item.codigoViaje || item.code) === normalizeCode(id));
    if (index === -1) return notFound(res, "Viaje no encontrado.");
    const existing = ensureTripSimulationFields(db.viajes[index]);

    if (req.method === "GET" && parts.length === 3) {
      return json(res, 200, { ok: true, data: existing });
    }

    if (req.method === "PUT" && parts.length === 3) {
      const body = await readBody(req);
      const updated = toApiTrip(body, existing);
      await persistApiDoc("viajes", updated.id, updated, db, current => {
        const next = { usuarios: current.usuarios, viajes: [...current.viajes] };
        next.viajes[index] = updated;
        return next;
      });
      return json(res, 200, { ok: true, data: updated });
    }

    if (req.method === "PATCH" && parts[3] === "estado") {
      const body = await readBody(req);
      const nextStatus = normalizeTripStatus(body.estado || body.status || existing.estado);
      const point = body.currentLocation || existing.currentLocation;
      const progreso = Number(body.progreso ?? existing.progreso) || 0;
      const statusHistory = agregarHistorialSiCambio(existing, nextStatus, point, progreso, body.observacion || "Estado actualizado desde API REST.");
      const updated = ensureTripSimulationFields({
        ...existing,
        estado: nextStatus,
        status: nextStatus,
        progreso,
        currentLocation: point,
        statusHistory,
        updatedAt: new Date().toISOString()
      });
      await persistApiDoc("viajes", updated.id, updated, db, current => {
        const next = { usuarios: current.usuarios, viajes: [...current.viajes] };
        next.viajes[index] = updated;
        return next;
      });
      return json(res, 200, { ok: true, data: updated });
    }

    if (req.method === "PATCH" && parts[3] === "gps") {
      const body = await readBody(req);
      const lat = Number(body.lat ?? body.latitude);
      const lng = Number(body.lng ?? body.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, { ok: false, error: "Debes enviar lat y lng numericos." });
      }
      const point = {
        lat,
        lng,
        label: clean(body.label || body.ubicacion || "GPS real del dispositivo"),
        accuracy: Number(body.accuracy) || null,
        capturedAt: new Date().toISOString()
      };
      const nextStatus = normalizeTripStatus(body.estado || body.status || "En ruta");
      const progreso = Number(body.progreso ?? existing.progreso) || existing.progreso || 0;
      const statusHistory = agregarHistorialSiCambio(existing, nextStatus, point, progreso, body.observacion || "Ubicacion GPS real actualizada desde API REST.");
      const updated = ensureTripSimulationFields({
        ...existing,
        ...buildSimulationFirestorePatch({ ...existing, currentLocation: point, estado: nextStatus, status: nextStatus, progreso }),
        currentLocation: point,
        estado: nextStatus,
        status: nextStatus,
        progreso,
        gpsRealActivo: true,
        statusHistory,
        updatedAt: new Date().toISOString()
      });
      await persistApiDoc("viajes", updated.id, updated, db, current => {
        const next = { usuarios: current.usuarios, viajes: [...current.viajes] };
        next.viajes[index] = updated;
        return next;
      });
      return json(res, 200, { ok: true, data: updated });
    }

    if (req.method === "DELETE" && parts.length === 3) {
      const deleted = db.viajes[index];
      await deleteApiDoc("viajes", deleted.id, db, current => {
        const next = { usuarios: current.usuarios, viajes: [...current.viajes] };
        next.viajes.splice(index, 1);
        return next;
      });
      return json(res, 200, { ok: true, data: deleted });
    }
  }

  return notFound(res);
}

async function serveStatic(req, res, url) {
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(__dirname, requested));
  if (!filePath.startsWith(__dirname)) return notFound(res);

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    notFound(res, "Archivo no encontrado.");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    json(res, error.status || 500, { ok: false, error: error.message || "Error interno" });
  }
});

server.listen(PORT, () => {
  console.log(`WayTure listo en http://localhost:${PORT}`);
  console.log(`API REST lista en http://localhost:${PORT}/api/health`);
});
