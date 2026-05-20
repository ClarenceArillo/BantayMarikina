import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppIcon, Badge, EmergencyCard, PressScale, SectionHeader, SoftCard, useAppTheme } from '@/components/EmergencyUI';
import { Radius, Spacing, Typography } from '@/constants/theme';

const iconSources = {
  alert: require('@/assets/Icons/Alert.png'),
  arrow: require('@/assets/Icons/Arrow.png'),
  check: require('@/assets/Icons/Check.png'),
  cross: require('@/assets/Icons/Cross.png'),
  gears: require('@/assets/Icons/Gears.png'),
  hardhat: require('@/assets/Icons/Hardhat.png'),
  hotline: require('@/assets/Icons/Hotline.png'),
  pillar: require('@/assets/Icons/Pillar.png'),
  profile: require('@/assets/Icons/Profile.png'),
  safetyTips: require('@/assets/Icons/SafetyTipsRed.png'),
  shield: require('@/assets/Icons/Shield.png'),
};

const emergencyNumbers = [
  { number: '8-646-2436 TO 38', badge: 'Landline' },
  { number: '8-646-0427', badge: 'Landline' },
  { number: '7-116-5532', badge: 'Landline' },
  { number: '0917-584-2168', badge: 'GLOBE' },
  { number: '0928-559-3341', badge: 'SMART' },
  { number: '0998-997-0115', badge: 'SMART' },
  { number: '0998-579-6435', badge: 'SMART' },
];

const offices = [
  { name: "Mayor's Office", number: '8646-1634', icon: iconSources.pillar },
  { name: 'DSWD', number: '369-4132', icon: iconSources.profile },
  { name: 'Health Office', number: '997-1108 / 942-2359', icon: iconSources.cross },
  { name: 'Engineering', number: '8948-1201 / 948-1202', icon: iconSources.hardhat },
  { name: 'PNP Marikina', number: '8405-0091', icon: iconSources.shield },
];

const fireDepartments = [
  { barangay: 'Malanday', number: '998-7412' },
  { barangay: 'IVC', number: '477-7003' },
  { barangay: 'Central', number: '681-0233' },
  { barangay: 'Nangka', number: '586-4397' },
  { barangay: 'Concepcion Uno', number: '706-1663' },
  { barangay: 'Parang', number: '636-2915' },
];

async function copyNumber(number: string) {
  await Clipboard.setStringAsync(number);
  Alert.alert('Copied', `${number} copied to clipboard.`);
}

function Header() {
  const theme = useAppTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSoft }]}>
      <PressScale onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.primaryTint }]}>
        <Text style={[styles.backText, { color: theme.primary }]}>‹</Text>
      </PressScale>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Emergency Hotlines</Text>
        <Text style={[styles.headerSubtitle, { color: theme.muted }]}>Quick access to emergency services</Text>
      </View>
    </View>
  );
}

function MainHotlineCard() {
  return (
    <EmergencyCard colors={['#c93535', '#215582', '#153d61']} delay={40} style={styles.mainCard}>
      <View style={styles.mainTop}>
        <View style={styles.mainIconWrap}>
          <AppIcon source={iconSources.hotline} size={32} />
        </View>
        <Badge label="Available 24/7" tone="green" style={styles.availabilityBadge} />
      </View>
      <Text style={styles.mainLabel}>Marikina City Rescue</Text>
      <Text style={styles.mainNumber}>8-161</Text>
      <View style={styles.mainActions}>
        <PressScale onPress={() => copyNumber('8-161')} style={styles.primaryCallButton}>
          <Text style={styles.primaryCallText}>Copy Number</Text>
        </PressScale>
      </View>
    </EmergencyCard>
  );
}

function HotlineCard({ number, badge, delay }: { number: string; badge: string; delay: number }) {
  const theme = useAppTheme();
  const tone = badge === 'GLOBE' ? 'blue' : badge === 'SMART' ? 'green' : 'neutral';

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360).springify()} style={styles.hotlineCardWrap}>
      <View style={[styles.hotlineCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
        <View style={styles.hotlineNumberWrap}>
          <Text style={[styles.hotlineNumber, { color: theme.text }]}>{number}</Text>
          <Badge label={badge} tone={tone} />
        </View>
        <View style={styles.rowActions}>
          <PressScale onPress={() => copyNumber(number)} style={[styles.iconAction, { backgroundColor: theme.primaryTint }]}>
            <Text style={[styles.iconActionText, { color: theme.primary }]}>Copy</Text>
          </PressScale>
        </View>
      </View>
    </Animated.View>
  );
}

function OfficeRow({ item }: { item: (typeof offices)[number] }) {
  const theme = useAppTheme();

  return (
    <View style={[styles.officeRow, { borderBottomColor: theme.borderSoft }]}>
      <View style={[styles.officeIcon, { backgroundColor: theme.primaryTint }]}>
        <AppIcon source={item.icon} size={20} tintColor={theme.primary} />
      </View>
      <View style={styles.officeCopy}>
        <Text style={[styles.officeName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.officeNumber, { color: theme.muted }]}>{item.number}</Text>
      </View>
      <PressScale onPress={() => copyNumber(item.number)} style={[styles.smallCall, { backgroundColor: theme.primaryTint }]}>
        <Text style={[styles.smallCallText, { color: theme.primary }]}>Copy</Text>
      </PressScale>
    </View>
  );
}

function FireCard({ barangay, number }: { barangay: string; number: string }) {
  const theme = useAppTheme();

  return (
    <PressScale onPress={() => copyNumber(number)} style={[styles.fireCard, { backgroundColor: theme.orangeSoft, borderColor: theme.orange }]}>
      <View style={styles.fireTop}>
        <AppIcon source={iconSources.alert} size={20} />
        <Text style={[styles.fireBarangay, { color: theme.text }]} numberOfLines={1}>{barangay}</Text>
      </View>
      <Text style={[styles.fireNumber, { color: theme.orange }]}>{number}</Text>
    </PressScale>
  );
}

export default function HotlineScreen() {
  const theme = useAppTheme();
  const [officesOpen, setOfficesOpen] = useState(true);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MainHotlineCard />

        <SoftCard delay={120} style={styles.sectionCard}>
          <SectionHeader
            icon={iconSources.hotline}
            title="Other Hotlines"
            subtitle="Copy numbers for quick sharing"
          />
          <View style={styles.hotlineGrid}>
            {emergencyNumbers.map((item, index) => (
              <HotlineCard key={item.number} number={item.number} badge={item.badge} delay={160 + index * 35} />
            ))}
          </View>
        </SoftCard>

        <SoftCard delay={220} style={styles.sectionCard}>
          <PressScale onPress={() => setOfficesOpen((value) => !value)} style={styles.officeHeaderPress}>
            <SectionHeader
              icon={iconSources.pillar}
              title="Government Offices"
              subtitle="City service offices and support desks"
              action={<Text style={[styles.expandText, { color: theme.primary }]}>{officesOpen ? 'Hide' : 'Show'}</Text>}
            />
          </PressScale>
          {officesOpen ? (
            <View style={styles.officeList}>
              {offices.map((item) => <OfficeRow key={item.name} item={item} />)}
            </View>
          ) : null}
        </SoftCard>

        <SoftCard delay={280} style={styles.sectionCard}>
          <SectionHeader
            icon={iconSources.alert}
            title="Barangay Fire Departments"
            subtitle="Direct station numbers by response area"
          />
          <View style={styles.fireGrid}>
            {fireDepartments.map((item) => (
              <FireCard key={item.barangay} barangay={item.barangay} number={item.number} />
            ))}
          </View>
        </SoftCard>

        <LinearGradient colors={['#f1f7fc', '#ffffff']} style={[styles.footerNote, { borderColor: theme.borderSoft }]}>
          <AppIcon source={iconSources.safetyTips} size={22} />
          <Text style={[styles.footerText, { color: theme.muted }]}>
            In immediate danger, call the main rescue hotline first and share your exact location.
          </Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    elevation: 5,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backText: {
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 36,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.title,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 3,
  },
  content: {
    gap: Spacing.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  mainCard: {
    minHeight: 246,
  },
  mainTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mainIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  availabilityBadge: {
    backgroundColor: 'rgba(228,247,237,0.95)',
  },
  mainLabel: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
    marginTop: Spacing.xl,
  },
  mainNumber: {
    color: '#ffffff',
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 68,
  },
  mainActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  primaryCallButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: Radius.pill,
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },
  primaryCallText: {
    color: '#c93535',
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
  },
  sectionCard: {
    padding: Spacing.lg,
  },
  hotlineGrid: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  hotlineCardWrap: {
    borderRadius: Radius.lg,
  },
  hotlineCard: {
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 78,
    padding: Spacing.md,
  },
  hotlineNumberWrap: {
    flex: 1,
    gap: Spacing.sm,
  },
  hotlineNumber: {
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconAction: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  iconActionText: {
    fontSize: Typography.caption,
    fontWeight: '900',
  },
  officeHeaderPress: {
    borderRadius: Radius.lg,
  },
  expandText: {
    fontSize: Typography.body,
    fontWeight: '900',
  },
  officeList: {
    marginTop: Spacing.lg,
  },
  officeRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 68,
    paddingVertical: Spacing.sm,
  },
  officeIcon: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  officeCopy: {
    flex: 1,
  },
  officeName: {
    fontSize: Typography.body,
    fontWeight: '900',
  },
  officeNumber: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 3,
  },
  smallCall: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 62,
  },
  smallCallText: {
    fontSize: Typography.caption,
    fontWeight: '900',
  },
  fireGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  fireCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    minHeight: 96,
    padding: Spacing.md,
    width: '47.8%',
  },
  fireTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fireBarangay: {
    flex: 1,
    fontSize: Typography.body,
    fontWeight: '900',
  },
  fireNumber: {
    fontSize: Typography.title,
    fontWeight: '900',
    marginTop: Spacing.lg,
  },
  footerNote: {
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  footerText: {
    flex: 1,
    fontSize: Typography.caption,
    fontWeight: '700',
    lineHeight: 17,
  },
});
