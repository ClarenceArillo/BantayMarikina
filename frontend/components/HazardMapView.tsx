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
  userLocation?: UserLocation | null;
  isLoading?: boolean;
  error?: string | null;
  height?: DimensionValue;
  initialZoom?: number;
  compact?: boolean;
  onMarkerPress?: (report: HazardReport) => void;
  onMapPress?: () => void;
  focusSignal?: number;
};

type ResolvableImage = typeof Image & {
  resolveAssetSource?: (source: ImageSourcePropType) => { uri?: string } | undefined;
};

function severityColor(severity?: string) {
  const normalized = severity?.toLowerCase();
  if (normalized === 'critical') return '#a6192e';
  if (normalized === 'high') return '#d64545';
  if (normalized === 'moderate') return '#f2a93b';
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

function buildMapHtml(pinUri: string, initialZoom: number, compact: boolean, isDark: boolean) {
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
    .hazard-pin-wrap::after {
      border: 3px solid #fff;
      border-radius: 50%;
      content: '';
      height: 12px;
      left: 18px;
      position: absolute;
      top: 8px;
      width: 12px;
    }
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
    const pinUri = ${serializeForScript(pinUri)};
    let markersById = {};
    let userMarker = null;
    let userAccuracy = null;

    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    map.addLayer(cluster);

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

    function markerIcon(report) {
      const color = report.color || '${DEFAULT_PIN_COLOR}';
      return L.divIcon({
        className: 'hazard-pin-host',
        html: '<div class="hazard-pin-wrap" style="--hazard-color:' + escapeHtml(color) + '"><img class="hazard-pin" src="' + escapeHtml(pinUri) + '" style="width:36px;height:36px;object-fit:contain;" onerror="this.style.display=\\'none\\';this.parentNode.style.width=\\'28px\\';this.parentNode.style.height=\\'28px\\';this.parentNode.style.borderRadius=\\'50%\\';this.parentNode.style.background=\\'' + escapeHtml(color) + '\\';"></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 34],
        popupAnchor: [0, -32]
      });
    }

    function popupHtml(report) {
      return '<div class="hazard-preview">' +
        '<div class="hazard-preview-title">' + escapeHtml(report.hazardType || 'Hazard') + '</div>' +
        '<div class="hazard-preview-meta">' + escapeHtml(report.severity || 'Live') + ' • ' + escapeHtml(report.barangay || 'Marikina City') + '</div>' +
        '<div class="hazard-preview-body">' + escapeHtml(report.description || 'Tap for full details') + '</div>' +
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

    window.updateHazardMap = function(payload) {
      if (Object.prototype.hasOwnProperty.call(payload, 'reports')) updateReports(payload.reports || []);
      if (Object.prototype.hasOwnProperty.call(payload, 'userLocation')) updateUserLocation(payload.userLocation);
      if (payload.focusUser) focusUser(payload.userLocation);
    };

    map.on('click', () => post({ type: 'mapPress' }));
    setTimeout(() => map.invalidateSize(), 250);
    post({ type: 'ready' });
  </script>
</body>
</html>`;
}

function HazardMapViewComponent({
  reports,
  pinSource,
  userLocation,
  isLoading = false,
  error,
  height = 320,
  initialZoom = 13,
  compact = false,
  onMarkerPress,
  onMapPress,
  focusSignal = 0,
}: HazardMapViewProps) {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const reportsRef = useRef(reports);
  const isMapReadyRef = useRef(false);
  const pendingPayloadRef = useRef<object | null>(null);
  const lastFocusSignalRef = useRef(focusSignal);
  const pinUri = useMemo(() => getImageUri(pinSource), [pinSource]);
  const html = useMemo(() => buildMapHtml(pinUri, initialZoom, compact, isDark), [compact, initialZoom, isDark, pinUri]);

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
      userLocation: safeUserLocation,
      focusUser: shouldFocusUser,
    });
  }, [focusSignal, injectMapUpdate, mapReports, safeUserLocation]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === 'ready') {
        isMapReadyRef.current = true;
        injectMapUpdate(
          pendingPayloadRef.current ?? {
            reports: mapReports,
            userLocation: safeUserLocation,
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
  }, [injectMapUpdate, mapReports, onMapPress, onMarkerPress, safeUserLocation]);

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
