const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin to enable 16KB page size compatibility for Android 15+
 * Required by Google Play as of November 2025
 * 
 * Since React Native and third-party libraries may not be 16KB-aligned,
 * we use useLegacyPackaging = true to compress native libs.
 * This extracts libs at install time, bypassing alignment requirements.
 * 
 * Reference: https://developer.android.com/guide/practices/page-sizes
 */
function with16KBPages(config) {
  return withAppBuildGradle(config, (config) => {
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
}

module.exports = with16KBPages;
