#!/usr/bin/env node
// Eval script for progressive disclosure search quality
// Measures: token reduction, first-sentence informativeness, path coverage

const API = "http://127.0.0.1:3120/api/tool-call";

const TEST_QUERIES = [
  "user preferences communication style",
  "morning briefing timer",
  "gmail imap connection",
  "sqlite-vec embedding binding",
  "telegram bot token",
  "zoho calendar api",
  "dream cycle overnight",
  "prediction error logging",
  "identity soul file",
  "fric and frac restaurant",
  "eth trading strategy",
  "compaction identity files",
  "hiring pipeline applicant",
  "needoh inventory target",
  "sonic pi music",
];

async function callTool(name, args) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

function countTokensApprox(text) {
  return Math.ceil(text.length / 4);
}

function scoreFirstSentence(indexLine, fullLine) {
  if (!indexLine || !fullLine) return 0;
  // Extract just the content (after the path/score header)
  const indexContent = indexLine.split("\n").slice(1).join(" ").trim();
  const fullContent = fullLine.split("\n").slice(1).join(" ").trim();

  if (!indexContent) return 0;

  // Penalty: starts with metadata/headers (not informative)
  const metaPatterns = [/^#/, /^\|/, /^---/, /^```/, /^\*\*[A-Z]/, /^- \*\*/];
  const startsWithMeta = metaPatterns.some(p => p.test(indexContent));

  // Reward: contains actual content words (not just punctuation/formatting)
  const contentWords = indexContent.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(w => w.length > 3);
  const wordRichness = Math.min(contentWords.length / 8, 1);

  // Reward: sentence ends with proper punctuation
  const hasEndPunct = /[.!?]$/.test(indexContent.trim());

  // Reward: index content captures key terms from full content
  const fullWords = new Set(fullContent.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const indexWords = indexContent.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const overlap = indexWords.filter(w => fullWords.has(w)).length;
  const keyTermCoverage = fullWords.size > 0 ? Math.min(overlap / Math.min(fullWords.size, 5), 1) : 0;

  let score = 0;
  score += startsWithMeta ? 0 : 0.25;  // No metadata prefix
  score += wordRichness * 0.25;         // Rich content words
  score += hasEndPunct ? 0.15 : 0;      // Proper sentence ending
  score += keyTermCoverage * 0.35;      // Key term coverage

  return score;
}

async function runEval() {
  const results = {
    queries: TEST_QUERIES.length,
    tokenReduction: [],
    sentenceScores: [],
    errors: [],
  };

  for (const query of TEST_QUERIES) {
    try {
      const [indexResult, fullResult] = await Promise.all([
        callTool("memory_search", { query, limit: 5, detail: "index" }),
        callTool("memory_search", { query, limit: 5, detail: "full" }),
      ]);

      const indexTokens = countTokensApprox(indexResult);
      const fullTokens = countTokensApprox(fullResult);
      const reduction = fullTokens > 0 ? 1 - indexTokens / fullTokens : 0;
      results.tokenReduction.push(reduction);

      // Score each result's first sentence quality
      const indexBlocks = indexResult.split("\n\n---\n\n");
      const fullBlocks = fullResult.split("\n\n---\n\n");
      const pairCount = Math.min(indexBlocks.length, fullBlocks.length);

      for (let i = 0; i < pairCount; i++) {
        const score = scoreFirstSentence(indexBlocks[i], fullBlocks[i]);
        results.sentenceScores.push(score);
      }
    } catch (err) {
      results.errors.push({ query, error: String(err) });
    }
  }

  // Compute aggregate metrics
  const avgReduction = results.tokenReduction.reduce((a, b) => a + b, 0) / results.tokenReduction.length;
  const avgSentenceScore = results.sentenceScores.reduce((a, b) => a + b, 0) / results.sentenceScores.length;
  const minSentenceScore = Math.min(...results.sentenceScores);

  // Combined score (0-1): weighted average
  const combinedScore = avgReduction * 0.4 + avgSentenceScore * 0.5 + (minSentenceScore > 0.3 ? 0.1 : 0);

  const report = {
    score: combinedScore,
    metrics: {
      avgTokenReduction: avgReduction,
      avgSentenceQuality: avgSentenceScore,
      minSentenceQuality: minSentenceScore,
      queriesTested: results.queries,
      sentencesScored: results.sentenceScores.length,
      errors: results.errors.length,
    },
    detail: {
      tokenReductions: results.tokenReduction.map((r, i) => ({
        query: TEST_QUERIES[i],
        reduction: `${(r * 100).toFixed(1)}%`,
      })),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  return report;
}

runEval().catch(err => {
  console.error("Eval failed:", err);
  process.exit(1);
});
