param(
  [string]$Source = "T:\OtherProjects\Lexicon\dictionary.txt",
  [string]$Output = (Join-Path $PSScriptRoot "..\assets\dictionary.json")
)

$sourcePath = [System.IO.Path]::GetFullPath($Source)
$outputPath = [System.IO.Path]::GetFullPath($Output)
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "Dictionary not found: $sourcePath"
}

$byLength = [ordered]@{}
foreach ($length in 5..7) { $byLength["$length"] = [System.Collections.Generic.List[string]]::new() }

Get-Content -LiteralPath $sourcePath | ForEach-Object {
  $word = $_.Trim().ToUpperInvariant()
  if ($word -match '^[A-Z]{5,7}$') { $byLength["$($word.Length)"].Add($word) }
}

foreach ($length in 5..7) {
  $byLength["$length"] = @($byLength["$length"] | Sort-Object -Unique)
}

$directory = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$json = $byLength | ConvertTo-Json -Depth 3 -Compress
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $outputPath"
foreach ($length in 5..7) { Write-Host "$length letters: $($byLength["$length"].Count)" }
