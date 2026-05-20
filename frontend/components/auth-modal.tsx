import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';

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
  const theme = useAppTheme();
  const isSuccess = status === 'success';

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.iconCircle, { backgroundColor: isSuccess ? theme.successSoft : theme.dangerSoft }]}>
            <Text style={[styles.iconMark, { color: isSuccess ? theme.success : theme.danger }]}>{isSuccess ? 'OK' : '!'}</Text>
          </View>
          <Text style={[styles.statusTitle, { color: isSuccess ? theme.success : theme.danger }]}>{title}</Text>
          {message ? <Text style={[styles.statusMessage, { color: theme.muted }]}>{message}</Text> : null}
          <Pressable style={[styles.statusButton, { backgroundColor: theme.primary }]} onPress={onClose}>
            <Text style={styles.statusButtonText}>{buttonTitle}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function OptionModal({ onClose, onSelect, options, title, visible }: OptionModalProps) {
  const theme = useAppTheme();

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.optionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.optionTitle, { color: theme.primary }]}>{title}</Text>
          <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
            {options.map((option) => (
              <Pressable key={option} style={[styles.optionRow, { borderColor: theme.border }]} onPress={() => onSelect(option)}>
                <Text style={[styles.optionText, { color: theme.text }]}>{option}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: 14,
    minHeight: 250,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 36,
    width: 278,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 41,
    height: 83,
    justifyContent: 'center',
    width: 82,
  },
  iconMark: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  statusButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 43,
    justifyContent: 'center',
    marginTop: 14,
    width: 192,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  optionCard: {
    borderRadius: 12,
    maxHeight: '78%',
    maxWidth: 340,
    padding: 18,
    width: '100%',
  },
  optionTitle: {
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
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 15,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 14,
    padding: 8,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
