import { memo, useMemo, useState } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AppIcon, BackButton, Badge, PressScale, useAppTheme } from '@/components/EmergencyUI';
import { Radius, Spacing, Typography } from '@/constants/theme';

type SafetyPhase = 'before' | 'during' | 'after';
type HazardKey = 'typhoon' | 'earthquake' | 'fire' | 'landslide' | 'flashFlood' | 'extremeHeat';

type SafetySection = {
  title: string;
  tone: 'blue' | 'orange' | 'red' | 'yellow' | 'green';
  tips: string[];
  highlight?: string;
};

type HazardTip = {
  key: HazardKey;
  label: string;
  subtitle: string;
  icon: ImageSourcePropType;
  sections: Record<SafetyPhase, SafetySection>;
};

const iconSources = {
  typhoon: require('@/assets/Icons/Typhoon.png'),
  earthquake: require('@/assets/Icons/EarthquakeIcon.png'),
  fire: require('@/assets/Icons/FireIcon.png'),
  landslide: require('@/assets/Icons/LandslideIcon.png'),
  flashFlood: require('@/assets/Icons/Flood.png'),
  extremeHeat: require('@/assets/Icons/HeatIcon.png'),
};

const phaseIcons = {
  before: require('@/assets/Icons/SafetyTips.png'),
  during: require('@/assets/Icons/RedFlag.png'),
  after: require('@/assets/Icons/Success.png'),
};

const hazardTips: HazardTip[] = [
  {
    key: 'typhoon',
    label: 'Typhoon',
    subtitle: 'Strong winds and heavy rain',
    icon: iconSources.typhoon,
    sections: {
      before: {
        title: 'Before',
        tone: 'blue',
        tips: ['Charge phones and power banks.', 'Secure loose roof sheets, pots, and signs.', 'Prepare drinking water, medicine, flashlight, and radio.'],
        highlight: 'Move important documents to a dry bag.',
      },
      during: {
        title: 'During',
        tone: 'red',
        tips: ['Stay indoors and away from windows.', 'Avoid flooded roads and riverbanks.', 'Follow official evacuation instructions early.'],
      },
      after: {
        title: 'After',
        tone: 'green',
        tips: ['Check for damaged wires before switching power on.', 'Boil water if supply looks dirty.', 'Report blocked roads or hazards in the app.'],
      },
    },
  },
  {
    key: 'earthquake',
    label: 'Earthquake',
    subtitle: 'Ground shaking and aftershocks',
    icon: iconSources.earthquake,
    sections: {
      before: {
        title: 'Before',
        tone: 'blue',
        tips: ['Know safe spots under sturdy tables.', 'Strap shelves and heavy appliances.', 'Agree on a family meeting place.'],
      },
      during: {
        title: 'During',
        tone: 'red',
        tips: ['Drop, cover, and hold on.', 'Stay away from glass and hanging objects.', 'Do not use elevators.'],
        highlight: 'If outside, move to an open area away from posts and buildings.',
      },
      after: {
        title: 'After',
        tone: 'orange',
        tips: ['Expect aftershocks.', 'Check for injuries and gas leaks.', 'Leave damaged buildings calmly.'],
      },
    },
  },
  {
    key: 'fire',
    label: 'Fire',
    subtitle: 'Smoke, flames, and evacuation',
    icon: iconSources.fire,
    sections: {
      before: {
        title: 'Before',
        tone: 'blue',
        tips: ['Keep exits clear.', 'Check LPG hoses and electrical cords.', 'Teach everyone where the extinguisher is.'],
      },
      during: {
        title: 'During',
        tone: 'red',
        tips: ['Get out first, then call for help.', 'Stay low under smoke.', 'Do not go back inside for belongings.'],
        highlight: 'Call emergency responders once you are safe.',
      },
      after: {
        title: 'After',
        tone: 'orange',
        tips: ['Wait for clearance before re-entering.', 'Avoid touching burnt wires or metal.', 'Document damage only when safe.'],
      },
    },
  },
  {
    key: 'landslide',
    label: 'Landslide',
    subtitle: 'Soil movement and slope danger',
    icon: iconSources.landslide,
    sections: {
      before: {
        title: 'Before',
        tone: 'yellow',
        tips: ['Watch for cracks on walls, roads, or soil.', 'Clear drainage near slopes.', 'Prepare to leave during long heavy rain.'],
      },
      during: {
        title: 'During',
        tone: 'red',
        tips: ['Move away from slopes fast.', 'Avoid crossing active mudflow.', 'Warn nearby neighbors if safe.'],
      },
      after: {
        title: 'After',
        tone: 'orange',
        tips: ['Stay away from the slide area.', 'Report new cracks or blocked canals.', 'Wait for city assessment before returning.'],
      },
    },
  },
  {
    key: 'flashFlood',
    label: 'Flash Flood',
    subtitle: 'Fast rising water',
    icon: iconSources.flashFlood,
    sections: {
      before: {
        title: 'Before',
        tone: 'blue',
        tips: ['Know your nearest evacuation site.', 'Keep valuables above floor level.', 'Prepare slippers, rain gear, and a go-bag.'],
      },
      during: {
        title: 'During',
        tone: 'red',
        tips: ['Move to higher ground immediately.', 'Never walk or drive through moving water.', 'Turn off electricity if water enters your home.'],
        highlight: 'Leave early when water starts rising.',
      },
      after: {
        title: 'After',
        tone: 'green',
        tips: ['Avoid floodwater if you have wounds.', 'Clean and disinfect wet surfaces.', 'Throw away food touched by floodwater.'],
      },
    },
  },
  {
    key: 'extremeHeat',
    label: 'Extreme Heat',
    subtitle: 'High heat index and dehydration risk',
    icon: iconSources.extremeHeat,
    sections: {
      before: {
        title: 'Before',
        tone: 'yellow',
        tips: ['Plan outdoor tasks before 10AM or after 4PM.', 'Prepare water and oral rehydration salts.', 'Check on children, seniors, and pets.'],
      },
      during: {
        title: 'During',
        tone: 'red',
        tips: ['Drink water often, even when not thirsty.', 'Rest in shade or a cool room.', 'Stop activity if dizzy, weak, or confused.'],
        highlight: 'Heat stroke is an emergency. Cool the person and call for help.',
      },
      after: {
        title: 'After',
        tone: 'green',
        tips: ['Keep hydrating.', 'Monitor anyone who felt dizzy or faint.', 'Avoid sudden heavy activity after cooling down.'],
      },
    },
  },
];

function TipSection({ section, phase }: { section: SafetySection; phase: SafetyPhase }) {
  const theme = useAppTheme();
  const toneColor = {
    blue: theme.primary,
    orange: theme.orange,
    red: theme.danger,
    yellow: theme.warning,
    green: theme.success,
  }[section.tone];
  const toneBackground = {
    blue: theme.primaryTint,
    orange: theme.orangeSoft,
    red: theme.dangerSoft,
    yellow: theme.warningSoft,
    green: theme.successSoft,
  }[section.tone];

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={[styles.tipSection, { backgroundColor: theme.surface, borderColor: theme.borderSoft, shadowColor: theme.black }]}>
      <View style={styles.sectionTop}>
        <View style={[styles.sectionIcon, { backgroundColor: toneBackground }]}>
          <AppIcon source={phaseIcons[phase]} size={18} tintColor={toneColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
        <View style={[styles.sectionAccent, { backgroundColor: toneColor }]} />
      </View>
      {section.highlight ? (
        <View style={[styles.highlight, { backgroundColor: toneBackground, borderColor: toneColor }]}>
          <Text style={[styles.highlightText, { color: toneColor }]}>{section.highlight}</Text>
        </View>
      ) : null}
      <View style={styles.tipList}>
        {section.tips.map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <View style={[styles.tipDot, { backgroundColor: toneColor }]} />
            <Text style={[styles.tipText, { color: theme.text }]}>{tip}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function HazardTab({ active, hazard, onPress }: { active: boolean; hazard: HazardTip; onPress: () => void }) {
  const theme = useAppTheme();

  return (
    <PressScale
      onPress={onPress}
      style={[
        styles.tab,
        { backgroundColor: active ? theme.primaryTint : theme.surface, borderColor: active ? theme.primary : theme.borderSoft },
      ]}>
      <AppIcon source={hazard.icon} size={19} />
      <Text style={[styles.tabText, { color: active ? theme.primary : theme.muted }]}>{hazard.label}</Text>
    </PressScale>
  );
}

export const SafetyTipsModal = memo(function SafetyTipsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const [activeKey, setActiveKey] = useState<HazardKey>('typhoon');
  const activeHazard = useMemo(() => hazardTips.find((hazard) => hazard.key === activeKey) ?? hazardTips[0], [activeKey]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <SafeAreaView style={styles.modalRoot}>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.backdrop} />
        <Animated.View entering={FadeInDown.duration(300).springify()} style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <BackButton label="Back" onPress={onClose} />
            <View style={styles.headerCopy}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Safety Tips</Text>
              <Text style={[styles.modalSubtitle, { color: theme.muted }]}>Fast reminders for common Marikina hazards</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {hazardTips.map((hazard) => (
              <HazardTab key={hazard.key} active={activeHazard.key === hazard.key} hazard={hazard} onPress={() => setActiveKey(hazard.key)} />
            ))}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Animated.View key={activeHazard.key} entering={FadeInDown.duration(240)} layout={LinearTransition.springify().damping(18)} style={styles.hero}>
              <View style={[styles.heroIcon, { backgroundColor: theme.primaryTint }]}>
                <Image source={activeHazard.icon} resizeMode="contain" style={styles.heroIconImage} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, { color: theme.text }]}>{activeHazard.label}</Text>
                <Text style={[styles.heroSubtitle, { color: theme.muted }]}>{activeHazard.subtitle}</Text>
              </View>
              <Badge label="READY" tone="green" />
            </Animated.View>
            <TipSection phase="before" section={activeHazard.sections.before} />
            <TipSection phase="during" section={activeHazard.sections.during} />
            <TipSection phase="after" section={activeHazard.sections.after} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '94%',
    minHeight: '88%',
    overflow: 'hidden',
    paddingTop: Spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  headerCopy: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  modalSubtitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  tabs: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  tab: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 42,
    paddingHorizontal: Spacing.md,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '900',
  },
  body: {
    gap: Spacing.md,
    paddingBottom: 34,
    paddingHorizontal: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroIconImage: {
    height: 34,
    width: 34,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: Typography.headline,
    fontWeight: '900',
  },
  heroSubtitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  tipSection: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    elevation: 4,
    gap: Spacing.md,
    padding: Spacing.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  sectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sectionTitle: {
    flex: 1,
    fontSize: Typography.title,
    fontWeight: '900',
  },
  sectionAccent: {
    borderRadius: Radius.pill,
    height: 8,
    width: 36,
  },
  highlight: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  highlightText: {
    fontSize: Typography.caption,
    fontWeight: '900',
    lineHeight: 17,
  },
  tipList: {
    gap: Spacing.sm,
  },
  tipRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tipDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.body,
    fontWeight: '700',
    lineHeight: 20,
  },
});
