// Enable edge-to-edge using the recommended enableEdgeToEdge() function from androidx.activity
// This ensures proper backward compatibility for Android 15 when targeting SDK 35
// 
// Note: In Expo SDK 53+ with RN 0.79+, edge-to-edge is largely handled automatically.
// This plugin only injects the enableEdgeToEdge() call for full backward compatibility.

const {
  withMainActivity,
  withAppBuildGradle,
} = require('@expo/config-plugins');

const EDGE_TO_EDGE_ID = 'edge-to-edge-mainActivity-onCreate';

function withAndroidEdgeToEdge(config) {
  // Inject EdgeToEdge.enable() call into MainActivity.onCreate
  config = withMainActivity(config, (config) => {
    const isJava = config.modResults.language === 'java';
    const LE = isJava ? ';' : '';

    // Add imports for enableEdgeToEdge
    if (isJava) {
      if (!config.modResults.contents.includes('import androidx.activity.EdgeToEdge;')) {
        config.modResults.contents = config.modResults.contents.replace(
          /package [^;]+;\s*/,
          (m) => `${m}\nimport androidx.activity.EdgeToEdge;\n`
        );
      }
    } else {
      // Kotlin - use the enableEdgeToEdge function import
      if (!config.modResults.contents.includes('import androidx.activity.enableEdgeToEdge')) {
        config.modResults.contents = config.modResults.contents.replace(
          /package [^\n]+\n/,
          (m) => `${m}import androidx.activity.enableEdgeToEdge\n`
        );
      }
    }

    // Insert enableEdgeToEdge() after super.onCreate
    const anchorRegex = /(^.*super\.onCreate\(.*\).*$)/m;
    const enableSrc = isJava 
      ? `EdgeToEdge.enable(this)${LE}`
      : `enableEdgeToEdge()${LE}`;

    if (!config.modResults.contents.includes(EDGE_TO_EDGE_ID)) {
      const lines = config.modResults.contents.split('\n');
      const superOnCreateIdx = lines.findIndex((l) => anchorRegex.test(l));
      
      if (superOnCreateIdx !== -1) {
        // Insert enableEdgeToEdge() right after super.onCreate
        lines.splice(superOnCreateIdx + 1, 0, `        // ${EDGE_TO_EDGE_ID}`, `        ${enableSrc}`);
        config.modResults.contents = lines.join('\n');
      }
    }

    return config;
  });

  // Ensure androidx.activity dependency is included
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("androidx.activity:activity")) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {
    implementation 'androidx.activity:activity-ktx:1.9.0'`
      );
    }
    return config;
  });

  return config;
}

module.exports = withAndroidEdgeToEdge;

