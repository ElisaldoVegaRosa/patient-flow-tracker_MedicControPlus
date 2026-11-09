param(
    [Parameter(Mandatory = $true)][string] $Address,
    [Parameter(Mandatory = $true)][string] $OutputDirectory
)

$ErrorActionPreference = "Stop"
$ip = [System.Net.IPAddress]::Parse($Address)
if ($ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "Se requiere una direccion IPv4 privada."
}
$bytes = $ip.GetAddressBytes()
if (-not ($bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168))) {
    throw "Se requiere una direccion IPv4 privada."
}
$repoPath = [System.IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$allowedPath = Join-Path $repoPath ".tmp"
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
if (-not $outputPath.StartsWith($allowedPath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "El destino debe estar dentro de .tmp del proyecto."
}
if (Test-Path -LiteralPath $outputPath) { throw "El destino de certificados ya existe. Elige otro destino. Habra que instalar la nueva CA en el movil." }

$rootKey = [System.Security.Cryptography.RSACng]::new(2048)
$serverKey = [System.Security.Cryptography.RSACng]::new(2048)
$rootCertificate = $null
$serverCertificate = $null
$signedCertificate = $null
try {
    $hash = [System.Security.Cryptography.HashAlgorithmName]::SHA256
    $padding = [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    $rootRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=MedicControl Demo LAN CA", $rootKey, $hash, $padding)
    $rootRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $true, 0, $true))
    $rootUsage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign
    $rootRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($rootUsage, $true))
    $rootRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($rootRequest.PublicKey, $false))
    $starts = [DateTimeOffset]::UtcNow.AddMinutes(-5)
    $ends = [DateTimeOffset]::UtcNow.AddDays(30)
    $rootCertificate = $rootRequest.CreateSelfSigned($starts, $ends)

    $serverRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=MedicControl Demo LAN", $serverKey, $hash, $padding)
    $serverRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true))
    $usage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment
    $serverRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($usage, $true))
    $oids = [System.Security.Cryptography.OidCollection]::new()
    [void]$oids.Add([System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1"))
    $serverRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids, $true))
    $san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $san.AddIpAddress($ip)
    $serverRequest.CertificateExtensions.Add($san.Build())
    $serial = [byte[]]::new(16)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($serial) } finally { $random.Dispose() }
    $serial[0] = $serial[0] -band 0x7f
    $serial[15] = $serial[15] -bor 1
    $signedCertificate = $serverRequest.Create($rootCertificate, $starts, $ends, $serial)
    $serverCertificate = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($signedCertificate, $serverKey)

    [void][System.IO.Directory]::CreateDirectory($outputPath)
    $security = [System.Security.AccessControl.DirectorySecurity]::new()
    $security.SetAccessRuleProtection($true, $false)
    $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    foreach ($sid in @([System.Security.Principal.WindowsIdentity]::GetCurrent().User, [System.Security.Principal.SecurityIdentifier]::new("S-1-5-18"))) {
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($sid, "FullControl", $inheritance, "None", "Allow")
        $security.AddAccessRule($rule)
    }
    [System.IO.Directory]::SetAccessControl($outputPath, $security)
    $publicRoot = $rootCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    [System.IO.File]::WriteAllBytes((Join-Path $outputPath "mediccontrol-demo-ca.cer"), $publicRoot)
    $rootPem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($publicRoot, [Base64FormattingOptions]::InsertLineBreaks) + "`n-----END CERTIFICATE-----`n"
    [System.IO.File]::WriteAllText((Join-Path $outputPath "ca.pem"), $rootPem, [System.Text.Encoding]::ASCII)
    [System.IO.File]::WriteAllBytes((Join-Path $outputPath "server.cer"), $serverCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
    [System.IO.File]::WriteAllBytes((Join-Path $outputPath "server.pfx"), $serverCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, ""))
    Write-Output "Certificados de ensayo generados en archivos locales. Vigencia 30 dias."
} finally {
    if ($serverCertificate) { $serverCertificate.Dispose() }
    if ($signedCertificate) { $signedCertificate.Dispose() }
    if ($rootCertificate) { $rootCertificate.Dispose() }
    $serverKey.Dispose()
    $rootKey.Dispose()
}
