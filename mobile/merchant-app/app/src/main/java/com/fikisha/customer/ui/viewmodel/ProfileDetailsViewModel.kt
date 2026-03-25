package com.fikisha.customer.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.model.Address
import com.fikisha.customer.data.model.NotificationPreferences
import com.fikisha.customer.data.model.PaymentMethod
import com.fikisha.customer.data.model.ProfileUpdateRequest
import com.fikisha.customer.data.model.User
import com.fikisha.customer.data.repository.Repository
import com.fikisha.customer.data.session.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import android.content.Context
import androidx.datastore.preferences.core.edit

class ProfileDetailsViewModel : ViewModel() {
    private val repository = Repository()
    
    // Edit Profile State
    private val _profileName = MutableStateFlow("")
    val profileName: StateFlow<String> = _profileName.asStateFlow()
    
    private val _profilePhone = MutableStateFlow("")
    val profilePhone: StateFlow<String> = _profilePhone.asStateFlow()
    
    private val _profileEmail = MutableStateFlow("")
    val profileEmail: StateFlow<String> = _profileEmail.asStateFlow()
    
    // Addresses State
    private val _addresses = MutableStateFlow<List<Address>>(emptyList())
    val addresses: StateFlow<List<Address>> = _addresses.asStateFlow()
    
    private val _newAddressLabel = MutableStateFlow("")
    val newAddressLabel: StateFlow<String> = _newAddressLabel.asStateFlow()
    
    private val _newAddressStreet = MutableStateFlow("")
    val newAddressStreet: StateFlow<String> = _newAddressStreet.asStateFlow()
    
    private val _newAddressCity = MutableStateFlow("")
    val newAddressCity: StateFlow<String> = _newAddressCity.asStateFlow()
    
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
                NetworkModule.dataStore.data.collect { preferences ->
                    val user = SessionStore.deserializeUser(preferences[SessionStore.userKey])
                    if (user != null) {
                        _profileName.value = user.name
                        _profilePhone.value = user.phone.orEmpty()
                        _profileEmail.value = user.email.orEmpty()
                    }
                }
                
                // Load addresses from shared preferences or local storage
                loadAddressesFromStorage()
                
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
                    phone = _profilePhone.value.ifBlank { null }
                )
                
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
                                    phone = _profilePhone.value.ifBlank { null },
                                    email = _profileEmail.value.ifBlank { null }
                                )
                            )
                        }
                    }
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
        
        val newAddress = Address(
            id = System.currentTimeMillis().toString(),
            label = label,
            street = street,
            city = city,
            isDefault = _addresses.value.isEmpty()
        )
        
        _addresses.value = _addresses.value + newAddress
        saveAddressesToStorage()
        
        // Clear new address fields
        _newAddressLabel.value = ""
        _newAddressStreet.value = ""
        _newAddressCity.value = ""
        
        _successMessage.value = "Address added successfully"
    }
    
    fun removeAddress(address: Address) {
        _addresses.value = _addresses.value.filter { it.id != address.id }
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
    
    fun addPaymentMethod() {
        val cardNumber = _newPaymentCardNumber.value.replace(" ", "").ifBlank { return }
        val expiry = _newPaymentExpiry.value.ifBlank { return }
        val cardholder = _newPaymentCardholder.value.ifBlank { return }
        
        if (cardNumber.length < 4 || !expiry.matches(Regex("\\d{2}/\\d{2}"))) {
            _errorMessage.value = "Invalid card number or expiry date"
            return
        }
        
        val newPayment = PaymentMethod(
            id = System.currentTimeMillis().toString(),
            type = _newPaymentType.value,
            last4 = cardNumber.takeLast(4),
            expiry = expiry,
            cardholderName = cardholder,
            isDefault = _paymentMethods.value.isEmpty()
        )
        
        _paymentMethods.value = _paymentMethods.value + newPayment
        savePaymentMethodsToStorage()
        
        // Clear new payment fields
        _newPaymentType.value = "Visa"
        _newPaymentCardNumber.value = ""
        _newPaymentExpiry.value = ""
        _newPaymentCardholder.value = ""
        
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
    
    fun clearMessages() {
        _successMessage.value = null
        _errorMessage.value = null
    }
    
    private fun saveAddressesToStorage() {
        // This would save to SharedPreferences or local storage
        // For now, data stays in memory during session
    }
    
    private fun loadAddressesFromStorage() {
        // This would load from SharedPreferences or local storage
        // For now, starts with empty list
    }
    
    private fun savePaymentMethodsToStorage() {
        // This would save to SharedPreferences or local storage
        // For now, data stays in memory during session
    }
    
    private fun loadPaymentMethodsFromStorage() {
        // This would load from SharedPreferences or local storage
        // For now, starts with empty list
    }
    
    private fun saveNotificationPreferences() {
        // This would save to SharedPreferences
        // For now, data stays in memory during session
    }
    
    private fun loadNotificationPreferences() {
        _notificationPrefs.value = NotificationPreferences()
    }
}
