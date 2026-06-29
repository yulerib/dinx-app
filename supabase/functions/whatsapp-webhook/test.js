// Fetch nativo do Node

async function test() {
  const payload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "123",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15556336800",
                "phone_number_id": "1132767353252080"
              },
              "messages": [
                {
                  "from": "5511999999999",
                  "id": "wamid.123",
                  "timestamp": "1603059201",
                  "type": "text",
                  "text": {
                    "body": "Oi, teste local"
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  console.log("Enviando webhook...");
  const res = await fetch("https://rntgupnmzkbkqmbebiqo.supabase.co/functions/v1/whatsapp-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Resposta:", text);
}

test();
