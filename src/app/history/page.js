import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, company_name, ticker, created_at, result_data')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-sans p-6 md:p-12 selection:bg-terminal-amber/30 selection:text-terminal-amber max-w-6xl mx-auto w-full">
      <h1 className="text-terminal-amber font-mono text-xs uppercase tracking-widest border-b border-terminal-border pb-4 mb-8">
        {'>'} QUERY_EXECUTION // REPORT_HISTORY
      </h1>

      {error && (
        <div className="text-terminal-red font-mono text-xs p-3 border border-terminal-red/30 bg-terminal-red/5 mb-8">
          ERR: {error.message}
        </div>
      )}

      {reports && reports.length === 0 && !error && (
        <div className="font-mono text-sm text-terminal-muted italic">
          No records found.
        </div>
      )}

      {reports && reports.length > 0 && (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-sm">
            <thead>
              <tr className="border-b border-terminal-border text-terminal-muted">
                <th className="py-4 pr-4 font-normal">TICKER</th>
                <th className="py-4 pr-4 font-normal">COMPANY</th>
                <th className="py-4 pr-4 font-normal">DATE (UTC)</th>
                <th className="py-4 pr-4 font-normal">VERDICT</th>
                <th className="py-4 font-normal text-right">CONFIDENCE</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const verdict = report.result_data?.finalDecision?.verdict || 'N/A'
                const confidence = report.result_data?.finalDecision?.confidence || 0
                const vColor = verdict.toLowerCase() === 'invest' ? 'text-terminal-green' : verdict.toLowerCase() === 'pass' ? 'text-terminal-red' : 'text-terminal-amber'
                
                return (
                  <tr key={report.id} className="border-b border-terminal-border/50 hover:bg-terminal-border/20 transition-colors group">
                    <td className="py-4 pr-4 text-terminal-amber">
                      <Link href={`/analyze?id=${report.id}`} className="block w-full h-full">
                        {report.ticker || '---'}
                      </Link>
                    </td>
                    <td className="py-4 pr-4 text-terminal-text">
                      <Link href={`/analyze?id=${report.id}`} className="block w-full h-full">
                        {report.company_name}
                      </Link>
                    </td>
                    <td className="py-4 pr-4 text-terminal-muted">
                      <Link href={`/analyze?id=${report.id}`} className="block w-full h-full">
                        {new Date(report.created_at).toISOString().split('T')[0]}
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      <Link href={`/analyze?id=${report.id}`} className={`block w-full h-full uppercase ${vColor}`}>
                        {verdict}
                      </Link>
                    </td>
                    <td className="py-4 text-right text-terminal-text">
                      <Link href={`/analyze?id=${report.id}`} className="block w-full h-full">
                        {confidence}%
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
