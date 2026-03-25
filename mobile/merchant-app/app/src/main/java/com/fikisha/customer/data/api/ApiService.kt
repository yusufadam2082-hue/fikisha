package com.fikisha.customer.data.api

import com.fikisha.customer.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<LoginResponse>

    @GET("api/stores")
    suspend fun getStores(): Response<List<Store>>

    @GET("api/promotions")
    suspend fun getPromotions(): Response<List<Promotion>>

    @GET("api/ai/recommendations")
    suspend fun getAiRecommendations(@Query("limit") limit: Int = 6): Response<AiRecommendationsResponse>

    @GET("api/stores/{id}")
    suspend fun getStore(@Path("id") storeId: String): Response<Store>

    @GET("api/products/store/{storeId}")
    suspend fun getProductsByStore(@Path("storeId") storeId: String): Response<List<Product>>

    @POST("api/orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): Response<Order>

    @GET("api/orders/{id}")
    suspend fun getOrder(@Path("id") orderId: String): Response<Order>

    @GET("api/orders")
    suspend fun getCustomerOrders(): Response<List<Order>>

    @GET("api/orders")
    suspend fun getOrders(): Response<List<Order>>

    @PUT("api/orders/{id}/status")
    suspend fun updateOrderStatus(
        @Path("id") orderId: String,
        @Body status: Map<String, String>
    ): Response<Order>

    @PUT("api/stores/{id}")
    suspend fun updateStore(
        @Path("id") storeId: String,
        @Body request: StoreUpdateRequest
    ): Response<Store>

    @POST("api/stores/{storeId}/products")
    suspend fun createProduct(
        @Path("storeId") storeId: String,
        @Body request: ProductUpsertRequest
    ): Response<Product>

    @PUT("api/stores/{storeId}/products/{productId}")
    suspend fun updateProduct(
        @Path("storeId") storeId: String,
        @Path("productId") productId: String,
        @Body request: ProductUpsertRequest
    ): Response<Product>

    @PUT("api/me")
    suspend fun updateProfile(@Body request: ProfileUpdateRequest): Response<User>

    @GET("api/me")
    suspend fun getProfile(): Response<User>
}
