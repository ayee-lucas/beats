use axum::{Router, routing::get};
use connectrpc::Router as ConnectRouter;
use profile_api::config::Settings;
use proto_gen::connect::profile::v1::ProfileServiceExt;
use std::sync::Arc;

use profile_api::{
    adapters::connect::ConnectProfileService, application::usecases::get_health::GetHealthHandler,
    infrastructure::InMemoryProfileRepository,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let settings = Settings::load()?;

    let profile_repo = InMemoryProfileRepository::arc();
    let get_health = Arc::new(GetHealthHandler::new(profile_repo));
    let profile_svc = Arc::new(ConnectProfileService::new(Arc::clone(&get_health)));
    let connect = profile_svc.register(ConnectRouter::new());

    let host: std::net::IpAddr = settings.server.host.parse()?;
    let addr = std::net::SocketAddr::new(host, settings.server.port);
    let app = Router::new()
        .route("/health", get(|| async { "Ok" }))
        .fallback_service(connect.into_axum_service());
    let listener = tokio::net::TcpListener::bind(addr).await?;

    eprintln!(
        "profile-server listening http://{} (Axum + Connect + gRPC + gRPC-Web)",
        addr
    );
    axum::serve(listener, app).await?;
    Ok(())
}
