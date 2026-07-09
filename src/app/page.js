'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function LandingPage() {
  const [headlineText, setHeadlineText] = useState("");
  const [showTagline, setShowTagline] = useState(false);
  const [taglineText, setTaglineText] = useState("");

  const initCommand = "> initializing research terminal_";
  const tagline = "Intelligent Investment Decisions.";

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setHeadlineText(initCommand.slice(0, i + 1));
      i++;
      if (i >= initCommand.length) {
        clearInterval(timer);
        setTimeout(() => setShowTagline(true), 500);
      }
    }, 40);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showTagline) return;
    let i = 0;
    const timer = setInterval(() => {
      setTaglineText(tagline.slice(0, i + 1));
      i++;
      if (i >= tagline.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [showTagline]);

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-sans selection:bg-terminal-amber/30 selection:text-terminal-amber flex flex-col">
      <main className="container mx-auto px-6 py-24 max-w-4xl flex-grow flex flex-col justify-center">
        
        {/* Hero Section */}
        <div className="mb-24 border-b border-terminal-border pb-12">
          <div className="font-mono text-terminal-muted mb-4 text-sm h-6">
            {headlineText}{!showTagline && <span className="animate-pulse">_</span>}
          </div>
          {showTagline && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-4xl md:text-6xl font-sans tracking-tight text-terminal-text uppercase leading-tight"
            >
              {taglineText}<span className="text-terminal-amber animate-cursor-blink">▊</span>
            </motion.h1>
          )}
        </div>

        {/* How It Works */}
        <div className="mb-24">
          <h2 className="text-terminal-amber font-mono text-xs uppercase tracking-widest mb-8">
            {'>'} PIPELINE_EXECUTION_STEPS
          </h2>
          <div className="space-y-4 font-mono text-sm text-terminal-text">
            <div className="border border-terminal-border p-4 bg-terminal-bg hover:border-terminal-amber transition-colors">
              <span className="text-terminal-muted mr-4">01</span> {'>'} gather_data [yahoo_finance]
            </div>
            <div className="border border-terminal-border p-4 bg-terminal-bg hover:border-terminal-amber transition-colors">
              <span className="text-terminal-muted mr-4">02</span> {'>'} analyze_parallel [fundamentals, sentiment, risk]
            </div>
            <div className="border border-terminal-border p-4 bg-terminal-bg hover:border-terminal-amber transition-colors border-l-[3px] border-l-terminal-green/50">
              <span className="text-terminal-muted mr-4">03a</span> {'>'} build_case [bull_thesis]
            </div>
            <div className="border border-terminal-border p-4 bg-terminal-bg hover:border-terminal-amber transition-colors border-l-[3px] border-l-terminal-red/50">
              <span className="text-terminal-muted mr-4">03b</span> {'>'} build_case [bear_thesis]
            </div>
            <div className="border border-terminal-border p-4 bg-terminal-bg hover:border-terminal-amber transition-colors border-l-[3px] border-l-terminal-amber">
              <span className="text-terminal-muted mr-4">04</span> {'>'} judge_verdict [scorecard, confidence, final_decision]
            </div>
          </div>
        </div>

        {/* What Makes It Different */}
        <div className="mb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-t border-terminal-border pt-6">
            <h3 className="font-sans uppercase tracking-widest text-lg mb-4 text-terminal-text">Data Grounded</h3>
            <p className="font-serif text-terminal-muted text-sm leading-relaxed">
              No LLM hallucinations. The pipeline is strictly constrained by real-time quantitative metrics, balance sheets, and analyst estimates.
            </p>
          </div>
          <div className="border-t border-terminal-border pt-6">
            <h3 className="font-sans uppercase tracking-widest text-lg mb-4 text-terminal-text">Adversarial Debate</h3>
            <p className="font-serif text-terminal-muted text-sm leading-relaxed">
              Dual agents independently construct the strongest possible Bull and Bear arguments before the Judge reaches a verdict, ensuring bias resistance.
            </p>
          </div>
          <div className="border-t border-terminal-border pt-6">
            <h3 className="font-sans uppercase tracking-widest text-lg mb-4 text-terminal-text">Transparent Scoring</h3>
            <p className="font-serif text-terminal-muted text-sm leading-relaxed">
              Every verdict generates a quantitative scorecard across Financial Health, Valuation, Sentiment, and Risk. The reasoning log is fully exposed.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="border border-terminal-border p-8 flex flex-col md:flex-row items-center justify-between bg-terminal-bg">
          <div className="mb-6 md:mb-0">
            <div className="font-mono text-terminal-amber text-xs uppercase tracking-widest mb-2">
              {'>'} AUTH_REQUIRED
            </div>
            <p className="font-serif text-terminal-muted text-sm">
              Terminal access restricted to authenticated operators.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <Link href="/login" className="px-8 py-3 border border-terminal-border hover:border-terminal-amber hover:text-terminal-amber text-terminal-text font-mono text-xs uppercase tracking-widest transition-colors text-center inline-block">
              {'>'} login
            </Link>
            <Link href="/register" className="px-8 py-3 border border-terminal-amber bg-terminal-amber/5 text-terminal-amber hover:bg-terminal-amber hover:text-terminal-bg font-mono text-xs uppercase tracking-widest transition-colors text-center inline-block">
              {'>'} register
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
