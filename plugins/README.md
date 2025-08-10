# Android Edge-to-Edge Plugin

This plugin enables edge-to-edge display mode for Android apps targeting SDK 35 or higher, ensuring compatibility with Android 15's edge-to-edge enforcement.

## What it does

1. **Uses EdgeToEdge.enable()**: Implements Google's recommended approach using `androidx.activity.EdgeToEdge.enable()` instead of the lower-level `WindowCompat.setDecorFitsSystemWindows()`.

2. **Ensures backward compatibility**: The EdgeToEdge API automatically handles edge-to-edge display on Android 15+ while maintaining compatibility with older Android versions.

3. **Adds required dependency**: Automatically includes the `androidx.activity:activity:1.9.0` dependency needed for the EdgeToEdge API.

4. **Sets transparent system bars**: Configures transparent status and navigation bars in the app theme as a fallback.

## Why this change was needed

Starting with Android 15, apps targeting SDK 35 are displayed edge-to-edge by default. Google Play Console warns developers to ensure their apps handle this properly to avoid UI elements being obscured by system bars. Using `EdgeToEdge.enable()` is the recommended approach that provides the best compatibility across Android versions.

## Implementation details

- The plugin modifies `MainActivity` to call `EdgeToEdge.enable(this)` before `setContentView()`
- It adds the necessary import statement for `androidx.activity.EdgeToEdge`
- It ensures the androidx.activity dependency is included in the app's build.gradle
- Theme modifications set transparent system bars as a fallback for older devices

This addresses the Google Play Console warning: "Edge-to-edge display may not work for all users"