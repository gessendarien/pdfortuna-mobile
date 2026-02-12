package com.pdfortuna;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.io.File;

public class FileOpenerModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;

    FileOpenerModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "FileOpener";
    }

    @ReactMethod
    public void open(String filepath, String mimeType, Promise promise) {
        try {
            File file = new File(filepath);

            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist");
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Uri fileUri = FileProvider.getUriForFile(
                    reactContext,
                    reactContext.getPackageName() + ".provider",
                    file);

            intent.setDataAndType(fileUri, mimeType);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

            try {
                reactContext.startActivity(intent);
                promise.resolve(true);
            } catch (ActivityNotFoundException e) {
                promise.reject("NO_APP", "No app found to open this file type");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
