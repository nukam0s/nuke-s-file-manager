use serde::{Deserialize, Serialize};

/// A single entry in a directory listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<String>,
    pub extension: Option<String>,
    pub attributes: String,
}

/// A mounted drive / filesystem root.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub path: String,
    pub label: String,
    pub kind: String,
    pub total: u64,
    pub free: u64,
}

/// Result of a directory listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListingResult {
    pub parent: Option<String>,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortField {
    Name,
    Extension,
    Size,
    Modified,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDir {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortOptions {
    pub field: SortField,
    pub dir: SortDir,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationError {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult {
    pub op_id: String,
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<OperationError>,
    pub cancelled: bool,
}

impl OperationResult {
    pub fn new(op_id: &str) -> Self {
        Self {
            op_id: op_id.to_string(),
            success: 0,
            failed: 0,
            errors: Vec::new(),
            cancelled: false,
        }
    }
}

/// Emitted while a batch operation is running.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressUpdate {
    pub op_id: String,
    pub processed: usize,
    pub total: usize,
    pub current: String,
}
