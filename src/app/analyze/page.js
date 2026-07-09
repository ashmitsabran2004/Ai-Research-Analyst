'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const LOADING_MESSAGES = [
  "INITIATING DATA GATHERING PROTOCOL...",
  "PARSING FUNDAMENTAL METRICS...",
  "ANALYZING SENTIMENT VECTORS...",
  "EXECUTING DEBATE ALGORITHMS...",
  "COMPILING FINAL VERDICT..."
];

export default function Home() {
  return (
    <Suspense fallback={<div className="p-12 text-terminal-muted font-mono">LOADING...</div>}>
      <AnalyzeContent />
    </Suspense>
  )
}

function PendingSection({ label }) {
  return (
    <div className="border border-terminal-border p-6 h-full flex flex-col justify-center items-center min-h-[150px]">
      <div className="text-terminal-muted font-mono text-xs flex items-center">
        {'>'} {label}...<span className="text-terminal-amber animate-cursor-blink ml-1">▊</span>
      </div>
    </div>
  );
}

function AnalyzeContent() {
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [taglineText, setTaglineText] = useState("");
  const [timingLog, setTimingLog] = useState([]);
  const [showTrace, setShowTrace] = useState(false);
  
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const fullTagline = "Intelligent Investment Decisions.";

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setTaglineText(fullTagline.slice(0, i + 1));
      i++;
      if (i >= fullTagline.length) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 5000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (reportId) {
      const fetchReport = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase.from('reports').select('result_data').eq('id', reportId).single();
        if (error) {
          setError(error.message);
        } else if (data) {
          setResult(data.result_data);
          if (data.result_data._timingLog) {
            setTimingLog(data.result_data._timingLog);
          }
        }
        setLoading(false);
      };
      fetchReport();
    }
  }, [reportId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.trim()) return;

    setLoading(true);
    setError(null);
    setResult({});
    setTimingLog([]);
    setShowTrace(false);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: company })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze company.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const block of lines) {
            const dataLine = block.split('\n').find(l => l.startsWith('data: '));
            if (dataLine) {
              const dataStr = dataLine.slice(6);
              if (dataStr === '[DONE]') {
                done = true;
              } else {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.error) {
                    setError(parsed.error);
                  } else {
                    if (parsed._timing) {
                      setTimingLog(prev => [...prev, parsed._timing]);
                    }
                    setResult(prev => {
                      const newErrors = parsed.errors || [];
                      const prevErrors = prev?.errors || [];
                      return {
                        ...prev,
                        ...parsed,
                        errors: [...prevErrors, ...newErrors]
                      };
                    });
                  }
                } catch (err) {
                  // ignore JSON parse error for incomplete chunks
                }
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderAsciiBar = (score) => {
    const filled = Math.round(score);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  };

  const getVerdictColor = (verdict) => {
    const v = verdict?.toLowerCase() || '';
    if (v === 'invest') return 'text-terminal-green';
    if (v === 'pass') return 'text-terminal-red';
    return 'text-terminal-amber';
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-sans selection:bg-terminal-amber/30 selection:text-terminal-amber">
      <main className="container mx-auto px-6 py-12 md:py-24 max-w-6xl">
        
        {/* Landing Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div className="font-mono text-xs text-terminal-muted mb-4 uppercase tracking-widest border-b border-terminal-border inline-block pb-1">
            AI Research Terminal v2.0
          </div>
          <h1 className="text-3xl md:text-5xl font-sans tracking-tight mb-8 text-terminal-text uppercase">
            {taglineText}<span className="text-terminal-amber animate-cursor-blink">▊</span>
          </h1>
          <p className="text-sm text-terminal-muted max-w-2xl font-mono">
            {'//'} Enter a ticker or company name below to initialize autonomous agent research.
          </p>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          onSubmit={handleSubmit} 
          className="max-w-2xl mb-16"
        >
          <div className="flex flex-col md:flex-row items-stretch md:items-center bg-terminal-bg border border-terminal-border font-mono p-1 focus-within:border-terminal-amber transition-colors">
            <div className="flex items-center flex-1 px-4 py-3 md:py-0">
              <span className="text-terminal-muted mr-3">{'>'} analyze</span>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder='"AAPL"'
                className="flex-1 w-full bg-transparent border-none outline-none text-terminal-amber placeholder-terminal-muted/50 focus:ring-0 text-lg"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !company.trim()}
              className="w-full md:w-auto bg-terminal-border hover:bg-terminal-border/80 text-terminal-text px-6 py-4 md:py-3 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-l border-terminal-bg"
            >
              {loading ? '[ EXECUTING ]' : '[ EXECUTE ]'}
            </button>
          </div>
          
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 flex flex-col"
              >
                <div className="text-terminal-muted/80 font-mono text-[10px] md:text-xs space-y-1 mb-4">
                  <div>{'>'} SYSTEM: running on free-tier inference (max 6 concurrent requests)</div>
                  <div>{'>'} queued requests may add 10-20s to analysis time</div>
                  <div>{'>'} this is expected — not a failure</div>
                </div>
                <div className="text-terminal-amber font-mono text-xs flex items-center">
                  <span className="animate-pulse mr-2">_</span>
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </div>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-terminal-red font-mono text-xs p-3 border border-terminal-red/30 bg-terminal-red/5"
              >
                ERR: {error}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.form>

        {/* Results View */}
        <AnimatePresence mode="wait">
          {result && (() => {
            const isFailedAnalysis = result.finalDecision?.confidence === 0 && result.errors?.length > 0;
            return (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              
              {/* Ticker / Price Header */}
              {result.financialData && !result.financialData.error && (
                <div className="border-b border-terminal-border pb-4 mb-8 flex justify-between items-end">
                  <div className="flex flex-wrap items-baseline gap-4 md:gap-8 font-mono">
                    <span className="text-2xl md:text-4xl text-terminal-amber font-bold">{result.financialData.ticker}</span>
                    <span className="text-xl md:text-2xl text-terminal-text">{result.financialData.price?.toFixed(2) || 'N/A'} {result.financialData.currency}</span>
                    {result.financialData.change !== undefined && (
                      <span className={`text-sm md:text-base ${result.financialData.change >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                        {result.financialData.change > 0 ? '+' : ''}{result.financialData.change.toFixed(2)} ({result.financialData.changePercent > 0 ? '+' : ''}{(result.financialData.changePercent * 100).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                  {result.financialData.marketCap && (
                    <div className="hidden md:block font-mono text-sm text-terminal-muted">
                      MCAP: {(result.financialData.marketCap / 1e9).toFixed(2)}B
                    </div>
                  )}
                </div>
              )}

              {/* Partial Errors Banner */}
              {((result.errors && result.errors.length > 0) || (result.financialData && result.financialData.error)) && (
                <div className="border border-terminal-amber/30 bg-terminal-amber/5 text-terminal-amber p-4 font-mono text-xs">
                  <div className="font-bold mb-2">{'!>'} PARTIAL_ANALYSIS_FAILURE</div>
                  <ul className="list-disc pl-5">
                    {result.financialData?.error && <li>Financial Data: {result.financialData.error}</li>}
                    {result.errors?.map((err, i) => <li key={i}>{err.node}: {err.message}</li>)}
                  </ul>
                </div>
              )}

              {/* Top Row: Verdict, Scorecard, Raw Data */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Verdict */}
                {result.finalDecision ? (
                  <div className="border border-terminal-border p-6 h-full flex flex-col justify-between min-h-[200px]">
                    <div className="text-terminal-amber font-mono text-xs uppercase tracking-widest border-b border-terminal-border pb-2">
                      {'>'} JUDGES_VERDICT
                    </div>
                    <div className="flex flex-col items-center justify-center flex-grow py-8 text-center">
                      <div className="text-xs text-terminal-muted font-mono mb-4">CONFIDENCE: {result.finalDecision.confidence}%</div>
                      <span className={`text-5xl md:text-6xl font-mono font-bold tracking-tighter uppercase ${getVerdictColor(result.finalDecision.verdict)}`}>
                        {result.finalDecision.verdict}<span className="animate-cursor-blink text-terminal-amber ml-1">▊</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <PendingSection label="AWAITING_JUDGE" />
                )}

                {/* Scorecard or Failure State */}
                {isFailedAnalysis ? (
                  <div className="border border-terminal-red p-6 h-full flex flex-col justify-center items-center min-h-[200px] bg-terminal-red/5">
                    <div className="text-terminal-red font-mono text-lg md:text-xl uppercase tracking-widest font-bold">
                      {'>'} ANALYSIS_FAILED
                    </div>
                  </div>
                ) : result.finalDecision?.scorecard ? (
                  <div className="border border-terminal-border p-6 h-full flex flex-col min-h-[200px]">
                    <div className="text-terminal-amber font-mono text-xs uppercase tracking-widest mb-6 border-b border-terminal-border pb-2">
                      {'>'} SCORECARD
                    </div>
                    <div className="space-y-4 font-mono text-xs md:text-sm flex-grow flex flex-col justify-center overflow-x-auto">
                      {[
                        { label: 'FIN_HEALTH', score: result.finalDecision.scorecard.financialHealth },
                        { label: 'VALUATION', score: result.finalDecision.scorecard.valuation },
                        { label: 'SENTIMENT', score: result.finalDecision.scorecard.sentiment },
                        { label: 'ECON_MOAT', score: result.finalDecision.scorecard.moat },
                        { label: 'RISK_SCORE', score: result.finalDecision.scorecard.riskLevel }
                      ].map((metric, idx) => (
                        <div key={idx} className="flex justify-between items-center min-w-[250px]">
                          <span className="text-terminal-muted w-24 flex-shrink-0">{metric.label}</span>
                          <span className="text-terminal-text ml-4 tracking-[0.2em] whitespace-nowrap">{renderAsciiBar(metric.score)}</span>
                          <span className="text-terminal-text ml-4 w-12 text-right">{metric.score.toString().padStart(2, ' ')}/10</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <PendingSection label="AWAITING_JUDGE" />
                )}

                {/* Raw Market Data */}
                {result.financialData ? (
                  result.financialData.error ? (
                    <div className="border border-terminal-red p-6 h-full flex flex-col justify-center items-center min-h-[200px]">
                      <div className="text-terminal-red font-mono text-xs text-center">
                        {'>'} ERROR: {result.financialData.error}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-terminal-border p-6 h-full flex flex-col min-h-[200px]">
                      <div className="text-terminal-amber font-mono text-xs uppercase tracking-widest mb-6 border-b border-terminal-border pb-2">
                        {'>'} MARKET_DATA
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-6 font-mono flex-grow content-center">
                        <div>
                          <div className="text-[10px] text-terminal-muted mb-1">P/E (TTM)</div>
                          <div className="text-sm text-terminal-text">{result.financialData.trailingPE?.toFixed(2) || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-terminal-muted mb-1">EPS (TTM)</div>
                          <div className="text-sm text-terminal-text">{result.financialData.eps?.toFixed(2) || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-terminal-muted mb-1">52W HIGH</div>
                          <div className="text-sm text-terminal-text">{result.financialData.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-terminal-muted mb-1">52W LOW</div>
                          <div className="text-sm text-terminal-text">{result.financialData.fiftyTwoWeekLow?.toFixed(2) || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <PendingSection label="GATHERING_FINANCIALS" />
                )}
              </div>

              {/* The Great Debate */}
              {!isFailedAnalysis && (result.bullCase || result.bearCase || Object.keys(result).length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Bull Case */}
                  {result.bullCase ? (
                    <div className="border border-terminal-border border-l-[3px] border-l-terminal-green p-8 h-full">
                      <div className="text-terminal-green font-mono text-xs uppercase tracking-widest mb-6 pb-2 border-b border-terminal-border">
                        {'>'} BULL_CASE
                      </div>
                      <p className="font-serif text-terminal-text text-base leading-relaxed mb-8 italic">
                        "{result.bullCase.argument}"
                      </p>
                      <ul className="space-y-4">
                        {result.bullCase.supportingPoints.map((pt, i) => (
                          <li key={i} className="font-serif text-sm text-terminal-text flex items-start border-t border-terminal-border/50 pt-4">
                            <span className="text-terminal-green mr-4 font-mono text-xs mt-0.5">{(i+1).toString().padStart(2, '0')}</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <PendingSection label="CONSTRUCTING_BULL_CASE" />
                  )}
                  
                  {/* Bear Case */}
                  {result.bearCase ? (
                    <div className="border border-terminal-border border-l-[3px] border-l-terminal-red p-8 h-full">
                      <div className="text-terminal-red font-mono text-xs uppercase tracking-widest mb-6 pb-2 border-b border-terminal-border">
                        {'>'} BEAR_CASE
                      </div>
                      <p className="font-serif text-terminal-text text-base leading-relaxed mb-8 italic">
                        "{result.bearCase.argument}"
                      </p>
                      <ul className="space-y-4">
                        {result.bearCase.supportingPoints.map((pt, i) => (
                          <li key={i} className="font-serif text-sm text-terminal-text flex items-start border-t border-terminal-border/50 pt-4">
                            <span className="text-terminal-red mr-4 font-mono text-xs mt-0.5">{(i+1).toString().padStart(2, '0')}</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <PendingSection label="CONSTRUCTING_BEAR_CASE" />
                  )}
                </div>
              )}

              {/* Risk Profile & Catalysts */}
              {!isFailedAnalysis && (result.riskCompetitiveAnalysis || Object.keys(result).length > 0) && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  
                  {/* Risk Profile */}
                  <div className="xl:col-span-7">
                    {result.riskCompetitiveAnalysis ? (
                      <div className="border border-terminal-border p-8 h-full">
                        <div className="flex justify-between items-center mb-6 border-b border-terminal-border pb-2">
                          <div className="text-terminal-amber font-mono text-xs uppercase tracking-widest">
                            {'>'} RISK_PROFILE
                          </div>
                          {result.riskCompetitiveAnalysis.marketPosition && (
                            <div className="font-mono text-[10px] text-terminal-muted uppercase">
                              POS: {result.riskCompetitiveAnalysis.marketPosition.replace('-', '_')}
                            </div>
                          )}
                        </div>
                        
                        <p className="font-serif text-sm text-terminal-text leading-relaxed mb-8">
                          {result.riskCompetitiveAnalysis.summary}
                        </p>

                        <div className="mb-8 border border-terminal-border/50 p-4">
                          <h4 className="text-[10px] font-mono text-terminal-muted uppercase tracking-widest mb-2">ANALYST_CONSENSUS</h4>
                          <p className="font-serif text-sm text-terminal-text">{result.riskCompetitiveAnalysis.analystConsensusNote}</p>
                        </div>

                        {result.riskCompetitiveAnalysis.keyRisks?.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-mono text-terminal-muted uppercase tracking-widest mb-4">GROUNDED_RISKS</h4>
                            <div className="space-y-0 border border-terminal-border">
                              {result.riskCompetitiveAnalysis.keyRisks.map((risk, i) => (
                                <div key={i} className={`p-4 ${i !== 0 ? 'border-t border-terminal-border' : ''}`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-serif text-terminal-text text-sm">{risk.risk}</span>
                                    <span className={`font-mono text-[10px] uppercase ml-4 flex-shrink-0 ${risk.severity === 'high' ? 'text-terminal-red' : risk.severity === 'medium' ? 'text-terminal-amber' : 'text-terminal-green'}`}>
                                      [{risk.severity}]
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-terminal-muted font-mono">
                                    SRC: {risk.source}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <PendingSection label="ANALYZING_RISKS" />
                    )}
                  </div>

                  {/* Catalysts & Risks */}
                  <div className="xl:col-span-5 flex flex-col gap-8">
                     {result.finalDecision?.keyCatalysts ? (
                       <div className="border border-terminal-border border-l-[3px] border-l-terminal-amber p-8 flex-1">
                         <h4 className="text-terminal-amber font-mono text-xs tracking-widest border-b border-terminal-border pb-2 mb-6 uppercase">
                           {'>'} KEY_CATALYSTS
                         </h4>
                         <ul className="space-y-4">
                           {result.finalDecision.keyCatalysts.map((cat, i) => (
                             <li key={i} className="font-serif text-sm text-terminal-text flex items-start">
                               <span className="text-terminal-amber mr-3 font-mono text-xs mt-0.5">{'>'}</span> {cat}
                             </li>
                           ))}
                         </ul>
                       </div>
                     ) : (
                       <PendingSection label="AWAITING_JUDGE" />
                     )}
                     
                     {result.finalDecision?.keyRisks ? (
                       <div className="border border-terminal-border border-l-[3px] border-l-terminal-red p-8 flex-1">
                         <h4 className="text-terminal-red font-mono text-xs tracking-widest border-b border-terminal-border pb-2 mb-6 uppercase">
                           {'>'} KEY_RISKS
                         </h4>
                         <ul className="space-y-4">
                           {result.finalDecision.keyRisks.map((risk, i) => (
                             <li key={i} className="font-serif text-sm text-terminal-text flex items-start">
                               <span className="text-terminal-red mr-3 font-mono text-xs mt-0.5">{'!'}</span> {risk}
                             </li>
                           ))}
                         </ul>
                       </div>
                     ) : (
                       <PendingSection label="AWAITING_JUDGE" />
                     )}
                  </div>
                </div>
              )}

              {/* Judge's Reasoning */}
              {(result.finalDecision || Object.keys(result).length > 0) && (
                result.finalDecision?.reasoning ? (
                  <div className="border border-terminal-border p-8 w-full">
                    <h3 className="text-terminal-amber font-mono text-xs tracking-widest border-b border-terminal-border pb-2 mb-8 uppercase">
                      {'>'} JUDGES_REASONING_LOG
                    </h3>
                    <div className="prose prose-invert prose-p:font-serif prose-li:font-serif prose-headings:font-sans prose-headings:tracking-tight max-w-none text-terminal-text text-sm leading-loose columns-1 md:columns-2 gap-12">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.finalDecision.reasoning}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <PendingSection label="AWAITING_JUDGE" />
                )
              )}

              {/* Execution Trace Toggle */}
              {timingLog.length > 0 && result.finalDecision && (
                <div className="mt-8 font-mono text-sm">
                  <button 
                    onClick={() => setShowTrace(!showTrace)}
                    className="text-terminal-muted hover:text-terminal-amber transition-colors flex items-center focus:outline-none"
                  >
                    {'>'} {showTrace ? 'hide execution trace' : 'show execution trace'}
                    {!showTrace && <span className="text-terminal-amber animate-cursor-blink ml-1">▊</span>}
                  </button>
                  
                  {showTrace && (
                    <div className="mt-4 flex flex-col max-w-2xl">
                      {timingLog.map((log, idx) => (
                        <div key={idx} className="flex text-terminal-muted mb-1">
                          <span className="w-64">{log.nodeName}</span>
                          <span className="w-16 text-right">{(log.durationMs / 1000).toFixed(1)}s</span>
                        </div>
                      ))}
                      <div className="border-t border-terminal-border/50 my-2 w-[20rem]"></div>
                      <div className="flex text-terminal-amber">
                        <span className="w-64">total</span>
                        <span className="w-16 text-right">
                          {timingLog[timingLog.length - 1]?.totalMs 
                            ? (timingLog[timingLog.length - 1].totalMs / 1000).toFixed(1) + 's' 
                            : '0.0s'}
                        </span>
                        <span className="ml-4">
                          (wall clock, includes parallel overlap)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </main>
    </div>
  );
}
