mod adapters;
mod commands;
mod domain;
mod error;
mod services;

use std::sync::Arc;

use adapters::drive_adapter::DriveAdapter;
use adapters::local_fs::LocalFsAdapter;
use domain::ports::{DrivePort, FileSystemPort};
use services::listing_service::ListingService;
use services::operation_service::OperationService;

/// Shared application state, injected into Tauri commands.
pub struct AppState {
    pub listing: ListingService,
    pub operations: OperationService,
    pub drives: Arc<dyn DrivePort>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Structured logging; no sensitive data.
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    // Composition root: wire concrete adapters into ports (dependency inversion).
    let fs: Arc<dyn FileSystemPort> = Arc::new(LocalFsAdapter::new());
    let drives: Arc<dyn DrivePort> = Arc::new(DriveAdapter::new());

    let state = AppState {
        listing: ListingService::new(fs.clone()),
        operations: OperationService::new(fs),
        drives,
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::fs_commands::list_dir,
            commands::fs_commands::get_metadata,
            commands::fs_commands::copy_items,
            commands::fs_commands::move_items,
            commands::fs_commands::delete_items,
            commands::fs_commands::rename_item,
            commands::fs_commands::create_dir,
            commands::system_commands::get_drives,
            commands::system_commands::get_home_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
