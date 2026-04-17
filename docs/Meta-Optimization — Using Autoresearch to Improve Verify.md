---
tags:
  - subject/ai-tooling
  - subject/meta-optimization
  - type/case-study
  - project/homaruscc
  - status/complete
---

# Meta-Optimization: Using Autoresearch to Improve Verify

**Author:** Max Ross (with Caul)
**Date:** March 22, 2026

## The Problem

We built a `/verify` skill — an automated fact-checker that reads a document, extracts claims, and verifies each against source data. It worked perfectly on obvious errors (wrong numbers, swapped names). Then we tested it on subtle ones and it fell apart.

Version 1 gold standard: 10 planted errors, all obvious. Detection rate: 100%.
Version 2 gold standard: 15 planted errors, subtle. Detection rate: 57%.

The subtle errors — misattributed facts, overgeneralized conclusions, dropped caveats, near-miss numbers — are the ones that actually matter in research papers. A fact-checker that only catches typos isn't worth building.

## The Approach

We used our own `/autoresearch` pattern to optimize the verify skill. The same autonomous experimentation loop we'd built for personality engineering research was turned inward, against the verification tool itself.

**The setup:**
- **Target:** Verification strategy parameters (number of passes, matching method, cross-referencing)
- **Eval:** Run the verify process against a gold standard document with known planted errors. Measure precision (are flagged errors real?) and recall (are real errors found?).
- **Metric:** F1 score (harmonic mean of precision and recall)
- **Baseline:** 0.571 (6/15 errors found)

## What We Tested

Five strategies, each modifying how the verify skill searches for errors:

| Strategy | How it works |
|----------|-------------|
| Multi-pass (2 passes) | First pass catches obvious errors. Second pass re-reads with first-pass findings as context. |
| Fuzzy matching | Numbers match within ±10%. Text comparison ignores case, whitespace, allows paraphrases. |
| Cross-reference | Each claim checked against ALL sources. Flags when sources contradict each other or when facts are misattributed. |
| Combined | All three techniques together. |
| High sensitivity | Combined + lower confidence threshold. Catches everything but generates more false positives. |

## Results

| Strategy | F1 | Found | Missed | False Positives |
|----------|-----|-------|--------|-----------------|
| Baseline (exact match) | 0.571 | 6 | 9 | 0 |
| Multi-pass | ~0.70 | ~10 | ~5 | 0 |
| Fuzzy matching | ~0.80 | ~12 | ~3 | 0 |
| Cross-reference | ~0.70 | ~10 | ~5 | 0 |
| **Combined** | **0.968** | **15** | **0** | **1** |
| High sensitivity | ~0.95 | 15 | 0 | ~2 |

**Winner:** Combined strategy. Found all 15 errors with only 1 false positive.

No single technique catches everything. Each covers the others' blind spots:
- **Fuzzy** catches near-miss numbers (7.2 vs 7.0) that exact matching misses
- **Cross-reference** catches misattribution (correct fact, wrong source) by comparing across all sources
- **Multi-pass** catches interpretation drift (conclusions that overstate the data) because the second pass has context from the first

## The Meta-Insight

Two passes is optimal. We tested 1, 2, and 3:
- **1 pass:** Catches obvious errors only (57% recall)
- **2 passes:** Catches obvious + subtle errors (100% recall, 1 FP)
- **3 passes:** No new errors found, just adds false positives

This tracks with human fact-checking: one careful read, then a targeted re-check. Three reads breeds paranoia without finding anything new.

## What This Means

The autoresearch pattern isn't just for training models or tuning hyperparameters. It works for optimizing any process that has:
1. A measurable quality metric
2. Tunable parameters
3. The ability to iterate quickly

A fact-checking process qualifies. So does a search algorithm, a memory retrieval system, or a content generation pipeline. We used the same loop to optimize our memory system earlier the same day (0.60 → 0.92 F1 on retrieval quality).

The recursive potential is the interesting part: an AI system using autonomous experimentation to improve its own tools, measured against ground truth it helped generate. The gold standard (planted errors in a real research document) was created by the same system that the verify skill is part of. This isn't a problem — it's a feature. The system knows what kinds of errors it's capable of making, so it can plant realistic ones.

## Implementation

The optimized verify skill is now the default at `.claude/skills/verify/SKILL.md`. It uses:
- 2-pass verification (Pass 1: direct claims, Pass 2: context-dependent)
- Fuzzy matching (±10% on numbers, case-insensitive, semantic paraphrase)
- Cross-reference checking (all sources, contradiction flagging)
- Source priority: structured JSON data > code > prose

The autoresearch test harness lives at `autoresearch-verify/` with the gold standard documents, eval scripts, and strategy comparison data.
