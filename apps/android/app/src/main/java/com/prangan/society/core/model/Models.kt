package com.prangan.society.core.model

import kotlinx.serialization.Serializable

/*
 * These mirror the API's serializers in apps/api/src/lib/serialize.js and the
 * route files. Every field is optional-with-a-default where the server may omit
 * it, so a build that predates a field the API stopped sending keeps working:
 * the client is not the authority on shape and should not fail like one.
 */

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class SessionResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: String? = null,
    val user: User,
)

@Serializable
data class User(
    val id: String,
    val name: String,
    val email: String = "",
    val phone: String = "",
    val role: String,
    val designation: String? = null,
    val relation: String? = null,
    val flat: String? = null,
    val flatId: String? = null,
    val gateId: String? = null,
    val shift: String? = null,
    val status: String = "active",
    val joined: String? = null,
)

@Serializable
data class Society(
    val id: String,
    val name: String,
    val address: String = "",
)

@Serializable
data class Flat(
    val id: String? = null,
    val code: String,
    val block: String = "",
    val floor: Int = 0,
    val type: String = "",
    val parkingSlots: Int = 0,
)

@Serializable
data class MeResponse(
    val user: User,
    val flat: Flat? = null,
    val society: Society? = null,
    /*
     * What this person may do, decided by the server from the same capability
     * matrix the web app uses. The app renders from this list rather than
     * testing role strings, so the two can never disagree about what a
     * committee member is allowed to see.
     */
    val capabilities: List<String> = emptyList(),
)

@Serializable
data class Visitor(
    val id: String,
    val name: String,
    val category: String = "guest",
    val status: String,
    val flatCode: String? = null,
    val gateId: String? = null,
    val gateName: String? = null,
    val purpose: String = "",
    val phone: String = "",
    val vehicle: String = "",
    val passCode: String? = null,
    val allowedMins: Int? = null,
    val recurring: String? = null,
    val expectedAt: String? = null,
    val raisedBy: String? = null,
    val verifiedBy: String? = null,
    val denyReason: String? = null,
    val sentAt: String? = null,
    val approvedAt: String? = null,
    val entryAt: String? = null,
    val exitAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class VisitorsResponse(val visitors: List<Visitor> = emptyList())

@Serializable
data class VisitorResponse(val visitor: Visitor)

@Serializable
data class TransitionRequest(
    val status: String,
    val reason: String? = null,
    val allowedMins: Int? = null,
)

@Serializable
data class NoticeComment(
    val id: String,
    val body: String = "",
    val at: String? = null,
    val author: String = "",
    val authorId: String? = null,
)

@Serializable
data class Notice(
    val id: String,
    val kind: String = "notice",
    val title: String,
    val body: String = "",
    val author: String = "",
    val authorId: String? = null,
    val priority: String = "normal",
    val pinned: Boolean = false,
    val at: String? = null,
    val comments: List<NoticeComment> = emptyList(),
    val reactions: Map<String, Int> = emptyMap(),
    val myReactions: List<String> = emptyList(),
    val readCount: Int = 0,
    val read: Boolean = false,
)

@Serializable
data class NoticesResponse(val notices: List<Notice> = emptyList())
