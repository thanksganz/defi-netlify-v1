// Aave V3 - рабочий MVP с мок-данными
// Для реальных данных нужно подключить Web3 провайдер

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

// Мок-данные для демонстрации (ключи уже в lowercase)
const MOCK_POSITIONS = {
  '0x863b4ba2173e84d9549fcb7ef09caecaca99714': {
    suppliedUSD: 15420.50,
    borrowedUSD: 8750.00,
    collateralUSD: 15420.50,
    healthFactor: 1.42,
    assets: [
      { symbol: 'USDC', role: 'supply', amount: '5000.00', usdValue: 5000.00 },
      { symbol: 'WETH', role: 'collateral', amount: '3.25', usdValue: 10420.50 },
      { symbol: 'USDT', role: 'borrow', amount: '4500.00', usdValue: 4500.00 },
      { symbol: 'DAI', role: 'borrow', amount: '4250.00', usdValue: 4250.00 }
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
    
    // Проверяем мок-данные
    var mockData = MOCK_POSITIONS[walletLower];
    
    if (mockData) {
      return json(200, {
        protocol: 'Aave V3',
        chain: chain,
        suppliedUSD: mockData.suppliedUSD,
        borrowedUSD: mockData.borrowedUSD,
        collateralUSD: mockData.collateralUSD,
        healthFactor: mockData.healthFactor,
        assets: mockData.assets,
        note: 'Демо-данные. Для реальных данных нужен Web3 провайдер.'
      });
    }

    // Для других адресов - шаблон
    return json(200, {
      protocol: 'Aave V3',
      chain: chain,
      suppliedUSD: 0,
      borrowedUSD: 0,
      collateralUSD: 0,
      healthFactor: null,
      assets: [],
      note: 'Адрес не найден в демо-базе. Для реальных данных необходимо подключить Web3 провайдер.',
      demoAddress: '0x863B4ba2173E84d9549fCb7ef09cAECAca99714'
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { error: e.message || 'Server error' });
  }
};
