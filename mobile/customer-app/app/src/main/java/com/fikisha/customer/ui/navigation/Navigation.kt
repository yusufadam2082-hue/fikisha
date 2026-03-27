package com.fikisha.customer.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.fikisha.customer.ui.screens.cart.CartScreen
import com.fikisha.customer.ui.screens.home.HomeScreen
import com.fikisha.customer.ui.screens.info.AboutScreen
import com.fikisha.customer.ui.screens.info.EditProfileScreen
import com.fikisha.customer.ui.screens.info.HelpSupportScreen
import com.fikisha.customer.ui.screens.info.NotificationSettingsScreen
import com.fikisha.customer.ui.screens.info.PaymentMethodsScreen
import com.fikisha.customer.ui.screens.info.PrivacyScreen
import com.fikisha.customer.ui.screens.info.SavedAddressesScreen
import com.fikisha.customer.ui.screens.info.TermsScreen
import com.fikisha.customer.ui.screens.login.LoginScreen
import com.fikisha.customer.ui.screens.location.LocationSelectorScreen
import com.fikisha.customer.ui.screens.order.OrderReceiptScreen
import com.fikisha.customer.ui.screens.order.OrderTrackingScreen
import com.fikisha.customer.ui.screens.orders.OrdersScreen
import com.fikisha.customer.ui.screens.profile.ProfileScreen
import com.fikisha.customer.ui.screens.store.StoreDetailScreen
import com.fikisha.customer.ui.viewmodel.AuthViewModel
import com.fikisha.customer.ui.viewmodel.LocationViewModel

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Home : Screen("home")
    object StoreDetail : Screen("store/{storeId}") {
        fun createRoute(storeId: String) = "store/$storeId"
    }
    object Cart : Screen("cart")
    object LocationSelector : Screen("location-selector")
    object OrderTracking : Screen("order/{orderId}") {
        fun createRoute(orderId: String) = "order/$orderId"
    }
    object Orders : Screen("orders")
    object OrderReceipt : Screen("order/{orderId}/receipt") {
        fun createRoute(orderId: String) = "order/$orderId/receipt"
    }
    object Profile : Screen("profile")
    object EditProfile : Screen("profile/edit")
    object SavedAddresses : Screen("profile/addresses")
    object PaymentMethods : Screen("profile/payments")
    object Notifications : Screen("profile/notifications")
    object HelpSupport : Screen("profile/help")
    object About : Screen("about")
    object Terms : Screen("terms")
    object Privacy : Screen("privacy")
}

@Composable
fun FikishaNavigation() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel()
    val locationViewModel: LocationViewModel = viewModel()
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()
    val isCheckingAuth by authViewModel.isCheckingAuth.collectAsState()

    if (isCheckingAuth) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn && navController.currentDestination?.route == Screen.Login.route) {
            navController.navigate(Screen.Home.route) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = if (isLoggedIn) Screen.Home.route else Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                defaultPortalMode = AuthViewModel.PortalMode.CUSTOMER,
                allowPortalSwitch = false,
                onLoginSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Home.route) {
            HomeScreen(
                locationViewModel = locationViewModel,
                onStoreClick = { storeId ->
                    navController.navigate(Screen.StoreDetail.createRoute(storeId))
                },
                onCartClick = {
                    navController.navigate(Screen.Cart.route)
                },
                onOrdersClick = {
                    navController.navigate(Screen.Orders.route)
                },
                onProfileClick = {
                    navController.navigate(Screen.Profile.route)
                },
                onLocationClick = {
                    navController.navigate(Screen.LocationSelector.route)
                },
                onActiveOrderClick = { orderId ->
                    navController.navigate(Screen.OrderTracking.createRoute(orderId))
                }
            )
        }

        composable(Screen.LocationSelector.route) {
            LocationSelectorScreen(
                viewModel = locationViewModel,
                onBackClick = { navController.popBackStack() },
                onLocationConfirmed = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = Screen.StoreDetail.route,
            arguments = listOf(navArgument("storeId") { type = NavType.StringType })
        ) { backStackEntry ->
            val storeId = backStackEntry.arguments?.getString("storeId") ?: ""
            StoreDetailScreen(
                storeId = storeId,
                onBackClick = { navController.popBackStack() },
                onCartClick = { navController.navigate(Screen.Cart.route) }
            )
        }

        composable(Screen.Cart.route) {
            CartScreen(
                onBackClick = { navController.popBackStack() },
                onOrderPlaced = { orderId ->
                    navController.navigate(Screen.OrderTracking.createRoute(orderId)) {
                        popUpTo(Screen.Home.route)
                    }
                }
            )
        }

        composable(
            route = Screen.OrderTracking.route,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
            OrderTrackingScreen(
                orderId = orderId,
                onBackClick = {
                    navController.navigate(Screen.Orders.route) {
                        popUpTo(Screen.OrderTracking.route) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                onOrdersClick = {
                    navController.navigate(Screen.Orders.route) {
                        popUpTo(Screen.OrderTracking.route) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                onHomeClick = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Orders.route) {
            OrdersScreen(
                onHomeClick = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                },
                onProfileClick = {
                    navController.navigate(Screen.Profile.route)
                },
                onOrderClick = { orderId ->
                    navController.navigate(Screen.OrderTracking.createRoute(orderId))
                },
                onReceiptClick = { orderId ->
                    navController.navigate(Screen.OrderReceipt.createRoute(orderId))
                },
                onCartClick = {
                    navController.navigate(Screen.Cart.route)
                }
            )
        }

        composable(
            route = Screen.OrderReceipt.route,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
            OrderReceiptScreen(
                orderId = orderId,
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(Screen.Profile.route) {
            ProfileScreen(
                onBackClick = { navController.popBackStack() },
                onHomeClick = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                },
                onOrdersClick = {
                    navController.navigate(Screen.Orders.route) {
                        popUpTo(Screen.Orders.route) { inclusive = true }
                    }
                },
                onEditProfileClick = { navController.navigate(Screen.EditProfile.route) },
                onAddressesClick = { navController.navigate(Screen.SavedAddresses.route) },
                onPaymentsClick = { navController.navigate(Screen.PaymentMethods.route) },
                onNotificationsClick = { navController.navigate(Screen.Notifications.route) },
                onHelpClick = { navController.navigate(Screen.HelpSupport.route) },
                onAboutClick = { navController.navigate(Screen.About.route) },
                onTermsClick = { navController.navigate(Screen.Terms.route) },
                onPrivacyClick = { navController.navigate(Screen.Privacy.route) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.EditProfile.route) {
            EditProfileScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.SavedAddresses.route) {
            SavedAddressesScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.PaymentMethods.route) {
            PaymentMethodsScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.Notifications.route) {
            NotificationSettingsScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.HelpSupport.route) {
            HelpSupportScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.About.route) {
            AboutScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.Terms.route) {
            TermsScreen(onBackClick = { navController.popBackStack() })
        }

        composable(Screen.Privacy.route) {
            PrivacyScreen(onBackClick = { navController.popBackStack() })
        }
    }
}
