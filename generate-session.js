import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

async function generateSession() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Chrome', 'Ubuntu', '20.0.04']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n📱 Scan this QR code:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n');
    }
    
    if (connection === 'connecting') {
      console.log('🔄 Connecting...');
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        generateSession();
      }
    } else if (connection === 'open') {
      console.log('\n✅ Connected!\n');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (fs.existsSync('./session/creds.json')) {
        const creds = JSON.parse(fs.readFileSync('./session/creds.json', 'utf-8'));
        const sessionId = 'Bmw-xmdπ' + Buffer.from(JSON.stringify(creds)).toString('base64');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 YOUR SESSION_ID (Copy everything below):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(sessionId);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n✅ Add this to Render Environment Variables:');
        console.log('   Key: SESSION_ID');
        console.log('   Value: (paste the string above)\n');
      }
      
      process.exit(0);
    }
  });
}

console.log('🚗 BMW-MD Session Generator\n');
console.log('📱 Scan the QR code with WhatsApp:\n');
console.log('   WhatsApp > Settings > Linked Devices > Link a Device\n');

generateSession();
