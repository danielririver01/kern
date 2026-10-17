import os

from flask import Flask


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
            ruta_schema = os.path.join(os.path.dirname(__file__), "schema.sql")
            with open(ruta_schema, encoding="utf-8") as f:
                db.ejecutar_esquema(f.read())
    except Exception:
        # Sin base de datos al arrancar: la app avisará al usarla
        pass

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
