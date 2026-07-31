use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::repositories::{LibraryRepository, PingError};

/// Development stand-in backing storage—not for production workloads.
#[derive(Debug, Default)]
pub struct NoopLibraryRepository;

impl NoopLibraryRepository {
    pub fn arc() -> Arc<dyn LibraryRepository> {
        Arc::new(NoopLibraryRepository)
    }
}

#[async_trait]
impl LibraryRepository for NoopLibraryRepository {
    async fn ping(&self) -> Result<(), PingError> {
        Ok(())
    }
}
