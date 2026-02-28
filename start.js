import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import express from 'express';
import fs from 'fs';
import config from './config.cjs';

const app = express();
const PORT = process.env.PORT || 3000;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['BMW-MD', 'Chrome', '20.0.04']
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 QR CODE - Scan with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nWhatsApp > Settings > Linked Devices > Link a Device\n');
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      
      // Generate SESSION_ID for future use
      if (fs.existsSync('./session/creds.json')) {
        const creds = JSON.parse(fs.readFileSync('./session/creds.json', 'utf-8'));
        const sessionId = 'Bmw-xmdπ' + Buffer.from(JSON.stringify(creds)).toString('base64');
        console.log('\n📋 Your SESSION_ID (save this):');
        console.log(sessionId.substring(0, 100) + '...\n');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    console.log('Message received:', text);
    
    // Simple ping response
    if (text.toLowerCase() === '.ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: '🏎️ BMW-MD is online!' });
    }
  });
}

app.get('/', (req, res) => {
  res.send('BMW-MD is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectToWhatsApp();
});
