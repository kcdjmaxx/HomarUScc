---
name: verify
description: Fact-check a document against source data using 2-pass claim extraction and verification. Produces an errata report (markdown) with claim-by-claim verdicts and optionally applies corrections to the source document. TRIGGER when user says "verify this", "fact-check", "check accuracy", "is this correct", or wants to validate claims in a document against ground truth. Invoked with /verify.
---

# Verify

Automated fact-checking loop that verifies claims in a document against source data. Produces an errata report listing what's correct, incorrect, and unverifiable. Optionally applies corrections.

## Usage

```
/verify                         -- verify target document using ./verify.md config
/verify --report-only           -- produce errata report without applying corrections
/verify --apply                 -- apply corrections from existing errata
/verify <path>                  -- verify a specific file (looks for verify.md in same dir)
```

## Prerequisites

The current working directory (or the target file's directory) must contain a `verify.md` file with configuration.

## verify.md Format

```yaml
target: RESULTS.md                    # Document to fact-check
sources:                              # Source(s) of truth — prose and/or structured data
  - experiment-log.md                 # Prose source
  - .autoresearch/results-data.json   # Structured data source (authoritative for numbers)
  - eval.py                           # Code source (methodology verification)
errata: ERRATA.md                     # Where to write the errata report
claim_types:                          # What kinds of claims to check
  - numbers                           # Specific numbers, percentages, counts
  - names                             # Names, labels, identifiers
  - methodology                       # Process descriptions, how things were done
  - conclusions                       # Logical conclusions drawn from data
auto_apply: false                     # If true, apply corrections without asking
```

### Source Priority

When a claim can be checked against multiple sources, use this priority:
1. **Structured data (JSON)** — authoritative for numerical claims. If results-data.json says consistency=0.8 and experiment-log.md says 1.0, the JSON wins.
2. **Code** — authoritative for methodology claims. If the document says "5 runs per experiment" and eval.py shows RUNS=5, the code wins.
3. **Prose sources** — for narrative context, conclusions, and interpretations.

For numerical claims, ALWAYS check structured data first. Only fall back to prose sources if no structured data exists.

## How It Works

### Phase 1: Claim Extraction

Read the target document. Extract every factual claim — anything that can be verified or falsified. For each claim, note:
- The claim text (verbatim quote from the document)
- The line number or section
- The claim type (number, name, methodology, conclusion)
- What source should contain the ground truth

### Phase 2: Verification (2-pass, fuzzy + cross-reference)

**Default strategy: Combined** (optimized via autoresearch meta-eval, F1=0.968 on subtle error detection).

**Pass 1:** For each extracted claim, search ALL source files using fuzzy matching:
- Numbers: match within ±10% tolerance (catches 7.2 vs 7.0)
- Text: case-insensitive, ignore whitespace differences, match semantic paraphrases
- Cross-reference: check each claim against ALL sources, flag when sources contradict each other or when a fact is attributed to the wrong source

**Pass 2:** Re-read the document with Pass 1 findings as context. Look for:
- Interpretation drift: conclusions that overstate the data (e.g., "all models" when only 2/3 showed the pattern)
- Omission errors: important caveats or qualifications that were dropped
- Dependent errors: claims that become wrong because they depend on a Pass 1 error

Two passes is optimal. Testing showed 3+ passes add false positives without catching new real errors.

For each claim, classify as:

| Status | Meaning |
|--------|---------|
| CORRECT | Claim matches source data exactly |
| INCORRECT | Claim contradicts source data — note what the source says |
| IMPRECISE | Claim is close but not exact (rounded number, paraphrase) |
| UNVERIFIABLE | No source data found to check against |
| INFERRED | Claim is a reasonable inference but not directly stated in source |

### Phase 3: Errata Report

Write the errata file with all claims and their verification status:

```markdown
# Errata Report: [target file]
**Verified:** YYYY-MM-DD
**Source(s):** [list]

## Summary
- X claims extracted
- Y correct, Z incorrect, W imprecise, V unverifiable

## Incorrect Claims
| Line | Claim | Source Says | Fix |
|------|-------|------------|-----|
| 42 | "consistency of 1.0 across all models" | Llama: 1.0, Mistral: 0.8, Qwen: 1.0 | "consistency of 1.0 on Llama and Qwen, 0.8 on Mistral" |

## Imprecise Claims
...

## Correct Claims (summary)
...

## Unverifiable Claims
...
```

### Phase 4: Correction (if auto_apply or --apply)

For each INCORRECT claim:
1. Show the user the claim, the source truth, and the proposed fix
2. If auto_apply: apply the fix directly
3. If not: wait for user approval before each fix
4. Never change style, structure, or add new content — only fix factual errors

### Phase 5: Re-verify

After applying corrections, re-run Phase 2 on the corrected document to confirm all fixes are accurate. Report the final accuracy.

## Key Principles

1. **Conservative corrections only.** Fix facts, not style. If a sentence is awkwardly worded but factually correct, leave it.
2. **Cite your sources.** Every verification must reference which source file and what it says.
3. **Flag uncertainty.** If you can't verify a claim, say so. Don't guess.
4. **Preserve the author's voice.** Corrections should use the same language style as the original.
5. **No scope creep.** Don't add new claims, reorganize sections, or improve the document beyond factual accuracy.

## Example Workflow

```
$ cd ~/research/enneagram-study/autoresearch-personality/
$ cat verify.md
target: RESULTS.md
sources:
  - experiment-log.md
errata: ERRATA.md
claim_types: [numbers, names, methodology, conclusions]
auto_apply: false

$ /verify
Extracting claims from RESULTS.md...
Found 47 verifiable claims.
Checking against experiment-log.md...

Results:
  41 CORRECT
  3 INCORRECT
  2 IMPRECISE
  1 UNVERIFIABLE

Errata written to ERRATA.md.
Apply corrections? (review ERRATA.md first, then run /verify --apply)
```

## Integration with Autoresearch

After an autoresearch experiment produces a results document:
1. Run `/verify` to fact-check the generated results
2. Review the errata
3. Apply corrections with `/verify --apply`
4. Re-run to confirm 100% accuracy

This closes the loop: autoresearch generates findings → verify ensures accuracy → corrections applied → verified document ready for publication.
