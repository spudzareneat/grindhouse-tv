$ErrorActionPreference = 'Stop'
$docid = '1BJ9Z3KwyZxyuK4g9tv4Un3wKMi0lQCs3'
$browser = 'Mozilla/5.0 (Linux; Android 14; onn. Streaming Device 4K pro Build/URO4.260304.011.B1;) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.217 Mobile Safari/537.36'
$dalvik  = 'Dalvik/2.1.0 (Linux; U; Android 14; onn. Streaming Device 4K pro Build/URO4.260304.011.B1)'
$info = "https://docs.google.com/get_video_info?authuser=&docid=$docid&sle=true&hl=en"

function MintLink($ua) {
    $bod = "$env:TEMP\gdb_$($ua.Length).txt"
    curl.exe -s -A $ua -o $bod $info | Out-Null
    $map = @{}
    foreach ($p in ((Get-Content $bod -Raw) -split '&')) { $kv = $p -split '=', 2; if ($kv.Count -eq 2) { $map[[uri]::UnescapeDataString($kv[0])] = [uri]::UnescapeDataString($kv[1]) } }
    if (-not $map['fmt_stream_map']) { return $null }
    return (($map['fmt_stream_map'] -split ',')[0] -split '\|', 2)[1]
}

Write-Output "== get_video_info requested with BROWSER UA =="
$lb = MintLink $browser
"  play w/ browser UA -> $(curl.exe -s -o NUL -w '%{http_code}' -A $browser -H 'Range: bytes=0-' $lb)"

Write-Output "== get_video_info requested with DALVIK UA =="
$ld = MintLink $dalvik
"  play w/ browser UA -> $(curl.exe -s -o NUL -w '%{http_code}' -A $browser -H 'Range: bytes=0-' $ld)"
"  play w/ dalvik  UA -> $(curl.exe -s -o NUL -w '%{http_code}' -A $dalvik  -H 'Range: bytes=0-' $ld)"
