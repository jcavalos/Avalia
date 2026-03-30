# 🤖 Avalia — Bot de WhatsApp Personal

Bot que responde tus mensajes de WhatsApp automáticamente, imitando tu forma de escribir, usando inteligencia artificial **completamente gratis**.

---

## 📋 Requisitos

- **Node.js** v18 o superior → https://nodejs.org
- **Cuenta de Groq** (gratis, sin tarjeta) → https://console.groq.com
- **WhatsApp** instalado en tu celular
- Computadora encendida con internet mientras el bot corre

---

## 🚀 Instalación desde cero

### 1. Clona o descarga el proyecto

```bash
git clone https://github.com/jcavalos/Avalia.git
cd Avalia
```

### 2. Instala las dependencias

```bash
npm install
```

Tarda 2-5 minutos porque descarga Chromium internamente.

### 3. Consigue tu API key gratis de Groq

1. Ve a https://console.groq.com
2. Regístrate con tu cuenta de Google
3. Ve a **API Keys → Create API Key**
4. Copia la key (empieza con `gsk_...`)

### 4. Configura el archivo `.env`

Abre el archivo `.env` en la raíz del proyecto y llénalo:

```env
GROQ_API_KEY=gsk_tu-key-aqui

BOT_MODE=suggest
MIN_REPLY_INTERVAL=0
ALLOWED_CONTACTS=
VIP_CONTACTS=
```

> Empieza con `BOT_MODE=suggest` para probar antes de activar el envío automático.

### 5. Exporta tus chats de WhatsApp

Para que el bot aprenda tu forma de escribir necesitas exportar conversaciones:

1. Abre WhatsApp en tu celular
2. Entra a un chat
3. Toca los **tres puntos** → **Más** → **Exportar chat**
4. Elige **Sin archivos multimedia**
5. Mándate el archivo por correo y descárgalo
6. Copia el `.txt` a la carpeta `exported_chats/` del proyecto
7. Repite con al menos 5 chats diferentes

> Mientras más chats exportes, mejor va a imitar tu estilo.

### 6. Analiza tu estilo de escritura

```bash
npm run analyze
```

Verás algo así:

```
📊 ANÁLISIS COMPLETADO:
   📝 Total mensajes  : 495
   📏 Longitud prom   : 31 caracteres
   😊 Emojis top      : 🙈 ☺
   💬 Frases típicas  : "por favor", "buenos días"
   🔤 Capitalización  : normal
✅ Estilo guardado en: data/style.json
```

### 7. Arranca el bot

```bash
npm start
```

Aparece un código QR en la terminal.

### 8. Conecta tu WhatsApp

1. Abre WhatsApp en tu celular
2. Toca los **tres puntos** → **Dispositivos vinculados**
3. Toca **Vincular dispositivo**
4. Escanea el QR que aparece en la terminal

Cuando conecte verás:

```
✅ Autenticación exitosa!
🚀 BOT CONECTADO Y FUNCIONANDO
👂 Escuchando mensajes...
```

---

## ⚙️ Configuración del archivo `.env`

| Variable | Descripción | Ejemplo |
|---|---|---|
| `GROQ_API_KEY` | Tu API key de Groq | `gsk_abc123...` |
| `BOT_MODE` | `suggest` = solo muestra, `auto` = envía solo | `auto` |
| `MIN_REPLY_INTERVAL` | Minutos entre respuestas al mismo contacto | `0` |
| `ALLOWED_CONTACTS` | Números que puede responder (vacío = todos) | `5215512345678@c.us` |
| `VIP_CONTACTS` | Contactos VIP: avisa pero no responde | `Maria,Juan` |

### Ejemplo de `.env` completo

```env
GROQ_API_KEY=gsk_tu-key-aqui
BOT_MODE=auto
MIN_REPLY_INTERVAL=0
ALLOWED_CONTACTS=
VIP_CONTACTS=Maria,5215512345678@c.us
```

---

## 🌟 Funcionalidades

### Modo sugerencia vs modo automático

**Modo sugerencia** (`BOT_MODE=suggest`): el bot genera la respuesta y la muestra en consola pero NO la envía. Útil para probar que el estilo es correcto antes de activarlo.

**Modo automático** (`BOT_MODE=auto`): el bot responde solo a todos los mensajes que lleguen.

### Contactos VIP

Contactos a los que NO quieres que el bot responda automáticamente. Cuando ese contacto escriba, el bot te avisa en consola con una alerta especial y tú respondes manualmente.

Para configurarlo, agrega el nombre o número en `.env`:

```env
VIP_CONTACTS=Maria,Jefe,5215512345678@c.us
```

Cuando ese contacto escriba verás:

```
★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
⭐ CONTACTO VIP: Maria
📩 Mensaje: "oye necesito hablar contigo"
⚠️  Este contacto requiere tu respuesta personal
★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
```

### Ignorar grupos

El bot ignora automáticamente todos los grupos. Solo responde mensajes directos.

### Historial de conversación

El bot recuerda el contexto de cada conversación (últimos 20 mensajes por contacto) para que las respuestas sean coherentes con lo que se habló antes.

---

## 🔄 Reentrenar el estilo

Puedes mejorar el bot en cualquier momento agregando más chats:

1. Exporta más conversaciones de WhatsApp
2. Copia los nuevos `.txt` a la carpeta `exported_chats/`
3. Corre el análisis de nuevo:

```bash
npm run analyze
```

4. Reinicia el bot:

```bash
npm start
```

El nuevo análisis sobreescribe el anterior con más datos, lo que mejora la imitación de tu estilo.

---

## 📱 Cambiar de número o reconectar WhatsApp

Si quieres conectar otro número o volver a escanear el QR:

```bash
rmdir /s /q .wwebjs_auth
npm start
```

Esto borra la sesión guardada y muestra el QR de nuevo.

---

## 📊 Límites de la API gratuita de Groq

| Límite | Cantidad |
|---|---|
| Requests por minuto | 30 |
| Requests por día | 14,400 |
| Tokens por minuto | 500,000 |
| Costo | Gratis |

Los límites se reinician automáticamente cada día. Para un bot personal nunca los vas a alcanzar.

---

## 🗂️ Estructura del proyecto

```
Avalia/
├── src/
│   ├── bot.js          # Lógica principal, conexión a WhatsApp
│   ├── analyzer.js     # Analiza tus chats y extrae tu estilo
│   ├── claude.js       # Cliente de la API de Groq
│   └── config.js       # Lee la configuración del .env
├── exported_chats/     # Aquí van tus chats exportados (.txt)
├── data/
│   ├── style.json      # Tu perfil de escritura generado
│   └── conversations.json  # Historial de conversaciones
├── .wwebjs_auth/       # Sesión de WhatsApp (se crea automáticamente)
├── .env                # Tu configuración y API key
└── package.json        # Dependencias del proyecto
```

---

## ❓ Solución de problemas comunes

**El bot no aparece el QR**
Espera 30-60 segundos, Chromium tarda en cargar la primera vez.

**Error de autenticación**
```bash
rmdir /s /q .wwebjs_auth
npm start
```

**El bot no responde algunos mensajes**
Verifica que `MIN_REPLY_INTERVAL=0` en tu `.env` y que `BOT_MODE=auto`.

**Error 429 de la API**
Cambiaste el modelo o la key. Verifica que en `src/claude.js` el modelo sea `llama-3.3-70b-versatile` y que la key en `.env` empiece con `gsk_`.

**No detecta nombres en los chats**
Tus chats deben tener el formato mexicano de WhatsApp:
```
[22/09/25, 11:43:38 a.m.] Nombre: mensaje
```
Asegúrate de exportarlos desde WhatsApp en español.

---

## 🛑 Detener el bot

Presiona `Ctrl+C` en la terminal donde está corriendo.

---

## 📝 Notas importantes

- El bot solo funciona mientras tu computadora esté encendida y con internet
- Tu celular también debe tener internet (igual que WhatsApp Web)
- No respondas desde tu celular mientras el bot está en modo `auto` o habrá respuestas duplicadas
- La sesión de WhatsApp se guarda en `.wwebjs_auth/` — no la subas a GitHub (ya está en `.gitignore`)
