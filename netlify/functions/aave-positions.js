const AAVE_GRAPHQL = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum';

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

    const walletLower = wallet.toLowerCase();

    // Получаем позиции пользователя
    const positionsQuery = `
      query UserReserves($userAddress: String!) {
        userReserves(where: {user: $userAddress}) {
          id
          reserve {
            symbol
            name
            underlyingAsset
            price {
              priceInEth
              oracle {
                usdPriceEth
              }
            }
          }
          currentATokenBalance
          currentVariableDebt
          currentStableDebt
          usageAsCollateralEnabledOnUser
        }
      }
    `;

    const data = await gql(positionsQuery, { userAddress: walletLower });
    const reserves = data.userReserves || [];

    if (reserves.length === 0) {
      return json(200, {
        protocol: 'Aave V3',
        chain,
        suppliedUSD: 0,
        borrowedUSD: 0,
        collateralUSD: 0,
        healthFactor: null,
        assets: [],
        note: 'Нет позиций в Aave V3 на Arbitrum'
      });
    }

    let suppliedUSD = 0;
    let borrowedUSD = 0;
    let collateralUSD = 0;
    const assets = [];

    for (const r of reserves) {
      const reserve = r.reserve;
      const supplyAmount = parseFloat(r.currentATokenBalance) / 1e18;
      const borrowAmount = (parseFloat(r.currentVariableDebt) + parseFloat(r.currentStableDebt)) / 1e18;
      
      // Получаем цену в USD
      let priceUSD = 0;
      if (reserve.price && reserve.price.priceInEth && reserve.price.oracle?.usdPriceEth) {
        const priceInEth = parseFloat(reserve.price.priceInEth);
        const usdPriceEth = parseFloat(reserve.price.oracle.usdPriceEth);
        priceUSD = priceInEth * usdPriceEth / 1e18;
      }

      const supplyUSD = supplyAmount * priceUSD;
      const borrowUSD = borrowAmount * priceUSD;

      suppliedUSD += supplyUSD;
      borrowedUSD += borrowUSD;
      if (r.usageAsCollateralEnabledOnUser && supplyAmount > 0) {
        collateralUSD += supplyUSD;
      }

      if (supplyAmount > 0) {
        assets.push({
          symbol: reserve.symbol,
          role: r.usageAsCollateralEnabledOnUser ? 'collateral' : 'supply',
          amount: supplyAmount.toFixed(6),
          usdValue: supplyUSD
        });
      }

      if (borrowAmount > 0) {
        assets.push({
          symbol: reserve.symbol,
          role: 'borrow',
          amount: borrowAmount.toFixed(6),
          usdValue: borrowUSD
        });
      }
    }

    // Расчет Health Factor (упрощенный)
    let healthFactor = null;
    if (borrowedUSD > 0 && collateralUSD > 0) {
      // Примерный расчет с LT 80%
      healthFactor = (collateralUSD * 0.8 / borrowedUSD).toFixed(2);
    }

    return json(200, {
      protocol: 'Aave V3',
      chain,
      suppliedUSD,
      borrowedUSD,
      collateralUSD,
      healthFactor,
      assets
    });

  } catch (e) {
    return json(500, { error: e.message || 'Server error' });
  }
};
