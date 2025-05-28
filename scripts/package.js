const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Parse command line arguments
const args = process.argv.slice(2);
const buildChrome = args.includes('--chrome') || !args.length;
const buildFirefox = args.includes('--firefox') || !args.length;

// Function to create a zip archive
function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create a file to stream archive data to
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Listen for all archive data to be written
    output.on('close', () => {
      console.log(`Archive created: ${outputPath}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve();
    });

    // Warning event
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn(err);
      } else {
        reject(err);
      }
    });

    // Error event
    archive.on('error', (err) => {
      reject(err);
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Append files from a directory
    archive.directory(sourceDir, false);

    // Finalize the archive
    archive.finalize();
  });
}

// Main function
async function main() {
  console.log('Packaging extensions...');

  try {
    if (buildChrome) {
      const chromeSourceDir = path.resolve(__dirname, '../dist/chrome');
      const chromeOutputPath = path.resolve(__dirname, '../dist/argus-chrome.zip');
      
      console.log('Packaging Chrome extension...');
      await createZip(chromeSourceDir, chromeOutputPath);
    }

    if (buildFirefox) {
      const firefoxSourceDir = path.resolve(__dirname, '../dist/firefox');
      const firefoxOutputPath = path.resolve(__dirname, '../dist/argus-firefox.zip');
      
      console.log('Packaging Firefox extension...');
      await createZip(firefoxSourceDir, firefoxOutputPath);
    }

    console.log('Packaging complete!');
  } catch (error) {
    console.error('Error packaging extensions:', error);
    process.exit(1);
  }
}

// Run the script
main(); 