//! Binary composition root.

use axum::{Router, routing::get};
use connectrpc::Router as ConnectRouter;
use proto_gen::connect::library::v1::LibraryServiceExt;
use std::sync::Arc;

use library_api::{
    adapters::connect::ConnectLibraryService, application::usecases::get_health::GetHealthHandler,
    infrastructure::NoopLibraryRepository,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let songs = NoopLibraryRepository::arc();
    let get_health = Arc::new(GetHealthHandler::new(songs));
    let library_svc = Arc::new(ConnectLibraryService::new(Arc::clone(&get_health)));
    let connect = library_svc.register(ConnectRouter::new());

    let addr = "[::1]:8080".parse::<std::net::SocketAddr>()?;
    let app = Router::new()
        .route("/health", get(|| async { "Ok" }))
        .fallback_service(connect.into_axum_service());
    let listener = tokio::net::TcpListener::bind(addr).await?;

    eprintln!("library-server listening connect://{}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}
