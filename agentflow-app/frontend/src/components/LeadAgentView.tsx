import { useState } from 'react';
import { Search, MapPin, Hash, Loader2, Bot, Download, Star, FileText } from 'lucide-react';

interface Lead {
  name: string;
  rating?: number;
  address: string;
  phone: string;
  website: string;
}

export function LeadAgentView() {
  const [searchString, setSearchString] = useState('restaurant');
  const [locationQuery, setLocationQuery] = useState('New York, USA');
  const [maxLeads, setMaxLeads] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lead[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState('');
  const [activeView, setActiveView] = useState<'table' | 'report'>('table');

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setReport(null);
    setPhase('Deploying Lead Scout Agent...');

    try {
      setPhase('Analyzing geographic network...');
      const res = await fetch('/api/leads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type: searchString,
          location: locationQuery,
          max_leads: Number(maxLeads),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate leads.');

      setResults(data.leads || []);
      if (data.report) { setReport(data.report); setActiveView('table'); }
      setPhase('');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const header = 'Name,Rating,Address,Phone,Website';
    const rows = results.map(r =>
      `"${r.name}","${r.rating ?? ''}","${r.address}","${r.phone}","${r.website}"`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-4">
        <div>
          <h3 className="text-lg font-serif uppercase tracking-widest text-white">Lead Finder Agent</h3>
          <p className="text-[12px] font-mono text-[#666] uppercase tracking-wider mt-1">
            Autonomous B2B lead discovery powered by Apify + LLM analysis
          </p>
        </div>
        {results.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-[#333] bg-[#0a0a0a] px-4 py-2 text-[12px] hover:bg-[#111] transition-none font-mono uppercase tracking-wider text-white"
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Control Panel */}
      <div className="bg-[#080808] border border-[#222]">
        <div className="border-b border-[#222] px-8 py-5 flex items-center gap-3">
          <Search size={14} className="text-[#666]" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#666]">Target Market Parameters</span>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#888]">Business Type</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                <input type="text"
                  className="w-full bg-[#111] border border-[#333] py-3 pl-9 pr-3 text-white font-mono text-[13px] outline-none focus:border-white transition-none placeholder:text-[#444]"
                  placeholder="e.g. restaurant" value={searchString} onChange={e => setSearchString(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#888]">Location</label>
              <div className="relative">
                <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                <input type="text"
                  className="w-full bg-[#111] border border-[#333] py-3 pl-9 pr-3 text-white font-mono text-[13px] outline-none focus:border-white transition-none placeholder:text-[#444]"
                  placeholder="e.g. New York, USA" value={locationQuery} onChange={e => setLocationQuery(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#888]">Max Leads</label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                <input type="number" min={1} max={50}
                  className="w-full bg-[#111] border border-[#333] py-3 pl-9 pr-3 text-white font-mono text-[13px] outline-none focus:border-white transition-none"
                  value={maxLeads} onChange={e => setMaxLeads(parseInt(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button onClick={fetchLeads} disabled={loading}
              className="flex items-center gap-2 bg-white text-black px-8 py-3 border border-white font-mono text-[13px] hover:bg-[#050505] hover:text-white transition-none uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Scanning...</> : <><Bot size={14} /> Deploy Lead Agent</>}
            </button>
            {loading && phase && (
              <span className="text-[11px] font-mono text-[#666] uppercase tracking-widest animate-pulse">{phase}</span>
            )}
          </div>

          {error && (
            <div className="border border-[#aa4444] bg-[#aa4444]/5 p-4 text-[12px] font-mono text-[#cc6666]">{error}</div>
          )}
        </div>
      </div>

      {/* Results */}
      {(results.length > 0 || loading) && (
        <div className="bg-[#080808] border border-[#222]">
          {/* Tab bar */}
          <div className="flex items-center border-b border-[#222]">
            <button onClick={() => setActiveView('table')}
              className={`px-6 py-4 font-mono text-[11px] uppercase tracking-widest transition-none ${activeView === 'table' ? 'bg-white text-black' : 'text-[#666] hover:text-white'}`}>
              Lead Index {results.length > 0 && `(${results.length})`}
            </button>
            {report && (
              <button onClick={() => setActiveView('report')}
                className={`px-6 py-4 font-mono text-[11px] uppercase tracking-widest transition-none flex items-center gap-2 ${activeView === 'report' ? 'bg-white text-black' : 'text-[#666] hover:text-white'}`}>
                <FileText size={12} /> AI Report
              </button>
            )}
          </div>

          {/* Table View */}
          {activeView === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222] text-[10px] text-[#666] uppercase tracking-[0.2em] font-mono bg-[#050505]">
                    <th className="px-8 py-4 font-normal">#</th>
                    <th className="px-6 py-4 font-normal">Business Name</th>
                    <th className="px-6 py-4 font-normal">Rating</th>
                    <th className="px-6 py-4 font-normal">Address</th>
                    <th className="px-6 py-4 font-normal">Phone</th>
                    <th className="px-6 py-4 font-normal">Website</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] font-mono divide-y divide-[#222]">
                  {loading && results.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 size={28} className="animate-spin text-white/20" />
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[#555]">{phase || 'Analyzing...'}</span>
                      </div>
                    </td></tr>
                  )}
                  {results.map((item, i) => (
                    <tr key={i} className="hover:bg-[#111] transition-none cursor-default">
                      <td className="px-8 py-4 text-[#444]">{i + 1}</td>
                      <td className="px-6 py-4 font-bold uppercase tracking-wider text-white">{item.name}</td>
                      <td className="px-6 py-4">
                        {item.rating ? (
                          <span className="flex items-center gap-1 text-white"><Star size={11} className="fill-white" />{item.rating}</span>
                        ) : <span className="text-[#444]">—</span>}
                      </td>
                      <td className="px-6 py-4 text-[#888] text-[11px] max-w-[180px] truncate">{item.address || '—'}</td>
                      <td className="px-6 py-4 text-[#aaa] text-[11px]">{item.phone || '—'}</td>
                      <td className="px-6 py-4">
                        {item.website && item.website !== 'N/A' ? (
                          <a href={item.website} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] border border-[#333] px-3 py-1 text-white hover:bg-white hover:text-black transition-none uppercase tracking-widest">
                            Visit
                          </a>
                        ) : <span className="text-[#444]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AI Report View */}
          {activeView === 'report' && report && (
            <div className="p-8">
              <pre className="whitespace-pre-wrap font-mono text-[13px] text-[#ccc] leading-relaxed">{report}</pre>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div className="bg-[#080808] border border-[#222] py-16 text-center">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#444]">
            Agent standing by. Set parameters and deploy.
          </span>
        </div>
      )}
    </div>
  );
}
