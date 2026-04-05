package com.fikisha.customer.ui.screens.cart

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.datastore.preferences.core.stringPreferencesKey
import org.json.JSONArray
import org.json.JSONObject

enum class PaymentMethod(val label: String, val value: String) {
    CASH("Cash on Delivery", "CASH"),
    MPESA("M-Pesa (STK Push)", "MPESA")
}

private fun normalizeMpesaPhone(input: String): String {
    val digits = input.filter { it.isDigit() }
    if (digits.isBlank()) return ""

    return when {
        digits.startsWith("254") -> digits.take(12)
        digits.startsWith("0") && digits.length >= 10 -> ("254" + digits.drop(1)).take(12)
        digits.startsWith("7") && digits.length >= 9 -> ("254" + digits).take(12)
        else -> digits.take(12)
    }
}

private fun isValidMpesaPhone(input: String): Boolean {
    val normalized = normalizeMpesaPhone(input)
    return normalized.matches(Regex("^2547\\d{8}$"))
}

private fun extractDefaultMpesaPhone(rawPaymentMethods: String): String? {
    if (rawPaymentMethods.isBlank()) return null

    return runCatching {
        val arr = JSONArray(rawPaymentMethods)
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val isDefault = obj.optBoolean("isDefault", false)
            val type = obj.optString("type")
            if (!isDefault || !type.equals("M-Pesa", ignoreCase = true)) continue

            val phone = obj.optString("phoneNumber").ifBlank { "" }
            val normalized = normalizeMpesaPhone(phone)
            if (isValidMpesaPhone(normalized)) return normalized
        }
        null
    }.getOrNull()
}

class CartViewModel : ViewModel() {
    private val repository = Repository()
    private val zoneErrorMessage = "Selected location is outside the store delivery zone. Choose another location."
    private val paymentMethodsStoreKey = stringPreferencesKey("profile_payment_methods")
    private val addressesStoreKey = stringPreferencesKey("profile_addresses")

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

    private val _defaultSavedAddressLabel = MutableStateFlow<String?>(null)
    val defaultSavedAddressLabel: StateFlow<String?> = _defaultSavedAddressLabel.asStateFlow()

    private val _selectedPaymentMethod = MutableStateFlow(PaymentMethod.CASH)
    val selectedPaymentMethod: StateFlow<PaymentMethod> = _selectedPaymentMethod.asStateFlow()

    private val _mpesaPhone = MutableStateFlow("")
    val mpesaPhone: StateFlow<String> = _mpesaPhone.asStateFlow()

    private val _paymentIntentId = MutableStateFlow<String?>(null)
    val paymentIntentId: StateFlow<String?> = _paymentIntentId.asStateFlow()

    fun updateSelectedPaymentMethod(method: PaymentMethod) {
        _selectedPaymentMethod.value = method
    }

    fun updateMpesaPhone(phone: String) {
        _mpesaPhone.value = normalizeMpesaPhone(phone)
    }

    init {
        viewModelScope.launch {
            try {
                val prefs = NetworkModule.dataStore.data.first()
                val user = SessionStore.deserializeUser(prefs[SessionStore.userKey])
                val location = LocationStore.getActiveLocation()
                val defaultProfileAddress = extractDefaultProfileAddress(prefs[addressesStoreKey].orEmpty())
                if (user != null) {
                    if (_customerName.value.isBlank()) _customerName.value = user.name
                    if (_customerPhone.value.isBlank()) _customerPhone.value = user.phone.orEmpty()
                    if (_mpesaPhone.value.isBlank()) {
                        _mpesaPhone.value = normalizeMpesaPhone(user.phone.orEmpty())
                    }
                }

                val storedMethods = prefs[paymentMethodsStoreKey].orEmpty()
                val defaultMpesa = extractDefaultMpesaPhone(storedMethods)
                if (!defaultMpesa.isNullOrBlank()) {
                    _mpesaPhone.value = defaultMpesa
                }

                if (_deliveryAddress.value.isBlank() && defaultProfileAddress != null) {
                    _deliveryAddress.value = defaultProfileAddress.address
                }

                if (defaultProfileAddress != null) {
                    _defaultSavedAddressLabel.value = defaultProfileAddress.label.ifBlank { "Default" }
                }

                if (location != null) {
                    _activeLocation.value = location
                    if (_deliveryAddress.value.isBlank()) {
                        _deliveryAddress.value = location.address
                    }
                } else if (defaultProfileAddress != null && defaultProfileAddress.latitude != null && defaultProfileAddress.longitude != null) {
                    val seeded = AppLocation(
                        id = "addr-${defaultProfileAddress.id}",
                        label = defaultProfileAddress.label.ifBlank { "Delivery Address" },
                        address = defaultProfileAddress.address,
                        latitude = defaultProfileAddress.latitude,
                        longitude = defaultProfileAddress.longitude,
                        source = "PROFILE_ADDRESS",
                        isSaved = true,
                        isDefault = true
                    )
                    _activeLocation.value = seeded
                    LocationStore.setActiveLocation(seeded)
                }
                refreshDeliveryQuote()
            } catch (_: Exception) { }
        }
    }

    fun useDefaultSavedAddress() {
        viewModelScope.launch {
            val prefs = NetworkModule.dataStore.data.first()
            val defaultAddress = extractDefaultProfileAddress(prefs[addressesStoreKey].orEmpty())
            if (defaultAddress == null) {
                _error.value = "No default saved address found"
                return@launch
            }

            _deliveryAddress.value = defaultAddress.address
            _defaultSavedAddressLabel.value = defaultAddress.label.ifBlank { "Default" }

            if (defaultAddress.latitude != null && defaultAddress.longitude != null) {
                val seeded = AppLocation(
                    id = "addr-${defaultAddress.id}",
                    label = defaultAddress.label.ifBlank { "Delivery Address" },
                    address = defaultAddress.address,
                    latitude = defaultAddress.latitude,
                    longitude = defaultAddress.longitude,
                    source = "PROFILE_ADDRESS",
                    isSaved = true,
                    isDefault = true
                )
                _activeLocation.value = seeded
                LocationStore.setActiveLocation(seeded)
                refreshDeliveryQuote()
            }

            _error.value = null
        }
    }

    private data class DefaultProfileAddress(
        val id: String,
        val label: String,
        val address: String,
        val latitude: Double?,
        val longitude: Double?
    )

    private fun extractDefaultProfileAddress(rawAddresses: String): DefaultProfileAddress? {
        if (rawAddresses.isBlank()) return null

        return runCatching {
            val arr = JSONArray(rawAddresses)
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                if (!obj.optBoolean("isDefault", false)) continue

                val full = obj.optString("fullAddress").ifBlank {
                    val street = obj.optString("street").ifBlank { "" }
                    val city = obj.optString("city").ifBlank { "" }
                    listOf(street, city).filter { it.isNotBlank() }.joinToString(", ")
                }

                return DefaultProfileAddress(
                    id = obj.optString("id"),
                    label = obj.optString("label"),
                    address = full,
                    latitude = obj.optNullableDouble("latitude"),
                    longitude = obj.optNullableDouble("longitude")
                )
            }
            null
        }.getOrNull()
    }

    private fun JSONObject.optNullableDouble(key: String): Double? {
        if (!has(key) || isNull(key)) return null
        return optDouble(key)
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
                    _error.value = zoneErrorMessage
                } else if (_error.value == zoneErrorMessage) {
                    _error.value = null
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

        if (_selectedPaymentMethod.value == PaymentMethod.MPESA && !isValidMpesaPhone(_mpesaPhone.value)) {
            _error.value = "Enter a valid M-Pesa number in format 2547XXXXXXXX"
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

            // For M-Pesa, create a payment intent first (STK push)
            if (_selectedPaymentMethod.value == PaymentMethod.MPESA) {
                val totalAmount = getTotal()
                val intentResult = repository.createPaymentIntent(
                    com.fikisha.customer.data.model.PaymentIntentRequest(
                        amount = totalAmount,
                        currency = "KES",
                        provider = "MPESA",
                        phoneNumber = _mpesaPhone.value.trim(),
                        description = "Order payment"
                    )
                )
                intentResult.onSuccess { resp ->
                    _paymentIntentId.value = resp.intent.id
                }.onFailure { e ->
                    _isLoading.value = false
                    _error.value = e.message ?: "Failed to initiate M-Pesa payment"
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
                notes = _orderNotes.value.takeIf { it.isNotBlank() },
                paymentMethod = _selectedPaymentMethod.value.value
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
    onOrderPlaced: (String, String?) -> Unit
) {
    val cartItems by viewModel.cartItems.collectAsState()
    val deliveryAddress by viewModel.deliveryAddress.collectAsState()
    val customerName by viewModel.customerName.collectAsState()
    val customerPhone by viewModel.customerPhone.collectAsState()
    val orderNotes by viewModel.orderNotes.collectAsState()
    val selectedPaymentMethod by viewModel.selectedPaymentMethod.collectAsState()
    val mpesaPhone by viewModel.mpesaPhone.collectAsState()
    val paymentIntentId by viewModel.paymentIntentId.collectAsState()
    val activeLocation by viewModel.activeLocation.collectAsState()
    val defaultSavedAddressLabel by viewModel.defaultSavedAddressLabel.collectAsState()
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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
                        HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
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
                            onClick = { viewModel.placeOrder { orderId -> onOrderPlaced(orderId, paymentIntentId) } },
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
                    if (!defaultSavedAddressLabel.isNullOrBlank()) {
                        TextButton(
                            onClick = { viewModel.useDefaultSavedAddress() },
                            modifier = Modifier.padding(top = 2.dp)
                        ) {
                            Text("Use Default (${defaultSavedAddressLabel})")
                        }
                    }
                    if (activeLocation?.source == "PROFILE_ADDRESS") {
                        Spacer(modifier = Modifier.height(6.dp))
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f)
                        ) {
                            Text(
                                text = "Using saved address: ${activeLocation?.label.orEmpty()}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
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
                        "Payment Method",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PaymentMethod.values().forEach { method ->
                            ElevatedCard(
                                onClick = { viewModel.updateSelectedPaymentMethod(method) },
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.elevatedCardColors(
                                    containerColor = if (selectedPaymentMethod == method)
                                        MaterialTheme.colorScheme.primaryContainer
                                    else
                                        MaterialTheme.colorScheme.surface
                                )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        method.label,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = if (selectedPaymentMethod == method) FontWeight.Bold else FontWeight.Medium
                                    )
                                    RadioButton(
                                        selected = selectedPaymentMethod == method,
                                        onClick = { viewModel.updateSelectedPaymentMethod(method) }
                                    )
                                }
                            }
                        }

                        if (selectedPaymentMethod == PaymentMethod.MPESA) {
                            OutlinedTextField(
                                value = mpesaPhone,
                                onValueChange = { viewModel.updateMpesaPhone(it) },
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = { Text("M-Pesa phone (2547XXXXXXXX)") },
                                leadingIcon = { Icon(Icons.Default.PhoneAndroid, contentDescription = null) },
                                singleLine = true
                            )
                            Text(
                                "We auto-format to 2547XXXXXXXX and send STK push to this number.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
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
