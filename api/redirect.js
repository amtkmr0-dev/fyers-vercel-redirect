const crypto = require('crypto');

module.exports = async function handler(req, res) {
  const authCode = req.query.auth_code || '';
  const state = req.query.state || '';

  // If no auth_code, show error
  if (!authCode) {
    return res.status(400).send(buildHtml('error', 'No auth_code in URL.', null));
  }

  const APP_ID = process.env.FYERS_APP_ID || '';
  const SECRET_ID = process.env.FYERS_SECRET_ID || '';
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1713719957';

  // Step 1: Exchange auth_code for tokens
  let tokenResult = null;
  let exchangeError = null;

  if (APP_ID && SECRET_ID) {
    try {
      const appIdHash = crypto
        .createHash('sha256')
        .update(`${APP_ID}:${SECRET_ID}`)
        .digest('hex');

      const exchangeResp = await fetch(
        'https://api-t1.fyers.in/api/v3/validate-authcode',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            appIdHash: appIdHash,
            code: authCode,
          }),
        }
      );

      tokenResult = await exchangeResp.json();

      if (tokenResult.s !== 'ok' && tokenResult.code !== 200) {
        exchangeError = tokenResult.message || 'Exchange failed';
        tokenResult = null;
      }
    } catch (err) {
      exchangeError = err.message;
    }
  } else {
    exchangeError = 'FYERS_APP_ID or FYERS_SECRET_ID not configured';
  }

  // Step 2: Send to Telegram
  let telegramSent = false;
  let telegramError = null;

  if (tokenResult && BOT_TOKEN) {
    try {
      // Decode access token expiry
      let expiryInfo = '';
      try {
        const payload = tokenResult.access_token.split('.')[1];
        const decoded = JSON.parse(
          Buffer.from(payload, 'base64url').toString()
        );
        const expDate = new Date(decoded.exp * 1000);
        const hours = Math.round((decoded.exp - Date.now() / 1000) / 3600);
        expiryInfo = `Expires: ${expDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST (~${hours}h)`;
      } catch (e) {
        expiryInfo = 'Expiry: unknown';
      }

      const message = [
        'FYERS_TOKEN_AUTO',
        '',
        `access_token:${tokenResult.access_token}`,
        '',
        expiryInfo,
        '',
        'Quanta will pick this up at 9:30 IST.',
      ].join('\n');

      const tgResp = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            disable_notification: false,
          }),
        }
      );

      const tgResult = await tgResp.json();
      telegramSent = tgResult.ok === true;
      if (!telegramSent) {
        telegramError = tgResult.description || 'Telegram send failed';
      }
    } catch (err) {
      telegramError = err.message;
    }
  } else if (!BOT_TOKEN) {
    telegramError = 'TELEGRAM_BOT_TOKEN not configured';
  }

  // Step 3: Build response page
  if (tokenResult && telegramSent) {
    return res.status(200).send(
      buildHtml('success', 'Token exchanged and sent to Telegram!', {
        accessTokenPreview: tokenResult.access_token.slice(0, 30) + '...',
        telegramSent: true,
      })
    );
  } else if (tokenResult && !telegramSent) {
    // Token exchanged but Telegram failed — show token for manual copy
    return res.status(200).send(
      buildHtml('partial', 'Token exchanged but Telegram send failed.', {
        accessToken: tokenResult.access_token,
        telegramError: telegramError,
        authCode: null,
      })
    );
  } else {
    // Exchange failed — show auth_code for manual use
    return res.status(200).send(
      buildHtml('fallback', exchangeError || 'Token exchange failed.', {
        authCode: authCode,
      })
    );
  }
};

function buildHtml(status, message, data) {
  const statusEmoji =
    status === 'success' ? '&#x2705;' : status === 'partial' ? '&#x26A0;' : status === 'fallback' ? '&#x1F4CB;' : '&#x274C;';
  const statusColor =
    status === 'success' ? '#22c55e' : status === 'partial' ? '#f59e0b' : '#ef4444';

  let bodyContent = '';

  if (status === 'success') {
    bodyContent = `
      <div class="card">
        <div class="status" style="color: ${statusColor}">${statusEmoji} ${message}</div>
        <p class="info">Access token: <code>${data.accessTokenPreview}</code></p>
        <p class="info">Sent to Telegram. Quanta agent will pick it up automatically.</p>
        <p class="done">You can close this page.</p>
      </div>
    `;
  } else if (status === 'partial') {
    bodyContent = `
      <div class="card">
        <div class="status" style="color: ${statusColor}">${statusEmoji} ${message}</div>
        <p class="info">Telegram error: ${data.telegramError}</p>
        <p class="info">Copy the access token below and paste it in Telegram to @amitfno_bot:</p>
        <div class="token-box">
          <textarea id="token" rows="3" readonly>${data.accessToken}</textarea>
          <button onclick="copyToken()">Copy Access Token</button>
        </div>
      </div>
    `;
  } else if (status === 'fallback') {
    bodyContent = `
      <div class="card">
        <div class="status" style="color: ${statusColor}">${statusEmoji} ${message}</div>
        <p class="info">Copy the auth code below and send it to Quanta in Telegram or Hyperagent:</p>
        <div class="token-box">
          <textarea id="token" rows="3" readonly>${data.authCode}</textarea>
          <button onclick="copyToken()">Copy Auth Code</button>
        </div>
      </div>
    `;
  } else {
    bodyContent = `
      <div class="card">
        <div class="status" style="color: ${statusColor}">${statusEmoji} ${message}</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fyers Auth</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .status {
      font-size: 1.3rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .info {
      color: #94a3b8;
      margin-bottom: 12px;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .done {
      color: #22c55e;
      font-weight: 500;
      margin-top: 16px;
      font-size: 1.05rem;
    }
    code {
      background: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .token-box {
      margin-top: 16px;
    }
    textarea {
      width: 100%;
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 0.8rem;
      resize: none;
    }
    button {
      margin-top: 12px;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
    }
    button:hover { background: #2563eb; }
    button.copied { background: #22c55e; }
  </style>
</head>
<body>
  ${bodyContent}
  <script>
    function copyToken() {
      const ta = document.getElementById('token');
      ta.select();
      navigator.clipboard.writeText(ta.value).then(() => {
        const btn = document.querySelector('button');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = btn.textContent.includes('Auth') ? 'Copy Auth Code' : 'Copy Access Token';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}
