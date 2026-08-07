use async_trait::async_trait;

#[async_trait]
pub trait LibraryRepository: Send + Sync {
    async fn ping(&self) -> Result<(), PingError>;
}

#[derive(Debug)]
pub enum PingError {
    BackendUnavailable,
}

impl std::fmt::Display for PingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PingError::BackendUnavailable => write!(f, "library persistence unavailable"),
        }
    }
}

impl std::error::Error for PingError {}
