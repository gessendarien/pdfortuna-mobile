package com.pdfortuna.scanner

import org.opencv.core.Point
import kotlin.math.hypot
import kotlin.math.max

/**
 * Estabiliza el cuadrilatero detectado entre frames:
 *  - suavizado exponencial con zona muerta (sin temblor)
 *  - histeresis: aparece tras HITS_TO_SHOW frames coherentes y desaparece tras MISS_LIMIT sin deteccion
 *  - deteccion de estabilidad temporal para auto-captura (isStableForCapture)
 * Trabaja en coordenadas normalizadas [0,1].
 */
class QuadTracker {

    private var current: DoubleArray? = null     // 8 valores normalizados
    private var candidate: DoubleArray? = null
    private var hits = 0
    private var misses = 0
    var visible = false
        private set

    var stableFrames = 0
        private set

    val isStable: Boolean
        get() = visible && stableFrames >= STABLE_FRAMES_REQUIRED

    fun reset() {
        current = null
        candidate = null
        hits = 0
        misses = 0
        visible = false
        stableFrames = 0
    }

    fun isStableForCapture(): Boolean {
        return visible && stableFrames >= STABLE_FRAMES_REQUIRED
    }

    fun update(quad: Quadrilateral?, w: Int, h: Int): Quadrilateral? {
        if (quad == null) {
            misses++
            stableFrames = 0
            if (misses >= MISS_LIMIT) { reset(); return null }
            return output(w, h)
        }
        misses = 0
        val n = normalize(quad, w, h)
        val cur = current
        if (cur == null) {
            current = n; hits = 1; visible = false; stableFrames = 0
            return output(w, h)
        }
        val d = maxDist(cur, n)
        when {
            d > JUMP_THRESHOLD -> {
                val cand = candidate
                if (cand != null && maxDist(cand, n) < JUMP_THRESHOLD * 0.5) {
                    current = n; candidate = null; hits = 1
                    visible = false
                    stableFrames = 0
                } else {
                    candidate = n
                    stableFrames = 0
                }
            }
            d < DEAD_ZONE -> {
                candidate = null
                hits++
                stableFrames++
            }
            else -> {
                candidate = null
                val a = if (d > 0.04) 0.55 else 0.3
                for (i in 0 until 8) cur[i] = cur[i] + a * (n[i] - cur[i])
                hits++
                if (d < STABLE_TOLERANCE) {
                    stableFrames++
                } else {
                    stableFrames = 0
                }
            }
        }
        if (hits >= HITS_TO_SHOW) visible = true
        return output(w, h)
    }

    fun getCurrentNormalized(): DoubleArray? = current?.clone()

    private fun output(w: Int, h: Int): Quadrilateral? {
        val c = current ?: return null
        if (!visible) return null
        return Quadrilateral(
            Point(c[0] * w, c[1] * h), Point(c[2] * w, c[3] * h),
            Point(c[4] * w, c[5] * h), Point(c[6] * w, c[7] * h)
        )
    }

    private fun normalize(q: Quadrilateral, w: Int, h: Int) = doubleArrayOf(
        q.topLeft.x / w, q.topLeft.y / h, q.topRight.x / w, q.topRight.y / h,
        q.bottomRight.x / w, q.bottomRight.y / h, q.bottomLeft.x / w, q.bottomLeft.y / h
    )

    private fun maxDist(a: DoubleArray, b: DoubleArray): Double {
        var m = 0.0
        for (i in 0 until 4) m = max(m, hypot(a[i * 2] - b[i * 2], a[i * 2 + 1] - b[i * 2 + 1]))
        return m
    }

    companion object {
        private const val HITS_TO_SHOW = 3
        private const val MISS_LIMIT = 6
        private const val JUMP_THRESHOLD = 0.12
        private const val DEAD_ZONE = 0.005
        private const val STABLE_TOLERANCE = 0.016
        private const val STABLE_FRAMES_REQUIRED = 8
    }
}
