import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

type AuthStatusModalProps = {
  buttonTitle: string;
  message?: string;
  onClose: () => void;
  status: 'success' | 'error';
  title: string;
  visible: boolean;
};

type OptionModalProps = {
  onClose: () => void;
  onSelect: (value: string) => void;
  options: string[];
  title: string;
  visible: boolean;
};

export function AuthStatusModal({
  buttonTitle,
  message,
  onClose,
  status,
  title,
  visible,
}: AuthStatusModalProps) {
  const isSuccess = status === 'success';

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.statusCard}>
          <View style={[styles.iconCircle, isSuccess ? styles.successIcon : styles.errorIcon]}>
            <Text style={styles.iconMark}>{isSuccess ? '✓' : '!'}</Text>
          </View>
          <Text style={[styles.statusTitle, isSuccess ? styles.successTitle : styles.errorTitle]}>
            {title}
          </Text>
          {message ? <Text style={styles.statusMessage}>{message}</Text> : null}
          <Pressable style={styles.statusButton} onPress={onClose}>
            <Text style={styles.statusButtonText}>{buttonTitle}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function OptionModal({ onClose, onSelect, options, title, visible }: OptionModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.optionCard}>
          <Text style={styles.optionTitle}>{title}</Text>
          <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
            {options.map((option) => (
              <Pressable key={option} style={styles.optionRow} onPress={() => onSelect(option)}>
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    height: 250,
    overflow: 'hidden',
    paddingTop: 41,
    width: 278,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 41,
    height: 83,
    justifyContent: 'center',
    width: 82,
  },
  successIcon: {
    backgroundColor: '#e4f8d9',
  },
  errorIcon: {
    backgroundColor: '#fde1e1',
  },
  iconMark: {
    color: '#2d75b4',
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 48,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  successTitle: {
    color: '#589f39',
  },
  errorTitle: {
    color: '#d53939',
  },
  statusMessage: {
    color: Colors.light.placeholder,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  statusButton: {
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 5,
    height: 43,
    justifyContent: 'center',
    marginTop: 12,
    width: 192,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    maxHeight: '78%',
    padding: 18,
    width: '100%',
    maxWidth: 340,
  },
  optionTitle: {
    color: Colors.light.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  optionList: {
    maxHeight: 420,
  },
  optionListContent: {
    gap: 8,
  },
  optionRow: {
    borderColor: Colors.light.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    color: Colors.light.black,
    fontSize: 15,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 14,
    padding: 8,
  },
  cancelText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
