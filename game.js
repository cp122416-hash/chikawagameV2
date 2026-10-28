// game.js — 치이카와 합치기 (1~10단계, 맵 15% 확장, 우사기 1단계 / 치이카와 3단계)
'use strict';

(function () {
  // ─── 맵 크기 및 경계 설정 ────────────────────────────────
  // 기존: W=400, H=640, 내부 너비=360px, 쌓기 높이(위험선~바닥)=540px
  // 변경: W=460, H=720, 내부 너비=414px (+15.0%), 쌓기 높이=620px (+14.8%)
  const W = 460;
  const H = 720;
  const WALL_PHYSICS_T = 80;    // 바디 뚫림 방지용 두꺼운 물리 벽 두께
  const WALL_VIS_W = 23;        // 시각적 벽 두께 (좌우 각각 23px)
  const DROP_ZONE_H = 80;       // 상단 낙하 대기 영역 높이
  const DANGER_Y = 100;         // 위험선 Y (낙하 대기 공간은 최대 3단계 치이카와 r=32 대기 가능)
  const DANGER_DURATION = 2000; // 게임 오버까지 연속 위험 시간 ms
  const DROP_GRACE = 1000;      // 낙하 후 위험 판정 유예 ms
  const DROP_COOLDOWN = 500;
  const FIXED_DT = 1000 / 60;
  const MAX_DT = 200;
  const SPAWN_LEVELS = [1, 2, 3];
  const MERGE_SCORES = {
    2: 10,
    3: 20,
    4: 40,
    5: 80,
    6: 160,
    7: 320,
    8: 640,
    9: 1280,
    10: 2560,
  };
  const ANOC_MERGE_SCORE = 5120;
  const MAX_LEVEL = 10;
  const STORAGE_KEY = 'chiikawa_merge_highscore';

  // 통일된 상자 내부 물리/표시 경계
  const BOX_LEFT = WALL_VIS_W;        // 23
  const BOX_RIGHT = W - WALL_VIS_W;   // 437 (내부 너비: 414px)
  const BOX_BOTTOM = H;               // 720 (쌓기 높이: 720 - 100 = 620px)

  // ─── Matter.js 별칭 ───────────────────────────────────────
  const { Engine, World, Bodies, Body, Events } = Matter;

  // ─── DOM ─────────────────────────────────────────────────
  const canvas          = document.getElementById('canvas-main');
  const ctx             = canvas.getContext('2d');
  const cvNext          = document.getElementById('cv-next');
  const ctxNext         = cvNext.getContext('2d');
  const guideContainer  = document.getElementById('guide-container');
  const wrapper         = document.getElementById('game-wrapper');
  const scoreValueEl    = document.getElementById('score-value');
  const bestValueEl     = document.getElementById('best-value');
  const overlayStart    = document.getElementById('overlay-start');
  const overlayGameover = document.getElementById('overlay-gameover');
  const goScoreEl       = document.getElementById('go-score');
  const goBestMergeEl   = document.getElementById('go-best-merge');
  const goHighscoreEl   = document.getElementById('go-highscore');
  const btnStart        = document.getElementById('btn-start');
  const btnRestart      = document.getElementById('btn-restart');
  const btnMute         = document.getElementById('btn-mute');
  const volSlider       = document.getElementById('vol-slider');

  // ─── 사운드 관리자 ───────────────────────────────────────
  const soundManager = {
    isMuted: false,
    volume: 0.3,
    voiceQueue: [], // 최대 2개 동시 재생 { audio, isVoice }

    init() {
      btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMute();
      });
      volSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        this.setVolume(parseFloat(e.target.value));
      });
      ['pointerdown', 'touchstart', 'click'].forEach(evt => {
        btnMute.addEventListener(evt, e => e.stopPropagation());
        volSlider.addEventListener(evt, e => e.stopPropagation());
      });
    },

    toggleMute() {
      this.isMuted = !this.isMuted;
      btnMute.textContent = this.isMuted ? '🔇' : '🔊';
      this.voiceQueue.forEach(item => {
        item.audio.volume = this.isMuted ? 0 : this.volume;
      });
    },

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      if (this.isMuted && this.volume > 0) {
        this.isMuted = false;
        btnMute.textContent = '🔊';
      }
      this.voiceQueue.forEach(item => {
        item.audio.volume = this.isMuted ? 0 : this.volume;
      });
    },

    playAudio(src, isVoice = true) {
      if (!src) return null;
      try {
        const audio = new Audio(src);
        audio.volume = this.isMuted ? 0 : this.volume;

        if (isVoice) {
          if (this.voiceQueue.length >= 2) {
            const oldest = this.voiceQueue.shift();
            try {
              oldest.audio.pause();
              oldest.audio.currentTime = 0;
            } catch (_) {}
          }
          this.voiceQueue.push({ audio, isVoice });
        }

        audio.addEventListener('ended', () => {
          this.voiceQueue = this.voiceQueue.filter(item => item.audio !== audio);
        });
        audio.addEventListener('error', () => {
          this.voiceQueue = this.voiceQueue.filter(item => item.audio !== audio);
        });

        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
        return audio;
      } catch (_) {
        return null;
      }
    },

    playLevelVoice(level) {
      const char = charData(level);
      const src = char.soundPath || 'assets/audio/merge.wav';
      this.playAudio(src, true);
    },

    playGulp() {
      this.playAudio('assets/audio/gulp.wav', false);
    },

    stopVoicesOnly() {
      this.voiceQueue.forEach(item => {
        try {
          item.audio.pause();
          item.audio.currentTime = 0;
        } catch (_) {}
      });
      this.voiceQueue = [];
    },

    stopAll() {
      this.stopVoicesOnly();
    }
  };

  // ─── 이미지 캐시 ─────────────────────────────────────────
  const imageCache = new Map();

  function initImageCache() {
    CHARACTERS.forEach(char => {
      const img = new Image();
      img.src = char.image;
      img._loaded = false;
      img._failed = false;
      img.onload = () => {
        img._loaded = true;
        renderGuideBadges();
        updateUI();
      };
      img.onerror = () => {
        img._failed = true;
        renderGuideBadges();
        updateUI();
      };
      imageCache.set(char.level, img);
    });
  }

  // ─── 최고 점수 로컬 저장 ─────────────────────────────────
  let highScore = 0;

  function loadHighScore() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val !== null) highScore = parseInt(val, 10) || 0;
    } catch (_) {
      highScore = 0;
    }
    bestValueEl.textContent = highScore;
  }

  function saveHighScore(scoreToSave) {
    if (scoreToSave > highScore) {
      highScore = scoreToSave;
      bestValueEl.textContent = highScore;
      try {
        localStorage.setItem(STORAGE_KEY, highScore.toString());
      } catch (_) {}
    }
  }

  // ─── 게임 상태 ───────────────────────────────────────────
  let gameState = 'idle'; // 'idle' | 'playing' | 'gameover'
  let engine, world;
  let nextBodyId = 0;
  let items = new Map(); // id -> { body, level, dropTime, highlightUntil }
  let mergeQueue = [];
  let mergeReserved = new Set();
  let score = 0;
  let bestMergeLevel = 0;
  let currentChar = null;
  let nextChar = null;
  let previewX = W / 2;
  let lastDropTime = 0;
  let dangerStart = null;
  let lastTimestamp = null;
  let accumulator = 0;
  let pointerDown = false;
  let pointerCancelled = false;

  // ─── 10단계 아노코 먹기 연출 상태 ────────────────────────
  let eatingAnimations = [];
  let floatingTexts = [];

  function charData(level) {
    return CHARACTERS.find(c => c.level === level) || CHARACTERS[0];
  }

  function randomSpawnChar() {
    const lvl = SPAWN_LEVELS[Math.floor(Math.random() * SPAWN_LEVELS.length)];
    return charData(lvl);
  }

  function clampX(x, radius) {
    return Math.max(BOX_LEFT + radius, Math.min(BOX_RIGHT - radius, x));
  }

  function clampMergePos(x, y, radius) {
    const cx = Math.max(BOX_LEFT + radius, Math.min(BOX_RIGHT - radius, x));
    const cy = Math.max(DROP_ZONE_H + radius, Math.min(BOX_BOTTOM - radius, y));
    return { x: cx, y: cy };
  }

  // ─── 공통 캐릭터 원형 배지 렌더링 ────────────────────────
  function drawCharacterBadge(targetCtx, char, x, y, radius, angle = 0, isHighlighted = false, customScale = 1, alpha = 1) {
    const img = imageCache.get(char.level);
    const hasImage = img && img._loaded && !img._failed;

    targetCtx.save();
    targetCtx.translate(x, y);
    if (angle) targetCtx.rotate(angle);
    if (customScale !== 1) targetCtx.scale(customScale, customScale);
    if (alpha !== 1) targetCtx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // 1. 원형 배경 배지
    targetCtx.beginPath();
    targetCtx.arc(0, 0, radius, 0, Math.PI * 2);
    targetCtx.fillStyle = char.color;
    targetCtx.fill();

    // 2. 캐릭터 이미지 (원형 클리핑 적용)
    if (hasImage) {
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.arc(0, 0, radius - 1, 0, Math.PI * 2);
      targetCtx.clip();

      const scaleRatio = char.imgScale !== undefined ? char.imgScale : 0.8;
      const targetBox = radius * 2 * scaleRatio;
      const imgAspect = img.naturalWidth / (img.naturalHeight || 1);
      let drawW, drawH;
      if (imgAspect >= 1) {
        drawW = targetBox;
        drawH = targetBox / imgAspect;
      } else {
        drawH = targetBox;
        drawW = targetBox * imgAspect;
      }

      const offsetY = (char.imgOffsetY || 0) * radius;
      targetCtx.drawImage(img, -drawW / 2, -drawH / 2 + offsetY, drawW, drawH);
      targetCtx.restore();
    } else {
      targetCtx.fillStyle = '#443328';
      const fontSize = Math.max(7, Math.floor(radius * 0.42));
      targetCtx.font = `bold ${fontSize}px sans-serif`;
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      const label = char.name.length > 3 ? char.name.slice(0, 2) : char.name;
      targetCtx.fillText(label, 0, 0);
    }

    // 3. 외곽선 (실제 충돌 범위와 100% 일치)
    targetCtx.beginPath();
    targetCtx.arc(0, 0, radius, 0, Math.PI * 2);
    if (isHighlighted) {
      targetCtx.strokeStyle = '#ffffff';
      targetCtx.lineWidth = Math.max(3, radius * 0.12);
    } else {
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      targetCtx.lineWidth = Math.max(1.5, radius * 0.05);
    }
    targetCtx.stroke();

    targetCtx.restore();
  }

  // ─── UI 갱신 ─────────────────────────────────────────────
  function updateUI() {
    scoreValueEl.textContent = score;

    ctxNext.clearRect(0, 0, 46, 46);
    if (nextChar) {
      const r = Math.min(nextChar.radius, 19);
      drawCharacterBadge(ctxNext, nextChar, 23, 23, r);
    }
  }

  // ─── 하단 1~10단계 합성 순서 가이드 (반응형 줄바꿈) ───────
  function initGuideContainer() {
    guideContainer.innerHTML = '';
    CHARACTERS.forEach((char, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'guide-item';

      const boxEl = document.createElement('div');
      boxEl.className = 'guide-badge-box';

      const cv = document.createElement('canvas');
      cv.className = 'guide-canvas';
      cv.width = 26;
      cv.height = 26;
      cv.id = `guide-cv-${char.level}`;

      const nameEl = document.createElement('span');
      nameEl.className = 'guide-name';
      nameEl.textContent = char.name;

      boxEl.appendChild(cv);
      boxEl.appendChild(nameEl);
      itemEl.appendChild(boxEl);

      if (idx < CHARACTERS.length - 1) {
        const arrowEl = document.createElement('span');
        arrowEl.className = 'guide-arrow';
        arrowEl.textContent = '›';
        itemEl.appendChild(arrowEl);
      }

      guideContainer.appendChild(itemEl);
    });
    renderGuideBadges();
  }

  function renderGuideBadges() {
    CHARACTERS.forEach(char => {
      const cv = document.getElementById(`guide-cv-${char.level}`);
      if (!cv) return;
      const gctx = cv.getContext('2d');
      gctx.clearRect(0, 0, 26, 26);
      drawCharacterBadge(gctx, char, 13, 13, 11);
    });
  }

  // ─── 물리 초기화 (통일된 상자 내부 경계 적용) ────────────
  function initPhysics() {
    engine = Engine.create({ gravity: { x: 0, y: 1.5 } });
    world = engine.world;

    const opts = { isStatic: true, friction: 0.5, restitution: 0.05, label: 'wall' };
    // 바닥: 윗면이 y = BOX_BOTTOM = H 에 정확히 위치하도록 중심 설정
    const floor = Bodies.rectangle(W / 2, BOX_BOTTOM + WALL_PHYSICS_T / 2, W * 2, WALL_PHYSICS_T, opts);
    // 좌측 벽: 우측면이 x = BOX_LEFT 에 정확히 위치하도록 중심 설정
    const wallL = Bodies.rectangle(BOX_LEFT - WALL_PHYSICS_T / 2, H / 2, WALL_PHYSICS_T, H * 2, opts);
    // 우측 벽: 좌측면이 x = BOX_RIGHT 에 정확히 위치하도록 중심 설정
    const wallR = Bodies.rectangle(BOX_RIGHT + WALL_PHYSICS_T / 2, H / 2, WALL_PHYSICS_T, H * 2, opts);
    World.add(world, [floor, wallL, wallR]);

    Events.on(engine, 'collisionStart', onCollision);
  }

  function createCharBody(level, x, y, isDropped, highlight = false) {
    const char = charData(level);
    const id = nextBodyId++;
    const body = Bodies.circle(x, y, char.radius, {
      restitution: 0.2,
      friction: 0.5,
      frictionAir: 0.01,
      density: 0.002,
      label: `char_${id}`,
    });
    body._gameId = id;
    World.add(world, body);

    const now = performance.now();
    items.set(id, {
      body,
      level,
      dropTime: isDropped ? now : null,
      highlightUntil: highlight ? now + 160 : 0,
    });
    return id;
  }

  function dropCharacter() {
    if (gameState !== 'playing' || eatingAnimations.length > 0) return;
    const now = performance.now();
    if (now - lastDropTime < DROP_COOLDOWN) return;
    lastDropTime = now;

    const char = currentChar;
    const x = clampX(previewX, char.radius);
    const y = DROP_ZONE_H - char.radius - 4;
    createCharBody(char.level, x, y, true, false);

    currentChar = nextChar;
    nextChar = randomSpawnChar();
    updateUI();
  }

  function onCollision(event) {
    if (gameState !== 'playing') return;
    for (const pair of event.pairs) {
      const bA = pair.bodyA;
      const bB = pair.bodyB;
      if (bA._gameId === undefined || bB._gameId === undefined) continue;

      const idA = bA._gameId;
      const idB = bB._gameId;
      const itA = items.get(idA);
      const itB = items.get(idB);
      if (!itA || !itB) continue;
      if (itA.level !== itB.level) continue;

      mergeQueue.push({ idA, idB });
    }
  }

  function processMergeQueue() {
    if (mergeQueue.length === 0) return;

    mergeReserved.clear();
    const toProcess = mergeQueue;
    mergeQueue = [];

    for (const { idA, idB } of toProcess) {
      if (mergeReserved.has(idA) || mergeReserved.has(idB)) continue;
      if (!items.has(idA) || !items.has(idB)) continue;

      const itA = items.get(idA);
      const itB = items.get(idB);

      if (itA.level !== itB.level) continue;

      // ─── 10단계 아노코 둘의 합성 (먹기 연출 & 소멸) ───
      if (itA.level === MAX_LEVEL) {
        mergeReserved.add(idA);
        mergeReserved.add(idB);

        soundManager.stopVoicesOnly();

        const isA_Eater = itA.body.position.y <= itB.body.position.y;
        const eaterItem = isA_Eater ? itA : itB;
        const victimItem = isA_Eater ? itB : itA;

        eatingAnimations.push({
          id: `${idA}_${idB}`,
          char: charData(MAX_LEVEL),
          eater: {
            x: eaterItem.body.position.x,
            y: eaterItem.body.position.y,
            angle: eaterItem.body.angle,
          },
          victim: {
            x: victimItem.body.position.x,
            y: victimItem.body.position.y,
            startX: victimItem.body.position.x,
            startY: victimItem.body.position.y,
            angle: victimItem.body.angle,
          },
          elapsed: 0,
          duration: 0.9,
          gulpPlayed: false,
          scoreAwarded: false,
          finished: false,
          text: '',
        });

        World.remove(world, itA.body);
        World.remove(world, itB.body);
        items.delete(idA);
        items.delete(idB);

        if (MAX_LEVEL > bestMergeLevel) bestMergeLevel = MAX_LEVEL;
        continue;
      }

      // ─── 일반 1~9단계 합성 ───
      mergeReserved.add(idA);
      mergeReserved.add(idB);

      const newLevel = itA.level + 1;
      const mx = (itA.body.position.x + itB.body.position.x) / 2;
      const my = (itA.body.position.y + itB.body.position.y) / 2;
      const newChar = charData(newLevel);
      const pos = clampMergePos(mx, my, newChar.radius);

      World.remove(world, itA.body);
      World.remove(world, itB.body);
      items.delete(idA);
      items.delete(idB);

      const newId = createCharBody(newLevel, pos.x, pos.y, false, true);
      const newBody = items.get(newId).body;
      const vx = Math.max(-5, Math.min(5, (itA.body.velocity.x + itB.body.velocity.x) / 2));
      const vy = Math.max(-5, Math.min(5, (itA.body.velocity.y + itB.body.velocity.y) / 2));
      Body.setVelocity(newBody, { x: vx, y: vy });
      Body.setAngularVelocity(newBody, 0);

      // 새 캐릭터 음성 재생
      soundManager.playLevelVoice(newLevel);

      score += MERGE_SCORES[newLevel] || 0;
      if (newLevel > bestMergeLevel) bestMergeLevel = newLevel;
      saveHighScore(score);
      updateUI();
    }
  }

  // ─── 아노코 먹기 연출 갱신 ───────────────────────────────
  function updateEatingAnimations(dtSec) {
    if (eatingAnimations.length === 0) return;

    for (let i = eatingAnimations.length - 1; i >= 0; i--) {
      const anim = eatingAnimations[i];
      anim.elapsed += dtSec;
      const t = anim.elapsed;
      const char = anim.char;
      const r = char.radius;

      // 1. 입 위치 계산 (eater 기준 회전 적용)
      const mRel = char.mouthPos || { x: 0, y: 0.15 };
      const cosA = Math.cos(anim.eater.angle);
      const sinA = Math.sin(anim.eater.angle);
      const mouthOffsetX = (mRel.x * cosA - mRel.y * sinA) * r;
      const mouthOffsetY = (mRel.x * sinA + mRel.y * cosA) * r;
      const mouthX = anim.eater.x + mouthOffsetX;
      const mouthY = anim.eater.y + mouthOffsetY;

      // 2. 0.15~0.5초: victim이 eater 입 위치로 이동하며 축소
      if (t >= 0.15 && t <= 0.5) {
        const prog = (t - 0.15) / 0.35;
        anim.victim.x = anim.victim.startX + (mouthX - anim.victim.startX) * prog;
        anim.victim.y = anim.victim.startY + (mouthY - anim.victim.startY) * prog;
        anim.text = '와앙!';
      } else if (t > 0.5) {
        anim.text = '꿀꺽!';
      }

      // 3. 약 0.5초 지점 통과 시 gulp.wav 1회 재생
      if (t >= 0.5 && !anim.gulpPlayed) {
        anim.gulpPlayed = true;
        soundManager.playGulp();
      }

      // 4. 0.9초 완료 처리
      if (t >= anim.duration) {
        if (!anim.scoreAwarded) {
          anim.scoreAwarded = true;
          score += ANOC_MERGE_SCORE;
          saveHighScore(score);
          updateUI();
          floatingTexts.push({
            text: `+${ANOC_MERGE_SCORE.toLocaleString()}`,
            x: anim.eater.x,
            y: anim.eater.y - 40,
            elapsed: 0,
            duration: 1.0,
          });
        }
        anim.finished = true;
        eatingAnimations.splice(i, 1);
      }
    }
  }

  // ─── 먹기 연출 렌더링 ────────────────────────────────────
  function drawEatingAnimations() {
    eatingAnimations.forEach(anim => {
      const t = anim.elapsed;
      const char = anim.char;
      const r = char.radius;

      let eaterScale = 1.0;
      let eaterAngle = anim.eater.angle;
      let eaterStretchX = 1.0;
      let eaterStretchY = 1.0;
      let eaterAlpha = 1.0;

      if (t <= 0.15) {
        const p = t / 0.15;
        eaterScale = 1.0 + 0.1 * p;
        eaterAngle -= 0.12 * p;
      } else if (t <= 0.5) {
        eaterScale = 1.1;
        eaterAngle -= 0.12;
      } else {
        const p = (t - 0.5) / 0.4;
        const wobble = Math.sin(p * Math.PI * 4);
        eaterStretchX = 1.0 + 0.12 * wobble;
        eaterStretchY = 1.0 - 0.08 * wobble;
        if (t >= 0.7) {
          const fadeP = (t - 0.7) / 0.2;
          eaterScale = Math.max(0, 1.1 * (1 - fadeP));
          eaterAlpha = Math.max(0, 1 - fadeP);
        } else {
          eaterScale = 1.1;
        }
      }

      // victim 렌더링 (입 뒤로 들어가게 먼저 그리기)
      if (t < 0.5) {
        let victimScale = 1.0;
        if (t >= 0.15) {
          const p = (t - 0.15) / 0.35;
          victimScale = Math.max(0, 1.0 - p);
        }
        if (victimScale > 0.01) {
          drawCharacterBadge(
            ctx,
            char,
            anim.victim.x,
            anim.victim.y,
            r,
            anim.victim.angle,
            false,
            victimScale,
            1.0
          );
        }
      }

      // eater 렌더링
      ctx.save();
      ctx.translate(anim.eater.x, anim.eater.y);
      ctx.rotate(eaterAngle);
      ctx.scale(eaterStretchX * eaterScale, eaterStretchY * eaterScale);
      ctx.globalAlpha = eaterAlpha;

      drawCharacterBadge(ctx, char, 0, 0, r, 0, false, 1.0, 1.0);

      // 입 벌림 표현
      if (t <= 0.5) {
        const mRel = char.mouthPos || { x: 0, y: 0.15 };
        const mx = mRel.x * r;
        const my = mRel.y * r;
        const openProg = Math.min(1, t / 0.15);
        ctx.beginPath();
        ctx.ellipse(mx, my, 14 * openProg, 10 * openProg, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2a1a1e';
        ctx.fill();
        ctx.strokeStyle = '#c06070';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // 대사 텍스트
      if (anim.text && eaterAlpha > 0.1) {
        ctx.save();
        ctx.fillStyle = '#e03050';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fillText(anim.text, anim.eater.x, anim.eater.y - r * 0.7);
        ctx.restore();
      }
    });
  }

  // ─── 점수 팝업 텍스트 ────────────────────────────────────
  function updateAndDrawFloatingTexts(dtSec) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.elapsed += dtSec;
      ft.y -= 30 * dtSec;
      const alpha = Math.max(0, 1 - ft.elapsed / ft.duration);

      ctx.save();
      ctx.fillStyle = `rgba(224, 60, 90, ${alpha})`;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();

      if (ft.elapsed >= ft.duration) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  function checkDanger(now) {
    let anyDanger = false;
    for (const [, item] of items) {
      const top = item.body.position.y - charData(item.level).radius;
      if (top >= DANGER_Y) continue;
      if (item.dropTime !== null && (now - item.dropTime) < DROP_GRACE) continue;

      anyDanger = true;
      break;
    }

    if (anyDanger) {
      if (dangerStart === null) dangerStart = now;
      if (now - dangerStart >= DANGER_DURATION) {
        triggerGameOver();
      }
    } else {
      dangerStart = null;
    }
  }

  function triggerGameOver() {
    gameState = 'gameover';
    soundManager.stopAll();
    saveHighScore(score);
    const bestChar = charData(bestMergeLevel);
    goScoreEl.textContent     = `최종 점수: ${score}점`;
    goBestMergeEl.textContent = bestMergeLevel > 0
      ? `최고 합성: ${bestChar.name} (${bestMergeLevel}단계)`
      : '합성 없음';
    goHighscoreEl.textContent = `역대 최고: ${highScore}점`;
    overlayGameover.style.display = 'flex';
  }

  // ─── 렌더링 ──────────────────────────────────────────────
  function drawPreview() {
    if (!currentChar || gameState !== 'playing' || eatingAnimations.length > 0) return;
    const char = currentChar;
    const x = clampX(previewX, char.radius);
    const y = DROP_ZONE_H - char.radius - 4;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(224, 109, 126, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, DROP_ZONE_H);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.restore();

    drawCharacterBadge(ctx, char, x, y, char.radius);
  }

  function drawDangerLine(now) {
    const isDanger = dangerStart !== null;
    const blink = isDanger && Math.floor(now / 300) % 2 === 0;
    ctx.save();
    ctx.strokeStyle = blink ? '#ff3b30' : 'rgba(255, 99, 71, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(BOX_LEFT, DANGER_Y);
    ctx.lineTo(BOX_RIGHT, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isDanger) {
      const remain = Math.max(0, DANGER_DURATION - (now - dangerStart));
      const sec = (remain / 1000).toFixed(1);
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`위험! ${sec}s`, BOX_RIGHT - 6, DANGER_Y - 4);
    }
    ctx.restore();
  }

  function render(now, dtSec) {
    ctx.fillStyle = '#fdf6ec';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#faefe0';
    ctx.fillRect(0, 0, W, DROP_ZONE_H);

    ctx.strokeStyle = '#ecd6c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, DROP_ZONE_H);
    ctx.lineTo(W, DROP_ZONE_H);
    ctx.stroke();

    drawDangerLine(now);
    drawPreview();

    // 일반 물리 객체 렌더링
    for (const [, item] of items) {
      const char = charData(item.level);
      const isHigh = now < item.highlightUntil;
      drawCharacterBadge(
        ctx,
        char,
        item.body.position.x,
        item.body.position.y,
        char.radius,
        item.body.angle,
        isHigh
      );
    }

    // 먹기 연출 렌더링
    drawEatingAnimations();

    // 점수 팝업 렌더링
    updateAndDrawFloatingTexts(dtSec);

    // 좌우 벽 시각 표시 (BOX_LEFT, BOX_RIGHT 경계와 정확히 일치)
    ctx.fillStyle = '#e8d2c0';
    ctx.fillRect(0, DROP_ZONE_H, BOX_LEFT, H - DROP_ZONE_H);
    ctx.fillRect(BOX_RIGHT, DROP_ZONE_H, W - BOX_RIGHT, H - DROP_ZONE_H);
  }

  function loop(timestamp) {
    requestAnimationFrame(loop);

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      render(timestamp, 0);
      return;
    }

    let dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    if (dt > MAX_DT) dt = FIXED_DT;
    const dtSec = dt / 1000;

    if (gameState === 'playing') {
      if (eatingAnimations.length > 0) {
        updateEatingAnimations(dtSec);
      } else {
        accumulator += dt;
        while (accumulator >= FIXED_DT) {
          Engine.update(engine, FIXED_DT);
          processMergeQueue();
          accumulator -= FIXED_DT;
        }
        checkDanger(timestamp);
      }
    }

    render(timestamp, dtSec);
  }

  // ─── 시작 / 재시작 ───────────────────────────────────────
  function startGame() {
    soundManager.stopAll();

    for (const [, item] of items) {
      World.remove(world, item.body);
    }
    items.clear();
    mergeQueue = [];
    mergeReserved.clear();
    eatingAnimations = [];
    floatingTexts = [];

    score = 0;
    bestMergeLevel = 0;
    dangerStart = null;
    lastDropTime = 0;

    currentChar = randomSpawnChar();
    nextChar    = randomSpawnChar();
    updateUI();

    lastTimestamp = null;
    accumulator = 0;

    overlayStart.style.display    = 'none';
    overlayGameover.style.display = 'none';

    gameState = 'playing';

    // 게임 시작 시 1단계 우사기 음성 1회 재생
    soundManager.playAudio('assets/audio/usagi.mp3', true);
  }

  // ─── 화면 반응형 스케일 ──────────────────────────────────
  function scaleWrapper() {
    const fullHeight = wrapper.offsetHeight || 880;
    const scaleX = (window.innerWidth - 12) / W;
    const scaleY = (window.innerHeight - 12) / fullHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    wrapper.style.transform = `scale(${scale})`;
    const offsetY = Math.max(0, (window.innerHeight - fullHeight * scale) / 2);
    wrapper.style.marginTop = `${offsetY}px`;
  }

  // ─── 포인터 입력 (실제 Canvas 렌더링 크기 기준 논리 좌표 변환) ──
  function toCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top)  * (H / rect.height),
    };
  }

  function isInsideGame(cx, cy) {
    return cx >= 0 && cx <= W && cy >= 0 && cy <= H;
  }

  function onPointerMove(e) {
    e.preventDefault();
    const { x } = toCanvasCoords(e);
    previewX = x;
  }

  function onPointerDown(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    const { x, y } = toCanvasCoords(e);
    if (!isInsideGame(x, y)) return;
    pointerDown = true;
    pointerCancelled = false;
    previewX = x;
  }

  function onPointerUp(e) {
    if (!pointerDown || pointerCancelled) {
      pointerDown = false;
      return;
    }
    pointerDown = false;
    const { x, y } = toCanvasCoords(e);
    if (isInsideGame(x, y)) dropCharacter();
  }

  function onPointerCancel(e) {
    pointerDown = false;
    pointerCancelled = true;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      lastTimestamp = null;
      soundManager.stopAll();
      if (dangerStart !== null) dangerStart = null;
    }
  }

  // ─── 초기화 ──────────────────────────────────────────────
  function init() {
    soundManager.init();
    loadHighScore();
    initImageCache();
    initPhysics();
    initGuideContainer();

    canvas.addEventListener('pointermove',   onPointerMove,   { passive: false });
    canvas.addEventListener('pointerdown',   onPointerDown,   { passive: false });
    canvas.addEventListener('pointerup',     onPointerUp,     { passive: false });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: false });
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', scaleWrapper);

    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', startGame);

    scaleWrapper();
    requestAnimationFrame(loop);
  }

  init();
})();
