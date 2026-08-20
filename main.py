import os
import sys
import webbrowser
import uvicorn

if __name__ == "__main__":
    port = 8000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    print(f"================================================================")
    print(f"🚀 LunarLander-v3 DQN 간지나는 상륙 관제 센터를 시작합니다!")
    print(f"📡 대시보드 웹 주소: {url}")
    print(f"================================================================")
    
    # Auto-open browser after slight delay
    try:
        import threading
        import time
        def open_browser():
            time.sleep(1.5)
            webbrowser.open(url)
        threading.Thread(target=open_browser, daemon=True).start()
    except Exception:
        pass

    uvicorn.run("server:app", host=host, port=port, log_level="info")
