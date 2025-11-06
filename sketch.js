// p5.js 測驗系統（CSV 題庫 + 視覺特效）
// 說明：
// - 將本檔與 questions.csv 放同資料夾，以本機伺服器開啟頁面。
// - questions.csv 標頭需為：question,A,B,C,D,answer（answer = A/B/C/D）。
// - 本程式包含：游標尾跡、點擊漣漪、選項懸停/點擊特效、作答回饋、依分數顯示煙火/氣球/泡泡動畫。
// p5.js Quiz System with CSV, animations, cursor trail, and selection effects
// Place a questions.csv next to this file. Run via a local server.

let table;
let questions = [];
let current = 0;
let score = 0;
let state = 'intro'; // 'intro' | 'quiz' | 'result'
let selectedIndex = -1;
let lockInput = false;
let feedbackTimer = 0;

let particles = [];
let ripples = [];
let cursorTrail = [];

let startBtnHover = false;

// Layout
let margin = 32;
let optionBoxes = [];
let baseFontSize;

// Timing
const nextDelayFrames = 45;

// Colors
// Off-white background and darker text for clarity
const bgA = [250, 247, 238]; // off-white base
const bgB = [250, 247, 238]; // same as bgA to keep flat
const cPrimary = [255, 201, 71];
const cCorrect = [80, 220, 120];
const cWrong = [255, 99, 132];
const cText = [40, 44, 60]; // darker for readability
const cDim = [110, 120, 135];

// 嘗試載入 CSV 題庫與標頭（失敗時改用內建範例）
function preload() {
  // Attempt to load a CSV with header row
  // Expected headers: question, A, B, C, D, answer
  // answer = "A" | "B" | "C" | "D"
  table = loadTable('questions.csv', 'csv', 'header', () => {}, () => {});
}

// 初始化：建立畫布、設定字型與載入題庫
function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
  textFont('system-ui, -apple-system, Segoe UI, Roboto, Arial');
  baseFontSize = max(14, min(22, width / 50));

  parseQuestionsOrFallback();
  buildOptionBoxes();
}

// 視窗改變時重新計算版面與字級/版面
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseFontSize = max(14, min(22, width / 50));
  buildOptionBoxes();
}

// 主繪製迴圈：依狀態切換畫面，最後疊加效果與自訂游標
function draw() {
  drawBackgroundGradient();
  drawCursorTrail();

  if (state === 'intro') {
    drawIntro();
  } else if (state === 'quiz') {
    drawQuiz();
  } else if (state === 'result') {
    drawResult();
  }

  updateAndDrawParticles();
  updateAndDrawRipples();
  drawCustomCursor();
}

// -------------------- Quiz Data --------------------

// 從 CSV 解析題目；若無法解析則載入內建範例題
function parseQuestionsOrFallback() {
  questions = [];

  if (table && table.getRowCount() > 0) {
    const cols = table.columns.map(c => c.toLowerCase());
    const hasQ = cols.includes('question');
    const hasA = cols.includes('a');
    const hasB = cols.includes('b');
    const hasC = cols.includes('c');
    const hasD = cols.includes('d');
    const hasAns = cols.includes('answer') || cols.includes('correct');

    if (hasQ && hasA && hasB && hasC && hasD && hasAns) {
      for (let r = 0; r < table.getRowCount(); r++) {
        const q = table.getString(r, 'question');
        const oA = table.getString(r, 'A');
        const oB = table.getString(r, 'B');
        const oC = table.getString(r, 'C');
        const oD = table.getString(r, 'D');

        let ans = '';
        if (cols.includes('answer')) ans = table.getString(r, 'answer');
        else ans = table.getString(r, 'correct');

        const idx = letterToIndex(ans);
        if (q && oA && oB && oC && oD && idx !== -1) {
          questions.push({
            q,
            options: [oA, oB, oC, oD],
            correct: idx
          });
        }
      }
    }
  }

  if (questions.length === 0) {
    // Fallback sample
    questions = [
      { q: '太陽系中最大的行星是？', options: ['地球', '木星', '火星', '金星'], correct: 1 },
      { q: '水的化學式是？', options: ['H2O', 'CO2', 'O2', 'NaCl'], correct: 0 },
      { q: '程式中的 if 用來做什麼？', options: ['重複', '條件判斷', '定義函式', '匯出模組'], correct: 1 }
    ];
  }
}

// -------------------- UI Layout --------------------

// 依視窗尺寸計算 4 個選項框的位置與大小
function buildOptionBoxes() {
  optionBoxes = [];
  const boxW = min(width - margin * 2, 900);
  const boxH = max(56, baseFontSize * 2.4);
  const gap = max(14, baseFontSize * 0.6);

  const startY = height * 0.38;
  const cx = width / 2;

  for (let i = 0; i < 4; i++) {
    const x = cx - boxW / 2;
    const y = startY + i * (boxH + gap);
    optionBoxes.push({ x, y, w: boxW, h: boxH, hover: false, flash: 0 });
  }
}

// 米白單色背景，讓文字與元件更清晰
function drawBackgroundGradient() {
  // Flat off-white background for clean readability
  background(bgA[0], bgA[1], bgA[2]);
}

// -------------------- Intro --------------------

// 首頁畫面：標題、說明與「開始測驗」按鈕
function drawIntro() {
  push();
  fill(cText[0], cText[1], cText[2]);
  textAlign(CENTER, CENTER);

  const titleSize = baseFontSize * 2.2;
  textSize(titleSize);
  textStyle(BOLD);
  text('互動測驗系統', width / 2, height * 0.25);

  textStyle(NORMAL);
  textSize(baseFontSize * 1.05);
  fill(210, 220, 240);
  text('題庫由 CSV 載入，作答後依分數給予不同動畫回饋', width / 2, height * 0.35);

  // Start button
  const btnW = 220;
  const btnH = 54;
  const bx = width / 2 - btnW / 2;
  const by = height * 0.5;

  startBtnHover = pointInRect(mouseX, mouseY, bx, by, btnW, btnH);

  const glow = startBtnHover ? 28 : 10;
  push();
  noStroke();
  fill(255, 255, 255, glow);
  rect(bx - 6, by - 6, btnW + 12, btnH + 12, 14);
  pop();

  const grad = lerpColor(color(cPrimary[0], cPrimary[1], cPrimary[2]), color(255, 240, 150), 0.4);
  push();
  noStroke();
  fill(grad);
  rect(bx, by, btnW, btnH, 14);
  pop();

  fill(50, 50, 60);
  textSize(baseFontSize * 1.1);
  textStyle(BOLD);
  text('開始測驗', width / 2, by + btnH / 2);

  pop();

  // Subtle sparkles on intro
  if (frameCount % 3 === 0) {
    spawnParticle(random(width), random(height * 0.6, height * 0.9), [255, 255, 255], 1.2, random(2, 4), 120, true);
  }
}

// -------------------- Quiz --------------------

// 測驗畫面：進度條、題目文字、4 個選項與作答回饋
function drawQuiz() {
  if (current >= questions.length) {
    state = 'result';
    return;
  }

  const q = questions[current];

  // Progress
  drawProgress(current, questions.length);

  // Question
  push();
  fill(cText[0], cText[1], cText[2]);
  textAlign(CENTER, BOTTOM);
  textStyle(BOLD);
  textSize(baseFontSize * 1.6);
  textWrap(WORD);
  const qBoxW = min(width - margin * 2, 1000);
  const qX = width / 2 - qBoxW / 2;
  const qY = height * 0.28;
  text(q.q, width / 2, qY);
  pop();

  // Options
  for (let i = 0; i < 4; i++) {
    const box = optionBoxes[i];
    const hovered = pointInRect(mouseX, mouseY, box.x, box.y, box.w, box.h);
    box.hover = hovered;

    const isSelected = selectedIndex === i;
    const baseC = hovered ? [255, 255, 255] : [240, 245, 255];
    const alpha = hovered ? 200 : 160;

    const borderC = hovered ? cPrimary : [180, 180, 180];
    const borderAlpha = hovered ? 255 : 80;

    // Flash overlay (on click result)
    if (box.flash > 0) box.flash -= 10;

    push();
    // Shadow
    noStroke();
    fill(0, 0, 0, hovered ? 80 : 50);
    rect(box.x, box.y + 6, box.w, box.h, 12);

    // Box
    stroke(borderC[0], borderC[1], borderC[2], borderAlpha);
    strokeWeight(2);
    fill(baseC[0], baseC[1], baseC[2], alpha);
    rect(box.x, box.y, box.w, box.h, 12);

    // Flash overlay
    if (box.flash > 0) {
      fill(255, 255, 255, box.flash);
      rect(box.x, box.y, box.w, box.h, 12);
    }

    // Text
    noStroke();
    fill(40, 44, 60);
    textSize(baseFontSize * 1.05);
    textAlign(LEFT, CENTER);
    textWrap(WORD);

    const label = ['A', 'B', 'C', 'D'][i];
    const pad = 18;
    text(`${label}. ${q.options[i]}`, box.x + pad, box.y + box.h / 2, box.w - pad * 2);
    pop();

    // Hover sparkle
    if (hovered && frameCount % 4 === 0) {
      spawnParticle(random(box.x + 8, box.x + box.w - 8), box.y + random(8, box.h - 8), [255, 255, 255], 1, random(1, 2.5), 80, true);
    }

    // Selected ripple highlight persists briefly
    if (isSelected) {
      push();
      noFill();
      stroke(255, 255, 255, 120);
      strokeWeight(3);
      rect(box.x - 3, box.y - 3, box.w + 6, box.h + 6, 14);
      pop();
    }
  }

  // Feedback text
  if (feedbackTimer > 0) {
    feedbackTimer--;
    push();
    textAlign(CENTER, TOP);
    textSize(baseFontSize * 1.15);
    textStyle(BOLD);
    const isGood = selectedIndex === q.correct;
    fill(isGood ? cCorrect[0] : cWrong[0], isGood ? cCorrect[1] : cWrong[1], isGood ? cCorrect[2] : cWrong[2]);
    const msg = isGood ? '太棒了！回答正確！' : '別灰心，再接再厲！';
    text(msg, width / 2, optionBoxes[3].y + optionBoxes[3].h + 24);
    pop();

    if (feedbackTimer === 0) {
      // Go next
      selectedIndex = -1;
      lockInput = false;
      current++;
      if (current >= questions.length) {
        state = 'result';
      }
    }
  }
}

// 處理首頁開始按鈕與選項點擊；同時在點擊位置產生漣漪
function mousePressed() {
  // Intro start
  if (state === 'intro') {
    const btnW = 220;
    const btnH = 54;
    const bx = width / 2 - btnW / 2;
    const by = height * 0.5;
    if (pointInRect(mouseX, mouseY, bx, by, btnW, btnH)) {
      spawnRipple(mouseX, mouseY);
      state = 'quiz';
      current = 0;
      score = 0;
      selectedIndex = -1;
      lockInput = false;
      feedbackTimer = 0;
      return;
    }
  }

  // Click ripple anywhere
  spawnRipple(mouseX, mouseY);

  if (state !== 'quiz' || lockInput) return;
  if (current >= questions.length) return;

  const q = questions[current];
  for (let i = 0; i < optionBoxes.length; i++) {
    const box = optionBoxes[i];
    if (pointInRect(mouseX, mouseY, box.x, box.y, box.w, box.h)) {
      selectedIndex = i;
      lockInput = true;
      box.flash = 140;

      const correct = i === q.correct;
      if (correct) {
        score++;
        burstParticlesCenter(box, cCorrect);
      } else {
        burstParticlesCenter(box, cWrong);
        // Also mark correct box with subtle glow
        optionBoxes[q.correct].flash = 80;
      }

      feedbackTimer = nextDelayFrames;
      break;
    }
  }
}

// 觸控裝置支援：轉呼叫滑鼠點擊流程
function touchStarted() {
  mousePressed();
  return false;
}

// 鍵盤 A/B/C/D 亦可快速作答
function keyPressed() {
  if (state === 'quiz' && !lockInput) {
    const mapKey = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
    const k = key.toLowerCase();
    if (k in mapKey) {
      const idx = mapKey[k];
      // simulate a click on that option
      const box = optionBoxes[idx];
      selectedIndex = idx;
      lockInput = true;
      const q = questions[current];
      const correct = idx === q.correct;
      if (correct) {
        score++;
        burstParticlesCenter(box, cCorrect);
      } else {
        burstParticlesCenter(box, cWrong);
        optionBoxes[q.correct].flash = 80;
      }
      feedbackTimer = nextDelayFrames;
    }
  }
}

// -------------------- Result --------------------

// 結果畫面：顯示分數與依表現切換不同動畫（煙火/氣球/泡泡）
function drawResult() {
  const total = questions.length;
  const ratio = total > 0 ? score / total : 0;
  const pct = floor(ratio * 100);

  push();
  textAlign(CENTER, BOTTOM);
  textSize(baseFontSize * 1.6);
  textStyle(BOLD);
  fill(cText[0], cText[1], cText[2]);
  text('成績', width / 2, height * 0.22);

  textAlign(CENTER, CENTER);
  textSize(baseFontSize * 2.6);
  fill(255, 240, 180);
  text(`${score} / ${total} (${pct}%)`, width / 2, height * 0.32);
  pop();

  if (ratio >= 0.8) {
    drawResultFireworks('超讚！你太強了！');
  } else if (ratio >= 0.5) {
    drawResultBalloons('不錯！再挑戰更高分！');
  } else {
    drawResultBubbles('加油！下次一定更好！');
  }

  // Restart hint
  push();
  textAlign(CENTER, TOP);
  textSize(baseFontSize * 0.95);
  fill(210, 220, 240);
  text('按 R 重新開始', width / 2, height - 48);
  pop();
}

// 結果畫面按 R 重置狀態
function keyTyped() {
  if (state === 'result' && (key === 'r' || key === 'R')) {
    state = 'intro';
    current = 0;
    score = 0;
    selectedIndex = -1;
    lockInput = false;
    feedbackTimer = 0;
    particles = [];
    ripples = [];
  }
}

// -------------------- Visual helpers --------------------

// 頂部進度條與步數文字
function drawProgress(idx, total) {
  const w = min(width - margin * 2, 800);
  const h = 12;
  const x = width / 2 - w / 2;
  const y = height * 0.16;

  push();
  noStroke();
  fill(255, 255, 255, 50);
  rect(x, y, w, h, 6);

  const ww = total > 0 ? (w * idx) / total : 0;
  const progC = color(cPrimary[0], cPrimary[1], cPrimary[2]);
  fill(progC);
  rect(x, y, ww, h, 6);

  const tick = 6;
  const glow = 20 + 10 * sin(frameCount * 0.15);
  fill(255, 255, 255, glow);
  rect(x - 3, y - 3, w + 6, h + 6, 8);

  // Step text
  fill(cText[0], cText[1], cText[2]);
  textAlign(CENTER, BOTTOM);
  textSize(baseFontSize);
  text(`第 ${idx + 1} 題 / 共 ${total} 題`, width / 2, y - 10);
  pop();
}

// 自訂游標：外圈脈動圓與暖色小圓點
function drawCustomCursor() {
  const r = 8 + 2 * sin(frameCount * 0.2);
  noFill();
  stroke(90, 90, 90, 220); // darker stroke for visibility on off-white
  strokeWeight(2);
  circle(mouseX, mouseY, r * 2);

  // inner dot
  noStroke();
  fill(255, 215, 120, 220);
  circle(mouseX, mouseY, 5);
}

// 游標尾跡：推入淡化的小點，維持固定長度佇列
function drawCursorTrail() {
  // Add trail point
  cursorTrail.push({
    x: mouseX + random(-0.5, 0.5),
    y: mouseY + random(-0.5, 0.5),
    a: 180,
    r: random(2, 4)
  });
  if (cursorTrail.length > 60) cursorTrail.shift();

  for (let i = 0; i < cursorTrail.length; i++) {
    const p = cursorTrail[i];
    p.a -= 3;
    p.r *= 0.985;
    if (p.a < 0) p.a = 0;
    noStroke();
    fill(255, 255, 255, p.a);
    circle(p.x, p.y, p.r * 2);
  }
}

// 產生點擊漣漪效果
function spawnRipple(x, y) {
  ripples.push({
    x,
    y,
    r: 0,
    a: 200,
    w: 2 + random(0.5, 1.5)
  });
}

// 更新並繪製所有漣漪；透明度歸零後移除
function updateAndDrawRipples() {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.r += 4;
    r.a -= 6;
    push();
    noFill();
    stroke(255, 255, 255, r.a);
    strokeWeight(r.w);
    circle(r.x, r.y, r.r * 2);
    pop();
    if (r.a <= 0) ripples.splice(i, 1);
  }
}

// 建立一般粒子（支援重力、壽命、閃爍效果）
function spawnParticle(x, y, col, scale = 1, speed = 2, life = 90, twinkle = false) {
  const ang = random(TWO_PI);
  particles.push({
    x, y,
    vx: cos(ang) * speed,
    vy: sin(ang) * speed,
    ax: 0,
    ay: 0.05, // gravity
    life,
    a: 255,
    col,
    size: random(2, 4) * scale,
    twinkle
  });
}

function burstParticlesCenter(box, col) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  for (let i = 0; i < 36; i++) {
    spawnParticle(cx, cy, col, 1.2, random(2, 4), 70, true);
  }
  // click ripple at center
  spawnRipple(cx, cy);
}

// 更新並繪製粒子；壽命歸零後移除
function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vx += p.ax;
    p.vy += p.ay;
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.a = map(p.life, 0, 90, 0, 255);
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    noStroke();
    const tw = p.twinkle ? (0.7 + 0.3 * sin(frameCount * 0.3 + i)) : 1;
    fill(p.col[0], p.col[1], p.col[2], p.a * tw);
    circle(p.x, p.y, p.size);
  }
}

// -------------------- Result Animations --------------------

let fireworks = [];
let balloons = [];
let bubbles = [];

// 高分動畫：煙火與稱讚文字
function drawResultFireworks(title) {
  push();
  textAlign(CENTER, CENTER);
  textSize(baseFontSize * 1.4);
  fill(255, 240, 170);
  text(title, width / 2, height * 0.44);
  pop();

  if (frameCount % 15 === 0 && fireworks.length < 6) {
    fireworks.push(new Firework(random(width * 0.15, width * 0.85)));
  }
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].draw();
    if (fireworks[i].done) fireworks.splice(i, 1);
  }
}

// 煙火：上升階段 -> 爆裂粒子
class Firework {
  constructor(x) {
    this.x = x;
    this.y = height;
    this.vy = random(-8, -12);
    this.phase = 'rise';
    this.exploded = false;
    this.p = [];
    this.color = random([
      [255, 180, 80],
      [255, 120, 120],
      [180, 220, 120],
      [120, 180, 255]
    ]);
  }
  update() {
    if (this.phase === 'rise') {
      this.y += this.vy;
      this.vy += 0.15;
      if (this.vy >= -1 || this.y < height * random(0.25, 0.45)) {
        this.explode();
      }
    } else {
      for (let i = this.p.length - 1; i >= 0; i--) {
        const pa = this.p[i];
        pa.vx *= 0.99;
        pa.vy *= 0.99;
        pa.vy += 0.05;
        pa.x += pa.vx;
        pa.y += pa.vy;
        pa.life--;
        if (pa.life <= 0) this.p.splice(i, 1);
      }
      if (this.p.length === 0) this.done = true;
    }
  }
  explode() {
    this.phase = 'burst';
    for (let i = 0; i < 80; i++) {
      const a = random(TWO_PI);
      const s = random(2, 5);
      this.p.push({
        x: this.x,
        y: this.y,
        vx: cos(a) * s,
        vy: sin(a) * s,
        life: random(40, 80)
      });
    }
    // sparkle ring
    for (let i = 0; i < 20; i++) {
      spawnParticle(this.x, this.y, this.color, 1.4, random(1, 3), 50, true);
    }
  }
  draw() {
    if (this.phase === 'rise') {
      stroke(255, 230, 180);
      line(this.x, this.y, this.x, this.y + 12);
    } else {
      noStroke();
      for (const pa of this.p) {
        fill(this.color[0], this.color[1], this.color[2], map(pa.life, 0, 80, 0, 255));
        circle(pa.x, pa.y, 3);
      }
    }
  }
}

// 中分動畫：緩慢上升的氣球
function drawResultBalloons(title) {
  push();
  textAlign(CENTER, CENTER);
  textSize(baseFontSize * 1.4);
  fill(220, 235, 255);
  text(title, width / 2, height * 0.44);
  pop();

  if (balloons.length < 10 && frameCount % 20 === 0) {
    balloons.push(new Balloon());
  }
  for (let i = balloons.length - 1; i >= 0; i--) {
    balloons[i].update();
    balloons[i].draw();
    if (balloons[i].y + balloons[i].r * 2 < -50) balloons.splice(i, 1);
  }
}

// 氣球：水平微擺 + 垂直上升
class Balloon {
  constructor() {
    this.x = random(width * 0.1, width * 0.9);
    this.y = height + 60;
    this.r = random(14, 26);
    this.hue = random([
      [255, 170, 120], [255, 120, 150], [150, 210, 255], [180, 240, 180]
    ]);
    this.t = random(1000);
    this.spd = random(1, 2);
  }
  update() {
    this.t += 0.02;
    this.x += sin(this.t) * 0.6;
    this.y -= this.spd;
  }
  draw() {
    push();
    noStroke();
    fill(this.hue[0], this.hue[1], this.hue[2], 220);
    ellipse(this.x, this.y, this.r * 1.2, this.r * 1.6);
    stroke(255, 255, 255, 120);
    line(this.x, this.y + this.r * 0.8, this.x, this.y + this.r * 2.5);
    pop();
  }
}

// 低分動畫：清爽泡泡與鼓勵文字
function drawResultBubbles(title) {
  push();
  textAlign(CENTER, CENTER);
  textSize(baseFontSize * 1.35);
  fill(220, 230, 255);
  text(title, width / 2, height * 0.44);
  pop();

  if (bubbles.length < 20 && frameCount % 5 === 0) {
    bubbles.push(new Bubble());
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].update();
    bubbles[i].draw();
    if (bubbles[i].y < -30) bubbles.splice(i, 1);
  }
}

// 泡泡：緩慢上升 + 小幅左右飄移
class Bubble {
  constructor() {
    this.x = random(width);
    this.y = height + 20;
    this.r = random(6, 14);
    this.t = random(1000);
    this.spd = random(0.8, 1.6);
  }
  update() {
    this.t += 0.03;
    this.x += sin(this.t) * 0.5;
    this.y -= this.spd;
  }
  draw() {
    push();
    noFill();
    stroke(255, 255, 255, 150);
    strokeWeight(1.5);
    circle(this.x, this.y, this.r * 2);
    pop();
  }
}

// -------------------- Utils --------------------

// 基本矩形點測試
function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

// 將答案字母 A/B/C/D 映射為索引 0/1/2/3
function letterToIndex(ch) {
  if (!ch) return -1;
  const c = ch.toString().trim().toUpperCase();
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map.hasOwnProperty(c) ? map[c] : -1;
}
