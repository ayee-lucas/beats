# Architectural decisions

This document records the main architectural choices for **beats**: a Rust workspace that exposes a **library API** defined with **Protocol Buffers** and served with **[connect-rust](https://github.com/anthropics/connect-rust)** (Connect + gRPC + gRPC-Web over HTTP) on **Axum**.

## Goals

- Keep API contracts **explicit and versioned** (Protobuf packages and services).
- Share generated client and server types across binaries and future services via a **single Rust crate**.
- Use **standard tooling** (Buf, buffa, connect-rust) so generation stays reproducible and reviewable.

---

## 1. Cargo workspace

**Context.** The repository is organized as one Cargo workspace rather than multiple independent crates at the root.

**Decision.** Use a virtual workspace with `resolver = "2"` and shared `[workspace.package]` metadata (`edition`, `license`, `version`). Members today:

| Path | Role |
|------|------|
| `crates/proto-gen` | Generated Protobuf / Connect Rust API |
| `services/library-api` | Binaries that host or call the library API |

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
- Drive Rust generation from `buf.gen.yaml` using **local** plugins on `PATH`:
  - **`protoc-gen-buffa`** (+ **`protoc-gen-buffa-packaging`**) for message types / views → `crates/proto-gen/gen/buffa`
  - **`protoc-gen-connect-rust`** (+ buffa-packaging with `filter=services`) for Connect service stubs → `crates/proto-gen/gen/connect`

Generated Rust is written under `crates/proto-gen/gen/` with `clean: true` so outputs are reset each generation run.

**Plugin / crate version family (keep aligned):**

| Component | Known working |
|-----------|----------------|
| `protoc-gen-buffa` | **0.8.1** |
| `protoc-gen-buffa-packaging` | **0.4.0** |
| `protoc-gen-connect-rust` (`connectrpc-codegen`) | **0.8.0** |
| `buffa` / `buffa-types` / `connectrpc` (Cargo) | **0.8.1** |

Mixing buffa **0.9** codegen with **0.8** runtimes fails. See also the `Makefile` comments.

**Consequences.**

- Contributors run a single, documented command (`make proto` / `buf generate`) instead of custom scripts.
- Local plugin versions must match the Cargo crate family for a successful build.

---

## 4. Checked-in generated code

**Context.** Generated Rust can either live only in `target/` or be committed.

**Decision.** Generated files under `crates/proto-gen/gen/` are **tracked in version control** (they are not excluded in `.gitignore`).

**Consequences.**

- **Pros:** `cargo build` works without Buf installed; reviews show API diffs in Git; CI does not need code gen for a normal compile.
- **Cons:** Pull requests that change `.proto` files must include regenerated Rust, or CI must enforce regeneration.

---

## 5. `proto-gen` crate as a thin facade

**Context.** Multiple binaries or services may need the same types and service traits.

**Decision.** The `proto-gen` library crate:

- Mounts generated trees as `proto` (buffa) and `connect` (connect-rust):

  ```rust
  extern crate self as proto_gen;

  #[path = "../gen/buffa/mod.rs"]
  pub mod proto;
  #[path = "../gen/connect/mod.rs"]
  pub mod connect;
  ```

- Depends on `connectrpc`, `buffa`, `buffa-types` (same release family as the plugins).

Service crates depend on `proto-gen` via a path dependency (e.g. `proto-gen = { path = "../../crates/proto-gen" }`).

**Consequences.**

- **Single import surface** (`proto_gen::proto::…`, `proto_gen::connect::…`) for messages and generated `LibraryService` / `LibraryServiceClient`.
- The crate stays small: it does not embed business logic, only the contract.

---

## 6. Async I/O with Tokio + Axum hosting

**Context.** connect-rust handlers are async; the recommended production-shaped host is Axum.

**Decision.**

- Use **Tokio** (`macros`, `rt-multi-thread`, `net`) as the async runtime.
- Host **`library-server`** with **Axum**: ordinary routes (e.g. `GET /health`) plus Connect via `fallback_service(connect.into_axum_service())`.
- Depend on `connectrpc` with features `axum` (server) and `client` (typed callers).

**Consequences.**

- One HTTP listener serves Connect, gRPC, and gRPC-Web (per connect-rust) alongside plain HTTP.
- Tower middleware can compose on the Axum router when needed.

---

## 7. Library service process layout

**Context.** Clear separation between “the thing that listens” and “the thing that calls the API” helps development and testing.

**Decision.** Under `services/library-api`, define separate binaries:

| Binary | Purpose |
|--------|---------|
| `library-server` | Host `LibraryService` over HTTP (Axum + Connect) |
| `library-client` | Example / smoke tool using generated `LibraryServiceClient` |

Local default listen address: **`http://[::1]:8080`** (IPv6 loopback). Production would use configuration (environment variables or config files) when that layer is added.

**Consequences.**

- Operational and integration-testing stories can target well-named entry points.
- Deployment can run one binary per role without pulling in the other.

---

## 8. Application layer organized by use case

**Context.** The library service will grow orchestration (“load aggregates, enforce rules, persist”) separately from stable domain semantics and separately from Connect/protobuf.

**Decision.** Prefer **application code grouped by use case**:

- **`services/library-api/src/application/usecases/<use_case>/`** — one module subtree per **externally initiated operation**. Name modules in **`snake_case`** (for example **`get_health`**, **`publish_release`**). Typical contents: an entrypoint type or function invoked by adapters (often one primary type per folder, e.g. `handler.rs`, `service.rs`), plus **delivery-specific orchestration**: transaction scope, retries, idempotency, ordering of dependency calls—not rules that belong in **`domain`** as stable catalogue semantics.

- **`services/library-api/src/application/usecases/mod.rs`** — groups every **`usecases/*`** subtree so **`application/mod.rs`** can later host **`ports/`** or other umbrellas without muddying RPC-named folders.

- **`services/library-api/src/domain/repositories/`** — **Rust traits** for catalogue persistence/read-model access only (**no databases or drivers here**). They anchor the ubiquitous language (“load/save/catalogue queries”). Implementations live **in **`infrastructure/`** and depend **only** **on **`domain`** (implementing these traits).

Optional **`services/library-api/src/application/ports/`** holds outbound traits that are **not** repositories (for example **`Clock`**, event publishers). Catalogue **repository traits** belong **only under **`domain/repositories/`**.

Use-case handlers **coordinate** workflows; they typically receive **`Arc<dyn domain::repositories::…>`** (and optional **`application::ports`** types) via the composition root. **`domain/models`** and **`domain/services`** may depend on **`domain/repositories`** traits whenever read/write coupling is intrinsic to those rules.

Mapping to the wire stays in **interface adapters**: thin **`impl`** of the generated Connect **`LibraryService`** that translates **`ServiceRequest` / views**, calls **`application/usecases/<use_case>`**, and maps errors to **`ConnectError`**.

For a fuller layering picture, including optional evolution into workspace crates, see [`docs/clean-architecture-layers.md`](./clean-architecture-layers.md).

**Consequences.**

- New RPC or job types usually add or extend **`application/usecases/<use_case>`**, keeping reviewers oriented by **intent** (“what triggered this”).
- Persistence contracts (**`trait LibraryRepository`**, siblings) ship next to **`domain`** code (on-disk **`domain/repositories/`**) so tests attach **repo mocks** beside **pure model** assertions.
- Composition root (**`library-server`**) binds **infra → domain traits** plus **handlers** consuming those trait objects, then mounts Connect on Axum.

---

## 9. Licensing

**Decision.** Workspace packages use the **Apache-2.0** license (`license` in the root `Cargo.toml`).

**Consequences.** Downstream use and contribution expectations are explicit; keep `LICENSE` files and headers aligned with this choice as the project grows.

---

## Related files

| File / directory | Purpose |
|------------------|---------|
| `Cargo.toml` | Workspace members and shared metadata |
| `buf.yaml` / `buf.gen.yaml` | Buf module and Rust codegen (buffa + connect-rust) |
| `Makefile` | `proto` target; plugin version pins |
| `proto/library/v1/library.proto` | Library API definition |
| `crates/proto-gen/` | Generated Rust + thin facade (`proto` + `connect`) |
| `services/library-api/` | Server and client binaries |
| `services/library-api/src/application/usecases/` | Per-trigger handlers (**`<use_case>/`**) (**§8**) |
| `services/library-api/src/domain/repositories/` | Repository **trait** definitions only (**§8**) |
| `services/library-api/src/adapters/connect/` | Connect transport adapter |
| [`docs/clean-architecture-layers.md`](./clean-architecture-layers.md) | Layering and where to implement Connect vs domain logic |
| [`docs/migrate-to-connect.md`](./migrate-to-connect.md) | Migration checklist (Tonic → connect-rust + Axum) |

---

## Changelog

| Date | Summary |
|------|---------|
| 2026-05-20 | Initial version documenting current workspace and API stack |
| 2026-05-20 | Link clean-architecture layering doc for library service structure |
| 2026-05-20 | **`application/usecases/<use_case>/`** for handlers (**§8**); **`domain/repositories`** for repository traits |
| 2026-05-20 | Add [**migrate-to-connect.md**](./migrate-to-connect.md) migration checklist |
| 2026-08-06 | Prost/Tonic → buffa/connect-rust + **Axum**; HTTP listen `[::1]:8080`; plugin version family documented |

When you change a major decision (e.g. switching from committed gen to build-time only), add a short subsection here or a numbered ADR file under `docs/adr/` and link it from this document.
