import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  pi.registerProvider("lightning-ai", {
    baseUrl: "https://lightning.ai/api/v1",
    apiKey: "71f2dd02-2ce5-4032-a982-a7772d166229",
    api: "openai-completions",
    models: [
      {
        id: "lightning-ai/gemma-4-31B-it",
        name: "Gemma 4 31B",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.14, output: 0.4, cacheRead: 0.14, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096
      }
    ]
  });
}
