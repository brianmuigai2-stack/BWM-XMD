import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import express from 'express';
import fs from 'fs';
import path from 'path';
import config from './config.cjs';

const app = express();
const PORT = process.env.PORT || 3000;

async function connectToWhatsApp() {
  let authState;
  
  // Check if SESSION_ID is provided in environment
  if (process.env.SESSION_ID) {
    console.log('Using SESSION_ID from environment...');
    
    // Create session directory if it doesn't exist
    if (!fs.existsSync('./session')) {
      fs.mkdirSync('./session');
    }
    
    // Parse SESSION_ID and write to creds.json
    let sessionData = process.env.SESSION_ID;
    
    // Remove prefix if it exists
    if (sessionData.startsWith('Bmw-xmdπ')) {
      sessionData = sessionData.replace('Bmw-xmdπ', '');
    }
    
    try {
      const creds = JSON.parse(Buffer.from(sessionData, 'base64').toString('utf-8'));
      fs.writeFileSync('./session/creds.json', JSON.stringify(creds, null, 2));
      console.log('✅ Session credentials loaded from SESSION_ID');
    } catch (error) {
      console.error('❌ Error parsing SESSION_ID:', error.message);
      console.log('Please generate a new session or check your SESSION_ID');
      return;
    }
  }
  
  // Use file-based auth state
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
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Status:', statusCode, 'Reconnecting:', shouldReconnect);
      
      if (statusCode === 401) {
        console.log('\n⚠️  Unauthorized - Need to scan QR code or add SESSION_ID\n');
      } else if (statusCode === 405) {
        console.log('\n⚠️  Method Not Allowed - Session may be invalid or expired\n');
        console.log('Try regenerating the session or check your connection\n');
      } else if (statusCode === 428) {
        console.log('\n⚠️  Connection closed - Will retry\n');
      }
      
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
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
