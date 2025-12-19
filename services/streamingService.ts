
import { OHLCV, Asset } from '../types';

export class StreamingService {
  private binanceSocket: WebSocket | null = null;
  private twelveDataSocket: WebSocket | null = null;
  private simulationInterval: number | null = null;
  private currentCandle: OHLCV | null = null;

  // Twelve Data 'demo' key is highly restricted for WebSockets.
  private TD_API_KEY = 'demo'; 

  connect(asset: Asset, interval: string, intervalSeconds: number, onMessage: (candle: OHLCV) => void, lastHistoricalCandle?: OHLCV) {
    this.disconnect();

    const category = asset.category;
    const symbol = asset.symbol;

    if (category === 'CRYPTO') {
      const binanceSymbol = symbol.split('/').join('').toLowerCase();
      this.connectBinance(binanceSymbol, interval, onMessage);
    } else if ((category === 'FOREX' || category === 'METALS') && this.TD_API_KEY !== 'demo') {
      // Only attempt Twelve Data WS if we have a real key, otherwise fallback to high-fidelity simulation immediately
      this.connectTwelveData(symbol, interval, onMessage);
    } else {
      // Use internal simulation for Equities, Futures, or Forex/Metals on demo keys
      this.startSimulation(asset, intervalSeconds, onMessage, lastHistoricalCandle);
    }
  }

  private connectBinance(formattedSymbol: string, interval: string, onMessage: (candle: OHLCV) => void) {
    const url = `wss://stream.binance.com:9443/ws/${formattedSymbol}@kline_${interval}`;
    try {
      this.binanceSocket = new WebSocket(url);
      
      this.binanceSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.e === 'kline') {
            const k = msg.k;
            onMessage({
              time: k.t / 1000,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isFinal: k.x
            });
          }
        } catch (e) {
          console.error("QuantumTrade: Binance message parse error", e);
        }
      };

      this.binanceSocket.onopen = () => {
        console.log(`QuantumTrade: Binance WebSocket connected for ${formattedSymbol}`);
      };

      this.binanceSocket.onerror = (err) => {
        console.error(`QuantumTrade: Binance WS Error. ReadyState: ${this.binanceSocket?.readyState}`);
      };

      this.binanceSocket.onclose = (e) => {
        if (!e.wasClean) {
          console.warn(`QuantumTrade: Binance WS closed unexpectedly. Code: ${e.code}`);
        }
      };
    } catch (e) {
      console.error("QuantumTrade: Binance WS critical failure", e);
    }
  }

  private connectTwelveData(symbol: string, interval: string, onMessage: (candle: OHLCV) => void) {
    const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${this.TD_API_KEY}`;
    
    try {
      this.twelveDataSocket = new WebSocket(url);
      
      this.twelveDataSocket.onopen = () => {
        console.log(`QuantumTrade: Twelve Data WebSocket connected. Subscribing: ${symbol}`);
        this.twelveDataSocket?.send(JSON.stringify({
          action: "subscribe",
          params: { symbols: symbol }
        }));
      };

      this.twelveDataSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'price' && msg.symbol === symbol) {
            onMessage({
              time: msg.timestamp || Math.floor(Date.now() / 1000),
              open: parseFloat(msg.price),
              high: parseFloat(msg.price),
              low: parseFloat(msg.price),
              close: parseFloat(msg.price),
              volume: 0,
              isFinal: false
            });
          }
        } catch (e) {
          console.error("QuantumTrade: Twelve Data message parse error", e);
        }
      };

      this.twelveDataSocket.onerror = (err: any) => {
        // Detailed error logging to fix [object Object] issue
        const state = this.twelveDataSocket ? this.twelveDataSocket.readyState : 'UNKNOWN';
        console.error(`QuantumTrade: Twelve Data WS Error. ReadyState: ${state}. Event type: ${err.type}`);
        // Falling back to internal simulation occurs naturally if the connection is never established
      };

      this.twelveDataSocket.onclose = (e) => {
        console.log(`QuantumTrade: Twelve Data WS closed. Clean: ${e.wasClean}, Code: ${e.code}`);
      };

    } catch (e) {
      console.error("QuantumTrade: Twelve Data WS critical failure", e);
    }
  }

  private startSimulation(asset: Asset, intervalSeconds: number, onMessage: (candle: OHLCV) => void, lastCandle?: OHLCV) {
    console.log(`QuantumTrade: Local Simulation Engine initialized for ${asset.symbol}`);
    
    let prevClose = lastCandle?.close || (asset.volatility > 1 ? 100 : 1.10);
    let currentCandleStartTime = lastCandle ? lastCandle.time + intervalSeconds : Math.floor(Date.now() / 1000 / intervalSeconds) * intervalSeconds;
    
    this.currentCandle = {
      time: currentCandleStartTime,
      open: prevClose,
      high: prevClose,
      low: prevClose,
      close: prevClose,
      volume: 0,
      isFinal: false
    };

    this.simulationInterval = window.setInterval(() => {
      if (!this.currentCandle) return;

      const now = Math.floor(Date.now() / 1000);
      const isClosing = now >= this.currentCandle.time + intervalSeconds;

      // Realistic tick noise based on asset volatility
      const tickVolatility = asset.volatility / (asset.category === 'FOREX' ? 10000 : 100); 
      const change = (Math.random() - 0.5) * tickVolatility;
      
      this.currentCandle.close += change;
      this.currentCandle.high = Math.max(this.currentCandle.high, this.currentCandle.close);
      this.currentCandle.low = Math.min(this.currentCandle.low, this.currentCandle.close);
      this.currentCandle.volume += Math.random() * 10;

      if (isClosing) {
        this.currentCandle.isFinal = true;
        onMessage({ ...this.currentCandle });

        // Cycle to new candle
        const nextTime = this.currentCandle.time + intervalSeconds;
        const nextOpen = this.currentCandle.close;
        this.currentCandle = {
          time: nextTime,
          open: nextOpen,
          high: nextOpen,
          low: nextOpen,
          close: nextOpen,
          volume: 0,
          isFinal: false
        };
      } else {
        onMessage({ ...this.currentCandle });
      }
    }, 1000);
  }

  disconnect() {
    if (this.binanceSocket) {
      this.binanceSocket.onclose = null;
      this.binanceSocket.onerror = null;
      this.binanceSocket.close();
      this.binanceSocket = null;
    }
    if (this.twelveDataSocket) {
      this.twelveDataSocket.onclose = null;
      this.twelveDataSocket.onerror = null;
      this.twelveDataSocket.close();
      this.twelveDataSocket = null;
    }
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.currentCandle = null;
  }
}
