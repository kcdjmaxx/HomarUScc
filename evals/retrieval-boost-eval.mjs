#!/usr/bin/env node
// Eval for retrieval-weighted scoring boost
// Measures: search quality stability, rank improvement of known-useful results, latency impact

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
  const start = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  const elapsed = Date.now() - start;
  const data = await res.json();
  return { text: data.content?.[0]?.text ?? "", elapsed };
}

async function getHealth() {
  const res = await fetch("http://127.0.0.1:3120/api/memory-health");
  return await res.json();
}

function parseResults(text) {
  return text.split("\n\n---\n\n").map(block => {
    const match = block.match(/^\[(\d+)\]\s+(.+?)\s+\(score:\s+([\d.]+)\)/);
    if (!match) return null;
    return { rank: parseInt(match[1]), path: match[2], score: parseFloat(match[3]) };
  }).filter(Boolean);
}

async function runEval() {
  const health = await getHealth();
  const latencies = [];
  const rankStability = [];
  const scoreDistribution = [];

  for (const query of TEST_QUERIES) {
    const { text, elapsed } = await callTool("memory_search", { query, limit: 5, detail: "index" });
    latencies.push(elapsed);

    const results = parseResults(text);
    if (results.length === 0) continue;

    // Score spread: good boosting should widen the gap between relevant and irrelevant
    const scores = results.map(r => r.score);
    const spread = scores.length > 1 ? scores[0] - scores[scores.length - 1] : 0;
    scoreDistribution.push(spread);

    // Check if top result is a frequently-retrieved memory (validates boost is working)
    const topPath = results[0]?.path;
    const topInMostRetrieved = health.topRetrieved?.some(t =>
      topPath && (t.path.includes(topPath) || topPath.includes(t.path))
    );
    rankStability.push(topInMostRetrieved ? 1 : 0);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const avgSpread = scoreDistribution.reduce((a, b) => a + b, 0) / scoreDistribution.length;
  const avgRankAlignment = rankStability.reduce((a, b) => a + b, 0) / rankStability.length;

  // Latency penalty: each ms over 200ms reduces score
  const latencyScore = Math.max(0, 1 - Math.max(0, avgLatency - 200) / 1000);

  // Score spread reward: more spread = better discrimination
  const spreadScore = Math.min(avgSpread / 0.2, 1);

  // Rank alignment: how often do top results match frequently-retrieved memories
  const alignmentScore = avgRankAlignment;

  // Utilization: what fraction of memories are actually being used
  const utilizationScore = Math.min(health.utilizationRate ?? 0, 1);

  // Combined score
  const score = latencyScore * 0.3 + spreadScore * 0.3 + alignmentScore * 0.3 + utilizationScore * 0.1;

  console.log(JSON.stringify({
    score,
    metrics: {
      avgLatencyMs: avgLatency,
      latencyScore,
      avgScoreSpread: avgSpread,
      spreadScore,
      rankAlignment: avgRankAlignment,
      alignmentScore,
      utilizationRate: health.utilizationRate,
      queriesTested: TEST_QUERIES.length,
    },
  }, null, 2));
}

runEval().catch(err => {
  console.error("Eval failed:", err);
  process.exit(1);
});
