import os
import sys

from flask import Flask


def _leer_schema():
    """Devuelve el contenido de schema.sql.

    En el .exe empaquetado el archivo puede quedar en distintas ubicaciones
    según cómo lo haya copiado PyInstaller (a veces dentro de una carpeta
    con su mismo nombre), así que probamos todas las conocidas.
    """
    carpeta_paquete = os.path.dirname(os.path.abspath(__file__))
    meipass = getattr(sys, "_MEIPASS", "")
    candidatas = [
        os.path.join(carpeta_paquete, "schema.sql"),
        os.path.join(carpeta_paquete, "schema.sql", "schema.sql"),
        os.path.join(meipass, "kern", "schema.sql"),
        os.path.join(meipass, "kern", "schema.sql", "schema.sql"),
        os.path.join(os.path.dirname(carpeta_paquete), "kern", "schema.sql"),
    ]
    for ruta in candidatas:
        if ruta and os.path.isfile(ruta):
            with open(ruta, encoding="utf-8") as f:
                return f.read()
    raise FileNotFoundError(
        "No se encontró schema.sql. Buscado en: "
        + " | ".join(c for c in candidatas if c)
    )


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "kern-dev-secret-cambiar")
    # Sin caché de estáticos: el navegador siempre recibe la última versión
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

    from . import db

    db.init_app(app)

    # Esquema idempotente: crea las tablas si faltan (kern.db puede ser nueva;
    # schema.sql usa IF NOT EXISTS). SQLite necesita executescript.
    try:
        with app.app_context():
            db.ejecutar_esquema(_leer_schema())
    except Exception:
        # Queda registrado en kern.log; la app avisará al usarla
        app.logger.exception("No se pudo aplicar el esquema de la base de datos")

    from .auth import bp as auth_bp

    app.register_blueprint(auth_bp)

    from .operaciones import bp as ops_bp

    app.register_blueprint(ops_bp)

    from .configuracion import bp as config_bp

    app.register_blueprint(config_bp)

    @app.template_filter("cop")
    def cop(valor):
        """Formatea un monto en pesos colombianos: 150000 -> $150.000,00"""
        if valor is None:
            valor = 0
        texto = f"{valor:,.2f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")
        return f"${texto}"

    return app
