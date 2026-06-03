# Architectural decisions

This document records the main architectural choices for **beats**: a Rust workspace that exposes a **gRPC library API** defined with **Protocol Buffers** and implemented with **Tonic**.

## Goals

- Keep API contracts **explicit and versioned** (Protobuf packages and services).
- Share generated client and server types across binaries and future services via a **single Rust crate**.
- Use **standard tooling** (Buf, Prost, Tonic) so generation stays reproducible and reviewable.

---

## 1. Cargo workspace

**Context.** The repository is organized as one Cargo workspace rather than multiple independent crates at the root.

**Decision.** Use a virtual workspace with `resolver = "2"` and shared `[workspace.package]` metadata (`edition`, `license`, `version`). Members today:

| Path | Role |
|------|------|
| `crates/proto-gen` | Generated Protobuf / gRPC Rust API |
| `services/library-api` | Binaries that host or call the library gRPC service |

**Consequences.**

- Dependency versions and crate metadata stay consistent.
- New services or libraries become new workspace members without a separate release pipeline per crate.

---

## 2. Contract-first API with Protocol Buffers

**Context.** Network APIs need a stable, language-neutral contract.

**Decision.** Define services and messages under `proto/` (for example `proto/library/v1/library.proto`), using `proto3` and package names such as `library.v1`. RPCs are declared on a `service` (e.g. `LibraryService`).

**Consequences.**

- The `.proto` files are the **source of truth** for request/response shapes and RPC names.
- Breaking changes are visible in diffs to `proto/` and can be managed with versioning (`v1`, `v2`, …).

---

## 3. Buf for linting and code generation

**Context.** Raw `protoc` invocations are easy to get wrong across machines and CI.

**Decision.**

- Configure Buf in `buf.yaml` with a module rooted at `./proto` and module name `buf.build/beats/core` (suitable for publishing or referencing on the Buf Schema Registry later).
- Drive Rust generation from `buf.gen.yaml` using **remote** Buf plugins:
  - `neoeinstein-prost` for `prost` message types
  - `neoeinstein-tonic` for Tonic service stubs

Generated Rust is written to `crates/proto-gen/gen` with `clean: true` so outputs are reset each generation run.

**Consequences.**

- Contributors run a single, documented command (`buf generate`) instead of custom scripts.
- Plugin versions are pinned in `buf.gen.yaml`, improving reproducibility.

---

## 4. Checked-in generated code

**Context.** Generated Rust can either live only in `target/` or be committed.

**Decision.** Generated files under `crates/proto-gen/gen/` are **tracked in version control** (they are not excluded in `.gitignore`).

**Consequences.**

- **Pros:** `cargo build` works without Buf installed; reviews show API diffs in Git; CI does not need code gen for a normal compile.
- **Cons:** Pull requests that change `.proto` files must include regenerated Rust, or CI must enforce regeneration.

---

## 5. `proto-gen` crate as a thin facade

**Context.** Multiple binaries or services may need the same types and server traits.

**Decision.** The `proto-gen` library crate:

- Points at the generated module with `#[path = "../gen/library/v1/library.v1.rs"]` (and nested includes for Tonic).
- Re-exports everything with `pub use library_proto_gen::*`.

Service crates depend on `proto-gen` via a path dependency (e.g. `proto-gen = { path = "../../crates/proto-gen" }`).

**Consequences.**

- **Single import surface** (`proto_gen::…`) for messages and `library_service_server::LibraryServiceServer` (and related symbols).
- The crate stays small: it does not embed business logic, only the contract.

---

## 6. Async I/O with Tokio

**Context.** Tonic servers and clients are async.

**Decision.** The `library-api` service uses **Tokio** (`macros`, `rt-multi-thread`) as the async runtime for binaries such as `library-server`.

**Consequences.**

- Aligns with the Tonic/Tokio ecosystem defaults.
- Blocking or CPU-heavy work inside request handlers should be offloaded deliberately (e.g. `spawn_blocking` or specialist workers) if added later.

---

## 7. Library service process layout

**Context.** Clear separation between “the thing that listens” and “the thing that calls the API” helps development and testing.

**Decision.** Under `services/library-api`, define separate binaries:

| Binary | Purpose (intended) |
|--------|--------------------|
| `library-server` | Host `LibraryService` over gRPC |
| `library-client` | Example or tool that calls the service |

Binding defaults (e.g. `[::1]:50051` for IPv6 loopback) are chosen for **local development**; production would use configuration (environment variables or config files) when that layer is added.

**Consequences.**

- Operational and integration-testing stories can target well-named entry points.
- Deployment can run one binary per role without pulling in the other.

---

## 8. Application layer organized by use case

**Context.** The library service will grow orchestration (“load aggregates, enforce rules, persist”) separately from stable domain semantics and separately from Tonic/protobuf.

**Decision.** Prefer **application code grouped by use case**:

- **`services/library-api/src/application/usecases/<use_case>/`** — one module subtree per **externally initiated operation**. Name modules in **`snake_case`** (for example **`get_health`**, **`publish_release`**). Typical contents: an entrypoint type or function invoked by adapters (often one primary type per folder, e.g. `handler.rs`, `service.rs`), plus **delivery-specific orchestration**: transaction scope, retries, idempotency, ordering of dependency calls—not rules that belong in **`domain`** as stable catalogue semantics.

- **`services/library-api/src/application/usecases/mod.rs`** — groups every **`usecases/*`** subtree so **`application/mod.rs`** can later host **`ports/`** or other umbrellas without muddying RPC-named folders.

- **`services/library-api/src/domain/repositories/`** — **Rust traits** for catalogue persistence/read-model access only (**no databases or drivers here**). They anchor the ubiquitous language (“load/save/catalogue queries”). Implementations live **in **`infrastructure/`** and depend **only** **on **`domain`** (implementing these traits).

Optional **`services/library-api/src/application/ports/`** holds outbound traits that are **not** repositories (for example **`Clock`**, event publishers). Catalogue **repository traits** belong **only under **`domain/repositories/`**.

Use-case handlers **coordinate** workflows; they typically receive **`Arc<dyn domain::repositories::…>`** (and optional **`application::ports`** types) via the composition root. **`domain/models`** and **`domain/services`** may depend on **`domain/repositories`** traits whenever read/write coupling is intrinsic to those rules.

Mapping to gRPC stays in **interface adapters**: thin **`impl`** of generated traits that translate **`tonic::Request`**, call **`application/usecases/<use_case>`**, map errors and responses.

For a fuller layering picture, including optional evolution into workspace crates, see [`docs/clean-architecture-layers.md`](./clean-architecture-layers.md).

**Consequences.**

- New RPC or job types usually add or extend **`application/usecases/<use_case>`**, keeping reviewers oriented by **intent** (“what triggered this”).
- Persistence contracts (**`trait SongRepository`**, siblings) ship next to **`domain`** code (on-disk **`domain/repositories/`**) so tests attach **repo mocks** beside **pure model** assertions.
- Composition root (**`library-server`**) binds **infra → domain traits** plus **handlers** consuming those trait objects.

---

## 9. Licensing

**Decision.** Workspace packages use the **Apache-2.0** license (`license` in the root `Cargo.toml`).

**Consequences.** Downstream use and contribution expectations are explicit; keep `LICENSE` files and headers aligned with this choice as the project grows.

---

## Related files

| File / directory | Purpose |
|------------------|---------|
| `Cargo.toml` | Workspace members and shared metadata |
| `buf.yaml` / `buf.gen.yaml` | Buf module and Rust codegen |
| `proto/library/v1/library.proto` | Library gRPC API definition |
| `crates/proto-gen/` | Generated Rust + small re-export crate |
| `services/library-api/` | Server and client binaries |
| `services/library-api/src/application/usecases/` | Per-trigger handlers (**`<use_case>/`**) (**§8**) |
| `services/library-api/src/domain/repositories/` | Repository **trait** definitions only (**§8**) |
| [`docs/clean-architecture-layers.md`](./clean-architecture-layers.md) | Layering and where to implement gRPC vs domain logic |
| [`docs/migrate-to-connect.md`](./migrate-to-connect.md) | Checklist for migrating from Tonic to connect-rust + **Axum** |

---

## Changelog

| Date | Summary |
|------|---------|
| 2026-05-20 | Initial version documenting current workspace and API stack |
| 2026-05-20 | Link clean-architecture layering doc for library service structure |
| 2026-05-20 | **`application/usecases/<use_case>/`** for handlers (**§8**); **`domain/repositories`** for repository traits |
| 2026-05-20 | Add [**migrate-to-connect.md**](./migrate-to-connect.md) migration checklist |

When you change a major decision (e.g. switching from committed gen to build-time only), add a short subsection here or a numbered ADR file under `docs/adr/` and link it from this document.
