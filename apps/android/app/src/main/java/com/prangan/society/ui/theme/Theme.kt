package com.prangan.society.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * The same values as apps/web/src/styles.js. Two apps that look like two
 * products are two products as far as a resident is concerned, so the palette
 * is copied deliberately rather than left to Material's defaults.
 *
 * Dynamic colour is off for the same reason: a society's accent is a setting
 * the committee chooses, not something the resident's wallpaper decides.
 */

// Neutral ramp — very slightly cool, so it reads as ink rather than mud.
val N0 = Color(0xFFFFFFFF)
val N25 = Color(0xFFFCFCFD)
val N50 = Color(0xFFF7F8F9)
val N100 = Color(0xFFF0F1F3)
val N150 = Color(0xFFE8EAED)
val N200 = Color(0xFFDFE1E6)
val N300 = Color(0xFFC6CAD1)
val N400 = Color(0xFF9BA1AB)
val N500 = Color(0xFF727984)
val N600 = Color(0xFF545B66)
val N700 = Color(0xFF3A404A)
val N800 = Color(0xFF252A32)
val N900 = Color(0xFF14171C)

val Accent = Color(0xFF2D4EA2)
val AccentHover = Color(0xFF25417F)
val AccentSoft = Color(0xFFEEF2FB)
val AccentLine = Color(0xFFCBD8F0)

val Ok = Color(0xFF1B7A4F)
val OkBg = Color(0xFFEAF5EF)
val Warn = Color(0xFF8A5A12)
val WarnBg = Color(0xFFFBF2E4)
val Bad = Color(0xFFA6322A)
val BadBg = Color(0xFFFBEDEC)
val Info = Color(0xFF1F5B94)
val InfoBg = Color(0xFFEAF1F8)

private val LightColors = lightColorScheme(
    primary = Accent,
    onPrimary = N0,
    primaryContainer = AccentSoft,
    onPrimaryContainer = AccentHover,
    secondary = N600,
    onSecondary = N0,
    background = N50,
    onBackground = N900,
    surface = N0,
    onSurface = N900,
    surfaceVariant = N100,
    onSurfaceVariant = N600,
    outline = N200,
    outlineVariant = N150,
    error = Bad,
    onError = N0,
    errorContainer = BadBg,
    onErrorContainer = Bad,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8FA9E0),
    onPrimary = Color(0xFF10203F),
    primaryContainer = Color(0xFF1E2C4C),
    onPrimaryContainer = Color(0xFFD7E1F6),
    background = Color(0xFF0F1115),
    onBackground = Color(0xFFE8EAED),
    surface = Color(0xFF171A20),
    onSurface = Color(0xFFE8EAED),
    surfaceVariant = Color(0xFF232830),
    onSurfaceVariant = Color(0xFFA8AEB8),
    outline = Color(0xFF3A404A),
    outlineVariant = Color(0xFF2A2F38),
    error = Color(0xFFE99189),
    onError = Color(0xFF3B100C),
)

private val PranganShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(20.dp),
)

private val PranganType = Typography(
    headlineLarge = TextStyle(fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold),
    headlineSmall = TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.5.sp, lineHeight = 18.sp),
    labelSmall = TextStyle(fontSize = 11.sp, lineHeight = 15.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun PranganTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = PranganType,
        shapes = PranganShapes,
        content = content,
    )
}
