use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use proto_gen::connect::profile::v1::ProfileService;
use proto_gen::proto::profile::v1::{GetHealthRequest, GetHealthResponse};
use std::sync::Arc;

pub struct ConnectProfileService {
    get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
}

impl ConnectProfileService {
    pub fn new(
        get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
    ) -> Self {
        Self { get_health }
    }
}

impl ProfileService for ConnectProfileService {
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
