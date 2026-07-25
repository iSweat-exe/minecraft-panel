use std::process::Command;

fn main() {
    // Récupère la version de rustc au moment de la compilation
    if let Ok(output) = Command::new("rustc").arg("--version").output() {
        if let Ok(version) = String::from_utf8(output.stdout) {
            println!("cargo:rustc-env=RUSTC_VERSION={}", version.trim());
            return;
        }
    }
    
    // Fallback au cas où rustc n'est pas dans le PATH
    println!("cargo:rustc-env=RUSTC_VERSION=Unknown");
}
