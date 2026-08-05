# Migrate beats from Tonic to connect-rust

This checklist tracks moving the **library API** from **Tonic + prost** to **[connect-rust](https://github.com/anthropics/connect-rust)** (Connect + gRPC + gRPC-Web over HTTP), hosted with **Axum**. API contracts stay in `proto/`; clean-architecture layers stay the same—only codegen, the transport adapter, and the composition root change.

Related docs: [architecture-decisions.md](./architecture-decisions.md), [clean-architecture-layers.md](./clean-architecture-layers.md).

---

## Current progress

| Section | Status |
|---------|--------|
| 0. Prerequisites | Partial — Rust ≥ 1.88 + listen `http://[::1]:8080`; plugin pins still open |
| 1. Codegen tooling | Done |
| 2. `buf.gen.yaml` | Done |
| 3. `proto-gen` | Done (`cargo build -p proto-gen` passes) |
| 4. `library-api` deps | Done (`tonic` removed; keep `async-trait` for repositories) |
| 5. Transport adapter | Done (`cargo build -p library-api --lib` passes) |
| 6. `server.rs` (Axum) | Done — serves on `[::1]:8080` with `/health` + Connect fallback |
| 7. Client binary | Later — still a stub |
| 8. Docs (arch / layers / Makefile) | Next |
| 9. Verification | Mostly done — workspace build + curl smoke tests passed |
| 10. Optional | Later |

**Important version rule learned during codegen:** keep `protoc-gen-buffa`, `buffa`, `buffa-types`, `connectrpc`, and `protoc-gen-connect-rust` on the **same release family**. Mixing `buffa` 0.9 codegen with `buffa`/`connectrpc` 0.8 runtimes fails.

**Important `async-trait` rule:** keep it while `LibraryRepository` uses `async fn` behind `Arc<dyn LibraryRepository>`. Removing it requires a separate repository-abstraction refactor, not part of this transport migration.

---

## Hosting

**Decision:** use **Axum** + connect-rust’s **`Router::into_axum_service()`** (via `fallback_service`).

| Benefit | Detail |
|---------|--------|
| One HTTP server | Connect RPCs and ordinary routes (e.g. `GET /health`) on the same port |
| Tower middleware | Trace, timeout, auth layers compose on the Axum router (see connect-rust [middleware guide](https://github.com/anthropics/connect-rust/blob/main/docs/guide.md#tower-middleware)) |
| Aligns with connect-rust | [Recommended hosting path](https://github.com/anthropics/connect-rust#with-axum-recommended) in the upstream project |

**Not in scope for this migration:** the standalone `connectrpc::Server` (no Axum). Use it only for throwaway experiments; production-shaped **`library-server`** should use Axum.

Use cases and domain code are unchanged when switching hosting; only `server.rs` and dependencies differ.

---

## 0. Prerequisites

- [x] Confirm **Rust ≥ 1.88** locally and in CI (connect-rust MSRV).
- [x] Choose listen address: **`[::1]:8080`** over HTTP (`http://`, not `grpc://` on `50051`).
- [ ] Record plugin versions in README or Makefile comments for reproducibility.
  - Known working local set: `protoc-gen-buffa` / `buffa` / `buffa-types` **0.8.x**, `connectrpc` / `connectrpc-codegen` **0.8.x**.
  - Optional polish: `server.rs` still logs `connect://`; prefer `http://` in the listen message.

---

## 1. Install codegen tooling

Requires [Buf](https://buf.build/docs/installation) (already used).

- [x] Install **`protoc-gen-buffa`** and **`protoc-gen-buffa-packaging`** — [buffa](https://github.com/anthropics/buffa) releases or `cargo install`.
- [x] Install **`protoc-gen-connect-rust`** — [GitHub release](https://github.com/anthropics/connect-rust/releases) or `cargo install --locked connectrpc-codegen`.

Confirm versions stay aligned:

```bash
protoc-gen-buffa --version
protoc-gen-connect-rust --version   # or: cargo install --list | rg connectrpc
```

---

## 2. Switch `buf.gen.yaml`

Was: `neoeinstein-prost` + `neoeinstein-tonic` → `crates/proto-gen/gen`.

- [x] Remove **neoeinstein-prost** and **neoeinstein-tonic** plugins.
- [x] Add **buffa** plugin → e.g. `crates/proto-gen/gen/buffa` with `opt: [views=true, json=true]`.
- [x] Add **buffa-packaging** on buffa out with `strategy: all`.
- [x] Add **protoc-gen-connect-rust** → e.g. `crates/proto-gen/gen/connect` with `opt: [extern_path=.=::proto_gen::proto]` (must match `pub mod proto` in `proto-gen/src/lib.rs`).
- [x] Add second **buffa-packaging** on connect out with `strategy: all` and `opt: [filter=services]`.
- [x] Run `make proto` / `buf generate` and fix any proto lint issues.

Example shape (adjust paths/options to match your `lib.rs` mount):

```yaml
plugins:
  - local: protoc-gen-buffa
    out: crates/proto-gen/gen/buffa
    opt: [views=true, json=true]
  - local: protoc-gen-buffa-packaging
    out: crates/proto-gen/gen/buffa
    strategy: all
  - local: protoc-gen-connect-rust
    out: crates/proto-gen/gen/connect
    opt: [extern_path=.=::proto_gen::proto]
  - local: protoc-gen-buffa-packaging
    out: crates/proto-gen/gen/connect
    strategy: all
    opt: [filter=services]
```

Use `extern_path=.=::proto_gen::proto` (leading `::` on the Rust path) so connect-rust resolves `library.v1` message types to the buffa output crate module. Shorthand `buffa_module=proto_gen::proto` may not be accepted by all plugin versions.

---

## 3. Rework `crates/proto-gen`

- [x] Replace checked-in **`gen/library/v1/library.v1.rs`** and **`library.v1.tonic.rs`** with buffa + connect trees under `gen/buffa` and `gen/connect`.
- [x] Update **`src/lib.rs`** to expose modules:

  ```rust
  extern crate self as proto_gen;

  #[path = "../gen/buffa/mod.rs"]
  pub mod proto;
  #[path = "../gen/connect/mod.rs"]
  pub mod connect;
  ```

  - Keep public module names as **`proto`** and **`connect`**.
  - `extern crate self as proto_gen;` is required so generated Connect code can refer to `::proto_gen::proto::...` from inside the same crate.
  - Prefer `pub mod` over `pub use ...::*` so namespaces stay intact.

- [x] Update **`Cargo.toml`**: remove `tonic`, `tonic-prost`, `prost`; add connect-rust generated deps (`connectrpc`, `buffa`, `buffa-types`, `serde`, `serde_json`, `http-body`).
  - Keep **`connectrpc` / `buffa` / `buffa-types` / `protoc-gen-buffa` on the same release family** (currently **0.8.x**). Mixing buffa **0.9** codegen with **0.8** runtimes fails.
- [x] Add crate-root allows only if the compiler requires them (not needed for current successful `proto-gen` build).
- [x] `cargo build -p proto-gen` succeeds.

---

## 4. `library-api` dependencies

**`services/library-api/Cargo.toml`:**

- [x] Remove **`tonic`**.
- [x] Keep **`async-trait`** for repository `async fn` + `Arc<dyn LibraryRepository>` (do not remove as part of this transport migration).
- [x] Add **`connectrpc`** with `features = ["axum"]`.
- [x] Add **`axum`** and **`tokio`** with `net`.
- [x] Keep **`proto-gen`** path dependency.
- [x] `cargo build -p library-api` passes (Axum `library-server` binary included).

**Lesson learned:** removing `async-trait` without changing repository traits breaks `Arc<dyn LibraryRepository>` because plain `async fn` traits are not dyn-compatible. Treat any `async-trait` removal as a separate refactor.

---

## 5. Transport adapter — DONE

Largest application change. **Do not** hand-write `trait LibraryService` — implement the **generated** Connect trait.

- [x] Add module **`src/adapters/connect/`**.
- [x] Rename type to **`ConnectLibraryService`** with `GetHealthHandler` field + `new`.
- [x] Update **`src/adapters/mod.rs`** to `pub mod connect` (old `grpc/` removed).
- [x] Keep `connectrpc` / `proto_gen` out of **`domain/`** and **`application/`**.
- [x] Implement generated **`LibraryService`** for `ConnectLibraryService`.

  Source of truth: `crates/proto-gen/gen/connect/library.v1.library.__connect.rs`

  For connect-rust **0.8.1**, the method looks like:

  ```rust
  fn get_health(
      &self,
      ctx: RequestContext,
      request: ServiceRequest<'_, GetHealthRequest>,
  ) -> ... ServiceResult<...>
  ```

  Prefer the generated signature over older doc wording that said `OwnedView<GetHealthRequestView<'_>>`.

- [x] Inside `get_health`:
  1. Read caller name from the request view (`request.name` via `Deref` on `ServiceRequest`).
  2. Own it before the use case: `let name = String::from(request.name);` (or `to_owned()`).
  3. Call `self.get_health.run(name).await.map_err(map_ping_error)?`
  4. Return:

     ```rust
     Response::ok(GetHealthResponse {
         status: outcome.message,
         ..Default::default()
     })
     ```

- [x] Add `map_ping_error`:

  ```rust
  fn map_ping_error(err: PingError) -> ConnectError {
      match err {
          PingError::BackendUnavailable => {
              ConnectError::unavailable("library persistence unavailable")
          }
      }
  }
  ```

- [x] Imports used in the adapter:

  ```rust
  use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
  use proto_gen::connect::library::v1::LibraryService;
  use proto_gen::proto::library::v1::{GetHealthRequest, GetHealthResponse};
  ```

- [x] `#[allow(refining_impl_trait_reachable)]` on `get_health` (concrete return refines generated `impl Encodable<...>`).
- [x] `cargo build -p library-api --lib` succeeds.

---

## 6. Composition root — `server.rs` (Axum) — DONE

**Current `server.rs`:** wires `NoopLibraryRepository` → `GetHealthHandler` → `ConnectLibraryService`, registers Connect, mounts Axum with `GET /health` + `fallback_service(connect.into_axum_service())`, listens on **`[::1]:8080`**.

- [x] Remove `LibraryServiceServer::new` and `tonic::transport::Server`.
- [x] Keep wiring: `NoopLibraryRepository` → `GetHealthHandler` → adapter `Arc`.
- [x] Use `ConnectLibraryService` (not `GrpcLibraryService`).
- [x] Register + mount on Axum (`LibraryServiceExt::register`, `into_axum_service`, `fallback_service`).
- [x] Smoke-test: `cargo run -p library-api --bin library-server` (serves HTTP + Connect).

Reference shape (matches the working binary; local names may differ slightly):

```rust
//! Binary composition root: wire `Arc`s, Axum app with Connect fallback.

use std::sync::Arc;

use axum::{Router, routing::get};
use connectrpc::Router as ConnectRouter;
use library_api::{
    adapters::connect::ConnectLibraryService,
    application::usecases::get_health::GetHealthHandler,
    infrastructure::NoopLibraryRepository,
};
// Needed so `.register(...)` is in scope:
use proto_gen::connect::library::v1::LibraryServiceExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let library_repo = NoopLibraryRepository::arc();
    let get_health = Arc::new(GetHealthHandler::new(library_repo));

    let library = Arc::new(ConnectLibraryService::new(Arc::clone(&get_health)));
    let connect = library.register(ConnectRouter::new());

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .fallback_service(connect.into_axum_service());

    let addr = "[::1]:8080";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    eprintln!("library-server listening http://{addr} (Axum + Connect + gRPC + gRPC-Web)");

    axum::serve(listener, app).await?;

    Ok(())
}
```

**Alternative:** `connect.into_axum_router()` merged with `.merge()` if you prefer a sub-router instead of `fallback_service`; `fallback_service` remains the simplest default when RPC paths are dynamic (`/library.v1.LibraryService/GetHealth`).

---

## 7. Client binary

**`services/library-api/src/client.rs`** is a stub today.

- [ ] Defer until needed, or implement with generated **`LibraryServiceClient`**, `connectrpc::client::HttpClient`, and `ClientConfig`.
- [ ] Enable connectrpc **`client`** feature on the crate/bin that calls the API.
- [ ] Base URL: `http://[::1]:8080` (or chosen listen addr).

---

## 8. Documentation updates

After the code migration (or in the same PR):

- [ ] **`docs/architecture-decisions.md`**: Prost/Tonic → buffa/connect-rust + **Axum**; Buf plugins; HTTP transport (Connect + gRPC + gRPC-Web).
- [ ] **`docs/clean-architecture-layers.md`**: adapter boundary types (`RequestContext`, `ConnectError`, views / `ServiceRequest`); composition root uses **Axum** + Connect `fallback_service`.
- [ ] **`Makefile`**: `help` / comments — note buffa + connect plugins, not only `buf`; pin plugin versions.
- [ ] Inline comments: `domain/repositories/library_repository.rs`, `domain/mod.rs`, adapter module — “map in Connect adapter”, not Tonic.

---

## 9. Verification

- [x] `cargo build --workspace`
- [x] `cargo run -p library-api --bin library-server`
- [x] Plain HTTP health (Axum):

  ```bash
  curl -s 'http://[::1]:8080/health'
  ```

- [x] Connect JSON RPC:

  ```bash
  curl -X POST 'http://[::1]:8080/library.v1.LibraryService/GetHealth' \
    -H 'content-type: application/json' \
    -d '{"name":"test"}'
  ```

- [ ] Optional: gRPC or gRPC-Web client against the same listener.
- [ ] After `.proto` changes: `make proto`, commit `gen/`, rebuild.

---

## 10. Optional / later

- [ ] **Tower middleware** on the Axum router (`TraceLayer`, `TimeoutLayer`, auth) — see connect-rust [middleware example](https://github.com/anthropics/connect-rust/tree/main/examples/middleware).
- [ ] **TLS**: wrap `TcpListener` with `tokio_rustls` (Axum path) or use connect-rust client TLS for callers; see [connect-rust TLS guide](https://github.com/anthropics/connect-rust/blob/main/docs/guide.md#tls).
- [ ] Pin **`connectrpc` / `buffa` / `axum`** in workspace `[workspace.dependencies]`.
- [ ] CI: install plugins, `buf generate`, fail on dirty `gen/`.
- [ ] **Interceptors** (connect-rust per-RPC middleware) when needed beyond Tower layers.
- [ ] Optional later: remove `async-trait` by refactoring repositories off `Arc<dyn Trait>` (generics or boxed futures). Separate from this transport migration.

---

## What stays unchanged

| Area | Action |
|------|--------|
| `proto/library/v1/library.proto` | No change unless adding RPCs |
| `application/usecases/*` | No connect imports |
| `domain/repositories/*` | Traits unchanged; error mapping stays in adapter |
| Composition pattern in `server.rs` | Same `Arc` wiring; **Axum** serves HTTP + Connect fallback |

---

## Suggested PR order

1. **Codegen only** — done: `buf.gen.yaml`, `proto-gen`, committed `gen/`, `cargo build -p proto-gen`.
2. **Runtime** — done: Connect adapter (step 5), Axum `server.rs` (step 6), curl smoke tests (step 9).
3. **Docs** — next: architecture + layering docs, Makefile plugin pins (step 8); fix stale “map to tonic” comments in domain.
4. **Client** — optional: implement `library-client` when needed (step 7).

---

## Layer import rules (unchanged)

| Layer | May import |
|-------|------------|
| **Domain** | Domain only — no `proto_gen`, no `connectrpc`, no `axum` |
| **Application** | Domain only |
| **Adapters (`connect/`)** | `proto_gen`, `connectrpc`, application, domain (for error mapping) |
| **`server.rs`** | `library_api`, `connectrpc`, `axum`, `tokio` |

---

## Lessons learned (keep in mind)

| Issue | Lesson |
|-------|--------|
| Unresolved `proto_gen::library_service_server` | Old Tonic paths after buffa/connect codegen — finish `proto-gen` `lib.rs` mount first |
| `cannot find proto_gen in the crate root` | Add `extern crate self as proto_gen;` in `proto-gen` |
| `HasMessageView` / dual `buffa` versions | Align plugin + crate versions (`protoc-gen-buffa` must match `buffa`) |
| Removing `async-trait` broke repositories | Keep it while using `async fn` + `Arc<dyn LibraryRepository>` |
