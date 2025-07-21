# 📚 Guía para Clientes: Uso de Webhook y Notificaciones en Tiempo Real

---

## 1. Enviar notificaciones usando el Webhook

### **¿Para qué sirve?**
Permite que sistemas externos (por ejemplo, un backend, CRM, ERP, etc.) envíen notificaciones a los usuarios conectados en tiempo real a través de WebSocket.

### **¿Cómo se usa?**

#### **Paso 1: Obtener el token de autenticación**
Solicita al administrador del sistema el valor de la variable de entorno `WEBHOOK_API_TOKEN`.  
Este token es necesario para autenticar tus peticiones.

#### **Paso 2: Realizar una petición HTTP POST**

- **URL:**  
  ```
  https://<TU_DOMINIO>/notifications/webhook
  ```

- **Headers requeridos:**  
  ```
  Authorization: Bearer <TU_TOKEN_WEBHOOK>
  Content-Type: application/json
  ```

- **Body de ejemplo (JSON):**
  ```json
  {
    "type": "alert",
    "message": "¡Tienes una nueva notificación!",
    "data": { "foo": "bar" },
    "priority": "high",
    "targetUsers": ["usuario1", "usuario2"] // Opcional: si se omite, es broadcast
  }
  ```

- **Ejemplo con curl:**
  ```bash
  curl -X POST https://<TU_DOMINIO>/notifications/webhook \
    -H "Authorization: Bearer TU_TOKEN_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "alert",
      "message": "¡Tienes una nueva notificación!",
      "priority": "high",
      "targetUsers": ["usuario1", "usuario2"]
    }'
  ```

- **Respuesta esperada:**
  ```json
  {
    "message": "Notification received and processed successfully",
    "status": "success",
    "notificationId": "uuid",
    "deliveryInfo": {
      "totalClients": 5,
      "deliveredTo": 2,
      "targetType": "targeted",
      "targetUsers": ["usuario1", "usuario2"]
    }
  }
  ```

---

## 2. Recibir notificaciones en tiempo real (WebSocket)

### **¿Para qué sirve?**
Permite que aplicaciones frontend (web, móvil, escritorio) reciban notificaciones en tiempo real, sin necesidad de refrescar la página o hacer polling.

### **¿Cómo se usa?**

#### **Paso 1: Obtener el JWT**
El usuario debe autenticarse en tu sistema y obtener un JWT válido (token de acceso).

#### **Paso 2: Conectarse al WebSocket**

- **URL de conexión:**  
  ```
  wss://<TU_DOMINIO>/notifications
  ```

- **Autenticación:**  
  Envía el JWT en el handshake, usando el campo `auth.token` o el header `Authorization`.

- **Ejemplo con socket.io-client (JavaScript):**
  ```js
  import { io } from "socket.io-client";

  const socket = io("wss://<TU_DOMINIO>/notifications", {
    auth: { token: "TU_JWT_AQUI" }
    // O bien:
    // extraHeaders: { Authorization: "Bearer TU_JWT_AQUI" }
  });

  // Evento de conexión
  socket.on("connected", (data) => {
    console.log("Conectado:", data);
  });

  // Evento de notificación
  socket.on("notification", (noti) => {
    console.log("Notificación recibida:", noti);
    // Aquí puedes mostrarla en tu UI
  });

  // Evento de error
  socket.on("error", (err) => {
    console.error("Error de conexión:", err);
  });
  ```

#### **Formato de la notificación recibida:**
```json
{
  "id": "uuid",
  "type": "alert",
  "message": "¡Tienes una nueva notificación!",
  "data": { "foo": "bar" },
  "priority": "high",
  "timestamp": "2024-06-01T12:34:56.789Z",
  "source": "webhook"
}
```

---

## 3. Resumen de flujo típico

1. **Un sistema externo** envía una notificación usando el webhook autenticado.
2. **El backend** procesa y distribuye la notificación a los usuarios conectados.
3. **El frontend** (o cualquier cliente WebSocket autenticado) recibe la notificación en tiempo real y la muestra al usuario.

---

## 4. Recomendaciones

- **No compartas tu `WEBHOOK_API_TOKEN`** con terceros no autorizados.
- **Asegúrate de manejar reconexiones** en el cliente WebSocket para no perder notificaciones.
- **Valida siempre el JWT** antes de conectar al WebSocket.
- **Puedes probar el webhook con Postman, curl o cualquier cliente HTTP**. 