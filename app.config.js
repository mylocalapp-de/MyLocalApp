module.exports = {
  name: "MeinStrodehne",
  slug: "meinhavelaue",
  version: "1.0.5",
  // Allow all orientations to comply with large-screen guidance (Android 16+)
  // Square 1024x1024 icon
  icon: "./assets/fixed/icon.png",
  userInterfaceStyle: "light",
  // Remove androidStatusBar and androidNavigationBar configs
  // as EdgeToEdge.enable() will handle the system bars automatically
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pkienast.meinhavelaue",
    infoPlist: {
      NSPhotoLibraryUsageDescription: "Die Foto-Mediathek wird benötigt, damit du Fotos auswählen und z.B. an Artikel oder Chat-Nachrichten anhängen kannst.",
      TermsOfServiceURL: "https://mylocalapp.de/agb",
      PrivacyPolicyURL: "https://mylocalapp.de/datenschutz"
    }
  },
  android: {
    adaptiveIcon: {
      // Square 1024x1024 adaptiveIcon
      foregroundImage: "./assets/fixed/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.pkienast.meinhavelaue",
    config: {
      googleMaps: {
        apiKey: "AIzaSyBahIjWqhGvO9_fn_e1pz4RZUQkeMprdT4"
      }
    },
    manifest: {
      usesPermissions: [],
      application: {
        metaData: {
          "com.google.android.termsOfService": "https://mylocalapp.de/agb",
          "com.google.android.privacyPolicy": "https://mylocalapp.de/datenschutz"
        }
      }
    },
    googleServicesFile: "./google-services.json"
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  updates: {
    url: "https://u.expo.dev/3adb5b7e-7622-44f3-9375-5f23371e77b7"
  },
  runtimeVersion: "1.0.0",
  extra: {
    // Add environment variables here
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Add RevenueCat keys
    revenueCatApiKeyAndroid: process.env.REVENUECAT_API_KEY_ANDROID,
    revenueCatApiKeyIos: process.env.REVENUECAT_API_KEY_IOS,
    // Feature toggles
    enableIosIap: process.env.ENABLE_IOS_IAP,
    enableAndroidIap: process.env.ENABLE_ANDROID_IAP,
    disableMap: process.env.EXPO_PUBLIC_DISABLE_MAP,
    disableVerify: process.env.EXPO_PUBLIC_DISABLE_VERIFY,
    eas: {
      projectId: "3adb5b7e-7622-44f3-9375-5f23371e77b7"
    }
  },
  owner: "pkienast",
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",
          kotlinVersion: "1.9.25",
          composeCompilerVersion: "1.5.15"
        }
      }
    ],
    "./plugins/with-android-edge-to-edge",
    "expo-font"
  ]
}; 