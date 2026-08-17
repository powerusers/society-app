package com.prangan.society.core.net

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

@Serializable
internal data class ErrorEnvelope(@SerialName("error") val error: ErrorBody?)

@Serializable
internal data class ErrorBody(val code: String? = null, val message: String? = null)

/**
 * A failure the screen can put in front of somebody.
 *
 * The API already writes its refusals in words a resident can act on — "That
 * slot has just been booked by another resident" — so the work here is to carry
 * that message through rather than replace it with "Request failed (409)".
 */
class ApiException(
    val status: Int,
    val code: String?,
    override val message: String,
) : Exception(message)

private val errorJson = Json { ignoreUnknownKeys = true }

/**
 * Runs a call and turns whatever went wrong into something sayable.
 *
 * The three cases a resident actually meets are a refusal from the server, a
 * phone with no signal, and everything else — and they want different words.
 */
suspend fun <T> apiCall(block: suspend () -> T): Result<T> = try {
    Result.success(block())
} catch (e: HttpException) {
    val body = e.response()?.errorBody()?.string()
    val parsed = body?.takeIf { it.isNotBlank() }?.let {
        runCatching { errorJson.decodeFromString<ErrorEnvelope>(it).error }.getOrNull()
    }
    Result.failure(
        ApiException(
            status = e.code(),
            code = parsed?.code,
            message = parsed?.message ?: "Something went wrong (${e.code()})",
        )
    )
} catch (e: IOException) {
    Result.failure(ApiException(0, "offline", "No connection. Check your network and try again."))
} catch (e: Exception) {
    Result.failure(ApiException(-1, "unknown", e.message ?: "Something went wrong"))
}
