import personnelChangesRoutes from '@/modules/workforce-compliance/routes/personnel-changes.routes.js';
import licenseComplianceRoutes from '@/modules/workforce-compliance/routes/license-compliance.routes.js';

type RouteDescriptor = {
  path: string;
  methods: string[];
};

const collectRoutes = (router: any, prefix = ''): RouteDescriptor[] => {
  const routes: RouteDescriptor[] = [];

  for (const layer of router.stack ?? []) {
    if (layer.route?.path) {
      routes.push({
        path: `${prefix}${layer.route.path}`,
        methods: Object.keys(layer.route.methods ?? {}).sort(),
      });
      continue;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      const nestedPrefixMatch = String(layer.regexp ?? '').match(/\\\/([^\\]+)\\\/\?\(\?=\\\/\|\$\)/);
      const nestedPrefix = nestedPrefixMatch ? `/${nestedPrefixMatch[1]}` : '';
      routes.push(...collectRoutes(layer.handle, `${prefix}${nestedPrefix}`));
    }
  }

  return routes;
};

describe('workforce compliance route maps', () => {
  test('personnel changes router exposes retirements and movements endpoints', () => {
    const routes = collectRoutes(personnelChangesRoutes);

    expect(routes).toEqual(
      expect.arrayContaining([
        { path: '/retirements', methods: ['get'] },
        { path: '/retirements', methods: ['post'] },
        { path: '/retirements/:id', methods: ['delete'] },
        { path: '/retirements/:id', methods: ['put'] },
        { path: '/movements', methods: ['get'] },
        { path: '/movements', methods: ['post'] },
        { path: '/movements/:id', methods: ['delete'] },
        { path: '/movements/:id', methods: ['put'] },
      ]),
    );
  });

  test('license compliance router exposes summary, list, and notify endpoints', () => {
    const routes = collectRoutes(licenseComplianceRoutes);

    expect(routes).toEqual(
      expect.arrayContaining([
        { path: '/summary', methods: ['get'] },
        { path: '/list', methods: ['get'] },
        { path: '/notify', methods: ['post'] },
      ]),
    );
  });
});
