package com.fikisha.customer.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.fikisha.customer.data.location.DeviceLocationClient
import com.fikisha.customer.data.location.LocationStore
import com.fikisha.customer.data.model.AddressSearchResult
import com.fikisha.customer.data.model.AppLocation
import com.fikisha.customer.data.model.DeliveryQuote
import com.fikisha.customer.data.repository.Repository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

class LocationViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = Repository()
    private val deviceLocationClient = DeviceLocationClient(application.applicationContext)

    private val _activeLocation = MutableStateFlow<AppLocation?>(null)
    val activeLocation: StateFlow<AppLocation?> = _activeLocation.asStateFlow()

    private val _savedLocations = MutableStateFlow<List<AppLocation>>(emptyList())
    val savedLocations: StateFlow<List<AppLocation>> = _savedLocations.asStateFlow()

    private val _searchResults = MutableStateFlow<List<AddressSearchResult>>(emptyList())
    val searchResults: StateFlow<List<AddressSearchResult>> = _searchResults.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val quoteCache = mutableMapOf<String, DeliveryQuote>()

    init {
        refreshFromStore()
    }

    fun refreshFromStore() {
        viewModelScope.launch {
            _activeLocation.value = LocationStore.getActiveLocation()
            _savedLocations.value = LocationStore.getSavedLocations()
        }
    }

    fun clearError() {
        _error.value = null
    }

    fun searchAddress(query: String) {
        viewModelScope.launch {
            if (query.isBlank()) {
                _searchResults.value = emptyList()
                return@launch
            }

            _isLoading.value = true
            repository.searchAddresses(query)
                .onSuccess { _searchResults.value = it }
                .onFailure {
                    _error.value = it.message ?: "Failed to search addresses"
                    _searchResults.value = emptyList()
                }
            _isLoading.value = false
        }
    }

    fun useCurrentLocation(hasPermission: Boolean, onSuccess: (() -> Unit)? = null) {
        if (!hasPermission) {
            _error.value = "Location permission denied. You can still choose location manually."
            return
        }

        if (!deviceLocationClient.isGpsEnabled()) {
            _error.value = "GPS is off. Turn it on or select location manually."
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            val coords = deviceLocationClient.getCurrentLocation()
            if (coords == null) {
                _error.value = "Unable to get current location. Try manual address selection."
                _isLoading.value = false
                return@launch
            }

            val (lat, lng) = coords
            repository.reverseGeocode(lat, lng)
                .onSuccess { result ->
                    val location = AppLocation(
                        id = repository.createLocationId(),
                        label = "Current Location",
                        address = result.address,
                        latitude = lat,
                        longitude = lng,
                        source = "GPS",
                        isSaved = false
                    )
                    setActiveLocation(location, saveToList = false)
                    onSuccess?.invoke()
                }
                .onFailure {
                    _error.value = "Failed to resolve current address."
                }
            _isLoading.value = false
        }
    }

    fun selectSearchResult(result: AddressSearchResult, saveToList: Boolean = false, onSuccess: (() -> Unit)? = null) {
        val location = AppLocation(
            id = repository.createLocationId(),
            label = result.label,
            address = result.address,
            latitude = result.latitude,
            longitude = result.longitude,
            source = "SEARCH",
            isSaved = saveToList
        )
        setActiveLocation(location, saveToList = saveToList)
        onSuccess?.invoke()
    }

    fun selectMapPoint(lat: Double, lng: Double, saveToList: Boolean = false, onSuccess: (() -> Unit)? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.reverseGeocode(lat, lng)
                .onSuccess { result ->
                    val location = AppLocation(
                        id = repository.createLocationId(),
                        label = result.label,
                        address = result.address,
                        latitude = lat,
                        longitude = lng,
                        source = "MAP",
                        isSaved = saveToList
                    )
                    setActiveLocation(location, saveToList = saveToList)
                    onSuccess?.invoke()
                }
                .onFailure {
                    _error.value = it.message ?: "Failed to resolve map location"
                }
            _isLoading.value = false
        }
    }

    fun activateSavedLocation(location: AppLocation, onSuccess: (() -> Unit)? = null) {
        setActiveLocation(location.copy(updatedAt = System.currentTimeMillis()), saveToList = false)
        onSuccess?.invoke()
    }

    fun removeSavedLocation(locationId: String) {
        viewModelScope.launch {
            LocationStore.removeSavedLocation(locationId)
            _savedLocations.value = LocationStore.getSavedLocations()
        }
    }

    private fun setActiveLocation(location: AppLocation, saveToList: Boolean) {
        viewModelScope.launch {
            LocationStore.setActiveLocation(location)
            if (saveToList) {
                LocationStore.saveLocation(location.copy(isSaved = true))
            }
            _activeLocation.value = LocationStore.getActiveLocation()
            _savedLocations.value = LocationStore.getSavedLocations()
            quoteCache.clear()
        }
    }

    suspend fun getDeliveryQuote(storeId: String, orderTotal: Double): Result<DeliveryQuote> {
        val location = _activeLocation.value ?: return Result.failure(Exception("Choose a location first"))
        val normalizedTotal = String.format(Locale.US, "%.2f", orderTotal)
        val key = "$storeId:${location.latitude}:${location.longitude}:$normalizedTotal"
        val cached = quoteCache[key]
        if (cached != null) return Result.success(cached)

        return repository.getDeliveryQuote(
            storeId = storeId,
            latitude = location.latitude,
            longitude = location.longitude,
            orderTotal = orderTotal
        ).onSuccess { quote ->
            quoteCache[key] = quote
        }
    }
}
