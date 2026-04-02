#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _addr = "[::1]:50051".parse::<std::net::SocketAddr>()?;
    Ok(())
}