/**
 * Scout Tool - Quick reconnaissance agent
 * 
 * Spawns a lightweight pi instance pre-prompted as a scout to do
 * quick searches/findings without polluting the main conversation.
 * 
 * Usage: scout "Find me where authentication is handled"
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const SCOUT_DEFAULT_MODEL = "openrouter/minimax/minimax-m2.5";
const SCOUT_DEFAULT_MAX_INPUT_TOKENS = 50000;

async function getScoutModel(): Promise<string | null> {
  const configPath = path.join(os.homedir(), ".pi", "config.json");
  try {
    const configContent = await fs.promises.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    if (config["scout-model"] && typeof config["scout-model"] === "string") {
      return config["scout-model"];
    }
  } catch {
    // Config doesn't exist or is invalid, will use fallback
  }
  return null;
}

async function getScoutMaxTokens(): Promise<number> {
  const configPath = path.join(os.homedir(), ".pi", "config.json");
  try {
    const configContent = await fs.promises.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    if (typeof config["scout-max-tokens"] === "number" && config["scout-max-tokens"] > 0) {
      return config["scout-max-tokens"];
    }
  } catch {
    // Config doesn't exist or is invalid, will use fallback
  }
  return SCOUT_DEFAULT_MAX_INPUT_TOKENS;
}

const SCOUT_SYSTEM_PROMPT = `# Scout Agent

You are a **Scout** - a specialized reconnaissance agent.

## Your Mission
- Search thoroughly and report findings
- Be precise and actionable in your reports
- Focus on finding relevant locations, patterns, and code

## Output Format
Always structure your response as:

### Summary
Brief one-paragraph overview of what you found.

### Locations Found
- \`file:line\` - Brief description of what this location contains
- \`file:line\` - Brief description...

### Key Patterns
- Pattern 1
- Pattern 2

### Recommendations
Any suggestions based on findings (optional).

---

Stay focused. Report only what's relevant to the task. The next agent will use this for writing full features.
`;

// Write scout prompt to temp file
async function writeScoutPrompt(): Promise<{ dir: string; filePath: string }> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-scout-"));
  const filePath = path.join(tmpDir, "scout-system.md");
  await fs.promises.writeFile(filePath, SCOUT_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });
  return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

// Type for scout cost entry stored in session
interface ScoutCostEntry {
  model: string;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  timestamp: number;
  query: string;
}

// Calculate total scout cost from scout-cost entries in the current branch only
function getScoutCostTotal(
  sessionManager: {
    getBranch(): Array<{ type: string; customType?: string; data?: ScoutCostEntry }>;
  },
): number {
  let total = 0;
  for (const entry of sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === "scout-cost" && entry.data?.cost) {
      total += entry.data.cost.total;
    }
  }
  return total;
}

export default function(pi: ExtensionAPI) {
  // Don't register scout tool if we're already inside a scout (prevents infinite recursion)
  if (process.env.PI_SCOUT_NESTED === "1") {
    return;
  }

  // Set up custom footer that includes scout costs
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() { },
        render(width: number): string[] {
          // Calculate session tokens and cost from messages
          let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
          for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
              const m = entry.message as { usage?: { input: number; output: number; cacheRead?: number; cacheWrite?: number; cost?: { total: number } } };
              input += m.usage?.input ?? 0;
              output += m.usage?.output ?? 0;
              cacheRead += m.usage?.cacheRead ?? 0;
              cacheWrite += m.usage?.cacheWrite ?? 0;
              cost += m.usage?.cost?.total ?? 0;
            }
          }

          // Add scout costs (from current branch only)
          const scoutCost = getScoutCostTotal(ctx.sessionManager);
          const totalCost = cost + scoutCost;

          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

          // Format: input output cache totalCost [scoutCost]
          let left = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)}`);
          if (cacheRead > 0) {
            left += theme.fg("muted", ` ↻${fmt(cacheRead)}`);
          }
          if (cacheWrite > 0) {
            left += theme.fg("muted", ` ↗${fmt(cacheWrite)}`);
          }
          left += theme.fg("dim", ` $${totalCost.toFixed(3)}`);
          if (scoutCost > 0) {
            left += theme.fg("accent", ` [scout: $${scoutCost.toFixed(3)}]`);
          }

          const branch = footerData.getGitBranch();
          const branchStr = branch ? ` (${branch})` : "";
          const right = theme.fg("dim", `${ctx.model?.id || "no-model"}${branchStr}`);

          const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          return [truncateToWidth(left + pad + right, width)];
        },
      };
    });
  });

  // Reset footer on session shutdown
  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.setFooter(undefined);
    }
  });

  pi.registerTool({
    name: "scout",
    label: "Scout",
    description:
      "Spawn a lightweight scout agent to search for patterns, locations, or code. " +
      "Use this for quick reconnaissance without polluting the main conversation.",
    parameters: Type.Object({
      query: Type.String({
        description: "What to search for or investigate",
        examples: [
          "Find me where authentication is handled",
          "Locate all database query patterns",
          "Search for error handling code",
        ],
      }),
      scope: Type.Optional(
        Type.String({
          description: "Scope of the search: 'code' (default), 'docs', or 'all'",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      let tmpPromptDir: string | null = null;
      let tmpPromptPath: string | null = null;

      // Determine which model to use
      const scoutModel = (await getScoutModel()) ?? SCOUT_DEFAULT_MODEL;

      const args: string[] = [
        "--model", scoutModel,
        "--mode", "json",
        "-p",
        "--no-session",
      ];

      try {
        // Write system prompt to temp file
        const tmp = await writeScoutPrompt();
        tmpPromptDir = tmp.dir;
        tmpPromptPath = tmp.filePath;
        args.push("--append-system-prompt", tmpPromptPath);

        // Add the task
        const task = params.scope
          ? `[${params.scope}] ${params.query}`
          : params.query;
        args.push(task);

        const sendUpdate = (status: string) => {
          onUpdate?.({
            content: [{ type: "text", text: status }],
            details: { status: "running" },
          });
        };

        // Initial status
        sendUpdate("🔍 Scout searching...");

        // Get max tokens limit
        const maxInputTokens = await getScoutMaxTokens();

        // Spawn pi process
        const result = await new Promise<{ output: string; stderr: string; exitCode: number; killed: boolean }>(
          (resolve) => {
            const invocation = getPiInvocation(args);
            let buffer = "";
            let stderrBuffer = "";
            let killed = false;

            const proc = spawn(invocation.command, invocation.args, {
              cwd: ctx.cwd,
              shell: false,
              stdio: ["ignore", "pipe", "pipe"],
              env: { ...process.env, PI_SCOUT_NESTED: "1" },
            });

            // Track real-time progress
            let outputTokens = 0;
            let statusUpdateCount = 0;

            proc.stdout.on("data", (data) => {
              const chunk = data.toString();
              buffer += chunk;

              // Parse streaming events to track progress
              // Each line is a JSON event
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const event = JSON.parse(line);

                  // Show progress during message streaming
                  if (event.type === "message_start") {
                    sendUpdate("🔍 Scout analyzing context...");
                  } else if (event.type === "message_update") {
                    // Count approximate tokens being generated
                    if (event.assistantMessageEvent?.type === "text_delta" && event.assistantMessageEvent.delta) {
                      // Rough estimate: ~4 characters per token
                      outputTokens += Math.ceil(event.assistantMessageEvent.delta.length / 4);

                      // Update every 50 tokens or so to avoid spam
                      if (outputTokens > statusUpdateCount * 50) {
                        statusUpdateCount++;
                        const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
                        sendUpdate(`🔍 Scout generating report... ↓~${fmt(outputTokens)}`);
                      }
                    }
                  } else if (event.type === "turn_start") {
                    sendUpdate("🔍 Scout thinking...");
                  }

                  // Check for max tokens limit and extract final usage
                  if (event.type === "message_end" && event.message?.role === "assistant") {
                    const msg = event.message;
                    if (msg.usage?.input > maxInputTokens) {
                      proc.kill("SIGTERM");
                      killed = true;
                      buffer += '\n{"type":"message_end","truncated":true,"reason":"max_tokens_exceeded"}\n';
                    }

                    // Show final usage if available
                    if (msg.usage) {
                      const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
                      let statusText = "🔍 Scout finishing... ↑" + fmt(msg.usage.input) + " ↓" + fmt(msg.usage.output);
                      if (msg.usage.cacheRead && msg.usage.cacheRead > 0) {
                        statusText += ` ↻${fmt(msg.usage.cacheRead)}`;
                      }
                      if (msg.usage.cacheWrite && msg.usage.cacheWrite > 0) {
                        statusText += ` ↗${fmt(msg.usage.cacheWrite)}`;
                      }
                      if (msg.usage.cost?.total) {
                        statusText += ` $${msg.usage.cost.total.toFixed(3)}`;
                      }
                      sendUpdate(statusText);
                    }
                  }
                } catch {
                  // Skip non-JSON lines
                }
              }
            });

            proc.stderr.on("data", (data) => {
              stderrBuffer += data.toString();
            });

            proc.on("close", (code) => {
              resolve({
                output: buffer,
                stderr: stderrBuffer,
                exitCode: code ?? 0,
                killed,
              });
            });

            proc.on("error", () => {
              resolve({ output: "", stderr: "Process error", exitCode: 1, killed: false });
            });

            if (signal) {
              signal.addEventListener(
                "abort",
                () => {
                  proc.kill("SIGTERM");
                },
                { once: true },
              );
            }
          },
        );

        // Parse JSON output and extract the final message and usage
        let scoutOutput = "(no output)";
        let scoutUsage: { input: number; output: number; cacheRead: number; cacheWrite: number } | null = null;
        let scoutCost: { total: number } | null = null;
        const lines = result.output.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "message_end" && event.message) {
              const msg = event.message;
              if (msg.role === "assistant") {
                for (const part of msg.content) {
                  if (part.type === "text" && part.text) {
                    scoutOutput = part.text;
                  }
                }
                // Extract usage and cost separately from the message
                if (msg.usage) {
                  scoutUsage = {
                    input: msg.usage.input || 0,
                    output: msg.usage.output || 0,
                    cacheRead: msg.usage.cacheRead || 0,
                    cacheWrite: msg.usage.cacheWrite || 0
                  };
                  scoutCost = msg.usage.cost || null;
                }
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }

        // Handle truncation due to max tokens
        const wasTruncated = result.killed || result.output.includes('"truncated":true');

        if (wasTruncated && !scoutOutput) {
          scoutOutput = `(output truncated - exceeded ${maxInputTokens.toLocaleString()} input token limit)`;
        } else if (result.exitCode !== 0 && !scoutOutput) {
          scoutOutput = `Scout encountered an error: ${result.stderr || "unknown"}`;
        }

        // Record scout cost to the current session if available
        if (scoutUsage && scoutCost && scoutCost.total > 0) {
          pi.appendEntry("scout-cost", {
            model: scoutModel,
            cost: {
              input: scoutUsage.input,
              output: scoutUsage.output,
              cacheRead: scoutUsage.cacheRead,
              cacheWrite: scoutUsage.cacheWrite,
              total: scoutCost.total
            },
            timestamp: Date.now(),
            query: params.query,
          });
        }

        // Send final update with token counts and cost
        if (scoutCost) {
          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
          const status = scoutUsage ?
            `✓ Done ↑${fmt(scoutUsage.input)} ↓${fmt(scoutUsage.output)}` +
            (scoutUsage.cacheRead > 0 ? ` ↻${fmt(scoutUsage.cacheRead)}` : "") +
            (scoutUsage.cacheWrite > 0 ? ` ↗${fmt(scoutUsage.cacheWrite)}` : "") +
            (scoutCost ? ` $${scoutCost.total.toFixed(3)}` : "")
            : "✓ Done";
          onUpdate?.({
            content: [{ type: "text", text: status }],
            details: { status: "done" },
          });
        }

        return {
          content: [{ type: "text", text: scoutOutput }],
          details: {
            exitCode: result.exitCode,
            usage: scoutUsage,
            cost: scoutCost,
            model: scoutModel
          },
        };
      } finally {
        // Cleanup temp files
        if (tmpPromptPath) {
          try {
            fs.unlinkSync(tmpPromptPath);
          } catch { /* ignore */ }
        }
        if (tmpPromptDir) {
          try {
            fs.rmdirSync(tmpPromptDir);
          } catch { /* ignore */ }
        }
      }
    },

    renderCall(args, theme, _context) {
      const preview = args.query.length > 60 ? `${args.query.slice(0, 60)}...` : args.query;
      let text = theme.fg("toolTitle", theme.bold("scout "));
      if (args.scope) {
        text += theme.fg("accent", `[${args.scope}] `);
      }
      text += theme.fg("dim", preview);
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme, context) {
      const text = result.content[0];
      const content = text?.type === "text" ? text.text : "(no output)";

      // Get usage and cost info from result details
      let costInfo = "";
      const usage = result.details?.usage;
      const cost = result.details?.cost;
      const model = result.details?.model;

      if (usage) {
        const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
        costInfo = ` ${theme.fg("dim", "[")}`;
        costInfo += theme.fg("muted", `↑${fmt(usage.input)} ↓${fmt(usage.output)}`);
        if (usage.cacheRead > 0) {
          costInfo += theme.fg("muted", ` ↻${fmt(usage.cacheRead)}`);
        }
        if (usage.cacheWrite > 0) {
          costInfo += theme.fg("muted", ` ↗${fmt(usage.cacheWrite)}`);
        }
        if (cost && cost.total > 0) {
          costInfo += theme.fg("accent", ` $${cost.total.toFixed(3)}`);
        }
        if (model) {
          // Show just the model name, not the full provider/model string
          const modelName = model.split('/').pop() || model;
          costInfo += theme.fg("dim", ` ${modelName}`);
        }
        costInfo += theme.fg("dim", "]");
      }

      if (expanded) {
        const header = theme.fg("toolTitle", theme.bold("🔍 Scout Report")) + costInfo;
        const separator = theme.fg("muted", "─".repeat(40));
        return new Text(
          `${header}\n${separator}\n${content}`,
          0,
          0,
        );
      }

      // Collapsed: show first few lines
      const lines = content.split("\n").filter(l => l.trim());
      const preview = lines.slice(0, 4).join("\n");
      const hasMore = lines.length > 4;

      let final_text = theme.fg("success", "✓ ") + theme.fg("toolTitle", "Scout") + costInfo + " ";
      final_text += hasMore ? theme.fg("dim", preview + "\n...") : theme.fg("dim", preview);
      return new Text(final_text, 0, 0);
    },
  });
}
