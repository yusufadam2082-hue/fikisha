# Mtaaexpress Merchant Android App

A native Android merchant platform app for the Mtaaexpress delivery service, built with Jetpack Compose.

## Features

- **User Authentication** - Login with username/password
- **Browse Stores** - View available stores and their ratings
- **Product Catalog** - Browse products by store with add-to-cart functionality  
- **Shopping Cart** - Manage cart items and checkout
- **Order Tracking** - Real-time order status tracking
- **Order History** - View past orders
- **User Profile** - Manage profile and settings

## Tech Stack

- **Language**: Kotlin
- **UI Framework**: Jetpack Compose
- **Architecture**: MVVM with Clean Architecture
- **Navigation**: Jetpack Navigation Compose
- **Networking**: Retrofit2 + OkHttp
- **Image Loading**: Coil
- **Local Storage**: DataStore Preferences
- **Dependency Injection**: Manual (ViewModel pattern)

## Project Structure

```
merchant-app/
├── app/
│   └── src/main/
│       ├── java/com/fikisha/customer/
│       │   ├── data/
│       │   │   ├── api/         # Network layer
│       │   │   ├── model/       # Data models
│       │   │   └── repository/  # Repository pattern
│       │   ├── ui/
│       │   │   ├── navigation/  # App navigation
│       │   │   ├── screens/     # UI screens
│       │   │   ├── theme/       # Material theming
│       │   │   └── viewmodel/  # ViewModels
│       │   └── MainActivity.kt
│       └── res/                # Android resources
├── build.gradle.kts            # Root build config
├── settings.gradle.kts        # Project settings
└── gradle/                    # Gradle wrapper
```

## Setup

1. **Prerequisites**:
   - Android Studio Arctic Fox or newer
   - JDK 17+
   - Android SDK 34

2. **Clone and Open**:
   - Open the `merchant-app` folder in Android Studio
   - Let Gradle sync and download dependencies

3. **Configure Backend URL**:
   - Use `api-base.example.properties` as a reference, then set `API_BASE_URL` in `local.properties` (or as an environment variable) to point to your backend server.
   - Example: `API_BASE_URL=http://10.0.2.2:3002/` for local emulator backend.
   - If not set, the app uses the default compiled URL.

4. **Build & Run**:
   - Connect a device or emulator
   - Click Run in Android Studio

## API Configuration

The app expects these backend endpoints:
- `POST /api/auth/login` - User authentication
- `GET /api/stores` - List all stores
- `GET /api/stores/{id}` - Get store details
- `GET /api/products/store/{storeId}` - Get store products
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order details
- `GET /api/orders/customer/{customerId}` - Get customer orders

## Screenshots

- Login screen with form validation
- Home screen with store listings
- Store detail with product catalog
- Shopping cart with checkout
- Order tracking with status updates
- Order history list
- User profile management

## License

Private - All rights reserved
