// "cd here": types a change-directory command into a shell pane and presses Enter, through the
// existing /api/pane/input and /api/pane/keys routes (no backend change).
import { machinePath, type HerdrPane } from "../upstream.ts";

export type ShellKind = "pwsh" | "cmd" | "posix" | "unknown";

/** Which shell the pane runs, guessed from what herdr shows for it (`pwsh.exe`, `bash`, `cmd.exe`…). */
export function shellOf(pane: HerdrPane): ShellKind {
  const names = [pane.title, pane.terminal_title_stripped, pane.terminal_title, pane.label].filter(Boolean).join(" ").toLowerCase();
  if (/\b(pwsh|powershell)\b/.test(names)) return "pwsh";
  if (/\bcmd(\.exe)?\b/.test(names)) return "cmd";
  if (/\b(bash|zsh|fish|sh|dash|ksh|nu)\b/.test(names)) return "posix";
  return "unknown";
}

/** The command that changes to `dir` in `shell`, quoted so spaces and quotes in the path are safe. */
export function cdCommand(shell: ShellKind, dir: string): string {
  switch (shell) {
    // single quotes are literal in PowerShell; a quote inside is doubled
    case "pwsh": return `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'`;
    // /d also changes the drive; cmd has no escape for a double quote, which a Windows path cannot hold
    case "cmd": return `cd /d "${dir}"`;
    // single quotes are literal in POSIX shells; a quote inside is closed, escaped and reopened
    case "posix": return `cd -- '${dir.replace(/'/g, "'\\''")}'`;
    // works in pwsh, bash and cmd (same drive) alike for an ordinary path
    case "unknown": return `cd "${dir}"`;
  }
}

/** Why the pane must not get a typed command now, or null when it may. */
export function cdBlocked(pane: HerdrPane): "agent" | "restoring" | null {
  if (pane.restore_error) return "restoring";
  // an agent's prompt would take the command as a message and send it
  if (pane.agent) return "agent";
  return null;
}

async function post(machineId: string, path: string, body: unknown): Promise<void> {
  const response = await fetch(machinePath(machineId, path), {
    method: "POST",
    headers: { "content-type": "application/json", "x-herdr-machine": "1" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
}

/** Types the command into the pane (no bracketed paste: one line) and presses Enter. */
export async function sendCd(machineId: string, pane: HerdrPane, dir: string): Promise<void> {
  await post(machineId, "pane/input", { pane_id: pane.pane_id, text: cdCommand(shellOf(pane), dir) });
  await post(machineId, "pane/keys", { pane_id: pane.pane_id, keys: ["Enter"] });
}

/** The folder a path is in (either separator). */
export function parentOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut <= 0 ? path : /^[A-Za-z]:$/.test(path.slice(0, cut)) ? path.slice(0, cut + 1) : path.slice(0, cut);
}
