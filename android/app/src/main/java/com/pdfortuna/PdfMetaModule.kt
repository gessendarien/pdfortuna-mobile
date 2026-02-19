package com.pdfortuna

import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

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

            // PdfRenderer requires API 21+ (Android 5.0) which is covered by minSdk 24
            val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val renderer = PdfRenderer(pfd)
            val count = renderer.pageCount
            
            renderer.close()
            pfd.close()

            promise.resolve(count)
        } catch (e: Exception) {
            // e.printStackTrace()
            // Return null if fails (e.g. password protected or corrupted)
            promise.resolve(null)
        }
    }
}
