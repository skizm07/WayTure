# WayTure — Explicación técnica del proyecto

**Proyecto:** WayTure — Plataforma de gestión y rastreo de viajes  
**Asignatura:** Ingeniería Web  
**Año:** 2026  
**Autores:** Juan Rojas · Santiago Cardenas · Juan Fajardo · Alejandro Tole 

---

## 1. Descripción general

WayTure es una aplicación web multicapa que simula una agencia de viajes digital. Permite a usuarios registrarse, solicitar y consultar itinerarios de viaje, y a administradores gestionar todos esos viajes desde un panel privado.

El proyecto demuestra el uso integrado de tecnologías frontend modernas (HTML5, CSS3, JavaScript modular) con un backend gestionado completamente por Firebase, sin necesidad de servidor propio.

---

## 2. Arquitectura general

```
CLIENTE (Navegador)
│
├── index.html           → Landing pública
├── login.html           → Autenticación
├── registro.html        → Registro de usuario
├── panel-usuario.html   → Zona privada del usuario
├── rastreo-viaje.html   → Consulta pública de viajes
└── admin-viajes.html    → Panel privado del administrador
         │
         ▼
    Firebase SDK (CDN — sin instalación)
         │
         ├── Firebase Authentication  → Gestión de identidad
         └── Cloud Firestore          → Base de datos documental en tiempo real
```

No hay backend propio. Toda la lógica de negocio ocurre en el navegador y se comunica directamente con Firebase mediante sus SDK oficiales.

---

## 3. Páginas del proyecto

### 3.1 `index.html` — Landing page

La página principal del sitio. Es completamente pública (no requiere autenticación).

**Secciones:**

| Sección | Contenido |
|---|---|
| Hero | Título animado, botones CTA, fondo con imagen |
| Funciones | Tarjetas descriptivas de la plataforma |
| Destinos | Galería con imágenes y chips de categorías |
| Planificador | Widget de presupuesto interactivo con `localStorage` |
| Mapa | Google Maps embebido mediante `<iframe>` |
| Multimedia | Reproducción de video y audio nativos HTML5 |
| Extras | Canvas animado, SVG de ruta aérea, nota editable, presupuesto favorito |
| Testimonios | Tarjetas de reseñas |
| Contacto | Formulario que guarda en Firestore |
| Comunidad | Suscripción a newsletter que guarda en Firestore |

**Técnicas CSS aplicadas:**
- Variables CSS (`--brand`, `--bg`, `--radius-xl`, etc.) para consistencia visual
- `clamp()` para tipografía fluida adaptable a cualquier pantalla
- Flexbox en el header y secciones de tarjetas
- CSS Grid en secciones de dos o más columnas
- Pseudo-elementos `::before` / `::after` para líneas decorativas y degradados
- Animaciones CSS (`@keyframes`) en el hero y chips
- Media queries para diseño responsive desde móvil hasta pantallas grandes

**Técnicas JavaScript aplicadas:**
- `IntersectionObserver` para activar animaciones `.reveal` al hacer scroll
- `Canvas 2D API` para dibujar la escena animada de horizonte (cielo, montaña, mar, sol, avión)
- `SVG` animado para la ruta de vuelo con `stroke-dashoffset`
- `localStorage` para persistir presupuesto, nota y destino favorito entre sesiones
- Formularios hacia Firestore con `addDoc` y `serverTimestamp`

---

### 3.2 `login.html` — Inicio de sesión

Pantalla de autenticación con un único campo de identidad que acepta correo electrónico o alias de usuario.

**Lógica de resolución de alias (`login-page.js`):**

```js
async function resolveEmail(input) {
  if (input.includes("@")) return input;           // es un correo
  const byAlias = await getDocs(query(
    collection(db, "usuarios"), where("alias", "==", input)
  ));
  if (!byAlias.empty) return byAlias.docs[0].data().email;
  const byName = await getDocs(query(
    collection(db, "usuarios"), where("nombre", "==", input)
  ));
  if (!byName.empty) return byName.docs[0].data().email;
  return null;
}
```

Firebase Auth solo admite autenticación por email, por lo que si el usuario ingresa un alias, el sistema consulta Firestore primero para obtener el email correspondiente y luego autentica normalmente.

---

### 3.3 `registro.html` — Registro de usuario

Formulario que crea la cuenta en Firebase Authentication y guarda el perfil en Firestore simultáneamente.

**Proceso (`register-page.js`):**

1. `createUserWithEmailAndPassword(auth, email, password)` — crea la cuenta en Firebase Auth
2. `updateProfile(cred.user, { displayName: nombre })` — asocia el nombre al usuario
3. `setDoc(doc(db, "usuarios", cred.user.uid), {...})` — guarda el perfil en Firestore

El registro crea cuentas con rol `"usuario"` únicamente. El rol `"admin"` solo se puede asignar manualmente desde Firebase Console, lo que garantiza que nadie pueda auto-asignarse permisos administrativos.

---

### 3.4 `panel-usuario.html` — Panel del usuario

Zona privada donde el usuario autenticado gestiona sus viajes. El contenido se renderiza dinámicamente mediante `tracking-page.js`.

**Secciones del panel:**

| Sección | Funcionalidad |
|---|---|
| Crear viaje | Formulario para registrar un viaje propio con código de rastreo |
| Mis viajes asignados | Lista de viajes vinculados al correo del usuario |
| Datos de cuenta | Edición de nombre, alias y solicitud de cambio de contraseña |

La sección de "Mis viajes asignados" consulta Firestore con un filtro `where("userEmail", "==", email)`, mostrando solo los viajes que el administrador asignó a ese correo.

---

### 3.5 `rastreo-viaje.html` — Rastreo público

Permite a cualquier persona consultar el estado de un viaje ingresando el código público (ej. `WT-PARIS-1234`).

**Flujo:**
1. El usuario ingresa el código en el formulario
2. El sistema consulta Firestore: `where("code", "==", codigo)`
3. Si existe, muestra: destino, estado, última ubicación, fechas, itinerario, historial de estados y mapa de Google Maps actualizado al destino
4. El mapa se actualiza dinámicamente cambiando el `src` del `<iframe>`

---

### 3.6 `admin-viajes.html` — Panel administrativo

El núcleo del sistema. Solo accesible para cuentas con `rol: "admin"` en Firestore.

**Verificación de rol (`admin-page.js`):**

```js
onAuthStateChanged(auth, async user => {
  if (!user) { showBlocked("No has iniciado sesión."); return; }
  const ps = await getDoc(doc(db, "usuarios", user.uid));
  currentProfile = ps.exists() ? ps.data() : { rol: "usuario" };
  if (currentProfile.rol !== "admin") {
    showBlocked("No tienes permisos de administrador.");
    setTimeout(() => location.href = "panel-usuario.html", 1200);
    return;
  }
  showDashboard();
  initRealtimeListeners();
});
```

**Actualizaciones en tiempo real con `onSnapshot`:**

```js
function initRealtimeListeners() {
  unsubscribers.push(onSnapshot(
    query(collection(db, "viajes"), orderBy("createdAt", "desc")),
    snap => {
      viajes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMetrics(); renderTrips(); renderSelected();
    }
  ));
  // ... listeners para destinos, contactos, suscripciones
}
```

`onSnapshot` mantiene una conexión persistente con Firestore. Cada vez que un documento cambia (desde cualquier dispositivo o pestaña), el callback se ejecuta automáticamente y actualiza la interfaz sin recargar. Los listeners se desregistran al cerrar sesión para liberar recursos.

**Sidebar de navegación con CSS Grid:**

El layout del panel usa `grid-template-areas` para posicionar el sidebar de forma declarativa:

```css
.dashboard.is-visible {
  display: grid;
  grid-template-columns: 220px 1fr;
  grid-template-areas:
    "top     top"
    "sidebar metrics"
    "sidebar requests"
    "sidebar trips";
}
```

Esto posiciona el sidebar en la columna izquierda, haciéndolo `sticky` mientras el contenido principal hace scroll.

---

## 4. Sistema de autenticación y roles

### Flujo de autenticación

```
Usuario ingresa credenciales
        ↓
Firebase Auth verifica identidad
        ↓
onAuthStateChanged detecta el cambio de estado
        ↓
Se consulta el documento del usuario en Firestore
        ↓
Se lee el campo "rol"
        ↓
"usuario"  →  panel-usuario.html
"admin"    →  admin-viajes.html (acceso completo)
```

### `auth-state.js` — Control global de sesión

Este módulo se importa en todas las páginas. Su responsabilidad es:
- Detectar si hay sesión activa (`onAuthStateChanged`)
- Mostrar u ocultar los enlaces de Login/Registro según el estado
- Mostrar el menú de usuario con nombre e iniciales cuando hay sesión
- Mostrar el enlace al panel admin solo si el rol es `admin`
- Gestionar el cierre de sesión desde cualquier página

---

## 5. Modelo de datos (Firestore)

Firestore es una base de datos documental NoSQL orientada a documentos JSON. WayTure usa 5 colecciones:

```
usuarios/
  {uid}/
    nombre, alias, email, rol, creadoEn

viajes/
  {autoId}/
    code, destination, startDate, endDate, travelers,
    experience, status, lastLocation, mapQuery,
    transport, hotel, food, activitiesCost,
    notes, itinerary[], statusHistory[],
    userEmail, userId, createdBy, createdAt, updatedAt

contactos/
  {autoId}/
    name, email, destination, message, status,
    adminNote, managedBy, managedByName, createdAt, updatedAt

suscripciones/
  {autoId}/
    email, status, source, managedBy, createdAt, updatedAt

destinosRecomendados/
  {autoId}/
    name, image, rating, description, mapLink,
    createdBy, createdAt, updatedAt
```

### Códigos de viaje

Los códigos son únicos y se generan así:

```js
function makeCode(dest) {
  const slug = dest.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, "-")   // reemplaza espacios/símbolos
    .slice(0, 14).toUpperCase();
  return `WT-${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
}
```

El sistema verifica en Firestore que el código no exista antes de guardarlo.

---

## 6. Chat widget de gestión rápida

Componente flotante (`chat-admin.js`) que permite al administrador registrar viajes pegando texto libre.

**Parser de texto:**

El módulo combina dos estrategias de análisis:

1. **Parser estructurado:** si el texto tiene líneas con formato `Clave: Valor`, extrae cada campo directamente.

2. **Parser de texto libre:** usa expresiones regulares para detectar:
   - Correos: `[\w.+-]+@[\w.-]+\.[a-z]{2,}`
   - Fechas: DD/MM/AAAA, AAAA-MM-DD, "15 de junio de 2026"
   - Viajeros: dígito + "viajeros/personas/pax"
   - Tipo de experiencia: palabras clave como "cultural", "aventura", "playa"
   - Estado del viaje: "reservado", "en curso", "finalizado", etc.

Una vez extraídos los datos, se rellenan los campos del formulario con:
```js
function fillTripForm(p) {
  const f = document.getElementById("tripForm");
  if (p.destination) f.destination.value = p.destination;
  if (p.email)       f.assignedEmail.value = p.email;
  if (p.startDate)   f.startDate.value = p.startDate;
  // ...
}
```

---

## 7. Técnicas CSS destacadas

### Variables CSS (custom properties)
```css
:root {
  --bg: #081120;
  --brand: #38bdf8;
  --brand-2: #22c55e;
  --accent: #f59e0b;
  --radius-xl: 28px;
}
```
Permite cambiar toda la paleta de colores modificando un solo lugar.

### Grid con named areas
```css
.dashboard.is-visible {
  display: grid;
  grid-template-areas:
    "top top"
    "sidebar metrics"
    "sidebar requests"
    "sidebar trips";
}
.admin-sidebar { grid-area: sidebar; position: sticky; top: 102px; }
.metrics-grid  { grid-area: metrics; }
```

### Animaciones de entrada con IntersectionObserver
```js
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add("visible");
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
```

Con CSS:
```css
.reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.7s, transform 0.7s; }
.reveal.visible { opacity: 1; transform: translateY(0); }
```

### Backdrop filter (efecto vidrio)
```css
header {
  background: rgba(8, 17, 32, 0.72);
  backdrop-filter: blur(16px);
}
```

---

## 8. Técnicas HTML5 destacadas

### Elementos semánticos
```html
<header>, <nav>, <main>, <section>, <article>, <aside>, <footer>
```

### Canvas 2D
```js
const ctx = canvas.getContext("2d");
ctx.fillStyle = "linear-gradient(...)";
ctx.arc(x, y, r, 0, Math.PI * 2);
ctx.fill();
```

### SVG animado
```html
<svg viewBox="0 0 760 220">
  <path id="flightPath" d="M 60 180 Q 380 20 700 80" />
  <circle>
    <animateMotion dur="4s" repeatCount="indefinite">
      <mpath href="#flightPath"/>
    </animateMotion>
  </circle>
</svg>
```

### Multimedia nativa
```html
<video controls autoplay muted loop>
  <source src="assets/viaje.mp4" type="video/mp4">
</video>
<audio controls>
  <source src="assets/viaje.mp3" type="audio/mpeg">
</audio>
```

### Google Maps Embed (sin API key)
```html
<iframe
  src="https://www.google.com/maps?q=Paris+France&output=embed"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade">
</iframe>
```

El `src` se actualiza dinámicamente desde JavaScript cuando el administrador selecciona un viaje.

---

## 9. Seguridad y consideraciones

### Lo que protege el sistema
- El rol `admin` se verifica en Firestore, no en localStorage. Aunque se manipule localStorage, `onAuthStateChanged` siempre consulta Firestore para leer el rol real.
- El registro público no permite crear cuentas admin. El campo rol solo se puede modificar desde Firebase Console.
- Las contraseñas son gestionadas completamente por Firebase Auth (nunca se almacenan en Firestore).

### Limitaciones conocidas
- Las reglas de Firestore en el entorno de desarrollo pueden estar en modo abierto. Para producción se deben definir reglas estrictas que validen `request.auth.uid` y el campo `rol`.
- La API key de Firebase en `firebase-config.js` es pública (es el comportamiento esperado en Firebase web). La seguridad real está en las reglas de Firestore, no en ocultar la key.

---

## 10. Resumen de tecnologías

| Tecnología | Versión / Especificación | Uso en el proyecto |
|---|---|---|
| HTML5 | Living Standard | Estructura semántica de todas las páginas |
| CSS3 | Custom Properties, Grid, Flexbox, Animations | Diseño, layout y animaciones |
| JavaScript | ES2022 (Modules, async/await, Optional chaining) | Lógica de todas las páginas |
| Firebase Authentication | v10.12.5 | Login, registro, sesión |
| Cloud Firestore | v10.12.5 | Base de datos, tiempo real con onSnapshot |
| Google Maps Embed | Pública (sin key) | Mapas en rastreo y panel admin |
| Canvas 2D API | Nativa HTML5 | Escena de horizonte animada |
| SVG | Nativo HTML5 | Ruta de vuelo animada |
| IntersectionObserver | Nativa DOM | Animaciones de entrada al hacer scroll |
| localStorage | Web Storage API | Persistencia de preferencias locales |
| Clipboard API | Nativa DOM | Copiar código de viaje |
| Audio/Video HTML5 | Nativo | Reproducción multimedia en la landing |

---

## 11. Conclusión

WayTure demuestra que es posible construir una aplicación web funcional y completa sin un servidor backend propio, usando únicamente tecnologías del navegador y servicios de Firebase. El proyecto integra:

- **Autenticación real** con roles y control de acceso
- **Base de datos en tiempo real** con sincronización entre múltiples clientes
- **Diseño responsive** sin frameworks CSS
- **Código modular** sin bundlers ni transpiladores
- **Experiencia de usuario** cuidada con animaciones, transiciones y feedback visual

La separación de responsabilidades (un CSS y un JS por página), el uso de ES Modules y la arquitectura de roles hace que el proyecto sea mantenible y escalable para futuras mejoras.
