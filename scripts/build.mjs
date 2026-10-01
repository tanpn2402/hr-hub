import { cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');

const distDir = path.join(rootDir, 'dist');
const deploymentDir = path.join(rootDir, 'deployment');

const apps = [
  {
    name: 'hr-hub-api',
    cwd: 'apps/hr-hub-api',
    dist: 'apps/hr-hub-api/dist',
    command: 'npm',
    args: ['run', 'build'],
    packageFiles: ['package.json'],
    envFile: {
      source: 'deployment/hr-hub-api/.env.production',
      target: '.env',
    },
    files: [
      'prisma.config.ts',
      'prisma/schema.prisma',
      'prisma/migrations',
    ],
  },
  {
    name: 'idenplane',
    cwd: 'apps/idenplane',
    dist: 'apps/idenplane/dist',
    command: 'npm',
    args: ['run', 'build'],
    packageFiles: ['package.json'],
    envFile: {
      source: 'deployment/idenplane/.env.production',
      target: '.env',
    },
    files: [
      'prisma.config.ts',
      'prisma/schema.prisma',
      'prisma/migrations',
      'scripts',
    ],
  },
  {
    name: 'idenplane-admin',
    cwd: 'apps/idenplane',
    dist: 'apps/idenplane/admin-ui/dist',
    command: 'npm',
    args: ['run', 'admin:build'],
  },
  {
    name: 'hr-hub-web',
    cwd: 'apps/hr-hub-web',
    dist: 'apps/hr-hub-web/dist',
    command: 'npm',
    args: ['run', 'build'],
  },
];

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(' ')}`);
    console.log(`  ${path.relative(rootDir, cwd)}\n`);

    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Build failed: ${path.relative(rootDir, cwd)} (exit code ${code})`,
          ),
        );
      }
    });
  });
}

async function buildApp(app) {
  const cwd = path.join(rootDir, app.cwd);

  await run(app.command, app.args, cwd);

  const sourceDist = path.join(rootDir, app.dist);
  const targetDist = path.join(distDir, app.name);

  if (!existsSync(sourceDist)) {
    throw new Error(`Missing build output: ${app.dist}`);
  }

  await cp(sourceDist, targetDist, { recursive: true });

  for (const file of app.packageFiles ?? []) {
    const source = path.join(cwd, file);
    const target = path.join(targetDist, file);

    if (!existsSync(source)) {
      throw new Error(`Missing package file: ${app.cwd}/${file}`);
    }
    console.log(' Copying package file: ' + source + ' -> ' + target);
    await cp(source, target);
  }

  if (app.envFile) {
    const source = path.join(rootDir, app.envFile.source);
    const target = path.join(targetDist, app.envFile.target);

    if (!existsSync(source)) {
      throw new Error(`Missing environment file: ${app.envFile.source}`);
    }
    console.log(' Copying environment file: ' + source + ' -> ' + target);
    await cp(source, target);
  }

  for (const file of app.files ?? []) {
    const source = path.join(cwd, file);
    const target = path.join(targetDist, file);

    if (!existsSync(source)) {
      throw new Error(`Missing file: ${app.cwd}/${file}`);
    }
    console.log(' Copying file: ' + source + ' -> ' + target);
    await cp(source, target, { recursive: true });
  }
}

async function main() {
  console.log('========================================');
  console.log(' HR Hub Build');
  console.log('========================================');

  // Always start with a clean deployment directory.
  console.log('\nCleaning dist/...');
  await rm(distDir, {
    recursive: true,
    force: true,
  });

  await Promise.all(apps.map(buildApp));

  // Copy deployment files into the final artifact.
  console.log('\nCopying deployment files...');

  await cp(deploymentDir, distDir, {
    recursive: true,
  });

  // Copy the root package.json and package-lock.json to the dist directory
  const rootPackageJson = path.join(rootDir, 'package.json');
  const rootPackageLockJson = path.join(rootDir, 'package-lock.json');

  await cp(rootPackageJson, path.join(distDir, 'package.json'));
  await cp(rootPackageLockJson, path.join(distDir, 'package-lock.json'));

  console.log('\n========================================');
  console.log(' Build completed');
  console.log('========================================');
  console.log('\nDeployment artifact:');
  console.log('  dist/');
  console.log('  ├── hr-hub-web/');
  console.log('  ├── hr-hub-api/');
  console.log('  ├── idenplane/');
  console.log('  ├── idenplane-admin/');
  console.log('  ├── package.json');
  console.log('  ├── package-lock.json');
  console.log('  ├── docker-compose.yaml');
  console.log('  └── nginx/');
}

main().catch((error) => {
  console.error('\nBuild failed.');
  console.error(error);
  process.exit(1);
});