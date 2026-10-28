# Pi Kampus: sunucudaki sifreli gece yedeklerini bu bilgisayara ceker (Gorev Zamanlayici her gun ve oturum acilinca calistirir).
# Son 30 yedek tutulur. Basarili cekimden sonra sunucuya isaret birakilir; 3 gun cekim olmazsa bekci uyarir.
$ErrorActionPreference = "Stop"
$Server = "root@194.62.52.232"
$Remote = "/home/vipozelders/yedek/disari"
$Root = Join-Path $env:USERPROFILE "PiKampusYedek"
$Local = Join-Path $Root "yedekler"
$Log = Join-Path $Root "yedek-cek.log"
$ssh = Join-Path $env:SystemRoot "System32\OpenSSH\ssh.exe"
$scp = Join-Path $env:SystemRoot "System32\OpenSSH\scp.exe"
New-Item -ItemType Directory -Force $Local | Out-Null

try {
  $files = @(& $ssh -o BatchMode=yes -o ConnectTimeout=20 $Server "ls $Remote" | Where-Object { $_ -like "pikampus-*.tar.enc" })
  if ($LASTEXITCODE -ne 0) { throw "sunucuya baglanilamadi" }
  $new = 0
  foreach ($f in $files) {
    $dest = Join-Path $Local $f
    if (Test-Path $dest) { continue }
    & $scp -o BatchMode=yes -q "${Server}:$Remote/$f" "$dest.part"
    if ($LASTEXITCODE -ne 0) { throw "indirilemedi: $f" }
    Move-Item "$dest.part" $dest -Force
    $new++
  }
  Get-ChildItem $Local -Filter "pikampus-*.tar.enc" | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force
  & $ssh -o BatchMode=yes $Server "touch /var/lib/pikampus-bekci/pc-son-cekim"
  Add-Content $Log "$(Get-Date -Format s) tamam: $new yeni yedek"
} catch {
  Add-Content $Log "$(Get-Date -Format s) HATA: $_"
  exit 1
}
