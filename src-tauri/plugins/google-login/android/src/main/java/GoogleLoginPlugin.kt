package io.github.oliveiravitor32.googlelogin

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@InvokeArg
class EntrarArgs {
    /** ID do cliente Web do Google: o id_token sai com ele como audiência, que é o que o Firebase espera. */
    lateinit var clientId: String
}

/** Abre a janela nativa de contas do Google (Credential Manager) e devolve o id_token. */
@TauriPlugin
class GoogleLoginPlugin(private val activity: Activity) : Plugin(activity) {
    private val escopo = CoroutineScope(Dispatchers.Main + SupervisorJob())

    @Command
    fun entrar(invoke: Invoke) {
        val args = invoke.parseArgs(EntrarArgs::class.java)
        val pedido = GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(args.clientId).build())
            .build()

        escopo.launch {
            val resposta = try {
                val credencial = CredentialManager.create(activity).getCredential(activity, pedido).credential
                val idToken = (credencial as? CustomCredential)
                    ?.takeIf { it.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL }
                    ?.let { GoogleIdTokenCredential.createFrom(it.data).idToken }
                RespostaLogin.daCredencial(credencial.type, idToken)
            } catch (e: GetCredentialCancellationException) {
                RespostaLogin.daFalha(cancelado = true, mensagem = e.message)
            } catch (e: GetCredentialException) {
                RespostaLogin.daFalha(cancelado = false, mensagem = e.message)
            }

            when (resposta) {
                is RespostaLogin.Token -> invoke.resolve(JSObject().apply { put("idToken", resposta.idToken) })
                RespostaLogin.Cancelado -> invoke.resolve(JSObject().apply { put("cancelado", true) })
                is RespostaLogin.Erro -> invoke.reject(resposta.mensagem)
            }
        }
    }
}
