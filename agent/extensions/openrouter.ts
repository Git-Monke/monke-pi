import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  // Register new provider with models
  pi.registerProvider("openrouter", {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "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",
    api: "openai-completions",
  });
}
