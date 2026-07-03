$ErrorActionPreference = 'Stop'
$docid = '1BJ9Z3KwyZxyuK4g9tv4Un3wKMi0lQCs3'
$ua = 'Mozilla/5.0 (Linux; Android 14; onn. Streaming Device 4K pro Build/URO4.260304.011.B1;) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.217 Mobile Safari/537.36'
$info = "https://docs.google.com/get_video_info?authuser=&docid=$docid&sle=true&hl=en"
$hdr = "$env:TEMP\gdh.txt"; $bod = "$env:TEMP\gdb.txt"
curl.exe -s -A $ua -D $hdr -o $bod $info | Out-Null
$headers = Get-Content $hdr -Raw
# collect ALL Set-Cookie name=value pairs (DRIVE_STREAM, NID, etc.)
$cookies = @()
foreach ($m in ([regex]'(?im)^set-cookie:\s*([^=]+=[^;]+)').Matches($headers)) { $cookies += $m.Groups[1].Value.Trim() }
$cookieHeader = ($cookies -join '; ')
$map = @{}
foreach ($p in ((Get-Content $bod -Raw) -split '&')) { $kv = $p -split '=', 2; if ($kv.Count -eq 2) { $map[[uri]::UnescapeDataString($kv[0])] = [uri]::UnescapeDataString($kv[1]) } }
$link = (($map['fmt_stream_map'] -split ',')[0] -split '\|', 2)[1]
Write-Output "cookies captured: $cookieHeader"
Write-Output ""
$c0 = curl.exe -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-" $link
Write-Output "no cookie                 -> $c0"
$c1 = curl.exe -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-" -H "Cookie: $cookieHeader" $link
Write-Output "ALL get_video_info cookies-> $c1"
$nid = ($cookies | Where-Object { $_ -like 'NID=*' } | Select-Object -First 1)
if ($nid) { $c2 = curl.exe -s -o NUL -w "%{http_code}" -A $ua -H "Range: bytes=0-" -H "Cookie: $nid" $link; Write-Output "NID only                  -> $c2" }
