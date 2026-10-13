import { describe, expect, it } from "bun:test";

import type { HerdrPane } from "../upstream.ts";
import { cdBlocked, cdCommand, parentOf, shellOf } from "./terminal.ts";

const pane = (fields: Partial<HerdrPane>): HerdrPane => ({ pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1", terminal_id: "t1", focused: true, revision: 1, agent_status: "idle", ...fields } as HerdrPane);

describe("shellOf", () => {
  it("reads the shell from what herdr shows", () => {
    expect(shellOf(pane({ title: "pwsh.exe" }))).toBe("pwsh");
    expect(shellOf(pane({ terminal_title: "Windows PowerShell" }))).toBe("pwsh");
    expect(shellOf(pane({ title: "cmd.exe" }))).toBe("cmd");
    expect(shellOf(pane({ title: "bash" }))).toBe("posix");
    expect(shellOf(pane({ title: "zsh" }))).toBe("posix");
    expect(shellOf(pane({ title: "my build" }))).toBe("unknown");
  });
});

describe("cdCommand", () => {
  it("quotes the path for each shell", () => {
    expect(cdCommand("pwsh", "C:\\Users\\me\\it's here")).toBe("Set-Location -LiteralPath 'C:\\Users\\me\\it''s here'");
    expect(cdCommand("cmd", "D:\\work dir")).toBe('cd /d "D:\\work dir"');
    expect(cdCommand("posix", "/home/me/it's $HOME")).toBe("cd -- '/home/me/it'\\''s $HOME'");
    expect(cdCommand("unknown", "/srv/app")).toBe('cd "/srv/app"');
  });
});

describe("cdBlocked", () => {
  it("refuses a pane running an agent or not running", () => {
    expect(cdBlocked(pane({}))).toBe(null);
    expect(cdBlocked(pane({ agent: "claude" }))).toBe("agent");
    expect(cdBlocked(pane({ restore_error: "gone" }))).toBe("restoring");
  });
});

describe("parentOf", () => {
  it("cuts the last segment with either separator", () => {
    expect(parentOf("/home/me/api/src/a.ts")).toBe("/home/me/api/src");
    expect(parentOf("C:\\work\\api\\a.ts")).toBe("C:\\work\\api");
    expect(parentOf("C:\\a.ts")).toBe("C:\\");
  });
});
