package io.github.oliveiravitor32.googlelogin

/** Resultado do login, separado da API do Android para poder ser testado com JUnit. */
sealed class RespostaLogin {
    data class Token(val idToken: String) : RespostaLogin()
    object Cancelado : RespostaLogin()
    data class Erro(val mensagem: String) : RespostaLogin()

    companion object {
        /** Igual a GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL. */
        const val TIPO_GOOGLE = "com.google.android.libraries.identity.googleid.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL"

        fun daCredencial(tipo: String, idToken: String?): RespostaLogin =
            if (tipo == TIPO_GOOGLE && !idToken.isNullOrBlank()) Token(idToken)
            else Erro("A conta escolhida não devolveu um login do Google.")

        fun daFalha(cancelado: Boolean, mensagem: String?): RespostaLogin =
            if (cancelado) Cancelado else Erro(mensagem ?: "Não foi possível entrar com o Google.")
    }
}
