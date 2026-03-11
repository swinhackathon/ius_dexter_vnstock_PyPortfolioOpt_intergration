"""
Google AI Studio - Model checker & tester
Cách dùng:
  python check_google_models.py                    # Liệt kê model  
  python check_google_models.py gemini-2.0-flash   # Test 1 model cụ thể
"""

import sys
import json
import urllib.request
import urllib.error
import os

# Đọc API key từ .env hoặc nhập tay
def get_api_key():
    env_path = os.path.join(os.path.dirname(__file__), "dexter", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("GOOGLE_API_KEY="):
                    return line.strip().split("=", 1)[1]
    key = os.environ.get("GOOGLE_API_KEY")
    if key:
        return key
    return input("Nhập GOOGLE_API_KEY: ").strip()


def list_models(api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    print("📋 Đang lấy danh sách model từ Google...\n")
    
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())

    models = data.get("models", [])
    generate_models = [
        m for m in models
        if "generateContent" in m.get("supportedGenerationMethods", [])
    ]
    
    print(f"{'Model ID':<45} {'Display Name'}")
    print("-" * 75)
    for m in generate_models:
        model_id = m["name"].replace("models/", "")
        display  = m.get("displayName", "")
        print(f"  {model_id:<43} {display}")
    
    print(f"\n✅ Tổng: {len(generate_models)} model hỗ trợ generateContent")


def test_model(api_key, model_id):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": "Reply with just the word OK"}]}]
    }).encode()
    
    print(f"🧪 Testing model: {model_id} ...")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            print(f"✅ OK - Response: \"{text}\"")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        code = body.get("error", {}).get("code", e.code)
        msg  = body.get("error", {}).get("message", str(e))
        
        if code == 429:
            print(f"⚠️  QUOTA hết  [{code}] - {msg}")
        elif code == 404:
            print(f"❌ Model không tồn tại [{code}] - {msg}")
        elif code == 400:
            print(f"❌ Lỗi key/request [{code}] - {msg}")
        else:
            print(f"❌ Lỗi [{code}] - {msg}")


if __name__ == "__main__":
    api_key = get_api_key()
    
    if len(sys.argv) > 1:
        test_model(api_key, sys.argv[1])
    else:
        list_models(api_key)
