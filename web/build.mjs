import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2018',
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: '/* GENERATED FILE — do not edit. Source: web/src/**. Rebuild: cd web && npm run bundle */' },
  loader: { '.css': 'text' },
  outfile: '../app/src/main/assets/cytube_mobile.js',
});
console.log('bundled OK');
