import urllib.request
import urllib.error
import json
import os
import sys

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    env_vars = {}
    try:
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v
    except FileNotFoundError:
        print("ERROR: .env file not found.")
        sys.exit(1)
    return env_vars

def main():
    print("Initiating Supabase Handshake...")
    env_vars = load_env()
    url = env_vars.get("VITE_SUPABASE_URL")
    key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("ERROR: Missing URL or KEY in .env")
        sys.exit(1)
        
    req_url = f"{url}/rest/v1/"
    req = urllib.request.Request(req_url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}"
    })
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print("SUCCESS: Handshake successful! Supabase is responding correctly.")
            else:
                print(f"FAILED: Handshake failed with status: {response.status}")
    except urllib.error.URLError as e:
        if hasattr(e, 'code') and e.code == 404:
            print("SUCCESS: Handshake successful! Supabase API is reachable (404 empty schema is normal).")
        else:
            print(f"FAILED: Handshake connection error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
