package com.pdfortuna

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PermissionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PermissionModule"
    }

    @ReactMethod
    fun openManageAllFilesAccessSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.addCategory("android.intent.category.DEFAULT")
                intent.data = Uri.parse("package:" + reactApplicationContext.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            } catch (e: Exception) {
                // Fallback to generic settings if the specific one fails
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                intent.data = Uri.parse("package:" + reactApplicationContext.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
        } else {
            // For older versions, just open app details
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.data = Uri.parse("package:" + reactApplicationContext.packageName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun checkManageAllFilesAccessPermission(promise: com.facebook.react.bridge.Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                promise.resolve(android.os.Environment.isExternalStorageManager())
            } catch (e: Exception) {
                promise.resolve(false)
            }
        } else {
            // For older versions, this permission concept doesn't exist in the same way,
            // usually handled by READ_EXTERNAL_STORAGE. We return true here to let logic flow,
            // or better, return false and let standard permissions handle it.
            // But to be safe for this specific check:
            promise.resolve(true) 
        }
    }
}
