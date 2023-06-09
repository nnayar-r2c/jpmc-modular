import { parsePackageName } from './parsePackageName';
import { getConfig } from './config';
import type { Dependency } from '@schemastore/package';

interface BuildImportInfoParams {
  externalDependencies: Dependency;
  externalResolutions: Dependency;
  selectiveCDNResolutions: Dependency;
}

export interface ImportInfo extends BuildImportInfoParams {
  importSet: Set<string>;
  externalCdnTemplate: string;
}

export function buildImportInfo(
  workspacePath: string,
  {
    externalDependencies,
    externalResolutions,
    selectiveCDNResolutions,
  }: BuildImportInfoParams,
): ImportInfo {
  const externalCdnTemplate = getConfig('externalCdnTemplate', workspacePath);

  // Add react-dom if only react is specified in the dependencies
  if (!externalDependencies['react-dom']) {
    externalDependencies['react-dom'] = externalDependencies['react'];
  }
  if (!externalResolutions['react-dom']) {
    externalResolutions['react-dom'] = externalResolutions['react'];
  }

  const importSet = new Set(Object.keys(externalDependencies));

  return {
    importSet,
    externalResolutions,
    selectiveCDNResolutions,
    externalDependencies,
    externalCdnTemplate,
  };
}

export function rewriteModuleSpecifier(
  importInfo: ImportInfo,
  moduleSpecifier: string,
): string | undefined {
  const {
    externalCdnTemplate,
    externalResolutions,
    externalDependencies,
    selectiveCDNResolutions,
  } = importInfo;
  const { dependencyName: name, submodule } = parsePackageName(moduleSpecifier);
  const submodulePath = submodule ? `/${submodule}` : '';

  const hasPath = externalCdnTemplate.includes('[path]');

  if (name && externalDependencies[name]) {
    const dependencyUrl = externalCdnTemplate
      .replace('[name]', name)
      .replace(
        '[version]',
        externalDependencies[name] ?? externalResolutions[name],
      )
      .replace('[resolution]', externalResolutions[name])
      .replace('[path]', submodulePath)
      .replace(
        '[selectiveCDNResolutions]',
        selectiveCDNResolutions
          ? Object.entries(selectiveCDNResolutions)
              .map(([key, value]) => `${key}@${value}`)
              .join(',')
          : '',
      );

    return `${dependencyUrl}${hasPath ? '' : submodulePath}`;
  }
}
