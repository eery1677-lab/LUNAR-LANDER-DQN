---
tags:
- reinforcement-learning
- deep-q-network
- dqn
- gymnasium
- lunar-lander
- pytorch
library_name: pytorch
pipeline_tag: reinforcement-learning
---

# 🚀 LunarLander-v3 Dueling DQN Agent

A trained **Dueling Double Deep Q-Network (DQN)** agent capable of smooth, stylish, and autonomous landing in the **Gymnasium LunarLander-v3** environment with an average reward score of **200+ PTS**.

---

## 🌟 Model Architecture & Hyperparameters

- **Algorithm**: Dueling Double DQN (Smooth L1 / Huber Loss)
- **Input State Space**: 8-dimensional continuous vector `[x, y, vx, vy, angle, angular_vel, left_leg_contact, right_leg_contact]`
- **Action Space**: Discrete(4) `[0: No-op, 1: Left RCS, 2: Main Thruster, 3: Right RCS]`
- **Network**:
  - Feature Extractor: Linear(8, 128) -> ReLU -> Linear(128, 128) -> ReLU
  - Value Stream $V(s)$: Linear(128, 64) -> ReLU -> Linear(64, 1)
  - Advantage Stream $A(s, a)$: Linear(128, 64) -> ReLU -> Linear(64, 4)
- **Hyperparameters**:
  - Learning Rate: `5e-4` (Adam)
  - Discount Factor $\gamma$: `0.99`
  - Soft Target Update $\tau$: `0.005`
  - Replay Buffer Size: `100,000`
  - Batch Size: `64`
  - Epsilon Schedule: Linear decay from `1.0` (100% exploration) to `0.05` (5% exploration)

---

## 🚀 How to Load and Run the Model

```python
import gymnasium as gym
import torch
from dqn_agent import DQNAgent

# 1. Initialize environment & agent
env = gym.make("LunarLander-v3", render_mode="human")
agent = DQNAgent(state_dim=8, action_dim=4)

# 2. Load weights
agent.load("dqn_lunar_lander_best.pt")

# 3. Test pilot landing (Epsilon = 0)
state, info = env.reset()
total_reward = 0.0
done = False

while not done:
    action, _ = agent.act(state, evaluate=True)
    state, reward, terminated, truncated, info = env.step(action)
    done = terminated or truncated
    total_reward += reward

print(f"Landing Finished! Total Score: {total_reward:.1f} PTS")
env.close()
```

---

## 🛰️ Interactive Cyber-Space Web Dashboard
This model was trained with the [LUNAR-LANDER-DQN](https://github.com/eery1677-lab/LUNAR-LANDER-DQN) 60FPS real-time web mission control platform.
