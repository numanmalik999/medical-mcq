# Plan — MCQ Enhancement Fix

## Problem
`bulk-enhance-mcqs` Edge Function crashes with `Deno.core.runMicrotasks() is not supported`. Escaped template literals also caused literal `${...}` placeholders in explanations instead of real MCQ content.

## Root Causes
1. **Deno error**: `esm.sh/openai@4.52.0?target=deno` imports Node.js compat layer calling `Deno.core.runMicrotasks()` — not supported in Deno Deploy (Supabase Edge Runtime)
2. **Escaped template literals**: `\${\` in the prompt caused literal `${question}` text instead of interpolated values

## Solution
1. Replace OpenAI SDK with native `fetch` to OpenAI REST API (`/v1/chat/completions`)
2. Fix prompt to use real template string interpolation

## Changes Made — `supabase/functions/bulk-enhance-mcqs/index.ts`
- Removed `import OpenAI from 'https://esm.sh/openai@4.52.0?target=deno'`
- Added base URL probe loop (tries `OPENAI_BASE_URL`, falls back to `api.openai.com/v1`)
- `generateEnhancedContent()` receives `baseUrl` + `apiKey`; calls `POST ${baseUrl}/chat/completions` via native `fetch`
- Fixed prompt: `${question}`, `${options.A/B/C/D}`, `${categoryList.join(', ')}` — real interpolation
- Prompt enforces 6 required H2 section headings; post-processing fills missing ones
- Added validation: correct_answer (A/B/C/D), difficulty (Easy/Medium/Hard), non-empty explanation_text

## Deployment
- Deploy `supabase/functions/bulk-enhance-mcqs/index.ts` to Supabase Edge Functions
- No schema, env var, or UI changes required

## Acceptance Criteria
- [ ] Function deploys without `Deno.core.runMicrotasks()` error
- [ ] MCQ question/options injected as real values (not literal `${...}`)
- [ ] Enhancement produces all 6 required H2 sections in explanation_text
- [ ] `correct_answer`, `difficulty`, `suggested_category_name` written to DB correctly
