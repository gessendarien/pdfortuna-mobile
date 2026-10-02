package com.pdfortuna

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class IntentReaderModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "IntentReader"
    }

    @ReactMethod
    fun getInitialUrl(promise: Promise) {
        try {
            val activity: Activity? = reactApplicationContext.currentActivity
            val intent: Intent? = activity?.intent
            if (intent == null) {
                promise.resolve(null)
                return
            }

            var uriString: String? = intent.dataString

            if (uriString == null && intent.action == Intent.ACTION_SEND) {
                val streamUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                }
                uriString = streamUri?.toString()
            }

            promise.resolve(uriString)
        } catch (e: Exception) {
            promise.reject("ERROR_GET_INTENT", e)
        }
    }

    /**
     * Copies a content:// URI to a local cache file using the Activity's ContentResolver,
     * which holds the transient URI read permission grant from the external app (e.g. Gmail).
     */
    @ReactMethod
    fun copyContentUri(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val activity: Activity? = reactApplicationContext.currentActivity
            val resolver = activity?.contentResolver ?: reactApplicationContext.contentResolver

            // 1. Resolve real file name via ContentResolver with Activity permission
            var resolvedName: String? = null
            try {
                val cursor = resolver.query(uri, null, null, null, null)
                cursor?.use {
                    if (it.moveToFirst()) {
                        val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (nameIndex != -1) {
                            val displayName = it.getString(nameIndex)
                            if (!displayName.isNullOrBlank() && !isUuidLike(displayName)) {
                                resolvedName = displayName.trimEnd('.')
                            }
                        }
                    }
                }
            } catch (_: Exception) {}

            var fileName = resolvedName ?: uri.lastPathSegment ?: "documento.pdf"
            fileName = fileName.trimEnd('.')
            if (!fileName.lowercase().endsWith(".pdf") &&
                !fileName.lowercase().endsWith(".docx") &&
                !fileName.lowercase().endsWith(".doc") &&
                !fileName.lowercase().endsWith(".odt") &&
                !fileName.lowercase().endsWith(".odf")) {
                fileName += ".pdf"
            }

            val safeFileName = fileName.replace(Regex("[^a-zA-Z0-9._\\- áéíóúñÁÉÍÓÚÑ]"), "_")

            // 2. Open input stream from ContentResolver using Activity context
            val inputStream = resolver.openInputStream(uri)
            if (inputStream == null) {
                promise.reject("ERR_OPEN_STREAM", "No se pudo leer el archivo adjunto desde la app externa.")
                return
            }

            // 3. Save copy to app cache
            val cacheDir = File(reactApplicationContext.cacheDir, "external_pdfs")
            if (!cacheDir.exists()) {
                cacheDir.mkdirs()
            }

            val targetFile = File(cacheDir, "${System.currentTimeMillis()}_$safeFileName")
            inputStream.use { input ->
                targetFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }

            val map = Arguments.createMap()
            map.putString("localUri", "file://${targetFile.absolutePath}")
            map.putString("name", safeFileName)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERR_COPY_CONTENT_URI", e.message, e)
        }
    }

    private fun isUuidLike(name: String): Boolean {
        return name.matches(Regex("^[0-9a-fA-F\\-]{30,}$")) || name.matches(Regex("^\\d+$"))
    }
}
