# AGENTS.md

Repo-level guidance for coding agents working inside `@gtmeasy/growth`. Mirrored to `CLAUDE.md` via symlink so Claude Code and any other AGENTS.md-aware runtime read the same file.

## What this is

`@gtmeasy/growth` is the first-party TypeScript SDK for GTM Easy growth analytics. One package, four runtimes via subpath exports:

- `@gtmeasy/growth/web` — browsers (`localStorage` for anon id, optional auto-instrumentation)
- `@gtmeasy/growth/node` — Node / Bun / Deno (server-side tracks + webhooks)
- `@gtmeasy/growth/react-native` — RN / Expo (`AsyncStorage` for persistence)
- `@gtmeasy/growth/bridges` — Clarity / PostHog / Sentry / Statsig connectors

A Claude Code skill at `skills/gtm-easy-web/SKILL.md` + `skills/gtm-easy-react-native/SKILL.md` teaches a coding agent in a consumer repo how to wire the SDK end-to-end.

## Toolchain

| Concern              | Tool                                      |
|----------------------|-------------------------------------------|
| Package management   | **Bun** (`bun install`, `bun.lockb`)      |
| Tests                | **Bun** (`bun test`)                      |
| Typecheck            | **TypeScript** (`bun run typecheck`)      |
| Build                | **tsup** (`bun run build`)                |
| Publish              | **npm** (`npm publish --provenance`) — only `npm` emits SLSA-style provenance attestations; `bun publish` does not yet support that. |

## Local workflow

```bash
bun install
bun run typecheck
bun test
bun run build
```

When adding a public API:
- Colocate tests as `<file>.test.ts` beside the source.
- Update the matching skill (`skills/gtm-easy-web/SKILL.md` or `skills/gtm-easy-react-native/SKILL.md`) so consumer-side coding agents pick the new surface up.
- Bump the relevant section of `README.md` and **bump `package.json` version** — see release rules below.

## Release rules

Two channels, both driven by `.github/workflows/release.yml`:

### 1. Unstable (every push to `main`)

- Trigger: any push to `main`.
- Version pattern: `<package.json version>-<7-char shortsha>-unstable`
  e.g. `0.1.1-abc1234-unstable`
- npm dist-tag: `unstable`. Consumers opt in with:
  ```bash
  npm i @gtmeasy/growth@unstable
  ```
- Never moves the default `latest` pointer.
- The version is set via `npm --no-git-tag-version version <semver>` inside CI; the working tree change is throwaway and is never committed back.

### 2. Stable (git tag)

- Trigger: pushing a tag matching `v*` (e.g. `v0.1.1`).
- Hard precondition: the tag's stripped semver MUST equal `package.json.version`. CI fails the publish step otherwise.
- npm dist-tag: `latest`. This is what `npm i @gtmeasy/growth` resolves to.
- Standard release flow:
  ```bash
  # 1. Bump package.json
  npm --no-git-tag-version version patch   # or minor / major
  # 2. Commit + push
  git add package.json && git commit -m "chore(release): vX.Y.Z" && git push
  # 3. Tag the resulting commit + push the tag
  git tag "v$(node -p "require('./package.json').version")"
  git push origin --tags
  ```
- The push-to-main step publishes an unstable build of that bumped version; the tag push publishes the stable one.

### Required secrets

- `NPM_TOKEN` — npm **Automation** token with publish access to `@gtmeasy/growth`. Classic tokens fail in CI with `npm error code EOTP` because npm enforces 2FA on writes; Automation tokens are the documented exception that skip the OTP prompt. Generate via npmjs.com → Access Tokens → Generate New Token → **Automation**. Update via `gh secret set NPM_TOKEN -R gtmeasy/gtm-easy-js-sdk`.

### Provenance

`npm publish --provenance --access public` is enabled on both paths. The CI job requests `permissions: id-token: write` and inherits `contents: read`, which is the minimum surface npm needs to mint a SLSA attestation.

## Things to NOT do

- **Don't run `npm install` / `pnpm install` / `yarn install`.** Bun is the project's package manager; mixing lockfiles breaks reproducibility.
- **Don't add `any`, `unknown`, or `object` types.** Public typings are part of the SDK contract.
- **Don't import from `@gtmeasy/growth` without a subpath** inside this repo's own tests. Pick `/web`, `/node`, `/react-native`, or `/bridges` so the test exercises the actual runtime entrypoint.
- **Don't commit a version bump that targets `latest` without also tagging it.** A bare push-to-main only ships an `unstable` build; consumers running `npm i @gtmeasy/growth` will not see it until a `v*` tag lands.
- **Don't loosen the tag→version equality check** in `.github/workflows/release.yml`. It's the only guardrail against tagging the wrong commit.

## Repo layout

```
.
├── src/
│   ├── core/              # runtime-neutral analytics core
│   ├── web/               # browser adapter
│   ├── node/              # server adapter
│   ├── react-native/      # RN adapter
│   ├── bridges/           # Clarity / PostHog / Sentry / Statsig
│   └── generated/         # OpenAPI typescript-fetch client (low-level)
├── examples/
│   ├── sample-web/        # Vite 5 + TS reference app
│   └── sample-expo/       # Expo 51 + RN 0.74 reference app
├── skills/
│   ├── gtm-easy-web/      # Claude Code skill for web integration
│   └── gtm-easy-react-native/   # Claude Code skill for RN integration
└── .github/workflows/
    ├── test.yml           # CI on every push + PR
    └── release.yml        # unstable on push-to-main, stable on v* tag
```
