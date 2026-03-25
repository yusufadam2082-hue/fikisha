package com.fikisha.customer.ui.screens.merchant

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.ToggleOff
import androidx.compose.material.icons.filled.ToggleOn
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fikisha.customer.data.model.Order
import com.fikisha.customer.data.model.Store
import com.fikisha.customer.data.model.StoreUpdateRequest
import com.fikisha.customer.data.model.User
import com.fikisha.customer.data.repository.Repository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private data class MerchantPerformance(
    val totalOrders: Int,
    val todaysOrders: Int,
    val pendingOrders: Int,
    val activeOrders: Int,
    val cancelledOrders: Int,
    val deliveredOrders: Int,
    val acceptanceRate: Int,
    val grossRevenue: Double,
    val deliveredRevenue: Double,
    val averageOrderValue: Double
)

class MerchantOrdersViewModel : ViewModel() {
    private val repository = Repository()

    private val _orders = MutableStateFlow<List<Order>>(emptyList())
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()

    private val _store = MutableStateFlow<Store?>(null)
    val store: StateFlow<Store?> = _store.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun refresh(storeId: String, silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) {
                _isLoading.value = true
            }

            repository.getOrders()
                .onSuccess { _orders.value = it }
                .onFailure { _message.value = it.message ?: "Failed to fetch merchant orders" }

            repository.getStore(storeId)
                .onSuccess { _store.value = it }
                .onFailure { _message.value = it.message ?: "Failed to fetch merchant store" }

            if (!silent) {
                _isLoading.value = false
            }
        }
    }

    fun updateOrderStatus(storeId: String, orderId: String, status: String) {
        viewModelScope.launch {
            repository.updateOrderStatus(orderId, status)
                .onSuccess { refresh(storeId, silent = true) }
                .onFailure { _message.value = it.message ?: "Failed to update order" }
        }
    }

    fun toggleStoreOpen(store: Store) {
        viewModelScope.launch {
            repository.updateStore(store.id, StoreUpdateRequest(isOpen = !store.isOpen))
                .onSuccess {
                    _store.value = it
                    _message.value = if (it.isOpen) {
                        "Store is now OPEN and visible for new orders."
                    } else {
                        "Store is now CLOSED for new orders."
                    }
                }
                .onFailure { _message.value = it.message ?: "Failed to update store status" }
        }
    }

    fun clearMessage() {
        _message.value = null
    }
}

private fun buildPerformance(orders: List<Order>): MerchantPerformance {
    val normalized = orders.map { it to normalizeMerchantOrderStatus(it.status) }
    val pending = normalized.count { it.second == "PENDING" }
    val cancelled = normalized.count { it.second == "CANCELLED" }
    val delivered = normalized.filter { it.second == "DELIVERED" }
    val active = normalized.count { it.second in setOf("PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY") }
    val acceptedCount = normalized.count { it.second != "PENDING" && it.second != "CANCELLED" }
    val decisions = acceptedCount + cancelled
    val acceptanceRate = if (decisions > 0) ((acceptedCount.toFloat() / decisions) * 100).toInt() else 0
    val nonCancelled = normalized.filter { it.second != "CANCELLED" }.map { it.first }
    val grossRevenue = nonCancelled.sumOf { it.total }
    val deliveredRevenue = delivered.sumOf { it.first.total }
    val averageOrderValue = if (nonCancelled.isNotEmpty()) grossRevenue / nonCancelled.size else 0.0
    val todayKey = java.time.LocalDate.now().toString()
    val todaysOrders = orders.count { (it.createdAt ?: "").startsWith(todayKey) }

    return MerchantPerformance(
        totalOrders = orders.size,
        todaysOrders = todaysOrders,
        pendingOrders = pending,
        activeOrders = active,
        cancelledOrders = cancelled,
        deliveredOrders = delivered.size,
        acceptanceRate = acceptanceRate,
        grossRevenue = grossRevenue,
        deliveredRevenue = deliveredRevenue,
        averageOrderValue = averageOrderValue
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MerchantOrdersScreen(
    user: User?,
    onProductsClick: () -> Unit,
    onProfileClick: () -> Unit,
    onLogout: () -> Unit,
    viewModel: MerchantOrdersViewModel = viewModel()
) {
    val storeId = user?.storeId
    val orders by viewModel.orders.collectAsState()
    val store by viewModel.store.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val message by viewModel.message.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val haptics = LocalHapticFeedback.current
    var knownOrderIds by remember { mutableStateOf(emptySet<String>()) }
    var alertOrderIds by remember { mutableStateOf(emptySet<String>()) }

    LaunchedEffect(storeId) {
        if (storeId != null) {
            viewModel.refresh(storeId)
        }
    }

    LaunchedEffect(storeId) {
        if (storeId != null) {
            while (true) {
                delay(10_000)
                viewModel.refresh(storeId, silent = true)
            }
        }
    }

    LaunchedEffect(orders) {
        val pendingIds = orders.filter { normalizeMerchantOrderStatus(it.status) == "PENDING" }.map { it.id }.toSet()
        if (knownOrderIds.isEmpty()) {
            knownOrderIds = orders.map { it.id }.toSet()
            alertOrderIds = pendingIds
        } else {
            val newlyPending = pendingIds - knownOrderIds
            if (newlyPending.isNotEmpty()) {
                alertOrderIds = alertOrderIds + newlyPending
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            }
            knownOrderIds = knownOrderIds + orders.map { it.id }
            alertOrderIds = alertOrderIds.intersect(pendingIds)
        }
    }

    LaunchedEffect(message) {
        if (!message.isNullOrBlank()) {
            snackbarHostState.showSnackbar(message!!)
            viewModel.clearMessage()
        }
    }

    if (storeId == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Merchant account is missing a store assignment.")
        }
        return
    }

    val performance = remember(orders) { buildPerformance(orders) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Merchant Orders", fontWeight = FontWeight.Bold)
                        Text(
                            text = store?.name ?: user.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = { MerchantLogoutAction(onLogout) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        bottomBar = {
            MerchantBottomBar(
                currentTab = MerchantTab.Orders,
                onOrdersClick = {},
                onProductsClick = onProductsClick,
                onProfileClick = onProfileClick
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { padding ->
        if (isLoading && orders.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Store availability", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text(
                                    text = if (store?.isOpen == false) "Closed to new orders" else "Accepting new orders",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Switch(
                                checked = store?.isOpen != false,
                                onCheckedChange = { currentOpen ->
                                    store?.let { currentStore ->
                                        if (currentOpen != currentStore.isOpen) {
                                            viewModel.toggleStoreOpen(currentStore)
                                        }
                                    }
                                }
                            )
                        }

                        if (alertOrderIds.isNotEmpty()) {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFFFFF1F2)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = Color(0xFFBE123C))
                                    Column {
                                        Text(
                                            text = "New order alert: ${alertOrderIds.size} pending",
                                            color = Color(0xFFBE123C),
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "Mobile alert stays visible until each order is accepted or declined.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF9F1239)
                                        )
                                    }
                                }
                            }
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MerchantMetricCard("Pending", performance.pendingOrders.toString(), Color(0xFFDC2626), Modifier.weight(1f))
                            MerchantMetricCard("Active", performance.activeOrders.toString(), Color(0xFF2563EB), Modifier.weight(1f))
                            MerchantMetricCard("Today", performance.todaysOrders.toString(), MaterialTheme.colorScheme.primary, Modifier.weight(1f))
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MerchantMetricCard("Acceptance", "${performance.acceptanceRate}%", MaterialTheme.colorScheme.primary, Modifier.weight(1f))
                            MerchantMetricCard("Average", formatKes(performance.averageOrderValue), Color(0xFF15803D), Modifier.weight(1f))
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AssistChip(
                                onClick = {},
                                label = { Text("Delivered ${performance.deliveredOrders}") },
                                leadingIcon = { Icon(Icons.Default.Storefront, contentDescription = null) },
                                colors = AssistChipDefaults.assistChipColors()
                            )
                            AssistChip(
                                onClick = {},
                                label = { Text("Cancelled ${performance.cancelledOrders}") },
                                leadingIcon = { Icon(Icons.Default.ToggleOff, contentDescription = null) },
                                colors = AssistChipDefaults.assistChipColors()
                            )
                            AssistChip(
                                onClick = {},
                                label = { Text("Gross ${formatKes(performance.grossRevenue)}") },
                                leadingIcon = { Icon(Icons.Default.ToggleOn, contentDescription = null) },
                                colors = AssistChipDefaults.assistChipColors()
                            )
                        }
                    }
                }
            }

            if (orders.isEmpty()) {
                item {
                    Card(shape = RoundedCornerShape(20.dp)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No orders yet. Keep the app open to receive new requests.")
                        }
                    }
                }
            }

            items(orders, key = { it.id }) { order ->
                val status = normalizeMerchantOrderStatus(order.status)
                Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Order ${order.orderNumber ?: order.id.take(8)}",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = order.createdAt?.replace("T", " ")?.take(16) ?: "Recent order",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = when (status) {
                                    "PENDING" -> MaterialTheme.colorScheme.secondaryContainer
                                    "PREPARING" -> Color(0xFFFFF7ED)
                                    "CANCELLED" -> Color(0xFFFFF1F2)
                                    else -> Color(0xFFF0FDF4)
                                }
                            ) {
                                Text(
                                    text = status,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = when (status) {
                                        "PREPARING" -> Color(0xFFB45309)
                                        "CANCELLED" -> Color(0xFFBE123C)
                                        "PENDING" -> MaterialTheme.colorScheme.onSecondaryContainer
                                        else -> Color(0xFF15803D)
                                    }
                                )
                            }
                        }

                        if (alertOrderIds.contains(order.id) && status == "PENDING") {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFFFF1F2), RoundedCornerShape(14.dp))
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = Color(0xFFBE123C))
                                Text(
                                    text = "New incoming order. Accept or decline to clear this alert.",
                                    color = Color(0xFFBE123C),
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Customer", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(order.customerInfo?.name ?: "Unknown customer", style = MaterialTheme.typography.bodyLarge)
                            Text(
                                text = order.deliveryAddress?.address ?: order.customerInfo?.address ?: "No delivery address",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Order Items", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            order.items.orEmpty().forEachIndexed { index, item ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("${item.quantity}x ${item.name ?: item.product?.name ?: "Item"}")
                                    Text(formatKes(item.price * item.quantity), fontWeight = FontWeight.SemiBold)
                                }
                                if (index < order.items.orEmpty().lastIndex) {
                                    Divider(modifier = Modifier.padding(top = 8.dp))
                                }
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(formatKes(order.total), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        }

                        when (status) {
                            "PENDING" -> {
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(
                                        onClick = {
                                            alertOrderIds = alertOrderIds - order.id
                                            viewModel.updateOrderStatus(storeId, order.id, "PREPARING")
                                        },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Accept & Prepare")
                                    }
                                    Button(
                                        onClick = {
                                            alertOrderIds = alertOrderIds - order.id
                                            viewModel.updateOrderStatus(storeId, order.id, "CANCELLED")
                                        },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Decline")
                                    }
                                }
                            }

                            "PREPARING" -> {
                                Button(
                                    onClick = { viewModel.updateOrderStatus(storeId, order.id, "READY_FOR_PICKUP") },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Mark Ready for Driver Pickup")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MerchantMetricCard(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = accent)
        }
    }
}