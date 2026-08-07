use async_trait::async_trait;

#[async_trait]
pub trait LibraryRepository: Send + Sync {
    async fn ping(&self) -> Result<(), PingError>;
}

#[derive(Debug)]
pub enum PingError {
    BackendUnavailable,
}
