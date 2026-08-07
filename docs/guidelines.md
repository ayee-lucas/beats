# Service guidelines

This document describes how to build a new service in the **beats** workspace. It is written for any service, not only the one that exists today.

The conventions below are the result of two earlier documents that have been merged here:

- `architecture-decisions.md` — workspace, contract-first APIs, code generation, hosting.
- `clean-architecture-layers.md` — how to keep business rules isolated from transports and frameworks.

## Goals

- Keep API contracts **explicit and versioned** (Protobuf packages and services).
- Share generated client and server types across binaries and services via a **single Rust crate**.
- Use **standard tooling** (Buf, buffa, connect-rust) so generation stays reproducible and reviewable.
- Keep **business rules** testable without a running HTTP/Connect stack.
- Restrict `proto-gen` / `connectrpc` usage to the **edges** of a service.
- Preserve **thin** composition roots that only wire implementations together.

---

## 1. Cargo workspace

The repository is a **virtual Cargo workspace** with `resolver = "2"` and shared `[workspace.package]` metadata (`edition`, `license`, `version`).

Typical members:

| Path | Role |
|------|------|
| `crates/proto-gen` | Generated Protobuf / Connect Rust API |
| `services/<service>` | Binaries that host or call a service API |

New services or libraries become new workspace members without a separate release pipeline per crate.

### Shared metadata

Root `Cargo.toml` example:

```toml
[workspace]
members = ["crates/proto-gen", "services/<service>"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "Apache-2.0"
```

Service `Cargo.toml` example:

```toml
[package]
name = "<service>"
version.workspace = true
edition.workspace = true
license.workspace = true

[[bin]]
name = "<service>-server"
path = "src/server.rs"

[[bin]]
name = "<service>-client"
path = "src/client.rs"

[dependencies]
proto-gen = { path = "../../crates/proto-gen" }
tokio = { version = "1", features = ["macros", "rt-multi-thread", "net"] }
axum = { version = "0.8.9" }
connectrpc = { version = "0.8.1", features = ["axum", "client"] }
async-trait = "0.1.91"
http = "1.5.0"
```

---

## 2. Contract-first API with Protocol Buffers

Network APIs need a stable, language-neutral contract. Define services and messages under `proto/<service>/v<N>/<service>.proto` using `proto3` and package names such as `<service>.v1`. RPCs are declared on a `service` (e.g. `<Service>Service`).

Example `proto/<service>/v1/<service>.proto`:

```protobuf
syntax = "proto3";

package <service>.v1;

service <Service>Service {
    rpc GetHealth(GetHealthRequest) returns (GetHealthResponse);
}

message GetHealthRequest {
    string name = 1;
}

message GetHealthResponse {
    string status = 1;
}
```

The `.proto` files are the **source of truth** for request/response shapes and RPC names. Breaking changes are visible in diffs to `proto/` and can be managed with versioning (`v1`, `v2`, …).

---

## 3. Buf for linting and code generation

Raw `protoc` invocations are easy to get wrong across machines and CI. Use Buf to drive generation.

### `buf.yaml`

Configure a module rooted at `./proto`:

```yaml
version: v2
modules:
  - path: ./proto
    name: buf.build/beats/core
```

### `buf.gen.yaml`

Drive Rust generation from local plugins on `PATH`:

```yaml
version: v2
clean: true

plugins:
  # Message types + views (buffa). Requires protoc-gen-buffa on PATH.
  - local: protoc-gen-buffa
    out: crates/proto-gen/gen/buffa
    opt:
      - views=true
      - json=true
  - local: protoc-gen-buffa-packaging
    out: crates/proto-gen/gen/buffa
    strategy: all

  # Service traits + register (connect-rust). Requires protoc-gen-connect-rust on PATH.
  - local: protoc-gen-connect-rust
    out: crates/proto-gen/gen/connect
    opt:
      - extern_path=.=::proto_gen::proto
  - local: protoc-gen-buffa-packaging
    out: crates/proto-gen/gen/connect
    strategy: all
    opt:
      - filter=services
```

Generated Rust is written under `crates/proto-gen/gen/` with `clean: true` so outputs are reset each generation run.

### Plugin / crate version family

Keep these aligned:

| Component | Known working |
|-----------|---------------|
| `protoc-gen-buffa` | **0.8.1** |
| `protoc-gen-buffa-packaging` | **0.4.0** |
| `protoc-gen-connect-rust` (`connectrpc-codegen`) | **0.8.0** |
| `buffa` / `buffa-types` / `connectrpc` (Cargo) | **0.8.1** |

Mixing buffa **0.9** codegen with **0.8** runtimes fails. Run `make proto` to regenerate after changing `.proto` files.

---

## 4. Checked-in generated code

Generated files under `crates/proto-gen/gen/` are **tracked in version control**. They are not excluded in `.gitignore`.

- **Pros:** `cargo build` works without Buf installed; reviews show API diffs in Git; CI does not need code generation for a normal compile.
- **Cons:** Pull requests that change `.proto` files must include regenerated Rust, or CI must enforce regeneration.

---

## 5. `proto-gen` crate as a thin facade

Multiple binaries or services may need the same types and service traits. The `proto-gen` library crate mounts generated trees as modules:

```rust
extern crate self as proto_gen;

#[path = "../gen/buffa/mod.rs"]
pub mod proto;
#[path = "../gen/connect/mod.rs"]
pub mod connect;
```

It depends on `connectrpc`, `buffa`, `buffa-types` (same release family as the plugins). Service crates depend on `proto-gen` via a path dependency:

```toml
proto-gen = { path = "../../crates/proto-gen" }
```

This creates a single import surface (`proto_gen::proto::…`, `proto_gen::connect::…`) for messages and generated `<Service>Service` / `<Service>ServiceClient`. The crate stays small: it does not embed business logic, only the contract.

---

## 6. Async I/O with Tokio + Axum hosting

connect-rust handlers are async; the recommended production-shaped host is Axum.

- Use **Tokio** (`macros`, `rt-multi-thread`, `net`) as the async runtime.
- Host **`<service>-server`** with **Axum**: ordinary routes (e.g. `GET /health`) plus Connect via `fallback_service(connect.into_axum_service())`.
- Depend on `connectrpc` with features `axum` (server) and `client` (typed callers).

One HTTP listener serves Connect, gRPC, and gRPC-Web (per connect-rust) alongside plain HTTP. Tower middleware can compose on the Axum router when needed.

### Binary layout

Under each `services/<service>`, define separate binaries:

| Binary | Purpose |
|--------|---------|
| `<service>-server` | Host `<Service>Service` over HTTP (Axum + Connect) |
| `<service>-client` | Example / smoke tool using generated `<Service>ServiceClient` |

Local default listen address: **`http://[::1]:8080`** (IPv6 loopback). Production would use configuration (environment variables or config files) when that layer is added.

An equivalent conventional layout is `services/<service>/src/bin/<service>-server.rs` and `services/<service>/src/bin/<service>-client.rs`. Choose one style per crate and stick to it.

---

## 7. Clean architecture layering

Think of rings from **outside** (frameworks and I/O) to **inside** (pure domain):

```text
┌─────────────────────────────────────┐
│     Frameworks & drivers            │
│  Tokio, Axum, connectrpc, DB, fs    │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Interface adapters             │
│  Connect: impl of generated traits  │
│  (map ServiceRequest ↔ app)         │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│   Application / use cases           │
│   delivery orchestration per trigger│
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│            Domain                   │
│   entities, repositories (traits),  │
│   domain services                   │
│   no connectrpc, no proto-gen       │
└─────────────────────────────────────┘
```

**Dependency rule:** Outer layers depend on inner layers—not the reverse. Inner layers expose **Rust traits and types they own**. Outer layers satisfy those traits using concrete infrastructure (repositories, adapters).

### Directory layout

```text
services/<service>/src/
├── lib.rs                         # pub mod adapters, application, domain, infrastructure
├── server.rs                      # composition root for <service>-server
├── client.rs                      # smoke / example client for <service>-client
├── application/
│   ├── mod.rs
│   ├── ports/                     # optional: non-repository outbound traits
│   │   └── clock.rs
│   └── usecases/
│       ├── mod.rs
│       └── <use_case>/            # one folder per externally triggered operation
│           ├── mod.rs
│           └── handler.rs         # or service.rs
├── domain/
│   ├── mod.rs
│   ├── repositories/              # trait definitions only
│   │   ├── mod.rs
│   │   └── <resource>_repository.rs
│   ├── models/                    # entities and value objects
│   │   └── <resource>.rs
│   └── services/                  # domain services; may depend on repository traits
│       └── <rule>.rs
└── adapters/
    ├── mod.rs
    └── connect/
        ├── mod.rs
        └── <service>_service.rs   # impl <Service>Service → application::usecases
```

---

## 8. Applying the layering

### 8.1 Use-case modules

Group application code by use case:

- `application/usecases/<use_case>/` — one module subtree per **externally initiated operation** (often aligned with an RPC or job). Name modules in `snake_case` (for example `get_health`, `publish_release`).
- Typical contents: an entrypoint type or function invoked by adapters (often one primary type per folder, e.g. `handler.rs` or `service.rs`), plus **delivery-specific orchestration**: transaction scope, retries, idempotency, ordering of dependency calls—not rules that belong in `domain`.
- `application/usecases/mod.rs` groups every `usecases/*` subtree so `application/mod.rs` can later host `ports/` or other umbrellas without muddying RPC-named folders.

Use-case handlers receive `Arc<dyn domain::repositories::…>` (and optional `application::ports` types) via the composition root. They coordinate workflows and call pure `domain` code.

### 8.2 Domain repositories

`domain/repositories/` holds **Rust traits** for persistence/read-model access only (**no databases or drivers here**). They anchor the ubiquitous language ("load/save/catalogue queries"). Implementations live in `infrastructure/` and depend only on `domain` (implementing these traits).

Example `domain/repositories/<resource>_repository.rs`:

```rust
use async_trait::async_trait;

#[async_trait]
pub trait <Resource>Repository: Send + Sync {
    async fn ping(&self) -> Result<(), <Resource>Error>;
}

#[derive(Debug)]
pub enum <Resource>Error {
    BackendUnavailable,
}
```

`domain/models` and `domain/services` may depend on `domain/repositories` traits whenever read/write coupling is intrinsic to those rules.

### 8.3 Application ports (optional)

`application/ports/` holds outbound traits that are **not** repositories (for example `Clock`, event publishers, idempotency stores). Catalogue repository traits belong **only** under `domain/repositories/`. Do not duplicate them here.

### 8.4 Connect adapter

Implement the generated `<Service>Service` trait inside `adapters/connect/<service>_service.rs`. Never modify generated stubs for behavior.

The adapter stays **thin**:

1. Read inputs from `ServiceRequest` / message views.
2. Own what the use case needs.
3. Call `application::usecases::<use_case>`.
4. Map domain errors to `ConnectError`.
5. Return `Response::ok(...)`.

Boundary types that belong in the adapter (not domain/application):

| Type | Role |
|------|------|
| `RequestContext` | Per-call Connect context |
| `ServiceRequest<'_, T>` | Borrowed request wrapper / views |
| `ConnectError` | Wire error codes |
| `Response` / `ServiceResult` | Encodable success path |

Example adapter skeleton:

```rust
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use proto_gen::connect::<service>::v1::<Service>Service;
use proto_gen::proto::<service>::v1::{GetHealthRequest, GetHealthResponse};
use std::sync::Arc;

pub struct Connect<Service>Service {
    get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
}

impl Connect<Service>Service {
    pub fn new(
        get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
    ) -> Self {
        Self { get_health }
    }
}

impl <Service>Service for Connect<Service>Service {
    #[allow(refining_impl_trait_reachable)]
    async fn get_health(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, GetHealthRequest>,
    ) -> ServiceResult<GetHealthResponse> {
        let name = String::from(request.name);
        let outcome = self.get_health.run(name).await.map_err(map_ping_error)?;

        Response::ok(GetHealthResponse {
            status: outcome.message,
            ..Default::default()
        })
    }
}

fn map_ping_error(err: crate::domain::repositories::<Resource>Error) -> ConnectError {
    use crate::domain::repositories::<Resource>Error::*;
    match err {
        BackendUnavailable => ConnectError::unavailable("<resource> persistence unavailable"),
    }
}
```

### 8.5 Composition root

The `<service>-server` binary is the composition root. It should do only four things:

1. Build infrastructure that `impl` `domain/repositories` traits (and `application::ports` when used).
2. Instantiate handlers (`application/usecases/<use_case>`) with those `Arc<dyn …>` dependencies.
3. Build the Connect adapter (`Connect<Service>Service`) that implements the generated `<Service>Service` and delegates to application code.
4. Register on a Connect router, mount on Axum (`GET /health` + `fallback_service(connect.into_axum_service())`), serve with Tokio.

Example `server.rs`:

```rust
use axum::{Router, routing::get};
use connectrpc::Router as ConnectRouter;
use proto_gen::connect::<service>::v1::<Service>ServiceExt;
use std::sync::Arc;

use <service>::{
    adapters::connect::Connect<Service>Service,
    application::usecases::get_health::GetHealthHandler,
    infrastructure::InMemory<Resource>Repository,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let resource_repo = InMemory<Resource>Repository::arc();
    let get_health = Arc::new(GetHealthHandler::new(resource_repo));
    let service = Arc::new(Connect<Service>Service::new(Arc::clone(&get_health)));
    let connect = service.register(ConnectRouter::new());

    let addr = "[::1]:8080".parse::<std::net::SocketAddr>()?;
    let app = Router::new()
        .route("/health", get(|| async { "Ok" }))
        .fallback_service(connect.into_axum_service());
    let listener = tokio::net::TcpListener::bind(addr).await?;

    eprintln!("<service>-server listening http://{} (Axum + Connect + gRPC + gRPC-Web)", addr);
    axum::serve(listener, app).await?;
    Ok(())
}
```

As shared code grows, prefer a `src/lib.rs` so inner modules are library code and `src/server.rs` stays a slim `main`.

### 8.6 Client binary

The `<service>-client` binary sits on the same outer boundary but on the caller side. Use generated `<Service>ServiceClient`, `HttpClient`, and `ClientConfig` from `proto-gen` / connectrpc there. Avoid importing inner domain modules unless the binary truly needs shared behavior—then expose a small façade from `lib`.

When the client is only examples or tooling, keeping it beside the server is acceptable. If it becomes a standalone product CLI, move it to its own crate (or workspace member) to avoid coupling unrelated delivery concerns into the server package.

Default base URL for local smoke tests: `http://[::1]:8080`.

---

## 9. Evolving toward separate crates

When a service outgrows a single crate, split by layer without breaking the dependency rule:

| Crate (example) | Responsibility |
|-----------------|----------------|
| `<service>-domain` | Entities, `repositories` (traits only), `services`, invariants |
| `<service>-application` | Use-case modules (`usecases/<use_case>/`); optional `application/ports` (non-repository) |
| `<service>-api` (bin + thin lib) | Connect adapters, Axum composition root |

The server crate depends on **application + proto-gen**. **Domain** depends on neither connectrpc nor `proto-gen`.

---

## 10. Adding a new service

1. Add the service crate under `services/<service>` and register it in the root `Cargo.toml` workspace members.
2. Define the contract in `proto/<service>/v1/<service>.proto`.
3. Run `make proto` to regenerate `crates/proto-gen/gen/`.
4. Commit the regenerated Rust under `crates/proto-gen/gen/`.
5. Create `services/<service>/src/lib.rs` exposing `adapters`, `application`, `domain`, `infrastructure`.
6. Implement `domain/repositories/<resource>_repository.rs` traits.
7. Implement `infrastructure/<resource>_repository.rs` concrete repositories.
8. Implement `application/usecases/<use_case>/handler.rs` for each RPC or trigger.
9. Implement `adapters/connect/<service>_service.rs` mapping between Connect and use cases.
10. Write `src/server.rs` as the composition root and `src/client.rs` as a smoke tool.
11. Run `cargo build` and `cargo test` to verify.

---

## 11. Conventions summary

| Area | Convention |
|------|------------|
| Workspace | Virtual workspace, `resolver = "2"`, shared `[workspace.package]` |
| License | Apache-2.0 |
| API contract | `proto/<service>/vN/<service>.proto`, package `<service>.vN` |
| Codegen | Buf + local `protoc-gen-buffa` / `protoc-gen-connect-rust`; `make proto` |
| Generated code | Checked in under `crates/proto-gen/gen/` |
| Contract crate | `crates/proto-gen` mounts `proto` and `connect` modules |
| Runtime family | buffa / connectrpc 0.8.x (plugins and Cargo crates aligned) |
| Hosting | Tokio + Axum + connect-rust; fallback service for Connect/gRPC/gRPC-Web |
| Listen address | `http://[::1]:8080` for local development |
| Binaries | `<service>-server`, `<service>-client` |
| Application | `application/usecases/<use_case>/` |
| Domain | `domain/models/`, `domain/services/`, `domain/repositories/` (traits only) |
| Infrastructure | `infrastructure/<resource>_repository.rs` implements domain traits |
| Adapters | `adapters/connect/<service>_service.rs` is the only Connect-aware module |
| Composition root | `src/server.rs` wires infra → use cases → adapter → Axum |
