package io.github.oliveiravitor32.googlelogin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RespostaLoginTest {
    @Test
    fun credencialDoGoogleComTokenViraToken() {
        val r = RespostaLogin.daCredencial(RespostaLogin.TIPO_GOOGLE, "tok")
        assertEquals(RespostaLogin.Token("tok"), r)
    }

    @Test
    fun credencialDeOutroTipoViraErro() {
        val r = RespostaLogin.daCredencial("androidx.credentials.TYPE_PASSWORD_CREDENTIAL", null)
        assertTrue(r is RespostaLogin.Erro)
    }

    @Test
    fun tokenVazioViraErro() {
        assertTrue(RespostaLogin.daCredencial(RespostaLogin.TIPO_GOOGLE, "") is RespostaLogin.Erro)
    }

    @Test
    fun cancelamentoNaoEErro() {
        assertEquals(RespostaLogin.Cancelado, RespostaLogin.daFalha(cancelado = true, mensagem = "user canceled"))
    }

    @Test
    fun falhaSemMensagemTemTextoPadrao() {
        val r = RespostaLogin.daFalha(cancelado = false, mensagem = null) as RespostaLogin.Erro
        assertEquals("Não foi possível entrar com o Google.", r.mensagem)
    }

    @Test
    fun falhaComMensagemMantemAMensagem() {
        val r = RespostaLogin.daFalha(cancelado = false, mensagem = "No credentials available") as RespostaLogin.Erro
        assertEquals("No credentials available", r.mensagem)
    }
}
