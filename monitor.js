import WebSocket from 'ws';
import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const HTTP_URL = "https://gateway.bit2me.com/alive";
const WS_URL = "wss://ws.bit2me.com/v1/trading";

let ws = null;
let lastMessageTime = Date.now();
let reconnectCount = 0;

// ======= FUNCIONES DE NOTIFICACIÓN ======= //
async function notify(msg) {
  console.log(`[ALERTA] ${new Date().toISOString()} - ${msg}`);

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg
    });
  } catch (err) {
    console.error("Error enviando Telegram:", err.message);
  }
}

// ======= CHECK HTTP ======= //
async function checkHttpEndpoint() {
  const start = Date.now();
  try {
    await axios.get(HTTP_URL, { timeout: 5000 });
    const elapsed = Date.now() - start;

    console.log(`${new Date().toISOString()} - HTTP response time: ${elapsed}ms`);
    
    if (elapsed > 5000) {
      notify(`HTTP lento: ${elapsed}ms`);
    }
  } catch (err) {
    notify("ERROR HTTP: " + err.message);
  }
}

setInterval(checkHttpEndpoint, 10_000);

// ======= WEBSOCKET ======= //
function connectWebSocket() {
  console.log("Conectando WebSocket...");
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    reconnectCount++;
    notify(`✅ WebSocket conectado (reconexiones: ${reconnectCount})`);
    
    ws.send(JSON.stringify({
      event: "subscribe",
      symbol: "USDT/USD",
      subscription: { name: "order-book" }
    }));

    lastMessageTime = Date.now();
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.event === 'pong') return;

    lastMessageTime = Date.now();
    console.log(`${new Date().toISOString()} - Websocket message received`);
  });

  ws.on('close', () => {
    notify("❌ WebSocket desconectado, reconectando en 3s...");
    setTimeout(connectWebSocket, 3000);
  });

  ws.on('error', err => {
    notify("Error WebSocket: " + err.message);
    ws.close();
  });
}

// Ping al WebSocket cada 10s
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: 'ping' }));
  }
}, 10_000);

// Chequeo de inactividad WS cada 10s
setInterval(() => {
  const secondsSinceLast = (Date.now() - lastMessageTime) / 1000;
  if (secondsSinceLast > 60) {
    notify(`⏱ Más de 60s sin mensajes del WebSocket (${secondsSinceLast}s)`);
  }
}, 10_000);

// ======= DASHBOARD TELEGRAM (1h) ======= //
setInterval(() => {
  const secondsSinceLast = Math.floor((Date.now() - lastMessageTime) / 1000);
  const msg = `📊 Dashboard\nHTTP: ${HTTP_URL}\nÚltimo mensaje WS: ${secondsSinceLast}s atrás\nReconexiones WS: ${reconnectCount}`;
  notify(msg);
}, 3600_000); // 1h

connectWebSocket();

