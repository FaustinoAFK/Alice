import { normalizeArray, normalizeText } from './contracts';

const SENSITIVE_PATTERNS = [
  /\.env(\.|$)/i,
  /secret/i,
  /credential/i,
  /token/i,
  /private[-_]?key/i,
  /id_rsa/i,
  /service[-_]?account/i,
  /\.kdbx$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /database\.sqlite$/i,
  /\.sqlite$/i,
  /\.db$/i,
  /\.sqlite3$/i,
];

const GENERATED_PATTERNS = [
  /(^|[\\/])node_modules([\\/]|$)/i,
  /(^|[\\/])dist([\\/]|$)/i,
  /(^|[\\/])build([\\/]|$)/i,
  /(^|[\\/])target([\\/]|$)/i,
  /(^|[\\/])\.git([\\/]|$)/i,
  /package-lock\.json$/i,
  /Cargo\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /poetry\.lock$/i,
];

const extensionLanguage = (path) => {
  const lower = path.toLowerCase();
  if (/\.(jsx?|tsx?)$/.test(lower)) return 'javascript';
  if (/\.py$/.test(lower)) return 'python';
  if (/\.rs$/.test(lower)) return 'rust';
  if (/\.css$/.test(lower)) return 'css';
  if (/\.md$/.test(lower)) return 'markdown';
  if (/\.html?$/.test(lower)) return 'html';
  return '';
};

export const classifyFileRisk = (path = '') => {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) {
    return { risk: 'low', reasons: ['empty_path'] };
  }
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return { risk: 'critical', reasons: ['sensitive_file'] };
  }
  if (GENERATED_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return { risk: 'low', reasons: ['generated_or_dependency'] };
  }
  if (/(^|[\\/])(src-tauri|src|alice-core)([\\/]|$)/i.test(normalizedPath)) {
    return { risk: 'high', reasons: ['official_code'] };
  }
  if (/(\.config\.|vite\.config|eslint\.config|Cargo\.toml|package\.json|pyproject\.toml|requirements\.txt)$/i.test(normalizedPath)) {
    return { risk: 'medium', reasons: ['config_or_dependency_manifest'] };
  }
  if (/\.(md|txt|example|sample)$/i.test(normalizedPath)) {
    return { risk: 'low', reasons: ['documentation_or_example'] };
  }
  return { risk: 'medium', reasons: ['unknown_project_file'] };
};

export const detectProjectCommands = ({
  packageJson = null,
  cargoToml = false,
  pyprojectToml = false,
  requirementsTxt = false,
} = {}) => {
  const commands = [];
  if (packageJson?.scripts) {
    if (packageJson.scripts.test) commands.push({ kind: 'test', command: 'npm', args: ['test'] });
    if (packageJson.scripts.lint) commands.push({ kind: 'lint', command: 'npm', args: ['run', 'lint'] });
    if (packageJson.scripts.build) commands.push({ kind: 'build', command: 'npm', args: ['run', 'build'] });
    if (packageJson.scripts.dev) commands.push({ kind: 'run', command: 'npm', args: ['run', 'dev'] });
    if (packageJson.scripts.start) commands.push({ kind: 'run', command: 'npm', args: ['start'] });
  }
  if (cargoToml) {
    commands.push({ kind: 'test', command: 'cargo', args: ['test'] });
  }
  if (pyprojectToml || requirementsTxt) {
    commands.push({ kind: 'test', command: 'python', args: ['-m', 'pytest'] });
  }
  return commands;
};

const detectFrameworks = ({ packageJson = null, files = [] } = {}) => {
  const deps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };
  const frameworks = [];
  if (deps.react) frameworks.push('react');
  if (deps.vite || files.some((file) => /vite\.config\./i.test(file.path))) frameworks.push('vite');
  if (deps['@tauri-apps/api'] || files.some((file) => /src-tauri[\\/]/i.test(file.path))) frameworks.push('tauri');
  if (deps.vitest) frameworks.push('vitest');
  if (files.some((file) => /pyproject\.toml$/i.test(file.path))) frameworks.push('python');
  if (files.some((file) => /Cargo\.toml$/i.test(file.path))) frameworks.push('rust');
  return [...new Set(frameworks)];
};

export const buildProjectContext = ({ files = [], packageJson = null } = {}) => {
  const normalizedFiles = normalizeArray(files).map((file) => {
    const path = normalizeText(file.path || file);
    const risk = classifyFileRisk(path);
    return {
      path,
      language: extensionLanguage(path),
      risk: risk.risk,
      riskReasons: risk.reasons,
      generated: GENERATED_PATTERNS.some((pattern) => pattern.test(path)),
      sensitive: SENSITIVE_PATTERNS.some((pattern) => pattern.test(path)),
    };
  }).filter((file) => file.path);
  const fileSet = new Set(normalizedFiles.map((file) => file.path.replace(/\\/g, '/').toLowerCase()));
  const has = (name) => fileSet.has(name.toLowerCase()) || [...fileSet].some((path) => path.endsWith(`/${name.toLowerCase()}`));
  const languages = [...new Set(normalizedFiles.map((file) => file.language).filter(Boolean))];
  const commands = detectProjectCommands({
    packageJson,
    cargoToml: has('Cargo.toml'),
    pyprojectToml: has('pyproject.toml'),
    requirementsTxt: has('requirements.txt'),
  });
  const frameworks = detectFrameworks({ packageJson, files: normalizedFiles });

  return {
    readme: normalizedFiles.find((file) => /(^|[\\/])readme\.md$/i.test(file.path))?.path || '',
    manifests: {
      packageJson: has('package.json'),
      pyprojectToml: has('pyproject.toml'),
      requirementsTxt: has('requirements.txt'),
      cargoToml: has('Cargo.toml'),
    },
    lockfiles: normalizedFiles.filter((file) => /(package-lock\.json|Cargo\.lock|pnpm-lock\.yaml|yarn\.lock|poetry\.lock)$/i.test(file.path)).map((file) => file.path),
    languages,
    frameworks,
    commands,
    files: normalizedFiles,
    criticalFiles: normalizedFiles.filter((file) => file.risk === 'critical').map((file) => file.path),
    highRiskFiles: normalizedFiles.filter((file) => file.risk === 'high').map((file) => file.path),
    riskyFiles: normalizedFiles.filter((file) => file.risk === 'high' || file.risk === 'critical').map((file) => file.path),
    testFiles: normalizedFiles.filter((file) => /(^|[\\/])(__tests__|tests?|specs?)([\\/]|$)|(\.test|\.spec)\./i.test(file.path)).map((file) => file.path),
    configFiles: normalizedFiles.filter((file) =>
      /(^|[\\/])(\.github|\.vscode)([\\/]|$)|(\.config\.|config\.|vite\.config|eslint\.config|tsconfig|pyproject\.toml|Cargo\.toml|package\.json|requirements\.txt)$/i.test(file.path),
    ).map((file) => file.path),
    safeEditZones: ['docs', 'examples', 'tests', 'tmp'],
    generatedFiles: normalizedFiles.filter((file) => file.generated).map((file) => file.path),
    sensitiveFiles: normalizedFiles.filter((file) => file.sensitive).map((file) => file.path),
  };
};

export const selectFilesForPlayground = ({ files = [], includeHighRisk = false } = {}) =>
  buildProjectContext({ files }).files
    .filter((file) => !file.sensitive)
    .filter((file) => !file.generated)
    .filter((file) => includeHighRisk || (file.risk !== 'high' && file.risk !== 'critical'))
    .map((file) => file.path);
