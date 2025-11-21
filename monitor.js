import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const HTTP_URL = "https://gateway.bit2me.com/alive";

// ======= COUNTERS ======= //
let totalChecks = 0;
let successfulChecks = 0;
let failedChecks = 0;
let slowChecks = 0;

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
    await axios.get(HTTP_URL, { timeout: 2000 });
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

setInterval(checkHttpEndpoint, 2_000);

// ======= SUMMARY EVERY 10 MINUTES ======= //
setInterval(() => {
  const msg = `📊 HTTP monitoring summary\n\n` +
    `Total checks: ${totalChecks}\n` +
    `✅ Successful: ${successfulChecks}\n` +
    `⚠️ Slow: ${slowChecks}\n` +
    `❌ Failed: ${failedChecks}`;
  
  notify(msg);
  
  // Reset counters after sending summary
  totalChecks = 0;
  successfulChecks = 0;
  failedChecks = 0;
  slowChecks = 0;
}, 600_000); // 10 minutes

