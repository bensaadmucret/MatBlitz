#!/usr/bin/env node
/**
 * Script pour générer le logo MatBlitz
 * Crée un SVG et le convertit en PNG avec différentes tailles
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// SVG Logo MatBlitz - Un éclair stylisé avec une pièce d'échecs
const svgLogo = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Gradient électrique -->
    <linearGradient id="boltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="50%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
    <!-- Gradient fond -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#312e81"/>
    </linearGradient>
    <!-- Ombre portée -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="4" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Fond circulaire -->
  <circle cx="256" cy="256" r="240" fill="url(#bgGradient)"/>
  
  <!-- Bordure -->
  <circle cx="256" cy="256" r="240" fill="none" stroke="#fbbf24" stroke-width="8"/>
  
  <!-- Éclair stylisé (symbole MatBlitz) -->
  <g transform="translate(256, 256)" filter="url(#shadow)">
    <!-- Éclair principal -->
    <path d="
      M -20 -80
      L 40 -10
      L 0 -10
      L 30 80
      L -50 0
      L -10 0
      Z
    " fill="url(#boltGradient)" stroke="#fff" stroke-width="3"/>
    
    <!-- Cercle électrique autour -->
    <circle cx="0" cy="0" r="120" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.3"/>
    <circle cx="0" cy="0" r="100" fill="none" stroke="#fbbf24" stroke-width="1" opacity="0.2"/>
  </g>
  
  <!-- Étoiles décoratives -->
  <g fill="#fbbf24" opacity="0.6">
    <circle cx="100" cy="120" r="4"/>
    <circle cx="420" cy="150" r="3"/>
    <circle cx="400" cy="380" r="5"/>
    <circle cx="80" cy="350" r="3"/>
    <circle cx="180" cy="80" r="2"/>
    <circle cx="350" cy="100" r="2"/>
  </g>
</svg>`

// Générer différentes tailles de PNG
const sizes = [
  32, 128, 256, 512
]

console.log('🎨 Génération du logo MatBlitz...')

// Sauvegarder le SVG source
const svgPath = path.join(__dirname, '../src-tauri/icons/icon.svg')
fs.writeFileSync(svgPath, svgLogo)
console.log('✅ SVG sauvegardé:', svgPath)

// Pour les formats PNG, ICO, ICNS, il faudrait utiliser une bibliothèque comme sharp
// Mais pour l'instant, on sauvegarde le SVG qui peut être converti manuellement

console.log('\n📋 Instructions:')
console.log('1. Ouvrez icon.svg dans un navigateur ou un éditeur d\'image')
console.log('2. Exportez en PNG 512x512 (icon.png)')
console.log('3. Utilisez tauri icon pour générer tous les formats:')
console.log('   npx tauri icon src-tauri/icons/icon.png')
console.log('\nOu utilisez un convertisseur en ligne:')
console.log('   https://convertio.fr/svg-png/')
