package com.fikisha.customer.ui.screens.location

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fikisha.customer.ui.viewmodel.LocationViewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

private enum class LocationTab { CURRENT, SEARCH, MAP, SAVED }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSelectorScreen(
    viewModel: LocationViewModel = viewModel(),
    onBackClick: () -> Unit,
    onLocationConfirmed: () -> Unit
) {
    val context = LocalContext.current
    val activeLocation by viewModel.activeLocation.collectAsState()
    val savedLocations by viewModel.savedLocations.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    var selectedTab by remember { mutableStateOf(LocationTab.CURRENT) }
    var searchQuery by remember { mutableStateOf("") }
    var mapPoint by remember { mutableStateOf<LatLng?>(null) }
    var saveSelection by remember { mutableStateOf(false) }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val allowed = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
            || granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        viewModel.useCurrentLocation(hasPermission = allowed, onSuccess = onLocationConfirmed)
    }

    fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Select Delivery Location", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = activeLocation?.address ?: "No active location selected",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            TabRow(selectedTabIndex = selectedTab.ordinal) {
                Tab(selected = selectedTab == LocationTab.CURRENT, onClick = { selectedTab = LocationTab.CURRENT }, text = { Text("Current") })
                Tab(selected = selectedTab == LocationTab.SEARCH, onClick = { selectedTab = LocationTab.SEARCH }, text = { Text("Search") })
                Tab(selected = selectedTab == LocationTab.MAP, onClick = { selectedTab = LocationTab.MAP }, text = { Text("Map") })
                Tab(selected = selectedTab == LocationTab.SAVED, onClick = { selectedTab = LocationTab.SAVED }, text = { Text("Saved") })
            }

            if (!error.isNullOrBlank()) {
                Text(
                    text = error ?: "",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            when (selectedTab) {
                LocationTab.CURRENT -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Button(onClick = {
                                viewModel.clearError()
                                if (hasLocationPermission()) {
                                    viewModel.useCurrentLocation(hasPermission = true, onSuccess = onLocationConfirmed)
                                } else {
                                    locationPermissionLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.ACCESS_FINE_LOCATION,
                                            Manifest.permission.ACCESS_COARSE_LOCATION
                                        )
                                    )
                                }
                            }) {
                                Icon(Icons.Default.MyLocation, contentDescription = null)
                                Spacer(modifier = Modifier.size(8.dp))
                                Text("Use Current Location")
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                "If permission is denied or GPS is off, use Search or Map tabs.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 24.dp)
                            )
                        }
                    }
                }

                LocationTab.SEARCH -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item {
                            OutlinedTextField(
                                value = searchQuery,
                                onValueChange = {
                                    searchQuery = it
                                    viewModel.searchAddress(it)
                                },
                                placeholder = { Text("Search address") },
                                modifier = Modifier.fillMaxWidth(),
                                leadingIcon = { Icon(Icons.Default.LocationOn, contentDescription = null) }
                            )
                        }

                        item {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                androidx.compose.material3.Checkbox(
                                    checked = saveSelection,
                                    onCheckedChange = { saveSelection = it }
                                )
                                Text("Save selected location")
                            }
                        }

                        items(searchResults) { result ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = {
                                    viewModel.selectSearchResult(
                                        result = result,
                                        saveToList = saveSelection,
                                        onSuccess = onLocationConfirmed
                                    )
                                }
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(result.label, fontWeight = FontWeight.SemiBold)
                                    Text(result.address, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }

                LocationTab.MAP -> {
                    val start = activeLocation?.let { LatLng(it.latitude, it.longitude) } ?: LatLng(-1.286389, 36.817223)
                    val cameraState = rememberCameraPositionState()

                    LaunchedEffect(start) {
                        cameraState.move(CameraUpdateFactory.newLatLngZoom(start, 13f))
                    }

                    Column(modifier = Modifier.fillMaxSize()) {
                        Box(modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)) {
                            GoogleMap(
                                modifier = Modifier.fillMaxSize(),
                                cameraPositionState = cameraState,
                                properties = MapProperties(isMyLocationEnabled = hasLocationPermission()),
                                onMapClick = { point -> mapPoint = point }
                            ) {
                                mapPoint?.let { point ->
                                    Marker(state = MarkerState(point), title = "Selected location")
                                }
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                androidx.compose.material3.Checkbox(
                                    checked = saveSelection,
                                    onCheckedChange = { saveSelection = it }
                                )
                                Text("Save")
                            }

                            Button(
                                enabled = mapPoint != null,
                                onClick = {
                                    val point = mapPoint ?: return@Button
                                    viewModel.selectMapPoint(
                                        lat = point.latitude,
                                        lng = point.longitude,
                                        saveToList = saveSelection,
                                        onSuccess = onLocationConfirmed
                                    )
                                }
                            ) {
                                Text("Use this point")
                            }
                        }
                    }
                }

                LocationTab.SAVED -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(savedLocations) { saved ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(saved.label, fontWeight = FontWeight.SemiBold)
                                        Text(saved.address, style = MaterialTheme.typography.bodySmall)
                                    }
                                    TextButton(onClick = { viewModel.activateSavedLocation(saved, onLocationConfirmed) }) {
                                        Text("Use")
                                    }
                                    IconButton(onClick = { viewModel.removeSavedLocation(saved.id) }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
    }
}
