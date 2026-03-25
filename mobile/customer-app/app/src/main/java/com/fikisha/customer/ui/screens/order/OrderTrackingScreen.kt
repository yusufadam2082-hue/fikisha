package com.fikisha.customer.ui.screens.order

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fikisha.customer.data.model.Order
import com.fikisha.customer.data.repository.Repository
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class OrderTrackingViewModel : ViewModel() {
    private val repository = Repository()
    
    private val _order = MutableStateFlow<Order?>(null)
    val order: StateFlow<Order?> = _order.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _currentStep = MutableStateFlow(1)
    val currentStep: StateFlow<Int> = _currentStep.asStateFlow()

    private var pollingJob: Job? = null

    fun loadOrder(orderId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getOrder(orderId)
                .onSuccess { order ->
                    _order.value = order
                    _currentStep.value = getStepFromStatus(order.status)
                }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun startPolling(orderId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(10_000)
                loadOrder(orderId)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }

    private fun getStepFromStatus(status: String): Int {
        return when (status.uppercase()) {
            "PENDING", "CONFIRMED" -> 1
            "PREPARING" -> 2
            "READY_FOR_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ON_THE_WAY" -> 3
            "DELIVERED" -> 4
            else -> 1
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderTrackingScreen(
    orderId: String,
    viewModel: OrderTrackingViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onBackClick: () -> Unit,
    onOrdersClick: () -> Unit,
    onHomeClick: () -> Unit
) {
    val order by viewModel.order.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val currentStep by viewModel.currentStep.collectAsState()

    LaunchedEffect(orderId) {
        viewModel.loadOrder(orderId)
        viewModel.startPolling(orderId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Track Order") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        if (isLoading && order == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (order != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp)
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                "Order #${order!!.id.takeLast(6).uppercase()}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                order!!.store?.name ?: "Store",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "KSh ${order!!.total}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                getStatusText(order!!.status),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    if (currentStep == 4) "Order Delivered!" else "Estimated arrival: ${15 - currentStep * 3} mins",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                if (currentStep == 3 && !order!!.deliveryOtp.isNullOrBlank() && !order!!.deliveryOtpVerified) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer
                        )
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Delivery Handshake Code",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = order!!.deliveryOtp!!,
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = MaterialTheme.colorScheme.onTertiaryContainer,
                                letterSpacing = 4.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Share this 4-digit code with your courier at drop-off to complete delivery.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                        }
                    }
                }

                if (currentStep == 3 && order!!.deliveryOtpVerified) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Text(
                            text = "Code verified with courier. Delivery completion is now unlocked.",
                            modifier = Modifier.padding(16.dp),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                OrderStep(
                    step = 1,
                    title = "Order Confirmed",
                    description = "Store has received your order",
                    icon = Icons.Default.CheckCircle,
                    isActive = currentStep == 1,
                    isCompleted = currentStep > 1
                )
                
                OrderStep(
                    step = 2,
                    title = "Preparing",
                    description = "Your items are being prepared",
                    icon = Icons.Default.Restaurant,
                    isActive = currentStep == 2,
                    isCompleted = currentStep > 2
                )
                
                OrderStep(
                    step = 3,
                    title = "On the way",
                    description = "Driver is heading to your location",
                    icon = Icons.Default.LocalShipping,
                    isActive = currentStep == 3,
                    isCompleted = currentStep > 3
                )
                
                OrderStep(
                    step = 4,
                    title = "Delivered",
                    description = "Order arrived successfully",
                    icon = Icons.Default.Home,
                    isActive = currentStep == 4,
                    isCompleted = currentStep > 4
                )

                Spacer(modifier = Modifier.weight(1f))

                OutlinedButton(
                    onClick = onOrdersClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("View My Orders")
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (currentStep == 4) {
                    Button(
                        onClick = onHomeClick,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Back to Home")
                    }
                }
            }
        }
    }
}

@Composable
fun OrderStep(
    step: Int,
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isActive: Boolean,
    isCompleted: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = when {
                    isCompleted -> MaterialTheme.colorScheme.primary
                    isActive -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                },
                modifier = Modifier.size(32.dp)
            )
            if (step < 4) {
                Divider(
                    modifier = Modifier
                        .width(2.dp)
                        .height(24.dp),
                    color = if (isCompleted) MaterialTheme.colorScheme.primary 
                           else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        
        Column {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (isActive || isCompleted) MaterialTheme.colorScheme.onSurface 
                       else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun getStatusText(status: String): String {
    return when (status.uppercase()) {
        "PENDING" -> "Pending"
        "CONFIRMED" -> "Confirmed"
        "PREPARING" -> "Preparing"
        "READY_FOR_PICKUP" -> "Ready for Pickup"
        "IN_TRANSIT" -> "In Transit"
        "OUT_FOR_DELIVERY" -> "Out for Delivery"
        "ON_THE_WAY" -> "On the Way"
        "DELIVERED" -> "Delivered"
        else -> status
    }
}
