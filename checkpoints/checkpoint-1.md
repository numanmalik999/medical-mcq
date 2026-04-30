# Checkpoint 1 — MCQ Enhancement Fix

## Date: 2026-04-30

## Status: COMPLETE — code changes implemented, awaiting deployment

## Root Causes Identified
1. `esm.sh/openai@4.52.0?target=deno` imports Node.js compat layer calling `Deno.core.runMicrotasks()` — not supported in Deno Deploy (Supabase Edge Runtime)
2. Escaped template literals `\${\` caused literal `${question}` instead of interpolated values

## Changes Made — `supabase/functions/bulk-enhance-mcqs/index.ts`
- Removed OpenAI SDK import entirely
- Added base URL probe loop to discover working endpoint from candidates
- `generateEnhancedContent()` receives `baseUrl` + `apiKey`; calls `POST ${baseUrl}/chat/completions` via native `fetch`
- Fixed prompt: `${question}`, `${options.A/B/C/D}`, `${categoryList.join(', ')}` — real interpolation
- Prompt enforces 6 required H2 section headings; post-processing auto-fills missing ones
- Added validation for correct_answer (A/B/C/D), difficulty (Easy/Medium/Hard), non-empty explanation_text

## Deployment Required
- [ ] Deploy `supabase/functions/bulk-enhance-mcqs/index.ts` to Supabase Edge Functions
- [ ] Test enhancement on one MCQ from admin panel
- [ ] Verify explanation_text contains all 6 H2 section headings