const KiteClient = require('./kiteClient');
const TradingStrategy = require('./strategy');
const Backtester = require('./backtester');
require('dotenv').config();

// Common NSE stock symbols
const STOCK_SYMBOLS = [
'BAJAJHCARE'
];

async function main() {
  console.log('=== Stock Alert Backtesting System (Kite API) ===\n');
 // Add startup delay to avoid rate limits
  const waitMinutes = 0; // Change this to 10 if you hit rate limits
  if (waitMinutes > 0) {
    console.log(`⏳ Waiting ${waitMinutes} minutes for rate limit to clear...`);
    await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
    console.log('✓ Ready to start\n');
  }
  const kiteClient = new KiteClient();
  const strategy = new TradingStrategy();
  const backtester = new Backtester(strategy);

  const startDate = process.env.START_DATE || '2024-01-01';
  const endDate = process.env.END_DATE || '2024-09-28';

  console.log(`Date range: ${startDate} to ${endDate}\n`);
  console.log('Stocks to test:', STOCK_SYMBOLS.join(', '));
  console.log('\n');

  // Process each stock
  for (const symbol of STOCK_SYMBOLS) {
    try {
      console.log(`\nFetching instrument token for ${symbol}...`);
      
      const instrument = await kiteClient.getInstrumentToken(symbol);
      
      if (!instrument) {
        console.log(`⚠ Instrument not found for ${symbol}`);
        continue;
      }

      console.log(`✓ Found: ${instrument.name} (Token: ${instrument.instrument_token})`);
      console.log(`Fetching historical data...`);
      
      const historicalData = await kiteClient.getHistoricalData(
        instrument.instrument_token,
        startDate,
        endDate
      );

      if (historicalData.length === 0) {
        console.log(`⚠ No data found for ${symbol}`);
        continue;
      }

      console.log(`✓ Received ${historicalData.length} data points`);

      // Run backtest
      await backtester.runBacktest(symbol, historicalData);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error processing ${symbol}:`, error.message);
    }
  }

  // Print summary and save results
  backtester.printSummary();
  await backtester.saveResultsToCSV();
  
  console.log('\n✓ Backtesting completed!');
}

// Run the application
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };