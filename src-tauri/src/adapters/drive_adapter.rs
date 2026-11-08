use async_trait::async_trait;

use crate::domain::models::DriveInfo;
use crate::domain::ports::DrivePort;
use crate::error::AppError;

/// Enumerates available drives / mount points, per platform.
pub struct DriveAdapter;

impl DriveAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DriveAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DrivePort for DriveAdapter {
    async fn drives(&self) -> Result<Vec<DriveInfo>, AppError> {
        #[cfg(windows)]
        {
            let mut drives = Vec::new();
            for letter in b'A'..=b'Z' {
                let root = format!("{}:\\", letter as char);
                if std::path::Path::new(&root).exists() {
                    drives.push(DriveInfo {
                        path: root.clone(),
                        label: format!("{}:", letter as char),
                        kind: "fixed".to_string(),
                        total: 0,
                        free: 0,
                    });
                }
            }
            Ok(drives)
        }

        #[cfg(not(windows))]
        {
            Ok(vec![DriveInfo {
                path: "/".to_string(),
                label: "Root".to_string(),
                kind: "fixed".to_string(),
                total: 0,
                free: 0,
            }])
        }
    }
}
