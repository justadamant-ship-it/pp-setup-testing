require('dotenv').config();

class TradingStrategy {
  constructor() {
    this.priceSpike = parseFloat(process.env.PRICE_SPIKE_PERCENT) || 6;
    this.volumeMultiplier = parseFloat(process.env.VOLUME_MULTIPLIER) || 2;
    this.volumeSMAPeriod = parseInt(process.env.VOLUME_SMA_PERIOD) || 20;
    this.entryPremium = parseFloat(process.env.ENTRY_PREMIUM_PERCENT) || 1;
    this.maxEntryDays = parseInt(process.env.MAX_ENTRY_DAYS) || 4;
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(data, period) {
    if (data.length < period) return null;
    const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
    return sum / period;
  }

  /**
   * Check if Day 0 conditions are met
   */
  checkDay0Conditions(historicalData, index) {
    if (index < this.volumeSMAPeriod) {
      return { isAlert: false };
    }

    const currentDay = historicalData[index];
    const previousDay = historicalData[index - 1];

    // Calculate price change percentage
    const priceChange = ((currentDay.close - previousDay.close) / previousDay.close) * 100;

    // Calculate volume SMA
    const volumes = historicalData.slice(index - this.volumeSMAPeriod, index).map(d => d.volume);
    const volumeSMA = this.calculateSMA(volumes, this.volumeSMAPeriod);

    // Check conditions
    const isPriceConditionMet = priceChange >= this.priceSpike;
    const isVolumeConditionMet = currentDay.volume >= (volumeSMA * this.volumeMultiplier);

    if (isPriceConditionMet && isVolumeConditionMet) {
      return {
        isAlert: true,
        day0Index: index,
        day0Date: currentDay.date,
        day0Close: currentDay.close,
        priceChange: priceChange.toFixed(2),
        volume: currentDay.volume,
        volumeSMA: volumeSMA,
        volumeRatio: (currentDay.volume / volumeSMA).toFixed(2)
      };
    }

    return { isAlert: false };
  }

  /**
   * Calculate entry prices for up to 4 days
   */
  calculateEntryLevels(alert, historicalData) {
    const day0Index = alert.day0Index;
    const day0Close = alert.day0Close;
    
    const entries = [];
    
    // Day 1 Entry: 1% above D0 close
    if (day0Index + 1 < historicalData.length) {
      const day1 = historicalData[day0Index + 1];
      entries.push({
        day: 1,
        date: day1.date,
        entryPrice: day0Close * (1 + this.entryPremium / 100),
        high: day1.high,
        low: day1.low,
        close: day1.close,
        previousHigh: day0Close
      });
    }

    // Day 2 Entry: 1% above D1 high
    if (day0Index + 2 < historicalData.length && entries.length > 0) {
      const day2 = historicalData[day0Index + 2];
      entries.push({
        day: 2,
        date: day2.date,
        entryPrice: entries[0].high * (1 + this.entryPremium / 100),
        high: day2.high,
        low: day2.low,
        close: day2.close,
        previousHigh: entries[0].high
      });
    }

    // Day 3 Entry: 1% above D2 high
    if (day0Index + 3 < historicalData.length && entries.length > 1) {
      const day3 = historicalData[day0Index + 3];
      entries.push({
        day: 3,
        date: day3.date,
        entryPrice: entries[1].high * (1 + this.entryPremium / 100),
        high: day3.high,
        low: day3.low,
        close: day3.close,
        previousHigh: entries[1].high
      });
    }

    // Day 4 Entry: 1% above D3 high
    if (day0Index + 4 < historicalData.length && entries.length > 2) {
      const day4 = historicalData[day0Index + 4];
      entries.push({
        day: 4,
        date: day4.date,
        entryPrice: entries[2].high * (1 + this.entryPremium / 100),
        high: day4.high,
        low: day4.low,
        close: day4.close,
        previousHigh: entries[2].high
      });
    }

    return {
      stopLoss: day0Close,
      entries: entries
    };
  }

  /**
   * Find if and when entry was triggered
   */
  findEntryExecution(entries) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.high >= entry.entryPrice) {
        return {
          executed: true,
          entryDay: entry.day,
          entryDate: entry.date,
          entryPrice: entry.entryPrice,
          actualHigh: entry.high
        };
      }
    }

    return {
      executed: false,
      reason: 'Entry price not reached in 4 days'
    };
  }

calculateExit(entry, stopLoss, historicalData, entryIndex) {
    if (entryIndex + 1 < historicalData.length) {
      const nextDay = historicalData[entryIndex + 1];
      
      // Check if stop loss hit
      if (nextDay.low <= stopLoss) {
        return {
          exitDate: nextDay.date,
          exitPrice: stopLoss,
          exitReason: 'Stop Loss Hit',
          pnlPercent: ((stopLoss - entry.entryPrice) / entry.entryPrice) * 100
        };
      }
      
      // Exit at close
      return {
        exitDate: nextDay.date,
        exitPrice: nextDay.close,
        exitReason: 'Next Day Close',
        pnlPercent: ((nextDay.close - entry.entryPrice) / entry.entryPrice) * 100
      };
    }

    return null;
  }
}

module.exports = TradingStrategy;