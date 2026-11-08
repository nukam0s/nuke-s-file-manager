use serde::Serialize;

/// Serialisable error type returned by every Tauri command.
///
/// The frontend receives `{ code, message }` so it can map to i18n messages.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("operation failed: {0}")]
    Operation(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Io(_) => "io_error",
            AppError::InvalidPath(_) => "invalid_path",
            AppError::NotFound(_) => "not_found",
            AppError::Operation(_) => "operation_failed",
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}
