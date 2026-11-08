use tauri::State;

use crate::domain::models::DriveInfo;
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn get_drives(state: State<'_, AppState>) -> Result<Vec<DriveInfo>, AppError> {
    state.drives.drives().await
}

#[tauri::command]
pub async fn get_home_dir() -> Result<String, AppError> {
    dirs::home_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| AppError::NotFound("home directory".to_string()))
}
