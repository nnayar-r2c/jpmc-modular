import { partitionDependencies } from '../utils/filterDependencies';

describe('partitionDependencies', () => {
  describe('WHEN we specify an allow / block list', () => {
    it('THEN expects packages to be blocked / allowed by exact name with blocking winning in case of intersection', () => {
      const fakePkg = {
        fake1: '^2.0.1',
        fake2: '^1.0.1',
        fake3: '^3.12.5',
        fake4: '^4.5.36',
        fake5: '^0.0.1',
      };
      const allowList = ['fake1', 'fake2', 'fake3'];
      const blockList = ['fake2'];
      expect(
        partitionDependencies({
          dependencies: fakePkg,
          allowList,
          blockList,
          workspaceInfo: {},
        }),
      ).toEqual({
        bundled: {
          fake2: '^1.0.1',
          fake4: '^4.5.36',
          fake5: '^0.0.1',
        },
        external: {
          fake1: '^2.0.1',
          fake3: '^3.12.5',
        },
      });
    });
    it('THEN expects packages to be blocked / allowed by wildcard', () => {
      const fakePkg = {
        'fake1-typea': '^2.0.1',
        'fake2-typea': '^1.0.1',
        'fake3-typeb': '^3.12.5',
        'fake4-typeb': '^4.5.36',
        'fake5-typec': '^0.0.1',
      };
      const allowList = ['**'];
      const blockList = ['*-typeb'];
      expect(
        partitionDependencies({
          dependencies: fakePkg,
          allowList,
          blockList,
          workspaceInfo: {},
        }),
      ).toEqual({
        bundled: {
          'fake3-typeb': '^3.12.5',
          'fake4-typeb': '^4.5.36',
        },
        external: {
          'fake1-typea': '^2.0.1',
          'fake2-typea': '^1.0.1',
          'fake5-typec': '^0.0.1',
        },
      });
    });
    it('THEN expects scoped packages to be allowed by default', () => {
      const fakePkg = {
        '@somescope/fake1': '^2.0.1',
        '@somescope/fake2': '^1.0.1',
      };
      expect(
        partitionDependencies({
          dependencies: fakePkg,
          workspaceInfo: {},
        }),
      ).toEqual({
        bundled: {},
        external: {
          '@somescope/fake1': '^2.0.1',
          '@somescope/fake2': '^1.0.1',
        },
      });
    });
    it('THEN expects workspace packages to be blocked by default', () => {
      const fakePkg = {
        '@somescope/fake1': '^2.0.1',
        '@somescope/fake2': '^1.0.1',
        '@workspacescope/my-local-pkg': '7.7.7',
      };
      expect(
        partitionDependencies({
          dependencies: fakePkg,
          workspaceInfo: {
            '@workspacescope/my-local-pkg': {
              location: '',
              version: '7.7.7',
              type: 'esm-view',
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
              public: false,
            },
          },
        }),
      ).toEqual({
        bundled: { '@workspacescope/my-local-pkg': '7.7.7' },
        external: {
          '@somescope/fake1': '^2.0.1',
          '@somescope/fake2': '^1.0.1',
        },
      });
    });
    it('THEN expects workspace packages to be blocked with workspace versions', () => {
      const fakePkg = {
        '@somescope/fake1': '^2.0.1',
        '@somescope/fake2': '^1.0.1',
        '@workspacescope/my-local-pkg': 'workspace:^7.7.7',
        '@workspacescope/my-other-local-pkg': 'workspace:*',
      };
      expect(
        partitionDependencies({
          dependencies: fakePkg,
          workspaceInfo: {
            '@workspacescope/my-local-pkg': {
              location: '',
              version: '7.7.12',
              type: 'esm-view',
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
              public: false,
            },
            '@workspacescope/my-other-local-pkg': {
              location: '',
              version: '1.2.3',
              type: 'esm-view',
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
              public: false,
            },
          },
        }),
      ).toEqual({
        bundled: {
          '@workspacescope/my-local-pkg': 'workspace:^7.7.7',
          '@workspacescope/my-other-local-pkg': 'workspace:*',
        },
        external: {
          '@somescope/fake1': '^2.0.1',
          '@somescope/fake2': '^1.0.1',
        },
      });
    });

    it('THEN expects workspace packages to be blocked with workspace versions not satisfying semver', () => {
      const fakePkg = {
        '@somescope/fake1': '^2.0.1',
        '@somescope/fake2': '^1.0.1',
        '@workspacescope/my-local-pkg': '^7.7.7',
        '@workspacescope/my-other-local-pkg': 'workspace:*',
      };
      expect(
        partitionDependencies({
          dependencies: fakePkg,
          workspaceInfo: {
            '@workspacescope/my-local-pkg': {
              location: '',
              version: '7.6.52',
              type: 'esm-view',
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
              public: false,
            },
            '@workspacescope/my-other-local-pkg': {
              location: '',
              version: '1.2.3',
              type: 'esm-view',
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
              public: false,
            },
          },
        }),
      ).toEqual({
        bundled: {
          '@workspacescope/my-other-local-pkg': 'workspace:*',
        },
        external: {
          '@workspacescope/my-local-pkg': '^7.7.7',
          '@somescope/fake1': '^2.0.1',
          '@somescope/fake2': '^1.0.1',
        },
      });
    });
  });
});
