# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues. Use the `gh` CLI for all operations and infer the repository from `git remote -v`.

## Conventions

- Create: `gh issue create --title "..." --body-file -`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Add or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Use a quoted heredoc for multiline issue bodies. Fetch labels and comments when a skill needs the complete ticket state.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares numbering between issues and pull requests. If `#42` is ambiguous, try `gh pr view 42` and then `gh issue view 42`.

## Skill operations

- “Publish to the issue tracker” means creating a GitHub issue.
- “Fetch the relevant ticket” means running `gh issue view <number> --comments`.

## Wayfinding operations

- A map is one issue labelled `wayfinder:map`.
- Child tickets use GitHub sub-issues when available. Otherwise, link them through a task list and a `Part of #<map>` line.
- Child labels use `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Represent blocking with native issue dependencies. If unavailable, use a `Blocked by: #<n>` line.
- The frontier is the first open, unassigned child without an open blocker.
- Claim work with `gh issue edit <number> --add-assignee @me`.
- Resolve work by commenting with the result, closing the ticket, and recording the decision pointer in the map.
