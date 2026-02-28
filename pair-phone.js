import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';

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
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['BMW-MD', 'Chrome', '121.0.0']
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, isNewLogin } = update;
    
    if (connection === 'open') {
      console.log('\n✅ Connected successfully!');
      
      const credsPath = `${sessionPath}/creds.json`;
      if (fs.existsSync(credsPath)) {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        const sessionId = Buffer.from(JSON.stringify(creds)).toString('base64');
        
        console.log('\n📋 Your SESSION_ID:\n');
        console.log(sessionId);
        console.log('\n✅ Copy this SESSION_ID and add it to your environment variables\n');
      }
      
      rl.close();
      process.exit(0);
    }
    
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      
      if (reason === 401) {
        console.log('\n⚠️  Need to pair device first');
        
        if (!sock.authState.creds.registered) {
          const phoneNumber = await question('\nEnter your WhatsApp number (with country code, e.g., 254712345678): ');
          
          setTimeout(async () => {
            try {
              const code = await sock.requestPairingCode(phoneNumber.trim());
              console.log(`\n🔑 Your pairing code: ${code}\n`);
              console.log('Enter this code in WhatsApp:');
              console.log('Settings > Linked Devices > Link a Device > Link with phone number\n');
            } catch (err) {
              console.error('Error requesting code:', err.message);
            }
          }, 3000);
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
console.log('Initializing connection...\n');

pairWithPhone().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
