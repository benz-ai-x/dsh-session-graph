# Session Graph Handoff

Updated: 2026-08-31 (Asia/Shanghai)

> This root `HANDOFF.md` is the only canonical live handoff for this repository. Update it in place for future handoffs; do not create another handoff file. The former `session-graph-handover.md` is intentionally deleted, and `docs/HANDOFF.md` is retained only as a historical project snapshot.

## Resume snapshot

- Repository: [`benz-ai-x/dsh-session-graph`](https://github.com/benz-ai-x/dsh-session-graph)
- Package: [`@benz-ai-x/dsh-client-ui-session-graph`](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph)
- Branch: `main`; release baseline `v0.1.5` is commit `bb94fb2`, with documentation commits following it
- Latest release: [`v0.1.5`](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.5); npm `latest` is `0.1.5`
- Scope: this handoff belongs to `dsh-session-graph`, not the separate `dsh-graph-workflow` repository.
- No implementation or release work remains from the Remote compatibility fix.

## Most recent outcome

Release `v0.1.5` fixes Host startup against DeepSeek Harness `0.1.2-alpha.2` while retaining `0.1.2-alpha.1` compatibility. The cause, implementation, regression coverage, version bump, bilingual documentation, and CI matrix are all captured in commit [`bb94fb2`](https://github.com/benz-ai-x/dsh-session-graph/commit/bb94fb25fcda5680ec71f5f9600bf89b61e295fc); do not reconstruct them in this document.

The local `web` profile was last observed listening on `127.0.0.1:3080`. Access requires the one-time authenticated URL printed by `dsh web`; never copy its token into documentation or logs intended for sharing.

## Documentation consolidation

The documentation consolidation requested after `v0.1.5` is complete and intentionally separate from the release commit:

- this root `HANDOFF.md` is the canonical handoff;
- the tracked legacy `session-graph-handover.md` is deleted;
- `docs/HANDOFF.md` is marked as historical;
- `AGENTS.md` records the canonical-file rule;
- `README.md` and `README.zh.md` present the same quick start, compatibility, data/model behavior, troubleshooting, and contributor guidance.

Do not restore `session-graph-handover.md` or create another live handoff file.

## Authoritative references

- Repository and release rules: [`AGENTS.md`](AGENTS.md)
- Domain terminology and boundaries: [`CONTEXT.md`](CONTEXT.md)
- Durable decisions: [`docs/adr/`](docs/adr/)
- Historical project snapshot: [`docs/HANDOFF.md`](docs/HANDOFF.md)
- Issue workflow: [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)
- Latest runtime compatibility change: [`bb94fb2`](https://github.com/benz-ai-x/dsh-session-graph/commit/bb94fb25fcda5680ec71f5f9600bf89b61e295fc)
- Runtime-hardening review: [PR #2](https://github.com/benz-ai-x/dsh-session-graph/pull/2)

## Verification record

- Local package check: 18 files, 167 tests passed.
- Local Harness `0.1.2-alpha.2` integration: 2 files, 97 tests passed.
- Both public READMEs pass relative-link checks and render through GitHub's GFM API; the post-update package check still passes 167 tests.
- CI passed Node 22.19/24/26 plus Harness `alpha.1` and `alpha.2`, including packed-profile installation/removal: [run 33347383516](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33347383516).
- Trusted Publishing and npm provenance completed successfully: [run 33347475410](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33347475410).

## Next-session start

1. Read `AGENTS.md`, this file, and `CONTEXT.md`.
2. Run `git status --short --branch` and `git fetch origin --tags`; confirm `main` is clean and synchronized before making changes.
3. Verify `npm view @benz-ai-x/dsh-client-ui-session-graph version dist-tags --json` only when release state matters.
4. For new product work, select or create a GitHub Issue and follow `docs/agents/issue-tracker.md`.
5. Re-run `pnpm run check`; add the real Harness suite whenever Host, Remote, Session, Workspace, or browser integration changes.

## Suggested skills

- `dsh-plugin-dev` for Cordis lifecycle, Remote compatibility, Harness integration, packaging, or releases.
- `diagnosing-bugs` for runtime, lifecycle, cancellation, persistence, or performance failures.
- `code-review` before approving or releasing subsequent implementation changes.
- `domain-modeling` when changing Session Graph terminology, projections, lineage, or ADR-backed boundaries.
- `handoff` when refreshing this file; explicitly keep the repository root `HANDOFF.md` as the destination.
