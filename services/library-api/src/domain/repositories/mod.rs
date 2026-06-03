//! Persistence **traits** catalogue code depends on (**impl`s** live **`infrastructure/`**).

mod song_repository;

pub use song_repository::{PingError, SongRepository};
