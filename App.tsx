
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, ShieldAlert, BookOpen, Activity, Terminal, 
  BrainCircuit, TrendingUp, ChevronRight, Loader2, X, Target, 
  Globe, Layers, Zap, Info, MessageSquareCode, Clock, MousePointer2,
  TrendingDown, Search, ArrowUpRight, Filter, Newspaper, Watch, RefreshCw,
  Square, Columns, Rows, LayoutGrid
} from 'lucide-react';
import TradingChart from './components/TradingChart';
import NewsFeed from './components/NewsFeed';
import { StreamingService } from './services/streamingService';
import { SMCEngine } from './services/smcEngine';
import { GeminiAIService } from './services/geminiService';
import { generateMockData } from './services/mockData';
import { OHLCV, SMCZone, TradeLog, AIValidationResult, ViewState, Asset, NewsItem } from './types';
import { ASSETS, TIMEFRAMES, DEFAULT_TIMEFRAME, TIMEZONES, DEFAULT_TIMEZONE } from './constants';

type ChartLayout = 'single' | 'vertical' | 'horizontal' | 'quad';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [currentTimeframe, setCurrentTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [selectedTimezone, setSelectedTimezone] = useState(DEFAULT_TIMEZONE);
  const [layout, setLayout] = useState<ChartLayout>('single');
  
  const [data, setData] = useState<OHLCV[]>([]);
  const [liveTick, setLiveTick] = useState<OHLCV | null>(null);
  const [zones, setZones] = useState<SMCZone[]>([]);
  const [journal, setJournal] = useState<TradeLog[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, AIValidationResult>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<SMCZone | null>(null);
  const [activeTrade, setActiveTrade] = useState<TradeLog | null>(null);
  
  const streamRef = useRef<StreamingService>(new StreamingService());
  const dataRef = useRef<OHLCV[]>([]);

  const runAnalysis = useCallback((ohlcv: OHLCV[]) => {
    const fvgs = SMCEngine.detectFVG(ohlcv);
    const obs = SMCEngine.detectOrderBlocks(ohlcv);
    const sweeps = SMCEngine.detectLiquiditySweeps(ohlcv);
    const allZones = SMCEngine.checkMitigation(ohlcv, [...fvgs, ...obs, ...sweeps]);
    setZones(allZones);
  }, []);

  const handleLiveTick = useCallback((candle: OHLCV) => {
    setLiveTick(candle);
    const lastIndex = dataRef.current.findIndex(c => c.time === candle.time);
    if (lastIndex !== -1) {
      dataRef.current[lastIndex] = candle;
    } else {
      dataRef.current = [...dataRef.current, candle].slice(-500);
    }
    if (candle.isFinal || !liveTick) { // Update data state on close or first tick
      const updatedData = [...dataRef.current];
      setData(updatedData);
      runAnalysis(updatedData);
    }
  }, [runAnalysis, zones, liveTick]);

  const initStream = useCallback(async () => {
    setIsLoading(true);
    streamRef.current.disconnect();

    try {
      const symbol = selectedAsset.symbol;
      const interval = currentTimeframe.value;
      let historicalData: OHLCV[] = [];

      if (selectedAsset.category === 'CRYPTO') {
        const binanceSymbol = symbol.split('/').join('').toUpperCase();
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=400`);
        if (!res.ok) throw new Error("Binance API Error");
        const history = await res.json();
        historicalData = history.map((k: any) => ({
          time: k[0] / 1000,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        }));
      } else if (selectedAsset.category === 'FOREX' || selectedAsset.category === 'METALS') {
        // Twelve Data History
        const tdInterval = interval.includes('m') ? `${interval.replace('m', '')}min` : 
                           interval.includes('h') ? `${interval.replace('h', '')}h` : '1day';
        
        const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${tdInterval}&outputsize=400&apikey=demo`);
        const json = await res.json();
        
        if (json.status === 'ok') {
          historicalData = json.values.map((v: any) => ({
            time: Math.floor(new Date(v.datetime).getTime() / 1000),
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseFloat(v.volume || '0')
          })).reverse();
        } else {
          throw new Error("Twelve Data Error: " + (json.message || "Invalid Status"));
        }
      } else {
        historicalData = generateMockData(400, selectedAsset.volatility, currentTimeframe.seconds);
      }

      dataRef.current = historicalData;
      setData(historicalData);
      runAnalysis(historicalData);
      
      streamRef.current.connect(selectedAsset, interval, currentTimeframe.seconds, handleLiveTick, historicalData[historicalData.length - 1]);
      fetchAssetIntelligence(selectedAsset.symbol);
    } catch (err) {
      console.warn("QuantumTrade: Switching to simulated buffer due to API restrictions.");
      const fallback = generateMockData(400, selectedAsset.volatility, currentTimeframe.seconds);
      dataRef.current = fallback;
      setData(fallback);
      runAnalysis(fallback);
      streamRef.current.connect(selectedAsset, currentTimeframe.value, currentTimeframe.seconds, handleLiveTick, fallback[fallback.length - 1]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAsset, currentTimeframe, handleLiveTick, runAnalysis]);

  useEffect(() => {
    initStream();
    return () => streamRef.current.disconnect();
  }, [initStream]);

  const runAIValidation = async (zone: SMCZone) => {
    setSelectedZone(zone);
    setAiAnalysis(prev => ({ ...prev, [zone.id]: { score: 0, reasoning: "Booting Neural Core...", confidence: "LOW", suggestion: "Calculating..." } }));
    const ai = new GeminiAIService();
    const result = await ai.validateSetup(zone, dataRef.current);
    setAiAnalysis(prev => ({ ...prev, [zone.id]: result }));
  };

  const fetchAssetIntelligence = async (symbol: string) => {
    setIsNewsLoading(true);
    const ai = new GeminiAIService();
    const briefing = await ai.fetchNews(symbol);
    setNews(briefing);
    setIsNewsLoading(false);
  };

  const getLayoutClasses = () => {
    switch (layout) {
      case 'vertical': return 'grid-cols-2 grid-rows-1';
      case 'horizontal': return 'grid-cols-1 grid-rows-2';
      case 'quad': return 'grid-cols-2 grid-rows-2';
      default: return 'grid-cols-1 grid-rows-1';
    }
  };

  const getChartCount = () => {
    switch (layout) {
      case 'vertical': return 2;
      case 'horizontal': return 2;
      case 'quad': return 4;
      default: return 1;
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-200 flex flex-col md:flex-row overflow-hidden font-['Inter']">
      <aside className="w-full md:w-64 border-r border-gray-800 flex flex-col p-6 bg-[#0a0c10] z-40 relative">
        <div className="flex items-center gap-4 mb-12 px-2 cursor-pointer group" onClick={() => setCurrentView('dashboard')}>
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/30 group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase">Quantum<span className="text-indigo-500">Trade</span></h1>
        </div>
        
        <nav className="space-y-1.5 flex-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Execution' },
            { id: 'scanner', icon: ShieldAlert, label: 'Analytics' },
            { id: 'intelligence', icon: Globe, label: 'Intelligence' }
          ].map(item => (
            <button key={item.id} 
              onClick={() => setCurrentView(item.id as any)} 
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${currentView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-gray-800/50 text-slate-500 font-bold'}`}
            >
              <item.icon className="w-5 h-5" /> {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-5 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
            <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Quantum Stream</span>
          </div>
          <p className="text-[10px] text-indigo-300/60 font-bold uppercase tracking-tight leading-relaxed">
            {isLoading ? 'Booting Cluster...' : `Tracking ${selectedAsset.symbol}`}
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#0c0e12]">
        <header className="h-24 border-b border-gray-800 flex items-center justify-between px-10 bg-[#0c0e12]/80 backdrop-blur-2xl sticky top-0 z-50">
          <div className="flex items-center gap-8 overflow-hidden flex-1">
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Asset Cluster</span>
              <select 
                value={selectedAsset.symbol} 
                onChange={(e) => setSelectedAsset(ASSETS.find(a => a.symbol === e.target.value)!)} 
                className="bg-gray-900 border border-gray-700 text-white text-sm font-black rounded-xl px-4 py-2 outline-none hover:border-indigo-500 transition-colors cursor-pointer appearance-none pr-8"
              >
                {ASSETS.map(asset => (
                  <option key={asset.symbol} value={asset.symbol}>{asset.symbol} [{asset.category}]</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Scan Resolution</span>
              <div className="flex bg-gray-900 border border-gray-700 rounded-xl p-1 gap-1">
                {TIMEFRAMES.slice(0, 5).map(tf => (
                  <button key={tf.value} 
                    onClick={() => setCurrentTimeframe(tf)} 
                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${currentTimeframe.value === tf.value ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 border-l border-gray-800 pl-4 ml-4">
              {[
                { id: 'single', icon: Square, label: 'Single' },
                { id: 'vertical', icon: Columns, label: 'Split Vertical' },
                { id: 'horizontal', icon: Rows, label: 'Split Horizontal' },
                { id: 'quad', icon: LayoutGrid, label: 'Quad Grid' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id as ChartLayout)}
                  className={`p-2 rounded-lg transition-all ${layout === opt.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-gray-800'}`}
                  title={opt.label}
                >
                  <opt.icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            <div className="hidden xl:flex flex-col shrink-0 min-w-[120px] ml-auto">
              <div className="flex items-center gap-2">
                <span className={`text-white font-black text-xl tracking-tighter font-mono transition-all ${liveTick ? 'scale-105' : ''}`}>
                  {liveTick?.close.toFixed(selectedAsset.volatility < 1 ? 5 : 2) || '---'}
                </span>
                <span className="animate-pulse text-emerald-400">
                  <Activity className="w-3 h-3" />
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Real-time Feed</span>
            </div>
          </div>
        </header>

        <div className="p-10 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Layout Container */}
              <div className={`grid gap-4 w-full h-[650px] transition-all ${getLayoutClasses()}`}>
                {Array.from({ length: getChartCount() }).map((_, idx) => (
                   <TradingChart 
                      key={idx}
                      data={data} 
                      zones={zones} 
                      activeTrade={activeTrade} 
                      currentAnalysis={selectedZone ? aiAnalysis[selectedZone.id] : null}
                      timezone={selectedTimezone.value}
                      liveUpdate={liveTick}
                    />
                ))}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#11141b] border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" /> Neural Terminal
                  </h3>
                  <div className="h-44 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-4">
                    {selectedZone ? (
                      <div className="animate-in fade-in duration-300">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                          <span className="text-indigo-400 font-black">[{selectedZone.type}]</span>
                          <span className="text-emerald-400 font-black">{(aiAnalysis[selectedZone.id]?.score * 100 || 0).toFixed(0)}% Confidence</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed italic">
                          "{aiAnalysis[selectedZone.id]?.reasoning || 'Decrypting institutional footprints...'}"
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600 italic">
                        <MousePointer2 className="w-5 h-5 mb-2 opacity-30" />
                        <span>Select a matrix footprint for validation</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#11141b] border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" /> Intelligence
                  </h3>
                  <div className="h-44 overflow-y-auto custom-scrollbar">
                    <NewsFeed news={news} isLoading={isNewsLoading} timezone={selectedTimezone.value} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#11141b] border border-gray-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-400" /> Active Footprints
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {zones.filter(z => !z.isMitigated).map(zone => (
                    <div key={zone.id} 
                      onClick={() => runAIValidation(zone)} 
                      className={`p-4 bg-gray-900/40 hover:bg-indigo-600/10 border border-gray-800 hover:border-indigo-500/50 rounded-2xl cursor-pointer transition-all group ${selectedZone?.id === zone.id ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-black text-white group-hover:text-indigo-400">{zone.type}</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${zone.direction === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {zone.direction}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">EQ: {zone.equilibrium.toFixed(selectedAsset.volatility < 1 ? 5 : 2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
