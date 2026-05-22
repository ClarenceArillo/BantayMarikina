import { memo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import { HAZARD_TYPES, SEVERITY_LEVELS, type HazardSeverity, type HazardType, type ReportDateFilter, type ReportFilters } from '@/types/hazard';

const DATE_OPTIONS: { label: string; value: ReportDateFilter }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ReportFilterBarProps = {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  compact?: boolean;
};

type SectionKey = 'date' | 'hazard' | 'severity';

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useAppTheme();

  return (
    <Pressable
      style={[
        styles.chip,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        active ? { backgroundColor: theme.primaryTint, borderColor: theme.primary } : null,
      ]}
      onPress={onPress}>
      <Text style={[styles.chipText, { color: active ? theme.primaryDark : theme.muted }]}>{label}</Text>
    </Pressable>
  );
}

function activeCount(filters: ReportFilters, section: SectionKey) {
  if (section === 'date') return filters.dateRange !== 'month' ? 1 : 0;
  if (section === 'hazard') return filters.hazardType && filters.hazardType !== 'All' ? 1 : 0;
  return [
    filters.severity && filters.severity !== 'All',
    filters.status && filters.status !== 'All',
    filters.source && filters.source !== 'All',
  ].filter(Boolean).length;
}

export const ReportFilterBar = memo(function ReportFilterBar({ filters, onChange, compact = false }: ReportFilterBarProps) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState<SectionKey | null>(null);

  const toggle = (section: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((current) => (current === section ? null : section));
  };

  const resetFilters = () => onChange({ dateRange: 'month', hazardType: 'All', severity: 'All', status: 'All', source: 'All' });

  return (
    <View style={[styles.container, compact ? styles.compactContainer : null]}>
      {([
        ['date', 'DATE'],
        ['hazard', 'HAZARD TYPE'],
        ['severity', 'SEVERITY'],
      ] as [SectionKey, string][]).map(([section, label]) => {
        const count = activeCount(filters, section);
        const isExpanded = expanded === section;

        return (
          <View key={section} style={[styles.section, { backgroundColor: theme.surface, borderColor: isExpanded ? theme.primary : theme.borderSoft }]}>
            <Pressable style={styles.sectionHeader} onPress={() => toggle(section)}>
              <Text style={[styles.sectionTitle, { color: isExpanded ? theme.primary : theme.text }]}>{label}</Text>
              <View style={styles.headerRight}>
                {count ? (
                  <View style={[styles.countPill, { backgroundColor: theme.primaryTint }]}>
                    <Text style={[styles.countText, { color: theme.primaryDark }]}>{count}</Text>
                  </View>
                ) : null}
                <Text style={[styles.chevron, { color: theme.muted }]}>{isExpanded ? 'Up' : 'Down'}</Text>
              </View>
            </Pressable>

            {isExpanded ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {section === 'date' ? DATE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={filters.dateRange === option.value}
                    label={option.label}
                    onPress={() => onChange({ ...filters, dateRange: option.value })}
                  />
                )) : null}

                {section === 'hazard' ? (
                  <>
                    <FilterChip active={!filters.hazardType || filters.hazardType === 'All'} label="All Hazards" onPress={() => onChange({ ...filters, hazardType: 'All' })} />
                    {HAZARD_TYPES.map((type) => (
                      <FilterChip key={type} active={filters.hazardType === type} label={type} onPress={() => onChange({ ...filters, hazardType: type as HazardType })} />
                    ))}
                  </>
                ) : null}

                {section === 'severity' ? (
                  <>
                    <FilterChip active={!filters.severity || filters.severity === 'All'} label="All Severity" onPress={() => onChange({ ...filters, severity: 'All' })} />
                    {SEVERITY_LEVELS.map((level) => (
                      <FilterChip key={level} active={filters.severity === level} label={level} onPress={() => onChange({ ...filters, severity: level as HazardSeverity })} />
                    ))}
                    <FilterChip active={filters.status === 'active'} label="Unresolved" onPress={() => onChange({ ...filters, status: 'active' })} />
                    <FilterChip active={filters.status === 'resolved'} label="Resolved" onPress={() => onChange({ ...filters, status: 'resolved' })} />
                    <FilterChip active={filters.source === 'community'} label="Community" onPress={() => onChange({ ...filters, source: 'community' })} />
                    <FilterChip active={filters.source === 'official'} label="Official" onPress={() => onChange({ ...filters, source: 'official' })} />
                    <Pressable style={[styles.resetButton, { borderColor: theme.border }]} onPress={resetFilters}>
                      <Text style={[styles.resetText, { color: theme.primary }]}>Reset</Text>
                    </Pressable>
                  </>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  compactContainer: {
    maxHeight: 190,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  countPill: {
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  countText: {
    fontSize: 10,
    fontWeight: '900',
  },
  chevron: {
    fontSize: 10,
    fontWeight: '900',
  },
  row: {
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingRight: 18,
  },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '900',
  },
  resetButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
