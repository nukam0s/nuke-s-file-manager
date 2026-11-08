use async_trait::async_trait;

use crate::domain::models::{DriveInfo, FileEntry, ListingResult, SortOptions};
use crate::error::AppError;

/// Port for filesystem access. Implemented by local (and future remote) adapters.
#[async_trait]
pub trait FileSystemPort: Send + Sync {
    async fn list_dir(
        &self,
        path: &str,
        show_hidden: bool,
        sort: SortOptions,
    ) -> Result<ListingResult, AppError>;

    async fn metadata(&self, path: &str) -> Result<FileEntry, AppError>;

    async fn copy_entry(&self, source: &str, destination_dir: &str) -> Result<(), AppError>;

    async fn move_entry(&self, source: &str, destination_dir: &str) -> Result<(), AppError>;

    async fn delete_entry(&self, path: &str, use_trash: bool) -> Result<(), AppError>;

    async fn rename(&self, path: &str, new_name: &str) -> Result<FileEntry, AppError>;

    async fn create_dir(&self, parent: &str, name: &str) -> Result<FileEntry, AppError>;
}

/// Port for enumerating drives / mount points.
#[async_trait]
pub trait DrivePort: Send + Sync {
    async fn drives(&self) -> Result<Vec<DriveInfo>, AppError>;
}
