'use strict';

const fs = require('fs');
const path = require('path');

const FILENAME = 'calibration.json';
const SCHEMA_VERSION = '1.0';

/**
 * Get the path to calibration.json in the current working directory
 */
function getPath() {
  return path.join(process.cwd(), FILENAME);
}

/**
 * Check if calibration file exists
 */
function exists() {
  return fs.existsSync(getPath());
}

/**
 * Validate calibration data schema
 */
function validate(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid calibration data: not an object');
  }

  if (data.version !== SCHEMA_VERSION) {
    throw new Error(`Invalid schema version: expected ${SCHEMA_VERSION}, got ${data.version}`);
  }

  if (!data.mappings || typeof data.mappings !== 'object') {
    throw new Error('Invalid calibration data: missing mappings object');
  }

  const keyPattern = /^\d+&[A-F0-9]+\|\d+$/i;

  for (const [key, value] of Object.entries(data.mappings)) {
    if (!keyPattern.test(key)) {
      throw new Error(`Invalid mapping key format: ${key}`);
    }
    if (!Number.isInteger(value) || value < 1 || value > 7) {
      throw new Error(`Invalid port value for ${key}: must be integer 1-7, got ${value}`);
    }
  }

  return true;
}

/**
 * Load calibration data from file
 */
function load() {
  const filePath = getPath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    validate(data);
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Corrupted calibration file: invalid JSON - ${err.message}`);
    }
    throw err;
  }
}

/**
 * Save calibration data to file
 */
function save(data) {
  const filePath = getPath();

  // Ensure required fields
  const now = new Date().toISOString();
  const toSave = {
    version: SCHEMA_VERSION,
    createdAt: data.createdAt || now,
    updatedAt: now,
    hubInfo: data.hubInfo || {},
    mappings: data.mappings || {}
  };

  validate(toSave);

  try {
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new Error('Cannot write calibration file to current directory');
    }
    throw err;
  }
}

/**
 * Clear (delete) calibration file if it exists
 */
function clear() {
  const filePath = getPath();

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new Error('Cannot delete calibration file');
      }
      throw err;
    }
  }
}

/**
 * Create a new empty calibration data structure
 */
function createEmpty() {
  return {
    version: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hubInfo: {
      primaryChip: null,
      secondaryChip: null
    },
    mappings: {}
  };
}

module.exports = {
  getPath,
  exists,
  load,
  save,
  clear,
  validate,
  createEmpty
};
