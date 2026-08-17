package com.prangan.society.core.net

import com.prangan.society.core.model.LoginRequest
import com.prangan.society.core.model.MeResponse
import com.prangan.society.core.model.NoticesResponse
import com.prangan.society.core.model.RefreshRequest
import com.prangan.society.core.model.SessionResponse
import com.prangan.society.core.model.TransitionRequest
import com.prangan.society.core.model.VisitorResponse
import com.prangan.society.core.model.VisitorsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The endpoints this app uses, named as the API names them.
 *
 * Kept deliberately thin: no client-side massaging of shapes, because the web
 * app and this one have to agree about what a notice or a visitor is, and the
 * only way they can is by both taking the server's word for it.
 */
interface Api {

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): SessionResponse

    @POST("api/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): SessionResponse

    @POST("api/auth/logout")
    suspend fun logout(@Body body: RefreshRequest)

    @GET("api/me")
    suspend fun me(): MeResponse

    @GET("api/visitors")
    suspend fun visitors(@Query("status") status: String? = null): VisitorsResponse

    @PATCH("api/visitors/{id}/status")
    suspend fun transitionVisitor(
        @Path("id") id: String,
        @Body body: TransitionRequest,
    ): VisitorResponse

    @GET("api/notices")
    suspend fun notices(@Query("limit") limit: Int = 60): NoticesResponse

    @POST("api/notices/{id}/read")
    suspend fun markNoticeRead(@Path("id") id: String)
}
