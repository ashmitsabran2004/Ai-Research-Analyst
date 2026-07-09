import { NextResponse } from 'next/server';
import { researchAgent } from '@/lib/agent';
import { createClient } from '@/utils/supabase/server';

export async function POST(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyName } = await req.json();

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const initialState = { companyName };
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let accumulatedState = { ...initialState };
        const startTime = Date.now();
        let lastChunkTime = startTime;
        let timingLog = [];
        try {
          for await (const chunk of await researchAgent.stream(initialState)) {
            const nodeName = Object.keys(chunk)[0];
            const stateUpdate = chunk[nodeName];

            const now = Date.now();
            const durationMs = now - lastChunkTime;
            const elapsedMs = now - startTime;
            lastChunkTime = now;

            const _timing = {
              nodeName,
              durationMs,
              elapsedMs,
              ...(nodeName === 'judge' ? { totalMs: elapsedMs } : {})
            };

            const newErrors = stateUpdate.errors || [];
            const prevErrors = accumulatedState.errors || [];
            
            accumulatedState = { 
              ...accumulatedState, 
              ...stateUpdate,
              errors: [...prevErrors, ...newErrors]
            };
            
            const payload = { ...stateUpdate, _timing };
            timingLog.push(_timing);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }

          accumulatedState._timingLog = timingLog;

          await supabase.from('reports').insert({
            user_id: user.id,
            company_name: companyName,
            ticker: accumulatedState.financialData?.ticker || companyName,
            result_data: accumulatedState
          });
          
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream Error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Stream Error' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
