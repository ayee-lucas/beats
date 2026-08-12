use std::sync::Arc;

use crate::domain::repositories::{PingError, ProfileRepository};

#[derive(Debug)]
pub struct HealthOutcome {
    pub message: String,
}

pub struct GetHealthHandler {
    profiles: Arc<dyn ProfileRepository>,
}

impl GetHealthHandler {
    pub fn new(profiles: Arc<dyn ProfileRepository>) -> Self {
        Self { profiles }
    }

    /// Returns the health status for the profile service.
    ///
    /// # Errors
    ///
    /// Returns [`PingError::BackendUnavailable`] if the persistence backend
    /// cannot be reached.
    pub async fn run(&self, name: String) -> Result<HealthOutcome, PingError> {
        self.profiles.ping().await?;

        let message = if name.is_empty() {
            "beats profile: OK (caller name omitted)".into()
        } else {
            format!("beats profile: OK (hello `{name}`)")
        };

        Ok(HealthOutcome { message })
    }
}
