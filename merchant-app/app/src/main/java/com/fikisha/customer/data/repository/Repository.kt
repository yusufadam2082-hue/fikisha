package com.fikisha.customer.data.repository

import com.fikisha.customer.data.api.ApiService
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.model.*

class Repository(private val apiService: ApiService = NetworkModule.apiService) {
    
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

    suspend fun register(username: String, password: String): Result<LoginResponse> {
        return try {
            val response = apiService.register(RegisterRequest(username, password))
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
        customerPhone: String
    ): Result<Order> {
        return try {
            val request = CreateOrderRequest(
                storeId = storeId,
                items = items.map { CartItemRequest(it.id, it.quantity) },
                deliveryAddress = deliveryAddress,
                customerInfo = """{"name":"$customerName","phone":"$customerPhone"}"""
            )
            val response = apiService.createOrder(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.message() ?: "Failed to create order"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

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
