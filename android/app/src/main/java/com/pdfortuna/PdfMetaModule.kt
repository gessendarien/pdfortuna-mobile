package com.pdfortuna

import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.zip.ZipFile
import java.util.regex.Pattern
class PdfMetaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PdfMeta"
    }

    @ReactMethod
    fun getPageCount(path: String, promise: Promise) {
        try {
            val file = File(path)
            if (!file.exists()) {
                promise.resolve(null)
                return
            }

            val lowerPath = path.lowercase()
            if (lowerPath.endsWith(".pdf")) {
                // PdfRenderer requires API 21+ (Android 5.0) which is covered by minSdk 24
                val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                val count = renderer.pageCount
                
                renderer.close()
                pfd.close()

                promise.resolve(count)
                return
            } else if (lowerPath.endsWith(".docx")) {
                var zip: ZipFile? = null
                try {
                    zip = ZipFile(file)
                    val entry = zip.getEntry("docProps/app.xml")
                    if (entry != null) {
                        val content = zip.getInputStream(entry).use { it.bufferedReader().readText() }
                        val pattern = Pattern.compile("<[^>]*?Pages[^>]*?>(\\d+)</[^>]*?Pages>", Pattern.CASE_INSENSITIVE)
                        val matcher = pattern.matcher(content)
                        if (matcher.find()) {
                            val count = matcher.group(1)?.toIntOrNull()
                            zip.close()
                            zip = null
                            promise.resolve(count)
                            return
                        }
                    }
                } finally {
                    zip?.close()
                }
            } else if (lowerPath.endsWith(".odt") || lowerPath.endsWith(".odf")) {
                var zip: ZipFile? = null
                try {
                    zip = ZipFile(file)
                    val entry = zip.getEntry("meta.xml")
                    if (entry != null) {
                        val content = zip.getInputStream(entry).use { it.bufferedReader().readText() }
                        val pattern = Pattern.compile("meta:page-count=[\"'](\\d+)[\"']", Pattern.CASE_INSENSITIVE)
                        val matcher = pattern.matcher(content)
                        if (matcher.find()) {
                            val count = matcher.group(1)?.toIntOrNull()
                            zip.close()
                            zip = null
                            promise.resolve(count)
                            return
                        }
                    }
                } finally {
                    zip?.close()
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            // e.printStackTrace()
            // Return null if fails (e.g. password protected or corrupted)
            promise.resolve(null)
        }
    }
}
