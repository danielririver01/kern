# KERN — Panel de operaciones

Aplicación web local para registrar operaciones de un taller (cliente, vehículo,
precio en pesos colombianos) con vista previa en vivo, historial compartido,
**tickets térmicos** e **impresora USB directa**. Pensada para correr en una sola
computadora y abrirse desde el navegador (PC o celular de la misma red).

## Características

- **Acceso con PIN de 4 dígitos** — el PIN se guarda con hash (scrypt); el
  registro solo está abierto para el primer usuario.
- **Panel de registro** con vista previa en vivo y formato COP es-CO
  (`$95.500,50`). Enter guarda, `n` salta al formulario.
- **Historial compartido**: editar con modal, eliminar con confirmación roja,
  **buscador en vivo** (cliente, vehículo, precio o fecha) y **paginación**
  (10 / 25 / 50 filas por página, enlaces compartibles `?q=...&pagina=2`).
- **Impresión de tickets** (80 mm):
  - Ícono de imprimir → cuadro de impresión del navegador (funciona con
    cualquier impresora).
  - **Impresora térmica USB directa** vía WebUSB + comandos ESC/POS
    (Chrome/Edge), sin cuadros de diálogo. Ancho de papel 58 u 80 mm;
    el permiso se guarda y se reconecta sola.
- **Configuración del negocio** (nombre, NIT, teléfono, dirección, mensaje)
  que encabeza el ticket, con preview en vivo sobre papel blanco.
- **Navegación completa por teclado**: Tab nunca escapa de la página, flechas
  recorren el historial, Enter edita, Supr elimina, `/` o `n` vuelven al
  formulario, Esc cierra modales.
- **Tema Orbit** oscuro (ámbar `#f5b942` sobre `#0d0d0d`), tipografías Onest y
  Geist Mono embebidas (sin CDN,100 % offline).
- Mensajes de éxito/error que se ocultan solos.

## Cómo funciona la base de datos

SQLite en un archivo **`kern.db`** que vive **junto al `.exe`** — no necesita
instalar nada (antes usaba PostgreSQL, ya no).

- **Compartir el programa**: copia solo `KERN.exe` → la otra PC arranca con una
  base vacía y su primer usuario se registra.
- **Compartir los datos**: copia `KERN.exe` **y** `kern.db` juntos.
- **Respaldar**: copiar `kern.db` es respaldar todo el negocio.
- Al mover el programa, llevar `kern.db` con el `.exe` (o mover la carpeta
  completa). Nunca se sube a GitHub.

## Desarrollo

```bash
python -m venv .venv
.venv\Scripts\pip install flask waitress        # + pyinstaller pillow (compilar/ícono)
npm install                                     # Tailwind v4
npm run build:css                               # compila kern/static/css/styles.css

python app.py            # producción local: http://127.0.0.1:8080 (abre el navegador)
python app.py --dev      # desarrollo: Flask con recarga en http://127.0.0.1:5000
```

La primera ejecución crea `kern.db` con las tablas de `kern/schema.sql`
(idempotente: puede faltar o estar vacía).

## Compilar el .exe

Doble clic en **`build.bat`** → genera `dist\KERN.exe` (onefile, sin consola,
con ícono). El puerto es el 8080; si KERN ya está corriendo, un segundo doble
clic solo abre otra pestaña del navegador.

## Estructura

```
app.py                     Punto de entrada (Waitress en :8080)
build.bat                  Compilación a dist\KERN.exe
kern/
  __init__.py              create_app: registro de blueprints, filtro "cop"
  db.py                    Conexión SQLite (kern.db junto al programa)
  auth.py                  Login/PIN, registro del primer usuario, panel
  operaciones.py           CRUD de operaciones + ruta del ticket
  configuracion.py         Datos del negocio (cabecera del ticket)
  schema.sql               Tablas: usuarios, operaciones, negocio
  templates/               login, registro, index (panel), configuracion, ticket
  static/
    src/input.css          Tailwind v4 + tokens del tema Orbit
    css/styles.css         CSS compilado (se genera con npm run build:css)
    js/app.js              Teclado, modales, vista previa, buscador
    js/printer.js          Impresora térmica USB (ESC/POS vía WebUSB)
    fonts/                 Onest + Geist Mono (woff2, embebidas)
    img/kern.ico           Ícono K ámbar (también favicon de la app)
```

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `Enter` | Guarda en formularios / edita la fila seleccionada |
| `↑` `↓` | Recorren las filas del historial |
| `Supr` | Elimina la fila seleccionada (con confirmación) |
| `n` o `/` | Salta al formulario de registro |
| `Esc` | Cierra modales y limpia campos |

## Notas técnicas

- Python 3.11, Flask, Waitress, Tailwind CSS v4, PyInstaller.
- `SECRET_KEY` puede fijarse por variable de entorno; si no, usa la de
  desarrollo (suficiente para uso local).
- WebUSB requiere Chrome/Edge y `http://localhost` (no funciona desde
  `file://`). Si Windows tiene un driver instalado para la impresora, puede
  bloquear la impresión directa: en ese caso usa el ícono normal (diálogo).
