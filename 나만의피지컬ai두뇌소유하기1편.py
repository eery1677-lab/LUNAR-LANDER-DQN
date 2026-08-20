# -*- coding: utf-8 -*-
"""나만의피지컬AI두뇌소유하기1편
LunarLander-v3 DQN 간지나는 상륙 & 실시간 웹 관제 시스템

- 알고리즘: Dueling Double DQN (Huber Loss, Replay Buffer, Soft Target Update)
- 입실론(Epsilon): 100% (1.0) -> 5% (0.05) 점진적 감쇠 (Decay)
- 학습 에피소드: 사용자 맞춤형 설정 가능 (기본: 1,000 에피소드)
- 지형 시스템: Gymnasium 환경의 절차적 생성 실제 달 표면 지형 실시간 100% 동기화 렌더링
- 실시간 웹 관제 대시보드 (FastAPI + WebSocket + HTML5 Canvas + Chart.js)
"""

import os
import sys
import gymnasium as gym
import numpy as np
import torch
from dqn_agent import DQNAgent

def train_standalone(max_episodes=1000, render=False):
    """독립 실행형 DQN 학습 함수 (에피소드 수 사용자 설정 가능)"""
    print("=" * 65)
    print("🚀 LunarLander-v3 DQN 간지나는 상륙 학습 시작!")
    print(f"📊 총 에피소드: {max_episodes} | Epsilon: 100% -> 5% 감쇠 ({int(max_episodes*0.8)} 에피소드 동안)")
    print("=" * 65)

    env = gym.make("LunarLander-v3", render_mode="human" if render else None)
    agent = DQNAgent(
        state_dim=8,
        action_dim=4,
        lr=5e-4,
        gamma=0.99,
        tau=0.005,
        buffer_size=100000,
        batch_size=64,
        eps_start=1.0,
        eps_end=0.05,
        eps_decay_episodes=int(max_episodes * 0.8)
    )

    best_reward = -float("inf")
    recent_100_rewards = []

    for episode in range(1, max_episodes + 1):
        state, info = env.reset()
        epsilon = agent.update_epsilon(episode)
        total_reward = 0.0
        step_count = 0
        done = False

        while not done:
            action, q_values = agent.act(state, evaluate=False)
            next_state, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

            agent.step(state, action, reward, next_state, done)
            state = next_state
            total_reward += reward
            step_count += 1

        recent_100_rewards.append(total_reward)
        if len(recent_100_rewards) > 100:
            recent_100_rewards.pop(0)
        avg_reward = np.mean(recent_100_rewards)

        if total_reward > best_reward:
            best_reward = total_reward
            agent.save("dqn_lunar_lander_best.pt")

        if episode % 10 == 0 or total_reward >= 200:
            status_icon = "🌟 [간지나는 착륙 성공!]" if total_reward >= 200 else ("💥 [충돌]" if total_reward < 0 else "✈️ [비행 완료]")
            print(f"Episode {episode:4d}/{max_episodes} | Reward: {total_reward:6.1f} | 100-Avg: {avg_reward:6.1f} | Best: {best_reward:6.1f} | Eps: {epsilon*100:5.1f}% | Steps: {step_count:3d} {status_icon}")

        if episode % 50 == 0:
            agent.save(f"dqn_lunar_lander.pt")

    env.close()
    print("=" * 65)
    print(f"🎉 {max_episodes} 에피소드 학습 완료! 모델이 저장되었습니다.")
    print("=" * 65)


def test_trained_model(model_path="dqn_lunar_lander_best.pt", episodes=5):
    """학습된 모델로 간지나는 상륙 시연 (인간 렌더링 모드)"""
    print(f"🎬 학습된 모델({model_path}) 로드 및 간지나는 착륙 시연 중...")
    env = gym.make("LunarLander-v3", render_mode="human")
    agent = DQNAgent(state_dim=8, action_dim=4)
    
    if os.path.exists(model_path):
        agent.load(model_path)
    else:
        print(f"⚠️ {model_path} 파일이 없어 기본 가중치로 시뮬레이션합니다.")

    for ep in range(1, episodes + 1):
        state, info = env.reset()
        total_reward = 0.0
        done = False
        print(f"\n🚀 시연 에피소드 {ep}/{episodes} 시작...")

        while not done:
            action, q_values = agent.act(state, evaluate=True)
            state, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            total_reward += reward

        outcome = "🌟 완벽한 간지 상륙 성공!" if total_reward >= 200 else "착륙 완료"
        print(f"에피소드 {ep} 결과: 보상 = {total_reward:.1f} PTS ({outcome})")

    env.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LunarLander DQN Controller")
    parser.add_argument("--mode", type=str, default="web", choices=["web", "train", "test"],
                        help="실행 모드: web (실시간 웹 대시보드), train (콘솔 학습), test (시연)")
    parser.add_argument("--episodes", type=int, default=1000, help="학습 에피소드 수 (기본: 1000, 원하는 숫자 입력 가능)")
    args = parser.parse_args()

    if args.mode == "web":
        from main import uvicorn
        import webbrowser, threading, time
        url = "http://127.0.0.1:8000"
        print(f"🚀 실시간 웹 관제 대시보드를 시작합니다: {url}")
        def open_browser():
            time.sleep(1.5)
            webbrowser.open(url)
        threading.Thread(target=open_browser, daemon=True).start()
        uvicorn.run("server:app", host="127.0.0.1", port=8000, log_level="info")
    elif args.mode == "train":
        train_standalone(max_episodes=args.episodes)
    elif args.mode == "test":
        test_trained_model()
