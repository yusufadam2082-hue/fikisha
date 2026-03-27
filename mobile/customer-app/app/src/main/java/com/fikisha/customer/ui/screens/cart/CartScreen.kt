package com.fikisha.customer.ui.screens.cart

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.location.LocationStore
import com.fikisha.customer.data.model.AppLocation
import com.fikisha.customer.data.model.CartItem
import com.fikisha.customer.data.model.DeliveryQuote
import com.fikisha.customer.data.repository.CartStore
import com.fikisha.customer.data.repository.Repository
import com.fikisha.customer.data.session.SessionStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import androidx.datastore.preferences.core.edit

class CartViewModel : ViewModel() {
    private val repository = Repository()

    val cartItems: StateFlow<List<CartItem>> = CartStore.items
    
    private val _deliveryAddress = MutableStateFlow("")
    val deliveryAddress: StateFlow<String> = _deliveryAddress.asStateFlow()
    
    private val _customerName = MutableStateFlow("")
    val customerName: StateFlow<String> = _customerName.asStateFlow()
    
    private val _customerPhone = MutableStateFlow("")
    val customerPhone: StateFlow<String> = _customerPhone.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _orderId = MutableStateFlow<String?>(null)
    val orderId: StateFlow<String?> = _orderId.asStateFlow()

    private val _orderNotes = MutableStateFlow("")
    val orderNotes: StateFlow<String> = _orderNotes.asStateFlow()

    private val _activeLocation = MutableStateFlow<AppLocation?>(null)
    val activeLocation: StateFlow<AppLocation?> = _activeLocation.asStateFlow()

    private val _deliveryQuote = MutableStateFlow<DeliveryQuote?>(null)
    val deliveryQuote: StateFlow<DeliveryQuote?> = _deliveryQuote.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                val prefs = NetworkModule.dataStore.data.first()
                val user = SessionStore.deserializeUser(prefs[SessionStore.userKey])
                val location = LocationStore.getActiveLocation()
                if (user != null) {
                    if (_customerName.value.isBlank()) _customerName.value = user.name
                    if (_customerPhone.value.isBlank()) _customerPhone.value = user.phone.orEmpty()
                }
                if (location != null) {
                    _activeLocation.value = location
                    if (_deliveryAddress.value.isBlank()) {
                        _deliveryAddress.value = location.address
                    }
                }
                refreshDeliveryQuote()
            } catch (_: Exception) { }
        }
    }

    fun updateDeliveryAddress(address: String) {
        _deliveryAddress.value = address
    }

    fun updateCustomerName(name: String) {
        _customerName.value = name
    }

    fun updateCustomerPhone(phone: String) {
        _customerPhone.value = phone
    }

    fun updateOrderNotes(notes: String) {
        _orderNotes.value = notes
    }

    fun updateQuantity(itemId: String, newQuantity: Int) {
        CartStore.updateQuantity(itemId, newQuantity)
        refreshDeliveryQuote()
    }

    fun getSubtotal(): Double {
        return cartItems.value.sumOf { it.price * it.quantity }
    }

    fun getDeliveryFee(): Double {
        if (cartItems.value.isEmpty()) return 0.0
        return _deliveryQuote.value?.deliveryFee ?: 2.99
    }

    fun getTotal(): Double {
        return getSubtotal() + getDeliveryFee()
    }

    fun refreshDeliveryQuote() {
        val location = _activeLocation.value ?: return
        val storeId = cartItems.value.firstOrNull()?.storeId ?: return

        viewModelScope.launch {
            repository.getDeliveryQuote(
                storeId = storeId,
                latitude = location.latitude,
                longitude = location.longitude,
                orderTotal = getSubtotal()
            ).onSuccess { quote ->
                _deliveryQuote.value = quote
                if (!quote.serviceable) {
                    _error.value = "Selected location is outside the store delivery zone. Choose another location."
                }
            }.onFailure { _deliveryQuote.value = null }
        }
    }

    fun placeOrder(onSuccess: (String) -> Unit) {
        if (!NetworkModule.hasAuthToken()) {
            _error.value = "Please sign in with a customer account to place an order"
            return
        }

        if (cartItems.value.isEmpty()) {
            _error.value = "Cart is empty"
            return
        }
        
        val location = _activeLocation.value
        if (location == null) {
            _error.value = "Please choose a delivery location first"
            return
        }

        if (_deliveryAddress.value.isBlank()) {
            _deliveryAddress.value = location.address
        }
        
        if (_customerName.value.isBlank() || _customerPhone.value.isBlank()) {
            _error.value = "Please enter your name and phone"
            return
        }

        val storeId = cartItems.value.firstOrNull()?.storeId ?: return

        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            val quote = repository.getDeliveryQuote(
                storeId = storeId,
                latitude = location.latitude,
                longitude = location.longitude,
                orderTotal = getSubtotal()
            ).getOrNull()
            if (quote != null) {
                _deliveryQuote.value = quote
                if (!quote.serviceable) {
                    _isLoading.value = false
                    _error.value = "Store does not deliver to selected location"
                    return@launch
                }

                if (!quote.orderValueValid) {
                    _isLoading.value = false
                    _error.value = "Order value does not meet zone minimum"
                    return@launch
                }
            }
            
            repository.createOrder(
                storeId = storeId,
                items = cartItems.value,
                deliveryAddress = _deliveryAddress.value,
                customerName = _customerName.value,
                customerPhone = _customerPhone.value,
                latitude = location.latitude,
                longitude = location.longitude,
                locationSource = location.source,
                notes = _orderNotes.value.takeIf { it.isNotBlank() }
            ).onSuccess { order ->
                _orderId.value = order.id
                CartStore.clear()
                onSuccess(order.id)
            }.onFailure { e ->
                val rawMessage = e.message ?: "Failed to place order"
                val lower = rawMessage.lowercase()
                val authFailure = lower.contains("token")
                    || lower.contains("unauthorized")
                    || lower.contains("access denied")
                    || lower.contains("invalid credentials")

                if (authFailure) {
                    clearSessionForReLogin()
                    _error.value = "Session expired. Please sign in again as customer."
                } else {
                    _error.value = rawMessage
                }
            }
            
            _isLoading.value = false
        }
    }

    private suspend fun clearSessionForReLogin() {
        try {
            NetworkModule.dataStore.edit { prefs ->
                prefs.remove(SessionStore.tokenKey)
                prefs.remove(SessionStore.userKey)
                prefs.remove(SessionStore.rememberMeKey)
            }
        } catch (_: Exception) { }

        NetworkModule.setAuthToken(null)
    }

    fun clearError() {
        _error.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    viewModel: CartViewModel = viewModel(),
    onBackClick: () -> Unit,
    onOrderPlaced: (String) -> Unit
) {
    val cartItems by viewModel.cartItems.collectAsState()
    val deliveryAddress by viewModel.deliveryAddress.collectAsState()
    val customerName by viewModel.customerName.collectAsState()
    val customerPhone by viewModel.customerPhone.collectAsState()
    val orderNotes by viewModel.orderNotes.collectAsState()
    val activeLocation by viewModel.activeLocation.collectAsState()
    val deliveryQuote by viewModel.deliveryQuote.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val subtotal = viewModel.getSubtotal()
    val deliveryFee = viewModel.getDeliveryFee()
    val total = viewModel.getTotal()

    LaunchedEffect(cartItems, activeLocation) {
        viewModel.refreshDeliveryQuote()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Your Cart", fontWeight = FontWeight.Bold)
                        Text(
                            text = "${cartItems.size} item${if (cartItems.size == 1) "" else "s"} ready for checkout",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        bottomBar = {
            if (cartItems.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Subtotal", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("KSh ${String.format("%.2f", subtotal)}")
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Delivery Fee", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("KSh ${String.format("%.2f", deliveryFee)}")
                        }
                        if (deliveryQuote?.etaMinutes != null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("ETA", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("${deliveryQuote?.etaMinMinutes}-${deliveryQuote?.etaMaxMinutes} min")
                            }
                        }
                        Divider(modifier = Modifier.padding(vertical = 2.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Total",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                "KSh ${String.format("%.2f", total)}",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Button(
                            onClick = { viewModel.placeOrder(onOrderPlaced) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            enabled = !isLoading
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(24.dp),
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                            } else {
                                Icon(Icons.Default.ShoppingBag, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Place Order")
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        if (cartItems.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(horizontal = 24.dp)
                ) {
                    Icon(
                        Icons.Default.ShoppingCart,
                        contentDescription = null,
                        modifier = Modifier.size(72.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                    Text(
                        "Your cart is empty",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "Add items from a store to start checkout.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "Checkout",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "Review details and place your order",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)
                            ) {
                                Icon(
                                    Icons.Default.LocalShipping,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier
                                        .padding(9.dp)
                                        .size(18.dp)
                                )
                            }
                        }
                    }
                }

                item {
                    Text(
                        "Delivery Address",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = deliveryAddress,
                        onValueChange = { viewModel.updateDeliveryAddress(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Enter your delivery address") },
                        leadingIcon = { Icon(Icons.Default.LocationOn, contentDescription = null) }
                    )
                }

                item {
                    Text(
                        "Contact Details",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = customerName,
                        onValueChange = { viewModel.updateCustomerName(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Your name") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = customerPhone,
                        onValueChange = { viewModel.updateCustomerPhone(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Your phone number") },
                        leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = orderNotes,
                        onValueChange = { viewModel.updateOrderNotes(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Special instructions (optional)") },
                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                        maxLines = 3,
                        minLines = 1
                    )
                }

                item {
                    Text(
                        "Order Items",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                items(cartItems) { item ->
                    CartItemCard(
                        item = item,
                        onQuantityChange = { viewModel.updateQuantity(item.id, it) }
                    )
                }

                if (error != null) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = error!!,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(100.dp))
                }
            }
        }
    }
}

@Composable
fun CartItemCard(
    item: CartItem,
    onQuantityChange: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = item.image,
                contentDescription = item.name,
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(10.dp)),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "KSh ${item.price}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }

            Surface(
                shape = RoundedCornerShape(999.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    IconButton(
                        onClick = { onQuantityChange(item.quantity - 1) },
                        modifier = Modifier.size(30.dp)
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = "Decrease")
                    }
                    Text(
                        text = item.quantity.toString(),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(
                        onClick = { onQuantityChange(item.quantity + 1) },
                        modifier = Modifier.size(30.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Increase")
                    }
                }
            }
        }
    }
}
