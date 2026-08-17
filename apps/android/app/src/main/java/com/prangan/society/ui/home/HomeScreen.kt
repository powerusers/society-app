package com.prangan.society.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prangan.society.core.model.Notice
import com.prangan.society.core.model.User
import com.prangan.society.core.model.Visitor
import com.prangan.society.ui.theme.WarnBg

/**
 * What a resident wants to see when they open the app.
 *
 * Ordered by urgency rather than by module: somebody standing at the gate comes
 * first, because that is the one thing on this screen where a delay costs
 * somebody their afternoon.
 */
@Composable
fun HomeScreen(
    user: User,
    societyName: String,
    pending: List<Visitor>,
    inside: List<Visitor>,
    notices: List<Notice>,
    busyVisitorId: String?,
    onApprove: (Visitor) -> Unit,
    onDeny: (Visitor) -> Unit,
    onOpenNotice: (Notice) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text(
                    user.name,
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    listOfNotNull(user.flat?.let { "Flat $it" }, user.designation, societyName)
                        .joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }

        if (pending.isNotEmpty()) {
            item {
                SectionHeading(
                    if (pending.size == 1) "Someone is at the gate"
                    else "${pending.size} people are at the gate"
                )
            }
            items(pending, key = { it.id }) { v ->
                VisitorCard(
                    visitor = v,
                    busy = busyVisitorId == v.id,
                    onApprove = { onApprove(v) },
                    onDeny = { onDeny(v) },
                )
            }
        }

        if (inside.isNotEmpty()) {
            item { SectionHeading("Inside now") }
            items(inside, key = { it.id }) { v ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(v.name, style = MaterialTheme.typography.titleSmall)
                        Text(
                            listOfNotNull(v.purpose.takeIf { it.isNotBlank() } ?: v.category, v.gateName)
                                .joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 3.dp),
                        )
                    }
                }
            }
        }

        item { SectionHeading("Notice board") }
        if (notices.isEmpty()) {
            item {
                Text(
                    "Nothing on the board yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(notices.take(6), key = { it.id }) { n ->
                NoticeCard(notice = n, onClick = { onOpenNotice(n) })
            }
        }
    }
}

@Composable
private fun SectionHeading(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 8.dp),
    )
}

/**
 * The card that decides whether somebody gets in.
 *
 * Approve and deny are the same visual weight on purpose. Making "approve" the
 * easy tap is how a resident lets in a courier they never ordered.
 */
@Composable
private fun VisitorCard(
    visitor: Visitor,
    busy: Boolean,
    onApprove: () -> Unit,
    onDeny: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = WarnBg),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(visitor.name, style = MaterialTheme.typography.titleMedium)
            Text(
                listOfNotNull(
                    visitor.purpose.takeIf { it.isNotBlank() } ?: visitor.category,
                    visitor.gateName,
                    visitor.vehicle.takeIf { it.isNotBlank() },
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 12.dp),
            ) {
                Button(
                    onClick = onApprove,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) { Text(if (busy) "…" else "Let in") }
                OutlinedButton(
                    onClick = onDeny,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) { Text("Deny") }
            }
        }
    }
}

@Composable
private fun NoticeCard(notice: Notice, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!notice.read) {
                    Box(
                        Modifier
                            .padding(end = 8.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50))
                            .size(7.dp)
                    )
                }
                Text(
                    notice.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (notice.read) FontWeight.Medium else FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                notice.body,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                listOfNotNull(notice.author.takeIf { it.isNotBlank() }, "Read by ${notice.readCount}")
                    .joinToString(" · "),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}
