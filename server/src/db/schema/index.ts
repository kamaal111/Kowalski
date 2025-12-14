import * as schema from './better-auth.js';
import * as stocksSchema from './stocks.js';
import * as portfolioSchema from './portfolio.js';
import * as forexSchema from './forex.js';

export default { ...schema, ...stocksSchema, ...portfolioSchema, ...forexSchema };
