#!/usr/bin/env node
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const argv = process.argv.slice(2);
const watch = argv.includes('--watch') || argv.includes('-w');
const destArg = argv.find(a => a !== '--watch' && a !== '-w');
const dest = destArg || process.env.DEV_PLUGIN_PATH;

if (!dest) {
  console.error('Usage: node scripts/copy-dev.cjs <destPluginFolder> [--watch]');
  console.error('Or set DEV_PLUGIN_PATH env var.');
  process.exit(1);
}

const files = ['main.js', 'manifest.json', 'styles.css'];

async function copyOnce() {
  try {
    await fsp.mkdir(dest, { recursive: true });
  } catch (e) {
    console.error('Failed to create dest folder', e.message);
    return;
  }

  for (const f of files) {
    const src = path.join(process.cwd(), f);
    const dst = path.join(dest, f);
    try {
      await fsp.copyFile(src, dst);
      console.log(`Copied ${f} -> ${dst}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`Skipped ${f}: source not found (${src})`);
      } else {
        console.error(`Error copying ${f}:`, err.message);
      }
    }
  }
}

copyOnce().catch(e => console.error(e));

if (watch) {
  // prefer chokidar if installed, fall back to fs.watch
  let chokidar;
  try { chokidar = require('chokidar'); } catch (e) { chokidar = null; }

  if (chokidar) {
    const watcher = chokidar.watch(files.map(f => path.join(process.cwd(), f)), { ignoreInitial: true });
    watcher.on('all', (ev, p) => {
      console.log('Detected change', ev, p);
      copyOnce().catch(e => console.error(e));
    });
    console.log('Watching build outputs for changes...');
  } else {
    const watchPaths = files.map(f => path.join(process.cwd(), f));
    watchPaths.forEach((watchPath) => {
      try {
        fs.watch(watchPath, () => {
          console.log('Detected change', watchPath);
          copyOnce().catch(e => console.error(e));
        });
      } catch (e) {
        // ignore watch errors
      }
    });
    console.log('Watching build outputs for changes (fs.watch)...');
  }
}
