package com.fikisha.customer.ui.screens.store

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.fikisha.customer.data.model.CartItem
import com.fikisha.customer.data.model.Product
import com.fikisha.customer.data.model.Store
import com.fikisha.customer.data.repository.CartStore
import com.fikisha.customer.data.repository.Repository
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class StoreDetailViewModel : ViewModel() {
    private val repository = Repository()
    
    private val _store = MutableStateFlow<Store?>(null)
    val store: StateFlow<Store?> = _store.asStateFlow()
    
    val cartItems: StateFlow<List<CartItem>> = CartStore.items
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun loadStore(storeId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getStore(storeId)
                .onSuccess { _store.value = it }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun addToCart(product: Product, storeId: String) {
        CartStore.addItem(
            CartItem(
                id = product.id,
                name = product.name,
                price = product.price,
                quantity = 1,
                image = product.image,
                storeId = product.storeId ?: storeId
            )
        )
    }

    fun removeFromCart(productId: String) {
        CartStore.removeOne(productId)
    }

    fun getCartQuantity(productId: String): Int {
        return cartItems.value.find { it.id == productId }?.quantity ?: 0
    }

    fun clearCart() {
        CartStore.clear()
    }

    fun getCartTotal(): Double {
        return cartItems.value.sumOf { it.price * it.quantity }
    }

    fun getCartCount(): Int {
        return cartItems.value.sumOf { it.quantity }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StoreDetailScreen(
    storeId: String,
    viewModel: StoreDetailViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onBackClick: () -> Unit,
    onCartClick: () -> Unit
) {
    val store by viewModel.store.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val cartCount = viewModel.getCartCount()
    var pendingCrossStoreProduct by remember { mutableStateOf<Product?>(null) }

    LaunchedEffect(storeId) {
        viewModel.loadStore(storeId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(store?.name ?: "Store") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    BadgedBox(
                        badge = {
                            if (cartCount > 0) {
                                Badge { Text(cartCount.toString()) }
                            }
                        }
                    ) {
                        IconButton(onClick = onCartClick) {
                            Icon(
                                Icons.Default.ShoppingCart,
                                contentDescription = "Cart",
                                tint = MaterialTheme.colorScheme.onPrimary
                            )
                        }
                    }
                }
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (store != null) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(bottom = 80.dp)
            ) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                    ) {
                        AsyncImage(
                            model = store!!.image,
                            contentDescription = store!!.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp)
                        ) {
                            Column(
                                modifier = Modifier.align(Alignment.BottomStart)
                            ) {
                                Text(
                                    text = store!!.name,
                                    style = MaterialTheme.typography.headlineMedium,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.Star,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "${store!!.rating}",
                                        color = MaterialTheme.colorScheme.onPrimary
                                    )
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Text(
                                        text = store!!.time,
                                        color = MaterialTheme.colorScheme.onPrimary
                                    )
                                }
                            }
                        }
                    }
                }

                item {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = store!!.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Text(
                            text = "Menu",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                items(store!!.products.filter { it.available }) { product ->
                    ProductCard(
                        product = product,
                        quantity = viewModel.getCartQuantity(product.id),
                        onAdd = {
                            val currentStoreId = cartItems.firstOrNull()?.storeId
                            val targetStoreId = product.storeId ?: store!!.id

                            if (currentStoreId != null && currentStoreId != targetStoreId) {
                                pendingCrossStoreProduct = product
                            } else {
                                viewModel.addToCart(product, store!!.id)
                            }
                        },
                        onRemove = { viewModel.removeFromCart(product.id) }
                    )
                }
            }
        }

        if (pendingCrossStoreProduct != null) {
            AlertDialog(
                onDismissRequest = { pendingCrossStoreProduct = null },
                title = { Text("Start a new order?") },
                text = {
                    Text("Your cart has items from another store. Clear it and add this item?")
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val product = pendingCrossStoreProduct
                            pendingCrossStoreProduct = null
                            if (product != null && store != null) {
                                viewModel.clearCart()
                                viewModel.addToCart(product, store!!.id)
                            }
                        }
                    ) {
                        Text("Clear & Add")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { pendingCrossStoreProduct = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun ProductCard(
    product: Product,
    quantity: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AsyncImage(
                model = product.image,
                contentDescription = product.name,
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = product.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "KSh ${product.price}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }
            
            if (quantity > 0) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = "Decrease")
                    }
                    Text(
                        text = quantity.toString(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(
                        onClick = onAdd,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Increase")
                    }
                }
            } else {
                Button(
                    onClick = onAdd,
                    modifier = Modifier.height(36.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp)
                ) {
                    Text("Add")
                }
            }
        }
    }
}
