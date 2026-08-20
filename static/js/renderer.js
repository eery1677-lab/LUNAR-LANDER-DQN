/**
 * LUNAR LANDER 60FPS VECTOR CANVAS RENDERER & DYNAMIC TERRAIN SYNC
 */

class LunarRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Space / Starfield
        this.stars = this.initStars(120);
        this.particles = [];
        this.touchdownParticles = [];
        this.flagWave = 0;

        // Current state cache
        this.state = {
            x: 0.0,
            y: 1.0,
            vx: 0.0,
            vy: 0.0,
            angle: 0.0,
            angular_vel: 0.0,
            left_leg: 0,
            right_leg: 0
        };
        this.action = 0;
        this.status = 'flying';
        
        // Procedural Dynamic Terrain from Gymnasium
        this.terrain = {
            points: [
                [-1.0, 0.05], [-0.8, 0.02], [-0.6, 0.0], [-0.4, 0.08],
                [-0.2, 0.0], [0.0, 0.0], [0.2, 0.0], [0.4, -0.05],
                [0.6, 0.02], [0.8, -0.04], [1.0, 0.12]
            ],
            helipad_x1: -0.2,
            helipad_x2: 0.2,
            helipad_y: 0.0
        };

        // Scale coordinates: LunarLander space x: [-1, 1] -> [0, width], y: [0, 1.4] -> [height, 0]
        this.offsetX = this.width / 2.0;
        this.offsetY = this.height * 0.82; // Ground level

        // Animation loop
        this.lastTime = performance.now();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    initStars(count) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * (this.height * 0.8),
                size: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 0.03 + 0.01
            });
        }
        return stars;
    }

    updateState(telemetry) {
        if (telemetry.state) {
            this.state = telemetry.state;
        }
        if (telemetry.action !== undefined) {
            this.action = telemetry.action;
        }
        if (telemetry.status) {
            if (this.status !== 'landed_safely' && telemetry.status === 'landed_safely') {
                this.spawnTouchdownCelebration();
            } else if (this.status !== 'crashed' && telemetry.status === 'crashed') {
                this.spawnCrashExplosion();
            }
            this.status = telemetry.status;
        }
        if (telemetry.terrain && telemetry.terrain.points) {
            this.terrain = telemetry.terrain;
        }
    }

    loop(now) {
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        this.updateParticles(dt);
        this.render();

        requestAnimationFrame(this.loop);
    }

    // World to Screen Coordinates
    worldToScreen(wx, wy) {
        const sx = this.offsetX + wx * (this.width * 0.45);
        const sy = this.offsetY - wy * (this.height * 0.52);
        return { x: sx, y: sy };
    }

    updateParticles(dt) {
        this.flagWave += dt * 5;

        // Spawn Thruster Particles based on Action
        const landerScreen = this.worldToScreen(this.state.x, this.state.y);
        const angle = this.state.angle;

        // Action 2: Main Engine
        if (this.action === 2) {
            for (let i = 0; i < 4; i++) {
                const spread = (Math.random() - 0.5) * 0.35;
                const speed = Math.random() * 120 + 80;
                const pAngle = angle + Math.PI / 2 + spread;
                this.particles.push({
                    x: landerScreen.x - Math.sin(angle) * 18,
                    y: landerScreen.y + Math.cos(angle) * 18,
                    vx: Math.cos(pAngle) * speed + (Math.random() - 0.5) * 20,
                    vy: Math.sin(pAngle) * speed,
                    size: Math.random() * 5 + 3,
                    color: Math.random() > 0.4 ? '#ff6600' : (Math.random() > 0.5 ? '#ffcc00' : '#00f0ff'),
                    alpha: 1.0,
                    decay: Math.random() * 2.5 + 2.0,
                    type: 'fire'
                });
            }

            // Ground dust if near surface
            if (this.state.y < 0.35) {
                for (let i = 0; i < 3; i++) {
                    this.particles.push({
                        x: landerScreen.x + (Math.random() - 0.5) * 40,
                        y: this.offsetY - 5,
                        vx: (Math.random() - 0.5) * 90,
                        vy: -Math.random() * 30 - 10,
                        size: Math.random() * 4 + 2,
                        color: 'rgba(180, 190, 210, 0.6)',
                        alpha: 0.8,
                        decay: 1.8,
                        type: 'dust'
                    });
                }
            }
        }

        // Action 1: Left RCS
        if (this.action === 1) {
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    x: landerScreen.x - Math.cos(angle) * 14 - Math.sin(angle) * 8,
                    y: landerScreen.y - Math.sin(angle) * 14 + Math.cos(angle) * 8,
                    vx: -Math.cos(angle) * 70 + (Math.random() - 0.5) * 15,
                    vy: -Math.sin(angle) * 70,
                    size: Math.random() * 3 + 2,
                    color: '#00f0ff',
                    alpha: 0.9,
                    decay: 3.5,
                    type: 'rcs'
                });
            }
        }

        // Action 3: Right RCS
        if (this.action === 3) {
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    x: landerScreen.x + Math.cos(angle) * 14 - Math.sin(angle) * 8,
                    y: landerScreen.y + Math.sin(angle) * 14 + Math.cos(angle) * 8,
                    vx: Math.cos(angle) * 70 + (Math.random() - 0.5) * 15,
                    vy: Math.sin(angle) * 70,
                    size: Math.random() * 3 + 2,
                    color: '#00f0ff',
                    alpha: 0.9,
                    decay: 3.5,
                    type: 'rcs'
                });
            }
        }

        // Update standard particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha -= p.decay * dt;
            p.size *= 0.96;
            if (p.alpha <= 0 || p.size <= 0.5) {
                this.particles.splice(i, 1);
            }
        }

        // Update celebration/explosion particles
        for (let i = this.touchdownParticles.length - 1; i >= 0; i--) {
            const p = this.touchdownParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 80 * dt;
            p.alpha -= p.decay * dt;
            if (p.alpha <= 0) {
                this.touchdownParticles.splice(i, 1);
            }
        }
    }

    spawnTouchdownCelebration() {
        const landerScreen = this.worldToScreen(this.state.x, this.state.y);
        const colors = ['#ffd700', '#00ff88', '#00f0ff', '#ffffff', '#ff00ea'];
        for (let i = 0; i < 80; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 220 + 60;
            this.touchdownParticles.push({
                x: landerScreen.x,
                y: landerScreen.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                size: Math.random() * 4 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                decay: Math.random() * 0.8 + 0.6
            });
        }
    }

    spawnCrashExplosion() {
        const landerScreen = this.worldToScreen(this.state.x, this.state.y);
        const colors = ['#ff0055', '#ff5500', '#ffaa00', '#333333'];
        for (let i = 0; i < 90; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 250 + 80;
            this.touchdownParticles.push({
                x: landerScreen.x,
                y: landerScreen.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                size: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                decay: Math.random() * 1.0 + 0.8
            });
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Deep Space & Starfield
        this.renderSpaceBackground(ctx);

        // 2. Landing Beacons & Guidance Lasers
        this.renderLandingGuidance(ctx);

        // 3. Dynamic Procedural Moon Terrain
        this.renderMoonTerrain(ctx);

        // 4. Particles
        this.renderParticles(ctx);

        // 5. Lunar Lander Spacecraft
        this.renderLander(ctx);

        // 6. HUD Flight Horizon & Vector Indicator
        this.renderFlightAids(ctx);
    }

    renderSpaceBackground(ctx) {
        const grad = ctx.createRadialGradient(
            this.width * 0.3, this.height * 0.2, 50,
            this.width * 0.5, this.height * 0.4, this.width * 0.7
        );
        grad.addColorStop(0, 'rgba(35, 15, 60, 0.45)');
        grad.addColorStop(0.5, 'rgba(10, 20, 45, 0.25)');
        grad.addColorStop(1, 'rgba(2, 4, 9, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        for (const star of this.stars) {
            star.alpha += (Math.random() - 0.5) * star.twinkleSpeed;
            star.alpha = Math.max(0.2, Math.min(1.0, star.alpha));

            ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Distant Earth in Sky
        ctx.save();
        const earthX = this.width * 0.85;
        const earthY = this.height * 0.18;
        const earthGrad = ctx.createRadialGradient(earthX - 6, earthY - 6, 2, earthX, earthY, 22);
        earthGrad.addColorStop(0, '#70d6ff');
        earthGrad.addColorStop(0.6, '#004e92');
        earthGrad.addColorStop(1, '#000428');
        ctx.fillStyle = earthGrad;
        ctx.beginPath();
        ctx.arc(earthX, earthY, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    renderLandingGuidance(ctx) {
        const p1 = this.worldToScreen(this.terrain.helipad_x1, this.terrain.helipad_y);
        const p2 = this.worldToScreen(this.terrain.helipad_x2, this.terrain.helipad_y);

        ctx.save();
        // Vertical Landing Laser Beacons
        const laserGrad = ctx.createLinearGradient(0, 0, 0, p1.y);
        laserGrad.addColorStop(0, 'rgba(0, 255, 136, 0)');
        laserGrad.addColorStop(0.8, 'rgba(0, 255, 136, 0.12)');
        laserGrad.addColorStop(1, 'rgba(0, 255, 136, 0.35)');

        ctx.fillStyle = laserGrad;
        ctx.fillRect(p1.x, 0, p2.x - p1.x, p1.y);

        // Guide Lines
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(p1.x, 0);
        ctx.lineTo(p1.x, p1.y);
        ctx.moveTo(p2.x, 0);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    renderMoonTerrain(ctx) {
        const pts = this.terrain.points;
        const p1 = this.worldToScreen(this.terrain.helipad_x1, this.terrain.helipad_y);
        const p2 = this.worldToScreen(this.terrain.helipad_x2, this.terrain.helipad_y);

        ctx.save();

        // 1. Draw Exact Dynamic Terrain Polygon from Gymnasium
        ctx.beginPath();
        ctx.moveTo(0, this.height);

        if (pts && pts.length > 0) {
            const firstScreen = this.worldToScreen(pts[0][0], pts[0][1]);
            ctx.lineTo(0, firstScreen.y);

            for (let i = 0; i < pts.length; i++) {
                const s = this.worldToScreen(pts[i][0], pts[i][1]);
                ctx.lineTo(s.x, s.y);
            }
            ctx.lineTo(this.width, this.worldToScreen(pts[pts.length - 1][0], pts[pts.length - 1][1]).y);
        } else {
            // Fallback
            ctx.lineTo(0, this.offsetY + 20);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(this.width, this.offsetY + 20);
        }

        ctx.lineTo(this.width, this.height);
        ctx.closePath();

        // Moon Surface Gradient
        const moonGrad = ctx.createLinearGradient(0, this.offsetY - 50, 0, this.height);
        moonGrad.addColorStop(0, '#353c52');
        moonGrad.addColorStop(0.25, '#222738');
        moonGrad.addColorStop(0.7, '#131622');
        moonGrad.addColorStop(1, '#080a12');
        ctx.fillStyle = moonGrad;
        ctx.fill();

        // Glowing Surface Ridge Outline
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 2. Landing Pad Flat Strip
        const padWidth = p2.x - p1.x;
        ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
        ctx.fillRect(p1.x, p1.y - 2, padWidth, 6);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(p1.x, p1.y - 2, padWidth, 6);

        // 3. Runway Pulsing Beacons
        const pulse = (Math.sin(performance.now() / 200) + 1) / 2;
        ctx.fillStyle = `rgba(0, 255, 136, ${0.4 + pulse * 0.6})`;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
        ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 4. Animated Landing Flags
        this.renderFlag(ctx, p1.x - 6, p1.y, '#ff0055');
        this.renderFlag(ctx, p2.x + 6, p2.y, '#00f0ff');

        ctx.restore();
    }

    renderFlag(ctx, x, y, color) {
        ctx.save();
        ctx.strokeStyle = '#e0e6ed';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 24);
        ctx.stroke();

        const wave = Math.sin(this.flagWave) * 3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 24);
        ctx.quadraticCurveTo(x + 8, y - 22 + wave, x + 16, y - 18);
        ctx.lineTo(x, y - 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    renderParticles(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const p of this.touchdownParticles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    renderLander(ctx) {
        const pos = this.worldToScreen(this.state.x, this.state.y);
        const angle = this.state.angle;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(-angle);

        const landerW = 34;
        const landerH = 26;

        // Landing Legs
        const legLeftContact = this.state.left_leg === 1;
        const legRightContact = this.state.right_leg === 1;

        // Left Leg
        ctx.strokeStyle = legLeftContact ? '#00ff88' : '#ccd6e0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, landerH / 2 - 2);
        ctx.lineTo(-22, landerH / 2 + 16);
        ctx.stroke();
        ctx.fillStyle = legLeftContact ? '#00ff88' : '#ffd700';
        ctx.beginPath();
        ctx.ellipse(-22, landerH / 2 + 16, 6, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Right Leg
        ctx.strokeStyle = legRightContact ? '#00ff88' : '#ccd6e0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, landerH / 2 - 2);
        ctx.lineTo(22, landerH / 2 + 16);
        ctx.stroke();
        ctx.fillStyle = legRightContact ? '#00ff88' : '#ffd700';
        ctx.beginPath();
        ctx.ellipse(22, landerH / 2 + 16, 6, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lander Main Engine Bell
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.moveTo(-7, landerH / 2);
        ctx.lineTo(7, landerH / 2);
        ctx.lineTo(10, landerH / 2 + 10);
        ctx.lineTo(-10, landerH / 2 + 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Lander Octagonal Body
        const bodyGrad = ctx.createLinearGradient(-landerW / 2, -landerH / 2, landerW / 2, landerH / 2);
        bodyGrad.addColorStop(0, '#ffd700');
        bodyGrad.addColorStop(0.4, '#e6b800');
        bodyGrad.addColorStop(0.7, '#2b354f');
        bodyGrad.addColorStop(1, '#1a2238');

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(-landerW / 2 + 6, -landerH / 2);
        ctx.lineTo(landerW / 2 - 6, -landerH / 2);
        ctx.lineTo(landerW / 2, -landerH / 2 + 8);
        ctx.lineTo(landerW / 2, landerH / 2 - 4);
        ctx.lineTo(landerW / 2 - 6, landerH / 2);
        ctx.lineTo(-landerW / 2 + 6, landerH / 2);
        ctx.lineTo(-landerW / 2, landerH / 2 - 4);
        ctx.lineTo(-landerW / 2, -landerH / 2 + 8);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cockpit Glass Visor
        const visorGrad = ctx.createLinearGradient(-8, -8, 8, 4);
        visorGrad.addColorStop(0, '#00f0ff');
        visorGrad.addColorStop(0.6, '#0066ff');
        visorGrad.addColorStop(1, '#001a4d');
        ctx.fillStyle = visorGrad;
        ctx.beginPath();
        ctx.roundRect(-9, -landerH / 2 + 4, 18, 10, [4, 4, 2, 2]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Antenna & Flashing Beacon
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -landerH / 2);
        ctx.lineTo(0, -landerH / 2 - 12);
        ctx.stroke();

        const beaconPulse = Math.sin(performance.now() / 150) > 0;
        ctx.fillStyle = beaconPulse ? '#ff0055' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(0, -landerH / 2 - 12, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    renderFlightAids(ctx) {
        const pos = this.worldToScreen(this.state.x, this.state.y);

        ctx.save();
        if (Math.abs(this.state.vx) > 0.05 || Math.abs(this.state.vy) > 0.05) {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            const targetX = pos.x + this.state.vx * 60;
            const targetY = pos.y - this.state.vy * 60;
            ctx.lineTo(targetX, targetY);
            ctx.stroke();

            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
