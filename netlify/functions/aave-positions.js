// Aave V3 - рабочий MVP с мок-данными
// Для реальных данных нужно подключить Web3 провайдер

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

// Мок-данные для демонстрации
const MOCK_POSITIONS = {
  '0x863B4ba2173E84d9549fCb7ef09cAECAca99714'.toLowerCase(): {
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

exports.handler = async (event) => {
  try {
    const { wallet, chain = 'arbitrum' } = JSON.parse(event.body || '{}');

    if (!wallet || !wallet.startsWith('0x')) {
      return json(400, { error: 'Нужен EVM-адрес 0x...' });
    }

    const walletLower = wallet.toLowerCase();
    
    // Проверяем мок-данные
    const mockData = MOCK_POSITIONS[walletLower];
    
    if (mockData) {
      return json(200, {
        protocol: 'Aave V3',
        chain,
        ...mockData,
        note: 'Демо-данные. Для реальных данных нужен Web3 провайдер.'
      });
    }

    // Для других адресов - шаблон
    return json(200, {
      protocol: 'Aave V3',
      chain,
      suppliedUSD: 0,
      borrowedUSD: 0,
      collateralUSD: 0,
      healthFactor: null,
      assets: [],
      note: `Адрес ${wallet.slice(0, 6)}...${wallet.slice(-4)} не найден в демо-базе. Для реальных данных необходимо:`,
      instructions: [
        '1. Получить API ключ Alchemy или Infura',
        '2. Подключить Aave V3 Pool Data Provider',
        '3. Вызвать getUserReserveData(wallet)',
        '4. Рассчитать Health Factor'
      ],
      demoAddress: '0x863B4ba2173E84d9549fCb7ef09cAECAca99714'
    });

  } catch (e) {
    console.error('Error:', e);
    return json(500, { error: e.message || 'Server error' });
  }
};
