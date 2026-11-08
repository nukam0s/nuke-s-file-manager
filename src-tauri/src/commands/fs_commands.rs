use tauri::{AppHandle, Emitter, State};

use crate::domain::models::{
    FileEntry, ListingResult, OperationResult, ProgressUpdate, SortOptions,
};
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn list_dir(
    state: State<'_, AppState>,
    path: String,
    show_hidden: bool,
    sort: SortOptions,
) -> Result<ListingResult, AppError> {
    state.listing.list(&path, show_hidden, sort).await
}

#[tauri::command]
pub async fn get_metadata(
    state: State<'_, AppState>,
    path: String,
) -> Result<FileEntry, AppError> {
    state.listing.metadata(&path).await
}

#[tauri::command]
pub async fn copy_items(
    app: AppHandle,
    state: State<'_, AppState>,
    sources: Vec<String>,
    destination: String,
) -> Result<OperationResult, AppError> {
    let op_id = uuid::Uuid::new_v4().to_string();
    let emitter = app.clone();
    let progress = move |update: ProgressUpdate| {
        let _ = emitter.emit("operation://progress", &update);
    };

    let result = state
        .operations
        .copy(&sources, &destination, &op_id, &progress)
        .await;

    let _ = app.emit("operation://completed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn move_items(
    app: AppHandle,
    state: State<'_, AppState>,
    sources: Vec<String>,
    destination: String,
) -> Result<OperationResult, AppError> {
    let op_id = uuid::Uuid::new_v4().to_string();
    let emitter = app.clone();
    let progress = move |update: ProgressUpdate| {
        let _ = emitter.emit("operation://progress", &update);
    };

    let result = state
        .operations
        .move_items(&sources, &destination, &op_id, &progress)
        .await;

    let _ = app.emit("operation://completed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn delete_items(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
    use_trash: bool,
) -> Result<OperationResult, AppError> {
    let op_id = uuid::Uuid::new_v4().to_string();
    let emitter = app.clone();
    let progress = move |update: ProgressUpdate| {
        let _ = emitter.emit("operation://progress", &update);
    };

    let result = state
        .operations
        .delete(&paths, use_trash, &op_id, &progress)
        .await;

    let _ = app.emit("operation://completed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn rename_item(
    state: State<'_, AppState>,
    path: String,
    new_name: String,
) -> Result<FileEntry, AppError> {
    state.operations.rename(&path, &new_name).await
}

#[tauri::command]
pub async fn create_dir(
    state: State<'_, AppState>,
    parent: String,
    name: String,
) -> Result<FileEntry, AppError> {
    state.operations.create_dir(&parent, &name).await
}
