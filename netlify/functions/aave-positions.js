// Aave V3 - рабочий MVP с мок-данными
// Обновлено под реальные позиции пользователя

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

// Реальные данные пользователя (Arbitrum)
const MOCK_POSITIONS = {
  '0xc863b4ba2173e84d9549fcb7ef09caecaca99714': {
    netWorth: 191.86,
    netAPY: -1.47,
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
  },
  // Демо-адрес для тестирования
  '0x863b4ba2173e84d9549fcb7ef09caecaca99714': {
    netWorth: 191.86,
    suppliedUSD: 237.38,
    borrowedUSD: 45.52,
    collateralUSD: 237.38,
    healthFactor: 3.28,
    assets: [
      { symbol: 'ARB', role: 'collateral', amount: '1824.60', usdValue: 237.38 }
    ],
    borrows: [
      { symbol: 'USD₮0', amount: '45.51', usdValue: 45.52 }
    ]
  }
};

exports.handler = async function(event, context) {
  try {
    var body = JSON.parse(event.body || '{}');
    var wallet = body.wallet;
    var chain = body.chain || 'arbitrum';

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    var walletLower = wallet.toLowerCase();
    
    var mockData = MOCK_POSITIONS[walletLower];
    
    if (mockData) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        netWorth: mockData.netWorth,
        suppliedUSD: mockData.suppliedUSD,
        borrowedUSD: mockData.borrowedUSD,
        collateralUSD: mockData.collateralUSD,
        healthFactor: mockData.healthFactor,
        assets: mockData.assets,
        borrows: mockData.borrows || [],
        note: 'Мок-данные соответствуют реальным позициям из app.aave.com'
      });
    }

    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      suppliedUSD: 0,
      borrowedUSD: 0,
      collateralUSD: 0,
      healthFactor: null,
      assets: [],
      note: 'Адрес не найден. Добавь свой адрес в мок-данные для тестирования.'
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { error: e.message || 'Server error' });
  }
};
