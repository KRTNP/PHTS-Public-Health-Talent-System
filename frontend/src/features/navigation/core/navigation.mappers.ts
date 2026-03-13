import type { NavItem, NavigationItem, NavigationPayload } from './types';

export const mapNavigationItems = (
  items: NavigationItem[] | undefined,
  badges: NavigationPayload['badges'] | undefined,
): NavItem[] =>
  (items ?? []).map((item) => ({
    name: item.label,
    href: item.href,
    iconKey: item.iconKey,
    badge: item.badgeKey ? badges?.[item.badgeKey] ?? 0 : undefined,
  }));
