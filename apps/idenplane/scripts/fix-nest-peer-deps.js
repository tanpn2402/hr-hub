#!/usr/bin/env node
// This monorepo has two Nest major versions installed side by side: apps/late-hub
// needs @nestjs/common@10.x (hoisted to the workspace root), apps/idenplane
// needs @nestjs/common@11.x (nested under apps/idenplane/node_modules since it
// conflicts with the root version).
//
// @nestjs/schedule and @nestjs/throttler are idenplane-only dependencies with
// a permissive peerDependencies range ("^10.0.0 || ^11.0.0" for @nestjs/common
// and @nestjs/core), so npm is happy to satisfy that peer with whichever copy
// it already hoisted to the root (v10) — there's no version *conflict* from
// npm's point of view, just an unwanted *identity* mismatch. Because Nest's DI
// container matches providers like Reflector by class identity, a schedule/
// throttler module built against the root's v10 classes cannot resolve
// providers from idenplane's v11 container, and the app fails to boot with
// "Nest can't resolve dependencies of the SchedulerMetadataAccessor (?)".
//
// npm's `overrides` field does not force these two packages to be physically
// nested (only auto-install-peers/version-range selection, not placement), so
// instead this script runs after every `npm install` and copies the two
// packages from the workspace root into apps/idenplane's own node_modules,
// so Node's module resolution finds @nestjs/common/@nestjs/core there first
// (idenplane's v11 copies) instead of walking up to the root's v10 copies.
const fs = require('fs');
const path = require('path');

const ROOT_NODE_MODULES = path.join(__dirname, '..', '..', '..', 'node_modules');
const LOCAL_NODE_MODULES = path.join(__dirname, '..', 'node_modules');
const PACKAGES = ['@nestjs/schedule', '@nestjs/throttler'];

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
}

for (const pkg of PACKAGES) {
  const src = path.join(ROOT_NODE_MODULES, pkg);
  const dest = path.join(LOCAL_NODE_MODULES, pkg);
  if (!fs.existsSync(src)) {
    console.warn(`[fix-nest-peer-deps] ${pkg} not found at workspace root, skipping`);
    continue;
  }
  copyDir(src, dest);
  console.log(`[fix-nest-peer-deps] nested ${pkg} under apps/idenplane/node_modules`);
}
