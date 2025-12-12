const { withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to enable 16KB page size compatibility for Android 15+
 * Required by Google Play as of November 2025
 * 
 * Since React Native and third-party libraries may not be 16KB-aligned,
 * we use TWO approaches:
 * 1. Set useLegacyPackaging = true in build.gradle
 * 2. Set android:extractNativeLibs="true" in AndroidManifest.xml
 * 
 * This compresses native libs and extracts them at install time,
 * bypassing the 16KB alignment requirements.
 * 
 * Reference: https://developer.android.com/guide/practices/page-sizes
 */
function with16KBPages(config) {
  // 1. Modify build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('useLegacyPackaging')) {
      return config;
    }

    // Find the android { } block and add packaging config
    const androidBlockRegex = /(android\s*\{)/;
    const packagingConfig = `$1
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }`;

    config.modResults.contents = config.modResults.contents.replace(
      androidBlockRegex,
      packagingConfig
    );

    return config;
  });

  // 2. Modify AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    // Set extractNativeLibs to true - this ensures native libs are extracted
    // at install time, which bypasses 16KB alignment requirements
    mainApplication.$['android:extractNativeLibs'] = 'true';
    
    return config;
  });

  return config;
}

module.exports = with16KBPages;
