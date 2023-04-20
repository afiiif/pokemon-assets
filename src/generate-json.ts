import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const API_ENDPOINT = 'https://beta.pokeapi.co/graphql/v1beta';
const VERSION = '1.0';

const generateJSON = async (filename: string, content: any, minify?: boolean) => {
  await mkdir(dirname(`data/v${VERSION}${filename}.json`), { recursive: true });
  await writeFile(`data/v${VERSION}${filename}.json`, JSON.stringify(content, null, 2));
  if (minify) {
    await writeFile(`data/v${VERSION}${filename}.min.json`, JSON.stringify(content));
  }
  console.info(`🟢 Generated data/v${VERSION}${filename}.json`);
};

const ITEMS_PER_PAGE = 24;
const generatePaginatedJSON = async (filename: string, data: any[]) => {
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageItems = data.slice(startIndex, endIndex);

    const jsonContent = {
      data: currentPageItems,
      page: currentPage,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
    };

    await generateJSON(`-pg/${filename}_${currentPage}`, jsonContent, true);
  }
};

(async () => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: /* GraphQL */ `
        query PokemonData {
          pokemon_v2_pokemonspecies(order_by: { id: asc }) {
            id
            name
            generation_id
            is_legendary
            is_mythical
            is_baby
            capture_rate
            pokemon_v2_pokemonhabitat {
              id
              name
            }
            pokemon_v2_pokemons {
              id
              name
              pokemon_v2_pokemontypes {
                pokemon_v2_type {
                  name
                }
              }
            }
          }
          pokemon_v2_generation {
            id
            name
          }
          pokemon_v2_type {
            id
            name
          }
          pokemon_v2_pokemonhabitat {
            id
            name
          }
          pokemon_v2_egggroup {
            id
            name
          }
        }
      `,
    }),
  });

  type ResponseJSON = {
    data: {
      pokemon_v2_pokemonspecies: {
        id: number;
        name: string;
        generation_id: number;
        is_legendary: number;
        is_mythical: boolean;
        is_baby: boolean;
        capture_rate: number;
        pokemon_v2_pokemonhabitat: { name: string } | null;
        pokemon_v2_pokemons: {
          id: number;
          name: string;
          pokemon_v2_pokemontypes: {
            pokemon_v2_type: { name: string };
          }[];
        }[];
      }[];
      pokemon_v2_generation: { id: number; name: string }[];
      pokemon_v2_type: { id: number; name: string }[];
      pokemon_v2_pokemonhabitat: { id: number; name: string }[];
      pokemon_v2_egggroup: { id: number; name: string }[];
    };
  };
  const { data } = (await response.json()) as ResponseJSON;

  const pokemons = [];
  const pokemonsByGenAndType = { allGen: {} };
  const pokemonNames = [];

  data.pokemon_v2_pokemonspecies.map((pokemonSpecies) => {
    const pokemon = {
      id: pokemonSpecies.id,
      name: pokemonSpecies.name,
      gen: pokemonSpecies.generation_id,
      isLegendary: pokemonSpecies.is_legendary,
      isMythical: pokemonSpecies.is_mythical,
      isBaby: pokemonSpecies.is_baby,
      captureRate: pokemonSpecies.capture_rate,
      habitat:
        pokemonSpecies.pokemon_v2_pokemonhabitat && pokemonSpecies.pokemon_v2_pokemonhabitat.name,
      pokemons: pokemonSpecies.pokemon_v2_pokemons.map((pokemon) => ({
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.pokemon_v2_pokemontypes.flatMap((type) => type.pokemon_v2_type.name),
      })),

      // Aggregate
      names: pokemonSpecies.pokemon_v2_pokemons.reduce<string[]>((prev, pokemon) => {
        prev.push(pokemon.name);
        pokemonNames.push(pokemon.name);
        return prev;
      }, []),
      types: pokemonSpecies.pokemon_v2_pokemons.reduce<string[]>((prev, pokemon) => {
        pokemon.pokemon_v2_pokemontypes.forEach((type) => {
          if (!prev.includes(type.pokemon_v2_type.name)) prev.push(type.pokemon_v2_type.name);
        });
        return prev;
      }, []),
    };

    pokemons.push(pokemon);

    if (typeof pokemonsByGenAndType[pokemon.gen] === 'undefined') {
      pokemonsByGenAndType[pokemon.gen] = { all: [] };
    }
    pokemonsByGenAndType[pokemon.gen].all.push(pokemon);
    for (const type of pokemon.types) {
      if (typeof pokemonsByGenAndType.allGen[type] === 'undefined') {
        pokemonsByGenAndType.allGen[type] = [];
      }
      pokemonsByGenAndType.allGen[type].push(pokemon);
      if (typeof pokemonsByGenAndType[pokemon.gen][type] === 'undefined') {
        pokemonsByGenAndType[pokemon.gen][type] = [];
      }
      pokemonsByGenAndType[pokemon.gen][type].push(pokemon);
    }
  });

  const metadata = {
    generations: data.pokemon_v2_generation,
    types: data.pokemon_v2_type,
    habitats: data.pokemon_v2_pokemonhabitat,
    egggroups: data.pokemon_v2_egggroup,
  };
  await generateJSON('/pokemon-metadata', metadata);

  await generateJSON('/pokemons', pokemons);
  await generateJSON('/pokemon-names', pokemonNames);

  for (const generation of data.pokemon_v2_generation) {
    await generateJSON(
      `/pokemons/gen-${generation.id}/all`,
      pokemonsByGenAndType[generation.id].all
    );
    for (const type of data.pokemon_v2_type) {
      await generateJSON(
        `/pokemons/gen-${generation.id}/${type.name}`,
        pokemonsByGenAndType[generation.id][type.name] || []
      );
    }
  }
  for (const type of data.pokemon_v2_type) {
    await generateJSON(
      `/pokemons/all-gen/${type.name}`,
      pokemonsByGenAndType.allGen[type.name] || []
    );
  }

  // Paginated

  await generatePaginatedJSON('/pokemons', pokemons);

  for (const generation of data.pokemon_v2_generation) {
    await generatePaginatedJSON(
      `/pokemons/gen-${generation.id}/all`,
      pokemonsByGenAndType[generation.id].all
    );
    for (const type of data.pokemon_v2_type) {
      await generatePaginatedJSON(
        `/pokemons/gen-${generation.id}/${type.name}`,
        pokemonsByGenAndType[generation.id][type.name] || []
      );
    }
  }
  for (const type of data.pokemon_v2_type) {
    await generatePaginatedJSON(
      `/pokemons/all-gen/${type.name}`,
      pokemonsByGenAndType.allGen[type.name] || []
    );
  }

  for (const type of data.pokemon_v2_type) {
    await generatePaginatedJSON(
      `/pokemons/all-gen/${type.name}`,
      pokemonsByGenAndType.allGen[type.name] || []
    );
  }
})();
