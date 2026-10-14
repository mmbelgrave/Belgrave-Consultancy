# Renders the first pages of the guide PDF (cover up to and including the contents) as images
# for the "Read the first pages" sample. Uses the PDF renderer built into Windows 10/11.
#
# Usage (PowerShell, from the site folder):
#   powershell -ExecutionPolicy Bypass -File tools\make-guide-sample.ps1 -Pdf "C:\path\to\guide.pdf" -LastPage 10
# Then run: node build.mjs   (the sample page lists whatever page-NN.jpg files exist)

param(
  [Parameter(Mandatory = $true)][string]$Pdf,
  [int]$LastPage = 10,
  [int]$Width = 1100,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$out = if ($OutDir) { $OutDir } else { Join-Path (Split-Path $PSScriptRoot -Parent) "assets\img\sample" }
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter "page-*.jpg" -ErrorAction SilentlyContinue | Remove-Item -Force

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTaskOp = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncAction" })[0]

function Await($op, $type) {
  $t = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result
}
function AwaitAction($op) { $t = $asTaskAction.Invoke($null, @($op)); $t.Wait(-1) | Out-Null }

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc  = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$last = [Math]::Min($LastPage, $doc.PageCount)

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 84L

for ($i = 0; $i -lt $last; $i++) {
  $page = $doc.GetPage($i)
  $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opts.DestinationWidth = $Width
  $opts.BackgroundColor = [Windows.UI.Color]::FromArgb(255, 255, 255, 255)
  AwaitAction ($page.RenderToStreamAsync($stream, $opts))
  $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
  $raw = [System.Drawing.Bitmap]::new($net)
  $h = [int]($raw.Height * $Width / $raw.Width)
  $bmp = New-Object System.Drawing.Bitmap $Width, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($raw, 0, 0, $Width, $h); $g.Dispose(); $raw.Dispose()
  $name = "page-{0:D2}.jpg" -f ($i + 1)
  $bmp.Save((Join-Path $out $name), $jpeg, $ep)
  $bmp.Dispose(); $net.Dispose(); $stream.Dispose(); $page.Dispose()
  Write-Host "rendered $name"
}
Write-Host "Done: $last pages in $out"
