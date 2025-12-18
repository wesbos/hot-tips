// Sine Wave Configuration - All variables can be changed
const sineWaveConfig = {
  amplitude: 100,       // How wide the wave oscillates (in pixels)
  frequency: 2,         // Number of complete waves
  points: 100,          // Number of points to generate (higher = smoother)
  phase: 0,             // Starting phase offset (in radians, 0 to 2π)
  offsetX: 150,         // Horizontal offset from the left (centers the wave)
  strokeWidth: 2,       // Width of the visible path stroke
  strokeColor: '#ff6b6b', // Color of the path
  showPath: true,       // Whether to show the path visually
};

// Get height dynamically (viewport height)
function getHeight(): number {
  return window.innerHeight;
}

// Generate SVG path data for a vertical sine wave
function generateVerticalSineWavePath(config: typeof sineWaveConfig): string {
  const { amplitude, frequency, points, phase, offsetX } = config;
  const height = getHeight();

  const pathPoints: string[] = [];

  for (let i = 0; i <= points; i++) {
    const t = i / points; // Normalized position (0 to 1)
    const y = t * height;
    const x = offsetX + amplitude * Math.sin(frequency * 2 * Math.PI * t + phase);

    if (i === 0) {
      pathPoints.push(`M ${x} ${y}`);
    } else {
      pathPoints.push(`L ${x} ${y}`);
    }
  }

  return pathPoints.join(' ');
}

// Create and inject the SVG element
function createSineWaveSVG(config: typeof sineWaveConfig): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const pathData = generateVerticalSineWavePath(config);
  const height = getHeight();

  // Set SVG dimensions to accommodate the wave
  const svgWidth = config.offsetX + config.amplitude + 50;

  svg.setAttribute('width', String(svgWidth));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${height}`);
  svg.id = 'sine-wave-svg';

  // Create the path element
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', config.showPath ? config.strokeColor : 'transparent');
  path.setAttribute('stroke-width', String(config.strokeWidth));
  path.id = 'sine-wave-path';

  svg.appendChild(path);

  return svg;
}

// Get the path data string for use with offset-path
function getSineWavePathData(): string {
  return generateVerticalSineWavePath(sineWaveConfig);
}

// Initialize the sine wave
function initSineWave() {
  const svg = createSineWaveSVG(sineWaveConfig);

  // Insert SVG at the beginning of body
  document.body.insertBefore(svg, document.body.firstChild);

  // Set the path as a CSS variable on .cards
  const cardsContainer = document.querySelector('.cards') as HTMLElement;
  const pathData = getSineWavePathData();

  if (cardsContainer) {
    cardsContainer.style.setProperty('--path', `path('${pathData}')`);
    cardsContainer.style.setProperty('--amplitude', String(sineWaveConfig.amplitude));
  }

  // Log the path data for debugging/copying
  console.log('Sine Wave Path Data:', pathData);
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSineWave);
} else {
  initSineWave();
}

// Export config for external manipulation
(window as any).sineWaveConfig = sineWaveConfig;
(window as any).regenerateSineWave = () => {
  // Remove existing SVG
  const existingSvg = document.getElementById('sine-wave-svg');
  if (existingSvg) {
    existingSvg.remove();
  }
  // Reinitialize
  initSineWave();
};

// Setup slider controls
function initControls() {
  const amplitudeSlider = document.getElementById('amplitude') as HTMLInputElement;
  const amplitudeOutput = document.querySelector('output[for="amplitude"]') as HTMLOutputElement;

  if (amplitudeSlider && amplitudeOutput) {
    amplitudeSlider.addEventListener('input', () => {
      const value = Number(amplitudeSlider.value);
      amplitudeOutput.textContent = String(value);
      sineWaveConfig.amplitude = value;
      (window as any).regenerateSineWave();
    });
  }
}

// Run controls setup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initControls);
} else {
  initControls();
}

