#!/usr/bin/env node
'use strict';

const readline = require('readline');
const store = require('./lib/store');
const scanner = require('./lib/scanner');
const PortMapper = require('./lib/mapper');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Readline interface (created on demand)
let rl = null;

function createReadline() {
  if (rl) return rl;

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  process.on('SIGINT', () => {
    console.log('\nExiting...');
    rl.close();
    process.exit(0);
  });

  return rl;
}

function closeReadline() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function ask(question) {
  createReadline();
  return new Promise(resolve => rl.question(question, resolve));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper functions for colored output
function success(msg) {
  console.log(`${colors.green}${msg}${colors.reset}`);
}

function warn(msg) {
  console.log(`${colors.yellow}${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.cyan}${msg}${colors.reset}`);
}

// Format date for display
function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function formatDateTime() {
  const now = new Date();
  return `${now.toLocaleDateString('en-US')} ${formatTime()}`;
}

// ============================================
// STATUS COMMAND
// ============================================
async function cmdStatus() {
  let calibration = null;
  let mapper = null;

  // Load calibration
  try {
    calibration = store.load();
    mapper = new PortMapper(calibration);
  } catch (err) {
    if (err.message.includes('Corrupted')) {
      error('\nCalibration file is corrupted.');
      const answer = await ask('Delete and recalibrate? (Y/n): ');
      if (answer.toLowerCase() !== 'n') {
        store.clear();
        console.log('Calibration cleared. Run "calibrate" to set up again.');
      }
      closeReadline();
      return;
    }
    throw err;
  }

  // Get current drives
  let drives = [];
  try {
    drives = await scanner.getDrives();
  } catch (err) {
    error(`\nError scanning drives: ${err.message}`);
    closeReadline();
    process.exit(1);
  }

  // Build port status array
  const ports = Array(7).fill(null).map((_, i) => ({
    port: i + 1,
    device: null,
    serial: ''
  }));

  const unmappedDrives = [];
  let hasCalibrationMismatch = false;

  for (const drive of drives) {
    if (!mapper) {
      unmappedDrives.push(drive);
      continue;
    }

    const port = mapper.getPhysicalPort(drive.location, drive.parent);

    if (port) {
      ports[port - 1].device = drive.name || 'USB Drive';
      ports[port - 1].serial = drive.serial || '';
    } else if (mapper.getMappingCount() > 0 && !mapper.isKnownChip(drive.location, drive.parent)) {
      // Only show mismatch if we have calibration but this hub is unknown
      hasCalibrationMismatch = true;
      unmappedDrives.push(drive);
    } else {
      unmappedDrives.push(drive);
    }
  }

  // Display output
  console.log('');
  console.log('\u2554' + '\u2550'.repeat(59) + '\u2557');
  console.log('\u2551' + '           USB Hub Port Mapper - Status                    '.padEnd(59) + '\u2551');
  console.log('\u2560' + '\u2550'.repeat(59) + '\u2563');

  // Calibration status line
  if (calibration && mapper.isCalibrated()) {
    const dateStr = formatDate(calibration.updatedAt);
    console.log(`\u2551 Calibration: ${colors.green}\u2713 Complete${colors.reset} (${dateStr})`.padEnd(70) + '\u2551');
  } else if (calibration) {
    console.log(`\u2551 Calibration: ${colors.yellow}Partial${colors.reset} (${mapper.getMappingCount()}/7 ports)`.padEnd(70) + '\u2551');
  } else {
    console.log(`\u2551 Calibration: ${colors.red}\u2717 Not Calibrated${colors.reset}`.padEnd(70) + '\u2551');
  }

  console.log(`\u2551 Mapped Ports: ${mapper ? mapper.getMappingCount() : 0}/7`.padEnd(60) + '\u2551');

  if (hasCalibrationMismatch) {
    console.log('\u2560' + '\u2550'.repeat(59) + '\u2563');
    console.log(`\u2551 ${colors.yellow}! Calibration Mismatch - Unknown hub detected${colors.reset}`.padEnd(70) + '\u2551');
  }

  console.log('\u2560' + '\u2550'.repeat(59) + '\u2563');
  console.log('\u2551  PORT \u2502 DEVICE                    \u2502 SERIAL                \u2551');
  console.log('\u2560' + '\u2550'.repeat(59) + '\u2563');

  for (const p of ports) {
    const portStr = String(p.port).padStart(3).padEnd(5);
    const deviceStr = (p.device || '(empty)').substring(0, 25).padEnd(25);
    const serialStr = p.serial.substring(0, 20).padEnd(20);

    if (p.device) {
      console.log(`\u2551 ${colors.green}${portStr}${colors.reset} \u2502 ${deviceStr} \u2502 ${serialStr} \u2551`);
    } else {
      console.log(`\u2551 ${portStr} \u2502 ${deviceStr} \u2502 ${serialStr} \u2551`);
    }
  }

  if (unmappedDrives.length > 0) {
    console.log('\u2560' + '\u2550'.repeat(59) + '\u2563');
    console.log(`\u2551 ${colors.yellow}Unknown Devices:${colors.reset}`.padEnd(70) + '\u2551');

    for (const drive of unmappedDrives) {
      const name = (drive.name || 'USB Drive').substring(0, 30);
      console.log(`\u2551   ? \u2502 ${name.padEnd(30)} \u2502 ${(drive.serial || '').padEnd(16)} \u2551`);
    }
  }

  console.log('\u255A' + '\u2550'.repeat(59) + '\u255D');

  if (!calibration) {
    warn('\nRun "node index.js calibrate" to set up port mapping.');
  }

  closeReadline();
}

// ============================================
// CALIBRATE COMMAND
// ============================================
async function cmdCalibrate() {
  console.log('');
  info('\u2550'.repeat(50));
  info('  USB Hub Port Mapper - Calibration Wizard');
  info('\u2550'.repeat(50));

  // Check existing calibration
  try {
    const existing = store.load();
    if (existing) {
      const mapper = new PortMapper(existing);
      warn(`\nExisting calibration found (${mapper.getMappingCount()}/7 ports mapped).`);
      const answer = await ask('Overwrite? (Y/n): ');
      if (answer.toLowerCase() === 'n') {
        console.log('Calibration cancelled.');
        closeReadline();
        return;
      }
    }
  } catch (err) {
    if (err.message.includes('Corrupted')) {
      warn('\nExisting calibration file is corrupted. Starting fresh.');
      store.clear();
    }
  }

  // Instructions
  console.log('\n' + colors.bold + 'Instructions:' + colors.reset);
  console.log('1. Use ONE USB flash drive for the entire calibration');
  console.log('2. You will insert it into each port (1-7) one at a time');
  console.log('3. Wait for the prompt before moving to the next port');
  console.log('');

  const ready = await ask('Ready to begin? (Y/n): ');
  if (ready.toLowerCase() === 'n') {
    console.log('Calibration cancelled.');
    closeReadline();
    return;
  }

  // Create new calibration data
  const calibration = store.createEmpty();
  const mapper = new PortMapper(calibration);

  // Calibrate each port
  for (let port = 1; port <= 7; port++) {
    console.log('');
    info(`\u2500\u2500\u2500 Port ${port} of 7 \u2500\u2500\u2500`);

    await ask(`Insert USB drive into PORT ${port}, then press ENTER...`);

    // Wait for Windows to detect
    console.log('Scanning...');
    await sleep(1000);

    // Scan for drives
    let drives = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        drives = await scanner.getDrives();
      } catch (err) {
        error(`Scan error: ${err.message}`);
        closeReadline();
        process.exit(1);
      }

      if (drives.length === 0) {
        warn('No USB drives detected.');
        const retry = await ask('Press ENTER to retry or type "skip" to skip this port: ');
        if (retry.toLowerCase() === 'skip') {
          warn(`Skipped port ${port}`);
          break;
        }
        await sleep(1000);
        attempts++;
        continue;
      }

      if (drives.length > 1) {
        warn(`Multiple drives detected (${drives.length}). Please ensure only ONE drive is connected.`);
        await ask('Remove extra drives and press ENTER to retry: ');
        await sleep(1000);
        attempts++;
        continue;
      }

      // Single drive detected
      break;
    }

    if (drives.length !== 1) {
      if (drives.length === 0) {
        continue; // Skipped
      }
      warn('Could not isolate a single drive. Skipping port.');
      continue;
    }

    const drive = drives[0];

    // Check for duplicate mapping
    const existingPort = mapper.getExistingPort(drive.location, drive.parent);
    if (existingPort !== null) {
      warn(`\nWarning: This location was already mapped to port ${existingPort}.`);
      const overwrite = await ask(`Remap to port ${port}? (Y/n): `);
      if (overwrite.toLowerCase() === 'n') {
        warn(`Skipped port ${port}`);
        continue;
      }
    }

    // Add mapping
    try {
      const key = mapper.addMapping(drive.location, drive.parent, port);
      calibration.mappings = mapper.getAllMappings();

      success(`\u2713 Port ${port} mapped: ${drive.name || 'USB Drive'}`);
      console.log(`  Key: ${key}`);
    } catch (err) {
      error(`Failed to map port ${port}: ${err.message}`);
      continue;
    }

    // Prompt to remove (except for last port)
    if (port < 7) {
      await ask('Remove the drive, then press ENTER...');
      await sleep(500);
    }
  }

  // Save calibration
  console.log('');
  try {
    store.save(calibration);
    success('\u2713 Calibration saved!');
  } catch (err) {
    error(`Failed to save: ${err.message}`);
    closeReadline();
    process.exit(1);
  }

  // Summary
  console.log('\n' + colors.bold + 'Summary:' + colors.reset);
  console.log(`Mapped: ${mapper.getMappingCount()}/7 ports`);

  if (mapper.getMappingCount() < 7) {
    warn('Calibration incomplete. Run calibrate again to map remaining ports.');
  } else {
    success('Calibration complete! Run "status" to view port mappings.');
  }

  closeReadline();
}

// ============================================
// MONITOR COMMAND
// ============================================
async function cmdMonitor() {
  let calibration = null;
  let mapper = null;

  try {
    calibration = store.load();
    mapper = new PortMapper(calibration);
  } catch (err) {
    if (err.message.includes('Corrupted')) {
      error('Calibration file is corrupted. Run "reset" then "calibrate".');
      process.exit(1);
    }
  }

  if (!mapper || !mapper.isCalibrated()) {
    warn('Warning: Not fully calibrated. Some ports may show as unknown.');
  }

  console.log('');
  info(`[${formatDateTime()}] Watching for USB changes (Ctrl+C to exit)...`);
  console.log('');

  // Track previous state
  let previousDrives = new Map();

  // Initial scan
  try {
    const drives = await scanner.getDrives();
    for (const drive of drives) {
      const key = mapper ? mapper.normalizeLocation(drive.location, drive.parent) : drive.serial;
      previousDrives.set(key || drive.serial, drive);
    }
  } catch (err) {
    error(`Initial scan failed: ${err.message}`);
    process.exit(1);
  }

  // Poll loop
  const pollInterval = setInterval(async () => {
    try {
      const currentDrives = await scanner.getDrives();
      const currentMap = new Map();

      for (const drive of currentDrives) {
        const key = mapper ? mapper.normalizeLocation(drive.location, drive.parent) : drive.serial;
        currentMap.set(key || drive.serial, drive);
      }

      // Check for new drives
      for (const [key, drive] of currentMap) {
        if (!previousDrives.has(key)) {
          const port = mapper ? mapper.getPhysicalPort(drive.location, drive.parent) : null;
          const time = formatTime();

          if (port) {
            success(`[${time}] + PORT ${port} \u2502 ${drive.name || 'USB Drive'} \u2502 ${drive.serial || ''}`);
          } else {
            warn(`[${time}] ? UNKNOWN \u2502 ${drive.name || 'USB Drive'} \u2502 ${drive.serial || ''}`);
          }
        }
      }

      // Check for removed drives
      for (const [key, drive] of previousDrives) {
        if (!currentMap.has(key)) {
          const port = mapper ? mapper.getPhysicalPort(drive.location, drive.parent) : null;
          const time = formatTime();

          if (port) {
            console.log(`[${time}] ${colors.red}- PORT ${port}${colors.reset} \u2502 Device removed`);
          } else {
            console.log(`[${time}] ${colors.red}- UNKNOWN${colors.reset} \u2502 Device removed`);
          }
        }
      }

      previousDrives = currentMap;
    } catch (err) {
      // Silently ignore transient errors during monitoring
    }
  }, 2000);

  // Handle exit
  process.on('SIGINT', () => {
    clearInterval(pollInterval);
    console.log('\nMonitor stopped.');
    process.exit(0);
  });
}

// ============================================
// RESET COMMAND
// ============================================
async function cmdReset() {
  if (!store.exists()) {
    console.log('No calibration file found.');
    closeReadline();
    return;
  }

  const answer = await ask('Delete calibration data? (Y/n): ');
  if (answer.toLowerCase() === 'n') {
    console.log('Cancelled.');
    closeReadline();
    return;
  }

  try {
    store.clear();
    success('Calibration data cleared.');
  } catch (err) {
    error(`Failed to clear: ${err.message}`);
  }

  closeReadline();
}

// ============================================
// HUBS COMMAND
// ============================================
async function cmdHubs() {
  console.log('');
  info('VL822 Hub Topology');
  info('\u2500'.repeat(40));

  let hubs = [];
  try {
    hubs = await scanner.getHubs();
  } catch (err) {
    error(`Error scanning hubs: ${err.message}`);
    process.exit(1);
  }

  if (hubs.length === 0) {
    warn('No VL822 hubs detected.');
    console.log('Make sure the hub is connected and powered on.');
    return;
  }

  console.log(`Found ${hubs.length} hub instance(s):\n`);

  for (const hub of hubs) {
    const isUSB3 = hub.instanceId?.includes('PID_0822');
    const speedLabel = isUSB3 ? 'USB 3.0' : 'USB 2.0';

    console.log(`${colors.cyan}\u2022${colors.reset} ${hub.name || 'VL822 Hub'} (${speedLabel})`);
    console.log(`  Instance: ${hub.instanceId}`);
    console.log(`  Location: ${hub.location || 'N/A'}`);
    console.log(`  Parent:   ${hub.parent || 'N/A'}`);
    console.log('');
  }

  // Group by chip
  const chips = new Map();
  for (const hub of hubs) {
    const mapper = new PortMapper();
    const prefix = mapper.extractChipPrefix(hub.instanceId);
    if (prefix) {
      if (!chips.has(prefix)) {
        chips.set(prefix, []);
      }
      chips.get(prefix).push(hub);
    }
  }

  if (chips.size > 0) {
    info('Chip Summary:');
    for (const [prefix, hubList] of chips) {
      console.log(`  ${prefix}: ${hubList.length} instance(s)`);
    }
  }
}

// ============================================
// HELP COMMAND
// ============================================
function cmdHelp() {
  console.log(`
${colors.bold}USB Hub Port Mapper${colors.reset}
Maps USB flash drives to physical port positions (1-7) on VL822 cascaded hubs.

${colors.cyan}Usage:${colors.reset}
  node index.js [command]

${colors.cyan}Commands:${colors.reset}
  status     Show calibration status and connected drives (default)
  calibrate  Interactive 7-step calibration wizard
  monitor    Continuous watch mode (2s polling)
  reset      Clear calibration data
  hubs       Show VL822 hub topology
  help       Show this help message

${colors.cyan}Examples:${colors.reset}
  node index.js              # Show status
  node index.js calibrate    # Start calibration
  node index.js monitor      # Watch for USB changes

${colors.cyan}How It Works:${colors.reset}
  The same physical port appears differently in Windows depending on whether
  a USB 2.0 or 3.0 device is connected. This tool extracts a stable key from
  the device's parent hub instance ID to reliably identify physical ports.
`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  // Check platform
  if (process.platform !== 'win32') {
    error('This tool requires Windows.');
    process.exit(1);
  }

  const command = process.argv[2] || 'status';

  try {
    switch (command.toLowerCase()) {
      case 'status':
        await cmdStatus();
        break;
      case 'calibrate':
        await cmdCalibrate();
        break;
      case 'monitor':
        await cmdMonitor();
        break;
      case 'reset':
        await cmdReset();
        break;
      case 'hubs':
        await cmdHubs();
        break;
      case 'help':
      case '--help':
      case '-h':
        cmdHelp();
        break;
      default:
        error(`Unknown command: ${command}`);
        cmdHelp();
        process.exit(1);
    }
  } catch (err) {
    error(`\nError: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    closeReadline();
    process.exit(1);
  }
}

main();
