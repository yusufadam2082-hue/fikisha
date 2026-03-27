package com.fikisha.customer.ui.screens.merchant

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.fikisha.customer.data.model.Product
import com.fikisha.customer.data.model.ProductUpsertRequest
import com.fikisha.customer.data.model.Store
import com.fikisha.customer.data.model.User
import com.fikisha.customer.data.repository.Repository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private data class ProductFormState(
    val name: String = "",
    val description: String = "",
    val price: String = "",
    val image: String = "",
    val category: String = "",
    val available: Boolean = true
)

class MerchantProductsViewModel : ViewModel() {
    private val repository = Repository()

    private val _store = MutableStateFlow<Store?>(null)
    val store: StateFlow<Store?> = _store.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun load(storeId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getStore(storeId)
                .onSuccess { _store.value = it }
                .onFailure { _message.value = it.message ?: "Failed to load products" }
            _isLoading.value = false
        }
    }

    fun createProduct(storeId: String, request: ProductUpsertRequest) {
        viewModelScope.launch {
            repository.createProduct(storeId, request)
                .onSuccess {
                    _message.value = "Menu item created"
                    load(storeId)
                }
                .onFailure { _message.value = it.message ?: "Failed to create product" }
        }
    }

    fun updateProduct(storeId: String, productId: String, request: ProductUpsertRequest) {
        viewModelScope.launch {
            repository.updateProduct(storeId, productId, request)
                .onSuccess {
                    _message.value = "Menu item updated"
                    load(storeId)
                }
                .onFailure { _message.value = it.message ?: "Failed to update product" }
        }
    }

    fun clearMessage() {
        _message.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MerchantProductsScreen(
    user: User?,
    onOrdersClick: () -> Unit,
    onProfileClick: () -> Unit,
    onLogout: () -> Unit,
    viewModel: MerchantProductsViewModel = viewModel()
) {
    val storeId = user?.storeId
    val store by viewModel.store.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val message by viewModel.message.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var dialogProduct by remember { mutableStateOf<Product?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }

    LaunchedEffect(storeId) {
        if (storeId != null) {
            viewModel.load(storeId)
        }
    }

    LaunchedEffect(message) {
        message?.takeIf { it.isNotBlank() }?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    if (storeId == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Merchant account is missing a store assignment.")
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Merchant Products", fontWeight = FontWeight.Bold)
                        Text(
                            text = store?.name ?: user.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = { MerchantLogoutAction(onLogout) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        bottomBar = {
            MerchantBottomBar(
                currentTab = MerchantTab.Products,
                onOrdersClick = onOrdersClick,
                onProductsClick = {},
                onProfileClick = onProfileClick
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add menu item")
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { padding ->
        if (isLoading && store == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("My Menu", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(
                            text = "Add new products and edit pricing, imagery, and availability from mobile.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (store?.products.isNullOrEmpty()) {
                item {
                    Card(shape = RoundedCornerShape(20.dp)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No menu items yet. Tap the add button to create your first product.")
                        }
                    }
                }
            }

            items(store?.products.orEmpty(), key = { it.id }) { product ->
                Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column {
                        if (product.image.isNotBlank()) {
                            AsyncImage(
                                model = product.image,
                                contentDescription = product.name,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(180.dp),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(180.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(36.dp))
                            }
                        }

                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(product.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    if (!product.category.isNullOrBlank()) {
                                        Text(product.category, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                Text(formatKes(product.price), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            }

                            Text(product.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = if (product.available) "Available" else "Unavailable",
                                    color = if (product.available) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.labelLarge
                                )
                                Button(onClick = { dialogProduct = product }) {
                                    Icon(Icons.Default.Edit, contentDescription = null)
                                    Spacer(modifier = Modifier.size(8.dp))
                                    Text("Edit")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        ProductEditorDialog(
            title = "New Menu Item",
            initialProduct = null,
            onDismiss = { showAddDialog = false },
            onSave = { form ->
                val price = form.price.toDoubleOrNull() ?: 0.0
                if (price > 0) {
                    viewModel.createProduct(
                        storeId = storeId,
                        request = ProductUpsertRequest(
                            name = form.name,
                            description = form.description,
                            price = price,
                            image = form.image,
                            category = form.category.ifBlank { null },
                            available = form.available
                        )
                    )
                    showAddDialog = false
                }
            }
        )
    }

    dialogProduct?.let { product ->
        ProductEditorDialog(
            title = "Edit Menu Item",
            initialProduct = product,
            onDismiss = { dialogProduct = null },
            onSave = { form ->
                val price = form.price.toDoubleOrNull() ?: 0.0
                if (price > 0) {
                    viewModel.updateProduct(
                        storeId = storeId,
                        productId = product.id,
                        request = ProductUpsertRequest(
                            name = form.name,
                            description = form.description,
                            price = price,
                            image = form.image,
                            category = form.category.ifBlank { null },
                            available = form.available
                        )
                    )
                    dialogProduct = null
                }
            }
        )
    }
}

@Composable
private fun ProductEditorDialog(
    title: String,
    initialProduct: Product?,
    onDismiss: () -> Unit,
    onSave: (ProductFormState) -> Unit
) {
    var form by remember(initialProduct) {
        mutableStateOf(
            ProductFormState(
                name = initialProduct?.name.orEmpty(),
                description = initialProduct?.description.orEmpty(),
                price = initialProduct?.price?.toString().orEmpty(),
                image = initialProduct?.image.orEmpty(),
                category = initialProduct?.category.orEmpty(),
                available = initialProduct?.available ?: true
            )
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = form.name, onValueChange = { form = form.copy(name = it) }, label = { Text("Item Name") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = form.price, onValueChange = { form = form.copy(price = it) }, label = { Text("Price in KES") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = form.description, onValueChange = { form = form.copy(description = it) }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = form.image, onValueChange = { form = form.copy(image = it) }, label = { Text("Image URL") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = form.category, onValueChange = { form = form.copy(category = it) }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth())
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Available")
                    Switch(checked = form.available, onCheckedChange = { form = form.copy(available = it) })
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(form) }, enabled = form.name.isNotBlank() && (form.price.toDoubleOrNull() ?: 0.0) > 0) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}