/**
 * CHART.JS REAL-TIME TELEMETRY & AI BRAIN VISUALIZATION
 */

class DashboardCharts {
    constructor() {
        this.rewardChart = null;
        this.lossChart = null;
        this.qChart = null;

        this.initCharts();
    }

    initCharts() {
        // Global Chart Defaults
        Chart.defaults.color = '#8a99b5';
        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.06)';

        // 1. REWARD & MOVING AVERAGE CHART
        const rewardCtx = document.getElementById('reward-chart').getContext('2d');
        this.rewardChart = new Chart(rewardCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Episode Reward',
                        data: [],
                        borderColor: 'rgba(0, 240, 255, 0.7)',
                        backgroundColor: 'rgba(0, 240, 255, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        tension: 0.15,
                        fill: false
                    },
                    {
                        label: '100-Ep Moving Average',
                        data: [],
                        borderColor: '#ffd700',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Target Solved (+200)',
                        data: [],
                        borderColor: 'rgba(0, 255, 136, 0.6)',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Episode', color: '#8a99b5', font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.04)' }
                    },
                    y: {
                        title: { display: true, text: 'Total Reward', color: '#8a99b5', font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        suggestedMin: -250,
                        suggestedMax: 280
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 10 } }
                    }
                }
            }
        });

        // 2. EPSILON DECAY & LOSS CHART
        const lossCtx = document.getElementById('loss-chart').getContext('2d');
        this.lossChart = new Chart(lossCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Epsilon (100% → 5%)',
                        data: [],
                        borderColor: '#b026ff',
                        backgroundColor: 'rgba(176, 38, 255, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1,
                        yAxisID: 'yEps'
                    },
                    {
                        label: 'Huber Loss',
                        data: [],
                        borderColor: '#ff8800',
                        backgroundColor: 'rgba(255, 136, 0, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.2,
                        yAxisID: 'yLoss'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Episode', color: '#8a99b5', font: { size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.04)' }
                    },
                    yEps: {
                        type: 'linear',
                        position: 'left',
                        min: 0.0,
                        max: 1.0,
                        title: { display: true, text: 'Epsilon', color: '#b026ff', font: { size: 10 } },
                        grid: { color: 'rgba(176, 38, 255, 0.08)' }
                    },
                    yLoss: {
                        type: 'linear',
                        position: 'right',
                        min: 0.0,
                        title: { display: true, text: 'Loss', color: '#ff8800', font: { size: 10 } },
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 10 } }
                    }
                }
            }
        });

        // 3. AI BRAIN Q-VALUES BAR CHART
        const qCtx = document.getElementById('q-values-chart').getContext('2d');
        this.qChart = new Chart(qCtx, {
            type: 'bar',
            data: {
                labels: ['0: No-op', '1: Left RCS', '2: Main Fire', '3: Right RCS'],
                datasets: [{
                    label: 'Predicted Q-Value',
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(0, 240, 255, 0.3)',
                        'rgba(0, 240, 255, 0.3)',
                        'rgba(0, 240, 255, 0.3)',
                        'rgba(0, 240, 255, 0.3)'
                    ],
                    borderColor: [
                        '#00f0ff',
                        '#00f0ff',
                        '#00f0ff',
                        '#00f0ff'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: { font: { size: 10 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: 'bold' }, color: '#fff' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    addEpisodeSummary(summary) {
        const ep = summary.episode;
        const reward = summary.reward;
        const movingAvg = summary.moving_avg;
        const epsilon = summary.epsilon;
        const loss = summary.loss;

        // Update Reward Chart
        this.rewardChart.data.labels.push(ep);
        this.rewardChart.data.datasets[0].data.push(reward);
        this.rewardChart.data.datasets[1].data.push(movingAvg);
        this.rewardChart.data.datasets[2].data.push(200);

        // Keep last 400 points for smooth performance
        if (this.rewardChart.data.labels.length > 400) {
            this.rewardChart.data.labels.shift();
            this.rewardChart.data.datasets[0].data.shift();
            this.rewardChart.data.datasets[1].data.shift();
            this.rewardChart.data.datasets[2].data.shift();
        }
        this.rewardChart.update();

        // Update Loss Chart
        this.lossChart.data.labels.push(ep);
        this.lossChart.data.datasets[0].data.push(epsilon);
        this.lossChart.data.datasets[1].data.push(loss);

        if (this.lossChart.data.labels.length > 400) {
            this.lossChart.data.labels.shift();
            this.lossChart.data.datasets[0].data.shift();
            this.lossChart.data.datasets[1].data.shift();
        }
        this.lossChart.update();
    }

    updateQValues(qValues, selectedAction) {
        if (!qValues || qValues.length < 4) return;

        const maxIdx = qValues.indexOf(Math.max(...qValues));
        const bgColors = [];
        const borderColors = [];

        for (let i = 0; i < 4; i++) {
            if (i === selectedAction) {
                bgColors.push('rgba(0, 255, 136, 0.7)'); // Selected action
                borderColors.push('#00ff88');
            } else if (i === maxIdx) {
                bgColors.push('rgba(255, 215, 0, 0.5)'); // Max Q
                borderColors.push('#ffd700');
            } else {
                bgColors.push('rgba(0, 240, 255, 0.2)');
                borderColors.push('rgba(0, 240, 255, 0.4)');
            }
        }

        this.qChart.data.datasets[0].data = qValues;
        this.qChart.data.datasets[0].backgroundColor = bgColors;
        this.qChart.data.datasets[0].borderColor = borderColors;
        this.qChart.update();
    }

    reset() {
        this.rewardChart.data.labels = [];
        this.rewardChart.data.datasets.forEach(d => d.data = []);
        this.rewardChart.update();

        this.lossChart.data.labels = [];
        this.lossChart.data.datasets.forEach(d => d.data = []);
        this.lossChart.update();

        this.qChart.data.datasets[0].data = [0, 0, 0, 0];
        this.qChart.update();
    }
}
