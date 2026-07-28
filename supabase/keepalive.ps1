# DINX APP - Keep-Alive Supabase
# Ping diario ao Supabase para evitar pausa no plano gratuito.

$SUPABASE_URL = "https://sxhhnptncflpueeksdbd.supabase.co"
$SUPABASE_KEY = "sb_publishable_xx5jKKPAuijiRwjwnN0roQ_jVPXihfi"
$LOG_FILE = "$PSScriptRoot\keepalive.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

$uri = "$SUPABASE_URL/rest/v1/configuracoes?select=limite_mensal_parcelas&limit=1"

$success = $false
$errorMsg = ""

try {
    $null = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET -TimeoutSec 15
    $success = $true
} catch {
    $errorMsg = $_.Exception.Message
}

if ($success) {
    Add-Content -Path $LOG_FILE -Value "[$timestamp] OK - ping respondido com sucesso."
} else {
    Add-Content -Path $LOG_FILE -Value "[$timestamp] ERRO - $errorMsg"
}
