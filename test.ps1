$uri = "http://localhost:3000/ask"
$headers = @{ "Content-Type" = "application/json; charset=utf-8" }

$question = @"
Cập nhật thị trường chứng khoán Việt Nam ngày hôm nay
"@

$body = @{
    question = $question
    modelProvider = "bedrock"
    model = "bedrock:us.anthropic.claude-sonnet-4-20250514-v1:0"
} | ConvertTo-Json

Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body | Select-Object -ExpandProperty answer | Out-File -FilePath "report.md" -Encoding utf8
Write-Host "Xong! Kiem tra file report.md" -ForegroundColor Green
