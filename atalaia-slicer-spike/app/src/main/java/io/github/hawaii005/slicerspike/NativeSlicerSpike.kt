package io.github.hawaii005.slicerspike

/**
 * Interface JNI mínima para o Spike de Fatiamento (arm64-v8a).
 * Mapeia os símbolos nativos exportados por libslice_core.so.
 */
object NativeSlicerSpike {
    init {
        try {
            System.loadLibrary("slice_core")
        } catch (e: UnsatisfiedLinkError) {
            System.err.println("NativeSlicerSpike: Não foi possível carregar libslice_core.so: ${e.message}")
        }
    }

    /**
     * Inicializa o motor com o ficheiro de perfil JSON (ex: Cosmos AFC).
     */
    external fun init(profileJson: String): Boolean

    /**
     * Executa o fatiamento de um STL/3MF para um ficheiro G-code.
     * @return 0 em caso de sucesso; código de erro caso contrário.
     */
    external fun slice(stlPath: String, outputPath: String, overridesJson: String): Int

    /**
     * Solicita o cancelamento imediato do fatiamento em curso.
     */
    external fun cancel(): Boolean

    /**
     * Consulta a percentagem atual de progresso (0 a 100).
     */
    external fun getProgress(): Int
}
