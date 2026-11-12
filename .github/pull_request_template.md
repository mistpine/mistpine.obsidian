<!--
Title: a Conventional Commit header, e.g. `fix: raise callout titles to 4.5:1`.
PRs are squash-merged and the title becomes the commit on main: lowercase,
imperative, 72 characters at most (aim for 50).

Agents: keep every heading. Tick a box only for a command you ran in this
branch; otherwise leave it unticked and say why below it.
-->

## What and why

<!-- What changes and the problem it solves. Link the issue: `Closes #123`. -->

## Checks

- [ ] `pnpm lint && pnpm typecheck`
- [ ] `pnpm check` (`theme.css` matches `src/theme.css` and the spec)
- [ ] Looked at it in Obsidian <!-- version -->, in Reading view and Live Preview

## Colors

- [ ] Edited `src/theme.css`, then ran `pnpm generate` (`theme.css` is never edited by hand)
- [ ] Colors use spec tokens (`{{bg1}}`, `{{syntax.comment}}`, `{{mix:…}}`); no new hex values
- [ ] No `!important`, fonts or network requests

## Screenshots

<!-- Before and after for any visible change. `pnpm render` regenerates the
README screenshots. Delete if nothing visible changed. -->

## Authorship

<!-- Tick one. If an agent took part, name it and the model. -->

- [ ] Written by a person
- [ ] Written with an AI agent; a person reviewed every change
- [ ] Written by an AI agent without line-by-line human review

<!-- Releasing? Merge first, then bump `version` in manifest.json in its own
PR and push a matching tag; see the README. -->
