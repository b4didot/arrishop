param([switch]$EnableConfirmation)

$ErrorActionPreference = 'Stop'
$shopProjectRef = 'spcuuigipezraflkmsaj'
$shopLinkFile = Join-Path $PSScriptRoot '../supabase/.temp/project-ref'
if (!(Test-Path -LiteralPath $shopLinkFile) -or (Get-Content -LiteralPath $shopLinkFile -Raw).Trim() -ne $shopProjectRef) {
  throw 'Link this checkout to the arrishop Supabase project before changing authentication settings.'
}

# Read only the credential used by the signed-in Supabase CLI. Never print or persist the token.
if (-not ('ShopSupabaseCredential' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ShopSupabaseCredential {
  [StructLayout(LayoutKind.Sequential)] private struct Credential {
    public uint Flags, Type;
    public IntPtr TargetName, Comment;
    public long LastWritten;
    public uint BlobSize;
    public IntPtr Blob;
    public uint Persist, AttributeCount;
    public IntPtr Attributes, TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")] private static extern void CredFree(IntPtr credential);
  public static string Get(string target) {
    IntPtr pointer;
    if (!Read(target, 1, 0, out pointer)) return null;
    try {
      var credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
      var bytes = new byte[credential.BlobSize];
      Marshal.Copy(credential.Blob, bytes, 0, bytes.Length);
      var token = Encoding.UTF8.GetString(bytes);
      Array.Clear(bytes, 0, bytes.Length);
      return token;
    } finally { CredFree(pointer); }
  }
}
'@
}
$shopToken = $env:SUPABASE_ACCESS_TOKEN
if (!$shopToken) { $shopToken = [ShopSupabaseCredential]::Get('Supabase CLI:supabase') }
if (!$shopToken) { $shopToken = [ShopSupabaseCredential]::Get('Supabase CLI:access-token') }
if (!$shopToken) {
  $shopTokenFile = Join-Path $env:USERPROFILE '.supabase/access-token'
  if (Test-Path -LiteralPath $shopTokenFile) { $shopToken = (Get-Content -LiteralPath $shopTokenFile -Raw).Trim() }
}
if (!$shopToken) { throw 'No Supabase CLI credential is available. Run supabase login locally first.' }

$shopHeaders = @{ Authorization = 'Bearer ' + $shopToken }
$shopEndpoint = 'https://api.supabase.com/v1/projects/' + $shopProjectRef + '/config/auth'
try {
  $shopBefore = Invoke-RestMethod -Uri $shopEndpoint -Headers $shopHeaders -Method Get
  $shopAutoConfirm = !$EnableConfirmation.IsPresent
  $shopBody = @{ mailer_autoconfirm = $shopAutoConfirm } | ConvertTo-Json -Compress
  Invoke-RestMethod -Uri $shopEndpoint -Headers $shopHeaders -Method Patch -ContentType 'application/json' -Body $shopBody | Out-Null
  $shopAfter = Invoke-RestMethod -Uri $shopEndpoint -Headers $shopHeaders -Method Get
  if ($shopAfter.mailer_autoconfirm -ne $shopAutoConfirm) { throw 'Authentication setting did not match the requested value.' }
  $shopChangedFields = @($shopBefore.PSObject.Properties | Where-Object {
    ($_.Value | ConvertTo-Json -Depth 20 -Compress) -cne ($shopAfter.($_.Name) | ConvertTo-Json -Depth 20 -Compress)
  } | Select-Object -ExpandProperty Name)
  [PSCustomObject]@{ Project = $shopProjectRef; EmailConfirmationRequired = !$shopAfter.mailer_autoconfirm; ChangedSettings = $shopChangedFields } | ConvertTo-Json -Compress
} catch {
  throw 'Could not update or verify Supabase email confirmation. Check the CLI account permissions and project connection.'
} finally { $shopToken = $null; $shopHeaders = $null; $shopBefore = $null; $shopAfter = $null }
