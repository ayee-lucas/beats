# Clean architecture layering (library API)

Guidelines for how **beats** should structure the **library gRPC service** so domain rules stay isolated from transports and frameworks. Aligns with the workspace described in [`architecture-decisions.md`](./architecture-decisions.md).

## Goals

- Keep **business rules** testable without a running gRPC stack.
- Restrict **`proto-gen`** usage to **edges** that speak Protobuf/Tonic (`tonic::Request`, generated messages).
- Preserve **thin** composition roots (`library-server`, `library-client`) that only wire implementations.

---

## Layer model

Think of rings from **outside** (frameworks and I/O) to **inside** (pure domain):

```text
                    ┌─────────────────────────────────────┐
                    │     Frameworks & drivers            │
                    │  Tokio, Tonic, DB clients, filesystem │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      Interface adapters             │
                    │  gRPC: impl of generated traits     │
                    │  (map Request / Response ↔ app)    │
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
                    │   no tonic, no proto-gen              │
                    └──────────────────────────────────────┘
```

**Dependency rule:** Outer layers depend on inner layers—not the reverse. Inner layers expose **Rust traits and types they own**. Outer layers satisfy those traits using concrete infra (repos, adapters).

### Project choice: use-case application modules

This workspace follows [**§8 — Application layer organized by use case**](./architecture-decisions.md#8-application-layer-organized-by-use-case):

- **`application/usecases/<use_case>/`** — orchestration for one triggered operation (often aligned with an RPC or job): transaction span, sequencing, retries, assembling arguments for **pure** **`domain`** code.
- **`domain/repositories/`** — **Rust traits** for catalogue persistence (implemented **under **`infrastructure/`**, which depends **on **`domain`**).
- **`application/ports/`** (optional) — **non-repository** outbound traits (**`Clock`**, messaging, …). Do **not** duplicate catalogue **`repository`** traits here; those stay **`domain/repositories/`**.
- **`domain/models`** and **`domain/services`** encode **meaning** and catalogue rules (**no `tonic`**, **`proto-gen`**, or databases).

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
│           └── handler.rs         # may inject Arc<dyn domain::repositories::SongRepository>, …
├── domain/
│   ├── repositories/
│   │   └── song.rs                # pub trait SongRepository { … }
│   ├── models/
│   │   └── song.rs
│   └── services/                  # may depend on traits from domain/repositories
└── adapters/
    └── grpc/
        └── library_service.rs     # impl LibraryService → application::usecases::get_health::…
```

---

## Generated gRPC code

Tonic emits a server trait (`LibraryService`) and wrappers such as `LibraryServiceServer`.

- **`crates/proto-gen`** remains the **contract surface** only ([§5 in architecture decisions](./architecture-decisions.md#5-proto-gen-crate-as-a-thin-facade)). Do not put business logic there.
- **Implement `LibraryService` in `services/library-api`**, inside an adapter module (for example `grpc/` or `adapters/grpc/`). Never modify generated stubs for behavior.

The adapter implementation should stay **thin**: validate or extract inputs, call application services, translate errors to `tonic::Status`, wrap responses in `tonic::Response`.

---

## Composition root: `library-server`

The **`library-server`** binary is the primary **composition root** for hosting the API:

1. Build **infrastructure** that **`impl`** **`domain/repositories`** traits (and **`application::ports`** when used).
2. Instantiate **handlers** (**`application/usecases/<use_case>`**) with those **`Arc<dyn …>`** dependencies (repository traits from **`domain`**, other traits from **`application::ports`** when needed).
3. Build the **gRPC adapter** that implements `LibraryService` and delegates to application code.
4. Pass the adapter into `LibraryServiceServer::new(...)`, attach to Tokio/Tonic serve.

As shared code grows, prefer a **`src/lib.rs`** in `library-api` so inner modules (`domain`, `application`, `grpc`) are library code and **`src/server.rs` (or `src/bin/library-server.rs`) stays a slim `main`**.

---

## Client binary: `library-client`

The **`library-client`** binary sits on the **same outer boundary** but on the caller side ([§7](./architecture-decisions.md#7-library-service-process-layout)). Use generated clients from **`proto-gen`** there; avoid importing inner domain modules unless the binary truly needs shared behavior—then expose a small façade from `lib`.

When the client is only examples or tooling, keeping it beside the server is acceptable. If it becomes a standalone product CLI, moving it to its own crate (or workspace member) avoids coupling unrelated delivery concerns into the server package.

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
| `library-api` (bin + thin lib) | gRPC adapters, composition root     |

The server crate depends on **application + proto-gen**. **Domain** depends on neither Tonic nor `proto-gen`.

---

## Related

- [`architecture-decisions.md`](./architecture-decisions.md) — Buf, `proto-gen`, and binary naming.
- `proto/library/v1/library.proto` — contract source of truth.
- `services/library-api/` — server and client entry points until refactored further.
