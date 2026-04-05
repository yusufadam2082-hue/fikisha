package com.fikisha.customer.ui.screens.ai

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fikisha.customer.data.model.AiChatMessage
import com.fikisha.customer.data.repository.Repository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class AiAssistantViewModel : ViewModel() {
    private val repository = Repository()

    private val _messages = MutableStateFlow(
        listOf(
            AiChatMessage(
                id = "welcome",
                role = "assistant",
                text = "Hi! I'm your Mtaaexpress AI assistant. Ask me about order tracking, delivery ETA, promos, or what to order."
            )
        )
    )
    val messages: StateFlow<List<AiChatMessage>> = _messages.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _suggestions = MutableStateFlow<List<String>>(emptyList())
    val suggestions: StateFlow<List<String>> = _suggestions.asStateFlow()

    fun sendMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank() || _isLoading.value) return

        val userMsg = AiChatMessage(id = "${UUID.randomUUID()}-user", role = "user", text = trimmed)
        _messages.value = _messages.value + userMsg
        _isLoading.value = true
        _suggestions.value = emptyList()

        viewModelScope.launch {
            val contextPayload = _messages.value.takeLast(7)
                .map { mapOf("role" to it.role, "text" to it.text) }

            repository.chatWithAi(trimmed, contextPayload)
                .onSuccess { response ->
                    val reply = response.reply ?: "I couldn't process that right now."
                    _messages.value = _messages.value + AiChatMessage(
                        id = "${UUID.randomUUID()}-assistant",
                        role = "assistant",
                        text = reply
                    )
                    _suggestions.value = response.suggestions.take(4)
                }
                .onFailure {
                    _messages.value = _messages.value + AiChatMessage(
                        id = "${UUID.randomUUID()}-fallback",
                        role = "assistant",
                        text = "I'm having trouble right now. Please try again shortly."
                    )
                }
            _isLoading.value = false
        }
    }
}

private val quickPrompts = listOf("Track my order", "Best stores near me", "How is ETA calculated?")

@Composable
fun AiAssistantBubble(
    viewModel: AiAssistantViewModel = viewModel()
) {
    var isOpen by remember { mutableStateOf(false) }
    val messages by viewModel.messages.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val suggestions by viewModel.suggestions.collectAsState()
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomEnd) {
        // Chat panel
        AnimatedVisibility(
            visible = isOpen,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it }),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(bottom = 80.dp, end = 16.dp)
        ) {
            Card(
                modifier = Modifier
                    .width(340.dp)
                    .heightIn(max = 480.dp),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Header
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Brush.horizontalGradient(listOf(Color(0xFFa63400), Color(0xFFff7948))))
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.SmartToy,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                                Text(
                                    "AI Assistant",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                            IconButton(onClick = { isOpen = false }, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                            }
                        }
                    }

                    // Messages
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            ChatBubble(msg)
                        }
                        if (isLoading) {
                            item {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(start = 4.dp)
                                ) {
                                    repeat(3) {
                                        Surface(
                                            shape = CircleShape,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                            modifier = Modifier.size(6.dp)
                                        ) {}
                                    }
                                }
                            }
                        }
                    }

                    // Quick prompt chips (first open or after a reply)
                    if (messages.size == 1 || suggestions.isNotEmpty()) {
                        val chips = if (suggestions.isNotEmpty()) suggestions else quickPrompts
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            chips.take(3).forEach { chip ->
                                SuggestionChip(
                                    onClick = {
                                        viewModel.sendMessage(chip)
                                        inputText = ""
                                    },
                                    label = {
                                        Text(chip, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                                    },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Input row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = inputText,
                            onValueChange = { inputText = it },
                            modifier = Modifier.weight(1f),
                            placeholder = { Text("Ask anything...", style = MaterialTheme.typography.bodySmall) },
                            singleLine = true,
                            shape = RoundedCornerShape(24.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFFa63400),
                                unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                            )
                        )
                        IconButton(
                            onClick = {
                                viewModel.sendMessage(inputText)
                                inputText = ""
                            },
                            enabled = inputText.isNotBlank() && !isLoading,
                            modifier = Modifier
                                .size(44.dp)
                                .background(
                                    color = if (inputText.isNotBlank()) Color(0xFFa63400) else MaterialTheme.colorScheme.surfaceVariant,
                                    shape = CircleShape
                                )
                        ) {
                            Icon(
                                Icons.Default.Send,
                                contentDescription = "Send",
                                tint = if (inputText.isNotBlank()) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }

        // Floating bubble button
        FloatingActionButton(
            onClick = { isOpen = !isOpen },
            modifier = Modifier
                .padding(bottom = 16.dp, end = 16.dp)
                .size(56.dp),
            shape = CircleShape,
            containerColor = Color(0xFFa63400),
            contentColor = Color.White,
            elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp)
        ) {
            Icon(
                if (isOpen) Icons.Default.Close else Icons.Default.SmartToy,
                contentDescription = if (isOpen) "Close AI assistant" else "Open AI assistant",
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
private fun ChatBubble(message: AiChatMessage) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isUser) 16.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 16.dp
            ),
            color = if (isUser)
                Color(0xFFa63400)
            else
                MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.widthIn(max = 260.dp)
        ) {
            Text(
                text = message.text,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                style = MaterialTheme.typography.bodySmall,
                color = if (isUser) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
