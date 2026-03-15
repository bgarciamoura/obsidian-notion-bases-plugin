#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const bump = process.argv[2] || 'patch'

if (!['patch', 'minor', 'major'].includes(bump)) {
	console.error(`Usage: node release.mjs [patch|minor|major]  (default: patch)`)
	process.exit(1)
}

// Read current version from manifest.json
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
const [major, minor, patch] = manifest.version.split('.').map(Number)

const next =
	bump === 'major' ? `${major + 1}.0.0` :
	bump === 'minor' ? `${major}.${minor + 1}.0` :
	                    `${major}.${minor}.${patch + 1}`

// Update manifest.json
manifest.version = next
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t') + '\n')

// Update versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'))
versions[next] = manifest.minAppVersion
writeFileSync('versions.json', JSON.stringify(versions, null, '\t') + '\n')

console.log(`${manifest.version}`)

// Type-check before proceeding
console.log('Running type-check...')
try {
	execSync('npx tsc -noEmit -skipLibCheck', { stdio: 'inherit' })
} catch {
	console.error('Type-check failed. Fix errors before releasing.')
	process.exit(1)
}

// Git: commit, tag, push
execSync(`git add manifest.json versions.json`, { stdio: 'inherit' })
execSync(`git commit -m "chore: bump version to ${next}"`, { stdio: 'inherit' })
execSync(`git tag ${next}`, { stdio: 'inherit' })
execSync(`git push && git push origin ${next}`, { stdio: 'inherit' })

console.log(`Release ${next} pushed. GitHub Actions will create the release.`)
