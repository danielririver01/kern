"""Configuración del negocio: datos que encabezan el ticket térmico."""
from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, url_for

from . import db
from .auth import login_requerido

bp = Blueprint("configuracion", __name__, url_prefix="/configuracion")

CAMPOS = ("pais", "nombre", "nit", "telefono", "direccion", "mensaje_final")
LIMITES = {
    "pais": 60,
    "nombre": 120,
    "nit": 40,
    "telefono": 40,
    "direccion": 160,
    "mensaje_final": 200,
}


def obtener_negocio():
    """Devuelve la fila única de datos del negocio (id = 1)."""
    return db.query_one("SELECT * FROM negocio WHERE id = 1")


@bp.route("", methods=["GET", "POST"])
@login_requerido
def pantalla():
    if request.method == "POST":
        datos = {c: (request.form.get(c, "") or "").strip() for c in CAMPOS}

        if not datos["nombre"]:
            flash("El nombre del negocio es obligatorio.", "error")
            return redirect(url_for("configuracion.pantalla"))

        largo = next((c for c in CAMPOS if len(datos[c]) > LIMITES[c]), None)
        if largo:
            flash(f"El campo {largo} supera los {LIMITES[largo]} caracteres.", "error")
            return redirect(url_for("configuracion.pantalla"))

        db.execute(
            """UPDATE negocio
               SET pais = ?, nombre = ?, nit = ?, telefono = ?,
                   direccion = ?, mensaje_final = ?, actualizado_en = ?
               WHERE id = 1""",
            (
                datos["pais"],
                datos["nombre"],
                datos["nit"],
                datos["telefono"],
                datos["direccion"],
                datos["mensaje_final"],
                datetime.now(),
            ),
        )
        flash("Configuracion guardada.", "exito")
        return redirect(url_for("configuracion.pantalla"))

    return render_template("configuracion.html", negocio=obtener_negocio())
