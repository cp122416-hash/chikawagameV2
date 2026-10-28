/* style.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #fbf5ee;
  color: #5a4638;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

#game-wrapper {
  position: relative;
  width: 460px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
}

/* 상단 정보 바 */
#top-bar {
  width: 460px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px 6px;
  background: #fffdf9;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 2px 8px rgba(180, 140, 120, 0.08);
  border: 2px solid #f2e2d5;
  border-bottom: none;
}

#top-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#title-area {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.15;
  color: #e06d7e;
  letter-spacing: -0.5px;
}

#sound-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

#btn-mute {
  background: #fdf0f2;
  border: 1px solid #f9d4dc;
  border-radius: 6px;
  padding: 2px 4px;
  font-size: 11px;
  cursor: pointer;
  line-height: 1;
}

#btn-mute:hover {
  background: #fce4e8;
}

#vol-slider {
  width: 46px;
  height: 4px;
  accent-color: #e06d7e;
  cursor: pointer;
}

#score-area {
  display: flex;
  gap: 6px;
}

.score-row {
  background: #fdf0f2;
  border: 1.5px solid #f9d4dc;
  border-radius: 10px;
  padding: 3px 8px;
  min-width: 62px;
  text-align: center;
}

.s-label {
  display: block;
  font-size: 9px;
  font-weight: 700;
  color: #cf6075;
}

#score-value, #best-value {
  display: block;
  font-size: 15px;
  font-weight: 800;
  color: #5a3d31;
}

#next-area {
  background: #fdf0f2;
  border: 1.5px solid #f9d4dc;
  border-radius: 10px;
  padding: 2px 5px 3px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#cv-next {
  display: block;
  margin-top: 1px;
}

/* 캔버스 */
#canvas-main {
  display: block;
  width: 460px;
  height: 720px;
  background: #fdf6ec;
  border-left: 2px solid #f2e2d5;
  border-right: 2px solid #f2e2d5;
  cursor: pointer;
  touch-action: none;
}

/* 하단 바: 1~10단계 가이드 + 아노코 꿀꺽 + 조작 힌트 */
#bottom-bar {
  width: 460px;
  background: #fffdf9;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2px solid #f2e2d5;
  border-top: none;
  box-shadow: 0 4px 12px rgba(180, 140, 120, 0.1);
  gap: 5px;
}

#guide-container {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 3px 2px;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 2px;
}

.guide-badge-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.guide-canvas {
  display: block;
}

.guide-name {
  font-size: 8.5px;
  font-weight: 700;
  color: #6e5548;
  margin-top: 1px;
}

.guide-arrow {
  font-size: 9px;
  color: #cfb2a3;
  font-weight: bold;
  padding: 0 1px;
}

#anoko-bonus-badge {
  background: #fff0f3;
  border: 1px dashed #f69aa9;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 10.5px;
  color: #c9405a;
  text-align: center;
}

#hint-text {
  font-size: 10.5px;
  line-height: 1.3;
  color: #8c7263;
  text-align: center;
  font-weight: 500;
}

/* 오버레이 */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(80, 60, 50, 0.45);
  backdrop-filter: blur(2px);
  z-index: 30;
  border-radius: 16px;
}

.overlay-box {
  background: #fffcf8;
  border: 3px solid #f6ccd5;
  border-radius: 20px;
  padding: 28px 24px;
  text-align: center;
  box-shadow: 0 10px 24px rgba(100, 70, 60, 0.2);
  width: 290px;
}

.overlay-title {
  font-size: 24px;
  font-weight: 800;
  color: #df697c;
  margin-bottom: 6px;
}

.overlay-sub {
  font-size: 13px;
  color: #8d7366;
  margin-bottom: 18px;
  line-height: 1.4;
}

.overlay-stat {
  font-size: 14px;
  color: #5d463b;
  margin-bottom: 8px;
  font-weight: 600;
}

.game-btn {
  margin-top: 14px;
  padding: 10px 32px;
  font-size: 16px;
  font-weight: 800;
  background: #f78d9f;
  color: #fff;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(247, 141, 159, 0.4);
  transition: transform 0.1s, background 0.15s;
}

.game-btn:hover {
  background: #ef778b;
  transform: translateY(-1px);
}

.game-btn:active {
  transform: translateY(1px);
}
