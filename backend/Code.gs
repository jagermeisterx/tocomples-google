function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Inventario');
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return jsonResponse({ status: 'ok', data: [] });
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  const result = data.map(row => ({
    producto: String(row[0]).trim(),
    metaTotal: Number(row[1]) || 0,
    totalDonado: Number(row[2]) || 0,
    restante: Number(row[3]) || 0
  }));

  return jsonResponse({ status: 'ok', data: result });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const body = JSON.parse(e.postData.contents);

    const error = validateInput(body);
    if (error) return jsonResponse(error);

    const nombre = body.nombre.trim();
    const apellido = body.apellido.trim();
    const productoInput = body.producto.trim();
    const cantidad = Number(body.cantidad);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const inventario = ss.getSheetByName('Inventario');
    const registro = ss.getSheetByName('Registro_Donaciones');

    const invData = inventario.getRange(2, 1, inventario.getLastRow() - 1, 4).getValues();

    let productRow = null;
    for (let i = 0; i < invData.length; i++) {
      if (String(invData[i][0]).trim().toLowerCase() === productoInput.toLowerCase()) {
        productRow = invData[i];
        break;
      }
    }

    if (!productRow) {
      return jsonResponse({
        status: 'error',
        code: 'PRODUCTO_INVALIDO',
        message: 'El producto seleccionado no existe en el inventario.'
      });
    }

    const productoExacto = String(productRow[0]).trim();
    const restante = Number(productRow[3]);

    if (restante <= 0) {
      return jsonResponse({
        status: 'error',
        code: 'STOCK_AGOTADO',
        message: `La meta de ${productoExacto} ya fue cubierta por otra donación.`,
        restanteActual: 0
      });
    }

    if (cantidad > restante) {
      return jsonResponse({
        status: 'error',
        code: 'CANTIDAD_EXCEDIDA',
        message: `Solo quedan ${restante} unidades de ${productoExacto}.`,
        restanteActual: restante
      });
    }

    const timestamp = new Date();
    registro.appendRow([timestamp, nombre, apellido, productoExacto, cantidad]);

    return jsonResponse({
      status: 'ok',
      message: 'Donación registrada correctamente',
      donacion: { nombre, apellido, producto: productoExacto, cantidad }
    });

  } catch (err) {
    return jsonResponse({
      status: 'error',
      code: 'ERROR_INTERNO',
      message: 'Ocurrió un error al procesar la donación. Intenta de nuevo.'
    });
  } finally {
    lock.releaseLock();
  }
}

function validateInput(body) {
  if (!body.nombre || !body.apellido || !body.producto || body.cantidad === undefined) {
    return { status: 'error', code: 'CAMPOS_INVALIDOS', message: 'Todos los campos son obligatorios.' };
  }

  const nombre = body.nombre.trim();
  const apellido = body.apellido.trim();
  const cantidad = Number(body.cantidad);

  if (nombre.length < 2 || apellido.length < 2) {
    return { status: 'error', code: 'CAMPOS_INVALIDOS', message: 'Nombre y apellido deben tener al menos 2 caracteres.' };
  }

  if (nombre.length > 50 || apellido.length > 50) {
    return { status: 'error', code: 'CAMPOS_INVALIDOS', message: 'Nombre y apellido no pueden exceder 50 caracteres.' };
  }

  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { status: 'error', code: 'CAMPOS_INVALIDOS', message: 'La cantidad debe ser un número entero positivo.' };
  }

  return null;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
