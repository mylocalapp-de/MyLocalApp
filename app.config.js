module.exports = {
  name: "MyLocalApp",
  slug: "mylocalapp-prototype",
  version: "1.0.0",
  orientation: "portrait",
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
    bundleIdentifier: "com.pkienast.mylocalappprototype"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.pkienast.mylocalappprototype"
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  updates: {
    url: "https://u.expo.dev/c24e6957-0c57-447c-b59c-9954f2d036f4"
  },
  runtimeVersion: "1.0.0",
  extra: {
    // Add environment variables here
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: "c24e6957-0c57-447c-b59c-9954f2d036f4"
    }
  },
  owner: "pkienast"
}; 