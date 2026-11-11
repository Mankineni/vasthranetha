// Creates an owner account, or resets a forgotten password. Run on the server:
//   npm run create-owner -- --name "Asha" --login "asha@example.com"
//   npm run create-owner -- --login "asha@example.com" --reset
// The password is asked for and not shown while typing. A reset signs the owner out everywhere.
import { getDb } from '@/db/client'
import { createOwner, resetPassword } from '@/lib/auth/sessions'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      // Piped input (for example from a password manager): read one line.
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (c) => (data += c))
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0]))
      stdin.on('error', reject)
      return
    }
    process.stdout.write(question)
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          process.stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const name = arg('name')
  const login = arg('login')
  const reset = process.argv.includes('--reset')
  if (!login || (!reset && !name)) {
    console.error('Usage: npm run create-owner -- --name "Asha" --login "asha@example.com"')
    console.error('       npm run create-owner -- --login "asha@example.com" --reset')
    process.exit(1)
  }
  const password = await askHidden(reset ? 'New password (at least 10 characters): ' : 'Password (at least 10 characters): ')
  if (process.stdin.isTTY) {
    const again = await askHidden('Repeat password: ')
    if (again !== password) throw new Error('The passwords do not match.')
  }
  if (reset) {
    await resetPassword(getDb(), login, password)
    console.log(`Password for ${login} changed. They are signed out on every device.`)
    return
  }
  const { id } = await createOwner(getDb(), { name: name!, login, password })
  console.log(`Owner ${name} created (id ${id}). Sign in at /admin/login.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
