use std::path::PathBuf;

use crate::domain::models::{FileEntry, SortDir, SortField, SortOptions};
use crate::error::AppError;

/// Validate an incoming path. Rejects empty paths and null bytes.
pub fn validate_path(input: &str) -> Result<PathBuf, AppError> {
    if input.trim().is_empty() {
        return Err(AppError::InvalidPath("empty path".into()));
    }
    if input.contains('\0') {
        return Err(AppError::InvalidPath("path contains a null byte".into()));
    }
    Ok(PathBuf::from(input))
}

/// Guard for destructive operations: refuse filesystem roots.
pub fn guard_destructive(input: &str) -> Result<PathBuf, AppError> {
    let path = validate_path(input)?;
    if path.parent().is_none() {
        return Err(AppError::InvalidPath(
            "refusing to operate on a filesystem root".into(),
        ));
    }
    Ok(path)
}

/// Sort entries in place. Directories always come first.
pub fn sort_entries(entries: &mut [FileEntry], sort: SortOptions) {
    entries.sort_by(|a, b| {
        // Directories before files, regardless of the chosen field.
        let dir_cmp = b.is_dir.cmp(&a.is_dir);
        if dir_cmp != std::cmp::Ordering::Equal {
            return dir_cmp;
        }

        let ord = match sort.field {
            SortField::Name => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            SortField::Extension => a
                .extension
                .clone()
                .unwrap_or_default()
                .to_lowercase()
                .cmp(&b.extension.clone().unwrap_or_default().to_lowercase()),
            SortField::Size => a.size.cmp(&b.size),
            SortField::Modified => a.modified.cmp(&b.modified),
        };

        match sort.dir {
            SortDir::Asc => ord,
            SortDir::Desc => ord.reverse(),
        }
    });
}
