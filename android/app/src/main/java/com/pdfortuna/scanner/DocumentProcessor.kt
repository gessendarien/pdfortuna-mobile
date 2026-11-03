package com.pdfortuna.scanner

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.pdf.PdfDocument
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

data class Quadrilateral(
    var topLeft: Point,
    var topRight: Point,
    var bottomRight: Point,
    var bottomLeft: Point
) {
    fun toArray(): Array<Point> = arrayOf(topLeft, topRight, bottomRight, bottomLeft)

    fun scale(factor: Double): Quadrilateral {
        return Quadrilateral(
            Point(topLeft.x * factor, topLeft.y * factor),
            Point(topRight.x * factor, topRight.y * factor),
            Point(bottomRight.x * factor, bottomRight.y * factor),
            Point(bottomLeft.x * factor, bottomLeft.y * factor)
        )
    }

    companion object {
        fun fromPoints(points: List<Point>): Quadrilateral {
            // tl: menor x+y, br: mayor x+y, tr: menor y-x, bl: mayor y-x
            val tl = points.minByOrNull { it.x + it.y }!!
            val br = points.maxByOrNull { it.x + it.y }!!
            val tr = points.minByOrNull { it.y - it.x }!!
            val bl = points.maxByOrNull { it.y - it.x }!!
            return Quadrilateral(tl, tr, br, bl)
        }

        fun defaultForDimensions(width: Double, height: Double, marginRatio: Double = 0.04): Quadrilateral {
            val mx = width * marginRatio
            val my = height * marginRatio
            return Quadrilateral(
                topLeft = Point(mx, my),
                topRight = Point(width - mx, my),
                bottomRight = Point(width - mx, height - my),
                bottomLeft = Point(mx, height - my)
            )
        }
    }
}

enum class FilterType {
    MAGIC_COLOR,
    SHARPEN,
    BW,
    GRAYSCALE,
    LIGHTEN,
    ORIGINAL
}

object DocumentProcessor {

    /**
     * Detects document quadrilateral edges within a bitmap.
     * Returns null if no valid document quadrilateral is detected.
     */
    @Volatile
    var segmenter: DocumentSegmenter? = null

    /** Deteccion principal: modelo de segmentacion; si no esta disponible, detector clasico. */
    fun detectDocumentOrNull(bitmap: Bitmap): Quadrilateral? {
        val seg = segmenter
        return if (seg != null) {
            try { seg.detectQuad(bitmap) } catch (e: Exception) { e.printStackTrace(); null }
        } else {
            detectDocumentClassic(bitmap)
        }
    }

    /** Detector clasico (Canny/Otsu), solo como respaldo. */
    fun detectDocumentClassic(bitmap: Bitmap): Quadrilateral? {
        val width = bitmap.width.toDouble()
        val height = bitmap.height.toDouble()
        val maxProcessingDim = 600.0

        val scale = if (max(width, height) > maxProcessingDim) {
            maxProcessingDim / max(width, height)
        } else {
            1.0
        }

        val scaledWidth = (width * scale).toInt()
        val scaledHeight = (height * scale).toInt()

        val scaledBitmap = if (scale < 1.0) {
            Bitmap.createScaledBitmap(bitmap, scaledWidth, scaledHeight, true)
        } else {
            bitmap
        }

        val mat = Mat()
        Utils.bitmapToMat(scaledBitmap, mat)

        val grayMat = Mat()
        Imgproc.cvtColor(mat, grayMat, Imgproc.COLOR_RGBA2GRAY)

        val blurredMat = Mat()
        Imgproc.GaussianBlur(grayMat, blurredMat, Size(5.0, 5.0), 0.0)

        // Dynamic Canny thresholds based on average scene brightness
        val meanVal = Core.mean(blurredMat).`val`[0]
        val lowerCanny = (meanVal * 0.45).coerceIn(20.0, 80.0)
        val upperCanny = (meanVal * 1.35).coerceIn(70.0, 200.0)

        val candidateContours = ArrayList<MatOfPoint>()

        // 1. Canny edge detector
        val edgesMat = Mat()
        Imgproc.Canny(blurredMat, edgesMat, lowerCanny, upperCanny)
        val dilateKernel = Imgproc.getStructuringElement(Imgproc.MORPH_RECT, Size(3.0, 3.0))
        Imgproc.dilate(edgesMat, edgesMat, dilateKernel)

        val contoursCanny = ArrayList<MatOfPoint>()
        val hierarchyCanny = Mat()
        Imgproc.findContours(edgesMat, contoursCanny, hierarchyCanny, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE)
        candidateContours.addAll(contoursCanny)

        // 2. Otsu thresholding fallback for low-contrast edges
        val threshMat = Mat()
        Imgproc.threshold(blurredMat, threshMat, 0.0, 255.0, Imgproc.THRESH_BINARY or Imgproc.THRESH_OTSU)
        val contoursOtsu = ArrayList<MatOfPoint>()
        val hierarchyOtsu = Mat()
        Imgproc.findContours(threshMat, contoursOtsu, hierarchyOtsu, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
        candidateContours.addAll(contoursOtsu)

        val totalArea = (scaledWidth * scaledHeight).toDouble()
        val minArea = totalArea * 0.10 // At least 10% of frame
        val maxArea = totalArea * 0.98 // At most 98% of frame

        // Sort candidate contours by area descending
        val sortedContours = candidateContours
            .map { contour -> contour to Imgproc.contourArea(contour) }
            .filter { (_, area) -> area in minArea..maxArea }
            .sortedByDescending { it.second }
            .take(15)

        var bestQuad: Quadrilateral? = null
        var bestArea = 0.0
        val epsFactors = listOf(0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05)

        for ((contour, _) in sortedContours) {
            val contour2f = MatOfPoint2f(*contour.toArray())
            val perimeter = Imgproc.arcLength(contour2f, true)

            var foundQuadForContour = false
            for (eps in epsFactors) {
                val approx = MatOfPoint2f()
                Imgproc.approxPolyDP(contour2f, approx, eps * perimeter, true)

                if (approx.total() == 4L) {
                    val approxMat = MatOfPoint(*approx.toArray())
                    if (Imgproc.isContourConvex(approxMat)) {
                        val area = Imgproc.contourArea(approxMat)
                        val points = approx.toList()
                        if (area > bestArea && isValidQuadAngles(points)) {
                            bestArea = area
                            bestQuad = Quadrilateral.fromPoints(points)
                            foundQuadForContour = true
                            approxMat.release()
                            approx.release()
                            break
                        }
                    }
                    approxMat.release()
                }
                approx.release()
            }

            // Fallback: try convex hull polygon approximation
            if (!foundQuadForContour) {
                val hull = MatOfInt()
                Imgproc.convexHull(contour, hull)
                val hullPoints = ArrayList<Point>()
                val contourPoints = contour.toList()
                for (index in hull.toList()) {
                    hullPoints.add(contourPoints[index])
                }
                if (hullPoints.size >= 4) {
                    val hullMat2f = MatOfPoint2f(*hullPoints.toTypedArray())
                    val hullPerimeter = Imgproc.arcLength(hullMat2f, true)
                    for (eps in epsFactors) {
                        val approxHull = MatOfPoint2f()
                        Imgproc.approxPolyDP(hullMat2f, approxHull, eps * hullPerimeter, true)
                        if (approxHull.total() == 4L) {
                            val approxMat = MatOfPoint(*approxHull.toArray())
                            if (Imgproc.isContourConvex(approxMat)) {
                                val area = Imgproc.contourArea(approxMat)
                                val points = approxHull.toList()
                                if (area > bestArea && isValidQuadAngles(points)) {
                                    bestArea = area
                                    bestQuad = Quadrilateral.fromPoints(points)
                                    approxMat.release()
                                    approxHull.release()
                                    break
                                }
                            }
                            approxMat.release()
                        }
                        approxHull.release()
                    }
                    hullMat2f.release()
                }
                hull.release()
            }
            contour2f.release()
        }

        // Clean up mats
        mat.release()
        grayMat.release()
        blurredMat.release()
        edgesMat.release()
        hierarchyCanny.release()
        threshMat.release()
        hierarchyOtsu.release()
        dilateKernel.release()
        for (c in candidateContours) c.release()

        if (scaledBitmap != bitmap) {
            scaledBitmap.recycle()
        }

        return bestQuad?.scale(1.0 / scale)
    }

    fun isValidQuadAngles(points: List<Point>): Boolean {
        if (points.size != 4) return false
        val p = Quadrilateral.fromPoints(points).toArray()
        for (i in 0 until 4) {
            val pPrev = p[(i + 3) % 4]
            val pCurr = p[i]
            val pNext = p[(i + 1) % 4]

            val v1x = pPrev.x - pCurr.x
            val v1y = pPrev.y - pCurr.y
            val v2x = pNext.x - pCurr.x
            val v2y = pNext.y - pCurr.y

            val dot = v1x * v2x + v1y * v2y
            val mag1 = hypot(v1x, v1y)
            val mag2 = hypot(v2x, v2y)
            if (mag1 < 1e-4 || mag2 < 1e-4) return false

            val cosTheta = kotlin.math.abs(dot / (mag1 * mag2))
            // Corners should be between ~50 and ~130 degrees
            if (cosTheta > 0.65) return false
        }
        return true
    }

    fun isValidQuad(quad: Quadrilateral, width: Double, height: Double): Boolean {
        val pts = quad.toArray().toList()
        if (!isValidQuadAngles(pts)) return false
        val mat = MatOfPoint(*pts.toTypedArray())
        val area = Imgproc.contourArea(mat)
        mat.release()
        val totalArea = width * height
        return area in (totalArea * 0.08)..(totalArea * 0.99)
    }

    /**
     * Detects document quadrilateral edges within a bitmap.
     * Reuses hintQuad if provided and valid, otherwise runs detector.
     * Falls back to default margins if no clear document is detected.
     */
    fun detectDocument(bitmap: Bitmap, hintQuad: Quadrilateral? = null): Quadrilateral {
        if (hintQuad != null && isValidQuad(hintQuad, bitmap.width.toDouble(), bitmap.height.toDouble())) {
            return hintQuad
        }
        return detectDocumentOrNull(bitmap)
            ?: Quadrilateral.defaultForDimensions(bitmap.width.toDouble(), bitmap.height.toDouble(), 0.03)
    }

    /**
     * Warps the quadrilateral area into an unskewed rectangle using homography.
     */
    fun warpPerspective(bitmap: Bitmap, quad: Quadrilateral): Bitmap {
        val srcMat = Mat()
        Utils.bitmapToMat(bitmap, srcMat)

        val tl = quad.topLeft
        val tr = quad.topRight
        val br = quad.bottomRight
        val bl = quad.bottomLeft

        val widthA = hypot(br.x - bl.x, br.y - bl.y)
        val widthB = hypot(tr.x - tl.x, tr.y - tl.y)
        val maxWidth = max(widthA, widthB).toInt().coerceAtLeast(100)

        val heightA = hypot(tr.x - br.x, tr.y - br.y)
        val heightB = hypot(tl.x - bl.x, tl.y - bl.y)
        val maxHeight = max(heightA, heightB).toInt().coerceAtLeast(100)

        val srcPoints = MatOfPoint2f(tl, tr, br, bl)
        val dstPoints = MatOfPoint2f(
            Point(0.0, 0.0),
            Point((maxWidth - 1).toDouble(), 0.0),
            Point((maxWidth - 1).toDouble(), (maxHeight - 1).toDouble()),
            Point(0.0, (maxHeight - 1).toDouble())
        )

        val transformMatrix = Imgproc.getPerspectiveTransform(srcPoints, dstPoints)
        val dstMat = Mat()
        Imgproc.warpPerspective(
            srcMat,
            dstMat,
            transformMatrix,
            Size(maxWidth.toDouble(), maxHeight.toDouble()),
            Imgproc.INTER_LINEAR,
            Core.BORDER_REPLICATE
        )

        val outputBitmap = Bitmap.createBitmap(maxWidth, maxHeight, Bitmap.Config.ARGB_8888)
        Utils.matToBitmap(dstMat, outputBitmap)

        srcMat.release()
        dstMat.release()
        transformMatrix.release()
        srcPoints.release()
        dstPoints.release()

        return outputBitmap
    }

    /**
     * Estima el campo de iluminacion (papel sin texto) de un canal U8 de luminosidad/grises.
     * Utiliza cierre morfologico multiescala con elemento eliptico amplio que elimina trazos
     * de texto y cuadros, seguido de un desenfoque gaussiano masivo que produce una superficie
     * continua de iluminacion real sin artefactos ni halos.
     */
    private fun estimateIlluminationBackground(gray: Mat): Mat {
        val maxDim = 360.0
        val w = gray.cols().toDouble()
        val h = gray.rows().toDouble()
        val scale = if (max(w, h) > maxDim) maxDim / max(w, h) else 1.0

        val small = Mat()
        if (scale < 1.0) {
            Imgproc.resize(gray, small, Size(w * scale, h * scale), 0.0, 0.0, Imgproc.INTER_AREA)
        } else {
            gray.copyTo(small)
        }

        // 1. Filtro de la mediana para suprimir puntos negros y ruido sensor fino
        Imgproc.medianBlur(small, small, 5)

        // 2. Cierre morfologico (dilatacion seguida de erosion) con elipse grande
        // El tamano cubre encabezados, texto en negrita y tablas sin deformar el gradiente
        val kSize = (max(small.cols(), small.rows()) / 14).coerceAtLeast(19) or 1
        val kernel = Imgproc.getStructuringElement(Imgproc.MORPH_ELLIPSE, Size(kSize.toDouble(), kSize.toDouble()))
        val morph = Mat()
        Imgproc.morphologyEx(small, morph, Imgproc.MORPH_CLOSE, kernel)

        // 3. Desenfoque gaussiano amplio para generar campo de luz continuo
        val sigma = (max(small.cols(), small.rows()) / 18.0).coerceAtLeast(14.0)
        Imgproc.GaussianBlur(morph, morph, Size(0.0, 0.0), sigma)

        val bg = Mat()
        if (scale < 1.0) {
            Imgproc.resize(morph, bg, gray.size(), 0.0, 0.0, Imgproc.INTER_LINEAR)
        } else {
            morph.copyTo(bg)
        }

        // Evitar divisiones por valores extremadamente bajos en sombras intensas
        Core.max(bg, Scalar(35.0), bg)

        kernel.release()
        small.release()
        morph.release()
        return bg
    }

    /** Percentil p (0..1) de la luminosidad de una imagen U8, usando histograma a escala optimizada. */
    private fun percentileLuma(img: Mat, p: Double): Int {
        val gray = Mat()
        if (img.channels() == 3) Imgproc.cvtColor(img, gray, Imgproc.COLOR_RGB2GRAY)
        else if (img.channels() == 4) Imgproc.cvtColor(img, gray, Imgproc.COLOR_RGBA2GRAY)
        else img.copyTo(gray)

        val small = Mat()
        val scale = 256.0 / max(gray.cols(), gray.rows())
        if (scale < 1.0) {
            Imgproc.resize(gray, small, Size(gray.cols() * scale, gray.rows() * scale), 0.0, 0.0, Imgproc.INTER_AREA)
        } else {
            gray.copyTo(small)
        }
        val data = ByteArray(small.cols() * small.rows())
        small.get(0, 0, data)
        val hist = IntArray(256)
        for (b in data) hist[b.toInt() and 0xFF]++
        val target = (data.size * p).toInt()
        var acc = 0
        var result = 255
        for (i in 0 until 256) {
            acc += hist[i]
            if (acc >= target) { result = i; break }
        }
        gray.release()
        small.release()
        return result
    }

    /**
     * Curva tonal de escáner:
     * - Percentil alto (papel) -> blanco puro (255)
     * - Percentil bajo (tinta/texto) -> negro profundo (0)
     * - Curva gamma suave para maximizar contraste y grosor del texto
     */
    private fun applyLevels(img: Mat, gamma: Double = 1.25): Mat {
        val wp = percentileLuma(img, 0.88).coerceIn(195, 252).toDouble()
        val bp = percentileLuma(img, 0.015).coerceIn(0, 55).toDouble()
        val lutData = ByteArray(256)
        for (i in 0 until 256) {
            val x = ((i - bp) / (wp - bp)).coerceIn(0.0, 1.0)
            lutData[i] = (x.pow(gamma) * 255.0).toInt().coerceIn(0, 255).toByte()
        }
        val lut = Mat(1, 256, CvType.CV_8U)
        lut.put(0, 0, lutData)
        val out = Mat()
        Core.LUT(img, lut, out)
        lut.release()
        return out
    }

    /** Enfoque de alta definicion (Unsharp Masking) para afilar los bordes de fuentes tipográficas y firmas. */
    private fun unsharp(img: Mat, sigma: Double, amount: Double): Mat {
        val blurred = Mat()
        Imgproc.GaussianBlur(img, blurred, Size(0.0, 0.0), sigma)
        val out = Mat()
        Core.addWeighted(img, 1.0 + amount, blurred, -amount, 0.0, out)
        blurred.release()
        return out
    }

    /**
     * Motor de filtros de imagen estilo CamScanner:
     * - MAGIC_COLOR: fondo blanco impoluto, eliminacion total de sombras, texto afilado de alta definicion,
     *   y saturacion selectiva de firmas (azul) y sellos (rojo) sin alterar el blanco del papel.
     * - SHARPEN: realce de color natural con CLAHE en luminancia y nitidez.
     * - BW: blanco y negro hiper-definido con compuerta de contraste (cero ruido pimienta en zonas blancas).
     * - GRAYSCALE: escala de grises con iluminacion aplanada y texto nitido.
     * - LIGHTEN: realce de brillo y gamma para documentos con fondo oscuro.
     * - ORIGINAL: sin alteraciones.
     */
    fun applyFilter(bitmap: Bitmap, filter: FilterType): Bitmap {
        if (filter == FilterType.ORIGINAL) return bitmap

        val srcMat = Mat()
        Utils.bitmapToMat(bitmap, srcMat)
        val outputBitmap = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)

        when (filter) {
            FilterType.MAGIC_COLOR -> {
                val rgb = Mat()
                Imgproc.cvtColor(srcMat, rgb, Imgproc.COLOR_RGBA2RGB)

                // 1. Extraer canal de luminosidad (L) en espacio Lab
                val lab = Mat()
                Imgproc.cvtColor(rgb, lab, Imgproc.COLOR_RGB2Lab)
                val labChannels = ArrayList<Mat>()
                Core.split(lab, labChannels)
                val lChan = labChannels[0]

                // 2. Normalizar iluminacion en luminancia para aniquilar sombras y gradientes
                val bg = estimateIlluminationBackground(lChan)
                val lNorm = Mat()
                Core.divide(lChan, bg, lNorm, 255.0)

                // 3. Mapeo de niveles para papel blanco y texto contrastado
                val lLeveled = applyLevels(lNorm, 1.25)
                val lSharp = unsharp(lLeveled, 1.0, 0.85)

                // 4. Espacio HSV para realzar color selectivo:
                // El papel (>220) se desatura a blanco puro (elimina tinte de bombilla),
                // mientras que las tintas y sellos (>35 sat) se potencian con un +38% de saturacion
                val hsv = Mat()
                Imgproc.cvtColor(rgb, hsv, Imgproc.COLOR_RGB2HSV)
                val hsvChannels = ArrayList<Mat>()
                Core.split(hsv, hsvChannels)
                val hChan = hsvChannels[0]
                val sChan = hsvChannels[1]

                val satLutData = ByteArray(256)
                for (i in 0 until 256) {
                    satLutData[i] = when {
                        i < 30 -> 0.toByte() // Purga tinte amarillo/gris del papel
                        i < 60 -> (((i - 30) / 30.0) * i).toInt().toByte()
                        else -> min(255, (i * 1.38).toInt()).toByte() // Realce de sellos y firmas
                    }
                }
                val satLut = Mat(1, 256, CvType.CV_8U)
                satLut.put(0, 0, satLutData)
                val sBoosted = Mat()
                Core.LUT(sChan, satLut, sBoosted)

                // 5. Fusionar: H original, Saturacion realzada y Valor normalizado/afilado
                val enhancedChannels = listOf(hChan, sBoosted, lSharp)
                val enhancedHsv = Mat()
                Core.merge(enhancedChannels, enhancedHsv)

                val rgbOut = Mat()
                Imgproc.cvtColor(enhancedHsv, rgbOut, Imgproc.COLOR_HSV2RGB)
                val rgbaOut = Mat()
                Imgproc.cvtColor(rgbOut, rgbaOut, Imgproc.COLOR_RGB2RGBA)

                Utils.matToBitmap(rgbaOut, outputBitmap)

                // Liberar memoria nativa
                rgb.release(); lab.release(); bg.release(); lNorm.release()
                lLeveled.release(); lSharp.release(); hsv.release()
                satLut.release(); sBoosted.release(); enhancedHsv.release()
                rgbOut.release(); rgbaOut.release()
                labChannels.forEach { it.release() }
                hsvChannels.forEach { it.release() }
            }

            FilterType.SHARPEN -> {
                val rgb = Mat()
                Imgproc.cvtColor(srcMat, rgb, Imgproc.COLOR_RGBA2RGB)
                val lab = Mat()
                Imgproc.cvtColor(rgb, lab, Imgproc.COLOR_RGB2Lab)
                val chs = ArrayList<Mat>()
                Core.split(lab, chs)

                // CLAHE en canal L con limites optimizados
                val clahe = Imgproc.createCLAHE(2.0, Size(8.0, 8.0))
                clahe.apply(chs[0], chs[0])
                Core.merge(chs, lab)

                val enhanced = Mat()
                Imgproc.cvtColor(lab, enhanced, Imgproc.COLOR_Lab2RGB)
                val sharp = unsharp(enhanced, 1.2, 0.75)
                val rgba = Mat()
                Imgproc.cvtColor(sharp, rgba, Imgproc.COLOR_RGB2RGBA)
                Utils.matToBitmap(rgba, outputBitmap)

                rgb.release(); lab.release(); enhanced.release(); sharp.release(); rgba.release()
                chs.forEach { it.release() }
            }

            FilterType.BW -> {
                val gray = Mat()
                Imgproc.cvtColor(srcMat, gray, Imgproc.COLOR_RGBA2GRAY)

                val bg = estimateIlluminationBackground(gray)
                val norm = Mat()
                Core.divide(gray, bg, norm, 255.0)

                // Compuerta de ruido: solo se consideran texto aquellos pixeles con contraste >= 16 respecto al papel
                val diff = Mat()
                Core.subtract(bg, gray, diff)
                val textMask = Mat()
                Imgproc.threshold(diff, textMask, 16.0, 255.0, Imgproc.THRESH_BINARY)

                val block = (max(norm.cols(), norm.rows()) / 35).coerceAtLeast(25) or 1
                val bw = Mat()
                Imgproc.adaptiveThreshold(
                    norm, bw, 255.0, Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
                    Imgproc.THRESH_BINARY, block, 12.0
                )

                // Forzar 255 (blanco) en todas las zonas vacías para erradicar ruido pimienta
                val invMask = Mat()
                Core.bitwise_not(textMask, invMask)
                val cleanBw = Mat()
                Core.bitwise_or(bw, invMask, cleanBw)

                val rgba = Mat()
                Imgproc.cvtColor(cleanBw, rgba, Imgproc.COLOR_GRAY2RGBA)
                Utils.matToBitmap(rgba, outputBitmap)

                gray.release(); bg.release(); norm.release(); diff.release()
                textMask.release(); bw.release(); invMask.release(); cleanBw.release(); rgba.release()
            }

            FilterType.GRAYSCALE -> {
                val gray = Mat()
                Imgproc.cvtColor(srcMat, gray, Imgproc.COLOR_RGBA2GRAY)

                val bg = estimateIlluminationBackground(gray)
                val norm = Mat()
                Core.divide(gray, bg, norm, 255.0)

                val leveled = applyLevels(norm, 1.22)
                val sharp = unsharp(leveled, 1.0, 0.8)
                val rgba = Mat()
                Imgproc.cvtColor(sharp, rgba, Imgproc.COLOR_GRAY2RGBA)
                Utils.matToBitmap(rgba, outputBitmap)

                gray.release(); bg.release(); norm.release(); leveled.release(); sharp.release(); rgba.release()
            }

            FilterType.LIGHTEN -> {
                val lutData = ByteArray(256)
                for (i in 0 until 256) {
                    lutData[i] = (i / 255.0).pow(0.70).times(255.0).toInt().coerceIn(0, 255).toByte()
                }
                val lut = Mat(1, 256, CvType.CV_8U)
                lut.put(0, 0, lutData)
                val out = Mat()
                Core.LUT(srcMat, lut, out)
                Utils.matToBitmap(out, outputBitmap)
                lut.release()
                out.release()
            }

            FilterType.ORIGINAL -> { }
        }

        srcMat.release()
        return outputBitmap
    }

    /**
     * Rotates bitmap by given degrees (e.g. 90, 180, 270).
     */
    fun rotateBitmap(bitmap: Bitmap, degrees: Float): Bitmap {
        if (degrees % 360f == 0f) return bitmap
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * Assembles all processed pages into a single PDF document with standard A4 dimensions.
     */
    fun createPdf(pages: List<Bitmap>, outputFile: File): Boolean {
        if (pages.isEmpty()) return false

        val pdfDocument = PdfDocument()
        val paint = android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG)
        try {
            for ((index, pageBitmap) in pages.withIndex()) {
                // Standard A4 width is 595 points (8.27 in * 72 dpi)
                val targetWidth = 595
                val targetHeight = (595f * pageBitmap.height / pageBitmap.width).toInt().coerceAtLeast(100)

                val pageInfo = PdfDocument.PageInfo.Builder(
                    targetWidth,
                    targetHeight,
                    index + 1
                ).create()
                val page = pdfDocument.startPage(pageInfo)
                val canvas = page.canvas
                val destRect = android.graphics.Rect(0, 0, targetWidth, targetHeight)
                canvas.drawBitmap(pageBitmap, null, destRect, paint)
                pdfDocument.finishPage(page)
            }

            outputFile.parentFile?.mkdirs()
            FileOutputStream(outputFile).use { out ->
                pdfDocument.writeTo(out)
            }
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        } finally {
            pdfDocument.close()
        }
    }
}
