# 📬 Documentación de Notificaciones: Webhook y WebSocket

---

## 1. Endpoint HTTP: `/webhook`

### **Descripción**
Permite recibir notificaciones externas (por ejemplo, desde otros sistemas) y distribuirlas a los clientes conectados vía WebSocket, ya sea a todos o a usuarios específicos.

### **Ruta**
```
POST /webhook
```

#### 🔒 **Detalles de autenticación (WebhookAuthGuard)**

Este endpoint requiere un header `Authorization` con el formato `Bearer <token>`

- **¿Cómo funciona?**
  1. Busca el header `Authorization` en la petición.
  2. Valida el formato: debe ser `Bearer <token>`.
  3. Obtiene el token esperado desde la variable de entorno `WEBHOOK_API_TOKEN`.
  4. Compara ambos tokens (el recibido y el configurado).
  5. Si todo es correcto, permite el acceso. Si falla cualquier paso, lanza un error 401 personalizado.

- **Ejemplo de uso en la petición:**

```http
POST /webhook HTTP/1.1
Host: tu-servidor.com
Authorization: Bearer TU_TOKEN_WEBHOOK
Content-Type: application/json

{
  "type": "alert",
  "message": "¡Notificación de prueba!"
}
```

- **Variables de entorno requeridas:**
  - `WEBHOOK_API_TOKEN`: El token secreto que debe coincidir con el enviado en el header.

- **Errores posibles:**
  - 401 Unauthorized si:
    - Falta el header `Authorization`
    - El formato es incorrecto (no es `Bearer <token>`)
    - El token no coincide con el configurado
    - El token no está configurado en el servidor

> **Resumen:** Si el token es incorrecto o falta, la petición será rechazada con error 401.

### **Body esperado**
```json
{
  "type": "string",                // Tipo de notificación (ej: "alert", "info", etc.)
  "message": "string",             // Mensaje principal de la notificación
  "data": { ... },                 // (Opcional) Objeto con datos adicionales
  "priority": "normal|high|low",   // (Opcional) Prioridad de la notificación
  "targetUsers": ["userId1", ...]  // (Opcional) Array de IDs de usuario destino
}
```

### **Comportamiento**
- Si `targetUsers` está presente y contiene usuarios, la notificación se envía solo a esos usuarios.
- Si no, la notificación se envía a **todos** los clientes conectados.
- El sistema registra logs detallados del proceso y maneja errores de validación, procesamiento y entrega.

### **Respuesta exitosa**
```json
{
  "message": "Notification received and processed successfully",
  "status": "success",
  "notificationId": "uuid",
  "deliveryInfo": {
    "totalClients": 5,
    "deliveredTo": 3,
    "targetType": "broadcast" | "targeted",
    "targetUsers": ["userId1", ...] // Solo si es targeted
  }
}
```

### **Errores posibles**
- 400: Datos inválidos (estructura, campos requeridos, etc.)
- 500: Error interno de procesamiento o entrega

---

## 2. WebSocket: Conexión y Recepción de Notificaciones

### **URL de conexión**
```
ws://<host>:<port>/notifications
```
- El namespace puede variar según configuración (`WS_NAMESPACE`).

### **Autenticación**
- **Obligatoria:**  
  Debes enviar un token JWT válido al conectar.
- **Formas de enviar el token:**
  - En el header `Authorization` como `Bearer <token>`
  - O en el objeto `auth` del handshake: `{ token: "<token>" }`

#### **Ejemplo con socket.io-client (JS):**
```js
import { io } from "socket.io-client";

const socket = io("ws://localhost:3000/notifications", {
  auth: { token: "TU_JWT_AQUI" }
  // O bien:
  // extraHeaders: { Authorization: "Bearer TU_JWT_AQUI" }
});

socket.on("connected", (data) => {
  console.log("Conectado:", data);
});

socket.on("notification", (noti) => {
  console.log("Notificación recibida:", noti);
});

socket.on("error", (err) => {
  console.error("Error de conexión:", err);
});
```

### **Eventos relevantes**

- **`connected`**  
  Emitido al conectar exitosamente.  
  Contiene:  
  ```json
  {
    "message": "Successfully connected to notification service",
    "socketId": "string",
    "userId": "string",
    "timestamp": "ISO8601",
    "authenticated": true
  }
  ```

- **`notification`**  
  Emitido cada vez que recibes una notificación (broadcast o dirigida).  
  Ejemplo de payload:
  ```json
  {
    "id": "uuid",
    "type": "alert",
    "message": "¡Tienes una nueva alerta!",
    "data": { ... },
    "priority": "high",
    "timestamp": "2024-06-01T12:34:56.789Z",
    "source": "webhook"
  }
  ```

- **`error`**  
  Si ocurre un error de autenticación o conexión.

---

## 3. **Notas adicionales**

- Si el usuario tiene varias conexiones (varias pestañas/dispositivos), recibirá la notificación en todas.
- El sistema maneja la desconexión y limpieza automática de clientes.
- El endpoint `/webhook` puede usarse para pruebas manuales con herramientas como Postman, siempre que se incluya la autenticación requerida. 