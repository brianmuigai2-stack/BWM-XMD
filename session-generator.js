import express from 'express';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;
let qrCode = '';
let sessionId = '';
let status = 'Initializing...';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BMW-MD Session Generator</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial; text-align: center; padding: 20px; background: #1a1a1a; color: #fff; }
        h1 { color: #00d4ff; }
        #status { font-size: 18px; margin: 20px; color: #00ff00; }
        #qr { margin: 20px auto; padding: 20px; background: white; display: inline-block; }
        #session { background: #2a2a2a; padding: 15px; border-radius: 5px; word-break: break-all; margin: 20px; }
        .btn { background: #00d4ff; color: #000; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px; }
        textarea { width: 80%; height: 100px; background: #1a1a1a; color: #0f0; border: 1px solid #00d4ff; padding: 10px; }
      </style>
    </head>
    <body>
      <h1>🚗 BMW-MD Session Generator</h1>
      <div id="status">Loading...</div>
      <div id="qr">Generating QR Code...</div>
      <div id="session"></div>
      <button class="btn" onclick="location.reload()">Refresh</button>
      <script>
        setInterval(() => {
          fetch('/qr').then(r => r.json()).then(data => {
            document.getElementById('status').innerHTML = data.status;
            if (data.qr) {
              document.getElementById('qr').innerHTML = '<img src="' + data.qr + '" width="300">';
            }
            if (data.session) {
              document.getElementById('session').innerHTML = '<h3>✅ Session Generated!</h3><p>Copy this SESSION_ID:</p><textarea readonly>' + data.session + '</textarea><br><button class="btn" onclick="navigator.clipboard.writeText(\\'' + data.session + '\\');alert(\\'Copied!\\')">Copy to Clipboard</button>';
            }
          });
        }, 1000);
      </script>
    </body>
    </html>
  `);
});

app.get('/qr', (req, res) => {
  res.json({ qr: qrCode, session: sessionId, status });
});

async function startPairing() {
  const sessionPath = './temp_session_' + Date.now();
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['BMW-MD', 'Chrome', '121.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code generated');
        status = '📱 Scan QR with WhatsApp (Linked Devices)';
        const QRCode = await import('qrcode');
        qrCode = await QRCode.toDataURL(qr);
      }
      
      if (connection === 'connecting') {
        status = '🔄 Connecting...';
        console.log('Connecting...');
      }
      
      if (connection === 'open') {
        console.log('✅ Connected successfully!');
        status = '✅ Connected! Generating session...';
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const credsPath = path.join(sessionPath, 'creds.json');
        if (fs.existsSync(credsPath)) {
          const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
          sessionId = Buffer.from(JSON.stringify(creds)).toString('base64');
          console.log('✅ Session ID generated');
          status = '✅ Session Generated! Copy it below.';
        }
        
        sock.end();
        
        setTimeout(() => {
          console.log('Cleaning up and restarting...');
          fs.rmSync(sessionPath, { recursive: true, force: true });
          qrCode = '';
          sessionId = '';
          status = 'Ready for new session...';
          startPairing();
        }, 120000);
      }
      
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log('Connection closed. Reason:', reason);
        
        if (reason === DisconnectReason.loggedOut) {
          status = '❌ Logged out. Please refresh.';
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } else if (reason === DisconnectReason.restartRequired) {
          status = '🔄 Restart required, continuing...';
          console.log('Restart required, continuing session generation...');
          // Don't restart, just wait a bit and continue
          setTimeout(() => {
            status = '📱 Scan QR with WhatsApp (Linked Devices)';
            startPairing();
          }, 2000);
        } else {
          status = '🔄 Reconnecting...';
          setTimeout(startPairing, 3000);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
    
  } catch (error) {
    console.error('Error:', error);
    status = '❌ Error: ' + error.message;
    setTimeout(startPairing, 5000);
  }
}

app.listen(PORT, () => {
  console.log(`✅ Session generator running on http://localhost:${PORT}`);
  startPairing();
});
