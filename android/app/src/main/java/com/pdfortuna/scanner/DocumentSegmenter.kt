package com.pdfortuna.scanner

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.channels.FileChannel
import kotlin.math.exp

/**
 * Detecta el documento con el modelo de segmentacion de FairScan (GPLv3):
 * https://github.com/pynicolas/fairscan-segmentation-model
 * DeepLabV3+ MobileNetV2, entrada 256x256 NHWC (RGB, normalizacion ImageNet), salida 1 canal.
 */
class DocumentSegmenter(context: Context) {

    private val interpreter: Interpreter
    private val inputBuffer: ByteBuffer
    private val outputSize: Int
    private val outH: Int
    private val outW: Int
    private val pixels = IntArray(IN * IN)

    init {
        val fd = context.assets.openFd(MODEL_ASSET)
        val mapped = fd.createInputStream().channel.map(
            FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength
        )
        val opts = Interpreter.Options().setNumThreads(4)
        interpreter = Interpreter(mapped, opts)

        val inShape = interpreter.getInputTensor(0).shape()
        val outShape = interpreter.getOutputTensor(0).shape()
        Log.i(TAG, "Model input=${inShape.toList()} output=${outShape.toList()}")
        // Salida esperada [1, H, W, 1] (NHWC) o [1, 1, H, W]
        outSizeFromShape(outShape).let { (h, w) -> outH = h; outW = w }
        outputSize = outH * outW

        inputBuffer = ByteBuffer.allocateDirect(IN * IN * 3 * 4).order(ByteOrder.nativeOrder())
    }

    private fun outSizeFromShape(shape: IntArray): Pair<Int, Int> {
        return when {
            shape.size == 4 && shape[3] == 1 -> shape[1] to shape[2]
            shape.size == 4 && shape[1] == 1 -> shape[2] to shape[3]
            shape.size == 3 -> shape[1] to shape[2]
            else -> IN to IN
        }
    }

    /** Devuelve la probabilidad de documento por pixel (CV_32F, outH x outW), 0..1. */
    @Synchronized
    fun predictProbability(bitmap: Bitmap): Mat {
        val scaled = Bitmap.createScaledBitmap(bitmap, IN, IN, true)
        scaled.getPixels(pixels, 0, IN, 0, 0, IN, IN)
        if (scaled !== bitmap) scaled.recycle()

        inputBuffer.rewind()
        for (p in pixels) {
            val r = ((p shr 16) and 0xFF) / 255f
            val g = ((p shr 8) and 0xFF) / 255f
            val b = (p and 0xFF) / 255f
            inputBuffer.putFloat((r - MEAN[0]) / STD[0])
            inputBuffer.putFloat((g - MEAN[1]) / STD[1])
            inputBuffer.putFloat((b - MEAN[2]) / STD[2])
        }
        inputBuffer.rewind()

        val outBuf = ByteBuffer.allocateDirect(outputSize * 4).order(ByteOrder.nativeOrder())
        interpreter.run(inputBuffer, outBuf)
        outBuf.rewind()
        val fb: FloatBuffer = outBuf.asFloatBuffer()
        val data = FloatArray(outputSize)
        fb.get(data)

        var min = Float.MAX_VALUE
        var max = -Float.MAX_VALUE
        for (v in data) { if (v < min) min = v; if (v > max) max = v }
        // Si hay valores fuera de [0,1] se trata de logits
        if (min < 0f || max > 1f) {
            for (i in data.indices) data[i] = 1f / (1f + exp(-data[i]))
        }
        val mat = Mat(outH, outW, CvType.CV_32F)
        mat.put(0, 0, data)
        return mat
    }

    /** Cuadrilatero del documento en coordenadas del bitmap, o null. */
    fun detectQuad(bitmap: Bitmap, minAreaRatio: Double = 0.08): Quadrilateral? {
        val prob = predictProbability(bitmap)
        try {
            return DocumentSegmenterPost.quadFromProbability(prob, bitmap.width, bitmap.height, minAreaRatio)
        } finally {
            prob.release()
        }
    }

    fun close() {
        interpreter.close()
    }

    companion object {
        private const val TAG = "DocumentSegmenter"
        private const val MODEL_ASSET = "fairscan-segmentation-model.tflite"
        private const val IN = 256
        private val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
        private val STD = floatArrayOf(0.229f, 0.224f, 0.225f)
    }
}

object DocumentSegmenterPost {

    fun quadFromProbability(prob: Mat, width: Int, height: Int, minAreaRatio: Double): Quadrilateral? {
        // Subir resolucion de la probabilidad (bilineal) para contornos suaves y subpixel
        val up = Mat()
        Imgproc.resize(prob, up, Size(512.0, 512.0), 0.0, 0.0, Imgproc.INTER_LINEAR)
        val bin = Mat()
        Imgproc.threshold(up, bin, 0.5, 255.0, Imgproc.THRESH_BINARY)
        val mask = Mat()
        bin.convertTo(mask, CvType.CV_8U)
        up.release(); bin.release()

        val k = Imgproc.getStructuringElement(Imgproc.MORPH_ELLIPSE, Size(7.0, 7.0))
        Imgproc.morphologyEx(mask, mask, Imgproc.MORPH_OPEN, k)
        Imgproc.morphologyEx(mask, mask, Imgproc.MORPH_CLOSE, k)
        k.release()

        val contours = ArrayList<MatOfPoint>()
        val hierarchy = Mat()
        Imgproc.findContours(mask, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)
        hierarchy.release()
        mask.release()

        var best: MatOfPoint? = null
        var bestArea = 0.0
        for (c in contours) {
            val a = Imgproc.contourArea(c)
            if (a > bestArea) { bestArea = a; best = c }
        }
        val total = 512.0 * 512.0
        if (best == null || bestArea < total * minAreaRatio) {
            contours.forEach { it.release() }
            return null
        }

        // Casco convexo -> aproximar a 4 vertices en perspectiva real
        val hullIdx = MatOfInt()
        Imgproc.convexHull(best, hullIdx)
        val pts = best.toList()
        val hullPts = hullIdx.toList().map { pts[it] }
        hullIdx.release()
        val hull2f = MatOfPoint2f(*hullPts.toTypedArray())
        val peri = Imgproc.arcLength(hull2f, true)

        var quadPts: List<Point>? = null
        var eps = 0.015
        while (eps <= 0.12) {
            val approx = MatOfPoint2f()
            Imgproc.approxPolyDP(hull2f, approx, eps * peri, true)
            val n = approx.total().toInt()
            if (n == 4) {
                val candidateMat = MatOfPoint(*approx.toArray())
                if (Imgproc.isContourConvex(candidateMat)) {
                    quadPts = approx.toList()
                    candidateMat.release()
                    approx.release()
                    break
                }
                candidateMat.release()
            }
            approx.release()
            if (n < 4) break
            eps += 0.005
        }

        // Si approxPolyDP no da exactamente 4 vertices, extraer las 4 esquinas de perspectiva
        // del casco convexo usando proyecciones diagonales y maxima distancia a diagonales
        if (quadPts == null && hullPts.size >= 4) {
            quadPts = extractPerspectiveQuad(hullPts)
        }

        hull2f.release()
        contours.forEach { it.release() }

        if (quadPts == null || quadPts.size != 4) return null

        val sx = width / 512.0
        val sy = height / 512.0
        val mapped = quadPts.map {
            Point(
                (it.x * sx).coerceIn(0.0, (width - 1).toDouble()),
                (it.y * sy).coerceIn(0.0, (height - 1).toDouble())
            )
        }
        return Quadrilateral.fromPoints(mapped)
    }

    /**
     * Extrae 4 esquinas de perspectiva real a partir del casco convexo,
     * evitando recortar el documento con rectangulos rigidos.
     */
    private fun extractPerspectiveQuad(hullPts: List<Point>): List<Point> {
        var tl = hullPts.minByOrNull { it.x + it.y } ?: hullPts[0]
        var br = hullPts.maxByOrNull { it.x + it.y } ?: hullPts[0]
        var tr = hullPts.minByOrNull { it.y - it.x } ?: hullPts[0]
        var bl = hullPts.maxByOrNull { it.y - it.x } ?: hullPts[0]

        // Refinamiento por distancia maxima a las diagonales
        val dx1 = br.x - tl.x
        val dy1 = br.y - tl.y
        val len1 = kotlin.math.hypot(dx1, dy1)
        if (len1 > 1.0) {
            val trCandidate = hullPts.minByOrNull { (it.x - tl.x) * dy1 - (it.y - tl.y) * dx1 }
            val blCandidate = hullPts.maxByOrNull { (it.x - tl.x) * dy1 - (it.y - tl.y) * dx1 }
            if (trCandidate != null) tr = trCandidate
            if (blCandidate != null) bl = blCandidate
        }

        val dx2 = bl.x - tr.x
        val dy2 = bl.y - tr.y
        val len2 = kotlin.math.hypot(dx2, dy2)
        if (len2 > 1.0) {
            val tlCandidate = hullPts.minByOrNull { (it.x - tr.x) * dy2 - (it.y - tr.y) * dx2 }
            val brCandidate = hullPts.maxByOrNull { (it.x - tr.x) * dy2 - (it.y - tr.y) * dx2 }
            if (tlCandidate != null) tl = tlCandidate
            if (brCandidate != null) br = brCandidate
        }

        return listOf(tl, tr, br, bl)
    }
}
