param(
  [string]$Source = "T:\OtherProjects\Lexicon\dictionary.txt",
  [string]$CandidateSource = "T:\OtherProjects\Lexicon\word-candidates-definition-and-frequency.jsonl",
  [double]$MinTargetZipf = 4.0,
  [string]$Output = (Join-Path $PSScriptRoot "..\assets\dictionary.json")
)

$sourcePath = [System.IO.Path]::GetFullPath($Source)
$candidatePath = [System.IO.Path]::GetFullPath($CandidateSource)
$outputPath = [System.IO.Path]::GetFullPath($Output)
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "Dictionary not found: $sourcePath"
}
if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
  throw "Frequency candidates not found: $candidatePath"
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

$dictionarySets = @{}
foreach ($length in 5..7) {
  $dictionarySets["$length"] = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  foreach ($word in $byLength["$length"]) { [void]$dictionarySets["$length"].Add($word) }
}

# Puzzle targets come from the curated Wiktextract/wordfreq candidate file. The full
# Scrabble-style dictionary above is still retained for accepting alternate guesses.
$targets = [ordered]@{}
foreach ($length in 5..7) { $targets["$length"] = [System.Collections.Generic.List[string]]::new() }
Get-Content -LiteralPath $candidatePath | ForEach-Object {
  try { $entry = $_ | ConvertFrom-Json -ErrorAction Stop } catch { return }
  $word = "$($entry.word)".Trim().ToUpperInvariant()
  if ($word -notmatch '^[A-Z]{5,7}$' -or [double]$entry.zipf -lt $MinTargetZipf) { return }
  $length = "$($word.Length)"
  if ($dictionarySets[$length].Contains($word)) { $targets[$length].Add($word) }
}
foreach ($length in 5..7) {
  $targets["$length"] = @($targets["$length"] | Sort-Object -Unique)
  if ($targets["$length"].Count -eq 0) { throw "No $length-letter targets met Zipf >= $MinTargetZipf" }
}

$directory = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$payload = [ordered]@{ words = $byLength; targets = $targets; targetMinZipf = $MinTargetZipf }
$json = $payload | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $outputPath"
foreach ($length in 5..7) {
  Write-Host "$length letters: $($byLength["$length"].Count) valid guesses; $($targets["$length"].Count) common targets"
}
