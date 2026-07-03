$ErrorActionPreference = 'Stop'
$docid = '1BJ9Z3KwyZxyuK4g9tv4Un3wKMi0lQCs3'
$ua = 'Mozilla/5.0 (Linux; Android 14; onn. Streaming Device 4K pro Build/URO4.260304.011.B1;) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.217 Mobile Safari/537.36'
$info = "https://docs.google.com/get_video_info?authuser=&docid=$docid&sle=true&hl=en"
$bod = "$env:TEMP\gdb.txt"
curl.exe -s -A $ua -o $bod $info | Out-Null
$map = @{}
foreach ($p in ((Get-Content $bod -Raw) -split '&')) {
    $kv = $p -split '=', 2
    if ($kv.Count -eq 2) { $map[[uri]::UnescapeDataString($kv[0])] = [uri]::UnescapeDataString($kv[1]) }
}
$link = (($map['fmt_stream_map'] -split ',')[0] -split '\|', 2)[1]
Write-Output "baked ip: $(([regex]'[?&]ip=([^&]+)').Match($link).Groups[1].Value)"

function Hit($label, [string[]]$h) {
    $args = @('-s','-o','NUL','-w','%{http_code}','-A',$ua,'-H','Range: bytes=0-')
    foreach ($x in $h) { $args += @('-H', $x) }
    $args += $link
    $code = & curl.exe @args
    Write-Output ("{0,-42} -> {1}" -f $label, $code)
}
Hit "baseline (Range 0-)" @()
Hit "+ Accept-Encoding: gzip" @('Accept-Encoding: gzip')
Hit "+ Accept-Encoding: gzip, deflate, br" @('Accept-Encoding: gzip, deflate, br')
Hit "+ Connection: keep-alive" @('Connection: keep-alive')
Hit "+ Accept-Encoding gzip + keep-alive" @('Accept-Encoding: gzip','Connection: keep-alive')
Hit "+ Accept-Charset (old HUC)" @('Accept-Charset: UTF-8')
