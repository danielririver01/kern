import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import Blueprint, flash, g, redirect, render_template, request, url_for

from . import db
from .auth import login_requerido

bp = Blueprint("operaciones", __name__, url_prefix="/operaciones")

# Formato es-CO: 95.500 (punto = miles, coma = decimal)
GRUPOS_MILES_RE = re.compile(r"^\d{1,3}(\.\d{3})+$")


def _parse_precio(valor):
    """Acepta 150000, 95.500 (miles), 150.000,50 o 150000.50. Devuelve Decimal o None."""
    v = (
        (valor or "")
        .strip()
        .replace("$", "")
        .replace("COP", "")
        .replace(" ", "")
    )
    if not v:
        return None
    if "," in v and "." in v:  # 1.500,50 -> coma decimal
        v = v.replace(".", "").replace(",", ".")
    elif "," in v:  # 150000,50 -> coma decimal
        v = v.replace(",", ".")
    elif GRUPOS_MILES_RE.match(v):  # 95.500 o 1.234.567 -> punto de miles
        v = v.replace(".", "")
    try:
        precio = Decimal(v)
    except InvalidOperation:
        return None
    if precio < 0 or precio > Decimal("9999999999.99"):
        return None
    return precio.quantize(Decimal("0.01"))


def _validar(cliente, vehiculo, precio):
    if not cliente or len(cliente) > 120:
        return "El nombre del cliente es obligatorio (max. 120 caracteres)."
    if not vehiculo or len(vehiculo) > 120:
        return "El nombre del vehiculo es obligatorio (max. 120 caracteres)."
    if precio is None:
        return "El precio debe ser un numero valido (ej. 150000 o 150.000,50)."
    return None


@bp.post("", endpoint="crear")
@login_requerido
def crear():
    cliente = request.form.get("cliente", "").strip()
    vehiculo = request.form.get("vehiculo", "").strip()
    precio = _parse_precio(request.form.get("precio"))

    error = _validar(cliente, vehiculo, precio)
    if error:
        flash(error, "error")
        return redirect(url_for("auth.index"))

    db.execute(
        """INSERT INTO operaciones (cliente, vehiculo, precio, usuario_id, creado_en)
           VALUES (?, ?, ?, ?, ?)""",
        (cliente, vehiculo, precio, g.usuario["id"], datetime.now()),
    )
    flash("Operacion registrada correctamente.", "exito")
    return redirect(url_for("auth.index"))


@bp.post("/<int:operacion_id>/editar")
@login_requerido
def editar(operacion_id):
    cliente = request.form.get("cliente", "").strip()
    vehiculo = request.form.get("vehiculo", "").strip()
    precio = _parse_precio(request.form.get("precio"))

    error = _validar(cliente, vehiculo, precio)
    if error:
        flash(error, "error")
        return redirect(url_for("auth.index"))

    filas = db.execute(
        """UPDATE operaciones
           SET cliente = ?, vehiculo = ?, precio = ?, actualizado_en = ?
           WHERE id = ?""",
        (cliente, vehiculo, precio, datetime.now(), operacion_id),
    )
    if filas == 0:
        flash("La operacion no existe.", "error")
    else:
        flash("Operacion actualizada.", "exito")
    return redirect(url_for("auth.index"))


@bp.post("/<int:operacion_id>/eliminar")
@login_requerido
def eliminar(operacion_id):
    filas = db.execute("DELETE FROM operaciones WHERE id = ?", (operacion_id,))
    if filas == 0:
        flash("La operacion no existe.", "error")
    else:
        flash("Operacion eliminada.", "exito")
    return redirect(url_for("auth.index"))


@bp.get("/<int:operacion_id>/ticket")
@login_requerido
def ticket(operacion_id):
    """Ticket térmico imprimible de una operación (80 mm)."""
    operacion = db.query_one("SELECT * FROM operaciones WHERE id = ?", (operacion_id,))
    if operacion is None:
        flash("La operacion no existe.", "error")
        return redirect(url_for("auth.index"))

    negocio = db.query_one("SELECT * FROM negocio WHERE id = 1")
    return render_template("ticket.html", op=operacion, negocio=negocio)
