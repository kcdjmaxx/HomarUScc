---
name: autoresearch
description: Autonomous experimentation loop that iteratively improves a target file. Produces experiments.jsonl log and structured results-data.json. TRIGGER when user says "optimize", "experiment with", "try variations of", "autoresearch", "run experiments on", or wants to iteratively improve code/config. Invoked with /autoresearch.
---

# Autoresearch

Autonomous experimentation loop that iteratively improves a target file by forming hypotheses, making changes, evaluating results, and keeping only what works. The human "programs" the agent by writing a `program.md` file that describes the research direction.

## Usage

```
/autoresearch                    -- start the experiment loop using ./program.md
/autoresearch --resume           -- resume from where the last session left off
/autoresearch --status           -- show experiment history and current baseline
/autoresearch --dry-run          -- parse program.md and show config without running
```

## Prerequisites

The current working directory must contain a `program.md` file. This file is the human's instruction document -- it tells the agent what to optimize, how to evaluate, and what strategies to explore. See the "program.md Format" section below for the required structure.

## How It Works

### Step 1: Parse program.md

Read `program.md` from the current working directory. Extract the configuration block (YAML fenced block near the top) and the research direction prose.

Required configuration fields:

```yaml
target_file: train.py              # The single file the agent modifies
eval_command: python train.py      # Command that runs the experiment
metric_key: val_loss               # JSON key to extract from eval output
direction: minimize                # "minimize" or "maximize"
max_experiments: 50                # Stop after this many experiments
experiment_timeout: 300            # Max seconds per experiment run
```

Optional configuration fields:

```yaml
baseline_command: null             # If set, run this once to establish baseline (otherwise first eval_command run is baseline)
metric_format: json_stdout         # "json_stdout" (default), "json_file:<path>", or "last_line"
git_branch: autoresearch           # Branch name for experiments (default: autoresearch/<timestamp>)
preserve_on_fail: false            # If true, don't revert failed experiments (for debugging)
cooldown_seconds: 5                # Pause between experiments (default: 5)
```

If any required field is missing, tell the user and stop.

### Step 2: Initialize State

Create a `.autoresearch/` directory in the current working directory if it does not exist.

**Files in `.autoresearch/`:**

- `config.json` -- Parsed configuration from program.md, frozen at session start
- `baseline.json` -- Current best metric value and the experiment that set it
- `experiments.jsonl` -- Append-only log, one JSON object per line per experiment
- `results-data.json` -- Structured results array: raw eval output from each experiment. This is the canonical source of truth for numerical claims. Verify can check prose documents against this file.

**Git setup:**

1. Verify the current directory is a git repo (if not, run `git init`)
2. Ensure the working tree is clean (if not, warn the user and stop)
3. Create and checkout a new branch: `autoresearch/<YYYYMMDD-HHMMSS>`
4. The main/master branch is the safe fallback -- never modify it directly

### Step 3: Establish Baseline

If `.autoresearch/baseline.json` exists and `--resume` was used, load it and skip this step.

Otherwise:

1. Read the current target file
2. Run `eval_command` (or `baseline_command` if specified)
3. Extract the metric value from the output
4. Save to `.autoresearch/baseline.json`:

```json
{
  "metric_key": "val_loss",
  "value": 1.234,
  "direction": "minimize",
  "experiment_id": 0,
  "timestamp": "2026-03-19T14:30:00Z"
}
```

5. Log as experiment 0 in `experiments.jsonl`
6. Commit the initial state: `git commit -am "autoresearch: baseline <metric>=<value>"`
7. Report the baseline to the user

### Step 4: Experiment Loop

Repeat until `max_experiments` is reached or the user interrupts:

#### 4a. Read Context

- Read `program.md` (re-read each iteration -- the human may update it mid-run)
- Read the current target file
- Read the last 10 experiments from `experiments.jsonl` to understand what has been tried
- Read `baseline.json` for the current best

#### 4b. Form Hypothesis

Based on the research direction in `program.md`, the current code, and the history of what has been tried (and what worked vs. failed), form a specific hypothesis:

```
Hypothesis: Increasing the learning rate warmup from 100 to 500 steps will improve
convergence because the current warmup is too short for the batch size, causing
early instability that compounds into a higher final loss.
```

The hypothesis MUST be:
- Specific (not "try different hyperparameters")
- Testable (one change that can be evaluated)
- Informed by prior experiments (don't repeat failed approaches unless with a meaningful variation)

#### 4c. Make the Change

Edit the target file to implement the hypothesis. Make the minimal change needed to test the hypothesis. Do NOT refactor, clean up, or make unrelated changes.

After editing, verify the file is syntactically valid:
- Python: `python -c "import ast; ast.parse(open('<file>').read())"`
- JavaScript/TypeScript: `node --check <file>` or `npx tsc --noEmit`
- Other: skip syntax check

If syntax check fails, fix the syntax error. If it still fails after one retry, revert and log as a failed experiment with reason "syntax_error".

#### 4d. Run Evaluation

Run `eval_command` with a timeout of `experiment_timeout` seconds.

**Extracting the metric:**

- `json_stdout` (default): The eval command prints JSON to stdout. Parse it and extract `metric_key`. If the output contains multiple JSON objects, use the last one. If stdout is not valid JSON, look for a line matching `{.*"<metric_key>".*}` and parse that.
- `json_file:<path>`: Read the JSON file at `<path>` after the command completes.
- `last_line`: The last line of stdout is the metric value (parse as float).

If the eval command fails (non-zero exit, timeout, or metric not found):
- Revert the change: `git checkout -- <target_file>`
- Log the experiment as failed with the error details
- Continue to the next experiment

#### 4e. Compare and Decide

Compare the new metric value against `baseline.json`:

- If `direction` is "minimize": improvement = new_value < baseline_value
- If `direction` is "maximize": improvement = new_value > baseline_value

**If improved:**
1. Update `baseline.json` with the new value
2. Commit the change: `git commit -am "autoresearch: exp <N> -- <metric>=<new_value> (was <old_value>) -- <short hypothesis>"`
3. Report the improvement to the user

**If NOT improved (or equal):**
1. Revert the change: `git checkout -- <target_file>`
2. Do NOT update baseline
3. Report the result to the user

#### 4f. Log the Experiment

Append to `.autoresearch/experiments.jsonl`:

```json
{
  "id": 1,
  "timestamp": "2026-03-19T14:35:00Z",
  "hypothesis": "Increase learning rate warmup from 100 to 500 steps",
  "change_summary": "Modified warmup_steps parameter in train.py line 42",
  "metric_value": 1.198,
  "baseline_value": 1.234,
  "improved": true,
  "kept": true,
  "duration_seconds": 287,
  "error": null
}
```

Also append the raw eval output to `.autoresearch/results-data.json` (create if missing, maintain as a JSON array):
```json
[
  { "experiment_id": 1, "timestamp": "...", "raw_eval_output": { /* full JSON from eval_command */ }, "hypothesis": "..." }
]
```
This structured data file is the canonical source of truth. When a prose results document is written, the /verify skill can check it against results-data.json for numerical accuracy.
```

For failed experiments:

```json
{
  "id": 2,
  "timestamp": "2026-03-19T14:41:00Z",
  "hypothesis": "Switch optimizer from AdamW to LAMB",
  "change_summary": "Replaced optimizer class in train.py lines 80-95",
  "metric_value": null,
  "baseline_value": 1.198,
  "improved": false,
  "kept": false,
  "duration_seconds": 45,
  "error": "RuntimeError: LAMB optimizer requires gradient clipping"
}
```

#### 4g. Cooldown

Wait `cooldown_seconds` before starting the next experiment. During cooldown, commit the updated `experiments.jsonl` and `baseline.json` if they changed.

### Step 5: Report Final Results

When the loop ends (max_experiments reached or user interrupt), output a summary:

```
## Autoresearch Complete

- Experiments run: 50
- Improvements found: 8
- Failed experiments: 3
- Starting baseline: val_loss = 1.234
- Final baseline: val_loss = 0.987 (20.0% improvement)
- Branch: autoresearch/20260319-143000

### Improvements (chronological)
1. Exp 1: Increased warmup steps 100->500 -- val_loss 1.234 -> 1.198
2. Exp 5: Added gradient clipping at 1.0 -- val_loss 1.198 -> 1.156
...

### Notable Failed Experiments
- Exp 2: LAMB optimizer -- RuntimeError (requires gradient clipping)
- Exp 7: Doubled batch size -- val_loss 1.156 -> 1.289 (regression)
```

## Error Handling

- **eval_command not found**: Stop and tell the user. Do not guess.
- **target_file not found**: Stop and tell the user.
- **Git conflicts**: Should not happen (single-file, single-branch). If they do, `git checkout --theirs` and continue.
- **Repeated failures**: If 5 consecutive experiments fail (error, not just non-improvement), pause and ask the user if they want to continue or adjust program.md.
- **Disk space**: Not monitored. If writes fail, stop gracefully.

## Metric Extraction Details

The eval command must output the metric in one of these formats. Examples:

**json_stdout (default):**
```bash
# Eval command outputs:
{"val_loss": 1.234, "train_loss": 1.100, "epoch": 10}
```

**json_file:**
```yaml
metric_format: json_file:results/metrics.json
```

**last_line:**
```yaml
metric_format: last_line
# Eval command outputs:
Training complete.
Final validation loss: 1.234
1.234          # <-- this line is parsed as the metric
```

## Safety Guarantees

1. The original code is always on main/master. The experiment branch can be deleted safely.
2. Every improvement is committed. You can `git log` to see the full history.
3. Failed experiments are reverted immediately. The working tree never stays in a broken state.
4. The `.autoresearch/experiments.jsonl` log is append-only and never modified.
5. `program.md` is never modified by the agent.

## --status Command

When invoked with `--status`, read `.autoresearch/` and display:

```
## Autoresearch Status

Baseline: val_loss = 0.987 (set by experiment 12)
Total experiments: 24
Improvements: 8 | Regressions: 13 | Errors: 3
Branch: autoresearch/20260319-143000
Last experiment: 2 hours ago

Recent experiments:
  #24 [kept]     val_loss 0.991 -> 0.987  "Reduce weight decay to 0.01"
  #23 [reverted] val_loss 0.991 -> 1.002  "Switch to cosine annealing with restarts"
  #22 [error]    timeout after 300s       "Triple the model dimension"
```

## program.md Format

The program.md file has two sections: a YAML config block and free-form research direction prose.

````markdown
# My Experiment

```yaml
target_file: train.py
eval_command: python train.py
metric_key: val_loss
direction: minimize
max_experiments: 50
experiment_timeout: 300
```

## Research Direction

<Free-form prose that guides the agent's hypothesis generation. This is where
the human "programs" the agent. Be as specific or as open-ended as you like.>

## Constraints

<Optional: things the agent should NOT change or must preserve.>

## Strategy

<Optional: prioritized list of approaches to try first.>
````

---

## Examples

See the `examples/` directory in this skill folder for 4 reference program.md files:
- ML training optimization (Python)
- API performance optimization (Node.js)
- Prompt engineering (zero-shot classification)
- Build time reduction (webpack)
