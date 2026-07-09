# AI Investment Research Agent

A multi-agent AI system that takes a company name, gathers real financial data, runs an
adversarial bull-versus-bear debate, and produces a structured investment verdict with
transparent, evidence-backed reasoning.

---

## Overview

Most implementations of a task like this reduce to a single prompt: feed a company name to an
LLM and ask it to guess an answer. That approach is fast to build but produces reasoning that
cannot be verified — every claim is either accurate by coincidence or invented outright, and
there is no way to tell which.

This project takes a different approach. It treats investment research the way a research desk
actually operates: gather real data first, analyze it from multiple independent angles, argue
both sides of the investment case explicitly, and only then reach a verdict. The system is built
around a LangGraph.js state machine with distinct agent nodes, each responsible for one piece of
the analysis, feeding into a final judge node that weighs the evidence and produces a scored,
structured decision.

The result is not just an answer but a traceable one: every figure in the final scorecard can be
tied back to a specific data point or a specific stage of the debate, and the full execution
trace (which node ran, how long it took, what it returned) is available to inspect.

---

## How to run it

### Requirements
- Node.js 18 or later
- A Mistral API key (free tier is sufficient) — https://console.mistral.ai
- A Supabase project (free tier) — https://supabase.com, for authentication and report persistence

### Setup

1. Clone the repository and install dependencies:
   ```
   npm install
   ```

2. Create a `.env.local` file in the project root with the following values:
   ```
   MISTRAL_API_KEY="kelDfknw21U4XeA37m8GiBBYniOS5i8g"
   NEXT_PUBLIC_SUPABASE_URL="https://qanmmvpvfzwbtcappigc.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbm1tdnB2Znp3YnRjYXBwaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDMxNTQsImV4cCI6MjA5OTA3OTE1NH0.0cRA1NAVRaAIAIA56LtEdiK2LrwavOrxKqT8bfzk0oI"
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_ke
   ```

3. In your Supabase project, create a `reports` table with the following columns:
   - `id` (uuid, primary key)
   - `user_id` (uuid, foreign key to `auth.users`)
   - `company_name` (text)
   - `ticker` (text)
   - `created_at` (timestamp, default now())
   - `result` (jsonb) — stores the full graph output for that run

4. In Supabase's Authentication settings, add your local and deployed URLs to the allowed redirect
   URL list.

5. Run the development server:
   ```
   npm run dev
   ```

6. Open `http://localhost:3000`, register an account, and run an analysis.

No paid API access is required to run this project. All external services used are on free
tiers, which is discussed further under Key Decisions & Trade-offs below.

---

## How it works

### Architecture summary

The core of the system is a LangGraph.js graph with the following stages:

```
gatherData
    │
    ▼
Parallel research
  ├─ analyzeFundamentals
  ├─ analyzeSentiment
  └─ analyzeRiskCompetitive
    │
    ▼
Adversarial debate
  ├─ genBullCase
  └─ genBearCase
    │
    ▼
judge
```

**gatherData** resolves the company name to a stock ticker and pulls real market data — price,
market capitalization, P/E ratio, EPS, 52-week range, recent news headlines, sector and industry
classification, profit margins, debt-to-equity ratio, return on equity, current ratio, revenue
growth, and analyst recommendation trends — via `yahoo-finance2`.

**Three research nodes run concurrently**, each analyzing a distinct slice of the gathered data
and producing a structured, schema-validated output:
- `analyzeFundamentals` scores financial health from the raw numbers only
- `analyzeSentiment` scores recent news sentiment, with per-headline reasoning
- `analyzeRiskCompetitive` scores risk level and competitive moat, grounded specifically in
  debt ratios, margins, revenue growth, and analyst consensus data — not general knowledge about
  the industry

**Two debate nodes then run concurrently.** `genBullCase` is instructed to construct the
strongest possible argument for investing, and `genBearCase` the strongest possible argument
against, each constrained to cite only evidence produced by the three research nodes above. This
is a deliberate stress test: a single LLM pass tends to produce a hedged, non-committal answer
that quietly agrees with itself. Forcing two independent, fully-committed arguments and only then
weighing them against each other produces a more rigorous final decision and exposes tensions in
the evidence — for example, a company can be simultaneously exceptionally profitable and
significantly overvalued, and the debate structure surfaces that tension explicitly rather than
averaging it away.

**The judge node** reads both arguments plus all three research outputs and produces the final
verdict: Invest, Pass, or Watch, a confidence percentage, a five-dimension scorecard (financial
health, valuation, sentiment, moat, risk level), key catalysts, key risks, and a reasoning
statement that explicitly explains which side of the debate won and why.

Every node's output is constrained by a Zod schema and enforced through the model's structured
output mode, rather than free text parsed with regular expressions. This was not the original
implementation — see Key Decisions & Trade-offs for why it changed.

### Streaming and execution transparency

The graph is invoked with `.stream()` rather than `.invoke()`, so each node's result is pushed to
the frontend as soon as it completes rather than waiting for the entire pipeline to finish. The
user sees ticker data appear first, then each research section as it completes, then the debate,
then the final verdict — rather than a blank loading screen for the full run duration.

Each streamed chunk carries timing metadata. The results page includes a collapsible execution
trace showing exactly how long each node took and the total wall-clock time for the run, which
makes the multi-agent nature of the system directly observable rather than something the user has
to take on faith.

### Authentication and persistence

Authentication is handled through Supabase using `@supabase/ssr` for secure server-side session
handling, with Next.js middleware protecting the analyze and history routes. On successful
completion, a report's full result is saved to a Supabase table scoped to the logged-in user.
A history page lists past reports; opening one hydrates the results view directly from the saved
data rather than re-running the pipeline, which also serves as a fast, deterministic fallback if
live inference is slow or rate-limited during a demonstration.

### Design system

The interface follows a deliberate "research terminal" visual identity — a near-black background,
a single amber accent color reserved for the verdict and signature elements, monospace typography
for all financial data and figures, and a serif typeface for the long-form bull/bear/judge
reasoning to visually distinguish written argument from raw data. This was a specific choice
against the default dark-mode SaaS dashboard look, discussed further below.

### Prompt design

Each node's prompt is deliberately scoped to only the data relevant to its task, rather than
handing every node the full research context. This was a specific choice: a node that can see
everything tends to write a prompt-length answer that restates all of it, which defeats the point
of having separate nodes in the first place. Restricting each node's input forces its output to
be a genuine, narrow analysis rather than a summary of everything available.

**Fundamentals node** — sees only price, market cap, 52-week range, P/E, and EPS. Explicitly told
not to reference news or sentiment, since that is handled elsewhere:

```
You are a financial analyst. Analyze ONLY the numbers below for {companyName} ({ticker}).
Do not reference news or sentiment — that is handled separately.

Price: {price} {currency}
Market Cap: {marketCap}
52-Week High/Low: {fiftyTwoWeekHigh} / {fiftyTwoWeekLow}
Trailing P/E: {trailingPE}
EPS: {eps}

Every strength/concern must cite a specific number from above.
```

**Sentiment node** — sees only recent news headlines, mirroring the same restriction in the
opposite direction:

```
You are a market sentiment analyst. Analyze ONLY the news headlines below for {companyName}.
Do not reference financial ratios — that is handled separately.

News:
{headline list}

Score sentiment from -10 (very negative) to 10 (very positive), and explain the impact of
each key story.
```

**Risk and competitive-position node** — sees sector, industry, business description, and the
financial ratios most relevant to risk (debt-to-equity, current ratio, revenue growth, return on
equity, analyst recommendation trend), with an explicit instruction against speculating when a
data point is absent:

```
You are a risk and competitive-positioning analyst. Analyze {companyName} using ONLY the
data below. Every risk you cite must reference a specific data point — do not invent risks
from general knowledge of the industry.

Sector: {sector}
Industry: {industry}
Business description: {businessSummary}
Profit margins: {profitMargins}
Debt-to-equity: {debtToEquity}
Return on equity: {returnOnEquity}
Current ratio: {currentRatio}
Revenue growth: {revenueGrowth}
Analyst recommendation: {recommendationKey}
Analyst recommendation trend: {recommendationTrend}

If a field says "not available," do not speculate about it — note the absence instead.
```

**Bull and bear nodes** — structurally identical prompts with only the stance reversed, each
explicitly forbidden from softening its position and restricted to citing only the three research
outputs above, not outside knowledge:

```
You are a [bullish / skeptical] investment analyst. Using ONLY the research below, build the
STRONGEST possible case [FOR / AGAINST] investing in {companyName}. Do not soften your
argument — argue this side fully. You may only cite evidence that appears in the research
below.

Fundamentals analysis: {fundamentalsAnalysis}
Sentiment analysis: {sentimentAnalysis}
Risk and competitive analysis: {riskCompetitiveAnalysis}
```

**Judge node** — the only node that sees the full picture, specifically because its role is to
weigh everything the other nodes produced against each other:

```
You are the final decision-maker at an investment fund. Weigh the bull case against the bear
case for {companyName} and reach a verdict: Invest, Pass, or Watch.

Bull case: {bullCase}
Bear case: {bearCase}
Fundamentals: {fundamentalsAnalysis}
Sentiment: {sentimentAnalysis}
Risk and competitive: {riskCompetitiveAnalysis}

Score each scorecard dimension 0-10 independently, then give your verdict, confidence, and
reasoning that explicitly explains why the bull or bear case won out.
```

Every node's output is enforced through `.withStructuredOutput()` against a Zod schema rather
than parsed from free text — see Key Decisions & Trade-offs for why.

The prompts used to direct AI-assisted code generation (Antigravity) throughout the build are not
reproduced here, since they are lengthy and fully captured verbatim in the accompanying chat
transcripts submitted alongside this README.

---

## Key decisions & trade-offs

**Multi-agent LangGraph pipeline instead of a single prompt.**
A single prompt is faster to build and, most of the time, produces a plausible-sounding answer.
The problem is that "plausible-sounding" and "grounded" are not the same thing, and there is no
way to distinguish them from the output alone. Splitting the analysis into independent nodes,
each scoped to a narrow task with only the data relevant to that task, makes it possible to
verify what each stage actually saw and reasoned about, and makes partial failure recoverable —
if one research node fails, the others still complete rather than the entire request failing.
The trade-off is complexity: more code, more prompts to maintain, and a longer total run time
than a single call would take.

**Mistral instead of Anthropic, OpenAI, or Google Gemini.**
The initial plan used Google Gemini's free tier. In practice, the parallel fan-out structure
(three concurrent research calls, then two concurrent debate calls) triggered free-tier rate
limits reliably under repeated testing. Mistral's free tier handled this pattern more reliably in
practice for this project's request volume. Anthropic and OpenAI were not used because both
require paid API access with no ongoing free tier, and this project was built without a budget
for inference costs. A concurrency semaphore was added regardless, to cap simultaneous in-flight
requests and stay within free-tier limits predictably rather than relying on retries after a
failure.

**`yahoo-finance2` instead of a paid financial data provider.**
Yahoo Finance's underlying API is unofficial and undocumented, accessed here through a community
wrapper library. Paid providers such as Polygon or a licensed Bloomberg feed offer contractual
reliability guarantees that this does not. The trade-off was accepted deliberately: this project
had no budget for a paid data provider, and `yahoo-finance2` exposes a genuinely rich dataset —
not just price and P/E, but profit margins, debt-to-equity, revenue growth, and analyst
recommendation trends through its `quoteSummary` endpoint — which is what allows the risk and
competitive-moat scoring to be grounded in real figures rather than the model's general
impression of an industry. The risk this introduces is that Yahoo can change or restrict this
endpoint without notice, since it is not a documented, contracted API.

**Structured output via Zod schemas instead of prompted text formats.**
The first working version of the judge node asked the model to output a fixed text format
(`DECISION: ...` followed by `REPORT: ...`) and parsed it with a regular expression. This worked
until it didn't — a single deviation in the model's formatting broke the parser silently. Every
node was subsequently rewritten to use `.withStructuredOutput()` against an explicit Zod schema,
so the model's output is validated and typed at the API boundary rather than pattern-matched
after the fact. This is a small amount of additional upfront schema-writing in exchange for
eliminating an entire category of runtime parsing failure.

**Streaming responses instead of reducing actual latency.**
Given the free-tier constraint above, the pipeline's total run time (typically 20 to 30 seconds,
occasionally more under queued rate limits) was accepted as a fixed cost rather than something to
eliminate outright — doing so would have required paid inference or a materially simpler pipeline,
both of which were judged worse trade-offs than the delay itself. Instead, the system streams
each node's result as it completes, so the wait is filled with real, incrementally-appearing
content instead of a static loading indicator. A visible notice also explains the free-tier
concurrency constraint directly, rather than leaving the delay unexplained.

**In-memory TTL cache instead of Redis, for now.**
Repeated development testing on the same ticker would otherwise exhaust free-tier request quotas
quickly. A simple in-memory cache with a time-to-live was sufficient for this project's scope and
avoided adding an external dependency. This does not persist across serverless function
instances in a production deployment and would need to be replaced with a shared store such as
Upstash Redis or Vercel KV for genuine production use — the cache is intentionally written behind
a small function interface (`withCache`) so that substitution would not require touching the
calling code.

**Supabase instead of a custom authentication and database layer.**
Supabase provides authentication, a Postgres database, and row-level security in a single free
product, which matched this project's timeline better than standing up a separate auth provider
and database. The trade-off is vendor coupling — migrating off Supabase later would require
rebuilding both the auth and persistence layers, not just one.

**A distinctive visual identity instead of a generic dashboard template.**
Early versions of the interface used a near-black background with a purple accent and rounded,
soft-glow cards — a pattern common enough in AI-generated interfaces to read as a default rather
than a design decision. The interface was rebuilt around a specific point of view: this is a
research terminal, and it should look like one — monospace data, a single restrained accent
color, hairline borders, and terminal-style section labels, rather than a generic SaaS aesthetic
applied to a finance topic.

**What was intentionally left out.** SEC filing text (10-K risk factor sections) was considered
as an additional grounding source for the risk analysis node but not implemented, in favor of the
`quoteSummary` financial ratios and analyst data already available through the existing data
source, given the time available. A comparison mode across multiple companies, a follow-up
question-and-answer interface over a completed report, and a production-grade caching layer were
also scoped out for the same reason — each was judged to add less value than the time it would
cost, relative to hardening and testing what already existed.

---

## Example runs

**Apple (AAPL) — Watch, 75% confidence**

Scorecard: financial health 6/10, valuation 5/10, sentiment 8/10, moat 9/10, risk score 6/10.
The bull case emphasized Apple's scale and financial performance — a market capitalization above
4.6 trillion dollars, consistent EPS-driven profitability, and unwavering investor confidence
tied to its industry leadership. The bear case centered on valuation risk: a trailing P/E ratio
of 38.03, well above what the bear case characterized as sustainable levels, combined with the
stock trading near its 52-week high, leaving limited room for further upside and raising the
possibility of a near-term correction. The bear case also flagged deteriorating balance-sheet
health tied to Apple's debt position.
Unlike the earlier Invest verdict this system produced for Apple, this run resolved to a Watch
verdict at 75 percent confidence — the same company, evaluated at a different valuation level and
with slightly different sentiment and financial-health inputs, produced a genuinely different
recommendation rather than a fixed answer for a fixed company. This is itself a useful data point
for the write-up: the verdict is sensitive to real, current market conditions rather than the
model's fixed impression of "Apple" as a company.

**NVIDIA (NVDA) — Invest, 85% confidence**

Scorecard: financial health 8/10, valuation 7/10, sentiment 8/10, moat 9/10, risk score 5/10.
The bull case centered on Nvidia's dominant position in AI infrastructure and data centers, a
market capitalization exceeding 4.9 trillion dollars, and strong analyst confidence, arguing that
its leadership in high-margin, high-growth segments justifies a premium valuation rather than
signaling overvaluation. The bear case took the opposite reading of the same P/E ratio, arguing
the valuation is stretched to unsustainable levels, and raised concerns about financial leverage,
dependence on volatile high-growth end markets, and geopolitical exposure tied to semiconductor
supply chains. The judge weighed these against each other and concluded the moat and sentiment
strength outweighed the valuation risk, producing an Invest verdict at 85 percent confidence — its
highest-confidence verdict observed during testing.

**Aditya Birla Money (BIRLAMONEY.NS) — Pass, 80% confidence**

Scorecard: financial health 3/10, valuation 7/10, sentiment 7/10, moat 5/10, risk score 3/10.
This example demonstrates the system correctly separating valuation from financial health rather
than conflating them. The bull case pointed to a trailing P/E ratio of 13.82, well below sector
averages, and an EPS of 10.35, arguing the stock is undervalued relative to its earnings. The bear
case, however, cited a specific and severe figure from the underlying data: a debt-to-equity ratio
of 734.586, which it characterized as an extreme solvency risk capable of triggering financial
distress independent of how cheap the stock appears on an earnings basis. The judge's low
financial-health and risk scores reflect that this leverage concern outweighed the valuation
argument, resulting in a Pass verdict despite the stock looking statistically cheap. This is a
useful example of the risk/competitive node functioning as intended — the debt-to-equity figure
came directly from Yahoo Finance's financialData module, not from the model inferring risk from
general knowledge of the company.

---

## What I would improve with more time

- **Ground the risk analysis in primary filing text.** Pulling the "Risk Factors" section directly
  from a company's most recent 10-K via SEC EDGAR's full-text search would move risk scoring from
  inferred financial ratios to the company's own disclosed risk language, which is a stronger
  evidentiary basis.
- **Move to a shared cache and a paid or higher-limit inference tier for reliability.** The
  free-tier constraint is the single largest source of variable run time and the main reason the
  system takes 20 to 30 seconds rather than a more consistent 8 to 10. A modest inference budget
  would remove the concurrency semaphore's necessity almost entirely.
- **Add a small evaluation suite.** Running the pipeline against a fixed set of companies with
  known, human-reviewed expected characteristics (for example, confirming that a company with a
  debt-to-equity ratio above a given threshold is never scored as low-risk) would catch prompt
  regressions automatically rather than relying on manual spot-checking, which is how testing was
  done throughout this build.
- **Support follow-up questions against a completed report**, using LangGraph's memory and
  checkpointing to answer questions like "why did the bear case not win here" against the saved
  state of a specific run, rather than requiring a fresh analysis for every question.
- **Add a multi-company comparison mode**, running the same pipeline across two or three tickers
  and presenting their scorecards side by side, which was scoped out of this version to prioritize
  depth on a single-company analysis over breadth.
- **Broaden test coverage of edge cases** — tickers that fail to resolve, companies with sparse or
  missing `quoteSummary` data, and non-US-listed equities where Yahoo Finance's data completeness
  varies — beyond the manual testing performed during development.

---

## AI usage disclosure

This project was built in collaboration with AI throughout — both for architectural planning and
iterative debugging (Claude), and for direct code generation against detailed specifications
written for that purpose (Antigravity). The full chat transcripts documenting this process,
including the reasoning behind each architectural decision as it was made, are included alongside
this submission as requested.
