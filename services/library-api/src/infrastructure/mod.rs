//! Concrete **`domain::repositories::…`** adapters (Postgres/`sqlx` later).

pub mod noop_library_repository;

pub use noop_library_repository::NoopLibraryRepository;
