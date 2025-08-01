/**
 * Directory Score
 */
import { Library } from '~/types';

// This is an array of modifier objects. Each modifier has a name, value, and condition.
// The data is passed to condition function, and if it returns true, the value is added to the
// libraries score. Read more: https://reactnative.directory/scoring
const MODIFIERS = [
  {
    name: 'Very popular',
    value: 45,
    condition: data => getCombinedPopularity(data) > 50000,
  },
  {
    name: 'Popular',
    value: 30,
    condition: data => getCombinedPopularity(data) > 10000,
  },
  {
    name: 'Known',
    value: 15,
    condition: data => getCombinedPopularity(data) > 2500,
  },
  {
    name: 'Lots of open issues',
    value: -20,
    condition: data => data.github.stats.issues >= 75,
  },
  {
    name: 'No license',
    value: -20,
    condition: data => data.license === null,
  },
  {
    name: 'GPL license',
    value: -20,
    condition: data =>
      data.license &&
      data.license.key &&
      (data.license.key.startsWith('gpl') || data.license.key.startsWith('other')),
  },
  {
    name: 'Recently updated',
    value: 10,
    condition: data => getUpdatedDaysAgo(data) <= 30, // Roughly 1 month
  },
  {
    name: 'Not updated recently',
    value: -20,
    condition: data => getUpdatedDaysAgo(data) >= 180, // Roughly 6 months
  },
  {
    name: 'Not supporting New Architecture',
    value: -5,
    condition: data => !data.newArchitecture || !data.github.newArchitecture,
  },
];

const DAY_IN_MS = 864e5;

// Calculate the minimum and maximum possible scores based on the modifiers
const minScore = MODIFIERS.reduce((currentMin, modifier) => {
  return modifier.value < 0 ? currentMin + modifier.value : currentMin;
}, 0);

const maxScore = MODIFIERS.reduce((currentMax, modifier) => {
  return modifier.value > 0 ? currentMax + modifier.value : currentMax;
}, 0);

export const calculateDirectoryScore = data => {
  // Filter the modifiers to the ones which conditions pass with the data
  const matchingModifiers = MODIFIERS.filter(modifier => modifier.condition(data));

  // Reduce the matching modifiers to find the raw score for the data
  const rawScore = matchingModifiers.reduce((currentScore, modifier) => {
    return currentScore + modifier.value;
  }, 0);

  // Scale the raw score as a percentage between the minimum and maximum possible score
  // based on the available modifiers
  const score = Math.round(((rawScore - minScore) / (maxScore - minScore)) * 100);

  // Map the modifiers to the name so we can include that in the data
  const matchingModifierNames = matchingModifiers.map(modifier => modifier.name);

  return {
    ...data,
    score,
    matchingScoreModifiers: matchingModifierNames,
  };
};

const getCombinedPopularity = data => {
  const { subscribers, forks, stars } = data.github.stats;
  const { downloads } = data.npm;
  return subscribers * 50 + forks * 25 + stars * 10 + downloads / 100;
};

const getUpdatedDaysAgo = data => {
  const { updatedAt } = data.github.stats;
  const updateDate = new Date(updatedAt).getTime();
  const currentDate = new Date().getTime();

  return (currentDate - updateDate) / DAY_IN_MS;
};

/**
 * Trending Score
 */

const MIN_MONTHLY_DOWNLOADS = 500;
const MANY_MONTHLY_DOWNLOADS = 5000;
const MIN_GITHUB_STARS = 25;
const DATE_NOW = Date.now();
const WEEK_IN_MS = 6048e5;

export function calculatePopularityScore(data: Library) {
  const {
    npm: { downloads },
    github,
    unmaintained,
  } = data;

  if (!downloads) {
    return {
      ...data,
      popularity: -100,
    };
  }

  const { createdAt, stars } = github.stats;

  // Figure out better way to determine popularity gain, since with amount of libraries
  // we list, we are hitting npm API limits when fetching twice, for each entry
  const popularityGain = (Math.floor(downloads / 4) - Math.floor(downloads / 4.5)) / downloads;

  const downloadsPenalty = downloads < MIN_MONTHLY_DOWNLOADS ? 0.25 : 0;
  const starsPenalty = stars < MIN_GITHUB_STARS ? 0.1 : 0;
  const unmaintainedPenalty = unmaintained ? 0.5 : 0;
  const freshPackagePenalty = DATE_NOW - new Date(createdAt).getTime() < WEEK_IN_MS ? 0.5 : 0;

  const downloadBonus = popularityGain > 0.25 ? (downloads > MANY_MONTHLY_DOWNLOADS ? 5 : 0) : 0;

  const popularity = parseFloat(
    (
      popularityGain -
      downloadsPenalty -
      unmaintainedPenalty -
      starsPenalty -
      freshPackagePenalty +
      downloadBonus
    ).toFixed(3)
  );

  return {
    ...data,
    popularity,
  };
}
