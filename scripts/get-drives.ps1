# Get USB mass storage drives with proper parent/grandparent info for hub port mapping
$drives = Get-PnpDevice -Class DiskDrive -Status OK | Where-Object { $_.InstanceId -like '*USBSTOR*' }

$results = @()

foreach ($drive in $drives) {
    # Extract serial from InstanceId
    $instancePart = ($drive.InstanceId -split '\\')[-1]
    $serial = if ($instancePart -match '&') { $instancePart.Split('&')[0] } else { $instancePart }
    if ($serial.Length -gt 16) { $serial = $serial.Substring(0, 16) }

    # Get parent (USB device) - this has the port location
    $usbDevice = (Get-PnpDeviceProperty -InstanceId $drive.InstanceId -KeyName 'DEVPKEY_Device_Parent' -EA SilentlyContinue).Data

    # Get location from USB device (parent), not from drive
    $location = $null
    $hub = $null

    if ($usbDevice) {
        $location = (Get-PnpDeviceProperty -InstanceId $usbDevice -KeyName 'DEVPKEY_Device_LocationInfo' -EA SilentlyContinue).Data
        # Get hub (grandparent) - this identifies which hub chip
        $hub = (Get-PnpDeviceProperty -InstanceId $usbDevice -KeyName 'DEVPKEY_Device_Parent' -EA SilentlyContinue).Data
    }

    $results += [PSCustomObject]@{
        name = $drive.FriendlyName
        serial = $serial
        location = $location
        parent = $hub  # This is now the hub (grandparent), renamed for compatibility
    }
}

if ($results.Count -eq 0) {
    Write-Output "[]"
} else {
    $results | ConvertTo-Json -Compress
}
