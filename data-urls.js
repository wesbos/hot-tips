/* eslint-disable */
x = () =>{
  [a.width, a.height] = [750, 500];
  const c = a.getContext(`2d`);

  const balls = [{ x: 295, y: 250, c: `#fff`, i: 1 }];

  for (let i = 6; --i; ) {
    for (let j = i; j--; ) {
      balls.push({ x: 400 + i * 25, y: 259 + (j - i / 2) * 25, c: `blue` });
    }
  }

  rect = (x, y, width, height, color) => {
    c.beginPath();
    c.fillStyle = color;
    c.fillRect(x, y, width, height);
  };

  let pts = (ma = t = lt = 0);
  const m = { d: 0 };

  setInterval((e) => {
    a.width = a.width;

    rect(100, 100, 550, 300, `#841`);
    rect(125, 125, 500, 250, `lime`);

    for (let i = 6; i--; ) {
      c.beginPath();
      c.arc(125 + (i % 3) * 250, 125 + ((i / 3) >> 0) * 250, 20, 0, 7);
      c.fillStyle = `#000`;
      c.fill();
    }

    balls.map((b, i) => {
      if (!b.vx) b.vx = b.vy = 0;
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.99;
      b.vy *= 0.99;

      if (b.x > 615 || b.x < 135) b.vx *= -1;
      if (b.y > 365 || b.y < 135) b.vy *= -1;

      Math.hypot((((b.x - 125) / 250 + 0.5) | 0) * 250 - b.x + 125, (((b.y - 125) / 250 + 0.5) | 0) * 250 - b.y + 125) <
        25 &&
        balls.splice(i, 1) &&
        pts++;

      balls.map((o) => {
        const dist = Math.hypot(b.x - o.x, b.y - o.y);
        if (b != o && dist < 20) {
          const angle = Math.atan2(o.y - b.y, o.x - b.x);
          const s = Math.sin(angle);
          const q = Math.cos(angle);

          b.vx -= q;
          b.vy -= s;
          o.vx += q;
          o.vy += s;
        }
      });

      c.beginPath();
      c.arc(b.x, b.y, 10, 0, 7);
      c.fillStyle = b.c;
      c.fill();
    });

    ma = Math.atan2(m.y - balls[0].y, m.x - balls[0].x) + 3;
    stp = Math.hypot(balls[0].vx, balls[0].vy) < 0.03;

    if (stp) {
      c.save();
      c.translate(balls[0].x, balls[0].y);
      c.rotate(ma);
      c.translate(m.d ? -30 / (lt - t) - 30 : Math.sin(t / 10) * 5, 0);
      rect(-135, 0, 120, 5, `#952`);
      c.restore();
    }

    c.font = `3em a`;
    c.fillStyle = `#000`;
    balls[1] || c.fillText(`Winner!`, 250, 260);
    balls[0].i || c.fillText(`Game Over`, 250, 260);

    c.fillText(pts, 360, 70);

    t++;
  }, 16);

  onmousedown = (e) => {
    ++m.d;
    lt = t;
  };
  onmouseup = (e) => {
    --m.d;
    if (stp) (balls[0].vx = Math.cos(ma) * 10), (balls[0].vy = Math.sin(ma) * 10);
  };
  onmousemove = (e) => {
    m.x = e.clientX;
    m.y = e.clientY;
  };
}

const h = /* html */ `<canvas id="a"/><script>(${x.toString()})();</script>`;

//

const url = `data:text/html,${encodeURIComponent(h)}`;
console.log(url);
copy(url)
