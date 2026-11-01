package io.github.hawaii005.atalaia

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.NativeModule
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager

/**
 * Ponte para os ficheiros que chegam pelo «Partilhar» do Android.
 *
 * O MainActivity copia o ficheiro para a cache da app (é o único sítio onde
 * ele continua legível depois de o intent morrer) e deixa aqui o caminho. O
 * JS pode não estar carregado nesse instante — por isso a caixa guarda os
 * ficheiros até alguém os pedir com `consumir`.
 */
object CaixaDePartilha {
  private val pendentes = mutableListOf<Map<String, String>>()

  @Synchronized
  fun juntar(uri: String, nome: String) {
    pendentes.add(mapOf("uri" to uri, "nome" to nome))
  }

  @Synchronized
  fun tirar(): List<Map<String, String>> {
    val copia = pendentes.toList()
    pendentes.clear()
    return copia
  }

  @Synchronized
  fun vazia(): Boolean = pendentes.isEmpty()
}

class PartilhaModule(private val contexto: ReactApplicationContext) :
    ReactContextBaseJavaModule(contexto) {

  override fun getName(): String = "Partilha"

  /** Devolve e limpa os ficheiros recebidos desde a última chamada. */
  @ReactMethod
  fun consumir(promessa: Promise) {
    try {
      val lista = Arguments.createArray()
      CaixaDePartilha.tirar().forEach { item ->
        lista.pushMap(
            Arguments.createMap().apply {
              putString("uri", item["uri"])
              putString("nome", item["nome"])
            })
      }
      promessa.resolve(lista)
    } catch (e: Exception) {
      promessa.reject("partilha_falhou", e)
    }
  }
}

class PartilhaPackage : ReactPackage {
  override fun createNativeModules(contexto: ReactApplicationContext): List<NativeModule> =
      listOf(PartilhaModule(contexto))

  override fun createViewManagers(contexto: ReactApplicationContext): List<ViewManager<*, *>> =
      emptyList()
}
