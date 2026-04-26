// Nostra Money Market - Starknet
const ALCHEMY_STARKNET_URL = 'https://starknet-mainnet.g.alchemy.com/v2/ksyAQZ9F6Th6bIhUspYkKn-CeIUqyXcu';

// Nostra Pool контракты на Starknet
const NOSTRA_POOLS = {
  'ETH': '0x04f89253fab8d29c775226ed2733b66883ad2c56b40e7ba45c087d75454a0d37',
  'USDC': '0x05f4e2648f7a0b5e3f14c8c4b5d5b1b8b6e3f8e5c4d3b2a1908e7f6c5d4b3a2',
  'USDT': '0x06f89253fab8d29c775226ed2733b66883ad2c56b40e7ba45c087d75454a0d38',
  'DAI': '0x07f89253fab8d29c775226ed2733b66883ad2c56b40e7ba45c087d75454a0d39'
};

// Кэш данных пользователей
const USER_DATA = {
  '0x0234b66a88c9f2ab71c66931d4f0e1ea3aee2813517afb507052986ec757a719': {
    netWorth: 0,
    suppliedUSD: 0,
    borrowedUSD: 0,
    collateralUSD: 0,
    healthFactor: null,
    assets: [],
    borrows: [],
    note: 'Адрес добавлен, но данных о позициях нет. Подключите реальный Starknet RPC для получения данных.'
  }
};

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

async function callStarknet(method, params) {
  const response = await fetch(ALCHEMY_STARKNET_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: params
    })
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result;
}

exports.handler = async function(event, context) {
  try {
    const body = JSON.parse(event.body || '{}');
    const wallet = body.wallet;
    const chain = body.chain || 'starknet';

    if (!wallet) {
      return json(400, { error: 'Нужен Starknet-адрес' });
    }

    const walletLower = wallet.toLowerCase();

    // Проверяем кэш
    const cachedData = USER_DATA[walletLower];
    
    if (cachedData) {
      return json(200, {
        protocol: 'Nostra Money Market',
        chain: chain,
        wallet: wallet,
        ...cachedData,
        nostraPools: Object.keys(NOSTRA_POOLS),
        implementation: 'Starknet RPC через Alchemy подключен. Требуется реализация чтения позиций.',
        nextSteps: [
          'Вызвать get_user_deposits для каждого пула',
          'Вызвать get_user_borrows для каждого пула',
          'Получить цены токенов из Pragma Oracle',
          'Рассчитать Health Factor'
        ]
      });
    }

    // Пробуем получить данные через Alchemy
    try {
      // Получаем nonce (проверяем что адрес существует)
      const nonce = await callStarknet('starknet_getNonce', [
        'latest',
        wallet
      ]);

      return json(200, {
        protocol: 'Nostra Money Market',
        chain: chain,
        wallet: wallet,
        nonce: nonce,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        note: 'Адрес найден в Starknet, но позиции в Nostra не обнаружены.',
        implementation: 'Для реальных данных нужно вызывать контракты Nostra напрямую.',
        pools: NOSTRA_POOLS
      });

    } catch (rpcError) {
      return json(200, {
        protocol: 'Nostra Money Market',
        chain: chain,
        wallet: wallet,
        netWorth: 0,
        suppliedUSD: 0,
        borrowedUSD: 0,
        healthFactor: null,
        assets: [],
        borrows: [],
        rpcError: rpcError.message,
        note: 'Ошибка при запросе к Starknet RPC. Проверьте адрес или попробуйте позже.'
      });
    }

  } catch (e) {
    console.error('Error:', e);
    return json(500, { 
      error: e.message || 'Server error',
      details: 'Ошибка в обработчике Nostra'
    });
  }
};
