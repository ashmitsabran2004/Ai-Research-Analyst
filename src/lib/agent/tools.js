import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export async function gatherFinancialData(companyName) {
  try {
    const searchResults = await yahooFinance.search(companyName);
    const bestMatch = searchResults.quotes.find(q => q.quoteType === 'EQUITY');

    if (!bestMatch) {
      return { error: `Could not find a public stock ticker for ${companyName}.` };
    }

    const ticker = bestMatch.symbol;
    const quote = await yahooFinance.quote(ticker);

    let profile = {};
    try {
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryProfile', 'financialData', 'recommendationTrend'],
      });

      profile = {
        sector: summary.summaryProfile?.sector,
        industry: summary.summaryProfile?.industry,
        businessSummary: summary.summaryProfile?.longBusinessSummary,
        fullTimeEmployees: summary.summaryProfile?.fullTimeEmployees,
        profitMargins: summary.financialData?.profitMargins,
        debtToEquity: summary.financialData?.debtToEquity,
        returnOnEquity: summary.financialData?.returnOnEquity,
        currentRatio: summary.financialData?.currentRatio,
        revenueGrowth: summary.financialData?.revenueGrowth,
        recommendationKey: summary.financialData?.recommendationKey,
        targetMeanPrice: summary.financialData?.targetMeanPrice,
        recommendationTrend: summary.recommendationTrend?.trend?.map(t => ({
          period: t.period,
          strongBuy: t.strongBuy,
          buy: t.buy,
          hold: t.hold,
          sell: t.sell,
          strongSell: t.strongSell,
        })),
      };
    } catch (enrichError) {
      console.error("quoteSummary enrichment failed (non-fatal):", enrichError.message);
    }

    const news = searchResults.news || [];

    return {
      ticker,
      name: quote.longName || quote.shortName || companyName,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      currency: quote.currency,
      marketCap: quote.marketCap,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      trailingPE: quote.trailingPE,
      forwardPE: quote.forwardPE,
      eps: quote.epsTrailingTwelveMonths,
      news: news.slice(0, 5).map(n => ({ title: n.title, publisher: n.publisher, link: n.link })),
      ...profile,
    };
  } catch (error) {
    console.error("Error gathering data:", error);
    return { error: error.message };
  }
}
