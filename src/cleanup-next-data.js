const fs = require('fs');
const path = require('path');

function removeFiles(dir) {
  // Read the contents of the directory
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error(`Error reading directory ${dir}: ${err.message}`);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(dir, file);

      fs.stat(filePath, (err, stat) => {
        if (err) {
          console.error(`Error stating file ${filePath}: ${err.message}`);
          return;
        }

        if (stat.isDirectory()) {
          // If it's a directory, recurse
          removeFiles(filePath);
        } else {
          // If it's a file, check the conditions
          if (!file.endsWith('.json') || file.endsWith('.nft.json')) {
            fs.unlink(filePath, (err) => {
              if (err) {
                console.error(`Error deleting file ${filePath}: ${err.message}`);
              } else {
                console.log(`Deleted file ${filePath}`);
              }
            });
          }
        }
      });
    });
  });
}

const directoryToClean = './next-data/20240515';
removeFiles(directoryToClean);
