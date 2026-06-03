use std::sync::Arc;

use crate::domain::repositories::{PingError, SongRepository};

/// Result of **`GetHealth`**: **`application`** stays free of Protobuf structs.
#[derive(Debug)]
pub struct HealthOutcome {
    pub message: String,
}

pub struct GetHealthHandler {
    songs: Arc<dyn SongRepository>,
}

impl GetHealthHandler {
    pub fn new(songs: Arc<dyn SongRepository>) -> Self {
        Self { songs }
    }

    pub async fn run(&self, name: String) -> Result<HealthOutcome, PingError> {
        self.songs.ping().await?;

        let message = if name.is_empty() {
            "beats library: OK (caller name omitted)".into()
        } else {
            format!("beats library: OK (hello `{name}`)")
        };

        Ok(HealthOutcome { message })
    }
}
