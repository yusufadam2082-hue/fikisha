package com.fikisha.customer.data.repository

import com.fikisha.customer.data.api.ApiService
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.model.*
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Response

class Repository(private val apiService: ApiService = NetworkModule.apiService) {

    private fun getApiError(response: Response<*>): String {
        val fallback = response.message().takeIf { it.isNotBlank() }
            ?: "Request failed (${response.code()})"
        val rawBody = response.errorBody()?.string()?.trim().orEmpty()

        if (rawBody.isBlank()) return fallback

        return try {
            val json = JSONObject(rawBody)
            json.optString("error").ifBlank {
                json.optString("message").ifBlank { fallback }
            }
        } catch (_: Exception) {
            rawBody
        }
    }
    
    suspend fun login(username: String, password: String): Result<LoginResponse> {
        return try {
            val response = apiService.login(LoginRequest(username, password))
            if (response.isSuccessful && response.body() != null) {
                NetworkModule.setAuthToken(response.body()!!.token)
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(
        fullName: String,
        email: String,
        phone: String,
        username: String,
        password: String,
        confirmPassword: String,
        country: String? = null,
        referralCode: String? = null,
        dateOfBirth: String? = null,
        gender: String? = null,
        address: String? = null,
    ): Result<LoginResponse> {
        return try {
            val response = apiService.register(
                RegisterRequest(
                    fullName = fullName,
                    email = email,
                    phone = phone,
                    username = username,
                    password = password,
                    confirmPassword = confirmPassword,
                    country = country,
                    referralCode = referralCode,
                    dateOfBirth = dateOfBirth,
                    gender = gender,
                    address = address,
                )
            )
            if (response.isSuccessful && response.body() != null) {
                NetworkModule.setAuthToken(response.body()!!.token)
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Registration failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getStores(): Result<List<Store>> {
        return try {
            val response = apiService.getStores()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch stores"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPromotions(): Result<List<Promotion>> {
        return try {
            val response = apiService.getPromotions()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch promotions"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAiRecommendations(limit: Int = 6): Result<List<AiRecommendation>> {
        return try {
            val response = apiService.getAiRecommendations(limit)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.recommendations)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch recommendations"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getStore(storeId: String): Result<Store> {
        return try {
            val response = apiService.getStore(storeId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch store"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createOrder(
        storeId: String,
        items: List<CartItem>,
        deliveryAddress: String,
        customerName: String,
        customerPhone: String,
        latitude: Double? = null,
        longitude: Double? = null,
        locationSource: String? = null,
        notes: String? = null
    ): Result<Order> {
        return try {
            val request = CreateOrderRequest(
                storeId = storeId,
                items = items.map { CartItemRequest(it.id, it.quantity) },
                deliveryAddress = CreateOrderDeliveryAddress(
                    address = deliveryAddress,
                    latitude = latitude,
                    longitude = longitude,
                    source = locationSource
                ),
                customerInfo = CreateOrderCustomerInfo(
                    name = customerName,
                    phone = customerPhone,
                    address = deliveryAddress
                ),
                notes = notes?.takeIf { it.isNotBlank() }
            )
            val response = apiService.createOrder(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(getApiError(response)))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDeliveryQuote(
        storeId: String,
        latitude: Double,
        longitude: Double,
        orderTotal: Double
    ): Result<DeliveryQuote> {
        return try {
            val response = apiService.getDeliveryQuote(
                storeId = storeId,
                latitude = latitude,
                longitude = longitude,
                orderTotal = orderTotal
            )

            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(getApiError(response)))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchAddresses(query: String): Result<List<AddressSearchResult>> {
        return try {
            if (query.isBlank()) return Result.success(emptyList())

            val encoded = URLEncoder.encode(query, "UTF-8")
            val url = "https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=8&addressdetails=1"
            val raw = URL(url).openConnection().apply {
                setRequestProperty("User-Agent", "FikishaCustomerAndroid/1.0")
                connectTimeout = 12000
                readTimeout = 12000
            }.getInputStream().bufferedReader().use { it.readText() }

            val arr = JSONArray(raw)
            val results = mutableListOf<AddressSearchResult>()
            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                val lat = item.optDouble("lat", Double.NaN)
                val lon = item.optDouble("lon", Double.NaN)
                if (!lat.isFinite() || !lon.isFinite()) continue

                val label = item.optString("display_name").ifBlank { query }
                results.add(
                    AddressSearchResult(
                        label = label.substringBefore(',').ifBlank { "Pinned location" },
                        address = label,
                        latitude = lat,
                        longitude = lon
                    )
                )
            }

            Result.success(results)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun reverseGeocode(latitude: Double, longitude: Double): Result<AddressSearchResult> {
        return try {
            val url = "https://nominatim.openstreetmap.org/reverse?lat=$latitude&lon=$longitude&format=json"
            val raw = URL(url).openConnection().apply {
                setRequestProperty("User-Agent", "FikishaCustomerAndroid/1.0")
                connectTimeout = 12000
                readTimeout = 12000
            }.getInputStream().bufferedReader().use { it.readText() }

            val json = JSONObject(raw)
            val display = json.optString("display_name").ifBlank { "Pinned location" }
            Result.success(
                AddressSearchResult(
                    label = display.substringBefore(',').ifBlank { "Pinned location" },
                    address = display,
                    latitude = latitude,
                    longitude = longitude
                )
            )
        } catch (_: Exception) {
            Result.success(
                AddressSearchResult(
                    label = "Pinned location",
                    address = "$latitude, $longitude",
                    latitude = latitude,
                    longitude = longitude
                )
            )
        }
    }

    fun createLocationId(): String = UUID.randomUUID().toString()

    suspend fun getOrder(orderId: String): Result<Order> {
        return try {
            val response = apiService.getOrder(orderId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch order"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCustomerOrders(): Result<List<Order>> {
        return try {
            val response = apiService.getCustomerOrders()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch orders"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getOrders(): Result<List<Order>> {
        return try {
            val response = apiService.getOrders()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch orders"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateOrderStatus(orderId: String, status: String): Result<Order> {
        return try {
            val response = apiService.updateOrderStatus(orderId, mapOf("status" to status))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to update order"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateStore(storeId: String, request: StoreUpdateRequest): Result<Store> {
        return try {
            val response = apiService.updateStore(storeId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to update store"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createProduct(storeId: String, request: ProductUpsertRequest): Result<Product> {
        return try {
            val response = apiService.createProduct(storeId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to create product"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProduct(storeId: String, productId: String, request: ProductUpsertRequest): Result<Product> {
        return try {
            val response = apiService.updateProduct(storeId, productId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to update product"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfile(request: ProfileUpdateRequest): Result<User> {
        return try {
            val response = apiService.updateProfile(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to update profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getProfile(): Result<User> {
        return try {
            val response = apiService.getProfile()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to fetch profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
