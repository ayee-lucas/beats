//! Concrete **`domain::repositories::…`** adapters (Postgres/`sqlx` later).

pub mod noop_song_repository;

pub use noop_song_repository::NoopSongRepository;
