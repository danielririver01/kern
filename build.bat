@echo off
REM ============================================================
REM  KERN — compilación a un solo .exe (sin ventana de consola)
REM  Requisitos: .venv con pyinstaller y npm con Tailwind instalado
REM  Nota: los datos viven en kern.db, junto al .exe. Si mueves
REM  el .exe, lleva kern.db contigo (o mueve la carpeta entera).
REM ============================================================

echo [1/3] Compilando CSS de production...
call npm run build:css
if errorlevel 1 goto error

echo [2/3] Empaquetando KERN.exe (onefile, sin consola)...
.\.venv\Scripts\pyinstaller.exe --noconfirm --onefile --noconsole --name KERN ^
  --icon "kern\static\img\kern.ico" ^
  --add-data "kern\templates;kern\templates" ^
  --add-data "kern\static;kern\static" ^
  --add-data "kern\schema.sql;kern" ^
  app.py
if errorlevel 1 goto error

echo.
echo [3/3] Listo: dist\KERN.exe
echo       Doble clic y abre el navegador solo. Usa el puerto 8080.
echo       La base de datos es dist\kern.db (va junto al exe).
goto fin

:error
echo.
echo *** Hubo un error arriba. Revisa el mensaje. ***

:fin
pause
