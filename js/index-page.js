import { db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

    // Tema 28: Storage
    const moneyFormatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });

    const budgetInputs = ['transport', 'hotel', 'food', 'activities'].map(id => document.getElementById(id));
    const budgetTotal = document.getElementById('budgetTotal');
    const budgetState = document.getElementById('budgetState');
    const saveBudgetBtn = document.getElementById('saveBudget');
    const editableNote = document.getElementById('editableNote');
    const noteStatus = document.getElementById('noteStatus');
    const saveNoteBtn = document.getElementById('saveNote');
    const clearNoteBtn = document.getElementById('clearNote');
    const favoriteDestination = document.getElementById('favoriteDestination');
    const setFavoriteBtn = document.getElementById('setFavorite');
    const sessionGreeting = document.getElementById('sessionGreeting');
    const contactForm = document.getElementById('contactForm');
    const formResponse = document.getElementById('formResponse');
    const newsletterForm = document.getElementById('newsletterForm');
    const newsletterResponse = document.getElementById('newsletterResponse');
    const floatingOffer = document.getElementById('floatingOffer');
    const closeOfferBtn = document.getElementById('closeOffer');
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    function calculateBudget() {
      const values = budgetInputs.map(input => Number(input.value) || 0);
      const total = values.reduce((acc, val) => acc + val, 0);
      budgetTotal.textContent = moneyFormatter.format(total);
      budgetState.textContent = total > 0 ? 'Actualizado' : 'Pendiente';
      return total;
    }

    function saveBudget() {
      const data = {};
      budgetInputs.forEach(input => {
        data[input.id] = input.value;
      });
      localStorage.setItem('wayture_budget', JSON.stringify(data));
      calculateBudget();
      budgetState.textContent = 'Guardado';
    }

    function loadBudget() {
      const saved = localStorage.getItem('wayture_budget');
      if (!saved) return;
      try {
        const data = JSON.parse(saved);
        budgetInputs.forEach(input => {
          input.value = data[input.id] || '';
        });
        calculateBudget();
        budgetState.textContent = 'Recuperado';
      } catch (error) {
        console.error('No se pudo cargar el presupuesto', error);
      }
    }

    function saveNote() {
      localStorage.setItem('wayture_note', editableNote.innerHTML);
      noteStatus.textContent = 'Guardada';
    }

    function loadNote() {
      const saved = localStorage.getItem('wayture_note');
      if (saved) {
        editableNote.innerHTML = saved;
        noteStatus.textContent = 'Recuperada';
      }
    }

    function clearNote() {
      editableNote.innerHTML = 'Escribe aquí tu lista de sueños de viaje, recomendaciones, restaurantes o actividades favoritas...';
      localStorage.removeItem('wayture_note');
      noteStatus.textContent = 'Eliminada';
    }

    function loadFavorite() {
      const savedFavorite = localStorage.getItem('wayture_favorite_destination');
      if (savedFavorite) {
        favoriteDestination.textContent = savedFavorite;
      }
    }

    function loadSessionGreeting() {
      // El saludo ahora lo controla Firebase desde js/auth-state.js
    }

    function saveFavorite() {
      localStorage.setItem('wayture_favorite_destination', 'Tokio 🇯🇵');
      favoriteDestination.textContent = 'Tokio 🇯🇵';
    }

    budgetInputs.forEach(input => input.addEventListener('input', calculateBudget));
    saveBudgetBtn.addEventListener('click', saveBudget);
    saveNoteBtn.addEventListener('click', saveNote);
    clearNoteBtn.addEventListener('click', clearNote);
    setFavoriteBtn.addEventListener('click', saveFavorite);

    closeOfferBtn.addEventListener('click', () => {
      floatingOffer.classList.add('is-hidden');
    });

    if (menuToggle && mainNav) {
      menuToggle.addEventListener('click', () => {
        const isOpen = mainNav.classList.toggle('is-open');
        menuToggle.setAttribute('aria-expanded', String(isOpen));
        menuToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
      });

      mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 640) {
            mainNav.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Abrir menú de navegación');
          }
        });
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth > 640) {
          mainNav.classList.remove('is-open');
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.setAttribute('aria-label', 'Abrir menú de navegación');
        }
      });
    }

    editableNote.addEventListener('input', () => {
      noteStatus.textContent = 'Editando...';
    });

    contactForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const name = formData.get('name') || 'viajero';
      const email = formData.get('email') || 'Sin correo';
      const destination = formData.get('destination') || 'tu destino favorito';
      const message = formData.get('message') || 'Sin mensaje adicional.';
      try {
        formResponse.textContent = 'Guardando solicitud...';
        await addDoc(collection(db, 'contactos'), {
          name,
          email,
          destination,
          message,
          status: 'pendiente',
          adminNote: '',
          source: 'index-contacto',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        formResponse.textContent = 'Solicitud guardada. Un administrador la revisará desde el panel.';
        contactForm.reset();
      } catch (error) {
        console.error('No se pudo enviar la solicitud:', error);
        formResponse.textContent = 'No se pudo guardar la solicitud. Revisa la conexión con Firebase.';
      }
    });

    if (newsletterForm) {
      newsletterForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(newsletterForm);
        const email = formData.get('newsletterEmail') || '';

        try {
          newsletterResponse.textContent = 'Guardando suscripción...';
          await addDoc(collection(db, 'suscripciones'), {
            email,
            status: 'activa',
            source: 'index-comunidad',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          newsletterResponse.textContent = 'Suscripción guardada. Un administrador puede verla en el panel.';
          newsletterForm.reset();
        } catch (error) {
          console.error('No se pudo enviar la suscripción:', error);
          newsletterResponse.textContent = 'No se pudo guardar la suscripción. Revisa la conexión con Firebase.';
        }
      });
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Tema 25: Canvas
    function drawCanvas() {
      const canvas = document.getElementById('travelCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#0ea5e9');
      sky.addColorStop(0.55, '#2563eb');
      sky.addColorStop(1, '#081120');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const sun = ctx.createRadialGradient(540, 85, 12, 540, 85, 78);
      sun.addColorStop(0, 'rgba(255, 244, 182, 0.95)');
      sun.addColorStop(1, 'rgba(255, 244, 182, 0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(540, 85, 78, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      [[110, 75], [250, 48], [420, 95]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 20, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(x + 26, y - 12, 24, Math.PI, Math.PI * 2);
        ctx.arc(x + 56, y, 18, Math.PI * 1.5, Math.PI * 0.5);
        ctx.closePath();
        ctx.fill();
      });

      const sea = ctx.createLinearGradient(0, 180, 0, h);
      sea.addColorStop(0, 'rgba(56, 189, 248, 0.78)');
      sea.addColorStop(1, 'rgba(8, 17, 32, 1)');
      ctx.fillStyle = sea;
      ctx.fillRect(0, 185, w, h - 185);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 230);
      ctx.lineTo(120, 170);
      ctx.lineTo(200, 205);
      ctx.lineTo(340, 128);
      ctx.lineTo(430, 210);
      ctx.lineTo(560, 150);
      ctx.lineTo(700, 220);
      ctx.lineTo(700, 320);
      ctx.lineTo(0, 320);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(88, 136);
      ctx.quadraticCurveTo(118, 122, 146, 132);
      ctx.quadraticCurveTo(132, 136, 122, 148);
      ctx.quadraticCurveTo(106, 156, 88, 136);
      ctx.fill();

      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(90, 140);
      ctx.quadraticCurveTo(210, 100, 320, 125);
      ctx.quadraticCurveTo(430, 145, 540, 100);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(540, 100, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText('Visual de viaje creado con Canvas', 24, 42);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('Cielo, montaña, mar y trayectoria aérea con JavaScript', 24, 68);
    }

    loadBudget();
    loadNote();
    loadFavorite();
    loadSessionGreeting();
    calculateBudget();
    drawCanvas();
    window.addEventListener('resize', drawCanvas);

let condicion1_cumplida = false;
  let condicion2_cumplida = false;
  let condicion3_cumplida = false;
  let misionActivada = false;

  const botonPresupuesto = document.getElementById("saveBudget");
  const botonNota = document.getElementById("saveNote");
  const botonFavorito = document.getElementById("setFavorite");
  const tituloPrincipal = document.getElementById("tituloPrincipal") || document.querySelector(".hero h1");

  function verificarMision() {
    if (misionActivada) return;

    if (condicion1_cumplida && condicion2_cumplida && condicion3_cumplida) {
      misionActivada = true;

      tituloPrincipal.classList.add("mission-title");

      const mensaje = document.createElement("p");
      mensaje.textContent = "Misión Cumplida: Agente DOM activado.";
      mensaje.className = "mission-message";
      mensaje.id = "mensaje-mision";

      tituloPrincipal.parentNode.insertBefore(mensaje, tituloPrincipal.nextSibling);
    }
  }

  if (botonPresupuesto) {
    botonPresupuesto.addEventListener("click", function () {
      condicion1_cumplida = true;
      verificarMision();
    });
  }

  if (botonNota) {
    botonNota.addEventListener("click", function () {
      condicion2_cumplida = true;
      verificarMision();
    });
  }

  if (botonFavorito) {
    botonFavorito.addEventListener("click", function () {
      condicion3_cumplida = true;
      verificarMision();
    });
  }
