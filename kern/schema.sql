-- Esquema de KERN (SQLite: la base de datos viaja junto al programa)
CREATE TABLE IF NOT EXISTS usuarios (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre    TEXT    NOT NULL UNIQUE,
    pin_hash  TEXT    NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operaciones (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente        TEXT    NOT NULL,
    vehiculo       TEXT    NOT NULL,
    precio         REAL    NOT NULL CHECK (precio >= 0),
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operaciones_creado_en ON operaciones (creado_en DESC);

-- Datos del negocio (una sola fila: id = 1) — cabecera del ticket térmico
CREATE TABLE IF NOT EXISTS negocio (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    pais           TEXT    NOT NULL DEFAULT 'Colombia',
    nombre         TEXT    NOT NULL DEFAULT '',
    nit            TEXT    NOT NULL DEFAULT '',
    telefono       TEXT    NOT NULL DEFAULT '',
    direccion      TEXT    NOT NULL DEFAULT '',
    mensaje_final  TEXT    NOT NULL DEFAULT 'Muchas gracias por su compra',
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO negocio (id) VALUES (1);
