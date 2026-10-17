// KERN — impresora térmica USB (ESC/POS vía WebUSB)
// Si hay una impresora conectada, el ícono imprime directo (sin cuadros de
// diálogo). Si no, el enlace abre el ticket en el navegador como siempre.
(function () {
  "use strict";

  const COLS = { 58: 32, 80: 48 };
  const CLAVE_IMPRESORA = "kern_impresora_usb";
  const CLAVE_ANCHO = "kern_ancho_papel";

  const estado = {
    device: null,
    epOut: null,
    soportado: typeof navigator.usb !== "undefined",
    ancho: Number(localStorage.getItem(CLAVE_ANCHO)) || 80,
  };

  // ---------------------------------------------------------------- bytes
  // Los tickets viajan en CP1252 (la codepage de las impresoras ESC/POS).
  function aCp1252(texto) {
    const mapa = {
      "€": 0x80, "–": 0x2d, "—": 0x2d, "‘": 0x27, "’": 0x27,
      "“": 0x22, "”": 0x22, "…": 0x2e, "•": 0x2a, "·": 0x2e,
      "™": 0x54, "®": 0x72,
    };
    const salida = [];
    for (const ch of String(texto || "")) {
      const cp = ch.codePointAt(0);
      if (mapa[ch] !== undefined) salida.push(mapa[ch]);
      else if (cp <= 0xff) salida.push(cp);
      else salida.push(0x3f); // "?" para lo no soportado
    }
    return salida;
  }

  function linea(b, t) {
    b.push.apply(b, aCp1252(t));
    b.push(13, 10);
  }

  function centrar(t, cols) {
    t = String(t);
    if (t.length >= cols) return t.slice(0, cols);
    const izq = Math.floor((cols - t.length) / 2);
    return " ".repeat(izq) + t;
  }

  function par(t1, t2, cols) {
    t1 = String(t1);
    t2 = String(t2);
    const medio = Math.max(1, cols - t1.length - t2.length);
    return t1 + " ".repeat(medio) + t2;
  }

  function construir(ticket) {
    const cols = COLS[estado.ancho] || 48;
    const b = [];
    b.push(0x1b, 0x40);            // ESC @  — inicializar
    b.push(0x1b, 0x74, 0x10);      // ESC t 16 — codepage Windows-1252
    b.push(0x1b, 0x61, 0x01);      // ESC a 1 — centrado
    b.push(0x1b, 0x45, 0x01);      // ESC E 1 — negrita
    b.push(0x1d, 0x21, 0x11);      // GS ! — doble ancho y alto
    linea(b, centrar(ticket.nombre || "KERN", 24));
    b.push(0x1d, 0x21, 0x00);      // tamaño normal
    b.push(0x1b, 0x45, 0x00);

    if (ticket.nit) linea(b, centrar("NIT " + ticket.nit, cols));
    if (ticket.telefono) linea(b, centrar("Tel " + ticket.telefono, cols));
    if (ticket.direccion) linea(b, centrar(ticket.direccion, cols));

    linea(b, "-".repeat(cols));
    if (ticket.id) {
      linea(b, centrar("TICKET #" + String(ticket.id).padStart(6, "0"), cols));
      linea(b, centrar(ticket.fecha || "", cols));
    } else {
      linea(b, centrar("IMPRESION DE PRUEBA", cols));
    }
    linea(b, "-".repeat(cols));

    b.push(0x1b, 0x61, 0x00);      // ESC a 0 — alineado a la izquierda
    linea(b, ticket.cliente || "");
    linea(b, ticket.vehiculo || "");
    linea(b, "-".repeat(cols));
    linea(b, par("Subtotal", ticket.total, cols));
    b.push(0x1b, 0x45, 0x01);
    linea(b, par("TOTAL", ticket.total, cols));
    b.push(0x1b, 0x45, 0x00);

    b.push(0x1b, 0x61, 0x01);
    linea(b, "-".repeat(cols));
    if (ticket.mensaje) linea(b, centrar(ticket.mensaje, cols));

    b.push(0x1b, 0x64, 0x04);      // ESC d 4 — avanzar 4 líneas
    b.push(0x1d, 0x56, 0x42, 0x00);// GS V B — corte parcial
    return new Uint8Array(b);
  }

  // ------------------------------------------------------------- dispositivo
  async function abrirDispositivo(d) {
    await d.open();
    if (!d.configuration) await d.selectConfiguration(1);

    let interfaz = null;
    for (const i of d.configuration.interfaces) {
      for (const alt of i.alternates) {
        if (alt.interfaceClass === 7 || alt.interfaceClass === 255) {
          interfaz = i;
          break;
        }
      }
      if (interfaz) break;
    }
    interfaz = interfaz || d.configuration.interfaces[0];

    await d.claimInterface(interfaz.interfaceNumber);
    const alternates = interfaz.alternates[0];
    const ep = alternates.endpoints.filter(function (e) { return e.direction === "out"; })[0];
    if (!ep) throw new Error("La impresora no tiene canal de salida.");

    estado.device = d;
    estado.epOut = ep.endpointNumber;
  }

  async function enviar(bytes) {
    const TROZO = 8192;
    for (let i = 0; i < bytes.length; i += TROZO) {
      await estado.device.transferOut(estado.epOut, bytes.subarray(i, i + TROZO));
    }
  }

  function recordar(d) {
    try {
      localStorage.setItem(CLAVE_IMPRESORA, JSON.stringify({
        vendorId: d.vendorId, productId: d.productId, name: d.productName,
      }));
    } catch (e) { /* modo privado: no pasa nada */ }
  }

  function olvidar() {
    try { localStorage.removeItem(CLAVE_IMPRESORA); } catch (e) { /* nada */ }
  }

  async function reconectarSiHabia() {
    if (!estado.soportado) return;
    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem(CLAVE_IMPRESORA)); } catch (e) { return; }
    if (!guardada) return;
    try {
      const devices = await navigator.usb.getDevices();
      const d = devices.filter(function (x) {
        return x.vendorId === guardada.vendorId && x.productId === guardada.productId;
      })[0];
      if (!d) return;
      await abrirDispositivo(d);
      pintarEstado("Conectada: " + (d.productName || guardada.name || "impresora"));
    } catch (e) {
      estado.device = null;
      pintarEstado("Sin conexión");
    }
  }

  // -------------------------------------------------------------------- UI
  function $(id) { return document.getElementById(id); }

  function pintarEstado(texto) {
    const pill = $("printer-status");
    if (!pill) return;
    pill.textContent = texto || "Sin impresora";
    const conectada = Boolean(estado.device);
    pill.className = "rounded-full px-3 py-1 text-xs font-semibold " +
      (conectada ? "bg-ok/15 text-ok" : "bg-raised text-muted");
    if ($("btn-prueba")) $("btn-prueba").disabled = !conectada;
    if ($("btn-desconectar")) $("btn-desconectar").disabled = !conectada;
    if ($("btn-conectar")) $("btn-conectar").disabled = !estado.soportado || conectada;
  }

  function pintarAnchos() {
    document.querySelectorAll("[data-ancho]").forEach(function (btn) {
      const activo = Number(btn.dataset.ancho) === estado.ancho;
      btn.className = "rounded-lg px-4 py-1.5 text-sm font-medium transition " +
        (activo ? "bg-amber text-ink" : "text-muted hover:text-amber");
    });
  }

  function aviso(texto, categoria) {
    const main = document.querySelector("main");
    if (!main) return;
    const d = document.createElement("div");
    d.setAttribute("data-flash", categoria || "exito");
    d.className = "mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium backdrop-blur " +
      (categoria === "error"
        ? "border-fail/40 bg-fail/10 text-fail"
        : "border-ok/40 bg-ok/10 text-ok");
    const punto = document.createElement("span");
    punto.className = "h-2 w-2 shrink-0 rounded-full bg-current";
    d.appendChild(punto);
    d.appendChild(document.createTextNode(texto));
    main.prepend(d);

    // Se borra solo igual que los mensajes del servidor
    setTimeout(function () {
      d.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      d.style.opacity = "0";
      d.style.transform = "translateY(-4px)";
      setTimeout(function () { d.remove(); }, 420);
    }, categoria === "error" ? 8000 : 4500);
  }

  function leerCabecera() {
    const form = document.getElementById("form-config");
    if (form) {
      return {
        nombre: form.nombre.value.trim(),
        nit: form.nit.value.trim(),
        telefono: form.telefono.value.trim(),
        direccion: form.direccion.value.trim(),
        mensaje_final: form.mensaje_final.value.trim(),
      };
    }
    const json = document.getElementById("kern-negocio");
    if (json) {
      try { return JSON.parse(json.textContent); } catch (e) { /* nada */ }
    }
    return {};
  }

  async function imprimir(ticket) {
    const cab = leerCabecera();
    const datos = {
      nombre: cab.nombre || "KERN",
      nit: cab.nit || "",
      telefono: cab.telefono || "",
      direccion: cab.direccion || "",
      mensaje: cab.mensaje_final || "",
      cliente: "",
      vehiculo: "",
      total: "",
      fecha: "",
      id: 0,
    };
    Object.keys(ticket).forEach(function (k) { datos[k] = ticket[k]; });
    await enviar(construir(datos));
  }

  // ------------------------------------------------------------ arranque UI
  function prepararConfig() {
    if (!$("printer-status")) return;

    if (!estado.soportado) {
      pintarEstado("Navegador no compatible");
      const nota = document.getElementById("printer-nota");
      if (nota) {
        nota.textContent =
          "Este navegador no permite la impresión directa (usa Chrome o Edge). " +
        "El botón de imprimir del historial abrirá el cuadro de impresión normal.";
      }
      return;
    }

    $("btn-conectar").addEventListener("click", async function () {
      try {
        const d = await navigator.usb.requestDevice({ filters: [] });
        await abrirDispositivo(d);
        recordar(d);
        pintarEstado("Conectada: " + (d.productName || "impresora"));
        aviso("Impresora conectada. Los tickets saldrán directo. ✓", "exito");
      } catch (e) {
        // El usuario canceló el selector o el driver de Windows se lo impidió
        pintarEstado(estado.device ? undefined : "Sin conexión");
        if (e && e.name !== "NotFoundError") {
          aviso(
            "No se pudo usar la impresora. Si Windows tiene un driver instalado " +
            "para ella, prueba quitarlo o usa el ícono normal de imprimir.",
            "error"
          );
        }
      }
    });

    $("btn-desconectar").addEventListener("click", async function () {
      try {
        if (estado.device) {
          await estado.device.releaseInterface(estado.epOut === null ? 0 : estado.device.configuration.interfaces[0].interfaceNumber);
          await estado.device.close();
        }
      } catch (e) { /* ya estaba cerrada */ }
      estado.device = null;
      estado.epOut = null;
      olvidar();
      pintarEstado("Sin conexión");
    });

    $("btn-prueba").addEventListener("click", async function () {
      try {
        await imprimir({
          cliente: "Impresión de prueba",
          vehiculo: new Date().toLocaleString("es-CO"),
          total: "$ 0",
        });
        aviso("Ticket de prueba enviado a la impresora ✓", "exito");
      } catch (e) {
        aviso("Error al imprimir: " + (e.message || e), "error");
      }
    });

    document.querySelectorAll("[data-ancho]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.ancho = Number(btn.dataset.ancho);
        try { localStorage.setItem(CLAVE_ANCHO, String(estado.ancho)); } catch (e) { /* nada */ }
        pintarAnchos();
      });
    });

    navigator.usb.addEventListener("disconnect", function (e) {
      if (estado.device && e.device === estado.device) {
        estado.device = null;
        estado.epOut = null;
        pintarEstado("Sin conexión");
        aviso("Se desconectó la impresora.", "error");
      }
    });

    pintarAnchos();
    pintarEstado("Sin conexión");
    reconectarSiHabia();
  }

  // ------------------------------------------------- ícono de imprimir (fila)
  function prepararHistorial() {
    document.querySelectorAll("a.js-imprimir").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (!estado.device) return; // sin impresora → pestaña + cuadro normal
        e.preventDefault();
        imprimir({
          id: Number(a.dataset.id),
          cliente: a.dataset.cliente,
          vehiculo: a.dataset.vehiculo,
          total: a.dataset.precio,
          fecha: a.dataset.fecha,
        }).then(function () {
          aviso("Ticket #" + a.dataset.id + " enviado a la impresora ✓", "exito");
        }).catch(function (err) {
          aviso("Error al imprimir: " + (err.message || err), "error");
        });
      });
    });
  }

  window.KernPrinter = { construir: construir, imprimir: imprimir, aviso: aviso, estado: estado };

  document.addEventListener("DOMContentLoaded", function () {
    prepararConfig();
    prepararHistorial();
  });
})();
