//! Login com Google nativo no Android. O comando `entrar` é implementado em
//! Kotlin (`android/`); no desktop o plugin não faz nada.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("google-login")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            _api.register_android_plugin("io.github.oliveiravitor32.googlelogin", "GoogleLoginPlugin")?;
            Ok(())
        })
        .build()
}
