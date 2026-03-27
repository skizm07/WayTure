# WayTure

WayTure es un proyecto web frontend orientado a la planificación de viajes. Su propuesta combina una landing page visualmente inmersiva con pequeñas funcionalidades interactivas para simular la experiencia de una plataforma turística moderna. El sitio fue desarrollado con **HTML5, CSS3 y JavaScript**, sin frameworks, para demostrar de forma práctica distintos fundamentos del desarrollo web.

## Demo del proyecto

Puedes ver la versión publicada en GitHub Pages aquí:

**Sitio en línea:**  
https://skizm07.github.io/WayTure/

## Descripción general

La aplicación presenta una experiencia centrada en el usuario, con una página principal rica en contenido visual, formularios de autenticación externos, elementos multimedia y almacenamiento local. Aunque no trabaja con backend ni base de datos real, sí simula interacciones frecuentes de una app web:

- registro e inicio de sesión de demostración
- saludo personalizado al usuario
- cálculo de presupuesto de viaje
- notas personales editables
- selección y guardado de destino favorito
- formulario de contacto
- mapa incrustado
- integración de audio, video, SVG y Canvas

El objetivo principal es mostrar cómo varios temas vistos en clase pueden integrarse dentro de un solo producto web con una presentación más cercana a un sitio real.

## Objetivos del proyecto

WayTure fue construido para:

- practicar la estructura semántica de una aplicación web
- aplicar estilos modernos y composición visual con CSS
- trabajar formularios e interacciones con JavaScript
- utilizar `localStorage` para persistencia básica en el navegador
- incorporar recursos multimedia y gráficos
- demostrar una navegación simple entre varias páginas HTML
- presentar un proyecto académico con una estética más profesional

## Qué puede hacer el usuario

Dentro de WayTure, el usuario puede:

- navegar entre la página principal, login y registro
- crear una cuenta de demostración
- iniciar sesión con un nombre visible dentro de la experiencia
- recibir una bienvenida personalizada en la portada
- diligenciar un formulario de contacto
- calcular un presupuesto estimado del viaje
- guardar ese presupuesto localmente
- escribir y editar notas personales del viaje
- limpiar o recuperar su nota guardada
- establecer un destino favorito
- visualizar contenido multimedia de apoyo
- explorar secciones visuales con tarjetas, testimonios, mapa, SVG y Canvas

## Flujo de uso

1. El usuario entra a `index.html`.
2. Desde la navegación puede ir a `registro.html` o `login.html`.
3. Al registrarse o iniciar sesión, el nombre se guarda en `localStorage`.
4. La aplicación redirige nuevamente al inicio.
5. En la página principal aparece un mensaje de bienvenida con el nombre del usuario.
6. Desde allí puede seguir interactuando con presupuesto, notas, favoritos y formulario.

## Persistencia de datos

El proyecto usa `localStorage` para conservar información entre recargas del navegador. Actualmente se manejan claves como:

- `wayture_registered_name`
- `wayture_logged_user`
- `wayture_budget`
- `wayture_note`
- `wayture_favorite_destination`

Esto permite que parte de la experiencia se mantenga activa aunque el usuario cierre o recargue la página.

## Estructura del proyecto

```text
WayTure-main/
├── index.html
├── login.html
├── registro.html
├── README.md
├── css/
│   └── style.css
├── assets/
│   ├── favicon.ico
│   ├── WayTureNoMAP.png
│   ├── LogoWayTure.png
│   ├── fondo.jpg
│   ├── playa.jpg
│   ├── montana.jpg
│   ├── ciudad.jpg
│   ├── paris-destination.jpg
│   ├── tokyo-destination.jpg
│   ├── amsterdam-destination.jpg
│   ├── viaje.mp4
│   └── viaje.mp3
├── docs/
└── js/
```

## Descripción de archivos principales

### `index.html`

Es la página principal y el núcleo del proyecto. Aquí se concentra la mayoría de la experiencia de usuario y también la mayor parte de los temas aplicados. Incluye:

- hero principal con imagen de fondo
- navegación interna
- tarjetas de funciones
- destinos destacados
- planeador y presupuesto
- sección de mapa
- contenido en columnas
- nota editable
- gráfico SVG
- ilustración dinámica en Canvas
- testimonios
- formulario de contacto
- banner flotante de oferta

### `login.html`

Página externa de inicio de sesión. Permite ingresar un nombre, correo y contraseña de demostración. Al enviar el formulario:

- guarda el nombre del usuario en `localStorage`
- muestra un mensaje de bienvenida
- redirige al inicio

### `registro.html`

Página externa de registro de usuario. Incluye validación básica de confirmación de contraseña y luego:

- guarda el nombre registrado en `localStorage`
- inicia la sesión de forma simulada
- redirige al `index`

### `css/style.css`

Contiene estilos base de una versión más tradicional del sitio. Aunque gran parte del diseño actual está integrado directamente dentro de las páginas HTML mediante estilos embebidos, este archivo sigue formando parte de la estructura del proyecto y muestra estilos complementarios trabajados durante el desarrollo.

### `assets/`

Contiene todos los recursos visuales y multimedia del proyecto:

- imágenes de portada y destinos
- logotipos
- favicon
- audio
- video

## Tecnologías utilizadas

- **HTML5** para la estructura semántica
- **CSS3** para estilos, layout, animaciones y responsive design
- **JavaScript** para interacciones y persistencia local
- **localStorage** para almacenar datos del usuario en el navegador
- **Google Maps Embed** para el mapa incrustado
- **GitHub Pages** para el despliegue del proyecto

## Temas y conceptos aplicados

El proyecto reúne varios temas fundamentales del desarrollo web frontend, entre ellos:

- estructura semántica de HTML5
- etiquetas básicas
- listas, enlaces e imágenes
- favicon
- bordes redondeados
- sombras
- imágenes de fondo
- tipografías
- centrado de contenido
- `float`
- `flexbox`
- `position`
- transformaciones con `transform`
- formularios
- `iframe`
- transiciones con `transition`
- columnas de texto
- video
- audio
- transparencias y degradados
- animaciones con `animation`
- gráficos SVG
- gráficos con Canvas
- media queries
- contenido editable
- almacenamiento con `localStorage`

## Diseño e interfaz

WayTure busca una apariencia moderna y atractiva mediante:

- fondos con gradientes e imágenes inmersivas
- tarjetas con efecto glassmorphism
- botones con transiciones y sombras
- animaciones de entrada y microinteracciones
- composición visual basada en bloques y paneles
- secciones informativas con jerarquía clara

Esto hace que el proyecto se acerque más a una landing page real de producto digital que a una maqueta básica de clase.

## Cómo ejecutar el proyecto en local

No se requiere instalación de dependencias ni proceso de compilación.

### Opción 1: abrir directamente el archivo

1. Descarga o clona este repositorio.
2. Entra a la carpeta del proyecto.
3. Abre `index.html` en tu navegador.

### Opción 2: usar Live Server en VS Code

1. Abre la carpeta del proyecto en Visual Studio Code.
2. Instala la extensión **Live Server** si aún no la tienes.
3. Haz clic derecho sobre `index.html`.
4. Selecciona **Open with Live Server**.

## Consideraciones del proyecto

Es importante tener en cuenta que:

- el login y el registro ahora pueden conectarse a Firebase Authentication
- no existe un backend propio para autenticación personalizada
- los datos se guardan solo en el navegador del usuario
- si se limpia el almacenamiento local, se pierde la información guardada
- algunas funciones están orientadas principalmente a demostración académica y visual

## Configurar Firebase Authentication

Para activar el registro y login reales con Firebase:

1. Crea un proyecto en Firebase Console.
2. En `Authentication > Sign-in method`, habilita `Email/Password`.
3. En `Project settings > Your apps`, copia la configuración web de Firebase.
4. Abre `js/firebase-config.js`.
5. Reemplaza los valores `REEMPLAZA_CON_TU_...` por los datos de tu proyecto.
6. Ejecuta el proyecto con Live Server o cualquier servidor local.

Archivos agregados para esta integración:

- `js/firebase-config.js`
- `js/auth.js`
- `js/login-page.js`
- `js/register-page.js`
- `js/index-auth.js`

## Posibles mejoras futuras

Si se quisiera evolucionar WayTure a una versión más completa, se podrían añadir:

- backend para autenticación real
- base de datos para usuarios y viajes
- panel de administración
- creación de itinerarios por fechas
- favoritos dinámicos elegidos desde la interfaz
- validaciones más completas en formularios
- consumo de APIs de clima, vuelos o destinos
- perfil de usuario
- modo oscuro o personalización de tema
- modularización del CSS y del JavaScript en archivos separados

## Valor académico del proyecto

WayTure funciona bien como proyecto integrador porque no se limita a una sola página estática. En cambio, reúne navegación, formularios, multimedia, persistencia local y elementos gráficos dentro de una misma experiencia. Eso lo convierte en una buena muestra de aprendizaje progresivo en frontend y en una evidencia sólida de práctica sobre conceptos vistos en clase.

## Estado actual

El proyecto se encuentra funcional como demostración frontend. La navegación entre páginas, el guardado local de datos, la personalización básica y los componentes visuales principales están operativos.

## Autoría

- Juan Rojas
- Santiago Cardenas
- Juan Fajardo
- 2026 ING WEB

## Licencia

Este proyecto no incluye una licencia definida por el momento.
