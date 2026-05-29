# WayTure

WayTure es una aplicación web para planificación, gestión y rastreo de viajes. El proyecto combina una página principal visual con autenticación real, panel de usuario, panel administrativo, rastreo público por código y almacenamiento de datos en Firebase.

Está construido con **HTML5, CSS3, JavaScript modular, Firebase Authentication y Cloud Firestore**, sin frameworks frontend.

## Demo

Versión publicada:

https://skizm07.github.io/WayTure/

## Funcionalidades principales

- Landing page con secciones de destinos, planificación, mapa, multimedia, testimonios y contacto.
- Registro e inicio de sesión con Firebase Authentication.
- Roles de cuenta: `usuario` y `admin`.
- Menú de usuario con acceso a panel, gestión de cuenta y cierre de sesión.
- Panel de usuario para crear viajes, consultar viajes asignados y editar datos básicos.
- Rastreo público de viajes mediante código.
- Panel administrativo para gestionar todos los viajes.
- Gestión de itinerario, estado, ubicación, mapa, presupuesto, notas y destinos recomendados.
- Gestión administrativa de formularios de contacto y suscripciones de comunidad.
- Persistencia local para presupuesto, nota editable y destino favorito de la landing.

## Flujo por rol

### Usuario

Después de iniciar sesión o registrarse, el usuario entra a:

```text
rastreo-viaje.html?mis=1
```

Desde su panel puede:

- crear viajes propios
- consultar viajes por código
- ver viajes asignados a su correo o usuario
- editar datos básicos de sus viajes
- ver estado, presupuesto, itinerario y mapa
- gestionar datos de cuenta
- solicitar cambio de contraseña por correo

### Administrador

El administrador también tiene panel de usuario, pero además puede entrar al panel privado:

```text
admin-viajes.html
```

Desde allí puede:

- ver todos los viajes
- crear viajes y asignarlos a usuarios por correo
- editar estado, ubicación y mapa
- agregar actividades al itinerario
- gestionar presupuesto y notas
- agregar destinos recomendados
- eliminar viajes, actividades y destinos
- exportar datos en JSON
- ver y gestionar formularios enviados desde la landing

## Formularios de contacto y comunidad

Los formularios del `index.html` no envían correos directamente. Para evitar servicios pagos o credenciales inseguras en frontend, guardan los datos en Firestore:

- `contactos`: solicitudes del formulario de contacto
- `suscripciones`: correos del formulario de comunidad/newsletter

El administrador puede gestionarlos desde `admin-viajes.html` en la sección **Gestión de contacto y comunidad**.

Acciones disponibles:

- ver contactos recibidos
- ver suscripciones
- marcar contacto como `en gestion` o `gestionado`
- guardar nota administrativa
- archivar suscripciones
- eliminar registros
- abrir respuesta manual por correo con `mailto:`

## Estructura del proyecto

```text
WayTure-main/
├── index.html
├── login.html
├── registro.html
├── rastreo-viaje.html
├── admin-viajes.html
├── README.md
├── .gitignore
├── assets/
│   ├── favicon.ico
│   ├── WayTureNoMAP.png
│   ├── LogoWayTure.png
│   ├── LaWture.png
│   ├── fondo.jpg
│   ├── login.jpg
│   ├── registro.jpg
│   ├── playa.jpg
│   ├── montana.jpg
│   ├── ciudad.jpg
│   ├── paris.jpg
│   ├── amsterdam.jpg
│   ├── tokyo.jpg
│   ├── rutaeuropa.jpg
│   ├── viaje.mp4
│   └── viaje.mp3
├── css/
│   ├── index.css
│   ├── login.css
│   ├── registro.css
│   ├── rastreo-viaje.css
│   └── admin-viajes.css
└── js/
    ├── firebase-config.js
    ├── auth-state.js
    ├── index-page.js
    ├── login-page.js
    ├── register-page.js
    ├── tracking-page.js
    └── admin-page.js
```

## Archivos principales

### `index.html`

Página principal del sitio. Incluye:

- hero principal
- navegación y menú de usuario
- secciones de funciones, destinos, planificación, mapa y multimedia
- presupuesto local
- nota editable con `localStorage`
- SVG y Canvas
- formulario de contacto
- formulario de comunidad/newsletter

Lógica asociada: `js/index-page.js`  
Estilos asociados: `css/index.css`

### `login.html`

Pantalla de inicio de sesión con Firebase Authentication.

Lógica asociada: `js/login-page.js`  
Estilos asociados: `css/login.css`

### `registro.html`

Pantalla de registro. Crea usuario en Firebase Auth y guarda el perfil en Firestore.

Lógica asociada: `js/register-page.js`  
Estilos asociados: `css/registro.css`

### `rastreo-viaje.html`

Pantalla de rastreo y panel de usuario.

Permite:

- consultar un viaje por código
- ver progreso, mapa, presupuesto, notas e itinerario
- crear viajes propios si hay sesión iniciada
- editar datos básicos de viajes asignados
- gestionar datos de cuenta

Lógica asociada: `js/tracking-page.js`  
Estilos asociados: `css/rastreo-viaje.css`

### `admin-viajes.html`

Panel privado para administradores.

Permite:

- gestionar viajes
- gestionar itinerarios
- administrar presupuestos y notas
- agregar destinos recomendados
- gestionar solicitudes de contacto
- gestionar suscripciones
- exportar datos

Lógica asociada: `js/admin-page.js`  
Estilos asociados: `css/admin-viajes.css`

## JavaScript

### `js/firebase-config.js`

Inicializa Firebase y exporta:

- `auth`
- `db`

### `js/auth-state.js`

Controla el estado global de sesión:

- detecta usuario autenticado
- muestra u oculta login, registro y menú de usuario
- muestra enlaces de admin solo si el rol es `admin`
- maneja cierre de sesión
- sincroniza nombre e iniciales del usuario en la interfaz

### `js/index-page.js`

Controla interacciones de la landing:

- presupuesto local
- nota editable
- destino favorito
- banner flotante
- menú móvil
- formulario de contacto hacia Firestore
- newsletter hacia Firestore
- animaciones de entrada
- Canvas
- reto DOM de “Misión Cumplida”

### `js/tracking-page.js`

Controla rastreo y panel de usuario:

- consulta por código de viaje
- renderiza resultado público
- carga viajes del usuario autenticado
- crea viajes propios
- edita datos básicos
- gestiona perfil
- envía correo de recuperación de contraseña mediante Firebase Auth

### `js/admin-page.js`

Controla el panel administrativo:

- valida rol `admin`
- carga viajes, destinos, contactos y suscripciones
- crea y edita viajes
- actualiza estado, mapa, itinerario, presupuesto y notas
- gestiona destinos recomendados
- gestiona solicitudes de contacto y comunidad
- exporta datos en JSON

## Colecciones de Firestore

El proyecto usa estas colecciones:

### `usuarios`

Guarda datos del perfil:

- `uid`
- `nombre`
- `alias`
- `email`
- `rol`
- `creadoEn`
- `actualizadoEn`

### `viajes`

Guarda viajes creados por usuarios o administradores:

- `code`
- `destination`
- `startDate`
- `endDate`
- `travelers`
- `experience`
- `status`
- `lastLocation`
- `mapQuery`
- `transport`
- `hotel`
- `food`
- `activitiesCost`
- `notes`
- `itinerary`
- `userId`
- `userEmail`
- `createdBy`
- `createdByRole`
- `createdAt`
- `updatedAt`

### `destinosRecomendados`

Guarda destinos creados desde el panel admin:

- `name`
- `image`
- `rating`
- `description`
- `mapLink`
- `createdAt`
- `createdBy`

### `contactos`

Guarda solicitudes del formulario de contacto:

- `name`
- `email`
- `destination`
- `message`
- `status`
- `adminNote`
- `source`
- `createdAt`
- `updatedAt`
- `managedBy`

### `suscripciones`

Guarda suscripciones de comunidad:

- `email`
- `status`
- `source`
- `createdAt`
- `updatedAt`
- `managedBy`

## Persistencia local

Además de Firebase, la landing usa `localStorage` para datos de experiencia local:

- `wayture_logged_user`
- `wayture_user_role`
- `wayture_budget`
- `wayture_note`
- `wayture_favorite_destination`

## Configuración de Firebase

El archivo de configuración está en:

```text
js/firebase-config.js
```

Debe tener la configuración web del proyecto Firebase:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`

En Firebase Console se debe habilitar:

1. **Authentication > Sign-in method > Email/Password**
2. **Firestore Database**

## Reglas de Firestore

Las reglas exactas dependen del entorno, pero la app necesita:

- permitir crear perfiles de usuario al registrarse
- permitir que cada usuario lea/actualice su perfil
- permitir que usuarios autenticados creen viajes propios
- permitir que usuarios consulten o editen viajes asignados a ellos
- permitir que admins lean y gestionen todos los viajes
- permitir crear `contactos` y `suscripciones` desde la landing
- permitir que admins lean, actualicen y eliminen `contactos` y `suscripciones`

## Cómo ejecutar en local

No hay build. Para la parte visual puede usarse Live Server, y para la actividad con Postman se agregó una API REST local en Node.js.

### Opción API REST + Postman

Desde la carpeta del proyecto:

```bash
npm start
```

Luego abre:

```text
http://localhost:3000
```

La API queda disponible en:

```text
http://localhost:3000/api
```

Endpoints principales:

- `GET /api/health`
- `GET /api/usuarios`
- `POST /api/usuarios`
- `GET /api/viajes`
- `POST /api/viajes`
- `GET /api/viajes/:id`
- `PUT /api/viajes/:id`
- `PATCH /api/viajes/:id/estado`
- `PATCH /api/viajes/:id/gps`
- `DELETE /api/viajes/:id`
- `GET /api/rastreo/:codigo`
- `GET /api/viajeros/ubicaciones`

Colección de Postman:

```text
docs/WayTure.postman_collection.json
```

La API REST está conectada a Firebase Firestore. Al consultar:

```text
GET /api/health
```

debe aparecer `database: "firebase"` cuando la conexión está activa. Si aparece `database: "local-fallback"`, el servidor no pudo llegar a Firebase y usa temporalmente el respaldo local.

El respaldo local guarda datos en:

```text
data/wayture-api.json
```

### Opción recomendada: Live Server

1. Abre el proyecto en Visual Studio Code.
2. Instala la extensión **Live Server**.
3. Haz clic derecho sobre `index.html`.
4. Selecciona **Open with Live Server**.

### Opción alternativa

Abrir `index.html` directamente puede funcionar para partes visuales, pero Firebase y módulos ES pueden requerir servidor local según el navegador. Por eso se recomienda Live Server.

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript ES Modules
- Firebase Authentication
- Cloud Firestore
- Google Maps Embed
- localStorage
- SVG
- Canvas
- Audio y video HTML5

## Buenas prácticas aplicadas

- Separación de HTML, CSS y JavaScript.
- Un CSS por pantalla para evitar conflictos de cascada.
- JavaScript modular por página.
- Navegación según estado de autenticación.
- Roles diferenciados entre usuario y administrador.
- Datos persistentes en Firestore.
- `.gitignore` para evitar archivos innecesarios como `.DS_Store`.

## Consideraciones

- El proyecto no usa backend propio.
- Los formularios se gestionan desde el panel admin mediante Firestore.
- Las funciones dependen de una configuración correcta de Firebase y reglas de seguridad.

## Posibles mejoras futuras

- Crear reglas de Firestore más estrictas para producción.
- Añadir filtros y búsqueda en el panel admin.
- Añadir notificaciones internas para nuevos contactos.
- Añadir historial de cambios por viaje.
- Añadir exportación CSV además de JSON.
- Crear dashboard estadístico para destinos y solicitudes.
- Agregar pruebas automatizadas.

## Autoría

- Juan Rojas
- Santiago Cardenas
- Juan Fajardo
- 2026 ING WEB
