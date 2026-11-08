use std::sync::Arc;

use crate::domain::models::{FileEntry, OperationError, OperationResult, ProgressUpdate};
use crate::domain::ports::FileSystemPort;
use crate::error::AppError;

/// Callback used to stream progress to the UI.
pub type ProgressFn<'a> = &'a (dyn Fn(ProgressUpdate) + Send + Sync);

/// Use cases that mutate the filesystem. Batch operations aggregate failures
/// instead of aborting on the first error.
pub struct OperationService {
    fs: Arc<dyn FileSystemPort>,
}

impl OperationService {
    pub fn new(fs: Arc<dyn FileSystemPort>) -> Self {
        Self { fs }
    }

    pub async fn copy(
        &self,
        sources: &[String],
        destination: &str,
        op_id: &str,
        on_progress: ProgressFn<'_>,
    ) -> OperationResult {
        let mut result = OperationResult::new(op_id);
        let total = sources.len();

        for (index, source) in sources.iter().enumerate() {
            match self.fs.copy_entry(source, destination).await {
                Ok(()) => result.success += 1,
                Err(err) => {
                    result.failed += 1;
                    result.errors.push(OperationError {
                        path: source.clone(),
                        message: err.to_string(),
                    });
                }
            }
            on_progress(ProgressUpdate {
                op_id: op_id.to_string(),
                processed: index + 1,
                total,
                current: source.clone(),
            });
        }

        result
    }

    pub async fn move_items(
        &self,
        sources: &[String],
        destination: &str,
        op_id: &str,
        on_progress: ProgressFn<'_>,
    ) -> OperationResult {
        let mut result = OperationResult::new(op_id);
        let total = sources.len();

        for (index, source) in sources.iter().enumerate() {
            match self.fs.move_entry(source, destination).await {
                Ok(()) => result.success += 1,
                Err(err) => {
                    result.failed += 1;
                    result.errors.push(OperationError {
                        path: source.clone(),
                        message: err.to_string(),
                    });
                }
            }
            on_progress(ProgressUpdate {
                op_id: op_id.to_string(),
                processed: index + 1,
                total,
                current: source.clone(),
            });
        }

        result
    }

    pub async fn delete(
        &self,
        paths: &[String],
        use_trash: bool,
        op_id: &str,
        on_progress: ProgressFn<'_>,
    ) -> OperationResult {
        let mut result = OperationResult::new(op_id);
        let total = paths.len();

        for (index, path) in paths.iter().enumerate() {
            match self.fs.delete_entry(path, use_trash).await {
                Ok(()) => result.success += 1,
                Err(err) => {
                    result.failed += 1;
                    result.errors.push(OperationError {
                        path: path.clone(),
                        message: err.to_string(),
                    });
                }
            }
            on_progress(ProgressUpdate {
                op_id: op_id.to_string(),
                processed: index + 1,
                total,
                current: path.clone(),
            });
        }

        result
    }

    pub async fn rename(&self, path: &str, new_name: &str) -> Result<FileEntry, AppError> {
        self.fs.rename(path, new_name).await
    }

    pub async fn create_dir(&self, parent: &str, name: &str) -> Result<FileEntry, AppError> {
        self.fs.create_dir(parent, name).await
    }
}
