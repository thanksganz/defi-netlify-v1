// Aave V3 - реальная интеграция через TheGraph
const AAVE_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum';

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(body)
  };
}

async function fetchSubgraph(query, variables) {
  const response = await fetch(AAVE_SUBGRAPH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  
  if (!response.ok) {
    throw new Error(`Subgraph error: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL error');
  }
  return data.data;
}

exports.handler = async function(event, context) {
  try {
    var body = JSON.parse(event.body || '{}');
    var wallet = body.wallet;
    var chain = body.chain || 'arbitrum';

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    var walletLower = wallet.toLowerCase();

    // Запрос позиций пользователя
    const query = `
      query UserReserves($userAddress: String!) {
        userReserves(where: {user: $userAddress}) {
          id
          reserve {
            symbol
            name
            decimals
            underlyingAsset
            price {
              priceInEth
            }
            baseLTVasCollateral
          }
          currentATokenBalance
          currentVariableDebt
          currentStableDebt
          usageAsCollateralEnabledOnUser
        }
        userTransactions(where: {user: $userAddress}, orderBy: timestamp, orderDirection: desc, first: 1) {
          id
        }
      }
    `;

    const data = await fetchSubgraph(query, { userAddress: walletLower });
    
    if (!data || !data.userReserves || data.userReserves.length === 0) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        collateralUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        note: 'Нет активных позиций в Aave V3 на Arbitrum'
      });
    }

    let suppliedUSD = 0;
    let borrowedUSD = 0;
    let collateralUSD = 0;
    const assets = [];
    const borrows = [];

    // ETH price in USD (примерно, для расчетов)
    const ethPriceUSD = 3500;

    for (const r of data.userReserves) {
      const reserve = r.reserve;
      const decimals = parseInt(reserve.decimals || '18');
      
      // Supply
      const supplyRaw = r.currentATokenBalance;
      const supplyAmount = supplyRaw / Math.pow(10, decimals);
      
      // Borrow (variable + stable)
      const borrowVariable = r.currentVariableDebt / Math.pow(10, decimals);
      const borrowStable = r.currentStableDebt / Math.pow(10, decimals);
      const borrowAmount = borrowVariable + borrowStable;
      
      // Price calculation
      let priceUSD = 0;
      if (reserve.price && reserve.price.priceInEth) {
        const priceInEth = parseFloat(reserve.price.priceInEth) / Math.pow(10, 18);
        priceUSD = priceInEth * ethPriceUSD;
      }
      
      // Fallback prices for common tokens
      if (priceUSD === 0) {
        const fallbackPrices = {
          'USDC': 1, 'USDT': 1, 'DAI': 1, 'USD₮0': 1,
          'WETH': 3500, 'ETH': 3500,
          'WBTC': 65000, 'BTC': 65000,
          'ARB': 0.13, 'LINK': 15, 'UNI': 7
        };
        priceUSD = fallbackPrices[reserve.symbol] || 0;
      }

      const supplyValue = supplyAmount * priceUSD;
      const borrowValue = borrowAmount * priceUSD;

      suppliedUSD += supplyValue;
      borrowedUSD += borrowValue;
      
      if (r.usageAsCollateralEnabledOnUser && supplyAmount > 0) {
        const ltv = parseFloat(reserve.baseLTVasCollateral || '0') / 10000;
        collateralUSD += supplyValue * ltv;
      }

      if (supplyAmount > 0.0001) {
        assets.push({
          symbol: reserve.symbol,
          role: r.usageAsCollateralEnabledOnUser ? 'collateral' : 'supply',
          amount: supplyAmount.toFixed(4),
          usdValue: supplyValue
        });
      }

      if (borrowAmount > 0.0001) {
        borrows.push({
          symbol: reserve.symbol,
          amount: borrowAmount.toFixed(4),
          usdValue: borrowValue
        });
      }
    }

    // Calculate Health Factor
    let healthFactor = null;
    if (borrowedUSD > 0 && collateralUSD > 0) {
      healthFactor = (collateralUSD / borrowedUSD).toFixed(2);
    } else if (borrowedUSD === 0 && suppliedUSD > 0) {
      healthFactor = '∞';
    }

    const netWorth = suppliedUSD - borrowedUSD;

    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      netWorth: netWorth,
      suppliedUSD: suppliedUSD,
      borrowedUSD: borrowedUSD,
      collateralUSD: collateralUSD,
      healthFactor: healthFactor,
      assets: assets,
      borrows: borrows,
      rawData: data.userReserves.length,
      note: 'Реальные данные из Aave V3 subgraph'
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { 
      error: e.message || 'Server error',
      details: 'Проверьте адрес или попробуйте позже'
    });
  }
};
