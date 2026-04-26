// Aave V3 - текущая версия с мок-данными
// TODO: Добавить реальную интеграцию через Aave Lens или subgraph

const ALCHEMY_URL = 'https://arb-mainnet.g.alchemy.com/v2/ksyAQZ9F6Th6bIhUspYkKn-CeIUqyXcu';

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

// Реальные данные пользователя (обновляются вручную)
const USER_DATA = {
  '0xc863b4ba2173e84d9549fcb7ef09caecaca99714': {
    netWorth: 191.86,
    suppliedUSD: 237.38,
    borrowedUSD: 45.52,
    collateralUSD: 237.38,
    healthFactor: 3.28,
    rewards: 0.34,
    assets: [
      { 
        symbol: 'ARB', 
        role: 'collateral', 
        amount: '1824.60', 
        usdValue: 237.38,
        apy: 0.09
      }
    ],
    borrows: [
      {
        symbol: 'USD₮0',
        amount: '45.51',
        usdValue: 45.52,
        apy: 6.67
      }
    ]
  }
};

exports.handler = async function(event, context) {
  try {
    const body = JSON.parse(event.body || '{}');
    const wallet = body.wallet;
    const chain = body.chain || 'arbitrum';

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    const walletLower = wallet.toLowerCase();
    
    // Проверяем известные адреса
    const userData = USER_DATA[walletLower];
    
    if (userData) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        ...userData,
        note: 'Данные из кэша. Для автоматического обновления требуется Aave Lens API.'
      });
    }

    // Для новых адресов - заглушка
    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      netWorth: 0,
      suppliedUSD: 0,
      borrowedUSD: 0,
      healthFactor: null,
      assets: [],
      borrows: [],
      note: 'Адрес не найден в базе. Добавьте адрес в USER_DATA для отображения.',
      knownAddresses: Object.keys(USER_DATA)
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { error: e.message || 'Server error' });
  }
};
