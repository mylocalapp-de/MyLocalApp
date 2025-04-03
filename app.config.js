module.exports = {
  name: "MeinHavelaue",
  slug: "meinhavelaue",
  version: "1.0.0",
  orientation: "portrait",
  // TODO: Replace with properly square (1024x1024) icon images
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
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
      NSPhotoLibraryUsageDescription: "Wir benötigen Zugriff auf deine Fotos, damit du Bilder an Nachrichten anhängen kannst."
    }
  },
  android: {
    adaptiveIcon: {
      // TODO: Replace with properly square (1024x1024) adaptiveIcon image
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.pkienast.meinhavelaue",
    config: {
      googleMaps: {
        apiKey: "AIzaSyBahIjWqhGvO9_fn_e1pz4RZUQkeMprdT4"
      }
    }
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
    eas: {
      projectId: "3adb5b7e-7622-44f3-9375-5f23371e77b7"
    }
  },
  owner: "pkienast"
}; 