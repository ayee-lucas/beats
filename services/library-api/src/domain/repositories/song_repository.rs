use async_trait::async_trait;

/// Read/write access to **`Song`** records (trait only—no SQL/driver types).
#[async_trait]
pub trait SongRepository: Send + Sync {
    /// Cheapest probe that backing storage participates in the readiness story.
    async fn ping(&self) -> Result<(), PingError>;
}

/// Persistence failure meaningful to **`domain`**; map to **`tonic::Status` in gRPC adapters.
#[derive(Debug)]
pub enum PingError {
    /// Reserved for timeouts, disconnects, etc.
    BackendUnavailable,
}
