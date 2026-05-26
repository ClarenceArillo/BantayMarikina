import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { getFirebaseClients } from '@/config/firebase';
import { subscribeWithRetry } from '@/services/realtime';
import type { EvacuationSite } from '@/types/evacuation';

const EVACUATION_SITES_COLLECTION = 'EvacuationSites';

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function normalizeEvacuationSite(id: string, data: Record<string, unknown>): EvacuationSite | null {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const name = String(data.name || '').trim();

  if (!name || !isValidCoordinate(latitude, longitude)) return null;

  return {
    id,
    name,
    latitude,
    longitude,
    active: data.active === false ? false : true,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : undefined,
  };
}

export function subscribeToEvacuationSites(
  onSites: (sites: EvacuationSite[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseClients();
  const sitesCollection = collection(db, EVACUATION_SITES_COLLECTION);

  return subscribeWithRetry(
    (handleError) => onSnapshot(
      sitesCollection,
      (snapshot) => {
        const sites = snapshot.docs
          .map((document) => normalizeEvacuationSite(document.id, document.data()))
          .filter((site): site is EvacuationSite => Boolean(site?.active))
          .sort((left, right) => {
            const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder || left.name.localeCompare(right.name);
          });

        onSites(sites);
      },
      handleError
    ),
    onError
  );
}
