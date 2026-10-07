// Construit le site dans dist/ à partir de src/.
//   node build.mjs          → version de production (JS et CSS minifiés, noms hachés)
//   node build.mjs --dev    → version lisible + serveur local sur http://localhost:3000
import { readFile, writeFile, readdir, rm, mkdir, cp } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { join, extname } from 'node:path';
import { transform } from 'esbuild';

const SRC = 'src', OUT = 'dist', DEV = process.argv.includes('--dev');

// Les fichiers de src/js partagent le même état : ils sont concaténés dans l'ordre
// de leur préfixe numérique, puis enveloppés dans une seule fonction anonyme.
const parts = (await readdir(join(SRC, 'js'))).filter(f => f.endsWith('.js')).sort();
const js = '(() => {\n' + (await Promise.all(parts.map(f => readFile(join(SRC, 'js', f), 'utf8')))).join('') + '})();\n';
const css = await readFile(join(SRC, 'styles.css'), 'utf8');

const min = async (code, loader) => DEV ? code
  : (await transform(code, { loader, minify: true, target: 'es2020', legalComments: 'none' })).code;
const hashed = (name, code) => DEV ? name
  : name.replace(/\.(\w+)$/, `.${createHash('sha256').update(code).digest('hex').slice(0, 10)}.$1`);

const outJs = await min(js, 'js'), outCss = await min(css, 'css');
const jsName = hashed('app.js', outJs), cssName = hashed('styles.css', outCss);

let html = await readFile(join(SRC, 'index.html'), 'utf8');
html = html.replace('href="styles.css"', `href="assets/${cssName}"`).replace('src="app.js"', `src="assets/${jsName}"`);
if (!DEV) html = html.replace(/<!--[\s\S]*?-->\n?/g, '');

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'assets'), { recursive: true });
await cp(join(SRC, 'public'), OUT, { recursive: true }); // favicon, icônes, manifeste : servis tels quels à la racine
await writeFile(join(OUT, 'index.html'), html);
await writeFile(join(OUT, 'assets', jsName), outJs);
await writeFile(join(OUT, 'assets', cssName), outCss);
console.log(`dist/ prêt (${DEV ? 'dev' : 'production'}) : ${parts.length} fichiers JS → assets/${jsName}, assets/${cssName}`);

if (DEV) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
  createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html');
    try {
      const body = await readFile(join(OUT, path.replace(/\.\./g, '')));
      const type = TYPES[extname(path)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type.startsWith('image/') ? type : type + '; charset=utf-8' }).end(body);
    } catch { res.writeHead(404).end('Introuvable'); }
  }).listen(3000, () => console.log('→ http://localhost:3000'));
}
