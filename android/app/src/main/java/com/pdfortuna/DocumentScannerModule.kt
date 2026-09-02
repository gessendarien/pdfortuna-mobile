package com.pdfortuna

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.*
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*

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
            val scannerOptions = GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(allowGallery)
                .setPageLimit(pageLimit)
                .setResultFormats(
                    GmsDocumentScannerOptions.RESULT_FORMAT_PDF,
                    GmsDocumentScannerOptions.RESULT_FORMAT_JPEG
                )
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                .build()

            val scanner = GmsDocumentScanning.getClient(scannerOptions)
            scanPromise = promise

            scanner.getStartScanIntent(activity)
                .addOnSuccessListener { intentSender: IntentSender ->
                    try {
                        activity.startIntentSenderForResult(
                            intentSender,
                            START_DOCUMENT_SCAN_REQUEST_CODE,
                            null,
                            0,
                            0,
                            0
                        )
                    } catch (e: Exception) {
                        scanPromise?.reject("INTENT_SENDER_ERROR", e.message, e)
                        scanPromise = null
                    }
                }
                .addOnFailureListener { e ->
                    scanPromise?.reject("SCANNER_INITIALIZATION_ERROR", e.message, e)
                    scanPromise = null
                }
        } catch (e: Exception) {
            scanPromise = null
            promise.reject("SCANNER_ERROR", e.message, e)
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
            val scanningResult = GmsDocumentScanningResult.fromActivityResultIntent(data)
            val pdf = scanningResult?.pdf

            if (pdf == null) {
                val resultMap = Arguments.createMap()
                resultMap.putBoolean("canceled", false)
                resultMap.putBoolean("success", false)
                resultMap.putString("error", "No PDF document was generated")
                promise.resolve(resultMap)
                return
            }

            val pdfUri: Uri = pdf.uri
            val pageCount = pdf.pageCount

            // Destination directory: Documents/PDFortuna or fallback to app files
            val documentsDir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
                "PDFortuna"
            )
            if (!documentsDir.exists()) {
                documentsDir.mkdirs()
            }

            val timestamp = SimpleDateFormat("dd-MM-yyyy_HH-mm", Locale.getDefault()).format(Date())
            val targetFileName = "Escaneo_$timestamp.pdf"
            val targetFile = File(documentsDir, targetFileName)

            // Copy content from Google ML Kit URI to destination file
            reactContext.contentResolver.openInputStream(pdfUri)?.use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            }

            // Register with Android MediaScanner so file system indexes it immediately
            MediaScannerConnection.scanFile(
                reactContext,
                arrayOf(targetFile.absolutePath),
                arrayOf("application/pdf"),
                null
            )

            val resultMap = Arguments.createMap()
            resultMap.putBoolean("success", true)
            resultMap.putBoolean("canceled", false)
            resultMap.putString("path", targetFile.absolutePath)
            resultMap.putString("name", targetFile.name)
            resultMap.putInt("pageCount", pageCount)
            resultMap.putString("uri", Uri.fromFile(targetFile).toString())

            promise.resolve(resultMap)
        } catch (e: Exception) {
            promise.reject("FILE_SAVE_ERROR", "Failed to save scanned PDF: ${e.message}", e)
        }
    }

    override fun onNewIntent(intent: Intent) {
        // No-op
    }
}
