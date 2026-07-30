//! Binary composition root.

use std::sync::Arc;

use library_api::{
    adapters::grpc::GrpcLibraryService, application::usecases::get_health::GetHealthHandler,
    infrastructure::NoopSongRepository,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let songs = NoopSongRepository::arc();
    let get_health = Arc::new(GetHealthHandler::new(songs));
    let grpc_adapter = GrpcLibraryService::new(Arc::clone(&get_health));
    let addr = "[::1]:50051".parse::<std::net::SocketAddr>()?;
    eprintln!("library-server listening grpc://{}", addr);

    Ok(())
}
