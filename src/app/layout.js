import { Space_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

const fontSans = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const fontSerif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ['normal', 'italic'],
});

export const metadata = {
  title: "AI Research Terminal",
  description: "Autonomous investment research terminal",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-terminal-bg text-terminal-text">
        {user && (
          <header className="border-b border-terminal-border p-4 flex justify-between items-center font-mono text-xs uppercase tracking-widest bg-terminal-bg">
            <div className="flex gap-6">
              <Link href="/analyze" className="text-terminal-muted hover:text-terminal-amber transition-colors">{'>'} analyze</Link>
              <Link href="/history" className="text-terminal-muted hover:text-terminal-amber transition-colors">{'>'} history</Link>
            </div>
            <form action="/auth/logout" method="POST">
              <button type="submit" className="text-terminal-muted hover:text-terminal-red transition-colors">{'>'} logout</button>
            </form>
          </header>
        )}
        <div className="flex-grow flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
