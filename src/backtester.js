const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

class Backtester {
  constructor(strategy) {
    this.strategy = strategy;
    this.trades = [];
  }

/**
   * Format historical data from Kite API response
   */
  formatHistoricalData(rawData) {
    return rawData.map(candle => {
      // Convert to IST and format as YYYY-MM-DD
      const date = new Date(candle.date);
      const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000)); // Add IST offset
      
      return {
        date: istDate.toISOString().split('T')[0],
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume)
      };
    });
  }
  /**
   * Run backtest on historical data
   */
  runBacktest(symbol, historicalData) {
    const formattedData = this.formatHistoricalData(historicalData);
    const alerts = [];
    const trades = [];

    console.log(`\n=== Backtesting ${symbol} ===`);
    console.log(`Total candles: ${formattedData.length}`);

    // Scan for Day 0 alerts
    for (let i = 0; i < formattedData.length - 4; i++) {
      const alert = this.strategy.checkDay0Conditions(formattedData, i);
      
      if (alert.isAlert) {
        console.log(`\n✓ Alert found on ${alert.day0Date}`);
        console.log(`  Price change: ${alert.priceChange}%`);
        console.log(`  Volume ratio: ${alert.volumeRatio}x`);
        
        // Calculate entry levels
        const entryLevels = this.strategy.calculateEntryLevels(alert, formattedData);
        
        // Check if entry was executed
        const execution = this.strategy.findEntryExecution(entryLevels.entries);
        
        if (execution.executed) {
          console.log(`  ✓ Entry executed on Day ${execution.entryDay} (${execution.entryDate})`);
          console.log(`    Entry Price: ₹${execution.entryPrice.toFixed(2)}`);
          
          // Calculate SL: Lower of previous day low or 2% below entry
          const entryDayIndex = alert.day0Index + execution.entryDay;
          const previousDayIndex = entryDayIndex - 1;
          const previousDayLow = formattedData[previousDayIndex].low;
          const twoPercentSL = execution.entryPrice * 0.98;
          const finalSL = Math.max(previousDayLow, twoPercentSL);
          
          console.log(`    Previous Day Low: ₹${previousDayLow.toFixed(2)}`);
          console.log(`    2% SL: ₹${twoPercentSL.toFixed(2)}`);
          console.log(`    Final SL: ₹${finalSL.toFixed(2)}`);
          
          // Calculate exit
          const exit = this.strategy.calculateExit(
            execution,
            finalSL,
            formattedData,
            entryDayIndex
          );
          
          if (exit) {
            console.log(`    Exit: ${exit.exitReason} on ${exit.exitDate}`);
            console.log(`    Exit Price: ₹${exit.exitPrice.toFixed(2)}`);
            console.log(`    P&L: ${exit.pnlPercent.toFixed(2)}%`);
            
            trades.push({
              symbol: symbol,
              alertDate: alert.day0Date,
              day0Close: alert.day0Close,
              priceChange: alert.priceChange,
              volumeRatio: alert.volumeRatio,
              entryDay: execution.entryDay,
              entryDate: execution.entryDate,
              entryPrice: execution.entryPrice,
              stopLoss: finalSL,
              exitDate: exit.exitDate,
              exitPrice: exit.exitPrice,
              exitReason: exit.exitReason,
              pnlPercent: exit.pnlPercent.toFixed(2)
            });
          }
        } else {
          console.log(`  ✗ Entry not executed: ${execution.reason}`);
          
          trades.push({
            symbol: symbol,
            alertDate: alert.day0Date,
            day0Close: alert.day0Close,
            priceChange: alert.priceChange,
            volumeRatio: alert.volumeRatio,
            entryDay: 'N/A',
            entryDate: 'N/A',
            entryPrice: 'N/A',
            stopLoss: entryLevels.stopLoss,
            exitDate: 'N/A',
            exitPrice: 'N/A',
            exitReason: execution.reason,
            pnlPercent: 0
          });
        }
        
        alerts.push(alert);
        
        // Skip next few days to avoid overlapping signals
        i += 5;
      }
    }

    console.log(`\nTotal alerts: ${alerts.length}`);
    console.log(`Executed trades: ${trades.filter(t => t.entryDay !== 'N/A').length}`);
    
    this.trades.push(...trades);
    return trades;
  }

  /**
   * Calculate statistics
   */
  calculateStats() {
    const executedTrades = this.trades.filter(t => t.entryDay !== 'N/A');
    
    if (executedTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        totalPnL: 0
      };
    }

    const winners = executedTrades.filter(t => parseFloat(t.pnlPercent) > 0);
    const losers = executedTrades.filter(t => parseFloat(t.pnlPercent) < 0);
    
    const totalPnL = executedTrades.reduce((sum, t) => sum + parseFloat(t.pnlPercent), 0);
    const avgProfit = winners.length > 0 
      ? winners.reduce((sum, t) => sum + parseFloat(t.pnlPercent), 0) / winners.length 
      : 0;
    const avgLoss = losers.length > 0
      ? losers.reduce((sum, t) => sum + parseFloat(t.pnlPercent), 0) / losers.length
      : 0;

    return {
      totalTrades: executedTrades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      winRate: ((winners.length / executedTrades.length) * 100).toFixed(2),
      avgProfit: avgProfit.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      totalPnL: totalPnL.toFixed(2)
    };
  }

  /**
   * Save results to CSV
   */
  async saveResultsToCSV() {
    const resultsDir = path.join(__dirname, '..', 'data', 'results');
    
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = path.join(resultsDir, `backtest_results_${timestamp}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: [
        { id: 'symbol', title: 'Symbol' },
        { id: 'alertDate', title: 'Alert Date (D0)' },
        { id: 'day0Close', title: 'D0 Close' },
        { id: 'priceChange', title: 'Price Change %' },
        { id: 'volumeRatio', title: 'Volume Ratio' },
        { id: 'entryDay', title: 'Entry Day' },
        { id: 'entryDate', title: 'Entry Date' },
        { id: 'entryPrice', title: 'Entry Price' },
        { id: 'stopLoss', title: 'Stop Loss' },
        { id: 'exitDate', title: 'Exit Date' },
        { id: 'exitPrice', title: 'Exit Price' },
        { id: 'exitReason', title: 'Exit Reason' },
        { id: 'pnlPercent', title: 'P&L %' }
      ]
    });

    await csvWriter.writeRecords(this.trades);
    console.log(`\n✓ Results saved to: ${filename}`);
    return filename;
  }

  /**
   * Print summary
   */
  printSummary() {
    const stats = this.calculateStats();
    
    console.log('\n' + '='.repeat(50));
    console.log('BACKTEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Alerts: ${this.trades.length}`);
    console.log(`Executed Trades: ${stats.totalTrades}`);
    console.log(`Winning Trades: ${stats.winningTrades}`);
    console.log(`Losing Trades: ${stats.losingTrades}`);
    console.log(`Win Rate: ${stats.winRate}%`);
    console.log(`Average Profit: ${stats.avgProfit}%`);
    console.log(`Average Loss: ${stats.avgLoss}%`);
    console.log(`Total P&L: ${stats.totalPnL}%`);
    console.log('='.repeat(50));
  }
}

module.exports = Backtester;