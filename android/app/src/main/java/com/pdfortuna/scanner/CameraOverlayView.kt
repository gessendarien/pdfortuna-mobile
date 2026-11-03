package com.pdfortuna.scanner

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View

class CameraOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // Document polygon contour
    private var detectedQuad: Quadrilateral? = null
    private var previewWidth = 0
    private var previewHeight = 0
    private var isStable = false

    private val colorTrackingStroke = Color.parseColor("#DD1F47")
    private val colorTrackingFill = Color.parseColor("#22DD1F47")
    private val colorStableStroke = Color.parseColor("#00E676")
    private val colorStableFill = Color.parseColor("#3300E676")

    private val polygonStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = colorTrackingStroke
        strokeWidth = 3.5f * resources.displayMetrics.density
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }

    private val polygonFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = colorTrackingFill
        style = Paint.Style.FILL
    }

    private val cornerDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }

    // Shutter flash animation
    private var flashOpacity = 0
    private val flashPaint = Paint().apply {
        color = Color.WHITE
    }

    fun setDetectedQuad(quad: Quadrilateral?, srcW: Int, srcH: Int, stable: Boolean = false) {
        this.detectedQuad = quad
        this.previewWidth = srcW
        this.previewHeight = srcH
        this.isStable = stable
        polygonStrokePaint.color = if (stable) colorStableStroke else colorTrackingStroke
        polygonFillPaint.color = if (stable) colorStableFill else colorTrackingFill
        postInvalidate()
    }

    fun clearDetectedQuad() {
        this.detectedQuad = null
        this.isStable = false
        postInvalidate()
    }

    // Anillo de enfoque (toque para enfocar)
    private var focusX = 0f
    private var focusY = 0f
    private var focusAlpha = 0
    private val focusPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 2f * resources.displayMetrics.density
    }

    fun showFocusRing(x: Float, y: Float) {
        focusX = x
        focusY = y
        focusAlpha = 255
        invalidate()
        postDelayed({ focusAlpha = 0; invalidate() }, 900)
    }

    fun triggerShutterAnimation() {
        flashOpacity = 200
        invalidate()
        postDelayed({
            flashOpacity = 0
            invalidate()
        }, 120)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0 || h <= 0) return

        // 1. Shutter flash effect
        if (flashOpacity > 0) {
            flashPaint.alpha = flashOpacity
            canvas.drawRect(0f, 0f, w, h, flashPaint)
        }

        if (focusAlpha > 0) {
            focusPaint.alpha = focusAlpha
            canvas.drawCircle(focusX, focusY, 34f * resources.displayMetrics.density, focusPaint)
        }

        // 2. Draw live detected document polygon (matching reference photo)
        val quad = detectedQuad
        if (quad != null && previewWidth > 0 && previewHeight > 0) {
            val scale = maxOf(w / previewWidth.toFloat(), h / previewHeight.toFloat())
            val offsetX = (w - previewWidth * scale) / 2f
            val offsetY = (h - previewHeight * scale) / 2f

            fun mapX(x: Double) = (x.toFloat() * scale) + offsetX
            fun mapY(y: Double) = (y.toFloat() * scale) + offsetY

            val pTL = PointF(mapX(quad.topLeft.x), mapY(quad.topLeft.y))
            val pTR = PointF(mapX(quad.topRight.x), mapY(quad.topRight.y))
            val pBR = PointF(mapX(quad.bottomRight.x), mapY(quad.bottomRight.y))
            val pBL = PointF(mapX(quad.bottomLeft.x), mapY(quad.bottomLeft.y))

            val polyPath = Path().apply {
                moveTo(pTL.x, pTL.y)
                lineTo(pTR.x, pTR.y)
                lineTo(pBR.x, pBR.y)
                lineTo(pBL.x, pBL.y)
                close()
            }

            canvas.drawPath(polyPath, polygonFillPaint)
            canvas.drawPath(polyPath, polygonStrokePaint)

            // Corner dots for visual precision
            val dotRadius = (if (isStable) 5.5f else 4f) * resources.displayMetrics.density
            cornerDotPaint.color = if (isStable) colorStableStroke else Color.WHITE
            canvas.drawCircle(pTL.x, pTL.y, dotRadius, cornerDotPaint)
            canvas.drawCircle(pTR.x, pTR.y, dotRadius, cornerDotPaint)
            canvas.drawCircle(pBR.x, pBR.y, dotRadius, cornerDotPaint)
            canvas.drawCircle(pBL.x, pBL.y, dotRadius, cornerDotPaint)
        }
    }
}
