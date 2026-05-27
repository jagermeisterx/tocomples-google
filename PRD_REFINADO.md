# PRD — Completada a Beneficio Tía Marcela
## Plataforma Web de Registro de Donaciones (Google Sheets como Backend)

**Versión:** 2.0 — Refinado para implementación  
**Fecha del evento:** Miércoles 03 de junio  
**Última actualización:** 27 de mayo de 2026

---

## 1. Resumen Ejecutivo

Plataforma web mobile-first donde la comunidad escolar registra donaciones de insumos para la completada a beneficio de la Tía Marcela. Reemplaza el archivo Excel local (`COMPLETADA_BENEFICIO.xlsx`) por un sistema en tiempo real con Google Sheets como base de datos y Google Apps Script como API.

**Flujo principal:** Usuario abre enlace → ve tabla de insumos con saldos → selecciona producto → ingresa cantidad y nombre → envía → Google Sheets se actualiza → tabla se refresca sin recargar.

---

## 2. Arquitectura Técnica

```
┌──────────────┐     HTTPS GET/POST      ┌─────────────────────┐      Lee/Escribe      ┌──────────────┐
│   Frontend   │ ◄──────────────────────► │  Google Apps Script  │ ◄──────────────────► │ Google Sheets │
│  (HTML/CSS/  │    JSON (JSONP/CORS)     │     (Web App)        │                      │  2 hojas      │
│   JS estático│                          │  Ejecución: Admin    │                      │               │
│   )          │                          │  Acceso: Anónimo     │                      │               │
└──────────────┘                          └─────────────────────┘                      └──────────────┘
   GitHub Pages                              clasp / editor                           Libro compartido
   o Vercel                                                                           con el admin
```

### Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | HTML5 + CSS (Bootstrap 5.3 CDN) + JS vanilla (Fetch API) | Cero dependencias de build, carga rápida en 4G |
| Backend/API | Google Apps Script desplegado como Web App | Gratis, sin servidor propio, maneja concurrencia |
| Base de datos | Google Sheets (2 hojas) | Gratis, fórmulas nativas, auditable por el admin |
| Hosting | GitHub Pages, Vercel o Firebase Hosting (tier gratuito) | Despliegue inmediato, HTTPS incluido |

---

## 3. Modelo de Datos

### 3.1 Hoja `Inventario` (12 filas, 4 columnas)

| Col | Campo | Tipo | Descripción |
|-----|-------|------|-------------|
| A | `Producto` | Texto | Nombre del insumo tal como se muestra al usuario |
| B | `Meta Total` | Entero | Cantidad objetivo a recolectar |
| C | `Total Donado` | Fórmula | `=SUMAR.SI(Registro_Donaciones!D:D;A2;Registro_Donaciones!E:E)` |
| D | `Restante` | Fórmula | `=MAX(0;B2-C2)` |

**Datos iniciales (extraídos del Excel fuente):**

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

> **Nota de implementación:** Los nombres de producto deben coincidir exactamente entre la hoja `Inventario` columna A y la hoja `Registro_Donaciones` columna D para que el `SUMAR.SI` funcione. El Apps Script debe escribir el nombre tal cual lo lee del inventario, no el texto del formulario del usuario.

### 3.2 Hoja `Registro_Donaciones` (crece con cada donación, 5 columnas)

| Col | Campo | Tipo | Fuente |
|-----|-------|------|--------|
| A | `Timestamp` | Fecha/Hora | `new Date()` en Apps Script (zona horaria Chile) |
| B | `Nombre` | Texto | Formulario |
| C | `Apellido` | Texto | Formulario |
| D | `Producto Donado` | Texto | Valor exacto de columna A de Inventario |
| E | `Cantidad` | Entero | Formulario (validado) |

**Fila 1 = encabezados.** La primera donación se escribe en la fila 2.

---

## 4. API — Google Apps Script (Web App)

### 4.1 Endpoint GET — Obtener inventario

**Trigger:** El frontend hace `fetch(SCRIPT_URL)` al cargar y tras cada donación exitosa.

**Respuesta exitosa (200):**
```json
{
  "status": "ok",
  "data": [
    {
      "producto": "Pan Copihue (a granel)",
      "metaTotal": 400,
      "totalDonado": 120,
      "restante": 280
    }
  ]
}
```

**Lógica del script:**
1. Abrir la hoja `Inventario`.
2. Leer filas 2..N (saltando encabezado).
3. Para cada fila, leer columnas A-D.
4. Retornar JSON con `ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON)`.

> **Nota CORS:** Apps Script como Web App no soporta CORS nativo. Usar JSONP (callback) o el patrón `doGet` + `doPost` que devuelve `ContentService`. El frontend debe usar `fetch(url, {redirect: 'follow'})` porque Apps Script redirige (302) al ejecutar.

### 4.2 Endpoint POST — Registrar donación

**Payload del frontend:**
```json
{
  "nombre": "María",
  "apellido": "González",
  "producto": "Pan Copihue (a granel)",
  "cantidad": 10
}
```

**Flujo del script (doPost):**
1. Parsear `e.postData.contents` como JSON.
2. **Validar campos obligatorios:** nombre, apellido, producto no vacíos; cantidad ≥ 1.
3. **Validar stock en tiempo real:**
   - Leer el `Restante` actual del producto en la hoja `Inventario`.
   - Si `cantidad > restante` → responder error.
4. **Escribir fila** en `Registro_Donaciones`: `[new Date(), nombre, apellido, producto, cantidad]`.
5. Retornar respuesta JSON.

**Respuesta exitosa:**
```json
{
  "status": "ok",
  "message": "Donación registrada correctamente",
  "donacion": {
    "nombre": "María",
    "apellido": "González",
    "producto": "Pan Copihue (a granel)",
    "cantidad": 10
  }
}
```

**Respuesta de error (stock agotado):**
```json
{
  "status": "error",
  "code": "STOCK_AGOTADO",
  "message": "La meta de Pan Copihue (a granel) ya fue cubierta por otra donación.",
  "restanteActual": 0
}
```

**Respuesta de error (cantidad excede restante):**
```json
{
  "status": "error",
  "code": "CANTIDAD_EXCEDIDA",
  "message": "Solo quedan 5 unidades de Pan Copihue (a granel).",
  "restanteActual": 5
}
```

### 4.3 Concurrencia

Google Apps Script serializa las escrituras a una misma hoja mediante `LockService`:

```javascript
var lock = LockService.getScriptLock();
lock.waitLock(10000); // espera hasta 10s
try {
  // leer restante, validar, escribir fila
} finally {
  lock.releaseLock();
}
```

Esto evita condiciones de carrera donde dos donantes agotan el mismo producto simultáneamente.

---

## 5. Frontend — Especificación de Interfaz

### 5.1 Estructura de la página (single-page)

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  "Completada a Beneficio — Tía Marcela" │
│  Subtítulo: Miércoles 03 de Junio       │
├─────────────────────────────────────────┤
│  TABLA DE INSUMOS                       │
│  Producto | Meta | Donado | Restante    │
│  (con barra de progreso por fila)       │
│  Badge "¡Meta cumplida!" si restante=0  │
├─────────────────────────────────────────┤
│  FORMULARIO DE DONACIÓN                 │
│  [Selector de producto ▼]              │
│  [Cantidad        ]                     │
│  [Nombre          ]                     │
│  [Apellido        ]                     │
│  [ Registrar Donación ]                 │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  "También puedes aportar con dinero     │
│   en efectivo. ¡Gracias!"              │
└─────────────────────────────────────────┘
```

### 5.2 Componentes y comportamiento

#### Tabla de insumos
- Se carga al abrir la página (GET al script).
- Muestra las 4 columnas: Producto, Meta, Donado, Restante.
- Cada fila incluye una barra de progreso (`<div>` con ancho porcentual = `donado/meta * 100`).
- Si `restante === 0`, la fila muestra un badge verde "¡Meta cumplida!" y el producto se oculta del selector.
- **Spinner de carga** mientras se obtienen los datos; si falla, mostrar mensaje "No se pudieron cargar los datos. Intenta de nuevo." con botón de reintentar.

#### Selector de producto (`<select>`)
- Se genera dinámicamente filtrando `data.filter(item => item.restante > 0)`.
- Opción por defecto: "— Selecciona un producto —" (value vacío, disabled).
- Al cambiar la selección, actualizar el `max` del campo cantidad y mostrar texto auxiliar: "Quedan X por cubrir".

#### Campo cantidad (`<input type="number">`)
- `min="1"`, `step="1"`, `max` dinámico según el `restante` del producto seleccionado.
- Validación en `oninput`: si el valor excede el max, truncar al max y mostrar aviso inline.
- Todos los productos se manejan en cantidades enteras independientemente de su unidad física.

#### Campos nombre y apellido (`<input type="text">`)
- `required`, `minlength="2"`, `maxlength="50"`.
- Trim de espacios al enviar.
- Capitalizar primera letra automáticamente con CSS: `text-transform: capitalize`.

#### Botón "Registrar Donación"
- `disabled` por defecto hasta que todos los campos sean válidos.
- Al hacer clic:
  1. Deshabilitar botón inmediatamente (previene doble envío).
  2. Mostrar spinner dentro del botón: "Registrando...".
  3. Enviar POST al script.
  4. **Si éxito:** alerta Bootstrap verde ("¡Gracias, María! Tu donación de 10 Pan Copihue fue registrada."), refrescar tabla (nuevo GET), limpiar formulario.
  5. **Si error STOCK_AGOTADO o CANTIDAD_EXCEDIDA:** alerta Bootstrap roja con el mensaje del servidor, refrescar tabla, re-habilitar botón.
  6. **Si error de red:** alerta Bootstrap amarilla ("Error de conexión. Intenta de nuevo."), re-habilitar botón.

### 5.3 Requisitos de UX mobile-first

- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Tamaño mínimo de elementos táctiles: 44×44px.
- Fuente base: 16px (evita zoom automático en iOS al hacer focus en inputs).
- Sin imágenes pesadas. Único recurso externo: Bootstrap 5.3 desde CDN (CSS + JS bundle ≈ 60KB gzip).
- Tabla responsiva: `table-responsive` de Bootstrap para scroll horizontal si es necesario.
- Colores accesibles: contraste mínimo WCAG AA (4.5:1 para texto normal).

---

## 6. Manejo de Casos Borde

| Caso | Comportamiento esperado |
|------|------------------------|
| Dos usuarios donan el último stock al mismo tiempo | `LockService` en Apps Script garantiza que solo el primero registra; el segundo recibe `CANTIDAD_EXCEDIDA` con el restante actualizado |
| Usuario ingresa cantidad = 0 o negativa | Bloqueado por validación frontend (`min=1`, `step=1`). Backend también rechaza como campo inválido |
| Usuario deja nombre/apellido en blanco | Bloqueado por `required` en frontend. Backend valida y rechaza con mensaje genérico |
| Producto se agota entre la carga de página y el envío del form | Backend valida stock en tiempo real al momento de escribir; retorna error si el restante cambió |
| Conexión lenta (>5s de latencia) | Spinner visible, botón deshabilitado, sin timeout en frontend (Apps Script tiene timeout de 30s) |
| Toda la meta fue cubierta (todos los restantes = 0) | Ocultar formulario completo. Mostrar mensaje: "¡Todas las metas fueron cubiertas! Gracias a todos." |
| Usuario intenta inyectar HTML/script en nombre | Backend escribe valores como texto plano en la celda; Google Sheets no ejecuta scripts en celdas de texto |
| Google Sheets no responde (caída del servicio) | Frontend muestra error de conexión y botón de reintentar |

---

## 7. Configuración de Google Sheets

### Paso a paso para el administrador

1. Crear un nuevo libro de Google Sheets.
2. Renombrar la primera hoja a `Inventario`.
3. Crear la segunda hoja: `Registro_Donaciones`.
4. En `Inventario`, llenar encabezados en fila 1: `Producto | Meta Total | Total Donado | Restante`.
5. Llenar filas 2-13 con los 12 productos y sus metas (ver tabla en sección 3.1).
6. En C2, poner la fórmula: `=SUMAR.SI(Registro_Donaciones!D:D;A2;Registro_Donaciones!E:E)` y copiar hasta C13.
7. En D2, poner la fórmula: `=MAX(0;B2-C2)` y copiar hasta D13.
8. En `Registro_Donaciones`, llenar encabezados en fila 1: `Timestamp | Nombre | Apellido | Producto Donado | Cantidad`.
9. Abrir **Extensiones → Apps Script**, pegar el código del backend, desplegar como Web App.
10. Configurar zona horaria del proyecto Apps Script: **Archivo → Configuración del proyecto → Zona horaria → America/Santiago**.

> **Separador de fórmulas:** Chile usa punto y coma (`;`) como separador de argumentos en fórmulas de Google Sheets, no coma. Las fórmulas del PRD ya usan esta convención.

---

## 8. Plan de Implementación

### Fase 1 — Backend (día 1)
1. Crear Google Sheet con estructura de datos (sección 3).
2. Escribir `doGet()` y `doPost()` en Apps Script (sección 4).
3. Desplegar como Web App (ejecutar como admin, acceso anónimo).
4. Testear con `curl` o Postman: GET para inventario, POST para registrar donación de prueba.

### Fase 2 — Frontend (día 1-2)
1. Crear `index.html` con Bootstrap 5.3.
2. Implementar carga de tabla de insumos (fetch GET).
3. Implementar formulario con validaciones.
4. Implementar envío de donación (fetch POST) con feedback visual.
5. Probar en móvil con conexión 4G.

### Fase 3 — Deploy y pruebas (día 2)
1. Subir a GitHub Pages (o Vercel).
2. Prueba end-to-end: donar, verificar en Google Sheets, verificar que la tabla web se actualiza.
3. Prueba de concurrencia: dos personas donando el mismo producto simultáneamente.
4. Generar enlace corto para distribución en WhatsApp.

---

## 9. Criterios de Aceptación (MVP)

1. ✅ El usuario abre la URL y ve la tabla con los 12 productos, sus metas y saldos restantes actualizados.
2. ✅ El selector solo muestra productos con `restante > 0`.
3. ✅ El campo cantidad no permite valores fuera del rango válido.
4. ✅ Al enviar, el botón se deshabilita y muestra spinner.
5. ✅ Google Sheets registra la fila en `Registro_Donaciones` con timestamp correcto (hora Chile).
6. ✅ Las fórmulas de `Inventario` recalculan automáticamente.
7. ✅ La tabla web se actualiza sin recargar la página.
8. ✅ Si el stock se agotó entre la carga y el envío, el usuario recibe un error claro.
9. ✅ La interfaz es usable en un teléfono con pantalla de 5" en conexión 4G.
10. ✅ El mensaje del footer menciona la opción de aportar con dinero en efectivo (requisito del Excel original).

---

## 10. Fuera de Alcance (MVP)

- Autenticación de usuarios (no se requiere login).
- Edición o eliminación de donaciones una vez registradas.
- Notificaciones push o email al donar.
- Panel de administración web (el admin usa Google Sheets directamente).
- Soporte multi-idioma.
- Modo offline / PWA.
