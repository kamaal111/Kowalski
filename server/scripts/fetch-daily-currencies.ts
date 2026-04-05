import db from '../src/db';
import {
  collectLatestExchangeRates,
  getCurrentCollectionDay,
  getLatestCollectedAt,
} from '../src/forex/services/collect';

async function main() {
  const targetCollectionDay = getCurrentCollectionDay();
  const latestCollectedAt = await getLatestCollectedAt(db);
  if (latestCollectedAt == null) {
    console.log('No forex snapshot has been stored yet.');
  } else {
    console.log(`Latest local forex fetch day: ${getCurrentCollectionDay(latestCollectedAt)}`);
  }

  const result = await collectLatestExchangeRates({
    db,
    latestCollectedAt,
    targetCollectionDay,
  });
  if (result.status === 'skipped') {
    console.log(`Skipping daily currency fetch for ${result.targetCollectionDay}; data is already up to date.`);
    return;
  }

  if (result.status === 'no-data') {
    console.error(`No exchange rates were found for ${result.targetCollectionDay}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Stored ${result.storedItems.length} forex rows for ${result.exchangeRate.dateString}.`);
}

await main();
