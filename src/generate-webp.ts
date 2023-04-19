import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import sharp from 'sharp';

const size = Number(process.argv[2] || 400);
const replaceExisting = process.argv[3] === 'replace';

const RAW_GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master';
const REPO_TREE_URL = 'https://api.github.com/repos/PokeAPI/sprites/git/trees/master?recursive=1';

const getArtworkPaths = async () => {
  type Path = { path: string; url: string };
  const paths: Path[] = (await fetch(REPO_TREE_URL).then((res) => res.json())).tree;
  const artworkPaths: string[] = [];
  paths.forEach(({ path }) => {
    if (/^sprites\/pokemon\/other\/official\-artwork\/.+\.\w+/.test(path)) {
      return artworkPaths.push(path);
    }
  });
  return artworkPaths;
};

const generateWebp = async (path: string, destination: string) => {
  const isAlreadyExist = existsSync(`${destination}.webp`);
  if (!replaceExisting && isAlreadyExist) {
    console.log('⚪️ Already exist', destination);
    return true;
  }
  try {
    console.log(isAlreadyExist ? '🟡 Replacing' : '🔵 Generating', destination);
    const image = await fetch(`${RAW_GITHUB_CONTENT_URL}/${path}`).then((res) => res.arrayBuffer());
    await mkdir(dirname(destination), { recursive: true });
    sharp(image).resize(size, size).webp({ quality: 60 }).toFile(`${destination}.webp`);
    console.log('🟢 Generated', destination);
    return true;
  } catch (error) {
    console.error('Failed', path);
    console.error(error);
    return false;
  }
};

(async () => {
  const artworkPaths = await getArtworkPaths();
  await mkdir(`artwork/webp/${size}x${size}`, { recursive: true });
  for (const path of artworkPaths) {
    const [, subfolder, pokemonNumber] = path.match(/artwork\/([a-z]+)?\/?([\w-]+)/);
    const destination = subfolder
      ? `artwork/webp/${size}x${size}/${subfolder}/${pokemonNumber}`
      : `artwork/webp/${size}x${size}/${pokemonNumber}`;
    await generateWebp(path, destination);
  }
})();
