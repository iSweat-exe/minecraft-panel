/// Helper to verify protocol version compatibility
pub fn check_protocol_version(provided_version: u32) -> Result<(), String> {
    if provided_version != crate::PROTOCOL_VERSION {
        Err(format!(
            "Protocol version mismatch! Daemon requires version {}, but client provided version {}",
            crate::PROTOCOL_VERSION,
            provided_version
        ))
    } else {
        Ok(())
    }
}
