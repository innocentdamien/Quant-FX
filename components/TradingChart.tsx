
import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, SeriesMarker, TickMarkType } from 'lightweight-charts';
import { OHLCV, SMCZone, TradeLog, AIValidationResult, ZoneType } from '../types';
import { COLORS } from '../constants';
import { BrainCircuit, MousePointer2, TrendingUp, Minus, Percent, Trash2, Crosshair } from 'lucide-react';

interface TradingChartProps {
  data: OHLCV[];
  zones: SMCZone[];
  activeTrade?: TradeLog | null;
  currentAnalysis?: AIValidationResult | null;
  timezone: string;
  liveUpdate?: OHLCV | null;
  className?: string; // Allow external styling overrides
}

type ToolType = 'cursor' | 'trendline' | 'horizontal' | 'fib';

interface DrawingPoint {
  time: number;
  price: number;
}

interface Drawing {
  id: string;
  type: ToolType;
  points: DrawingPoint[];
}

const TradingChart: React.FC<TradingChartProps> = ({ data, zones, activeTrade, currentAnalysis, timezone, liveUpdate, className }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const entryLineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const tpLineRef = useRef<any>(null);

  const [selectedTool, setSelectedTool] = useState<ToolType>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);
  const [, setChartVersion] = useState(0); // Force re-render for SVG sync

  // Force update wrapper
  const forceUpdate = () => setChartVersion(v => v + 1);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: COLORS.CHART_BG },
          textColor: COLORS.TEXT,
          fontSize: 11,
        },
        grid: {
          vertLines: { color: COLORS.CHART_GRID, style: 2 },
          horzLines: { color: COLORS.CHART_GRID, style: 2 },
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        timeScale: {
          borderColor: COLORS.CHART_GRID,
          timeVisible: true,
          secondsVisible: true,
          barSpacing: 8,
          tickMarkFormatter: (time: any, tickMarkType: TickMarkType, locale: string) => {
            const date = new Date((time as number) * 1000);
            return new Intl.DateTimeFormat(locale, {
              timeZone: timezone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).format(date);
          },
        },
        crosshair: {
            mode: 1 // Normal
        }
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: COLORS.BULL_CANDLE,
        downColor: COLORS.BEAR_CANDLE,
        borderVisible: false,
        wickUpColor: COLORS.BULL_CANDLE,
        wickDownColor: COLORS.BEAR_CANDLE,
      });

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;

      // Subscribe to time scale changes to sync SVG drawings
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => forceUpdate());
      chart.timeScale().subscribeVisibleTimeRangeChange(() => forceUpdate());

      // Initial Resize to fit container
      const resizeObserver = new ResizeObserver(() => {
          if (chartRef.current && chartContainerRef.current) {
              chartRef.current.applyOptions({ 
                  width: chartContainerRef.current.clientWidth,
                  height: chartContainerRef.current.clientHeight
              });
              forceUpdate();
          }
      });
      resizeObserver.observe(chartContainerRef.current);

      return () => resizeObserver.disconnect();

    } catch (err) {
      console.error('Chart init failed', err);
    }

    return () => {
      if (chartRef.current) {
         chartRef.current.remove();
         chartRef.current = null;
      }
    };
  }, [timezone]);

  // Update Data
  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data.map(d => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));
    }
  }, [data]);

  // Live Update
  useEffect(() => {
    if (candlestickSeriesRef.current && liveUpdate) {
      candlestickSeriesRef.current.update({
        time: liveUpdate.time as Time,
        open: liveUpdate.open,
        high: liveUpdate.high,
        low: liveUpdate.low,
        close: liveUpdate.close,
      });
      forceUpdate(); // Ensure drawings stay synced with new live bar
    }
  }, [liveUpdate]);

  // Trade Lines
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;
    const series = candlestickSeriesRef.current;
    if (entryLineRef.current) series.removePriceLine(entryLineRef.current);
    if (slLineRef.current) series.removePriceLine(slLineRef.current);
    if (tpLineRef.current) series.removePriceLine(tpLineRef.current);

    if (activeTrade) {
      entryLineRef.current = series.createPriceLine({ price: activeTrade.entryPrice, color: '#6366f1', title: 'ENTRY' });
      slLineRef.current = series.createPriceLine({ price: activeTrade.sl, color: '#f43f5e', title: 'STOP' });
      tpLineRef.current = series.createPriceLine({ price: activeTrade.tp, color: '#10b981', title: 'TARGET' });
    }
  }, [activeTrade]);

  // SMC Zones (Markers - excluding FVG)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !zones.length) return;
    
    // Filter out FVGs, we will draw them as boxes
    const markerZones = zones.filter(z => z.type !== ZoneType.FVG);
    
    const markers: SeriesMarker<Time>[] = markerZones.map(zone => ({
      time: zone.startTime as Time,
      position: zone.direction === 'BULLISH' ? 'belowBar' : 'aboveBar',
      color: zone.direction === 'BULLISH' ? '#22c55e' : '#ef4444',
      shape: 'circle',
      text: zone.type.substring(0, 3)
    }));
    // Use type assertion to bypass incomplete type definitions in some versions
    (candlestickSeriesRef.current as any).setMarkers(markers);
  }, [zones]);

  // Drawing Logic
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (selectedTool === 'cursor') return;
    
    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect || !chartRef.current || !candlestickSeriesRef.current) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const time = chartRef.current.timeScale().coordinateToTime(x) as number;
    const price = candlestickSeriesRef.current.coordinateToPrice(y) as number;
    
    if (time === null || price === null) return;
    
    const point = { time, price };

    if (selectedTool === 'horizontal') {
        const newDrawing: Drawing = { id: Date.now().toString(), type: 'horizontal', points: [point] };
        setDrawings([...drawings, newDrawing]);
        setSelectedTool('cursor');
    } else {
        if (!currentDrawing) {
            // Start drawing
            setCurrentDrawing({ id: 'temp', type: selectedTool, points: [point] });
        } else {
            // Finish drawing
            const newDrawing: Drawing = { 
                ...currentDrawing, 
                id: Date.now().toString(), 
                points: [currentDrawing.points[0], point] 
            };
            setDrawings([...drawings, newDrawing]);
            setCurrentDrawing(null);
            setSelectedTool('cursor');
        }
    }
  };

  const handleOverlayMove = (e: React.MouseEvent) => {
    if (!currentDrawing || selectedTool === 'horizontal') return;
    
    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect || !chartRef.current || !candlestickSeriesRef.current) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const time = chartRef.current.timeScale().coordinateToTime(x) as number;
    const price = candlestickSeriesRef.current.coordinateToPrice(y) as number;
    
    if (time !== null && price !== null) {
        // Update the temporary end point
        setCurrentDrawing({ 
            ...currentDrawing, 
            points: [currentDrawing.points[0], { time, price }] 
        });
    }
  };

  // SVG Rendering Helper
  const getCoordinates = (point: DrawingPoint) => {
      if (!chartRef.current || !candlestickSeriesRef.current) return null;
      const x = chartRef.current.timeScale().timeToCoordinate(point.time as Time);
      const y = candlestickSeriesRef.current.priceToCoordinate(point.price);
      return { x: x ?? -100, y: y ?? -100 };
  };

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden border border-gray-800 bg-[#0c0e12] ${className || ''}`}>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 bg-gray-900/90 border border-gray-700/50 p-1.5 rounded-xl backdrop-blur-sm shadow-xl">
        {[
          { id: 'cursor', icon: MousePointer2, label: 'Cursor' },
          { id: 'trendline', icon: TrendingUp, label: 'Trendline' },
          { id: 'horizontal', icon: Minus, label: 'Horizontal Line' },
          { id: 'fib', icon: Percent, label: 'Fibonacci' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setSelectedTool(t.id as ToolType); setCurrentDrawing(null); }}
            className={`p-2 rounded-lg transition-all ${selectedTool === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-gray-800'}`}
            title={t.label}
          >
            <t.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="h-px bg-gray-700 my-1" />
        <button
          onClick={() => setDrawings([])}
          className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all"
          title="Clear All"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Drawing Overlay (Input Capture) */}
      {selectedTool !== 'cursor' && (
         <div 
           className="absolute inset-0 z-20 cursor-crosshair"
           onClick={handleOverlayClick}
           onMouseMove={handleOverlayMove}
         />
      )}

      {/* SVG Layer */}
      <svg className="absolute inset-0 z-10 pointer-events-none w-full h-full overflow-visible">
         <defs>
           <linearGradient id="bullishGradient" x1="0" y1="0" x2="1" y2="0">
             <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
             <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
           </linearGradient>
           <linearGradient id="bearishGradient" x1="0" y1="0" x2="1" y2="0">
             <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
             <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
           </linearGradient>
         </defs>

         {/* FVG Zones Visualization */}
         {zones.filter(z => z.type === ZoneType.FVG).map(zone => {
             if (!chartRef.current || !candlestickSeriesRef.current) return null;

             const startX = chartRef.current.timeScale().timeToCoordinate(zone.startTime as Time);
             const y1 = candlestickSeriesRef.current.priceToCoordinate(zone.top);
             const y2 = candlestickSeriesRef.current.priceToCoordinate(zone.bottom);

             if (startX === null || y1 === null || y2 === null) return null;

             let endX: number | null = null;
             if (zone.isMitigated && zone.endTime) {
                 endX = chartRef.current.timeScale().timeToCoordinate(zone.endTime as Time);
             } else {
                 // Extend to the latest data point if unmitigated
                 const lastData = data[data.length - 1];
                 if (lastData) {
                    endX = chartRef.current.timeScale().timeToCoordinate(lastData.time as Time);
                 }
             }

             // If coordinates are invalid or off-screen, render safely or skip
             // We use a safe width if endX is null or same as startX
             const safeEndX = endX ?? (startX + 50); 
             const width = Math.max(safeEndX - startX, 10);
             const height = Math.abs(y2 - y1);
             const y = Math.min(y1, y2);
             
             // Dynamic styling based on Strength
             const baseColor = zone.direction === 'BULLISH' ? '#22c55e' : '#ef4444';
             const gradientUrl = zone.direction === 'BULLISH' ? 'url(#bullishGradient)' : 'url(#bearishGradient)';
             
             // Strength 0-10, maps to opacity multiplier roughly 0.2 to 0.6
             const opacity = 0.2 + (zone.strengthScore / 25); 
             const strokeOpacity = 0.4 + (zone.strengthScore / 20);
             
             // Mitigated styling overrides
             const fill = zone.isMitigated ? baseColor : gradientUrl;
             const finalFillOpacity = zone.isMitigated ? 0.05 : opacity;
             const strokeDash = zone.isMitigated ? "4,4" : "none";

             return (
                 <g key={zone.id}>
                     <rect 
                        x={startX} 
                        y={y} 
                        width={width} 
                        height={Math.max(height, 2)} 
                        fill={fill}
                        fillOpacity={finalFillOpacity}
                        stroke={baseColor}
                        strokeWidth={zone.isMitigated ? 1 : 1 + (zone.strengthScore > 7 ? 1 : 0)} // Thicker stroke for strong zones
                        strokeDasharray={strokeDash}
                        strokeOpacity={zone.isMitigated ? 0.2 : strokeOpacity}
                     />
                     
                     {/* Mitigation Overlay: Dashed Cross Line */}
                     {zone.isMitigated && (
                        <path 
                           d={`M ${startX} ${y + height/2} L ${safeEndX} ${y + height/2}`} 
                           stroke={baseColor} 
                           strokeWidth="1" 
                           strokeDasharray="2,2" 
                           opacity="0.5"
                        />
                     )}
                     
                     {/* Checkmark indicator at the end if mitigated */}
                     {zone.isMitigated && (
                        <path 
                           d={`M ${safeEndX - 8} ${y + height/2 - 3} L ${safeEndX - 4} ${y + height/2 + 3} L ${safeEndX + 2} ${y + height/2 - 6}`}
                           stroke={baseColor}
                           strokeWidth="1.5"
                           fill="none"
                           opacity="0.6"
                        />
                     )}

                     {!zone.isMitigated && (
                       <text x={startX + 4} y={y - 4} fill={baseColor} fontSize="9" fontWeight="bold" opacity="0.9">FVG ({zone.strengthScore.toFixed(1)})</text>
                     )}
                 </g>
             );
         })}

         {/* User Drawings */}
         {[...drawings, ...(currentDrawing ? [currentDrawing] : [])].map((d) => {
            const start = getCoordinates(d.points[0]);
            // For incomplete drawings or single points
            const end = d.points.length > 1 ? getCoordinates(d.points[1]) : start;
            
            if (!start || !end) return null;

            if (d.type === 'horizontal') {
                return <line key={d.id} x1="0" y1={start.y} x2="100%" y2={start.y} stroke="#38bdf8" strokeWidth="2" strokeDasharray="5,5" opacity="0.8" />;
            }
            if (d.type === 'trendline') {
                return <line key={d.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#facc15" strokeWidth="2" />;
            }
            if (d.type === 'fib') {
                const dy = end.y - start.y;
                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                // Limit Fib width to the drawing extent horizontally
                const width = end.x - start.x;
                
                return (
                    <g key={d.id}>
                        {/* Diagonal Reference */}
                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                        {levels.map(l => {
                            const y = start.y + dy * l;
                            return (
                                <g key={l}>
                                    <line x1={start.x} y1={y} x2={end.x} y2={y} stroke={`rgba(99, 102, 241, ${l === 0 || l === 1 ? 0.8 : 0.4})`} strokeWidth="1" />
                                    {/* Text Label */}
                                    <text x={end.x + 5} y={y + 3} fill="#a5b4fc" fontSize="9" fontFamily="monospace">{l.toFixed(3)}</text>
                                </g>
                            );
                        })}
                    </g>
                );
            }
            return null;
         })}
      </svg>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* AI Badge */}
      {currentAnalysis && (
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-indigo-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-indigo-500/30 flex items-center gap-3 shadow-xl">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{currentAnalysis.confidence} Confidence</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingChart;
