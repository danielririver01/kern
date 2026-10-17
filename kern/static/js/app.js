// KERN — utilidades de interfaz
(function () {
  "use strict";

  const esCampo = function (el) {
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };

  // ---------- PIN: solo 4 dígitos ----------
  document.querySelectorAll("[data-pin]").forEach(function (input) {
    input.addEventListener("input", function () {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);

      // Registro: con 4 dígitos avanza solo al repetir PIN
      if (input.id === "pin" && input.value.length === 4) {
        const pin2 = document.getElementById("pin2");
        if (pin2 && !pin2.value) pin2.focus();
      }
    });
  });

  // ---------- Login/registro: una tecla reemplaza lo autocompletado ----------
  const nombreInicial = document.getElementById("nombre");
  if (nombreInicial) {
    nombreInicial.focus();
    nombreInicial.select();
  }

  // ---------- Formateo de precio en COP ----------
  const fmtCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const MILES_ES_CO = /^\d{1,3}(\.\d{3})+$/;

  function parsePrecio(texto) {
    if (!texto) return null;
    let v = texto.replace(/\$/g, "").replace(/COP/gi, "").trim();
    if (!v) return null;
    if (v.includes(",") && v.includes(".")) v = v.replace(/\./g, "").replace(",", ".");
    else if (v.includes(",")) v = v.replace(/,/g, ".");
    else if (MILES_ES_CO.test(v)) v = v.replace(/\./g, "");
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  // ---------- Vista previa en vivo ----------
  const form = document.getElementById("form-operacion");
  if (form) {
    const pvCliente = document.getElementById("pv-cliente");
    const pvVehiculo = document.getElementById("pv-vehiculo");
    const pvPrecio = document.getElementById("pv-precio");
    const pvAviso = document.getElementById("pv-aviso");

    function actualizar() {
      const cliente = form.cliente.value.trim();
      const vehiculo = form.vehiculo.value.trim();
      const precio = parsePrecio(form.precio.value);

      pvCliente.textContent = cliente || "—";
      pvVehiculo.textContent = vehiculo || "—";
      pvPrecio.textContent = precio === null ? "—" : fmtCOP.format(precio);
      pvAviso.classList.toggle("hidden", Boolean(cliente || vehiculo || form.precio.value.trim()));
    }

    form.addEventListener("input", actualizar);

    const btnPreview = document.getElementById("btn-preview");
    if (btnPreview) {
      btnPreview.addEventListener("click", function () {
        actualizar();
        document
          .getElementById("preview-card")
          .scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    // Enter en cualquier campo guarda la operación (envío explícito y
    // determinista en todos los navegadores, no depende del implícito)
    form.querySelectorAll("input").forEach(function (campo) {
      campo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          form.requestSubmit();
        }
      });
    });

    // Tras guardar y volver, el foco regresa al cliente para encadenar operaciones
    document.getElementById("cliente").focus();
  }

  // ---------- Confirmar eliminación (modal propio, sin alert del navegador) ----------
  const modalElim = document.getElementById("modal-eliminar");
  if (modalElim) {
    const txtElim = document.getElementById("elim-txt");
    const btnSi = document.getElementById("btn-elim-si");
    let pendiente = null;
    let ultimoFoco = null;

    function abrirElim(f) {
      pendiente = f;
      const foco = document.activeElement;
      ultimoFoco = (foco && foco.closest && foco.closest("tr[data-fila]")) || foco;
      txtElim.textContent = f.dataset.confirmar;
      modalElim.classList.remove("hidden");
      btnSi.focus();
    }

    function cerrarElim() {
      modalElim.classList.add("hidden");
      pendiente = null;
      if (ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus();
      ultimoFoco = null;
    }

    document.querySelectorAll("form[data-confirmar]").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        if (f.dataset.enviando === "1") return; // segundo paso: envío real
        e.preventDefault();
        abrirElim(f);
      });
    });

    btnSi.addEventListener("click", function () {
      if (!pendiente) return;
      const f = pendiente;
      pendiente = null;
      ultimoFoco = null;
      modalElim.classList.add("hidden");
      f.dataset.enviando = "1";
      f.requestSubmit();
      // si por algo no navega, liberamos el envío para la próxima vez
      setTimeout(function () { f.dataset.enviando = "0"; }, 0);
    });

    modalElim.querySelectorAll("[data-cerrar]").forEach(function (el) {
      el.addEventListener("click", cerrarElim);
    });

    // Clic fuera de la tarjeta
    modalElim.addEventListener("click", function (e) {
      if (e.target === modalElim) cerrarElim();
    });

    // Tecla Escape cierra
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modalElim.classList.contains("hidden")) cerrarElim();
    });

    // Tab atrapado dentro del modal
    modalElim.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      const focoables = modalElim.querySelectorAll("button:not([disabled])");
      if (!focoables.length) return;
      const primero = focoables[0];
      const ultimo = focoables[focoables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    });
  } else {
    // Respaldo por si la plantilla no incluye el modal
    document.querySelectorAll("form[data-confirmar]").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        if (!window.confirm(f.dataset.confirmar)) e.preventDefault();
      });
    });
  }

  // ---------- Modal de edición ----------
  const modal = document.getElementById("modal-editar");
  if (modal) {
    const formEditar = document.getElementById("form-editar");
    let ultimoFoco = null;

    function abrir(btn) {
      // Si vino del teclado sobre la fila, el foco debe volver a la fila al cerrar
      ultimoFoco = (btn.closest && btn.closest("tr[data-fila]")) || btn;
      formEditar.action = btn.dataset.url;
      formEditar.cliente.value = btn.dataset.cliente || "";
      formEditar.vehiculo.value = btn.dataset.vehiculo || "";
      formEditar.precio.value = btn.dataset.precio || "";
      modal.classList.remove("hidden");
      formEditar.cliente.focus();
      formEditar.cliente.select();
    }

    function cerrar() {
      modal.classList.add("hidden");
      if (ultimoFoco) ultimoFoco.focus();
    }

    document.querySelectorAll("[data-editar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        abrir(btn);
      });
    });

    modal.querySelectorAll("[data-cerrar]").forEach(function (el) {
      el.addEventListener("click", cerrar);
    });

    // Clic fuera de la tarjeta
    modal.addEventListener("click", function (e) {
      if (e.target === modal) cerrar();
    });

    // Tecla Escape cierra
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) cerrar();
    });

    // Tab atrapado dentro del modal
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        formEditar.requestSubmit();
      }
      if (e.key !== "Tab") return;
      const focoables = modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focoables.length) return;
      const primero = focoables[0];
      const ultimo = focoables[focoables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    });

    // Enter dentro del modal también guarda (comportamiento nativo del form)
  }

  // ---------- Historial: navegación con teclado ----------
  const tbody = document.querySelector("tbody[data-filas]");
  if (tbody) {
    const filas = Array.from(tbody.querySelectorAll("tr[data-fila]"));

    tbody.addEventListener("keydown", function (e) {
      const fila = e.target.closest("tr[data-fila]");
      if (!fila) return;
      const i = filas.indexOf(fila);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        filas[(i + 1) % filas.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        filas[(i - 1 + filas.length) % filas.length].focus();
      } else if (e.key === "Enter" && e.target === fila) {
        e.preventDefault();
        const btn = fila.querySelector("[data-editar]");
        if (btn) btn.click();
      } else if ((e.key === "Delete" || e.key === "Backspace") && e.target === fila) {
        e.preventDefault();
        const f = fila.querySelector("form[data-confirmar]");
        if (f) f.requestSubmit();
      }
    });
  }

  // ---------- Atajo global: Esc sale del modo escritura ----------
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && esCampo(document.activeElement)) {
      document.activeElement.blur();
    }
  });

  // ---------- Atajos globales (cuando NO se está escribiendo) ----------
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Lista blanca: solo "n", "/" y las flechas de navegación
    const esAtajo = e.key === "n" || e.key === "/";
    const esFlecha = e.key === "ArrowDown" || e.key === "ArrowUp";
    if (!esAtajo && !esFlecha) return;
    if (esCampo(e.target)) {
      // Dentro de un campo: las letras se escriben (nunca se secuestran) y
      // las flechas solo navegan si el campo está vacío (si no, mueven el cursor)
      if (!esFlecha || e.target.value !== "") return;
    }
    if (e.target.closest && e.target.closest("tr[data-fila]")) return; // ya en el historial

    // El modal abierto tiene prioridad: no mover el foco detrás de él
    const m = document.getElementById("modal-editar");
    if (m && !m.classList.contains("hidden")) return;
    if (modalElim && !modalElim.classList.contains("hidden")) return;

    if (esAtajo) {
      const cliente = document.getElementById("cliente");
      if (cliente) {
        e.preventDefault();
        cliente.focus();
        cliente.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (e.key === "ArrowDown") {
      const primera = document.querySelector("tr[data-fila]");
      if (primera) {
        e.preventDefault();
        primera.focus();
        primera.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "ArrowUp") {
      const filasTodas = document.querySelectorAll("tr[data-fila]");
      const ultima = filasTodas[filasTodas.length - 1];
      if (ultima) {
        e.preventDefault();
        ultima.focus();
        ultima.scrollIntoView({ block: "nearest" });
      }
    }
  });

  // ---------- Enter guarda en todos los formularios ----------
  ["form-login", "form-registro", "form-config"].forEach(function (id) {
    const f = document.getElementById(id);
    if (!f) return;
    f.querySelectorAll("input").forEach(function (campo) {
      campo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          f.requestSubmit();
        }
      });
    });
  });

  // ---------- El Tab nunca se escapa de la página ----------
  // Del último elemento (Eliminar) vuelve al primer campo del formulario.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;

    // Los modales abiertos ya atrapan el Tab por su cuenta
    const m1 = document.getElementById("modal-editar");
    const m2 = document.getElementById("modal-eliminar");
    if ((m1 && !m1.classList.contains("hidden")) || (m2 && !m2.classList.contains("hidden"))) return;

    const focoables = Array.prototype.filter.call(
      document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'),
      function (el) { return el.getClientRects().length > 0; } // solo visibles
    );
    if (!focoables.length) return;

    const primero = focoables[0];
    const ultimo = focoables[focoables.length - 1];

    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      // De vuelta al formulario: el primer campo visible de la página
      const primerCampo = focoables.filter(function (el) { return el.tagName === "INPUT"; })[0];
      (primerCampo || primero).focus();
      if (primerCampo) primerCampo.scrollIntoView({ block: "center" });
    }
  });

  // ---------- Mensajes que desaparecen solos ----------
  document.querySelectorAll("[data-flash]").forEach(function (el) {
    const ms = el.dataset.flash === "error" ? 8000 : 4500;
    setTimeout(function () {
      el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(-4px)";
      setTimeout(function () { el.remove(); }, 420);
    }, ms);
  });

  // ---------- Configuración: vista previa del ticket en vivo ----------
  const formConfig = document.getElementById("form-config");
  if (formConfig) {
    const tpFecha = document.getElementById("tp-fecha");
    if (tpFecha) {
      tpFecha.textContent = new Date().toLocaleString("es-CO", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
    }

    function pintarTicket() {
      const v = function (c) { return (formConfig[c].value || "").trim(); };
      const mostrar = function (el, texto) {
        el.textContent = texto;
        el.classList.toggle("hidden", !texto);
      };

      document.getElementById("tp-nombre").textContent = v("nombre") || "Tu negocio";
      mostrar(document.getElementById("tp-nit"), v("nit") ? "NIT " + v("nit") : "");
      mostrar(document.getElementById("tp-telefono"), v("telefono") ? "Tel " + v("telefono") : "");
      mostrar(document.getElementById("tp-direccion"), v("direccion"));
      document.getElementById("tp-mensaje").textContent =
        v("mensaje_final") || "Muchas gracias por su compra";
    }

    formConfig.addEventListener("input", pintarTicket);
    pintarTicket();
  }

  // ------------------------------------------------- buscador del historial
  // Busca mientras el usuario escribe (con pausa) sin necesidad de botón.
  const buscador = document.getElementById("buscar");
  if (buscador) {
    let temporizador;
    buscador.addEventListener("input", function () {
      clearTimeout(temporizador);
      temporizador = setTimeout(function () {
        buscador.form.submit();
      }, 380);
    });
    // Tras recargar con una búsqueda, el cursor sigue en el buscador
    if (buscador.value) {
      buscador.focus();
      buscador.setSelectionRange(buscador.value.length, buscador.value.length);
    }
  }
})();
