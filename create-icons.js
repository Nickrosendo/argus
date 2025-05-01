const fs = require('fs');
const { createCanvas } = require('canvas');

// Create icons of various sizes
const sizes = [16, 48, 128];

// Define colors
const primaryColor = '#4a1e8a';  // Purple
const secondaryColor = '#d4af37'; // Gold

// Create icons
sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Calculate scaling factor based on size
  const scale = size / 128;
  
  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Transparent background
  ctx.fillRect(0, 0, size, size);
  
  // Border
  const borderWidth = Math.max(1, Math.round(8 * scale));
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = primaryColor;
  ctx.strokeRect(
    Math.round(4 * scale), 
    Math.round(4 * scale), 
    size - Math.round(8 * scale), 
    size - Math.round(8 * scale)
  );
  
  // Greek key patterns in corners
  ctx.fillStyle = primaryColor;
  
  // Top-left
  ctx.fillRect(
    Math.round(4 * scale), 
    Math.round(4 * scale), 
    Math.round(20 * scale), 
    Math.round(8 * scale)
  );
  ctx.fillRect(
    Math.round(4 * scale), 
    Math.round(4 * scale), 
    Math.round(8 * scale), 
    Math.round(20 * scale)
  );
  
  // Top-right
  ctx.fillRect(
    size - Math.round(24 * scale), 
    Math.round(4 * scale), 
    Math.round(20 * scale), 
    Math.round(8 * scale)
  );
  ctx.fillRect(
    size - Math.round(12 * scale), 
    Math.round(4 * scale), 
    Math.round(8 * scale), 
    Math.round(20 * scale)
  );
  
  // Bottom-left
  ctx.fillRect(
    Math.round(4 * scale), 
    size - Math.round(12 * scale), 
    Math.round(8 * scale), 
    Math.round(8 * scale)
  );
  ctx.fillRect(
    Math.round(4 * scale), 
    size - Math.round(24 * scale), 
    Math.round(8 * scale), 
    Math.round(12 * scale)
  );
  
  // Bottom-right
  ctx.fillRect(
    size - Math.round(12 * scale), 
    size - Math.round(12 * scale), 
    Math.round(8 * scale), 
    Math.round(8 * scale)
  );
  ctx.fillRect(
    size - Math.round(12 * scale), 
    size - Math.round(24 * scale), 
    Math.round(8 * scale), 
    Math.round(12 * scale)
  );
  
  // Draw central eye
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Eye rays
  ctx.lineWidth = Math.max(1, Math.round(5 * scale));
  ctx.lineCap = 'round';
  ctx.strokeStyle = primaryColor;
  
  // Only draw rays for larger icons
  if (size >= 48) {
    // Draw rays
    const rayLength = Math.round(20 * scale);
    const rayStart = Math.round(40 * scale);
    const rayPositions = [
      [0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], 
      [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7]
    ];
    
    rayPositions.forEach(([dirX, dirY]) => {
      ctx.beginPath();
      ctx.moveTo(
        centerX + dirX * rayStart,
        centerY + dirY * rayStart
      );
      ctx.lineTo(
        centerX + dirX * rayLength,
        centerY + dirY * rayLength
      );
      ctx.stroke();
    });
  }
  
  // Main eye
  const eyeWidth = Math.round(20 * scale);
  const eyeHeight = Math.round(12 * scale);
  
  // Eye outline
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.lineWidth = Math.max(1, Math.round(4 * scale));
  ctx.strokeStyle = primaryColor;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Iris
  const irisRadius = Math.round(8 * scale);
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, irisRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Pupil
  const pupilRadius = Math.round(2 * scale);
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // For larger icons, add the corner eyes
  if (size >= 48) {
    const smallEyePositions = [
      [32, 32], [96, 32], [32, 96], [96, 96]
    ];
    
    smallEyePositions.forEach(([x, y]) => {
      const eyeX = Math.round(x * scale);
      const eyeY = Math.round(y * scale);
      const smallEyeWidth = Math.round(12 * scale);
      const smallEyeHeight = Math.round(8 * scale);
      
      // Eye outline
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, smallEyeWidth, smallEyeHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.lineWidth = Math.max(1, Math.round(3 * scale));
      ctx.strokeStyle = primaryColor;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, smallEyeWidth, smallEyeHeight, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // Iris
      const smallIrisRadius = Math.round(5 * scale);
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, smallIrisRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Pupil
      const smallPupilRadius = Math.max(1, Math.round(1.5 * scale));
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, smallPupilRadius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  // Save the icon
  const buffer = canvas.toBuffer('image/png');
  
  // Ensure the directory exists
  if (!fs.existsSync('./icons')) {
    fs.mkdirSync('./icons', { recursive: true });
  }
  
  fs.writeFileSync(`./icons/icon${size}.png`, buffer);
  console.log(`Created icon${size}.png`);
});

console.log('Icon generation completed.'); 