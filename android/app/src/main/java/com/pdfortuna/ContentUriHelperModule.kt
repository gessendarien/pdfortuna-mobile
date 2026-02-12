package com.pdfortuna

import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ContentUriHelperModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ContentUriHelper"
    }

    @ReactMethod
    fun getFileName(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            if (uri.scheme == "content") {
                val resolved = resolveNameFromContentUri(uri)
                promise.resolve(resolved)
            } else {
                // For file:// or http://, extract from path
                val path = uri.lastPathSegment ?: uri.path ?: uriString
                val name = path.substringAfterLast('/')
                promise.resolve(name)
            }
        } catch (e: Exception) {
            promise.reject("ERROR_GET_FILENAME", e)
        }
    }

    /**
     * Try both the decoded and original URI strings.
     * Sometimes the decoded URI works better with ContentResolver,
     * other times the original encoded URI is needed.
     */
    @ReactMethod
    fun getFileNameTryBoth(decodedUri: String, originalUri: String, promise: Promise) {
        try {
            // Try decoded first
            val uri1 = Uri.parse(decodedUri)
            if (uri1.scheme == "content") {
                val name1 = resolveNameFromContentUri(uri1)
                if (isGoodName(name1)) {
                    promise.resolve(name1)
                    return
                }
            }

            // Try original if different
            if (originalUri != decodedUri) {
                val uri2 = Uri.parse(originalUri)
                if (uri2.scheme == "content") {
                    val name2 = resolveNameFromContentUri(uri2)
                    if (isGoodName(name2)) {
                        promise.resolve(name2)
                        return
                    }
                }
            }

            // Fallback
            val fallback = Uri.parse(decodedUri).lastPathSegment ?: "Documento"
            promise.resolve(fallback)
        } catch (e: Exception) {
            promise.reject("ERROR_GET_FILENAME", e)
        }
    }

    private fun resolveNameFromContentUri(uri: Uri): String? {
        val resolver = reactApplicationContext.contentResolver

        try {
            val cursor: Cursor? = resolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    // Strategy 1: DISPLAY_NAME (most reliable for user-facing name)
                    val displayIdx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (displayIdx != -1) {
                        val displayName = it.getString(displayIdx)
                        if (isGoodName(displayName)) {
                            return displayName
                        }
                    }

                    // Strategy 2: _data column (full file path — extract filename)
                    val dataIdx = it.getColumnIndex("_data")
                    if (dataIdx != -1) {
                        val dataPath = it.getString(dataIdx)
                        if (dataPath != null && dataPath.contains("/")) {
                            val extracted = dataPath.substringAfterLast('/')
                            if (isGoodName(extracted)) {
                                return extracted
                            }
                        }
                    }

                    // Strategy 3: title column
                    val titleIdx = it.getColumnIndex("title")
                    if (titleIdx != -1) {
                        val title = it.getString(titleIdx)
                        if (isGoodName(title)) {
                            return title
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // Query failed, try MIME-based approach
        }

        // Strategy 4: Try to get MIME type and use lastPathSegment
        try {
            val mimeType = resolver.getType(uri)
            val segment = uri.lastPathSegment
            if (segment != null && segment.isNotBlank()) {
                // If segment doesn't have extension but we know MIME type, add it
                if (mimeType == "application/pdf" && !segment.lowercase().endsWith(".pdf")) {
                    return "$segment.pdf"
                }
                return segment
            }
        } catch (_: Exception) {}

        return uri.lastPathSegment
    }

    /** Check if a name looks like a real filename (not a UUID or empty) */
    private fun isGoodName(name: String?): Boolean {
        if (name.isNullOrBlank()) return false
        // Reject pure UUIDs / hex IDs
        if (name.matches(Regex("^[0-9a-fA-F\\-]{30,}$"))) return false
        // Reject purely numeric IDs
        if (name.matches(Regex("^\\d+$"))) return false
        return true
    }
}
