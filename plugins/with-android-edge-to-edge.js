// Enable edge-to-edge using the recommended EdgeToEdge.enable() method from androidx.activity
// This ensures proper backward compatibility for Android 15 when targeting SDK 35

const {
  withMainActivity,
  withAndroidStyles,
  AndroidConfig,
  withAppBuildGradle,
} = require('@expo/config-plugins');

const EDGE_TO_EDGE_ID = 'edge-to-edge-mainActivity-onCreate';

function withAndroidTransparentWindow(config) {
  // No longer need to manually set transparent colors in theme as EdgeToEdge.enable() handles this
  // But we'll keep them for older devices that might not fully support the new API
  config = withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeLightNoActionBarGroup(),
      name: 'android:statusBarColor',
      value: '@android:color/transparent',
    });

    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeLightNoActionBarGroup(),
      name: 'android:navigationBarColor',
      value: '@android:color/transparent',
    });

    return config;
  });

  // Inject EdgeToEdge.enable() call into MainActivity.onCreate before setContentView
  config = withMainActivity(config, (config) => {
    const isJava = config.modResults.language === 'java';
    const LE = isJava ? ';' : '';

    // Add imports for EdgeToEdge
    if (isJava) {
      if (!config.modResults.contents.includes('import androidx.activity.EdgeToEdge;')) {
        config.modResults.contents = config.modResults.contents.replace(
          /package [^;]+;\s*/,
          (m) => `${m}\nimport androidx.activity.EdgeToEdge;\n`
        );
      }
    } else {
      // Kotlin
      if (!config.modResults.contents.includes('import androidx.activity.EdgeToEdge')) {
        config.modResults.contents = config.modResults.contents.replace(
          /package [^\n]+\n/,
          (m) => `${m}import androidx.activity.EdgeToEdge\n`
        );
      }
    }

    // Insert EdgeToEdge.enable() before setContentView
    const anchorRegex = /(^.*super\.onCreate\(.*\).*$)/m;
    const enableSrc = `\n                EdgeToEdge.enable(this)${LE}\n            `;

    if (!config.modResults.contents.includes(EDGE_TO_EDGE_ID)) {
      const lines = config.modResults.contents.split('\n');
      const superOnCreateIdx = lines.findIndex((l) => anchorRegex.test(l));
      
      if (superOnCreateIdx !== -1) {
        // Find setContentView after super.onCreate
        let setContentViewIdx = -1;
        for (let i = superOnCreateIdx + 1; i < lines.length; i++) {
          if (lines[i].includes('setContentView')) {
            setContentViewIdx = i;
            break;
          }
        }
        
        if (setContentViewIdx !== -1) {
          // Insert EdgeToEdge.enable() just before setContentView
          lines.splice(setContentViewIdx, 0, `// ${EDGE_TO_EDGE_ID}`, ...enableSrc.split('\n'));
          config.modResults.contents = lines.join('\n');
        } else {
          // If no setContentView found, insert after super.onCreate as fallback
          lines.splice(superOnCreateIdx + 1, 0, `// ${EDGE_TO_EDGE_ID}`, ...enableSrc.split('\n'));
          config.modResults.contents = lines.join('\n');
        }
      }
    }

    return config;
  });

  // Ensure androidx.activity dependency is included
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("androidx.activity:activity")) {
      // Add the dependency if not already present
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {
    implementation 'androidx.activity:activity:1.9.0'`
      );
    }
    return config;
  });

  return config;
}

module.exports = withAndroidTransparentWindow;

