use std::sync::Arc;

use crate::domain::models::{FileEntry, ListingResult, SortOptions};
use crate::domain::operations::validate_path;
use crate::domain::ports::FileSystemPort;
use crate::error::AppError;

/// Use cases around reading the filesystem.
pub struct ListingService {
    fs: Arc<dyn FileSystemPort>,
}

impl ListingService {
    pub fn new(fs: Arc<dyn FileSystemPort>) -> Self {
        Self { fs }
    }

    pub async fn list(
        &self,
        path: &str,
        show_hidden: bool,
        sort: SortOptions,
    ) -> Result<ListingResult, AppError> {
        validate_path(path)?;
        self.fs.list_dir(path, show_hidden, sort).await
    }

    pub async fn metadata(&self, path: &str) -> Result<FileEntry, AppError> {
        validate_path(path)?;
        self.fs.metadata(path).await
    }
}
