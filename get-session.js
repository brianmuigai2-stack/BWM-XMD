import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

async function pair() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    markOnlineOnConnect: false
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 Scan this QR code:\n');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'open') {
      console.log('\n✅ Connected!\n');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (fs.existsSync('./session/creds.json')) {
        const creds = JSON.parse(fs.readFileSync('./session/creds.json', 'utf-8'));
        const sessionId = Buffer.from(JSON.stringify(creds)).toString('base64');
        
        console.log('📋 SESSION_ID:\n');
        console.log(sessionId);
        console.log('\n');
      }
      
      process.exit(0);
    }
    
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      
      if (code === DisconnectReason.loggedOut) {
        console.log('\n❌ Logged out\n');
        process.exit(1);
      } else {
        console.log(`Reconnecting... (${code})`);
        setTimeout(pair, 2000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

console.log('🚗 BMW-MD Pairing\n');
pair();
