import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_HP = 1000;
const ARENA_WIDTH = 900;
const ARENA_HEIGHT = 540;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const makeEnemy = (id, x, y, hero = false) => ({
  id,
  x,
  y,
  hp: hero ? 900 : 300,
  maxHp: hero ? 900 : 300,
  speed: hero ? 43 : 35,
  damage: hero ? 13 : 5,
  range: hero ? 105 : 40,
  attackCd: 1.5,
  hero,
  kind: hero ? "knight" : ["soldier", "archer", "guard"][id % 3],
  facing: Math.PI,
});

const makeGame = () => ({
  player: {
    x: 145,
    y: 270,
    hp: INITIAL_HP,
    speed: 210,
    facing: 0,
  },

  enemies: [
    makeEnemy(1, 620, 100),
    makeEnemy(2, 695, 185),
    makeEnemy(3, 620, 270),
    makeEnemy(4, 695, 355),
    makeEnemy(5, 760, 440, true),
  ],

  bullets: [],
  effects: [],
  score: 0,
  kills: 0,
  baseHp: 1800,
  cooldowns: [0, 0, 0],
  attackCd: 0,
  running: true,
  time: 0,
});

export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(makeGame());
  const keysRef = useRef({});
  const joystickRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef(null);

  const [version, setVersion] = useState(0);

  const [hud, setHud] = useState({
    hp: INITIAL_HP,
    score: 0,
    kills: 0,
    baseHp: 1800,
    cooldowns: [0, 0, 0],
    running: true,
  });

  const restart = useCallback(() => {
    gameRef.current = makeGame();
    keysRef.current = {};
    joystickRef.current = { x: 0, y: 0 };
    targetRef.current = null;

    setHud({
      hp: INITIAL_HP,
      score: 0,
      kills: 0,
      baseHp: 1800,
      cooldowns: [0, 0, 0],
      running: true,
    });

    setVersion((value) => value + 1);
  }, []);

  const attack = useCallback(() => {
    const game = gameRef.current;
    const player = game.player;

    if (!game.running || game.attackCd > 0) return;

    const enemies = game.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.y - player.y) -
          Math.hypot(b.x - player.x, b.y - player.y),
      );

    const target = enemies[0];

    if (!target) {
      if (Math.hypot(ARENA_WIDTH - 48 - player.x, 270 - player.y) < 150) {
        game.baseHp = Math.max(0, game.baseHp - 100);

        game.effects.push({
          x: 852,
          y: 270,
          radius: 42,
          life: 0.35,
          color: "#ffe08a",
        });
      }

      game.attackCd = 0.3;
      return;
    }

    const distance = Math.hypot(target.x - player.x, target.y - player.y);

    if (distance > 250) {
      targetRef.current = {
        x: target.x,
        y: target.y,
      };
      return;
    }

    player.facing =
      Math.atan2(target.y - player.y, target.x - player.x) + Math.PI / 2;

    game.bullets.push({
      x: player.x,
      y: player.y,
      target,
      speed: 570,
      damage: 110,
      life: 1.4,
      color: "#ffe08a",
    });

    game.attackCd = 0.3;
  }, []);

  const skill = useCallback((index) => {
    const game = gameRef.current;
    const player = game.player;

    if (!game.running || game.cooldowns[index] > 0) {
      return;
    }

    const enemies = game.enemies.filter((enemy) => enemy.hp > 0);

    if (index === 0) {
      const target = enemies
        .filter(
          (enemy) => Math.hypot(enemy.x - player.x, enemy.y - player.y) < 420,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - player.x, a.y - player.y) -
            Math.hypot(b.x - player.x, b.y - player.y),
        )[0];

      if (target) {
        game.bullets.push({
          x: player.x,
          y: player.y,
          target,
          speed: 850,
          damage: 270,
          life: 1.5,
          color: "#5ceaff",
        });
      }

      game.cooldowns[0] = 4;
    }

    if (index === 1) {
      enemies.forEach((enemy) => {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);

        if (distance < 155) {
          enemy.hp -= 230;
        }
      });

      game.effects.push({
        x: player.x,
        y: player.y,
        radius: 155,
        life: 0.7,
        color: "#b88aff",
      });

      game.cooldowns[1] = 7;
    }

    if (index === 2) {
      enemies.forEach((enemy) => {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);

        if (distance < 310) {
          enemy.hp -= 420;
        }
      });

      game.effects.push({
        x: player.x,
        y: player.y,
        radius: 310,
        life: 0.9,
        color: "#ff719c",
      });

      game.cooldowns[2] = 15;
    }
  }, []);

  // Canvas drawing and gameplay logic will continue
  // in Part 2.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    let raf = 0;
    let last = 0;
    let hudClock = 0;
    let disposed = false;

    const down = (event) => {
      const key = event.key.toLowerCase();
      keysRef.current[key] = true;

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      ) {
        event.preventDefault();
      }

      if (key === "j" || key === " ") attack();
      if (key === "q") skill(0);
      if (key === "e") skill(1);
      if (key === "r") skill(2);

      if (key === "p") {
        const game = gameRef.current;
        game.paused = !game.paused;
      }
    };

    const up = (event) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };

    const blur = () => {
      keysRef.current = {};
      joystickRef.current = { x: 0, y: 0 };
    };

    const circle = (x, y, radius, color, stroke = false, lineWidth = 2) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);

      if (stroke) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    };

    const bar = (x, y, width, hp, maxHp, color) => {
      ctx.fillStyle = "#101721";
      ctx.fillRect(x, y, width, 6);

      ctx.fillStyle = color;
      ctx.fillRect(x, y, width * clamp(hp / maxHp, 0, 1), 6);

      ctx.strokeStyle = "#ffffff55";
      ctx.lineWidth = 0.7;
      ctx.strokeRect(x, y, width, 6);
    };

    const drawHuman = ({
      x,
      y,
      facing = 0,
      team = "blue",
      kind = "soldier",
      hero = false,
      time = 0,
      attacking = false,
    }) => {
      const blue = team === "blue";
      const armor = blue ? "#159ac7" : "#c93658";
      const armorLight = blue ? "#65e8ff" : "#ff8298";
      const armorDark = blue ? "#12516e" : "#70243c";
      const skin = "#e8b18a";
      const skinDark = "#b87858";
      const cloth = blue ? "#183e67" : "#4a2034";
      const metal = "#d8e6ed";
      const scale = hero ? 1.13 : 0.86;
      const walking = Math.sin(time * 11 + x * 0.05) * 2.2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(facing);
      ctx.scale(scale, scale);

      // Shadow
      ctx.fillStyle = "#06120dbb";
      ctx.beginPath();
      ctx.ellipse(1, 7, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = armorDark;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.lineTo(-6 + walking, 13);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(5, 4);
      ctx.lineTo(6 - walking, 13);
      ctx.stroke();

      // Boots
      ctx.fillStyle = "#192a3a";

      ctx.beginPath();
      ctx.ellipse(-6 + walking, 15, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(6 - walking, 15, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cape
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(-8, -7);
      ctx.lineTo(0, 2);
      ctx.lineTo(9, -7);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 12);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();

      // Arms
      ctx.strokeStyle = skinDark;
      ctx.lineWidth = 6;

      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(-13, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.lineTo(13, -1);
      ctx.stroke();

      // Shoulder armor
      circle(-9, -7, 4, armorLight);
      circle(9, -7, 4, armorLight);

      // Chest armor
      ctx.fillStyle = armorDark;
      ctx.beginPath();
      ctx.moveTo(-8, -9);
      ctx.lineTo(8, -9);
      ctx.lineTo(7, 3);
      ctx.lineTo(0, 7);
      ctx.lineTo(-7, 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = armor;
      ctx.beginPath();
      ctx.moveTo(-6, -9);
      ctx.lineTo(6, -9);
      ctx.lineTo(5, 2);
      ctx.lineTo(0, 4);
      ctx.lineTo(-5, 2);
      ctx.closePath();
      ctx.fill();

      // Chest emblem
      ctx.fillStyle = hero ? "#fff0a5" : metal;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(3, -3);
      ctx.lineTo(0, 0);
      ctx.lineTo(-3, -3);
      ctx.closePath();
      ctx.fill();

      // Neck and face
      ctx.fillStyle = skinDark;
      ctx.fillRect(-2.5, -13, 5, 5);
      circle(0, -17, 7, skin);
      circle(-6, -17, 2, skinDark);
      circle(6, -17, 2, skinDark);

      // Helmet
      if (kind === "knight" || hero) {
        ctx.fillStyle = armorDark;
        ctx.beginPath();
        ctx.arc(0, -19, 8, Math.PI, Math.PI * 2);
        ctx.lineTo(7, -15);
        ctx.lineTo(3, -18);
        ctx.lineTo(0, -15);
        ctx.lineTo(-7, -15);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = armorLight;
        ctx.beginPath();
        ctx.moveTo(0, -29);
        ctx.lineTo(4, -21);
        ctx.lineTo(-3, -21);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = blue ? "#35271f" : "#2b1723";
        ctx.beginPath();
        ctx.arc(0, -19, 7, Math.PI, Math.PI * 2);
        ctx.lineTo(7, -16);
        ctx.lineTo(4, -12);
        ctx.lineTo(-5, -13);
        ctx.lineTo(-7, -16);
        ctx.closePath();
        ctx.fill();
      }

      // Eyes
      ctx.fillStyle = "#32221c";
      ctx.fillRect(-4, -18, 2.2, 1.5);
      ctx.fillRect(2, -18, 2.2, 1.5);

      // Weapon
      if (kind === "archer") {
        ctx.strokeStyle = metal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(16, -3, 7, -1.3, 1.3);
        ctx.stroke();

        ctx.strokeStyle = armorLight;
        ctx.beginPath();
        ctx.moveTo(15, -9);
        ctx.lineTo(15, 3);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#6c4630";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(13, -2);
        ctx.lineTo(17, -8);
        ctx.stroke();

        ctx.strokeStyle = metal;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(17, -8);
        ctx.lineTo(22, -17);
        ctx.stroke();

        ctx.strokeStyle = armorLight;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(18, -10);
        ctx.lineTo(23, -18);
        ctx.stroke();
      }

      // Shield
      if (kind === "knight") {
        ctx.fillStyle = armorDark;
        ctx.beginPath();
        ctx.moveTo(-14, -9);
        ctx.lineTo(-20, -7);
        ctx.lineTo(-19, 2);
        ctx.lineTo(-14, 7);
        ctx.lineTo(-10, 1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = armorLight;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Attack slash
      if (attacking) {
        ctx.strokeStyle = "#fff0a5";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -2, 24, -1.2, 0.7);
        ctx.stroke();
      }

      // Player selection ring
      if (blue && hero) {
        ctx.strokeStyle = "#6cf3ff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 3, 17, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Drawing and update functions continue in Part 3.
    const draw = (game) => {
      const W = ARENA_WIDTH;
      const H = ARENA_HEIGHT;

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1d443b");
      bg.addColorStop(1, "#102d30");

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Jungle terrain
      for (let x = 15; x < W; x += 65) {
        for (let y = 15; y < H; y += 65) {
          ctx.fillStyle = ((x + y) / 10) % 2 ? "#254d3d" : "#214637";

          ctx.fillRect(x, y, 48, 45);
        }
      }

      // Main battle lane
      ctx.lineCap = "round";
      ctx.strokeStyle = "#66766a";
      ctx.lineWidth = 98;
      ctx.beginPath();
      ctx.moveTo(30, 270);
      ctx.lineTo(870, 270);
      ctx.stroke();

      // Lane markings
      ctx.strokeStyle = "#9eaa8c";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 15]);
      ctx.beginPath();
      ctx.moveTo(25, 270);
      ctx.lineTo(875, 270);
      ctx.stroke();
      ctx.setLineDash([]);

      // River
      ctx.strokeStyle = "#347c7c";
      ctx.lineWidth = 31;
      ctx.beginPath();
      ctx.moveTo(410, 0);
      ctx.lineTo(450, 135);
      ctx.lineTo(400, 270);
      ctx.lineTo(450, 405);
      ctx.lineTo(420, 540);
      ctx.stroke();

      // Jungle trees
      const trees = [
        [75, 85],
        [160, 445],
        [320, 80],
        [320, 450],
        [520, 80],
        [550, 455],
        [780, 90],
        [780, 450],
      ];

      for (const [x, y] of trees) {
        circle(x, y, 23, "#102f29");
        circle(x - 4, y - 4, 16, "#37724e");
        circle(x - 9, y - 9, 5, "#4b8d5a");
      }

      // Allied base
      circle(48, 270, 30, "#12374b");
      circle(48, 270, 24, "#44dfff", true, 4);
      circle(48, 270, 13, "#e9ffff");
      bar(18, 232, 60, 1800, 1800, "#51eaff");

      // Enemy base
      circle(852, 270, 30, "#4c2036");
      circle(852, 270, 24, "#ff6f90", true, 4);
      circle(852, 270, 13, "#fff0f5");
      bar(822, 232, 60, game.baseHp, 1800, "#ff6f90");

      // Defensive towers
      for (const [x, color] of [
        [260, "#4deaff"],
        [640, "#ff718d"],
      ]) {
        circle(x, 270, 24, "#142c33");
        circle(x, 270, 18, color, true, 4);
        circle(x, 270, 9, "#dbefff");
        circle(x, 270, 4, color);
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("ALLY BASE", 20, 216);
      ctx.fillText("ENEMY BASE", 815, 216);

      // Ability effects
      for (const effect of game.effects) {
        ctx.globalAlpha = clamp(effect.life * 1.6, 0, 0.85);

        circle(
          effect.x,
          effect.y,
          effect.radius * (1.05 - effect.life * 0.2),
          effect.color,
          true,
          4,
        );
      }

      ctx.globalAlpha = 1;

      // Projectiles
      for (const bullet of game.bullets) {
        circle(bullet.x, bullet.y, 5, bullet.color);
        circle(bullet.x, bullet.y, 9, bullet.color, true, 1);
      }

      // Enemy units
      for (const enemy of game.enemies) {
        if (enemy.hp <= 0) continue;

        drawHuman({
          x: enemy.x,
          y: enemy.y,
          facing: enemy.facing,
          team: "red",
          kind: enemy.kind,
          hero: enemy.hero,
          time: game.time,
          attacking: enemy.attackCd < 0.18,
        });

        bar(
          enemy.x - (enemy.hero ? 24 : 18),
          enemy.y - 38,
          enemy.hero ? 48 : 36,
          enemy.hp,
          enemy.maxHp,
          "#ff6482",
        );

        if (enemy.hero) {
          ctx.fillStyle = "#ffe3eb";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("ENEMY HERO", enemy.x, enemy.y - 44);
          ctx.textAlign = "left";
        }
      }

      // Player hero
      const player = game.player;

      drawHuman({
        x: player.x,
        y: player.y,
        facing: player.facing,
        team: "blue",
        kind: "knight",
        hero: true,
        time: game.time,
        attacking: game.attackCd > 0.18,
      });

      bar(player.x - 25, player.y - 39, 50, player.hp, INITIAL_HP, "#49eac0");

      ctx.fillStyle = "#c9faff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("YOU · NOVA", player.x, player.y - 46);
      ctx.textAlign = "left";

      // Movement target indicator
      if (targetRef.current) {
        circle(
          targetRef.current.x,
          targetRef.current.y,
          13,
          "#ffffff",
          true,
          2,
        );
      }

      // Victory / defeat overlay
      if (!game.running) {
        ctx.fillStyle = "#07101ddd";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.font = "bold 39px system-ui";
        ctx.fillStyle = game.baseHp <= 0 ? "#5ceaff" : "#ff7894";

        ctx.fillText(game.baseHp <= 0 ? "VICTORY!" : "DEFEAT", W / 2, 250);

        ctx.font = "16px system-ui";
        ctx.fillStyle = "#ffffff";

        ctx.fillText(
          game.baseHp <= 0 ? "Enemy base destroyed" : "Your hero was defeated",
          W / 2,
          284,
        );

        ctx.textAlign = "left";
      }

      // Pause overlay
      if (game.paused && game.running) {
        ctx.fillStyle = "#07101dbb";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px system-ui";
        ctx.fillText("PAUSED", W / 2, H / 2);

        ctx.font = "14px system-ui";
        ctx.fillText("Press P to resume", W / 2, H / 2 + 30);

        ctx.textAlign = "left";
      }
    };

    // Gameplay update function continues in Part 4.
    const update = (dt) => {
      const game = gameRef.current;

      if (!game.running || game.paused) return;

      game.time += dt;
      game.attackCd = Math.max(0, game.attackCd - dt);

      game.cooldowns = game.cooldowns.map((cooldown) =>
        Math.max(0, cooldown - dt),
      );

      const player = game.player;
      const keys = keysRef.current;
      const joystick = joystickRef.current;

      // Keyboard and mobile joystick movement
      let dx =
        Number(Boolean(keys.d || keys.arrowright)) -
        Number(Boolean(keys.a || keys.arrowleft)) +
        joystick.x;

      let dy =
        Number(Boolean(keys.s || keys.arrowdown)) -
        Number(Boolean(keys.w || keys.arrowup)) +
        joystick.y;

      let length = Math.hypot(dx, dy);

      if (length > 1) {
        dx /= length;
        dy /= length;
      }

      if (length > 0.1) {
        player.facing = Math.atan2(dy, dx) + Math.PI / 2;
        targetRef.current = null;
      }

      // Click-to-move
      if (targetRef.current && length < 0.1) {
        const target = targetRef.current;
        const tx = target.x - player.x;
        const ty = target.y - player.y;
        const distance = Math.hypot(tx, ty);

        if (distance < 12) {
          targetRef.current = null;
        } else {
          dx = tx / distance;
          dy = ty / distance;

          player.facing = Math.atan2(dy, dx) + Math.PI / 2;
        }
      }

      player.x = clamp(player.x + dx * player.speed * dt, 25, 875);

      player.y = clamp(player.y + dy * player.speed * dt, 35, 505);

      // Enemy AI
      for (const enemy of game.enemies) {
        if (enemy.hp <= 0) continue;

        enemy.attackCd -= dt;

        const tx = player.x - enemy.x;
        const ty = player.y - enemy.y;
        const distance = Math.hypot(tx, ty) || 1;

        enemy.facing = Math.atan2(ty, tx) + Math.PI / 2;

        if (distance > enemy.range) {
          enemy.x += (tx / distance) * enemy.speed * dt;
          enemy.y += (ty / distance) * enemy.speed * dt;
        } else if (enemy.attackCd <= 0) {
          player.hp = Math.max(0, player.hp - enemy.damage);

          enemy.attackCd = enemy.hero ? 1.4 : 1.8;

          game.effects.push({
            x: player.x,
            y: player.y,
            radius: 25,
            life: 0.25,
            color: "#ff607d",
          });
        }
      }

      // Remove defeated enemies and award score once
      const survivors = [];

      for (const enemy of game.enemies) {
        if (enemy.hp <= 0) {
          game.score += enemy.hero ? 100 : 20;
          game.kills += 1;
        } else {
          survivors.push(enemy);
        }
      }

      game.enemies = survivors;

      // Spawn replacement soldiers every five seconds
      if (Math.floor(game.time / 5) !== Math.floor((game.time - dt) / 5)) {
        const minions = game.enemies.filter((enemy) => !enemy.hero).length;

        if (minions < 5) {
          const id = Math.floor(Math.random() * 100000);

          game.enemies.push(makeEnemy(id, 710, 145 + Math.random() * 250));
        }
      }

      // Update homing projectiles
      for (const bullet of game.bullets) {
        bullet.life -= dt;

        const target = bullet.target;

        if (target && target.hp > 0) {
          const tx = target.x - bullet.x;
          const ty = target.y - bullet.y;
          const distance = Math.hypot(tx, ty) || 1;
          const step = bullet.speed * dt;

          if (distance < step + 13) {
            target.hp -= bullet.damage;
            bullet.life = 0;

            game.effects.push({
              x: target.x,
              y: target.y,
              radius: 22,
              life: 0.25,
              color: bullet.color,
            });
          } else {
            bullet.x += (tx / distance) * step;
            bullet.y += (ty / distance) * step;
          }
        } else {
          bullet.life = 0;
        }
      }

      game.bullets = game.bullets.filter((bullet) => bullet.life > 0);

      // Update visual effects
      for (const effect of game.effects) {
        effect.life -= dt;
      }

      game.effects = game.effects.filter((effect) => effect.life > 0);

      // End the battle
      if (player.hp <= 0 || game.baseHp <= 0) {
        game.running = false;
      }
    };

    // Animation loop
    const frame = (now) => {
      if (disposed) return;

      const dt = last ? Math.min((now - last) / 1000, 0.035) : 0;

      last = now;

      update(dt);
      draw(gameRef.current);

      hudClock += dt;

      if (hudClock > 0.12) {
        hudClock = 0;

        const game = gameRef.current;

        setHud({
          hp: Math.round(game.player.hp),
          score: game.score,
          kills: game.kills,
          baseHp: Math.round(game.baseHp),
          cooldowns: [...game.cooldowns],
          running: game.running,
          paused: Boolean(game.paused),
        });
      }

      raf = requestAnimationFrame(frame);
    };

    // Click the arena to move
    const clickCanvas = (event) => {
      const rect = canvas.getBoundingClientRect();

      targetRef.current = {
        x: clamp(
          ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH,
          25,
          875,
        ),

        y: clamp(
          ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
          35,
          505,
        ),
      };
    };

    canvas.addEventListener("click", clickCanvas);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;

      cancelAnimationFrame(raf);
      canvas.removeEventListener("click", clickCanvas);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [version, attack, skill]);
  const moveJoystick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const dx = (x - 0.5) * 2;
    const dy = (y - 0.5) * 2;
    const length = Math.hypot(dx, dy) || 1;

    joystickRef.current = {
      x: clamp(dx / length, -1, 1),
      y: clamp(dy / length, -1, 1),
    };
  };

  const stopJoystick = () => {
    joystickRef.current = { x: 0, y: 0 };
  };

  const togglePause = () => {
    const game = gameRef.current;
    if (game.running) game.paused = !game.paused;

    setHud((current) => ({
      ...current,
      paused: Boolean(game.paused),
    }));
  };

  return (
    <main className="game-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #080e18;
          color: #edf5ff;
          font-family: 'Inter', sans-serif;
        }

        button {
          font: inherit;
          cursor: pointer;
        }

        .game-shell {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(ellipse at top, #17283b 0%, #080e18 60%);
        }

        .game-container {
          width: min(1200px, 100%);
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .brand-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border: 1px solid #39d9f677;
          border-radius: 14px;
          background: #102b3a;
          color: #62edff;
          font-size: 25px;
          box-shadow: 0 0 28px #31dff51a;
        }

        .brand h1 {
          margin: 0;
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(18px, 3vw, 27px);
          letter-spacing: 2px;
        }

        .brand h1 span {
          color: #5de7ff;
        }

        .subtitle {
          margin: 6px 0 0;
          color: #8295ac;
          font-size: 12px;
          letter-spacing: 2px;
        }

        .status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1px solid #28463e;
          border-radius: 999px;
          background: #10251f;
          color: #7ef0b5;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #56f2a3;
          box-shadow: 0 0 12px #56f2a3;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          padding: 17px;
          border: 1px solid #253348;
          border-radius: 14px;
          background: linear-gradient(135deg, #142132, #0e1724);
        }

        .stat-label {
          color: #8295ac;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .stat-value {
          margin-top: 8px;
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(17px, 3vw, 25px);
          font-weight: 700;
        }

        .cyan { color: #62e9ff; }
        .green { color: #6bf0b1; }
        .red { color: #ff718e; }
        .gold { color: #ffdc7b; }

        .arena-card {
          overflow: hidden;
          border: 1px solid #2a3c50;
          border-radius: 18px;
          background: #0e1724;
          box-shadow: 0 18px 60px #0005;
        }

        .arena-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: 1px solid #243348;
        }

        .arena-heading {
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .arena-hint {
          color: #8497ad;
          font-size: 11px;
        }

        .canvas-wrap {
          position: relative;
          width: 100%;
          background: #15392f;
        }

        .game-canvas {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 5 / 3;
          cursor: crosshair;
          touch-action: manipulation;
        }

        .arena-footer {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 18px;
          border-top: 1px solid #243348;
          color: #8da0b7;
          font-size: 11px;
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }

        .control-panel {
          padding: 18px;
          border: 1px solid #253348;
          border-radius: 16px;
          background: #101a28;
        }

        .section-title {
          margin: 0 0 14px;
          color: #91a5bc;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.6px;
        }

        .skill-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .skill-button {
          min-height: 88px;
          padding: 12px 8px;
          border: 1px solid #30465d;
          border-radius: 12px;
          background: #172638;
          color: #eef8ff;
          text-align: left;
          transition: 0.2s ease;
        }

        .skill-button:hover:not(:disabled) {
          border-color: #5ceaff;
          background: #1b3448;
          transform: translateY(-2px);
        }

        .skill-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .skill-key {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          margin-bottom: 10px;
          border: 1px solid #3c607a;
          border-radius: 6px;
          color: #65eaff;
          font-family: 'Orbitron', sans-serif;
          font-size: 11px;
        }

        .skill-name {
          font-size: 11px;
          font-weight: 800;
        }

        .skill-cd {
          margin-top: 5px;
          color: #8da0b7;
          font-size: 10px;
        }

        .action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .action-button {
          flex: 1;
          min-width: 100px;
          padding: 12px 14px;
          border: 1px solid #344a60;
          border-radius: 10px;
          background: #172638;
          color: #edf5ff;
          font-size: 12px;
          font-weight: 800;
          transition: 0.2s ease;
        }

        .action-button:hover {
          border-color: #5ceaff;
        }

        .attack-button {
          border-color: #2088a1;
          background: linear-gradient(135deg, #11627a, #16445d);
          color: #bdf8ff;
        }

        .restart-button {
          border-color: #3a6753;
          background: #153326;
          color: #91ffc7;
        }

        .health-track {
          height: 7px;
          overflow: hidden;
          margin-top: 10px;
          border-radius: 999px;
          background: #283749;
        }

        .health-fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.15s linear;
        }

        .mobile-pad {
          display: none;
        }

        .help-text {
          margin: 14px 0 0;
          color: #71869d;
          font-size: 11px;
          line-height: 1.8;
        }

        @media (max-width: 700px) {
          .game-shell {
            padding: 14px 10px;
          }

          .topbar {
            align-items: flex-start;
          }

          .brand-icon {
            width: 40px;
            height: 40px;
          }

          .status-pill {
            padding: 8px 10px;
            font-size: 9px;
          }

          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .stat-card {
            padding: 12px;
          }

          .arena-header {
            padding: 12px;
          }

          .arena-hint {
            display: none;
          }

          .controls {
            grid-template-columns: 1fr;
          }

          .skill-button {
            min-height: 76px;
          }

          .mobile-pad {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            margin-top: 14px;
          }

          .pad-button {
            width: 70px;
            height: 70px;
            border: 1px solid #31516a;
            border-radius: 50%;
            background: #14273a;
            color: #74edff;
            font-size: 23px;
            touch-action: none;
            user-select: none;
          }

          .pad-button:active {
            background: #1c4359;
          }

          .mobile-note {
            color: #8295ac;
            font-size: 10px;
            text-align: center;
          }
        }
      `}</style>

      <div className="game-container">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">⚔</div>

            <div>
              <h1>
                NOVA <span>STRIKE</span>
              </h1>
              <p className="subtitle">TACTICAL ARENA · SEASON 01</p>
            </div>
          </div>

          <div className="status-pill">
            <span className="status-dot" />
            {hud.running
              ? hud.paused
                ? "PAUSED"
                : "LIVE MATCH"
              : "MATCH ENDED"}
          </div>
        </header>

        <section className="stats">
          <div className="stat-card">
            <div className="stat-label">HERO HEALTH</div>
            <div className="stat-value green">
              {hud.hp} <span style={{ fontSize: 12 }}>/ 1000</span>
            </div>
            <div className="health-track">
              <div
                className="health-fill"
                style={{
                  width: `${(hud.hp / INITIAL_HP) * 100}%`,
                  background: "#6bf0b1",
                }}
              />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">TOTAL SCORE</div>
            <div className="stat-value gold">{hud.score}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">ENEMY KILLS</div>
            <div className="stat-value cyan">{hud.kills}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">ENEMY BASE</div>
            <div className="stat-value red">
              {hud.baseHp} <span style={{ fontSize: 12 }}>/ 1800</span>
            </div>
            <div className="health-track">
              <div
                className="health-fill"
                style={{
                  width: `${(hud.baseHp / 1800) * 100}%`,
                  background: "#ff718e",
                }}
              />
            </div>
          </div>
        </section>

        <section className="arena-card">
          <div className="arena-header">
            <div className="arena-heading">⚡ BATTLE ARENA</div>
            <div className="arena-hint">
              Click on the map to move · WASD / Arrow keys
            </div>
          </div>

          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={ARENA_WIDTH}
              height={ARENA_HEIGHT}
            />
          </div>

          <div className="arena-footer">
            <span>🔵 ALLIED BASE</span>
            <span>⚔ ELIMINATE ENEMIES</span>
            <span>🔴 DESTROY ENEMY BASE</span>
          </div>
        </section>

        <section className="controls">
          <div className="control-panel">
            <h2 className="section-title">SPECIAL ABILITIES</h2>

            <div className="skill-row">
              <button
                className="skill-button"
                disabled={!hud.running || hud.cooldowns[0] > 0}
                onClick={() => skill(0)}
              >
                <span className="skill-key">Q</span>
                <div className="skill-name">ARC SHOT</div>
                <div className="skill-cd">
                  {hud.cooldowns[0] > 0
                    ? `${hud.cooldowns[0].toFixed(1)}s`
                    : "READY"}
                </div>
              </button>

              <button
                className="skill-button"
                disabled={!hud.running || hud.cooldowns[1] > 0}
                onClick={() => skill(1)}
              >
                <span className="skill-key">E</span>
                <div className="skill-name">NOVA BURST</div>
                <div className="skill-cd">
                  {hud.cooldowns[1] > 0
                    ? `${hud.cooldowns[1].toFixed(1)}s`
                    : "READY"}
                </div>
              </button>

              <button
                className="skill-button"
                disabled={!hud.running || hud.cooldowns[2] > 0}
                onClick={() => skill(2)}
              >
                <span className="skill-key">R</span>
                <div className="skill-name">ULTIMATE</div>
                <div className="skill-cd">
                  {hud.cooldowns[2] > 0
                    ? `${hud.cooldowns[2].toFixed(1)}s`
                    : "READY"}
                </div>
              </button>
            </div>

            <div className="action-row">
              <button
                className="action-button attack-button"
                disabled={!hud.running}
                onClick={attack}
              >
                ⚔ ATTACK [J]
              </button>

              <button
                className="action-button"
                disabled={!hud.running}
                onClick={togglePause}
              >
                {hud.paused ? "▶ RESUME [P]" : "Ⅱ PAUSE [P]"}
              </button>

              <button
                className="action-button restart-button"
                onClick={restart}
              >
                ↻ RESTART
              </button>
            </div>
          </div>

          <div className="control-panel">
            <h2 className="section-title">MISSION OBJECTIVE</h2>

            <div style={{ fontSize: 14, fontWeight: 800 }}>
              Destroy the enemy base
            </div>

            <p className="help-text">
              Defeat enemy soldiers and their hero. Use your special abilities
              to deal area damage. Keep your hero alive while pushing towards
              the enemy base.
            </p>

            <div className="mobile-pad">
              <button
                className="pad-button"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  joystickRef.current = { x: -1, y: 0 };
                }}
                onPointerUp={stopJoystick}
                onPointerCancel={stopJoystick}
                onLostPointerCapture={stopJoystick}
                aria-label="Move left"
              >
                ←
              </button>

              <div className="mobile-note">HOLD TO MOVE</div>

              <button
                className="pad-button"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  joystickRef.current = { x: 1, y: 0 };
                }}
                onPointerUp={stopJoystick}
                onPointerCancel={stopJoystick}
                onLostPointerCapture={stopJoystick}
                aria-label="Move right"
              >
                →
              </button>
            </div>

            <p className="help-text">
              Desktop: WASD or arrow keys to move, click map to travel, J or
              Space to attack, Q / E / R for abilities, P to pause.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
