import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function pairWithPhone() {
  const sessionPath = './session';
  
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }
  
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  });

  let pairingRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }
    
    if (connection === 'open') {
      if (!pairingRequested) {
        console.log('\n✅ Connected!\n');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (fs.existsSync('./session/creds.json')) {
          const creds = JSON.parse(fs.readFileSync('./session/creds.json', 'utf-8'));
          const sessionId = Buffer.from(JSON.stringify(creds)).toString('base64');
          
          console.log('📋 SESSION_ID:\n');
          console.log(sessionId);
          console.log('\n');
        }
        
        rl.close();
        process.exit(0);
      }
    }
    
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      
      if (reason === 401 && !pairingRequested) {
        pairingRequested = true;
        console.log('\n⚠️  Need to pair device\n');
        
        const phoneNumber = await question('Enter WhatsApp number (with country code, e.g., 254712345678): ');
        
        try {
          const code = await sock.requestPairingCode(phoneNumber.trim());
          console.log(`\n🔑 Pairing code: ${code}\n`);
          console.log('Enter this code in WhatsApp:');
          console.log('Settings > Linked Devices > Link a Device > Link with phone number\n');
        } catch (err) {
          console.error('Error:', err.message);
          rl.close();
          process.exit(1);
        }
      } else if (reason !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...');
        setTimeout(pairWithPhone, 3000);
      } else {
        rl.close();
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

console.log('🚗 BMW-MD Phone Pairing\n');
pairWithPhone().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
