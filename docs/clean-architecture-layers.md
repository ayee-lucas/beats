# Clean architecture layering (library API)

Guidelines for how **beats** should structure the **library API** so domain rules stay isolated from transports and frameworks. Aligns with the workspace described in [`architecture-decisions.md`](./architecture-decisions.md).

## Goals

- Keep **business rules** testable without a running HTTP/Connect stack.
- Restrict **`proto-gen`** / **`connectrpc`** usage to **edges** (`RequestContext`, `ServiceRequest`, generated messages, `ConnectError`).
- Preserve **thin** composition roots (`library-server`, `library-client`) that only wire implementations.

---

## Layer model

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
                    │   Application / use cases            │
                    │   delivery orchestration per trigger │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │            Domain                    │
                    │   entities, repositories (traits),  │
                    │   domain services                     │
                    │   no connectrpc, no proto-gen        │
                    └──────────────────────────────────────┘
```

**Dependency rule:** Outer layers depend on inner layers—not the reverse. Inner layers expose **Rust traits and types they own**. Outer layers satisfy those traits using concrete infra (repos, adapters).

### Project choice: use-case application modules

This workspace follows [**§8 — Application layer organized by use case**](./architecture-decisions.md#8-application-layer-organized-by-use-case):

- **`application/usecases/<use_case>/`** — orchestration for one triggered operation (often aligned with an RPC or job): transaction span, sequencing, retries, assembling arguments for **pure** **`domain`** code.
- **`domain/repositories/`** — **Rust traits** for catalogue persistence (implemented **under **`infrastructure/`**, which depends **on **`domain`**).
- **`application/ports/`** (optional) — **non-repository** outbound traits (**`Clock`**, messaging, …). Do **not** duplicate catalogue **`repository`** traits here; those stay **`domain/repositories/`**.
- **`domain/models`** and **`domain/services`** encode **meaning** and catalogue rules (**no `connectrpc`**, **`proto-gen`**, or databases).

Example shape (illustrative):

```text
services/library-api/src/
├── application/
│   ├── mod.rs
│   ├── ports/
│   │   └── clock.rs               # trait Clock — optional alternative homes ok
│   └── usecases/
│       ├── mod.rs
│       └── get_health/
│           └── handler.rs         # may inject Arc<dyn domain::repositories::LibraryRepository>, …
├── domain/
│   ├── repositories/
│   │   └── library_repository.rs  # pub trait LibraryRepository { … }
│   ├── models/
│   │   └── library.rs
│   └── services/                  # may depend on traits from domain/repositories
└── adapters/
    └── connect/
        └── library_service.rs     # impl LibraryService → application::usecases::get_health::…
```

---

## Generated Connect code

connect-rust (via Buf) emits a server trait (`LibraryService`), registration helpers (`LibraryServiceExt`), and `LibraryServiceClient`.

- **`crates/proto-gen`** remains the **contract surface** only ([§5 in architecture decisions](./architecture-decisions.md#5-proto-gen-crate-as-a-thin-facade)). Do not put business logic there.
- **Implement `LibraryService` in `services/library-api`**, inside **`adapters/connect/`**. Never modify generated stubs for behavior.

The adapter implementation should stay **thin**: read inputs from **`ServiceRequest`** / message views, own what the use case needs, call application handlers, map domain errors to **`ConnectError`**, return **`Response::ok(...)`**.

Boundary types that belong in the adapter (not domain/application):

| Type | Role |
|------|------|
| `RequestContext` | Per-call Connect context |
| `ServiceRequest<'_, T>` | Borrowed request wrapper / views |
| `ConnectError` | Wire error codes |
| `Response` / `ServiceResult` | Encodeable success path |

---

## Composition root: `library-server`

The **`library-server`** binary is the primary **composition root** for hosting the API:

1. Build **infrastructure** that **`impl`** **`domain/repositories`** traits (and **`application::ports`** when used).
2. Instantiate **handlers** (**`application/usecases/<use_case>`**) with those **`Arc<dyn …>`** dependencies.
3. Build the **Connect adapter** (`ConnectLibraryService`) that implements generated `LibraryService` and delegates to application code.
4. `register` on a Connect router, mount on **Axum** (`GET /health` + `fallback_service(connect.into_axum_service())`), serve with Tokio.

As shared code grows, prefer a **`src/lib.rs`** in `library-api` so inner modules (`domain`, `application`, `adapters`) are library code and **`src/server.rs` stays a slim `main`**.

---

## Client binary: `library-client`

The **`library-client`** binary sits on the **same outer boundary** but on the caller side ([§7](./architecture-decisions.md#7-library-service-process-layout)). Use generated **`LibraryServiceClient`**, **`HttpClient`**, and **`ClientConfig`** from **`proto-gen` / connectrpc** there; avoid importing inner domain modules unless the binary truly needs shared behavior—then expose a small façade from `lib`.

When the client is only examples or tooling, keeping it beside the server is acceptable. If it becomes a standalone product CLI, moving it to its own crate (or workspace member) avoids coupling unrelated delivery concerns into the server package.

Default base URL for local smoke tests: **`http://[::1]:8080`**.

---

## Cargo layout conventions

Today the workspace uses explicit binaries:

| Binary           | Typical path                             |
|------------------|-------------------------------------------|
| `library-server` | `services/library-api/src/server.rs`      |
| `library-client` | `services/library-api/src/client.rs`      |

That arrangement is appropriate for architecture: both are **process / driver entry points**.

An equivalent conventional layout is `services/library-api/src/bin/library-server.rs` and `services/library-api/src/bin/library-client.rs`; choose one style per crate and stick to it.

---

## Evolving toward separate crates

When the codebase outgrows a single crate, split by layer without breaking the dependency rule:

| Crate (example)       | Responsibility                            |
|-----------------------|--------------------------------------------|
| `library-domain`      | Entities, **`repositories`** (traits only), **`services`**, invariants |
| `library-application` | Use-case modules (**`usecases/<use_case>/`**); optional **`application/ports`** (**non-repository**) |
| `library-api` (bin + thin lib) | Connect adapters, Axum composition root |

The server crate depends on **application + proto-gen**. **Domain** depends on neither connectrpc nor `proto-gen`.

---

## Related

- [`architecture-decisions.md`](./architecture-decisions.md) — Buf, `proto-gen`, Axum hosting, and binary naming.
- `proto/library/v1/library.proto` — contract source of truth.
- `services/library-api/` — server and client entry points until refactored further.
- [`migrate-to-connect.md`](./migrate-to-connect.md) — migration checklist.
