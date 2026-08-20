import asyncio
import threading
import time
from collections import deque
import gymnasium as gym
import numpy as np
from dqn_agent import DQNAgent

class LunarEngine:
    def __init__(self, max_episodes=1000):
        self.max_episodes = max_episodes
        self.agent = DQNAgent(
            state_dim=8,
            action_dim=4,
            lr=5e-4,
            gamma=0.99,
            tau=0.005,
            buffer_size=100000,
            batch_size=64,
            eps_start=1.0,
            eps_end=0.05,
            eps_decay_episodes=800
        )
        
        self.env = None
        self.is_running = False
        self.is_paused = False
        self.mode = "idle"  # "training", "evaluating", "human", "idle"
        self.speed = 1.0     # 1.0, 2.0, 5.0, "turbo"
        self.speed_mode = "realtime" # "realtime", "2x", "5x", "turbo"

        # Stats & Metrics
        self.current_episode = 0
        self.episode_rewards = []
        self.moving_avg_rewards = []
        self.losses = []
        self.best_reward = -float("inf")
        self.successful_landings = 0
        self.total_finished_episodes = 0

        # Real-time state
        self.current_step_data = None
        self.subscribers = set() # Asyncio queues for WebSocket clients
        self.human_action = 0

        # Threading
        self.worker_thread = None
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()
        self.pause_event.set() # Unpaused by default

        self.lock = threading.Lock()

    def get_terrain_coords(self, env):
        """Extract terrain polygon coordinates from Gymnasium LunarLander"""
        try:
            unwrapped = env.unwrapped
            if hasattr(unwrapped, 'helipad_x1') and hasattr(unwrapped, 'moon'):
                # Extract ground polygon points if available
                helipad_x1 = getattr(unwrapped, 'helipad_x1', 0.4)
                helipad_x2 = getattr(unwrapped, 'helipad_x2', 0.6)
                helipad_y = getattr(unwrapped, 'helipad_y', 0.2)
                return {
                    'helipad_x1': float(helipad_x1),
                    'helipad_x2': float(helipad_x2),
                    'helipad_y': float(helipad_y)
                }
        except Exception:
            pass
        return {'helipad_x1': 0.4, 'helipad_x2': 0.6, 'helipad_y': 0.2}

    def subscribe(self, queue: asyncio.Queue):
        with self.lock:
            self.subscribers.add(queue)

    def unsubscribe(self, queue: asyncio.Queue):
        with self.lock:
            self.subscribers.discard(queue)

    def broadcast(self, message: dict):
        """Send message to all connected WebSocket subscriber queues"""
        with self.lock:
            for q in list(self.subscribers):
                try:
                    q.put_nowait(message)
                except Exception:
                    pass

    def start_training(self):
        if self.is_running and self.mode == "training":
            return {"status": "already_running"}
        
        self.stop_current_worker()
        self.is_running = True
        self.is_paused = False
        self.mode = "training"
        self.pause_event.set()
        self.stop_event.clear()

        self.worker_thread = threading.Thread(target=self._train_loop, daemon=True)
        self.worker_thread.start()
        return {"status": "training_started"}

    def pause_training(self):
        if self.is_running:
            self.is_paused = True
            self.pause_event.clear()
            return {"status": "paused"}
        return {"status": "not_running"}

    def resume_training(self):
        if self.is_running and self.is_paused:
            self.is_paused = False
            self.pause_event.set()
            return {"status": "resumed"}
        return {"status": "not_paused"}

    def stop_training(self):
        self.stop_current_worker()
        self.mode = "idle"
        self.is_running = False
        self.is_paused = False
        return {"status": "stopped"}

    def set_speed(self, mode: str):
        self.speed_mode = mode
        if mode == "1x" or mode == "realtime":
            self.speed = 1.0
        elif mode == "2x":
            self.speed = 2.0
        elif mode == "5x":
            self.speed = 5.0
        elif mode == "turbo":
            self.speed = "turbo"
        return {"status": "speed_set", "speed": self.speed_mode}

    def start_evaluation(self):
        """Run a single test episode with epsilon=0 to watch the best landing"""
        self.stop_current_worker()
        self.is_running = True
        self.mode = "evaluating"
        self.pause_event.set()
        self.stop_event.clear()

        self.worker_thread = threading.Thread(target=self._eval_loop, daemon=True)
        self.worker_thread.start()
        return {"status": "evaluation_started"}

    def start_human_mode(self):
        """Run an episode where the user controls the lander with arrow keys"""
        self.stop_current_worker()
        self.is_running = True
        self.mode = "human"
        self.pause_event.set()
        self.stop_event.clear()

        self.worker_thread = threading.Thread(target=self._human_loop, daemon=True)
        self.worker_thread.start()
        return {"status": "human_mode_started"}

    def set_human_action(self, action: int):
        self.human_action = int(action)

    def stop_current_worker(self):
        self.stop_event.set()
        self.pause_event.set() # Unblock if paused
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=1.0)
        self.is_running = False

    def _get_step_delay(self):
        if self.speed_mode == "turbo":
            return 0.0
        elif self.speed_mode == "5x":
            return 0.004
        elif self.speed_mode == "2x":
            return 0.01
        else: # 1x / realtime
            return 0.02

    def _train_loop(self):
        env = gym.make("LunarLander-v3")
        recent_100_rewards = deque(maxlen=100)

        while not self.stop_event.is_set() and self.current_episode < self.max_episodes:
            self.pause_event.wait()
            if self.stop_event.is_set():
                break

            self.current_episode += 1
            epsilon = self.agent.update_epsilon(self.current_episode)
            state, info = env.reset()
            episode_reward = 0.0
            step_count = 0
            ep_losses = []
            done = False

            terrain_info = self.get_terrain_coords(env)

            while not done and not self.stop_event.is_set():
                self.pause_event.wait()
                if self.stop_event.is_set():
                    break

                step_count += 1
                action, q_values = self.agent.act(state, evaluate=False)
                next_state, reward, terminated, truncated, info = env.step(action)
                done = terminated or truncated

                # Bonus reward shaping for ganji smooth landing:
                # Extra stability reward if horizontal velocity and angle are near zero near ground
                shaping_reward = reward
                loss = self.agent.step(state, action, shaping_reward, next_state, done)
                if loss is not None:
                    ep_losses.append(loss)

                state = next_state
                episode_reward += reward

                # Landing status determination
                status = "flying"
                if done:
                    if reward >= 100 or episode_reward >= 200:
                        status = "landed_safely"
                        self.successful_landings += 1
                    elif terminated:
                        status = "crashed"
                    else:
                        status = "timeout"

                # Step telemetry payload
                telemetry = {
                    "type": "telemetry",
                    "mode": "training",
                    "episode": self.current_episode,
                    "max_episodes": self.max_episodes,
                    "step": step_count,
                    "state": {
                        "x": float(state[0]),
                        "y": float(state[1]),
                        "vx": float(state[2]),
                        "vy": float(state[3]),
                        "angle": float(state[4]),
                        "angular_vel": float(state[5]),
                        "left_leg": int(state[6]),
                        "right_leg": int(state[7])
                    },
                    "action": action,
                    "q_values": q_values,
                    "step_reward": float(reward),
                    "episode_reward": float(episode_reward),
                    "epsilon": float(epsilon),
                    "loss": float(ep_losses[-1]) if ep_losses else 0.0,
                    "status": status,
                    "terrain": terrain_info
                }

                # In turbo mode, broadcast step only every 10 steps to save network/render bandwidth
                if self.speed_mode != "turbo" or step_count % 10 == 0 or done:
                    self.broadcast(telemetry)

                delay = self._get_step_delay()
                if delay > 0:
                    time.sleep(delay)

            # Episode summary
            self.total_finished_episodes += 1
            self.episode_rewards.append(episode_reward)
            recent_100_rewards.append(episode_reward)
            avg_100 = float(np.mean(recent_100_rewards))
            self.moving_avg_rewards.append(avg_100)

            if episode_reward > self.best_reward:
                self.best_reward = episode_reward
                # Auto-save best model
                try:
                    self.agent.save("dqn_lunar_lander_best.pt")
                except Exception:
                    pass

            avg_loss = float(np.mean(ep_losses)) if ep_losses else 0.0
            self.losses.append(avg_loss)

            ep_summary = {
                "type": "episode_summary",
                "episode": self.current_episode,
                "reward": float(episode_reward),
                "moving_avg": avg_100,
                "epsilon": float(epsilon),
                "loss": avg_loss,
                "best_reward": float(self.best_reward),
                "success_rate": float(self.successful_landings / max(1, self.total_finished_episodes) * 100),
                "steps": step_count,
                "status": status
            }
            self.broadcast(ep_summary)

            # Auto-save checkpoint every 50 episodes
            if self.current_episode % 50 == 0:
                try:
                    self.agent.save("dqn_lunar_lander.pt")
                except Exception:
                    pass

        env.close()
        self.is_running = False
        self.mode = "idle"
        self.broadcast({"type": "training_finished", "total_episodes": self.current_episode})

    def _eval_loop(self):
        """Evaluate current model with epsilon=0 for 1 smooth episode"""
        env = gym.make("LunarLander-v3")
        state, info = env.reset()
        episode_reward = 0.0
        step_count = 0
        done = False
        terrain_info = self.get_terrain_coords(env)

        while not done and not self.stop_event.is_set():
            step_count += 1
            # Epsilon = 0: Pure best policy
            action, q_values = self.agent.act(state, evaluate=True)
            next_state, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

            state = next_state
            episode_reward += reward

            status = "flying"
            if done:
                if reward >= 100 or episode_reward >= 200:
                    status = "landed_safely"
                elif terminated:
                    status = "crashed"
                else:
                    status = "timeout"

            telemetry = {
                "type": "telemetry",
                "mode": "evaluating",
                "episode": self.current_episode,
                "max_episodes": self.max_episodes,
                "step": step_count,
                "state": {
                    "x": float(state[0]),
                    "y": float(state[1]),
                    "vx": float(state[2]),
                    "vy": float(state[3]),
                    "angle": float(state[4]),
                    "angular_vel": float(state[5]),
                    "left_leg": int(state[6]),
                    "right_leg": int(state[7])
                },
                "action": action,
                "q_values": q_values,
                "step_reward": float(reward),
                "episode_reward": float(episode_reward),
                "epsilon": 0.0,
                "loss": 0.0,
                "status": status,
                "terrain": terrain_info
            }
            self.broadcast(telemetry)
            time.sleep(0.02) # 50 FPS smooth render

        env.close()
        self.is_running = False
        self.mode = "idle"
        self.broadcast({"type": "evaluation_finished", "reward": float(episode_reward), "status": status})

    def _human_loop(self):
        """Allow the human player to control the lunar lander"""
        env = gym.make("LunarLander-v3")
        state, info = env.reset()
        episode_reward = 0.0
        step_count = 0
        done = False
        terrain_info = self.get_terrain_coords(env)

        while not done and not self.stop_event.is_set():
            step_count += 1
            action = self.human_action
            next_state, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

            # Evaluate what AI would have estimated for Q-values
            _, ai_q_values = self.agent.act(state, evaluate=True)

            state = next_state
            episode_reward += reward

            status = "flying"
            if done:
                if reward >= 100 or episode_reward >= 200:
                    status = "landed_safely"
                elif terminated:
                    status = "crashed"
                else:
                    status = "timeout"

            telemetry = {
                "type": "telemetry",
                "mode": "human",
                "episode": self.current_episode,
                "max_episodes": self.max_episodes,
                "step": step_count,
                "state": {
                    "x": float(state[0]),
                    "y": float(state[1]),
                    "vx": float(state[2]),
                    "vy": float(state[3]),
                    "angle": float(state[4]),
                    "angular_vel": float(state[5]),
                    "left_leg": int(state[6]),
                    "right_leg": int(state[7])
                },
                "action": action,
                "q_values": ai_q_values,
                "step_reward": float(reward),
                "episode_reward": float(episode_reward),
                "epsilon": 0.0,
                "loss": 0.0,
                "status": status,
                "terrain": terrain_info
            }
            self.broadcast(telemetry)
            time.sleep(0.025)

        env.close()
        self.is_running = False
        self.mode = "idle"
        self.broadcast({"type": "human_finished", "reward": float(episode_reward), "status": status})

    def get_status(self):
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "mode": self.mode,
            "speed_mode": self.speed_mode,
            "current_episode": self.current_episode,
            "max_episodes": self.max_episodes,
            "best_reward": self.best_reward if self.best_reward != -float("inf") else 0.0,
            "epsilon": self.agent.epsilon,
            "success_rate": (self.successful_landings / max(1, self.total_finished_episodes) * 100),
            "total_finished_episodes": self.total_finished_episodes,
            "total_steps": self.agent.total_steps
        }

    def save_model(self, filename="dqn_lunar_lander.pt"):
        self.agent.save(filename)
        return {"status": "model_saved", "filename": filename}

    def load_model(self, filename="dqn_lunar_lander.pt"):
        self.agent.load(filename)
        return {"status": "model_loaded", "filename": filename, "epsilon": self.agent.epsilon}

    def reset_model(self):
        self.stop_current_worker()
        self.agent = DQNAgent(
            state_dim=8,
            action_dim=4,
            lr=5e-4,
            gamma=0.99,
            tau=0.005,
            buffer_size=100000,
            batch_size=64,
            eps_start=1.0,
            eps_end=0.05,
            eps_decay_episodes=800
        )
        self.current_episode = 0
        self.episode_rewards.clear()
        self.moving_avg_rewards.clear()
        self.losses.clear()
        self.best_reward = -float("inf")
        self.successful_landings = 0
        self.total_finished_episodes = 0
        return {"status": "model_reset"}
