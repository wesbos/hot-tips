import express from 'express';
import fs from 'fs';
import { reactViewEngine } from './reactVewEngine';
import { svelteViewEngine } from './sveltetVewEngine';
import { wesViewEngine } from './wesVewEngine';

const app = express();

app.use((req, res, next) => {
  res.locals.courseCode = 'RFB';
  res.locals.productCode = 'RFB2';
  next();
});

app.get(`/`, (req, res) => {
  const routes = app._router.stack
    .map((r) => {
      if (r.route && r.route.path) {
        return `http://localhost:3000${r.route.path}`;
      }
    })
    .filter(Boolean);
  const html = routes.map((route) => `<a href="${route}">${route}</a><br>`).join(``);
  res.send(html);
});

// .pug files
app.set('view engine', 'pug');
// .wes files
app.engine('wes', wesViewEngine);
// .jsx files
app.engine('jsx', reactViewEngine);
app.engine('tsx', reactViewEngine);
app.engine('svelte', svelteViewEngine);

app.get(`/react`, (req, res) => {
  res.render('react.jsx', { title: 'Hey', message: 'Hello there!' });
});
app.get(`/svelte`, (req, res) => {
  res.render('svelte.svelte', { title: 'Hey', message: 'Hello there!' });
});

app.get(`/pug`, (req, res) => {
  res.render('pug.pug', { title: 'Hey', message: 'Hello there!' });
});
app.get(`/wes`, (req, res) => {
  res.render('wes.wes', { title: 'Hey', message: 'Hello there!' });
});

app.listen(3000, () => {
  console.log(`Example app listening on port http://localhost:3000!`);
});
