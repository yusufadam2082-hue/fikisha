package com.fikisha.customer.ui.screens.orders

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.fikisha.customer.data.model.Order
import com.fikisha.customer.data.model.CartItem
import com.fikisha.customer.data.repository.CartStore
import com.fikisha.customer.data.repository.Repository
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private val ACTIVE_STATUSES = setOf(
    "PENDING", "CONFIRMED", "PREPARING",
    "READY_FOR_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ON_THE_WAY"
)

class OrdersViewModel : ViewModel() {
    private val repository = Repository()

    private val _orders = MutableStateFlow<List<Order>>(emptyList())
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun loadOrders() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getCustomerOrders()
                .onSuccess { _orders.value = it }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun reorder(order: Order) {
        CartStore.clear()
        order.items?.forEach { item ->
            val productId = item.productId ?: item.id ?: return@forEach
            if (productId.isBlank()) return@forEach
            CartStore.addItem(
                CartItem(
                    id = productId,
                    name = item.product?.name ?: item.name ?: "Item",
                    price = item.price,
                    quantity = item.quantity,
                    image = item.product?.image ?: "",
                    storeId = order.storeId
                )
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterialApi::class)
@Composable
fun OrdersScreen(
    viewModel: OrdersViewModel = viewModel(),
    onHomeClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onOrderClick: (String) -> Unit,
    onReceiptClick: (String) -> Unit,
    onCartClick: () -> Unit = {}
) {
    val orders by viewModel.orders.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = isLoading,
        onRefresh = { viewModel.loadOrders() }
    )

    val activeOrders = remember(orders) { orders.filter { it.status.uppercase() in ACTIVE_STATUSES } }
    val historyOrders = remember(orders) { orders.filter { it.status.uppercase() !in ACTIVE_STATUSES } }

    LaunchedEffect(Unit) { viewModel.loadOrders() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("My Orders", fontWeight = FontWeight.Bold)
                        Text(
                            "Track & review your orders",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                ),
                actions = {
                    IconButton(onClick = { viewModel.loadOrders() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = MaterialTheme.colorScheme.primary)
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 0.dp
            ) {
                val itemColors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home") },
                    selected = false,
                    onClick = onHomeClick,
                    colors = itemColors
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Receipt, contentDescription = "Orders") },
                    label = { Text("Orders") },
                    selected = true,
                    onClick = {},
                    colors = itemColors
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Person, contentDescription = "Profile") },
                    label = { Text("Profile") },
                    selected = false,
                    onClick = onProfileClick,
                    colors = itemColors
                )
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .pullRefresh(pullRefreshState)
        ) {
        if (orders.isEmpty() && !isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        Icons.Default.Receipt,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                    )
                    Text("No orders yet", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Place your first order to see it here", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (!error.isNullOrBlank()) {
                        TextButton(onClick = { viewModel.loadOrders() }) { Text("Retry") }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Active orders section
                if (activeOrders.isNotEmpty()) {
                    item {
                        SectionHeader(title = "Active", color = MaterialTheme.colorScheme.primary)
                    }
                    items(activeOrders) { order ->
                        OrderCard(order = order, isActive = true, onClick = { onOrderClick(order.id) })
                    }
                    if (historyOrders.isNotEmpty()) {
                        item { Spacer(modifier = Modifier.height(4.dp)) }
                    }
                }
                // History section
                if (historyOrders.isNotEmpty()) {
                    item {
                        SectionHeader(title = "Order History", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    items(historyOrders) { order ->
                        OrderCard(
                            order = order,
                            isActive = false,
                            onClick = { onReceiptClick(order.id) },
                            onReorder = if (order.status.uppercase() == "DELIVERED") {{
                                viewModel.reorder(order)
                                onCartClick()
                            }} else null
                        )
                    }
                }
            }
        }
        PullRefreshIndicator(
            refreshing = isLoading,
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter)
        )
        }
    }
}

@Composable
private fun SectionHeader(title: String, color: androidx.compose.ui.graphics.Color) {
    Text(
        title,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier.padding(bottom = 2.dp)
    )
}

@Composable
private fun OrderCard(order: Order, isActive: Boolean, onClick: () -> Unit, onReorder: (() -> Unit)? = null) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isActive)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f)
            else
                MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isActive) 0.dp else 1.dp),
        border = if (isActive) BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)) else null
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        order.orderNumber ?: "#${order.id.takeLast(6).uppercase()}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        order.store?.name ?: "Store",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                StatusChip(status = order.status)
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 10.dp),
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "${order.items?.size ?: 0} item${if ((order.items?.size ?: 0) != 1) "s" else ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        order.createdAt?.take(10) ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "KSh ${String.format("%.2f", order.total)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Icon(
                        if (isActive) Icons.Default.ChevronRight else Icons.Default.Receipt,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (onReorder != null) {
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 8.dp),
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                )
                TextButton(
                    onClick = onReorder,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Reorder", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}

@Composable
fun StatusChip(status: String) {
    val (backgroundColor, textColor) = when (status.uppercase()) {
        "PENDING" -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        "CONFIRMED", "PREPARING" -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        "IN_TRANSIT", "OUT_FOR_DELIVERY", "ON_THE_WAY", "READY_FOR_PICKUP" -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
        "DELIVERED" -> MaterialTheme.colorScheme.primary to MaterialTheme.colorScheme.onPrimary
        "CANCELLED" -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(color = backgroundColor, shape = RoundedCornerShape(20.dp)) {
        Text(
            text = status.replace("_", " "),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Medium
        )
    }
}

