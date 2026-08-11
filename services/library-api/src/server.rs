use axum::{Router, routing::get};
use connectrpc::Router as ConnectRouter;
use library_api::config::Settings;
use proto_gen::connect::library::v1::LibraryServiceExt;
use std::sync::Arc;

use library_api::{
    adapters::connect::ConnectLibraryService, application::usecases::get_health::GetHealthHandler,
    infrastructure::InMemoryLibraryRepository,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let settings = Settings::load()?;

    let library_repo = InMemoryLibraryRepository::arc();
    let get_health = Arc::new(GetHealthHandler::new(library_repo));
    let library_svc = Arc::new(ConnectLibraryService::new(Arc::clone(&get_health)));
    let connect = library_svc.register(ConnectRouter::new());

    let host: std::net::IpAddr = settings.server.host.parse()?;
    let addr = std::net::SocketAddr::new(host, settings.server.port);
    let app = Router::new()
        .route("/health", get(|| async { "Ok" }))
        .fallback_service(connect.into_axum_service());
    let listener = tokio::net::TcpListener::bind(addr).await?;

    eprintln!(
        "library-server listening http://{} (Axum + Connect + gRPC + gRPC-Web)",
        addr
    );
    axum::serve(listener, app).await?;
    Ok(())
}
