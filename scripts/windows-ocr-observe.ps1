param(
  [string]$InputPath,
  [string]$InputListPath
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

Add-Type -AssemblyName System.Runtime.WindowsRuntime

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

function Await-WinRtResult {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Operation,
    [Parameter(Mandatory = $true)]
    [Type]$ResultType
  )

  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethodDefinition -and
      $_.GetGenericArguments().Count -eq 1 -and
      $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1
  if (-not $method) {
    throw 'Unable to locate the WinRT AsTask bridge.'
  }
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

$languages = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
$korean = $languages | Where-Object { $_.LanguageTag -eq 'ko' } | Select-Object -First 1
$engine = if ($korean) {
  [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($korean)
} else {
  [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if (-not $engine) {
  throw 'No Windows OCR engine is available.'
}

function Observe-Image {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  if (-not [System.IO.File]::Exists($resolvedPath)) {
    throw "Input image does not exist: $resolvedPath"
  }

  $file = Await-WinRtResult ([Windows.Storage.StorageFile]::GetFileFromPathAsync($resolvedPath)) ([Windows.Storage.StorageFile])
  $stream = Await-WinRtResult ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await-WinRtResult ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRtResult ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await-WinRtResult ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $width = [double]$bitmap.PixelWidth
  $height = [double]$bitmap.PixelHeight
  $lines = foreach ($line in $result.Lines) {
    $words = foreach ($word in $line.Words) {
      $rect = $word.BoundingRect
      [ordered]@{
        textUtf8Base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($word.Text))
        x = [double]$rect.X
        y = [double]$rect.Y
        width = [double]$rect.Width
        height = [double]$rect.Height
        normalized = [ordered]@{
          x = [double]$rect.X / $width
          y = [double]$rect.Y / $height
          width = [double]$rect.Width / $width
          height = [double]$rect.Height / $height
          unit = 'normalized'
        }
      }
    }
    [ordered]@{
      textUtf8Base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($line.Text))
      words = @($words)
    }
  }

  $observation = [ordered]@{
    schema = 'munjanggun.windowsOcrObservation.v1'
    version = '1.0'
    sourcePath = $resolvedPath
    language = if ($korean) { $korean.LanguageTag } else { 'user-profile-default' }
    width = [int]$width
    height = [int]$height
    textAngle = $result.TextAngle
    textUtf8Base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($result.Text))
    lines = @($lines)
  }

  $bitmap.Dispose()
  $stream.Dispose()
  return $observation
}

$paths = @()
if ($InputPath) {
  $paths += $InputPath
}
if ($InputListPath) {
  $resolvedList = [System.IO.Path]::GetFullPath($InputListPath)
  if (-not [System.IO.File]::Exists($resolvedList)) {
    throw "Input list does not exist: $resolvedList"
  }
  $paths += Get-Content -LiteralPath $resolvedList | Where-Object { $_.Trim() }
}
if ($paths.Count -eq 0) {
  throw 'Provide -InputPath or -InputListPath.'
}

foreach ($path in $paths) {
  Observe-Image -Path $path | ConvertTo-Json -Depth 12 -Compress
}
