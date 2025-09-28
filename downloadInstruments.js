const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadInstruments() {
  console.log('Downloading NSE instruments list...');
  
  try {
    // Kite provides a public CSV dump (no auth needed)
    const url = 'https://api.kite.trade/instruments';
    
    const response = await axios.get(url);
    const csvPath = path.join(__dirname, 'data', 'instruments.csv');
    
    fs.writeFileSync(csvPath, response.data);
    console.log(`✓ Instruments saved to: ${csvPath}`);
    console.log('You can now run your backtest without hitting rate limits!');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nAlternative: Download manually from:');
    console.log('https://api.kite.trade/instruments');
    console.log('Save it as: data/instruments.csv');
  }
}

downloadInstruments();