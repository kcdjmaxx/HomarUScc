# Progressive Disclosure Search — extractSentences Optimization

```yaml
target_file: src/mcp-tools.ts
eval_command: node evals/progressive-disclosure-eval.mjs
metric_key: score
direction: maximize
max_experiments: 15
experiment_timeout: 60
metric_format: json_stdout
cooldown_seconds: 3
```

## Research Direction

Optimize the `extractSentences` function in `src/mcp-tools.ts` (defined near the top of the file, before `createMcpTools`). This function extracts a compact first-sentence summary from memory search result content. It is used by the progressive disclosure search feature to reduce token usage by ~60-70%.

The eval measures three things weighted into a combined score (0-1):
- **Token reduction** (40% weight): How much smaller is "index" mode vs "full" mode
- **Sentence quality** (50% weight): Does the extracted sentence contain informative content words, avoid metadata noise, end with proper punctuation, and cover key terms from the full content
- **Floor quality** (10% bonus): Whether the worst extraction is still above 0.3 quality

Current baseline: 0.612. Key weaknesses to address:

1. **Markdown tables**: Content starting with `|` pipes gets included as "prose" — should be skipped or summarized differently
2. **Bullet lists without sentences**: Lists like `- Name: value` don't have sentence-ending punctuation, triggering the word-count fallback which produces low-quality results
3. **Code blocks**: Content after triple-backtick fences should be skipped entirely
4. **Headers as content**: Lines starting with `#` are skipped, but their text is informative — consider using header text as the summary when no prose follows
5. **Short content**: Files with very little text get minimal token reduction — consider returning the full content for very short results (< 100 chars)
6. **YAML frontmatter values**: Tags and metadata in frontmatter sometimes leak through

## Constraints

- Only modify the `extractSentences` function and the `formatResult` function that calls it
- Do NOT modify any other tool handlers, the search logic, or the memory_get tool
- Do NOT add new dependencies or imports (existsSync and readFileSync are already imported)
- The function signature must remain: `extractSentences(content: string, count: number): string`
- The function must handle empty/null content gracefully
- Keep the function under 60 lines — it should be fast and simple

## Strategy

Priority order of approaches to try:

1. **Better list handling**: When content is mostly bullet points (`- item`), extract the first 2-3 list items as the summary instead of trying sentence splitting
2. **Header-as-fallback**: When no prose is found after skipping headers, use the first header's text as the summary (e.g., "# User" -> "User")
3. **Table skipping**: Skip lines that look like markdown table rows (`| col | col |`)
4. **Short content passthrough**: If the total prose content is under 100 chars, return it all (no reduction needed for tiny content)
5. **Smarter sentence boundary detection**: Handle abbreviations (Mr., Dr., e.g.) and URLs that contain dots
6. **Multi-line frontmatter handling**: Ensure YAML arrays and nested values in frontmatter are fully stripped
