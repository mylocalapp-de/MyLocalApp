/**
 * FormInput — Reusable text input with label, error display, required marker,
 * and optional character counter.
 *
 * Props:
 *   label          – string
 *   value          – string
 *   onChangeText   – (text) => void
 *   error          – string | null (shown in red below input)
 *   required       – boolean (shows * after label)
 *   multiline      – boolean
 *   maxLength      – number (shows character counter)
 *   placeholder    – string
 *   secureTextEntry – boolean
 *   keyboardType   – string
 *   autoCapitalize – string
 *   editable       – boolean
 *   style          – override for the outer container
 *   inputStyle     – override for the TextInput
 *   numberOfLines  – number (for multiline)
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const FormInput = ({
  label,
  value = '',
  onChangeText,
  error,
  required = false,
  multiline = false,
  maxLength,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize,
  editable = true,
  style,
  inputStyle,
  numberOfLines,
  ...rest
}) => {
  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}

      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error && styles.inputError,
          !editable && styles.inputDisabled,
          inputStyle,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray500}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        multiline={multiline}
        maxLength={maxLength}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
      />

      <View style={styles.bottomRow}>
        {error ? <Text style={styles.errorText}>{error}</Text> : <View />}
        {maxLength ? (
          <Text style={styles.counter}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: colors.gray200,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    flex: 1,
  },
  counter: {
    color: colors.gray500,
    fontSize: 12,
  },
});

export default FormInput;
