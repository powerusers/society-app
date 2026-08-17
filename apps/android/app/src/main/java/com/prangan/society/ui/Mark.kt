package com.prangan.society.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.prangan.society.ui.theme.Accent
import com.prangan.society.ui.theme.AccentLine

/**
 * The mark, drawn rather than shipped as a bitmap.
 *
 * The same geometry as apps/web/src/lib/mark.js: a courtyard — which is what
 * "prangan" means — as an opening with a tower either side. Drawn in code so it
 * stays sharp at any size and cannot drift out of step with the web app's
 * version the way two exported PNGs would.
 */
@Composable
fun Mark(size: Dp = 40.dp, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(size)) {
        val unit = this.size.minDimension / 24f
        fun u(n: Float) = n * unit

        fun block(x: Float, y: Float, w: Float, h: Float, colour: androidx.compose.ui.graphics.Color) {
            drawRoundRect(
                color = colour,
                topLeft = Offset(u(x), u(y)),
                size = Size(u(w), u(h)),
                cornerRadius = CornerRadius(u(1.2f), u(1.2f)),
            )
        }

        // Two towers either side of an open courtyard.
        block(2f, 6f, 6f, 16f, Accent)
        block(16f, 6f, 6f, 16f, Accent)

        // The courtyard wall, lower and lighter, closing the square.
        block(8f, 15f, 8f, 7f, AccentLine)

        // The roofline over the opening.
        val roof = Path().apply {
            moveTo(u(7f), u(8f))
            lineTo(u(12f), u(3f))
            lineTo(u(17f), u(8f))
            close()
        }
        drawPath(roof, Accent)
    }
}
