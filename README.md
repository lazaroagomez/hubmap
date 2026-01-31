# USB Hub Port Mapper

CLI tool that maps USB flash drives to physical port positions (1-7) on a cascaded VL822 USB hub.

## The Problem

The same physical USB port appears under different Windows hub instances depending on whether a USB 2.0 or 3.0 device is connected. This makes it impossible to reliably identify which physical port a device is plugged into.

## The Solution

Extract a stable `chipPrefix|portIndex` key from the device's parent hub InstanceId. This key remains consistent regardless of device speed.

## Hardware Specific

This tool was built for a specific 7-port VL822 cascaded hub configuration. However, the approach is generic and can be adapted to other USB hubs:

1. The `scripts/get-drives.ps1` traverses the device tree to find the hub
2. The `lib/mapper.js` extracts chip prefix from any hub's InstanceId
3. Calibration maps your specific hub's internal ports to physical positions

To adapt for a different hub, you may need to modify the hub detection in `scripts/get-hubs.ps1` (currently filters for VL822's VID `2109`).

## Requirements

- Windows 10/11
- Node.js >= 14
- PowerShell 5.1+ (uses `Get-PnpDevice` cmdlet)

## Usage

```bash
# Show current status
node index.js status

# Calibrate (one-time setup with a single USB drive)
node index.js calibrate

# Watch for changes in real-time
node index.js monitor

# Show hub topology
node index.js hubs

# Clear calibration
node index.js reset
```

## Integration

The modules can be imported directly for use in other Node.js applications:

```javascript
const scanner = require('./lib/scanner');
const PortMapper = require('./lib/mapper');
const store = require('./lib/store');

const calibration = store.load();
const mapper = new PortMapper(calibration);
const drives = await scanner.getDrives();

for (const drive of drives) {
  const port = mapper.getPhysicalPort(drive.location, drive.parent);
  console.log(`Port ${port}: ${drive.name}`);
}
```

## License

MIT
