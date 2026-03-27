# WayTure

## Descripción del Proyecto

WayTure es una página web enfocada en la planificación de viajes. El proyecto fue construido con **HTML, CSS y JavaScript**, integrando una interfaz principal atractiva, formularios interactivos, contenido multimedia y páginas externas de autenticación.

La aplicación permite mostrar una experiencia moderna de marca, incluyendo:

- una página principal visualmente inmersiva
- una página de **login**
- una página de **registro**
- persistencia básica de datos con `localStorage`
- interacción con presupuesto, notas y contenido editable

El proyecto se encuentra desplegado mediante **GitHub Pages**, por lo que puede visualizarse directamente desde el navegador.

**Acceso a la página:**  
https://skizm07.github.io/WayTure/

---

## Objetivo

El objetivo de WayTure es demostrar, en un solo proyecto, la aplicación práctica de varios temas fundamentales del desarrollo web:

- estructura semántica de HTML5
- estilos avanzados con CSS
- diseño responsivo
- formularios
- multimedia
- animaciones
- almacenamiento local

Además, busca presentar una experiencia visual más cercana a una landing page real de producto turístico.

---

## Estructura del Proyecto

El repositorio está organizado para separar responsabilidades dentro del desarrollo del sitio:

- `index.html`
  Página principal del proyecto. Contiene la experiencia principal de WayTure y la mayoría de los temas del curso.

- `login.html`
  Página externa de inicio de sesión. Guarda el nombre del usuario y redirige al inicio mostrando una bienvenida.

- `registro.html`
  Página externa de registro. Permite crear una cuenta de demostración y guardar el nombre del usuario para usarlo después en login.

- `css/`
  Carpeta destinada a hojas de estilo adicionales del proyecto.

- `assets/`
  Imágenes, favicon, audio y video utilizados en la interfaz.

- `js/`
  Carpeta reservada para scripts adicionales del proyecto.

---

## Funcionalidades Principales

- navegación entre la página principal, login y registro
- saludo personalizado en el `index` con el nombre del usuario
- formulario de contacto
- selección de destino soñado
- presupuesto interactivo
- notas editables
- guardado de información mediante `localStorage`
- mapa embebido con `iframe`
- reproducción de video y audio
- sección visual con SVG y Canvas

---

## Tecnologías Utilizadas

- **HTML5**
- **CSS3**
- **JavaScript**
- **Google Maps Embed**
- **GitHub Pages**

---

## Flujo de Usuario

1. El usuario puede entrar desde `index.html`.
2. Desde el menú puede ir a `login.html` o `registro.html`.
3. Al registrarse o iniciar sesión, el nombre se guarda en `localStorage`.
4. Luego es redirigido de nuevo a `index.html`.
5. En la portada aparece una bienvenida personalizada con su nombre.

---

## Temas del Curso Aplicados

Dentro del proyecto se trabajaron temas como:

- estructura semántica de HTML5
- etiquetas básicas
- imágenes, listas y enlaces
- CSS y sus propiedades más utilizadas
- favicon
- bordes redondeados
- sombras
- imágenes de fondo
- tipografías
- float
- centrado de contenido
- flexbox
- position
- transform
- formularios
- iframe
- transition
- columnas de texto
- video
- audio
- transparencias y degradados
- animation
- SVG
- Canvas
- media queries
- contenido editable
- storage

---

## Estado Actual

WayTure se encuentra funcional como proyecto demostrativo y visual. Incluye una experiencia principal atractiva, autenticación externa simulada y persistencia local básica para reforzar el aprendizaje de desarrollo web frontend.
