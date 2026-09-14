#!/usr/bin/env node
/**
 * Cross-platform Backend Development Runner for Argus Monorepo
 * Automatically detects virtual environments or system Python and launches
 * Uvicorn with hot reloading targeted at the `backend` directory.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function resolvePythonExecutable() {
  // 1. Explicit env override
  if (process.env.PYTHON && fs.existsSync(process.env.PYTHON)) {
    return process.env.PYTHON;
  }

  // 2. Local virtual environment (.venv or venv)
  const candidateVenvs = [
    path.join(ROOT_DIR, '.venv', 'Scripts', 'python.exe'),
    path.join(ROOT_DIR, '.venv', 'bin', 'python'),
    path.join(ROOT_DIR, 'venv', 'Scripts', 'python.exe'),
    path.join(ROOT_DIR, 'venv', 'bin', 'python'),
  ];

  for (const candidate of candidateVenvs) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 3. System PATH candidates
  const systemCandidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  for (const cmd of systemCandidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {
      // Continue searching
    }
  }

  // Default fallback
  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonBin = resolvePythonExecutable();
const args = [
  '-m',
  'uvicorn',
  'backend.main:app',
  '--host',
  '127.0.0.1',
  '--port',
  '8000',
  '--reload',
  '--reload-dir',
  'backend',
];

console.log(`[backend] Starting FastAPI server using: ${pythonBin}`);

const child = spawn(pythonBin, args, {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// Forward termination signals
const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
signals.forEach((signal) => {
  process.on(signal, () => {
    if (child && !child.killed) {
      child.kill(signal);
    }
  });
});

child.on('exit', (code, signal) => {
  if (code !== null) {
    process.exit(code);
  } else if (signal) {
    process.kill(process.pid, signal);
  }
});
