const AAVE_GRAPHQL = 'https://api.v3.aave.com/graphql';
const CHAIN_ID_MAP = { ethereum: 1, arbitrum: 42161, base: 8453 };

function json(statusCode, body) {
 return {
 statusCode,
 headers: {
 'content-type': 'application/json',
 'access-control-allow-origin': '*'
 },
 body: JSON.stringify(body)
 };
}

async function gql(query, variables) {
 const res = await fetch(AAVE_GRAPHQL, {
 method: 'POST',
 headers: { 'content-type': 'application/json' },
 body: JSON.stringify({ query, variables })
 });

 const data = await res.json();
 if (data.errors) {
 throw new Error(data.errors[0]?.message || 'Aave GraphQL error');
 }
 return data.data;
}

exports.handler = async (event) => {
 try {
 const { wallet, chain = 'arbitrum' } = JSON.parse(event.body || '{}');

 if (!wallet || !wallet.startsWith('0x')) {
 return json(400, { error: 'Нужен EVM-адрес 0x...' });
 }

 const chainId = CHAIN_ID_MAP[chain];
 if (!chainId) {
 return json(400, { error: 'Aave adapter поддерживает ethereum, arbitrum, base' });
 }

 const marketsQuery = `
 query Markets($request: MarketsRequest!) {
 markets(request: $request) {
 address
 name
 chain { chainId name }
 }
 }
 `;

 const marketsData = await gql(marketsQuery, {
 request: { chainIds: [chainId], user: wallet }
 });

 const markets = (marketsData.markets || []).filter(
 m => m.chain?.chainId === chainId
 );

 if (!markets.length) {
 return json(200, {
 protocol: 'Aave V3',
 chain,
 suppliedUSD: 0,
 borrowedUSD: 0,
 collateralUSD: 0,
 healthFactor: null,
 assets: [],
 note: 'Market не найден'
 });
 }

 const market = markets[0];

 const stateQuery = `
 query UserMarketState($request: UserMarketStateRequest!) {
 userMarketState(request: $request) {
 borrowableUsd
 collateralUsd
 debtUsd
 netWorthUsd
 availableBorrowsUsd
 healthFactor
 }
 }
 `;

 const suppliesQuery = `
 query UserSupplies($request: UserSuppliesRequest!) {
 userSupplies(request: $request) {
 amount { value }
 reserve {
 underlyingToken { symbol }
 price { usd }
 }
 isCollateral
 }
 }
 `;

 const borrowsQuery = `
 query UserBorrows($request: UserBorrowsRequest!) {
 userBorrows(request: $request) {
 amount { value }
 reserve {
 underlyingToken { symbol }
 price { usd }
 }
 }
 }
 `;

 const orderBy = { date: 'DESC' };

 const [stateData, suppliesData, borrowsData] = await Promise.all([
 gql(stateQuery, {
 request: { market: market.address, user: wallet, chainId }
 }),
 gql(suppliesQuery, {
 request: {
 markets: [market.address],
 user: wallet,
 collateralsOnly: false,
 orderBy
 }
 }).catch(() => ({ userSupplies: [] })),
 gql(borrowsQuery, {
 request: {
 markets: [market.address],
 user: wallet,
 orderBy
 }
 }).catch(() => ({ userBorrows: [] }))
 ]);

 const state = stateData.userMarketState || {};

 const supplyAssets = (suppliesData.userSupplies || []).map(x => ({
 symbol: x.reserve?.underlyingToken?.symbol || '?',
 role: x.isCollateral ? 'collateral' : 'supply',
 amount: x.amount?.value || null,
 usdValue:
 x.reserve?.price?.usd && x.amount?.value
 ? Number(x.reserve.price.usd) * Number(x.amount.value)
 : null
 }));

 const borrowAssets = (borrowsData.userBorrows || []).map(x => ({
 symbol: x.reserve?.underlyingToken?.symbol || '?',
 role: 'borrow',
 amount: x.amount?.value || null,
 usdValue:
 x.reserve?.price?.usd && x.amount?.value
 ? Number(x.reserve.price.usd) * Number(x.amount.value)
 : null
 }));

 return json(200, {
 protocol: 'Aave V3',
 chain,
 market: {
 address: market.address,
 name: market.name,
 chainId
 },
 suppliedUSD: Number(state.collateralUsd || 0),
 borrowedUSD: Number(state.debtUsd || 0),
 collateralUSD: Number(state.collateralUsd || 0),
 healthFactor: state.healthFactor ?? null,
 borrowableUSD: Number(state.borrowableUsd || 0),
 netWorthUSD: Number(state.netWorthUsd || 0),
 assets: [...supplyAssets, ...borrowAssets]
 });

 } catch (e) {
 return json(500, { error: e.message || 'Server error' });
 }
};
