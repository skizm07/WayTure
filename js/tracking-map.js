import {
  ensureTripSimulationFields,
  routeIndexFromProgress
} from "./trip-simulation.js";

const mapStates = new WeakMap();

function getContainer(container) {
  if (typeof container === "string") return document.getElementById(container);
  return container || null;
}

function routeLatLngs(route) {
  return route.map(point => [Number(point.lat), Number(point.lng)]);
}

function markerIcon() {
  if (!window.L) return null;
  return L.divIcon({
    className: "wayture-marker",
    html: '<span></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function clearLayer(map, layer) {
  if (layer) map.removeLayer(layer);
}

function ensureMap(container, firstPoint) {
  if (!window.L || !container) return null;
  const existing = mapStates.get(container);
  if (existing?.map) return existing;

  const map = L.map(container, { scrollWheelZoom: false }).setView([firstPoint.lat, firstPoint.lng], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  const state = { map, routeLayer: null, traveledLayer: null, gpsLinkLayer: null, marker: null, pointsLayer: null };
  mapStates.set(container, state);
  return state;
}

export function renderizarMapaRuta(viaje, options = {}) {
  const container = getContainer(options.container || "trackingMap");
  if (!container) return null;
  const trip = ensureTripSimulationFields(viaje);
  const firstPoint = trip.route[0] || trip.currentLocation;

  if (!window.L) {
    container.innerHTML = '<div class="empty-state">Leaflet no está disponible para renderizar el mapa.</div>';
    return null;
  }

  const state = ensureMap(container, firstPoint);
  if (!state) return null;
  const { map } = state;
  const latLngs = routeLatLngs(trip.route);
  const currentIndex = routeIndexFromProgress(trip.progreso, trip.route.length);
  const traveledLatLngs = latLngs.slice(0, currentIndex + 1);
  const currentLatLng = [trip.currentLocation.lat, trip.currentLocation.lng];

  clearLayer(map, state.routeLayer);
  clearLayer(map, state.traveledLayer);
  clearLayer(map, state.gpsLinkLayer);
  clearLayer(map, state.pointsLayer);

  state.routeLayer = L.polyline(latLngs, {
    color: "#38bdf8",
    weight: 5,
    opacity: 0.9
  }).addTo(map);

  state.traveledLayer = L.polyline(traveledLatLngs.length ? traveledLatLngs : [currentLatLng], {
    color: "#22c55e",
    weight: 7,
    opacity: 0.95
  }).addTo(map);

  if (trip.gpsFueraDeRuta && traveledLatLngs.length) {
    state.gpsLinkLayer = L.polyline([traveledLatLngs[traveledLatLngs.length - 1], currentLatLng], {
      color: "#f97316",
      weight: 3,
      opacity: 0.85,
      dashArray: "8 8"
    }).addTo(map);
  }

  state.pointsLayer = L.layerGroup(trip.route.map(point => L.circleMarker([point.lat, point.lng], {
    radius: 5,
    color: "#ffffff",
    weight: 2,
    fillColor: "#0f172a",
    fillOpacity: 0.95
  }).bindTooltip(point.label || "Punto de ruta", { direction: "top" }))).addTo(map);

  if (!state.marker) {
    state.marker = L.marker(currentLatLng, { icon: markerIcon() || undefined }).addTo(map);
  } else {
    state.marker.setLatLng(currentLatLng);
  }

  state.marker.bindPopup(trip.currentLocation.label || "Ubicación GPS real");
  if (options.openPopup) state.marker.openPopup();

  if (options.fit !== false && state.routeLayer.getBounds().isValid()) {
    const bounds = L.latLngBounds([...latLngs, currentLatLng]);
    map.fitBounds(bounds, { padding: [28, 28] });
    if (trip.gpsFueraDeRuta) {
      setTimeout(() => map.panTo(currentLatLng), 180);
    }
  } else {
    map.panTo(currentLatLng);
  }

  setTimeout(() => map.invalidateSize(), 120);
  return state;
}

export function moverMarcadorEnRuta(viaje, options = {}) {
  const container = getContainer(options.container || "trackingMap");
  if (!container) return null;
  const state = mapStates.get(container);
  if (!state) return renderizarMapaRuta(viaje, { ...options, fit: options.fit ?? false });

  const trip = ensureTripSimulationFields(viaje);
  const latLngs = routeLatLngs(trip.route);
  const currentIndex = routeIndexFromProgress(trip.progreso, trip.route.length);
  const traveledLatLngs = latLngs.slice(0, currentIndex + 1);
  const currentLatLng = [trip.currentLocation.lat, trip.currentLocation.lng];

  if (!state.marker) {
    state.marker = L.marker(currentLatLng, { icon: markerIcon() || undefined }).addTo(state.map);
  } else {
    state.marker.setLatLng(currentLatLng);
  }

  state.marker.bindPopup(trip.currentLocation.label || "Ubicación GPS real");
  if (state.traveledLayer) state.traveledLayer.setLatLngs(traveledLatLngs.length ? traveledLatLngs : [currentLatLng]);
  if (state.gpsLinkLayer) {
    if (trip.gpsFueraDeRuta && traveledLatLngs.length) {
      state.gpsLinkLayer.setLatLngs([traveledLatLngs[traveledLatLngs.length - 1], currentLatLng]);
    } else {
      state.gpsLinkLayer.setLatLngs([]);
    }
  }
  if (options.pan !== false) state.map.panTo(currentLatLng);
  setTimeout(() => state.map.invalidateSize(), 80);
  return state;
}

export function limpiarMapaRuta(containerRef) {
  const container = getContainer(containerRef);
  const state = container ? mapStates.get(container) : null;
  if (!state) return;
  state.map.remove();
  mapStates.delete(container);
}
