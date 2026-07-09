'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { login } from '../auth-actions';

export default function LoginPage() {
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.target);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-sans flex flex-col justify-center items-center px-6 selection:bg-terminal-amber/30 selection:text-terminal-amber">
      <div className="w-full max-w-md">
        <div className="border border-terminal-border bg-terminal-bg p-8">
          <h1 className="text-terminal-amber font-mono text-xs uppercase tracking-widest border-b border-terminal-border pb-4 mb-8">
            {'>'} AUTH_PROTOCOL // LOGIN
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center font-mono">
              <span className="text-terminal-muted mr-3 mb-2 md:mb-0 w-24 flex-shrink-0">{'>'} email:</span>
              <input 
                name="email" 
                type="email" 
                required 
                className="flex-1 bg-transparent border-b border-terminal-border outline-none text-terminal-text focus:border-terminal-amber focus:text-terminal-amber transition-colors pb-1 rounded-none" 
              />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center font-mono">
              <span className="text-terminal-muted mr-3 mb-2 md:mb-0 w-24 flex-shrink-0">{'>'} pass:</span>
              <input 
                name="password" 
                type="password" 
                required 
                className="flex-1 bg-transparent border-b border-terminal-border outline-none text-terminal-text focus:border-terminal-amber focus:text-terminal-amber transition-colors pb-1 rounded-none" 
              />
            </div>

            {error && (
              <div className="text-terminal-red font-mono text-xs p-3 border border-terminal-red/30 bg-terminal-red/5">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isPending}
              className="w-full mt-8 bg-terminal-border hover:bg-terminal-border/80 text-terminal-text px-6 py-4 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50 border border-terminal-border"
            >
              {isPending ? '[ AUTHENTICATING ]' : '[ EXEC_LOGIN ]'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-terminal-border pt-6">
            <Link href="/register" className="font-mono text-xs text-terminal-muted hover:text-terminal-amber transition-colors uppercase tracking-widest">
              no_account? {'>'} register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
