import re
from functools import wraps

from flask import (
    Blueprint,
    flash,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from . import db

bp = Blueprint("auth", __name__)

PIN_RE = re.compile(r"^\d{4}$")


@bp.before_app_request
def cargar_usuario():
    """Carga el usuario de la sesion en g.usuario para cada peticion."""
    g.usuario = None
    usuario_id = session.get("usuario_id")
    if usuario_id:
        g.usuario = db.query_one(
            "SELECT id, nombre FROM usuarios WHERE id = ?", (usuario_id,)
        )
        if g.usuario is None:
            session.clear()


def login_requerido(vista):
    @wraps(vista)
    def envuelta(*args, **kwargs):
        if g.usuario is None:
            flash("Inicia sesion para continuar.", "info")
            return redirect(url_for("auth.login"))
        return vista(*args, **kwargs)

    return envuelta


def _hay_usuarios():
    return db.query_one("SELECT 1 FROM usuarios LIMIT 1") is not None


def _paginas_visibles(pagina, paginas):
    """Numeros para la barra de paginacion: [1, '...', 4, 5, 6, '...', 35]."""
    if paginas <= 7:
        return list(range(1, paginas + 1))
    conjunto = {1, paginas, pagina - 1, pagina, pagina + 1}
    if pagina <= 3:
        conjunto.update({2, 3, 4})
    if pagina >= paginas - 2:
        conjunto.update({paginas - 3, paginas - 2, paginas - 1})
    ordenados = sorted(x for x in conjunto if 1 <= x <= paginas)
    salida = []
    anterior = 0
    for p in ordenados:
        if anterior and p - anterior > 1:
            salida.append("...")
        salida.append(p)
        anterior = p
    return salida


# ------------------------------------------------------------------ panel
@bp.route("/")
@login_requerido
def index():
    # Buscador y paginacion del historial
    q = request.args.get("q", "").strip()
    pagina = max(1, request.args.get("pagina", 1, type=int))
    por_pagina = request.args.get("por_pagina", 10, type=int)
    if por_pagina not in (10, 25, 50):
        por_pagina = 10

    condiciones = ""
    params = []
    if q:
        patron = (
            "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        )
        condiciones = (
            "WHERE o.cliente LIKE ? OR o.vehiculo LIKE ?"
            " OR CAST(o.precio AS TEXT) LIKE ?"
            " OR CAST(o.creado_en AS TEXT) LIKE ?"
        )
        params = [patron, patron, patron, patron]

    resumen = db.query_one(
        f"""SELECT COUNT(*) AS n, COALESCE(SUM(o.precio), 0) AS suma
            FROM operaciones o {condiciones}""",
        params,
    )
    total = resumen["n"]          # registros que coinciden con la busqueda
    suma = resumen["suma"]        # suma de esos registros

    if q:
        global_ = db.query_one(
            "SELECT COUNT(*) AS n, COALESCE(SUM(precio), 0) AS suma FROM operaciones"
        )
        total_todo, suma_todo = global_["n"], global_["suma"]
    else:
        total_todo, suma_todo = total, suma

    paginas = max(1, -(-total // por_pagina))  # division con techo
    pagina = min(pagina, paginas)
    offset = (pagina - 1) * por_pagina

    operaciones = db.query(
        f"""SELECT o.id, o.cliente, o.vehiculo, o.precio, o.creado_en,
                   u.nombre AS registrado_por
            FROM operaciones o
            JOIN usuarios u ON u.id = o.usuario_id
            {condiciones}
            ORDER BY o.creado_en DESC, o.id DESC
            LIMIT ? OFFSET ?""",
        params + [por_pagina, offset],
    )

    negocio = db.query_one("SELECT * FROM negocio WHERE id = 1")
    return render_template(
        "index.html",
        operaciones=operaciones,
        total=total,
        suma=suma,
        total_todo=total_todo,
        suma_todo=suma_todo,
        q=q,
        pagina=pagina,
        paginas=paginas,
        por_pagina=por_pagina,
        inicio=offset + 1 if total else 0,
        fin=offset + len(operaciones),
        paginas_visibles=_paginas_visibles(pagina, paginas),
        negocio=negocio,
    )


# --------------------------------------------------------------- registro
@bp.route("/registro", methods=["GET", "POST"])
def registro():
    # Solo el primer usuario: si ya existe al menos uno, se cierra el registro
    if _hay_usuarios():
        flash("El registro esta cerrado: ya existe al menos un usuario.", "info")
        return redirect(url_for("auth.login"))

    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()
        pin = request.form.get("pin", "").strip()
        pin2 = request.form.get("pin2", "").strip()

        error = None
        if not nombre or len(nombre) > 80:
            error = "El nombre de usuario es obligatorio (max. 80 caracteres)."
        elif not PIN_RE.match(pin):
            error = "El PIN debe ser exactamente 4 digitos."
        elif pin != pin2:
            error = "Los PIN no coinciden."

        if error is None and db.query_one(
            "SELECT 1 FROM usuarios WHERE lower(nombre) = lower(?)", (nombre,)
        ):
            error = "Ese nombre de usuario ya existe."

        if error:
            flash(error, "error")
            return render_template("registro.html", nombre=nombre), 400

        db.insert_returning(
            """INSERT INTO usuarios (nombre, pin_hash, creado_en)
               VALUES (?, ?, datetime('now', 'localtime')) RETURNING id""",
            (nombre, generate_password_hash(pin)),
        )
        flash("Usuario creado. Ahora inicia sesion.", "exito")
        return redirect(url_for("auth.login"))

    return render_template("registro.html")


# ------------------------------------------------------------------ login
@bp.route("/login", methods=["GET", "POST"])
def login():
    if not _hay_usuarios():
        # Nadie registrado aun: el primer acceso es el de registro
        return redirect(url_for("auth.registro"))
    if g.usuario:
        return redirect(url_for("auth.index"))

    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()
        pin = request.form.get("pin", "").strip()

        usuario = db.query_one(
            "SELECT * FROM usuarios WHERE lower(nombre) = lower(?)", (nombre,)
        )
        if usuario is None or not check_password_hash(usuario["pin_hash"], pin):
            flash(
                "Usuario o PIN incorrectos. Si el navegador autocompleto un "
                "usuario antiguo, borra el campo y escribe el nombre correcto.",
                "error",
            )
            return render_template("login.html", nombre=nombre), 401

        session.clear()
        session["usuario_id"] = usuario["id"]
        session["usuario"] = usuario["nombre"]
        return redirect(url_for("auth.index"))

    return render_template("login.html")


@bp.post("/logout")
def logout():
    session.clear()
    flash("Sesion cerrada correctamente.", "info")
    return redirect(url_for("auth.login"))
