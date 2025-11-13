
import React, { useRef, useEffect } from 'react';
import { ChannelState, HarmonyState } from '../types';

declare const p5: any;

interface P5CanvasProps {
  channels: ChannelState[];
  harmonyState: HarmonyState;
}

const P5Canvas: React.FC<P5CanvasProps> = ({ channels, harmonyState }) => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ channels, harmonyState });
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    propsRef.current = { channels, harmonyState };
  }, [channels, harmonyState]);

  useEffect(() => {
    if (!sketchRef.current || typeof p5 === 'undefined') return;

    const sketch = (p: any) => {
      const particles: Particle[] = [];
      const supernovaParticles: SupernovaParticle[] = [];
      const resolutionParticles: ResolutionParticle[] = [];
      let harmonicCore: HarmonicCore;
      const lenses: Lens[] = [];
      const PARTICLE_COUNT = 1500;
      let smoothedPalette: any = null;

      class Particle {
        pos: any;
        vel: any;
        acc: any;
        maxSpeed: number;
        lifespan: number;
        baseAlpha: number;

        constructor() {
          this.pos = p.createVector(p.random(p.width), p.random(p.height));
          this.vel = p.createVector(0, 0);
          this.acc = p.createVector(0, 0);
          this.maxSpeed = 2;
          this.lifespan = 255;
          this.baseAlpha = p.random(10, 40);
        }

        applyForce(force: any) {
          this.acc.add(force);
        }

        update() {
          const { harmonyState } = propsRef.current;
          this.maxSpeed = 2 + (harmonyState?.tension ?? 0.5) * 3;

          this.vel.add(this.acc);
          this.vel.limit(this.maxSpeed);
          this.pos.add(this.vel);
          this.acc.mult(0);

          if (this.pos.x > p.width) this.pos.x = 0;
          if (this.pos.x < 0) this.pos.x = p.width;
          if (this.pos.y > p.height) this.pos.y = 0;
          if (this.pos.y < 0) this.pos.y = p.height;
        }

        display(color: any, alpha: number) {
          p.stroke(color, alpha);
          p.point(this.pos.x, this.pos.y);
        }
      }
      
      class SupernovaParticle {
        pos: any;
        vel: any;
        lifespan: number;
        color: any;

        constructor(position: any, velocity: any, color: any) {
            this.pos = position.copy();
            this.vel = velocity.copy();
            this.lifespan = 255;
            this.color = color;
        }

        update() {
            this.vel.mult(0.96);
            this.pos.add(this.vel);
            this.lifespan -= 4;
        }

        isDead() {
            return this.lifespan < 0;
        }

        display() {
            p.noStroke();
            p.fill(p.hue(this.color), p.saturation(this.color), p.brightness(this.color), this.lifespan);
            p.ellipse(this.pos.x, this.pos.y, 2, 2);
        }
      }

      class ResolutionParticle {
        pos: any;
        vel: any;
        lifespan: number;
        color: any;

        constructor(position: any, velocity: any, color: any) {
            this.pos = position.copy();
            this.vel = velocity.copy();
            this.lifespan = 255;
            this.color = color;
        }

        update() {
            this.vel.mult(0.98); // Slows down
            this.pos.add(this.vel);
            this.lifespan -= 5;
        }

        isDead() {
            return this.lifespan < 0;
        }

        display() {
            p.stroke(p.hue(this.color), p.saturation(this.color), p.brightness(this.color), this.lifespan);
            p.strokeWeight(2);
            p.point(this.pos.x, this.pos.y);
        }
      }

      class HarmonicCore {
          pos: any;
          noiseSeed: number;

          constructor() {
              this.pos = p.createVector(p.width / 2, p.height / 2);
              this.noiseSeed = p.random(1000);
          }

          update(palette: any) {
              this.pos.set(p.width / 2, p.height / 2);
              const { harmonyState } = propsRef.current;
              
              if (harmonyState.resolution > 0.5 && p.frameCount % 2 === 0) { 
                  this.pulse(harmonyState.resolution, palette.accent);
              }
          }
          
          pulse(strength: number, pulseColor: any) {
              const particleCount = p.floor(p.map(strength, 0.5, 1, 20, 100));
              for (let i = 0; i < particleCount; i++) {
                  const angle = p.random(p.TWO_PI);
                  const speed = p.random(3, 8) * (1 + strength);
                  const vel = p5.Vector.fromAngle(angle, speed);
                  resolutionParticles.push(new ResolutionParticle(this.pos, vel, pulseColor));
              }
          }

          display(palette: any) {
              const { harmonyState, channels } = propsRef.current;
              const tension = harmonyState?.tension ?? 0.5;

              const totalSignal = channels.reduce((sum, ch) => sum + ch.currentSignal, 0);
              const avgSignal = channels.length > 0 ? totalSignal / channels.length : 0;
              const baseSize = 50 + avgSignal * 250;

              const lowTensionColor = palette.primary; 
              const highTensionColor = p.color(0, 90, 90); // Red
              const coreColor = p.lerpColor(lowTensionColor, highTensionColor, tension);

              p.push();
              p.translate(this.pos.x, this.pos.y);
              p.noStroke();

              const instability = tension * 20;
              
              for (let i = 5; i > 0; i--) {
                  const size = baseSize + i * 20;
                  const alpha = p.map(i, 5, 1, 10, 50);
                  p.fill(p.hue(coreColor), p.saturation(coreColor), p.brightness(coreColor), alpha);
                  
                  p.beginShape();
                  for (let angle = 0; angle < p.TWO_PI; angle += 0.1) {
                      const offset = p.map(p.noise(this.noiseSeed + p.cos(angle) + p.frameCount * 0.01, this.noiseSeed + p.sin(angle) + p.frameCount * 0.01), 0, 1, -instability, instability);
                      const r = size / 2 + offset;
                      const x = r * p.cos(angle);
                      const y = r * p.sin(angle);
                      p.vertex(x, y);
                  }
                  p.endShape(p.CLOSE);
              }
              
              p.pop();
          }
      }

      class Lens {
        channel: ChannelState;
        pos: any;
        vel: any;
        acc: any;
        targetPos: any;
        color: any;
        noiseSeed: number;
        hueOffset: number;

        constructor(channel: ChannelState, index: number, total: number) {
          this.channel = channel;
          const angle = p.map(index, 0, total, 0, p.TWO_PI);
          const radius = p.min(p.width, p.height) * 0.35;
          this.targetPos = p.createVector(
            p.width / 2 + radius * p.cos(angle),
            p.height / 2 + radius * p.sin(angle)
          );
          this.pos = this.targetPos.copy();
          this.vel = p.createVector(0, 0);
          this.acc = p.createVector(0, 0);
          this.noiseSeed = p.random(1000);
          this.hueOffset = (index * (360 / total) * 0.7) % 360; 
          this.color = p.color(this.hueOffset, 80, 90);
        }
        
        applyForce(force: any) {
            this.acc.add(force);
        }

        applyBehaviors(otherLenses: Lens[]) {
            let toTarget = p5.Vector.sub(this.targetPos, this.pos);
            toTarget.mult(0.01); 
            this.applyForce(toTarget);

            for (const other of otherLenses) {
                if (other === this) continue;
                let force = p5.Vector.sub(this.pos, other.pos);
                let distance = force.mag();

                if (distance < 120) { 
                    force.setMag(p.map(distance, 0, 120, 0.6, 0));
                    this.applyForce(force);
                }

                const meritThreshold = 0.35;
                if (this.channel.merit > meritThreshold && other.channel.merit > meritThreshold) {
                    let attractionForce = p5.Vector.sub(other.pos, this.pos);
                    let d = attractionForce.mag();
                    if (d > 100) { 
                        attractionForce.setMag(p.map(d, 100, p.width, 0, 0.25));
                        this.applyForce(attractionForce);
                    }
                }
            }
        }

        update(channel: ChannelState, palette: any, consonance: number) {
          this.channel = channel;

          const baseHue = p.hue(palette.primary);
          const myHue = (baseHue + this.hueOffset) % 360;
          const consonanceFactor = 0.5 + consonance * 0.5;
          const mySaturation = p.map(this.channel.habituation, 0, 1, 80 * consonanceFactor, 20);
          const myBrightness = p.map(this.channel.habituation, 0, 1, 95, 50);
          this.color = p.color(myHue, mySaturation, myBrightness);

          this.vel.add(this.acc);
          this.vel.mult(0.95);
          this.vel.limit(3);
          this.pos.add(this.vel);
          this.acc.mult(0);
        }

        attract(particle: Particle) {
          const force = p5.Vector.sub(this.pos, particle.pos);
          let d = force.mag();
          
          const isBored = this.channel.habituation > 0.7;
          if (isBored) {
             const repelRadius = p.map(this.channel.habituation, 0.7, 1, 50, 150);
             if (d < repelRadius) {
                const repelForce = force.copy().mult(-0.5);
                particle.applyForce(repelForce);
             }
             return;
          }

          if (this.channel.isActive && d < 200) {
            const strength = p.map(this.channel.currentSignal, 0.1, 1, 0.01, 0.5);
            force.setMag(strength);
            particle.applyForce(force);
            
            const alpha = p.map(d, 200, 0, 0, 255);
            particle.display(this.color, alpha);
          }
        }
        
        display() {
           if (this.channel.merit > 0.6 && p.random() < 0.05) {
                this.supernova();
           }
          
           const blurAmount = p.map(this.channel.habituation, 0.5, 1, 0, 20);
           if (blurAmount > 1) {
               p.drawingContext.filter = `blur(${blurAmount}px)`;
           }

           const coreSize = 10 + this.channel.attention * 40;
           const coreBrightness = p.map(this.channel.habituation, 0, 1, p.brightness(this.color), 30);
           const coreSaturation = p.map(this.channel.habituation, 0, 1, p.saturation(this.color), 10);
           const coreColor = p.color(p.hue(this.color), coreSaturation, coreBrightness, 200);
           
           p.noStroke();
           p.fill(coreColor);
           p.ellipse(this.pos.x, this.pos.y, coreSize, coreSize);
           p.drawingContext.filter = 'none';
        }

        supernova() {
            for (let i = 0; i < 30; i++) {
                const angle = p.random(p.TWO_PI);
                const speed = p.random(2, 6);
                const vel = p5.Vector.fromAngle(angle, speed);
                supernovaParticles.push(new SupernovaParticle(this.pos, vel, this.color));
            }
        }
      }

      p.setup = () => {
        p.createCanvas(sketchRef.current!.offsetWidth, sketchRef.current!.offsetHeight);
        p.colorMode(p.HSB, 360, 100, 100, 255);
        p.strokeWeight(1.5);

        // Initialize smoothed palette to a neutral default
        smoothedPalette = {
            bg: p.color(200, 50, 12, 255),
            primary: p.color(200, 80, 95),
            accent: p.color(350, 70, 95),
            neutral: p.color(200, 10, 95),
        };

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles[i] = new Particle();
        }
        const { channels: currentChannels } = propsRef.current;
        lenses.push(...currentChannels.map((ch, i) => new Lens(ch, i, currentChannels.length)));
        harmonicCore = new HarmonicCore();
      };

      p.windowResized = () => {
        p.resizeCanvas(sketchRef.current!.offsetWidth, sketchRef.current!.offsetHeight);
        const radius = p.min(p.width, p.height) * 0.35;
        lenses.forEach((lens, index) => {
            const angle = p.map(index, 0, lenses.length, 0, p.TWO_PI);
            lens.targetPos.set(
                p.width / 2 + radius * p.cos(angle),
                p.height / 2 + radius * p.sin(angle)
            );
        });
      };

      p.draw = () => {
        const { channels: currentChannels, harmonyState } = propsRef.current;
        
        // --- Adaptive Color Palette (Smoothed) ---
        const consonance = harmonyState?.consonance ?? 0;
        const pitch = harmonyState?.pitch ?? 0;
        
        const targetPitchHue = p.map(p.log(pitch), p.log(130), p.log(1046), 0, 360) % 360;

        if (!isNaN(targetPitchHue)) {
            const consonanceFactor = 0.6 + consonance * 0.4;
            const targetPalette = {
                bg: p.color(targetPitchHue, 50 * consonanceFactor, 12, 255),
                primary: p.color(targetPitchHue, 80 * consonanceFactor, 95),
                accent: p.color((targetPitchHue + 150) % 360, 70, 95),
                neutral: p.color(targetPitchHue, 10, 95),
            };
            
            // Smoothly interpolate towards the target palette to prevent flickering
            const smoothing = 0.05;
            smoothedPalette.bg = p.lerpColor(smoothedPalette.bg, targetPalette.bg, smoothing);
            smoothedPalette.primary = p.lerpColor(smoothedPalette.primary, targetPalette.primary, smoothing);
            smoothedPalette.accent = p.lerpColor(smoothedPalette.accent, targetPalette.accent, smoothing);
            smoothedPalette.neutral = p.lerpColor(smoothedPalette.neutral, targetPalette.neutral, smoothing);
        }
        p.background(smoothedPalette.bg);
        
        if (lenses.length !== currentChannels.length) {
          lenses.length = 0;
          lenses.push(...currentChannels.map((ch, i) => new Lens(ch, i, currentChannels.length)));
        }
        
        for (let i = supernovaParticles.length - 1; i >= 0; i--) {
            supernovaParticles[i].update();
            supernovaParticles[i].display();
            if (supernovaParticles[i].isDead()) supernovaParticles.splice(i, 1);
        }
        
        for (let i = resolutionParticles.length - 1; i >= 0; i--) {
            resolutionParticles[i].update();
            resolutionParticles[i].display();
            if (resolutionParticles[i].isDead()) resolutionParticles.splice(i, 1);
        }

        for (const particle of particles) {
          particle.update();
          particle.display(smoothedPalette.neutral, particle.baseAlpha);
        }
        
        lenses.forEach(lens => lens.applyBehaviors(lenses));
        lenses.forEach((lens, i) => {
          lens.update(currentChannels[i], smoothedPalette, consonance);
          particles.forEach(particle => lens.attract(particle));
        });

        // --- DRAW INTER-LENS CONNECTIONS from Interharmonic Analysis ---
        const { interLensConsonance } = propsRef.current.harmonyState;
        if (interLensConsonance && interLensConsonance.length === lenses.length) {
            p.strokeWeight(0.75);
            for (let i = 0; i < lenses.length; i++) {
                for (let j = i + 1; j < lenses.length; j++) {
                    const consonanceScore = interLensConsonance[i][j];
                    if (consonanceScore > 0.15) { // Threshold to draw
                        const opacity = p.map(consonanceScore, 0.15, 1.0, 0, 150);
                        p.stroke(
                            p.hue(smoothedPalette.neutral), 
                            p.saturation(smoothedPalette.neutral) * 0.5, 
                            p.brightness(smoothedPalette.neutral), 
                            opacity
                        );
                        p.line(lenses[i].pos.x, lenses[i].pos.y, lenses[j].pos.x, lenses[j].pos.y);
                    }
                }
            }
        }

        lenses.forEach(lens => lens.display());

        harmonicCore.update(smoothedPalette);
        harmonicCore.display(smoothedPalette);
      };
    };

    const p5Instance = new p5(sketch, sketchRef.current!);
    p5InstanceRef.current = p5Instance;

    return () => {
      p5Instance.remove();
    };
  }, []);

  return <div ref={sketchRef} className="w-full h-full" />;
};

export default P5Canvas;
