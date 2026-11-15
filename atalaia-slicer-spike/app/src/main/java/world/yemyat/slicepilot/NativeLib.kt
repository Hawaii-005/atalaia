package world.yemyat.slicepilot

/**
 * Assinatura JNI exata esperada pelo binário libslice_core.so exportado por slice_jni.cpp:
 * Java_world_yemyat_slicepilot_NativeLib_*
 */
object NativeLib {
    interface SliceCallback {
        fun onProgress(
            step: Int,
            text: String,
            percent: Int,
        )
    }

    interface PreviewCallback {
        fun onProgress(percent: Int)
    }

    @Volatile
    var isLoaded: Boolean = false
        private set

    fun loadLibrary(): Boolean {
        if (isLoaded) return true
        return try {
            System.loadLibrary("slice_core")
            isLoaded = true
            true
        } catch (e: UnsatisfiedLinkError) {
            android.util.Log.e("NativeLib", "Falha ao carregar libslice_core.so", e)
            false
        }
    }

    external fun nativeInit(
        dataDir: String,
        resDir: String,
    )

    external fun nativeSlice(
        modelPath: String,
        iniConfig: String,
        outPath: String,
        callback: SliceCallback,
    ): Boolean

    external fun nativeSliceWithPreset(
        modelPath: String,
        printerName: String,
        filamentName: String,
        processName: String,
        outPath: String,
        callback: SliceCallback,
    ): Boolean

    external fun nativeGetPrinters(): String

    external fun nativeGetFilaments(): String

    external fun nativeGetProcesses(): String

    external fun nativeSelectPrinter(printerName: String): Boolean

    external fun nativeSelectProcess(processName: String): Boolean

    external fun nativeGetCompatibleProcesses(): String

    external fun nativeGetCompatibleFilaments(): String

    external fun nativeSliceWithOverrides(
        modelPath: String,
        printerName: String,
        filamentName: String,
        processName: String,
        overridesIni: String,
        supportFilamentName: String,
        outPath: String,
        callback: SliceCallback,
    ): Boolean

    external fun nativeSetModelTransform(
        rotX: Float,
        rotY: Float,
        rotZ: Float,
        mirrorX: Boolean,
        mirrorY: Boolean,
        mirrorZ: Boolean,
        offsetX: Float,
        offsetY: Float,
    )

    external fun nativeSetPartPoses(
        poses: FloatArray?,
        rowCount: Int,
    )

    external fun nativeCancel()

    external fun nativeIsRunning(): Boolean

    external fun nativeGetError(): String

    external fun nativeGetVersion(): String

    external fun nativeParsePreview(
        path: String,
        targetTris: Int,
        callback: PreviewCallback?,
    ): Array<Any>?
}
