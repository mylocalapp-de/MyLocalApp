import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Navigate to a screen from outside React components
 * @param {string} name - Screen name
 * @param {object} params - Navigation parameters
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    // Queue navigation for when navigator is ready
    console.warn('Navigation not ready, queuing navigation to:', name);
    setTimeout(() => navigate(name, params), 100);
  }
}

/**
 * Reset navigation state
 * @param {object} state - New navigation state
 */
export function reset(state) {
  if (navigationRef.isReady()) {
    navigationRef.reset(state);
  }
}

/**
 * Go back in navigation stack
 */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

/**
 * Get current route name
 * @returns {string|undefined} Current route name
 */
export function getCurrentRouteName() {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name;
  }
  return undefined;
}
