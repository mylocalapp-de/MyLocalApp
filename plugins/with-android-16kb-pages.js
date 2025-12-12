const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Config plugin to enable 16KB page size support for Android 15+
 * Required by Google Play as of 2024
 */
function with16KBPages(config) {
  // Add gradle.properties entries
  config = withGradleProperties(config, (config) => {
    // Remove any existing entries to avoid duplicates
    config.modResults = config.modResults.filter(
      (item) =>
        !(item.type === 'property' && 
          (item.key === 'android.bundle.enableUncompressedNativeLibs' ||
           item.key === 'android.experimental.enableNewResourceShrinker.preciseShrinking'))
    );

    // Add the properties for 16KB page support
    config.modResults.push({
      type: 'property',
      key: 'android.bundle.enableUncompressedNativeLibs',
      value: 'false',
    });

    return config;
  });

  // Add packagingOptions to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('jniLibs.useLegacyPackaging')) {
      return config;
    }

    // Find the android { } block and add packagingOptions
    const androidBlockRegex = /(android\s*\{)/;
    const packagingOptions = `$1
    packagingOptions {
        jniLibs {
            useLegacyPackaging = false
        }
    }`;

    config.modResults.contents = config.modResults.contents.replace(
      androidBlockRegex,
      packagingOptions
    );

    return config;
  });

  return config;
}

module.exports = with16KBPages;
