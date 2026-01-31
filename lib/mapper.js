'use strict';

/**
 * PortMapper - Normalizes Windows USB locations to stable keys and performs lookups
 *
 * The key challenge: Same physical port appears under different Windows hub instances
 * depending on USB 3.0 vs 2.0 device speed. Solution: Extract stable "chipPrefix|portIndex"
 * key from device parent InstanceId.
 */
class PortMapper {
  constructor(calibrationData) {
    this.mappings = calibrationData?.mappings || {};
  }

  /**
   * Extract chip prefix from parent InstanceId
   * Example: "USB\VID_2109&PID_0822\9&238498F1&0&3" → "9&238498F1"
   */
  extractChipPrefix(parent) {
    if (!parent) return null;

    // Match pattern: backslash, then digits, ampersand, hex chars, before another ampersand
    const match = parent.match(/\\(\d+&[A-F0-9]+)&/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Extract port index from location string
   * Example: "Port_#0003.Hub_#0008" → "3"
   */
  extractPortIndex(location) {
    if (!location) return null;

    const match = location.match(/Port_#(\d+)/i);
    if (!match) return null;

    // Convert "0003" to "3" (strip leading zeros)
    return String(parseInt(match[1], 10));
  }

  /**
   * Create normalized location key from location and parent
   * Returns: "chipPrefix|portIndex" or null if extraction fails
   */
  normalizeLocation(location, parent) {
    const chipPrefix = this.extractChipPrefix(parent);
    const portIndex = this.extractPortIndex(location);

    if (!chipPrefix || !portIndex) {
      return null;
    }

    return `${chipPrefix}|${portIndex}`;
  }

  /**
   * Get physical port number (1-7) for a device
   */
  getPhysicalPort(location, parent) {
    const key = this.normalizeLocation(location, parent);
    if (!key) return null;

    return this.mappings[key] || null;
  }

  /**
   * Add a mapping from location/parent to physical port
   * Returns the key that was added
   */
  addMapping(location, parent, physicalPort) {
    const key = this.normalizeLocation(location, parent);
    if (!key) {
      throw new Error('Cannot normalize location - invalid location or parent data');
    }

    if (!Number.isInteger(physicalPort) || physicalPort < 1 || physicalPort > 7) {
      throw new Error('Physical port must be integer 1-7');
    }

    this.mappings[key] = physicalPort;
    return key;
  }

  /**
   * Check if a mapping exists for this location/parent
   */
  hasMapping(location, parent) {
    const key = this.normalizeLocation(location, parent);
    return key ? key in this.mappings : false;
  }

  /**
   * Get existing port number if mapped, null otherwise
   */
  getExistingPort(location, parent) {
    const key = this.normalizeLocation(location, parent);
    return key ? this.mappings[key] || null : null;
  }

  /**
   * Check if the chip prefix from this device exists in any mapping
   * Used to detect calibration mismatch (hub moved to different USB port)
   */
  isKnownChip(location, parent) {
    const chipPrefix = this.extractChipPrefix(parent);
    if (!chipPrefix) return false;

    return Object.keys(this.mappings).some(key => key.startsWith(chipPrefix + '|'));
  }

  /**
   * Check if calibration is complete (all 7 ports mapped)
   */
  isCalibrated() {
    return Object.keys(this.mappings).length >= 7;
  }

  /**
   * Get number of mapped ports
   */
  getMappingCount() {
    return Object.keys(this.mappings).length;
  }

  /**
   * Get all mappings
   */
  getAllMappings() {
    return { ...this.mappings };
  }

  /**
   * Get unique chip prefixes from current mappings
   */
  getKnownChips() {
    const chips = new Set();
    for (const key of Object.keys(this.mappings)) {
      const [chipPrefix] = key.split('|');
      chips.add(chipPrefix);
    }
    return Array.from(chips);
  }
}

module.exports = PortMapper;
