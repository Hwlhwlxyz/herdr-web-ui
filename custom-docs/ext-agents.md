# Rules for src/ext/ (agents and people)

Local extensions that live beside upstream herdr-web-ui without editing it, so upstream commits
merge cleanly. Design and rules in full: custom-docs/extensions.md.

## RULES
- Never edit upstream files to make an extension work. The only upstream edits are the slot hooks
  listed in custom-docs/extensions.md (main.tsx 1 line, App.tsx 4 lines). A new hook point is a new slot
  name in src/slots/types.ts plus one line in App.tsx, recorded in custom-docs/extensions.md.
- Import upstream code only through `src/ext/upstream.ts` (and `src/slots/`). If something is not
  exported there, add it there.
- No backend changes: use the existing `/api/*` routes through `useMachineApi()`; a route it does not wrap is called with `machinePath(machineId, …)` and the `x-herdr-machine: 1` header (as `project-files/terminal.ts` does).
- Never type into a pane that runs an agent: its prompt would send the text as a message (`cdBlocked`).
- Strings: do NOT call `t("…")` / `tt("…")` here. src/lib/i18n.test.ts scans every `t(` call
  and would demand the string in upstream's dictionaries. Each extension keeps its own small
  dictionary and calls it `tx`.
- CSS: colocated, tokens only (`var(--…)`), no color literal and no `!important`
  (src/conventions.test.ts scans src/**/*.css). Prefix every class with the extension's short
  name (`pf-` for project-files) so nothing collides with upstream.
- One folder per extension: `src/ext/<name>/index.ts` registers it (src/ext/load.ts finds it).
- localStorage keys: `ovis:ext:<name>:<key>`, always inside try/catch. Never store tokens.
