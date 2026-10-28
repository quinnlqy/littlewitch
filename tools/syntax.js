// 语法自检：把 src 打包后取出 <script> 内容，用 vm 编译（不执行）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const html = execFileSync('python', [path.join(root, 'tools/build.py'), '--print'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const i = html.indexOf('<script>');
const j = html.indexOf('</script>', i);
const js = html.slice(i + 8, j);
try {
  new vm.Script(js, { filename: 'game.js' });
  console.log('syntax ok  (' + js.length + ' chars)');
} catch (e) {
  console.log('SYNTAX ERROR:', e.message);
  const m = /game\.js:(\d+)/.exec(e.stack || '');
  if (m) {
    const lines = js.split('\n');
    const n = parseInt(m[1], 10);
    for (let k = Math.max(0, n - 4); k < Math.min(lines.length, n + 2); k++) {
      console.log((k + 1) + ': ' + lines[k].slice(0, 160));
    }
  }
  process.exit(1);
}
