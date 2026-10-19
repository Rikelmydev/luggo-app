// O GitHub Pages só conhece arquivos. Para cada rota conhecida, cria uma cópia do
// index.html na pasta da rota: assim o link aberto direto responde 200 (bom para
// prévias de link e buscadores). Rotas dinâmicas, como /pedido/LG..., caem no
// 404.html, que também é o site e o React Router resolve.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = [
  'malas',
  'reserva',
  'pagamento',
  'minhas-reservas',
  'como-funciona',
  'perguntas',
  'termos',
  'contato',
  'sobre',
  'equipe',
  'equipe/reservas',
  'equipe/estoque',
  'equipe/numeros',
]

// Uma página por mala do catálogo.
const catalog = readFileSync('src/data/catalog.ts', 'utf8')
const models = [...catalog.matchAll(/^\s{4}id: '([a-z0-9-]+)',$/gm)].map((m) => `malas/${m[1]}`)

for (const route of [...routes, ...models]) {
  const dir = join('dist', route)
  mkdirSync(dir, { recursive: true })
  copyFileSync('dist/index.html', join(dir, 'index.html'))
}
copyFileSync('dist/index.html', 'dist/404.html')
console.log(`${routes.length + models.length} rotas com página própria, mais o 404.html`)
