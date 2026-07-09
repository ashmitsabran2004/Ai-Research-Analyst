import { z } from "zod";

export const RiskCompetitiveAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of competitive position and risk profile"),
  riskLevel: z.number().min(0).max(10).describe("10 = very low risk, 0 = very high risk"),
  moatScore: z.number().min(0).max(10).describe("Durability of competitive advantage, 0-10"),
  marketPosition: z.enum(["leader", "strong-challenger", "niche-player", "laggard"]),
  keyRisks: z.array(
    z.object({
      risk: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      source: z.string().describe("Which data point this risk was inferred from, e.g. 'debt-to-equity of 1.8' or 'analyst downgrade trend'"),
    })
  ),
  analystConsensusNote: z.string().describe("Plain-English read of the recommendationTrend/recommendationKey data, or 'No analyst data available' if absent"),
});

export const FundamentalsAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence plain-English summary of financial health"),
  score: z.number().min(0).max(10).describe("Financial health score, 0-10"),
  strengths: z.array(z.string()).describe("Specific cited strengths, e.g. 'P/E of 13.7 is below sector average'"),
  concerns: z.array(z.string()).describe("Specific cited concerns"),
});

export const SentimentAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of recent news sentiment"),
  score: z.number().min(-10).max(10).describe("Sentiment score, -10 (very negative) to 10 (very positive)"),
  keyStories: z.array(
    z.object({
      headline: z.string(),
      impact: z.enum(["positive", "negative", "neutral"]),
      reasoning: z.string(),
    })
  ),
});

export const CaseArgumentSchema = z.object({
  argument: z.string().describe("The strongest version of this case in 3-5 sentences"),
  supportingPoints: z.array(z.string()).describe("Specific evidence points drawn only from the research provided"),
});

export const FinalDecisionSchema = z.object({
  verdict: z.enum(["Invest", "Pass", "Watch"]),
  confidence: z.number().min(0).max(100).describe("Confidence in this verdict, 0-100"),
  reasoning: z.string().describe("Core reasoning, explicitly weighing the bull case against the bear case"),
  scorecard: z.object({
    financialHealth: z.number().min(0).max(10),
    valuation: z.number().min(0).max(10),
    sentiment: z.number().min(0).max(10),
    moat: z.number().min(0).max(10),
    riskLevel: z.number().min(0).max(10).describe("10 = very low risk, 0 = very high risk"),
  }),
  keyCatalysts: z.array(z.string()),
  keyRisks: z.array(z.string()),
});
