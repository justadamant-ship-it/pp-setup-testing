const TradingStrategy = require('./src/strategy');
const Backtester = require('./src/backtester');

// Generate mock data with guaranteed alerts
function generateMockDataWithAlerts() {
  const data = [];
  let price = 1000;
  let baseVolume = 1000000;
  
  for (let i = 0; i < 100; i++) {
    let priceChangePercent = (Math.random() - 0.5) * 2; // Normal small moves
    let volumeMultiplier = 1;
    
    // Create alert conditions every 20 days
    if (i === 25 || i === 50 || i === 75) {
      priceChangePercent = 7; // 7% spike
      volumeMultiplier = 2.5; // 2.5x volume
    }
    
    price = price * (1 + priceChangePercent / 100);
    
    const open = price * 0.99;
    const close = price;
    const high = price * 1.01;
    const low = price * 0.98;
    const volume = Math.floor(baseVolume * (0.8 + Math.random() * 0.4) * volumeMultiplier);
    
    const date = new Date(2024, 0, i + 1);
    
    data.push({
      date: date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume
    });
  }
  
  return data;
}

async function testStrategy() {
  console.log('=== Testing Strategy with Mock Data ===\n');
  
  const strategy = new TradingStrategy();
  const backtester = new Backtester(strategy);
  
  const mockData = generateMockDataWithAlerts();
  
  await backtester.runBacktest('TEST_STOCK', mockData);
  backtester.printSummary();
  await backtester.saveResultsToCSV();
  
  console.log('\n✓ Test completed! Check the CSV file in data/results/ folder');
}

testStrategy().catch(console.error);