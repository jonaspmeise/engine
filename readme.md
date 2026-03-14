# My-Engine

A monorepo game engine built with [Bun](https://bun.sh) and TypeScript (strict).

## Packages

| Package | Description | Depends on |
|---|---|---|
| [`@my-engine/library`](./packages/library) | Core engine primitives — math, game state | — |
| [`@my-engine/client-singleplayer`](./packages/client-singleplayer) | Singleplayer session management | `library` |
| [`@my-engine/client-p2p`](./packages/client-p2p) | Peer-to-peer client built on trystero | `client-singleplayer` |
| [`@my-engine/server`](./packages/server) | Authoritative server room management | `library` |

## Getting started

```sh
bun install
bun run build   # builds all packages via workspace filter
bun run test    # runs tests in all packages
```

## Scripts

| Command | What it does |
|---|---|
| `bun run build` | Builds all workspace packages via `bun --filter '*' build` |
| `bun run test` | Runs tests in all workspace packages |
| `bun run typecheck` | Full `tsc -b` from root using project references |
| `bun run format` | Formats all TS/JSON/MD files with Prettier |
| `bun run format:check` | CI format check |

## Stack

- **Runtime / tooling**: Bun
- **Language**: TypeScript 5 (strictest settings + `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Formatting**: Prettier
- **CI**: GitHub Actions (`oven-sh/setup-bun`)
- **Dependency updates**: Renovate

