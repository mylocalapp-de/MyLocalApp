import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import {
    saveOfflineData,
    loadOfflineData,
    saveOfflineModeStatus,
    loadOfflineModeStatus,
    saveLastOfflineSaveTimestamp,
    loadLastOfflineSaveTimestamp
} from '../utils/storageUtils';
import { supabase } from '../lib/supabase'; // Import supabase for data fetching

// Create context
const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(true); // Assume connected initially
    const [isOfflineMode, setIsOfflineMode] = useState(false); // Whether user chose offline mode
    const [lastOfflineSaveTimestamp, setLastOfflineSaveTimestamp] = useState(null);
    const [isSavingData, setIsSavingData] = useState(false); // Loading state for save button
    const [initialCheckDone, setInitialCheckDone] = useState(false); // Track initial network check

    // Keep refs for latest values inside event handlers
    const isOfflineModeRef = useRef(isOfflineMode);
    useEffect(() => { isOfflineModeRef.current = isOfflineMode; }, [isOfflineMode]);
    const initialCheckDoneRef = useRef(initialCheckDone);
    useEffect(() => { initialCheckDoneRef.current = initialCheckDone; }, [initialCheckDone]);

    // Subscribe to network changes once on mount
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const isDefinitelyOffline = state.isConnected === false || state.isInternetReachable === false;
            const currentlyConnected = !isDefinitelyOffline;

            console.log('[NetworkContext] Network State Change:', state);
            console.log(`[NetworkContext] isConnected: ${state.isConnected}, isInternetReachable: ${state.isInternetReachable}, Effective: ${currentlyConnected}`);

            setIsConnected(currentlyConnected);

            if (!initialCheckDoneRef.current) {
                if (state.isConnected === false && !isOfflineModeRef.current) {
                    console.log('[NetworkContext] Initial check: No connection detected (isConnected=false). Prompting offline mode.');
                    promptOfflineMode();
                } else {
                    console.log('[NetworkContext] Initial check: Connection detected or already in offline mode.');
                }
                initialCheckDoneRef.current = true;
                setInitialCheckDone(true);
                return; // avoid running subsequent logic on first pass
            }

            if (isDefinitelyOffline && !isOfflineModeRef.current) {
                console.log('[NetworkContext] Subsequent check: Connection lost and not in offline mode. Prompting offline mode.');
                promptOfflineMode();
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Load initial state once on mount (non-sticky offline mode)
    useEffect(() => {
        const loadInitialState = async () => {
            const storedTimestamp = await loadLastOfflineSaveTimestamp();
            setIsOfflineMode(false);
            await saveOfflineModeStatus(false);
            setLastOfflineSaveTimestamp(storedTimestamp);
            console.log(`[NetworkContext] Initial Load: isOfflineMode reset to false, lastSave=${storedTimestamp}`);
        };
        loadInitialState();
    }, []);

    // Track whether the offline prompt is currently shown to avoid duplicates
    const isPromptOpenRef = useRef(false);

    // Function to prompt the user about offline mode
    const promptOfflineMode = () => {
        // Prevent prompt if already in offline mode or a prompt is currently open
        if (isOfflineModeRef.current || isPromptOpenRef.current) return;

        isPromptOpenRef.current = true;
        Alert.alert(
            "Keine Internetverbindung",
            "Keine Internetverbindung gefunden. Willst du in den Offline-Modus wechseln?",
            [
                {
                    text: "Offline Modus",
                    onPress: () => {
                        isPromptOpenRef.current = false;
                        toggleOfflineMode(true);
                    },
                },
                {
                    text: "Abbrechen",
                    style: "cancel",
                    onPress: () => {
                        isPromptOpenRef.current = false;
                        console.log("Offline mode cancelled by user.");
                    },
                },
            ],
            { cancelable: false }
        );
    };

    // Function to toggle offline mode manually
    const toggleOfflineMode = useCallback(async (offline) => {
        console.log(`[NetworkContext] Toggling offline mode to: ${offline}`);
        setIsOfflineMode(offline);
        await saveOfflineModeStatus(offline);
        if (offline && !isConnected) {
             console.log("[NetworkContext] Entered offline mode while disconnected.");
        }
        if (!offline && isConnected) {
             console.log("[NetworkContext] Exited offline mode while connected.");
             // Potentially trigger data refresh here if needed
        }
    }, [isConnected]);

    // Function to fetch and save necessary data for offline use
    const saveDataForOffline = useCallback(async () => {
        if (!isConnected) {
            Alert.alert("Keine Verbindung", "Du benötigst eine Internetverbindung, um Offline-Daten zu speichern.");
            return { success: false, error: "No internet connection" };
        }
        if (isSavingData) {
            console.log("[NetworkContext] Data saving already in progress.");
            return { success: false, error: "Saving already in progress"};
        }

        console.log("[NetworkContext] Starting offline data save...");
        setIsSavingData(true);
        let success = true;
        let errorMsg = null;

        try {
            // Fetch and save data concurrently
            const [articlesResult, filtersResult, eventsResult, chatGroupsResult] = await Promise.allSettled([
                supabase
                    .from('article_listings')
                    .select('*')
                    .order('published_at', { ascending: false }),
                supabase
                    .from('article_filters')
                    .select('name, is_highlighted')
                    .order('display_order', { ascending: true }),
                supabase
                    .from('event_listings')
                    .select('*'), // Fetch all event data including recurrence
                supabase
                    .from('chat_group_listings')
                    .select('*')
                    .neq('type', 'bot'), // Exclude bots
            ]);

            // Process Articles
            if (articlesResult.status === 'fulfilled' && !articlesResult.value.error) {
                await saveOfflineData('articles', articlesResult.value.data || []);
                console.log(`[NetworkContext] Saved ${articlesResult.value.data?.length ?? 0} articles.`);
            } else {
                console.error("[NetworkContext] Error fetching articles:", articlesResult.reason || articlesResult.value.error);
                throw new Error("Artikel konnten nicht geladen werden."); // Throw error if critical data fails
            }

            // Process Article Filters
            if (filtersResult.status === 'fulfilled' && !filtersResult.value.error) {
                await saveOfflineData('article_filters', filtersResult.value.data || []);
                console.log(`[NetworkContext] Saved ${filtersResult.value.data?.length ?? 0} filters.`);
            } else {
                console.error("[NetworkContext] Error fetching article filters:", filtersResult.reason || filtersResult.value.error);
                // Decide if this is critical enough to throw
            }

            // Process Events
            if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
                await saveOfflineData('events', eventsResult.value.data || []);
                console.log(`[NetworkContext] Saved ${eventsResult.value.data?.length ?? 0} events.`);
            } else {
                console.error("[NetworkContext] Error fetching events:", eventsResult.reason || eventsResult.value.error);
                throw new Error("Events konnten nicht geladen werden.");
            }

            // Process Chat Groups
            if (chatGroupsResult.status === 'fulfilled' && !chatGroupsResult.value.error) {
                await saveOfflineData('chat_groups', chatGroupsResult.value.data || []);
                console.log(`[NetworkContext] Saved ${chatGroupsResult.value.data?.length ?? 0} chat groups.`);
            } else {
                console.error("[NetworkContext] Error fetching chat groups:", chatGroupsResult.reason || chatGroupsResult.value.error);
                throw new Error("Chat-Gruppen konnten nicht geladen werden.");
            }

            // --- Update Timestamp ---
            const now = Date.now();
            setLastOfflineSaveTimestamp(now);
            await saveLastOfflineSaveTimestamp(now);
            console.log("[NetworkContext] Offline data save completed successfully.");

        } catch (err) {
            console.error("[NetworkContext] Error during offline data save:", err);
            success = false;
            errorMsg = err.message || "Ein Fehler ist beim Speichern aufgetreten.";
            Alert.alert("Speichern fehlgeschlagen", errorMsg);
        } finally {
            setIsSavingData(false);
        }

        return { success, error: errorMsg };
    }, [isConnected, isSavingData]); // Add dependencies


    const value = {
        isConnected,
        isOfflineMode,
        lastOfflineSaveTimestamp,
        isSavingData,
        toggleOfflineMode,
        saveDataForOffline,
    };

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
};

// Custom hook to use the context
export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
}; 