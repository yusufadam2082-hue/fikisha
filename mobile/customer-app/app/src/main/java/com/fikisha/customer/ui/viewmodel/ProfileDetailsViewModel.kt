package com.fikisha.customer.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.model.Address
import com.fikisha.customer.data.model.NotificationPreferences
import com.fikisha.customer.data.model.PaymentMethod
import com.fikisha.customer.data.model.ProfileUpdateRequest
import com.fikisha.customer.data.model.User
import com.fikisha.customer.data.model.AppLocation
import com.fikisha.customer.data.location.LocationStore
import com.fikisha.customer.data.repository.Repository
import com.fikisha.customer.data.session.SessionStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import org.json.JSONArray
import org.json.JSONObject

class ProfileDetailsViewModel : ViewModel() {
    private val repository = Repository()
    private val paymentMethodsStoreKey = stringPreferencesKey("profile_payment_methods")
    private val profileAvatarStoreKey = stringPreferencesKey("profile_avatar_uri")
    private val addressesStoreKey = stringPreferencesKey("profile_addresses")
    
    // Edit Profile State
    private val _profileName = MutableStateFlow("")
    val profileName: StateFlow<String> = _profileName.asStateFlow()
    
    private val _profilePhone = MutableStateFlow("")
    val profilePhone: StateFlow<String> = _profilePhone.asStateFlow()
    
    private val _profileEmail = MutableStateFlow("")
    val profileEmail: StateFlow<String> = _profileEmail.asStateFlow()

    private val _profileUsername = MutableStateFlow("")
    val profileUsername: StateFlow<String> = _profileUsername.asStateFlow()

    private val _profilePassword = MutableStateFlow("")
    val profilePassword: StateFlow<String> = _profilePassword.asStateFlow()

    private val _profilePasswordConfirm = MutableStateFlow("")
    val profilePasswordConfirm: StateFlow<String> = _profilePasswordConfirm.asStateFlow()

    private val _profileAvatarUri = MutableStateFlow<String?>(null)
    val profileAvatarUri: StateFlow<String?> = _profileAvatarUri.asStateFlow()
    
    // Addresses State
    private val _addresses = MutableStateFlow<List<Address>>(emptyList())
    val addresses: StateFlow<List<Address>> = _addresses.asStateFlow()
    
    private val _newAddressLabel = MutableStateFlow("")
    val newAddressLabel: StateFlow<String> = _newAddressLabel.asStateFlow()
    
    private val _newAddressStreet = MutableStateFlow("")
    val newAddressStreet: StateFlow<String> = _newAddressStreet.asStateFlow()
    
    private val _newAddressCity = MutableStateFlow("")
    val newAddressCity: StateFlow<String> = _newAddressCity.asStateFlow()

    private val _editingAddressId = MutableStateFlow<String?>(null)
    val editingAddressId: StateFlow<String?> = _editingAddressId.asStateFlow()

    private val _locationCandidates = MutableStateFlow<List<AppLocation>>(emptyList())
    val locationCandidates: StateFlow<List<AppLocation>> = _locationCandidates.asStateFlow()
    
    // Payment Methods State
    private val _paymentMethods = MutableStateFlow<List<PaymentMethod>>(emptyList())
    val paymentMethods: StateFlow<List<PaymentMethod>> = _paymentMethods.asStateFlow()
    
    private val _newPaymentType = MutableStateFlow("Visa")
    val newPaymentType: StateFlow<String> = _newPaymentType.asStateFlow()
    
    private val _newPaymentCardNumber = MutableStateFlow("")
    val newPaymentCardNumber: StateFlow<String> = _newPaymentCardNumber.asStateFlow()
    
    private val _newPaymentExpiry = MutableStateFlow("")
    val newPaymentExpiry: StateFlow<String> = _newPaymentExpiry.asStateFlow()
    
    private val _newPaymentCardholder = MutableStateFlow("")
    val newPaymentCardholder: StateFlow<String> = _newPaymentCardholder.asStateFlow()

    private val _newPaymentPhone = MutableStateFlow("")
    val newPaymentPhone: StateFlow<String> = _newPaymentPhone.asStateFlow()
    
    // Notification Preferences State
    private val _notificationPrefs = MutableStateFlow(NotificationPreferences())
    val notificationPrefs: StateFlow<NotificationPreferences> = _notificationPrefs.asStateFlow()
    
    // Loading and error states
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()
    
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()
    
    fun loadProfileData() {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                
                // Load from DataStore
                val preferences = NetworkModule.dataStore.data.first()
                val user = SessionStore.deserializeUser(preferences[SessionStore.userKey])
                if (user != null) {
                    _profileName.value = user.name
                    _profilePhone.value = user.phone.orEmpty()
                    _profileEmail.value = user.email.orEmpty()
                    _profileUsername.value = user.username
                }

                _profileAvatarUri.value = preferences[profileAvatarStoreKey]
                
                // Load addresses from shared preferences or local storage
                loadAddressesFromStorage()
                loadLocationCandidates()
                
                // Load payment methods from shared preferences
                loadPaymentMethodsFromStorage()
                
                // Load notification preferences
                loadNotificationPreferences()
                
                _isLoading.value = false
            } catch (e: Exception) {
                _errorMessage.value = e.message
                _isLoading.value = false
            }
        }
    }
    
    fun updateProfile(@Suppress("UNUSED_PARAMETER") context: Context) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                
                val request = ProfileUpdateRequest(
                    name = _profileName.value,
                    email = _profileEmail.value.ifBlank { null },
                    phone = _profilePhone.value.ifBlank { null },
                    username = _profileUsername.value.ifBlank { null },
                    password = _profilePassword.value.ifBlank { null }
                )

                if (_profileName.value.isBlank()) {
                    _errorMessage.value = "Full name is required"
                    _isLoading.value = false
                    return@launch
                }

                if (_profileUsername.value.isBlank()) {
                    _errorMessage.value = "Username is required"
                    _isLoading.value = false
                    return@launch
                }

                if (_profilePassword.value.isNotBlank() && _profilePassword.value.length < 6) {
                    _errorMessage.value = "Password must be at least 6 characters"
                    _isLoading.value = false
                    return@launch
                }

                if (_profilePassword.value != _profilePasswordConfirm.value) {
                    _errorMessage.value = "Passwords do not match"
                    _isLoading.value = false
                    return@launch
                }
                
                val response = repository.updateProfile(request)
                if (response.isSuccess) {
                    _successMessage.value = "Profile updated successfully"
                    
                    // Update DataStore with new name
                    val dataStore = NetworkModule.dataStore
                    dataStore.edit { preferences ->
                        val currentUser = SessionStore.deserializeUser(preferences[SessionStore.userKey])
                        if (currentUser != null) {
                            preferences[SessionStore.userKey] = SessionStore.serializeUser(
                                currentUser.copy(
                                    name = _profileName.value,
                                    username = _profileUsername.value,
                                    phone = _profilePhone.value.ifBlank { null },
                                    email = _profileEmail.value.ifBlank { null }
                                )
                            )
                        }

                        if (_profileAvatarUri.value.isNullOrBlank()) {
                            preferences.remove(profileAvatarStoreKey)
                        } else {
                            preferences[profileAvatarStoreKey] = _profileAvatarUri.value!!
                        }
                    }

                    _profilePassword.value = ""
                    _profilePasswordConfirm.value = ""
                } else {
                    _errorMessage.value = response.exceptionOrNull()?.message ?: "Failed to update profile"
                }
                _isLoading.value = false
            } catch (e: Exception) {
                _errorMessage.value = e.message
                _isLoading.value = false
            }
        }
    }
    
    fun addAddress() {
        val label = _newAddressLabel.value.ifBlank { return }
        val street = _newAddressStreet.value.ifBlank { return }
        val city = _newAddressCity.value.ifBlank { return }

        val editId = _editingAddressId.value
        if (editId != null) {
            _addresses.value = _addresses.value.map {
                if (it.id == editId) {
                    it.copy(
                        label = label,
                        street = street,
                        city = city,
                        fullAddress = "$street, $city"
                    )
                } else {
                    it
                }
            }
            _editingAddressId.value = null
            _successMessage.value = "Address updated"
        } else {
            val newAddress = Address(
                id = System.currentTimeMillis().toString(),
                label = label,
                street = street,
                city = city,
                fullAddress = "$street, $city",
                isDefault = _addresses.value.isEmpty()
            )
            _addresses.value = _addresses.value + newAddress
            _successMessage.value = "Address added successfully"
        }

        saveAddressesToStorage()

        // Clear new address fields
        _newAddressLabel.value = ""
        _newAddressStreet.value = ""
        _newAddressCity.value = ""
    }

    fun editAddress(address: Address) {
        _editingAddressId.value = address.id
        _newAddressLabel.value = address.label
        _newAddressStreet.value = address.street
        _newAddressCity.value = address.city
    }

    fun cancelEditAddress() {
        _editingAddressId.value = null
        _newAddressLabel.value = ""
        _newAddressStreet.value = ""
        _newAddressCity.value = ""
    }
    
    fun removeAddress(address: Address) {
        val remaining = _addresses.value.filter { it.id != address.id }
        _addresses.value = if (remaining.none { it.isDefault } && remaining.isNotEmpty()) {
            val first = remaining.first()
            remaining.map { if (it.id == first.id) it.copy(isDefault = true) else it }
        } else {
            remaining
        }
        saveAddressesToStorage()
        _successMessage.value = "Address removed"
    }
    
    fun setDefaultAddress(address: Address) {
        _addresses.value = _addresses.value.map {
            if (it.id == address.id) it.copy(isDefault = true)
            else it.copy(isDefault = false)
        }
        saveAddressesToStorage()
        _successMessage.value = "Default address updated"
    }

    fun addFromLocationCandidate(location: AppLocation, labelOverride: String? = null) {
        val label = labelOverride?.ifBlank { null } ?: location.label.ifBlank { "Saved place" }
        val street = location.address.substringBefore(',').ifBlank { location.address }
        val city = location.address.substringAfter(',').trim().ifBlank { "City" }

        val existingIndex = _addresses.value.indexOfFirst {
            it.fullAddress.equals(location.address, ignoreCase = true)
        }

        val mapped = Address(
            id = if (existingIndex >= 0) _addresses.value[existingIndex].id else System.currentTimeMillis().toString(),
            label = label,
            street = street,
            city = city,
            fullAddress = location.address,
            latitude = location.latitude,
            longitude = location.longitude,
            isDefault = if (existingIndex >= 0) _addresses.value[existingIndex].isDefault else _addresses.value.isEmpty()
        )

        _addresses.value = if (existingIndex >= 0) {
            _addresses.value.toMutableList().also { it[existingIndex] = mapped }
        } else {
            listOf(mapped) + _addresses.value
        }

        saveAddressesToStorage()
        _successMessage.value = "Address imported from location"
    }

    fun useAddressForOrders(address: Address) {
        val lat = address.latitude
        val lng = address.longitude
        if (lat == null || lng == null) {
            _errorMessage.value = "This address has no map pin yet. Import it from Quick Add or set location first."
            return
        }

        val full = address.fullAddress ?: "${address.street}, ${address.city}"
        val location = AppLocation(
            id = "addr-${address.id}",
            label = address.label.ifBlank { "Delivery Address" },
            address = full,
            latitude = lat,
            longitude = lng,
            source = "PROFILE_ADDRESS",
            isSaved = true,
            isDefault = address.isDefault
        )

        viewModelScope.launch {
            LocationStore.setActiveLocation(location)
            LocationStore.saveLocation(location)
            _successMessage.value = "Address selected for checkout"
        }
    }
    
    fun addPaymentMethod() {
        val type = _newPaymentType.value
        val isMpesa = type.equals("M-Pesa", ignoreCase = true)

        val newPayment = if (isMpesa) {
            val normalizedPhone = normalizeMpesaPhone(_newPaymentPhone.value)
            if (!normalizedPhone.matches(Regex("^2547\\d{8}$"))) {
                _errorMessage.value = "Enter a valid M-Pesa number in format 2547XXXXXXXX"
                return
            }

            PaymentMethod(
                id = System.currentTimeMillis().toString(),
                type = "M-Pesa",
                last4 = normalizedPhone.takeLast(4),
                expiry = "",
                cardholderName = _profileName.value.ifBlank { "M-Pesa" },
                phoneNumber = normalizedPhone,
                isDefault = _paymentMethods.value.isEmpty()
            )
        } else {
            val cardNumber = _newPaymentCardNumber.value.replace(" ", "").ifBlank { return }
            val expiry = _newPaymentExpiry.value.ifBlank { return }
            val cardholder = _newPaymentCardholder.value.ifBlank { return }

            if (cardNumber.length < 4 || !expiry.matches(Regex("\\d{2}/\\d{2}"))) {
                _errorMessage.value = "Invalid card number or expiry date"
                return
            }

            PaymentMethod(
                id = System.currentTimeMillis().toString(),
                type = type,
                last4 = cardNumber.takeLast(4),
                expiry = expiry,
                cardholderName = cardholder,
                phoneNumber = null,
                isDefault = _paymentMethods.value.isEmpty()
            )
        }
        
        _paymentMethods.value = _paymentMethods.value + newPayment
        savePaymentMethodsToStorage()
        
        // Clear new payment fields
        _newPaymentType.value = "Visa"
        _newPaymentCardNumber.value = ""
        _newPaymentExpiry.value = ""
        _newPaymentCardholder.value = ""
        _newPaymentPhone.value = ""
        
        _successMessage.value = "Payment method added"
    }
    
    fun removePaymentMethod(method: PaymentMethod) {
        _paymentMethods.value = _paymentMethods.value.filter { it.id != method.id }
        savePaymentMethodsToStorage()
        _successMessage.value = "Payment method removed"
    }
    
    fun setDefaultPaymentMethod(method: PaymentMethod) {
        _paymentMethods.value = _paymentMethods.value.map {
            if (it.id == method.id) it.copy(isDefault = true)
            else it.copy(isDefault = false)
        }
        savePaymentMethodsToStorage()
        _successMessage.value = "Default payment method updated"
    }
    
    fun updateNotificationPreference(preference: NotificationPreferences) {
        _notificationPrefs.value = preference
        saveNotificationPreferences()
        _successMessage.value = "Notification preferences saved"
    }
    
    fun updateProfileName(name: String) {
        _profileName.value = name
    }
    
    fun updateProfilePhone(phone: String) {
        _profilePhone.value = phone
    }
    
    fun updateProfileEmail(email: String) {
        _profileEmail.value = email
    }

    fun updateProfileUsername(username: String) {
        _profileUsername.value = username
    }

    fun updateProfilePassword(password: String) {
        _profilePassword.value = password
    }

    fun updateProfilePasswordConfirm(confirm: String) {
        _profilePasswordConfirm.value = confirm
    }

    fun updateProfileAvatarUri(uri: String?) {
        _profileAvatarUri.value = uri
    }
    
    fun updateNewAddressLabel(label: String) {
        _newAddressLabel.value = label
    }
    
    fun updateNewAddressStreet(street: String) {
        _newAddressStreet.value = street
    }
    
    fun updateNewAddressCity(city: String) {
        _newAddressCity.value = city
    }
    
    fun updateNewPaymentType(type: String) {
        _newPaymentType.value = type
    }
    
    fun updateNewPaymentCardNumber(cardNumber: String) {
        // Format card number as user types (add spaces every 4 digits)
        val cleaned = cardNumber.replace(" ", "").take(16)
        val formatted = cleaned.chunked(4).joinToString(" ")
        _newPaymentCardNumber.value = formatted
    }
    
    fun updateNewPaymentExpiry(expiry: String) {
        // Auto-format MM/YY
        val cleaned = expiry.replace("/", "").take(4)
        if (cleaned.length >= 2) {
            val formatted = "${cleaned.substring(0, 2)}/${cleaned.substring(2)}"
            _newPaymentExpiry.value = formatted
        } else {
            _newPaymentExpiry.value = cleaned
        }
    }
    
    fun updateNewPaymentCardholder(name: String) {
        _newPaymentCardholder.value = name
    }

    fun updateNewPaymentPhone(phone: String) {
        _newPaymentPhone.value = normalizeMpesaPhone(phone)
    }
    
    fun clearMessages() {
        _successMessage.value = null
        _errorMessage.value = null
    }
    
    private fun saveAddressesToStorage() {
        viewModelScope.launch {
            val json = JSONArray().apply {
                _addresses.value.forEach { address ->
                    put(
                        JSONObject().apply {
                            put("id", address.id)
                            put("label", address.label)
                            put("street", address.street)
                            put("city", address.city)
                            put("fullAddress", address.fullAddress ?: JSONObject.NULL)
                            put("latitude", address.latitude ?: JSONObject.NULL)
                            put("longitude", address.longitude ?: JSONObject.NULL)
                            put("postalCode", address.postalCode ?: JSONObject.NULL)
                            put("isDefault", address.isDefault)
                        }
                    )
                }
            }

            NetworkModule.dataStore.edit { prefs ->
                prefs[addressesStoreKey] = json.toString()
            }
        }
    }
    
    private fun loadAddressesFromStorage() {
        viewModelScope.launch {
            val raw = NetworkModule.dataStore.data.first()[addressesStoreKey].orEmpty()
            if (raw.isBlank()) {
                _addresses.value = emptyList()
                return@launch
            }

            _addresses.value = runCatching {
                val arr = JSONArray(raw)
                buildList {
                    for (i in 0 until arr.length()) {
                        val item = arr.optJSONObject(i) ?: continue
                        add(
                            Address(
                                id = item.optString("id"),
                                label = item.optString("label"),
                                street = item.optString("street"),
                                city = item.optString("city"),
                                fullAddress = item.optString("fullAddress").ifBlank { null },
                                latitude = item.optDouble("latitude").takeIf { item.has("latitude") },
                                longitude = item.optDouble("longitude").takeIf { item.has("longitude") },
                                postalCode = item.optString("postalCode").ifBlank { null },
                                isDefault = item.optBoolean("isDefault", false)
                            )
                        )
                    }
                }
            }.getOrDefault(emptyList())
        }
    }

    private fun loadLocationCandidates() {
        viewModelScope.launch {
            val active = LocationStore.getActiveLocation()
            val saved = LocationStore.getSavedLocations()
            _locationCandidates.value = buildList {
                if (active != null) add(active)
                addAll(saved.filterNot { s -> active != null && s.id == active.id })
            }
        }
    }
    
    private fun savePaymentMethodsToStorage() {
        viewModelScope.launch {
            val json = JSONArray().apply {
                _paymentMethods.value.forEach { method ->
                    put(
                        JSONObject().apply {
                            put("id", method.id)
                            put("type", method.type)
                            put("last4", method.last4)
                            put("expiry", method.expiry)
                            put("cardholderName", method.cardholderName)
                            put("phoneNumber", method.phoneNumber ?: JSONObject.NULL)
                            put("isDefault", method.isDefault)
                        }
                    )
                }
            }

            NetworkModule.dataStore.edit { prefs ->
                prefs[paymentMethodsStoreKey] = json.toString()
            }
        }
    }
    
    private fun loadPaymentMethodsFromStorage() {
        viewModelScope.launch {
            val raw = NetworkModule.dataStore.data.first()[paymentMethodsStoreKey].orEmpty()
            if (raw.isBlank()) {
                _paymentMethods.value = emptyList()
                return@launch
            }

            _paymentMethods.value = runCatching {
                val arr = JSONArray(raw)
                buildList {
                    for (i in 0 until arr.length()) {
                        val item = arr.optJSONObject(i) ?: continue
                        add(
                            PaymentMethod(
                                id = item.optString("id"),
                                type = item.optString("type"),
                                last4 = item.optString("last4"),
                                expiry = item.optString("expiry"),
                                cardholderName = item.optString("cardholderName"),
                                phoneNumber = item.optString("phoneNumber").ifBlank { null },
                                isDefault = item.optBoolean("isDefault", false)
                            )
                        )
                    }
                }
            }.getOrDefault(emptyList())
        }
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
    
    private fun saveNotificationPreferences() {
        // This would save to SharedPreferences
        // For now, data stays in memory during session
    }
    
    private fun loadNotificationPreferences() {
        _notificationPrefs.value = NotificationPreferences()
    }
}
