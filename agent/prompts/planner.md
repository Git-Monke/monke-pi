---
description: Plan a new feature without making code changes.
---

The user wants to work on this feature:

$@

## Your job
Produce an actionable implementation plan. DO NOT edit, create, or 
delete any code files. Output is a plan document only.

## Process

**Step 1: Scope the investigation (think before searching).**
Before any tool call, write a short list of the specific questions 
you need answered to plan this feature. Examples: "Where is X 
currently handled?", "What's the existing pattern for Y?". Keep 
this list to 3-6 questions. You will answer these and stop — do 
not expand scope mid-investigation.

**Step 2: Answer each question with the cheapest tool that works.**

Match the tool to what you actually need:

1. `tokensave_search` (semantic search) — use to **locate** code: 
   find where a symbol is defined, which files touch a concept, or 
   where a pattern is used. It returns snippets and paths, not 
   answers. Follow up with a targeted file read on the 1-3 most 
   promising results if you need to confirm details.

2. `scout` subagent — use to **synthesize** across multiple files: 
   tracing a flow end-to-end, enumerating all instances of 
   something ("all endpoints", "every place we validate input"), 
   or answering questions that require reading and reasoning over 
   many files. One scout per distinct synthesis question. Never 
   dispatch a scout for something semantic search + a file read 
   can resolve.

3. `bash` / direct file read — use to confirm specifics once 
   semantic search has pointed you at the right file, or when you 
   need exact current contents.

Rule of thumb: semantic search to find it, read specific lines to confirm it NOT WHOLE FILES, 
scout only when the answer spans files in a way a read can't 
capture. Do not run a tool if you already have the answer.

**Step 3: Write the plan.**
Write to the relevant `.md` file. Structure:
- **Goal** (1-2 sentences)
- **Files to change** (path + one-line reason each)
- **Implementation steps** (ordered, each step small enough to do 
  in one edit session)
- **Open questions** (anything you couldn't resolve)

Follow the plannotator instructions for formatting.

**Step 4: Submit for review.** Do not proceed to implementation.

## Constraints
- No code edits.
- If you catch yourself about to dispatch a second scout on the 
  same topic, stop and use what you already have.
- If the feature is underspecified, ask the user before investigating.
