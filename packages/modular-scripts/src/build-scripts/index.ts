import { buildStandalone } from './buildStandalone';
import { buildPackage } from './build-package';
import * as logger from '../utils/logger';
import actionPreflightCheck from '../utils/actionPreflightCheck';
import getWorkspaceLocation from '../utils/getLocation';
import { selectParallellyBuildableWorkspaces } from '../utils/selectWorkspaces';
import { setupEnvForDirectory } from '../utils/setupEnv';
import { getAllWorkspaces } from '../utils/getAllWorkspaces';
import getModularRoot from '../utils/getModularRoot';
import execAsync from '../utils/execAsync';
import type { ModularWorkspacePackage } from '@modular-scripts/modular-types';

async function build({
  packagePaths,
  preserveModules = true,
  private: includePrivate,
  ancestors,
  descendants,
  changed,
  compareBranch,
  dangerouslyIgnoreCircularDependencies,
  concurrencyLevel,
}: {
  packagePaths: string[];
  preserveModules: boolean;
  private: boolean;
  ancestors: boolean;
  descendants: boolean;
  changed: boolean;
  compareBranch?: string;
  dangerouslyIgnoreCircularDependencies: boolean;
  concurrencyLevel: number;
}): Promise<void> {
  const isSelective =
    changed || ancestors || descendants || packagePaths.length;

  const modularRoot = getModularRoot();
  const [allWorkspacePackages] = await getAllWorkspaces(modularRoot);

  // targets are either the set of what's specified in the selective options or all the packages in the monorepo
  const targets = isSelective ? packagePaths : [...allWorkspacePackages.keys()];

  const selectedTargets = await selectParallellyBuildableWorkspaces({
    targets,
    changed,
    compareBranch,
    descendants,
    ancestors,
    dangerouslyIgnoreCircularDependencies,
  });

  if (!selectedTargets.length) {
    logger.log('No workspaces to build');
    process.exit(0);
  }

  logger.debug(
    `Building the following workspaces in order: ${JSON.stringify(
      selectedTargets,
    )}`,
  );

  for (const batch of selectedTargets) {
    logger.debug(
      `Building batch: ${JSON.stringify(
        batch,
      )} with concurrency ${concurrencyLevel}`,
    );
    const jobBatch = batch.map((target) => {
      const packageInfo = allWorkspacePackages.get(target);
      if (!packageInfo) {
        throw new Error(
          `building ${target} failed - pacakge ${target} has no package info.`,
        );
      }
      return {
        id: packageInfo.name,
        promise: () => {
          return runBuildJob({
            packageInfo,
            preserveModules,
            includePrivate,
            cwd: modularRoot,
          });
        },
      };
    });
    await runBatch(jobBatch, concurrencyLevel);
  }
}

interface Job {
  id: string;
  promise: (...args: unknown[]) => Promise<void>;
}
interface BuildParameters {
  packageInfo: ModularWorkspacePackage;
  preserveModules: boolean;
  includePrivate: boolean;
  cwd: string;
}

async function runBuildJob({
  packageInfo,
  preserveModules,
  includePrivate,
  cwd,
}: BuildParameters) {
  const target = packageInfo?.name;
  try {
    const targetDirectory = await getWorkspaceLocation(target);
    await setupEnvForDirectory(targetDirectory);
    if (packageInfo?.modular) {
      // If it's modular, build with Modular
      const targetType = packageInfo.modular.type;
      if (!targetType)
        throw new Error(`modular.type missing in ${target} package.json`);

      logger.log('\nBuilding', targetType, target);

      if (targetType === 'app' || targetType === 'esm-view') {
        await buildStandalone(target, targetType);
      } else {
        await buildPackage(target, preserveModules, includePrivate);
      }
    } else {
      // Otherwise, build by running the workspace's build script
      // We're sure it's here because selectParallellyBuildableWorkspaces returns only buildable workspaces.
      logger.log('\nBuilding non-modular package', target);
      await execAsync(`yarn`, ['workspace', target, 'build'], {
        cwd,
        log: false,
      });
    }
  } catch (err) {
    logger.error(`building ${target} failed`);
    throw err;
  }
}

async function runBatch<T extends Job>(jobs: T[], concurrency: number) {
  while (jobs.length) {
    // Councurrency = [0|1] means no concurrency in a user-friendly way. Since 0 would spin forever, it's defaulted to 1.
    const nextConcurrentBatch = jobs.splice(0, concurrency || 1);
    const ids = nextConcurrentBatch.map((j) => j.id);
    const promises = nextConcurrentBatch.map((j) => j.promise);
    logger.debug(
      `runBatch is running a batch of length ${JSON.stringify(
        ids.length,
      )}: ${JSON.stringify(ids)}`,
    );
    // It's not Promise.all that starts the functions, but the act of invoking them, so we need to defer invocation until it's needed.
    await Promise.all(promises.map((f) => f()));
  }
}

export default actionPreflightCheck(build);
