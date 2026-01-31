'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

const TIMEOUT_MS = 10000;
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

/**
 * Execute a PowerShell script file and return parsed JSON result
 */
async function runScript(scriptName, retryOnce = true) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;

  try {
    const { stdout } = await execAsync(command, { timeout: TIMEOUT_MS });
    const trimmed = stdout.trim();

    if (!trimmed || trimmed === '[]') {
      return [];
    }

    try {
      const result = JSON.parse(trimmed);
      // Wrap single object in array
      return Array.isArray(result) ? result : [result];
    } catch {
      // JSON parse failed, return empty
      return [];
    }
  } catch (err) {
    // Check if PowerShell not found
    if (err.code === 'ENOENT') {
      throw new Error('PowerShell not found. Requires Windows PowerShell 5.1');
    }

    // Timeout - retry once
    if (err.killed && retryOnce) {
      return runScript(scriptName, false);
    }

    if (err.killed) {
      throw new Error('PowerShell command timed out');
    }

    throw err;
  }
}

/**
 * Get connected USB mass storage drives
 * Returns: [{ name, serial, location, parent }, ...]
 *
 * Note: 'location' is from the USB device (drive's parent)
 *       'parent' is the hub (drive's grandparent) for chip identification
 */
async function getDrives() {
  return runScript('get-drives.ps1');
}

/**
 * Get VL822 USB hub instances
 * Returns: [{ name, instanceId, location, parent }, ...]
 */
async function getHubs() {
  return runScript('get-hubs.ps1');
}

module.exports = {
  getDrives,
  getHubs
};
