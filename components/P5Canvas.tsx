

import React, { useRef, useEffect } from 'react';
import { ChannelState } from '../types';

declare const p5: any;

interface P5CanvasProps {
  channels: ChannelState[];
}

const P5Canvas: React.FC<P5CanvasProps> = ({ channels }) => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ channels });
  // FIX: Declare p5InstanceRef to store the p5.js instance.
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    propsRef.current = { channels };
  }, [channels]);

  useEffect(() => {
    if (!sketchRef.current || typeof p5 === 'undefined') return;

    const sketch = (p: any) => {
      const particles: Particle[] = [];
      const lenses: Lens[] = [];
      const PARTICLE_COUNT = 1500;

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

      class Lens {
        channel: ChannelState;
        pos: any;
        targetPos: any;
        color: any;
        noiseSeed: number;

        constructor(channel: ChannelState, index: number, total: number) {
          this.channel = channel;
          const angle = p.map(index, 0, total, 0, p.TWO_PI);
          const radius = p.min(p.width, p.height) * 0.35;
          this.targetPos = p.createVector(
            p.width / 2 + radius * p.cos(angle),
            p.height / 2 + radius * p.sin(angle)
          );
          this.pos = this.targetPos.copy();
          this.noiseSeed = p.random(1000);
          
          const colorMapping: { [key: string]: number[] } = {
            'Sub Bass': [0, 80, 90],   // Red
            'Bass': [30, 80, 90], // Orange
            'Low Mids': [60, 80, 90], // Yellow
            'Midrange': [120, 70, 80], // Green
            'Upper Mids': [180, 70, 90], // Cyan
            'Presence': [240, 80, 90], // Blue
            'Brilliance': [280, 80, 90], // Purple
          };
          const colorValues = colorMapping[channel.label] || [200, 50, 80];
          this.color = p.color(colorValues[0], colorValues[1], colorValues[2]);
        }
        
        update(channel: ChannelState) {
          this.channel = channel;

          // Seeking behavior: Drift when attention is low
          if (this.channel.attention < 0.2) {
            const wanderStrength = p.map(this.channel.attention, 0, 0.2, 0.5, 0);
            const angle = p.noise(this.noiseSeed + p.frameCount * 0.005) * p.TWO_PI * 4;
            const wanderVector = p5.Vector.fromAngle(angle, wanderStrength);
            this.pos.add(wanderVector);
          }
          // Lerp back to target position
          this.pos.lerp(this.targetPos, 0.02);
        }

        attract(particle: Particle) {
          const force = p5.Vector.sub(this.pos, particle.pos);
          let d = force.mag();
          
          // Boredom as repulsion/weak attraction
          const isBored = this.channel.habituation > 0.7;
          if (isBored) {
             const repelRadius = p.map(this.channel.habituation, 0.7, 1, 50, 150);
             if (d < repelRadius) {
                const repelForce = force.copy().mult(-0.5);
                particle.applyForce(repelForce);
             }
             return;
          }

          // Active signal attraction
          if (this.channel.isActive && d < 200) {
            const strength = p.map(this.channel.currentSignal, 0.1, 1, 0.01, 0.5);
            force.setMag(strength);
            particle.applyForce(force);
            
            // Color particles that are being pulled in
            const alpha = p.map(d, 200, 0, 0, 255);
            particle.display(this.color, alpha);
          }
        }
        
        display() {
           // Interest as a "supernova" burst
           if (this.channel.merit > 0.6 && p.random() < 0.1) {
                this.supernova();
           }
          
           // Boredom as a "cataract" / blur
           const blurAmount = p.map(this.channel.habituation, 0.5, 1, 0, 20);
           if (blurAmount > 1) {
               p.drawingContext.filter = `blur(${blurAmount}px)`;
           }

           const coreSize = 10 + this.channel.attention * 40;
           const coreBrightness = p.map(this.channel.habituation, 0, 1, 90, 30);
           const coreSaturation = p.map(this.channel.habituation, 0, 1, 80, 10);
           
           const coreColor = p.color(p.hue(this.color), coreSaturation, coreBrightness, 200);
           
           p.noStroke();
           p.fill(coreColor);
           p.ellipse(this.pos.x, this.pos.y, coreSize, coreSize);

           // Reset blur
           p.drawingContext.filter = 'none';
        }

        supernova() {
            for (let i = 0; i < 30; i++) {
                const angle = p.random(p.TWO_PI);
                const speed = p.random(2, 6);
                const p_ = new Particle();
                p_.pos.set(this.pos);
                p_.vel = p5.Vector.fromAngle(angle, speed);
                p_.maxSpeed = 10;
                p_.lifespan = 100;
                
                const drawParticle = () => {
                    p_.vel.mult(0.96);
                    p_.pos.add(p_.vel);
                    p_.lifespan -= 4;
                    if(p_.lifespan > 0) {
                        const alpha = p.map(p_.lifespan, 0, 100, 0, 255);
                        p.noStroke();
                        p.fill(this.color, alpha);
                        p.ellipse(p_.pos.x, p_.pos.y, 2, 2);
                        requestAnimationFrame(drawParticle);
                    }
                };
                requestAnimationFrame(drawParticle);
            }
        }
      }

      p.setup = () => {
        p.createCanvas(sketchRef.current!.offsetWidth, sketchRef.current!.offsetHeight);
        p.colorMode(p.HSB, 360, 100, 100, 255);
        p.strokeWeight(1.5);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles[i] = new Particle();
        }
        const { channels: currentChannels } = propsRef.current;
        lenses.push(...currentChannels.map((ch, i) => new Lens(ch, i, currentChannels.length)));
      };

      p.windowResized = () => {
        p.resizeCanvas(sketchRef.current!.offsetWidth, sketchRef.current!.offsetHeight);
      };

      p.draw = () => {
        p.background(95, 25, 10, 255); // Very dark green, almost black
        const { channels: currentChannels } = propsRef.current;
        
        if (lenses.length !== currentChannels.length) {
          lenses.length = 0;
          lenses.push(...currentChannels.map((ch, i) => new Lens(ch, i, currentChannels.length)));
        }

        // --- Update and draw particles (the "static")
        for (const particle of particles) {
          particle.update();
          particle.display(p.color(100, 5, 100), particle.baseAlpha); // Dim white static
        }

        // --- Update, attract, and draw lenses (the "retina")
        lenses.forEach((lens, i) => {
          lens.update(currentChannels[i]);
          particles.forEach(particle => lens.attract(particle));
          lens.display();
        });
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