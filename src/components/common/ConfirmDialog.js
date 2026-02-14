/**
 * ConfirmDialog — Wrapper around Alert.alert that returns a Promise.
 *
 * Usage:
 *   import { useConfirm } from '../components/common/ConfirmDialog';
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm('Wirklich löschen?', { destructive: true });
 *   if (ok) { ... }
 *
 * Also exports a plain function for non-hook contexts:
 *   import { confirmAlert } from '../components/common/ConfirmDialog';
 *   const ok = await confirmAlert('Titel', 'Nachricht', { destructive: true });
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';

/**
 * Show a confirm/cancel alert and return a Promise<boolean>.
 *
 * @param {string} title
 * @param {string} [message]
 * @param {Object} [opts]
 * @param {boolean} [opts.destructive=false]
 * @param {string}  [opts.confirmText='OK']
 * @param {string}  [opts.cancelText='Abbrechen']
 */
export function confirmAlert(title, message, opts = {}) {
  const {
    destructive = false,
    confirmText = 'OK',
    cancelText = 'Abbrechen',
  } = opts;

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * React hook wrapping confirmAlert for convenient use inside components.
 *
 * @returns {(title: string, opts?: Object) => Promise<boolean>}
 */
export function useConfirm() {
  return useCallback(
    (title, opts = {}) => confirmAlert(title, opts.message, opts),
    []
  );
}

export default { confirmAlert, useConfirm };
