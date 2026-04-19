import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const { stdout } = await pi.exec("git", [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
    ]);

    const fileMap = stdout.trim();
    if (!fileMap) return;

    return {
      systemPrompt: event.systemPrompt + `# Project File Map\nUse this to navigate the project. DO NOT USE "ls -R" AS IT WILL SHOW YOU MANY FILES WHICH ARE IRRELEVANT.\n\`\`\`\n${fileMap}\n\`\`\``,
    };
  });
}
