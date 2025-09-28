const KiteConnect = require('kiteconnect').KiteConnect;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class KiteClient {
  constructor() {
    this.apiKey = process.env.KITE_API_KEY;
    this.apiSecret = process.env.KITE_API_SECRET;
    this.accessToken = process.env.KITE_ACCESS_TOKEN;
    
    this.kite = new KiteConnect({
      api_key: this.apiKey
    });
    
    if (this.accessToken && this.accessToken !== 'your_access_token_here') {
      this.kite.setAccessToken(this.accessToken);
    }

    // Cache instruments from local CSV
    this.instrumentsCache = null;
    this.lastAPICall = 0;
    this.minDelay = 600; // 600ms = ~1.6 requests/sec (safe for historical data)
  }

  /**
   * Add delay to respect rate limits
   */
  async rateLimitDelay() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastAPICall;
    
    if (timeSinceLastCall < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastAPICall = Date.now();
  }

  /**
   * Get historical data for a symbol
   */
  async getHistoricalData(instrument_token, from_date, to_date, interval = 'day') {
    try {
      await this.rateLimitDelay();
      
      const data = await this.kite.getHistoricalData(
        instrument_token,
        interval,
        from_date,
        to_date
      );
      
      return data || [];
    } catch (error) {
      if (error.message && error.message.includes('429')) {
        console.log('⚠ Rate limit hit, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        return await this.getHistoricalData(instrument_token, from_date, to_date, interval);
      }
      console.error(`Error fetching historical data:`, error.message);
      return [];
    }
  }

  /**
   * Parse CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * Load instruments from local CSV file
   */
  loadInstrumentsFromCSV(exchange = 'NSE') {
    try {
      const csvPath = path.join(__dirname, '..', 'data', 'instruments.csv');
      
      if (!fs.existsSync(csvPath)) {
        console.error('❌ instruments.csv not found!');
        console.log('Run: node downloadInstruments.js');
        return [];
      }

      console.log('Loading instruments from local CSV...');
      const csvData = fs.readFileSync(csvPath, 'utf8');
      const lines = csvData.split('\n');
      
      // CSV is tab-delimited, not comma-delimited
      const headers = lines[0].split('\t').map(h => h.trim());
      
      console.log(`Processing ${lines.length - 1} instruments...`);
      
      const instruments = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Split by tabs instead of commas
        const values = lines[i].split('\t').map(v => v.trim());
        const instrument = {};
        
        headers.forEach((header, index) => {
          instrument[header] = values[index] || '';
        });
        
        // Filter by exchange and only equity instruments
        const isEquity = instrument.instrument_type && instrument.instrument_type.trim() === 'EQ';
        const matchesExchange = (
          instrument.exchange === exchange || 
          instrument.segment === exchange ||
          instrument.segment === 'NS'
        );
        
        if (matchesExchange && isEquity) {
          instruments.push({
            instrument_token: parseInt(instrument.instrument_token),
            tradingsymbol: instrument.tradingsymbol,
            name: instrument.name || instrument.tradingsymbol,
            segment: exchange
          });
        }
      }
      
      console.log(`✓ Loaded ${instruments.length} ${exchange} equity instruments from CSV`);
      return instruments;
      
    } catch (error) {
      console.error('Error loading CSV:', error.message);
      return [];
    }
  }
  /**
   * Get list of instruments (from local CSV, cached)
   */
  async getInstruments(exchange = 'NSE') {
    if (this.instrumentsCache) {
      return this.instrumentsCache;
    }

    this.instrumentsCache = this.loadInstrumentsFromCSV(exchange);
    return this.instrumentsCache;
  }

  /**
   * Find instrument token by symbol
   */
  async getInstrumentToken(symbol, exchange = 'NSE') {
    try {
      const instruments = await this.getInstruments(exchange);
      const instrument = instruments.find(
        inst => inst.tradingsymbol === symbol
      );
      
      if (instrument) {
        return {
          instrument_token: instrument.instrument_token,
          tradingsymbol: instrument.tradingsymbol,
          name: instrument.name
        };
      }
      
      console.error(`Instrument ${symbol} not found in CSV`);
      return null;
    } catch (error) {
      console.error('Error finding instrument:', error.message);
      return null;
    }
  }
}

module.exports = KiteClient;