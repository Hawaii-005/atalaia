// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Bruno Rocha
package io.github.hawaii005.atalaia

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.github.hawaii005.atalaia.slicer.SlicerEngine
import java.io.File

/**
 * Ponte JS ↔ motor de fatiamento nativo. Só existe na edição 'completa'.
 *
 * O fatiamento corre numa thread própria: o motor é bloqueante e pode demorar
 * minutos num modelo grande. O progresso é lido por polling de `progresso()`
 * (o JS faz o intervalo) para não manter um callback vivo entre recarregamentos.
 */
class FatiadorModule(private val contexto: ReactApplicationContext) :
    ReactContextBaseJavaModule(contexto) {

  override fun getName(): String = "Fatiador"

  private fun dirTrabalho(): File =
      (contexto.getExternalFilesDir(null) ?: contexto.filesDir)
          .resolve("fatiador")
          .apply { mkdirs() }

  @ReactMethod
  fun inicializar(promessa: Promise) {
    promessa.resolve(SlicerEngine.inicializar(contexto))
  }

  @ReactMethod
  fun versao(promessa: Promise) {
    promessa.resolve(SlicerEngine.versao())
  }

  @ReactMethod
  fun perfis(promessa: Promise) {
    try {
      val mapa = Arguments.createMap()
      mapa.putArray("impressoras", lista(SlicerEngine.impressoras()))
      mapa.putArray("filamentos", lista(SlicerEngine.filamentos()))
      mapa.putArray("processos", lista(SlicerEngine.processos()))
      promessa.resolve(mapa)
    } catch (e: Throwable) {
      promessa.reject("perfis_falhou", e)
    }
  }

  /** Copia o modelo recebido por «Partilhar» para a pasta de trabalho do motor. */
  @ReactMethod
  fun prepararModelo(uri: String, nome: String, promessa: Promise) {
    try {
      val origem = File(uri.removePrefix("file://"))
      if (!origem.isFile) {
        promessa.reject("modelo_ausente", "Ficheiro não encontrado: $uri")
        return
      }
      val destino = dirTrabalho().resolve(nome.substringAfterLast('/'))
      origem.copyTo(destino, overwrite = true)
      promessa.resolve(destino.absolutePath)
    } catch (e: Throwable) {
      promessa.reject("modelo_falhou", e)
    }
  }

  @ReactMethod
  fun fatiar(
      modelo: String,
      impressora: String,
      filamento: String,
      processo: String,
      promessa: Promise,
  ) {
    if (SlicerEngine.estaEmCurso()) {
      promessa.reject("ja_em_curso", "Já existe um fatiamento em curso")
      return
    }
    val entrada = File(modelo.removePrefix("file://"))
    if (!entrada.isFile) {
      promessa.reject("modelo_ausente", "Ficheiro não encontrado: $modelo")
      return
    }
    val saida = dirTrabalho().resolve(entrada.nameWithoutExtension + ".gcode")

    Thread {
      try {
        val ok = SlicerEngine.fatiar(
            entrada,
            SlicerEngine.Perfil(impressora, filamento, processo),
            saida,
        )
        val resultado = Arguments.createMap()
        resultado.putBoolean("sucesso", ok)
        resultado.putString("gcode", if (ok) saida.absolutePath else "")
        resultado.putDouble("bytes", saida.length().toDouble())
        resultado.putString("erro", if (ok) "" else SlicerEngine.ultimoErro())
        promessa.resolve(resultado)
      } catch (e: Throwable) {
        promessa.reject("fatiar_falhou", e)
      }
    }.start()
  }

  @ReactMethod
  fun progresso(promessa: Promise) {
    val p = SlicerEngine.progressoAtual()
    promessa.resolve(
        Arguments.createMap().apply {
          putInt("passo", p.passo)
          putString("etapa", p.etapa)
          putInt("percentagem", p.percentagem)
        })
  }

  @ReactMethod
  fun cancelar(promessa: Promise) {
    SlicerEngine.cancelar()
    promessa.resolve(true)
  }

  @ReactMethod
  fun erro(promessa: Promise) {
    promessa.resolve(SlicerEngine.ultimoErro())
  }

  private fun lista(itens: List<String>) =
      Arguments.createArray().apply { itens.forEach { pushString(it) } }
}
