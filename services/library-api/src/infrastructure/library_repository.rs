use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::repositories::{LibraryRepository, PingError};

/// In-memory stand-in; not for production.
#[derive(Debug, Default)]
pub struct InMemoryLibraryRepository;

impl InMemoryLibraryRepository {
    pub fn arc() -> Arc<dyn LibraryRepository> {
        Arc::new(InMemoryLibraryRepository)
    }
}

#[async_trait]
impl LibraryRepository for InMemoryLibraryRepository {
    async fn ping(&self) -> Result<(), PingError> {
        Ok(())
    }
}
