
import { OHLCV, SMCZone, ZoneType } from '../types';

export class SMCEngine {
  static detectFVG(ohlcv: OHLCV[]): SMCZone[] {
    const zones: SMCZone[] = [];
    for (let i = 2; i < ohlcv.length; i++) {
      const prev2 = ohlcv[i - 2];
      const current = ohlcv[i];
      const prev1 = ohlcv[i-1];

      // Calculate Average Bar Size for context (High - Low)
      const avgBarSize = (
        (prev1.high - prev1.low) + 
        (current.high - current.low) + 
        (prev2.high - prev2.low)
      ) / 3;

      // Bullish FVG
      if (current.low > prev2.high) {
        const gapSize = current.low - prev2.high;
        // Strength Calculation: Ratio of gap size to average bar size. 
        // A gap equal to avg bar size gets a 5. Double size gets 10.
        const ratio = gapSize / (avgBarSize || 0.000001); 
        const strength = Math.min(10, Math.max(1, ratio * 5));

        zones.push({
          id: `fvg-bull-${i}`,
          type: ZoneType.FVG,
          top: current.low,
          bottom: prev2.high,
          startTime: ohlcv[i-1].time,
          isMitigated: false,
          strengthScore: strength,
          direction: 'BULLISH',
          equilibrium: (current.low + prev2.high) / 2
        });
      }

      // Bearish FVG
      if (current.high < prev2.low) {
        const gapSize = prev2.low - current.high;
        const ratio = gapSize / (avgBarSize || 0.000001);
        const strength = Math.min(10, Math.max(1, ratio * 5));

        zones.push({
          id: `fvg-bear-${i}`,
          type: ZoneType.FVG,
          top: prev2.low,
          bottom: current.high,
          startTime: ohlcv[i-1].time,
          isMitigated: false,
          strengthScore: strength,
          direction: 'BEARISH',
          equilibrium: (prev2.low + current.high) / 2
        });
      }
    }
    return zones;
  }

  static detectOrderBlocks(ohlcv: OHLCV[]): SMCZone[] {
    const zones: SMCZone[] = [];
    for (let i = 5; i < ohlcv.length; i++) {
      const current = ohlcv[i];
      const prev = ohlcv[i-1];
      const lookback = ohlcv.slice(i - 5, i);
      const recentHigh = Math.max(...lookback.map(c => c.high));
      const recentLow = Math.min(...lookback.map(c => c.low));

      // Bullish OB: Expansion up after a series of down candles or a strong base
      if (current.close > recentHigh && current.volume > prev.volume * 1.3) {
        let lastDownCandle = ohlcv[i-1];
        for (let j = i - 1; j > i - 5; j--) {
          if (ohlcv[j].close < ohlcv[j].open) { lastDownCandle = ohlcv[j]; break; }
        }
        
        const expansionSize = current.close - lastDownCandle.high;
        const strength = Math.min(10, (expansionSize / (lastDownCandle.high - lastDownCandle.low)) * 2);

        zones.push({
          id: `ob-bull-${i}`,
          type: ZoneType.OB,
          top: lastDownCandle.high,
          bottom: lastDownCandle.low,
          startTime: current.time,
          isMitigated: false,
          strengthScore: strength > 0 ? strength : 5.0,
          direction: 'BULLISH',
          equilibrium: (lastDownCandle.high + lastDownCandle.low) / 2
        });
      } else if (current.close < recentLow && current.volume > prev.volume * 1.3) {
        // Bearish OB
        let lastUpCandle = ohlcv[i-1];
        for (let j = i - 1; j > i - 5; j--) {
          if (ohlcv[j].close > ohlcv[j].open) { lastUpCandle = ohlcv[j]; break; }
        }

        const expansionSize = lastUpCandle.low - current.close;
        const strength = Math.min(10, (expansionSize / (lastUpCandle.high - lastUpCandle.low)) * 2);

        zones.push({
          id: `ob-bear-${i}`,
          type: ZoneType.OB,
          top: lastUpCandle.high,
          bottom: lastUpCandle.low,
          startTime: current.time,
          isMitigated: false,
          strengthScore: strength > 0 ? strength : 5.0,
          direction: 'BEARISH',
          equilibrium: (lastUpCandle.high + lastUpCandle.low) / 2
        });
      }
    }
    return zones;
  }

  static detectLiquiditySweeps(ohlcv: OHLCV[]): SMCZone[] {
    const zones: SMCZone[] = [];
    const lookback = 30;
    for (let i = lookback; i < ohlcv.length; i++) {
      const current = ohlcv[i];
      const window = ohlcv.slice(i - lookback, i);
      const localHigh = Math.max(...window.map(c => c.high));
      const localLow = Math.min(...window.map(c => c.low));
      const avgVol = window.reduce((acc, c) => acc + c.volume, 0) / lookback;

      // Bearish Sweep (Sweep of old high)
      if (current.high > localHigh && current.close < localHigh) {
         const sweepDepth = current.high - localHigh;
         const strength = Math.min(10, (current.volume / avgVol) * (sweepDepth / (current.high - current.low)) * 10);
         
         zones.push({
           id: `sweep-high-${i}`,
           type: ZoneType.LIQUIDITY_SWEEP,
           top: current.high,
           bottom: localHigh,
           startTime: current.time,
           isMitigated: false,
           strengthScore: strength || 7.0,
           direction: 'BEARISH',
           equilibrium: (current.high + localHigh) / 2
         });
      }
      // Bullish Sweep (Sweep of old low)
      if (current.low < localLow && current.close > localLow) {
         const sweepDepth = localLow - current.low;
         const strength = Math.min(10, (current.volume / avgVol) * (sweepDepth / (current.high - current.low)) * 10);

         zones.push({
           id: `sweep-low-${i}`,
           type: ZoneType.LIQUIDITY_SWEEP,
           top: localLow,
           bottom: current.low,
           startTime: current.time,
           isMitigated: false,
           strengthScore: strength || 7.0,
           direction: 'BULLISH',
           equilibrium: (localLow + current.low) / 2
         });
      }
    }
    return zones;
  }

  static checkMitigation(ohlcv: OHLCV[], zones: SMCZone[]): SMCZone[] {
    return zones.map(zone => {
      const futureData = ohlcv.filter(c => c.time > zone.startTime);
      // FVG mitigation is typically just touching the gap
      // OB mitigation is typically touching the mean threshold (equilibrium) or at least the top/bottom
      const mitigationCandle = futureData.find(c => {
        if (zone.direction === 'BULLISH') {
          return c.low <= zone.top;
        } else {
          return c.high >= zone.bottom;
        }
      });
      return {
        ...zone,
        isMitigated: !!mitigationCandle,
        endTime: mitigationCandle ? mitigationCandle.time : undefined
      };
    });
  }
}
