import { router } from 'expo-router';

export type MainTabRoute = 'home' | 'map' | 'report' | 'notification' | 'profile';
export type MainTabDirection = 'forward' | 'backward';

const MAIN_TAB_ORDER: MainTabRoute[] = ['home', 'map', 'report', 'notification', 'profile'];

export const routesByMainTab = {
  home: '/home',
  map: '/map',
  report: '/report',
  notification: '/notification',
  profile: '/profile',
} as const;

let pendingDirection: MainTabDirection = 'forward';

export function getMainTabFromPath(pathname: string): MainTabRoute | null {
  const route = pathname.replace(/^\//, '').split('/')[0];
  return isMainTabRoute(route) ? route : null;
}

export function getMainTabFromRouteName(routeName: string): MainTabRoute | null {
  return isMainTabRoute(routeName) ? routeName : null;
}

export function getMainTabTransitionDirection() {
  return pendingDirection;
}

export function getMainTabAnimation() {
  return pendingDirection === 'forward' ? 'slide_from_right' : 'slide_from_left';
}

export function getMainTabReplaceAnimation() {
  return pendingDirection === 'forward' ? 'push' : 'pop';
}

export function navigateMainTab(
  currentTab: MainTabRoute,
  targetTab: MainTabRoute,
  params?: Record<string, string>
) {
  if (currentTab === targetTab && !params) return;

  pendingDirection = getDirection(currentTab, targetTab);
  const pathname = routesByMainTab[targetTab];

  if (params) {
    router.replace({ pathname, params } as never);
    return;
  }

  router.replace(pathname as never);
}

function getDirection(currentTab: MainTabRoute, targetTab: MainTabRoute): MainTabDirection {
  return MAIN_TAB_ORDER.indexOf(targetTab) > MAIN_TAB_ORDER.indexOf(currentTab) ? 'forward' : 'backward';
}

function isMainTabRoute(value: string): value is MainTabRoute {
  return MAIN_TAB_ORDER.includes(value as MainTabRoute);
}
