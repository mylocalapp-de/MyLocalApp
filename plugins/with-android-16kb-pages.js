const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin to enable 16KB page size support for Android 15+
 * Required by Google Play as of 2024
 * 
 * Sets useLegacyPackaging = false which ensures native libs are stored
 * uncompressed and page-aligned in the APK/AAB.
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
            useLegacyPackaging = false
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
