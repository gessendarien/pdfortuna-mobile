package com.pdfortuna.scanner

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.*
import android.media.ExifInterface
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.app.Dialog
import android.graphics.drawable.ColorDrawable
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.ImageViewCompat
import androidx.lifecycle.lifecycleScope
import com.pdfortuna.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.opencv.android.OpenCVLoader
import java.io.ByteArrayOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class ScannerActivity : AppCompatActivity() {

    // CameraX components
    private var imageCapture: ImageCapture? = null
    private var imageAnalysis: ImageAnalysis? = null
    private lateinit var cameraExecutor: ExecutorService
    private var flashMode = ImageCapture.FLASH_MODE_OFF

    // Screen 1: Capture views
    private lateinit var layoutCapture: LinearLayout
    private lateinit var previewView: PreviewView
    private lateinit var cameraOverlayView: CameraOverlayView
    private lateinit var btnCaptureBack: ImageView
    private lateinit var btnCaptureMenu: ImageView
    private lateinit var btnCaptureAutoMode: LinearLayout
    private lateinit var tvCaptureAutoMode: TextView
    private var isAutoCaptureEnabled = true
    private lateinit var btnFlash: ImageView
    private lateinit var btnShutter: View
    private lateinit var containerCaptureThumbs: LinearLayout
    private lateinit var btnCaptureImport: LinearLayout
    private lateinit var btnCaptureProceed: LinearLayout
    private lateinit var tvCapturePageCount: TextView

    // Screen 2: Review views
    private lateinit var layoutReview: LinearLayout
    private lateinit var btnReviewBack: ImageView
    private lateinit var tvReviewPageIndicator: TextView
    private lateinit var btnReviewMenu: ImageView
    private lateinit var imgReviewDoc: ImageView
    private lateinit var scrollFilterSelector: HorizontalScrollView
    private lateinit var containerFilterPreviews: LinearLayout
    private var isFilterModeActive = false
    private lateinit var toolMagicFilter: ImageView
    private lateinit var toolCrop: ImageView
    private lateinit var toolRotateLeft: ImageView
    private lateinit var toolRotateRight: ImageView
    private lateinit var toolDelete: ImageView
    private lateinit var containerReviewThumbs: LinearLayout
    private lateinit var btnReviewAddPage: LinearLayout
    private lateinit var btnReviewExport: LinearLayout

    // Screen 3: Crop Mode views
    private lateinit var layoutCropMode: LinearLayout
    private lateinit var btnCropModeBack: ImageView
    private lateinit var btnCropModeDone: View
    private lateinit var cropOverlayView: CropOverlayView

    // Loading overlay
    private lateinit var layoutLoading: LinearLayout
    private lateinit var tvLoadingStatus: TextView

    // Scanned data model
    data class PageData(
        var rawBitmap: Bitmap,
        var quad: Quadrilateral,
        var warpedBitmap: Bitmap,
        var selectedFilter: FilterType = FilterType.MAGIC_COLOR,
        var filteredBitmap: Bitmap? = null,
        var thumbnail: Bitmap? = null
    )

    private val pages = mutableListOf<PageData>()
    private var currentReviewIndex = 0

    // Permissions
    private val requestCameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startCamera()
        } else {
            Toast.makeText(this, getString(R.string.scanner_camera_permission), Toast.LENGTH_LONG).show()
            setResult(Activity.RESULT_CANCELED)
            finish()
        }
    }

    // Gallery picker
    private val pickGalleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            loadFromGallery(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scanner)

        if (!OpenCVLoader.initLocal()) {
            OpenCVLoader.initDebug()
        }

        if (DocumentProcessor.segmenter == null) {
            try {
                DocumentProcessor.segmenter = DocumentSegmenter(applicationContext)
            } catch (e: Throwable) {
                e.printStackTrace()
            }
        }

        cameraExecutor = Executors.newSingleThreadExecutor()
        bindViews()
        setupListeners()
        setupTapToFocus()
        setupWindowInsets()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun getStatusBarHeight(): Int {
        val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (resourceId > 0) resources.getDimensionPixelSize(resourceId) else 0
    }

    private fun setupWindowInsets() {
        var sbHeight = getStatusBarHeight()
        val root = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val insetTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            if (insetTop > 0) {
                sbHeight = insetTop
                applyStatusBarHeight(sbHeight)
            }
            insets
        }
        if (sbHeight > 0) {
            applyStatusBarHeight(sbHeight)
        }
    }

    private fun applyStatusBarHeight(height: Int) {
        val spacerCapture = findViewById<View>(R.id.statusBarSpacerCapture)
        val spacerReview = findViewById<View>(R.id.statusBarSpacerReview)
        val spacerCrop = findViewById<View>(R.id.statusBarSpacerCrop)

        spacerCapture?.layoutParams = spacerCapture?.layoutParams?.apply { this.height = height }
        spacerReview?.layoutParams = spacerReview?.layoutParams?.apply { this.height = height }
        spacerCrop?.layoutParams = spacerCrop?.layoutParams?.apply { this.height = height }
    }

    private fun bindViews() {
        // Screen 1: Capture
        layoutCapture = findViewById(R.id.layoutCapture)
        previewView = findViewById(R.id.previewView)
        cameraOverlayView = findViewById(R.id.cameraOverlayView)
        btnCaptureBack = findViewById(R.id.btnCaptureBack)
        btnCaptureMenu = findViewById(R.id.btnCaptureMenu)
        btnCaptureAutoMode = findViewById(R.id.btnCaptureAutoMode)
        tvCaptureAutoMode = findViewById(R.id.tvCaptureAutoMode)
        btnFlash = findViewById(R.id.btnFlash)
        btnShutter = findViewById(R.id.btnShutter)
        containerCaptureThumbs = findViewById(R.id.containerCaptureThumbs)
        btnCaptureImport = findViewById(R.id.btnCaptureImport)
        btnCaptureProceed = findViewById(R.id.btnCaptureProceed)
        tvCapturePageCount = findViewById(R.id.tvCapturePageCount)

        // Screen 2: Review
        layoutReview = findViewById(R.id.layoutReview)
        btnReviewBack = findViewById(R.id.btnReviewBack)
        tvReviewPageIndicator = findViewById(R.id.tvReviewPageIndicator)
        btnReviewMenu = findViewById(R.id.btnReviewMenu)
        imgReviewDoc = findViewById(R.id.imgReviewDoc)
        scrollFilterSelector = findViewById(R.id.scrollFilterSelector)
        containerFilterPreviews = findViewById(R.id.containerFilterPreviews)
        toolMagicFilter = findViewById(R.id.toolMagicFilter)
        toolCrop = findViewById(R.id.toolCrop)
        toolRotateLeft = findViewById(R.id.toolRotateLeft)
        toolRotateRight = findViewById(R.id.toolRotateRight)
        toolDelete = findViewById(R.id.toolDelete)
        containerReviewThumbs = findViewById(R.id.containerReviewThumbs)
        btnReviewAddPage = findViewById(R.id.btnReviewAddPage)
        btnReviewExport = findViewById(R.id.btnReviewExport)

        // Screen 3: Crop Mode
        layoutCropMode = findViewById(R.id.layoutCropMode)
        btnCropModeBack = findViewById(R.id.btnCropModeBack)
        btnCropModeDone = findViewById(R.id.btnCropModeDone)
        cropOverlayView = findViewById(R.id.cropOverlayView)

        // Loading
        layoutLoading = findViewById(R.id.layoutLoading)
        tvLoadingStatus = findViewById(R.id.tvLoadingStatus)
    }

    private fun updateAutoModeUI() {
        if (isAutoCaptureEnabled) {
            tvCaptureAutoMode.text = "AUTO"
            tvCaptureAutoMode.setTextColor(Color.parseColor("#00E676"))
            btnCaptureAutoMode.alpha = 1.0f
        } else {
            tvCaptureAutoMode.text = "MANUAL"
            tvCaptureAutoMode.setTextColor(Color.parseColor("#B0BEC5"))
            btnCaptureAutoMode.alpha = 0.8f
        }
    }

    private fun setupListeners() {
        // Screen 1: Capture
        btnCaptureBack.setOnClickListener {
            setResult(Activity.RESULT_CANCELED)
            finish()
        }

        btnCaptureMenu.setOnClickListener {
            showOverflowMenu(it)
        }

        btnCaptureAutoMode.setOnClickListener {
            isAutoCaptureEnabled = !isAutoCaptureEnabled
            updateAutoModeUI()
            val modeText = if (isAutoCaptureEnabled) "Captura automática activada" else "Captura manual activada"
            Toast.makeText(this, modeText, Toast.LENGTH_SHORT).show()
        }
        updateAutoModeUI()

        btnFlash.setOnClickListener {
            toggleFlash()
        }

        btnCaptureImport.setOnClickListener {
            pickGalleryLauncher.launch("image/*")
        }

        btnShutter.setOnClickListener {
            takePhotoManual()
        }

        btnCaptureProceed.setOnClickListener {
            if (pages.isNotEmpty()) {
                currentReviewIndex = pages.size - 1
                showReviewScreen()
            }
        }

        // Screen 2: Review
        btnReviewBack.setOnClickListener {
            if (isFilterModeActive) toggleFilterMode()
            showCaptureScreen()
        }

        btnReviewMenu.setOnClickListener {
            showOverflowMenu(it)
        }

        toolMagicFilter.setOnClickListener {
            toggleFilterMode()
        }

        toolCrop.setOnClickListener {
            if (isFilterModeActive) toggleFilterMode()
            openCropMode()
        }

        toolRotateLeft.setOnClickListener {
            rotateCurrentPage(-90f)
        }

        toolRotateRight.setOnClickListener {
            rotateCurrentPage(90f)
        }

        toolDelete.setOnClickListener {
            confirmDeleteCurrentPage()
        }

        btnReviewAddPage.setOnClickListener {
            showCaptureScreen()
        }

        btnReviewExport.setOnClickListener {
            generateFinalPdf()
        }

        // Screen 3: Crop Mode
        btnCropModeBack.setOnClickListener {
            layoutCropMode.visibility = View.GONE
            layoutReview.visibility = View.VISIBLE
        }

        btnCropModeDone.setOnClickListener {
            confirmCropAdjustment()
        }
    }

    // ========================================================
    // SCREEN 1: CAMERA & LIVE CONTOUR TRACKING
    // ========================================================

    private var camera: androidx.camera.core.Camera? = null
    private val quadTracker = QuadTracker()
    private var lastFocusTime = 0L
    private var lastFocusCx = -1f
    private var lastFocusCy = -1f

    @Volatile
    private var lastLiveQuad: Quadrilateral? = null
    @Volatile
    private var lastLiveW = 0
    @Volatile
    private var lastLiveH = 0
    @Volatile
    private var isCapturing = false
    private var lastAutoCaptureTime = 0L

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val ratio43 = AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY

            val previewSelector = ResolutionSelector.Builder()
                .setAspectRatioStrategy(ratio43)
                .build()
            val preview = Preview.Builder()
                .setResolutionSelector(previewSelector)
                .build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

            // Captura 4:3 en la mayor resolucion razonable (tope ~12 MP para no agotar memoria)
            val captureSelector = ResolutionSelector.Builder()
                .setAspectRatioStrategy(ratio43)
                .setResolutionStrategy(
                    ResolutionStrategy(
                        android.util.Size(4000, 3000),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
                    )
                )
                .build()
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setResolutionSelector(captureSelector)
                .setFlashMode(flashMode)
                .build()

            // Analisis para deteccion en vivo: 640x480 (4:3)
            val analysisSelector = ResolutionSelector.Builder()
                .setAspectRatioStrategy(ratio43)
                .setResolutionStrategy(
                    ResolutionStrategy(
                        android.util.Size(640, 480),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
                    )
                )
                .build()
            imageAnalysis = ImageAnalysis.Builder()
                .setResolutionSelector(analysisSelector)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build()
                .also { analysis ->
                    analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                        analyzeLiveFrame(imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture, imageAnalysis)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    /** Mapea un punto del frame de analisis a coordenadas de la vista (FILL_CENTER). */
    private fun frameToView(x: Double, y: Double, fw: Int, fh: Int): PointF {
        val vw = previewView.width.toFloat()
        val vh = previewView.height.toFloat()
        val scale = maxOf(vw / fw, vh / fh)
        val ox = (vw - fw * scale) / 2f
        val oy = (vh - fh * scale) / 2f
        return PointF(x.toFloat() * scale + ox, y.toFloat() * scale + oy)
    }

    /** Enfoque y exposicion automaticos sobre un punto de la vista. */
    private fun focusAt(viewX: Float, viewY: Float, showRing: Boolean) {
        val cam = camera ?: return
        try {
            val point = previewView.meteringPointFactory.createPoint(viewX, viewY)
            val action = FocusMeteringAction.Builder(
                point,
                FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
            ).setAutoCancelDuration(3, java.util.concurrent.TimeUnit.SECONDS).build()
            cam.cameraControl.startFocusAndMetering(action)
            lastFocusTime = System.currentTimeMillis()
            lastFocusCx = viewX
            lastFocusCy = viewY
            if (showRing) cameraOverlayView.showFocusRing(viewX, viewY)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupTapToFocus() {
        previewView.setOnTouchListener { v, event ->
            if (event.action == android.view.MotionEvent.ACTION_UP) {
                focusAt(event.x, event.y, true)
                v.performClick()
            }
            true
        }
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun analyzeLiveFrame(imageProxy: ImageProxy) {
        try {
            val rawBitmap = imageProxy.toBitmap()
            val rotationDegrees = imageProxy.imageInfo.rotationDegrees
            val bitmap = if (rotationDegrees != 0) {
                DocumentProcessor.rotateBitmap(rawBitmap, rotationDegrees.toFloat())
            } else {
                rawBitmap
            }

            val detected = DocumentProcessor.detectDocumentOrNull(bitmap)
            val stable = quadTracker.update(detected, bitmap.width, bitmap.height)
            val fw = bitmap.width
            val fh = bitmap.height
            val isStable = quadTracker.isStableForCapture()

            lastLiveQuad = stable
            lastLiveW = fw
            lastLiveH = fh

            // Re-enfocar sobre el documento cuando se estabiliza o se desplaza
            if (stable != null && previewView.width > 0) {
                val cx = (stable.topLeft.x + stable.topRight.x + stable.bottomRight.x + stable.bottomLeft.x) / 4.0
                val cy = (stable.topLeft.y + stable.topRight.y + stable.bottomRight.y + stable.bottomLeft.y) / 4.0
                val p = frameToView(cx, cy, fw, fh)
                val now = System.currentTimeMillis()
                val moved = lastFocusCx < 0f ||
                    kotlin.math.hypot((p.x - lastFocusCx).toDouble(), (p.y - lastFocusCy).toDouble()) > previewView.width * 0.18
                if (now - lastFocusTime > 2500 && (moved || now - lastFocusTime > 6000)) {
                    runOnUiThread { focusAt(p.x, p.y, false) }
                }
            }

            runOnUiThread {
                if (stable != null) {
                    cameraOverlayView.setDetectedQuad(stable, fw, fh, isStable)
                } else {
                    cameraOverlayView.clearDetectedQuad()
                }
            }

            // Disparo automático inteligente si está habilitado y el cuadrilátero permanece estable
            if (isAutoCaptureEnabled && isStable && !isCapturing && layoutCapture.visibility == View.VISIBLE) {
                val now = System.currentTimeMillis()
                if (now - lastAutoCaptureTime > 2200) {
                    lastAutoCaptureTime = now
                    runOnUiThread {
                        if (!isCapturing && layoutCapture.visibility == View.VISIBLE) {
                            takePhotoInternal(isAuto = true)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            imageProxy.close()
        }
    }

    private fun toggleFlash() {
        flashMode = if (flashMode == ImageCapture.FLASH_MODE_OFF) {
            btnFlash.setColorFilter(Color.parseColor("#FFEB3B"))
            ImageCapture.FLASH_MODE_ON
        } else {
            btnFlash.setColorFilter(Color.WHITE)
            ImageCapture.FLASH_MODE_OFF
        }
        imageCapture?.flashMode = flashMode
    }

    private fun takePhotoManual() {
        takePhotoInternal(isAuto = false)
    }

    private fun takePhotoInternal(isAuto: Boolean) {
        val capture = imageCapture ?: return
        if (isCapturing) return
        isCapturing = true

        btnShutter.isEnabled = false
        btnShutter.performHapticFeedback(
            if (isAuto) HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.KEYBOARD_TAP
        )
        cameraOverlayView.triggerShutterAnimation()

        // Instantánea del cuadrilátero detectado en preview al momento exacto del disparo
        val liveQuadSnapshot = lastLiveQuad
        val liveWSnapshot = lastLiveW
        val liveHSnapshot = lastLiveH

        val photoFile = File(cacheDir, "scan_raw_${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    val rawBitmap = decodeBitmapFromFile(photoFile)
                    photoFile.delete()

                    if (rawBitmap != null) {
                        val hintQuad = if (liveQuadSnapshot != null && liveWSnapshot > 0 && liveHSnapshot > 0) {
                            val sx = rawBitmap.width.toDouble() / liveWSnapshot.toDouble()
                            val sy = rawBitmap.height.toDouble() / liveHSnapshot.toDouble()
                            Quadrilateral(
                                org.opencv.core.Point(liveQuadSnapshot.topLeft.x * sx, liveQuadSnapshot.topLeft.y * sy),
                                org.opencv.core.Point(liveQuadSnapshot.topRight.x * sx, liveQuadSnapshot.topRight.y * sy),
                                org.opencv.core.Point(liveQuadSnapshot.bottomRight.x * sx, liveQuadSnapshot.bottomRight.y * sy),
                                org.opencv.core.Point(liveQuadSnapshot.bottomLeft.x * sx, liveQuadSnapshot.bottomLeft.y * sy)
                            )
                        } else null

                        processNewPage(rawBitmap, hintQuad)
                    } else {
                        runOnUiThread {
                            isCapturing = false
                            btnShutter.isEnabled = true
                        }
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    exception.printStackTrace()
                    runOnUiThread {
                        isCapturing = false
                        btnShutter.isEnabled = true
                    }
                }
            }
        )
    }

    private fun loadFromGallery(uri: Uri) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                contentResolver.openInputStream(uri)?.use { stream ->
                    val bitmap = BitmapFactory.decodeStream(stream)
                    if (bitmap != null) {
                        processNewPage(bitmap, null)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun processNewPage(rawBitmap: Bitmap, hintQuad: Quadrilateral? = null) {
        lifecycleScope.launch(Dispatchers.Default) {
            val quad = DocumentProcessor.detectDocument(rawBitmap, hintQuad)
            val warped = DocumentProcessor.warpPerspective(rawBitmap, quad)
            val filtered = DocumentProcessor.applyFilter(warped, FilterType.MAGIC_COLOR)

            // Small thumb
            val thumb = Bitmap.createScaledBitmap(filtered, 120, 160, true)

            val page = PageData(
                rawBitmap = rawBitmap,
                quad = quad,
                warpedBitmap = warped,
                selectedFilter = FilterType.MAGIC_COLOR,
                filteredBitmap = filtered,
                thumbnail = thumb
            )

            withContext(Dispatchers.Main) {
                pages.add(page)
                isCapturing = false
                btnShutter.isEnabled = true
                updateCaptureUI()
            }
        }
    }

    private fun updateCaptureUI() {
        containerCaptureThumbs.removeAllViews()

        if (pages.isEmpty()) {
            btnCaptureProceed.visibility = View.INVISIBLE
            return
        }

        btnCaptureProceed.visibility = View.VISIBLE
        val count = pages.size
        tvCapturePageCount.text = if (count == 1) {
            getString(R.string.scanner_1_page)
        } else {
            getString(R.string.scanner_n_pages, count)
        }

        // Build thumbnail cards matching FairScan
        for ((index, page) in pages.withIndex()) {
            val cardView = createThumbnailCard(page, index, isReview = false)
            containerCaptureThumbs.addView(cardView)
        }
    }

    private fun createThumbnailCard(page: PageData, index: Int, isReview: Boolean): View {
        val frame = FrameLayout(this).apply {
            val lp = LinearLayout.LayoutParams(
                (48 * resources.displayMetrics.density).toInt(),
                (60 * resources.displayMetrics.density).toInt()
            ).apply {
                marginEnd = (10 * resources.displayMetrics.density).toInt()
            }
            layoutParams = lp
            background = ContextCompat.getDrawable(context, R.drawable.bg_thumb_card)
            clipToOutline = true
        }

        val iv = ImageView(this).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageBitmap(page.thumbnail ?: page.filteredBitmap ?: page.warpedBitmap)
        }
        frame.addView(iv)

        // Badge with page number at the bottom center
        val tvNumber = TextView(this).apply {
            val lp = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.BOTTOM or android.view.Gravity.CENTER_HORIZONTAL
                bottomMargin = (3 * resources.displayMetrics.density).toInt()
            }
            layoutParams = lp
            setPadding(8, 2, 8, 2)
            background = ContextCompat.getDrawable(context, R.drawable.bg_page_indicator)
            text = (index + 1).toString()
            setTextColor(Color.WHITE)
            textSize = 9f
            setTypeface(null, Typeface.BOLD)
        }
        frame.addView(tvNumber)

        if (isReview && index == currentReviewIndex) {
            frame.foreground = ContextCompat.getDrawable(this, R.drawable.bg_thumb_selected)
        } else {
            frame.foreground = null
        }

        frame.setOnClickListener {
            currentReviewIndex = index
            showReviewScreen()
        }

        return frame
    }

    // ========================================================
    // SCREEN 2: REVIEW / PAGE EDIT (Right in screenshot)
    // ========================================================

    private fun showCaptureScreen() {
        if (isFilterModeActive) toggleFilterMode()
        isCapturing = false
        quadTracker.reset()
        lastAutoCaptureTime = System.currentTimeMillis() + 1200
        cameraOverlayView.clearDetectedQuad()
        layoutCapture.visibility = View.VISIBLE
        layoutReview.visibility = View.GONE
        layoutCropMode.visibility = View.GONE
        updateCaptureUI()
    }

    private fun showReviewScreen() {
        if (pages.isEmpty()) {
            showCaptureScreen()
            return
        }

        cameraOverlayView.clearDetectedQuad()
        layoutCapture.visibility = View.GONE
        layoutReview.visibility = View.VISIBLE
        layoutCropMode.visibility = View.GONE

        currentReviewIndex = currentReviewIndex.coerceIn(0, pages.size - 1)
        displayReviewPage()
    }

    private fun displayReviewPage() {
        if (pages.isEmpty()) {
            showCaptureScreen()
            return
        }

        val page = pages[currentReviewIndex]
        tvReviewPageIndicator.text = "${currentReviewIndex + 1} / ${pages.size}"

        val displayBmp = page.filteredBitmap ?: page.warpedBitmap
        imgReviewDoc.setImageBitmap(displayBmp)

        // Update Review thumbnail carousel
        containerReviewThumbs.removeAllViews()
        for ((idx, p) in pages.withIndex()) {
            val card = createThumbnailCard(p, idx, isReview = true)
            containerReviewThumbs.addView(card)
        }

        // If filter mode is open, refresh filter cards for current page
        if (isFilterModeActive) {
            populateFilterPreviews()
        }
    }

    private fun toggleFilterMode() {
        if (pages.isEmpty()) return
        isFilterModeActive = !isFilterModeActive

        if (isFilterModeActive) {
            scrollFilterSelector.visibility = View.VISIBLE
            toolMagicFilter.background = ContextCompat.getDrawable(this, R.drawable.bg_circle_tool_active)
            ImageViewCompat.setImageTintList(toolMagicFilter, ColorStateList.valueOf(Color.WHITE))
            setOtherToolsEnabled(false)
            populateFilterPreviews()
        } else {
            scrollFilterSelector.visibility = View.GONE
            toolMagicFilter.background = ContextCompat.getDrawable(this, R.drawable.bg_circle_tool)
            ImageViewCompat.setImageTintList(toolMagicFilter, ColorStateList.valueOf(Color.parseColor("#DD1F47")))
            setOtherToolsEnabled(true)
        }
    }

    private fun setOtherToolsEnabled(enabled: Boolean) {
        val alpha = if (enabled) 1.0f else 0.35f
        toolCrop.isEnabled = enabled
        toolCrop.alpha = alpha
        toolRotateLeft.isEnabled = enabled
        toolRotateLeft.alpha = alpha
        toolRotateRight.isEnabled = enabled
        toolRotateRight.alpha = alpha
        toolDelete.isEnabled = enabled
        toolDelete.alpha = alpha
    }

    data class FilterItem(
        val type: FilterType,
        val labelRes: Int
    )

    private val filterItems = listOf(
        FilterItem(FilterType.MAGIC_COLOR, R.string.scanner_filter_magic),
        FilterItem(FilterType.SHARPEN, R.string.scanner_filter_sharpen),
        FilterItem(FilterType.BW, R.string.scanner_filter_bw),
        FilterItem(FilterType.GRAYSCALE, R.string.scanner_filter_grayscale),
        FilterItem(FilterType.LIGHTEN, R.string.scanner_filter_lighten),
        FilterItem(FilterType.ORIGINAL, R.string.scanner_filter_original)
    )

    private fun populateFilterPreviews() {
        if (pages.isEmpty()) return
        val page = pages[currentReviewIndex]
        val baseWarped = page.warpedBitmap

        val thumbW = 100
        val thumbH = (thumbW * (baseWarped.height.toFloat() / baseWarped.width.toFloat())).toInt().coerceIn(80, 150)
        val smallBmp = Bitmap.createScaledBitmap(baseWarped, thumbW, thumbH, true)

        lifecycleScope.launch(Dispatchers.Default) {
            val previewMap = mutableMapOf<FilterType, Bitmap>()
            for (item in filterItems) {
                previewMap[item.type] = DocumentProcessor.applyFilter(smallBmp, item.type)
            }

            withContext(Dispatchers.Main) {
                containerFilterPreviews.removeAllViews()
                for (item in filterItems) {
                    val previewBmp = previewMap[item.type] ?: smallBmp
                    val isSelected = (item.type == page.selectedFilter)
                    val cardView = createFilterPreviewCard(item, previewBmp, isSelected)
                    containerFilterPreviews.addView(cardView)
                }
            }
        }
    }

    private fun createFilterPreviewCard(item: FilterItem, previewBmp: Bitmap, isSelected: Boolean): View {
        val dp = resources.displayMetrics.density
        val itemLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER_HORIZONTAL
            val lp = LinearLayout.LayoutParams(
                (64 * dp).toInt(),
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginEnd = (10 * dp).toInt()
            }
            layoutParams = lp
        }

        val frame = FrameLayout(this).apply {
            val lp = LinearLayout.LayoutParams(
                (54 * dp).toInt(),
                (70 * dp).toInt()
            )
            layoutParams = lp
            background = ContextCompat.getDrawable(context, R.drawable.bg_thumb_card)
            clipToOutline = true
            if (isSelected) {
                foreground = ContextCompat.getDrawable(context, R.drawable.bg_thumb_selected)
            }
        }

        val iv = ImageView(this).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageBitmap(previewBmp)
        }
        frame.addView(iv)
        itemLayout.addView(frame)

        val tv = TextView(this).apply {
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = (4 * dp).toInt()
            }
            layoutParams = lp
            text = getString(item.labelRes)
            textSize = 10f
            if (isSelected) {
                setTextColor(Color.parseColor("#DD1F47"))
                setTypeface(null, Typeface.BOLD)
            } else {
                setTextColor(Color.parseColor("#64748B"))
                setTypeface(null, Typeface.NORMAL)
            }
        }
        itemLayout.addView(tv)

        itemLayout.setOnClickListener {
            applyFilterToCurrentPage(item.type)
        }

        return itemLayout
    }

    private fun applyFilterToCurrentPage(filterType: FilterType) {
        if (pages.isEmpty()) return
        val page = pages[currentReviewIndex]
        page.selectedFilter = filterType

        lifecycleScope.launch(Dispatchers.Default) {
            val filtered = DocumentProcessor.applyFilter(page.warpedBitmap, filterType)
            page.filteredBitmap = filtered
            page.thumbnail = Bitmap.createScaledBitmap(filtered, 120, 160, true)

            withContext(Dispatchers.Main) {
                imgReviewDoc.setImageBitmap(filtered)
                // Refresh bottom thumbnails
                containerReviewThumbs.removeAllViews()
                for ((idx, p) in pages.withIndex()) {
                    val card = createThumbnailCard(p, idx, isReview = true)
                    containerReviewThumbs.addView(card)
                }
                // Refresh filter card selection borders
                populateFilterPreviews()
            }
        }
    }

    private fun rotateCurrentPage(degrees: Float) {
        if (pages.isEmpty()) return
        val page = pages[currentReviewIndex]

        lifecycleScope.launch(Dispatchers.Default) {
            val rotatedWarped = DocumentProcessor.rotateBitmap(page.warpedBitmap, degrees)
            page.warpedBitmap = rotatedWarped

            val filtered = DocumentProcessor.applyFilter(rotatedWarped, page.selectedFilter)
            page.filteredBitmap = filtered
            page.thumbnail = Bitmap.createScaledBitmap(filtered, 120, 160, true)

            withContext(Dispatchers.Main) {
                displayReviewPage()
            }
        }
    }

    private fun confirmDeleteCurrentPage() {
        if (pages.isEmpty()) return

        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val dialogView = layoutInflater.inflate(R.layout.dialog_confirm_delete, null)
        dialog.setContentView(dialogView)

        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            val displayMetrics = resources.displayMetrics
            val width = (displayMetrics.widthPixels * 0.88).toInt().coerceAtMost((360 * displayMetrics.density).toInt())
            setLayout(width, WindowManager.LayoutParams.WRAP_CONTENT)
        }

        dialogView.findViewById<View>(R.id.btnDeleteCancel).setOnClickListener {
            dialog.dismiss()
        }

        dialogView.findViewById<View>(R.id.btnDeleteConfirm).setOnClickListener {
            dialog.dismiss()
            deleteCurrentPage()
        }

        dialog.show()
    }

    private fun deleteCurrentPage() {
        if (pages.isEmpty()) return
        pages.removeAt(currentReviewIndex)

        if (pages.isEmpty()) {
            if (isFilterModeActive) {
                toggleFilterMode()
            }
            showCaptureScreen()
        } else {
            currentReviewIndex = currentReviewIndex.coerceIn(0, pages.size - 1)
            displayReviewPage()
        }
    }

    // ========================================================
    // SCREEN 3: INTERACTIVE CROP MODE
    // ========================================================

    private fun openCropMode() {
        if (pages.isEmpty()) return
        if (isFilterModeActive) {
            toggleFilterMode()
        }
        val page = pages[currentReviewIndex]

        layoutReview.visibility = View.GONE
        layoutCropMode.visibility = View.VISIBLE

        cropOverlayView.setImageBitmap(page.rawBitmap, page.quad)
    }

    private fun confirmCropAdjustment() {
        val quad = cropOverlayView.getCropQuadrilateral() ?: return
        val page = pages[currentReviewIndex]
        page.quad = quad

        layoutCropMode.visibility = View.GONE
        layoutReview.visibility = View.VISIBLE

        showLoading(getString(R.string.scanner_crop) + "...")
        lifecycleScope.launch(Dispatchers.Default) {
            val warped = DocumentProcessor.warpPerspective(page.rawBitmap, quad)
            page.warpedBitmap = warped

            val filtered = DocumentProcessor.applyFilter(warped, page.selectedFilter)
            page.filteredBitmap = filtered
            page.thumbnail = Bitmap.createScaledBitmap(filtered, 120, 160, true)

            withContext(Dispatchers.Main) {
                hideLoading()
                displayReviewPage()
            }
        }
    }

    // ========================================================
    // EXPORT PDF
    // ========================================================

    private fun generateFinalPdf() {
        if (pages.isEmpty()) return

        showLoading(getString(R.string.scanner_exporting))
        lifecycleScope.launch(Dispatchers.Default) {
            val finalBitmaps = mutableListOf<Bitmap>()
            for (page in pages) {
                val bmp = page.filteredBitmap ?: DocumentProcessor.applyFilter(page.warpedBitmap, page.selectedFilter)
                finalBitmaps.add(bmp)
            }

            // Save directory: Documents/PDFortuna
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

            val success = DocumentProcessor.createPdf(finalBitmaps, targetFile)

            if (success) {
                MediaScannerConnection.scanFile(
                    this@ScannerActivity,
                    arrayOf(targetFile.absolutePath),
                    arrayOf("application/pdf"),
                    null
                )

                withContext(Dispatchers.Main) {
                    hideLoading()
                    val resultIntent = Intent().apply {
                        putExtra("path", targetFile.absolutePath)
                        putExtra("name", targetFile.name)
                        putExtra("pageCount", finalBitmaps.size)
                        putExtra("uri", Uri.fromFile(targetFile).toString())
                    }
                    setResult(Activity.RESULT_OK, resultIntent)
                    finish()
                }
            } else {
                withContext(Dispatchers.Main) {
                    hideLoading()
                    Toast.makeText(this@ScannerActivity, "Error saving PDF", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun showOverflowMenu(v: View) {
        val popup = PopupMenu(this, v)
        popup.menu.add(if (flashMode == ImageCapture.FLASH_MODE_ON) "Flash: ON" else "Flash: OFF")
        popup.setOnMenuItemClickListener {
            toggleFlash()
            true
        }
        popup.show()
    }

    private fun decodeBitmapFromFile(file: File): Bitmap? {
        val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, boundsOptions)

        val maxDim = 3200
        var sampleSize = 1
        while (boundsOptions.outWidth / sampleSize > maxDim || boundsOptions.outHeight / sampleSize > maxDim) {
            sampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, decodeOptions) ?: return null

        val exif = ExifInterface(file.absolutePath)
        val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        }

        return if (!matrix.isIdentity) {
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else {
            bitmap
        }
    }

    private fun showLoading(message: String) {
        tvLoadingStatus.text = message
        layoutLoading.visibility = View.VISIBLE
    }

    private fun hideLoading() {
        layoutLoading.visibility = View.GONE
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        for (page in pages) {
            page.rawBitmap.recycle()
            page.warpedBitmap.recycle()
            page.filteredBitmap?.recycle()
            page.thumbnail?.recycle()
        }
        pages.clear()
    }
}
