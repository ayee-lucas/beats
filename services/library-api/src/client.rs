use std::str::FromStr;

use connectrpc::client::{ClientConfig, HttpClient};
use http::Uri;
use proto_gen::connect::library::v1::LibraryServiceClient;
use proto_gen::proto::library::v1::GetHealthRequest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let http = HttpClient::plaintext();
    let addr = Uri::from_str("http://[::1]:8080")?;
    let config = ClientConfig::new(addr);

    let library_client = LibraryServiceClient::new(http, config);

    let result = library_client
        .get_health(GetHealthRequest {
            name: "test".into(),
            ..Default::default()
        })
        .await?;

    println!("{}", result.view().status);

    Ok(())
}
