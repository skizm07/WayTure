const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "waytrue-38d39";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyA0aMZzRDGdRRU4RIR_r8IG26frpFG6KuE";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function firestoreUrl(path) {
  return `${FIRESTORE_BASE_URL}/${path}?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
}

function toFirestoreValue(value) {
  if (value === null || typeof value === "undefined") return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]))
      }
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)]));
  }
  return null;
}

function docFromFirestore(doc = {}) {
  const id = String(doc.name || "").split("/").pop();
  const data = Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
  return { id: data.id || id, ...data };
}

function docToFirestore(data = {}) {
  return {
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]))
  };
}

async function requestFirestore(path, options = {}) {
  const response = await fetch(firestoreUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Firebase rechazo la peticion.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function listFirebaseCollection(collection) {
  const payload = await requestFirestore(collection);
  return (payload.documents || []).map(docFromFirestore);
}

export async function getFirebaseDoc(collection, id) {
  const payload = await requestFirestore(`${collection}/${encodeURIComponent(id)}`);
  return docFromFirestore(payload);
}

export async function setFirebaseDoc(collection, id, data) {
  const payload = await requestFirestore(`${collection}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(docToFirestore({ ...data, id }))
  });
  return docFromFirestore(payload);
}

export async function deleteFirebaseDoc(collection, id) {
  await requestFirestore(`${collection}/${encodeURIComponent(id)}`, { method: "DELETE" });
  return true;
}
