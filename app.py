import os
import socket
import sys
import threading
import webbrowser

from kern import create_app

app = create_app()

URL = "http://127.0.0.1:8080"
PUERTO = 8080


def _open_browser():
    threading.Timer(1.5, lambda: webbrowser.open(URL)).start()


def _puerto_en_uso():
    """True si ya hay una instancia de KERN corriendo en el puerto."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", PUERTO)) == 0


if __name__ == "__main__":
    if "--dev" in sys.argv:
        # Modo desarrollo: Flask con recarga, sin Waitress ni navegador
        app.run(host="127.0.0.1", port=5000, debug=True)
    else:
        from waitress import serve

        if _puerto_en_uso():
            # Ya está corriendo: doble clic no duplica, solo abre el navegador
            webbrowser.open(URL)
            sys.exit(0)

        if os.environ.get("KERN_NO_BROWSER") != "1":
            _open_browser()
        print(f"KERN corriendo en {URL}")
        serve(app, host="127.0.0.1", port=PUERTO)
