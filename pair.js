import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

async function pair() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'fatal' }),
    browser: ['BMW-MD', 'Safari', '3.0'],
    syncFullHistory: false
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏰ QR code expires in 60 seconds. Scan quickly!\n');
    }
    
    if (connection === 'open') {
      console.log('\n✅ Connected successfully!');
      console.log('Generating SESSION_ID...\n');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const credsPath = './session/creds.json';
      if (fs.existsSync(credsPath)) {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        const sessionId = Buffer.from(JSON.stringify(creds)).toString('base64');
        
        console.log('📋 Your SESSION_ID:\n');
        console.log(sessionId);
        console.log('\n✅ Copy this and add to your Render environment variables\n');
      }
      
      process.exit(0);
    }
    
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed. Code:', code);
      
      if (code !== DisconnectReason.loggedOut && code !== 515) {
        console.log('Retrying in 3 seconds...\n');
        setTimeout(pair, 3000);
      } else {
        console.log('\n❌ Connection failed. Try again.\n');
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

console.log('🚗 BMW-MD Session Generator\n');
console.log('Initializing...\n');
pair();
