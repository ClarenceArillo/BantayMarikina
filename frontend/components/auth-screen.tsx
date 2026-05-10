import { Image, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

type AuthScreenProps = ViewProps & {
  children: React.ReactNode;
  logoMode?: 'full' | 'mark';
  title: string;
};

export function AuthScreen({ children, logoMode = 'full', style, title }: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, style]}>
        <Image
          source={require('@/assets/Logo/BantayMarikinaLogo.png')}
          style={logoMode === 'mark' ? styles.logoMark : styles.logoFull}
        />
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.light.background,
  },
  logoFull: {
    width: 116,
    height: 110,
    marginTop: 48,
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  logoMark: {
    width: 230,
    height: 92,
    marginTop: 46,
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  title: {
    marginTop: 28,
    marginBottom: 26,
    color: Colors.light.primary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
});
