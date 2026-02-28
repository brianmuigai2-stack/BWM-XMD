import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SESSION_ID = process.env.SESSION_ID;

console.log('🔍 Checking SESSION_ID format...\n');

if (!SESSION_ID) {
  console.log('❌ SESSION_ID not found in environment variables');
  console.log('Add it to your .env file or Render environment variables\n');
  process.exit(1);
}

console.log('✅ SESSION_ID found');
console.log('Length:', SESSION_ID.length);

// Check if it has the correct prefix
if (SESSION_ID.startsWith('Bmw-xmdπ')) {
  console.log('✅ Correct format: Bmw-xmdπ prefix found\n');
  
  const base64Part = SESSION_ID.split('Bmw-xmdπ')[1];
  
  try {
    // Try to decode and create creds.json
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
    const creds = JSON.parse(decoded);
    
    console.log('✅ Valid session data');
    console.log('Creating session folder...\n');
    
    if (!fs.existsSync('./session')) {
      fs.mkdirSync('./session', { recursive: true });
    }
    
    fs.writeFileSync('./session/creds.json', JSON.stringify(creds, null, 2));
    console.log('✅ Session file created successfully!');
    console.log('You can now start your bot with: npm start\n');
    
  } catch (error) {
    console.log('❌ Invalid base64 or JSON format');
    console.log('Error:', error.message);
  }
  
} else {
  console.log('❌ Wrong format!');
  console.log('\nYour SESSION_ID should be in format:');
  console.log('Bmw-xmdπYOUR_BASE64_STRING\n');
  
  console.log('Current format:', SESSION_ID.substring(0, 50) + '...\n');
  
  // Try to fix it
  console.log('Attempting to fix format...');
  const fixed = 'Bmw-xmdπ' + SESSION_ID;
  console.log('\nTry using this instead:');
  console.log(fixed.substring(0, 100) + '...\n');
}
