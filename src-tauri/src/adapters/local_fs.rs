use std::path::{Path, PathBuf};

use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::domain::models::{
    FileEntry, ListingResult, SortOptions,
};
use crate::domain::operations::sort_entries;
use crate::domain::ports::FileSystemPort;
use crate::error::AppError;

/// Local filesystem adapter backed by `std::fs` / `tokio::fs`.
pub struct LocalFsAdapter;

impl LocalFsAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for LocalFsAdapter {
    fn default() -> Self {
        Self::new()
    }
}

fn modified_rfc3339(meta: &std::fs::Metadata) -> Option<String> {
    meta.modified().ok().map(|time| {
        let dt: DateTime<Utc> = time.into();
        dt.to_rfc3339()
    })
}

fn entry_from(path: &Path, meta: &std::fs::Metadata) -> FileEntry {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let is_dir = meta.is_dir();
    FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        is_symlink: meta.file_type().is_symlink(),
        size: if is_dir { 0 } else { meta.len() },
        modified: modified_rfc3339(meta),
        extension: path
            .extension()
            .map(|ext| ext.to_string_lossy().to_lowercase()),
        attributes: if is_dir { "D".to_string() } else { "A".to_string() },
    }
}

/// Recursively copy a file or directory. Blocking; call inside `spawn_blocking`.
fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    let meta = std::fs::symlink_metadata(src)?;
    if meta.is_dir() {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(src, dst)?;
        Ok(())
    }
}

/// Blocking recursive removal.
fn remove_recursive(path: &Path) -> std::io::Result<()> {
    let meta = std::fs::symlink_metadata(path)?;
    if meta.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    }
}

#[async_trait]
impl FileSystemPort for LocalFsAdapter {
    async fn list_dir(
        &self,
        path: &str,
        show_hidden: bool,
        sort: SortOptions,
    ) -> Result<ListingResult, AppError> {
        let dir = PathBuf::from(path);
        let mut reader = tokio::fs::read_dir(&dir)
            .await
            .map_err(|err| AppError::Io(format!("{path}: {err}")))?;

        let mut entries: Vec<FileEntry> = Vec::new();
        while let Some(entry) = reader
            .next_entry()
            .await
            .map_err(|err| AppError::Io(err.to_string()))?
        {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !show_hidden && file_name.starts_with('.') {
                continue;
            }

            let file_type = entry
                .file_type()
                .await
                .map_err(|err| AppError::Io(err.to_string()))?;
            let meta = entry
                .metadata()
                .await
                .map_err(|err| AppError::Io(err.to_string()))?;
            let full_path = entry.path();

            entries.push(FileEntry {
                name: file_name,
                path: full_path.to_string_lossy().to_string(),
                is_dir: file_type.is_dir(),
                is_symlink: file_type.is_symlink(),
                size: if file_type.is_dir() { 0 } else { meta.len() },
                modified: modified_rfc3339(&meta),
                extension: full_path
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_lowercase()),
                attributes: if file_type.is_dir() {
                    "D".to_string()
                } else {
                    "A".to_string()
                },
            });
        }

        sort_entries(&mut entries, sort);
        let parent = dir.parent().map(|p| p.to_string_lossy().to_string());

        Ok(ListingResult { parent, entries })
    }

    async fn metadata(&self, path: &str) -> Result<FileEntry, AppError> {
        let file_path = PathBuf::from(path);
        let meta = tokio::fs::symlink_metadata(&file_path)
            .await
            .map_err(|err| AppError::Io(err.to_string()))?;
        Ok(entry_from(&file_path, &meta))
    }

    async fn copy_entry(&self, source: &str, destination_dir: &str) -> Result<(), AppError> {
        let src = PathBuf::from(source);
        let name = src
            .file_name()
            .ok_or_else(|| AppError::InvalidPath(source.to_string()))?
            .to_owned();
        let dest = PathBuf::from(destination_dir).join(name);

        tokio::task::spawn_blocking(move || copy_recursive(&src, &dest))
            .await
            .map_err(|err| AppError::Io(err.to_string()))??;
        Ok(())
    }

    async fn move_entry(&self, source: &str, destination_dir: &str) -> Result<(), AppError> {
        let src = PathBuf::from(source);
        let name = src
            .file_name()
            .ok_or_else(|| AppError::InvalidPath(source.to_string()))?
            .to_owned();
        let dest = PathBuf::from(destination_dir).join(name);

        tokio::task::spawn_blocking(move || -> std::io::Result<()> {
            match std::fs::rename(&src, &dest) {
                Ok(()) => Ok(()),
                // Cross-device move: fall back to copy + delete.
                Err(_) => {
                    copy_recursive(&src, &dest)?;
                    remove_recursive(&src)
                }
            }
        })
        .await
        .map_err(|err| AppError::Io(err.to_string()))??;
        Ok(())
    }

    async fn delete_entry(&self, path: &str, use_trash: bool) -> Result<(), AppError> {
        let target = PathBuf::from(path);
        if use_trash {
            tokio::task::spawn_blocking(move || trash::delete(&target))
                .await
                .map_err(|err| AppError::Io(err.to_string()))?
                .map_err(|err| AppError::Operation(err.to_string()))?;
        } else {
            tokio::task::spawn_blocking(move || remove_recursive(&target))
                .await
                .map_err(|err| AppError::Io(err.to_string()))??;
        }
        Ok(())
    }

    async fn rename(&self, path: &str, new_name: &str) -> Result<FileEntry, AppError> {
        let source = PathBuf::from(path);
        let parent = source
            .parent()
            .ok_or_else(|| AppError::InvalidPath(path.to_string()))?
            .to_path_buf();
        let new_path = parent.join(new_name);

        tokio::fs::rename(&source, &new_path)
            .await
            .map_err(|err| AppError::Io(err.to_string()))?;

        self.metadata(&new_path.to_string_lossy()).await
    }

    async fn create_dir(&self, parent: &str, name: &str) -> Result<FileEntry, AppError> {
        let target = PathBuf::from(parent).join(name);
        tokio::fs::create_dir_all(&target)
            .await
            .map_err(|err| AppError::Io(err.to_string()))?;
        self.metadata(&target.to_string_lossy()).await
    }
}
