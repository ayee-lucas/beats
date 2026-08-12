use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::repositories::{PingError, ProfileRepository};

/// In-memory stand-in; not for production.
#[derive(Debug, Default)]
pub struct InMemoryProfileRepository;

impl InMemoryProfileRepository {
    pub fn arc() -> Arc<dyn ProfileRepository> {
        Arc::new(InMemoryProfileRepository)
    }
}

#[async_trait]
impl ProfileRepository for InMemoryProfileRepository {
    async fn ping(&self) -> Result<(), PingError> {
        Ok(())
    }
}
