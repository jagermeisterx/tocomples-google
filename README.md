# Completada a Beneficio — Tía Marcela

Plataforma web mobile-first para registrar donaciones de insumos, con Google Sheets como backend.

---

## Instrucciones de Setup

### 1. Crear el Google Sheet

1. Ve a [sheets.new](https://sheets.new) (crea un nuevo libro).
2. Renombra la hoja por defecto a `Inventario`.
3. Crea una segunda hoja llamada `Registro_Donaciones`.
4. En `Inventario`, fila 1, pon estos encabezados: `Producto | Meta Total | Total Donado | Restante`.
5. Llena las filas 2 a 13 con:

   | Producto | Meta Total |
   |----------|-----------|
   | Pan Copihue (a granel) | 400 |
   | Salchichas | 400 |
   | Mayonesa (Kg) | 4 |
   | Mostaza (Kg) | 3 |
   | Ketchup (Kg) | 4 |
   | Palta (Kg) | 25 |
   | Tomate (Kg) | 20 |
   | Vasos (Mangas 50 un. 200cc) | 10 |
   | Bebidas 3L | 25 |
   | Jugo (Botellas) | 10 |
   | Sal (Kg) | 1 |
   | Ají en pasta (Bolsita) | 1 |

6. En `C2` pega: `=SUMAR.SI(Registro_Donaciones!D:D;A2;Registro_Donaciones!E:E)` y arrastra hasta C13.
7. En `D2` pega: `=MAX(0;B2-C2)` y arrastra hasta D13.
8. En `Registro_Donaciones`, fila 1: `Timestamp | Nombre | Apellido | Producto Donado | Cantidad`.

### 2. Crear y desplegar el Web App

1. En el mismo Google Sheet: **Extensiones → Apps Script**.
2. Borra el código por defecto y pega el contenido de `backend/Code.gs`.
3. **Archivo → Configuración del proyecto → Zona horaria → America/Santiago**.
4. Haz clic en **Implementar → Nueva implementación**.
5. Tipo: **Web App**.
   - Ejecutar como: **Yo** (tu correo).
   - Acceso: **Cualquier usuario** (anónimo).
6. Haz clic en **Implementar** y copia la URL generada (algo como `https://script.google.com/macros/s/.../exec`).

### 3. Configurar el frontend

1. Abre `index.html` en este repositorio.
2. En la línea `const SCRIPT_URL = 'URL_DEL_WEB_APP';`, reemplaza `'URL_DEL_WEB_APP'` por la URL que copiaste.

### 4. Publicar en GitHub Pages

1. Sube todo a un repositorio en GitHub (`git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`).
2. En GitHub: **Settings → Pages → Source → Deploy from branch → main → / (root) → Save**.
3. Espera 1-2 minutos. Tu sitio estará en `https://<usuario>.github.io/<repo>/`.

### 5. Probar

1. Abre la URL de GitHub Pages desde un celular.
2. Verifica que ves la tabla con los 12 productos.
3. Haz una donación de prueba.
4. Abre el Google Sheet y verifica que la fila se agregó a `Registro_Donaciones`.
5. Verifica que los totales se actualizaron en `Inventario`.

---

## Estructura del proyecto

```
├── index.html        Frontend (GitHub Pages)
├── backend/
│   └── Code.gs       Backend (Google Apps Script)
├── PRD_REFINADO.md    Documento de requerimientos
└── README.md         Este archivo
```
