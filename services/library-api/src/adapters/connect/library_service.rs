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
        let outcome = self.get_health.run(name).await?;

        Response::ok(GetHealthResponse {
            status: outcome.message,
            ..Default::default()
        })
    }
}

impl From<crate::domain::repositories::PingError> for ConnectError {
    fn from(err: crate::domain::repositories::PingError) -> Self {
        match err {
            crate::domain::repositories::PingError::BackendUnavailable => {
                ConnectError::unavailable(err.to_string())
            }
        }
    }
}
