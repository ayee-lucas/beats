use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use proto_gen::connect::library::v1::LibraryService;
use proto_gen::proto::library::v1::{GetHealthRequest, GetHealthResponse};
use std::sync::Arc;

pub struct ConnectLibraryService {
    get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
}

impl ConnectLibraryService {
    pub fn new(
        get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
    ) -> Self {
        Self { get_health }
    }
}

impl LibraryService for ConnectLibraryService {
    #[allow(refining_impl_trait_reachable)]
    async fn get_health(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, GetHealthRequest>,
    ) -> ServiceResult<GetHealthResponse> {
        let name = String::from(request.name);
        let outcome = self.get_health.run(name).await.map_err(map_ping_error)?;

        Response::ok(GetHealthResponse {
            status: outcome.message,
            ..Default::default()
        })
    }
}

fn map_ping_error(err: crate::domain::repositories::PingError) -> ConnectError {
    use crate::domain::repositories::PingError::*;
    match err {
        BackendUnavailable => ConnectError::unavailable("library persistence unavailable"),
    }
}
