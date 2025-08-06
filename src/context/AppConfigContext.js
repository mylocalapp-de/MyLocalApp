import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Types are expressed via JSDoc for better editor support without requiring TypeScript
/**
 * @typedef {Object.<string, string>} ConfigMap
 */

const AppConfigContext = createContext({
  /** @type {ConfigMap} */
  config: {},
  /** @type {boolean} */
  loading: true,
});

export const AppConfigProvider = ({ children }) => {
  /** @type {[ConfigMap, Function]} */
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.from('app_config').select('key, value');
        if (error) {
          console.error('[AppConfig] Failed to fetch configuration:', error);
        } else if (data) {
          const cfg = {};
          data.forEach(({ key, value }) => {
            cfg[key] = value;
          });
          setConfig(cfg);
        }
      } catch (err) {
        console.error('[AppConfig] Unexpected error while fetching configuration:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <AppConfigContext.Provider value={{ config, loading }}>
      {children}
    </AppConfigContext.Provider>
  );
};

export const useAppConfig = () => useContext(AppConfigContext); 