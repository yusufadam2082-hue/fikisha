import { execSync } from 'node:child_process';

const highConfidencePatterns = [
  'sk_live_[0-9A-Za-z]{16,}',
  'rk_live_[0-9A-Za-z]{16,}',
  'pk_live_[0-9A-Za-z]{16,}',
  'AIza[0-9A-Za-z_-]{35}',
  'SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}',
  'xox[baprs]-[A-Za-z0-9-]{10,}',
  'ghp_[A-Za-z0-9]{20,}',
  'AKIA[0-9A-Z]{16}',
  'ASIA[0-9A-Z]{16}',
  '-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----',
  'aws_secret_access_key'
];

const commandForPattern = (pattern) => `git grep -nEI -e "${pattern}" -- .`;

let foundAny = false;

for (const pattern of highConfidencePatterns) {
  try {
    const output = execSync(commandForPattern(pattern), {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();

    if (output) {
      foundAny = true;
      console.error(`\n[secret-scan] Potential secret match for pattern: ${pattern}`);
      console.error(output);
    }
  } catch (error) {
    // git grep returns exit code 1 when there are no matches.
    if (error.status !== 1) {
      console.error(`\n[secret-scan] Scan command failed for pattern: ${pattern}`);
      console.error(error.message || error);
      process.exit(2);
    }
  }
}

if (foundAny) {
  console.error('\n[secret-scan] Potential secrets detected. Remove/rotate before commit.');
  process.exit(1);
}

console.log('[secret-scan] No high-confidence secrets found in tracked files.');
