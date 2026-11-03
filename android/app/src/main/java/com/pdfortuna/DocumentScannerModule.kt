package com.pdfortuna

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import com.pdfortuna.scanner.ScannerActivity

class DocumentScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var scanPromise: Promise? = null
    private val START_DOCUMENT_SCAN_REQUEST_CODE = 42819

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "DocumentScannerModule"
    }

    @ReactMethod
    fun startScan(options: ReadableMap?, promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Current activity does not exist")
            return
        }

        if (scanPromise != null) {
            promise.reject("SCAN_IN_PROGRESS", "A scan is already in progress")
            return
        }

        val pageLimit = if (options != null && options.hasKey("pageLimit")) {
            options.getInt("pageLimit")
        } else {
            100
        }

        val allowGallery = if (options != null && options.hasKey("allowGallery")) {
            options.getBoolean("allowGallery")
        } else {
            true
        }

        try {
            scanPromise = promise
            val intent = Intent(activity, ScannerActivity::class.java).apply {
                putExtra("PAGE_LIMIT", pageLimit)
                putExtra("ALLOW_GALLERY", allowGallery)
            }
            activity.startActivityForResult(intent, START_DOCUMENT_SCAN_REQUEST_CODE)
        } catch (e: Exception) {
            scanPromise = null
            promise.reject("SCANNER_LAUNCH_ERROR", "Failed to launch scanner: ${e.message}", e)
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != START_DOCUMENT_SCAN_REQUEST_CODE) {
            return
        }

        val promise = scanPromise ?: return
        scanPromise = null

        if (resultCode == Activity.RESULT_CANCELED) {
            val resultMap = Arguments.createMap()
            resultMap.putBoolean("canceled", true)
            resultMap.putBoolean("success", false)
            promise.resolve(resultMap)
            return
        }

        if (resultCode != Activity.RESULT_OK || data == null) {
            val resultMap = Arguments.createMap()
            resultMap.putBoolean("canceled", false)
            resultMap.putBoolean("success", false)
            resultMap.putString("error", "Scan was not successful or no data returned")
            promise.resolve(resultMap)
            return
        }

        try {
            val path = data.getStringExtra("path")
            val name = data.getStringExtra("name")
            val pageCount = data.getIntExtra("pageCount", 1)
            val uri = data.getStringExtra("uri")

            if (path == null) {
                val resultMap = Arguments.createMap()
                resultMap.putBoolean("canceled", false)
                resultMap.putBoolean("success", false)
                resultMap.putString("error", "No PDF document path returned")
                promise.resolve(resultMap)
                return
            }

            val resultMap = Arguments.createMap()
            resultMap.putBoolean("success", true)
            resultMap.putBoolean("canceled", false)
            resultMap.putString("path", path)
            resultMap.putString("name", name ?: "Escaneo.pdf")
            resultMap.putInt("pageCount", pageCount)
            resultMap.putString("uri", uri ?: "file://$path")

            promise.resolve(resultMap)
        } catch (e: Exception) {
            promise.reject("SCAN_RESULT_ERROR", "Failed to parse scan result: ${e.message}", e)
        }
    }

    override fun onNewIntent(intent: Intent) {
        // No-op
    }
}
