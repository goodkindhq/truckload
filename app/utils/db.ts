import { MongoClient } from 'mongodb';

let mongo: MongoClient;

export const getDbInstance = (env: string) => {
  if (mongo) {
    return mongo.db();
  }

  switch (env) {
    case 'dev':
      mongo = new MongoClient(process.env.MONGO_URI_DEV!);
      break;
    case 'qa':
      mongo = new MongoClient(process.env.MONGO_URI_QA!);
      break;
    case 'prod':
      mongo = new MongoClient(process.env.MONGO_URI_PROD!);
      break;
    default:
      throw new Error('Invalid environment');
  }

  return mongo.db();
};
