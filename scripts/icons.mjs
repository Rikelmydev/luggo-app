// Gera src/components/ui/icons.tsx só com os ícones e pesos usados (lista em scripts/icons.json).
// O pacote React do Phosphor traz os 6 pesos de cada ícone; aqui entram só os necessários.
// Uso: npm run icons
import { readFileSync, writeFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('scripts/icons.json', 'utf8'))
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
const inner = (file) => readFileSync(file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()

const lines = [
  '// Gerado por scripts/icons.mjs a partir de @phosphor-icons/core. Não edite à mão.',
  "import type { SVGProps } from 'react'",
  '',
  "export type IconWeight = 'regular' | 'bold' | 'fill'",
  "export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {",
  '  size?: number | string',
  '  weight?: IconWeight',
  '}',
  '',
  'function icon(paths: Partial<Record<IconWeight, string>>) {',
  "  return function Icon({ size = '1em', weight = 'regular', ...rest }: IconProps) {",
  '    const markup = paths[weight] ?? paths.regular ?? Object.values(paths)[0]',
  '    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill="currentColor" {...rest} dangerouslySetInnerHTML={{ __html: markup ?? \'\' }} />',
  '  }',
  '}',
  '',
]
for (const [name, weights] of Object.entries(manifest).sort()) {
  const k = kebab(name)
  const parts = weights.map((w) => {
    const file = w === 'regular'
      ? `node_modules/@phosphor-icons/core/assets/regular/${k}.svg`
      : `node_modules/@phosphor-icons/core/assets/${w}/${k}-${w}.svg`
    return `${w}: ${JSON.stringify(inner(file))}`
  })
  lines.push(`export const ${name} = icon({ ${parts.join(', ')} })`)
}
writeFileSync('src/components/ui/icons.tsx', lines.join('\n') + '\n')
console.log(`${Object.keys(manifest).length} ícones gerados`)
