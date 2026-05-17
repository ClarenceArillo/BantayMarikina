import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

function toLocationObject(position: GeolocationPosition): Location.LocationObject {
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude ?? null,
      accuracy: position.coords.accuracy ?? null,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
      heading: position.coords.heading ?? null,
      speed: position.coords.speed ?? null,
    },
    timestamp: position.timestamp,
  };
}

export function useLiveLocation(autoStart = true) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLocating, setIsLocating] = useState(autoStart);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locateOnce = useCallback(async () => {
    setIsLocating(true);
    setError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(permission.status);

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        throw new Error('Location permission is required to use GPS reporting.');
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(current);
      return current;
    } catch (locationError) {
      const message = locationError instanceof Error ? locationError.message : 'Unable to get current location.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    if (!autoStart) return undefined;

    let subscription: Location.LocationSubscription | null = null;
    let webWatchId: number | null = null;
    let isMounted = true;

    async function startWatching() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;

        setPermissionStatus(permission.status);

        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setError('Location permission is required to show your live position.');
          setIsLocating(false);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (!isMounted) return;
        setLocation(current);

        if (Platform.OS === 'web') {
          if (!navigator.geolocation) {
            setError('Geolocation is not available in this browser.');
            return;
          }

          webWatchId = navigator.geolocation.watchPosition(
            (position) => {
              if (isMounted) setLocation(toLocationObject(position));
            },
            (positionError) => {
              if (isMounted) setError(positionError.message || 'Unable to watch your location.');
            },
            {
              enableHighAccuracy: true,
              maximumAge: 4000,
              timeout: 10000,
            }
          );
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 4000,
          },
          (nextLocation: Location.LocationObject) => {
            if (isMounted) setLocation(nextLocation);
          }
        );
      } catch (watchError) {
        if (!isMounted) return;
        setError(watchError instanceof Error ? watchError.message : 'Unable to watch your location.');
      } finally {
        if (isMounted) setIsLocating(false);
      }
    }

    startWatching();

    return () => {
      isMounted = false;

      if (webWatchId !== null) {
        navigator.geolocation?.clearWatch(webWatchId);
      }

      try {
        subscription?.remove();
      } catch {
        // Expo Location's web watcher can throw during cleanup in some SDK/browser combinations.
      }
    };
  }, [autoStart]);

  return {
    location,
    isLocating,
    permissionStatus,
    error,
    locateOnce,
  };
}
