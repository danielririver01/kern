# KERN — Plan desde cero

Dashboard de operaciones: registro de cliente → vehículo → precio, con login por PIN,
vista previa, historial compartido y empaquetado como `.exe` para Windows.

---

## 1. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Registro (nombre + PIN) | Solo accesible cuando **no existe ningún usuario** (bootstrap). Después solo login. |
| Vista de datos | **Vista previa** antes de guardar + **historial editable** (editar/eliminar). |
| Visibilidad | **Todos ven todo**: el historial es compartido; `usuario_id` se guarda solo como auditoría (quién registró). |
| Tailwind | **v4 compilado** con `@tailwindcss/cli` a un `styles.css` estático → funciona 100% offline en el `.exe`. |
| Colores | Deep Blue: `#102A43` · `#243B53` · `#38BDF8` · `#F0F7FF` |
| Backend | Flask (rutas/templates) + Waitress (servidor WSGI en Windows) |
| Base de datos | PostgreSQL 18 (servicio local `postgresql-x64-18`, ya instalado) |
| Empaquetado | PyInstaller `--onefile --noconsole` |

## 2. Entorno detectado

- Python 3.11.15 ✓ · pip 26.1.2 ✓ · Node 24.17 ✓ · npm 11.13 ✓
- PostgreSQL 18 instalado (servicio activo). `psql` **no** está en el PATH → se usa la ruta
  completa `C:\Program Files\PostgreSQL\18\bin\psql.exe` o la conexión directa por psycopg2.
- Flask / psycopg2 / waitress / pyinstaller: **pendientes de instalar** (Fase 0).

## 3. Estructura del proyecto

```
Kern/
├── PLAN.md
├── requirements.txt
├── app.py                     # Punto de entrada: dev (Flask) y prod (Waitress)
├── build.bat                  # Comando PyInstaller --onefile --noconsole
├── package.json               # Solo para @tailwindcss/cli
├── kern/
│   ├── __init__.py            # create_app() — fábrica de la app
│   ├── db.py                  # Conexión psycopg2 + helpers query/execute
│   ├── auth.py                # Blueprint: /registro /login /logout
│   ├── operaciones.py         # Blueprint: CRUD de operaciones
│   ├── schema.sql             # DDL de las tablas
│   ├── templates/
│   │   ├── base.html           # Layout + navbar KERN
│   │   ├── registro.html       # Solo primer usuario
│   │   ├── login.html          # Tarjeta centrada
│   │   └── dashboard.html      # Formulario + vista previa + historial
│   └── static/
│       ├── src/input.css       # @import "tailwindcss"; + @theme (paleta Deep Blue)
│       ├── css/styles.css      # Generado por el CLI (se empaqueta)
│       └── js/app.js           # Vista previa, validaciones, confirmaciones
└── dist/
    └── Kern.exe                # Resultado final
```

## 4. Modelo de datos (PostgreSQL)

```sql
CREATE TABLE usuarios (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80)  NOT NULL UNIQUE,   -- nombre de usuario para login
    pin_hash    TEXT         NOT NULL,          -- hash scrypt, NUNCA el PIN en claro
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE operaciones (
    id            SERIAL PRIMARY KEY,
    cliente       VARCHAR(120)    NOT NULL,
    vehiculo      VARCHAR(120)    NOT NULL,
    precio        NUMERIC(12,2)   NOT NULL CHECK (precio >= 0),
    usuario_id    INT NOT NULL REFERENCES usuarios(id),  -- auditoría: quién lo creó
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Base de datos: `kern` (se crea en Fase 0), conexión vía variable de entorno
  `DATABASE_URL` con valor por defecto `postgresql://kern@localhost:5432/kern`.
- PIN: se valida formato `^\d{4}$` y se guarda con
  `werkzeug.security.generate_password_hash(pin)` (scrypt). Comparación con
  `check_password_hash`.

## 5. Rutas

| Método | Ruta | Acción |
|---|---|---|
| GET/POST | `/registro` | Alta del **primer** usuario. Si ya hay usuarios → redirect a `/login`. |
| GET/POST | `/login` | Nombre + 4 dígitos → crea sesión → `/`. |
| POST | `/logout` | Destruye sesión. |
| GET | `/` | Dashboard (si no hay sesión → `/login`). |
| POST | `/operaciones` | Crea operación desde la vista previa. |
| POST | `/operaciones/<id>/editar` | Actualiza cliente/vehículo/precio. |
| POST | `/operaciones/<id>/eliminar` | Elimina con confirmación. |

Protección: decorador `login_required` en todo salvo `/login` y `/registro`.

## 6. Pantallas y diseño (Deep Blue)

**Login / Registro** — tarjeta blanca `#F0F7FF` centrada sobre fondo degradado
`#102A43 → #243B53`, logo **KERN** en `#38BDF8`, inputs con foco en acento, botón
`#38BDF8` sobre texto `#102A43`.

**Dashboard** —
1. Navbar oscura `#102A43`: logo KERN, nombre del usuario, botón Salir.
2. Columna izquierda: formulario (Cliente → Vehículo → Precio) con botones
   **Vista previa** y **Guardar**.
3. Columna derecha: tarjeta de vista previa que se actualiza en vivo (JS) antes de guardar.
4. Abajo: tabla historial (filas alternas `#F0F7FF`, cabecera `#243B53`), con
   editar (modal) y eliminar por fila.

Paleta como variables Tailwind v4 en `@theme`:

```css
@theme {
  --color-ink:    #102A43;  /* fondos oscuros, texto principal */
  --color-panel:  #243B53;  /* superficies, cabeceras */
  --color-accent: #38BDF8;  /* botones, focos, enlaces */
  --color-paper:  #F0F7FF;  /* tarjetas, fondos claros */
}
```

## 7. Fases de implementación (cada una verificable)

- **Fase 0 — Entorno**: `venv`, `pip install flask psycopg2-binary waitress pyinstaller`,
  `npm i -D @tailwindcss/cli`, crear BD `kern` + usuario, verificar conexión.
  ✔ *Prueba: script de conexión imprime versión de PostgreSQL.*
- **Fase 1 — Esqueleto**: fábrica de app, `db.py`, `schema.sql` aplicado, `base.html`,
  rutas vacías.
  ✔ *Prueba: servidor arranca y `/` responde.*
- **Fase 2 — Auth**: registro bootstrap (solo 0 usuarios), login con PIN hasheado,
  sesión, `login_required`, logout.
  ✔ *Prueba: primer registro crea fila con hash; login correcto/incorrecto; si ya hay
  usuarios, `/registro` redirige.*
- **Fase 3 — Operaciones**: formulario + vista previa (JS) + crear en BD.
  ✔ *Prueba: guardar una operación y verla en tabla.*
- **Fase 4 — Historial**: tabla completa, editar (modal), eliminar con confirmación,
  conteo/total opcional.
  ✔ *Prueba: editar y eliminar persisten en PostgreSQL.*
- **Fase 5 — Estilos**: Tailwind v4 compilado con la paleta Deep Blue, responsive,
  estados vacíos, mensajes de éxito/error.
  ✔ *Prueba: `npm run build:css` genera `styles.css`; vistas revisadas en navegador.*
- **Fase 6 — Checklist manual**: registro → login → crear → editar → eliminar →
  logout, validaciones (PIN no numérico, precio negativo, campos vacíos).
- **Fase 7 — Empaquetado**: `build.bat` con
  `pyinstaller --onefile --noconsole --add-data "kern/templates;kern/templates"
  --add-data "kern/static;kern/static" --add-data "kern/schema.sql;kern" app.py`,
  arranque con Waitress (`serve(app, host='127.0.0.1', port=8080)`), pruebas del `.exe`.

## 8. Dudas abiertas (las resolvemos en el camino)

1. **Credenciales de PostgreSQL**: hace falta la contraseña del superusuario `postgres`
   para crear la BD `kern` y un usuario dedicado. ¿La tienes a mano?
2. **Moneda del precio**: ¿pesos mexicanos (MXN), dólares u otra? (afecta el símbolo
   en la UI y el formato `es-MX`/`es-ES`).
3. **Editar**: ¿modal sobre la tabla o página aparte? (mi propuesta: modal).
4. **Historial**: ¿necesitas buscar/filtrar por cliente o vehículo? ¿mostrar total
   acumulado?
5. **Fecha/hora**: ¿mostrar fecha de registro en el historial? (asumo que sí).
6. **Puerto del `.exe`**: asumo `127.0.0.1:8080` y que se abre el navegador
   automáticamente.
