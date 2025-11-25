import axios from 'axios';
import https from 'https';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const HTTP_URL = "https://gateway.bit2me.com/alive";
const LIVENESS_URL = "https://gateway.bit2me.com/v1/health/liveness";

const httpsAgent = new https.Agent({
  keepAlive: true,
  timeout: 60000, // Socket timeout
});

// ======= COUNTERS ======= //
// Alive endpoint counters
let totalChecks = 0;
let successfulChecks = 0;
let failedChecks = 0;
let slowChecks = 0;

// Liveness endpoint counters
let totalChecksLiveness = 0;
let successfulChecksLiveness = 0;
let failedChecksLiveness = 0;
let slowChecksLiveness = 0;

// ======= NOTIFICATION FUNCTIONS ======= //
async function notify(msg) {
  console.log(`[ALERT] ${new Date().toISOString()} - ${msg}`);

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg
    });
  } catch (err) {
    console.error("Error sending Telegram:", err.message);
  }
}

// ======= CHECK HTTP ======= //
async function checkHttpEndpoint() {
  const start = Date.now();
  totalChecks++;

  try {
    await axios.get(HTTP_URL, {
      timeout: 2000,
      httpsAgent
    });
    const elapsed = Date.now() - start;

    console.log(`${new Date().toISOString()} - HTTP response time: ${elapsed}ms`);

    successfulChecks++;

    if (elapsed > 1000) {
      slowChecks++;
      notify(`HTTP slow: ${elapsed}ms`);
    }
  } catch (err) {
    failedChecks++;
    notify("ERROR HTTP: " + err.message);
  }
}

// ======= CHECK LIVENESS ======= //
async function checkLivenessEndpoint() {
  const start = Date.now();
  totalChecksLiveness++;

  try {
    const response = await axios.get(LIVENESS_URL, {
      timeout: 2000,
      httpsAgent,
      validateStatus: (status) => status === 204 || status < 500 // Accept 204 and other success codes
    });
    const elapsed = Date.now() - start;

    console.log(`${new Date().toISOString()} - Liveness response time: ${elapsed}ms (status: ${response.status})`);

    successfulChecksLiveness++;

    if (elapsed > 1000) {
      slowChecksLiveness++;
      notify(`Liveness slow: ${elapsed}ms`);
    }
  } catch (err) {
    failedChecksLiveness++;
    notify("ERROR Liveness: " + err.message);
  }
}

setInterval(checkHttpEndpoint, 2_000);
setInterval(checkLivenessEndpoint, 2_000);

// ======= SUMMARY EVERY 10 MINUTES ======= //
setInterval(() => {
  const msg = `📊 HTTP monitoring summary\n\n` +
    `🔗 /alive endpoint:\n` +
    `  Total checks: ${totalChecks}\n` +
    `  ✅ Successful: ${successfulChecks}\n` +
    `  ⚠️ Slow: ${slowChecks}\n` +
    `  ❌ Failed: ${failedChecks}\n\n` +
    `🔗 /v1/health/liveness endpoint:\n` +
    `  Total checks: ${totalChecksLiveness}\n` +
    `  ✅ Successful: ${successfulChecksLiveness}\n` +
    `  ⚠️ Slow: ${slowChecksLiveness}\n` +
    `  ❌ Failed: ${failedChecksLiveness}`;

  notify(msg);

  // Reset counters after sending summary
  totalChecks = 0;
  successfulChecks = 0;
  failedChecks = 0;
  slowChecks = 0;
  totalChecksLiveness = 0;
  successfulChecksLiveness = 0;
  failedChecksLiveness = 0;
  slowChecksLiveness = 0;
}, 600_000); // 10 minutes

