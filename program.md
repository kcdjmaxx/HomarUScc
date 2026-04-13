# Retrieval Boost Tuning

```yaml
target_file: src/memory-index.ts
eval_command: node evals/retrieval-boost-eval.mjs
metric_key: score
direction: maximize
max_experiments: 10
experiment_timeout: 60
metric_format: json_stdout
cooldown_seconds: 3
```

## Research Direction

Optimize the retrieval-weighted scoring boost in `src/memory-index.ts`. The boost is applied in the `search()` method after decay and dream scoring. It multiplies each result's score by `min(1 + log(count+1) * retrievalBoost, retrievalBoostCap)` where `count` is the number of times that path has been retrieved before.

The eval measures:
- **Latency** (30% weight): Search must stay under 200ms. Currently 111ms.
- **Score spread** (30% weight): The gap between top and bottom results. More spread = better discrimination.
- **Rank alignment** (30% weight): Whether top results match frequently-retrieved memories.
- **Utilization rate** (10% weight): What fraction of memories are being used.

Current baseline: 0.606. Current boost: 0.05, cap: 1.5.

Key weakness: rank alignment is only 6.7% — the boost isn't strong enough to meaningfully rerank results yet.

## Constraints

- Only modify the retrieval boost section in `search()` and the constructor defaults
- Do NOT modify the retrieval_log table, logRetrievals, or stats methods
- Do NOT modify other scoring (decay, dream, vector, FTS)
- Keep latency under 200ms — the getRetrievalCount query adds overhead per result
- The boost must have a hard cap to prevent popularity runaway

## Strategy

1. Increase boost factor from 0.05 to see if alignment improves
2. Try different log bases (log2, log10) for the boost curve
3. Try a recency-weighted boost (recent retrievals count more)
4. Batch the retrieval count query instead of per-result
5. Try a threshold approach: only boost if count > N
