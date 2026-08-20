import random
from collections import deque
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

class DuelingQNetwork(nn.Module):
    """
    Dueling DQN Network Architecture:
    Splits into Value stream V(s) and Advantage stream A(s, a)
    Q(s, a) = V(s) + (A(s, a) - mean(A(s, a)))
    """
    def __init__(self, state_dim=8, action_dim=4, hidden_dim=128):
        super(DuelingQNetwork, self).__init__()
        
        # Shared feature extractor
        self.feature_layer = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU()
        )
        
        # State-Value stream V(s)
        self.value_stream = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )
        
        # Advantage stream A(s, a)
        self.advantage_stream = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Linear(64, action_dim)
        )

    def forward(self, state):
        features = self.feature_layer(state)
        value = self.value_stream(features)
        advantages = self.advantage_stream(features)
        # Combine streams with mean subtraction for stability
        q_values = value + (advantages - advantages.mean(dim=-1, keepdim=True))
        return q_values


class ReplayBuffer:
    def __init__(self, capacity=100000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size):
        states, actions, rewards, next_states, dones = zip(*random.sample(self.buffer, batch_size))
        return (
            np.array(states, dtype=np.float32),
            np.array(actions, dtype=np.int64),
            np.array(rewards, dtype=np.float32),
            np.array(next_states, dtype=np.float32),
            np.array(dones, dtype=np.float32)
        )

    def __len__(self):
        return len(self.buffer)


class DQNAgent:
    def __init__(
        self,
        state_dim=8,
        action_dim=4,
        lr=5e-4,
        gamma=0.99,
        tau=0.005,
        buffer_size=100000,
        batch_size=64,
        eps_start=1.0,
        eps_end=0.05,
        eps_decay_episodes=800,
        device=None
    ):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.tau = tau
        self.batch_size = batch_size
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Epsilon schedule parameters (1.0 -> 0.05 over 1000 episodes)
        self.eps_start = eps_start
        self.eps_end = eps_end
        self.eps_decay_episodes = eps_decay_episodes
        self.epsilon = eps_start

        # Networks
        self.q_network = DuelingQNetwork(state_dim, action_dim).to(self.device)
        self.target_network = DuelingQNetwork(state_dim, action_dim).to(self.device)
        self.target_network.load_state_dict(self.q_network.state_dict())
        self.target_network.eval()

        self.optimizer = optim.Adam(self.q_network.parameters(), lr=lr)
        self.criterion = nn.SmoothL1Loss()  # Huber loss for gradient robustness
        self.memory = ReplayBuffer(capacity=buffer_size)

        self.total_steps = 0
        self.current_episode = 0

    def update_epsilon(self, episode):
        """Linearly decay epsilon from 1.0 (100%) to 0.05 (5%) over decay episodes"""
        self.current_episode = episode
        progress = min(1.0, episode / max(1, self.eps_decay_episodes))
        self.epsilon = self.eps_start - progress * (self.eps_start - self.eps_end)
        return self.epsilon

    def act(self, state, evaluate=False):
        """
        Choose action using epsilon-greedy policy.
        Returns: (action, q_values_list)
        """
        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        self.q_network.eval()
        with torch.no_grad():
            q_values = self.q_network(state_t).cpu().numpy()[0]
        self.q_network.train()

        # Epsilon-greedy
        if not evaluate and random.random() < self.epsilon:
            action = random.randrange(self.action_dim)
        else:
            action = int(np.argmax(q_values))

        return action, q_values.tolist()

    def step(self, state, action, reward, next_state, done):
        self.memory.push(state, action, reward, next_state, done)
        self.total_steps += 1
        
        loss = None
        if len(self.memory) >= self.batch_size:
            loss = self.learn()
        return loss

    def learn(self):
        states, actions, rewards, next_states, dones = self.memory.sample(self.batch_size)

        states_t = torch.FloatTensor(states).to(self.device)
        actions_t = torch.LongTensor(actions).unsqueeze(1).to(self.device)
        rewards_t = torch.FloatTensor(rewards).unsqueeze(1).to(self.device)
        next_states_t = torch.FloatTensor(next_states).to(self.device)
        dones_t = torch.FloatTensor(dones).unsqueeze(1).to(self.device)

        # Current Q-values: Q(s, a)
        curr_q = self.q_network(states_t).gather(1, actions_t)

        # Double DQN: select best action using online network, evaluate Q using target network
        with torch.no_grad():
            best_actions = self.q_network(next_states_t).argmax(1, keepdim=True)
            next_q = self.target_network(next_states_t).gather(1, best_actions)
            target_q = rewards_t + (1.0 - dones_t) * self.gamma * next_q

        loss = self.criterion(curr_q, target_q)

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=10.0)
        self.optimizer.step()

        # Soft target network update
        self.soft_update()

        return float(loss.item())

    def soft_update(self):
        """Soft update target network: θ_target = τ*θ_local + (1 - τ)*θ_target"""
        for target_param, local_param in zip(self.target_network.parameters(), self.q_network.parameters()):
            target_param.data.copy_(self.tau * local_param.data + (1.0 - self.tau) * target_param.data)

    def save(self, filepath="dqn_lunar_lander.pt"):
        torch.save({
            'q_network_state_dict': self.q_network.state_dict(),
            'target_network_state_dict': self.target_network.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'current_episode': self.current_episode,
            'total_steps': self.total_steps
        }, filepath)

    def load(self, filepath="dqn_lunar_lander.pt"):
        checkpoint = torch.load(filepath, map_location=self.device)
        self.q_network.load_state_dict(checkpoint['q_network_state_dict'])
        self.target_network.load_state_dict(checkpoint['target_network_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.epsilon = checkpoint.get('epsilon', self.eps_end)
        self.current_episode = checkpoint.get('current_episode', 0)
        self.total_steps = checkpoint.get('total_steps', 0)
