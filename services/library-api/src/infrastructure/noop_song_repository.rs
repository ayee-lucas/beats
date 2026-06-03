use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::repositories::{PingError, SongRepository};

/// Development stand-in backing storage—not for production workloads.
#[derive(Debug, Default)]
pub struct NoopSongRepository;

impl NoopSongRepository {
    pub fn arc() -> Arc<dyn SongRepository> {
        Arc::new(NoopSongRepository)
    }
}

#[async_trait]
impl SongRepository for NoopSongRepository {
    async fn ping(&self) -> Result<(), PingError> {
        Ok(())
    }
}
