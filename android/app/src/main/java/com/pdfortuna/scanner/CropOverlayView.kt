package com.pdfortuna.scanner

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import org.opencv.core.Point
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class CropOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var sourceBitmap: Bitmap? = null
    private var quad: Quadrilateral? = null

    // Display scale and offsets
    private var imageBounds = RectF()
    private var scaleFactor = 1f
    private var offsetX = 0f
    private var offsetY = 0f

    // Corner tracking
    private var activeCornerIndex = -1
    private val touchRadius = 48f * resources.displayMetrics.density
    private val handleRadius = 14f * resources.displayMetrics.density
    private val loupeRadius = 56f * resources.displayMetrics.density
    private val loupeZoom = 2.5f

    // Paint tools
    private val accentColor = Color.parseColor("#dd1f47")
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accentColor
        strokeWidth = 3f * resources.displayMetrics.density
        style = Paint.Style.STROKE
    }

    private val handleOuterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
        setShadowLayer(4f * resources.displayMetrics.density, 0f, 2f, Color.argb(120, 0, 0, 0))
    }

    private val handleInnerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accentColor
        style = Paint.Style.FILL
    }

    private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(130, 0, 0, 0)
        style = Paint.Style.FILL
    }

    private val loupeBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 3f * resources.displayMetrics.density
        style = Paint.Style.STROKE
    }

    private val crosshairPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accentColor
        strokeWidth = 1.5f * resources.displayMetrics.density
        style = Paint.Style.STROKE
    }

    private val bitmapPaint = Paint(Paint.FILTER_BITMAP_FLAG)

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
    }

    fun setImageBitmap(bitmap: Bitmap, initialQuad: Quadrilateral) {
        this.sourceBitmap = bitmap
        this.quad = initialQuad
        calculateBounds()
        invalidate()
    }

    fun getCropQuadrilateral(): Quadrilateral? {
        return quad
    }

    fun resetToFull() {
        val bmp = sourceBitmap ?: return
        quad = Quadrilateral(
            Point(0.0, 0.0),
            Point(bmp.width.toDouble() - 1.0, 0.0),
            Point(bmp.width.toDouble() - 1.0, bmp.height.toDouble() - 1.0),
            Point(0.0, bmp.height.toDouble() - 1.0)
        )
        invalidate()
    }

    private fun calculateBounds() {
        val bmp = sourceBitmap ?: return
        if (width <= 0 || height <= 0) return

        val availW = width.toFloat()
        val availH = height.toFloat()
        val bmpW = bmp.width.toFloat()
        val bmpH = bmp.height.toFloat()

        scaleFactor = min(availW / bmpW, availH / bmpH)
        val drawnW = bmpW * scaleFactor
        val drawnH = bmpH * scaleFactor

        offsetX = (availW - drawnW) / 2f
        offsetY = (availH - drawnH) / 2f
        imageBounds.set(offsetX, offsetY, offsetX + drawnW, offsetY + drawnH)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        calculateBounds()
    }

    private fun bitmapToView(pt: Point): PointF {
        return PointF(
            (pt.x.toFloat() * scaleFactor) + offsetX,
            (pt.y.toFloat() * scaleFactor) + offsetY
        )
    }

    private fun viewToBitmap(vx: Float, vy: Float): Point {
        val clampedX = vx.coerceIn(imageBounds.left, imageBounds.right)
        val clampedY = vy.coerceIn(imageBounds.top, imageBounds.bottom)
        val bx = ((clampedX - offsetX) / scaleFactor).toDouble()
        val by = ((clampedY - offsetY) / scaleFactor).toDouble()
        val bmpW = (sourceBitmap?.width ?: 1) - 1.0
        val bmpH = (sourceBitmap?.height ?: 1) - 1.0
        return Point(bx.coerceIn(0.0, bmpW), by.coerceIn(0.0, bmpH))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val bmp = sourceBitmap ?: return
        val currentQuad = quad ?: return

        // 1. Draw source bitmap fitted inside bounds
        canvas.drawBitmap(bmp, null, imageBounds, bitmapPaint)

        // Calculate view coordinates for corners
        val tl = bitmapToView(currentQuad.topLeft)
        val tr = bitmapToView(currentQuad.topRight)
        val br = bitmapToView(currentQuad.bottomRight)
        val bl = bitmapToView(currentQuad.bottomLeft)

        // 2. Draw darkened mask outside polygon
        val polyPath = Path().apply {
            moveTo(tl.x, tl.y)
            lineTo(tr.x, tr.y)
            lineTo(br.x, br.y)
            lineTo(bl.x, bl.y)
            close()
        }

        canvas.save()
        val fullPath = Path().apply {
            addRect(imageBounds, Path.Direction.CW)
        }
        val outsidePath = Path()
        outsidePath.op(fullPath, polyPath, Path.Op.DIFFERENCE)
        canvas.drawPath(outsidePath, maskPaint)
        canvas.restore()

        // 3. Draw crop border
        canvas.drawPath(polyPath, linePaint)

        // 4. Draw corner handles
        val points = arrayOf(tl, tr, br, bl)
        for ((idx, pt) in points.withIndex()) {
            canvas.drawCircle(pt.x, pt.y, handleRadius, handleOuterPaint)
            canvas.drawCircle(pt.x, pt.y, handleRadius * 0.6f, handleInnerPaint)
        }

        // 5. Draw Magnifier Loupe if currently dragging a corner
        if (activeCornerIndex in 0..3) {
            val activePt = points[activeCornerIndex]
            val activeBitmapPt = when (activeCornerIndex) {
                0 -> currentQuad.topLeft
                1 -> currentQuad.topRight
                2 -> currentQuad.bottomRight
                else -> currentQuad.bottomLeft
            }

            // Place loupe above finger, or below if too close to screen top
            val loupeCenterX = activePt.x.coerceIn(loupeRadius + 16f, width - loupeRadius - 16f)
            val loupeCenterY = if (activePt.y - loupeRadius * 2.2f > 40f) {
                activePt.y - loupeRadius * 1.8f
            } else {
                activePt.y + loupeRadius * 1.8f
            }

            canvas.save()
            val loupePath = Path().apply {
                addCircle(loupeCenterX, loupeCenterY, loupeRadius, Path.Direction.CW)
            }
            canvas.clipPath(loupePath)

            // Fill background with black in loupe
            canvas.drawColor(Color.BLACK)

            // Zoom in around the corner
            canvas.save()
            canvas.translate(loupeCenterX, loupeCenterY)
            canvas.scale(scaleFactor * loupeZoom, scaleFactor * loupeZoom)
            canvas.translate(-activeBitmapPt.x.toFloat(), -activeBitmapPt.y.toFloat())
            canvas.drawBitmap(bmp, 0f, 0f, bitmapPaint)
            canvas.restore()

            // Draw crosshairs
            canvas.drawLine(
                loupeCenterX - loupeRadius * 0.4f, loupeCenterY,
                loupeCenterX + loupeRadius * 0.4f, loupeCenterY,
                crosshairPaint
            )
            canvas.drawLine(
                loupeCenterX, loupeCenterY - loupeRadius * 0.4f,
                loupeCenterX, loupeCenterY + loupeRadius * 0.4f,
                crosshairPaint
            )

            // Loupe border
            canvas.drawCircle(loupeCenterX, loupeCenterY, loupeRadius - 2f, loupeBorderPaint)
            canvas.restore()
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val currentQuad = quad ?: return super.onTouchEvent(event)
        val tl = bitmapToView(currentQuad.topLeft)
        val tr = bitmapToView(currentQuad.topRight)
        val br = bitmapToView(currentQuad.bottomRight)
        val bl = bitmapToView(currentQuad.bottomLeft)
        val points = arrayOf(tl, tr, br, bl)

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val touchX = event.x
                val touchY = event.y

                var closestDist = Float.MAX_VALUE
                var closestIndex = -1

                for ((idx, pt) in points.withIndex()) {
                    val dist = hypot(touchX - pt.x, touchY - pt.y)
                    if (dist < touchRadius && dist < closestDist) {
                        closestDist = dist
                        closestIndex = idx
                    }
                }

                if (closestIndex != -1) {
                    activeCornerIndex = closestIndex
                    parent?.requestDisallowInterceptTouchEvent(true)
                    invalidate()
                    return true
                }
            }

            MotionEvent.ACTION_MOVE -> {
                if (activeCornerIndex in 0..3) {
                    val newPoint = viewToBitmap(event.x, event.y)
                    when (activeCornerIndex) {
                        0 -> currentQuad.topLeft = newPoint
                        1 -> currentQuad.topRight = newPoint
                        2 -> currentQuad.bottomRight = newPoint
                        3 -> currentQuad.bottomLeft = newPoint
                    }
                    invalidate()
                    return true
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (activeCornerIndex != -1) {
                    activeCornerIndex = -1
                    parent?.requestDisallowInterceptTouchEvent(false)
                    invalidate()
                    return true
                }
            }
        }
        return super.onTouchEvent(event)
    }
}
