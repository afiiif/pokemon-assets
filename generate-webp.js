const { mkdirSync, existsSync } = require('node:fs');

const fetch = require('node-fetch');
const sharp = require('sharp');

const GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master';

mkdirSync('artwork/webp/400x400', { recursive: true });
mkdirSync('artwork/webp/128x128', { recursive: true });

fetch('https://api.github.com/repos/PokeAPI/sprites/git/trees/master?recursive=1').then((res) => {
  res.json().then((data) => {
    const images = data.tree.filter(({ path }) =>
      path.startsWith('sprites/pokemon/other/official-artwork/')
    );

    Promise.all(
      images.map(
        ({ path }) =>
          new Promise((resolve) => {
            const filename = path.split('/').splice(-1)[0].split('.')[0];

            if (
              existsSync(`./artwork/webp/400x400/${filename}.webp`) &&
              existsSync(`./artwork/webp/128x128/${filename}.webp`)
            ) {
              resolve();
              return;
            }

            // Workaround using timeout to resolve, because bug node-fetch buffer() not resolving
            setTimeout(() => {
              resolve();
            }, 1000 * 60);

            fetch(`${GITHUB_CONTENT_URL}/${path}`)
              .then((res) =>
                res
                  .buffer()
                  .then((buffer) =>
                    Promise.all([
                      sharp(buffer)
                        .resize(400, 400)
                        .webp({ quality: 60 })
                        .toFile(`./artwork/webp/400x400/${filename}.webp`),
                      sharp(buffer)
                        .resize(128, 128)
                        .webp({ quality: 60 })
                        .toFile(`./artwork/webp/128x128/${filename}.webp`),
                    ]).then(() => {
                      console.log(`Pokemon ${filename} images generated`);
                    })
                  )
                  .catch(() => {
                    console.log(`Error buffer pokemon ${filename}`);
                  })
              )
              .catch(() => {
                console.log(`Error fetch pokemon ${filename}`);
              });
          })
      )
    ).then(() => {
      console.log('Finished');
      process.exit();
    });
  });
});
