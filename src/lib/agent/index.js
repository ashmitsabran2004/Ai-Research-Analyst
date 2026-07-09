import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatMistralAI } from "@langchain/mistralai";
import { gatherFinancialData } from "./tools";
import { withCache } from "./cache/memoryCache";
import {
  FundamentalsAnalysisSchema,
  SentimentAnalysisSchema,
  RiskCompetitiveAnalysisSchema,
  CaseArgumentSchema,
  FinalDecisionSchema,
} from "./schemas";

// --------------------------------------------------------------------------
// State: each parallel branch writes to its OWN key, so LangGraph can run
// them concurrently without needing a custom reducer. Only merge nodes
// (judge) read from multiple keys at once.
// --------------------------------------------------------------------------
const AgentState = Annotation.Root({
  companyName: Annotation(),
  financialData: Annotation(),
  fundamentalsAnalysis: Annotation(),
  sentimentAnalysis: Annotation(),
  riskCompetitiveAnalysis: Annotation(),
  bullCase: Annotation(),
  bearCase: Annotation(),
  finalDecision: Annotation(),
  errors: Annotation({
    reducer: (existing = [], update) => existing.concat(update),
    default: () => [],
  }),
});

function getModel() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is missing. Restart your Next.js server after adding it to .env.local.");
  }
  return new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0.2,
    apiKey,
    maxRetries: 5,
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Semaphore to prevent hitting Gemini Free Tier concurrency limits
class Semaphore {
  constructor(max) {
    this.tasks = [];
    this.counter = max;
  }
  async acquire() {
    if (this.counter > 0) {
      this.counter--;
      return;
    }
    return new Promise(resolve => this.tasks.push(resolve));
  }
  release() {
    this.counter++;
    if (this.tasks.length > 0) {
      this.counter--;
      const next = this.tasks.shift();
      next();
    }
  }
}
const llmSemaphore = new Semaphore(1); // Run LLM calls sequentially to avoid 429 bursts

async function invokeWithRetry(model, prompt, maxRetries = 4) {
  for (let i = 0; i < maxRetries; i++) {
    await llmSemaphore.acquire();
    try {
      return await model.invoke(prompt);
    } catch (e) {
      if (e.message && e.message.includes('429') && i < maxRetries - 1) {
        let waitTime = (2 ** i) * 5000; // fallback backoff
        const match = e.message.match(/retry in (\d+(?:\.\d+)?)s/);
        if (match) {
          waitTime = parseFloat(match[1]) * 1000 + 1000; // Add 1s buffer
        }
        console.warn(`[Node] Rate limited (429). Retrying in ${waitTime/1000}s...`);
        await sleep(waitTime);
      } else {
        throw e;
      }
    } finally {
      llmSemaphore.release();
    }
  }
}

// --------------------------------------------------------------------------
// 1. Data Gathering Node (unchanged from your version)
// --------------------------------------------------------------------------
async function gatherDataNode(state) {
  // Cache for 15 min — long enough to survive repeated dev testing on the
  // same ticker, short enough that prices don't go stale during a demo.
  const data = await withCache(
    `financialData:${state.companyName.toLowerCase()}`,
    () => gatherFinancialData(state.companyName),
    15 * 60 * 1000
  );
  return { financialData: data };
}

function routeAfterGather(state) {
  if (state.financialData?.error) {
    return ["analysisFailed"];
  }
  return ["analyzeFundamentals", "analyzeSentiment", "analyzeRiskCompetitive"];
}

async function analysisFailedNode(state) {
  return {
    finalDecision: {
      verdict: "Pass",
      confidence: 0,
      reasoning: `Could not analyze ${state.companyName}: ${state.financialData?.error || "no public ticker found"}. No verdict can be produced without real market data.`,
      scorecard: { financialHealth: 0, valuation: 0, sentiment: 0, moat: 0, riskLevel: 0 },
      keyCatalysts: [],
      keyRisks: [],
    },
    errors: [{ node: "gatherData", message: state.financialData?.error || "Ticker not found" }],
  };
}

// --------------------------------------------------------------------------
// 2a. Fundamentals Analysis (parallel branch — numbers only, no news)
// --------------------------------------------------------------------------
async function fundamentalsAnalysisNode(state) {
  if (state.financialData?.error) {
    return { errors: [{ node: "fundamentals", message: state.financialData.error }] };
  }
  try {
    const model = getModel().withStructuredOutput(FundamentalsAnalysisSchema);
    const fd = state.financialData;
    const result = await invokeWithRetry(model, `
You are a financial analyst. Analyze ONLY the numbers below for ${state.companyName} (${fd.ticker}).
Do not reference news or sentiment — that is handled separately.

Price: ${fd.price} ${fd.currency}
Market Cap: ${fd.marketCap}
52-Week High/Low: ${fd.fiftyTwoWeekHigh} / ${fd.fiftyTwoWeekLow}
Trailing P/E: ${fd.trailingPE}
EPS: ${fd.eps}

Every strength/concern must cite a specific number from above.
    `);
    return { fundamentalsAnalysis: result };
  } catch (e) {
    return { errors: [{ node: "fundamentals", message: e.message }] };
  }
}

// --------------------------------------------------------------------------
// 2b. Sentiment Analysis (parallel branch — news only)
// --------------------------------------------------------------------------
async function sentimentAnalysisNode(state) {
  if (state.financialData?.error) {
    return { errors: [{ node: "sentiment", message: state.financialData.error }] };
  }
  try {
    const model = getModel().withStructuredOutput(SentimentAnalysisSchema);
    const news = state.financialData.news || [];
    const result = await invokeWithRetry(model, `
You are a market sentiment analyst. Analyze ONLY the news headlines below for ${state.companyName}.
Do not reference financial ratios — that is handled separately.

News:
${news.map((n) => `- ${n.title} (${n.publisher})`).join("\n") || "No recent news available."}

Score sentiment from -10 (very negative) to 10 (very positive), and explain the impact of each key story.
    `);
    return { sentimentAnalysis: result };
  } catch (e) {
    return { errors: [{ node: "sentiment", message: e.message }] };
  }
}

// --------------------------------------------------------------------------
// 2c. Risk & Competitive Analysis (parallel branch — uses extensive data)
// --------------------------------------------------------------------------
async function riskCompetitiveAnalysisNode(state) {
  if (state.financialData?.error) {
    return { errors: [{ node: "riskCompetitive", message: state.financialData.error }] };
  }
  try {
    const model = getModel().withStructuredOutput(RiskCompetitiveAnalysisSchema);
    const fd = state.financialData;
    const result = await invokeWithRetry(model, `
You are a risk and competitive-positioning analyst. Analyze ${state.companyName} using ONLY the
data below. Every risk you cite must reference a specific data point — do not invent risks from
general knowledge of the industry.

Sector: ${fd.sector || "unknown"}
Industry: ${fd.industry || "unknown"}
Business description: ${fd.businessSummary || "not available"}
Profit margins: ${fd.profitMargins ?? "not available"}
Debt-to-equity: ${fd.debtToEquity ?? "not available"}
Return on equity: ${fd.returnOnEquity ?? "not available"}
Current ratio: ${fd.currentRatio ?? "not available"}
Revenue growth: ${fd.revenueGrowth ?? "not available"}
Analyst recommendation: ${fd.recommendationKey || "not available"}
Analyst recommendation trend (recent periods): ${JSON.stringify(fd.recommendationTrend) || "not available"}

If a field says "not available," do not speculate about it — note the absence instead.
    `);
    return { riskCompetitiveAnalysis: result };
  } catch (e) {
    return { errors: [{ node: "riskCompetitive", message: e.message }] };
  }
}

// --------------------------------------------------------------------------
// 3a. Bull Case (parallel branch — argues FOR investing)
// --------------------------------------------------------------------------
async function bullCaseNode(state) {
  if (state.financialData?.error || !state.fundamentalsAnalysis || !state.sentimentAnalysis || !state.riskCompetitiveAnalysis) {
    return { errors: [{ node: "bullCase", message: "Missing upstream analysis" }] };
  }
  try {
    const model = getModel().withStructuredOutput(CaseArgumentSchema);
    const result = await invokeWithRetry(model, `
You are a bullish investment analyst. Using ONLY the research below, build the STRONGEST possible case
FOR investing in ${state.companyName}. Do not soften your argument — argue this side fully.
You may only cite evidence that appears in the research below.

Fundamentals analysis: ${JSON.stringify(state.fundamentalsAnalysis)}
Sentiment analysis: ${JSON.stringify(state.sentimentAnalysis)}
Risk/Competitive analysis: ${JSON.stringify(state.riskCompetitiveAnalysis)}
    `);
    return { bullCase: result };
  } catch (e) {
    return { errors: [{ node: "bullCase", message: e.message }] };
  }
}

// --------------------------------------------------------------------------
// 3b. Bear Case (parallel branch — argues AGAINST investing)
// --------------------------------------------------------------------------
async function bearCaseNode(state) {
  if (state.financialData?.error || !state.fundamentalsAnalysis || !state.sentimentAnalysis || !state.riskCompetitiveAnalysis) {
    return { errors: [{ node: "bearCase", message: "Missing upstream analysis" }] };
  }
  try {
    const model = getModel().withStructuredOutput(CaseArgumentSchema);
    const result = await invokeWithRetry(model, `
You are a skeptical/bearish investment analyst. Using ONLY the research below, build the STRONGEST possible
case AGAINST investing in ${state.companyName}. Do not soften your argument — argue this side fully.
You may only cite evidence that appears in the research below.

Fundamentals analysis: ${JSON.stringify(state.fundamentalsAnalysis)}
Sentiment analysis: ${JSON.stringify(state.sentimentAnalysis)}
Risk/Competitive analysis: ${JSON.stringify(state.riskCompetitiveAnalysis)}
    `);
    return { bearCase: result };
  } catch (e) {
    return { errors: [{ node: "bearCase", message: e.message }] };
  }
}

// --------------------------------------------------------------------------
// 4. Judge Node — weighs both arguments, outputs structured decision
// --------------------------------------------------------------------------
async function judgeNode(state) {
  if (state.financialData?.error || !state.bullCase || !state.bearCase) {
    return {
      errors: [{ node: "judge", message: "Missing upstream analysis" }],
      finalDecision: {
        verdict: "Pass",
        confidence: 0,
        reasoning: "Missing required upstream cases or data.",
        scorecard: { financialHealth: 0, valuation: 0, sentiment: 0, riskLevel: 0, moat: 0 },
        keyCatalysts: [],
        keyRisks: [],
      }
    };
  }
  try {
    const model = getModel().withStructuredOutput(FinalDecisionSchema);
    const result = await invokeWithRetry(model, `
You are the final decision-maker at an investment fund. Weigh the bull case against the bear case for
${state.companyName} and reach a verdict: Invest, Pass, or Watch.

Bull case: ${JSON.stringify(state.bullCase)}
Bear case: ${JSON.stringify(state.bearCase)}
Fundamentals: ${JSON.stringify(state.fundamentalsAnalysis)}
Sentiment: ${JSON.stringify(state.sentimentAnalysis)}
Risk/Competitive: ${JSON.stringify(state.riskCompetitiveAnalysis)}

Score each scorecard dimension 0-10 independently, then give your verdict, confidence, and reasoning that
explicitly explains why the bull or bear case won out.
Note: You MUST use Risk/Competitive riskLevel and moatScore to inform finalDecision.scorecard.riskLevel and finalDecision.scorecard.moat.
    `);
    return { finalDecision: result };
  } catch (e) {
    return {
      errors: [{ node: "judge", message: e.message }],
      finalDecision: {
        verdict: "Pass",
        confidence: 0,
        reasoning: "Decision node failed: " + e.message,
        scorecard: { financialHealth: 0, valuation: 0, sentiment: 0, riskLevel: 0, moat: 0 },
        keyCatalysts: [],
        keyRisks: [],
      },
    };
  }
}

// --------------------------------------------------------------------------
// Build Graph
// gatherData -> [fundamentalsAnalysis, sentimentAnalysis] (parallel)
//            -> [bullCase, bearCase] (parallel, after both analyses land)
//            -> judge -> END
// --------------------------------------------------------------------------
const workflow = new StateGraph(AgentState)
  .addNode("gatherData", gatherDataNode)
  .addNode("analysisFailed", analysisFailedNode)
  .addNode("analyzeFundamentals", fundamentalsAnalysisNode)
  .addNode("analyzeSentiment", sentimentAnalysisNode)
  .addNode("analyzeRiskCompetitive", riskCompetitiveAnalysisNode)
  .addNode("genBullCase", bullCaseNode)
  .addNode("genBearCase", bearCaseNode)
  .addNode("judge", judgeNode)

  .addEdge(START, "gatherData")
  .addConditionalEdges("gatherData", routeAfterGather)
  .addEdge("analysisFailed", END)

  .addEdge("analyzeFundamentals", "genBullCase")
  .addEdge("analyzeSentiment", "genBullCase")
  .addEdge("analyzeRiskCompetitive", "genBullCase")
  
  .addEdge("analyzeFundamentals", "genBearCase")
  .addEdge("analyzeSentiment", "genBearCase")
  .addEdge("analyzeRiskCompetitive", "genBearCase")

  .addEdge("genBullCase", "judge")
  .addEdge("genBearCase", "judge")
  .addEdge("judge", END);

export const researchAgent = workflow.compile();
