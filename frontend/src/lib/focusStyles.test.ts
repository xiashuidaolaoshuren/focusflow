/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// Vitest runs from the frontend package root.
const SRC_DIR = resolve(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    const isSource = /\.(ts|tsx)$/.test(name)
    const isTest = /\.test\.(ts|tsx)$/.test(name)
    return isSource && !isTest ? [path] : []
  })
}

describe('focus indicators', () => {
  it('never pairs outline-none with a focus-visible outline (Tailwind v4 draws no ring)', () => {
    const offenders = sourceFiles(SRC_DIR).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(
          ({ line }) =>
            /\boutline-none\b/.test(line) && /focus-visible:outline-/.test(line),
        )
        .map(({ index }) => `${relative(SRC_DIR, file)}:${index + 1}`),
    )

    expect(offenders).toEqual([])
  })

  it('gives every focus-visible outline an explicit solid style (outline-hidden sets it to none)', () => {
    const offenders = sourceFiles(SRC_DIR).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(
          ({ line }) =>
            /focus-visible:outline-2\b/.test(line) &&
            !/focus-visible:outline-solid\b/.test(line),
        )
        .map(({ index }) => `${relative(SRC_DIR, file)}:${index + 1}`),
    )

    expect(offenders).toEqual([])
  })
})
