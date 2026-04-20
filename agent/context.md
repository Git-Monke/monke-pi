# Code Context

## Source
- `/home/monke/.nvm/versions/node/v24.14.1/lib/node_modules/@mariozechner/pi-coding-agent/README.md` (full file)

---

# What is pi?

**Pi is a minimal terminal coding harness** — a CLI coding agent that adapts to your workflows rather than dictating them. Built with extensibility as a core principle, it ships with powerful defaults but remains aggressively customizable.

Key differentiator: Instead of baking in features like sub-agents, plan mode, MCP, or permission popups, pi lets you build or install exactly what you need via extensions.

---

## Key Features

### Core Agent Capabilities
- **4 built-in tools**: `read`, `write`, `edit`, `bash` (easily extended)
- **Multi-model support**: Anthropic, OpenAI, Google Gemini, GitHub Copilot, Azure, Bedrock, Mistral, Groq, Cerebras, xAI, OpenRouter, HuggingFace, and more
- **Interactive TUI**: Terminal interface with message queue, session tree navigation, branching, and automatic context compaction

### Session Management
- **Branching**: Navigate session trees in-place with `/tree`, fork with `/fork`
- **Compaction**: Automatic and manual summarization to prevent context overflow
- **Persistence**: Sessions stored as JSONL in `~/.pi/agent/sessions/`

### Extensibility System
| Extension Type | Purpose | Location |
|----------------|---------|----------|
| **Prompt Templates** | Reusable prompts (`/name` to expand) | `prompts/*.md` |
| **Skills** | On-demand capability packages (Agent Skills standard) | `skills/*/SKILL.md` |
| **Extensions** | TypeScript modules (custom tools, commands, UI, sub-agents) | `extensions/*.ts` |
| **Themes** | Hot-reloadable color schemes | `themes/*.json` |
| **Pi Packages** | npm/git distributable bundles of the above | published to npm |

### Running Modes
- **Interactive**: Default TUI mode
- **Print/JSON**: Non-interactive output (`pi -p` or `pi --mode json`)
- **RPC**: Process integration over stdin/stdout JSONL
- **SDK**: Embed in other Node.js apps via `@mariozechner/pi-coding-agent`

### Platform Support
- Node.js (primary), Windows, Termux/Android, tmux
- Wide terminal compatibility

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     pi CLI                          │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Skills    │  │   Prompts   │  │  Extensions │  │
│  │  (on-demand)│  │  (reusable) │  │ (typescript)│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────┤
│           @mariozechner/pi-ai (LLM toolkit)         │
│          @mariozechner/pi-agent (framework)        │
│           @mariozechner/pi-tui (UI components)     │
└─────────────────────────────────────────────────────┘
```

Extensions can add: custom tools, sub-agents, permission gates, MCP integration, git checkpointing, SSH/sandbox execution, custom UI components, or anything else via the `ExtensionAPI`.

---

## Installation & Quick Start

```bash
npm install -g @mariozechner/pi-coding-agent
export ANTHROPIC_API_KEY=sk-ant-...  # or use /login for OAuth
pi
```

---

## Key Files for This Project

Based on the current working directory being `/home/monke/.pi/agent`, the local pi configuration likely includes:
- `~/.pi/agent/settings.json` — global settings
- `~/.pi/agent/AGENTS.md` — project context instructions
- `~/.pi/agent/extensions/` — installed extensions
- `~/.pi/agent/skills/` — installed skills
- `~/.pi/agent/sessions/` — session history

---

## Philosophy

Pi deliberately excludes: MCP, sub-agents, permission popups, plan mode, and built-in todos. These can be built with extensions or installed as pi packages. The core stays minimal; you shape pi to fit how you work.

For the full rationale, see the [blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/).
