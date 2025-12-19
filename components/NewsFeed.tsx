
import React from 'react';
import { NewsItem } from '../types';
import { Globe, ExternalLink, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsFeedProps {
  news: NewsItem[];
  isLoading: boolean;
  timezone: string;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ news, isLoading, timezone }) => {
  const formatNewsTime = (timestamp: string) => {
    // Attempt to convert generic "10:30 AM" or similar to actual user timezone based on "now"
    // Since mock news comes with "10:30 AM", we'll just re-format the current time for the mock feel
    // In a real app, this would be a full ISO timestamp.
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date());
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-800/50 rounded-2xl border border-gray-700/30" />
        ))}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="py-12 text-center opacity-40">
        <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">No Intelligence Briefings Found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {news.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block p-4 bg-gray-900/40 hover:bg-indigo-500/10 border border-gray-800/30 hover:border-indigo-500/30 rounded-2xl transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.source}</span>
              <span className="text-[9px] text-slate-600 font-bold flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {formatNewsTime(item.timestamp)}
              </span>
            </div>
            {item.sentiment === 'BULLISH' ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : item.sentiment === 'BEARISH' ? (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <h4 className="text-[11px] font-black text-white mb-1 group-hover:text-indigo-300 transition-colors leading-tight">
            {item.title}
          </h4>
          <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
            {item.summary}
          </p>
          <div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              Read Briefing <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
};

export default NewsFeed;
