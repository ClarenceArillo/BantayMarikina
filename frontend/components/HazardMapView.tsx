import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Asset } from 'expo-asset';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useTheme } from '@/theme/useTheme';
import type { EvacuationSite } from '@/types/evacuation';
import type { HazardReport } from '@/types/hazard';

const MARIKINA_CENTER = { latitude: 14.6507, longitude: 121.1029 };
const DEFAULT_PIN_COLOR = '#2d75b4';

type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type HazardMapViewProps = {
  reports: HazardReport[];
  pinSource: ImageSourcePropType;
  evacuationSource?: ImageSourcePropType;
  evacuationSites?: EvacuationSite[];
  userLocation?: UserLocation | null;
  isLoading?: boolean;
  error?: string | null;
  height?: DimensionValue;
  initialZoom?: number;
  compact?: boolean;
  onMarkerPress?: (report: HazardReport) => void;
  onMapPress?: () => void;
  focusSignal?: number;
  focusReportId?: string;
};

type ResolvableImage = typeof Image & {
  resolveAssetSource?: (source: ImageSourcePropType) => { uri?: string } | undefined;
};

function severityColor(severity?: string) {
  const normalized = severity?.toLowerCase();
  if (normalized === 'critical') return '#a6192e';
  if (normalized === 'high') return '#d64545';
  if (normalized === 'moderate') return '#f2a93b';
  if (normalized === 'low') return '#f2c94c';
  return DEFAULT_PIN_COLOR;
}

function isFiniteCoordinate(value: number) {
  return Number.isFinite(value);
}

function isValidLocation(location?: UserLocation | null) {
  return Boolean(
    location &&
      isFiniteCoordinate(location.latitude) &&
      isFiniteCoordinate(location.longitude) &&
      Math.abs(location.latitude) <= 90 &&
      Math.abs(location.longitude) <= 180
  );
}

function serializeForScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function getImageUri(source: ImageSourcePropType) {
  const resolvedSource = (Image as ResolvableImage).resolveAssetSource?.(source);
  if (resolvedSource?.uri) return resolvedSource.uri;

  if (typeof source === 'number') {
    const asset = Asset.fromModule(source);
    return asset.localUri || asset.uri || '';
  }

  if (Array.isArray(source)) {
    const uriSource = source.find((item) => item?.uri);
    return uriSource?.uri || '';
  }

  if (source && typeof source === 'object' && 'uri' in source) {
    return source.uri || '';
  }

  return '';
}

function buildMapHtml(pinUri: string, evacuationUri: string, initialZoom: number, compact: boolean, isDark: boolean) {
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const mapBackground = isDark ? '#111827' : '#e7eef4';
  const popupBackground = isDark ? '#172033' : '#ffffff';
  const popupText = isDark ? '#f8fafc' : '#111827';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">
  <style>
    html, body, #map { height: 100%; margin: 0; width: 100%; }
    body { background: ${mapBackground}; }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: ${popupBackground}; color: ${popupText}; }
    .hazard-preview { min-width: 168px; }
    .hazard-preview-title { font-size: 13px; font-weight: 800; margin-bottom: 4px; }
    .hazard-preview-meta { font-size: 11px; font-weight: 700; opacity: .72; }
    .hazard-preview-body { font-size: 11px; line-height: 1.35; margin-top: 6px; }
    .hazard-pin { filter: drop-shadow(0 5px 7px rgba(0,0,0,.28)); }
    .hazard-pin-wrap { align-items: center; display: flex; justify-content: center; position: relative; }
    .hazard-pin-icon {
      height: 22px;
      left: 10px;
      position: absolute;
      top: 8px;
      width: 22px;
    }
    .evacuation-pin-wrap {
      filter: drop-shadow(0 10px 14px rgba(201,53,53,.34));
      height: 50px;
      position: relative;
      width: 42px;
    }
    .evacuation-pin-svg {
      display: block;
      height: 50px;
      width: 42px;
    }
    .evacuation-pin-icon {
      background: #ffffff;
      border-radius: 50%;
      height: 20px;
      left: 11px;
      object-fit: contain;
      padding: 2px;
      position: absolute;
      top: 8px;
      width: 20px;
    }
    .evacuation-label {
      background: #fff;
      border: 1px solid rgba(201,53,53,.26);
      border-radius: 999px;
      box-shadow: 0 8px 18px rgba(17,24,39,.16);
      color: #a6192e;
      font-size: 11px;
      font-weight: 900;
      padding: 5px 9px;
    }
    .leaflet-tooltip-left.evacuation-label::before,
    .leaflet-tooltip-right.evacuation-label::before,
    .leaflet-tooltip-top.evacuation-label::before,
    .leaflet-tooltip-bottom.evacuation-label::before {
      display: none;
    }
    .evacuation-preview { min-width: 180px; }
    .evacuation-preview-title { color: #a6192e; font-size: 13px; font-weight: 900; margin-bottom: 4px; }
    .evacuation-preview-meta { font-size: 11px; font-weight: 800; opacity: .74; }
    .user-dot {
      background: #2d75b4;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(45,117,180,.22);
      height: 16px;
      width: 16px;
    }
    .leaflet-control-attribution { font-size: ${compact ? '8px' : '10px'}; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script>
    const marikina = [${MARIKINA_CENTER.latitude}, ${MARIKINA_CENTER.longitude}];
    const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(marikina, ${initialZoom});
    const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: ${compact ? 42 : 54} });
    const evacuationLayer = L.layerGroup();
    const pinUri = ${serializeForScript(pinUri)};
    const evacuationUri = ${serializeForScript(evacuationUri)};
    const evacuationLabelMinZoom = 16;
    let markersById = {};
    let evacuationMarkers = [];
    let userMarker = null;
    let userAccuracy = null;

    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    map.addLayer(cluster);
    map.addLayer(evacuationLayer);

    function post(payload) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }

    function isValidPoint(item) {
      return item &&
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude) &&
        Math.abs(item.latitude) <= 90 &&
        Math.abs(item.longitude) <= 180;
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function hazardSymbolHtml(hazardType) {
      const type = String(hazardType || '').toLowerCase();
      const attrs = 'class="hazard-pin-icon" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

      if (type === 'flood') {
        return '<svg ' + attrs + '><path d="M3 8c2.2 0 2.2 1.4 4.4 1.4S9.6 8 11.8 8s2.2 1.4 4.4 1.4S18.4 8 21 8"/><path d="M3 13c2.2 0 2.2 1.4 4.4 1.4s2.2-1.4 4.4-1.4 2.2 1.4 4.4 1.4S18.4 13 21 13"/><path d="M3 18c2.2 0 2.2 1.4 4.4 1.4s2.2-1.4 4.4-1.4 2.2 1.4 4.4 1.4S18.4 18 21 18"/></svg>';
      }

      if (type === 'fire') {
        return '<svg ' + attrs + '><path d="M12 22c4 0 7-2.7 7-6.6 0-2.7-1.4-4.6-3.2-6.3-.8 2-2.3 2.8-3.8 3.3.9-3.4-.7-6.4-3.2-8.4.2 3.7-3.8 5.8-3.8 10.7C5 19 8 22 12 22Z"/><path d="M12 22c1.9 0 3.3-1.3 3.3-3 0-1.3-.7-2.2-1.8-3.2-.4 1.1-1.1 1.7-2 2 .4-1.9-.4-3.3-1.7-4.4.1 2-1.8 3.2-1.8 5.5 0 1.8 1.4 3.1 4 3.1Z"/></svg>';
      }

      if (type === 'landslide') {
        return '<svg ' + attrs + '><path d="M3 20h18"/><path d="M5 20 14 5l7 15"/><path d="m8 15 3 2 3-2 3 2"/><circle cx="9" cy="7" r="1.5"/><circle cx="13" cy="11" r="1.5"/></svg>';
      }

      if (type === 'earthquake damage') {
        return '<svg ' + attrs + '><path d="M4 21h16"/><path d="M7 21V6h10v15"/><path d="m12 6-2 5h4l-2 5"/><path d="M9 10H7"/><path d="M17 14h-2"/></svg>';
      }

      if (type === 'road blockage') {
        return '<svg ' + attrs + '><path d="M4 20 11 4"/><path d="m13 4 7 16"/><path d="M7 14h10"/><path d="m9 10 6 4"/><path d="m15 10-6 4"/></svg>';
      }

      if (type === 'power outage') {
        return '<svg ' + attrs + '><path d="M13 2 5 14h7l-1 8 8-12h-7l1-8Z"/></svg>';
      }

      return '<svg ' + attrs + '><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"/></svg>';
    }

    function markerIcon(report) {
      const color = report.color || '${DEFAULT_PIN_COLOR}';
      return L.divIcon({
        className: 'hazard-pin-host',
        html: '<div class="hazard-pin-wrap" style="position:relative;width:42px;height:50px;">' +
          '<svg viewBox="0 0 42 50" style="width:42px;height:50px;"><path d="M21 0 C9.4 0 0 9.4 0 21 C0 36.75 21 50 21 50 C21 50 42 36.75 42 21 C42 9.4 32.6 0 21 0Z" fill="' + escapeHtml(color) + '"/></svg>' +
          hazardSymbolHtml(report.hazardType) +
          '</div>',
        iconSize: [42, 50],
        iconAnchor: [21, 50],
        popupAnchor: [0, -50]
      });
    }

    function popupHtml(report) {
      return '<div class="hazard-preview">' +
        '<div class="hazard-preview-title">' + escapeHtml(report.hazardType || 'Hazard') + '</div>' +
        '<div class="hazard-preview-meta">' + escapeHtml(report.severity || 'Live') + ' • ' + escapeHtml(report.barangay || 'Marikina City') + '</div>' +
        '<div class="hazard-preview-body">' + escapeHtml(report.description || 'Tap for full details') + '</div>' +
      '</div>';
    }

    function evacuationIcon() {
      return L.divIcon({
        className: 'evacuation-pin-host',
        html: '<div class="evacuation-pin-wrap">' +
          '<svg class="evacuation-pin-svg" viewBox="0 0 42 50" aria-hidden="true" focusable="false">' +
            '<path d="M21 1.5C10.5 1.5 2.5 9.4 2.5 19.7c0 13.2 18.5 28.8 18.5 28.8s18.5-15.6 18.5-28.8C39.5 9.4 31.5 1.5 21 1.5Z" fill="#c93535" stroke="#ffffff" stroke-width="3"/>' +
            '<circle cx="21" cy="19.5" r="12" fill="#ffffff"/>' +
          '</svg>' +
          '<img class="evacuation-pin-icon" src="' + escapeHtml(evacuationUri) + '" onerror="this.style.display=\\'none\\';">' +
        '</div>',
        iconSize: [42, 50],
        iconAnchor: [21, 48],
        popupAnchor: [0, -46]
      });
    }

    function evacuationPopupHtml(site) {
      return '<div class="evacuation-preview">' +
        '<div class="evacuation-preview-title">' + escapeHtml(site.name || 'Evacuation site') + '</div>' +
        '<div class="evacuation-preview-meta">Evacuation center preview</div>' +
      '</div>';
    }

    function updateReports(reports) {
      cluster.clearLayers();
      markersById = {};
      reports.forEach((report) => {
        if (!isValidPoint(report)) return;
        const marker = L.marker([report.latitude, report.longitude], { icon: markerIcon(report), title: report.hazardType });
        marker.bindTooltip(report.hazardType || 'Hazard', { direction: 'top', offset: [0, -28] });
        marker.bindPopup(popupHtml(report), { closeButton: false, maxWidth: 220 });
        marker.on('click', (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          marker.openPopup();
          post({ type: 'markerPress', id: report.id });
        });
        markersById[report.id] = marker;
        cluster.addLayer(marker);
      });
    }

    function updateEvacuations(sites) {
      evacuationLayer.clearLayers();
      evacuationMarkers = [];
      (sites || []).forEach((site) => {
        if (!isValidPoint(site)) return;
        const marker = L.marker([site.latitude, site.longitude], {
          icon: evacuationIcon(),
          title: site.name,
          zIndexOffset: 700
        });
        marker.bindPopup(evacuationPopupHtml(site), { closeButton: false, maxWidth: 240 });
        evacuationMarkers.push({
          marker,
          label: site.name || 'Evacuation site'
        });
        evacuationLayer.addLayer(marker);
      });
      syncEvacuationLabels();
    }

    function syncEvacuationLabels() {
      const shouldShow = map.getZoom() >= evacuationLabelMinZoom;
      evacuationMarkers.forEach(({ marker, label }) => {
        if (shouldShow) {
          if (!marker.getTooltip()) {
            marker.bindTooltip(label, {
              className: 'evacuation-label',
              direction: 'right',
              offset: [18, -24],
              permanent: false
            });
          }
          marker.openTooltip();
        } else {
          marker.closeTooltip();
          if (marker.getTooltip()) marker.unbindTooltip();
        }
      });
    }

    function updateUserLocation(location) {
      if (!isValidPoint(location)) {
        if (userMarker) {
          map.removeLayer(userMarker);
          userMarker = null;
        }
        if (userAccuracy) {
          map.removeLayer(userAccuracy);
          userAccuracy = null;
        }
        return;
      }

      const latLng = [location.latitude, location.longitude];
      const icon = L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

      if (!userMarker) {
        userMarker = L.marker(latLng, { icon, zIndexOffset: 900 }).addTo(map);
      } else {
        userMarker.setLatLng(latLng);
      }

      if (Number.isFinite(location.accuracy) && location.accuracy > 0) {
        if (!userAccuracy) {
          userAccuracy = L.circle(latLng, {
            radius: location.accuracy,
            color: '#2d75b4',
            fillColor: '#2d75b4',
            fillOpacity: 0.1,
            weight: 1
          }).addTo(map);
        } else {
          userAccuracy.setLatLng(latLng);
          userAccuracy.setRadius(location.accuracy);
        }
      } else if (userAccuracy) {
        map.removeLayer(userAccuracy);
        userAccuracy = null;
      }
    }

    function focusUser(location) {
      if (isValidPoint(location)) map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 16), { duration: 0.65 });
    }

    function focusReport(reportId) {
      const marker = markersById[reportId];
      if (!marker) return;

      cluster.zoomToShowLayer(marker, () => {
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.65 });
        marker.openPopup();
      });
    }

    window.updateHazardMap = function(payload) {
      if (Object.prototype.hasOwnProperty.call(payload, 'reports')) updateReports(payload.reports || []);
      if (Object.prototype.hasOwnProperty.call(payload, 'evacuationSites')) updateEvacuations(payload.evacuationSites || []);
      if (Object.prototype.hasOwnProperty.call(payload, 'userLocation')) updateUserLocation(payload.userLocation);
      if (payload.focusUser) focusUser(payload.userLocation);
      if (payload.focusReportId) setTimeout(() => focusReport(payload.focusReportId), 80);
    };

    map.on('click', () => post({ type: 'mapPress' }));
    map.on('zoomend', syncEvacuationLabels);
    setTimeout(() => map.invalidateSize(), 250);
    post({ type: 'ready' });
  </script>
</body>
</html>`;
}

function HazardMapViewComponent({
  reports,
  pinSource,
  evacuationSource,
  evacuationSites = [],
  userLocation,
  isLoading = false,
  error,
  height = 320,
  initialZoom = 13,
  compact = false,
  onMarkerPress,
  onMapPress,
  focusSignal = 0,
  focusReportId,
}: HazardMapViewProps) {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const reportsRef = useRef(reports);
  const isMapReadyRef = useRef(false);
  const pendingPayloadRef = useRef<object | null>(null);
  const lastFocusSignalRef = useRef(focusSignal);
  const pinUri = useMemo(() => getImageUri(pinSource), [pinSource]);
  const evacuationUri = useMemo(() => getImageUri(evacuationSource ?? pinSource), [evacuationSource, pinSource]);
  const html = useMemo(
    () => buildMapHtml(pinUri, evacuationUri, initialZoom, compact, isDark),
    [compact, evacuationUri, initialZoom, isDark, pinUri]
  );

  reportsRef.current = reports;

  useEffect(() => {
    isMapReadyRef.current = false;
    pendingPayloadRef.current = null;
  }, [html]);

  const mapReports = useMemo(
    () =>
      reports
        .filter((report) => isValidLocation(report))
        .map((report) => ({
          id: report.id,
          hazardType: report.hazardType,
          description: report.description,
          barangay: report.barangay,
          latitude: report.latitude,
          longitude: report.longitude,
          severity: report.severity,
          color: severityColor(report.severity),
        })),
    [reports]
  );

  const mapEvacuationSites = useMemo(
    () =>
      evacuationSites
        .filter((site) => isValidLocation(site))
        .map((site) => ({
          id: site.id,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
        })),
    [evacuationSites]
  );

  const safeUserLocation = useMemo(() => (isValidLocation(userLocation) ? userLocation : null), [userLocation]);

  const injectMapUpdate = useCallback((payload: object) => {
    pendingPayloadRef.current = payload;

    if (!isMapReadyRef.current) return;

    const script = `window.updateHazardMap && window.updateHazardMap(${serializeForScript(payload)}); true;`;
    webViewRef.current?.injectJavaScript(script);
    pendingPayloadRef.current = null;
  }, []);

  useEffect(() => {
    const shouldFocusUser = focusSignal > lastFocusSignalRef.current;
    lastFocusSignalRef.current = focusSignal;

    injectMapUpdate({
      reports: mapReports,
      evacuationSites: mapEvacuationSites,
      userLocation: safeUserLocation,
      focusUser: shouldFocusUser,
      focusReportId,
    });
  }, [focusReportId, focusSignal, injectMapUpdate, mapEvacuationSites, mapReports, safeUserLocation]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === 'ready') {
        isMapReadyRef.current = true;
        injectMapUpdate(
          pendingPayloadRef.current ?? {
            reports: mapReports,
            evacuationSites: mapEvacuationSites,
            userLocation: safeUserLocation,
            focusReportId,
          }
        );
      }

      if (payload.type === 'markerPress') {
        const report = reportsRef.current.find((item) => item.id === payload.id);
        if (report) onMarkerPress?.(report);
      }

      if (payload.type === 'mapPress') {
        onMapPress?.();
      }
    } catch {
      return;
    }
  }, [focusReportId, injectMapUpdate, mapEvacuationSites, mapReports, onMapPress, onMarkerPress, safeUserLocation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.mapBackground, height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={handleMessage}
        style={[styles.webView, { backgroundColor: colors.mapBackground }]}
      />
      {isLoading ? (
        <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.82)' }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.overlayText, { color: colors.primaryDark }]}>Loading live hazards</Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.errorPill, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const HazardMapView = memo(HazardMapViewComponent);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e7eef4',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  webView: {
    backgroundColor: '#e7eef4',
    flex: 1,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    bottom: 0,
    gap: 8,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayText: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorPill: {
    backgroundColor: 'rgba(255, 245, 245, 0.96)',
    borderColor: '#f0b5b5',
    borderRadius: 12,
    borderWidth: 1,
    left: 12,
    padding: 10,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  errorText: {
    color: '#9b2d2d',
    fontSize: 11,
    fontWeight: '700',
  },
});
