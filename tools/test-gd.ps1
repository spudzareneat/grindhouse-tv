$ErrorActionPreference = 'Stop'
$docid = '1BJ9Z3KwyZxyuK4g9tv4Un3wKMi0lQCs3'
$ua = 'Mozilla/5.0 (Linux; Android 14; onn. Streaming Device 4K pro Build/URO4.260304.011.B1;) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.217 Mobile Safari/537.36'
$info = "https://docs.google.com/get_video_info?authuser=&docid=$docid&sle=true&hl=en"

$hdr = "$env:TEMP\gdh.txt"; $bod = "$env:TEMP\gdb.txt"
curl.exe -s -A $ua -D $hdr -o $bod $info | Out-Null
$body = Get-Content $bod -Raw
$headers = Get-Content $hdr -Raw

$ds = ([regex]'(?i)set-cookie:\s*(DRIVE_STREAM=[^;]+)').Match($headers).Groups[1].Value
$map = @{}
foreach ($p in ($body -split '&')) {
    $kv = $p -split '=', 2
    if ($kv.Count -eq 2) { $map[[uri]::UnescapeDataString($kv[0])] = [uri]::UnescapeDataString($kv[1]) }
}
$fsm = $map['fmt_stream_map']
if (-not $fsm) { Write-Output "NO fmt_stream_map. status=$($map['status']) reason=$($map['reason'])"; exit }
$link = (($fsm -split ',')[0] -split '\|', 2)[1]
$bakedIp = ([regex]'[?&]ip=([^&]+)').Match($link).Groups[1].Value

Write-Output "status=$($map['status'])  bakedIp=$bakedIp  cookie=$ds"
$egress = curl.exe -s https://api.ipify.org
Write-Output "PowerShell egress IP: $egress"
Write-Output ""

$code1 = curl.exe -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-" $link
Write-Output "videoplayback, NO cookie       -> $code1"
$code2 = curl.exe -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-" -H "Cookie: $ds" $link
Write-Output "videoplayback, WITH DRIVE_STREAM -> $code2"
$code3 = curl.exe -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-1023" $link
Write-Output "videoplayback, closed range no cookie -> $code3"
$code4 = curl.exe -4 -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-" $link
Write-Output "videoplayback, force IPv4, no cookie  -> $code4"
