# Migrate beats from Tonic to connect-rust

This checklist tracks moving the **library API** from **Tonic + prost** to **[connect-rust](https://github.com/anthropics/connect-rust)** (Connect + gRPC + gRPC-Web over HTTP), hosted with **Axum**. API contracts stay in `proto/`; clean-architecture layers stay the same—only codegen, the transport adapter, and the composition root change.

Related docs: [architecture-decisions.md](./architecture-decisions.md), [clean-architecture-layers.md](./clean-architecture-layers.md).

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
- [ ] Choose listen address: e.g. keep `[::1]` but use an **HTTP** port (e.g. `8080`) and document `http://` for clients (not `grpc://` on `50051`).
- [ ] Record plugin versions in README or Makefile comments for reproducibility.

---

## 1. Install codegen tooling

Requires [Buf](https://buf.build/docs/installation) (already used).

- [ ] Install **`protoc-gen-buffa`** and **`protoc-gen-buffa-packaging`** — [buffa](https://github.com/anthropics/buffa) releases or `cargo install`.
- [ ] Install **`protoc-gen-connect-rust`** — [GitHub release](https://github.com/anthropics/connect-rust/releases) or `cargo install --locked connectrpc-codegen`.

---

## 2. Switch `buf.gen.yaml`

Today: `neoeinstein-prost` + `neoeinstein-tonic` → `crates/proto-gen/gen`.

- [ ] Remove **neoeinstein-prost** and **neoeinstein-tonic** plugins.
- [ ] Add **buffa** plugin → e.g. `crates/proto-gen/gen/buffa` with `opt: [views=true, json=true]`.
- [ ] Add **buffa-packaging** on buffa out with `strategy: all`.
- [ ] Add **protoc-gen-connect-rust** → e.g. `crates/proto-gen/gen/connect` with `opt: [extern_path=.=::proto_gen::proto]` (must match `pub mod proto` in `proto-gen/src/lib.rs`).
- [ ] Add second **buffa-packaging** on connect out with `strategy: all` and `opt: [filter=services]`.
- [ ] Run `make proto` / `buf generate` and fix any proto lint issues.

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

- [ ] Replace checked-in **`gen/library/v1/library.v1.rs`** and **`library.v1.tonic.rs`** with buffa + connect trees under `gen/buffa` and `gen/connect`.
- [ ] Update **`src/lib.rs`** to expose modules, for example:

  ```rust
  #[path = "../gen/buffa/mod.rs"]
  pub mod proto;
  #[path = "../gen/connect/mod.rs"]
  pub mod connect;
  ```

- [ ] Update **`Cargo.toml`**: remove `tonic`, `tonic-prost`, `prost`; add connect-rust generated deps (`connectrpc`, `buffa`, `buffa-types`, `serde`, `serde_json`, `http-body` — see [connect-rust README](https://github.com/anthropics/connect-rust#generated-code-dependencies)).
- [ ] Add crate-root allows if the compiler requires them:

  ```rust
  #![allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
  ```

- [ ] `cargo build -p proto-gen` and commit regenerated `gen/`.

---

## 4. `library-api` dependencies

**`services/library-api/Cargo.toml`:**

- [ ] Remove **`tonic`** and **`async-trait`** (if only used for the gRPC adapter).
- [ ] Add **`connectrpc`** with `features = ["axum"]` (Axum integration for `into_axum_service` / `into_axum_router`).
- [ ] Add **`axum`** and **`tokio`** with `net` (for `TcpListener` + `axum::serve`).
- [ ] Keep **`proto-gen`** path dependency.

Example:

```toml
connectrpc = { version = "0.6", features = ["axum"] }
axum = "0.8"
tokio = { version = "1", features = ["macros", "rt-multi-thread", "net"] }
```

- [ ] `cargo build -p library-api` (adapter/server will fail until steps 5–6).

---

## 5. Transport adapter

Largest application change. **Do not** hand-write `trait LibraryService` — implement the **generated** Connect trait from `proto_gen::connect::…`.

- [ ] Add module e.g. **`src/adapters/connect/`** (rename from `grpc/` or keep name and swap implementation).
- [ ] Replace **`GrpcLibraryService`** Tonic impl with Connect impl:

  | Tonic (today) | Connect |
  |---------------|---------|
  | `tonic::Request<GetHealthRequest>` | `RequestContext` + `OwnedView<GetHealthRequestView<'_>>` |
  | `Result<tonic::Response<…>, tonic::Status>` | `ServiceResult<GetHealthResponse>` / `Response::ok(…)` |
  | `map_ping_error` → `tonic::Status` | `ConnectError` + `ErrorCode` (e.g. `Unavailable`) |

- [ ] Update **`src/adapters/mod.rs`** exports.
- [ ] **Do not** import `connectrpc` / `proto_gen` in **`domain/`** or **`application/`** — only the adapter and binaries.

Reference: current adapter at `services/library-api/src/adapters/grpc/library_service.rs`.

---

## 6. Composition root — `server.rs` (Axum)

**`services/library-api/src/server.rs`:**

- [ ] Keep wiring: `NoopSongRepository` → `GetHealthHandler` → adapter `Arc`.
- [ ] Remove `LibraryServiceServer::new` and `tonic::transport::Server`.
- [ ] Register the Connect service and mount it on Axum:

  ```rust
  //! Binary composition root: wire `Arc`s, Axum app with Connect fallback.

  use std::sync::Arc;

  use axum::{Router, routing::get};
  use connectrpc::Router as ConnectRouter;
  use library_api::{
      adapters::connect::ConnectLibraryService,
      application::usecases::get_health::GetHealthHandler,
      infrastructure::NoopSongRepository,
  };

  #[tokio::main]
  async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
      let songs = NoopSongRepository::arc();
      let get_health = Arc::new(GetHealthHandler::new(songs));

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

- [ ] Smoke-test: `cargo run -p library-api --bin library-server`.

**Alternative:** `connect.into_axum_router()` merged with `.merge()` if you prefer a sub-router instead of `fallback_service`—`fallback_service` is the usual pattern when RPC paths are dynamic (`/library.v1.LibraryService/GetHealth`).

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
- [ ] **`docs/clean-architecture-layers.md`**: adapter boundary types (`RequestContext`, `ConnectError`, views); composition root uses **Axum** + Connect `fallback_service`.
- [ ] **`Makefile`**: `help` / comments — note buffa + connect plugins, not only `buf`.
- [ ] Inline comments: `domain/repositories/song_repository.rs`, `domain/mod.rs`, adapter module — “map in Connect adapter”, not Tonic.

---

## 9. Verification

- [ ] `cargo build --workspace`
- [ ] `cargo run -p library-api --bin library-server`
- [ ] Plain HTTP health (Axum):

  ```bash
  curl -s 'http://[::1]:8080/health'
  ```

- [ ] Connect JSON RPC:

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

1. **Codegen only** — `buf.gen.yaml`, `proto-gen`, committed `gen/` (library-api may not build until PR 2).
2. **Runtime** — adapter, Axum `server.rs`, `Cargo.toml`, `/health` + RPC curl smoke tests.
3. **Docs** — architecture + layering docs; client when implemented.

---

## Layer import rules (unchanged)

| Layer | May import |
|-------|------------|
| **Domain** | Domain only — no `proto_gen`, no `connectrpc`, no `axum` |
| **Application** | Domain only |
| **Adapters (`connect/`)** | `proto_gen`, `connectrpc`, application, domain (for error mapping) |
| **`server.rs`** | `library_api`, `connectrpc`, `axum`, `tokio` |
