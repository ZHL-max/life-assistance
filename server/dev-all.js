import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = [
  spawn(npmCommand, ['run', 'connector'], { stdio: 'inherit', shell: true }),
  spawn(npmCommand, ['run', 'dev'], { stdio: 'inherit', shell: true }),
]

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

for (const child of children) {
  child.on('exit', code => {
    if (code && code !== 0) {
      stopAll()
      process.exit(code)
    }
  })
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopAll()
  process.exit(0)
})
