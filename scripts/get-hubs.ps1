# Get VL822 USB hub instances
$hubs = Get-PnpDevice -Class USB -Status OK | Where-Object { $_.InstanceId -match 'VID_2109&(PID_0822|PID_2822)' }

$results = @()

foreach ($hub in $hubs) {
    $location = (Get-PnpDeviceProperty -InstanceId $hub.InstanceId -KeyName 'DEVPKEY_Device_LocationInfo' -EA SilentlyContinue).Data
    $parent = (Get-PnpDeviceProperty -InstanceId $hub.InstanceId -KeyName 'DEVPKEY_Device_Parent' -EA SilentlyContinue).Data

    $results += [PSCustomObject]@{
        name = $hub.FriendlyName
        instanceId = $hub.InstanceId
        location = $location
        parent = $parent
    }
}

if ($results.Count -eq 0) {
    Write-Output "[]"
} else {
    $results | ConvertTo-Json -Compress
}
