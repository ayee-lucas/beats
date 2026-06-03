//! Binary composition root (**construct `Arc`s, spawn Tonic **`Server`**).

use std::sync::Arc;

use library_api::{
    adapters::grpc::GrpcLibraryService,
    application::usecases::get_health::GetHealthHandler,
    infrastructure::NoopSongRepository,
};
use proto_gen::library_service_server::LibraryServiceServer;
use tonic::transport::Server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let songs = NoopSongRepository::arc();
    let get_health = Arc::new(GetHealthHandler::new(songs));

    let grpc_adapter = GrpcLibraryService::new(Arc::clone(&get_health));
    let svc = LibraryServiceServer::new(grpc_adapter);

    let addr = "[::1]:50051".parse::<std::net::SocketAddr>()?;
    eprintln!("library-server listening grpc://{}", addr);

    Server::builder().add_service(svc).serve(addr).await?;

    Ok(())
}
