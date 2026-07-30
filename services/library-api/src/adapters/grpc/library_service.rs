use std::sync::Arc;

pub struct GrpcLibraryService {
    get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
}

impl GrpcLibraryService {
    pub fn new(
        get_health: Arc<crate::application::usecases::get_health::GetHealthHandler>,
    ) -> Self {
        Self { get_health }
    }
}
