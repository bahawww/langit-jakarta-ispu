# Generate Dashboard_ISPU_DKI_Jakarta.html dari CSV di folder yang sama.
# Jalankan ulang dari PowerShell setelah CSV diperbarui:  .\build_dashboard.ps1
param(
  [string]$Root = $PSScriptRoot,
  [string]$Template = "$PSScriptRoot\template.html",
  [string]$Out = "$PSScriptRoot\Dashboard_ISPU_DKI_Jakarta.html"
)
$ErrorActionPreference = 'Stop'

$clean = Import-Csv (Join-Path $Root 'Dataset_ISPU_DKI_Jakarta_2024_2025_Clean.csv')
$test  = Import-Csv (Join-Path $Root 'Hasil_Testing_80_20_ISPU_DKI_Jakarta.csv')
$raw   = Import-Csv (Join-Path $Root 'Filedata Data Indeks Standar Pencemar Udara ISPU di Provinsi DKI Jakarta.csv')

$KAT = @('BAIK', 'SEDANG', 'TIDAK SEHAT')
$ST  = @($clean | ForEach-Object stasiun | Sort-Object -Unique)

function Q([string]$s) { '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"' }
function Idx($arr, [string]$v, [string]$what) {
  $i = [array]::IndexOf($arr, $v)
  if ($i -lt 0) { throw "Nilai $what tidak dikenal: '$v'" }
  $i
}
function Row($r, [bool]$withPred) {
  if ($r.tanggal_lengkap -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "Tanggal tidak valid: $($r.tanggal_lengkap)" }
  $parts = @(
    (Q $r.tanggal_lengkap),
    (Idx $ST $r.stasiun 'stasiun'),
    [int]$r.pm_sepuluh, [int]$r.pm_duakomalima, [int]$r.sulfur_dioksida,
    [int]$r.karbon_monoksida, [int]$r.ozon, [int]$r.nitrogen_dioksida, [int]$r.max,
    (Q $r.parameter_pencemar_kritis),
    (Idx $KAT $r.kategori 'kategori')
  )
  if ($withPred) {
    $parts += (Idx $KAT $r.Prediksi_Random_Forest 'prediksi RF')
    $parts += (Idx $KAT $r.Prediksi_Decision_Tree 'prediksi DT')
    $parts += (Idx $KAT $r.Prediksi_kNN 'prediksi kNN')
  }
  '[' + ($parts -join ',') + ']'
}

$cleanJson = ($clean | ForEach-Object { Row $_ $false }) -join ','
$testJson  = ($test  | ForEach-Object { Row $_ $true })  -join ','
$json = '{"rawCount":' + $raw.Count +
  ',"kat":[' + (($KAT | ForEach-Object { Q $_ }) -join ',') + ']' +
  ',"stations":[' + (($ST | ForEach-Object { Q $_ }) -join ',') + ']' +
  ',"clean":[' + $cleanJson + '],"test":[' + $testJson + ']}'

$tpl = [IO.File]::ReadAllText($Template, [Text.Encoding]::UTF8)
if (-not $tpl.Contains('/*__DATA__*/null')) { throw 'Placeholder data tidak ditemukan di template' }
$html = $tpl.Replace('/*__DATA__*/null', $json)
[IO.File]::WriteAllText($Out, $html, (New-Object Text.UTF8Encoding $false))
"OK: raw=$($raw.Count) clean=$($clean.Count) test=$($test.Count) stations=$($ST.Count) size=$([math]::Round((Get-Item $Out).Length/1KB)) KB"
