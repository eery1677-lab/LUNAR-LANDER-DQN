import asyncio
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from lunar_engine import LunarEngine

app = FastAPI(title="LunarLander DQN Cyber-Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = LunarEngine(max_episodes=1000)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def get_index():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "LunarLander DQN Mission Control running. Please build static/index.html"}

@app.get("/api/status")
async def get_status():
    return engine.get_status()

@app.post("/api/train/start")
async def start_training():
    return engine.start_training()

@app.post("/api/train/pause")
async def pause_training():
    return engine.pause_training()

@app.post("/api/train/resume")
async def resume_training():
    return engine.resume_training()

@app.post("/api/train/stop")
async def stop_training():
    return engine.stop_training()

class SpeedRequest(BaseModel):
    speed: str # "1x", "2x", "5x", "turbo"

@app.post("/api/train/speed")
async def set_speed(req: SpeedRequest):
    return engine.set_speed(req.speed)

@app.post("/api/pilot/test")
async def start_evaluation():
    return engine.start_evaluation()

@app.post("/api/human/start")
async def start_human():
    return engine.start_human_mode()

class HumanActionRequest(BaseModel):
    action: int # 0, 1, 2, 3

@app.post("/api/human/action")
async def set_human_action(req: HumanActionRequest):
    engine.set_human_action(req.action)
    return {"status": "ok", "action": req.action}

@app.post("/api/model/save")
async def save_model():
    return engine.save_model("dqn_lunar_lander.pt")

@app.post("/api/model/load")
async def load_model():
    return engine.load_model("dqn_lunar_lander.pt")

@app.post("/api/model/reset")
async def reset_model():
    return engine.reset_model()

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    q = asyncio.Queue(maxsize=100)
    engine.subscribe(q)

    # Send initial status
    try:
        await websocket.send_json({
            "type": "init",
            "status": engine.get_status()
        })
    except Exception:
        pass

    async def sender():
        try:
            while True:
                msg = await q.get()
                await websocket.send_json(msg)
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception:
            pass

    async def receiver():
        try:
            while True:
                data = await websocket.receive_text()
                parsed = json.loads(data)
                if parsed.get("type") == "human_action":
                    engine.set_human_action(int(parsed.get("action", 0)))
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception:
            pass

    sender_task = asyncio.create_task(sender())
    receiver_task = asyncio.create_task(receiver())

    try:
        done, pending = await asyncio.wait(
            [sender_task, receiver_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    finally:
        engine.unsubscribe(q)
        try:
            await websocket.close()
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
