// Thin wrapper around `claude -p` so we authenticate via the user's Max sub
// instead of an API key. Used by personalization and playbook research.

import { spawn } from "node:child_process";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";

export type RunClaudeOptions = {
  systemPrompt: string;
  userPrompt: string;
  model?: string; // "sonnet", "opus", or full id; default "sonnet"
  tools?: string[]; // extra tools to allow, e.g. ["WebSearch", "WebFetch"]
  bypassPermissions?: boolean; // required if tools are used
  timeoutMs?: number; // hard kill after this long
};

export async function runClaude(opts: RunClaudeOptions): Promise<string> {
  const env = { ...process.env };
  // Force OAuth/Max-sub auth — never let the CLI fall back to an API key.
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_BASE_URL;

  const args: string[] = [
    "-p",
    "--model",
    opts.model ?? "sonnet",
    "--output-format",
    "json",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--system-prompt",
    opts.systemPrompt,
  ];
  if (opts.tools && opts.tools.length > 0) {
    args.push("--tools", opts.tools.join(","));
  } else {
    args.push("--tools", ""); // disable all tools when none requested
  }
  if (opts.bypassPermissions) {
    args.push("--permission-mode", "bypassPermissions");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          killed = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : null;

    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (killed) {
        reject(new Error(`claude CLI timed out after ${opts.timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`claude CLI exit ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      try {
        const events = JSON.parse(stdout);
        if (!Array.isArray(events)) {
          reject(new Error(`unexpected CLI output: ${stdout.slice(0, 300)}`));
          return;
        }
        const finalEvent = events.find(
          (e: any) => e?.type === "result" && typeof e.result === "string",
        );
        if (!finalEvent) {
          reject(new Error(`no result event in CLI output: ${stdout.slice(0, 300)}`));
          return;
        }
        resolve(finalEvent.result as string);
      } catch (e) {
        reject(new Error(`failed to parse CLI output: ${(e as Error).message}`));
      }
    });

    child.stdin.write(opts.userPrompt);
    child.stdin.end();
  });
}

export function safeJsonExtract(s: string): any {
  const cleaned = s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
