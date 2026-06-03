//! **Do not** declare your own **`trait LibraryService`**: Tonic **generates** it from **`proto/library/v1/library.proto`** and publishes **`proto_gen::library_service_server::LibraryService`**.
//! Provide a **`struct`** (**`GrpcLibraryService`**) and **`#[tonic::async_trait] impl`** that trait instead.

use std::sync::Arc;

/// Thin type that **implements Protobuf-derived `library.v1.LibraryService`**.
///
/// Responsibility split:
///
/// | Layer | Responsibility |
/// |-------|----------------|
/// | `proto_gen::*` traits | Mechanical **gRPC signatures** (**do not redefine** manually). |
/// | **`GrpcLibraryService`** (this file) | Translate **`Request<…>`**/errors ↔ application types. |
/// | **`application::usecases::get_health::GetHealthHandler`** | Delivery orchestration (**per ADR §8**). |
/// | **`domain::repositories::SongRepository`** | Persistence contract (**traits only**). |
pub struct GrpcLibraryService {
    get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
}

impl GrpcLibraryService {
    pub fn new(
        get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
    ) -> Self {
        Self { get_health }
    }
}

#[tonic::async_trait]
impl proto_gen::library_service_server::LibraryService for GrpcLibraryService {
    async fn get_health(
        &self,
        request: tonic::Request<proto_gen::GetHealthRequest>,
    ) -> Result<tonic::Response<proto_gen::GetHealthResponse>, tonic::Status> {
        let proto_gen::GetHealthRequest { name } = request.into_inner();
        let outcome = self.get_health.run(name).await.map_err(map_ping_error)?;
        Ok(tonic::Response::new(proto_gen::GetHealthResponse {
            status: outcome.message,
        }))
    }
}

fn map_ping_error(err: crate::domain::repositories::PingError) -> tonic::Status {
    use crate::domain::repositories::PingError::*;
    match err {
        BackendUnavailable => tonic::Status::unavailable("library persistence unavailable"),
    }
}
