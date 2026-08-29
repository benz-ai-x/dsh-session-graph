# Domain Docs

This is a single-context repository.

## Before exploring

Read these files when they exist:

- `CONTEXT.md` at the repository root
- Relevant ADRs under `docs/adr/`

If they do not exist, proceed silently. Domain-modeling workflows create them lazily when terminology or architectural decisions are resolved.

## Layout

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Vocabulary

Use terms defined in `CONTEXT.md` consistently in issue titles, proposals, tests, and implementation. Avoid synonyms that the glossary explicitly rejects.

If a necessary concept is missing, reconsider whether existing terminology already covers it. Otherwise, record it as a domain-modeling gap.

## ADR conflicts

Explicitly identify proposals that contradict an existing ADR instead of silently overriding the decision.
