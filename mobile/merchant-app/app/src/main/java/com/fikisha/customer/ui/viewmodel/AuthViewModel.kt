package com.fikisha.customer.ui.viewmodel

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.session.SessionStore
import com.fikisha.customer.data.model.User
import com.fikisha.customer.data.repository.Repository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {
    private val repository = Repository()

    enum class PortalMode {
        CUSTOMER,
        MERCHANT
    }
    
    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _isCheckingAuth = MutableStateFlow(true)
    val isCheckingAuth: StateFlow<Boolean> = _isCheckingAuth.asStateFlow()
    
    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    companion object {
        private val USER_KEY = stringPreferencesKey("user")
        private val TOKEN_KEY = stringPreferencesKey("token")
        private val REMEMBER_ME_KEY = booleanPreferencesKey("remember_me")
    }

    init {
        checkLoginStatus()
    }

    private fun checkLoginStatus() {
        viewModelScope.launch {
            try {
                val prefs = NetworkModule.dataStore.data.first()
                val rememberMe = prefs[REMEMBER_ME_KEY] ?: true
                val token = prefs[TOKEN_KEY]
                val userJson = prefs[USER_KEY]
                val storedUser = SessionStore.deserializeUser(userJson)

                if (rememberMe && token != null && storedUser != null) {
                    NetworkModule.setAuthToken(token)
                    _user.value = storedUser
                    _isLoggedIn.value = true
                }
            } catch (e: Exception) {
                _isLoggedIn.value = false
            } finally {
                _isCheckingAuth.value = false
            }
        }
    }

    fun login(
        username: String,
        password: String,
        rememberMe: Boolean,
        portalMode: PortalMode,
        onSuccess: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            repository.login(username, password)
                .onSuccess { response ->
                    val expectedRole = if (portalMode == PortalMode.MERCHANT) "MERCHANT" else "CUSTOMER"
                    if (response.user.role != expectedRole) {
                        _error.value = if (portalMode == PortalMode.MERCHANT) {
                            "This portal is only for merchants."
                        } else {
                            "This portal is only for customers."
                        }
                        _isLoading.value = false
                        return@onSuccess
                    }

                    NetworkModule.dataStore.edit { prefs ->
                        prefs[REMEMBER_ME_KEY] = rememberMe
                        if (rememberMe) {
                            prefs[TOKEN_KEY] = response.token
                            prefs[USER_KEY] = SessionStore.serializeUser(response.user)
                        } else {
                            prefs.remove(TOKEN_KEY)
                            prefs.remove(USER_KEY)
                        }
                    }

                    NetworkModule.setAuthToken(response.token)
                    _user.value = response.user
                    _isLoggedIn.value = true
                    onSuccess(response.user.role)
                }
                .onFailure { e ->
                    _error.value = e.message ?: "Login failed"
                }
            
            _isLoading.value = false
        }
    }

    fun register(username: String, password: String, rememberMe: Boolean, onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            repository.register(username, password)
                .onSuccess { response ->
                    if (response.user.role != "CUSTOMER") {
                        _error.value = "This portal is only for customers."
                        _isLoading.value = false
                        return@onSuccess
                    }

                    NetworkModule.dataStore.edit { prefs ->
                        prefs[REMEMBER_ME_KEY] = rememberMe
                        if (rememberMe) {
                            prefs[TOKEN_KEY] = response.token
                            prefs[USER_KEY] = SessionStore.serializeUser(response.user)
                        } else {
                            prefs.remove(TOKEN_KEY)
                            prefs.remove(USER_KEY)
                        }
                    }

                    NetworkModule.setAuthToken(response.token)
                    _user.value = response.user
                    _isLoggedIn.value = true
                    onSuccess(response.user.role)
                }
                .onFailure { e ->
                    _error.value = e.message ?: "Registration failed"
                }

            _isLoading.value = false
        }
    }

    fun continueAsGuest(onSuccess: () -> Unit) {
        viewModelScope.launch {
            _error.value = null
            NetworkModule.dataStore.edit { prefs ->
                prefs[REMEMBER_ME_KEY] = false
                prefs.remove(TOKEN_KEY)
                prefs.remove(USER_KEY)
            }

            NetworkModule.setAuthToken(null)
            _user.value = User(
                id = "guest",
                username = "Guest",
                name = "Guest User",
                email = null,
                phone = null,
                role = "CUSTOMER",
                storeId = null
            )
            _isLoggedIn.value = true
            onSuccess()
        }
    }

    fun updateStoredUser(user: User) {
        viewModelScope.launch {
            _user.value = user
            NetworkModule.dataStore.edit { prefs ->
                prefs[USER_KEY] = SessionStore.serializeUser(user)
            }
        }
    }

    fun requestPasswordReset(identifier: String, onComplete: (String) -> Unit) {
        viewModelScope.launch {
            _error.value = null
            _isLoading.value = true
            delay(500)
            _isLoading.value = false

            onComplete(
                if (identifier.isBlank()) {
                    "Enter your username or email to continue."
                } else {
                    "If the account exists, reset instructions have been sent."
                }
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            NetworkModule.dataStore.edit { prefs ->
                prefs.remove(TOKEN_KEY)
                prefs.remove(USER_KEY)
                prefs.remove(REMEMBER_ME_KEY)
            }
            NetworkModule.setAuthToken(null)
            _user.value = null
            _isLoggedIn.value = false
        }
    }

    fun clearError() {
        _error.value = null
    }
}
